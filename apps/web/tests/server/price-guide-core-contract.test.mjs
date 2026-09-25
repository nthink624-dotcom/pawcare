import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const sourcePath = resolve(sourceRoot, specifier.slice(2));
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`].find((path) => existsSync(path));
    return candidate ? { url: pathToFileURL(candidate).href, shortCircuit: true } : nextResolve(specifier, context);
  },
});

const {
  getPriceGuideCoreContract,
  priceGuideCoreContractSchema,
  preparePriceGuideForStorage,
  projectCanonicalPriceGuidesForRead,
  readCanonicalPriceGuide,
  servicePriceGuideInputSchema,
} = await import("../../src/lib/price-guide-core.ts");

function document() {
  return {
    schemaVersion: 2,
    source: "ai_imported",
    overallNote: null,
    rows: [{
      serviceName: "목욕",
      species: "dog",
      breedNames: ["말티즈"],
      breedGroup: "소형견",
      sizeClass: "small",
      minKg: 0,
      maxKg: 2,
      weightBandLabel: "2kg",
      priceKind: "fixed",
      priceMinKrw: 20_000,
      priceMaxKrw: null,
      durationMinutes: 80,
      note: null,
    }],
    tableGroups: [],
    surcharges: [],
    aiReview: [{
      targetId: "rows:0",
      field: "priceMinKrw",
      rawText: "20,000",
      confidence: "medium",
      userConfirmed: true,
      userCorrected: false,
    }],
  };
}

function legacy(canonicalV2) {
  return {
    enabled: true,
    weightBands: ["2kg"],
    items: [],
    sections: [],
    extraNote: "기존 설명",
    extraFees: [],
    ...(canonicalV2 ? { canonicalV2 } : {}),
    preservedLegacyField: "보존",
  };
}

test("canonical storage validates, assigns stable ids, redacts OCR text, and validates again", () => {
  const stored = preparePriceGuideForStorage(document());
  assert.equal(stored.rows[0].sourceItemId.startsWith("pgi_"), true);
  assert.equal(stored.aiReview[0].rawText, "");
  assert.deepEqual(readCanonicalPriceGuide(stored), stored);
});

test("nested canonical documents retain legacy fields while sharing the canonical reader", () => {
  const stored = preparePriceGuideForStorage(legacy(document()));
  assert.equal(stored.preservedLegacyField, "보존");
  assert.equal(stored.canonicalV2.aiReview[0].rawText, "");
  assert.equal(readCanonicalPriceGuide(stored).rows[0].serviceName, "목욕");
  const projected = projectCanonicalPriceGuidesForRead([{ id: "service", price_guide: stored }]);
  assert.equal(projected[0].price_guide.schemaVersion, 2);
});

test("explicit legacy remains lossless and malformed arbitrary objects fail closed", () => {
  const stored = preparePriceGuideForStorage(legacy());
  assert.equal(stored.preservedLegacyField, "보존");
  assert.equal(readCanonicalPriceGuide(stored), null);
  assert.equal(servicePriceGuideInputSchema.safeParse({ rows: [] }).success, false);
  assert.throws(() => preparePriceGuideForStorage({ schemaVersion: 2, rows: [] }));
});

test("bootstrap publishes the exact generated-core identity and duplicate readers are gone", async () => {
  const [bootstrap, servicesSchema, customerOptions, breedPricing] = await Promise.all([
    readFile(new URL("../../src/app/api/bootstrap/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/server/schemas.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/lib/customer-service-options.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/lib/customer-breed-pricing-group.ts", import.meta.url), "utf8"),
  ]);
  const contract = getPriceGuideCoreContract();
  assert.equal(contract.version, "2.0.0");
  assert.match(contract.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(priceGuideCoreContractSchema.safeParse({ ...contract, sourceHash: "0".repeat(64) }).success, false);
  assert.match(bootstrap, /priceGuideCore: getPriceGuideCoreContract\(\)/);
  assert.doesNotMatch(servicesSchema, /priceGuide:\s*z\.unknown/);
  assert.match(customerOptions, /readCanonicalPriceGuide\(service\.price_guide\)/);
  assert.match(breedPricing, /readCanonicalPriceGuide\(service\.price_guide\)/);
});
