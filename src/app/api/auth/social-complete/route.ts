import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "@/lib/env";
import { resolveSocialProviderFromAuthUser } from "@/lib/auth/social-auth";
import { OWNER_SIGNUP_TERMS_VERSION } from "@/lib/auth/owner-signup-terms";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { defaultShopNotificationSettings } from "@/lib/notification-settings";

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
  return value.replace(/\D/g, "").slice(0, 11);
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ message: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Supabase 관리자 설정을 확인해 주세요." }, { status: 503 });
    }

    const existingShop = await admin.from("shops").select("id").eq("owner_user_id", user.id).maybeSingle();
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

    const shopInsert = await admin.from("shops").insert({
      id: shopId,
      owner_user_id: user.id,
      name: payload.shopName,
      phone: ownerPhoneNumber,
      address: payload.shopAddress,
      description: "",
      business_hours: {},
      regular_closed_days: [],
      temporary_closed_dates: [],
      concurrent_capacity: 1,
      approval_mode: "manual",
      notification_settings: defaultShopNotificationSettings,
      created_at: now,
      updated_at: now,
    });

    if (shopInsert.error) {
      return NextResponse.json({ message: "매장 정보를 저장하지 못했어요." }, { status: 400 });
    }

    const agreementPayload = {
      agreed_at: now,
      terms_version: payload.termsVersion || OWNER_SIGNUP_TERMS_VERSION,
      agreements: payload.agreements,
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
