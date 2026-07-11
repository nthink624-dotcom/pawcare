import { getAlimtalkCreditProduct } from "@/lib/alimtalk-credit-products";
import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { grantShopAlimtalkCredits } from "@/server/alimtalk-credit-service";
import { OwnerBillingError, type BillingIdentity } from "@/server/owner-billing";
import type { AlimtalkCreditSummary } from "@/types/domain";

type PortonePaymentResponse = {
  payment?: {
    status?: string;
    amount?: { total?: number };
    totalAmount?: number;
    paidAmount?: number;
    customData?: string | Record<string, unknown> | null;
    paidAt?: string | null;
  };
  status?: string;
  amount?: { total?: number };
  totalAmount?: number;
  paidAmount?: number;
  customData?: string | Record<string, unknown> | null;
  paidAt?: string | null;
  message?: string;
};

type CreditLedgerPayload = {
  kind?: unknown;
  productId?: unknown;
  creditCount?: unknown;
  amount?: unknown;
  creditGrantedEventId?: unknown;
};

function getAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerBillingError("Supabase 관리자 설정을 확인해 주세요.", 503);
  }
  return admin;
}

async function portoneFetch<T>(path: string) {
  if (!serverEnv.portoneApiSecret) {
    throw new OwnerBillingError("PortOne 서버 설정을 확인해 주세요.", 503);
  }

  const response = await fetch(`https://api.portone.io${path}`, {
    headers: {
      Authorization: `PortOne ${serverEnv.portoneApiSecret}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as T & { message?: string }) : ({} as T & { message?: string });

  if (!response.ok) {
    throw new OwnerBillingError(json.message ?? "PortOne 결제 정보를 확인하지 못했습니다.", response.status);
  }

  return json as T;
}

function extractPayment(payload: PortonePaymentResponse) {
  const payment = payload.payment ?? payload;
  return {
    status: payment.status ?? payload.status ?? "",
    amount:
      payment.amount?.total ??
      payload.amount?.total ??
      payment.totalAmount ??
      payload.totalAmount ??
      payment.paidAmount ??
      payload.paidAmount ??
      0,
    customData: payment.customData ?? payload.customData ?? null,
    paidAt: payment.paidAt ?? payload.paidAt ?? null,
  };
}

function parseCustomData(value: string | Record<string, unknown> | null) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isAlreadyGranted(payload: CreditLedgerPayload | null | undefined) {
  return (
    payload?.kind === "alimtalk-credit-purchase" &&
    typeof payload.creditGrantedEventId === "string" &&
    payload.creditGrantedEventId.length > 0
  );
}

async function readCreditSummary(shopId: string): Promise<AlimtalkCreditSummary | null> {
  const admin = getAdmin();
  const result = await admin
    .from("shop_alimtalk_credit_summaries")
    .select(
      "shop_id, included_total, included_used, included_remaining, included_period_started_at, included_period_ends_at, purchased_total, purchased_used, purchased_remaining, remaining_total, updated_at",
    )
    .eq("shop_id", shopId)
    .maybeSingle();

  if (result.error) {
    throw new OwnerBillingError(result.error.message, 500);
  }

  return (result.data ?? null) as AlimtalkCreditSummary | null;
}

async function recordPurchaseEvent(input: {
  identity: BillingIdentity;
  shopId: string;
  paymentId: string;
  amount: number;
  status: string;
  payload: Record<string, unknown>;
}) {
  const admin = getAdmin();
  const insertResult = await admin.from("owner_billing_events").insert({
    user_id: input.identity.id,
    shop_id: input.shopId,
    event_type: "alimtalk_credit_purchased",
    payment_id: input.paymentId,
    amount: input.amount,
    status: input.status,
    payload: input.payload,
  });

  if (insertResult.error) {
    throw new OwnerBillingError(insertResult.error.message, 500);
  }
}

export async function confirmOwnerAlimtalkCreditPurchase(
  paymentId: string,
  expected: { identity: BillingIdentity; shopId: string },
) {
  const admin = getAdmin();
  const existingLedger = await admin
    .from("owner_payment_ledger")
    .select("payment_id, status, payload")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (existingLedger.error) {
    throw new OwnerBillingError(existingLedger.error.message, 500);
  }

  const existingPayload = (existingLedger.data?.payload ?? null) as CreditLedgerPayload | null;
  if (existingLedger.data && isAlreadyGranted(existingPayload)) {
    return {
      ok: true as const,
      alreadyProcessed: true,
      summary: await readCreditSummary(expected.shopId),
    };
  }

  if (existingLedger.data?.status === "REQUESTED") {
    throw new OwnerBillingError("이미 처리 중인 결제입니다. 잠시 후 다시 확인해 주세요.", 409);
  }

  const paymentResponse = await portoneFetch<PortonePaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`);
  const payment = extractPayment(paymentResponse);
  const customData = parseCustomData(payment.customData);

  if (!customData || customData.kind !== "alimtalk-credit-purchase") {
    throw new OwnerBillingError("알림톡 충전 결제 정보를 찾지 못했습니다.", 400);
  }

  const userId = typeof customData.userId === "string" ? customData.userId : null;
  const shopId = typeof customData.shopId === "string" ? customData.shopId : null;
  const productId = typeof customData.productId === "string" ? customData.productId : null;
  const product = getAlimtalkCreditProduct(productId);

  if (!userId || !shopId || userId !== expected.identity.id || shopId !== expected.shopId || !product) {
    throw new OwnerBillingError("현재 매장의 알림톡 충전 결제가 아닙니다.", 403);
  }

  if (payment.status !== "PAID") {
    throw new OwnerBillingError("결제가 완료된 뒤 알림톡이 충전됩니다.", 400);
  }

  if (payment.amount !== product.price) {
    throw new OwnerBillingError("결제 금액이 충전 상품과 일치하지 않습니다.", 400);
  }

  const ledgerPayload = {
    kind: "alimtalk-credit-purchase",
    productId: product.id,
    creditCount: product.creditCount,
    amount: product.price,
    paidAt: payment.paidAt,
  };

  const holdResult = await admin.from("owner_payment_ledger").insert({
    payment_id: paymentId,
    user_id: expected.identity.id,
    shop_id: expected.shopId,
    plan_code: null,
    amount: product.price,
    status: "REQUESTED",
    paid_at: payment.paidAt,
    last_event_type: "alimtalk_credit_purchase_requested",
    payload: ledgerPayload,
  });

  if (holdResult.error) {
    if (holdResult.error.code === "23505") {
      throw new OwnerBillingError("이미 처리 중인 결제입니다. 잠시 후 다시 확인해 주세요.", 409);
    }
    throw new OwnerBillingError(holdResult.error.message, 500);
  }

  const grantResult = await grantShopAlimtalkCredits({
    shopId: expected.shopId,
    amount: product.creditCount,
    creditBucket: "purchased",
    reason: "owner_alimtalk_credit_purchase",
    metadata: {
      paymentId,
      productId: product.id,
      amount: product.price,
    },
  });

  const finalPayload = {
    ...ledgerPayload,
    creditGrantedEventId: grantResult.eventId,
    remainingCount: grantResult.remainingCount,
  };

  const updateResult = await admin
    .from("owner_payment_ledger")
    .update({
      status: "PAID",
      last_event_type: "alimtalk_credit_purchased",
      payload: finalPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("payment_id", paymentId);

  if (updateResult.error) {
    throw new OwnerBillingError(updateResult.error.message, 500);
  }

  await recordPurchaseEvent({
    identity: expected.identity,
    shopId: expected.shopId,
    paymentId,
    amount: product.price,
    status: "PAID",
    payload: finalPayload,
  });

  return {
    ok: true as const,
    alreadyProcessed: false,
    summary: await readCreditSummary(expected.shopId),
  };
}

export async function syncOwnerAlimtalkCreditPurchaseFromPayment(paymentId: string) {
  const paymentResponse = await portoneFetch<PortonePaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`);
  const payment = extractPayment(paymentResponse);
  const customData = parseCustomData(payment.customData);

  if (!customData || customData.kind !== "alimtalk-credit-purchase") {
    return null;
  }

  const userId = typeof customData.userId === "string" ? customData.userId : null;
  const shopId = typeof customData.shopId === "string" ? customData.shopId : null;
  if (!userId || !shopId) {
    return null;
  }

  return confirmOwnerAlimtalkCreditPurchase(paymentId, {
    identity: { id: userId },
    shopId,
  });
}
