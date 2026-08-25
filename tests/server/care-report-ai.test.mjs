import assert from "node:assert/strict";
import test from "node:test";

import {
  assertObservationOnlyCareReport,
  assertGroundedWeightGuidance,
  buildCareReportPrompt,
  estimateDeepSeekV4FlashCostUsd,
  hashCareReportInput,
  normalizeCareReportUsage,
} from "../../src/server/care-report-ai.ts";
import { finalizeCareReportDraft } from "../../src/lib/care-report-draft.ts";
import { careReportDraftSchema, careReportGenerationInputSchema } from "../../src/types/care-report.ts";

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
  assert.match(prompt.system, /의미 없는 자모 반복/);
  assert.match(prompt.system, /품종 평균으로 표현하지 마세요/);
  assert.match(prompt.system, /정상·과체중·저체중 또는 감량 필요를 판단하지 마세요/);
  assert.match(prompt.system, /핵심 2~3문장/);
  assert.match(prompt.system, /빈 문자열 또는 빈 배열/);
  assert.doesNotMatch(prompt.system, /없으면 별도 상태 기록이 없다고 작성/);
  assert.match(prompt.user, /두부/);
  assert.match(prompt.user, /귀 뒤쪽 엉킴/);
  assert.match(prompt.user, /actualDurationMinutes/);
  assert.match(prompt.user, /recentAverageWeightKg/);
  assert.match(prompt.user, /오늘은 전체적으로 편안하게 미용했어요/);
});

test("allows a 400-character owner-edited core summary and rejects longer copy", () => {
  const baseDraft = {
    oneLineSummary: "가".repeat(400),
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
  };

  assert.equal(careReportDraftSchema.parse(baseDraft).oneLineSummary.length, 400);
  assert.equal(careReportDraftSchema.safeParse({ ...baseDraft, oneLineSummary: "가".repeat(401) }).success, false);
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

test("blocks weight judgments that the owner did not provide", () => {
  assert.throws(
    () => assertGroundedWeightGuidance({
      oneLineSummary: "두부는 과체중이라 체중 감량이 필요해요.",
      treatmentSummary: "전체미용을 진행했어요.",
      conditionSummary: "",
      groomingResponse: "",
      homeCareTips: [],
      nextVisitGuide: "",
    }, context),
    /입력하지 않은 체중 판단/,
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

test("accepts a one-decimal current weight measurement for the report context", () => {
  const parsed = careReportGenerationInputSchema.parse({
    shopId: "shop-950db4fa",
    appointmentId: "mongshop-appointment-today-1",
    observations: context.observations,
    voiceTranscript: "",
    photoConsent: false,
    currentWeightKg: 4.6,
  });

  assert.equal(parsed.currentWeightKg, 4.6);
  assert.throws(() => careReportGenerationInputSchema.parse({
    shopId: "shop-950db4fa",
    appointmentId: "mongshop-appointment-today-1",
    observations: context.observations,
    voiceTranscript: "",
    photoConsent: false,
    currentWeightKg: 0,
  }));
});

test("accepts backward-compatible empty optional detail fields", () => {
  const parsed = careReportDraftSchema.parse({
    oneLineSummary: "두부가 오늘 전체미용을 마쳤어요.",
    treatmentSummary: "전체미용을 진행했어요.",
  });

  assert.equal(parsed.conditionSummary, "");
  assert.equal(parsed.groomingResponse, "");
  assert.deepEqual(parsed.homeCareTips, []);
  assert.equal(parsed.nextVisitGuide, "");
});

test("uses only verified service facts when the owner leaves no care input", () => {
  const draft = finalizeCareReportDraft({
    oneLineSummary: "두부가 편안하고 즐겁게 미용을 받았어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "별도 상태 기록은 없어요.",
    groomingResponse: "차분하게 잘 받았어요.",
    homeCareTips: ["별도 홈케어 안내는 없어요."],
    nextVisitGuide: "다음 방문일은 정해지지 않았어요.",
  }, {
    petName: "두부",
    serviceName: "전체미용",
    actualDurationMinutes: 125,
    nextRecommendedVisitDate: null,
    ownerSourceText: "",
    observations: {
      coat: [], skin: [], ears: [], pawsAndNails: [], groomingResponse: [], customNote: "",
    },
  });

  assert.equal(draft.oneLineSummary, "두부가 오늘 전체미용을 마쳤어요.");
  assert.equal(draft.treatmentSummary, "전체미용을 진행했고, 총 작업 시간은 2시간 5분이었어요.");
  assert.equal(draft.conditionSummary, "");
  assert.equal(draft.groomingResponse, "");
  assert.deepEqual(draft.homeCareTips, []);
  assert.equal(draft.nextVisitGuide, "");
});

test("keeps evidence-backed tears, shampoo, ear sensitivity, reaction, and home-care details", () => {
  const ownerSourceText = "눈물이 많아 눈가를 닦고 저자극 샴푸로 세정했어요. 귀는 조금 예민했어요. 얼굴 드라이 때 잠시 긴장했어요. 집에서는 눈가를 부드럽게 닦아 주세요.";
  const draft = finalizeCareReportDraft({
    oneLineSummary: ownerSourceText,
    treatmentSummary: "임의 문장",
    conditionSummary: "눈물이 많았고 귀가 조금 예민했어요.",
    groomingResponse: "얼굴 드라이 때 잠시 긴장했어요.",
    homeCareTips: ["집에서는 눈가를 부드럽게 닦아 주세요."],
    nextVisitGuide: "임의 날짜",
  }, {
    petName: "두부",
    serviceName: "전체미용",
    actualDurationMinutes: 125,
    nextRecommendedVisitDate: "2026-09-23",
    ownerSourceText,
    observations: context.observations,
  });

  assert.match(draft.oneLineSummary, /눈물/);
  assert.match(draft.oneLineSummary, /저자극 샴푸/);
  assert.match(draft.conditionSummary, /귀/);
  assert.match(draft.groomingResponse, /긴장/);
  assert.deepEqual(draft.homeCareTips, ["집에서는 눈가를 부드럽게 닦아 주세요."]);
  assert.equal(draft.nextVisitGuide, "2026-09-23 전후로 다음 관리를 권장해요.");
});

test("removes keyboard jamo noise from the generated core summary", () => {
  const draft = finalizeCareReportDraft({
    oneLineSummary: "ㄴㅇㄹㄴㅇㄹ 두부는 오늘 눈가를 부드럽게 닦았어요.",
    treatmentSummary: "전체미용",
    conditionSummary: "눈물이 많았어요.",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
  }, {
    petName: "두부",
    serviceName: "전체미용",
    actualDurationMinutes: 120,
    nextRecommendedVisitDate: null,
    ownerSourceText: "눈물이 많아 눈가를 닦았어요.",
    observations: { ...context.observations, groomingResponse: [] },
  });

  assert.doesNotMatch(draft.oneLineSummary, /[ㄱ-ㅎㅏ-ㅣ]/);
});

test("preserves unaffected existing detail fields during a tone-only revision", () => {
  const currentDraft = {
    oneLineSummary: "두부는 오늘 눈가를 부드럽게 세정했어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "눈물이 많아 눈가를 세정했어요.",
    groomingResponse: "얼굴 드라이 때 잠시 긴장했어요.",
    homeCareTips: ["눈가를 부드럽게 닦아 주세요."],
    nextVisitGuide: "2026-09-23 전후로 다음 관리를 권장해요.",
  };
  const draft = finalizeCareReportDraft({
    oneLineSummary: "두부는 오늘 눈가를 정성스럽게 세정했어요.",
    treatmentSummary: "",
    conditionSummary: "",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
  }, {
    petName: "두부",
    serviceName: "전체미용",
    actualDurationMinutes: 125,
    nextRecommendedVisitDate: "2026-09-23",
    ownerSourceText: "말투만 조금 더 부드럽게 바꿔줘.",
    observations: { coat: [], skin: [], ears: [], pawsAndNails: [], groomingResponse: [], customNote: "" },
    currentDraft,
  });

  assert.equal(draft.conditionSummary, currentDraft.conditionSummary);
  assert.equal(draft.groomingResponse, currentDraft.groomingResponse);
  assert.deepEqual(draft.homeCareTips, currentDraft.homeCareTips);
  assert.equal(draft.treatmentSummary, "전체미용을 진행했고, 총 작업 시간은 2시간 5분이었어요.");
});
