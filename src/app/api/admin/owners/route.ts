import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getOwnerPlanDisplayName, type OwnerPlanCode } from "@/lib/billing/owner-plans";
import {
  normalizeOwnerSubscriptionMetadata,
  planCodeToBillingCycle,
  type OwnerLastPaymentStatus,
  type OwnerSubscriptionStatus,
} from "@/lib/billing/owner-subscription";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { syncOwnerSubscriptionFromPayment } from "@/server/owner-billing";

type OwnerProfileRow = {
  user_id: string;
  shop_id: string;
  login_id: string | null;
  name: string | null;
  phone_number: string | null;
  created_at: string;
};

type ShopRow = {
  id: string;
  owner_user_id: string | null;
  name: string;
  address: string;
  created_at: string;
};

type SubscriptionRow = {
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

type AdminOwnerEventType =
  | "trial_extended"
  | "service_extended"
  | "plan_changed"
  | "status_changed"
  | "payment_status_changed"
  | "suspended"
  | "restored";

type BillingEventStatus = "PAID" | "FAILED" | "CANCELLED" | "REQUESTED" | "SCHEDULED" | null;

type AdminOwnerEventRow = {
  id: string;
  target_user_id: string;
  target_shop_id: string;
  admin_email: string;
  event_type: AdminOwnerEventType;
  previous_payload: Record<string, unknown>;
  next_payload: Record<string, unknown>;
  note: string | null;
  created_at: string;
};

type OwnerBillingEventRow = {
  id: string;
  user_id: string;
  shop_id: string;
  event_type: string;
  payment_id: string | null;
  schedule_id: string | null;
  amount: number | null;
  status: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type OwnerPaymentLedgerRow = {
  id: string;
  payment_id: string;
  user_id: string;
  shop_id: string;
  plan_code: OwnerPlanCode | null;
  amount: number | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type AdminOwnerHistoryItem = {
  id: string;
  type: AdminOwnerEventType;
  adminEmail: string;
  note: string | null;
  previousPayload: Record<string, unknown>;
  nextPayload: Record<string, unknown>;
  createdAt: string;
};

type AdminOwnerPaymentItem = {
  id: string;
  paymentId: string;
  amount: number | null;
  status: BillingEventStatus;
  planCode: OwnerPlanCode | null;
  createdAt: string;
  refundable: boolean;
};

type AdminLoginMethod = "id" | "google" | "kakao" | "naver";

type AdminOwnerItem = {
  userId: string;
  ownerName: string;
  loginId: string | null;
  ownerPhoneNumber: string | null;
  ownerEmail: string | null;
  loginMethods: AdminLoginMethod[];
  shopId: string;
  shopName: string;
  shopAddress: string;
  joinedAt: string;
  serviceStartedAt: string;
  status: OwnerSubscriptionStatus;
  currentPlanCode: OwnerPlanCode;
  currentPlanName: string;
  trialEndsAt: string;
  currentPeriodEndsAt: string | null;
  lastPaymentStatus: OwnerLastPaymentStatus;
  paymentMethodExists: boolean;
  suspended: boolean;
  suspensionReason: string | null;
  recentEvents: AdminOwnerHistoryItem[];
  recentPayments: AdminOwnerPaymentItem[];
};

function normalizeLoginProvider(value: string | null | undefined): AdminLoginMethod | null {
  if (!value) return null;

  const normalized = value.toLowerCase();
  if (normalized === "google" || normalized === "kakao" || normalized === "naver") {
    return normalized;
  }

  if (normalized === "custom:naver" || normalized.endsWith(":naver")) {
    return "naver";
  }

  return null;
}

function extractLoginMethods(user: {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  identities?: Array<{ provider?: string | null } | null> | null;
}, loginId: string | null): AdminLoginMethod[] {
  const methods = new Set<AdminLoginMethod>();

  if (loginId || user.email?.endsWith("@owner.pawcare.local")) {
    methods.add("id");
  }

  const directProvider =
    typeof user.app_metadata?.provider === "string" ? normalizeLoginProvider(user.app_metadata.provider) : null;
  if (directProvider) {
    methods.add(directProvider);
  }

  const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [];
  for (const provider of providers) {
    if (typeof provider === "string") {
      const normalized = normalizeLoginProvider(provider);
      if (normalized) {
        methods.add(normalized);
      }
    }
  }

  const identities = Array.isArray(user.identities) ? user.identities : [];
  for (const identity of identities) {
    const normalized = normalizeLoginProvider(identity?.provider);
    if (normalized) {
      methods.add(normalized);
    }
  }

  if (methods.size === 0) {
    methods.add("id");
  }

  return Array.from(methods);
}

const patchSchema = z.object({
  userId: z.string().min(1),
  shopId: z.string().min(1),
  currentPlanCode: z.enum(["free", "monthly", "quarterly", "halfyearly", "yearly"]).optional(),
  serviceStartedAt: z.string().datetime({ offset: true }).optional(),
  trialEndsAt: z.string().datetime({ offset: true }).optional(),
  currentPeriodEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
  status: z.enum(["trialing", "trial_will_end", "active", "past_due", "canceled", "expired"]).optional(),
  lastPaymentStatus: z.enum(["none", "scheduled", "paid", "failed", "cancelled"]).optional(),
  suspended: z.boolean().optional(),
  suspensionReason: z.string().trim().max(200).nullable().optional(),
});

function resolveAdminStatus(params: {
  requestedStatus?: OwnerSubscriptionStatus;
  currentPeriodEndsAt: string | null;
  trialEndsAt: string;
}) {
  if (params.requestedStatus) {
    return params.requestedStatus;
  }

  const now = Date.now();
  const serviceEndsAt = params.currentPeriodEndsAt ? new Date(params.currentPeriodEndsAt).getTime() : null;
  const trialEndsAt = new Date(params.trialEndsAt).getTime();

  if (serviceEndsAt && serviceEndsAt > now) {
    return "active" as const;
  }

  if (Number.isFinite(trialEndsAt) && trialEndsAt > now) {
    const diffDays = Math.ceil((trialEndsAt - now) / 86400000);
    return diffDays <= 3 ? ("trial_will_end" as const) : ("trialing" as const);
  }

  return "expired" as const;
}

function isMissingTableError(error: DatabaseErrorLike | null | undefined, tableName: string) {
  const haystack = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return error?.code === "42P01" || (haystack.includes(tableName.toLowerCase()) && haystack.includes("schema cache"));
}

function buildMetadataFromRecord(record: SubscriptionRow) {
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

function getSuspensionState(metadata: Record<string, unknown> | null | undefined) {
  return {
    suspended: metadata?.account_suspended === true,
    suspensionReason:
      typeof metadata?.account_suspension_reason === "string" && metadata.account_suspension_reason.trim()
        ? metadata.account_suspension_reason
        : null,
  };
}

function normalizeBillingEventStatus(value: string | null | undefined): BillingEventStatus {
  if (!value) return null;
  const normalized = value.toUpperCase();
  if (normalized === "PAID" || normalized === "FAILED" || normalized === "CANCELLED" || normalized === "REQUESTED" || normalized === "SCHEDULED") {
    return normalized;
  }
  return null;
}

function inferBillingEventStatus(eventType: string, value: string | null | undefined): BillingEventStatus {
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
      return normalizeBillingEventStatus(value);
  }
}

function getBillingStatusPriority(status: BillingEventStatus) {
  switch (status) {
    case "CANCELLED":
      return 5;
    case "PAID":
      return 4;
    case "REQUESTED":
      return 3;
    case "FAILED":
      return 2;
    case "SCHEDULED":
      return 1;
    default:
      return 0;
  }
}

function todayKstIsoStart() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}T00:00:00+09:00`;
}

async function readAdminOwners() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new AdminApiError("Supabase 설정을 확인해 주세요.", 503);
  }

  const [profilesResult, shopsResult, subscriptionsResult, eventsResult, billingEventsResult, paymentLedgerResult] = await Promise.all([
    admin
      .from("owner_profiles")
      .select("user_id, shop_id, login_id, name, phone_number, created_at")
      .order("created_at", { ascending: false }),
    admin.from("shops").select("id, owner_user_id, name, address, created_at").order("created_at", { ascending: false }),
    admin
      .from("owner_subscriptions")
      .select(
        "user_id, shop_id, current_plan_code, billing_cycle, trial_started_at, trial_ends_at, next_billing_at, payment_method_exists, payment_method_label, subscription_status, cancel_at_period_end, last_payment_status, last_payment_failed_at, last_payment_at, last_payment_id, billing_issue_id, portone_customer_id, featured_plan_code, auto_renew_plan_code, current_period_started_at, current_period_ends_at, last_schedule_id, created_at, updated_at",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("owner_admin_events")
      .select("id, target_user_id, target_shop_id, admin_email, event_type, previous_payload, next_payload, note, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    admin
      .from("owner_billing_events")
      .select("id, user_id, shop_id, event_type, payment_id, schedule_id, amount, status, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("owner_payment_ledger")
      .select("id, payment_id, user_id, shop_id, plan_code, amount, status, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1000),
  ]);

  if (profilesResult.error) throw new AdminApiError(profilesResult.error.message, 500);
  if (shopsResult.error) throw new AdminApiError(shopsResult.error.message, 500);
  if (subscriptionsResult.error && !isMissingTableError(subscriptionsResult.error, "owner_subscriptions")) {
    throw new AdminApiError(subscriptionsResult.error.message, 500);
  }
  if (eventsResult.error && !isMissingTableError(eventsResult.error, "owner_admin_events")) {
    throw new AdminApiError(eventsResult.error.message, 500);
  }
  if (billingEventsResult.error && !isMissingTableError(billingEventsResult.error, "owner_billing_events")) {
    throw new AdminApiError(billingEventsResult.error.message, 500);
  }
  if (paymentLedgerResult.error && !isMissingTableError(paymentLedgerResult.error, "owner_payment_ledger")) {
    throw new AdminApiError(paymentLedgerResult.error.message, 500);
  }

  const profiles = (profilesResult.data ?? []) as OwnerProfileRow[];
  const shops = (shopsResult.data ?? []) as ShopRow[];
  const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const events = (eventsResult.data ?? []) as AdminOwnerEventRow[];
  const billingEvents = (billingEventsResult.data ?? []) as OwnerBillingEventRow[];
  const paymentLedger = (paymentLedgerResult.data ?? []) as OwnerPaymentLedgerRow[];

  const shopByUserId = new Map<string, ShopRow>();
  for (const shop of shops) {
    if (shop.owner_user_id && !shopByUserId.has(shop.owner_user_id)) {
      shopByUserId.set(shop.owner_user_id, shop);
    }
  }

  const profileByUserId = new Map<string, OwnerProfileRow>();
  for (const profile of profiles) {
    if (!profileByUserId.has(profile.user_id)) {
      profileByUserId.set(profile.user_id, profile);
    }
  }

  const subscriptionByUserId = new Map<string, SubscriptionRow>();
  for (const subscription of subscriptions) {
    if (!subscriptionByUserId.has(subscription.user_id)) {
      subscriptionByUserId.set(subscription.user_id, subscription);
    }
  }

  const eventsByUserId = new Map<string, AdminOwnerHistoryItem[]>();
  for (const event of events) {
    const current = eventsByUserId.get(event.target_user_id) ?? [];
    if (current.length < 5) {
      current.push({
        id: event.id,
        type: event.event_type,
        adminEmail: event.admin_email,
        note: event.note,
        previousPayload: event.previous_payload ?? {},
        nextPayload: event.next_payload ?? {},
        createdAt: event.created_at,
      });
      eventsByUserId.set(event.target_user_id, current);
    }
  }

  const recentPaymentsByUserId = new Map<string, AdminOwnerPaymentItem[]>();
  const paymentMapByUserId = new Map<string, Map<string, AdminOwnerPaymentItem>>();
  for (const payment of paymentLedger) {
    const status = normalizeBillingEventStatus(payment.status);
    const currentMap = paymentMapByUserId.get(payment.user_id) ?? new Map<string, AdminOwnerPaymentItem>();
    currentMap.set(payment.payment_id, {
      id: payment.id,
      paymentId: payment.payment_id,
      amount: payment.amount ?? null,
      status,
      planCode: payment.plan_code ?? null,
      createdAt: payment.updated_at ?? payment.created_at,
      refundable: status === "PAID",
    });
    paymentMapByUserId.set(payment.user_id, currentMap);
  }

  for (const event of billingEvents) {
    if (!event.payment_id) continue;

    const currentMap = paymentMapByUserId.get(event.user_id) ?? new Map<string, AdminOwnerPaymentItem>();
    const current = currentMap.get(event.payment_id) ?? null;
    if (current) {
      continue;
    }

    const payload = event.payload ?? {};
    const planCode =
      typeof payload.planCode === "string" &&
      ["free", "monthly", "quarterly", "halfyearly", "yearly"].includes(payload.planCode)
        ? (payload.planCode as OwnerPlanCode)
        : null;
    const status = inferBillingEventStatus(event.event_type, event.status);

    currentMap.set(event.payment_id, {
      id: event.id,
      paymentId: event.payment_id,
      amount: event.amount ?? null,
      status,
      planCode,
      createdAt: event.created_at,
      refundable: status === "PAID",
    });
    paymentMapByUserId.set(event.user_id, currentMap);
  }

  for (const [userId, paymentMap] of paymentMapByUserId.entries()) {
    recentPaymentsByUserId.set(
      userId,
      Array.from(paymentMap.values())
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((payment) => ({
          ...payment,
          refundable: payment.status === "PAID",
        }))
        .slice(0, 10),
    );
  }

  const userIds = Array.from(new Set([...shopByUserId.keys(), ...profileByUserId.keys()]));
  const owners = await Promise.all(
    userIds.map(async (userId) => {
      const userResult = await admin.auth.admin.getUserById(userId);
      const authUser = userResult.data.user;
      const profile = profileByUserId.get(userId) ?? null;
      const shop = shopByUserId.get(userId) ?? null;

      if (!authUser || !shop) return null;

      const subscription = subscriptionByUserId.get(userId) ?? null;
      const reconciledSummary =
        subscription?.last_payment_id &&
        (subscription.subscription_status === "past_due" ||
          subscription.last_payment_status === "failed" ||
          subscription.last_payment_status === "scheduled")
          ? await syncOwnerSubscriptionFromPayment(subscription.last_payment_id).catch(() => null)
          : null;
      const summary = reconciledSummary
        ? reconciledSummary
        : subscription
        ? normalizeOwnerSubscriptionMetadata(buildMetadataFromRecord(subscription), subscription.created_at, {
            userId,
            shopId: shop.id,
            ownerName: profile?.name ?? null,
            ownerPhoneNumber: profile?.phone_number ?? null,
            ownerEmail: authUser.email ?? null,
          })
        : normalizeOwnerSubscriptionMetadata(authUser.user_metadata, authUser.created_at ?? nowIso(), {
            userId,
            shopId: shop.id,
            ownerName: profile?.name ?? null,
            ownerPhoneNumber: profile?.phone_number ?? null,
            ownerEmail: authUser.email ?? null,
          });

      const suspension = getSuspensionState(authUser.user_metadata);

      return {
        userId,
        ownerName: profile?.name ?? authUser.user_metadata?.name?.toString() ?? "이름 없음",
        loginId: profile?.login_id ?? null,
        ownerPhoneNumber: profile?.phone_number ?? null,
        ownerEmail: authUser.email ?? null,
        loginMethods: extractLoginMethods(authUser, profile?.login_id ?? null),
        shopId: shop.id,
        shopName: shop.name,
        shopAddress: shop.address,
        joinedAt: profile?.created_at ?? shop.created_at ?? authUser.created_at ?? nowIso(),
        serviceStartedAt: summary.currentPeriodStartedAt ?? summary.trialStartedAt,
        status: summary.status,
        currentPlanCode: summary.currentPlanCode,
        currentPlanName:
          summary.status === "trialing" || summary.status === "trial_will_end"
            ? "체험 플랜"
            : getOwnerPlanDisplayName(summary.currentPlanCode),
        trialEndsAt: summary.trialEndsAt,
        currentPeriodEndsAt: summary.currentPeriodEndsAt,
        lastPaymentStatus: summary.lastPaymentStatus,
        paymentMethodExists: summary.paymentMethodExists,
        suspended: suspension.suspended,
        suspensionReason: suspension.suspensionReason,
        recentEvents: eventsByUserId.get(userId) ?? [],
        recentPayments: recentPaymentsByUserId.get(userId) ?? [],
      } satisfies AdminOwnerItem;
    }),
  );

  return owners.filter(Boolean) as AdminOwnerItem[];
}

function createAdminEvents(params: {
  previousOwner: AdminOwnerItem;
  nextOwner: AdminOwnerItem;
  adminEmail: string;
}) {
  const { previousOwner, nextOwner, adminEmail } = params;
  const events: Omit<AdminOwnerEventRow, "id" | "created_at">[] = [];

  const pushEvent = (
    type: AdminOwnerEventType,
    previousPayload: Record<string, unknown>,
    nextPayload: Record<string, unknown>,
    note?: string | null,
  ) => {
    events.push({
      target_user_id: nextOwner.userId,
      target_shop_id: nextOwner.shopId,
      admin_email: adminEmail,
      event_type: type,
      previous_payload: previousPayload,
      next_payload: nextPayload,
      note: note ?? null,
    });
  };

  if (previousOwner.currentPlanCode !== nextOwner.currentPlanCode) {
    pushEvent(
      "plan_changed",
      { currentPlanCode: previousOwner.currentPlanCode, currentPlanName: previousOwner.currentPlanName },
      { currentPlanCode: nextOwner.currentPlanCode, currentPlanName: nextOwner.currentPlanName },
    );
  }

  if (previousOwner.status !== nextOwner.status) {
    pushEvent("status_changed", { status: previousOwner.status }, { status: nextOwner.status });
  }

  if (previousOwner.lastPaymentStatus !== nextOwner.lastPaymentStatus) {
    pushEvent(
      "payment_status_changed",
      { lastPaymentStatus: previousOwner.lastPaymentStatus },
      { lastPaymentStatus: nextOwner.lastPaymentStatus },
    );
  }

  if (previousOwner.trialEndsAt !== nextOwner.trialEndsAt) {
    pushEvent(
      "trial_extended",
      { trialEndsAt: previousOwner.trialEndsAt },
      { trialEndsAt: nextOwner.trialEndsAt },
      "체험 플랜 종료일이 변경되었습니다.",
    );
  }

  if ((previousOwner.currentPeriodEndsAt ?? null) !== (nextOwner.currentPeriodEndsAt ?? null)) {
    pushEvent(
      "service_extended",
      { currentPeriodEndsAt: previousOwner.currentPeriodEndsAt },
      { currentPeriodEndsAt: nextOwner.currentPeriodEndsAt },
      "서비스 종료일이 변경되었습니다.",
    );
  }

  if (!previousOwner.suspended && nextOwner.suspended) {
    pushEvent(
      "suspended",
      { suspended: false, suspensionReason: previousOwner.suspensionReason },
      { suspended: true, suspensionReason: nextOwner.suspensionReason },
      nextOwner.suspensionReason ?? "운영자가 계정을 일시 중지했습니다.",
    );
  }

  if (previousOwner.suspended && !nextOwner.suspended) {
    pushEvent(
      "restored",
      { suspended: true, suspensionReason: previousOwner.suspensionReason },
      { suspended: false, suspensionReason: null },
      "운영자가 계정 정지를 해제했습니다.",
    );
  }

  return events;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const owners = await readAdminOwners();
    return NextResponse.json(owners);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "오너 계정을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminSession = await requireAdminSession(request);
    const body = patchSchema.parse(await request.json());
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new AdminApiError("Supabase 설정을 확인해 주세요.", 503);
    }

    const currentOwners = await readAdminOwners();
    const previousOwner = currentOwners.find((item) => item.userId === body.userId && item.shopId === body.shopId);
    if (!previousOwner) {
      throw new AdminApiError("관리할 오너 계정을 찾지 못했습니다.", 404);
    }

    const userResult = await admin.auth.admin.getUserById(body.userId);
    const user = userResult.data.user;
    if (userResult.error || !user) {
      throw new AdminApiError("관리할 오너 계정을 찾지 못했습니다.", 404);
    }

    const subscriptionResult = await admin
      .from("owner_subscriptions")
      .select(
        "user_id, shop_id, current_plan_code, billing_cycle, trial_started_at, trial_ends_at, next_billing_at, payment_method_exists, payment_method_label, subscription_status, cancel_at_period_end, last_payment_status, last_payment_failed_at, last_payment_at, last_payment_id, billing_issue_id, portone_customer_id, featured_plan_code, auto_renew_plan_code, current_period_started_at, current_period_ends_at, last_schedule_id, created_at, updated_at",
      )
      .eq("user_id", body.userId)
      .maybeSingle();

    if (subscriptionResult.error && subscriptionResult.error.code !== "42P01") {
      throw new AdminApiError(subscriptionResult.error.message, 500);
    }

    const existingRecord = (subscriptionResult.data as SubscriptionRow | null) ?? null;
    const nextPlanCode = body.currentPlanCode ?? existingRecord?.current_plan_code ?? previousOwner.currentPlanCode;
    const nextTrialEndsAt = body.trialEndsAt ?? existingRecord?.trial_ends_at ?? previousOwner.trialEndsAt;
    const nextCurrentPeriodEndsAt =
      body.currentPeriodEndsAt !== undefined
        ? body.currentPeriodEndsAt
        : existingRecord?.current_period_ends_at ?? previousOwner.currentPeriodEndsAt ?? null;
    const hasFutureServiceEnd =
      !!nextCurrentPeriodEndsAt && new Date(nextCurrentPeriodEndsAt).getTime() > new Date(nowIso()).getTime();
    const previousServiceEndedAt =
      existingRecord?.current_period_ends_at ??
      previousOwner.currentPeriodEndsAt ??
      existingRecord?.trial_ends_at ??
      previousOwner.trialEndsAt;
    const shouldResetServiceStart =
      !body.serviceStartedAt &&
      hasFutureServiceEnd &&
      (!!previousServiceEndedAt && new Date(previousServiceEndedAt).getTime() < new Date(nowIso()).getTime());
    const nextServiceStartedAt =
      body.serviceStartedAt ??
      (shouldResetServiceStart
        ? todayKstIsoStart()
        : existingRecord?.current_period_started_at ?? existingRecord?.trial_started_at ?? previousOwner.serviceStartedAt);
    const nextStatus = resolveAdminStatus({
      requestedStatus: body.status,
      currentPeriodEndsAt: nextCurrentPeriodEndsAt,
      trialEndsAt: nextTrialEndsAt,
    });
    const nextAutoRenewPlanCode: OwnerPlanCode =
      nextPlanCode === "free"
        ? (existingRecord?.auto_renew_plan_code && existingRecord.auto_renew_plan_code !== "free"
            ? existingRecord.auto_renew_plan_code
            : "monthly")
        : nextPlanCode;
    const nextFeaturedPlanCode: OwnerPlanCode =
      nextPlanCode === "free"
        ? (existingRecord?.featured_plan_code && existingRecord.featured_plan_code !== "free"
            ? existingRecord.featured_plan_code
            : "yearly")
        : nextPlanCode;
    const nextLastPaymentStatus =
      body.lastPaymentStatus ?? existingRecord?.last_payment_status ?? previousOwner.lastPaymentStatus;
    const nextSuspended = body.suspended ?? getSuspensionState(user.user_metadata).suspended;
    const nextSuspensionReason =
      nextSuspended
        ? body.suspensionReason?.trim() || getSuspensionState(user.user_metadata).suspensionReason || "운영자에 의해 일시 중지됨"
        : null;
    const nextCurrentPeriodStartedAt =
      nextStatus === "active"
        ? existingRecord?.current_period_started_at ??
          (typeof user.user_metadata?.current_period_started_at === "string"
            ? user.user_metadata.current_period_started_at
            : nowIso())
        : null;

    if (existingRecord) {
      const updatePayload = {
        ...existingRecord,
        shop_id: body.shopId,
        current_plan_code: nextPlanCode,
        featured_plan_code: nextFeaturedPlanCode,
        auto_renew_plan_code: nextAutoRenewPlanCode,
        billing_cycle: planCodeToBillingCycle(nextPlanCode),
        trial_started_at: nextServiceStartedAt,
        subscription_status: nextStatus,
        trial_ends_at: nextTrialEndsAt,
        current_period_started_at: nextCurrentPeriodStartedAt ?? nextServiceStartedAt,
        current_period_ends_at: nextCurrentPeriodEndsAt,
        next_billing_at: nextCurrentPeriodEndsAt,
        last_payment_status: nextLastPaymentStatus,
        updated_at: nowIso(),
      };

      const updateResult = await admin
        .from("owner_subscriptions")
        .update(updatePayload)
        .eq("user_id", body.userId)
        .select("user_id")
        .single();
      if (updateResult.error) {
        throw new AdminApiError(updateResult.error.message, 500);
      }
    } else {
      const insertPayload = {
        user_id: body.userId,
        shop_id: body.shopId,
        current_plan_code: nextPlanCode,
        billing_cycle: planCodeToBillingCycle(nextPlanCode),
        trial_started_at: nextServiceStartedAt,
        trial_ends_at: nextTrialEndsAt,
        next_billing_at: nextCurrentPeriodEndsAt,
        payment_method_exists: false,
        payment_method_label: null,
        subscription_status: nextStatus,
        cancel_at_period_end: false,
        last_payment_status: nextLastPaymentStatus,
        last_payment_failed_at: null,
        last_payment_at: null,
        last_payment_id: null,
        billing_key: null,
        billing_issue_id: null,
        portone_customer_id: `owner_${body.userId}`,
        featured_plan_code: nextFeaturedPlanCode,
        auto_renew_plan_code: nextAutoRenewPlanCode,
        current_period_started_at: nextCurrentPeriodStartedAt ?? nextServiceStartedAt,
        current_period_ends_at: nextCurrentPeriodEndsAt,
        last_schedule_id: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };

      const insertResult = await admin.from("owner_subscriptions").insert(insertPayload).select("user_id").single();
      if (insertResult.error) {
        throw new AdminApiError(insertResult.error.message, 500);
      }
    }

    const nextMetadata = {
      ...(user.user_metadata ?? {}),
      current_plan_code: nextPlanCode,
      featured_plan_code: nextFeaturedPlanCode,
      auto_renew_plan_code: nextAutoRenewPlanCode,
      auto_renew_enabled: false,
      cancel_at_period_end: false,
      subscription_status: nextStatus,
      billing_cycle: planCodeToBillingCycle(nextPlanCode),
      trial_ends_at: nextTrialEndsAt,
      current_period_started_at: nextCurrentPeriodStartedAt,
      current_period_ends_at: nextCurrentPeriodEndsAt,
      next_billing_at: nextCurrentPeriodEndsAt,
      last_payment_status: nextLastPaymentStatus,
      account_suspended: nextSuspended,
      account_suspension_reason: nextSuspensionReason,
      account_suspended_at: nextSuspended ? nowIso() : null,
    } satisfies Record<string, unknown>;

    const authUpdateResult = await admin.auth.admin.updateUserById(body.userId, {
      user_metadata: nextMetadata,
    });
    if (authUpdateResult.error) {
      throw new AdminApiError(authUpdateResult.error.message, 500);
    }

    const nextOwners = await readAdminOwners();
    const nextOwner = nextOwners.find((item) => item.userId === body.userId && item.shopId === body.shopId);
    if (nextOwner) {
      const events = createAdminEvents({
        previousOwner,
        nextOwner,
        adminEmail: adminSession.email.toLowerCase().trim() || "unknown-admin",
      });

      if (events.length > 0) {
        const insertEventsResult = await admin.from("owner_admin_events").insert(events);
        if (insertEventsResult.error && insertEventsResult.error.code !== "42P01") {
          throw new AdminApiError(insertEventsResult.error.message, 500);
        }
      }
    }

    const refreshedOwners = await readAdminOwners();
    return NextResponse.json({ success: true, owners: refreshedOwners });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "날짜 형식이나 입력값을 다시 확인해 주세요." }, { status: 400 });
    }

    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "오너 계정을 저장하지 못했습니다." }, { status: 500 });
  }
}
