import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "@/lib/env";
import { resolveSocialProviderFromAuthUser } from "@/lib/auth/social-auth";
import { OWNER_SIGNUP_TERMS_VERSION } from "@/lib/auth/owner-signup-terms";
import { buildDefaultCustomerPageSettings } from "@/lib/customer-page-settings";
import { defaultOwnerBusinessHours, defaultOwnerRegularClosedDays } from "@/lib/owner-default-setup";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { defaultShopNotificationSettings } from "@/lib/notification-settings";
import { insertOwnerDefaultSetup } from "@/server/owner-default-setup";
import { upsertOwnerShopMembership } from "@/server/owner-shop-memberships";

function isValidShopPhone(value: string) {
  return /^(?:02\d{7,8}|0[3-6]\d{7,8}|070\d{7,8}|050\d{8}|01\d{8,9})$/.test(value);
}

const payloadSchema = z.object({
  ownerName: z.string().trim().min(1),
  phoneNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, "").slice(0, 11))
    .refine((value) => /^01\d{8,9}$/.test(value), {
      message: "휴대폰 번호를 올바르게 입력해 주세요.",
    }),
  shopName: z.string().trim().min(1),
  shopPhoneNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ?? "").replace(/\D/g, "").slice(0, 11))
    .refine((value) => !value || isValidShopPhone(value), {
      message: "매장 연락처를 올바르게 입력해 주세요.",
    }),
  shopAddress: z.string().trim().min(1),
  agreements: z.object({
    service: z.boolean(),
    privacy: z.boolean(),
    location: z.boolean().optional().default(false),
    marketing: z.boolean().optional().default(false),
  }),
  termsVersion: z.string().trim().optional(),
});

function nowIso() {
  return new Date().toISOString();
}

function readMetadataValue(source: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!source) return "";
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const domesticDigits = digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
  return domesticDigits.slice(0, 11);
}

function resolveOwnerName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName = readMetadataValue(user.user_metadata, ["name", "full_name", "nickname", "given_name"]);
  if (metadataName) return metadataName;

  const emailPrefix = user.email?.split("@")[0]?.trim();
  if (emailPrefix) return emailPrefix;

  return "사장님";
}

function resolvePhoneNumber(user: { phone?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadataPhone = readMetadataValue(user.user_metadata, ["phone", "phone_number", "phoneNumber"]);
  return normalizePhone(metadataPhone || user.phone || "");
}

export async function POST(request: NextRequest) {
  try {
    if (!env.supabaseUrl || !env.supabasePublishableKey) {
      return NextResponse.json({ message: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 503 });
    }

    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "매장 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    const payload = parsed.data;
    if (!payload.agreements.service || !payload.agreements.privacy) {
      return NextResponse.json({ message: "필수 약관에 동의해 주세요." }, { status: 400 });
    }

    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    const authClient = getSupabaseAuthClient();
    const bearerUserResult = token && authClient ? await authClient.auth.getUser(token) : null;

    const cookieStore = await cookies();
    const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        },
      },
    });

    const cookieUserResult = bearerUserResult?.data.user ? null : await supabase.auth.getUser();
    const user = bearerUserResult?.data.user ?? cookieUserResult?.data.user ?? null;
    const userError = bearerUserResult?.error ?? cookieUserResult?.error ?? null;

    if (userError || !user) {
      return NextResponse.json({ message: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Supabase 관리자 설정을 확인해 주세요." }, { status: 503 });
    }

    const existingShop = await admin
      .from("shops")
      .select("id")
      .eq("owner_user_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (existingShop.error) {
      return NextResponse.json({ message: existingShop.error.message }, { status: 500 });
    }

    if (existingShop.data?.id) {
      return NextResponse.json({ success: true, shopId: existingShop.data.id });
    }

    const shopId = `shop-${randomUUID().slice(0, 8)}`;
    const now = nowIso();
    const provider = resolveSocialProviderFromAuthUser(user);
    const loginId = `social_${provider}_${user.id.replace(/-/g, "").slice(0, 12)}`;
    const ownerName = payload.ownerName.trim() || resolveOwnerName(user);
    const ownerPhoneNumber = payload.phoneNumber || resolvePhoneNumber(user) || null;
    const shopPhoneNumber = payload.shopPhoneNumber || ownerPhoneNumber;

    const shopInsert = await admin.from("shops").insert({
      id: shopId,
      owner_user_id: user.id,
      name: payload.shopName,
      phone: shopPhoneNumber,
      address: payload.shopAddress,
      description: "",
      business_hours: defaultOwnerBusinessHours,
      regular_closed_days: defaultOwnerRegularClosedDays,
      temporary_closed_dates: [],
      concurrent_capacity: 1,
      booking_slot_interval_minutes: 30,
      booking_slot_offset_minutes: 0,
      booking_available_start_time: "10:00",
      booking_available_end_time: "17:00",
      approval_mode: "auto",
      notification_settings: defaultShopNotificationSettings,
      customer_page_settings: buildDefaultCustomerPageSettings({
        shopName: payload.shopName,
        description: "",
      }),
      created_at: now,
      updated_at: now,
    });

    if (shopInsert.error) {
      return NextResponse.json({ message: "매장 정보를 저장하지 못했어요." }, { status: 400 });
    }

    try {
      await insertOwnerDefaultSetup(admin, {
        shopId,
        ownerName,
        ownerPhone: ownerPhoneNumber,
        now,
      });
    } catch {
      await admin.from("shops").delete().eq("id", shopId);
      return NextResponse.json({ message: "기본 운영 정보를 저장하지 못했어요." }, { status: 400 });
    }

    const agreementPayload = {
      agreed_at: now,
      terms_version: payload.termsVersion || OWNER_SIGNUP_TERMS_VERSION,
      agreements: payload.agreements,
      ...(provider === "naver"
        ? {
            consent_source: "naver_login_plus",
            consent_provider: "naver",
          }
        : {}),
    };

    const profileInsert = await admin.from("owner_profiles").upsert({
      user_id: user.id,
      shop_id: shopId,
      login_id: loginId,
      name: ownerName,
      birth_date: null,
      phone_number: ownerPhoneNumber,
      identity_verified_at: null,
      agreements: agreementPayload,
      created_at: now,
      updated_at: now,
    });

    if (profileInsert.error) {
      await admin.from("shops").delete().eq("id", shopId);
      return NextResponse.json({ message: "사장님 정보를 저장하지 못했어요." }, { status: 400 });
    }

    try {
      await upsertOwnerShopMembership(admin, {
        ownerUserId: user.id,
        shopId,
        isPrimary: true,
        now,
      });
    } catch {
      await admin.from("owner_profiles").delete().eq("user_id", user.id);
      await admin.from("shops").delete().eq("id", shopId);
      return NextResponse.json({ message: "매장 소유권 정보를 저장하지 못했습니다." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      shopId,
      message: "소셜 로그인 정보 확인이 끝났어요. 이제 무료체험을 시작할 수 있어요.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "소셜 로그인 처리 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
