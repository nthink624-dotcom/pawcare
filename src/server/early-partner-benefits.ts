import { getSupabaseAdmin } from "@/lib/supabase/server";

export class EarlyPartnerBenefitError extends Error {
  public status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export type EarlyPartnerBenefitGrantReason = "core_issue" | "major_issue";

export type EarlyPartnerBenefitGrantResult = {
  status: "granted" | "already_granted";
  claimId: string;
  grantId?: string;
  grantedDays: 7 | 14;
  currentPeriodEndsAt: string;
  nextBillingAt: string | null;
  cumulativeBonusDays?: number;
  benefitWindowEndsAt?: string;
};

function readGrantResult(value: unknown): EarlyPartnerBenefitGrantResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EarlyPartnerBenefitError("초기 협력 매장 혜택 처리 결과를 확인하지 못했습니다.");
  }

  const result = value as Record<string, unknown>;
  const status = result.status;
  const claimId = result.claimId;
  const grantedDays = result.grantedDays;
  const currentPeriodEndsAt = result.currentPeriodEndsAt;
  const nextBillingAt = result.nextBillingAt;

  if (
    (status !== "granted" && status !== "already_granted") ||
    typeof claimId !== "string" ||
    (grantedDays !== 7 && grantedDays !== 14) ||
    typeof currentPeriodEndsAt !== "string" ||
    (nextBillingAt !== null && typeof nextBillingAt !== "string")
  ) {
    throw new EarlyPartnerBenefitError("초기 협력 매장 혜택 처리 결과 형식이 올바르지 않습니다.");
  }

  return {
    status,
    claimId,
    ...(typeof result.grantId === "string" ? { grantId: result.grantId } : {}),
    grantedDays,
    currentPeriodEndsAt,
    nextBillingAt,
    ...(typeof result.cumulativeBonusDays === "number" ? { cumulativeBonusDays: result.cumulativeBonusDays } : {}),
    ...(typeof result.benefitWindowEndsAt === "string" ? { benefitWindowEndsAt: result.benefitWindowEndsAt } : {}),
  };
}

/**
 * Server-only entry point for the future admin issue-resolution control.
 * The database function validates the 3-month eligibility window, a 60-day
 * issue-compensation cap separate from the initial 30-day bonus, and the
 * request idempotency key in one transaction.
 */
export async function grantEarlyPartnerManualBenefit(input: {
  shopId: string;
  reason: EarlyPartnerBenefitGrantReason;
  actorId: string;
  idempotencyKey: string;
  auditPayload?: Record<string, unknown>;
}): Promise<EarlyPartnerBenefitGrantResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new EarlyPartnerBenefitError("Supabase 관리자 설정을 확인해 주세요.", 503);
  }

  const days = input.reason === "major_issue" ? 14 : 7;
  const result = await admin.rpc("grant_early_partner_manual_bonus_v1", {
    p_shop_id: input.shopId,
    p_days: days,
    p_reason_code: input.reason,
    p_actor_id: input.actorId,
    p_idempotency_key: input.idempotencyKey,
    p_payload: input.auditPayload ?? {},
  });

  if (result.error) {
    throw new EarlyPartnerBenefitError(result.error.message, 409);
  }

  return readGrantResult(result.data);
}
