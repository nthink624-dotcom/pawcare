import assert from "node:assert/strict";
import test from "node:test";

const { parsePriceGuideRoughInput } = await import("../../src/lib/price-guide-rough-input.ts");
const { priceGuideV2Schema } = await import("../../src/types/price-guide-photo-import.ts");

test("one-line Korean memo creates one editable row without inventing classifications", () => {
  const result = parsePriceGuideRoughInput("전체미용 5만원 1시간");
  const [row] = result.document.rows;

  assert.equal(priceGuideV2Schema.safeParse(result.document).success, true);
  assert.equal(result.document.source, "manual");
  assert.equal(result.document.rows.length, 1);
  assert.equal(row.serviceName, "전체미용");
  assert.equal(row.priceKind, "fixed");
  assert.equal(row.priceMinKrw, 50_000);
  assert.equal(row.priceMaxKrw, null);
  assert.equal(row.durationMinutes, 60);
  assert.equal(row.species, "unknown");
  assert.equal(row.sizeClass, "unknown");
  assert.equal(row.minKg, null);
  assert.equal(row.maxKg, null);
  assert.deepEqual(row.breedNames, []);
  assert.equal(row.breedGroup, null);
  assert.equal(row.note, null);
  assert.deepEqual(result.document.surcharges, []);
  assert.deepEqual(result.document.aiReview, []);
  assert.deepEqual(result.missingFields, ["species", "sizeClass"]);
});

test("explicit animal, size, kg, price range, and duration are preserved exactly", () => {
  const result = parsePriceGuideRoughInput("강아지 소형견 3~5kg 목욕 5~7만원 1시간 30분");
  const [row] = result.document.rows;

  assert.equal(row.serviceName, "목욕");
  assert.equal(row.species, "dog");
  assert.equal(row.sizeClass, "small");
  assert.equal(row.minKg, 3);
  assert.equal(row.maxKg, 5);
  assert.equal(row.priceKind, "range");
  assert.equal(row.priceMinKrw, 50_000);
  assert.equal(row.priceMaxKrw, 70_000);
  assert.equal(row.durationMinutes, 90);
  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(result.recognizedFields, ["serviceName", "species", "sizeClass", "weight", "durationMinutes", "price"]);
});

test("starting price is accepted only when the memo says it is a starting price", () => {
  const result = parsePriceGuideRoughInput("고양이 발톱 정리 3만원부터 30분");
  const [row] = result.document.rows;

  assert.equal(row.serviceName, "발톱 정리");
  assert.equal(row.species, "cat");
  assert.equal(row.sizeClass, "unknown");
  assert.equal(row.priceKind, "starting");
  assert.equal(row.priceMinKrw, 30_000);
  assert.equal(row.priceMaxKrw, null);
  assert.equal(row.durationMinutes, 30);
  assert.deepEqual(result.missingFields, ["sizeClass"]);
});

test("ambiguous ranges and out-of-contract values stay unresolved", () => {
  const incomplete = parsePriceGuideRoughInput("전체미용 5만원~ 1~2시간");
  assert.equal(incomplete.document.rows[0].serviceName, "전체미용");
  assert.equal(incomplete.document.rows[0].priceKind, "unknown");
  assert.equal(incomplete.document.rows[0].priceMinKrw, null);
  assert.equal(incomplete.document.rows[0].durationMinutes, null);
  assert.ok(incomplete.missingFields.includes("price"));
  assert.ok(incomplete.missingFields.includes("durationMinutes"));

  const incompleteWords = parsePriceGuideRoughInput("전체미용 가격 범위 5만원 1시간~");
  assert.equal(incompleteWords.document.rows[0].serviceName, "전체미용");
  assert.equal(incompleteWords.document.rows[0].priceKind, "unknown");
  assert.equal(incompleteWords.document.rows[0].durationMinutes, null);

  const overflow = parsePriceGuideRoughInput("전체미용 100000001원 2000분");
  assert.equal(overflow.document.rows[0].priceKind, "unknown");
  assert.equal(overflow.document.rows[0].priceMinKrw, null);
  assert.equal(overflow.document.rows[0].durationMinutes, null);
  assert.equal(priceGuideV2Schema.safeParse(overflow.document).success, true);
});

test("breed words and kg values never infer animal or size", () => {
  const result = parsePriceGuideRoughInput("말티즈 미용 5kg 5만원 1시간");
  const [row] = result.document.rows;

  assert.equal(row.serviceName, "말티즈 미용");
  assert.equal(row.species, "unknown");
  assert.equal(row.sizeClass, "unknown");
  assert.equal(row.minKg, 5);
  assert.equal(row.maxKg, 5);
  assert.deepEqual(row.breedNames, []);
});
