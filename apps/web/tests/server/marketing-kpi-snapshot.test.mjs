import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketingKpiSnapshot,
  safeConversionRate,
  safePercentChange,
} from "../../src/lib/marketing-kpi-runtime.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z");

test("marketing KPI counts privacy-safe signup cohorts, activation, and paid conversion", () => {
  const snapshot = buildMarketingKpiSnapshot({
    now: NOW,
    days: 7,
    environment: "production",
    signupRows: [
      { shopId: "current-a", createdAt: "2026-08-20T00:00:00.000Z" },
      { shopId: "current-b", createdAt: "2026-08-25T00:00:00.000Z" },
      { shopId: "previous-a", createdAt: "2026-08-13T00:00:00.000Z" },
      { shopId: "deleted-shop", createdAt: "2026-08-21T00:00:00.000Z" },
      { shopId: "current-a", createdAt: "2026-08-21T00:00:00.000Z" },
    ],
    activeShopIds: ["current-a", "current-b", "previous-a"],
    appointmentRows: [
      { shopId: "current-a", status: "confirmed", createdAt: "2026-08-22T00:00:00.000Z" },
      { shopId: "current-a", status: "completed", createdAt: "2026-08-19T00:00:00.000Z" },
      { shopId: "current-b", status: "cancelled", createdAt: "2026-08-25T10:00:00.000Z" },
      { shopId: "previous-a", status: "completed", createdAt: "2026-08-15T00:00:00.000Z" },
      { shopId: "previous-a", status: "completed", createdAt: "2026-08-20T00:00:00.000Z" },
    ],
    paymentRows: [
      { shopId: "current-a", planCode: "monthly", status: "PAID", paidAt: "2026-08-24T00:00:00.000Z" },
      { shopId: "current-b", planCode: null, status: "PAID", paidAt: "2026-08-25T00:00:00.000Z" },
      { shopId: "current-b", planCode: "free", status: "PAID", paidAt: "2026-08-25T01:00:00.000Z" },
      { shopId: "current-b", planCode: "quarterly", status: "FAILED", paidAt: "2026-08-25T02:00:00.000Z" },
      { shopId: "previous-a", planCode: "yearly", status: "paid", paidAt: "2026-08-16T00:00:00.000Z" },
      { shopId: "previous-a", planCode: "monthly", status: "PAID", paidAt: "2026-08-20T00:00:00.000Z" },
    ],
  });

  assert.equal(snapshot.availability, "ready");
  assert.deepEqual(snapshot.current, {
    signupCompleted: 2,
    activatedShops: 1,
    paidConversions: 1,
    signupToActivationRate: 50,
    signupToPaidRate: 50,
  });
  assert.deepEqual(snapshot.previous, {
    signupCompleted: 1,
    activatedShops: 1,
    paidConversions: 1,
    signupToActivationRate: 100,
    signupToPaidRate: 100,
  });
  assert.deepEqual(snapshot.changes, {
    signupCompletedPercent: 100,
    activatedShopsPercent: 0,
    paidConversionsPercent: 0,
  });
  assert.equal(snapshot.acquisition.landingVisitors.value, null);
  assert.equal(snapshot.acquisition.landingVisitors.state, "not_instrumented");
});

test("the previous cohort ignores reservations and payments after its own period closes", () => {
  const snapshot = buildMarketingKpiSnapshot({
    now: NOW,
    days: 7,
    environment: "production",
    signupRows: [{ shopId: "previous-a", createdAt: "2026-08-13T00:00:00.000Z" }],
    activeShopIds: ["previous-a"],
    appointmentRows: [
      { shopId: "previous-a", status: "completed", createdAt: "2026-08-20T00:00:00.000Z" },
    ],
    paymentRows: [
      { shopId: "previous-a", planCode: "monthly", status: "PAID", paidAt: "2026-08-20T00:00:00.000Z" },
    ],
  });

  assert.equal(snapshot.previous.signupCompleted, 1);
  assert.equal(snapshot.previous.activatedShops, 0);
  assert.equal(snapshot.previous.paidConversions, 0);
});

test("missing operational sources stay unavailable instead of becoming zero", () => {
  const snapshot = buildMarketingKpiSnapshot({
    now: NOW,
    days: 7,
    environment: "development",
    signupRows: [{ shopId: "shop-a", createdAt: "2026-08-25T00:00:00.000Z" }],
    activeShopIds: ["shop-a"],
    appointmentRows: null,
    paymentRows: null,
  });

  assert.equal(snapshot.availability, "partial");
  assert.equal(snapshot.current.signupCompleted, 1);
  assert.equal(snapshot.current.activatedShops, null);
  assert.equal(snapshot.current.paidConversions, null);
  assert.equal(snapshot.current.signupToActivationRate, null);
  assert.equal(snapshot.current.signupToPaidRate, null);
});

test("a missing signup source makes every cohort KPI unavailable", () => {
  const snapshot = buildMarketingKpiSnapshot({
    now: NOW,
    days: 7,
    environment: "unknown",
    signupRows: null,
    activeShopIds: null,
    appointmentRows: [],
    paymentRows: [],
  });

  assert.equal(snapshot.availability, "unavailable");
  assert.equal(snapshot.current.signupCompleted, null);
  assert.equal(snapshot.current.activatedShops, null);
  assert.equal(snapshot.current.paidConversions, null);
});

test("zero denominators and zero comparison baselines do not create misleading percentages", () => {
  assert.equal(safeConversionRate(0, 0), null);
  assert.equal(safePercentChange(2, 0), null);
  assert.equal(safeConversionRate(1, 4), 25);
  assert.equal(safePercentChange(3, 2), 50);
});

test("the KPI response contains aggregates only and no raw identifiers or PII fields", () => {
  const snapshot = buildMarketingKpiSnapshot({
    now: NOW,
    environment: "production",
    signupRows: [{ shopId: "sensitive-shop-id", createdAt: "2026-08-25T00:00:00.000Z" }],
    activeShopIds: ["sensitive-shop-id"],
    appointmentRows: [],
    paymentRows: [],
  });
  const serialized = JSON.stringify(snapshot);

  assert.equal(serialized.includes("sensitive-shop-id"), false);
  assert.equal(serialized.includes("email"), false);
  assert.equal(serialized.includes("phone"), false);
  assert.equal(serialized.includes("userId"), false);
  assert.equal(serialized.includes("shopId"), false);
});
