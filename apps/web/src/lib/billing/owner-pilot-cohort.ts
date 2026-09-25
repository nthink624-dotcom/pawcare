import type { OwnerPilotBenefitStatus } from "@/lib/billing/owner-pilot-benefit";

export const OWNER_PILOT_COHORT_LIMIT = 20;
export const OWNER_PILOT_FIRST_PAID_BONUS_DAYS = 30;

export const ownerPilotCohortStatuses = [
  "planned",
  "active",
  "paused",
  "completed",
  "excluded",
] as const;

export type OwnerPilotCohortStatus = (typeof ownerPilotCohortStatuses)[number];
export type OwnerPilotRecognitionState = "not_decided" | "not_evaluated";

export type OwnerPilotFirstPaidBenefit = {
  granted: boolean;
  days: number;
  source: "pilot_cohort" | "legacy_early_partner" | null;
  appliedAt: string | null;
};

export type OwnerPilotCohortProjection = {
  schemaReady: boolean;
  isPilotMember: boolean;
  status: OwnerPilotCohortStatus | null;
  statusLabel: string | null;
  cohortPosition: number | null;
  recognitionState: OwnerPilotRecognitionState | null;
  testerAccess: {
    schemaReady: boolean;
    decisionState: "pending" | "ended" | "converted" | null;
    displayState: "active" | "awaiting_owner_decision" | "ended" | "converted" | null;
    reviewDueAt: string | null;
    accessAllowed: boolean;
  };
  prePaymentBenefit: OwnerPilotBenefitStatus | null;
  firstPaidBenefit: OwnerPilotFirstPaidBenefit;
};

export type OwnerPilotFeedbackOutcome =
  | "granted"
  | "recorded_planned"
  | "recorded_paused"
  | "recorded_completed"
  | "recorded_excluded"
  | "recorded_paid"
  | "recorded_cap_reached"
  | "recorded_initial_benefit_missing";

const statusLabels: Record<OwnerPilotCohortStatus, string> = {
  planned: "가입예정",
  active: "진행중",
  paused: "중지",
  completed: "완료",
  excluded: "제외",
};

export function ownerPilotCohortStatusLabel(status: OwnerPilotCohortStatus) {
  return statusLabels[status];
}

export function emptyOwnerPilotCohortProjection(schemaReady: boolean): OwnerPilotCohortProjection {
  return {
    schemaReady,
    isPilotMember: false,
    status: null,
    statusLabel: null,
    cohortPosition: null,
    recognitionState: null,
    testerAccess: {
      schemaReady: false,
      decisionState: null,
      displayState: null,
      reviewDueAt: null,
      accessAllowed: false,
    },
    prePaymentBenefit: null,
    firstPaidBenefit: {
      granted: false,
      days: 0,
      source: null,
      appliedAt: null,
    },
  };
}

export function resolveOwnerPilotFeedbackDecision(input: {
  status: OwnerPilotCohortStatus;
  paid: boolean;
  initialBenefitEnrolled: boolean;
  totalFreeDays: number;
  requestedDays: number;
}): { outcome: OwnerPilotFeedbackOutcome; grantedDays: number } {
  if (input.status !== "active") {
    return { outcome: `recorded_${input.status}`, grantedDays: 0 };
  }
  if (input.paid) return { outcome: "recorded_paid", grantedDays: 0 };
  if (!input.initialBenefitEnrolled) {
    return { outcome: "recorded_initial_benefit_missing", grantedDays: 0 };
  }
  if (input.totalFreeDays + input.requestedDays > 60) {
    return { outcome: "recorded_cap_reached", grantedDays: 0 };
  }
  return { outcome: "granted", grantedDays: input.requestedDays };
}
