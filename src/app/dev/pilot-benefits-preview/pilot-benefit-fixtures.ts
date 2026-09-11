import type { AdminPilotBenefitFixture } from "@/components/admin/admin-pilot-benefit-screen";
import type { AdminOwnerItem } from "@/components/admin/owner-admin-model";
import type { OwnerPilotBenefitStatus } from "@/lib/billing/owner-pilot-benefit";

export const PILOT_BENEFIT_PREVIEW_STATES = [
  "initial",
  "extended",
  "cap",
  "paid",
  "schema-missing",
  "loading",
  "error",
] as const;

export type PilotBenefitPreviewState = (typeof PILOT_BENEFIT_PREVIEW_STATES)[number];

export const PILOT_BENEFIT_PREVIEW_LABELS: Record<PilotBenefitPreviewState, string> = {
  initial: "기본 적용 전",
  extended: "보상 연장",
  cap: "60일 상한",
  paid: "첫 결제 완료",
  "schema-missing": "DB 미적용",
  loading: "불러오는 중",
  error: "조회 오류",
};

const previewOwner: AdminOwnerItem = {
  userId: "00000000-0000-4000-8000-000000000701",
  ownerName: "예시 오너",
  loginId: null,
  ownerPhoneNumber: null,
  ownerEmail: null,
  loginMethods: ["email"],
  shopId: "pilot-benefit-preview-shop",
  shopName: "파일럿 예시 매장",
  shopAddress: "검수용 예시 데이터",
  joinedAt: "2026-09-01T00:00:00.000Z",
  serviceStartedAt: "2026-09-01T00:00:00.000Z",
  status: "trialing",
  currentPlanCode: "free",
  currentPlanName: "체험 플랜",
  trialEndsAt: "2026-10-01T00:00:00.000Z",
  currentPeriodEndsAt: null,
  lastPaymentStatus: "none",
  paymentMethodExists: false,
  paymentMethodLabel: null,
  suspended: false,
  suspensionReason: null,
  usageWarnings: [],
  recentEvents: [],
  recentPayments: [],
};

function status(overrides: Partial<OwnerPilotBenefitStatus> = {}): OwnerPilotBenefitStatus {
  return {
    schemaReady: true,
    enrolled: false,
    paid: false,
    freeStartedAt: null,
    freeEndsAt: null,
    totalFreeDays: 0,
    remainingGrantableDays: 60,
    grants: [],
    ...overrides,
  };
}

const initialGrant = {
  grantId: "00000000-0000-4000-8000-000000000711",
  kind: "initial" as const,
  days: 30,
  reason: "파일럿 참여 확인",
  createdAt: "2026-09-01T00:00:00.000Z",
};

const extensionGrant = {
  grantId: "00000000-0000-4000-8000-000000000712",
  kind: "feedback_issue" as const,
  days: 12,
  reason: "확인된 피드백 보상",
  createdAt: "2026-09-04T00:00:00.000Z",
};

export function buildPilotBenefitPreviewFixture(stateKey: PilotBenefitPreviewState): AdminPilotBenefitFixture {
  const base = { owners: [previewOwner] };
  if (stateKey === "extended") {
    return {
      ...base,
      benefit: status({
        enrolled: true,
        freeStartedAt: "2026-09-01T00:00:00.000Z",
        freeEndsAt: "2026-10-13T00:00:00.000Z",
        totalFreeDays: 42,
        remainingGrantableDays: 18,
        grants: [extensionGrant, initialGrant],
      }),
    };
  }
  if (stateKey === "cap") {
    return {
      ...base,
      benefit: status({
        enrolled: true,
        freeStartedAt: "2026-09-01T00:00:00.000Z",
        freeEndsAt: "2026-10-31T00:00:00.000Z",
        totalFreeDays: 60,
        remainingGrantableDays: 0,
        grants: [{ ...extensionGrant, days: 30 }, initialGrant],
      }),
    };
  }
  if (stateKey === "paid") {
    return {
      ...base,
      benefit: status({
        enrolled: true,
        paid: true,
        freeStartedAt: "2026-09-01T00:00:00.000Z",
        freeEndsAt: "2026-10-13T00:00:00.000Z",
        totalFreeDays: 42,
        remainingGrantableDays: 18,
        grants: [extensionGrant, initialGrant],
      }),
    };
  }
  if (stateKey === "schema-missing") {
    return { ...base, benefit: status({ schemaReady: false }) };
  }
  if (stateKey === "loading") {
    return { ...base, benefit: status(), viewState: "loading" };
  }
  if (stateKey === "error") {
    return {
      ...base,
      benefit: status(),
      viewState: "error",
      errorMessage: "파일럿 혜택 상태를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.",
    };
  }
  return { ...base, benefit: status() };
}
