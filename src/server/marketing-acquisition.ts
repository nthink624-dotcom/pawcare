import { createHash } from "node:crypto";

import type { NextRequest } from "next/server";

import {
  createOpaqueMarketingAcquisitionId,
  isMarketingAcquisitionId,
  type MarketingAcquisitionEventName,
  type MarketingAcquisitionSource,
} from "@/lib/marketing-acquisition";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const MARKETING_ACQUISITION_COOKIE = "pm_acquisition_id";
export const MARKETING_ACQUISITION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type MarketingAcquisitionWriteStatus =
  | "recorded"
  | "duplicate"
  | "schema_missing"
  | "not_bound"
  | "not_due"
  | "not_ready"
  | "rejected";

function isMissingMarketingAcquisitionSchema(error: DatabaseErrorLike | null | undefined) {
  const detail = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "42883" ||
    error?.code === "PGRST202" ||
    detail.includes("marketing_acquisition")
  );
}

function readRpcStatus(data: unknown): MarketingAcquisitionWriteStatus {
  if (data && typeof data === "object" && "status" in data) {
    const value = (data as { status?: unknown }).status;
    if (
      value === "recorded" ||
      value === "duplicate" ||
      value === "not_bound" ||
      value === "not_due" ||
      value === "not_ready" ||
      value === "rejected"
    ) return value;
  }
  return "recorded";
}

function buildStableEventKey(eventName: MarketingAcquisitionEventName, stableValue: string) {
  return `${eventName}:${createHash("sha256").update(stableValue).digest("hex")}`;
}

export function readMarketingAcquisitionId(request: NextRequest) {
  const value = request.cookies.get(MARKETING_ACQUISITION_COOKIE)?.value;
  return isMarketingAcquisitionId(value) ? value : null;
}

export function marketingAcquisitionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MARKETING_ACQUISITION_COOKIE_MAX_AGE_SECONDS,
  };
}

async function callMarketingRpc(functionName: string, params: Record<string, unknown>) {
  try {
    if (!hasSupabaseServerEnv()) return "schema_missing" as const;
    const admin = getSupabaseAdmin();
    if (!admin) return "schema_missing" as const;

    const result = await admin.rpc(functionName, params);
    if (!result.error) return readRpcStatus(result.data);
    if (isMissingMarketingAcquisitionSchema(result.error)) return "schema_missing" as const;
    return "rejected" as const;
  } catch {
    return "rejected" as const;
  }
}

export async function recordAnonymousMarketingTouch(input: {
  request: NextRequest;
  eventName: "landing_view" | "landing_cta_click";
  source: MarketingAcquisitionSource;
  ctaId?: "signup";
}) {
  const existingId = readMarketingAcquisitionId(input.request);
  const acquisitionId = existingId ?? createOpaqueMarketingAcquisitionId();
  const utm = input.source.utm;
  const status = await callMarketingRpc("record_marketing_acquisition_touch_v1", {
    p_acquisition_id: acquisitionId,
    p_source_kind: input.source.sourceKind,
    p_utm_source: utm?.utm_source ?? null,
    p_utm_medium: utm?.utm_medium ?? null,
    p_utm_campaign: utm?.utm_campaign ?? null,
    p_utm_content: utm?.utm_content ?? null,
    p_utm_term: utm?.utm_term ?? null,
    p_event_name: input.eventName,
    p_event_key: input.eventName === "landing_view" ? "landing_view" : `landing_cta_click:${input.ctaId}`,
    p_cta_id: input.ctaId ?? null,
  });

  return {
    acquisitionId,
    shouldSetCookie: existingId === null && (status === "recorded" || status === "duplicate"),
    status,
  };
}

export async function recordSignupIdentityVerified(input: {
  request: NextRequest;
  verificationRequestId: string;
}) {
  const acquisitionId = readMarketingAcquisitionId(input.request);
  if (!acquisitionId) return "not_bound" as const;

  return callMarketingRpc("record_marketing_acquisition_identity_v1", {
    p_acquisition_id: acquisitionId,
    p_event_key: buildStableEventKey("identity_verified", input.verificationRequestId),
  });
}

export async function bindMarketingAcquisitionToSignup(input: {
  request: NextRequest;
  signupRequestId: string;
  ownerUserId: string | null;
  shopId: string;
}) {
  const acquisitionId = readMarketingAcquisitionId(input.request);
  if (!acquisitionId || !input.ownerUserId) return "not_bound" as const;

  return callMarketingRpc("bind_marketing_acquisition_signup_v1", {
    p_acquisition_id: acquisitionId,
    p_signup_request_id: input.signupRequestId,
    p_owner_user_id: input.ownerUserId,
    p_shop_id: input.shopId,
    p_event_key: buildStableEventKey("signup_completed", input.signupRequestId),
  });
}

export async function recordBoundShopAcquisitionMilestone(input: {
  ownerUserId: string;
  shopId: string;
  eventName: Extract<
    MarketingAcquisitionEventName,
    "setup_step_completed" | "test_booking_created" | "activated_day_7" | "paid_conversion"
  >;
  authoritativeEventId: string;
  stepKey?: "operating_hours" | "staff_hours" | "services" | "test_booking";
  bookingSource?: "owner" | "customer";
  planCode?: string;
  daysFromSignup?: number;
  activationRuleVersion?: string;
}) {
  return callMarketingRpc("record_bound_marketing_acquisition_milestone_v1", {
    p_owner_user_id: input.ownerUserId,
    p_shop_id: input.shopId,
    p_event_name: input.eventName,
    p_event_key: buildStableEventKey(input.eventName, input.authoritativeEventId),
    p_step_key: input.stepKey ?? null,
    p_booking_source: input.bookingSource ?? null,
    p_plan_code: input.planCode ?? null,
    p_days_from_signup: input.daysFromSignup ?? null,
    p_activation_rule_version: input.activationRuleVersion ?? null,
  });
}

export const OWNER_OPERATIONAL_ACTIVITY_SOURCES = [
  "operating_hours",
  "staff_hours",
  "services",
  "test_booking",
] as const;

export type OwnerOperationalActivitySource = (typeof OWNER_OPERATIONAL_ACTIVITY_SOURCES)[number];
export const MARKETING_DAY7_ACTIVATION_RULE_VERSION = "day7_v1";

export function buildOwnerOperationalActivityRequestKey(
  source: OwnerOperationalActivitySource,
  authoritativeEvidence: string,
) {
  return createHash("sha256").update(`${source}:${authoritativeEvidence}`).digest("hex");
}

export async function recordBoundOwnerOperationalActivity(input: {
  ownerUserId: string;
  shopId: string;
  source: OwnerOperationalActivitySource;
  authoritativeEvidence: string;
}) {
  return callMarketingRpc("record_owner_operational_activity_v1", {
    p_owner_user_id: input.ownerUserId,
    p_shop_id: input.shopId,
    p_activity_source: input.source,
    p_request_key: buildOwnerOperationalActivityRequestKey(input.source, input.authoritativeEvidence),
  });
}

export async function evaluateBoundOwnerDay7Activation(input: {
  ownerUserId: string;
  shopId: string;
}) {
  const ruleVersion = MARKETING_DAY7_ACTIVATION_RULE_VERSION;
  return callMarketingRpc("evaluate_marketing_day7_activation_v1", {
    p_owner_user_id: input.ownerUserId,
    p_shop_id: input.shopId,
    p_rule_version: ruleVersion,
    p_event_key: buildStableEventKey("activated_day_7", `${input.shopId}:${ruleVersion}`),
  });
}
