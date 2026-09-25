import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const sourcePath = resolve(sourceRoot, specifier.slice(2));
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`, resolve(sourcePath, "index.ts"), resolve(sourcePath, "index.tsx")]
      .find((path) => existsSync(path));
    if (!candidate) return nextResolve(specifier, context);
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  },
});

const { buildCustomerServiceMenuOptions, buildCustomerServiceSourceOptions } = await import(
  "../../src/lib/customer-service-options.ts"
);
const { normalizeCustomerPageSettings } = await import("../../src/lib/customer-page-settings.ts");

function canonicalRow(serviceName, breedGroup, price, durationMinutes) {
  return {
    serviceName,
    species: "dog",
    breedNames: [`${breedGroup} 대표 품종`],
    breedGroup,
    sizeClass: "all",
    minKg: null,
    maxKg: null,
    weightBandLabel: "전체 체중",
    priceKind: "fixed",
    priceMinKrw: price,
    priceMaxKrw: null,
    durationMinutes,
    note: null,
  };
}

function canonicalService(rows) {
  return {
    id: "canonical-price-guide-carrier",
    shop_id: "retirement-contract-shop",
    name: rows[0].serviceName,
    description: "",
    price: rows[0].priceMinKrw,
    price_type: "fixed",
    duration_minutes: rows[0].durationMinutes,
    is_active: true,
    category: "미용",
    sort_order: 1,
    capacity_label: "동일 시간 1건",
    staff_selection_mode: "all",
    price_guide: {
      schemaVersion: 2,
      source: "owner_confirmed",
      overallNote: null,
      rows,
      surcharges: [],
      aiReview: [],
    },
    created_at: "2026-09-13T00:00:00.000Z",
    updated_at: "2026-09-13T00:00:00.000Z",
  };
}

async function collectProductSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectProductSourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

test("canonical groups produce one service label in first-seen order and keep a single-group service", () => {
  const rows = [
    canonicalRow("목욕", "소형견", 30_000, 60),
    canonicalRow("목　욕", "중형견", 40_000, 75),
    canonicalRow("스포팅", "특수견", 80_000, 120),
  ];
  const sourceOptions = buildCustomerServiceSourceOptions([canonicalService(rows)]);
  const menuOptions = buildCustomerServiceMenuOptions(sourceOptions);

  assert.deepEqual(menuOptions.map((option) => option.displayName), ["목욕", "스포팅"]);
  assert.deepEqual(menuOptions.map((option) => option.order), [1, 2]);
  assert.equal(menuOptions[0].aliasIds.length, 2);
  assert.equal(menuOptions[1].aliasIds.length, 1);
});

test("legacy manual visibility and order data is dropped by the public settings projection", () => {
  const normalized = normalizeCustomerPageSettings({
    customer_service_overrides: {
      hidden: { visible: false, order: 99 },
    },
  });

  assert.equal(Object.hasOwn(normalized, "customer_service_overrides"), false);
});

test("manual exposure UI, state, save request, and customer override application cannot return", async () => {
  const sourceFiles = await collectProductSourceFiles(sourceRoot);
  const productSource = (await Promise.all(sourceFiles.map((path) => readFile(path, "utf8")))).join("\n");
  const picker = await readFile(new URL("../../src/components/customer/customer-entry-service-picker.tsx", import.meta.url), "utf8");
  const entry = await readFile(new URL("../../src/components/customer/customer-booking-entry-page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(productSource, /customer_service_overrides|customerServiceOverrides/);
  assert.doesNotMatch(productSource, /CustomerServiceExposurePanel|applyConfiguredCustomerServiceOverrides|sanitizeCustomerServiceOverridesForSourceOptions/);
  assert.doesNotMatch(productSource, /고객에게 보여줄 요금표|노출 설정 저장/);
  assert.match(entry, /buildCustomerServiceMenuOptions\(sourceServiceOptions\)/);
  assert.match(picker, /요금표 전체 보기/);
  assert.match(entry, /<CustomerFullPriceGuide document=\{canonicalPriceGuide\}/);
});
