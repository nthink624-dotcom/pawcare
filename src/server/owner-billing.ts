import { randomUUID } from "node:crypto";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "@/lib/env";
import { getOwnerPlanByCode, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import {
  addMonthsIso,
  normalizeOwnerSubscriptionMetadata,
  type OwnerLastPaymentStatus,
  type OwnerSubscriptionStatus,
  type OwnerSubscriptionSummary,
} from "@/lib/billing/owner-subscription";
import { requireServerSecret, serverEnv } from "@/lib/server-env";
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
  billing_key_encrypted?: string | null;
  billing_key_encryption_version?: number | null;
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

type LedgerPaymentStatus = "PAID" | "FAILED" | "CANCELLED" | "REQUESTED" | "SCHEDULED" | "UNKNOWN";

type OwnerPaymentLedgerRow = {
  id: string;
  payment_id: string;
  user_id: string;
  shop_id: string;
  plan_code: OwnerPlanCode | null;
  schedule_id: string | null;
  amount: number | null;
  status: LedgerPaymentStatus;
  paid_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  last_event_type: string | null;
  payload: Record<string, unknown> | null;
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

type PortonePaymentResponse = {
  payment?: PortonePaymentShape;
  status?: string;
  amount?: { total?: number };
  totalAmount?: number;
  paidAmount?: number;
  customData?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  paymentMethod?: {
    type?: string;
    card?: {
      issuer?: string | null;
      publisher?: string | null;
      brand?: string | null;
      number?: string | null;
    } | null;
  } | null;
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

const DEFAULT_PUBLIC_NOTICE_ORIGIN = "https://www.petmanager.co.kr";

function isLocalOrigin(value: string | null | undefined) {
  return Boolean(value && /localhost|127\.0\.0\.1/i.test(value));
}

function buildOwnerBillingNoticeUrl() {
  const configuredOrigin = env.siteUrl?.replace(/\/$/, "");
  if (configuredOrigin && !isLocalOrigin(configuredOrigin)) {
    return `${configuredOrigin}/api/webhooks/portone`;
  }

  return `${DEFAULT_PUBLIC_NOTICE_ORIGIN}/api/webhooks/portone`;
}

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
const PAYMENT_LEDGER_TABLE = "owner_payment_ledger";
const BILLING_KEY_ENCRYPTION_VERSION = 1;

type BillingKeyReadState = {
  billingKey: string | null;
  resetRequired: boolean;
  problemCode: "decrypt_failed" | "missing_key" | null;
};

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "42P01" ||
    error?.message?.includes("relation") ||
    error?.message?.includes("schema cache") ||
    error?.message?.includes(BILLING_TABLE) ||
    error?.message?.includes(PAYMENT_LEDGER_TABLE) ||
    false
  );
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, columnName: string) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "PGRST204" || (message.includes(columnName.toLowerCase()) && message.includes("schema cache"));
}

function normalizeLedgerStatus(value: string | null | undefined, eventType?: string | null): LedgerPaymentStatus {
  const normalized = value?.trim().toUpperCase();
  if (
    normalized === "PAID" ||
    normalized === "FAILED" ||
    normalized === "CANCELLED" ||
    normalized === "REQUESTED" ||
    normalized === "SCHEDULED"
  ) {
    return normalized;
  }

  switch (eventType) {
    case "payment_paid":
      return "PAID";
    case "payment_failed":
      return "FAILED";
    case "payment_cancelled":
      return "CANCELLED";
    case "payment_cancel_requested":
      return "REQUESTED";
    case "payment_scheduled":
      return "SCHEDULED";
    default:
      return "UNKNOWN";
  }
}

function normalizeLedgerPlanCode(value: unknown): OwnerPlanCode | null {
  if (value === "free" || value === "monthly" || value === "quarterly" || value === "halfyearly" || value === "yearly") {
    return value;
  }
  return null;
}

function readLedgerTimestamp(payload: Record<string, unknown>, key: "paidAt" | "failedAt" | "cancelledAt" | "requestedAt") {
  const value = payload[key];
  return typeof value === "string" && value ? value : null;
}

function getBillingKeyCipherKey() {
  return createHash("sha256")
    .update(requireServerSecret(serverEnv.billingKeyEncryptionSecret, "BILLING_KEY_ENCRYPTION_SECRET"), "utf8")
    .digest();
}

function canWriteProtectedBillingData() {
  return process.env.NODE_ENV === "production" || process.env.ALLOW_LOCAL_BILLING_KEY_WRITE === "true";
}

function encryptBillingKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getBillingKeyCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptBillingKey(value: string) {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = value.split(":");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new OwnerBillingError("암호화된 결제수단 정보를 해석하지 못했습니다.", 500);
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getBillingKeyCipherKey(),
      Buffer.from(ivEncoded, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new OwnerBillingError("등록된 결제수단 정보를 읽지 못했습니다. 결제수단을 다시 등록해 주세요.", 500);
  }
}

function readStoredBillingKeyState(record: OwnerSubscriptionRecord): BillingKeyReadState {
  if (record.billing_key_encrypted) {
    try {
      return {
        billingKey: decryptBillingKey(record.billing_key_encrypted),
        resetRequired: false,
        problemCode: null,
      };
    } catch {
      return {
        billingKey: null,
        resetRequired: record.payment_method_exists,
        problemCode: "decrypt_failed",
      };
    }
  }

  if (record.billing_key) {
    return {
      billingKey: record.billing_key,
      resetRequired: false,
      problemCode: null,
    };
  }

  return {
    billingKey: null,
    resetRequired: record.payment_method_exists,
    problemCode: record.payment_method_exists ? "missing_key" : null,
  };
}

function readStoredBillingKey(record: OwnerSubscriptionRecord) {
  return readStoredBillingKeyState(record).billingKey;
}

function buildBillingKeyStorageColumns(
  record: Pick<OwnerSubscriptionRecord, "billing_key" | "billing_key_encrypted" | "billing_key_encryption_version">,
) {
  if (record.billing_key) {
    if (!canWriteProtectedBillingData()) {
      return {
        billing_key: record.billing_key,
        billing_key_encrypted: record.billing_key_encrypted ?? null,
        billing_key_encryption_version: record.billing_key_encryption_version ?? null,
      };
    }

    return {
      billing_key: null,
      billing_key_encrypted: encryptBillingKey(record.billing_key),
      billing_key_encryption_version: BILLING_KEY_ENCRYPTION_VERSION,
    };
  }

  if (record.billing_key_encrypted) {
    return {
      billing_key: null,
      billing_key_encrypted: record.billing_key_encrypted,
      billing_key_encryption_version: record.billing_key_encryption_version ?? BILLING_KEY_ENCRYPTION_VERSION,
    };
  }

  return {
    billing_key: null,
    billing_key_encrypted: null,
    billing_key_encryption_version: null,
  };
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
  const billingKeyState = readStoredBillingKeyState(record);
  return {
    current_plan_code: record.current_plan_code,
    billing_cycle: record.billing_cycle,
    trial_started_at: record.trial_started_at,
    trial_ends_at: record.trial_ends_at,
    next_billing_at: record.next_billing_at,
    payment_method_exists: record.payment_method_exists,
    payment_method_label: record.payment_method_label,
    payment_method_reset_required: billingKeyState.resetRequired,
    payment_method_problem_code: billingKeyState.problemCode,
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

function extractCardPrefix(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 3 ? digits.slice(0, 3) : null;
}

function buildBillingMethodLabelFromInfo(payload: PortoneBillingKeyInfoResponse | null | undefined) {
  const source = payload?.billingKeyInfo?.paymentMethod ?? payload?.paymentMethod ?? null;
  const card = source?.card ?? null;
  const company = normalizeCardCompanyLabel(card?.issuer ?? card?.publisher ?? null);
  const prefix = extractCardPrefix(card?.number ?? null);

  if (!company) {
    return null;
  }

  return prefix ? `${company} · ${prefix}` : company;
}

function buildBillingMethodLabelFromPayment(payload: PortonePaymentResponse | null | undefined) {
  const source = payload?.payment?.paymentMethod ?? payload?.paymentMethod ?? null;
  const card = source?.card ?? null;
  const company = normalizeCardCompanyLabel(card?.issuer ?? card?.publisher ?? null);
  const prefix = extractCardPrefix(card?.number ?? null);

  if (!company) {
    return null;
  }

  return prefix ? `${company} · ${prefix}` : company;
}

function shouldRefreshPaymentMethodLabel(value: string | null | undefined) {
  if (!value) return true;
  const normalized = value.trim();
  if (!normalized || normalized === "등록된 카드") return true;
  return !/\d{3,}/.test(normalized);
}

async function resolveBillingMethodLabel(billingKey: string, fallback?: string | null) {
  const preferredFallback =
    fallback && fallback.trim() && fallback.trim() !== "등록된 카드"
      ? normalizeCardCompanyLabel(fallback.replace(/\s*\([^)]*\)\s*$/, ""))
      : null;

  try {
    const billingKeyInfo = await portoneFetch<PortoneBillingKeyInfoResponse>(
      `/billing-keys/${encodeURIComponent(billingKey)}?storeId=${encodeURIComponent(env.portoneStoreId ?? "")}`,
    );

    return buildBillingMethodLabelFromInfo(billingKeyInfo) ?? preferredFallback ?? "등록된 카드";
  } catch {
    return preferredFallback ?? "등록된 카드";
  }
}

async function resolveBillingMethodLabelFromLastPayment(paymentId: string, fallback?: string | null) {
  const preferredFallback =
    fallback && fallback.trim() && fallback.trim() !== "등록된 카드"
      ? normalizeCardCompanyLabel(fallback.replace(/\s*\([^)]*\)\s*$/, ""))
      : null;

  try {
    const paymentInfo = await portoneFetch<PortonePaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`);
    return buildBillingMethodLabelFromPayment(paymentInfo) ?? preferredFallback ?? "등록된 카드";
  } catch {
    return preferredFallback ?? "등록된 카드";
  }
}

async function upsertPaymentLedgerEntry(payload: {
  userId: string;
  shopId: string;
  eventType: string;
  paymentId: string;
  scheduleId?: string | null;
  amount?: number | null;
  status?: string | null;
  detailPayload?: Record<string, unknown> | null;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const selectResult = await admin
    .from(PAYMENT_LEDGER_TABLE)
    .select("id, payment_id, user_id, shop_id, plan_code, schedule_id, amount, status, paid_at, failed_at, cancelled_at, last_event_type, payload, created_at, updated_at")
    .eq("payment_id", payload.paymentId)
    .maybeSingle();

  if (selectResult.error) {
    if (isMissingRelationError(selectResult.error)) {
      return;
    }
    console.error("owner_payment_ledger read failed", selectResult.error);
    return;
  }

  const current = (selectResult.data ?? null) as OwnerPaymentLedgerRow | null;
  const detailPayload = payload.detailPayload ?? {};
  const nextStatus = normalizeLedgerStatus(payload.status, payload.eventType);
  const nextPlanCode =
    current?.plan_code ??
    normalizeLedgerPlanCode(detailPayload.planCode) ??
    null;
  const now = nowIso();
  const paidAt = readLedgerTimestamp(detailPayload, "paidAt");
  const failedAt = readLedgerTimestamp(detailPayload, "failedAt");
  const cancelledAt = readLedgerTimestamp(detailPayload, "cancelledAt") ?? readLedgerTimestamp(detailPayload, "requestedAt");

  const upsertPayload = {
    id: current?.id,
    payment_id: payload.paymentId,
    user_id: payload.userId,
    shop_id: payload.shopId,
    plan_code: nextPlanCode,
    schedule_id: payload.scheduleId ?? current?.schedule_id ?? null,
    amount: current?.amount ?? payload.amount ?? null,
    status: nextStatus,
    paid_at:
      nextStatus === "PAID"
        ? current?.paid_at ?? paidAt ?? now
        : current?.paid_at ?? null,
    failed_at:
      nextStatus === "FAILED"
        ? current?.failed_at ?? failedAt ?? now
        : current?.failed_at ?? null,
    cancelled_at:
      nextStatus === "CANCELLED"
        ? current?.cancelled_at ?? cancelledAt ?? now
        : current?.cancelled_at ?? null,
    last_event_type: payload.eventType,
    payload: {
      ...(current?.payload ?? {}),
      ...detailPayload,
    },
    updated_at: now,
  };

  const upsertResult = await admin
    .from(PAYMENT_LEDGER_TABLE)
    .upsert(upsertPayload, { onConflict: "payment_id" });

  if (upsertResult.error && !isMissingRelationError(upsertResult.error)) {
    console.error("owner_payment_ledger upsert failed", upsertResult.error);
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

  if (payload.paymentId) {
    await upsertPaymentLedgerEntry({
      userId: payload.userId,
      shopId: payload.shopId,
      eventType: payload.eventType,
      paymentId: payload.paymentId,
      scheduleId: payload.scheduleId ?? null,
      amount: payload.amount ?? null,
      status: payload.status ?? null,
      detailPayload: payload.payload ?? null,
    });
  }
}

async function recordBillingKeyReadFailure(params: {
  identity: BillingIdentity;
  shopId: string;
  record: OwnerSubscriptionRecord;
  source:
    | "retry_charge"
    | "schedule_charge"
    | "payment_method_refresh"
    | "admin_reset_check";
  problemCode: BillingKeyReadState["problemCode"];
}) {
  await recordBillingEvent({
    userId: params.identity.id,
    shopId: params.shopId,
    eventType: "payment_method_decrypt_failed",
    status: "REQUIRES_RESET",
    payload: {
      source: params.source,
      problemCode: params.problemCode,
      paymentMethodLabel: params.record.payment_method_label,
      billingIssueId: params.record.billing_issue_id,
      hasEncryptedBillingKey: Boolean(params.record.billing_key_encrypted),
      hasLegacyBillingKey: Boolean(params.record.billing_key),
      encryptionVersion: params.record.billing_key_encryption_version ?? null,
      runtime: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      siteUrl: env.siteUrl,
    },
  });
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
    billing_key_encrypted: null,
    billing_key_encryption_version: null,
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

  if (record.billing_key && !record.billing_key_encrypted && serverEnv.billingKeyEncryptionSecret && canWriteProtectedBillingData()) {
    record = await persistSubscriptionRecord(identity, record);
  }

  if (record.payment_method_exists) {
    if (shouldRefreshPaymentMethodLabel(record.payment_method_label)) {
      const billingKeyState = readStoredBillingKeyState(record);
      const billingKey = billingKeyState.billingKey;
      const resolvedPaymentMethodLabel =
        record.last_payment_id
          ? await resolveBillingMethodLabelFromLastPayment(record.last_payment_id, record.payment_method_label)
          : billingKey
          ? await resolveBillingMethodLabel(billingKey, record.payment_method_label)
          : record.payment_method_label ?? "등록된 카드";

      if (resolvedPaymentMethodLabel !== record.payment_method_label) {
        record = await persistSubscriptionRecord(identity, {
          ...record,
          payment_method_label: resolvedPaymentMethodLabel,
        });
      }
    }
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
    ...buildBillingKeyStorageColumns(record),
    updated_at: nowIso(),
  };

  const updateResult = await admin.from(BILLING_TABLE).upsert(nextRecord).select("*").single();
  if (updateResult.error) {
    if (
      isMissingColumnError(updateResult.error, "billing_key_encrypted") ||
      isMissingColumnError(updateResult.error, "billing_key_encryption_version")
    ) {
      const fallbackRecord = {
        ...record,
        billing_key: record.billing_key ?? null,
        updated_at: nowIso(),
      };

      const { billing_key_encrypted, billing_key_encryption_version, ...fallbackPayload } = fallbackRecord as OwnerSubscriptionRecord & {
        billing_key_encrypted?: string | null;
        billing_key_encryption_version?: number | null;
      };

      const fallbackResult = await admin.from(BILLING_TABLE).upsert(fallbackPayload).select("*").single();
      if (fallbackResult.error) {
        throw new OwnerBillingError(fallbackResult.error.message, 500);
      }

      const savedFallback = fallbackResult.data as OwnerSubscriptionRecord;
      await syncUserMetadata(identity, savedFallback);
      return savedFallback;
    }

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
  const billingKey = readStoredBillingKey(record);
  if (!billingKey || !serverEnv.portoneApiSecret) return;
  try {
    await portoneFetch<{ revokedScheduleIds?: string[] }>("/payment-schedules", {
      method: "DELETE",
      body: JSON.stringify({
        storeId: env.portoneStoreId,
        billingKey,
      }),
    });
  } catch {
    // ignore cancellation failures for missing schedules
  }
}

async function scheduleUpcomingCharge(identity: BillingIdentity, profile: OwnerProfileRecord | null, record: OwnerSubscriptionRecord) {
  const billingKeyState = readStoredBillingKeyState(record);
  const billingKey = billingKeyState.billingKey;
  if (!billingKey || !record.payment_method_exists || record.cancel_at_period_end || !env.portoneStoreId) {
    if (record.payment_method_exists && !billingKey) {
      await recordBillingKeyReadFailure({
        identity,
        shopId: record.shop_id,
        record,
        source: "schedule_charge",
        problemCode: billingKeyState.problemCode,
      });
    }
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
        billingKey,
        orderName: `펫매니저 ${plan.name} 정기결제`,
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
        noticeUrls: [buildOwnerBillingNoticeUrl()],
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

function extractOwnerSubscriptionPaymentContext(payment: { customData?: string | null }) {
  const customData = parseCustomData(payment.customData ?? null);
  if (!customData || customData.kind !== "owner-subscription") {
    return null;
  }

  const userId = typeof customData.userId === "string" ? customData.userId : null;
  const shopId = typeof customData.shopId === "string" ? customData.shopId : null;
  const planCode = typeof customData.planCode === "string" ? (customData.planCode as OwnerPlanCode) : "monthly";

  if (!userId || !shopId) {
    return null;
  }

  return { userId, shopId, planCode, customData };
}

function buildOwnerSubscriptionSummary(
  identity: BillingIdentity,
  shopId: string,
  record: OwnerSubscriptionRecord,
  profile: OwnerProfileRecord | null,
) {
  return normalizeOwnerSubscriptionMetadata(buildSubscriptionMetadata(record), record.created_at, {
    userId: identity.id,
    shopId,
    ownerName: profile?.name ?? null,
    ownerPhoneNumber: profile?.phone_number ?? null,
    ownerEmail: identity.email ?? null,
  });
}

async function reconcileOwnerSubscriptionRecordIfNeeded(
  identity: BillingIdentity,
  shopId: string,
  record: OwnerSubscriptionRecord | null,
) {
  if (!record?.last_payment_id) return null;

  const shouldReconcile =
    record.subscription_status === "past_due" ||
    record.last_payment_status === "failed" ||
    record.last_payment_status === "scheduled";

  if (!shouldReconcile) return null;

  try {
    return await syncOwnerSubscriptionFromPayment(record.last_payment_id);
  } catch {
    return null;
  }
}

async function listRecentOwnerPaymentIds(userId: string, shopId: string, limit = 30) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerBillingError("Supabase 관리자 설정을 확인해 주세요.", 503);
  }

  const ledgerResult = await admin
    .from(PAYMENT_LEDGER_TABLE)
    .select("payment_id, updated_at")
    .eq("user_id", userId)
    .eq("shop_id", shopId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!ledgerResult.error) {
    return (ledgerResult.data ?? [])
      .map((row) => (typeof row.payment_id === "string" ? row.payment_id : null))
      .filter((paymentId): paymentId is string => Boolean(paymentId));
  }

  if (!isMissingRelationError(ledgerResult.error)) {
    throw new OwnerBillingError(ledgerResult.error.message, 500);
  }

  const eventsResult = await admin
    .from(BILLING_EVENT_TABLE)
    .select("payment_id, created_at")
    .eq("user_id", userId)
    .eq("shop_id", shopId)
    .not("payment_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (eventsResult.error) {
    if (isMissingRelationError(eventsResult.error)) {
      return [];
    }
    throw new OwnerBillingError(eventsResult.error.message, 500);
  }

  const seen = new Set<string>();
  const paymentIds: string[] = [];

  for (const row of eventsResult.data ?? []) {
    const paymentId = typeof row.payment_id === "string" ? row.payment_id : null;
    if (!paymentId || seen.has(paymentId)) continue;
    seen.add(paymentId);
    paymentIds.push(paymentId);
  }

  return paymentIds;
}

async function rebuildOwnerSubscriptionFromRecentPayments(
  identity: BillingIdentity,
  shopId: string,
  record: OwnerSubscriptionRecord,
  profile: OwnerProfileRecord | null,
  fallbackCancelledPaymentId?: string,
) {
  const paymentIds = await listRecentOwnerPaymentIds(identity.id, shopId);

  for (const paymentId of paymentIds) {
    try {
      const paymentResponse = await portoneFetch<PortonePaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`);
      const payment = extractPaymentShape(paymentResponse);
      const context = extractOwnerSubscriptionPaymentContext(payment);

      if (!context || context.userId !== identity.id || context.shopId !== shopId) {
        continue;
      }

      if (payment.status !== "PAID") {
        continue;
      }

      const rebuiltRecord = applySuccessfulCharge(record, context.planCode, payment.paidAt, paymentId);
      const saved = await persistSubscriptionRecord(identity, rebuiltRecord);
      return buildOwnerSubscriptionSummary(identity, shopId, saved, profile);
    } catch {
      continue;
    }
  }

  const expiredRecord = applyCancelledCharge(record, fallbackCancelledPaymentId ?? record.last_payment_id ?? `cancel_${Date.now()}`);
  const saved = await persistSubscriptionRecord(identity, expiredRecord);
  return buildOwnerSubscriptionSummary(identity, shopId, saved, profile);
}

function hasRecentSuccessfulCharge(record: OwnerSubscriptionRecord) {
  if (
    record.subscription_status !== "active" ||
    record.last_payment_status !== "paid" ||
    !record.current_period_ends_at ||
    !record.last_payment_at
  ) {
    return false;
  }

  const now = Date.now();
  const currentPeriodEndsAt = new Date(record.current_period_ends_at).getTime();
  const lastPaymentAt = new Date(record.last_payment_at).getTime();

  if (!Number.isFinite(currentPeriodEndsAt) || !Number.isFinite(lastPaymentAt)) {
    return false;
  }

  return currentPeriodEndsAt > now && now - lastPaymentAt < 1000 * 60 * 10;
}

export async function getOwnerSubscriptionSummary(identity: BillingIdentity, shopId: string) {
  const { summary, record, profile } = await readOrCreateSubscription(identity, shopId);
  const reconciled = await reconcileOwnerSubscriptionRecordIfNeeded(identity, shopId, record);
  if (reconciled) {
    return reconciled;
  }

  if (record) {
    return buildOwnerSubscriptionSummary(identity, shopId, record, profile);
  }

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
  const nextSummary = buildOwnerSubscriptionSummary(identity, shopId, saved, profile);

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
  if (!canWriteProtectedBillingData()) {
    throw new OwnerBillingError("운영 결제수단 보호를 위해 카드 등록은 배포 서버에서만 진행할 수 있습니다.", 400);
  }

  const { record, profile, tableReady } = await readOrCreateSubscription(identity, shopId);
  if (!tableReady || !record) {
    throw new OwnerBillingError("구독 결제 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해 주세요.", 503);
  }

  const previousBillingKey = readStoredBillingKey(record);
  if (previousBillingKey && previousBillingKey !== payload.billingKey) {
    try {
      await portoneFetch(`/billing-keys/${encodeURIComponent(previousBillingKey)}?storeId=${encodeURIComponent(env.portoneStoreId ?? "")}`, {
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
    payload: { planCode: saved.auto_renew_plan_code },
  });

  return buildOwnerSubscriptionSummary(identity, shopId, saved, profile);
}

export async function retryOwnerSubscriptionCharge(identity: BillingIdentity, shopId: string) {
  const { record, profile, tableReady } = await readOrCreateSubscription(identity, shopId);
  if (!tableReady || !record) {
    throw new OwnerBillingError("구독 결제 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해 주세요.", 503);
  }

  const reconciledSummary = await reconcileOwnerSubscriptionRecordIfNeeded(identity, shopId, record);
  if (reconciledSummary) {
    const { record: refreshedRecord, profile: refreshedProfile } = await readOrCreateSubscription(identity, shopId);
    if (refreshedRecord && hasRecentSuccessfulCharge(refreshedRecord)) {
      return buildOwnerSubscriptionSummary(identity, shopId, refreshedRecord, refreshedProfile);
    }
  }

  if (hasRecentSuccessfulCharge(record)) {
    return buildOwnerSubscriptionSummary(identity, shopId, record, profile);
  }

  const billingKeyState = readStoredBillingKeyState(record);
  const billingKey = billingKeyState.billingKey;
  if (!record.payment_method_exists) {
    throw new OwnerBillingError("먼저 카드 결제수단을 등록해 주세요.", 400);
  }
  if (!billingKey) {
    await recordBillingKeyReadFailure({
      identity,
      shopId,
      record,
      source: "retry_charge",
      problemCode: billingKeyState.problemCode,
    });
    throw new OwnerBillingError("등록된 결제수단을 다시 확인할 수 없어 새 카드를 한 번만 다시 등록해 주세요.", 400);
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
      billingKey,
      orderName: `펫매니저 ${plan.name} 정기결제`,
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
      noticeUrls: [buildOwnerBillingNoticeUrl()],
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
    payload: {
      planCode: plan.code,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
    },
  });

  return buildOwnerSubscriptionSummary(identity, shopId, saved, profile);
}

export async function syncOwnerSubscriptionFromPayment(
  paymentId: string,
  expectedContext?: { userId?: string; shopId?: string },
) {
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

  if (expectedContext?.userId && expectedContext.userId !== userId) {
    throw new OwnerBillingError("다른 계정의 결제 정보입니다.", 403);
  }

  if (expectedContext?.shopId && expectedContext.shopId !== shopId) {
    throw new OwnerBillingError("다른 매장의 결제 정보입니다.", 403);
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
    payload: {
      ...customData,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
    },
  });

  return buildOwnerSubscriptionSummary(
    {
      id: userId,
      email: userResult.data.user.email ?? null,
      created_at: userResult.data.user.created_at ?? null,
      user_metadata: userResult.data.user.user_metadata ?? null,
    },
    shopId,
    saved,
    profile,
  );
}

export async function resetOwnerPaymentMethod(
  identity: BillingIdentity,
  shopId: string,
  reason = "운영자 결제수단 초기화",
) {
  const { record, profile, tableReady } = await readOrCreateSubscription(identity, shopId);
  if (!tableReady || !record) {
    throw new OwnerBillingError("구독 결제 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해 주세요.", 503);
  }

  const billingKeyState = readStoredBillingKeyState(record);
  const previousBillingKey = billingKeyState.billingKey;
  if (previousBillingKey && env.portoneStoreId) {
    try {
      await portoneFetch(`/billing-keys/${encodeURIComponent(previousBillingKey)}?storeId=${encodeURIComponent(env.portoneStoreId)}`, {
        method: "DELETE",
      });
    } catch {
      // ignore billing key delete errors during manual reset
    }
  }

  if (!previousBillingKey && record.payment_method_exists) {
    await recordBillingKeyReadFailure({
      identity,
      shopId,
      record,
      source: "admin_reset_check",
      problemCode: billingKeyState.problemCode,
    });
  }

  const saved = await persistSubscriptionRecord(identity, {
    ...record,
    payment_method_exists: false,
    payment_method_label: null,
    billing_key: null,
    billing_key_encrypted: null,
    billing_key_encryption_version: null,
    billing_issue_id: null,
    last_schedule_id: null,
  });

  await recordBillingEvent({
    userId: identity.id,
    shopId,
    eventType: "payment_method_reset",
    status: saved.subscription_status,
    payload: {
      reason,
      previousPaymentMethodLabel: record.payment_method_label,
      hadEncryptedBillingKey: Boolean(record.billing_key_encrypted),
      hadLegacyBillingKey: Boolean(record.billing_key),
      previousProblemCode: billingKeyState.problemCode,
    },
  });

  return buildOwnerSubscriptionSummary(identity, shopId, saved, profile);
}

export async function refundOwnerLatestPayment(
  identity: BillingIdentity,
  shopId: string,
  reason: string,
) {
  const { record, tableReady } = await readOrCreateSubscription(identity, shopId);
  if (!tableReady || !record) {
    throw new OwnerBillingError("구독 결제 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해 주세요.", 503);
  }

  if (!record.last_payment_id) {
    throw new OwnerBillingError("최근 결제 건을 찾지 못했습니다.", 400);
  }

  return refundOwnerPayment(identity, shopId, record.last_payment_id, reason);
}

export async function refundOwnerPayment(
  identity: BillingIdentity,
  shopId: string,
  paymentId: string,
  reason: string,
) {
  const initial = await readOrCreateSubscription(identity, shopId);
  if (!initial.tableReady || !initial.record) {
    throw new OwnerBillingError("구독 결제 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해 주세요.", 503);
  }

  await reconcileOwnerSubscriptionRecordIfNeeded(identity, shopId, initial.record);
  const { record, profile, tableReady } = await readOrCreateSubscription(identity, shopId);
  if (!tableReady || !record) {
    throw new OwnerBillingError("구독 결제 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해 주세요.", 503);
  }
  const paymentResponse = await portoneFetch<PortonePaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`);
  const payment = extractPaymentShape(paymentResponse);
  const context = extractOwnerSubscriptionPaymentContext(payment);

  if (!context || context.userId !== identity.id || context.shopId !== shopId) {
    throw new OwnerBillingError("선택한 결제 건을 찾지 못했습니다.", 404);
  }

  if (payment.status === "CANCELLED") {
    const summary = await rebuildOwnerSubscriptionFromRecentPayments(identity, shopId, record, profile, paymentId);
    return {
      summary,
      refundStatus: "succeeded" as const,
      message: "이미 취소된 결제입니다.",
    };
  }

  if (payment.status !== "PAID") {
    throw new OwnerBillingError("결제 완료 상태인 건만 취소할 수 있습니다.", 400);
  }

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

  if (cancellationStatus === "REQUESTED") {
    await recordBillingEvent({
      userId: identity.id,
      shopId,
      eventType: "payment_cancel_requested",
      paymentId,
      status: "REQUESTED",
      payload: {
        reason,
        planCode: context.planCode,
        requestedAt: cancellationResponse.cancellation?.requestedAt ?? null,
      },
    });

    return {
      summary: buildOwnerSubscriptionSummary(identity, shopId, record, profile),
      refundStatus: "requested" as const,
      message: "결제 취소 요청이 접수되었습니다. 잠시 후 상태를 다시 확인해 주세요.",
    };
  }

  const summary = await rebuildOwnerSubscriptionFromRecentPayments(identity, shopId, record, profile, paymentId);
  await recordBillingEvent({
    userId: identity.id,
    shopId,
    eventType: "payment_cancelled",
    paymentId,
    status: cancellationStatus ?? "CANCELLED",
    payload: {
      reason,
      source: "fallback",
      planCode: context.planCode,
      cancelledAt: cancellationResponse.cancellation?.cancelledAt ?? null,
    },
  });

  return {
    summary,
    refundStatus: "succeeded" as const,
    message: "선택한 결제를 취소했습니다.",
  };
}
