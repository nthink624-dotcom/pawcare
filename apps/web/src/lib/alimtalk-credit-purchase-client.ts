import type { AlimtalkCreditProductId } from "@/lib/alimtalk-credit-products";

const SALES_ENDED_MESSAGE = "알림톡 추가 발송 이용권 판매가 종료되었습니다.";

function salesEnded(): never {
  throw new Error(SALES_ENDED_MESSAGE);
}

export async function confirmAlimtalkCreditPurchase(_paymentId: string) {
  return salesEnded();
}

export async function purchaseAlimtalkCreditsWithRegisteredCard(_params: {
  productId: AlimtalkCreditProductId;
  requestId: string;
}) {
  return salesEnded();
}

export async function requestAlimtalkCreditPurchase(_params: {
  productId: AlimtalkCreditProductId;
  userId: string;
  shopId: string;
  customerName: string;
  phoneNumber?: string | null;
  email?: string | null;
}) {
  return salesEnded();
}
