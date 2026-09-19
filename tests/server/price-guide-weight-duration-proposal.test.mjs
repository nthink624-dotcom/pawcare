import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWeightDurationUpdates,
  isValidWeightDurationRule,
  proposeWeightDuration,
  proposeWeightDurations,
} from "../../src/lib/price-guide-weight-duration-proposal.ts";

const rule = { baseKg: 2, baseMinutes: 30, stepKg: 2, incrementMinutes: 10 };
const target = (rowIndex, minKg, maxKg, durationMinutes = null) => ({ rowIndex, minKg, maxKg, durationMinutes });

test("weight-duration proposals use canonical maxKg boundaries without reading labels", () => {
  assert.deepEqual(proposeWeightDurations([target(0, null, 2), target(1, null, 4), target(2, null, 6), target(3, null, 8)], rule).map((item) => item.previewDurationMinutes), [30, 40, 50, 60]);
  assert.equal(proposeWeightDuration(target(3, 1.2, 2.1), rule).previewDurationMinutes, 40, "decimal maxKg uses ceil");
  const open = proposeWeightDuration(target(4, 8, null), rule);
  assert.equal(open.needsDirectInput, true);
  assert.equal(open.reason, "직접 입력");
  assert.equal(proposeWeightDuration(target(5, null, null), rule).needsDirectInput, true);
  const mismatched = proposeWeightDuration(target(6, 8, 4), rule);
  assert.equal(mismatched.needsDirectInput, true);
  assert.equal(mismatched.reason, "체중 확인");
});

test("invalid rules and out-of-range proposals fail closed instead of clamping", () => {
  assert.equal(isValidWeightDurationRule({ ...rule, stepKg: 0 }), false);
  assert.equal(isValidWeightDurationRule({ ...rule, baseKg: Number.NaN }), false);
  assert.equal(isValidWeightDurationRule({ ...rule, incrementMinutes: -1 }), false);
  assert.equal(proposeWeightDuration(target(0, 0, 2), { ...rule, stepKg: 0 }).needsDirectInput, true);
  assert.equal(proposeWeightDuration(target(0, 0, 100), { ...rule, incrementMinutes: 20 }).needsDirectInput, true);
});

test("apply changes only explicit scoped rows and preserves prices, existing durations, and other groups", () => {
  const document = {
    schemaVersion: 2, source: "manual", overallNote: null, tableGroups: [], surcharges: [], aiReview: [],
    rows: [
      { serviceName: "목욕", species: "dog", breedNames: [], breedGroup: "소형견", sizeClass: "small", minKg: 0, maxKg: 2, weightBandLabel: "2kg", priceKind: "fixed", priceMinKrw: 30000, priceMaxKrw: null, durationMinutes: null, note: null },
      { serviceName: "목욕", species: "dog", breedNames: [], breedGroup: "소형견", sizeClass: "small", minKg: 2, maxKg: 8, weightBandLabel: "8kg", priceKind: "fixed", priceMinKrw: 40000, priceMaxKrw: null, durationMinutes: 75, note: null },
      { serviceName: "목욕", species: "dog", breedNames: [], breedGroup: "중형견", sizeClass: "medium", minKg: 0, maxKg: 8, weightBandLabel: "8kg", priceKind: "fixed", priceMinKrw: 50000, priceMaxKrw: null, durationMinutes: null, note: null },
    ],
  };
  const applied = applyWeightDurationUpdates(document, [{ rowIndex: 0, durationMinutes: 30 }]);
  assert.equal(applied.rows[0].durationMinutes, 30);
  assert.equal(applied.rows[1].durationMinutes, 75, "existing owner value remains until explicitly edited");
  assert.equal(applied.rows[2].durationMinutes, null, "same service in another group remains untouched");
  assert.deepEqual(applied.rows.map((row) => row.priceMinKrw), [30000, 40000, 50000]);
  const overridden = applyWeightDurationUpdates(applied, [{ rowIndex: 1, durationMinutes: 90 }]);
  assert.equal(overridden.rows[1].durationMinutes, 90, "a direct row override is explicit");
  assert.equal(applyWeightDurationUpdates(document, [{ rowIndex: 2, durationMinutes: 481 }]), document);
});
