import assert from "node:assert/strict";
import test from "node:test";

import { buildCustomerWeightHistory } from "../../src/lib/customer-weight-history.ts";

function record(petId, date, weightKg) {
  return {
    pet_id: petId,
    groomed_at: date,
    pet_weight_snapshot: weightKg,
  };
}

test("customer weight history exposes only the same pet's latest 12 valid measurements", () => {
  const dates = [
    "2025-01-01", "2025-02-01", "2025-03-01", "2025-04-01", "2025-05-01", "2025-06-01", "2025-07-01",
    "2025-08-01", "2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01",
  ];
  const records = [
    record("other-pet", "2026-08-20T10:00:00+09:00", 9.9),
    record("pet-1", "2024-12-01T10:00:00+09:00", null),
    ...dates.map((date, index) => record("pet-1", `${date}T10:00:00+09:00`, 4 + index / 10)),
  ];

  const history = buildCustomerWeightHistory(records, "pet-1");

  assert.equal(history.length, 12);
  assert.deepEqual(history[0], { measuredAt: "2025-03-01T10:00:00+09:00", weightKg: 4.2 });
  assert.deepEqual(history.at(-1), { measuredAt: "2026-02-01T10:00:00+09:00", weightKg: 5.3 });
  assert.equal(history.some((item) => item.weightKg === 9.9), false);
});

test("customer weight history is ordered from oldest to newest", () => {
  const history = buildCustomerWeightHistory([
    record("pet-1", "2026-03-01T10:00:00+09:00", 4.3),
    record("pet-1", "2026-01-01T10:00:00+09:00", 4.1),
    record("pet-1", "2026-02-01T10:00:00+09:00", 4.2),
  ], "pet-1");

  assert.deepEqual(history.map((item) => item.weightKg), [4.1, 4.2, 4.3]);
});

test("customer weight history shows one current value without inventing past measurements", () => {
  const history = buildCustomerWeightHistory([], "pet-1", 12, {
    measuredAt: "2026-08-21T10:00:00+09:00",
    weightKg: 4.6,
  });

  assert.deepEqual(history, [{ measuredAt: "2026-08-21T10:00:00+09:00", weightKg: 4.6 }]);
});
