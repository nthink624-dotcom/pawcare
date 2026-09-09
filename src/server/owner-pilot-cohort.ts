import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  emptyOwnerPilotCohortProjection,
  ownerPilotCohortStatusLabel,
  type OwnerPilotCohortProjection,
  type OwnerPilotCohortStatus,
  type OwnerPilotRecognitionState,
} from "@/lib/billing/owner-pilot-cohort";
import { resolveTesterAccessDisplayState } from "@/lib/tester-feedback";
import { getOwnerPilotBenefitStatus, OwnerPilotBenefitError } from "@/server/owner-pilot-benefits";

export class OwnerPilotCohortError extends Error {
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

type CohortMembershipRow = {
  owner_user_id: string;
  shop_id: string;
  cohort_position: number;
  status: OwnerPilotCohortStatus;
  recognition_state: OwnerPilotRecognitionState;
  tester_access_decision_state?: "pending" | "ended" | "converted" | null;
  tester_access_review_due_at?: string | null;
};

type FirstPaidRow = {
  granted_days: number;
  grant_source: "pilot_cohort" | "legacy_early_partner";
  applied_at: string;
};

function isMissingCohortSchema(error: DatabaseErrorLike | null | undefined) {
  const detail = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return error?.code === "42P01" || detail.includes("owner_pilot_cohort_memberships");
}

function translateCohortRpcError(error: DatabaseErrorLike | null | undefined) {
  const code = error?.message ?? "";
  if (error?.code === "42883" || /owner_pilot_(cohort|feedback)/.test(code)) {
    return new OwnerPilotCohortError("파일럿 코호트 DB 준비가 필요합니다.", 503);
  }
  if (code.includes("PM_PILOT_COHORT_IDEMPOTENCY_CONFLICT")) return new OwnerPilotCohortError("같은 요청의 내용이 달라 처리하지 않았습니다.", 409);
  if (code.includes("PM_PILOT_COHORT_FULL")) return new OwnerPilotCohortError("파일럿 테스트 매장 20곳이 모두 배정되었습니다.", 409);
  if (code.includes("PM_PILOT_COHORT_OWNER_SHOP_MISMATCH")) return new OwnerPilotCohortError("선택한 오너와 매장이 일치하지 않습니다.", 403);
  if (code.includes("PM_PILOT_COHORT_MEMBERSHIP_REQUIRED")) return new OwnerPilotCohortError("파일럿 테스트 매장 등록을 먼저 확인해 주세요.", 409);
  if (code.includes("PM_PILOT_FEEDBACK_REQUIRED")) return new OwnerPilotCohortError("내용이 있는 피드백을 입력해 주세요.", 400);
  if (code.includes("PM_PILOT_MIN_EXTENSION_REQUIRED")) return new OwnerPilotCohortError("피드백 혜택은 건당 3일 이상이어야 합니다.", 400);
  return new OwnerPilotCohortError("파일럿 코호트 요청을 처리하지 못했습니다. 상태를 새로고침해 확인해 주세요.", 409);
}

export async function getOwnerPilotCohortProjection(input: {
  ownerUserId: string;
  shopId: string;
}): Promise<OwnerPilotCohortProjection> {
  const admin = getSupabaseAdmin();
  if (!admin) return emptyOwnerPilotCohortProjection(false);

  let accessSchemaReady = true;
  let membership = await admin
    .from("owner_pilot_cohort_memberships")
    .select("owner_user_id,shop_id,cohort_position,status,recognition_state,tester_access_decision_state,tester_access_review_due_at")
    .eq("owner_user_id", input.ownerUserId)
    .eq("shop_id", input.shopId)
    .maybeSingle();
  if (membership.error && /tester_access_(decision_state|review_due_at)/i.test(membership.error.message ?? "")) {
    accessSchemaReady = false;
    membership = await admin
      .from("owner_pilot_cohort_memberships")
      .select("owner_user_id,shop_id,cohort_position,status,recognition_state")
      .eq("owner_user_id", input.ownerUserId)
      .eq("shop_id", input.shopId)
      .maybeSingle();
  }
  if (membership.error) {
    if (isMissingCohortSchema(membership.error)) return emptyOwnerPilotCohortProjection(false);
    throw new OwnerPilotCohortError("파일럿 테스트 매장 상태를 확인하지 못했습니다.", 503);
  }
  if (!membership.data) return emptyOwnerPilotCohortProjection(true);

  const [prePaymentBenefit, firstPaid] = await Promise.all([
    getOwnerPilotBenefitStatus({ userId: input.ownerUserId, shopId: input.shopId }).catch((error) => {
      if (error instanceof OwnerPilotBenefitError && error.status === 503) return null;
      throw error;
    }),
    admin
      .from("owner_pilot_first_paid_benefit_grants")
      .select("granted_days,grant_source,applied_at")
      .eq("owner_user_id", input.ownerUserId)
      .eq("shop_id", input.shopId)
      .maybeSingle(),
  ]);
  if (firstPaid.error && !isMissingCohortSchema(firstPaid.error)) {
    throw new OwnerPilotCohortError("파일럿 첫 결제 혜택 상태를 확인하지 못했습니다.", 503);
  }

  const row = membership.data as CohortMembershipRow;
  const paidRow = (firstPaid.data ?? null) as FirstPaidRow | null;
  const isPilotMember = row.status !== "excluded";
  const decisionState = accessSchemaReady ? row.tester_access_decision_state ?? "pending" : null;
  const displayState = accessSchemaReady
    ? resolveTesterAccessDisplayState({
        isTester: isPilotMember,
        decisionState,
        reviewDueAt: row.tester_access_review_due_at ?? null,
      })
    : null;
  return {
    schemaReady: true,
    isPilotMember,
    status: row.status,
    statusLabel: ownerPilotCohortStatusLabel(row.status),
    cohortPosition: row.cohort_position,
    recognitionState: row.recognition_state,
    testerAccess: {
      schemaReady: accessSchemaReady,
      decisionState,
      displayState,
      reviewDueAt: row.tester_access_review_due_at ?? null,
      accessAllowed: accessSchemaReady && isPilotMember && displayState !== "ended" && displayState !== "converted",
    },
    prePaymentBenefit,
    firstPaidBenefit: {
      granted: Boolean(paidRow),
      days: paidRow?.granted_days ?? 0,
      source: paidRow?.grant_source ?? null,
      appliedAt: paidRow?.applied_at ?? null,
    },
  };
}

export async function setOwnerPilotCohortMembership(input: {
  ownerUserId: string;
  shopId: string;
  status: OwnerPilotCohortStatus;
  reason: string;
  adminEmail: string;
  idempotencyKey: string;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerPilotCohortError("관리자 데이터 연결을 확인해 주세요.", 503);
  const result = await admin.rpc("upsert_owner_pilot_cohort_membership_v1", {
    p_owner_user_id: input.ownerUserId,
    p_shop_id: input.shopId,
    p_status: input.status,
    p_reason: input.reason,
    p_admin_email: input.adminEmail,
    p_idempotency_key: input.idempotencyKey,
  });
  if (result.error) throw translateCohortRpcError(result.error);
  return getOwnerPilotCohortProjection(input);
}

export async function recordOwnerPilotFeedback(input: {
  ownerUserId: string;
  shopId: string;
  contentFingerprint: string;
  days: number;
  adminEmail: string;
  idempotencyKey: string;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerPilotCohortError("관리자 데이터 연결을 확인해 주세요.", 503);
  const result = await admin.rpc("record_owner_pilot_feedback_benefit_v1", {
    p_owner_user_id: input.ownerUserId,
    p_shop_id: input.shopId,
    p_content_fingerprint: input.contentFingerprint,
    p_requested_days: input.days,
    p_admin_email: input.adminEmail,
    p_idempotency_key: input.idempotencyKey,
  });
  if (result.error) throw translateCohortRpcError(result.error);
  return {
    result: result.data,
    cohort: await getOwnerPilotCohortProjection(input),
  };
}
