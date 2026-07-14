import { NextRequest, NextResponse } from "next/server";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

type PushProvider = "expo" | "fcm" | "apns" | "capacitor";
type PushPlatform = "ios" | "android" | "web" | "unknown";

const providerValues = new Set<PushProvider>(["expo", "fcm", "apns", "capacitor"]);
const platformValues = new Set<PushPlatform>(["ios", "android", "web", "unknown"]);

function normalizeProvider(value: unknown): PushProvider {
  return typeof value === "string" && providerValues.has(value as PushProvider) ? (value as PushProvider) : "expo";
}

function normalizePlatform(value: unknown): PushPlatform {
  return typeof value === "string" && platformValues.has(value as PushPlatform) ? (value as PushPlatform) : "unknown";
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function assertStaffMemberBelongsToShop(staffMemberId: string | null, shopId: string) {
  if (!staffMemberId) return null;

  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("푸시 토큰 저장소 설정을 확인해 주세요.", 503);

  const result = await admin
    .from("staff_members")
    .select("id")
    .eq("id", staffMemberId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (result.error) throw new OwnerApiError(result.error.message, 500);
  if (!result.data) throw new OwnerApiError("해당 매장 직원 정보를 찾을 수 없습니다.", 400);

  return staffMemberId;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestedShopId = normalizeOptionalString(body?.shopId) ?? undefined;
    const pushToken = normalizeOptionalString(body?.pushToken);

    if (!requestedShopId) {
      throw new OwnerApiError("매장 정보가 필요합니다.", 400);
    }

    if (!pushToken) {
      throw new OwnerApiError("푸시 토큰이 필요합니다.", 400);
    }

    const owner = await requireOwnerShop(request, requestedShopId);
    const provider = normalizeProvider(body?.provider);
    const platform = normalizePlatform(body?.platform);
    const staffMemberId = await assertStaffMemberBelongsToShop(normalizeOptionalString(body?.staffMemberId), owner.shopId);

    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({
        mode: "mock",
        registered: true,
        shopId: owner.shopId,
        provider,
        platform,
        pushToken,
        staffMemberId,
      });
    }

    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("푸시 토큰 저장소 설정을 확인해 주세요.", 503);

    const now = new Date().toISOString();
    const result = await admin
      .from("owner_push_tokens")
      .upsert(
        {
          shop_id: owner.shopId,
          owner_user_id: owner.userId,
          staff_member_id: staffMemberId,
          provider,
          platform,
          push_token: pushToken,
          device_id: normalizeOptionalString(body?.deviceId),
          device_name: normalizeOptionalString(body?.deviceName),
          app_id: normalizeOptionalString(body?.appId),
          app_version: normalizeOptionalString(body?.appVersion),
          locale: normalizeOptionalString(body?.locale),
          timezone: normalizeOptionalString(body?.timezone),
          enabled: true,
          disabled_at: null,
          last_registered_at: now,
          last_seen_at: now,
          updated_at: now,
          metadata: normalizeMetadata(body?.metadata),
        },
        {
          onConflict: "provider,push_token",
        },
      )
      .select("id,shop_id,owner_user_id,staff_member_id,provider,platform,enabled,last_registered_at")
      .single();

    if (result.error) {
      throw new OwnerApiError(result.error.message, 500);
    }

    return NextResponse.json({
      registered: true,
      token: result.data,
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "푸시 토큰을 등록하지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedShopId = normalizeOptionalString(body?.shopId) ?? undefined;
    const pushToken = normalizeOptionalString(body?.pushToken);
    const deviceId = normalizeOptionalString(body?.deviceId);

    if (!requestedShopId) {
      throw new OwnerApiError("매장 정보가 필요합니다.", 400);
    }

    if (!pushToken && !deviceId) {
      throw new OwnerApiError("비활성화할 푸시 토큰 또는 디바이스 ID가 필요합니다.", 400);
    }

    const owner = await requireOwnerShop(request, requestedShopId);

    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({
        mode: "mock",
        deactivated: true,
        shopId: owner.shopId,
        pushToken,
        deviceId,
      });
    }

    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("푸시 토큰 저장소 설정을 확인해 주세요.", 503);

    const now = new Date().toISOString();
    let query = admin
      .from("owner_push_tokens")
      .update({
        enabled: false,
        disabled_at: now,
        updated_at: now,
      })
      .eq("shop_id", owner.shopId)
      .eq("owner_user_id", owner.userId);

    query = pushToken ? query.eq("push_token", pushToken) : query.eq("device_id", deviceId);

    const result = await query.select("id");
    if (result.error) {
      throw new OwnerApiError(result.error.message, 500);
    }

    return NextResponse.json({
      deactivated: true,
      count: result.data?.length ?? 0,
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "푸시 토큰을 비활성화하지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
