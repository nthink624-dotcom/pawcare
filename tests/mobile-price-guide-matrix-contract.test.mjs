import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const adapterSource = await readFile(new URL("../src/lib/price-photo/mobile-price-photo-adapter.ts", import.meta.url), "utf8");
const matrixSource = await readFile(new URL("../src/lib/price-photo/mobile-price-guide-matrix.ts", import.meta.url), "utf8");

function transpile(sourceText, requireImpl = () => ({})) {
  const output = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  Function("module", "exports", "require", output)(loadedModule, loadedModule.exports, requireImpl);
  return loadedModule.exports;
}

const adapterModule = transpile(adapterSource);
const matrix = transpile(matrixSource, (specifier) => {
  if (specifier === "./mobile-price-photo-adapter") return adapterModule;
  throw new Error(`unexpected import: ${specifier}`);
});

test("direct registration starts with one canonical empty 2/4/6/8 matrix", () => {
  const document = matrix.createMobilePriceGuideSkeleton();
  assert.deepEqual(document.tableGroups.map((group) => group.sourceLabel), ["베이직", "플러스", "프리미엄"]);
  assert.deepEqual(document.tableGroups[0].weightBands.map((band) => band.maxKg), [2, 4, 6, 8]);
  assert.deepEqual(document.tableGroups[0].serviceNames, ["목욕", "전체 미용", "부분 미용", "스포팅"]);
  assert.equal(document.rows.length, 48);
  assert.ok(document.rows.every((row) => row.priceMinKrw === null && row.durationMinutes === null));
  assert.ok(document.rows.every((row) => row.sourceItemId.startsWith("pgi_client_")));
});

test("all matrix mutations update one document and preserve unknown and null values", () => {
  let document = matrix.createMobilePriceGuideSkeleton();
  const unknownId = document.rows[1].sourceItemId;
  document = matrix.updateMobilePriceGuideGroup(document, 0, { sourceLabel: "소형견", breedNames: ["말티즈", "푸들"] });
  document = matrix.updateMobilePriceGuideService(document, 0, 0, "스파 목욕");
  document = matrix.updateMobilePriceGuideWeightBand(document, 0, 0, "2kg 미만");
  document = matrix.updateMobilePriceGuideCell(document, 0, 0, 0, { priceMinKrw: 25_000, durationMinutes: 40 });
  document = matrix.updateMobilePriceGuideCell(document, 0, 0, 1, { priceKind: "unknown", priceMinKrw: 55_000, durationMinutes: null });
  document = matrix.addMobilePriceGuideService(document, 0);
  document = matrix.addMobilePriceGuideWeightBand(document, 0);
  document = matrix.addMobilePriceGuideGroup(document);
  document = matrix.removeMobilePriceGuideService(document, 0, 4);
  document = matrix.removeMobilePriceGuideWeightBand(document, 0, 4);
  document = matrix.removeMobilePriceGuideGroup(document, 3);

  assert.equal(document.tableGroups[0].sourceLabel, "소형견");
  assert.deepEqual(document.tableGroups[0].breedNames, ["말티즈", "푸들"]);
  assert.equal(document.rows[0].serviceName, "스파 목욕");
  assert.equal(document.rows[0].weightBandLabel, "2kg 미만");
  assert.equal(document.rows[0].minKg, null);
  assert.equal(document.rows[0].maxKg, null);
  assert.equal(document.rows[0].priceMinKrw, 25_000);
  assert.equal(document.rows[0].durationMinutes, 40);
  assert.equal(document.rows[1].sourceItemId, unknownId);
  assert.equal(document.rows[1].priceKind, "unknown");
  assert.equal(document.rows[1].priceMinKrw, 55_000);
  assert.equal(document.rows[1].durationMinutes, null);
});

test("read and write preserve imported table groups and source item identity", () => {
  const document = {
    schemaVersion: 2,
    source: "ai_imported",
    overallNote: null,
    tableGroups: [{ sourceLabel: "특수견", species: "dog", breedNames: ["비숑"], sizeClass: "small", weightBands: [{ label: "5kg 이하", minKg: null, maxKg: 5, note: null }], serviceNames: ["가위컷"], note: null }],
    rows: [{ sourceItemId: "pgi_imported", serviceName: "가위컷", species: "dog", breedNames: ["비숑"], breedGroup: "특수견", sizeClass: "small", minKg: null, maxKg: 5, weightBandLabel: "5kg 이하", priceKind: "unknown", priceMinKrw: 65_000, priceMaxKrw: null, durationMinutes: null, note: null }],
    surcharges: [],
    aiReview: [],
  };
  const groups = matrix.readMobilePriceGuideMatrix(document);
  const roundTrip = matrix.writeMobilePriceGuideMatrix(document, groups);
  assert.deepEqual(roundTrip, document);
});
