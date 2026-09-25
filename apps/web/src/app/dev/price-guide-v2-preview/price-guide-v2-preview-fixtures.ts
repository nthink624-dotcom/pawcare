import {
  buildCustomerServiceMenuOptions,
  buildCustomerServiceSourceOptions,
} from "@/lib/customer-service-options";
import { buildDemoBootstrap } from "@/lib/mock-data";
import { type PriceGuideV2 } from "@/types/price-guide-photo-import";
import type { BootstrapPayload } from "@/types/domain";

export type PriceGuideV2PreviewScenarioId =
  | "ai-imported"
  | "owner-confirmed"
  | "owner-corrected";

type PreviewReviewState = "pending" | "confirmed" | "corrected";

const rows: PriceGuideV2["rows"] = [
  {
    serviceName: "소형견 목욕",
    species: "dog",
    breedNames: ["말티즈", "포메라니안"],
    breedGroup: "소형 장모종",
    sizeClass: "small",
    minKg: 0,
    maxKg: 5,
    priceKind: "fixed",
    priceMinKrw: 35_000,
    priceMaxKrw: null,
    durationMinutes: 45,
    note: "발톱 정리와 귀 청소가 포함된 기본 목욕입니다.",
  },
  {
    serviceName: "중형견 전체 미용",
    species: "dog",
    breedNames: ["코커스패니얼", "비글"],
    breedGroup: "중형견",
    sizeClass: "medium",
    minKg: 5,
    maxKg: 12,
    priceKind: "starting",
    priceMinKrw: 65_000,
    priceMaxKrw: null,
    durationMinutes: 90,
    note: "기본 클리핑 기준이며 털 상태에 따라 시간이 달라질 수 있습니다.",
  },
  {
    serviceName: "대형견 목욕·드라이",
    species: "dog",
    breedNames: ["골든리트리버", "사모예드"],
    breedGroup: "대형 이중모",
    sizeClass: "large",
    minKg: 12,
    maxKg: 28,
    priceKind: "range",
    priceMinKrw: 80_000,
    priceMaxKrw: 120_000,
    durationMinutes: 150,
    note: "모량과 엉킴 정도에 따라 범위 안에서 최종 금액을 안내합니다.",
  },
  {
    serviceName: "초대형견 전체 미용",
    species: "dog",
    breedNames: ["뉴펀들랜드", "세인트버나드"],
    breedGroup: "초대형 장모종",
    sizeClass: "extra-large",
    minKg: 28,
    maxKg: null,
    priceKind: "starting",
    priceMinKrw: 130_000,
    priceMaxKrw: null,
    durationMinutes: 180,
    note: "방문 전 전화 상담 후 예약 시간을 확정합니다.",
  },
];

const surcharges: PriceGuideV2["surcharges"] = [
  {
    condition: "털 엉킴 또는 심한 오염",
    amountKrw: 10_000,
    percent: null,
    note: "현장에서 상태를 확인한 뒤 먼저 안내합니다.",
  },
  {
    condition: "주말·공휴일",
    amountKrw: null,
    percent: 15,
    note: "기본 미용 금액을 기준으로 계산합니다.",
  },
];

function buildReviews(state: PreviewReviewState): PriceGuideV2["aiReview"] {
  return [
    {
      targetId: "rows:1",
      field: "breedNames",
      rawText: "코커 스파니엘, 비글",
      confidence: "medium",
      userConfirmed: state !== "pending",
      userCorrected: false,
    },
    {
      targetId: "rows:2",
      field: "priceMaxKrw",
      rawText: "80,000~120,000",
      confidence: "low",
      userConfirmed: state === "confirmed",
      userCorrected: state === "corrected",
    },
  ];
}

function buildDocument(
  source: PriceGuideV2["source"],
  reviewState: PreviewReviewState,
): PriceGuideV2 {
  return {
    schemaVersion: 2,
    source,
    overallNote:
      "표시 금액은 기본 요금입니다. 반려동물의 털 상태와 행동 특성을 확인한 뒤 작업 전에 최종 금액을 안내합니다.",
    rows,
    surcharges,
    aiReview: buildReviews(reviewState),
  };
}

export const priceGuideV2PreviewScenarios: Array<{
  id: PriceGuideV2PreviewScenarioId;
  label: string;
  description: string;
  document: PriceGuideV2;
}> = [
  {
    id: "ai-imported",
    label: "AI 분석 직후",
    description: "AI가 읽었지만 오너 확인이 아직 필요한 상태",
    document: buildDocument("ai_imported", "pending"),
  },
  {
    id: "owner-confirmed",
    label: "확인 완료",
    description: "오너가 AI 분석 내용을 그대로 확인한 상태",
    document: buildDocument("owner_confirmed", "confirmed"),
  },
  {
    id: "owner-corrected",
    label: "수정 완료",
    description: "오너가 일부 내용을 고쳐서 저장한 상태",
    document: buildDocument("owner_corrected", "corrected"),
  },
];

export type PriceGuideRegistrationPreviewPath = "photo-e2e" | "direct-e2e";

export type PriceGuideRegistrationPreviewFixture = {
  data: BootstrapPayload;
  sourceOptionIds: string[];
  customerOptionIds: string[];
  customerLinkedSourceOptionIds: string[];
};

export function inspectPriceGuideRegistrationPreview(
  data: BootstrapPayload,
): Pick<PriceGuideRegistrationPreviewFixture, "sourceOptionIds" | "customerOptionIds" | "customerLinkedSourceOptionIds"> {
  const sourceOptions = buildCustomerServiceSourceOptions(data.services);
  const customerOptions = buildCustomerServiceMenuOptions(sourceOptions);
  return {
    sourceOptionIds: sourceOptions.map((option) => option.id),
    customerOptionIds: customerOptions.map((option) => option.id),
    customerLinkedSourceOptionIds: customerOptions.map((option) => option.linkedOptionId ?? option.id),
  };
}

export function buildPriceGuideRegistrationPreviewFixture(
  path: PriceGuideRegistrationPreviewPath,
): PriceGuideRegistrationPreviewFixture {
  const base = buildDemoBootstrap();
  const shopId = `price-guide-${path}`;
  const shop = {
    ...base.shop,
    id: shopId,
  };
  const data: BootstrapPayload = {
    ...base,
    shop,
    initialSetupReadiness: undefined,
    ownerProfile: base.ownerProfile ? { ...base.ownerProfile, shop_id: shopId } : null,
    guardians: [],
    deletedGuardians: [],
    pets: [],
    services: [],
    staffMembers: [],
    appointments: [],
    groomingRecords: [],
    notifications: [],
    landingInterests: [],
    landingFeedback: [],
  };

  return { data, ...inspectPriceGuideRegistrationPreview(data) };
}
