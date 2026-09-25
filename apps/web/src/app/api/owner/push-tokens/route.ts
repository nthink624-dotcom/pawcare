import { NextRequest } from "next/server";
import { z } from "zod";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const PUSH_TOKEN_CORS = { methods: "POST, DELETE, OPTIONS" };

const providerSchema = z.enum(["expo", "fcm", "apns", "capacitor"]);
const platformSchema = z.enum(["ios", "android", "web", "unknown"]);
const optionalText = (maxLength: number) => z.string().trim().min(1).max(maxLength).nullable().optional();

const metadataSchema = z.object({
  appRole: z.enum(["owner", "staff"]).optional(),
  bookingRequestedEnabled: z.boolean().optional(),
  alertMode: z.enum(["sound", "vibrate", "silent"]).optional(),
  androidChannelId: z.enum([
    "owner-bookings-sound-v1",
    "owner-bookings-vibrate-v1",
    "owner-bookings-silent-v1",
  ]).optional(),
}).strict().optional().default({});

const registerSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  pushToken: z.string().trim().min(1).max(4096),
  provider: providerSchema,
  platform: platformSchema,
  deviceId: optionalText(160),
  appId: optionalText(160),
  appVersion: optionalText(80),
  locale: optionalText(40),
  timezone: optionalText(80),
  staffMemberId: optionalText(120),
  metadata: metadataSchema,
}).strict();

const deactivateSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  pushToken: z.string().trim().min(1).max(4096).optional(),
  deviceId: z.string().trim().min(1).max(160).optional(),
}).strict().refine((value) => Boolean(value.pushToken || value.deviceId), {
  message: "푸시 토큰 또는 디바이스 ID가 필요합니다.",
});

function nullableText(value: string | null | undefined) {
  return value ?? null;
}

function pushStorageError(error: { code?: string } | null | undefined) {
  if (error?.code === "23505") {
    return new OwnerApiError("이미 다른 매장에 연결된 알림 기기입니다.", 409);
  }
  return new OwnerApiError("알림 기기 정보를 저장하지 못했습니다.", 500);
}

async function resolveScopedStaffMemberId(params: {
  shopId: string;
  userId: string;
  role: "owner" | "manager" | "staff";
  ownerStaffId: string | null;
  requestedStaffId: string | null;
}) {
  if (params.role === "staff") {
    if (!params.ownerStaffId || (params.requestedStaffId && params.requestedStaffId !== params.ownerStaffId)) {
      throw new OwnerApiError("현재 직원 계정에 연결된 알림 기기만 등록할 수 있습니다.", 403);
    }
    return params.ownerStaffId;
  }

  if (params.requestedStaffId) {
    throw new OwnerApiError("대표 또는 매니저 계정은 다른 직원의 알림 기기를 등록할 수 없습니다.", 403);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const input = registerSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    await assertOwnerInitialSetupComplete(owner.shopId);

    if (!hasSupabaseServerEnv()) {
      return ownerMobileCorsJson(request, {
        mode: "mock",
        registered: true,
        provider: input.provider,
        platform: input.platform,
        staleDeactivated: 0,
      }, undefined, PUSH_TOKEN_CORS);
    }

    if (!owner.userId) {
      throw new OwnerApiError("로그인이 필요합니다.", 401);
    }

    const staffMemberId = await resolveScopedStaffMemberId({
      shopId: owner.shopId,
      userId: owner.userId,
      role: owner.role,
      ownerStaffId: owner.staffId,
      requestedStaffId: nullableText(input.staffMemberId),
    });
    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("푸시 토큰 저장소 설정을 확인해 주세요.", 503);

    const existing = await admin
      .from("owner_push_tokens")
      .select("id,shop_id,owner_user_id")
      .eq("provider", input.provider)
      .eq("push_token", input.pushToken)
      .maybeSingle();
    if (existing.error) throw pushStorageError(existing.error);
    if (existing.data && (existing.data.shop_id !== owner.shopId || existing.data.owner_user_id !== owner.userId)) {
      throw new OwnerApiError("이미 다른 매장에 연결된 알림 기기입니다.", 409);
    }

    const now = new Date().toISOString();
    let staleDeactivated = 0;
    if (input.deviceId) {
      const stale = await admin
        .from("owner_push_tokens")
        .update({ enabled: false, disabled_at: now, updated_at: now })
        .eq("shop_id", owner.shopId)
        .eq("owner_user_id", owner.userId)
        .eq("device_id", input.deviceId)
        .neq("push_token", input.pushToken)
        .eq("enabled", true)
        .select("id");
      if (stale.error) throw pushStorageError(stale.error);
      staleDeactivated = stale.data?.length ?? 0;
    }

    const record = {
      shop_id: owner.shopId,
      owner_user_id: owner.userId,
      staff_member_id: staffMemberId,
      provider: input.provider,
      platform: input.platform,
      push_token: input.pushToken,
      device_id: nullableText(input.deviceId),
      app_id: nullableText(input.appId),
      app_version: nullableText(input.appVersion),
      locale: nullableText(input.locale),
      timezone: nullableText(input.timezone),
      enabled: true,
      disabled_at: null,
      last_registered_at: now,
      last_seen_at: now,
      updated_at: now,
      metadata: input.metadata,
    };

    const saved = existing.data
      ? await admin
          .from("owner_push_tokens")
          .update(record)
          .eq("id", existing.data.id)
          .eq("shop_id", owner.shopId)
          .eq("owner_user_id", owner.userId)
          .select("id")
          .maybeSingle()
      : await admin
          .from("owner_push_tokens")
          .insert(record)
          .select("id")
          .maybeSingle();
    if (saved.error || !saved.data) throw pushStorageError(saved.error);

    return ownerMobileCorsJson(request, {
      registered: true,
      provider: input.provider,
      platform: input.platform,
      staleDeactivated,
    }, undefined, PUSH_TOKEN_CORS);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "알림 기기 정보를 다시 확인해 주세요." }, { status: 400 }, PUSH_TOKEN_CORS);
    }
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, PUSH_TOKEN_CORS);
    }
    return ownerMobileCorsJson(request, { message: "알림 기기를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 }, PUSH_TOKEN_CORS);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const input = deactivateSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    await assertOwnerInitialSetupComplete(owner.shopId);

    if (!hasSupabaseServerEnv()) {
      return ownerMobileCorsJson(request, { mode: "mock", deactivated: true, count: 0 }, undefined, PUSH_TOKEN_CORS);
    }
    if (!owner.userId) throw new OwnerApiError("로그인이 필요합니다.", 401);

    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("푸시 토큰 저장소 설정을 확인해 주세요.", 503);

    let query = admin
      .from("owner_push_tokens")
      .update({ enabled: false, disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("shop_id", owner.shopId)
      .eq("owner_user_id", owner.userId)
      .eq("enabled", true);
    if (input.pushToken) query = query.eq("push_token", input.pushToken);
    if (input.deviceId) query = query.eq("device_id", input.deviceId);

    const deactivated = await query.select("id");
    if (deactivated.error) throw pushStorageError(deactivated.error);

    return ownerMobileCorsJson(request, {
      deactivated: true,
      count: deactivated.data?.length ?? 0,
    }, undefined, PUSH_TOKEN_CORS);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "알림 기기 정보를 다시 확인해 주세요." }, { status: 400 }, PUSH_TOKEN_CORS);
    }
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, PUSH_TOKEN_CORS);
    }
    return ownerMobileCorsJson(request, { message: "알림 기기를 해제하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 }, PUSH_TOKEN_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, PUSH_TOKEN_CORS);
}
