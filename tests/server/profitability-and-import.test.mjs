import assert from "node:assert/strict";
import test from "node:test";

import { parseDataImportFile } from "../../src/server/data-import-parser.ts";
import { buildProfitabilityPayload } from "../../src/server/profitability-analytics.ts";

test("profitability identifies a delayed low-hourly-revenue breed and weight segment", () => {
  const observations = [
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `maltese-${index}`,
      serviceId: "full",
      serviceName: "전체 미용",
      staffId: "staff-a",
      staffName: "정우진",
      breed: "말티즈",
      weightKg: 6,
      expectedMinutes: 90,
      actualMinutes: 110,
      grossRevenue: 70000,
      discountAmount: index === 0 ? 5000 : 0,
      netRevenue: index === 0 ? 65000 : 70000,
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `poodle-${index}`,
      serviceId: "bath",
      serviceName: "목욕",
      staffId: "staff-b",
      staffName: "김민지",
      breed: "토이푸들",
      weightKg: 4,
      expectedMinutes: 60,
      actualMinutes: 60,
      grossRevenue: 80000,
      discountAmount: 0,
      netRevenue: 80000,
    })),
  ];

  const payload = buildProfitabilityPayload({
    observations,
    range: "90d",
    from: "2026-05-01",
    to: "2026-08-01",
  });

  assert.equal(payload.summary.completedCount, 7);
  assert.equal(payload.summary.discountAmount, 5000);
  assert.equal(payload.staff.length, 2);
  assert.equal(payload.priceRecommendations.length, 1);
  assert.match(payload.priceRecommendations[0].segmentLabel, /말티즈 6kg.*전체 미용/);
  assert.equal(payload.priceRecommendations[0].averageDelayMinutes, 20);
  assert.ok(payload.priceRecommendations[0].recommendedPrice > payload.priceRecommendations[0].currentAveragePrice);
  assert.match(payload.insights[0].description, /시간당 매출/);
});

test("CSV migration parser classifies customer, visit, and price guide rows", async () => {
  const csv = [
    "보호자명,연락처,반려동물이름,품종,몸무게kg,방문일,서비스명,예상시간,실제시간,결제금액,그룹명,무게구간",
    "정유진,010-1234-5678,우유,말티즈,6,2026-07-20,전체 미용,90,110,70000,베이직,6kg 이하",
  ].join("\r\n");

  const parsed = await parseDataImportFile(Buffer.from(csv, "utf8"), "teepee-export.csv");

  assert.equal(parsed.totalRows, 1);
  assert.equal(parsed.customers.length, 1);
  assert.equal(parsed.visits.length, 1);
  assert.equal(parsed.priceGuide.length, 1);
  assert.equal(parsed.customers[0].phone, "010-1234-5678");
  assert.equal(parsed.visits[0].actualMinutes, 110);
  assert.equal(parsed.priceGuide[0].price, 70000);
});
