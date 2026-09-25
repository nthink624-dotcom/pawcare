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
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`, resolve(sourcePath, "index.ts"), resolve(sourcePath, "index.tsx")]
      .find((path) => existsSync(path));
    if (!candidate) return nextResolve(specifier, context);
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  },
});

const {
  buildPriceGuideStructuredProjection,
  findPriceGuideStructuredConsistencyIssues,
  normalizeImportedPriceGuideStructure,
  preparePriceGuidePhotoDraftForReview,
  reconcilePriceGuideStructuredDraft,
  resolvePriceGuideOrderedWeightBands,
} = await import("../../src/lib/price-guide-structured-table.ts");
const { resolveCustomerPriceGuideWeightBand } = await import("../../src/lib/customer-service-options.ts");
const { priceGuideV2Schema } = await import("../../src/types/price-guide-photo-import.ts");
const {
  readDirectPriceGuideMatrix,
  updateDirectPriceGuideCell,
} = await import("../../src/lib/price-guide-direct-matrix.ts");
const {
  createPriceGuideResponsesFixture,
  extractPriceGuideFromImages,
  PriceGuidePhotoImportError,
  PRICE_GUIDE_PROVIDER_MAX_OUTPUT_TOKENS,
  PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA,
} = await import("../../src/server/price-guide-photo-import.ts");

const commonServices = ["목욕", "부분", "목욕+부분", "얼굴+부분+목욕", "기본전체미용"];
const specialServices = ["목욕", "부분", "목욕+부분", "얼굴+부분+목욕", "스포팅", "가위컷"];

const smallWeights = [
  { label: "2kg이하", minKg: null, maxKg: 2, prices: [12_000, 12_000, 15_000, 20_000, 25_000] },
  { label: "2kg~5kg", minKg: 2, maxKg: 5, prices: [15_000, 15_000, 20_000, 25_000, 30_000] },
  { label: "5kg~8kg", minKg: 5, maxKg: 8, prices: [20_000, 20_000, 25_000, 30_000, 35_000] },
  { label: "8kg~10kg", minKg: 8, maxKg: 10, prices: [25_000, 25_000, 30_000, 35_000, 40_000] },
];
const mediumWeights = [
  { label: "5kg이하", minKg: null, maxKg: 5, prices: [20_000, 20_000, 25_000, 30_000, 35_000] },
  { label: "5kg~8kg", minKg: 5, maxKg: 8, prices: [25_000, 25_000, 30_000, 35_000, 40_000] },
  { label: "8kg~10kg", minKg: 8, maxKg: 10, prices: [30_000, 30_000, 35_000, 40_000, 45_000] },
  { label: "10kg~12kg", minKg: 10, maxKg: 12, prices: [35_000, 35_000, 40_000, 45_000, 50_000] },
];
const specialWeights = [
  { label: "5kg이하", minKg: null, maxKg: 5, prices: [20_000, 20_000, 25_000, 30_000, 45_000, 60_000] },
  { label: "5kg~8kg", minKg: 5, maxKg: 8, prices: [25_000, 25_000, 30_000, 35_000, 50_000, 65_000] },
  { label: "8kg이상", minKg: 8, maxKg: null, prices: [30_000, 30_000, 35_000, 40_000, 55_000, 70_000] },
];

function rowsFor({ sourceLabel, breedNames, sizeClass, services, weights }) {
  return weights.flatMap((weight) => services.map((serviceName, serviceIndex) => ({
    serviceName,
    species: "dog",
    breedNames,
    breedGroup: sourceLabel,
    sizeClass,
    minKg: weight.minKg,
    maxKg: weight.maxKg,
    weightBandLabel: weight.label,
    priceKind: "unknown",
    priceMinKrw: weight.prices[serviceIndex],
    priceMaxKrw: null,
    durationMinutes: null,
    note: null,
  })));
}

function projectedPriceMatrix(group) {
  return group.weights
    .filter((weight) => group.rows.some((row) => row.weightBandLabel === weight))
    .map((weight) => group.services.map((serviceName) => (
      group.rows.find((row) => row.weightBandLabel === weight && row.serviceName === serviceName)?.priceMinKrw
    )));
}

function referenceRateCardDocument() {
  const smallSource = "소형견 (말티즈, 요크셔, 시츄, 푸들 등..)";
  const mediumSource = "중형견 (슈나, 코카 등..)";
  const specialSource = "특수견 (비숑, 베들링턴 등..)";
  return {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [
      {
        sourceLabel: smallSource,
        species: "dog",
        breedNames: [],
        sizeClass: "small",
        weightBands: smallWeights.map(({ label, minKg, maxKg }) => ({ label, minKg, maxKg, note: null })),
        serviceNames: commonServices,
        note: null,
      },
      {
        sourceLabel: mediumSource,
        species: "dog",
        breedNames: [],
        sizeClass: "medium",
        weightBands: [
          ...mediumWeights.map(({ label, minKg, maxKg }) => ({ label, minKg, maxKg, note: null })),
          { label: "12kg이상", minKg: 12, maxKg: null, note: "초과 1kg당 5,000원 추가" },
        ],
        serviceNames: commonServices,
        note: null,
      },
      {
        sourceLabel: specialSource,
        species: "dog",
        breedNames: [],
        sizeClass: "unknown",
        weightBands: specialWeights.map(({ label, minKg, maxKg }) => ({ label, minKg, maxKg, note: null })),
        serviceNames: specialServices,
        note: null,
      },
    ],
    rows: [
      ...rowsFor({ sourceLabel: smallSource, breedNames: [], sizeClass: "small", services: commonServices, weights: smallWeights }),
      ...rowsFor({ sourceLabel: mediumSource, breedNames: [], sizeClass: "medium", services: commonServices, weights: mediumWeights }),
      ...rowsFor({ sourceLabel: specialSource, breedNames: [], sizeClass: "unknown", services: specialServices, weights: specialWeights }),
    ],
    surcharges: [
      ["가위컷", 25_000], ["썸머", 10_000], ["기장", 5_000], ["엉킴", 5_000],
      ["특수얼굴컷", 5_000], ["투톤염색", 10_000], ["염색", 5_000], ["특수견", 7_000],
    ].map(([condition, amountKrw]) => ({ condition, amountKrw, percent: null, note: null })),
    aiReview: [],
  };
}

test("reference structured rate card preserves groups, breeds, source bands, dynamic services, and surcharges", () => {
  const parsed = priceGuideV2Schema.parse(referenceRateCardDocument());
  const normalized = normalizeImportedPriceGuideStructure(parsed);
  const projection = buildPriceGuideStructuredProjection(normalized);

  assert.equal(normalized.rows.length, 58);
  assert.deepEqual(normalized.tableGroups.map((group) => group.sourceLabel), ["소형견", "중형견", "특수견"]);
  assert.deepEqual(normalized.tableGroups.map((group) => group.breedNames), [
    ["말티즈", "요크셔", "시츄", "푸들"],
    ["슈나", "코카"],
    ["비숑", "베들링턴"],
  ]);
  assert.deepEqual(projection.groups.map((group) => group.label), ["소형견", "중형견", "특수견"]);
  assert.deepEqual(projection.groups[0].breeds, ["말티즈", "요크셔", "시츄", "푸들"]);
  assert.deepEqual(projection.groups[0].weights, smallWeights.map((weight) => weight.label));
  assert.deepEqual(projection.groups[1].weights, ["5kg이하", "5kg~8kg", "8kg~10kg", "10kg~12kg", "12kg이상"]);
  assert.equal(projection.groups[1].weightNotes["12kg이상"], "초과 1kg당 5,000원 추가");
  assert.deepEqual(projection.groups[2].weights, specialWeights.map((weight) => weight.label));
  assert.deepEqual(projection.groups[0].services, commonServices);
  assert.deepEqual(projection.groups[1].services, commonServices);
  assert.deepEqual(projection.groups[2].services, specialServices);
  assert.deepEqual(projection.groups.map((group) => group.rows.length), [20, 20, 18]);
  assert.deepEqual(projectedPriceMatrix(projection.groups[0]), smallWeights.map((weight) => weight.prices));
  assert.deepEqual(projectedPriceMatrix(projection.groups[1]), mediumWeights.map((weight) => weight.prices));
  assert.deepEqual(projectedPriceMatrix(projection.groups[2]), specialWeights.map((weight) => weight.prices));
  assert.deepEqual(projection.unplacedRowIndexes, []);
  assert.equal(normalized.rows.every((row) => row.durationMinutes === null), true);
  assert.equal(normalized.rows.every((row) => row.priceKind === "unknown"), true);
  assert.equal(normalized.rows.every((row) => Number.isInteger(row.priceMinKrw)), true);
  assert.equal(normalized.rows.some((row) => ["말티즈", "요크셔", "시츄", "푸들", "슈나", "코카", "비숑", "베들링턴"].includes(row.serviceName)), false);
  assert.deepEqual(normalized.surcharges.map((fee) => [fee.condition, fee.amountKrw]), [
    ["가위컷", 25_000], ["썸머", 10_000], ["기장", 5_000], ["엉킴", 5_000],
    ["특수얼굴컷", 5_000], ["투톤염색", 10_000], ["염색", 5_000], ["특수견", 7_000],
  ]);
  assert.equal(projection.groups.flatMap((group) => group.weights).includes("4kg 이하"), false);
  assert.equal(projection.groups.flatMap((group) => group.weights).includes("6kg 이하"), false);
  assert.equal(projection.groups.flatMap((group) => group.weights).includes("8kg 이하"), false);
});

test("pricing group labels are source-authored only and never inferred from sizeClass", () => {
  const reference = referenceRateCardDocument();
  const originalSmallLabel = reference.tableGroups[0].sourceLabel;

  for (const sourceLabel of ["소형견", "중형견/이중모", "임의 한국어 이름"]) {
    const document = {
      ...reference,
      tableGroups: [{ ...reference.tableGroups[0], sourceLabel }],
      rows: reference.rows
        .filter((row) => row.breedGroup === originalSmallLabel)
        .map((row) => ({ ...row, breedGroup: sourceLabel })),
      surcharges: [],
    };
    const projection = buildPriceGuideStructuredProjection(document);
    assert.equal(projection.groups.length, 1);
    assert.equal(projection.groups[0].sourceLabel, sourceLabel);
    assert.equal(projection.groups[0].label, sourceLabel);
    assert.deepEqual(projection.unplacedRowIndexes, []);
  }

  const missingSourceLabel = {
    ...reference,
    tableGroups: [],
    rows: [{ ...reference.rows[0], breedGroup: null, sizeClass: "small" }],
    surcharges: [],
  };
  const missingProjection = buildPriceGuideStructuredProjection(missingSourceLabel);
  assert.deepEqual(missingProjection.groups, []);
  assert.deepEqual(missingProjection.unplacedRowIndexes, [0]);
});

test("ordered weight bands bind shared boundaries without changing source labels or guessing prices", () => {
  const labels = ["5kg 이하", "5~8kg", "8kg 이상"];
  const ordered = resolvePriceGuideOrderedWeightBands([
    { label: labels[0], minKg: null, maxKg: 5 },
    { label: labels[1], minKg: 5, maxKg: 8 },
    { label: labels[2], minKg: 8, maxKg: null },
  ]);

  assert.deepEqual(ordered.map((band) => band.label), labels);
  assert.deepEqual(
    ordered.map((band) => [band.minimum, band.maximum, band.minimumInclusive, band.maximumInclusive]),
    [[null, 5, null, true], [5, 8, false, false], [8, null, true, null]],
  );
  assert.equal(ordered.every((band) => !band.contradictsAxis), true);
  assert.equal(resolveCustomerPriceGuideWeightBand(labels, 5), labels[0]);
  assert.equal(resolveCustomerPriceGuideWeightBand(labels, 5.1), labels[1]);
  assert.equal(resolveCustomerPriceGuideWeightBand(labels, 7.9), labels[1]);
  assert.equal(resolveCustomerPriceGuideWeightBand(labels, 8), labels[2]);

  const cumulativeUpperLabels = ["4kg 이하", "6kg 이하", "8kg 이하"];
  assert.equal(resolveCustomerPriceGuideWeightBand(cumulativeUpperLabels, 4), cumulativeUpperLabels[0]);
  assert.equal(resolveCustomerPriceGuideWeightBand(cumulativeUpperLabels, 5.2), cumulativeUpperLabels[1]);
  assert.equal(resolveCustomerPriceGuideWeightBand(cumulativeUpperLabels, 8), cumulativeUpperLabels[2]);

  const equivalentSource = referenceRateCardDocument();
  equivalentSource.rows = equivalentSource.rows.map((row) => (
    row.breedGroup?.startsWith("특수견") && row.weightBandLabel === "5kg~8kg"
      ? { ...row, weightBandLabel: "5-8 kg" }
      : row
  ));
  const reconciled = reconcilePriceGuideStructuredDraft(priceGuideV2Schema.parse(equivalentSource));
  assert.equal(reconciled.document.rows.length, 58);
  assert.equal(
    reconciled.document.rows.filter((row) => row.breedGroup === "특수견" && row.weightBandLabel === "5kg~8kg").length,
    6,
  );
  assert.deepEqual(
    reconciled.document.rows
      .filter((row) => row.breedGroup === "특수견" && row.weightBandLabel === "5kg~8kg")
      .map((row) => row.priceMinKrw),
    specialWeights[1].prices,
    "semantic coordinate binding never copies or changes a neighboring price",
  );
});

test("unanchored or contradictory ordered boundaries fail closed at ambiguous customer weights", () => {
  assert.equal(resolveCustomerPriceGuideWeightBand(["5~8kg"], 5), null);
  assert.equal(resolveCustomerPriceGuideWeightBand(["5~8kg"], 6), "5~8kg");
  assert.equal(resolveCustomerPriceGuideWeightBand(["5~8kg"], 8), null);

  const contradictory = resolvePriceGuideOrderedWeightBands([
    { label: "5kg 이하", minKg: null, maxKg: 5 },
    { label: "5~9kg", minKg: 5, maxKg: 9 },
    { label: "8kg 이상", minKg: 8, maxKg: null },
  ]);
  assert.equal(contradictory.some((band) => band.contradictsAxis), true);
  assert.equal(resolveCustomerPriceGuideWeightBand(["5kg 이하", "5~9kg", "8kg 이상"], 7), null);

  const conflictingOwnership = resolvePriceGuideOrderedWeightBands([
    { label: "5kg 이하", minKg: null, maxKg: 5 },
    { label: "5kg 이상", minKg: 5, maxKg: null },
  ]);
  assert.equal(conflictingOwnership.every((band) => band.contradictsAxis), true);
  assert.equal(resolveCustomerPriceGuideWeightBand(["5kg 이하", "5kg 이상"], 5), null);
});

test("incomplete coordinates stay outside the table and never become 확인 필요 data axes", () => {
  const normalized = normalizeImportedPriceGuideStructure(priceGuideV2Schema.parse(referenceRateCardDocument()));
  const incompleteIndex = normalized.rows.length;
  const projection = buildPriceGuideStructuredProjection({
    ...normalized,
    rows: [...normalized.rows, {
      ...normalized.rows[0],
      serviceName: null,
      weightBandLabel: null,
      minKg: null,
      maxKg: null,
    }],
  });
  assert.deepEqual(projection.unplacedRowIndexes, [incompleteIndex]);
  assert.equal(projection.groups.flatMap((group) => group.services).some((service) => /확인 필요/.test(service)), false);
  assert.equal(projection.groups.flatMap((group) => group.weights).some((weight) => /확인 필요/.test(weight)), false);
});

test("source table axes keep unreadable intersections as blank cells without inventing rows", () => {
  const document = referenceRateCardDocument();
  const removed = document.rows.findIndex((row) => row.breedGroup === document.tableGroups[0].sourceLabel && row.serviceName === "부분" && row.weightBandLabel === "2kg이하");
  document.rows.splice(removed, 1);
  const projection = buildPriceGuideStructuredProjection(normalizeImportedPriceGuideStructure(priceGuideV2Schema.parse(document)));

  assert.deepEqual(projection.groups[0].services, commonServices);
  assert.equal(
    projection.groups[0].rows.some((row) => row.serviceName === "부분" && row.weightBandLabel === "2kg이하"),
    false,
  );
  assert.equal(projection.groups[0].weights.includes("2kg이하"), true);

  const matrix = readDirectPriceGuideMatrix(document);
  const edited = updateDirectPriceGuideCell(document, 0, 0, 0, { priceMinKrw: 13_000 });
  assert.equal(edited.rows.length, document.rows.length, "editing one read cell must not materialize the blank intersection");
  assert.equal(edited.rows[0].priceMinKrw, 13_000);
  assert.equal(
    edited.rows.some((row) => row.serviceName === "부분" && row.weightBandLabel === "2kg이하"),
    false,
  );
  assert.equal(matrix[0].cells[0][1].priceMinKrw, null);
});

test("structured consistency detects malformed provider rows while recovery keeps safe values blank", async () => {
  const valid = normalizeImportedPriceGuideStructure(priceGuideV2Schema.parse(referenceRateCardDocument()));
  assert.deepEqual(findPriceGuideStructuredConsistencyIssues(valid), []);

  const duplicate = { ...valid, rows: [...valid.rows, { ...valid.rows[0] }] };
  assert.equal(findPriceGuideStructuredConsistencyIssues(duplicate).some((issue) => issue.code === "DUPLICATE_CELL"), true);

  const unplaced = { ...valid, rows: valid.rows.map((row, index) => index === 0 ? { ...row, serviceName: "사진에 없는 열" } : row) };
  assert.equal(findPriceGuideStructuredConsistencyIssues(unplaced).some((issue) => issue.code === "UNPLACED_CELL"), true);

  const uncertain = preparePriceGuidePhotoDraftForReview({
    ...valid,
    aiReview: [{ targetId: "rows:0", field: "priceMinKrw", rawText: "", confidence: "low", userConfirmed: false, userCorrected: false }],
  });
  assert.equal(uncertain.rows[0].priceKind, "unknown");
  assert.equal(uncertain.rows[0].priceMinKrw, null);
  assert.equal(uncertain.rows[0].priceMaxKrw, null);
  assert.deepEqual(findPriceGuideStructuredConsistencyIssues(uncertain), []);

  const malformedAxes = {
    ...valid,
    tableGroups: valid.tableGroups.map((group, index) => index === 0 ? { ...group, serviceNames: [...group.serviceNames, group.serviceNames[0]] } : group),
  };
  assert.equal(findPriceGuideStructuredConsistencyIssues(malformedAxes).some((issue) => issue.code === "DUPLICATE_AXIS"), true);

  const recoveredDuplicate = await extractPriceGuideFromImages(["data:image/png;base64,fixture"], {
    responsesClient: async () => createPriceGuideResponsesFixture(duplicate),
  });
  assert.equal(recoveredDuplicate.document.rows.length, 58);
  assert.equal(recoveredDuplicate.issues.some((issue) => /겹치거나 서로 다른 값/.test(issue.message)), false);

  const recoveredAxes = await extractPriceGuideFromImages(["data:image/png;base64,fixture"], {
    responsesClient: async () => createPriceGuideResponsesFixture(malformedAxes),
  });
  assert.deepEqual(
    recoveredAxes.document.tableGroups[0].serviceNames,
    valid.tableGroups[0].serviceNames,
    "an evidence-equivalent duplicate header is one physical service axis",
  );

  const conflictingAxes = {
    ...valid,
    tableGroups: valid.tableGroups.map((group, index) => index === 0 ? {
      ...group,
      weightBands: [
        ...group.weightBands,
        { ...group.weightBands[0], maxKg: (group.weightBands[0].maxKg ?? 0) + 1 },
      ],
    } : group),
  };
  assert.equal(
    findPriceGuideStructuredConsistencyIssues(conflictingAxes).some((issue) => issue.code === "INVALID_AXIS"),
    true,
  );
  await assert.rejects(
    extractPriceGuideFromImages(["data:image/png;base64,fixture"], {
      responsesClient: async () => createPriceGuideResponsesFixture(conflictingAxes),
    }),
    (error) => error instanceof PriceGuidePhotoImportError
      && error.code === "VISION_RESPONSE_SCHEMA_INVALID"
      && error.safeSubtype === "AXIS_INVALID",
  );
});

test("one-photo recovery keeps every unambiguous 20+20+18 cell and canonicalizes harmless axis typography", () => {
  const document = referenceRateCardDocument();
  document.rows[0] = { ...document.rows[0], weightBandLabel: "2 kg 이하" };
  document.rows[2] = { ...document.rows[2], serviceName: "목욕 + 부분" };
  document.rows.push({ ...document.rows[3] });

  const recovered = reconcilePriceGuideStructuredDraft(priceGuideV2Schema.parse(document));
  const projection = buildPriceGuideStructuredProjection(recovered.document);

  assert.equal(recovered.document.rows.length, 58);
  assert.deepEqual(projection.groups.map((group) => group.rows.length), [20, 20, 18]);
  assert.deepEqual(projection.groups.map((group) => group.services), [commonServices, commonServices, specialServices]);
  assert.deepEqual(projectedPriceMatrix(projection.groups[0]), smallWeights.map((weight) => weight.prices));
  assert.deepEqual(projectedPriceMatrix(projection.groups[1]), mediumWeights.map((weight) => weight.prices));
  assert.deepEqual(projectedPriceMatrix(projection.groups[2]), specialWeights.map((weight) => weight.prices));
  assert.equal(recovered.issues.filter((issue) => issue.code === "DUPLICATE_CELL").length, 0);
  assert.deepEqual(findPriceGuideStructuredConsistencyIssues(recovered.document), []);
});

test("r34 recovery binds equivalent weight notation per group and removes duplicated group rules from surcharges", async () => {
  const document = referenceRateCardDocument();
  document.tableGroups[2].weightBands[1] = {
    ...document.tableGroups[2].weightBands[1],
    label: "5~8kg",
  };
  document.rows
    .filter((row) => row.breedGroup === document.tableGroups[2].sourceLabel && row.weightBandLabel === "5kg~8kg")
    .forEach((row) => {
      row.weightBandLabel = "5 kg ~ 8 kg";
    });
  document.surcharges.push({ ...document.surcharges[0], condition: "가위 컷" });
  document.surcharges.push({
    condition: "12 kg 이상 초과 1kg당",
    amountKrw: 5_000,
    percent: null,
    note: null,
  });

  const recovered = reconcilePriceGuideStructuredDraft(priceGuideV2Schema.parse(document));
  const projection = buildPriceGuideStructuredProjection(recovered.document);

  assert.equal(recovered.document.rows.length, 58);
  assert.deepEqual(projection.groups.map((group) => group.rows.length), [20, 20, 18]);
  assert.deepEqual(projection.groups.map((group) => group.services.length), [5, 5, 6]);
  assert.deepEqual(projectedPriceMatrix(projection.groups[0]), smallWeights.map((weight) => weight.prices));
  assert.deepEqual(projectedPriceMatrix(projection.groups[1]), mediumWeights.map((weight) => weight.prices));
  assert.deepEqual(projectedPriceMatrix(projection.groups[2]), specialWeights.map((weight) => weight.prices));
  assert.equal(projection.groups[1].weightNotes["12kg이상"], "초과 1kg당 5,000원 추가");
  assert.equal(recovered.document.surcharges.length, 8);
  assert.deepEqual(recovered.document.surcharges.map((fee) => [fee.condition, fee.amountKrw]), [
    ["가위컷", 25_000], ["썸머", 10_000], ["기장", 5_000], ["엉킴", 5_000],
    ["특수얼굴컷", 5_000], ["투톤염색", 10_000], ["염색", 5_000], ["특수견", 7_000],
  ]);
  assert.equal(recovered.issues.filter((issue) => issue.code === "DUPLICATE_SURCHARGE").length, 1);
  assert.equal(recovered.issues.filter((issue) => issue.code === "UNPLACED_SURCHARGE").length, 1);
  assert.deepEqual(findPriceGuideStructuredConsistencyIssues(recovered.document), []);

  const providerPath = await extractPriceGuideFromImages(["data:image/png;base64,fixture"], {
    responsesClient: async () => createPriceGuideResponsesFixture(priceGuideV2Schema.parse(document)),
  });
  assert.equal(providerPath.document.rows.length, 58);
  assert.equal(providerPath.document.surcharges.length, 8);
  assert.equal(providerPath.issues.some((issue) => /같은 추가요금은 한 번만/.test(issue.message)), true);
  assert.equal(providerPath.issues.some((issue) => /표 행 규칙과 겹치거나/.test(issue.message)), true);
});

test("r34 recovery blanks conflicting coordinates and surcharge pairs without borrowing neighbor values", () => {
  const document = referenceRateCardDocument();
  const mediumTargets = document.rows.filter((row) => (
    row.breedGroup === document.tableGroups[1].sourceLabel
    && row.weightBandLabel === "10kg~12kg"
    && ["목욕+부분", "얼굴+부분+목욕"].includes(row.serviceName)
  ));
  assert.equal(mediumTargets.length, 2);
  document.rows.push(
    { ...mediumTargets[0], priceMinKrw: 77_777 },
    { ...mediumTargets[1], priceMinKrw: 88_888 },
  );
  document.surcharges.push({ ...document.surcharges[0], condition: "가위 컷", amountKrw: 99_999 });
  document.surcharges.push({ condition: "읽기 어려운 항목", amountKrw: null, percent: null, note: null });

  const recovered = reconcilePriceGuideStructuredDraft(priceGuideV2Schema.parse(document));
  const projection = buildPriceGuideStructuredProjection(recovered.document);
  const medium = projection.groups[1];

  assert.equal(recovered.document.rows.length, 56);
  assert.deepEqual(projection.groups.map((group) => group.rows.length), [20, 18, 18]);
  assert.equal(medium.rows.some((row) => row.weightBandLabel === "10kg~12kg" && row.serviceName === "목욕+부분"), false);
  assert.equal(medium.rows.some((row) => row.weightBandLabel === "10kg~12kg" && row.serviceName === "얼굴+부분+목욕"), false);
  assert.equal(medium.rows.find((row) => row.weightBandLabel === "10kg~12kg" && row.serviceName === "목욕")?.priceMinKrw, 35_000);
  assert.equal(medium.rows.find((row) => row.weightBandLabel === "10kg~12kg" && row.serviceName === "기본전체미용")?.priceMinKrw, 50_000);
  assert.equal(recovered.document.surcharges.some((fee) => fee.condition?.replace(/\s/gu, "") === "가위컷"), false);
  assert.equal(recovered.document.surcharges.some((fee) => fee.condition === "읽기 어려운 항목"), false);
  assert.equal(recovered.issues.filter((issue) => issue.code === "DUPLICATE_CELL").length, 4);
  assert.equal(recovered.issues.filter((issue) => issue.code === "CONFLICTING_SURCHARGE").length, 2);
  assert.equal(recovered.issues.filter((issue) => issue.code === "UNPLACED_SURCHARGE").length, 1);
  assert.deepEqual(findPriceGuideStructuredConsistencyIssues(recovered.document), []);
});

test("r34 weight normalization keeps different comparison boundaries separate", () => {
  const document = referenceRateCardDocument();
  document.rows[20] = { ...document.rows[20], weightBandLabel: "5kg미만" };

  const recovered = reconcilePriceGuideStructuredDraft(priceGuideV2Schema.parse(document));

  assert.equal(recovered.document.rows.length, 57);
  assert.equal(recovered.issues.some((issue) => issue.code === "UNPLACED_CELL" && issue.path === "rows:20"), true);

  const duplicateAxis = referenceRateCardDocument();
  duplicateAxis.tableGroups[2].weightBands.push({
    ...duplicateAxis.tableGroups[2].weightBands[1],
    label: "5~8kg",
  });
  assert.equal(
    findPriceGuideStructuredConsistencyIssues(priceGuideV2Schema.parse(duplicateAxis))
      .some((issue) => issue.code === "DUPLICATE_AXIS" && issue.path.endsWith(".weightBands")),
    true,
  );
});

test("r36 rejects parseable weight labels whose numeric bounds contradict before reconciliation", async () => {
  const contradictions = [
    {
      path: "tableGroups:2.weightBands:1",
      mutate(document) {
        document.tableGroups[2].weightBands[1] = {
          ...document.tableGroups[2].weightBands[1],
          label: "5~8kg",
          minKg: 5,
          maxKg: 9,
        };
      },
    },
    {
      path: "rows:0.weightBandLabel",
      mutate(document) {
        document.rows[0] = {
          ...document.rows[0],
          weightBandLabel: "2kg 이하",
          maxKg: 3,
        };
      },
    },
    {
      path: "rows:52.weightBandLabel",
      mutate(document) {
        document.rows[52] = {
          ...document.rows[52],
          weightBandLabel: "8kg 이상",
          minKg: 9,
        };
      },
    },
  ];

  for (const contradiction of contradictions) {
    const document = referenceRateCardDocument();
    contradiction.mutate(document);
    const parsed = priceGuideV2Schema.parse(document);
    const issues = findPriceGuideStructuredConsistencyIssues(parsed);
    assert.equal(
      issues.some((issue) => issue.code === "INVALID_AXIS" && issue.path === contradiction.path),
      true,
    );
    await assert.rejects(
      extractPriceGuideFromImages(["data:image/png;base64,fixture"], {
        responsesClient: async () => createPriceGuideResponsesFixture(parsed),
      }),
      (error) => (
        error instanceof PriceGuidePhotoImportError
        && error.code === "VISION_RESPONSE_SCHEMA_INVALID"
        && error.status === 422
        && /체급 표기와 숫자 경계가 서로 맞지 않습니다/.test(error.message)
      ),
    );
  }

  const providerSource = await readFile(
    new URL("../../src/server/price-guide-photo-import.ts", import.meta.url),
    "utf8",
  );
  const invalidAxisGate = providerSource.indexOf('issue.code === "INVALID_AXIS"');
  const reconciliation = providerSource.indexOf("const recovered = reconcilePriceGuideStructuredDraft");
  assert.equal(invalidAxisGate >= 0 && reconciliation > invalidAxisGate, true);
});

test("conflicting or unresolved photo intersections become blank without discarding readable groups", async () => {
  const conflicting = referenceRateCardDocument();
  conflicting.rows.push({ ...conflicting.rows[0], priceMinKrw: 99_999 });
  const conflictResult = await extractPriceGuideFromImages(["data:image/png;base64,fixture"], {
    responsesClient: async () => createPriceGuideResponsesFixture(conflicting),
  });
  const conflictProjection = buildPriceGuideStructuredProjection(conflictResult.document);
  assert.equal(conflictResult.document.rows.length, 57);
  assert.equal(conflictProjection.groups[0].rows.some((row) => row.serviceName === "목욕" && row.weightBandLabel === "2kg이하"), false);
  assert.equal(conflictResult.issues.some((issue) => /빈칸으로 남겼습니다/.test(issue.message)), true);

  const unresolved = referenceRateCardDocument();
  unresolved.aiReview = [{
    targetId: "rows:0",
    field: "serviceName",
    rawText: "",
    confidence: "low",
    userConfirmed: false,
    userCorrected: false,
  }];
  const unresolvedResult = await extractPriceGuideFromImages(["data:image/png;base64,fixture"], {
    responsesClient: async () => createPriceGuideResponsesFixture(unresolved),
  });
  const unresolvedProjection = buildPriceGuideStructuredProjection(unresolvedResult.document);
  assert.equal(unresolvedResult.document.rows.length, 57);
  assert.equal(unresolvedProjection.groups[0].rows.some((row) => row.serviceName === "목욕" && row.weightBandLabel === "2kg이하"), false);
  assert.deepEqual(findPriceGuideStructuredConsistencyIssues(unresolvedResult.document), []);
});

test("r43 compact provider transport reserves all standalone surcharge pairs before 58 cell coordinates", async () => {
  const fixture = referenceRateCardDocument();
  let providerDocument = null;
  const result = await extractPriceGuideFromImages(["data:image/png;base64,fixture"], {
    responsesClient: async () => {
      const response = createPriceGuideResponsesFixture(fixture);
      providerDocument = JSON.parse(response.output[0].content[0].text);
      return response;
    },
  });

  assert.deepEqual(Object.keys(providerDocument).slice(0, 5), ["schemaVersion", "source", "overallNote", "tableGroups", "surcharges"]);
  assert.equal(Object.keys(providerDocument).indexOf("surcharges") < Object.keys(providerDocument).indexOf("rows"), true);
  assert.equal(providerDocument.rows.length, 58);
  assert.equal(providerDocument.surcharges.length, 8);
  assert.equal(providerDocument.rows.every((row) => (
    Number.isInteger(row.g)
    && Number.isInteger(row.w)
    && Number.isInteger(row.s)
    && !Object.hasOwn(row, "breedGroup")
    && !Object.hasOwn(row, "weightBandLabel")
    && !Object.hasOwn(row, "serviceName")
  )), true);
  assert.deepEqual(Object.keys(providerDocument.rows[0]), ["g", "w", "s", "k", "p", "x", "t", "d", "n"]);
  const verboseRows = providerDocument.rows.map((row) => ({
    groupIndex: row.g,
    weightBandIndex: row.w,
    serviceIndex: row.s,
    priceKind: row.k,
    priceMinKrw: row.p,
    priceMaxKrw: row.x,
    priceCellText: row.t,
    durationMinutes: row.d,
    note: row.n,
  }));
  const compactBytes = Buffer.byteLength(JSON.stringify(providerDocument));
  const verboseBytes = Buffer.byteLength(JSON.stringify({ ...providerDocument, rows: verboseRows }));
  assert.ok(compactBytes < verboseBytes * 0.78, `compact=${compactBytes}, verbose=${verboseBytes}`);
  assert.deepEqual(result.document.surcharges, fixture.surcharges);
  assert.deepEqual(result.document.tableGroups.map((group) => group.serviceNames.length), [5, 5, 6]);
  assert.deepEqual(result.document.tableGroups.map((group) => group.weightBands.length), [4, 5, 3]);
  assert.equal(result.document.rows.length, 58);
});

test("strict provider request asks for source table axes without inventing default columns or price kind", async () => {
  const fixture = referenceRateCardDocument();
  let capturedBody = null;
  const result = await extractPriceGuideFromImages(["data:image/png;base64,fixture"], {
    responsesClient: async ({ body }) => {
      capturedBody = body;
      return createPriceGuideResponsesFixture(fixture);
    },
  });
  const instruction = capturedBody.input[0].content[0].text;

  assert.deepEqual(PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA.properties.rows.items.required, ["g", "w", "s", "k", "p", "x", "t", "d", "n"]);
  assert.equal(PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA.required.includes("tableGroups"), true);
  assert.equal(
    Object.keys(PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA.properties).indexOf("surcharges")
      < Object.keys(PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA.properties).indexOf("rows"),
    true,
  );
  assert.match(instruction, /tableGroups/);
  assert.match(instruction, /사진 정확히 한 장/);
  assert.match(instruction, /서비스 축은 요금 분류마다 독립적/);
  assert.match(instruction, /전역 서비스 목록을 복사하거나 강제하지 마세요/);
  assert.match(instruction, /가격 셀이 없는 명시적 무게 구간/);
  assert.match(instruction, /셀 경계, 병합 범위, 반복 block/);
  assert.match(instruction, /각주·안내문에 있는 발톱, 귀청소 같은 단어/);
  assert.match(instruction, /흔한 미용 서비스명으로 추측하지 말고/);
  assert.match(instruction, /물리적 행·열 방향이 표마다 반대여도/);
  assert.match(instruction, /요금 분류 값은 사진의 해당 header\/cell에서 동적으로 읽은 원문/);
  assert.match(instruction, /슬래시 문자의 유무만으로 텍스트를 합치거나 나누지 마세요/);
  assert.match(instruction, /오른쪽이나 아래쪽에 별도로 놓인 추가 서비스·추가요금/);
  assert.match(instruction, /주 표 아래의 시작가 서비스/);
  assert.match(instruction, /호텔 같은 독립 이름\+금액도 누락하지 마세요/);
  assert.match(instruction, /빈 셀, 일부만 읽힌 금액/);
  assert.match(instruction, /상담 후 결정/);
  assert.match(instruction, /숫자를 만들거나 빈칸으로 버리지 마세요/);
  assert.match(instruction, /tableGroups 다음에 surcharges를 먼저 완결/);
  assert.match(instruction, /짧은 키 g\/w\/s/);
  assert.match(instruction, /숫자 임계값과 포함 관계가 같은 표기만 같은 체급/);
  assert.match(instruction, /이하·미만·이상·초과가 다르면 절대 합치지 마세요/);
  assert.match(instruction, /tableGroups\.weightBands\.label에서 읽은 숫자 경계와 minKg\/maxKg는 정확히 같아야 합니다/);
  assert.match(instruction, /이웃 셀과 독립적으로 읽고/);
  assert.match(instruction, /주변 가격을 복사·보간하거나 가격 규칙을 추론하지 마세요/);
  assert.match(instruction, /각 row의 t에는 해당 교차 셀에서 실제로 보이는 가격 문자열/);
  assert.match(instruction, /원문 숫자와 구조화 숫자가 다르거나 숫자 한 자리가 모호하면/);
  assert.match(instruction, /마지막 대시가 000 생략임을 같은 표의 명시적 천원 단위 또는 반복된 가격 셀 표기가 입증할 때만/);
  assert.match(instruction, /숫자~숫자와 숫자-숫자는 가격 범위/);
  assert.match(instruction, /체급 행에 붙은 kg당 규칙을 전역 추가요금으로 다시 만들지 마세요/);
  assert.match(instruction, /사진에 명확히 따로 적힌 추가요금 이름\+금액 또는 비율 한 쌍은 절대 생략하지 마세요/);
  assert.match(instruction, /분·시간 단위로 명시된 경우에만/);
  assert.match(instruction, /단일 금액만 보인다고 fixed로 추측하지 마세요/);
  assert.match(instruction, /다른 요금표의 기본 체급이나 고정 서비스 열을 추가하지 마세요/);
  assert.equal(capturedBody.input[0].content.filter((item) => item.type === "input_image").length, 1);
  assert.equal(capturedBody.max_output_tokens, PRICE_GUIDE_PROVIDER_MAX_OUTPUT_TOKENS);
  assert.equal(result.document.rows.length, 58);
  assert.deepEqual(result.document.tableGroups.map((group) => group.sourceLabel), ["소형견", "중형견", "특수견"]);
  assert.equal(result.document.rows.every((row) => row.durationMinutes === null && row.priceKind === "unknown"), true);
});

test("connected photo review uses one clean table and the same inline edit path before save and after reopen", async () => {
  const [onboarding, manual, editor, reviewTable, detail, nativeTable, extras, matrixModel, projection] = await Promise.all([
    readFile(new URL("../../src/components/owner-web/price-guide-photo-onboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/price-guide-manual-onboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/auth/signup-price-guide-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/price-guide-structured-review-table.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/price-guide-v2-service-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/price-guide-native-inline-table.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/price-guide-native-inline-extras.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/lib/price-guide-direct-matrix.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/lib/price-guide-structured-table.ts", import.meta.url), "utf8"),
  ]);

  assert.match(onboarding, /function openPhotoReview\([\s\S]*setEditorMode\("photo-review"\)[\s\S]*setMode\("manual"\)/);
  assert.match(onboarding, /openPhotoReview\(nextResult\)/);
  assert.match(onboarding, /function AnalyzedPriceGuideEditor[\s\S]*<PriceGuideNativeInlineTable[\s\S]*photoReviewMode/);
  assert.match(manual, /manualMatrixMode \|\| photoEditing \? \([\s\S]*<PriceGuideNativeInlineTable/);
  assert.match(manual, /<PriceGuideStructuredReviewTable/);
  assert.match(manual, /photoReviewMode=\{!manualMatrixMode\}/);
  assert.match(editor, /<PriceGuideStructuredReviewTable document=\{document\} onEditRow=\{focusStructuredRow\}/);
  assert.match(reviewTable, /data-price-guide-photo-table-sheet="true"/);
  assert.doesNotMatch(reviewTable, /사진에서 읽은 요금표/);
  assert.match(reviewTable, /data-price-guide-group-edit-action=\{groupIndex\}/);
  assert.match(reviewTable, /overflow-hidden rounded-\[12px\] border border-\[#dbe2ea\] bg-white/);
  assert.match(reviewTable, /group\.breeds\.join\(" · "\)/);
  assert.match(reviewTable, /group\.weights\.map/);
  assert.match(reviewTable, /group\.weightNotes\[weight\]/);
  assert.match(reviewTable, /group\.services\.map/);
  assert.match(reviewTable, /요금표 수정/);
  assert.match(reviewTable, /평균 시간 설정이 필요해요/);
  assert.doesNotMatch(reviewTable, /실제 평균 시간을 계산해 추천해 드려요/);
  assert.doesNotMatch(reviewTable, /가격 방식 선택 필요|소요 시간 입력 필요|가격 입력 필요|확인 필요/);
  assert.match(reviewTable, /min-h-11/);
  assert.match(reviewTable, /PRICE_GUIDE_UI_HARD_CONTRACT/);
  assert.match(reviewTable, /data-price-guide-breeds="true"/);
  assert.match(reviewTable, /data-price-guide-group-heading="true"/);
  assert.match(reviewTable, /flex[^"\n]*flex-wrap[^"\n]*items-baseline/);
  assert.match(reviewTable, /text-\[20px\] font-semibold leading-7/);
  assert.match(reviewTable, /text-\[18px\] font-normal leading-\[26px\]/);
  assert.match(reviewTable, /border-l border-\[#cbd5e1\] pl-3/);
    assert.doesNotMatch(reviewTable, /읽힌 가격만 채웠어요/);
  assert.match(reviewTable, />몸무게<\/th>/);
  assert.doesNotMatch(reviewTable, /data-price-guide-service-subheaders="true"/);
  assert.doesNotMatch(reviewTable, />가격<\/span>|>예상시간<\/span>/);
  assert.match(reviewTable, /data-price-left-time-right="true"/);
  assert.match(reviewTable, /grid-cols-\[minmax\(0,1fr\)_88px\]/);
  assert.match(reviewTable, /data-price-side="left"/);
  assert.match(reviewTable, /data-duration-side="right"/);
  assert.match(reviewTable, /row\?\.durationMinutes === null[\s\S]*\? "미정"/);
  assert.doesNotMatch(reviewTable, /text-\[(?:11|12|13|14|15)px\]/);
  assert.doesNotMatch(reviewTable, /flex-col justify-center/);
  assert.match(reviewTable, /px-3 py-3 font-medium[^>]*>몸무게<\/th>/);
  assert.match(reviewTable, /px-3 py-3 font-medium text-\[#172033\]/);
  assert.match(reviewTable, /font-normal[^>]*data-price-side="left">\{price\}<\/span>/);
  assert.match(reviewTable, /font-normal[^>]*data-duration-side="right">\{duration\}<\/span>/);
  assert.doesNotMatch(reviewTable, /font-bold/);
  assert.match(detail, /<PriceGuideStructuredReviewTable/);
  assert.match(detail, /data-price-guide-detail-matrix="true"/);
  assert.match(detail, /photoReviewMode=\{photoTable\}/);
  assert.match(detail, /setEditing\(true\)/);
  assert.match(detail, /setEditingTarget\(\{ kind: "group", groupIndex \}\)/);
  assert.match(nativeTable, /visibleGroupIndex !== undefined && groupIndex !== visibleGroupIndex/);
  assert.match(matrixModel, /buildPriceGuideStructuredProjection\(document\)\.groups/);
  assert.match(nativeTable, /updateDirectPriceGuideGroup/);
  assert.match(nativeTable, /photoReviewMode/);
  assert.match(nativeTable, /data-price-guide-breed-chips="true"/);
  assert.match(nativeTable, /data-price-guide-dynamic-service-ui="true"/);
  assert.doesNotMatch(nativeTable, /대상 동물|체급 분류|가격 방식 선택|메모 추가|simplified=\{photoReviewMode\}/);
  assert.match(nativeTable, /PriceGuideNativeInlineExtras/);
  assert.match(nativeTable, /data-price-left-time-right="true"/);
  assert.match(nativeTable, /data-price-guide-price-duration-cell=\{rowIndex\}/);
  assert.match(nativeTable, /id=\{minPriceId\}[\s\S]*id=\{durationId\}/);
  assert.match(nativeTable, /if \(photoReviewMode\) \{[\s\S]*onChange\(corrected\)/);
  assert.match(nativeTable, /서비스별 예상시간/);
  assert.doesNotMatch(nativeTable, /한 번 선택하면 같은 서비스의 모든 체급에 적용됩니다|완료 기록이 3건 이상 쌓이면 추천으로만 보여 드리며/);
  assert.doesNotMatch(extras, /표 밖에 적힌 항목을 관리합니다/);
  assert.match(nativeTable, /text-\[18px\] font-semibold leading-\[26px\]/);
  assert.match(nativeTable, />몸무게<\/th>/);
  assert.match(nativeTable, /weightBand\.note/);
  assert.doesNotMatch(projection, /sourceLabel === "소형견"|sizeGroupLabels/);
  assert.match(projection, /unplacedRowIndexes\.push\(rowIndex\)/);
  assert.doesNotMatch(`${reviewTable}\n${projection}`, /\["4kg 이하", "6kg 이하", "8kg 이하"\]/);
});

test("additional-fee cards keep the compact three-row editing structure", async () => {
  const extras = await readFile(new URL("../../src/components/owner-web/price-guide-native-inline-extras.tsx", import.meta.url), "utf8");
  const cardStart = extras.indexOf('data-price-guide-surcharge-card="true"');
  const cardEnd = extras.indexOf("</article>", cardStart);
  const card = extras.slice(cardStart, cardEnd);

  assert.ok(cardStart >= 0 && cardEnd > cardStart);
  assert.match(card, /rounded-\[14px\] border border-\[#dbe2ea\] bg-white p-4/);
  assert.match(card, /renderSurchargeField\("condition", "적용 조건", "적용 조건"\)/);
  assert.match(card, /grid grid-cols-2 gap-2/);
  assert.match(card, /renderSurchargeField\("amountKrw", "가격", "금액\(원\)", true\)/);
  assert.match(card, /renderSurchargeField\("percent", "추가 비율", "비율\(%\)", true\)/);
  assert.match(card, /renderSurchargeField\("note", "설명", "설명 추가"\)/);
  assert.match(card, /className=\{iconButtonClass\}/);
  assert.match(extras, /field === "note" \? "line-clamp-2"/);
  assert.doesNotMatch(card, /grid-cols-\[minmax\(180px,1\.3fr\)/);
  assert.doesNotMatch(extras, /overflow-hidden rounded-\[10px\] border border-\[#dbe2ea\] bg-white/);
});
