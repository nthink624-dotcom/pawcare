import { fetchApiJsonWithAuth } from "@/lib/api";
import { OWNER_SINGLE_MONTHLY_PLAN_CODE } from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";

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
