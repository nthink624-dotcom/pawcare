import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  OWNER_PILOT_INITIAL_FREE_DAYS,
  OWNER_PILOT_MAX_FREE_DAYS,
  type OwnerPilotBenefitGrantKind,
  type OwnerPilotBenefitStatus,
} from "@/lib/billing/owner-pilot-benefit";

export class OwnerPilotBenefitError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type PilotClaimRow = {
  free_started_at: string;
  free_ends_at: string;
  total_free_days: number;
};

type PilotGrantRow = {
  grant_id: string;
  grant_kind: OwnerPilotBenefitGrantKind;
  granted_days: number;
  reason: string;
  created_at: string;
};

function isMissingPilotSchema(error: DatabaseErrorLike | null | undefined) {
  const detail = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return error?.code === "42P01" || detail.includes("owner_pilot_benefit_claims");
}

function emptyStatus(schemaReady: boolean, paid = false): OwnerPilotBenefitStatus {
  return {
    schemaReady,
    enrolled: false,
    paid,
    freeStartedAt: null,
    freeEndsAt: null,
    totalFreeDays: 0,
    remainingGrantableDays: OWNER_PILOT_MAX_FREE_DAYS,
    grants: [],
  };
}

async function requireExactOwnerSubscription(userId: string, shopId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerPilotBenefitError("관리자 데이터 연결을 확인해 주세요.", 503);

  const subscription = await admin
    .from("owner_subscriptions")
    .select("user_id, shop_id")
    .eq("user_id", userId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (subscription.error) throw new OwnerPilotBenefitError("매장 이용 정보를 확인하지 못했습니다.", 503);
  if (!subscription.data) throw new OwnerPilotBenefitError("선택한 오너와 매장이 일치하지 않습니다.", 404);
  return admin;
}

export async function getOwnerPilotBenefitStatus(input: { userId: string; shopId: string }) {
  const admin = await requireExactOwnerSubscription(input.userId, input.shopId);
  const payment = await admin
    .from("owner_payment_ledger")
    .select("id")
    .eq("user_id", input.userId)
    .eq("shop_id", input.shopId)
    .eq("status", "PAID")
    .limit(1)
    .maybeSingle();
  if (payment.error) throw new OwnerPilotBenefitError("결제 여부를 확인하지 못했습니다.", 503);
  const paid = Boolean(payment.data);

  const claim = await admin
    .from("owner_pilot_benefit_claims")
    .select("free_started_at, free_ends_at, total_free_days")
    .eq("user_id", input.userId)
    .eq("shop_id", input.shopId)
    .maybeSingle();
  if (claim.error) {
    if (isMissingPilotSchema(claim.error)) return emptyStatus(false, paid);
    throw new OwnerPilotBenefitError("파일럿 혜택 상태를 확인하지 못했습니다.", 503);
  }
  if (!claim.data) return emptyStatus(true, paid);

  const grantRows = await admin
    .from("owner_pilot_benefit_grants")
    .select("grant_id, grant_kind, granted_days, reason, created_at")
    .eq("user_id", input.userId)
    .eq("shop_id", input.shopId)
    .order("created_at", { ascending: false });
  if (grantRows.error) throw new OwnerPilotBenefitError("파일럿 혜택 지급 기록을 확인하지 못했습니다.", 503);

  const row = claim.data as PilotClaimRow;
  return {
    schemaReady: true,
    enrolled: true,
    paid,
    freeStartedAt: row.free_started_at,
    freeEndsAt: row.free_ends_at,
    totalFreeDays: row.total_free_days,
    remainingGrantableDays: Math.max(0, OWNER_PILOT_MAX_FREE_DAYS - row.total_free_days),
    grants: ((grantRows.data ?? []) as PilotGrantRow[]).map((grant) => ({
      grantId: grant.grant_id,
      kind: grant.grant_kind,
      days: grant.granted_days,
      reason: grant.reason,
      createdAt: grant.created_at,
    })),
  } satisfies OwnerPilotBenefitStatus;
}

export async function grantOwnerPilotBenefit(input: {
  userId: string;
  shopId: string;
  kind: OwnerPilotBenefitGrantKind;
  days: number;
  reason: string;
  adminEmail: string;
  idempotencyKey: string;
}) {
  const admin = await requireExactOwnerSubscription(input.userId, input.shopId);
  // The RPC resolves an exact idempotent replay before evaluating mutable
  // enrollment, payment, and cap state. Do not preflight those values here:
  // a lost successful response must be safely recoverable with the same key.
  const result = await admin.rpc("grant_owner_pilot_pre_payment_benefit_v1", {
    p_user_id: input.userId,
    p_shop_id: input.shopId,
    p_grant_kind: input.kind,
    p_days: input.kind === "initial" ? OWNER_PILOT_INITIAL_FREE_DAYS : input.days,
    p_reason: input.reason,
    p_admin_email: input.adminEmail,
    p_idempotency_key: input.idempotencyKey,
  });
  if (result.error) {
    const code = result.error.message ?? "";
    if (result.error.code === "42883" || code.includes("grant_owner_pilot_pre_payment_benefit_v1")) {
      throw new OwnerPilotBenefitError("파일럿 혜택 DB 준비가 필요합니다.", 503);
    }
    if (code.includes("PM_PILOT_ALREADY_PAID")) throw new OwnerPilotBenefitError("첫 결제 전인 파일럿 매장에만 적용할 수 있습니다.", 409);
    if (code.includes("PM_PILOT_CAP_EXCEEDED")) throw new OwnerPilotBenefitError("파일럿 무료 이용은 최초 시작일부터 총 60일을 넘길 수 없습니다.", 409);
    if (code.includes("PM_PILOT_ALREADY_ENROLLED")) throw new OwnerPilotBenefitError("이미 파일럿 기본 혜택이 적용된 매장입니다.", 409);
    if (code.includes("PM_PILOT_ENROLLMENT_REQUIRED")) throw new OwnerPilotBenefitError("먼저 파일럿 기본 30일을 적용해 주세요.", 409);
    if (code.includes("PM_PILOT_MIN_EXTENSION_REQUIRED")) throw new OwnerPilotBenefitError("피드백·문제 보상은 한 건당 3일 이상이어야 합니다.", 409);
    if (code.includes("PM_PILOT_IDEMPOTENCY_CONFLICT")) throw new OwnerPilotBenefitError("같은 지급 요청의 내용이 달라 처리하지 않았습니다.", 409);
    throw new OwnerPilotBenefitError("파일럿 혜택을 적용하지 못했습니다. 상태를 새로고침해 다시 확인해 주세요.", 409);
  }

  return getOwnerPilotBenefitStatus({ userId: input.userId, shopId: input.shopId });
}
