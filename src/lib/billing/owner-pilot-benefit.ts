export const OWNER_PILOT_INITIAL_FREE_DAYS = 30;
export const OWNER_PILOT_MIN_EXTENSION_DAYS = 3;
export const OWNER_PILOT_MAX_FREE_DAYS = 60;

export type OwnerPilotBenefitGrantKind = "initial" | "feedback_issue";

export type OwnerPilotBenefitGrant = {
  grantId: string;
  kind: OwnerPilotBenefitGrantKind;
  days: number;
  reason: string;
  createdAt: string;
};

export type OwnerPilotBenefitStatus = {
  schemaReady: boolean;
  enrolled: boolean;
  paid: boolean;
  freeStartedAt: string | null;
  freeEndsAt: string | null;
  totalFreeDays: number;
  remainingGrantableDays: number;
  grants: OwnerPilotBenefitGrant[];
};

export type OwnerPilotBenefitGrantIntent = {
  userId: string;
  shopId: string;
  kind: OwnerPilotBenefitGrantKind;
  days: number;
  reason: string;
};

export type OwnerPilotBenefitGrantAttempt = {
  fingerprint: string;
  idempotencyKey: string;
};

export function ownerPilotBenefitGrantFingerprint(intent: OwnerPilotBenefitGrantIntent) {
  return JSON.stringify([
    intent.userId,
    intent.shopId,
    intent.kind,
    intent.days,
    intent.reason.trim(),
  ]);
}

export function resolveOwnerPilotBenefitGrantAttempt(
  current: OwnerPilotBenefitGrantAttempt | null,
  intent: OwnerPilotBenefitGrantIntent,
  createIdempotencyKey: () => string,
): OwnerPilotBenefitGrantAttempt {
  const fingerprint = ownerPilotBenefitGrantFingerprint(intent);
  if (current?.fingerprint === fingerprint) return current;
  return { fingerprint, idempotencyKey: createIdempotencyKey() };
}

export function validateOwnerPilotBenefitGrant(input: {
  kind: OwnerPilotBenefitGrantKind;
  requestedDays: number;
  currentTotalFreeDays: number;
  paid: boolean;
}) {
  if (input.paid) return "첫 결제 전인 파일럿 매장에만 적용할 수 있습니다.";
  if (!Number.isInteger(input.requestedDays)) return "지급 일수는 정수로 입력해 주세요.";
  if (input.kind === "initial" && input.requestedDays !== OWNER_PILOT_INITIAL_FREE_DAYS) {
    return "파일럿 기본 무료 이용은 30일로만 적용할 수 있습니다.";
  }
  if (input.kind === "feedback_issue" && input.requestedDays < OWNER_PILOT_MIN_EXTENSION_DAYS) {
    return "피드백·문제 보상은 한 건당 3일 이상이어야 합니다.";
  }
  const nextTotal = input.kind === "initial"
    ? OWNER_PILOT_INITIAL_FREE_DAYS
    : input.currentTotalFreeDays + input.requestedDays;
  if (nextTotal > OWNER_PILOT_MAX_FREE_DAYS) {
    return "파일럿 무료 이용은 최초 시작일부터 총 60일을 넘길 수 없습니다.";
  }
  return null;
}
