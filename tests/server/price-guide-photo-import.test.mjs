import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
  PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA,
  PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD,
  PRICE_GUIDE_VISION_MODEL,
  redactPriceGuideRawTextForStorage,
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

test("Responses fixture uses the production strict parser and preserves full V2 detail", async () => {
  const expected = v2Document();
  let capturedBody = null;
  const result = await extractPriceGuideFromImages(["data:image/jpeg;base64,fixture"], {
    responsesClient: async ({ body }) => {
      capturedBody = body;
      return createPriceGuideResponsesFixture(expected);
    },
  });

  assert.deepEqual(result.document, { ...expected, source: "ai_imported" });
  assert.equal(capturedBody.store, false);
  assert.equal(capturedBody.text.format.strict, true);
  assert.equal(capturedBody.text.format.schema, PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA);
  assert.equal(capturedBody.input[0].content[1].detail, "original");
  assert.deepEqual(result.document.rows.map((row) => row.sizeClass), ["small", "medium", "large", "extra-large", "all", "unknown"]);
  assert.deepEqual(result.document.rows[0].breedNames, ["말티즈", "푸들"]);
  assert.equal(result.document.overallNote, "전체 메모를 빠뜨리지 않습니다.");
  assert.equal(result.document.rows[0].note, "행 메모");
  assert.deepEqual(result.document.surcharges.map((fee) => [fee.amountKrw, fee.percent]), [[5_000, null], [null, 10]]);
  assert.deepEqual(result.document.aiReview.map((review) => review.confidence), ["low", "medium"]);
});

test("AI/fixture imports and owner review actions keep explicit source provenance", async () => {
  const fixture = v2Document();
  const imported = (await extractPriceGuideFromImages(["data:image/jpeg;base64,fixture"], {
    responsesClient: async () => createPriceGuideResponsesFixture(fixture),
  })).document;
  assert.equal(imported.source, "ai_imported");

  const partlyConfirmed = resolvePriceGuideV2Reviews(
    imported,
    (review) => review.targetId === "rows:3",
    "confirmed",
  );
  assert.equal(partlyConfirmed.source, "ai_imported");
  const fullyConfirmed = resolvePriceGuideV2Reviews(
    partlyConfirmed,
    (review) => review.targetId === "rows:5",
    "confirmed",
  );
  assert.equal(fullyConfirmed.source, "owner_confirmed");

  const corrected = resolvePriceGuideV2Reviews(
    imported,
    (review) => review.targetId === "rows:3",
    "corrected",
  );
  assert.equal(corrected.source, "owner_corrected");
  assert.equal(corrected.aiReview[0].userCorrected, true);
  assert.equal(corrected.aiReview[0].userConfirmed, false);

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
  const cell = compatibility.guide.sections[0].items[0].cells[""];
  assert.deepEqual(parsed, document);
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
  }), document);
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
