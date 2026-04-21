import { randomUUID } from "node:crypto";

import { env } from "@/lib/env";
import { getOwnerPlanByCode, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import {
  addMonthsIso,
  normalizeOwnerSubscriptionMetadata,
  type OwnerLastPaymentStatus,
  type OwnerSubscriptionStatus,
  type OwnerSubscriptionSummary,
} from "@/lib/billing/owner-subscription";
import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";

export class OwnerBillingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type BillingIdentity = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type OwnerProfileRecord = {
  name: string | null;
  phone_number: string | null;
};

type OwnerSubscriptionRecord = {
  user_id: string;
  shop_id: string;
  current_plan_code: OwnerPlanCode;
  billing_cycle: "0m" | "1m" | "3m" | "6m" | "12m";
  trial_started_at: string;
  trial_ends_at: string;
  next_billing_at: string | null;
  payment_method_exists: boolean;
  payment_method_label: string | null;
  subscription_status: OwnerSubscriptionStatus;
  cancel_at_period_end: boolean;
  last_payment_status: OwnerLastPaymentStatus;
  last_payment_failed_at: string | null;
  last_payment_at: string | null;
  last_payment_id: string | null;
  billing_key: string | null;
  billing_issue_id: string | null;
  portone_customer_id: string;
  featured_plan_code: OwnerPlanCode;
  auto_renew_plan_code: OwnerPlanCode;
  current_period_started_at: string | null;
  current_period_ends_at: string | null;
  last_schedule_id: string | null;
  created_at: string;
  updated_at: string;
};

type PortonePaymentShape = {
  status?: string;
  amount?: { total?: number };
  totalAmount?: number;
  paidAmount?: number;
  customData?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
};

type PortonePaymentResponse = {
  payment?: PortonePaymentShape;
  status?: string;
  amount?: { total?: number };
  totalAmount?: number;
  paidAmount?: number;
  customData?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  message?: string;
};

type PortoneCancelResponse = {
  cancellation?: {
    status?: string;
    cancelledAt?: string | null;
    requestedAt?: string | null;
    reason?: string | null;
    id?: string | null;
  } | null;
  message?: string;
};

type PortoneBillingKeyInfoResponse = {
  billingKeyInfo?: {
    paymentMethod?: {
      type?: string;
      card?: {
        issuer?: string | null;
        publisher?: string | null;
        brand?: string | null;
        number?: string | null;
      } | null;
    } | null;
  } | null;
  paymentMethod?: {
    type?: string;
    card?: {
      issuer?: string | null;
      publisher?: string | null;
      brand?: string | null;
      number?: string | null;
    } | null;
  } | null;
};

const BILLING_TABLE = "owner_subscriptions";
const BILLING_EVENT_TABLE = "owner_billing_events";

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "42P01" ||
    error?.message?.includes("relation") ||
    error?.message?.includes("schema cache") ||
    error?.message?.includes(BILLING_TABLE) ||
    false
  );
}

function buildPortoneCustomer(identity: BillingIdentity, profile: OwnerProfileRecord | null) {
  const fullName = profile?.name ?? "펫매니저 사장님";

  return {
    id: `owner_${identity.id}`,
    name: {
      full: fullName,
    },
    phoneNumber: profile?.phone_number ?? undefined,
    email: identity.email ?? undefined,
  };
}

function buildSubscriptionMetadata(record: OwnerSubscriptionRecord) {
  return {
    current_plan_code: record.current_plan_code,
    billing_cycle: record.billing_cycle,
    trial_started_at: record.trial_started_at,
    trial_ends_at: record.trial_ends_at,
    next_billing_at: record.next_billing_at,
    payment_method_exists: record.payment_method_exists,
    payment_method_label: record.payment_method_label,
    subscription_status: record.subscription_status,
    cancel_at_period_end: record.cancel_at_period_end,
    auto_renew_enabled: !record.cancel_at_period_end,
    auto_renew_plan_code: record.auto_renew_plan_code,
    featured_plan_code: record.featured_plan_code,
    last_payment_status: record.last_payment_status,
    last_payment_failed_at: record.last_payment_failed_at,
    last_payment_at: record.last_payment_at,
    last_payment_id: record.last_payment_id,
    current_period_started_at: record.current_period_started_at,
    current_period_ends_at: record.current_period_ends_at,
  } satisfies Record<string, unknown>;
}

function extractPaymentShape(payload: PortonePaymentResponse) {
  const payment = payload.payment ?? payload;
  const status = payment.status ?? payload.status ?? "";
  const amount =
    payment.amount?.total ??
    payload.amount?.total ??
    payment.totalAmount ??
    payload.totalAmount ??
    payment.paidAmount ??
    payload.paidAmount ??
    0;
  const customData = payment.customData ?? payload.customData ?? null;
  const paidAt = payment.paidAt ?? payload.paidAt ?? null;
  const failedAt = payment.failedAt ?? payload.failedAt ?? null;

  return { status, amount, customData, paidAt, failedAt };
}

function parseCustomData(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeCardCompanyLabel(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  const upper = normalized.toUpperCase();

  if (normalized.endsWith("카드")) return normalized;
  if (upper.includes("SHINHAN")) return "신한카드";
  if (upper.includes("HANA")) return "하나카드";
  if (upper.includes("KB") || upper.includes("KOOKMIN")) return "KB국민카드";
  if (upper.includes("HYUNDAI")) return "현대카드";
  if (upper.includes("SAMSUNG")) return "삼성카드";
  if (upper.includes("LOTTE")) return "롯데카드";
  if (upper.includes("WOORI")) return "우리카드";
  if (upper.includes("NH")) return "NH농협카드";
  if (upper.includes("BC")) return "BC카드";
  if (upper.includes("KAKAO")) return "카카오뱅크카드";
  if (upper.includes("TOSS")) return "토스카드";

  return normalized;
}

function buildBillingMethodLabelFromInfo(payload: PortoneBillingKeyInfoResponse | null | undefined) {
  const source = payload?.billingKeyInfo?.paymentMethod ?? payload?.paymentMethod ?? null;
  const card = source?.card ?? null;
  const company = normalizeCardCompanyLabel(card?.issuer ?? card?.publisher ?? null);

  if (!company) {
    return null;
  }

  return company;
}

async function resolveBillingMethodLabel(billingKey: string, fallback?: string | null) {
  const preferredFallback =
    fallback && fallback.trim() && fallback.trim() !== "등록된 카드" ? fallback.trim() : null;

  try {
    const billingKeyInfo = await portoneFetch<PortoneBillingKeyInfoResponse>(
      `/billing-keys/${encodeURIComponent(billingKey)}?storeId=${encodeURIComponent(env.portoneStoreId ?? "")}`,
    );

    return buildBillingMethodLabelFromInfo(billingKeyInfo) ?? preferredFallback ?? "등록된 카드";
  } catch {
    return preferredFallback ?? "등록된 카드";
  }
}

async function portoneFetch<T>(path: string, init?: RequestInit) {
  if (!serverEnv.portoneApiSecret) {
    throw new OwnerBillingError("PortOne 서버 설정을 확인해 주세요.", 503);
  }

  const response = await fetch(`https://api.portone.io${path}`, {
    ...init,
    headers: {
      Authorization: `PortOne ${serverEnv.portoneApiSecret}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const json = text ? (JSON.parse(text) as T & { message?: string }) : ({} as T & { message?: string });

  if (!response.ok) {
    throw new OwnerBillingError(json.message ?? "PortOne 요청에 실패했습니다.", response.status);
  }

  return json as T;
}

async function recordBillingEvent(payload: {
  userId: string;
  shopId: string;
  eventType: string;
  paymentId?: string | null;
  scheduleId?: string | null;
  amount?: number | null;
  status?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const insertResult = await admin.from(BILLING_EVENT_TABLE).insert({
    user_id: payload.userId,
    shop_id: payload.shopId,
    event_type: payload.eventType,
    payment_id: payload.paymentId ?? null,
    schedule_id: payload.scheduleId ?? null,
    amount: payload.amount ?? null,
    status: payload.status ?? null,
    payload: payload.payload ?? {},
    created_at: nowIso(),
  });

  if (insertResult.error && !isMissingRelationError(insertResult.error)) {
    console.error("owner_billing_events insert failed", insertResult.error);
  }
}

async function syncUserMetadata(identity: BillingIdentity, record: OwnerSubscriptionRecord) {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  await admin.auth.admin.updateUserById(identity.id, {
    user_metadata: {
      ...(identity.user_metadata ?? {}),
      ...buildSubscriptionMetadata(record),
    },
  });
}

async function getOwnerProfile(userId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerBillingError("Supabase 관리자 설정을 확인해 주세요.", 503);
  }

  const profileResult = await admin
    .from("owner_profiles")
    .select("name, phone_number")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileResult.error) {
    throw new OwnerBillingError(profileResult.error.message, 500);
  }

  return (profileResult.data ?? null) as OwnerProfileRecord | null;
}

function buildDefaultRecord(identity: BillingIdentity, shopId: string): OwnerSubscriptionRecord {
  const summary = normalizeOwnerSubscriptionMetadata(identity.user_metadata, identity.created_at ?? nowIso(), {
    userId: identity.id,
    shopId,
    ownerEmail: identity.email ?? null,
  });

  return {
    user_id: identity.id,
    shop_id: shopId,
    current_plan_code: summary.currentPlanCode,
    billing_cycle: summary.billingCycle,
    trial_started_at: summary.trialStartedAt,
    trial_ends_at: summary.trialEndsAt,
    next_billing_at: summary.nextBillingAt,
    payment_method_exists: summary.paymentMethodExists,
    payment_method_label: summary.paymentMethodLabel,
    subscription_status: summary.status,
    cancel_at_period_end: summary.cancelAtPeriodEnd,
    last_payment_status: summary.lastPaymentStatus,
    last_payment_failed_at: summary.lastPaymentFailedAt,
    last_payment_at: summary.lastPaymentAt,
    last_payment_id: summary.lastPaymentId,
    billing_key: null,
    billing_issue_id: null,
    portone_customer_id: `owner_${identity.id}`,
    featured_plan_code: summary.featuredPlanCode,
    auto_renew_plan_code: summary.autoRenewPlanCode,
    current_period_started_at: summary.currentPeriodStartedAt,
    current_period_ends_at: summary.currentPeriodEndsAt,
    last_schedule_id: null,
    created_at: identity.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
}

function getBillingCycleForPlan(plan: { months: number }) {
  return plan.months === 12
    ? "12m"
    : plan.months === 6
      ? "6m"
      : plan.months === 3
        ? "3m"
        : plan.months === 0
          ? "0m"
          : "1m";
}

function getChargeAmountForPlan(plan: { billingType: "one_time" | "subscription"; monthlyPrice: number; totalPrice: number }) {
  return plan.billingType === "subscription" ? plan.monthlyPrice : plan.totalPrice;
}

function getPeriodMonthsForPlan(plan: { billingType: "one_time" | "subscription"; months: number }) {
  return plan.billingType === "subscription" ? 1 : plan.months;
}

async function readOrCreateSubscription(identity: BillingIdentity, shopId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerBillingError("Supabase 관리자 설정을 확인해 주세요.", 503);
  }

  const profile = await getOwnerProfile(identity.id);
  const subscriptionResult = await admin.from(BILLING_TABLE).select("*").eq("user_id", identity.id).maybeSingle();

  if (subscriptionResult.error) {
    if (isMissingRelationError(subscriptionResult.error)) {
      const fallbackSummary = normalizeOwnerSubscriptionMetadata(identity.user_metadata, identity.created_at ?? nowIso(), {
        userId: identity.id,
        shopId,
        ownerName: profile?.name ?? null,
        ownerPhoneNumber: profile?.phone_number ?? null,
        ownerEmail: identity.email ?? null,
      });
      return { summary: fallbackSummary, record: null as OwnerSubscriptionRecord | null, profile, tableReady: false };
    }
    throw new OwnerBillingError(subscriptionResult.error.message, 500);
  }

  let record = subscriptionResult.data as OwnerSubscriptionRecord | null;
  if (!record) {
    const baseRecord = buildDefaultRecord(identity, shopId);
    const insertResult = await admin.from(BILLING_TABLE).insert(baseRecord).select("*").single();
    if (insertResult.error) {
      if (isMissingRelationError(insertResult.error)) {
        const fallbackSummary = normalizeOwnerSubscriptionMetadata(identity.user_metadata, identity.created_at ?? nowIso(), {
          userId: identity.id,
          shopId,
          ownerName: profile?.name ?? null,
          ownerPhoneNumber: profile?.phone_number ?? null,
          ownerEmail: identity.email ?? null,
        });
        return { summary: fallbackSummary, record: null as OwnerSubscriptionRecord | null, profile, tableReady: false };
      }
      throw new OwnerBillingError(insertResult.error.message, 500);
    }
    record = insertResult.data as OwnerSubscriptionRecord;
    await syncUserMetadata(identity, record);
  }

  const summary = normalizeOwnerSubscriptionMetadata(buildSubscriptionMetadata(record), record.created_at, {
    userId: identity.id,
    shopId,
    ownerName: profile?.name ?? null,
    ownerPhoneNumber: profile?.phone_number ?? null,
    ownerEmail: identity.email ?? null,
  });

  return { summary, record, profile, tableReady: true };
}

async function persistSubscriptionRecord(identity: BillingIdentity, record: OwnerSubscriptionRecord) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerBillingError("Supabase 관리자 설정을 확인해 주세요.", 503);
  }

  const nextRecord = {
    ...record,
    updated_at: nowIso(),
  };

  const updateResult = await admin.from(BILLING_TABLE).upsert(nextRecord).select("*").single();
  if (updateResult.error) {
    throw new OwnerBillingError(updateResult.error.message, 500);
  }

  const saved = updateResult.data as OwnerSubscriptionRecord;
  await syncUserMetadata(identity, saved);
  return saved;
}

function nextStatusForRecord(record: OwnerSubscriptionRecord) {
  if (record.subscription_status === "past_due") {
    return "past_due";
  }

  if (record.subscription_status === "active" || record.subscription_status === "canceled") {
    if (record.current_period_ends_at && new Date(record.current_period_ends_at).getTime() <= Date.now()) {
      return "expired";
    }
    return "active";
  }

  if (record.subscription_status === "expired") {
    return "expired";
  }

  const daysUntilTrialEnds = Math.ceil((new Date(record.trial_ends_at).getTime() - Date.now()) / 86400000);
  if (daysUntilTrialEnds <= 0) {
    return "expired";
  }
  if (daysUntilTrialEnds <= 3) {
    return "trial_will_end";
  }
  return "trialing";
}

async function cancelScheduledPayment(record: OwnerSubscriptionRecord) {
  if (!record.billing_key || !serverEnv.portoneApiSecret) return;
  try {
    await portoneFetch<{ revokedScheduleIds?: string[] }>("/payment-schedules", {
      method: "DELETE",
      body: JSON.stringify({
        storeId: env.portoneStoreId,
        billingKey: record.billing_key,
      }),
    });
  } catch {
    // ignore cancellation failures for missing schedules
  }
}

async function scheduleUpcomingCharge(identity: BillingIdentity, profile: OwnerProfileRecord | null, record: OwnerSubscriptionRecord) {
  if (!record.billing_key || !record.payment_method_exists || record.cancel_at_period_end || !env.portoneStoreId) {
    return record;
  }

  const plan = getOwnerPlanByCode(record.auto_renew_plan_code) ?? getOwnerPlanByCode("monthly");
  if (!plan) return record;
  const chargeAmount = getChargeAmountForPlan(plan);

  const timeToPay = record.subscription_status === "active" && record.current_period_ends_at ? record.current_period_ends_at : record.trial_ends_at;
  if (!timeToPay) return record;

  const paymentId = `sub_${identity.id}_${Date.now()}`;
  const scheduleResponse = await portoneFetch<Record<string, unknown>>(`/payments/${encodeURIComponent(paymentId)}/schedule`, {
    method: "POST",
    body: JSON.stringify({
      storeId: env.portoneStoreId,
      payment: {
        billingKey: record.billing_key,
        orderName: `${plan.name} 펫매니저 구독`,
        customer: buildPortoneCustomer(identity, profile),
        amount: { total: chargeAmount },
        currency: "KRW",
        customData: JSON.stringify({
          kind: "owner-subscription",
          userId: identity.id,
          shopId: record.shop_id,
          planCode: plan.code,
          cycle: getBillingCycleForPlan(plan),
        }),
        noticeUrls: [`${env.siteUrl.replace(/\/$/, "")}/api/webhooks/portone`],
      },
      timeToPay,
    }),
  });

  const schedule = (scheduleResponse.schedule ?? scheduleResponse) as Record<string, unknown>;
  const scheduleId =
    (typeof schedule.id === "string" && schedule.id) ||
    (typeof schedule.paymentScheduleId === "string" && schedule.paymentScheduleId) ||
    null;

  const nextRecord: OwnerSubscriptionRecord = {
    ...record,
    last_schedule_id: scheduleId,
    last_payment_id: paymentId,
    last_payment_status: "scheduled",
    next_billing_at: timeToPay,
  };

  await recordBillingEvent({
    userId: identity.id,
    shopId: record.shop_id,
    eventType: "payment_scheduled",
    paymentId,
    scheduleId,
    amount: chargeAmount,
    status: "scheduled",
    payload: { planCode: plan.code, timeToPay },
  });

  return nextRecord;
}

function applySuccessfulCharge(record: OwnerSubscriptionRecord, planCode: OwnerPlanCode, paidAt: string | null, paymentId: string) {
  const plan = getOwnerPlanByCode(planCode) ?? getOwnerPlanByCode("monthly");
  if (!plan) {
    throw new OwnerBillingError("유효한 플랜을 찾지 못했습니다.", 400);
  }

  const paidIso = paidAt ?? nowIso();
  const periodMonths = getPeriodMonthsForPlan(plan);

  return {
    ...record,
    subscription_status: "active" as const,
    current_plan_code: plan.code,
    billing_cycle: getBillingCycleForPlan(plan),
    current_period_started_at: paidIso,
    current_period_ends_at: addMonthsIso(paidIso, periodMonths),
    next_billing_at: addMonthsIso(paidIso, periodMonths),
    last_payment_status: "paid" as const,
    last_payment_at: paidIso,
    last_payment_failed_at: null,
    last_payment_id: paymentId,
  } satisfies OwnerSubscriptionRecord;
}

function applyFailedCharge(record: OwnerSubscriptionRecord, failedAt: string | null, paymentId: string) {
  return {
    ...record,
    subscription_status: "past_due" as const,
    last_payment_status: "failed" as const,
    last_payment_failed_at: failedAt ?? nowIso(),
    last_payment_id: paymentId,
  } satisfies OwnerSubscriptionRecord;
}

function applyCancelledCharge(record: OwnerSubscriptionRecord, paymentId: string) {
  return {
    ...record,
    subscription_status: "expired" as const,
    current_period_started_at: null,
    current_period_ends_at: null,
    next_billing_at: null,
    last_payment_status: "cancelled" as const,
    last_payment_failed_at: null,
    last_schedule_id: null,
    last_payment_id: paymentId,
  } satisfies OwnerSubscriptionRecord;
}

export async function getOwnerSubscriptionSummary(identity: BillingIdentity, shopId: string) {
  const { summary } = await readOrCreateSubscription(identity, shopId);
  return summary;
}

export async function updateOwnerSubscriptionPreferences(
  identity: BillingIdentity,
  shopId: string,
  patch: { currentPlanCode?: OwnerPlanCode },
) {
  const { record, profile, tableReady, summary } = await readOrCreateSubscription(identity, shopId);

  if (!tableReady || !record) {
    const nextMetadata = {
      ...(identity.user_metadata ?? {}),
      current_plan_code: patch.currentPlanCode ?? summary.currentPlanCode,
      auto_renew_plan_code: patch.currentPlanCode ?? summary.currentPlanCode,
      auto_renew_enabled: false,
      cancel_at_period_end: false,
      subscription_status: summary.status,
    };

    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new OwnerBillingError("Supabase 관리자 설정을 확인해 주세요.", 503);
    }

    const result = await admin.auth.admin.updateUserById(identity.id, {
      user_metadata: nextMetadata,
    });

    if (result.error || !result.data.user) {
      throw new OwnerBillingError(result.error?.message ?? "구독 정보를 저장하지 못했습니다.", 400);
    }

    const nextSummary = normalizeOwnerSubscriptionMetadata(nextMetadata, identity.created_at ?? nowIso(), {
      userId: identity.id,
      shopId,
      ownerName: profile?.name ?? null,
      ownerPhoneNumber: profile?.phone_number ?? null,
      ownerEmail: identity.email ?? null,
    });
    return nextSummary;
  }

  let nextRecord: OwnerSubscriptionRecord = {
    ...record,
    current_plan_code: patch.currentPlanCode ?? record.current_plan_code,
    auto_renew_plan_code: patch.currentPlanCode ?? record.auto_renew_plan_code,
    cancel_at_period_end: false,
    featured_plan_code: record.featured_plan_code,
  };

  nextRecord.subscription_status = nextStatusForRecord(nextRecord);
  nextRecord.last_schedule_id = null;

  const saved = await persistSubscriptionRecord(identity, nextRecord);
  const nextSummary = normalizeOwnerSubscriptionMetadata(buildSubscriptionMetadata(saved), saved.created_at, {
    userId: identity.id,
    shopId,
    ownerName: profile?.name ?? null,
    ownerPhoneNumber: profile?.phone_number ?? null,
    ownerEmail: identity.email ?? null,
  });

  await recordBillingEvent({
    userId: identity.id,
    shopId,
    eventType: "subscription_updated",
    status: nextSummary.status,
    payload: patch,
  });

  return nextSummary;
}

export async function registerOwnerBillingMethod(
  identity: BillingIdentity,
  shopId: string,
  payload: {
    billingKey: string;
    issueId?: string | null;
    paymentMethodLabel?: string | null;
    autoRenewPlanCode?: OwnerPlanCode;
  },
) {
  const { record, profile, tableReady } = await readOrCreateSubscription(identity, shopId);
  if (!tableReady || !record) {
    throw new OwnerBillingError("구독 결제 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해 주세요.", 503);
  }

  if (record.billing_key && record.billing_key !== payload.billingKey) {
    try {
      await portoneFetch(`/billing-keys/${encodeURIComponent(record.billing_key)}?storeId=${encodeURIComponent(env.portoneStoreId ?? "")}`, {
        method: "DELETE",
      });
    } catch {
      // ignore old billing key delete errors
    }
  }

  const resolvedPaymentMethodLabel = await resolveBillingMethodLabel(
    payload.billingKey,
    payload.paymentMethodLabel ?? record.payment_method_label,
  );

  let nextRecord: OwnerSubscriptionRecord = {
    ...record,
    billing_key: payload.billingKey,
    billing_issue_id: payload.issueId ?? null,
    payment_method_exists: true,
    payment_method_label: resolvedPaymentMethodLabel,
    auto_renew_plan_code: payload.autoRenewPlanCode ?? record.auto_renew_plan_code,
    current_plan_code: payload.autoRenewPlanCode ?? record.current_plan_code,
    cancel_at_period_end: false,
  };

  nextRecord.last_schedule_id = null;
  nextRecord.subscription_status = nextStatusForRecord(nextRecord);

  const saved = await persistSubscriptionRecord(identity, nextRecord);
  await recordBillingEvent({
    userId: identity.id,
    shopId,
    eventType: "payment_method_registered",
    status: saved.subscription_status,
    payload: { billingKey: payload.billingKey, planCode: saved.auto_renew_plan_code },
  });

  return normalizeOwnerSubscriptionMetadata(buildSubscriptionMetadata(saved), saved.created_at, {
    userId: identity.id,
    shopId,
    ownerName: profile?.name ?? null,
    ownerPhoneNumber: profile?.phone_number ?? null,
    ownerEmail: identity.email ?? null,
  });
}

export async function retryOwnerSubscriptionCharge(identity: BillingIdentity, shopId: string) {
  const { record, profile, tableReady } = await readOrCreateSubscription(identity, shopId);
  if (!tableReady || !record) {
    throw new OwnerBillingError("구독 결제 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해 주세요.", 503);
  }

  if (!record.billing_key || !record.payment_method_exists) {
    throw new OwnerBillingError("먼저 카드 결제수단을 등록해 주세요.", 400);
  }

  const plan = getOwnerPlanByCode(record.current_plan_code) ?? getOwnerPlanByCode("monthly");
  if (!plan) {
    throw new OwnerBillingError("유효한 플랜을 찾지 못했습니다.", 400);
  }
  const chargeAmount = getChargeAmountForPlan(plan);

  const paymentId = `sub_retry_${identity.id}_${Date.now()}`;
  const paymentResponse = await portoneFetch<PortonePaymentResponse>(`/payments/${encodeURIComponent(paymentId)}/billing-key`, {
    method: "POST",
    body: JSON.stringify({
      storeId: env.portoneStoreId,
      billingKey: record.billing_key,
      orderName: `${plan.name} 펫매니저 구독`,
      customer: buildPortoneCustomer(identity, profile),
      amount: { total: chargeAmount },
      currency: "KRW",
      customData: JSON.stringify({
        kind: "owner-subscription",
        userId: identity.id,
        shopId,
        planCode: plan.code,
        cycle: getBillingCycleForPlan(plan),
      }),
      noticeUrls: [`${env.siteUrl.replace(/\/$/, "")}/api/webhooks/portone`],
    }),
  });

  const payment = extractPaymentShape(paymentResponse);
  let nextRecord = record;
  if (payment.status === "PAID") {
    nextRecord = applySuccessfulCharge(record, plan.code, payment.paidAt, paymentId);
  } else {
    nextRecord = applyFailedCharge(record, payment.failedAt, paymentId);
  }

  const saved = await persistSubscriptionRecord(identity, nextRecord);
  await recordBillingEvent({
    userId: identity.id,
    shopId,
    eventType: payment.status === "PAID" ? "payment_paid" : "payment_failed",
    paymentId,
    amount: chargeAmount,
    status: payment.status,
    payload: { planCode: plan.code },
  });

  return normalizeOwnerSubscriptionMetadata(buildSubscriptionMetadata(saved), saved.created_at, {
    userId: identity.id,
    shopId,
    ownerName: profile?.name ?? null,
    ownerPhoneNumber: profile?.phone_number ?? null,
    ownerEmail: identity.email ?? null,
  });
}

export async function syncOwnerSubscriptionFromPayment(paymentId: string) {
  const paymentResponse = await portoneFetch<PortonePaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`);
  const payment = extractPaymentShape(paymentResponse);
  const customData = parseCustomData(payment.customData);

  if (!customData || customData.kind !== "owner-subscription") {
    return null;
  }

  const userId = typeof customData.userId === "string" ? customData.userId : null;
  const shopId = typeof customData.shopId === "string" ? customData.shopId : null;
  const planCode = typeof customData.planCode === "string" ? (customData.planCode as OwnerPlanCode) : "monthly";
  if (!userId || !shopId) {
    return null;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerBillingError("Supabase 관리자 설정을 확인해 주세요.", 503);
  }

  const userResult = await admin.auth.admin.getUserById(userId);
  if (userResult.error || !userResult.data.user) {
    throw new OwnerBillingError("구독 사용자를 찾지 못했습니다.", 404);
  }

  const { record, profile, tableReady } = await readOrCreateSubscription(userResult.data.user as BillingIdentity, shopId);
  if (!tableReady || !record) {
    return null;
  }

  let nextRecord = record;
  if (payment.status === "PAID") {
    nextRecord = applySuccessfulCharge(record, planCode, payment.paidAt, paymentId);
  } else if (payment.status === "CANCELLED") {
    nextRecord = applyCancelledCharge(record, paymentId);
  } else if (payment.status === "FAILED") {
    nextRecord = applyFailedCharge(record, payment.failedAt, paymentId);
  } else {
    return null;
  }

  const saved = await persistSubscriptionRecord(userResult.data.user as BillingIdentity, nextRecord);
  await recordBillingEvent({
    userId,
    shopId,
    eventType:
      payment.status === "PAID"
        ? "payment_paid"
        : payment.status === "CANCELLED"
        ? "payment_cancelled"
        : "payment_failed",
    paymentId,
    amount: extractPaymentShape(paymentResponse).amount,
    status: payment.status,
    payload: customData,
  });

  return normalizeOwnerSubscriptionMetadata(buildSubscriptionMetadata(saved), saved.created_at, {
    userId,
    shopId,
    ownerName: profile?.name ?? null,
    ownerPhoneNumber: profile?.phone_number ?? null,
    ownerEmail: userResult.data.user.email ?? null,
  });
}

export async function refundOwnerLatestPayment(
  identity: BillingIdentity,
  shopId: string,
  reason: string,
) {
  const { record, profile, tableReady } = await readOrCreateSubscription(identity, shopId);
  if (!tableReady || !record) {
    throw new OwnerBillingError("구독 결제 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해 주세요.", 503);
  }

  if (!record.last_payment_id || record.last_payment_status !== "paid") {
    throw new OwnerBillingError("최근 결제 완료 건이 있어야 취소할 수 있습니다.", 400);
  }

  const paymentId = record.last_payment_id;
  const cancellationResponse = await portoneFetch<PortoneCancelResponse>(
    `/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        reason: reason.trim() || "관리자 환불 처리",
      }),
    },
  );

  const cancellationStatus = cancellationResponse.cancellation?.status ?? null;

  if (cancellationStatus === "FAILED") {
    throw new OwnerBillingError("결제 취소를 완료하지 못했습니다.", 400);
  }

  const syncedSummary = await syncOwnerSubscriptionFromPayment(paymentId);
  if (syncedSummary && syncedSummary.lastPaymentStatus === "cancelled") {
    await recordBillingEvent({
      userId: identity.id,
      shopId,
      eventType: "payment_cancelled",
      paymentId,
      status: cancellationStatus ?? "CANCELLED",
      payload: { reason },
    });

    return {
      summary: syncedSummary,
      refundStatus: "succeeded" as const,
      message: "최근 결제를 취소하고 이용 상태를 만료로 되돌렸습니다.",
    };
  }

  if (cancellationStatus === "REQUESTED") {
    await recordBillingEvent({
      userId: identity.id,
      shopId,
      eventType: "payment_cancel_requested",
      paymentId,
      status: "REQUESTED",
      payload: { reason },
    });

    return {
      summary: normalizeOwnerSubscriptionMetadata(buildSubscriptionMetadata(record), record.created_at, {
        userId: identity.id,
        shopId,
        ownerName: profile?.name ?? null,
        ownerPhoneNumber: profile?.phone_number ?? null,
        ownerEmail: identity.email ?? null,
      }),
      refundStatus: "requested" as const,
      message: "결제 취소 요청이 접수되었습니다. 잠시 후 상태를 다시 확인해 주세요.",
    };
  }

  const fallbackRecord = applyCancelledCharge(record, paymentId);
  const saved = await persistSubscriptionRecord(identity, fallbackRecord);
  await recordBillingEvent({
    userId: identity.id,
    shopId,
    eventType: "payment_cancelled",
    paymentId,
    status: cancellationStatus ?? "CANCELLED",
    payload: { reason, source: "fallback" },
  });

  return {
    summary: normalizeOwnerSubscriptionMetadata(buildSubscriptionMetadata(saved), saved.created_at, {
      userId: identity.id,
      shopId,
      ownerName: profile?.name ?? null,
      ownerPhoneNumber: profile?.phone_number ?? null,
      ownerEmail: identity.email ?? null,
    }),
    refundStatus: "succeeded" as const,
    message: "최근 결제를 취소하고 이용 상태를 만료로 되돌렸습니다.",
  };
}
