import { createHmac, randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  acceptsAtomicOwnerSignupContract,
  ATOMIC_OWNER_SIGNUP_SUPPORTED_VERSIONS,
} from "@/lib/auth/atomic-signup-contract";
import {
  hashIdentityStableValue,
  buildOwnerMarketingBenefitShopIdentity,
  buildOwnerTrialPhoneIdentityKeys,
} from "@/lib/auth/owner-identity";
import {
  isValidBirthDate8,
  isValidOwnerEmail,
  isValidOwnerPassword,
  normalizeOwnerEmail,
  normalizeOwnerPhoneNumber,
  ownerPasswordRuleMessage,
} from "@/lib/auth/owner-credentials";
import {
  OWNER_MARKETING_CONSENT_DOCUMENT_VERSION,
  OWNER_SIGNUP_TERMS_VERSION,
} from "@/lib/auth/owner-signup-terms";
import { buildDefaultCustomerPageSettings } from "@/lib/customer-page-settings";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { defaultOwnerBusinessHours, defaultOwnerRegularClosedDays } from "@/lib/owner-default-setup";
import { defaultShopNotificationSettings } from "@/lib/notification-settings";
import { hasSupabaseServerEnv, ServerEnvError } from "@/lib/server-env";
import { nowIso } from "@/lib/utils";
import { getVerifiedIdentityForToken } from "@/server/owner-identity-verification";
import {
  orchestrateDevelopmentSignup,
  SignupFlowError,
  type SignupRequestRecord,
} from "@/server/signup-development-orchestration";
import { parseBoundedAtomicSignupJson, SignupJsonBodyError } from "@/server/signup-json-body";
import { bindMarketingAcquisitionToSignup } from "@/server/marketing-acquisition";
import {
  buildSignupServiceRpcPayload,
  parseSignupRequestPayload,
  SignupPriceGuideValidationError,
  type SignupRequestPayload,
} from "@/server/signup-price-guide-validation";

function isValidPhoneNumber(value: string) {
  return /^01\d{8,9}$/.test(normalizeOwnerPhoneNumber(value));
}

function isValidShopPhone(value: string) {
  return /^(?:02\d{7,8}|0[3-6]\d{7,8}|070\d{7,8}|050\d{8}|01\d{8,9})$/.test(normalizeOwnerPhoneNumber(value));
}

function logSignupIssue(stage: string, error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
  console.error("[owner-signup]", stage, message);
}

function buildSignupPayloadHash(payload: SignupRequestPayload) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OWNER_SESSION_SECRET;
  if (!secret) throw new Error("회원가입 요청 서명 환경 변수가 설정되지 않았습니다.");
  return createHmac("sha256", secret)
    .update(JSON.stringify({
      ...payload,
      passwordConfirm: undefined,
      servicePrices: [...payload.servicePrices].sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    if (!acceptsAtomicOwnerSignupContract(request.headers)) {
      return NextResponse.json(
        {
          code: "SIGNUP_CONTRACT_VERSION_UNSUPPORTED",
          message: "현재 앱에서는 안전한 회원가입을 진행할 수 없습니다. 앱을 업데이트한 뒤 다시 시도해 주세요.",
          supportedVersions: ATOMIC_OWNER_SIGNUP_SUPPORTED_VERSIONS,
        },
        { status: 426 },
      );
    }
    const decodedBody = await parseBoundedAtomicSignupJson(request);
    if (!decodedBody || typeof decodedBody !== "object" || Array.isArray(decodedBody)) {
      throw new SignupJsonBodyError("SIGNUP_BODY_INVALID", "회원가입 요청을 확인해 주세요.", 400);
    }
    const body = decodedBody as Record<string, unknown>;
    const payload = parseSignupRequestPayload(body);
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 503 });
    }

    const email = normalizeOwnerEmail(payload.email);

    if (!isValidOwnerEmail(email)) {
      return NextResponse.json(
        { message: "올바른 이메일 주소를 입력해 주세요." },
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

    if (!isValidShopPhone(payload.shopPhone)) {
      return NextResponse.json({ message: "매장 연락처를 올바르게 입력해 주세요." }, { status: 400 });
    }

    if (!payload.agreements.service || !payload.agreements.privacy) {
      return NextResponse.json({ message: "필수 약관에 동의해 주세요." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const authClient = getSupabaseAuthClient();
    if (!supabase || !authClient) {
      return NextResponse.json({ message: "Supabase 관리자 클라이언트를 만들 수 없습니다." }, { status: 503 });
    }
    const payloadHash = buildSignupPayloadHash(payload);
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

    const duplicate = await supabase.from("owner_profiles").select("login_id").eq("login_id", email).maybeSingle();
    if (duplicate.data?.login_id) {
      return NextResponse.json({ message: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }

    const ciHash = verifiedIdentity.ci ? hashIdentityStableValue(verifiedIdentity.ci) : null;
    const diHash = verifiedIdentity.di ? hashIdentityStableValue(verifiedIdentity.di) : null;
    const trialIdentity = buildOwnerTrialPhoneIdentityKeys(verifiedIdentity.phone_number);
    const marketingBenefitShopIdentity = buildOwnerMarketingBenefitShopIdentity({
      verifiedPhoneNumber: verifiedIdentity.phone_number,
      shopName: payload.shopName,
      shopPhone: payload.shopPhone,
      shopAddress: payload.shopAddress,
    });

    const shopId = `shop-${randomUUID().slice(0, 8)}`;
    const now = nowIso();
    const agreementPayload = {
      agreed_at: now,
      terms_version: OWNER_SIGNUP_TERMS_VERSION,
      marketing_consent_document_version: OWNER_MARKETING_CONSENT_DOCUMENT_VERSION,
      agreements: payload.agreements,
    };
    const normalizedServices = buildSignupServiceRpcPayload(payload, shopId);

    const orchestration = await orchestrateDevelopmentSignup({
      requestId: payload.signupRequestId,
      payloadHash,
      dependencies: {
        claimRequest: async ({ requestId, payloadHash: requestHash }) => {
          const result = await supabase.rpc("claim_owner_signup_v5", {
            p_signup_request_id: requestId,
            p_payload_hash: requestHash,
          });
          if (result.error) throw new Error(`ATOMIC_SIGNUP_MIGRATION_REQUIRED:${result.error.message}`);
          const value = result.data as {
            action?: "claimed" | "completed" | "in_progress" | "compensation_pending" | "payload_mismatch";
            status?: SignupRequestRecord["status"];
            authUserId?: string | null;
            shopId?: string | null;
            trialEligible?: boolean | null;
            trialDays?: 0 | 14 | 44 | null;
            billingRequired?: boolean | null;
          } | null;
          return {
            action: value?.action ?? "in_progress",
            record: value?.status
              ? {
                  requestId,
                  payloadHash: requestHash,
                  status: value.status,
                  authUserId: value.authUserId ?? null,
                  shopId: value.shopId ?? null,
                  trialEligible: value.trialEligible ?? null,
                  trialDays: value.trialDays ?? null,
                  billingRequired: value.billingRequired ?? null,
                }
              : null,
          };
        },
        createAuthUser: async () => {
          const createdUser = await supabase.auth.admin.createUser({
            email,
            password: payload.password,
            email_confirm: true,
            user_metadata: {
              login_id: email,
              name: payload.name.trim(),
              signup_request_id: payload.signupRequestId,
            },
          });
          if (createdUser.error || !createdUser.data.user) {
            const signupMessage = createdUser.error?.message || "회원가입 처리 중 문제가 발생했습니다.";
            throw new Error(signupMessage.includes("already") ? "이미 사용 중인 이메일입니다." : signupMessage);
          }
          return { userId: createdUser.data.user.id };
        },
        markAuthCreated: async ({ requestId, payloadHash: requestHash, authUserId }) => {
          const result = await supabase.rpc("mark_owner_signup_auth_created_v5", {
            p_signup_request_id: requestId,
            p_payload_hash: requestHash,
            p_auth_user_id: authUserId,
          });
          if (result.error) throw new Error(result.error.message);
        },
        writeAtomicSignup: async (authUserId) => {
          const result = await supabase.rpc("complete_owner_signup_v6", {
            p_signup_request_id: payload.signupRequestId,
            p_payload_hash: payloadHash,
            p_auth_user_id: authUserId,
            p_shop: {
              id: shopId,
              name: payload.shopName.trim(),
              phone: payload.shopPhone,
              address: payload.shopAddress,
              business_hours: defaultOwnerBusinessHours,
              regular_closed_days: defaultOwnerRegularClosedDays,
              notification_settings: defaultShopNotificationSettings,
              customer_page_settings: buildDefaultCustomerPageSettings({ shopName: payload.shopName, description: "" }),
            },
            p_profile: {
              login_id: email,
              name: payload.name.trim(),
              birth_date: payload.birthDate,
              phone_number: payload.phoneNumber,
              ci_hash: ciHash,
              di_hash: diHash,
              identity_verified_at: now,
              agreements: agreementPayload,
            },
            p_services: normalizedServices,
            p_staff: {
              name: payload.name.trim(),
              phone: payload.phoneNumber,
              role: "대표",
              position: "대표",
            },
            p_identity_verification_id: verifiedIdentity.id,
            p_identity_token_id: verifiedIdentity.tokenId,
            p_trial_identity_keys: trialIdentity.keys,
            p_trial_identity_current_version: trialIdentity.currentVersion,
            p_marketing_consent: payload.agreements.marketing,
            p_marketing_consent_document_version: OWNER_MARKETING_CONSENT_DOCUMENT_VERSION,
            p_marketing_consent_recorded_at: now,
            p_shop_identity_key_version: marketingBenefitShopIdentity.keyVersion,
            p_shop_identity_key: marketingBenefitShopIdentity.shopIdentityKey,
          });
          if (result.error) throw new Error(result.error.message);
          const value = result.data as {
            shopId?: string;
            reused?: boolean;
            trialEligible?: boolean;
            trialDays?: 0 | 14 | 44;
            billingRequired?: boolean;
          } | null;
          if (
            typeof value?.trialEligible !== "boolean" ||
            (value.trialDays !== 0 && value.trialDays !== 14 && value.trialDays !== 44) ||
            typeof value.billingRequired !== "boolean"
          ) {
            throw new Error("PM_SIGNUP_TRIAL_RESULT_MISSING");
          }
          return {
            shopId: value.shopId ?? shopId,
            reused: value.reused ?? false,
            trialEligible: value.trialEligible,
            trialDays: value.trialDays,
            billingRequired: value.billingRequired,
          };
        },
        deleteAuthUser: async (authUserId) => {
          const deleted = await supabase.auth.admin.deleteUser(authUserId);
          return !deleted.error;
        },
        markCompensationPending: async (record) => {
          await supabase.from("signup_idempotency_requests").upsert({
            signup_request_id: record.requestId,
            payload_hash: record.payloadHash,
            status: "compensation_pending",
            auth_user_id: record.authUserId,
            failure_reason: record.reason,
            updated_at: nowIso(),
          });
        },
        markFailureCompensated: async (record) => {
          await supabase.from("signup_idempotency_requests").upsert({
            signup_request_id: record.requestId,
            payload_hash: record.payloadHash,
            status: "failed_compensated",
            auth_user_id: null,
            failure_reason: record.reason,
            updated_at: nowIso(),
          });
        },
      },
    });

    await bindMarketingAcquisitionToSignup({
      request,
      signupRequestId: payload.signupRequestId,
      ownerUserId: orchestration.authUserId,
      shopId: orchestration.shopId,
    });

    const signInResult = await authClient.auth.signInWithPassword({ email, password: payload.password });
    if (signInResult.error || !signInResult.data.session) {
      logSignupIssue("initial-login-failed", signInResult.error?.message ?? "session_missing");
      return NextResponse.json({
        success: true,
        session: null,
        trial: { eligible: orchestration.trialEligible, days: orchestration.trialDays },
        billingRequired: orchestration.billingRequired,
        nextAction: orchestration.billingRequired ? "billing" : "initial_setup",
        message: orchestration.billingRequired
          ? "이 번호로 무료 체험을 이미 사용했습니다. 계속 이용하려면 결제를 진행해 주세요."
          : "회원가입이 완료됐어요. 이메일과 비밀번호로 로그인해 주세요.",
      });
    }

    return NextResponse.json({
      success: true,
      session: {
        accessToken: signInResult.data.session.access_token,
        refreshToken: signInResult.data.session.refresh_token,
      },
      trial: { eligible: orchestration.trialEligible, days: orchestration.trialDays },
      billingRequired: orchestration.billingRequired,
      nextAction: orchestration.billingRequired ? "billing" : "initial_setup",
      message: orchestration.billingRequired
        ? "이 번호로 무료 체험을 이미 사용했습니다. 계속 이용하려면 결제를 진행해 주세요."
        : orchestration.trialDays === 44
          ? "회원가입이 완료됐어요. 마케팅 수신 동의 30일이 추가되어 총 44일 무료 체험이 시작됐어요."
          : "회원가입이 완료됐어요. 14일 무료 체험이 시작됐어요.",
    });
  } catch (error) {
    if (error instanceof SignupJsonBodyError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
    }
    if (error instanceof SignupPriceGuideValidationError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
    }
    if (error instanceof SignupFlowError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
    }
    if (error instanceof ServerEnvError) {
      return NextResponse.json(
        { code: "SIGNUP_SECURITY_CONFIGURATION_REQUIRED", message: "회원가입 보안 설정을 확인하고 있습니다. 잠시 후 다시 시도해 주세요." },
        { status: error.status },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "입력 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("ATOMIC_SIGNUP_MIGRATION_REQUIRED:")) {
      return NextResponse.json(
        {
          code: "ATOMIC_SIGNUP_MIGRATION_REQUIRED",
          message: "Development 원자 가입 migration이 아직 적용되지 않아 가입 저장을 중단했습니다.",
        },
        { status: 503 },
      );
    }
    if (message.toLowerCase().includes("not sent")) {
      return NextResponse.json({ message: "회원가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    }

    return NextResponse.json({ message: "회원가입 처리 중 문제가 발생했습니다." }, { status: 400 });
  }
}



