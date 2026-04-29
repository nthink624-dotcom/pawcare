import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hashIdentityStableValue } from "@/lib/auth/owner-identity";
import {
  buildOwnerAuthEmail,
  isValidBirthDate8,
  isValidOwnerLoginId,
  isValidOwnerPassword,
  normalizeOwnerLoginId,
  ownerPasswordRuleMessage,
} from "@/lib/auth/owner-credentials";
import { OWNER_SIGNUP_TERMS_VERSION } from "@/lib/auth/owner-signup-terms";
import { OWNER_TRIAL_DAYS } from "@/lib/billing/owner-subscription";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { defaultShopNotificationSettings } from "@/lib/notification-settings";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { nowIso } from "@/lib/utils";
import { consumeVerifiedIdentity, getVerifiedIdentityForToken } from "@/server/owner-identity-verification";

const schema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(6),
  passwordConfirm: z.string().min(6),
  name: z.string().min(1),
  birthDate: z.string().min(8).max(8),
  phoneNumber: z.string().min(10).max(11),
  identityVerificationToken: z.string().min(1),
  shopName: z.string().min(1),
  shopPhone: z.string().min(10).max(11),
  shopAddress: z.string().min(1),
  agreements: z.object({
    service: z.boolean(),
    privacy: z.boolean(),
    location: z.boolean(),
    marketing: z.boolean(),
  }),
  termsVersion: z.string().optional(),
});

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidPhoneNumber(value: string) {
  return /^01\d{8,9}$/.test(normalizePhoneNumber(value));
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 503 });
    }

    const body = await request.json();
    const payload = schema.parse({
      ...body,
      phoneNumber: normalizePhoneNumber(body?.phoneNumber ?? ""),
      shopPhone: normalizePhoneNumber(body?.shopPhone ?? ""),
    });

    const loginId = normalizeOwnerLoginId(payload.loginId);

    if (!isValidOwnerLoginId(loginId)) {
      return NextResponse.json(
        { message: "아이디는 영문 소문자, 숫자, 마침표(.), 하이픈(-), 밑줄(_) 조합으로 4자 이상 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!isValidOwnerPassword(payload.password)) {
      return NextResponse.json({ message: ownerPasswordRuleMessage }, { status: 400 });
    }

    if (payload.password !== payload.passwordConfirm) {
      return NextResponse.json({ message: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
    }

    if (!isValidBirthDate8(payload.birthDate)) {
      return NextResponse.json({ message: "생년월일은 8자리 숫자로 입력해 주세요." }, { status: 400 });
    }

    if (!isValidPhoneNumber(payload.phoneNumber)) {
      return NextResponse.json({ message: "휴대폰 번호를 올바르게 입력해 주세요." }, { status: 400 });
    }

    if (!isValidPhoneNumber(payload.shopPhone)) {
      return NextResponse.json({ message: "매장 연락처를 올바르게 입력해 주세요." }, { status: 400 });
    }

    if (!payload.agreements.service || !payload.agreements.privacy) {
      return NextResponse.json({ message: "필수 약관에 동의해 주세요." }, { status: 400 });
    }

    const verifiedIdentity = await getVerifiedIdentityForToken({
      verificationToken: payload.identityVerificationToken,
      purpose: "signup",
      expectedName: payload.name,
      expectedBirthDate: payload.birthDate,
      expectedPhoneNumber: payload.phoneNumber,
    });
    if (!verifiedIdentity) {
      return NextResponse.json({ message: "본인인증이 완료되지 않았습니다." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: "Supabase 관리자 클라이언트를 만들 수 없습니다." }, { status: 503 });
    }

    const duplicate = await supabase.from("owner_profiles").select("login_id").eq("login_id", loginId).maybeSingle();
    if (duplicate.data?.login_id) {
      return NextResponse.json({ message: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }

    const consumed = await consumeVerifiedIdentity({
      verificationId: verifiedIdentity.id,
      tokenId: verifiedIdentity.tokenId,
      action: "signup",
    });

    if (!consumed) {
      return NextResponse.json({ message: "이미 사용된 본인인증입니다. 다시 인증해 주세요." }, { status: 400 });
    }

    const authEmail = buildOwnerAuthEmail(loginId);
    const trialStartedAt = nowIso();
    const trialEndsAt = new Date(Date.now() + OWNER_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const createdUser = await supabase.auth.admin.createUser({
      email: authEmail,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        login_id: loginId,
        name: payload.name.trim(),
        subscription_status: "trialing",
        trial_started_at: trialStartedAt,
        trial_ends_at: trialEndsAt,
        next_billing_at: null,
        current_plan_code: "monthly",
        auto_renew_enabled: false,
        auto_renew_plan_code: "monthly",
        cancel_at_period_end: false,
        featured_plan_code: "yearly",
      },
    });

    if (createdUser.error || !createdUser.data.user) {
      const message = createdUser.error?.message || "회원가입 처리 중 문제가 발생했습니다.";
      return NextResponse.json(
        { message: message.includes("already") ? "이미 사용 중인 아이디입니다." : message },
        { status: message.includes("already") ? 409 : 400 },
      );
    }

    const user = createdUser.data.user;
    const shopId = `shop-${randomUUID().slice(0, 8)}`;
    const now = nowIso();

    const shopInsert = await supabase.from("shops").insert({
      id: shopId,
      owner_user_id: user.id,
      name: payload.shopName,
      phone: payload.shopPhone,
      address: payload.shopAddress,
      description: "",
      business_hours: {},
      regular_closed_days: [],
      temporary_closed_dates: [],
      concurrent_capacity: 2,
      booking_slot_interval_minutes: 30,
      booking_slot_offset_minutes: 0,
      approval_mode: "manual",
      notification_settings: defaultShopNotificationSettings,
      created_at: now,
      updated_at: now,
    });

    if (shopInsert.error) {
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json({ message: "매장 정보를 저장하지 못했습니다." }, { status: 400 });
    }

    const agreementPayload = {
      agreed_at: now,
      terms_version: payload.termsVersion || OWNER_SIGNUP_TERMS_VERSION,
      agreements: payload.agreements,
    };

    const profileInsert = await supabase.from("owner_profiles").upsert({
      user_id: user.id,
      shop_id: shopId,
      login_id: loginId,
      name: payload.name.trim(),
      birth_date: payload.birthDate,
      phone_number: payload.phoneNumber,
      ci_hash: verifiedIdentity.ci ? hashIdentityStableValue(verifiedIdentity.ci) : null,
      di_hash: verifiedIdentity.di ? hashIdentityStableValue(verifiedIdentity.di) : null,
      identity_verified_at: now,
      agreements: agreementPayload,
      created_at: now,
      updated_at: now,
    });

    if (profileInsert.error) {
      await supabase.from("shops").delete().eq("id", shopId);
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json(
        {
          message:
            profileInsert.error.code === "23505"
              ? "이미 사용 중인 아이디입니다."
              : "회원 정보를 저장하지 못했습니다.",
        },
        { status: profileInsert.error.code === "23505" ? 409 : 400 },
      );
    }

    return NextResponse.json({
      success: true,
      requiresEmailConfirmation: false,
      message: "회원가입이 완료되었습니다. 로그인 후 카드 등록 없이 2주 무료체험을 시작할 수 있어요. 무료체험 종료 후 자동결제되지는 않습니다.",
    });
  } catch {
    return NextResponse.json({ message: "회원가입 처리 중 문제가 발생했습니다." }, { status: 400 });
  }
}



