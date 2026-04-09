import { requestIssueBillingKey } from "@portone/browser-sdk/v2";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { env } from "@/lib/env";
import type { OwnerPlanCode } from "@/lib/billing/owner-plans";
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

function buildPaymentMethodLabel(result: BillingKeyIssueResponse) {
  const source = result.billingKeyInfo ?? result;
  const company = source.cardCompany || source.methodName || "등록된 카드";
  const number = source.cardNumber ? ` (${source.cardNumber})` : "";
  return `${company}${number}`.trim();
}

function extractBillingKey(result: BillingKeyIssueResponse) {
  return result.billingKeyInfo?.billingKey || result.billingKey || null;
}

function extractIssueId(result: BillingKeyIssueResponse) {
  return result.billingKeyInfo?.issueId || result.issueId || null;
}

export async function fetchOwnerSubscriptionSummary() {
  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription");
}

export async function saveOwnerSubscriptionPreferences(payload: {
  currentPlanCode?: OwnerPlanCode;
}) {
  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function retryOwnerSubscriptionPayment() {
  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription/retry", {
    method: "POST",
  });
}

export async function issueOwnerBillingKey(params: {
  customerId: string;
  customerName: string;
  phoneNumber?: string | null;
  email?: string | null;
  planCode: OwnerPlanCode;
}) {
  if (!env.portoneStoreId || !env.portoneBillingChannelKey) {
    throw new Error("PortOne 정기결제 설정을 먼저 확인해 주세요.");
  }

  const issueId = `owner_billing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const result = await requestIssueBillingKey({
    storeId: env.portoneStoreId,
    channelKey: env.portoneBillingChannelKey,
    billingKeyMethod: "CARD",
    issueId,
    issueName: "멍매니저 결제수단 등록",
    customer: {
      customerId: params.customerId,
      fullName: params.customerName,
      phoneNumber: params.phoneNumber || undefined,
      email: params.email || undefined,
    },
    redirectUrl: `${window.location.origin}/owner/billing`,
  });

  if (!result) {
    throw new Error("결제수단 등록 창을 열지 못했습니다.");
  }

  if (result.code || result.message) {
    throw new Error(result.message || "결제수단을 등록하지 못했습니다.");
  }

  const billingKey = extractBillingKey(result);
  if (!billingKey) {
    throw new Error("빌링키를 확인하지 못했습니다.");
  }

  return fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription/payment-method", {
    method: "POST",
    body: JSON.stringify({
      billingKey,
      issueId: extractIssueId(result),
      paymentMethodLabel: buildPaymentMethodLabel(result),
      planCode: params.planCode,
    }),
  });
}
