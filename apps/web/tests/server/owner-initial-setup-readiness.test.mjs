import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const sourcePath = resolve(sourceRoot, specifier.slice(2));
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`]
      .find((path) => existsSync(path));
    if (!candidate) return nextResolve(specifier, context);
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  },
});

const {
  createIncompleteOwnerInitialSetupReadiness,
  deriveOwnerInitialSetupReadiness,
  getBootstrapOwnerInitialSetupReadiness,
  resolveOwnerInitialSetupVisibility,
} = await import("../../src/lib/owner-initial-setup-readiness.ts");

const readyHours = {
  1: { open: "10:00", close: "19:00", enabled: true },
};

const readyStaff = [{
  id: "staff-owner",
  name: "김대표",
  role: "대표",
  defaultDays: [1, 2, 3, 4, 5],
  startTime: "10:00",
  endTime: "19:00",
}];

function readyService(shopId) {
  return {
    id: `service-${shopId}`,
    shop_id: shopId,
    name: "전체 미용",
    price: 55_000,
    price_type: "fixed",
    duration_minutes: 90,
    is_active: true,
    category: "미용",
    description: "",
    sort_order: 1,
    capacity_label: "동일 시간 1건",
    staff_selection_mode: "all",
    price_guide: {
      schemaVersion: 2,
      source: "owner_confirmed",
      overallNote: null,
      rows: [{
        serviceName: "전체 미용",
        species: "dog",
        breedNames: ["말티즈"],
        breedGroup: "베이직",
        sizeClass: "small",
        minKg: null,
        maxKg: 5,
        priceKind: "fixed",
        priceMinKrw: 55_000,
        priceMaxKrw: null,
        durationMinutes: 90,
        note: null,
      }],
      surcharges: [],
      aiReview: [],
    },
    created_at: "2026-09-03T00:00:00.000Z",
    updated_at: "2026-09-03T00:00:00.000Z",
  };
}

function derive(shopId, { hours = readyHours, staff = readyStaff, services = [readyService(shopId)] } = {}) {
  return deriveOwnerInitialSetupReadiness({
    shop: { id: shopId, business_hours: hours },
    services,
    persistedStaffMembers: staff,
  });
}

test("incomplete shops expose one entry and resume the earliest persisted incomplete step", () => {
  const readiness = derive("shop-incomplete", { staff: [] });
  assert.deepEqual(readiness.steps, { hours: true, staff: false, pricing: true });
  assert.equal(readiness.nextStep, "staff");
  assert.deepEqual(resolveOwnerInitialSetupVisibility(readiness, false), {
    showEntry: true,
    open: false,
    nextStep: "staff",
  });
  assert.deepEqual(resolveOwnerInitialSetupVisibility(readiness, true), {
    showEntry: true,
    open: true,
    nextStep: "staff",
  });
});

test("completed shop authority wins over initialSetup=1 and hides every setup entry", () => {
  const readiness = derive("shop-complete");
  assert.equal(readiness.completed, true);
  assert.deepEqual(resolveOwnerInitialSetupVisibility(readiness, true), {
    showEntry: false,
    open: false,
    nextStep: null,
  });
});

test("failed final save keeps the prior incomplete state; successful authoritative requery hides it", () => {
  const beforeSave = derive("shop-final", { services: [] });
  const failedSaveVisibility = resolveOwnerInitialSetupVisibility(beforeSave, true);
  assert.equal(failedSaveVisibility.open, true);
  assert.equal(failedSaveVisibility.nextStep, "pricing");

  const afterSuccessfulRequery = derive("shop-final");
  assert.equal(afterSuccessfulRequery.completed, true);
  assert.equal(resolveOwnerInitialSetupVisibility(afterSuccessfulRequery, true).showEntry, false);
});

test("readiness is scoped to the authorized current shop and mismatches fail closed", () => {
  const completedShop = derive("shop-a");
  const incompleteShop = derive("shop-b", { hours: {}, staff: [], services: [] });
  assert.equal(resolveOwnerInitialSetupVisibility(completedShop, false).showEntry, false);
  assert.equal(resolveOwnerInitialSetupVisibility(incompleteShop, false).showEntry, true);

  const mismatched = getBootstrapOwnerInitialSetupReadiness({
    shop: { id: "shop-b" },
    initialSetupReadiness: completedShop,
  });
  assert.deepEqual(mismatched, createIncompleteOwnerInitialSetupReadiness("shop-b"));
});
