import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildServiceDurationRecommendations } from "../../src/lib/service-duration-recommendations.ts";
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

test("service duration recommendation uses only corroborated completed work grouped by service and rounded weight", () => {
  const startedAt = "2026-09-01T01:00:00.000Z";
  const completedAt = (minutes) => new Date(Date.parse(startedAt) + minutes * 60_000).toISOString();
  const validMinutes = [60, 90, 120];
  const validAppointments = validMinutes.map((minutes, index) => ({
    id: `valid-${index}`,
    service_id: "service-a",
    status: "completed",
    start_at: startedAt,
    end_at: completedAt(30),
    actual_started_at: startedAt,
    actual_completed_at: completedAt(minutes),
  }));
  const validRecords = validMinutes.map((minutes, index) => ({
    id: `record-valid-${index}`,
    appointment_id: `valid-${index}`,
    service_id: "service-a",
    actual_duration_minutes: minutes,
    pet_weight_snapshot: 5.2,
  }));
  const excludedAppointments = [
    { id: "cancelled", service_id: "service-a", status: "cancelled", actual_started_at: startedAt, actual_completed_at: completedAt(70) },
    { id: "missing-time", service_id: "service-a", status: "completed", actual_started_at: null, actual_completed_at: completedAt(70) },
    { id: "mismatch", service_id: "service-a", status: "completed", actual_started_at: startedAt, actual_completed_at: completedAt(70) },
    { id: "missing-weight", service_id: "service-a", status: "completed", actual_started_at: startedAt, actual_completed_at: completedAt(70) },
    { id: "unknown-service", service_id: "missing", status: "completed", actual_started_at: startedAt, actual_completed_at: completedAt(70) },
    { id: "duplicate", service_id: "service-a", status: "completed", actual_started_at: startedAt, actual_completed_at: completedAt(70) },
  ];
  const excludedRecords = [
    { id: "record-cancelled", appointment_id: "cancelled", service_id: "service-a", actual_duration_minutes: 70, pet_weight_snapshot: 5.2 },
    { id: "record-missing-time", appointment_id: "missing-time", service_id: "service-a", actual_duration_minutes: 70, pet_weight_snapshot: 5.2 },
    { id: "record-mismatch", appointment_id: "mismatch", service_id: "service-a", actual_duration_minutes: 71, pet_weight_snapshot: 5.2 },
    { id: "record-missing-weight", appointment_id: "missing-weight", service_id: "service-a", actual_duration_minutes: 70, pet_weight_snapshot: null },
    { id: "record-unknown-service", appointment_id: "unknown-service", service_id: "missing", actual_duration_minutes: 70, pet_weight_snapshot: 5.2 },
    { id: "record-duplicate-a", appointment_id: "duplicate", service_id: "service-a", actual_duration_minutes: 70, pet_weight_snapshot: 5.2 },
    { id: "record-duplicate-b", appointment_id: "duplicate", service_id: "service-a", actual_duration_minutes: 70, pet_weight_snapshot: 5.2 },
  ];

  const recommendations = buildServiceDurationRecommendations({
    shopId: "shop-a",
    records: [...validRecords, ...excludedRecords],
    appointments: [...validAppointments, ...excludedAppointments],
    services: [{ id: "service-a", name: "전체 미용" }],
  });

  assert.deepEqual(recommendations, [{
    key: "shop-a|service-a|5kg",
    shopId: "shop-a",
    serviceId: "service-a",
    serviceName: "전체 미용",
    roundedWeightKg: 5,
    weightLabel: "5kg",
    sampleCount: 3,
    observedAverageMinutes: 90,
  }]);
});

test("service duration recommendation requires three records in the same service and weight group", () => {
  const appointments = [0, 1].map((index) => ({
    id: `appointment-${index}`,
    service_id: "service-a",
    status: "completed",
    actual_started_at: "2026-09-01T01:00:00.000Z",
    actual_completed_at: "2026-09-01T02:00:00.000Z",
  }));
  const records = appointments.map((appointment, index) => ({
    id: `record-${index}`,
    appointment_id: appointment.id,
    service_id: "service-a",
    actual_duration_minutes: 60,
    pet_weight_snapshot: index === 0 ? 4.2 : 5.2,
  }));

  assert.deepEqual(buildServiceDurationRecommendations({
    shopId: "shop-a",
    records,
    appointments,
    services: [{ id: "service-a", name: "목욕" }],
  }), []);
});

test("service duration UI keeps the configured baseline separate from read-only recommendations", () => {
  const panelSource = readFileSync(
    new URL("../../src/components/owner-web/service-duration-recommendation-panel.tsx", import.meta.url),
    "utf8",
  );
  const screenSource = readFileSync(
    new URL("../../src/components/owner-web/service-management-screen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(panelSource, /초기 평균 시간을 정해 주세요\. 실제 완료 기록이 쌓이면 평균을 자동 계산해 추천해 드려요\./);
  assert.match(panelSource, /range=365d/);
  assert.doesNotMatch(panelSource, /updatePriceGuide|onApply|durationMinutes\s*:/);
  assert.match(screenSource, /<ServiceDurationRecommendationPanel/);
});
