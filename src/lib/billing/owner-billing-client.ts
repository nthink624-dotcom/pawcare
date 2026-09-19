import { requestIssueBillingKey } from "@portone/browser-sdk/v2";

import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  OWNER_SINGLE_MONTHLY_ORDER_NAME,
  OWNER_SINGLE_MONTHLY_PLAN_CODE,
} from "@/lib/billing/owner-plans";
import { createPortoneId } from "@/lib/billing/portone-ids";
import { env } from "@/lib/env";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";

type BillingKeyIssueResponse = {
  code?: string;
  message?: string;
  billingKey?: string;
  issueId?: string;
  methodName?: string;
  cardCompany?: string;
  cardNumber?: string;
  billingKeyInfo?: {
    billingKey?: string;
    issueId?: string;
    methodName?: string;
    cardCompany?: string;
    cardNumber?: string;
  };
};

function subscriptionPath(path: string, shopId: string) {
  const normalizedShopId = shopId.trim();
  if (!normalizedShopId) {
    throw new Error("결제를 관리할 매장을 다시 선택해 주세요.");
  }
  return `${path}?${new URLSearchParams({ shopId: normalizedShopId }).toString()}`;
}

function extractCardPrefix(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 3 ? digits.slice(0, 3) : null;
}

function buildPaymentMethodLabel(result: BillingKeyIssueResponse) {
  const source = result.billingKeyInfo ?? result;
  const company = source.cardCompany || source.methodName || "등록된 카드";
  const prefix = extractCardPrefix(source.cardNumber);
  return prefix ? `${company.trim()} · ${prefix}` : company.trim();
}

function extractBillingKey(result: BillingKeyIssueResponse) {
  return result.billingKeyInfo?.billingKey || result.billingKey || null;
}

function extractIssueId(result: BillingKeyIssueResponse) {
  return result.billingKeyInfo?.issueId || result.issueId || null;
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

export async function issueOwnerBillingKey(params: {
  shopId: string;
  customerId: string;
  customerName: string;
  phoneNumber?: string | null;
  email?: string | null;
}): Promise<OwnerSubscriptionSummary | null> {
  if (!env.portoneStoreId || !env.portoneBillingChannelKey) {
    throw new Error("PortOne 정기결제 설정을 먼저 확인해 주세요.");
  }

  const issueId = createPortoneId("obill");
  const result = await requestIssueBillingKey({
    storeId: env.portoneStoreId,
    channelKey: env.portoneBillingChannelKey,
    billingKeyMethod: "CARD",
    issueId,
    issueName: `${OWNER_SINGLE_MONTHLY_ORDER_NAME} 결제수단 등록`,
    customer: {
      customerId: params.customerId,
      fullName: params.customerName,
      phoneNumber: params.phoneNumber || undefined,
      email: params.email || undefined,
    },
    offerPeriod: { interval: "1m" },
  });

  if (!result && typeof window !== "undefined") return null;
  if (!result) throw new Error("결제수단 등록 창을 열지 못했습니다.");
  if (result.code || result.message) {
    throw new Error(result.message || "결제수단을 등록하지 못했습니다.");
  }

  const billingKey = extractBillingKey(result);
  if (!billingKey) throw new Error("빌링키를 확인하지 못했습니다.");

  return registerOwnerBillingKey({
    shopId: params.shopId,
    billingKey,
    issueId: extractIssueId(result),
    paymentMethodLabel: buildPaymentMethodLabel(result),
  });
}
