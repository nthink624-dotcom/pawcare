import { buildPriceGuideV2Compatibility } from "@/lib/auth/signup-service-pricing";
import { preparePriceGuidePhotoDraftForReview } from "@/lib/price-guide-structured-table";
import {
  priceGuideV2Schema,
  type PriceGuidePhotoImportResponse,
} from "@/types/price-guide-photo-import";

export function createPriceGuidePhotoImportFixture(): PriceGuidePhotoImportResponse {
  const weightCutoffs = [2, 4, 6, 8] as const;
  const services = [
    { name: "목욕", basePrice: 30_000, durationMinutes: 50 },
    { name: "발톱", basePrice: 10_000, durationMinutes: 20 },
  ] as const;
  const document = preparePriceGuidePhotoDraftForReview(priceGuideV2Schema.parse({
    schemaVersion: 2,
    source: "fixture",
    overallNote: "모량과 털 상태에 따라 최종 금액이 달라질 수 있습니다.",
    rows: weightCutoffs.flatMap((maxKg, weightIndex) => services.map((service, serviceIndex) => ({
      serviceName: service.name,
      species: "dog" as const,
      breedNames: ["말티즈", "푸들"],
      breedGroup: "소형견",
      sizeClass: "small" as const,
      minKg: null,
      maxKg,
      weightBandLabel: `${maxKg}kg 미만`,
      priceKind: "fixed" as const,
      priceMinKrw: service.basePrice + weightIndex * 5_000 + serviceIndex * 1_000,
      priceMaxKrw: null,
      durationMinutes: service.durationMinutes + weightIndex * 10,
      note: null,
    }))),
    surcharges: [
      { condition: "털 엉킴", amountKrw: 10_000, percent: null, note: "상태에 따라 추가" },
    ],
    aiReview: [
      {
        targetId: "rows:5",
        field: "priceMinKrw",
        rawText: "25,000원으로 보임",
        confidence: "medium",
        userConfirmed: false,
        userCorrected: false,
      },
    ],
  }));
  const compatibility = buildPriceGuideV2Compatibility(document);
  return {
    document,
    guide: compatibility.guide,
    summary: "요금 8개 셀과 추가요금 1개를 읽었습니다.",
    issues: [{
      path: "원본 전체",
      message: "사진 위·아래의 이름·전화번호·주소 가능 영역을 가린 뒤 분석했습니다. 잘린 요금이나 표 안의 개인정보가 없는지 확인해 주세요.",
      confidence: "medium",
    }, ...compatibility.issues],
    sourceMediaAssetIds: [],
    model: "gpt-5.6-luna",
  };
}
