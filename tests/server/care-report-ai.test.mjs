import assert from "node:assert/strict";
import test from "node:test";

import {
  assertObservationOnlyCareReport,
  buildCareReportPrompt,
  estimateDeepSeekV4FlashCostUsd,
  hashCareReportInput,
  normalizeCareReportUsage,
} from "../../src/server/care-report-ai.ts";
import { careReportGenerationInputSchema } from "../../src/types/care-report.ts";

const context = {
  petName: "두부",
  petBreed: "말티즈",
  serviceName: "전체미용",
  observations: {
    coat: ["귀 뒤쪽 엉킴"],
    skin: ["배 쪽이 예민해 보임"],
    ears: [],
    pawsAndNails: ["발톱 정리 완료"],
    groomingResponse: ["얼굴 드라이 때 잠시 긴장"],
    customNote: "",
  },
  voiceTranscript: "오늘은 전체적으로 편안하게 미용했어요.",
};

test("builds an observation-only prompt without exposing a medical diagnosis instruction", () => {
  const prompt = buildCareReportPrompt(context);
  assert.match(prompt.system, /의료 진단/);
  assert.match(prompt.system, /입력에 없는 사실을 만들지 마세요/);
  assert.match(prompt.user, /두부/);
  assert.match(prompt.user, /귀 뒤쪽 엉킴/);
});

test("hashes identical AI inputs deterministically", () => {
  const first = hashCareReportInput("deepseek-v4-flash", context);
  const second = hashCareReportInput("deepseek-v4-flash", context);
  assert.equal(first, second);
  assert.equal(first.length, 64);
});

test("normalizes DeepSeek usage and estimates sub-won V4 Flash cost", () => {
  const usage = normalizeCareReportUsage({
    prompt_tokens: 1500,
    completion_tokens: 350,
    total_tokens: 1850,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 1500,
  });
  assert.deepEqual(usage, {
    promptTokens: 1500,
    completionTokens: 350,
    totalTokens: 1850,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: 1500,
  });
  assert.ok(Math.abs(estimateDeepSeekV4FlashCostUsd(usage) - 0.000308) < 1e-12);
});

test("blocks AI copy that states a medical diagnosis", () => {
  assert.throws(
    () =>
      assertObservationOnlyCareReport({
        oneLineSummary: "오늘 미용을 마쳤어요.",
        treatmentSummary: "전체미용을 진행했어요.",
        conditionSummary: "피부병입니다.",
        groomingResponse: "차분했어요.",
        homeCareTips: ["가볍게 빗질해 주세요."],
        nextVisitGuide: "다음 관리 시점을 확인해 주세요.",
      }),
    /의료 진단/,
  );
});

test("accepts durable seeded appointment ids used by the owner demo", () => {
  const parsed = careReportGenerationInputSchema.parse({
    shopId: "shop-950db4fa",
    appointmentId: "mongshop-appointment-today-1",
    observations: context.observations,
    voiceTranscript: "",
    photoConsent: false,
  });

  assert.equal(parsed.appointmentId, "mongshop-appointment-today-1");
});
