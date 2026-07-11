import { requestPayment } from "@portone/browser-sdk/v2";

import { getAlimtalkCreditProduct, type AlimtalkCreditProductId } from "@/lib/alimtalk-credit-products";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { createPortoneId } from "@/lib/billing/portone-ids";
import { env } from "@/lib/env";
import { kpnApprovedCardCompanies } from "@/lib/portone/cards";
import type { AlimtalkCreditSummary } from "@/types/domain";

type PurchaseConfirmResponse = {
  ok: true;
  alreadyProcessed: boolean;
  summary: AlimtalkCreditSummary | null;
};

const DEFAULT_PUBLIC_NOTICE_ORIGIN = "https://www.petmanager.co.kr";

function isLocalOrigin(value: string | null | undefined) {
  return Boolean(value && /localhost|127\.0\.0\.1/i.test(value));
}

function buildNoticeUrl() {
  const currentOrigin = window.location.origin.replace(/\/$/, "");
  if (!isLocalOrigin(currentOrigin)) {
    return `${currentOrigin}/api/webhooks/portone`;
  }

  const configuredOrigin = env.siteUrl?.replace(/\/$/, "");
  if (configuredOrigin && !isLocalOrigin(configuredOrigin)) {
    return `${configuredOrigin}/api/webhooks/portone`;
  }

  return `${DEFAULT_PUBLIC_NOTICE_ORIGIN}/api/webhooks/portone`;
}

export async function confirmAlimtalkCreditPurchase(paymentId: string) {
  return fetchApiJsonWithAuth<PurchaseConfirmResponse>("/api/alimtalk-credits/purchase/confirm", {
    method: "POST",
    body: JSON.stringify({ paymentId }),
  });
}

export async function requestAlimtalkCreditPurchase(params: {
  productId: AlimtalkCreditProductId;
  userId: string;
  shopId: string;
  customerName: string;
  phoneNumber?: string | null;
  email?: string | null;
}) {
  const product = getAlimtalkCreditProduct(params.productId);
  if (!product) {
    throw new Error("충전 상품을 찾지 못했습니다.");
  }

  if (!env.portoneStoreId || !env.portonePaymentChannelKey) {
    throw new Error("PortOne 일반결제 설정을 먼저 확인해 주세요.");
  }

  const paymentId = createPortoneId("talk");
  const result = await requestPayment({
    storeId: env.portoneStoreId,
    channelKey: env.portonePaymentChannelKey,
    paymentId,
    orderName: `펫매니저 알림톡 ${product.creditCount.toLocaleString("ko-KR")}건 충전`,
    totalAmount: product.price,
    currency: "KRW",
    payMethod: "CARD",
    card: {
      availableCards: kpnApprovedCardCompanies,
    },
    customer: {
      customerId: `owner_${params.userId}`,
      fullName: params.customerName,
      phoneNumber: params.phoneNumber || undefined,
      email: params.email || undefined,
    },
    redirectUrl: `${window.location.origin}/owner/alimtalk-credits`,
    customData: {
      kind: "alimtalk-credit-purchase",
      userId: params.userId,
      shopId: params.shopId,
      productId: product.id,
      creditCount: product.creditCount,
      amount: product.price,
    },
    noticeUrls: [buildNoticeUrl()],
  });

  if (!result) {
    throw new Error("결제창을 열지 못했습니다.");
  }

  if (result.code || result.message) {
    throw new Error(result.message || "결제를 완료하지 못했습니다.");
  }

  if (!result.paymentId) {
    throw new Error("결제 정보를 확인하지 못했습니다.");
  }

  return confirmAlimtalkCreditPurchase(result.paymentId);
}
