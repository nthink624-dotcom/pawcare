import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePriceGuideProviderCostMicroUsd,
  normalizePriceGuidePhotoExtraction,
  PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD,
} from "../../src/server/price-guide-photo-import.ts";
import {
  consumePreferredPriceGuideOnboardingMode,
  setPreferredPriceGuideOnboardingMode,
} from "../../src/lib/price-guide-onboarding.ts";

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
    calculatePriceGuideProviderCostMicroUsd("gpt-4o-mini", { inputTokens: 10_000, outputTokens: 2_000 }),
    2_700,
  );
  assert.equal(
    calculatePriceGuideProviderCostMicroUsd("gpt-4o-mini", null),
    PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD,
  );
  assert.equal(
    calculatePriceGuideProviderCostMicroUsd("unpriced-vision-model", { inputTokens: 1, outputTokens: 1 }),
    PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD,
  );
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
