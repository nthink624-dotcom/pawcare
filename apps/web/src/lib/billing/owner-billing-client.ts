import { fetchApiJsonWithAuth } from "@/lib/api";
import { OWNER_SINGLE_MONTHLY_PLAN_CODE } from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { env } from "@/lib/env";

const hostedCardAttemptKey = "owner-billing:hosted-card-attempt";

export function takeOwnerHostedCardAttempt(shopId: string, issueId: string) {
  try {
    const raw = window.sessionStorage.getItem(hostedCardAttemptKey);
    if (!raw) return false;
    const pending = JSON.parse(raw) as { shopId?: string; issueId?: string; expiresAt?: number };
    if (pending.shopId !== shopId || pending.issueId !== issueId) return false;
    window.sessionStorage.removeItem(hostedCardAttemptKey);
    return typeof pending.expiresAt === "number" && pending.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export async function requestOwnerHostedBillingKey(shopId: string, customerId: string | null) {
  if (!env.portoneStoreId || !env.portoneBillingChannelKey || !customerId) {
    throw new Error("카드 등록 설정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  const { requestIssueBillingKey } = await import("@portone/browser-sdk/v2");
  const issueId = `pm-card-${window.crypto.randomUUID()}`;
  const redirectUrl = new URL("/owner/billing", window.location.origin);
  redirectUrl.search = new URLSearchParams({ billingReturn: "1", plan: OWNER_SINGLE_MONTHLY_PLAN_CODE, attempt: issueId }).toString();
  window.sessionStorage.setItem(hostedCardAttemptKey, JSON.stringify({
    shopId,
    issueId,
    expiresAt: Date.now() + 20 * 60 * 1000,
  }));

  try {
    const result = await requestIssueBillingKey({
      storeId: env.portoneStoreId,
      channelKey: env.portoneBillingChannelKey,
      billingKeyMethod: "CARD",
      issueId,
      issueName: "펫매니저 정기결제 카드 등록",
      customer: { customerId },
      redirectUrl: redirectUrl.toString(),
    });
    if (!result) return null;
    if (!takeOwnerHostedCardAttempt(shopId, issueId) || result.code || !result.billingKey || result.billingKey === "NEEDS_CONFIRMATION") {
      throw new Error("카드 등록을 완료하지 못했습니다. 다시 시도해 주세요.");
    }
    return { shopId, issueId, billingKey: result.billingKey };
  } catch (error) {
    takeOwnerHostedCardAttempt(shopId, issueId);
    throw error;
  }
}

function subscriptionPath(path: string, shopId: string) {
  const normalizedShopId = shopId.trim();
  if (!normalizedShopId) {
    throw new Error("결제를 관리할 매장을 다시 선택해 주세요.");
  }
  return `${path}?${new URLSearchParams({ shopId: normalizedShopId }).toString()}`;
}

export async function fetchOwnerSubscriptionSummary(shopId: string) {
  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>(subscriptionPath("/api/subscription", shopId));
}

export async function saveOwnerSubscriptionPreferences(shopId: string) {
  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>(subscriptionPath("/api/subscription", shopId), {
    method: "PATCH",
    body: JSON.stringify({ currentPlanCode: OWNER_SINGLE_MONTHLY_PLAN_CODE }),
  });
}

export async function retryOwnerSubscriptionPayment(shopId: string) {
  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>(subscriptionPath("/api/subscription/retry", shopId), {
    method: "POST",
  });
}

export async function cancelOwnerSubscriptionRenewal(shopId: string) {
  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>(subscriptionPath("/api/subscription/cancel", shopId), {
    method: "POST",
  });
}

export async function confirmOwnerSubscriptionPayment(shopId: string, paymentId: string) {
  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>(
    subscriptionPath("/api/subscription/confirm-payment", shopId),
    { method: "POST", body: JSON.stringify({ paymentId }) },
  );
}

export async function registerOwnerBillingKey(params: {
  shopId: string;
  billingKey: string;
  issueId?: string | null;
  paymentMethodLabel?: string | null;
}) {
  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>(
    subscriptionPath("/api/subscription/payment-method", params.shopId),
    {
      method: "POST",
      body: JSON.stringify({
        billingKey: params.billingKey,
        issueId: params.issueId,
        paymentMethodLabel: params.paymentMethodLabel,
        planCode: OWNER_SINGLE_MONTHLY_PLAN_CODE,
      }),
    },
  );
}

export async function issueOwnerBillingKeyByApi(params: {
  shopId: string;
  cardNumber: string;
  expiryYear: string;
  expiryMonth: string;
  birthOrBusinessRegistrationNumber: string;
  passwordTwoDigits: string;
  customerName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}) {
  const { shopId, ...paymentMethod } = params;
  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>(
    subscriptionPath("/api/subscription/payment-method/issue", shopId),
    {
      method: "POST",
      body: JSON.stringify({ ...paymentMethod, planCode: OWNER_SINGLE_MONTHLY_PLAN_CODE }),
    },
  );
}
