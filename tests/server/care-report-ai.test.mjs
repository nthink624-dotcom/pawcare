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
  automaticFacts: {
    actualDurationMinutes: 125,
    expectedDurationMinutes: 120,
    currentWeightKg: 4.6,
    previousWeightKg: 4.5,
    weightChangeFromPreviousKg: 0.1,
    recentAverageWeightKg: 4.4,
    weightDifferenceFromRecentAverageKg: 0.2,
    weightSampleCount: 6,
    nextRecommendedVisitDate: "2026-09-23",
  },
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
  assert.match(prompt.system, /오너 입력은 유일한 사람 판단 근거/);
  assert.match(prompt.system, /품종 평균으로 표현하지 마세요/);
  assert.match(prompt.system, /정상·과체중·저체중 또는 감량 필요를 판단하지 마세요/);
  assert.match(prompt.user, /두부/);
  assert.match(prompt.user, /귀 뒤쪽 엉킴/);
  assert.match(prompt.user, /actualDurationMinutes/);
  assert.match(prompt.user, /recentAverageWeightKg/);
  assert.match(prompt.user, /오늘은 전체적으로 편안하게 미용했어요/);
});

test("keeps the current edited draft as context for an iterative owner request", () => {
  const currentDraft = {
    oneLineSummary: "두부는 오늘 눈가를 부드럽게 세정했어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "눈물이 많아 눈가를 세정했어요.",
    groomingResponse: "얼굴 드라이 때 잠시 긴장했어요.",
    homeCareTips: ["눈가를 부드럽게 닦아 주세요."],
    nextVisitGuide: "9월 23일 전후 관리를 권장해요.",
  };
  const prompt = buildCareReportPrompt({
    ...context,
    voiceTranscript: "말투만 조금 더 부드럽게 바꿔줘.",
    currentDraft,
  });

  assert.match(prompt.system, /최신 오너 요청에 필요한 부분만 수정/);
  assert.match(prompt.system, /기존 내용을 임의로 빼거나/);
  assert.match(prompt.user, /두부는 오늘 눈가를 부드럽게 세정했어요/);
  assert.match(prompt.user, /말투만 조금 더 부드럽게 바꿔줘/);
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

test("accepts the current care report draft for iterative generation", () => {
  const parsed = careReportGenerationInputSchema.parse({
    shopId: "shop-950db4fa",
    appointmentId: "mongshop-appointment-today-1",
    observations: context.observations,
    voiceTranscript: "기존 내용은 유지하고 말투만 다듬어줘.",
    currentDraft: {
      oneLineSummary: "두부가 오늘 전체미용을 마쳤어요.",
      treatmentSummary: "전체미용을 진행했어요.",
      conditionSummary: "귀 뒤쪽 엉킴을 확인했어요.",
      groomingResponse: "얼굴 드라이 때 잠시 긴장했어요.",
      homeCareTips: ["귀 뒤쪽을 가볍게 빗질해 주세요."],
      nextVisitGuide: "9월 23일 전후 관리를 권장해요.",
    },
    photoConsent: false,
  });

  assert.equal(parsed.currentDraft?.conditionSummary, "귀 뒤쪽 엉킴을 확인했어요.");
});
