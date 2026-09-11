import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { registerHooks } from "node:module";
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
  calculatePriceGuideProviderCostMicroUsd,
  createPriceGuideResponsesFixture,
  extractPriceGuideFromImages,
  normalizePriceGuidePhotoExtraction,
  parsePriceGuideResponsesPayload,
  PriceGuidePhotoImportError,
  PRICE_GUIDE_PROVIDER_INVALID_RESPONSE_CODE,
  PRICE_GUIDE_PROVIDER_INVALID_RESPONSE_MESSAGE,
  PRICE_GUIDE_PROVIDER_VALIDATION_SAFE_SUBTYPES,
  PRICE_GUIDE_PROVIDER_MAX_OUTPUT_TOKENS,
  PRICE_GUIDE_PROVIDER_REASONING_EFFORT,
  PRICE_GUIDE_PROVIDER_TEXT_VERBOSITY,
  PRICE_GUIDE_PROVIDER_TIMEOUT_MS,
  PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA,
  PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD,
  PRICE_GUIDE_VISION_MODEL,
  redactPriceGuideRawTextForStorage,
  toSafePriceGuideProviderValidationResponse,
} = await import("../../src/server/price-guide-photo-import.ts");
const {
  buildPriceGuideV2Compatibility,
  buildPriceGuideV2FromLegacySignupServices,
  buildSignupServicePriceGuide,
  normalizeSignupServicePrices,
  readPriceGuideV2,
  validatePriceGuideV2StorageCompatibility,
} = await import("../../src/lib/auth/signup-service-pricing.ts");
const {
  findPriceGuideV2ClassificationIssues,
  priceGuideV2Schema,
  resolvePriceGuideV2Reviews,
} = await import("../../src/types/price-guide-photo-import.ts");
const {
  consumePreferredPriceGuideOnboardingMode,
  setPreferredPriceGuideOnboardingMode,
} = await import("../../src/lib/price-guide-onboarding.ts");
const { getOwnerPriceGuideServiceProjection } = await import("../../src/lib/owner-price-guide-onboarding.ts");
const {
  preparePriceGuideProviderImages,
  toPriceGuideProviderDataUrl,
} = await import("../../src/server/price-guide-image-privacy.ts");
const sharp = (await import("sharp")).default;

function v2Document() {
  return {
    schemaVersion: 2,
    source: "fixture",
    overallNote: "전체 메모를 빠뜨리지 않습니다.",
    rows: [
      { serviceName: "소형 목욕", species: "dog", breedNames: ["말티즈", "푸들"], breedGroup: "소형견", sizeClass: "small", minKg: null, maxKg: 5, priceKind: "fixed", priceMinKrw: 30_000, priceMaxKrw: null, durationMinutes: 45, note: "행 메모" },
      { serviceName: "중형 미용", species: "dog", breedNames: ["코커스패니얼"], breedGroup: "중형견", sizeClass: "medium", minKg: 5, maxKg: 12, priceKind: "starting", priceMinKrw: 55_000, priceMaxKrw: null, durationMinutes: 90, note: null },
      { serviceName: "대형 미용", species: "dog", breedNames: ["골든리트리버"], breedGroup: "대형견", sizeClass: "large", minKg: 12, maxKg: 25, priceKind: "range", priceMinKrw: 80_000, priceMaxKrw: 120_000, durationMinutes: 150, note: "모량에 따라 범위 적용" },
      { serviceName: "초대형 목욕", species: "dog", breedNames: [], breedGroup: "초대형견", sizeClass: "extra-large", minKg: 25, maxKg: null, priceKind: "unknown", priceMinKrw: null, priceMaxKrw: null, durationMinutes: null, note: null },
      { serviceName: "공통 발톱", species: "all", breedNames: [], breedGroup: null, sizeClass: "all", minKg: null, maxKg: null, priceKind: "fixed", priceMinKrw: 10_000, priceMaxKrw: null, durationMinutes: 10, note: null },
      { serviceName: null, species: "unknown", breedNames: [], breedGroup: null, sizeClass: "unknown", minKg: null, maxKg: null, priceKind: "unknown", priceMinKrw: null, priceMaxKrw: null, durationMinutes: null, note: "이름 판독 불가" },
    ],
    surcharges: [
      { condition: "털 엉킴", amountKrw: 5_000, percent: null, note: "시작 금액" },
      { condition: "주말", amountKrw: null, percent: 10, note: null },
    ],
    aiReview: [
      { targetId: "rows:3", field: "priceMinKrw", rawText: "금액 흐림", confidence: "low", userConfirmed: false, userCorrected: false },
      { targetId: "rows:5", field: "serviceName", rawText: "글자 일부", confidence: "medium", userConfirmed: false, userCorrected: false },
    ],
  };
}

test("one confirmed source is metadata-stripped into one full-table provider image", async () => {
  const source = await sharp({
    create: { width: 546, height: 814, channels: 3, background: "#ef7c9b" },
  }).jpeg({ quality: 92 }).withMetadata({ orientation: 1 }).toBuffer();
  const prepared = await preparePriceGuideProviderImages([source]);
  try {
    assert.equal(prepared.length, 1);
    assert.equal(prepared[0].kind, "privacy_normalized_full");
    assert.equal(prepared[0].cropIndex, null);
    assert.deepEqual([prepared[0].width, prepared[0].height], [1_092, 1_628]);
    const metadata = await sharp(prepared[0].buffer).metadata();
    assert.deepEqual([metadata.width, metadata.height], [1_092, 1_628]);
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.exif, undefined);
    assert.match(toPriceGuideProviderDataUrl(prepared[0]), /^data:image\/webp;base64,/);
  } finally {
    prepared.forEach((image) => image.buffer.fill(0));
    source.fill(0);
  }

  await assert.rejects(
    preparePriceGuideProviderImages([Buffer.from("first"), Buffer.from("second")]),
    /요금표 사진은 한 장만 선택해 주세요/,
  );
});

test("service storage removes adversarial PII and long OCR text from every aiReview.rawText", () => {
  const document = v2Document();
  document.aiReview = [
    { targetId: "rows:0", field: "priceMinKrw", rawText: "010-1234-5678 owner@example.com 서울시 강남구 테헤란로 123", confidence: "low", userConfirmed: false, userCorrected: false },
    { targetId: "rows:1", field: "priceMinKrw", rawText: "110-123-456789 900101-1234567 " + "OCR 원문 ".repeat(80), confidence: "medium", userConfirmed: false, userCorrected: false },
  ];
  const original = structuredClone(document);

  const sanitized = redactPriceGuideRawTextForStorage(document);
  const serialized = JSON.stringify(sanitized);

  assert.deepEqual(sanitized.aiReview.map((review) => review.rawText), ["", ""]);
  assert.equal(serialized.includes("010-1234-5678"), false);
  assert.equal(serialized.includes("owner@example.com"), false);
  assert.equal(serialized.includes("테헤란로"), false);
  assert.equal(serialized.includes("110-123-456789"), false);
  assert.equal(serialized.includes("900101-1234567"), false);
  assert.deepEqual(sanitized.rows, document.rows, "structured service, price, and duration fields stay intact");
  assert.deepEqual(document, original, "the server sanitizer does not mutate the reviewed request");
  assert.deepEqual(redactPriceGuideRawTextForStorage(document), sanitized, "redaction is deterministic");
});

test("photo price guide normalization preserves visible values and flags uncertain cells", () => {
  const result = normalizePriceGuidePhotoExtraction({
    summary: "강아지 요금표를 읽었습니다.",
    sections: [{
      species: "dog",
      title: "강아지 베이직",
      breeds: ["말티즈", "푸들"],
      weightBands: ["5kg 미만", "5~10kg"],
      items: [{
        label: "클리핑",
        cells: [
          { weightBand: "5kg 미만", price: "40,000원", durationMinutes: "60분", confidence: "high", issue: "" },
          { weightBand: "5~10kg", price: "", durationMinutes: "", confidence: "low", issue: "사진이 흐립니다." },
        ],
      }],
    }],
    extraFees: [{ label: "털엉킴", price: "5,000원부터", confidence: "medium", issue: "시작가 기호 확인" }],
    extraNote: "현장 상담 후 달라질 수 있습니다.",
    warnings: [],
  });

  const section = result.guide.sections[0];
  assert.equal(section.species, "dog");
  assert.equal(section.note, "말티즈, 푸들");
  assert.deepEqual(section.items[0].cells["5kg 미만"], { price: "40000", durationMinutes: "60" });
  assert.deepEqual(section.items[0].cells["5~10kg"], { price: "", durationMinutes: "" });
  assert.equal(result.guide.extraFees[0].price, "5000~");
  assert.equal(result.issues.length, 2);
  assert.equal(result.issues[0].path, "강아지 베이직 / 클리핑 / 5~10kg");
  assert.equal(result.issues[1].path, "추가요금 / 털엉킴");
});

test("photo price guide normalization does not invent rows when no weight band is visible", () => {
  const result = normalizePriceGuidePhotoExtraction({
    summary: "읽을 수 있는 표가 없습니다.",
    sections: [{
      species: "cat",
      title: "고양이 요금",
      breeds: [],
      weightBands: [],
      items: [{ label: "목욕", cells: [] }],
    }],
    extraFees: [],
    extraNote: "",
    warnings: ["표의 열 제목을 확인할 수 없습니다."],
  });

  assert.deepEqual(result.guide.sections, []);
  assert.equal(result.issues[0].path, "원본 전체");
});

test("Vision metering uses provider usage and fails closed when usage or model pricing is unknown", () => {
  assert.equal(
    calculatePriceGuideProviderCostMicroUsd(PRICE_GUIDE_VISION_MODEL, { inputTokens: 10_000, outputTokens: 2_000 }),
    4_400,
  );
  assert.equal(
    calculatePriceGuideProviderCostMicroUsd(PRICE_GUIDE_VISION_MODEL, null),
    PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD,
  );
  assert.equal(
    calculatePriceGuideProviderCostMicroUsd("unpriced-vision-model", { inputTokens: 1, outputTokens: 1 }),
    PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD,
  );
});

test("PriceGuideV2 strict schema requires every property and rejects additional properties recursively", () => {
  const visit = (schema) => {
    if (!schema || typeof schema !== "object") return;
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
      for (const child of Object.values(schema.properties)) visit(child);
    }
    if (schema.type === "array") visit(schema.items);
  };
  visit(PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA);
  assert.ok(PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA.properties.source.enum.includes("manual"));
  assert.ok(PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA.properties.source.enum.includes("ai_imported"));
  assert.ok(PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA.properties.source.enum.includes("owner_corrected"));
});

test("Responses fixture uses compact coordinates and preserves safe canonical detail", async () => {
  const expected = v2Document();
  let capturedBody = null;
  const result = await extractPriceGuideFromImages(["data:image/jpeg;base64,fixture"], {
    responsesClient: async ({ body }) => {
      capturedBody = body;
      return createPriceGuideResponsesFixture(expected);
    },
  });

  assert.equal(result.document.source, "ai_imported");
  assert.equal(result.document.overallNote, expected.overallNote);
  assert.equal(result.document.rows.length, 5, "the unresolved fixture row stays outside the source table");
  assert.deepEqual(result.document.rows.slice(0, 3).map((row) => row.note), ["행 메모", null, "모량에 따라 범위 적용"]);
  assert.equal(result.document.tableGroups?.length, 6);
  assert.equal(capturedBody.store, false);
  assert.equal(capturedBody.text.format.strict, true);
  assert.equal(capturedBody.text.format.schema, PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA);
  assert.equal(capturedBody.input[0].content[1].detail, "original");
  assert.deepEqual(result.document.rows.map((row) => row.sizeClass), ["small", "medium", "large", "extra-large", "all"]);
  assert.deepEqual(result.document.rows[0].breedNames, ["말티즈", "푸들"]);
  assert.equal(result.document.overallNote, "전체 메모를 빠뜨리지 않습니다.");
  assert.equal(result.document.rows[0].note, "행 메모");
  assert.deepEqual(result.document.surcharges.map((fee) => [fee.amountKrw, fee.percent]), [[5_000, null], [null, 10]]);
  assert.deepEqual(result.document.aiReview.map((review) => review.confidence), ["low"]);
});

test("provider canonicalization recovers only evidence-equivalent Korean table variants", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [{
      sourceLabel: "소형견 (말티즈, 푸들 등)",
      species: "dog",
      breedNames: [],
      sizeClass: "small",
      weightBands: [
        { label: "5kg 이하", minKg: null, maxKg: 5, note: null },
        { label: "5~8kg", minKg: 5, maxKg: 8, note: null },
      ],
      serviceNames: ["목욕"],
      note: null,
    }],
    rows: [
      { serviceName: "목욕", species: "dog", breedNames: [], breedGroup: "소형견 (말티즈, 푸들 등)", sizeClass: "small", minKg: null, maxKg: 5, weightBandLabel: "5kg 이하", priceKind: "fixed", priceMinKrw: 30_000, priceMaxKrw: null, durationMinutes: null, note: null },
      { serviceName: "목욕", species: "dog", breedNames: [], breedGroup: "소형견 (말티즈, 푸들 등)", sizeClass: "small", minKg: 5, maxKg: 8, weightBandLabel: "5~8kg", priceKind: "range", priceMinKrw: 40_000, priceMaxKrw: 50_000, durationMinutes: null, note: null },
    ],
    surcharges: [],
    aiReview: [],
  };
  const response = createPriceGuideResponsesFixture(document);
  const providerDocument = JSON.parse(response.output[0].content[0].text);
  providerDocument.overallNote = "";
  providerDocument.tableGroups[0].note = "";
  providerDocument.tableGroups[0].weightBands[0].note = "";
  providerDocument.rows[0].d = "";
  providerDocument.rows[0].n = "";
  providerDocument.rows[1] = {
    ...providerDocument.rows[1],
    w: providerDocument.rows[1].s,
    s: providerDocument.rows[1].w,
  };
  response.output[0].content[0].text = JSON.stringify(providerDocument);

  const result = await extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async () => response,
  });

  assert.equal(result.document.overallNote, null);
  assert.equal(result.document.tableGroups[0].sourceLabel, "소형견");
  assert.deepEqual(result.document.tableGroups[0].breedNames, ["말티즈", "푸들"]);
  assert.deepEqual(result.document.rows.map((row) => row.weightBandLabel), ["5kg 이하", "5~8kg"]);
  assert.deepEqual(result.document.rows.map((row) => row.durationMinutes), [null, null]);
  assert.deepEqual(
    result.document.rows.map((row) => [row.priceKind, row.priceMinKrw, row.priceMaxKrw]),
    [["fixed", 30_000, null], ["range", 40_000, 50_000]],
  );
});

test("merged pricing-group headers and duplicate physical axes remap without inventing cells", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [{
      sourceLabel: "관리형 A/B",
      species: "dog",
      breedNames: ["견종가", "견종나"],
      sizeClass: "medium",
      weightBands: [
        { label: "5kg 이하", minKg: null, maxKg: 5, note: null },
        { label: "5~8kg", minKg: 5, maxKg: 8, note: null },
      ],
      serviceNames: ["목욕", "전체 미용"],
      note: null,
    }],
    rows: [
      { serviceName: "목욕", species: "dog", breedNames: ["견종가", "견종나"], breedGroup: "관리형 A/B", sizeClass: "medium", minKg: null, maxKg: 5, weightBandLabel: "5kg 이하", priceKind: "fixed", priceMinKrw: 30_000, priceMaxKrw: null, durationMinutes: null, note: null },
      { serviceName: "전체 미용", species: "dog", breedNames: ["견종가", "견종나"], breedGroup: "관리형 A/B", sizeClass: "medium", minKg: 5, maxKg: 8, weightBandLabel: "5~8kg", priceKind: "range", priceMinKrw: 40_000, priceMaxKrw: 50_000, durationMinutes: 90, note: null },
    ],
    surcharges: [],
    aiReview: [],
  };
  const response = createPriceGuideResponsesFixture(document);
  const providerDocument = JSON.parse(response.output[0].content[0].text);
  providerDocument.tableGroups[0].sourceLabel = "관리형 A/B\n견종가, 견종나 등";
  providerDocument.tableGroups[0].breedNames = [];
  providerDocument.tableGroups[0].weightBands.push(
    { label: "5kg ~ 8kg", minKg: 5, maxKg: 8, note: null },
    { label: " ", minKg: null, maxKg: null, note: null },
  );
  providerDocument.tableGroups[0].serviceNames.push("전체미용", " ");
  providerDocument.rows[1].w = 2;
  providerDocument.rows[1].s = 2;
  response.output[0].content[0].text = JSON.stringify(providerDocument);
  let capturedBody = null;

  const result = await extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async ({ body }) => {
      capturedBody = body;
      return response;
    },
  });

  assert.equal(result.document.tableGroups[0].sourceLabel, "관리형 A/B");
  assert.deepEqual(result.document.tableGroups[0].breedNames, ["견종가", "견종나"]);
  assert.deepEqual(result.document.tableGroups[0].serviceNames, ["목욕", "전체 미용"]);
  assert.deepEqual(result.document.tableGroups[0].weightBands.map((band) => band.label), ["5kg 이하", "5~8kg"]);
  assert.deepEqual(
    result.document.rows.map((row) => [row.serviceName, row.weightBandLabel, row.priceMinKrw, row.priceMaxKrw, row.durationMinutes]),
    [["목욕", "5kg 이하", 30_000, null, null], ["전체 미용", "5~8kg", 40_000, 50_000, 90]],
  );
  const prompt = capturedBody.input[0].content[0].text;
  assert.match(prompt, /요금 분류\(sourceLabel\)/u);
  assert.match(prompt, /특정 분류명을 만들거나 allowlist로 제한하지 마세요/u);
  assert.match(prompt, /슬래시 문자의 유무만으로 텍스트를 합치거나 나누지 마세요/u);
});

test("dynamic pricing groups preserve repeated, bottom-addon, and side-addon table topologies", async () => {
  function topologyDocument({ groupCount, weightCount, serviceCount, surchargeCount }) {
    const allBands = [
      { label: "5kg 이하", minKg: null, maxKg: 5, note: null },
      { label: "5~8kg", minKg: 5, maxKg: 8, note: null },
      { label: "8kg 이상", minKg: 8, maxKg: null, note: null },
    ];
    const tableGroups = Array.from({ length: groupCount }, (_, groupIndex) => ({
      sourceLabel: `분류 ${groupIndex + 1}`,
      species: "unknown",
      breedNames: [`견종 ${groupIndex + 1}-가`, `견종 ${groupIndex + 1}-나`],
      sizeClass: "unknown",
      weightBands: allBands.slice(0, weightCount).map((band) => ({ ...band })),
      serviceNames: Array.from({ length: serviceCount }, (_, serviceIndex) => `서비스 ${serviceIndex + 1}`),
      note: null,
    }));
    const rows = tableGroups.flatMap((group, groupIndex) => group.weightBands.flatMap((band, weightIndex) => (
      group.serviceNames.map((serviceName, serviceIndex) => ({
        serviceName,
        species: "unknown",
        breedNames: [...group.breedNames],
        breedGroup: group.sourceLabel,
        sizeClass: "unknown",
        minKg: band.minKg,
        maxKg: band.maxKg,
        weightBandLabel: band.label,
        priceKind: "unknown",
        priceMinKrw: 10_000 + (groupIndex * 1_000) + (weightIndex * 100) + serviceIndex,
        priceMaxKrw: null,
        durationMinutes: serviceIndex === 0 ? 30 + weightIndex : null,
        note: null,
      }))
    )));
    return {
      schemaVersion: 2,
      source: "fixture",
      overallNote: null,
      tableGroups,
      rows,
      surcharges: Array.from({ length: surchargeCount }, (_, index) => ({
        condition: `추가 항목 ${index + 1}`,
        amountKrw: 1_000 + index,
        percent: null,
        note: null,
      })),
      aiReview: [],
    };
  }

  const cases = [
    { name: "repeated-blocks-bottom-addons", groupCount: 3, weightCount: 2, serviceCount: 3, surchargeCount: 2 },
    { name: "multi-blocks-bottom-addons", groupCount: 2, weightCount: 3, serviceCount: 2, surchargeCount: 3 },
    { name: "main-matrix-side-addons", groupCount: 1, weightCount: 2, serviceCount: 3, surchargeCount: 4 },
  ];

  for (const fixture of cases) {
    const source = topologyDocument(fixture);
    const result = await extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
      responsesClient: async () => createPriceGuideResponsesFixture(source),
    });
    assert.deepEqual(result.document.tableGroups.map((group) => group.sourceLabel), source.tableGroups.map((group) => group.sourceLabel), fixture.name);
    assert.deepEqual(result.document.tableGroups.map((group) => group.serviceNames), source.tableGroups.map((group) => group.serviceNames), fixture.name);
    assert.deepEqual(result.document.tableGroups.map((group) => group.weightBands.map((band) => band.label)), source.tableGroups.map((group) => group.weightBands.map((band) => band.label)), fixture.name);
    assert.equal(result.document.rows.length, fixture.groupCount * fixture.weightCount * fixture.serviceCount, fixture.name);
    assert.equal(result.document.surcharges.length, fixture.surchargeCount, fixture.name);
    assert.equal(result.document.rows.some((row) => row.durationMinutes === 60), false, fixture.name);
  }
});

test("stage87 a structurally empty repeated block does not discard independent confirmed blocks", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [
      {
        sourceLabel: "확정 분류",
        species: "unknown",
        breedNames: [],
        sizeClass: "unknown",
        weightBands: [{ label: "3kg 이하", minKg: null, maxKg: 3, note: null }],
        serviceNames: ["서비스 가"],
        note: null,
      },
      {
        sourceLabel: "부분 확인 분류",
        species: "unknown",
        breedNames: [],
        sizeClass: "unknown",
        weightBands: [
          { label: "5kg 이하", minKg: null, maxKg: 5, note: null },
        ],
        serviceNames: [],
        note: null,
      },
    ],
    rows: [
      { serviceName: "서비스 가", species: "unknown", breedNames: [], breedGroup: "확정 분류", sizeClass: "unknown", minKg: null, maxKg: 3, weightBandLabel: "3kg 이하", priceKind: "unknown", priceMinKrw: 21_000, priceMaxKrw: null, durationMinutes: null, note: null },
    ],
    surcharges: [],
    aiReview: [],
  };

  const result = await extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async () => createPriceGuideResponsesFixture(document),
  });
  assert.deepEqual(result.document.rows.map((row) => [row.breedGroup, row.weightBandLabel, row.priceMinKrw]), [
    ["확정 분류", "3kg 이하", 21_000],
  ]);
  assert.deepEqual(result.document.tableGroups.map((group) => group.sourceLabel), ["확정 분류"]);
  assert.equal(result.issues.some((issue) => issue.path === "tableGroups:1"), true);
});

test("stage87 uncertain breed text is review-only while confirmed group, cells, and dynamic labels survive", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [{
      sourceLabel: "사진 원문 분류/한 셀",
      species: "unknown",
      breedNames: ["불확정 견종 후보"],
      sizeClass: "unknown",
      weightBands: [{ label: "4kg 이하", minKg: null, maxKg: 4, note: null }],
      serviceNames: ["서비스 원문"],
      note: null,
    }],
    rows: [{
      serviceName: "서비스 원문", species: "unknown", breedNames: ["불확정 견종 후보"], breedGroup: "사진 원문 분류/한 셀", sizeClass: "unknown", minKg: null, maxKg: 4, weightBandLabel: "4kg 이하", priceKind: "unknown", priceMinKrw: 27_000, priceMaxKrw: null, durationMinutes: null, note: null,
    }],
    surcharges: [],
    aiReview: [{ targetId: "rows:0", field: "breedNames", rawText: "판독 불확실", confidence: "low", userConfirmed: false, userCorrected: false }],
  };

  const result = await extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async () => createPriceGuideResponsesFixture(document),
  });
  assert.equal(result.document.tableGroups[0].sourceLabel, document.tableGroups[0].sourceLabel);
  assert.deepEqual(result.document.tableGroups[0].breedNames, []);
  assert.deepEqual(result.document.rows[0].breedNames, []);
  assert.equal(result.document.rows[0].priceMinKrw, 27_000);
  assert.equal(result.document.aiReview[0].field, "breedNames");
});

test("stage87 right and bottom regions preserve a separate add-on matrix and every complete surcharge pair", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [
      {
        sourceLabel: "주 표",
        species: "unknown",
        breedNames: [],
        sizeClass: "unknown",
        weightBands: [{ label: "6kg 이하", minKg: null, maxKg: 6, note: "12kg 초과 시 1kg당 추가" }],
        serviceNames: ["주 서비스"],
        note: null,
      },
      {
        sourceLabel: "분리된 추가 서비스 표",
        species: "unknown",
        breedNames: [],
        sizeClass: "unknown",
        weightBands: [{ label: "무게 구간 가", minKg: null, maxKg: null, note: null }],
        serviceNames: ["추가 서비스 가", "추가 서비스 나"],
        note: null,
      },
    ],
    rows: [
      { serviceName: "주 서비스", species: "unknown", breedNames: [], breedGroup: "주 표", sizeClass: "unknown", minKg: null, maxKg: 6, weightBandLabel: "6kg 이하", priceKind: "unknown", priceMinKrw: 30_000, priceMaxKrw: null, durationMinutes: null, note: null },
      { serviceName: "추가 서비스 가", species: "unknown", breedNames: [], breedGroup: "분리된 추가 서비스 표", sizeClass: "unknown", minKg: null, maxKg: null, weightBandLabel: "무게 구간 가", priceKind: "unknown", priceMinKrw: 7_000, priceMaxKrw: null, durationMinutes: null, note: null },
      { serviceName: "추가 서비스 나", species: "unknown", breedNames: [], breedGroup: "분리된 추가 서비스 표", sizeClass: "unknown", minKg: null, maxKg: null, weightBandLabel: "무게 구간 가", priceKind: "unknown", priceMinKrw: 9_000, priceMaxKrw: null, durationMinutes: null, note: null },
    ],
    surcharges: [
      { condition: "하단 항목 가", amountKrw: 1_000, percent: null, note: null },
      { condition: "하단 항목 나", amountKrw: 2_000, percent: null, note: null },
      { condition: "우측 항목 다", amountKrw: null, percent: 10, note: null },
      { condition: "불확정 항목", amountKrw: 4_000, percent: null, note: null },
    ],
    aiReview: [{ targetId: "surcharges:3", field: "amountKrw", rawText: "금액 불확실", confidence: "low", userConfirmed: false, userCorrected: false }],
  };
  let capturedBody;
  const result = await extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async ({ body }) => {
      capturedBody = body;
      return createPriceGuideResponsesFixture(document);
    },
  });

  assert.deepEqual(result.document.tableGroups.map((group) => group.sourceLabel), ["주 표", "분리된 추가 서비스 표"]);
  assert.deepEqual(result.document.rows.map((row) => row.priceMinKrw), [30_000, 7_000, 9_000]);
  assert.deepEqual(result.document.surcharges.map((fee) => [fee.condition, fee.amountKrw, fee.percent]), [
    ["하단 항목 가", 1_000, null],
    ["하단 항목 나", 2_000, null],
    ["우측 항목 다", null, 10],
  ]);
  assert.equal(result.document.surcharges.some((fee) => fee.condition?.includes("1kg당")), false);
  const prompt = capturedBody.input[0].content[0].text;
  assert.match(prompt, /오른쪽과 아래쪽 분리 구역을 각각 한 번 더 끝까지 훑으세요/u);
  assert.match(prompt, /추가 서비스 표는 별도 tableGroup과 rows/u);
  assert.match(prompt, /견종 글자가 불명확하면 해당 breedNames만 aiReview/u);
});

test("a source table with no explicit weight axis stays fail-closed without a fabricated band", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [{
      sourceLabel: "분류 1",
      species: "unknown",
      breedNames: [],
      sizeClass: "unknown",
      weightBands: [],
      serviceNames: ["서비스 1"],
      note: null,
    }],
    rows: [],
    surcharges: [],
    aiReview: [],
  };
  await assert.rejects(
    extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
      responsesClient: async () => createPriceGuideResponsesFixture(document),
    }),
    (error) => error instanceof PriceGuidePhotoImportError && error.safeSubtype === "AXIS_INVALID",
  );
  assert.deepEqual(document.tableGroups[0].weightBands, []);
  assert.deepEqual(document.rows, []);
});

test("an explicit weightless fixed-price list keeps nullable-weight rows without fabricating a band", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: "단위: 천원",
    tableGroups: [{
      sourceLabel: "기본 서비스",
      species: "unknown",
      breedNames: [],
      sizeClass: "unknown",
      weightBands: [],
      serviceNames: ["목욕", "발톱"],
      note: "단위: 천원",
    }],
    rows: [
      { serviceName: "목욕", species: "unknown", breedNames: [], breedGroup: "기본 서비스", sizeClass: "unknown", minKg: null, maxKg: null, weightBandLabel: null, priceKind: "fixed", priceMinKrw: 20_000, priceMaxKrw: null, durationMinutes: 40, note: null },
      { serviceName: "발톱", species: "unknown", breedNames: [], breedGroup: "기본 서비스", sizeClass: "unknown", minKg: null, maxKg: null, weightBandLabel: null, priceKind: "fixed", priceMinKrw: 10_000, priceMaxKrw: null, durationMinutes: 20, note: null },
    ],
    surcharges: [{ condition: "주말", amountKrw: 5_000, percent: null, note: null }],
    aiReview: [],
  };

  const fixture = createPriceGuideResponsesFixture(document, {
    priceCellTexts: { 0: "20-", 1: "10-" },
  });
  const providerDocument = JSON.parse(fixture.output[0].content[0].text);
  assert.deepEqual(providerDocument.tableGroups[0].weightBands, []);
  assert.deepEqual(providerDocument.rows.map((row) => row.w), [null, null]);

  const result = await extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async () => fixture,
  });
  assert.deepEqual(result.document.rows.map((row) => [
    row.serviceName,
    row.minKg,
    row.maxKg,
    row.weightBandLabel,
    row.priceMinKrw,
    row.durationMinutes,
  ]), [
    ["목욕", null, null, null, 20_000, 40],
    ["발톱", null, null, null, 10_000, 20],
  ]);
  assert.deepEqual(result.document.tableGroups, []);
  assert.deepEqual(result.document.surcharges, document.surcharges);
});

test("a weightless list without one explicit service-price pair stays fail-closed", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [{
      sourceLabel: "기본 서비스",
      species: "unknown",
      breedNames: [],
      sizeClass: "unknown",
      weightBands: [],
      serviceNames: ["목욕"],
      note: null,
    }],
    rows: [{
      serviceName: "목욕", species: "unknown", breedNames: [], breedGroup: "기본 서비스", sizeClass: "unknown", minKg: null, maxKg: null, weightBandLabel: null,
      priceKind: "unknown", priceMinKrw: null, priceMaxKrw: null, durationMinutes: null, note: null,
    }],
    surcharges: [],
    aiReview: [],
  };
  await assert.rejects(
    extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
      responsesClient: async () => createPriceGuideResponsesFixture(document),
    }),
    (error) => error instanceof PriceGuidePhotoImportError && error.safeSubtype === "NO_ROWS",
  );
});

test("ambiguous numeric grids and conflicting weight evidence stay AXIS_INVALID", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [{
      sourceLabel: "요금표",
      species: "unknown",
      breedNames: [],
      sizeClass: "unknown",
      weightBands: [
        { label: "1", minKg: null, maxKg: null, note: null },
        { label: "2", minKg: null, maxKg: null, note: null },
      ],
      serviceNames: ["1", "2"],
      note: null,
    }],
    rows: [
      { serviceName: "1", species: "unknown", breedNames: [], breedGroup: "요금표", sizeClass: "unknown", minKg: null, maxKg: null, weightBandLabel: "1", priceKind: "unknown", priceMinKrw: 30_000, priceMaxKrw: null, durationMinutes: null, note: null },
    ],
    surcharges: [],
    aiReview: [],
  };
  await assert.rejects(
    extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
      responsesClient: async () => createPriceGuideResponsesFixture(document),
    }),
    (error) => error instanceof PriceGuidePhotoImportError && error.safeSubtype === "AXIS_INVALID",
  );

  const conflicting = createPriceGuideResponsesFixture({
    ...document,
    tableGroups: [{
      ...document.tableGroups[0],
      sourceLabel: "소형견",
      species: "dog",
      sizeClass: "small",
      weightBands: [
        { label: "5~8kg", minKg: 5, maxKg: 8, note: null },
        { label: "5kg~8kg", minKg: 5, maxKg: 9, note: null },
      ],
      serviceNames: ["목욕"],
    }],
    rows: [{
      ...document.rows[0],
      serviceName: "목욕",
      species: "dog",
      breedGroup: "소형견",
      sizeClass: "small",
      minKg: 5,
      maxKg: 8,
      weightBandLabel: "5~8kg",
    }],
  });
  const conflictingDocument = JSON.parse(conflicting.output[0].content[0].text);
  conflictingDocument.rows[0].w = 1;
  conflicting.output[0].content[0].text = JSON.stringify(conflictingDocument);
  await assert.rejects(
    extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
      responsesClient: async () => conflicting,
    }),
    (error) => error instanceof PriceGuidePhotoImportError && error.safeSubtype === "AXIS_INVALID",
  );
});

test("provider canonicalization preserves explicit unknown prices and keeps an unplaced coordinate out of the editable matrix", () => {
  const document = v2Document();
  document.rows = [{
    ...document.rows[0],
    priceKind: "unknown",
    priceMinKrw: 31_000,
    priceMaxKrw: null,
    durationMinutes: null,
  }];
  document.aiReview = [];
  const explicitUnknown = parsePriceGuideResponsesPayload(createPriceGuideResponsesFixture(document));
  assert.deepEqual(
    [explicitUnknown.rows[0].priceKind, explicitUnknown.rows[0].priceMinKrw, explicitUnknown.rows[0].durationMinutes],
    ["unknown", 31_000, null],
  );

  const invalidCoordinates = createPriceGuideResponsesFixture(document);
  const invalidDocument = JSON.parse(invalidCoordinates.output[0].content[0].text);
  invalidDocument.rows[0].w = 99;
  invalidDocument.rows[0].s = 99;
  invalidCoordinates.output[0].content[0].text = JSON.stringify(invalidDocument);
  const partial = parsePriceGuideResponsesPayload(invalidCoordinates);
  assert.deepEqual(partial.rows, []);
});

test("provider topology recovery keeps confirmed cells when one compact coordinate is ambiguous", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [{
      sourceLabel: "동적 분류/일반",
      species: "unknown",
      breedNames: [],
      sizeClass: "unknown",
      weightBands: [
        { label: "2kg 미만", minKg: null, maxKg: 2, note: null },
        { label: "4kg 미만", minKg: 2, maxKg: 4, note: null },
      ],
      serviceNames: ["목욕"],
      note: null,
    }],
    rows: [
      { serviceName: "목욕", species: "unknown", breedNames: [], breedGroup: "동적 분류/일반", sizeClass: "unknown", minKg: null, maxKg: 2, weightBandLabel: "2kg 미만", priceKind: "fixed", priceMinKrw: 20_000, priceMaxKrw: null, durationMinutes: 40, note: null },
      { serviceName: "목욕", species: "unknown", breedNames: [], breedGroup: "동적 분류/일반", sizeClass: "unknown", minKg: 2, maxKg: 4, weightBandLabel: "4kg 미만", priceKind: "fixed", priceMinKrw: 30_000, priceMaxKrw: null, durationMinutes: 50, note: null },
    ],
    surcharges: [{ condition: "주말", amountKrw: 5_000, percent: null, note: null }],
    aiReview: [],
  };
  const fixture = createPriceGuideResponsesFixture(document);
  const providerDocument = JSON.parse(fixture.output[0].content[0].text);
  providerDocument.rows[1].w = 99;
  providerDocument.rows[1].s = 99;
  fixture.output[0].content[0].text = JSON.stringify(providerDocument);

  const result = await extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async () => fixture,
  });

  assert.deepEqual(result.document.rows.map((row) => [row.serviceName, row.priceMinKrw, row.durationMinutes]), [
    ["목욕", 20_000, 40],
  ]);
  assert.deepEqual(result.document.surcharges, document.surcharges);
  assert.deepEqual(result.issues.map((issue) => issue.path), ["providerRows:1"]);
});

test("repeated physical classification blocks use explicit axis evidence despite axis order changes", async () => {
  const document = {
    schemaVersion: 2,
    source: "fixture",
    overallNote: null,
    tableGroups: [{
      sourceLabel: "동적 A/B",
      species: "dog",
      breedNames: ["견종가"],
      sizeClass: "unknown",
      weightBands: [
        { label: "2kg 미만", minKg: null, maxKg: 2, note: null },
        { label: "4kg 미만", minKg: 2, maxKg: 4, note: null },
      ],
      serviceNames: ["목욕", "발톱"],
      note: null,
    }],
    rows: [
      { serviceName: "목욕", species: "dog", breedNames: ["견종가"], breedGroup: "동적 A/B", sizeClass: "unknown", minKg: null, maxKg: 2, weightBandLabel: "2kg 미만", priceKind: "fixed", priceMinKrw: 20_000, priceMaxKrw: null, durationMinutes: 40, note: null },
      { serviceName: "발톱", species: "dog", breedNames: ["견종가"], breedGroup: "동적 A/B", sizeClass: "unknown", minKg: 2, maxKg: 4, weightBandLabel: "4kg 미만", priceKind: "fixed", priceMinKrw: 10_000, priceMaxKrw: null, durationMinutes: 20, note: null },
    ],
    surcharges: [{ condition: "주말", amountKrw: 5_000, percent: null, note: null }],
    aiReview: [],
  };
  const fixture = createPriceGuideResponsesFixture(document);
  const providerDocument = JSON.parse(fixture.output[0].content[0].text);
  providerDocument.tableGroups.push({
    ...providerDocument.tableGroups[0],
    weightBands: [...providerDocument.tableGroups[0].weightBands].reverse(),
    serviceNames: [...providerDocument.tableGroups[0].serviceNames].reverse(),
  });
  providerDocument.rows[1] = { ...providerDocument.rows[1], g: 1, w: 0, s: 0 };
  fixture.output[0].content[0].text = JSON.stringify(providerDocument);

  const result = await extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async () => fixture,
  });

  assert.equal(result.document.tableGroups?.length, 1);
  assert.deepEqual(result.document.rows.map((row) => [row.serviceName, row.weightBandLabel, row.priceMinKrw]), [
    ["목욕", "2kg 미만", 20_000],
    ["발톱", "4kg 미만", 10_000],
  ]);
  assert.deepEqual(result.document.surcharges, document.surcharges);
});

test("provider JSON schema bounds mirror the canonical editable document limits", () => {
  const properties = PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA.properties;
  const group = properties.tableGroups.items.properties;
  const row = properties.rows.items.properties;
  const surcharge = properties.surcharges.items.properties;

  assert.equal(properties.tableGroups.maxItems, 40);
  assert.equal(properties.rows.maxItems, 200);
  assert.equal(properties.surcharges.maxItems, 100);
  assert.equal(properties.aiReview.maxItems, 500);
  assert.equal(group.weightBands.maxItems, 40);
  assert.equal(group.serviceNames.maxItems, 40);
  assert.equal(group.weightBands.items.properties.minKg.maximum, 1_000);
  assert.equal(group.weightBands.items.properties.maxKg.maximum, 1_000);
  assert.equal(row.p.maximum, 100_000_000);
  assert.equal(row.x.maximum, 100_000_000);
  assert.deepEqual(row.d.anyOf, [
    { type: "integer", minimum: 1, maximum: 1_440 },
    { type: "string", enum: [""] },
    { type: "null" },
  ]);
  assert.equal(surcharge.amountKrw.maximum, 100_000_000);
  assert.equal(surcharge.percent.maximum, 1_000);
});

test("provider price-cell evidence blanks only mismatched or ambiguous digits without neighbor inference", () => {
  const document = v2Document();
  document.aiReview = [];
  document.rows[0] = { ...document.rows[0], priceMinKrw: 41_000 };
  document.rows[1] = { ...document.rows[1], priceMinKrw: 57_000 };
  document.rows[2] = { ...document.rows[2], priceMinKrw: 61_000, priceMaxKrw: 113_000 };

  const parsed = parsePriceGuideResponsesPayload(createPriceGuideResponsesFixture(document, {
    priceCellTexts: {
      0: "47,000원",
      1: "57,OOO원",
      2: "61,000원~113,000원",
    },
  }));

  assert.deepEqual(
    parsed.rows.slice(0, 2).map((row) => [row.priceKind, row.priceMinKrw, row.priceMaxKrw]),
    [["unknown", null, null], ["unknown", null, null]],
  );
  assert.deepEqual(
    [parsed.rows[2].priceKind, parsed.rows[2].priceMinKrw, parsed.rows[2].priceMaxKrw],
    ["range", 61_000, 113_000],
    "a clear self-consistent cell stays intact even when it differs from nearby values",
  );
  assert.deepEqual(parsed.aiReview.map((review) => [review.targetId, review.field, review.rawText]), [
    ["rows:0", "priceMinKrw", ""],
    ["rows:1", "priceMinKrw", ""],
  ]);
  assert.equal(parsed.rows.some((row) => row.priceMinKrw === 47_000), false, "raw digits are never copied into a conflicting numeric field");
});

test("trailing-dash thousands are accepted only with explicit price-table evidence", () => {
  const baseRow = {
    ...v2Document().rows[0],
    breedNames: [],
    breedGroup: "임의 분류",
    sizeClass: "unknown",
    minKg: null,
    maxKg: 5,
    weightBandLabel: "5kg 이하",
    priceKind: "unknown",
    durationMinutes: null,
    note: null,
  };
  const repeated = {
    ...v2Document(),
    overallNote: null,
    tableGroups: [{
      sourceLabel: "임의 분류",
      species: "dog",
      breedNames: [],
      sizeClass: "unknown",
      weightBands: [{ label: "5kg 이하", minKg: null, maxKg: 5, note: null }],
      serviceNames: ["서비스 하나", "서비스 둘"],
      note: null,
    }],
    rows: [
      { ...baseRow, serviceName: "서비스 하나", priceMinKrw: 21_000 },
      { ...baseRow, serviceName: "서비스 둘", priceMinKrw: 34_000 },
    ],
    surcharges: [],
    aiReview: [],
  };
  const repeatedParsed = parsePriceGuideResponsesPayload(createPriceGuideResponsesFixture(repeated, {
    priceCellTexts: { 0: "21-", 1: "34-" },
  }));
  assert.deepEqual(repeatedParsed.rows.map((row) => row.priceMinKrw), [21_000, 34_000]);

  const explicitUnit = structuredClone(repeated);
  explicitUnit.tableGroups[0].note = "단위: 천원";
  explicitUnit.tableGroups[0].serviceNames = ["서비스 하나"];
  explicitUnit.rows = [{ ...baseRow, serviceName: "서비스 하나", priceMinKrw: 47_000 }];
  const explicitUnitParsed = parsePriceGuideResponsesPayload(createPriceGuideResponsesFixture(explicitUnit, {
    priceCellTexts: { 0: "47-" },
  }));
  assert.equal(explicitUnitParsed.rows[0].priceMinKrw, 47_000);

  const unsupported = structuredClone(explicitUnit);
  unsupported.tableGroups[0].note = null;
  const unsupportedParsed = parsePriceGuideResponsesPayload(createPriceGuideResponsesFixture(unsupported, {
    priceCellTexts: { 0: "47-" },
  }));
  assert.deepEqual(
    [unsupportedParsed.rows[0].priceKind, unsupportedParsed.rows[0].priceMinKrw],
    ["unknown", null],
  );
});

test("trailing-dash normalization never consumes ranges, signs, weights, times, comparators, or explicit units", () => {
  const base = v2Document();
  const cases = [
    { text: "21-34", priceKind: "range", priceMinKrw: 21_000, priceMaxKrw: 34_000, accepted: false },
    { text: "21~34", priceKind: "range", priceMinKrw: 21_000, priceMaxKrw: 34_000, accepted: false },
    { text: "-21", priceKind: "unknown", priceMinKrw: 21_000, priceMaxKrw: null, accepted: false },
    { text: "21kg", priceKind: "unknown", priceMinKrw: 21_000, priceMaxKrw: null, accepted: false },
    { text: "21분", priceKind: "unknown", priceMinKrw: 21_000, priceMaxKrw: null, accepted: false },
    { text: "21 이하", priceKind: "unknown", priceMinKrw: 21_000, priceMaxKrw: null, accepted: false },
    { text: "21,000원", priceKind: "unknown", priceMinKrw: 21_000, priceMaxKrw: null, accepted: true },
    { text: "2.1만원", priceKind: "unknown", priceMinKrw: 21_000, priceMaxKrw: null, accepted: true },
  ];

  for (const fixture of cases) {
    const document = {
      ...base,
      rows: [{
        ...base.rows[0],
        priceKind: fixture.priceKind,
        priceMinKrw: fixture.priceMinKrw,
        priceMaxKrw: fixture.priceMaxKrw,
      }],
      surcharges: [],
      aiReview: [],
    };
    const parsed = parsePriceGuideResponsesPayload(createPriceGuideResponsesFixture(document, {
      priceCellTexts: { 0: fixture.text },
    }));
    assert.equal(parsed.rows[0].priceMinKrw, fixture.accepted ? fixture.priceMinKrw : null, fixture.text);
    assert.equal(parsed.rows[0].priceMaxKrw, fixture.accepted ? fixture.priceMaxKrw : null, fixture.text);
  }
});

test("provider extraction accepts exactly one normalized price-table image", async () => {
  let providerCalls = 0;
  await assert.rejects(
    extractPriceGuideFromImages([
      "data:image/jpeg;base64,first",
      "data:image/jpeg;base64,overlapping-crop",
    ], {
      responsesClient: async () => {
        providerCalls += 1;
        return createPriceGuideResponsesFixture(v2Document());
      },
    }),
    /정확히 한 장이어야 합니다/,
  );
  assert.equal(providerCalls, 0);
});

test("AI/fixture imports and owner review actions keep explicit source provenance", async () => {
  const fixture = v2Document();
  const imported = (await extractPriceGuideFromImages(["data:image/jpeg;base64,fixture"], {
    responsesClient: async () => createPriceGuideResponsesFixture(fixture),
  })).document;
  imported.aiReview = [
    { targetId: "rows:0", field: "priceMinKrw", rawText: "", confidence: "low", userConfirmed: false, userCorrected: false },
    { targetId: "rows:0", field: "note", rawText: "", confidence: "low", userConfirmed: false, userCorrected: false },
  ];
  assert.equal(imported.source, "ai_imported");

  const partlyConfirmed = resolvePriceGuideV2Reviews(
    imported,
    (review) => review.targetId === "rows:0" && review.field === "priceMinKrw",
    "confirmed",
  );
  assert.equal(partlyConfirmed.source, "ai_imported");
  const fullyConfirmed = resolvePriceGuideV2Reviews(
    partlyConfirmed,
    (review) => review.targetId === "rows:0" && review.field === "note",
    "confirmed",
  );
  assert.equal(fullyConfirmed.source, "owner_confirmed");

  const corrected = resolvePriceGuideV2Reviews(
    imported,
    (review) => review.targetId === "rows:0" && review.field === "priceMinKrw",
    "corrected",
  );
  assert.equal(corrected.source, "owner_corrected");
  assert.equal(corrected.aiReview.some((review) => review.userCorrected), true);
  assert.equal(corrected.aiReview.some((review) => review.userConfirmed), false);

  for (const source of ["legacy", "manual", "owner_confirmed", "vision", "fixture"]) {
    assert.equal(priceGuideV2Schema.safeParse({ ...fixture, source }).success, true, source);
  }
  const manual = resolvePriceGuideV2Reviews(
    { ...imported, source: "manual" },
    () => true,
    "corrected",
  );
  assert.equal(manual.source, "manual");
});

test("classification validation reports species and size unknown without inventing defaults", () => {
  const document = v2Document();
  assert.deepEqual(findPriceGuideV2ClassificationIssues(document), [
    { rowIndex: 5, field: "species" },
    { rowIndex: 5, field: "sizeClass" },
  ]);
});

test("owner photo save summary uses only explicit name, price, and duration while hidden taxonomy stays unknown", () => {
  const source = v2Document().rows[0];
  const document = {
    schemaVersion: 2,
    source: "ai_imported",
    overallNote: null,
    rows: [{
      ...source,
      species: "unknown",
      sizeClass: "unknown",
      priceKind: "unknown",
      priceMinKrw: 31_000,
      durationMinutes: 75,
    }],
    surcharges: [],
    aiReview: [],
  };

  assert.deepEqual(getOwnerPriceGuideServiceProjection(document), {
    name: source.serviceName,
    price: 31_000,
    priceType: "starting",
    durationMinutes: 75,
  });
  assert.equal(
    getOwnerPriceGuideServiceProjection({ ...document, rows: [{ ...document.rows[0], durationMinutes: null }] }),
    null,
  );
});

test("Responses parser distinguishes incomplete, refusal, empty output, and invalid schema", () => {
  assert.throws(
    () => parsePriceGuideResponsesPayload({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] }),
    (error) => error instanceof PriceGuidePhotoImportError && error.code === "VISION_RESPONSE_INCOMPLETE" && error.incompleteReason === "max_output_tokens",
  );
  assert.throws(
    () => parsePriceGuideResponsesPayload({ status: "completed", output: [{ content: [{ type: "refusal", refusal: "not retained" }] }] }),
    (error) => error instanceof PriceGuidePhotoImportError && error.code === "VISION_RESPONSE_REFUSAL",
  );
  assert.throws(
    () => parsePriceGuideResponsesPayload({ status: "completed", output: [] }),
    (error) => error instanceof PriceGuidePhotoImportError && error.code === "VISION_RESPONSE_EMPTY",
  );
  assert.throws(
    () => parsePriceGuideResponsesPayload({ status: "completed", output_text: "not-json" }),
    (error) => error instanceof PriceGuidePhotoImportError && error.code === "VISION_RESPONSE_SCHEMA_INVALID",
  );
  assert.throws(
    () => parsePriceGuideResponsesPayload({ status: "completed", output_text: JSON.stringify({ schemaVersion: 2 }) }),
    (error) => error instanceof PriceGuidePhotoImportError && error.code === "VISION_RESPONSE_SCHEMA_INVALID",
  );
  const missingEvidence = createPriceGuideResponsesFixture(v2Document());
  const missingEvidenceDocument = JSON.parse(missingEvidence.output[0].content[0].text);
  delete missingEvidenceDocument.rows[0].t;
  missingEvidence.output[0].content[0].text = JSON.stringify(missingEvidenceDocument);
  assert.throws(
    () => parsePriceGuideResponsesPayload(missingEvidence),
    (error) => error instanceof PriceGuidePhotoImportError && error.code === "VISION_RESPONSE_SCHEMA_INVALID",
  );
});

test("provider validation failures expose only a coarse code and allowlisted safe subtype", async () => {
  assert.deepEqual(PRICE_GUIDE_PROVIDER_VALIDATION_SAFE_SUBTYPES, [
    "NO_ROWS",
    "AXIS_INVALID",
    "SHAPE_INVALID",
    "SCHEMA_INVALID",
  ]);

  const capture = async (run) => {
    try {
      await run();
      assert.fail("expected provider validation rejection");
    } catch (error) {
      assert.equal(error instanceof PriceGuidePhotoImportError, true);
      return error;
    }
  };

  const schemaError = await capture(() => parsePriceGuideResponsesPayload({
    status: "completed",
    output_text: "not-json",
  }));

  const noRowsDocument = v2Document();
  noRowsDocument.rows = [];
  const noRowsError = await capture(() => extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async () => createPriceGuideResponsesFixture(noRowsDocument),
  }));

  const invalidAxisPayload = createPriceGuideResponsesFixture(v2Document());
  const invalidAxisDocument = JSON.parse(invalidAxisPayload.output[0].content[0].text);
  invalidAxisDocument.tableGroups[0].weightBands[0] = {
    ...invalidAxisDocument.tableGroups[0].weightBands[0],
    label: "2kg 이하",
    maxKg: 3,
  };
  invalidAxisPayload.output[0].content[0].text = JSON.stringify(invalidAxisDocument);
  const axisError = await capture(() => extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async () => invalidAxisPayload,
  }));

  const shapeError = new PriceGuidePhotoImportError(
    "VISION_RESPONSE_SCHEMA_INVALID",
    "internal shape detail must not escape",
    422,
    undefined,
    undefined,
    "SHAPE_INVALID",
  );

  for (const [error, safeSubtype] of [
    [schemaError, "SCHEMA_INVALID"],
    [noRowsError, "NO_ROWS"],
    [axisError, "AXIS_INVALID"],
    [shapeError, "SHAPE_INVALID"],
  ]) {
    assert.deepEqual(toSafePriceGuideProviderValidationResponse(error), {
      code: PRICE_GUIDE_PROVIDER_INVALID_RESPONSE_CODE,
      safeSubtype,
      message: PRICE_GUIDE_PROVIDER_INVALID_RESPONSE_MESSAGE,
    });
  }

  const unknownSubtype = new PriceGuidePhotoImportError(
    "VISION_RESPONSE_SCHEMA_INVALID",
    "raw provider rows and cells",
    502,
    undefined,
    undefined,
    "NOT_ALLOWLISTED",
  );
  const unknownResponse = toSafePriceGuideProviderValidationResponse(unknownSubtype);
  assert.deepEqual(unknownResponse, {
    code: PRICE_GUIDE_PROVIDER_INVALID_RESPONSE_CODE,
    message: PRICE_GUIDE_PROVIDER_INVALID_RESPONSE_MESSAGE,
  });
  assert.doesNotMatch(JSON.stringify(unknownResponse), /raw provider|rows|cells|NOT_ALLOWLISTED/);
  assert.equal(toSafePriceGuideProviderValidationResponse(
    new PriceGuidePhotoImportError("VISION_TIMEOUT", "timeout", 504),
  ), null);

  const importRoute = await readFile(
    new URL("../../src/app/api/owner/price-guide-photo-import/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    importRoute,
    /const safeProviderValidationResponse = toSafePriceGuideProviderValidationResponse\(error\)/,
  );
  assert.match(
    importRoute,
    /safeProviderValidationResponse \?\? \{ code: error\.code, message: error\.message \}/,
  );
});

test("provider deadline fails closed after one slow attempt without retry or fallback", async () => {
  let providerCalls = 0;
  const startedAt = Date.now();
  await assert.rejects(
    extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
      timeoutMs: 5_000,
      responsesClient: ({ signal }) => new Promise((resolve, reject) => {
        providerCalls += 1;
        signal.addEventListener("abort", () => reject(new DOMException("deadline", "AbortError")), { once: true });
      }),
    }),
    (error) => error instanceof PriceGuidePhotoImportError
      && error.code === "VISION_TIMEOUT"
      && error.status === 504,
  );
  const elapsedMs = Date.now() - startedAt;
  assert.equal(providerCalls, 1);
  assert.equal(PRICE_GUIDE_PROVIDER_TIMEOUT_MS, 60_000);
  assert.ok(elapsedMs >= 4_900 && elapsedMs < 6_500, `bounded timeout elapsed=${elapsedMs}`);
});

test("provider request lowers reasoning and verbosity while reducing the output ceiling", async () => {
  const document = v2Document();
  let capturedBody = null;
  await extractPriceGuideFromImages(["data:image/webp;base64,fixture"], {
    responsesClient: async ({ body }) => {
      capturedBody = body;
      return createPriceGuideResponsesFixture(document);
    },
  });
  assert.equal(PRICE_GUIDE_PROVIDER_MAX_OUTPUT_TOKENS, 7_000);
  assert.equal(capturedBody.max_output_tokens, PRICE_GUIDE_PROVIDER_MAX_OUTPUT_TOKENS);
  assert.equal(capturedBody.reasoning.effort, PRICE_GUIDE_PROVIDER_REASONING_EFFORT);
  assert.equal(capturedBody.text.verbosity, PRICE_GUIDE_PROVIDER_TEXT_VERBOSITY);
  assert.equal(capturedBody.store, false);
});

test("storage compatibility uses exact minimum representatives for fixed, starting, and range rows", () => {
  const document = v2Document();
  const compatibility = buildPriceGuideV2Compatibility(document);
  assert.equal(compatibility.guide.sections[1].items[0].cells["5~12kg"].price, "55000~");
  assert.equal(compatibility.guide.sections[2].items[0].cells["12~25kg"].price, "80000~120000");
  assert.equal(compatibility.guide.sections[3].items[0].cells["25kg 이상"].durationMinutes, "");
  assert.deepEqual(compatibility.services.map((service) => service.name), ["소형 목욕", "중형 미용", "대형 미용", "공통 발톱"]);
  assert.deepEqual(compatibility.services.map((service) => service.price), [30_000, 55_000, 80_000, 10_000]);
  assert.deepEqual(compatibility.services.map((service) => service.priceType), ["fixed", "starting", "starting", "fixed"]);
  assert.deepEqual(compatibility.services.map((service) => service.durationMinutes), [45, 90, 150, 10]);
  assert.equal(compatibility.services.some((service) => service.durationMinutes === 60), false);
  assert.equal(compatibility.storageValidation.complete, false);
  assert.equal(compatibility.storageValidation.canonicalRowCount, 6);
  assert.equal(compatibility.storageValidation.mappedRowCount, 4);
  assert.deepEqual(
    [...new Set(compatibility.storageValidation.issues.map((issue) => issue.code))].sort(),
    ["DURATION_REQUIRED", "PRICE_REQUIRED", "SERVICE_NAME_REQUIRED", "SIZE_CLASS_REQUIRED", "SPECIES_REQUIRED"],
  );
});

test("storage compatibility refuses unknown prices and null durations without inventing defaults", () => {
  const source = v2Document();
  const document = {
    ...source,
    source: "manual",
    rows: [
      source.rows[1],
      { ...source.rows[0], serviceName: "시간 미확정 목욕", durationMinutes: null },
      { ...source.rows[0], serviceName: "가격 미확정 목욕", priceKind: "unknown", priceMinKrw: null },
    ],
    aiReview: [],
  };

  const compatibility = buildPriceGuideV2Compatibility(document);
  assert.deepEqual(compatibility.services.map((service) => service.name), ["중형 미용"]);
  assert.equal(compatibility.services[0].price, 55_000);
  assert.equal(compatibility.services[0].priceType, "starting");
  assert.equal(compatibility.services[0].durationMinutes, 90);
  assert.deepEqual(compatibility.services[0].priceGuide, document);
  assert.equal(compatibility.services.some((service) => service.durationMinutes === 60), false);
  assert.deepEqual(compatibility.storageValidation, validatePriceGuideV2StorageCompatibility(document));
  assert.equal(compatibility.storageValidation.complete, false);
  assert.deepEqual(compatibility.storageValidation.issues, [
    { rowIndex: 1, code: "DURATION_REQUIRED" },
    { rowIndex: 2, code: "PRICE_REQUIRED" },
  ]);
});

test("storage compatibility keeps every canonical row when legacy values are duplicates", () => {
  const source = v2Document();
  const document = {
    ...source,
    rows: [source.rows[0], source.rows[0]],
    aiReview: [],
  };

  const compatibility = buildPriceGuideV2Compatibility(document);
  assert.equal(compatibility.storageValidation.complete, true);
  assert.equal(compatibility.storageValidation.mappedRowCount, 2);
  assert.deepEqual(compatibility.services.map((service) => service.id), ["photo-1", "photo-2"]);
  assert.equal(normalizeSignupServicePrices(compatibility.services).length, 2);
  assert.deepEqual(compatibility.services[0].priceGuide, document);
  assert.deepEqual(compatibility.services[1].priceGuide, document);
});

test("manual PriceGuideV2 validates and maps without inventing price or duration", () => {
  const document = {
    schemaVersion: 2,
    source: "manual",
    overallNote: "가격과 시간은 상담 후 확정합니다.",
    rows: [{
      serviceName: "특수견 상담 미용",
      species: "dog",
      breedNames: ["코몬도르"],
      breedGroup: "특수견",
      sizeClass: "unknown",
      minKg: null,
      maxKg: null,
      priceKind: "unknown",
      priceMinKrw: null,
      priceMaxKrw: null,
      durationMinutes: null,
      note: "피모 상태를 보고 안내",
    }],
    surcharges: [{ condition: "심한 엉킴", amountKrw: null, percent: null, note: "현장 상담" }],
    aiReview: [],
  };

  const parsed = parsePriceGuideResponsesPayload(createPriceGuideResponsesFixture(document));
  const compatibility = buildPriceGuideV2Compatibility(parsed);
  const cell = compatibility.guide.sections[0].items[0].cells["fixture-band-1"];
  assert.equal(parsed.source, document.source);
  assert.equal(parsed.overallNote, document.overallNote);
  assert.deepEqual(parsed.rows[0], { ...document.rows[0], weightBandLabel: "fixture-band-1" });
  assert.deepEqual(parsed.surcharges, document.surcharges);
  assert.equal(cell.price, "");
  assert.equal(cell.durationMinutes, "");
  assert.equal(compatibility.guide.extraNote, document.overallNote);
  assert.equal(compatibility.guide.sections[0].note, "코몬도르 · 피모 상태를 보고 안내");
  assert.deepEqual(parsed.surcharges, document.surcharges);
  assert.deepEqual(compatibility.services, []);
  assert.deepEqual(buildSignupServicePriceGuide({
    id: "manual-storage",
    name: "직접 입력 보관",
    detailName: "",
    price: 0,
    durationMinutes: 5,
    species: "dog",
    breedGroup: "",
    weightBand: "",
    priceGuide: parsed,
  }), parsed);
});

test("storage mapper preserves the complete V2 JSON while legacy rows remain readable", () => {
  const document = v2Document();
  const compatibility = buildPriceGuideV2Compatibility(document);
  for (const service of compatibility.services) {
    assert.deepEqual(service.priceGuide, document);
    assert.deepEqual(buildSignupServicePriceGuide(service), document);
  }
  assert.equal(normalizeSignupServicePrices(compatibility.services).length, compatibility.services.length);
  assert.equal(compatibility.services[2].priceGuide.rows[2].priceKind, "range");
  assert.equal(compatibility.services[2].priceGuide.rows[2].priceMinKrw, 80_000);
  assert.equal(compatibility.services[2].priceGuide.rows[2].priceMaxKrw, 120_000);
  assert.deepEqual(compatibility.services[2].priceGuide.surcharges, document.surcharges);
  assert.deepEqual(compatibility.services[2].priceGuide.aiReview, document.aiReview);

  const legacyService = {
    id: "legacy-1",
    name: "기존 목욕",
    detailName: "기존 메모",
    price: 40_000,
    durationMinutes: 50,
    species: "dog",
    breedGroup: "기존 소형견",
    weightBand: "5kg 이하",
  };
  const legacyDocument = buildPriceGuideV2FromLegacySignupServices([legacyService]);
  assert.equal(legacyDocument.schemaVersion, 2);
  assert.equal(legacyDocument.source, "legacy");
  assert.equal(buildSignupServicePriceGuide(legacyService).source, "manual");
  assert.equal(legacyDocument.rows[0].priceMinKrw, 40_000);
  assert.equal(legacyDocument.rows[0].minKg, null);
  assert.equal(legacyDocument.rows[0].maxKg, null);
  assert.deepEqual(readPriceGuideV2({ enabled: true }, legacyService), legacyDocument);
});

test("initial setup hands the selected price-guide entry mode to the service screen once", () => {
  const values = new Map();
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key) => values.get(key) ?? null,
        removeItem: (key) => values.delete(key),
        setItem: (key, value) => values.set(key, value),
      },
    },
  });

  try {
    setPreferredPriceGuideOnboardingMode("shop-onboarding", "photo");
    assert.equal(consumePreferredPriceGuideOnboardingMode("shop-onboarding"), "photo");
    assert.equal(consumePreferredPriceGuideOnboardingMode("shop-onboarding"), null);

    setPreferredPriceGuideOnboardingMode("shop-onboarding", "manual");
    assert.equal(consumePreferredPriceGuideOnboardingMode("shop-onboarding"), "manual");
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  }
});
