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

test("direct registration starts with one editable small-dog row", () => {
  const document = matrix.createMobilePriceGuideSkeleton();
  assert.deepEqual(document.tableGroups.map((group) => group.sourceLabel), ["소형견"]);
  assert.deepEqual(document.tableGroups[0].weightBands.map((band) => band.maxKg), [2]);
  assert.deepEqual(document.tableGroups[0].weightBands.map((band) => band.label), ["2kg 이하"]);
  assert.deepEqual(document.tableGroups[0].serviceNames, ["기본 미용"]);
  assert.equal(document.rows.length, 1);
  assert.ok(document.rows.every((row) => row.priceMinKrw === null && row.durationMinutes === null));
  assert.ok(document.rows.every((row) => row.sourceItemId.startsWith("pgi_client_")));
});

test("added weights continue the previous two-kilogram boundary", () => {
  let document = matrix.createMobilePriceGuideSkeleton();
  document = matrix.addMobilePriceGuideWeightBand(document, 0);
  document = matrix.addMobilePriceGuideWeightBand(document, 0);
  assert.deepEqual(document.tableGroups[0].weightBands.map((band) => ({ label: band.label, minKg: band.minKg, maxKg: band.maxKg })), [
    { label: "2kg 이하", minKg: null, maxKg: 2 },
    { label: "2~4kg", minKg: 2, maxKg: 4 },
    { label: "4~6kg", minKg: 4, maxKg: 6 },
  ]);
});

test("all matrix mutations update one document and preserve unknown and null values", () => {
  let document = matrix.createMobilePriceGuideSkeleton();
  const unknownId = document.rows[0].sourceItemId;
  document = matrix.updateMobilePriceGuideGroup(document, 0, { sourceLabel: "소형견", breedNames: ["말티즈", "푸들"] });
  document = matrix.updateMobilePriceGuideWeightBand(document, 0, 0, "2kg 미만");
  document = matrix.updateMobilePriceGuideCell(document, 0, 0, 0, { priceMinKrw: 25_000, durationMinutes: 40 });
  document = matrix.addMobilePriceGuideService(document, 0);
  document = matrix.updateMobilePriceGuideCell(document, 0, 0, 1, { priceKind: "unknown", priceMinKrw: 55_000, durationMinutes: null });
  document = matrix.updateMobilePriceGuideService(document, 0, 1, "전체+얼굴");
  document = matrix.addMobilePriceGuideWeightBand(document, 0);
  document = matrix.addMobilePriceGuideGroup(document);

  assert.equal(document.tableGroups[0].sourceLabel, "소형견");
  assert.deepEqual(document.tableGroups[0].breedNames, ["말티즈", "푸들"]);
  assert.equal(document.rows[0].serviceName, "기본 미용");
  assert.equal(document.rows[0].weightBandLabel, "2kg 미만");
  assert.equal(document.rows[0].minKg, null);
  assert.equal(document.rows[0].maxKg, null);
  assert.equal(document.rows[0].priceMinKrw, 25_000);
  assert.equal(document.rows[0].durationMinutes, 40);
  assert.equal(document.rows[0].sourceItemId, unknownId);
  const group = matrix.readMobilePriceGuideMatrix(document)[0];
  assert.equal(group.cells[0][1].priceKind, "unknown");
  assert.equal(group.cells[0][1].priceMinKrw, 55_000);
  assert.equal(group.cells[0][1].durationMinutes, null);
  assert.equal(group.cells[0][1].serviceName, "전체+얼굴");
});

test("read and write keep imported service columns exactly as declared by the photographed table", () => {
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
  assert.deepEqual(groups[0].serviceNames, ["가위컷"]);
  assert.deepEqual(roundTrip.tableGroups[0].serviceNames, ["가위컷"]);
  assert.equal(groups[0].cells[0][0].priceMinKrw, 65_000);
  assert.equal(matrix.readPreservedMobilePriceGuideRows(roundTrip).length, 0);
});

test("photo 2 style services remain source ordered and can be added, renamed, and removed", () => {
  const document = {
    schemaVersion: 2,
    source: "ai_imported",
    overallNote: null,
    tableGroups: [{ sourceLabel: "소형견", species: "dog", breedNames: ["말티즈"], sizeClass: "small", weightBands: [{ label: "4kg", minKg: null, maxKg: 4, note: null }], serviceNames: ["목욕", "전체", "전체+얼굴", "스포팅", "전체가위"], note: null }],
    rows: [
      { sourceItemId: "bath", serviceName: "목욕", species: "dog", breedNames: ["말티즈"], breedGroup: "소형견", sizeClass: "small", minKg: null, maxKg: 4, weightBandLabel: "4kg", priceKind: "fixed", priceMinKrw: 20_000, priceMaxKrw: null, durationMinutes: 40, note: null },
      { sourceItemId: "face", serviceName: "전체+얼굴", species: "dog", breedNames: ["말티즈"], breedGroup: "소형견", sizeClass: "small", minKg: null, maxKg: 4, weightBandLabel: "4kg", priceKind: "fixed", priceMinKrw: 45_000, priceMaxKrw: null, durationMinutes: 80, note: null },
    ],
    surcharges: [],
    aiReview: [],
  };
  let next = matrix.writeMobilePriceGuideMatrix(document, matrix.readMobilePriceGuideMatrix(document));
  assert.deepEqual(next.tableGroups[0].serviceNames, ["목욕", "전체", "전체+얼굴", "스포팅", "전체가위"]);
  assert.equal(matrix.readMobilePriceGuideMatrix(next)[0].cells[0][2].priceMinKrw, 45_000);
  next = matrix.addMobilePriceGuideService(next, 0);
  next = matrix.updateMobilePriceGuideService(next, 0, 5, "전체+하이바");
  assert.equal(matrix.readMobilePriceGuideMatrix(next)[0].serviceNames[5], "전체+하이바");
  next = matrix.removeMobilePriceGuideService(next, 0, 5);
  assert.deepEqual(matrix.readMobilePriceGuideMatrix(next)[0].serviceNames, ["목욕", "전체", "전체+얼굴", "스포팅", "전체가위"]);
});

test("canonical service rows without a matching group or weight coordinate remain preserved", () => {
  const document = matrix.createMobilePriceGuideSkeleton();
  const orphanRow = {
    ...document.rows[0],
    sourceItemId: "pgi_orphan_canonical",
    breedGroup: "기존 별도 요금",
    weightBandLabel: "99kg",
    minKg: null,
    maxKg: 99,
    priceMinKrw: 91_000,
    durationMinutes: 150,
  };
  const withOrphan = { ...document, rows: [...document.rows, orphanRow] };
  const next = matrix.updateMobilePriceGuideCell(withOrphan, 0, 0, 0, { priceMinKrw: 30_000, durationMinutes: 40 });
  const preserved = matrix.readPreservedMobilePriceGuideRows(next);
  assert.equal(preserved.length, 1);
  assert.equal(preserved[0].sourceItemId, "pgi_orphan_canonical");
  assert.equal(preserved[0].priceMinKrw, 91_000);
});

test("breed assignment is unique across every category and can be reassigned after removal", () => {
  let document = matrix.createMobilePriceGuideSkeleton();
  document = matrix.addMobilePriceGuideGroup(document);
  document = matrix.updateMobilePriceGuideGroup(document, 0, { breedNames: ["말티즈", "푸들"] });
  document = matrix.updateMobilePriceGuideGroup(document, 1, { breedNames: ["말티즈", "비숑"] });
  assert.deepEqual(document.tableGroups[1].breedNames, ["비숑"]);
  document = matrix.updateMobilePriceGuideGroup(document, 0, { breedNames: ["푸들"] });
  document = matrix.updateMobilePriceGuideGroup(document, 1, { breedNames: ["비숑", "말티즈"] });
  assert.deepEqual(document.tableGroups[1].breedNames, ["비숑", "말티즈"]);
});

test("a newly added manual category receives editable default services without null-service rows", () => {
  let document = matrix.addMobilePriceGuideGroup(matrix.createMobilePriceGuideSkeleton());
  assert.equal(document.rows.length, 2);
  assert.equal(document.tableGroups[1].sourceLabel, "중형견");
  assert.deepEqual(document.tableGroups[1].serviceNames, ["기본 미용"]);
  assert.equal(document.rows.filter((row) => row.serviceName === null).length, 0);
  document = matrix.removeMobilePriceGuideGroup(document, 1);
  assert.equal(document.rows.length, 1);
  assert.equal(matrix.readPreservedMobilePriceGuideRows(document).length, 0);
});

test("AI review targets follow mapped and preserved rows when write reorders them", () => {
  const document = matrix.createMobilePriceGuideSkeleton();
  const orphan = { ...document.rows[0], sourceItemId: "pgi_orphan", serviceName: "가위컷" };
  const reordered = {
    ...document,
    rows: [orphan, ...document.rows],
    aiReview: [
      { targetId: "rows:0", field: "serviceName", reason: "확인 필요", status: "unresolved" },
      { targetId: "rows:1", field: "priceMinKrw", reason: "확인 필요", status: "unresolved" },
    ],
  };
  const next = matrix.writeMobilePriceGuideMatrix(reordered, matrix.readMobilePriceGuideMatrix(reordered));
  assert.equal(next.aiReview[0].targetId, "rows:1");
  assert.equal(next.aiReview[1].targetId, "rows:0");
});
