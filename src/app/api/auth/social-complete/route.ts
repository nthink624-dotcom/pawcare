import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "@/lib/env";
import { OWNER_SIGNUP_TERMS_VERSION } from "@/lib/auth/owner-signup-terms";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isValidBirthDate8 } from "@/lib/auth/owner-credentials";

const payloadSchema = z.object({
  name: z.string().trim().min(1),
  birthDate: z.string().trim().length(8),
  phoneNumber: z.string().trim().min(9).max(11),
  shopName: z.string().trim().min(1),
  shopAddress: z.string().trim().min(1),
  agreements: z.object({
    service: z.boolean(),
    privacy: z.boolean(),
    location: z.boolean(),
    marketing: z.boolean().optional().default(false),
  }),
  termsVersion: z.string().trim().optional(),
});

function nowIso() {
  return new Date().toISOString();
}

export async function POST(request: NextRequest) {
  try {
    if (!env.supabaseUrl || !env.supabasePublishableKey) {
      return NextResponse.json({ message: "Supabase 설정을 확인해 주세요." }, { status: 503 });
    }

    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "입력한 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    const payload = parsed.data;
    if (!isValidBirthDate8(payload.birthDate)) {
      return NextResponse.json({ message: "생년월일은 8자리 숫자로 입력해 주세요." }, { status: 400 });
    }

    if (!payload.agreements.service || !payload.agreements.privacy || !payload.agreements.location) {
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
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Supabase 서버 설정을 확인해 주세요." }, { status: 503 });
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
    const provider = typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "social";
    const loginId = `social_${provider}_${user.id.replace(/-/g, "").slice(0, 12)}`;

    const shopInsert = await admin.from("shops").insert({
      id: shopId,
      owner_user_id: user.id,
      name: payload.shopName,
      phone: payload.phoneNumber,
      address: payload.shopAddress,
      description: "",
      business_hours: {},
      regular_closed_days: [],
      temporary_closed_dates: [],
      concurrent_capacity: 1,
      approval_mode: "manual",
      created_at: now,
      updated_at: now,
    });

    if (shopInsert.error) {
      return NextResponse.json({ message: "매장 정보를 저장하지 못했습니다." }, { status: 400 });
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
      name: payload.name,
      birth_date: payload.birthDate,
      phone_number: payload.phoneNumber,
      identity_verified_at: null,
      agreements: agreementPayload,
      created_at: now,
      updated_at: now,
    });

    if (profileInsert.error) {
      await admin.from("shops").delete().eq("id", shopId);
      return NextResponse.json({ message: "회원 정보를 저장하지 못했습니다." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      shopId,
      message: "소셜 로그인 가입이 완료되었습니다. 바로 무료체험을 시작할 수 있어요.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가입 처리 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
