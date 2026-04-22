import { ownerPlans, type OwnerPlan, type OwnerPlanCode } from "@/lib/billing/owner-plans";

export type OwnerSubscriptionStatus =
  | "trialing"
  | "trial_will_end"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";
export type SubscriptionNoticeLevel = "none" | "3days" | "1day" | "expired" | "past_due";
export type BillingCycle = "0m" | "1m" | "3m" | "6m" | "12m";
export type OwnerLastPaymentStatus = "none" | "scheduled" | "paid" | "failed" | "cancelled";

export type OwnerSubscriptionSummary = {
  userId: string;
  shopId: string;
  status: OwnerSubscriptionStatus;
  currentPlanCode: OwnerPlanCode;
  currentPlan: OwnerPlan;
  billingCycle: BillingCycle;
  trialStartedAt: string;
  trialEndsAt: string;
  nextBillingAt: string | null;
  paymentMethodExists: boolean;
  paymentMethodLabel: string | null;
  paymentMethodResetRequired: boolean;
  paymentMethodProblemCode: "decrypt_failed" | "missing_key" | null;
  autoRenewEnabled: boolean;
  autoRenewPlanCode: OwnerPlanCode;
  autoRenewPlan: OwnerPlan;
  featuredPlanCode: OwnerPlanCode;
  noticeLevel: SubscriptionNoticeLevel;
  daysUntilTrialEnds: number;
  cancelAtPeriodEnd: boolean;
  lastPaymentStatus: OwnerLastPaymentStatus;
  lastPaymentAt: string | null;
  lastPaymentFailedAt: string | null;
  lastPaymentId: string | null;
  currentPeriodStartedAt: string | null;
  currentPeriodEndsAt: string | null;
  ownerName: string | null;
  ownerPhoneNumber: string | null;
  ownerEmail: string | null;
};

export const OWNER_TRIAL_DAYS = 14;

const ownerPlanCodes = ownerPlans.map((plan) => plan.code);

function isOwnerPlanCode(value: unknown): value is OwnerPlanCode {
  return typeof value === "string" && ownerPlanCodes.includes(value as OwnerPlanCode);
}

function getPlanOrDefault(code: string | null | undefined) {
  return ownerPlans.find((plan) => plan.code === code) ?? ownerPlans.find((plan) => plan.code === "monthly") ?? ownerPlans[0];
}

export function addDaysIso(baseIso: string, days: number) {
  const date = new Date(baseIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function addMonthsIso(baseIso: string, months: number) {
  const date = new Date(baseIso);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function diffDays(fromIso: string, toIso: string) {
  const diff = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.ceil(diff / 86400000);
}

export function planCodeToBillingCycle(code: OwnerPlanCode): BillingCycle {
  switch (code) {
    case "free":
      return "0m";
    case "quarterly":
      return "3m";
    case "halfyearly":
      return "6m";
    case "yearly":
      return "12m";
    default:
      return "1m";
  }
}

export function normalizeOwnerSubscriptionMetadata(
  metadata: Record<string, unknown> | null | undefined,
  createdAt: string,
  options?: {
    userId?: string;
    shopId?: string;
    ownerName?: string | null;
    ownerPhoneNumber?: string | null;
    ownerEmail?: string | null;
  },
) {
  const baseCreatedAt = createdAt || new Date().toISOString();
  const trialStartedAt =
    typeof metadata?.trial_started_at === "string" ? metadata.trial_started_at : baseCreatedAt;
  const trialEndsAt =
    typeof metadata?.trial_ends_at === "string"
      ? metadata.trial_ends_at
      : addDaysIso(trialStartedAt, OWNER_TRIAL_DAYS);

  const featuredPlanCode = isOwnerPlanCode(metadata?.featured_plan_code)
    ? metadata.featured_plan_code
    : "yearly";
  const autoRenewPlanCode = isOwnerPlanCode(metadata?.auto_renew_plan_code)
    ? metadata.auto_renew_plan_code
    : "monthly";
  const currentPlanCode = isOwnerPlanCode(metadata?.current_plan_code)
    ? metadata.current_plan_code
    : autoRenewPlanCode;

  const paymentMethodExists = metadata?.payment_method_exists === true;
  const paymentMethodLabel =
    typeof metadata?.payment_method_label === "string" ? metadata.payment_method_label : null;
  const paymentMethodResetRequired = metadata?.payment_method_reset_required === true;
  const paymentMethodProblemCode =
    metadata?.payment_method_problem_code === "decrypt_failed" ||
    metadata?.payment_method_problem_code === "missing_key"
      ? metadata.payment_method_problem_code
      : null;
  const lastPaymentStatus =
    metadata?.last_payment_status === "scheduled" ||
    metadata?.last_payment_status === "paid" ||
    metadata?.last_payment_status === "failed" ||
    metadata?.last_payment_status === "cancelled"
      ? metadata.last_payment_status
      : "none";
  const lastPaymentAt = typeof metadata?.last_payment_at === "string" ? metadata.last_payment_at : null;
  const lastPaymentFailedAt =
    typeof metadata?.last_payment_failed_at === "string" ? metadata.last_payment_failed_at : null;
  const lastPaymentId = typeof metadata?.last_payment_id === "string" ? metadata.last_payment_id : null;
  const currentPeriodStartedAt =
    typeof metadata?.current_period_started_at === "string"
      ? metadata.current_period_started_at
      : null;
  const currentPeriodEndsAt =
    typeof metadata?.current_period_ends_at === "string" ? metadata.current_period_ends_at : null;
  const nextBillingAt =
    typeof metadata?.next_billing_at === "string" ? metadata.next_billing_at : currentPeriodEndsAt;
  const autoRenewEnabled = false;
  const cancelAtPeriodEnd = false;
  const storedStatus =
    metadata?.subscription_status === "trial_will_end" ||
    metadata?.subscription_status === "active" ||
    metadata?.subscription_status === "past_due" ||
    metadata?.subscription_status === "canceled" ||
    metadata?.subscription_status === "expired"
      ? metadata.subscription_status
      : "trialing";

  const now = new Date().toISOString();
  const daysUntilTrialEnds = diffDays(now, trialEndsAt);
  const daysUntilPeriodEnds = currentPeriodEndsAt ? diffDays(now, currentPeriodEndsAt) : null;

  let status: OwnerSubscriptionStatus = storedStatus;
  if (storedStatus === "past_due") {
    status = "past_due";
  } else if (storedStatus === "active" || storedStatus === "canceled") {
    status = daysUntilPeriodEnds !== null && daysUntilPeriodEnds <= 0 ? "expired" : "active";
  } else if (
    (storedStatus === "trialing" || storedStatus === "trial_will_end") &&
    daysUntilTrialEnds <= 3 &&
    daysUntilTrialEnds > 0
  ) {
    status = "trial_will_end";
  } else if (storedStatus === "trialing" || storedStatus === "trial_will_end") {
    status = daysUntilTrialEnds <= 0 ? "expired" : "trialing";
  }

  let noticeLevel: SubscriptionNoticeLevel = "none";
  if (status === "past_due") {
    noticeLevel = "past_due";
  } else if (daysUntilTrialEnds <= 0) {
    noticeLevel = "expired";
  } else if (daysUntilTrialEnds <= 1) {
    noticeLevel = "1day";
  } else if (daysUntilTrialEnds <= 3) {
    noticeLevel = "3days";
  }

  const currentPlan = getPlanOrDefault(currentPlanCode);
  const autoRenewPlan = getPlanOrDefault(autoRenewPlanCode);

  return {
    userId: options?.userId ?? "",
    shopId: options?.shopId ?? "",
    status,
    currentPlanCode,
    currentPlan,
    billingCycle: planCodeToBillingCycle(currentPlanCode),
    trialStartedAt,
    trialEndsAt,
    nextBillingAt,
    paymentMethodExists,
    paymentMethodLabel,
    paymentMethodResetRequired,
    paymentMethodProblemCode,
    autoRenewEnabled,
    autoRenewPlanCode,
    autoRenewPlan,
    featuredPlanCode,
    noticeLevel,
    daysUntilTrialEnds,
    cancelAtPeriodEnd,
    lastPaymentStatus,
    lastPaymentAt,
    lastPaymentFailedAt,
    lastPaymentId,
    currentPeriodStartedAt,
    currentPeriodEndsAt,
    ownerName: options?.ownerName ?? null,
    ownerPhoneNumber: options?.ownerPhoneNumber ?? null,
    ownerEmail: options?.ownerEmail ?? null,
  } satisfies OwnerSubscriptionSummary;
}
