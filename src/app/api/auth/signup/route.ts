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
import { defaultOwnerBusinessHours, defaultOwnerRegularClosedDays } from "@/lib/owner-default-setup";
import { defaultShopNotificationSettings } from "@/lib/notification-settings";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { nowIso } from "@/lib/utils";
import { insertOwnerDefaultSetup } from "@/server/owner-default-setup";
import { consumeVerifiedIdentity, getVerifiedIdentityForToken } from "@/server/owner-identity-verification";
import { upsertOwnerShopMembership } from "@/server/owner-shop-memberships";

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

const duplicateAccountMessage = "이미 가입된 계정이 있어요. 아이디 찾기 또는 비밀번호 찾기를 이용해 주세요.";

function isMissingSchemaFieldError(error: { code?: string; message?: string } | null | undefined, fields: string[]) {
  const message = error?.message ?? "";
  return (
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    fields.some((field) => message.includes(field)) ||
    /schema cache|column .* does not exist|Could not find .* column/i.test(message)
  );
}

function logSignupIssue(stage: string, error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
  console.error("[owner-signup]", stage, message);
}

async function findExistingOwnerByIdentity(input: {
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  name: string;
  birthDate: string;
  phoneNumber: string;
  ciHash: string | null;
  diHash: string | null;
}) {
  const identityFilters = [
    input.ciHash ? `ci_hash.eq.${input.ciHash}` : null,
    input.diHash ? `di_hash.eq.${input.diHash}` : null,
  ].filter((value): value is string => Boolean(value));

  if (identityFilters.length > 0) {
    const identityResult = await input.supabase
      .from("owner_profiles")
      .select("login_id")
      .or(identityFilters.join(","))
      .limit(1)
      .maybeSingle<{ login_id: string }>();

    if (identityResult.error) {
      if (isMissingSchemaFieldError(identityResult.error, ["ci_hash", "di_hash"])) {
        logSignupIssue("identity-hash-columns-missing", identityResult.error.message);
      } else {
        throw new Error(identityResult.error.message || "가입된 계정 확인 중 문제가 발생했습니다.");
      }
    }

    if (identityResult.data?.login_id) {
      return identityResult.data;
    }
  }

  const profileResult = await input.supabase
    .from("owner_profiles")
    .select("login_id")
    .eq("name", input.name.trim())
    .eq("birth_date", input.birthDate)
    .eq("phone_number", input.phoneNumber)
    .limit(1)
    .maybeSingle<{ login_id: string }>();

  if (profileResult.error) {
    throw new Error(profileResult.error.message || "가입된 계정 확인 중 문제가 발생했습니다.");
  }

  return profileResult.data ?? null;
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

    const ciHash = verifiedIdentity.ci ? hashIdentityStableValue(verifiedIdentity.ci) : null;
    const diHash = verifiedIdentity.di ? hashIdentityStableValue(verifiedIdentity.di) : null;
    const existingOwner = await findExistingOwnerByIdentity({
      supabase,
      name: payload.name,
      birthDate: payload.birthDate,
      phoneNumber: payload.phoneNumber,
      ciHash,
      diHash,
    });

    if (existingOwner?.login_id) {
      return NextResponse.json({ message: duplicateAccountMessage }, { status: 409 });
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
        current_plan_code: "quarterly",
        auto_renew_enabled: false,
        auto_renew_plan_code: "quarterly",
        cancel_at_period_end: false,
        featured_plan_code: "quarterly",
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

    const shopPayload = {
      id: shopId,
      owner_user_id: user.id,
      name: payload.shopName,
      phone: payload.shopPhone,
      address: payload.shopAddress,
      description: "",
      business_hours: defaultOwnerBusinessHours,
      regular_closed_days: defaultOwnerRegularClosedDays,
      temporary_closed_dates: [],
      concurrent_capacity: 1,
      booking_slot_interval_minutes: 30,
      booking_slot_offset_minutes: 0,
      approval_mode: "manual",
      notification_settings: defaultShopNotificationSettings,
      created_at: now,
      updated_at: now,
    };

    let shopInsert = await supabase.from("shops").insert(shopPayload);

    if (shopInsert.error && isMissingSchemaFieldError(shopInsert.error, ["booking_slot_interval_minutes", "booking_slot_offset_minutes"])) {
      logSignupIssue("shop-booking-slot-columns-missing", shopInsert.error.message);
      const { booking_slot_interval_minutes, booking_slot_offset_minutes, ...fallbackShopPayload } = shopPayload;
      shopInsert = await supabase.from("shops").insert(fallbackShopPayload);
    }

    if (shopInsert.error) {
      logSignupIssue("shop-insert-failed", shopInsert.error.message);
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json({ message: "매장 정보를 저장하지 못했습니다." }, { status: 400 });
    }

    try {
      await insertOwnerDefaultSetup(supabase, {
        shopId,
        ownerName: payload.name.trim(),
        ownerPhone: payload.phoneNumber,
        now,
      });
    } catch (error) {
      logSignupIssue("default-setup-failed", error);
      await supabase.from("shops").delete().eq("id", shopId);
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json({ message: "기본 운영 정보를 저장하지 못했습니다." }, { status: 400 });
    }

    const agreementPayload = {
      agreed_at: now,
      terms_version: payload.termsVersion || OWNER_SIGNUP_TERMS_VERSION,
      agreements: payload.agreements,
    };

    const profilePayload = {
      user_id: user.id,
      shop_id: shopId,
      login_id: loginId,
      name: payload.name.trim(),
      birth_date: payload.birthDate,
      phone_number: payload.phoneNumber,
      ci_hash: ciHash,
      di_hash: diHash,
      identity_verified_at: now,
      agreements: agreementPayload,
      created_at: now,
      updated_at: now,
    };

    let profileInsert = await supabase.from("owner_profiles").upsert(profilePayload);

    if (profileInsert.error && isMissingSchemaFieldError(profileInsert.error, ["ci_hash", "di_hash"])) {
      logSignupIssue("profile-identity-hash-columns-missing", profileInsert.error.message);
      const { ci_hash, di_hash, ...fallbackProfilePayload } = profilePayload;
      profileInsert = await supabase.from("owner_profiles").upsert(fallbackProfilePayload);
    }

    if (profileInsert.error) {
      logSignupIssue("profile-insert-failed", profileInsert.error.message);
      await supabase.from("shops").delete().eq("id", shopId);
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json(
        {
          message:
            profileInsert.error.code === "23505"
              ? "이미 사용 중인 아이디이거나 이미 가입된 계정입니다. 아이디 찾기 또는 비밀번호 찾기를 이용해 주세요."
              : "회원 정보를 저장하지 못했습니다.",
        },
        { status: profileInsert.error.code === "23505" ? 409 : 400 },
      );
    }

    try {
      await upsertOwnerShopMembership(supabase, {
        ownerUserId: user.id,
        shopId,
        isPrimary: true,
        now,
      });
    } catch {
      await supabase.from("owner_profiles").delete().eq("user_id", user.id);
      await supabase.from("shops").delete().eq("id", shopId);
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json({ message: "매장 소유권 정보를 저장하지 못했습니다." }, { status: 400 });
    }

    const consumed = await consumeVerifiedIdentity({
      verificationId: verifiedIdentity.id,
      tokenId: verifiedIdentity.tokenId,
      action: "signup",
    });

    if (!consumed) {
      await supabase.from("owner_profiles").delete().eq("user_id", user.id);
      await supabase.from("shops").delete().eq("id", shopId);
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json({ message: "이미 사용된 본인인증입니다. 다시 인증해 주세요." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      requiresEmailConfirmation: false,
      message: "회원가입이 완료되었습니다. 로그인 후 카드 등록 없이 2주 무료체험을 시작할 수 있어요. 무료체험 종료 후 자동결제되지는 않습니다.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "입력 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("not sent")) {
      return NextResponse.json({ message: "회원가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    }

    return NextResponse.json({ message: "회원가입 처리 중 문제가 발생했습니다." }, { status: 400 });
  }
}



