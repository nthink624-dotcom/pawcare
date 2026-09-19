import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyConfirmedDurationToService,
  groupPriceGuideRowsByServiceDuration,
  isConfirmedPriceGuideDuration,
  PRICE_GUIDE_DURATION_QUICK_OPTIONS,
} from "../../src/lib/price-guide-duration-confirmation.ts";
import { isSlotAvailable } from "../../src/lib/availability.ts";
import { buildCustomerServiceSourceOptions } from "../../src/lib/customer-service-options.ts";
import { getOwnerPriceGuideServiceProjection } from "../../src/lib/owner-price-guide-onboarding.ts";

function document() {
  return {
    schemaVersion: 2,
    source: "ai_imported",
    overallNote: null,
    tableGroups: [],
    rows: [
      { sourceItemId: "bath-small", serviceName: "목욕", species: "dog", breedNames: [], breedGroup: "그룹", sizeClass: "small", minKg: 0, maxKg: 5, weightBandLabel: "5kg 이하", priceKind: "fixed", priceMinKrw: 30_000, priceMaxKrw: null, durationMinutes: 60, note: null },
      { sourceItemId: "bath-medium", serviceName: " 목욕 ", species: "dog", breedNames: [], breedGroup: "그룹", sizeClass: "medium", minKg: 5, maxKg: 8, weightBandLabel: "5~8kg", priceKind: "fixed", priceMinKrw: 40_000, priceMaxKrw: null, durationMinutes: null, note: null },
      { sourceItemId: "cut-small", serviceName: "전체 미용", species: "dog", breedNames: [], breedGroup: "그룹", sizeClass: "small", minKg: 0, maxKg: 5, weightBandLabel: "5kg 이하", priceKind: "fixed", priceMinKrw: 50_000, priceMaxKrw: null, durationMinutes: 10, note: null },
    ],
    surcharges: [],
    aiReview: [],
  };
}

test("service duration is confirmed once per unique service and only by an owner action", () => {
  const original = document();
  const groups = groupPriceGuideRowsByServiceDuration(original);
  assert.deepEqual(PRICE_GUIDE_DURATION_QUICK_OPTIONS, [30, 60, 90, 120]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].confirmedDurations, [60]);
  assert.equal(groups[0].unresolvedCount, 1);
  assert.equal(groups[1].unresolvedCount, 1);
  assert.equal(original.rows[1].durationMinutes, null, "grouping must never fill an imported blank");

  const applied = applyConfirmedDurationToService(original, "목욕", 90);
  assert.deepEqual(applied.rows.slice(0, 2).map((row) => row.durationMinutes), [90, 90]);
  assert.equal(applied.rows[2].durationMinutes, 10, "another service remains untouched");
  assert.equal(applyConfirmedDurationToService(original, "목욕", 10), original, "out-of-range time fails closed");
});

test("save, exposure, and scheduling accept only owner-confirmed 15 to 480 minute durations", () => {
  assert.equal(isConfirmedPriceGuideDuration(null), false);
  assert.equal(isConfirmedPriceGuideDuration(14), false);
  assert.equal(isConfirmedPriceGuideDuration(15), true);
  assert.equal(isConfirmedPriceGuideDuration(480), true);
  assert.equal(isConfirmedPriceGuideDuration(481), false);
  const scheduledService = { id: "service-1", duration_minutes: 60 };
  const tenToEleven = {
    id: "appointment-1",
    appointment_date: "2026-09-10",
    appointment_time: "10:00",
    start_at: "2026-09-10T10:00:00+09:00",
    end_at: "2026-09-10T11:00:00+09:00",
    service_id: "service-1",
    status: "confirmed",
  };
  assert.equal(isSlotAvailable({ date: "2026-09-10", startMinute: 10 * 60 + 30, durationMinutes: 60, appointments: [tenToEleven], services: [scheduledService] }), false);
  assert.equal(isSlotAvailable({ date: "2026-09-10", startMinute: 11 * 60, durationMinutes: 60, appointments: [tenToEleven], services: [scheduledService] }), true);

  const unresolved = document();
  const carrier = {
    id: "service-1", shop_id: "shop-1", name: "목욕", price: 30_000, price_type: "fixed",
    duration_minutes: 60, is_active: true, category: "미용", description: "", sort_order: 1,
    capacity_label: "동일 시간 1건", staff_selection_mode: "all", price_guide: unresolved,
    created_at: "2026-09-10T00:00:00.000Z", updated_at: "2026-09-10T00:00:00.000Z",
  };
  assert.deepEqual(buildCustomerServiceSourceOptions([carrier]).map((item) => item.displayName), ["목욕"]);
  assert.equal(getOwnerPriceGuideServiceProjection(unresolved)?.durationMinutes, 60);

  const invalid = structuredClone(unresolved);
  invalid.rows.forEach((row) => { row.durationMinutes = 10; });
  assert.deepEqual(buildCustomerServiceSourceOptions([{ ...carrier, price_guide: invalid }]), []);
  assert.equal(getOwnerPriceGuideServiceProjection(invalid), null);
});

test("the shared editor exposes scoped weight-duration editing without an automatic default", async () => {
  const [table, validator, recommendations] = await Promise.all([
    readFile(new URL("../../src/components/owner-web/price-guide-native-inline-table.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/auth/signup-price-guide-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/service-duration-recommendation-panel.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(table, /groupPriceGuideRowsByServiceDuration\(guide\)/);
  assert.match(table, /PriceGuideServiceDurationControl/);
  assert.match(table, /targets=\{durationTargets\}/);
  assert.match(table, /applyWeightDurationUpdates\(guide, updates\)/);
  assert.doesNotMatch(table, /전체 체급에 적용|PRICE_GUIDE_DURATION_QUICK_OPTIONS/);
  assert.doesNotMatch(table, /durationMinutes:\s*60/);
  assert.match(validator, /isConfirmedPriceGuideDuration\(row\.durationMinutes\)/);
  assert.match(validator, /소요 시간은 15~480분으로 확정해 주세요/);
  assert.match(recommendations, /유효한 완료 기록이 3건 이상 쌓이면 추천이 표시됩니다/);
  assert.doesNotMatch(recommendations, /onApply|자동 적용/);
});
