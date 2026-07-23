import type { OwnerPlanCode } from "@/lib/billing/owner-plans";
import { serverEnv } from "@/lib/server-env";
import {
  OwnerBillingError,
  registerOwnerBillingMethod,
  type BillingIdentity,
} from "@/server/owner-billing";

type PortoneIssueBillingKeyResponse = {
  billingKey?: string;
  issueId?: string;
  billingKeyInfo?: {
    billingKey?: string;
    issueId?: string;
    paymentMethod?: {
      card?: {
        issuer?: string | null;
        publisher?: string | null;
        number?: string | null;
      } | null;
    } | null;
  } | null;
};

export type OwnerBillingKeyIssueInput = {
  cardNumber: string;
  expiryYear: string;
  expiryMonth: string;
  birthOrBusinessRegistrationNumber: string;
  passwordTwoDigits: string;
  planCode: OwnerPlanCode;
  customerName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
};

function normalizeCardIssuer(value: string | null | undefined) {
  if (!value) return null;
  const issuer = value.trim();
  if (!issuer) return null;
  return issuer.endsWith("카드") ? issuer : `${issuer}카드`;
}

function paymentMethodLabel(response: PortoneIssueBillingKeyResponse) {
  const card = response.billingKeyInfo?.paymentMethod?.card;
  const issuer = normalizeCardIssuer(card?.issuer ?? card?.publisher);
  const prefix = card?.number?.replace(/\D/g, "").slice(0, 3);
  if (!issuer) return null;
  return prefix ? `${issuer} · ${prefix}` : issuer;
}

export async function issueOwnerBillingKeyViaApi(
  identity: BillingIdentity,
  shopId: string,
  input: OwnerBillingKeyIssueInput,
) {
  if (!serverEnv.portoneApiSecret || !serverEnv.portoneBillingChannelKey) {
    throw new OwnerBillingError("PortOne 정기결제 서버 설정을 확인해 주세요.", 503);
  }

  const response = await fetch("https://api.portone.io/billing-keys", {
    method: "POST",
    headers: {
      Authorization: `PortOne ${serverEnv.portoneApiSecret}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      channelKey: serverEnv.portoneBillingChannelKey,
      customer: {
        id: `owner_${identity.id}`,
        name: input.customerName ? { full: input.customerName } : undefined,
        phoneNumber: input.phoneNumber || undefined,
        email: input.email || undefined,
      },
      method: {
        card: {
          credential: {
            number: input.cardNumber,
            expiryYear: input.expiryYear,
            expiryMonth: input.expiryMonth,
            birthOrBusinessRegistrationNumber: input.birthOrBusinessRegistrationNumber,
            passwordTwoDigits: input.passwordTwoDigits,
          },
        },
      },
    }),
  });

  const raw = await response.text();
  let result: PortoneIssueBillingKeyResponse & { message?: string } = {};
  if (raw) {
    try {
      result = JSON.parse(raw) as PortoneIssueBillingKeyResponse & { message?: string };
    } catch {
      throw new OwnerBillingError("카드 등록 결과를 확인하지 못했습니다.", 502);
    }
  }

  if (!response.ok) {
    throw new OwnerBillingError(result.message ?? "카드를 등록하지 못했습니다.", response.status);
  }

  const billingKey = result.billingKeyInfo?.billingKey ?? result.billingKey;
  if (!billingKey) {
    throw new OwnerBillingError("빌링키 발급 결과를 확인하지 못했습니다.", 502);
  }

  return registerOwnerBillingMethod(identity, shopId, {
    billingKey,
    issueId: result.billingKeyInfo?.issueId ?? result.issueId ?? null,
    paymentMethodLabel: paymentMethodLabel(result),
    autoRenewPlanCode: input.planCode,
  });
}
