import assert from "node:assert/strict";
import test from "node:test";

import {
  CARE_REPORT_PROVIDER_MAX_OUTPUT_TOKENS,
  CARE_REPORT_PROVIDER_SCHEMA_MAX_COMPACT_CHARACTERS,
  CareReportGenerationError,
  CareReportSafetyValidationError,
  assertObservationOnlyCareReport,
  assertCareReportDraftPiiFree,
  assertGroundedWeightGuidance,
  assertSourceFactProvenance,
  buildCareReportProviderRequestBody,
  buildCareReportPrompt,
  estimateDeepSeekV4FlashCostUsd,
  hashCareReportInput,
  normalizeCareReportUsage,
  normalizeCareReportSafetyError,
  parseAndValidateCareReportProviderOutput,
  toSafeCareReportGenerationHttpResponse,
  toSafeCareReportSafetyDiagnostic,
  toSafeCareReportSafetyHttpResponse,
} from "../../src/server/care-report-ai.ts";
import {
  CARE_REPORT_GENERATION_RETRY_MESSAGE,
  buildPreviewCareReportDraft,
  createCareReportSourceFacts,
  finalizeCareReportDraft,
  hasCareReportExactSourceEcho,
  hasCareReportPiiResidual,
  isCareReportDraftUnchanged,
  prepareCareReportSourceText,
  scrubCareReportSourceText,
  serializeCareReportSavePayload,
} from "../../src/lib/care-report-draft.ts";
import { decideCareReportSaveReplay, hashCareReportSavePayload } from "../../src/server/care-report-save-identity.ts";
import {
  careReportDraftSchema,
  careReportGeneratedResponseSchema,
  careReportGenerationInputSchema,
} from "../../src/types/care-report.ts";

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
    sourceFacts: [{ id: "fact-note", category: "general", text: "귀가 조금 예민했어요.", source: "note" }],
  },
  voiceTranscript: "오늘은 전체적으로 편안하게 미용했어요.",
};

function expectSafetyRule(callback, ruleCode) {
  assert.throws(callback, (error) => error instanceof CareReportSafetyValidationError && error.ruleCode === ruleCode);
}

test("returns only allowlisted safety rule codes through the client-safe diagnostic boundary", () => {
  const fallback = normalizeCareReportSafetyError(new Error("provider raw text must never escape"));
  assert.deepEqual(toSafeCareReportSafetyDiagnostic(fallback), {
    message: "AI 초안이 안전 기준을 통과하지 못했습니다. 관찰 메모를 확인한 뒤 다시 작성해 주세요.",
    safetyRuleCode: "safety_validation_rejected",
  });
  assert.doesNotMatch(JSON.stringify(toSafeCareReportSafetyDiagnostic(fallback)), /provider raw text/);
});

test("normalizes provider and network failures to one retry message without raw details", () => {
  const rawMarker = "RAW_PROVIDER_NETWORK_FAILURE_MUST_NOT_ESCAPE";
  const response = toSafeCareReportGenerationHttpResponse(
    Object.assign(new CareReportGenerationError(), { cause: new Error(rawMarker) }),
  );

  assert.deepEqual(response, {
    status: 502,
    body: { message: CARE_REPORT_GENERATION_RETRY_MESSAGE },
  });
  assert.doesNotMatch(JSON.stringify(response), new RegExp(rawMarker));
});

test("classifies deterministic malformed provider branches without exposing rejected content", () => {
  const rawMarker = "RAW_PROVIDER_MARKER_MUST_NOT_ESCAPE";
  const cases = [
    [{ choices: [] }, "envelope_validation_rejected"],
    [{ choices: [{}] }, "envelope_validation_rejected"],
    [{ choices: [{ message: { content: null } }] }, "content_type_validation_rejected"],
    [{ choices: [{ finish_reason: "length", message: { content: rawMarker } }] }, "truncated_output_validation_rejected"],
    [{ choices: [{ message: { content: `\{\"oneLineSummary\":\"${rawMarker}\"` } }] }, "structure_validation_rejected"],
    [{ choices: [{ message: { content: `\`\`\`json\n{\"oneLineSummary\":\"${rawMarker}\"}\n\`\`\`` } }] }, "structure_validation_rejected"],
    [{ choices: [{ message: { content: JSON.stringify([]) } }] }, "structure_validation_rejected"],
    [{ choices: [{ message: { content: JSON.stringify(JSON.stringify(JSON.stringify({ oneLineSummary: rawMarker }))) } }] }, "structure_validation_rejected"],
    [{ choices: [{ message: { content: JSON.stringify({ oneLineSummary: { raw: rawMarker } }) } }] }, "section_validation_rejected"],
    [{ choices: [{ message: { content: JSON.stringify({
      oneLineSummary: "목욕을 마쳤어요.",
      treatmentSummary: "전체미용을 진행했어요.",
      sourceFactIds: "fact-note",
    }) } }] }, "citation_validation_rejected"],
    [{ choices: [{ message: { content: JSON.stringify({
      oneLineSummary: "목욕을 마쳤어요.",
      treatmentSummary: "전체미용을 진행했어요.",
      sourceFactIds: [],
      sourceFactCitations: [],
      rejectedDetail: rawMarker,
    }) } }] }, "unexpected_field_validation_rejected"],
    [{ choices: [{ message: { content: JSON.stringify({
      oneLineSummary: "목욕을 마쳤어요.",
      treatmentSummary: "전체미용을 진행했어요.",
      sourceFactIds: ["fact-note"],
      sourceFactCitations: [{
        field: "oneLineSummary",
        sentence: "목욕을 마쳤어요.",
        sourceFactIds: ["fact-note"],
        rejectedDetail: rawMarker,
      }],
    }) } }] }, "unexpected_field_validation_rejected"],
  ];

  for (const [providerOutput, expectedRuleCode] of cases) {
    let caught;
    try {
      parseAndValidateCareReportProviderOutput(providerOutput, context);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof CareReportSafetyValidationError);
    assert.equal(caught.ruleCode, expectedRuleCode);
    assert.deepEqual(toSafeCareReportSafetyHttpResponse(caught), {
      status: 422,
      body: {
        message: "AI 초안이 안전 기준을 통과하지 못했습니다. 관찰 메모를 확인한 뒤 다시 작성해 주세요.",
        safetyRuleCode: expectedRuleCode,
      },
    });
    assert.doesNotMatch(JSON.stringify(toSafeCareReportSafetyHttpResponse(caught)), new RegExp(rawMarker));
  }
});

test("accepts the documented envelope and at most one nested JSON string", () => {
  const validContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [{ id: "fact-note", category: "general", text: "목욕 잘 했고 괜찮았습니다.", source: "note" }],
    },
    voiceTranscript: "목욕 잘 했고 괜찮았습니다.",
  };
  const generatedContent = {
    oneLineSummary: "목욕을 잘 마쳤으며, 전반적인 상태도 양호했습니다.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
    sourceFactIds: ["fact-note"],
    sourceFactCitations: [{
      field: "oneLineSummary",
      sentence: "목욕을 잘 마쳤으며, 전반적인 상태도 양호했습니다.",
      sourceFactIds: ["fact-note"],
    }],
  };

  for (const content of [JSON.stringify(generatedContent), JSON.stringify(JSON.stringify(generatedContent))]) {
    const result = parseAndValidateCareReportProviderOutput({
      choices: [{ finish_reason: "stop", message: { content } }],
    }, validContext);
    assert.equal(result.draft.oneLineSummary, generatedContent.oneLineSummary);
    assert.equal(result.sourceFactCitations.length, 1);
  }
});

test("keeps truly unknown provider access failures on the coarse safety rule", () => {
  const rawMarker = "RAW_UNKNOWN_PROVIDER_ACCESS_MUST_NOT_ESCAPE";
  const providerOutput = Object.defineProperty({}, "choices", {
    get() {
      throw new Error(rawMarker);
    },
  });

  let caught;
  try {
    parseAndValidateCareReportProviderOutput(providerOutput, context);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof CareReportSafetyValidationError);
  assert.equal(caught.ruleCode, "safety_validation_rejected");
  assert.doesNotMatch(JSON.stringify(toSafeCareReportSafetyHttpResponse(caught)), new RegExp(rawMarker));
});

test("accepts a valid structured provider fixture through the complete safety boundary", () => {
  const validContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [{ id: "fact-note", category: "general", text: "목욕 잘 했고 괜찮았습니다.", source: "note" }],
    },
    voiceTranscript: "목욕 잘 했고 괜찮았습니다.",
  };
  const providerOutput = {
    choices: [{
      message: {
        content: JSON.stringify({
          oneLineSummary: "목욕을 잘 마쳤으며, 전반적인 상태도 양호했습니다.",
          treatmentSummary: "전체미용을 진행했어요.",
          conditionSummary: "",
          groomingResponse: "",
          homeCareTips: [],
          nextVisitGuide: "",
          sourceFactIds: ["fact-note"],
          sourceFactCitations: [
            {
              field: "oneLineSummary",
              sentence: "목욕을 잘 마쳤으며, 전반적인 상태도 양호했습니다.",
              sourceFactIds: ["fact-note"],
            },
          ],
        }),
      },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };

  const result = parseAndValidateCareReportProviderOutput(providerOutput, validContext);
  assert.equal(result.draft.oneLineSummary, "목욕을 잘 마쳤으며, 전반적인 상태도 양호했습니다.");
  assert.equal(result.sourceFactCitations.length, 1);
  assert.equal(result.usage.totalTokens, 30);
});

test("accepts cited benign nail and skin condition rewrites without weakening safety", () => {
  const cases = [
    {
      source: "발톱상태 좋다 피부상태 좋다",
      generated: "발톱과 피부 상태가 모두 좋았습니다.",
    },
    {
      source: "피부 상태 좋다",
      generated: "피부 상태가 좋았습니다.",
    },
    {
      source: "발톱 상태가 좋고 피부 상태도 좋다",
      generated: "발톱 상태와 피부 상태가 모두 양호했습니다.",
    },
  ];

  for (const [index, fixture] of cases.entries()) {
    const factId = `fact-benign-${index}`;
    const benignContext = {
      ...context,
      observations: {
        ...context.observations,
        sourceFacts: [{ id: factId, category: "general", text: fixture.source, source: "note" }],
      },
      voiceTranscript: fixture.source,
    };
    const providerOutput = {
      choices: [{
        message: {
          content: JSON.stringify({
            oneLineSummary: fixture.generated,
            treatmentSummary: "전체미용을 진행했어요.",
            conditionSummary: "",
            groomingResponse: "",
            homeCareTips: [],
            nextVisitGuide: "",
            sourceFactIds: [factId],
            sourceFactCitations: [
              { field: "oneLineSummary", sentence: fixture.generated, sourceFactIds: [factId] },
            ],
          }),
        },
      }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };

    const result = parseAndValidateCareReportProviderOutput(providerOutput, benignContext);
    assert.equal(result.draft.oneLineSummary, fixture.generated);
  }
});

test("keeps diagnosis, treatment, medication, PII, and malformed output fail-closed", () => {
  for (const unsafeCondition of ["피부병입니다.", "피부 치료가 필요합니다.", "피부에 약을 바르세요."]) {
    expectSafetyRule(() => assertObservationOnlyCareReport({
      oneLineSummary: "미용을 마쳤어요.",
      treatmentSummary: "전체미용을 진행했어요.",
      conditionSummary: unsafeCondition,
      groomingResponse: "",
      homeCareTips: [],
      nextVisitGuide: "",
    }), "medical_validation_rejected");
  }

  expectSafetyRule(() => assertCareReportDraftPiiFree({
    oneLineSummary: "010-1234-5678로 연락해 주세요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
  }), "pii_validation_rejected");
  expectSafetyRule(
    () => parseAndValidateCareReportProviderOutput({ choices: [{ message: { content: "{" } }] }, context),
    "structure_validation_rejected",
  );
});

test("builds a source-fact-only prompt without exposing pet identity or medical diagnosis", () => {
  const prompt = buildCareReportPrompt(context);
  assert.match(prompt.system, /의료 진단/);
  assert.match(prompt.system, /sourceFacts는 유일한 사람 판단 근거/);
  assert.match(prompt.system, /의미 없는 자모 반복/);
  assert.match(prompt.system, /문장, 요약, 인용문, sourceFacts\.text 사본은 출력하지 마세요/);
  assert.match(prompt.system, /첫 항목은 서버가 oneLineSummary로 배치하므로 factPlacements에 넣지 마세요/);
  assert.match(prompt.system, /나머지 sourceFacts\.id를 정확히 한 번씩/);
  assert.match(prompt.system, /factPlacements만 가진 compact JSON 객체/);
  assert.doesNotMatch(prompt.user, /두부|말티즈|currentDraft|recentAverageWeightKg/);
  assert.match(prompt.user, /귀가 조금 예민했어요/);
  assert.match(prompt.user, /actualDurationMinutes/);
  assert.match(prompt.user, /factPlacements/);
  assert.doesNotMatch(prompt.user, /sourceFactCitations|oneLineSummary.*sourceFacts의 사실/);
  assert.doesNotMatch(prompt.user, /오늘은 전체적으로 편안하게 미용했어요/);
});

test("renders an exact fact-id placement plan into a non-echo CareReportDraft with exact citations", () => {
  const semanticContext = {
    ...context,
    petName: "반려동물",
    serviceName: "전체 미용",
    automaticFacts: {
      ...context.automaticFacts,
      actualDurationMinutes: 90,
      nextRecommendedVisitDate: null,
    },
    observations: {
      ...context.observations,
      sourceFacts: [
        { id: "fact-condition", category: "skin_ears", text: "눈물이 많아 눈가를 닦았어요.", source: "note" },
        { id: "fact-response", category: "behavior", text: "얼굴 드라이 때 잠시 긴장했어요.", source: "note" },
        { id: "fact-home-care", category: "special", text: "집에서는 눈가를 부드럽게 닦아 주세요.", source: "note" },
      ],
    },
    voiceTranscript: "",
  };
  const factPlacements = [
    { sourceFactId: "fact-response", field: "groomingResponse" },
    { sourceFactId: "fact-home-care", field: "homeCareTips" },
  ];
  const providerContent = JSON.stringify({ factPlacements });
  assert.doesNotMatch(providerContent, /눈물이|눈가|드라이|닦아 주세요/);

  const result = parseAndValidateCareReportProviderOutput({
    choices: [{ finish_reason: "stop", message: { content: providerContent } }],
    usage: { prompt_tokens: 20, completion_tokens: 12, total_tokens: 32 },
  }, semanticContext, { requireSemanticPlan: true });

  assert.deepEqual(result.draft, {
    oneLineSummary: "눈물이 많아 눈가를 닦은 점을 중심으로 오늘 케어 기록을 정리했습니다.",
    treatmentSummary: "전체 미용을 진행했고, 총 작업 시간은 1시간 30분이었어요.",
    conditionSummary: "",
    groomingResponse: "미용 중 얼굴 드라이 때 잠시 긴장한 반응을 확인했습니다.",
    homeCareTips: ["홈케어 안내로 집에서는 눈가를 부드럽게 닦아 주시기 바랍니다."],
    nextVisitGuide: "",
  });
  assert.deepEqual(result.sourceFactCitations, [
    { field: "oneLineSummary", sentence: result.draft.oneLineSummary, sourceFactIds: ["fact-condition"] },
    { field: "groomingResponse", sentence: result.draft.groomingResponse, sourceFactIds: ["fact-response"] },
    { field: "homeCareTips", sentence: result.draft.homeCareTips[0], sourceFactIds: ["fact-home-care"] },
  ]);
  assert.deepEqual(
    result.sourceFactCitations.flatMap((citation) => citation.sourceFactIds).sort(),
    ["fact-condition", "fact-home-care", "fact-response"],
  );
  expectSafetyRule(
    () => assertSourceFactProvenance(
      semanticContext.observations.sourceFacts.map((fact) => fact.id),
      result.sourceFactCitations.map((citation, index) => index === 0
        ? { ...citation, sentence: "서버가 만들지 않은 다른 문장입니다." }
        : citation),
      semanticContext,
      result.draft,
    ),
    "citation_validation_rejected",
  );
  assert.equal(
    semanticContext.observations.sourceFacts.some((fact) => hasCareReportExactSourceEcho(fact.text, result.draft)),
    false,
  );

  expectSafetyRule(
    () => parseAndValidateCareReportProviderOutput({
      choices: [{ message: { content: JSON.stringify({
        ...result.draft,
        sourceFactIds: factPlacements.map((placement) => placement.sourceFactId),
        sourceFactCitations: result.sourceFactCitations,
      }) } }],
    }, semanticContext, { requireSemanticPlan: true }),
    "structure_validation_rejected",
  );
});

test("fails closed for missing, duplicate, unknown, misplaced, or unrenderable semantic facts", () => {
  const semanticContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [
        { id: "fact-condition", category: "skin_ears", text: "눈물이 많아 눈가를 닦았어요.", source: "note" },
        { id: "fact-response", category: "behavior", text: "얼굴 드라이 때 잠시 긴장했어요.", source: "note" },
      ],
    },
    voiceTranscript: "",
  };
  const parsePlan = (factPlacements, extra = {}) => parseAndValidateCareReportProviderOutput({
    choices: [{ message: { content: JSON.stringify({ factPlacements, ...extra }) } }],
  }, semanticContext);

  for (const placements of [
    [],
    [
      { sourceFactId: "fact-response", field: "groomingResponse" },
      { sourceFactId: "fact-response", field: "groomingResponse" },
    ],
    [
      { sourceFactId: "fact-unknown", field: "groomingResponse" },
    ],
    [
      { sourceFactId: "fact-response", field: "conditionSummary" },
    ],
    [
      { sourceFactId: "fact-response", field: "oneLineSummary" },
    ],
  ]) {
    expectSafetyRule(() => parsePlan(placements), "citation_validation_rejected");
  }
  expectSafetyRule(
    () => parsePlan([
      { sourceFactId: "fact-response", field: "groomingResponse" },
    ], { generatedSentence: "provider prose is forbidden" }),
    "unexpected_field_validation_rejected",
  );

  const unrenderableContext = {
    ...semanticContext,
    observations: {
      ...semanticContext.observations,
      sourceFacts: [{ id: "fact-note", category: "general", text: "끝맺음이 없는 관찰 메모", source: "note" }],
    },
  };
  expectSafetyRule(
    () => parseAndValidateCareReportProviderOutput({
      choices: [{ message: { content: JSON.stringify({
        factPlacements: [],
      }) } }],
    }, unrenderableContext),
    "claim_validation_rejected",
  );
});

test("uses the smallest rounded bounded output budget above the maximal compact schema fixture", () => {
  const sourceFactIds = Array.from({ length: 6 }, (_, index) =>
    `fact-${index}${"a".repeat(47)}`);
  const maximalResponse = careReportGeneratedResponseSchema.parse({
    oneLineSummary: "가".repeat(400),
    treatmentSummary: "가".repeat(800),
    conditionSummary: "가".repeat(800),
    groomingResponse: "가".repeat(500),
    homeCareTips: Array(4).fill("가".repeat(240)),
    nextVisitGuide: "가".repeat(300),
    sourceFactIds,
    sourceFactCitations: Array.from({ length: 12 }, (_, index) => ({
      field: ["oneLineSummary", "conditionSummary", "groomingResponse", "homeCareTips"][index % 4],
      sentence: "가".repeat(400),
      sourceFactIds,
    })),
  });
  const compactCharacterCount = JSON.stringify(maximalResponse).length;
  const characterBudgetWithFifteenPercentMargin = Math.ceil(compactCharacterCount * 1.15);

  assert.equal(compactCharacterCount, CARE_REPORT_PROVIDER_SCHEMA_MAX_COMPACT_CHARACTERS);
  assert.ok(CARE_REPORT_PROVIDER_MAX_OUTPUT_TOKENS >= characterBudgetWithFifteenPercentMargin);
  assert.ok(CARE_REPORT_PROVIDER_MAX_OUTPUT_TOKENS - characterBudgetWithFifteenPercentMargin < 128);

  const prompt = buildCareReportPrompt(context);
  const requestBody = buildCareReportProviderRequestBody("configured-model", prompt);
  assert.equal(requestBody.max_tokens, CARE_REPORT_PROVIDER_MAX_OUTPUT_TOKENS);
  assert.deepEqual(requestBody.response_format, { type: "json_object" });
  assert.equal(requestBody.messages.length, 2);
});

test("rejects an exact provider echo even when its citation shape is otherwise valid", () => {
  const roughNoteContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [{
        id: "fact-note",
        category: "general",
        text: "목욕은 잘 진행됐고 귀가 조금 예민했어요.",
        source: "note",
      }],
    },
    voiceTranscript: "목욕은 잘 진행됐고 귀가 조금 예민했어요.",
  };
  const providerOutput = {
    choices: [{
      message: {
        content: JSON.stringify({
          oneLineSummary: "목욕은 잘 진행됐고 귀가 조금 예민했어요.",
          treatmentSummary: "전체미용을 진행했어요.",
          conditionSummary: "목욕은 잘 진행됐고 귀가 조금 예민했어요.",
          groomingResponse: "",
          homeCareTips: [],
          nextVisitGuide: "",
          sourceFactIds: ["fact-note"],
          sourceFactCitations: [
            { field: "oneLineSummary", sentence: "목욕은 잘 진행됐고 귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
            { field: "conditionSummary", sentence: "목욕은 잘 진행됐고 귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
          ],
        }),
      },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };

  expectSafetyRule(
    () => parseAndValidateCareReportProviderOutput(providerOutput, roughNoteContext),
    "echo_validation_rejected",
  );
});

test("accepts a narrow no-invention rewrite but rejects the unchanged bathing source", () => {
  const roughNoteContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [{
        id: "fact-note",
        category: "general",
        text: "목욕잘했고 컨디션 좋았다",
        source: "note",
      }],
    },
    voiceTranscript: "목욕잘했고 컨디션 좋았다",
  };
  const rawDraft = {
    oneLineSummary: "목욕잘했고 컨디션 좋았다",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "목욕잘했고 컨디션 좋았다",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
    sourceFactIds: ["fact-note"],
    sourceFactCitations: [
      { field: "oneLineSummary", sentence: "목욕잘했고 컨디션 좋았다", sourceFactIds: ["fact-note"] },
      { field: "conditionSummary", sentence: "목욕잘했고 컨디션 좋았다", sourceFactIds: ["fact-note"] },
    ],
  };
  expectSafetyRule(
    () => parseAndValidateCareReportProviderOutput({
      choices: [{ message: { content: JSON.stringify(rawDraft) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }, roughNoteContext),
    "echo_validation_rejected",
  );

  const rewrittenSentence = "목욕을 잘 마쳤고, 컨디션도 좋았습니다.";
  const result = parseAndValidateCareReportProviderOutput({
    choices: [{ message: { content: JSON.stringify({
      ...rawDraft,
      oneLineSummary: rewrittenSentence,
      conditionSummary: rewrittenSentence,
      sourceFactCitations: rawDraft.sourceFactCitations.map((citation) => ({
        ...citation,
        sentence: rewrittenSentence,
      })),
    }) } }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }, roughNoteContext);

  assert.equal(result.draft.oneLineSummary, rewrittenSentence);
  assert.equal(result.draft.conditionSummary, rewrittenSentence);
  assert.deepEqual(result.sourceFactCitations.map((citation) => citation.sentence), [
    rewrittenSentence,
    rewrittenSentence,
  ]);
});

test("normalizes whitespace and punctuation before detecting source echo and unchanged fallback", () => {
  const sourceText = "목욕 잘 했고 괜찮았습니다.";
  const exactEcho = careReportDraftSchema.parse({
    oneLineSummary: "목욕 잘 했고, 괜찮았습니다!",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
  });
  const rewritten = careReportDraftSchema.parse({
    ...exactEcho,
    oneLineSummary: "목욕을 잘 마쳤으며, 전반적인 상태도 양호했습니다.",
  });

  assert.equal(hasCareReportExactSourceEcho(sourceText, exactEcho), true);
  assert.equal(hasCareReportExactSourceEcho(sourceText, rewritten), false);
  assert.equal(isCareReportDraftUnchanged(rewritten, { ...rewritten }), true);
  assert.equal(isCareReportDraftUnchanged(rewritten, { ...rewritten, homeCareTips: ["빗질해 주세요."] }), false);
});

test("keeps the fixed synthetic provider facts behind the normalized exact-echo guard", () => {
  const fixedSyntheticFacts = [
    "눈물이 많아 눈가를 닦았어요.",
    "얼굴 드라이 때 잠시 긴장했어요.",
    "집에서는 눈가를 부드럽게 닦아 주세요.",
  ];
  const punctuationOnlyVariants = [
    "눈물이 많아, 눈가를 닦았어요!",
    "얼굴 드라이 때  잠시 긴장했어요!",
    "집에서는 눈가를 부드럽게 닦아 주세요!",
  ];

  for (const [index, sourceText] of fixedSyntheticFacts.entries()) {
    const exactEcho = careReportDraftSchema.parse({
      oneLineSummary: punctuationOnlyVariants[index],
      treatmentSummary: "전체 미용을 진행했어요.",
      conditionSummary: "",
      groomingResponse: "",
      homeCareTips: [],
      nextVisitGuide: "",
    });
    assert.equal(hasCareReportExactSourceEcho(sourceText, exactEcho), true);
  }

  const rewritten = careReportDraftSchema.parse({
    oneLineSummary: "눈가를 닦아 눈물 자국을 정리했습니다.",
    treatmentSummary: "전체 미용을 진행했어요.",
    conditionSummary: "얼굴을 말리는 동안에는 잠시 긴장하는 반응이 있었습니다.",
    groomingResponse: "",
    homeCareTips: ["집에서도 눈가를 부드럽게 닦아 관리해 주세요."],
    nextVisitGuide: "",
  });
  assert.equal(fixedSyntheticFacts.some((sourceText) => hasCareReportExactSourceEcho(sourceText, rewritten)), false);
});

test("builds the DB-free representative preview as a distinct no-invention rewrite", () => {
  const preview = buildPreviewCareReportDraft({
    petName: "두부",
    serviceName: "목욕",
    actualDurationMinutes: 45,
    nextRecommendedVisitDate: null,
    ownerSourceText: "목욕 잘 했고 괜찮았습니다.",
    observations: {
      ...context.observations,
      sourceFacts: createCareReportSourceFacts("목욕 잘 했고 괜찮았습니다."),
    },
  });

  assert.equal(preview.oneLineSummary, "목욕을 잘 마쳤으며, 전반적인 상태도 양호했습니다.");
  assert.equal(hasCareReportExactSourceEcho("목욕 잘 했고 괜찮았습니다.", preview), false);
  assert.equal(preview.homeCareTips.length, 0);
  assert.throws(
    () => buildPreviewCareReportDraft({
      petName: "두부",
      serviceName: "목욕",
      actualDurationMinutes: 45,
      nextRecommendedVisitDate: null,
      ownerSourceText: "입력에 없는 제품을 추천해 주세요.",
      observations: context.observations,
    }),
    (error) => error instanceof Error && error.message === CARE_REPORT_GENERATION_RETRY_MESSAGE,
  );
});

test("aligns a multi-sentence summary with one exact citation row per sentence", () => {
  const multiFactContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [
        { id: "fact-ear", category: "skin_ears", text: "귀가 조금 예민했어요.", source: "note" },
        { id: "fact-dry", category: "behavior", text: "드라이 때 잠시 긴장했어요.", source: "chip" },
      ],
    },
  };
  const draft = {
    oneLineSummary: "귀가 조금 예민했어요. 드라이 때 잠시 긴장했어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "귀가 조금 예민했어요.",
    groomingResponse: "드라이 때 잠시 긴장했어요.",
    homeCareTips: [],
    nextVisitGuide: "",
  };
  const exactSentenceCitations = [
    { field: "oneLineSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-ear"] },
    { field: "oneLineSummary", sentence: "드라이 때 잠시 긴장했어요.", sourceFactIds: ["fact-dry"] },
    { field: "conditionSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-ear"] },
    { field: "groomingResponse", sentence: "드라이 때 잠시 긴장했어요.", sourceFactIds: ["fact-dry"] },
  ];

  assert.doesNotThrow(() => assertSourceFactProvenance(
    ["fact-ear", "fact-dry"],
    exactSentenceCitations,
    multiFactContext,
    draft,
  ));
  expectSafetyRule(
    () => assertSourceFactProvenance(
      ["fact-ear", "fact-dry"],
      [
        { field: "oneLineSummary", sentence: draft.oneLineSummary, sourceFactIds: ["fact-ear", "fact-dry"] },
        ...exactSentenceCitations.slice(2),
      ],
      multiFactContext,
      draft,
    ),
    "citation_validation_rejected",
  );
});

test("binds each output sentence to a complete atomic sentence from a multi-sentence fact", () => {
  const multiSentenceFactContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [{
        id: "fact-note",
        category: "general",
        text: "목욕을 잘 마쳤어요. 귀가 조금 예민했어요.",
        source: "note",
      }],
    },
  };
  const draft = {
    oneLineSummary: "오늘은 목욕을 잘 마쳤어요. 귀가 조금 예민했어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "귀가 조금 예민했어요.",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
  };
  const citations = [
    { field: "oneLineSummary", sentence: "오늘은 목욕을 잘 마쳤어요.", sourceFactIds: ["fact-note"] },
    { field: "oneLineSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
    { field: "conditionSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
  ];

  assert.doesNotThrow(() => assertSourceFactProvenance(["fact-note"], citations, multiSentenceFactContext, draft));
  expectSafetyRule(
    () => assertSourceFactProvenance(
      ["fact-note"],
      [{ field: "oneLineSummary", sentence: "목욕 후 기분이 좋아 보였어요.", sourceFactIds: ["fact-note"] }],
      multiSentenceFactContext,
      { ...draft, oneLineSummary: "목욕 후 기분이 좋아 보였어요.", conditionSummary: "" },
    ),
    "claim_validation_rejected",
  );
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

test("does not transmit the current edited draft to the provider prompt", () => {
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

  assert.doesNotMatch(prompt.system, /최신 오너 요청에 필요한 부분만 수정/);
  assert.doesNotMatch(prompt.user, /두부는 오늘 눈가를 부드럽게 세정했어요/);
  assert.doesNotMatch(prompt.user, /말투만 조금 더 부드럽게 바꿔줘/);
});

test("scrubs direct contact details before source facts are made", () => {
  const source = prepareCareReportSourceText("010-1234-5678로 연락 주세요. 서울 강남구 테헤란로 123-4 2층이에요.");
  assert.doesNotMatch(source, /010-1234-5678|테헤란로|123-4|강남구/);
  assert.equal(hasCareReportPiiResidual(source), false);
  const facts = createCareReportSourceFacts(source, ["skin_ears", "behavior"]);
  assert.equal(facts.length, 3);
  assert.ok(facts.every((fact) => fact.text === source));
  assert.deepEqual(facts.map((fact) => fact.source), ["note", "chip", "chip"]);
});

test("fully removes Korean phone variants and addresses while allowing ordinary numbers", () => {
  const scrubbed = prepareCareReportSourceText("+82 (0)10.1234.5678, 02) 123-4567, 부산 해운대구 센텀중앙로 45에 연락해요.");
  assert.doesNotMatch(scrubbed, /010|1234|02\)|센텀중앙로|해운대구|45/);
  assert.equal(hasCareReportPiiResidual(scrubbed), false);
  assert.equal(prepareCareReportSourceText("9월 3일에 4.5kg 반려동물 미용을 90분 진행했어요."), "9월 3일에 4.5kg 반려동물 미용을 90분 진행했어요.");
});

test("detects an address-shaped residual without blocking ordinary dates, prices, weights, or time", () => {
  assert.equal(hasCareReportPiiResidual("마포구 월드컵북로 12A"), true);
  assert.equal(hasCareReportPiiResidual("9월 3일, 35,000원, 4.5kg, 90분"), false);
});

test("requires known source fact ids for owner-observation copy", () => {
  const response = careReportGeneratedResponseSchema.parse({
    oneLineSummary: "귀가 조금 예민했어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "귀가 조금 예민했어요.",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
    sourceFactIds: ["fact-unknown"],
  });
  expectSafetyRule(
    () => assertSourceFactProvenance(response.sourceFactIds, [], context, response),
    "citation_validation_rejected",
  );
});

test("rejects observation copy when the response omits provenance", () => {
  const draft = {
    oneLineSummary: "귀가 조금 예민했어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "귀가 조금 예민했어요.",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
  };
  expectSafetyRule(
    () => assertSourceFactProvenance([], [], context, draft),
    "citation_validation_rejected",
  );
});

test("requires each observation sentence to cite a matching fact and rejects cross-section misuse", () => {
  const draft = {
    oneLineSummary: "귀가 조금 예민했어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "귀가 조금 예민했어요.",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
  };
  const citations = [
    { field: "oneLineSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
    { field: "conditionSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
  ];
  assert.doesNotThrow(() => assertSourceFactProvenance(["fact-note"], citations, context, draft));
  expectSafetyRule(
    () => assertSourceFactProvenance(["fact-note"], [{ field: "conditionSummary", sentence: "피부 알레르기가 의심돼요.", sourceFactIds: ["fact-note"] }], context, { ...draft, conditionSummary: "피부 알레르기가 의심돼요." }),
    "citation_validation_rejected",
  );
  const behaviorOnlyContext = {
    ...context,
    observations: { ...context.observations, sourceFacts: [{ id: "fact-behavior", category: "behavior", text: "드라이 때 잠시 긴장했어요.", source: "chip" }] },
  };
  expectSafetyRule(
    () => assertSourceFactProvenance(["fact-behavior"], [{ field: "conditionSummary", sentence: "드라이 때 잠시 긴장했어요.", sourceFactIds: ["fact-behavior"] }], behaviorOnlyContext, { ...draft, oneLineSummary: "드라이 때 잠시 긴장했어요.", conditionSummary: "드라이 때 잠시 긴장했어요." }),
    "citation_validation_rejected",
  );
});

test("rejects hospital guidance without an explicit danger fact", () => {
  const noDangerContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [
        { id: "fact-note", category: "general", text: "귀가 조금 예민했어요.", source: "note" },
        { id: "fact-guidance", category: "special", text: "동물병원에 문의해 주세요.", source: "chip" },
      ],
    },
  };
  const draft = {
    oneLineSummary: "귀가 조금 예민했어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "귀가 조금 예민했어요.",
    groomingResponse: "",
    homeCareTips: ["동물병원에 문의해 주세요."],
    nextVisitGuide: "",
  };
  const citations = [
    { field: "oneLineSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
    { field: "conditionSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
    { field: "homeCareTips", sentence: "동물병원에 문의해 주세요.", sourceFactIds: ["fact-guidance"] },
  ];
  expectSafetyRule(
    () => assertSourceFactProvenance(["fact-note", "fact-guidance"], citations, noDangerContext, draft),
    "citation_validation_rejected",
  );
});

test("accepts only neutral hospital guidance cited directly to an explicit danger fact", () => {
  const dangerContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [
        { id: "fact-danger", category: "special", text: "발에 상처가 있었어요.", source: "note" },
        { id: "fact-ear", category: "general", text: "귀가 조금 예민했어요.", source: "chip" },
      ],
    },
  };
  const draft = {
    oneLineSummary: "발에 상처가 있었어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "발에 상처가 있었어요.",
    groomingResponse: "",
    homeCareTips: ["지속되거나 심해지면 동물병원에 문의해 주세요."],
    nextVisitGuide: "",
  };
  const citations = [
    { field: "oneLineSummary", sentence: "발에 상처가 있었어요.", sourceFactIds: ["fact-danger"] },
    { field: "conditionSummary", sentence: "발에 상처가 있었어요.", sourceFactIds: ["fact-danger"] },
    { field: "homeCareTips", sentence: "지속되거나 심해지면 동물병원에 문의해 주세요.", sourceFactIds: ["fact-danger"] },
  ];
  assert.doesNotThrow(() => assertSourceFactProvenance(["fact-danger"], citations, dangerContext, draft));
  expectSafetyRule(
    () => assertSourceFactProvenance(
      ["fact-danger", "fact-ear"],
      [...citations.slice(0, 2), { ...citations[2], sourceFactIds: ["fact-danger", "fact-ear"] }],
      dangerContext,
      draft,
    ),
    "citation_validation_rejected",
  );
  expectSafetyRule(
    () => assertSourceFactProvenance(["fact-danger"], [{ ...citations[0] }, { ...citations[1] }, { ...citations[2], sentence: "상처 원인 때문에 동물병원에 문의해 주세요." }], dangerContext, { ...draft, homeCareTips: ["상처 원인 때문에 동물병원에 문의해 주세요."] }),
    "citation_validation_rejected",
  );
});

test("rejects exact duplicate citation rows even when their fact-ID order differs", () => {
  const dangerContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [
        { id: "fact-danger-a", category: "special", text: "발에 상처가 있었어요.", source: "note" },
        { id: "fact-danger-b", category: "special", text: "출혈이 있었어요.", source: "chip" },
      ],
    },
  };
  const draft = {
    oneLineSummary: "발에 상처가 있었어요.", treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "발에 상처가 있었어요.", groomingResponse: "", homeCareTips: ["동물병원에 문의해 주세요."], nextVisitGuide: "",
  };
  const citations = [
    { field: "oneLineSummary", sentence: "발에 상처가 있었어요.", sourceFactIds: ["fact-danger-a"] },
    { field: "conditionSummary", sentence: "발에 상처가 있었어요.", sourceFactIds: ["fact-danger-a"] },
    { field: "homeCareTips", sentence: "동물병원에 문의해 주세요.", sourceFactIds: ["fact-danger-a", "fact-danger-b"] },
  ];
  assert.doesNotThrow(() => assertSourceFactProvenance(["fact-danger-a", "fact-danger-b"], citations, dangerContext, draft));
  expectSafetyRule(
    () => assertSourceFactProvenance(
      ["fact-danger-a", "fact-danger-b"],
      [...citations, { ...citations[2], sourceFactIds: ["fact-danger-b", "fact-danger-a"] }],
      dangerContext,
      draft,
    ),
    "citation_validation_rejected",
  );
});

test("requires the exact citation union and binds every cited fact to its sentence", () => {
  const multiFactContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [
        { id: "fact-ear", category: "general", text: "귀가 조금 예민했어요.", source: "note" },
        { id: "fact-nail", category: "general", text: "발톱 정리 완료.", source: "chip" },
      ],
    },
  };
  const draft = {
    oneLineSummary: "귀가 조금 예민했어요.", treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "귀가 조금 예민했어요.", groomingResponse: "", homeCareTips: [], nextVisitGuide: "",
  };
  const citations = [
    { field: "oneLineSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-ear"] },
    { field: "conditionSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-ear"] },
  ];
  assert.doesNotThrow(() => assertSourceFactProvenance(["fact-ear"], citations, multiFactContext, draft));
  expectSafetyRule(
    () => assertSourceFactProvenance(["fact-ear", "fact-nail"], citations, multiFactContext, draft),
    "citation_validation_rejected",
  );
  expectSafetyRule(
    () => assertSourceFactProvenance(["fact-ear", "fact-nail"], [{ ...citations[0], sourceFactIds: ["fact-ear", "fact-nail"] }, citations[1]], multiFactContext, draft),
    "claim_validation_rejected",
  );
  expectSafetyRule(
    () => assertSourceFactProvenance(["fact-ear"], [{ ...citations[0], sourceFactIds: ["fact-ear", "fact-nail"] }, citations[1]], multiFactContext, draft),
    "citation_validation_rejected",
  );
});

test("rejects unsupported normality, causes, mixed unknown citations, and non-danger hospital guidance", () => {
  const draft = {
    oneLineSummary: "귀가 조금 예민했어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "귀가 조금 예민했어요.",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
  };
  const citations = [
    { field: "oneLineSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
    { field: "conditionSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
  ];
  for (const claim of ["귀는 깨끗해요.", "귀 상태는 healthy예요.", "샴푸 때문에 귀가 예민해요."]) {
    expectSafetyRule(
      () => assertSourceFactProvenance(["fact-note"], [...citations, { field: "conditionSummary", sentence: claim, sourceFactIds: ["fact-note"] }], context, { ...draft, conditionSummary: claim }),
      "claim_validation_rejected",
    );
  }
  expectSafetyRule(
    () => assertSourceFactProvenance(["fact-note"], [...citations, { field: "conditionSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note", "fact-unknown"] }], context, draft),
    "citation_validation_rejected",
  );
  const dangerElsewhere = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [
        { id: "fact-note", category: "general", text: "귀가 조금 예민했어요.", source: "note" },
        { id: "fact-danger", category: "special", text: "발에 상처가 있었어요.", source: "chip" },
        { id: "fact-guidance", category: "special", text: "동물병원에 문의해 주세요.", source: "chip" },
      ],
    },
  };
  const hospitalDraft = { ...draft, groomingResponse: "발에 상처가 있었어요.", homeCareTips: ["동물병원에 문의해 주세요."] };
  expectSafetyRule(
    () => assertSourceFactProvenance(
      ["fact-note", "fact-danger", "fact-guidance"],
      [...citations, { field: "groomingResponse", sentence: "발에 상처가 있었어요.", sourceFactIds: ["fact-danger"] }, { field: "homeCareTips", sentence: "동물병원에 문의해 주세요.", sourceFactIds: ["fact-guidance"] }],
      dangerElsewhere,
      hospitalDraft,
    ),
    "citation_validation_rejected",
  );
});

test("allows an exact cited owner normality observation but rejects fabricated normality", () => {
  const normalityContext = {
    ...context,
    observations: {
      ...context.observations,
      sourceFacts: [{ id: "fact-note", category: "general", text: "문제 없음 컨디션 좋음", source: "note" }],
    },
    voiceTranscript: "문제 없음 컨디션 좋음",
  };
  const draft = {
    oneLineSummary: "문제 없음 컨디션 좋음", treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "문제 없음 컨디션 좋음", groomingResponse: "", homeCareTips: [], nextVisitGuide: "",
  };
  const citations = [
    { field: "oneLineSummary", sentence: "문제 없음 컨디션 좋음", sourceFactIds: ["fact-note"] },
    { field: "conditionSummary", sentence: "문제 없음 컨디션 좋음", sourceFactIds: ["fact-note"] },
  ];

  assert.doesNotThrow(() => assertSourceFactProvenance(["fact-note"], citations, normalityContext, draft));
  expectSafetyRule(
    () => assertSourceFactProvenance(["fact-note"], citations, context, draft),
    "claim_validation_rejected",
  );
});

test("rejects contact or address-shaped content before a final report can be stored", () => {
  expectSafetyRule(() => assertCareReportDraftPiiFree({
    oneLineSummary: "010-1234-5678로 연락해 주세요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
  }), "pii_validation_rejected");
});

test("keeps a stable save fingerprint for requery-only retry and rejects changed replay", () => {
  const observations = { ...context.observations, sourceFactCitations: [] };
  const payload = serializeCareReportSavePayload({
    careReport: {
      oneLineSummary: "귀가 조금 예민했어요.", treatmentSummary: "전체미용을 진행했어요.", conditionSummary: "", groomingResponse: "", homeCareTips: [], nextVisitGuide: "",
    },
    observations,
    sourceText: scrubCareReportSourceText("귀가 조금 예민했어요."),
    photoConsent: false,
  });
  const fingerprint = hashCareReportSavePayload(payload);
  assert.equal(decideCareReportSaveReplay({ requestId: "save-stable", fingerprint, existingRequestId: "save-stable", existingFingerprint: fingerprint }), "replay");
  assert.equal(decideCareReportSaveReplay({ requestId: "save-stable", fingerprint: "f".repeat(64), existingRequestId: "save-stable", existingFingerprint: fingerprint }), "conflict");
  assert.equal(decideCareReportSaveReplay({ requestId: "save-next", fingerprint, existingRequestId: "save-stable", existingFingerprint: fingerprint }), "write");
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

test("allows zero usage only when usage is absent", () => {
  assert.deepEqual(normalizeCareReportUsage(undefined), {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: 0,
  });
  expectSafetyRule(() => normalizeCareReportUsage({}), "usage_validation_rejected");
});

test("fails closed when supplied provider usage contains a non-finite, negative, or non-number value", () => {
  const validUsage = {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
    prompt_cache_hit_tokens: 2,
    prompt_cache_miss_tokens: 8,
  };
  const invalidCases = Object.keys(validUsage).flatMap((field) => ["10", Number.NaN, Number.POSITIVE_INFINITY, -1]
    .map((invalidValue) => ({ ...validUsage, [field]: invalidValue })));

  const validContent = JSON.stringify({
    oneLineSummary: "귀가 조금 예민했어요.",
    treatmentSummary: "전체미용을 진행했어요.",
    conditionSummary: "귀가 조금 예민했어요.",
    groomingResponse: "",
    homeCareTips: [],
    nextVisitGuide: "",
    sourceFactIds: ["fact-note"],
    sourceFactCitations: [
      { field: "oneLineSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
      { field: "conditionSummary", sentence: "귀가 조금 예민했어요.", sourceFactIds: ["fact-note"] },
    ],
  });

  for (const usage of invalidCases) {
    let caught;
    try {
      parseAndValidateCareReportProviderOutput({ choices: [{ message: { content: validContent } }], usage }, context);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof CareReportSafetyValidationError);
    assert.deepEqual(toSafeCareReportSafetyHttpResponse(caught), {
      status: 422,
      body: {
        message: "AI 초안이 안전 기준을 통과하지 못했습니다. 관찰 메모를 확인한 뒤 다시 작성해 주세요.",
        safetyRuleCode: "usage_validation_rejected",
      },
    });
    assert.doesNotMatch(JSON.stringify(toSafeCareReportSafetyHttpResponse(caught)), /NaN|Infinity|prompt_tokens|completion_tokens/);
  }
});

test("blocks AI copy that states a medical diagnosis", () => {
  expectSafetyRule(
    () =>
      assertObservationOnlyCareReport({
        oneLineSummary: "오늘 미용을 마쳤어요.",
        treatmentSummary: "전체미용을 진행했어요.",
        conditionSummary: "피부병입니다.",
        groomingResponse: "차분했어요.",
        homeCareTips: ["가볍게 빗질해 주세요."],
        nextVisitGuide: "다음 관리 시점을 확인해 주세요.",
      }),
    "medical_validation_rejected",
  );
});

test("blocks weight judgments that the owner did not provide", () => {
  expectSafetyRule(
    () => assertGroundedWeightGuidance({
      oneLineSummary: "두부는 과체중이라 체중 감량이 필요해요.",
      treatmentSummary: "전체미용을 진행했어요.",
      conditionSummary: "",
      groomingResponse: "",
      homeCareTips: [],
      nextVisitGuide: "",
    }, context),
    "weight_validation_rejected",
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
