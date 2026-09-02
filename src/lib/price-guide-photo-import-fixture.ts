import { buildPriceGuideV2Compatibility } from "@/lib/auth/signup-service-pricing";
import {
  priceGuideV2Schema,
  type PriceGuidePhotoImportResponse,
} from "@/types/price-guide-photo-import";

export function createPriceGuidePhotoImportFixture(): PriceGuidePhotoImportResponse {
  const document = priceGuideV2Schema.parse({
    schemaVersion: 2,
    source: "fixture",
    overallNote: "모량과 털 상태에 따라 최종 금액이 달라질 수 있습니다.",
    rows: [
      {
        serviceName: "소형견 목욕",
        species: "dog",
        breedNames: ["말티즈", "푸들"],
        breedGroup: "소형견",
        sizeClass: "small",
        minKg: null,
        maxKg: 5,
        priceKind: "fixed",
        priceMinKrw: 35_000,
        priceMaxKrw: null,
        durationMinutes: 60,
        note: "기본 목욕과 발톱 정리 포함",
      },
      {
        serviceName: "소형견 전체 미용",
        species: "dog",
        breedNames: ["말티즈", "푸들"],
        breedGroup: "소형견",
        sizeClass: "small",
        minKg: null,
        maxKg: 5,
        priceKind: "starting",
        priceMinKrw: 70_000,
        priceMaxKrw: null,
        durationMinutes: 120,
        note: "가위컷은 상담 후 추가",
      },
    ],
    surcharges: [
      { condition: "털 엉킴", amountKrw: 10_000, percent: null, note: "상태에 따라 추가" },
    ],
    aiReview: [
      {
        targetId: "rows:1",
        field: "priceMinKrw",
        rawText: "70,000원부터로 보임",
        confidence: "medium",
        userConfirmed: false,
        userCorrected: false,
      },
    ],
  });
  const compatibility = buildPriceGuideV2Compatibility(document);
  return {
    document,
    guide: compatibility.guide,
    summary: "요금 2개 행과 추가요금 1개를 읽었습니다.",
    issues: [{
      path: "원본 전체",
      message: "사진 위·아래의 이름·전화번호·주소 가능 영역을 가린 뒤 분석했습니다. 잘린 요금이나 표 안의 개인정보가 없는지 확인해 주세요.",
      confidence: "medium",
    }, ...compatibility.issues],
    sourceMediaAssetIds: [],
    model: "gpt-5.6-luna",
  };
}
