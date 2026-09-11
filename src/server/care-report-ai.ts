import { createHash } from "node:crypto";

import { z } from "zod";

import { serverEnv } from "@/lib/server-env";
import {
  CARE_REPORT_GENERATION_RETRY_MESSAGE,
  assertCareReportTextPiiFree,
  buildVerifiedNextVisitGuide,
  buildVerifiedTreatmentSummary,
  finalizeCareReportDraft,
  hasCareReportExactSourceEcho,
  isCareReportDraftUnchanged,
} from "@/lib/care-report-draft";
import {
  careReportDraftSchema,
  careReportGeneratedResponseSchema,
  type CareReportDraft,
  type CareReportGenerationUsage,
  type CareReportObservations,
  type CareReportSourceFactCitation,
} from "@/types/care-report";

const deepseekChatCompletionsUrl = "https://api.deepseek.com/chat/completions";
const generationTimeoutMs = 15_000;
export const CARE_REPORT_PROVIDER_SCHEMA_MAX_COMPACT_CHARACTERS = 13_820;
export const CARE_REPORT_PROVIDER_MAX_OUTPUT_TOKENS = 16_000;

type CareReportContext = {
  petName: string;
  petBreed: string;
  serviceName: string;
  automaticFacts: {
    actualDurationMinutes: number | null;
    expectedDurationMinutes: number | null;
    currentWeightKg: number | null;
    previousWeightKg: number | null;
    weightChangeFromPreviousKg: number | null;
    recentAverageWeightKg: number | null;
    weightDifferenceFromRecentAverageKg: number | null;
    weightSampleCount: number;
    nextRecommendedVisitDate: string | null;
  };
  observations: CareReportObservations;
  voiceTranscript: string;
  currentDraft?: CareReportDraft;
};

type DeepSeekUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
};

type DeepSeekChatResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null };
  }>;
  usage?: DeepSeekUsage;
};

export type CareReportAiResult = {
  draft: CareReportDraft;
  sourceFactCitations: CareReportSourceFactCitation[];
  model: string;
  inputHash: string;
  usage: CareReportGenerationUsage;
  estimatedCostUsd: number;
};

export const CARE_REPORT_SAFETY_RULE_CODES = [
  "content_type_validation_rejected",
  "envelope_validation_rejected",
  "structure_validation_rejected",
  "truncated_output_validation_rejected",
  "section_validation_rejected",
  "unexpected_field_validation_rejected",
  "usage_validation_rejected",
  "citation_validation_rejected",
  "claim_validation_rejected",
  "echo_validation_rejected",
  "medical_validation_rejected",
  "pii_validation_rejected",
  "weight_validation_rejected",
  "safety_validation_rejected",
] as const;

export type CareReportSafetyRuleCode = typeof CARE_REPORT_SAFETY_RULE_CODES[number];

const safetyRuleMessage = "AI 초안이 안전 기준을 통과하지 못했습니다. 관찰 메모를 확인한 뒤 다시 작성해 주세요.";

function safetyRuleMessageFor(ruleCode: CareReportSafetyRuleCode) {
  return ruleCode === "echo_validation_rejected" ? CARE_REPORT_GENERATION_RETRY_MESSAGE : safetyRuleMessage;
}

/** Carries only a fixed allowlisted code: never provider output, prompt, or observation text. */
export class CareReportSafetyValidationError extends Error {
  constructor(readonly ruleCode: CareReportSafetyRuleCode) {
    super(safetyRuleMessageFor(ruleCode));
    this.name = "CareReportSafetyValidationError";
  }
}

/** Hides provider, network, timeout, and local secret details from owner-facing responses. */
export class CareReportGenerationError extends Error {
  constructor() {
    super(CARE_REPORT_GENERATION_RETRY_MESSAGE);
    this.name = "CareReportGenerationError";
  }
}

function rejectCareReportSafety(ruleCode: CareReportSafetyRuleCode): never {
  throw new CareReportSafetyValidationError(ruleCode);
}

function isCareReportSafetyRuleCode(value: unknown): value is CareReportSafetyRuleCode {
  return typeof value === "string" && CARE_REPORT_SAFETY_RULE_CODES.includes(value as CareReportSafetyRuleCode);
}

export function normalizeCareReportSafetyError(error: unknown) {
  return error instanceof CareReportSafetyValidationError && isCareReportSafetyRuleCode(error.ruleCode)
    ? error
    : new CareReportSafetyValidationError("safety_validation_rejected");
}

export function toSafeCareReportSafetyDiagnostic(error: unknown) {
  const normalized = normalizeCareReportSafetyError(error);
  return { message: normalized.message, safetyRuleCode: normalized.ruleCode };
}

export function toSafeCareReportSafetyHttpResponse(error: unknown) {
  return { status: 422, body: toSafeCareReportSafetyDiagnostic(error) } as const;
}

export function toSafeCareReportGenerationHttpResponse(_error: unknown) {
  return { status: 502, body: { message: CARE_REPORT_GENERATION_RETRY_MESSAGE } } as const;
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function buildCareReportPrompt(context: CareReportContext) {
  return {
    system: [
      "당신은 반려동물 미용실 오너가 남긴 사실을 고객용 케어리포트 섹션에 배치하는 분류기입니다.",
      "sourceFacts는 유일한 사람 판단 근거입니다. 입력에 담긴 관찰, 조치, 반응, 주의사항을 빠뜨리거나 의미를 바꾸지 마세요.",
      "의미 없는 자모 반복, 키보드 테스트 문자열, 문맥과 무관한 글자는 케어 내용으로 인용하거나 고객 문장에 포함하지 마세요.",
      "category는 화면의 분류 보조값일 뿐 그 자체가 관찰 사실은 아닙니다. text에 없는 사실을 만들지 마세요.",
      "의료 진단·질환·원인·치료·입력에 없는 정상성이나 관리법을 만들지 말고, 그런 의미를 암시하는 새 필드도 출력하지 마세요.",
      "문장, 요약, 인용문, sourceFacts.text 사본은 출력하지 마세요. 고객용 한국어 문장과 정확한 citation은 서버가 원문을 복사하지 않는 결정적 렌더러로 만듭니다.",
      "sourceFacts의 첫 항목은 서버가 oneLineSummary로 배치하므로 factPlacements에 넣지 마세요.",
      "factPlacements에는 나머지 sourceFacts.id를 정확히 한 번씩 넣고, 각 fact를 의미에 맞는 상세 field 하나에만 배치하세요.",
      "conditionSummary는 상태·관찰, groomingResponse는 미용 중 반응, homeCareTips는 오너가 명시한 가정 관리 안내에만 사용하세요.",
      "sourceFacts가 비어 있으면 factPlacements도 빈 배열로 반환하세요.",
      "마크다운·코드 펜스·설명·추가 필드 없이 factPlacements만 가진 compact JSON 객체를 출력하세요.",
    ].join(" "),
    user: safeJson({
      petLabel: "반려동물",
      verifiedFacts: {
        serviceName: context.serviceName,
        actualDurationMinutes: context.automaticFacts.actualDurationMinutes,
      },
      sourceFacts: context.observations.sourceFacts,
      output: {
        factPlacements: [
          { sourceFactId: "sourceFacts.id 중 하나", field: "conditionSummary | groomingResponse | homeCareTips" },
        ],
      },
    }),
  };
}

export function buildCareReportProviderRequestBody(model: string, prompt: ReturnType<typeof buildCareReportPrompt>) {
  return {
    model,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: { type: "json_object" },
    max_tokens: CARE_REPORT_PROVIDER_MAX_OUTPUT_TOKENS,
    temperature: 0.3,
    thinking: { type: "disabled" },
  };
}

export function hashCareReportInput(model: string, context: CareReportContext) {
  return createHash("sha256").update(`${model}:${safeJson(context)}`).digest("hex");
}

export function normalizeCareReportUsage(usage: DeepSeekUsage | undefined): CareReportGenerationUsage {
  if (usage === undefined) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      promptCacheHitTokens: 0,
      promptCacheMissTokens: 0,
    };
  }

  const requiredValues = [usage.prompt_tokens, usage.completion_tokens, usage.total_tokens];
  const optionalValues = [usage.prompt_cache_hit_tokens, usage.prompt_cache_miss_tokens]
    .filter((value) => value !== undefined);
  if (
    requiredValues.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0) ||
    optionalValues.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0)
  ) {
    rejectCareReportSafety("usage_validation_rejected");
  }

  const promptTokens = usage.prompt_tokens as number;
  const completionTokens = usage.completion_tokens as number;
  const promptCacheHitTokens = usage.prompt_cache_hit_tokens ?? 0;
  const explicitMissTokens = usage.prompt_cache_miss_tokens ?? 0;
  const promptCacheMissTokens = explicitMissTokens || Math.max(0, promptTokens - promptCacheHitTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens: Math.max(promptTokens + completionTokens, usage.total_tokens as number),
    promptCacheHitTokens,
    promptCacheMissTokens,
  };
}

export function estimateDeepSeekV4FlashCostUsd(usage: CareReportGenerationUsage) {
  return (
    (usage.promptCacheHitTokens * 0.0028 +
      usage.promptCacheMissTokens * 0.14 +
      usage.completionTokens * 0.28) /
    1_000_000
  );
}

const diagnosticPatterns = [
  /(?:질환|감염|염증|피부병)(?:입니다|이에요|예요|으로 보입니다)/,
  /진단(?:됩니다|했어요|입니다)/,
  /치료(?:가|를) 필요/,
  /약을 (?:먹이|바르)/,
  /(?:알레르기|원인|가능성|의심)(?:이|되|됩|돼|으로|이라|이에요|입니다)/,
];

const dangerFactPattern = /상처|출혈|고름|심한\s*통증|호흡\s*문제/;
const hospitalGuidancePattern = /동물병원|병원에?\s*문의/;

export function assertObservationOnlyCareReport(draft: CareReportDraft) {
  const allText = [
    draft.oneLineSummary,
    draft.treatmentSummary,
    draft.conditionSummary,
    draft.groomingResponse,
    ...draft.homeCareTips,
    draft.nextVisitGuide,
  ].join(" ");

  if (diagnosticPatterns.some((pattern) => pattern.test(allText))) {
    rejectCareReportSafety("medical_validation_rejected");
  }
}

export function assertGroundedWeightGuidance(draft: CareReportDraft, context: CareReportContext) {
  const outputText = [draft.oneLineSummary, draft.conditionSummary, ...draft.homeCareTips].join(" ");
  const sourceText = [
    context.voiceTranscript,
    context.currentDraft ? safeJson(context.currentDraft) : "",
    ...context.observations.coat,
    ...context.observations.skin,
    ...context.observations.ears,
    ...context.observations.pawsAndNails,
    ...context.observations.groomingResponse,
  ].join(" ");
  const weightJudgmentPattern = /과체중|저체중|정상 체중|비만|살을 빼|체중 감량|다이어트/;

  if (weightJudgmentPattern.test(outputText) && !weightJudgmentPattern.test(sourceText)) {
    rejectCareReportSafety("weight_validation_rejected");
  }
}

export function assertCareReportDraftPiiFree(draft: CareReportDraft) {
  try {
    for (const value of [
      draft.oneLineSummary,
      draft.treatmentSummary,
      draft.conditionSummary,
      draft.groomingResponse,
      ...draft.homeCareTips,
      draft.nextVisitGuide,
    ]) {
      assertCareReportTextPiiFree(value);
    }
  } catch {
    rejectCareReportSafety("pii_validation_rejected");
  }
}

function splitCareSentences(value: string) {
  return value.split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function normalizeGroundedClaim(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");
}

const careReportSemanticPlacementFieldSchema = z.enum([
  "conditionSummary",
  "groomingResponse",
  "homeCareTips",
]);

const careReportSemanticPlanSchema = z.object({
  factPlacements: z.array(z.object({
    sourceFactId: z.string().trim().regex(/^fact-[a-z0-9-]{1,48}$/),
    field: careReportSemanticPlacementFieldSchema,
  }).strict()).max(5),
}).strict();

type CareReportSemanticField = CareReportSourceFactCitation["field"];

function stripTerminalSentencePunctuation(value: string) {
  return value.trim().replace(/[.!?]+$/u, "").trim();
}

/**
 * Converts a closed set of ordinary Korean note endings into a server-owned
 * sentence. Unsupported grammar fails closed instead of copying provider or
 * owner prose into the final report.
 */
function renderDeterministicSourceFactSentence(sourceText: string, field: CareReportSemanticField) {
  const source = stripTerminalSentencePunctuation(sourceText);
  if (!source) rejectCareReportSafety("claim_validation_rejected");

  if (field === "homeCareTips") {
    let instruction = "";
    if (/해\s*주세요$/u.test(source)) {
      instruction = source.replace(/해\s*주세요$/u, "해 주시기 바랍니다");
    } else if (/주세요$/u.test(source)) {
      instruction = source.replace(/주세요$/u, "주시기 바랍니다");
    }
    if (!instruction) rejectCareReportSafety("claim_validation_rejected");
    return `홈케어 안내로 ${instruction}.`;
  }

  const rules: Array<[RegExp, string]> = [
    [/있었어요$/u, "있었던"],
    [/없었어요$/u, "없었던"],
    [/보였어요$/u, "보인"],
    [/이었어요$/u, "이었던"],
    [/였어요$/u, "였던"],
    [/했어요$/u, "한"],
    [/았어요$/u, "은"],
    [/었어요$/u, "은"],
    [/했습니다$/u, "한"],
    [/했음$/u, "한"],
    [/함$/u, "한"],
  ];
  const rule = rules.find(([pattern]) => pattern.test(source));
  if (!rule) rejectCareReportSafety("claim_validation_rejected");
  const clause = source.replace(rule[0], rule[1]);

  if (field === "oneLineSummary") {
    return `${clause} 점을 중심으로 오늘 케어 기록을 정리했습니다.`;
  }
  if (field === "groomingResponse") {
    return `미용 중 ${clause} 반응을 확인했습니다.`;
  }
  return `상태 기록에서 ${clause} 점을 확인했습니다.`;
}

function isDeterministicSourceFactRendering(
  sentence: string,
  factText: string,
  field: CareReportSemanticField,
) {
  try {
    return splitCareSentences(factText).some((factSentence) =>
      renderDeterministicSourceFactSentence(factSentence, field) === sentence);
  } catch {
    return false;
  }
}

const supportedBathPositiveSourcePattern =
  /^목욕(?:을|은)?잘(?:했|진행됐|마쳤)(?:고|으며)(?:(?:전반적인)?상태(?:도|가)?(?:괜찮|양호)|컨디션(?:도|이)?좋|괜찮)(?:았습니다|었어요|았다|했어요|습니다)?$/;
const supportedBathPositiveDraftPattern =
  /^목욕(?:을|은)?잘(?:마쳤|진행했|완료했)(?:으며|고)(?:(?:전반적인)?상태(?:도|가)?(?:괜찮|양호)|컨디션(?:도|이)?좋)(?:했습니다|았습니다|했어요|아요|습니다)?$/;

function isSupportedSourceBackedParaphrase(sentence: string, factText: string) {
  return supportedBathPositiveSourcePattern.test(normalizeGroundedClaim(factText)) &&
    supportedBathPositiveDraftPattern.test(normalizeGroundedClaim(sentence));
}

const benignPositiveObservationSubjectPattern = "(?:발톱|피부)";
const benignPositiveObservationPredicatePattern =
  "(?:좋(?:다|습니다|았습니다|아요|았어요|고|으며)|양호(?:하다|합니다|했습니다|해요|했어요|하고|하며))";
const benignPositiveObservationClausePattern = new RegExp(
  `(${benignPositiveObservationSubjectPattern})(?:상태)?(?:가|도|는|은|이)?${benignPositiveObservationPredicatePattern}`,
  "g",
);
const benignPositiveObservationJointPattern = new RegExp(
  `^(${benignPositiveObservationSubjectPattern})(?:상태)?(?:과|와|및)(${benignPositiveObservationSubjectPattern})(?:상태)?(?:가|도|는|은|이)?(?:모두)?${benignPositiveObservationPredicatePattern}$`,
);

function parseBenignPositiveObservationSubjects(value: string) {
  const normalized = normalizeGroundedClaim(value);
  const joint = benignPositiveObservationJointPattern.exec(normalized);
  if (joint) return new Set(joint.slice(1));

  const matches = [...normalized.matchAll(benignPositiveObservationClausePattern)];
  if (!matches.length || matches.map((match) => match[0]).join("") !== normalized) return null;
  return new Set(matches.map((match) => match[1]));
}

function isSupportedBenignPositiveObservationParaphrase(sentence: string, factText: string) {
  const sentenceSubjects = parseBenignPositiveObservationSubjects(sentence);
  const factSubjects = parseBenignPositiveObservationSubjects(factText);
  return Boolean(
    sentenceSubjects &&
    factSubjects &&
    sentenceSubjects.size === factSubjects.size &&
    [...sentenceSubjects].every((subject) => factSubjects.has(subject)),
  );
}

/**
 * Provider output is validated against the operator's exact source sentence before
 * this display-only pass runs. Each rule is intentionally narrow: it fixes grammar
 * without adding a new observation, interpretation, or care instruction.
 */
const sourceBackedDisplayPolishRules = [
  {
    source: "목욕잘했고컨디션좋았다",
    display: "목욕을 잘 마쳤고, 컨디션도 좋았습니다.",
  },
] as const;

function displayCitationKey(field: CareReportSourceFactCitation["field"], sentence: string) {
  return `${field}\u0000${sentence}`;
}

function polishSourceBackedDisplayDraft(
  draft: CareReportDraft,
  sourceFactCitations: CareReportSourceFactCitation[],
) {
  const replacements = new Map<string, string>();
  const polishField = (field: CareReportSourceFactCitation["field"], value: string) => splitCareSentences(value)
    .map((sentence) => {
      const display = sourceBackedDisplayPolishRules.find((rule) => rule.source === normalizeGroundedClaim(sentence))?.display;
      if (!display) return sentence;
      replacements.set(displayCitationKey(field, sentence), display);
      return display;
    })
    .join(" ");

  return {
    draft: {
      ...draft,
      oneLineSummary: polishField("oneLineSummary", draft.oneLineSummary),
      conditionSummary: polishField("conditionSummary", draft.conditionSummary),
      groomingResponse: polishField("groomingResponse", draft.groomingResponse),
      homeCareTips: draft.homeCareTips.map((tip) => polishField("homeCareTips", tip)),
    },
    sourceFactCitations: sourceFactCitations.map((citation) => ({
      ...citation,
      sentence: replacements.get(displayCitationKey(citation.field, citation.sentence)) ?? citation.sentence,
    })),
  };
}

/** A claim must contain a complete atomic fact sentence (or vice versa), never a fuzzy shared token. */
function hasFactClaimBinding(sentence: string, factTexts: string[], field: CareReportSemanticField) {
  const normalizedSentence = normalizeGroundedClaim(sentence);
  if (normalizedSentence.length < 6) return false;
  return factTexts.some((factText) => splitCareSentences(factText).some((factSentence) => {
    const normalizedFactSentence = normalizeGroundedClaim(factSentence);
    return normalizedFactSentence.length >= 6 &&
      (normalizedFactSentence.includes(normalizedSentence) ||
        normalizedSentence.includes(normalizedFactSentence) ||
        isSupportedSourceBackedParaphrase(sentence, factSentence) ||
        isSupportedBenignPositiveObservationParaphrase(sentence, factSentence) ||
        isDeterministicSourceFactRendering(sentence, factSentence, field));
  }));
}

const unsupportedNormalityPatterns = [
  /(?:문제|이상)\s*없(?:어요|습니다|었|는)/,
  /(?:건강|깨끗|청결)(?:해|한|합니다|했|해요)/,
  /(?:괜찮|양호)/,
  /(?:컨디션|상태).{0,8}(?:좋|양호|괜찮)/,
  /(?:healthy|clean|problem[-\s]?free)/i,
];

const unsupportedCausePatterns = [
  /(?:때문에|원인(?:은|이|으로)|가능성|의심)/,
  /(?:샴푸|목욕|미용|드라이).{0,24}(?:때문에|원인)/,
];

const neutralHospitalGuidancePattern = /^(?:지속되거나\s*심해지면\s*)?동물병원에\s*문의해\s*주세요[.!]?$/;

const citationCategories: Record<CareReportSourceFactCitation["field"], CareReportObservations["sourceFacts"][number]["category"][]> = {
  oneLineSummary: ["general", "condition", "skin_ears", "behavior", "special"],
  conditionSummary: ["general", "condition", "skin_ears", "special"],
  groomingResponse: ["general", "behavior", "special"],
  homeCareTips: ["general", "special"],
};

export function assertSourceFactProvenance(
  sourceFactIds: string[],
  sourceFactCitations: CareReportSourceFactCitation[],
  context: CareReportContext,
  draft: CareReportDraft,
) {
  const factsById = new Map(context.observations.sourceFacts.map((fact) => [fact.id, fact]));
  const allowedIds = new Set(factsById.keys());
  const citedIds = sourceFactCitations.flatMap((citation) => citation.sourceFactIds);
  if ([...sourceFactIds, ...citedIds].some((id) => !allowedIds.has(id))) {
    rejectCareReportSafety("citation_validation_rejected");
  }
  if (sourceFactCitations.some((citation) => new Set(citation.sourceFactIds).size !== citation.sourceFactIds.length)) {
    rejectCareReportSafety("citation_validation_rejected");
  }
  const citationRowKeys = sourceFactCitations.map((citation) => [
    citation.field,
    citation.sentence.normalize("NFC"),
    [...new Set(citation.sourceFactIds)].sort().join(","),
  ].join("\u0000"));
  if (new Set(citationRowKeys).size !== citationRowKeys.length) {
    rejectCareReportSafety("citation_validation_rejected");
  }
  const declaredIds = new Set(sourceFactIds);
  const citedIdSet = new Set(citedIds);
  if (declaredIds.size !== sourceFactIds.length ||
    declaredIds.size !== citedIdSet.size ||
    [...declaredIds].some((id) => !citedIdSet.has(id))) {
    rejectCareReportSafety("citation_validation_rejected");
  }

  const hasOwnerDetail = Boolean(context.observations.sourceFacts.length || context.voiceTranscript.trim());
  const containsOwnerDetail = Boolean(
    draft.conditionSummary || draft.groomingResponse || draft.homeCareTips.length ||
    (hasOwnerDetail && draft.oneLineSummary),
  );
  if (containsOwnerDetail && sourceFactIds.length === 0) {
    rejectCareReportSafety("citation_validation_rejected");
  }

  const fields: Array<[CareReportSourceFactCitation["field"], string[]]> = [
    ["oneLineSummary", splitCareSentences(draft.oneLineSummary)],
    ["conditionSummary", splitCareSentences(draft.conditionSummary)],
    ["groomingResponse", splitCareSentences(draft.groomingResponse)],
    ["homeCareTips", draft.homeCareTips.flatMap(splitCareSentences)],
  ];
  for (const [field, sentences] of fields) {
    for (const sentence of sentences) {
      const citations = sourceFactCitations.filter((citation) => citation.field === field && citation.sentence === sentence);
      if (!citations.length) rejectCareReportSafety("citation_validation_rejected");
      const citedFacts = citations.flatMap((citation) => citation.sourceFactIds
        .map((id) => factsById.get(id))
        .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact)));
      if (!citedFacts.length || citedFacts.some((fact) => !citationCategories[field].includes(fact.category))) {
        rejectCareReportSafety("citation_validation_rejected");
      }
      if (hospitalGuidancePattern.test(sentence)) {
        if (!neutralHospitalGuidancePattern.test(sentence) || !citedFacts.every((fact) => dangerFactPattern.test(fact.text))) {
          rejectCareReportSafety("citation_validation_rejected");
        }
        continue;
      }
      if (unsupportedCausePatterns.some((pattern) => pattern.test(sentence))) {
        rejectCareReportSafety("claim_validation_rejected");
      }
      if (citedFacts.some((fact) => !hasFactClaimBinding(sentence, [fact.text], field))) {
        rejectCareReportSafety("claim_validation_rejected");
      }
      if (unsupportedNormalityPatterns.some((pattern) => pattern.test(sentence)) &&
        !citedFacts.some((fact) => unsupportedNormalityPatterns.some((pattern) => pattern.test(fact.text)))) {
        rejectCareReportSafety("claim_validation_rejected");
      }
    }
  }
}

function renderCareReportSemanticPlan(
  plan: z.infer<typeof careReportSemanticPlanSchema>,
  context: CareReportContext,
) {
  const sourceFacts = context.observations.sourceFacts;
  const factsById = new Map(sourceFacts.map((fact) => [fact.id, fact]));
  const summaryFact = sourceFacts[0];
  const expectedIds = sourceFacts.slice(1).map((fact) => fact.id).sort();
  const placedIds = plan.factPlacements.map((placement) => placement.sourceFactId);
  const uniquePlacedIds = [...new Set(placedIds)].sort();
  if (
    placedIds.length !== expectedIds.length ||
    uniquePlacedIds.length !== placedIds.length ||
    uniquePlacedIds.some((id, index) => id !== expectedIds[index])
  ) {
    rejectCareReportSafety("citation_validation_rejected");
  }

  const homeCarePlacementCount = plan.factPlacements
    .filter((placement) => placement.field === "homeCareTips").length;
  if (homeCarePlacementCount > 4) {
    rejectCareReportSafety("citation_validation_rejected");
  }

  const rendered: Record<CareReportSemanticField, string[]> = {
    oneLineSummary: [],
    conditionSummary: [],
    groomingResponse: [],
    homeCareTips: [],
  };
  const sourceFactCitations: CareReportSourceFactCitation[] = [];

  if (summaryFact) {
    const summarySentences = splitCareSentences(summaryFact.text)
      .map((sentence) => renderDeterministicSourceFactSentence(sentence, "oneLineSummary"));
    rendered.oneLineSummary.push(...summarySentences);
    sourceFactCitations.push(...summarySentences.map((sentence) => ({
      field: "oneLineSummary" as const,
      sentence,
      sourceFactIds: [summaryFact.id],
    })));
  }

  for (const placement of plan.factPlacements) {
    const fact = factsById.get(placement.sourceFactId);
    if (!fact || !citationCategories[placement.field].includes(fact.category)) {
      rejectCareReportSafety("citation_validation_rejected");
    }
    const sentences = splitCareSentences(fact.text);
    if (!sentences.length) rejectCareReportSafety("claim_validation_rejected");
    const renderedSentences = sentences.map((sentence) =>
      renderDeterministicSourceFactSentence(sentence, placement.field));
    const renderedValue = renderedSentences.join(" ");
    rendered[placement.field].push(renderedValue);
    sourceFactCitations.push(...renderedSentences.map((sentence) => ({
      field: placement.field,
      sentence,
      sourceFactIds: [fact.id],
    })));
  }

  const draftResult = careReportDraftSchema.safeParse({
    oneLineSummary: rendered.oneLineSummary.join(" ") ||
      `${context.petName}가 오늘 ${context.serviceName || "예약한 미용"}을 마쳤어요.`,
    treatmentSummary: buildVerifiedTreatmentSummary(
      context.serviceName,
      context.automaticFacts.actualDurationMinutes,
    ),
    conditionSummary: rendered.conditionSummary.join(" "),
    groomingResponse: rendered.groomingResponse.join(" "),
    homeCareTips: rendered.homeCareTips,
    nextVisitGuide: buildVerifiedNextVisitGuide(context.automaticFacts.nextRecommendedVisitDate),
  });
  if (!draftResult.success) rejectCareReportSafety("section_validation_rejected");
  const generatedResponseResult = careReportGeneratedResponseSchema.safeParse({
    ...draftResult.data,
    sourceFactIds: sourceFacts.map((fact) => fact.id),
    sourceFactCitations,
  });
  if (!generatedResponseResult.success) rejectCareReportSafety("citation_validation_rejected");
  const {
    sourceFactIds,
    sourceFactCitations: validatedSourceFactCitations,
    ...draft
  } = generatedResponseResult.data;
  const sourceTexts = context.observations.sourceFacts.map((fact) => fact.text);
  if (
    sourceTexts.some((sourceText) => hasCareReportExactSourceEcho(sourceText, draft)) ||
    (context.currentDraft && isCareReportDraftUnchanged(context.currentDraft, draft))
  ) {
    rejectCareReportSafety("echo_validation_rejected");
  }

  assertSourceFactProvenance(sourceFactIds, validatedSourceFactCitations, context, draft);
  assertObservationOnlyCareReport(draft);
  assertCareReportDraftPiiFree(draft);
  assertGroundedWeightGuidance(draft, context);

  return { draft, sourceFactCitations: validatedSourceFactCitations };
}

export function parseAndValidateCareReportProviderOutput(
  providerOutput: unknown,
  context: CareReportContext,
  options: { requireSemanticPlan?: boolean } = {},
) {
  try {
    const data = providerOutput as DeepSeekChatResponse;
    const choices = data?.choices;
    if (!Array.isArray(choices) || !choices.length) {
      rejectCareReportSafety("envelope_validation_rejected");
    }
    const choice = choices[0];
    if (!choice || typeof choice !== "object" || !choice.message || typeof choice.message !== "object") {
      rejectCareReportSafety("envelope_validation_rejected");
    }
    if (choice.finish_reason === "length") {
      rejectCareReportSafety("truncated_output_validation_rejected");
    }
    const content = choice.message.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      rejectCareReportSafety("content_type_validation_rejected");
    }

    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      rejectCareReportSafety("structure_validation_rejected");
    }
    if (typeof parsedContent === "string") {
      try {
        parsedContent = JSON.parse(parsedContent);
      } catch {
        rejectCareReportSafety("structure_validation_rejected");
      }
    }
    if (!parsedContent || typeof parsedContent !== "object" || Array.isArray(parsedContent)) {
      rejectCareReportSafety("structure_validation_rejected");
    }

    const contentRecord = parsedContent as Record<string, unknown>;
    if (Object.hasOwn(contentRecord, "factPlacements")) {
      const semanticPlanResult = careReportSemanticPlanSchema.safeParse(contentRecord);
      if (!semanticPlanResult.success) {
        rejectCareReportSafety(
          Object.keys(contentRecord).some((key) => key !== "factPlacements")
            ? "unexpected_field_validation_rejected"
            : "citation_validation_rejected",
        );
      }
      const usage = normalizeCareReportUsage(data.usage);
      return {
        ...renderCareReportSemanticPlan(semanticPlanResult.data, context),
        usage,
      };
    }
    if (options.requireSemanticPlan) {
      rejectCareReportSafety("structure_validation_rejected");
    }

    const generatedResponseKeys = new Set([
      "oneLineSummary",
      "treatmentSummary",
      "conditionSummary",
      "groomingResponse",
      "homeCareTips",
      "nextVisitGuide",
      "sourceFactIds",
      "sourceFactCitations",
    ]);
    const citationKeys = new Set(["field", "sentence", "sourceFactIds"]);
    const hasUnexpectedTopLevelField = Object.keys(contentRecord)
      .some((key) => !generatedResponseKeys.has(key));
    const hasUnexpectedCitationField = Array.isArray(contentRecord.sourceFactCitations) &&
      contentRecord.sourceFactCitations.some((citation) => citation && typeof citation === "object" && !Array.isArray(citation) &&
        Object.keys(citation).some((key) => !citationKeys.has(key)));
    if (hasUnexpectedTopLevelField || hasUnexpectedCitationField) {
      rejectCareReportSafety("unexpected_field_validation_rejected");
    }

    if (!careReportDraftSchema.safeParse(contentRecord).success) {
      rejectCareReportSafety("section_validation_rejected");
    }
    const generatedResponseResult = careReportGeneratedResponseSchema.safeParse(contentRecord);
    if (!generatedResponseResult.success) {
      rejectCareReportSafety("citation_validation_rejected");
    }
    const generatedResponse = generatedResponseResult.data;
    const usage = normalizeCareReportUsage(data.usage);
    const { sourceFactIds, sourceFactCitations, ...generatedDraft } = generatedResponse;
    const sourceTexts = [context.voiceTranscript, ...context.observations.sourceFacts.map((fact) => fact.text)];
    if (sourceTexts.some((sourceText) => hasCareReportExactSourceEcho(sourceText, generatedDraft))) {
      rejectCareReportSafety("echo_validation_rejected");
    }
    assertSourceFactProvenance(sourceFactIds, sourceFactCitations, context, generatedDraft);
    const finalizedDraft = finalizeCareReportDraft(generatedDraft, {
      petName: context.petName,
      serviceName: context.serviceName,
      actualDurationMinutes: context.automaticFacts.actualDurationMinutes,
      nextRecommendedVisitDate: context.automaticFacts.nextRecommendedVisitDate,
      ownerSourceText: context.voiceTranscript,
      observations: context.observations,
      currentDraft: context.currentDraft,
    });
    if (
      sourceTexts.some((sourceText) => hasCareReportExactSourceEcho(sourceText, finalizedDraft)) ||
      (context.currentDraft && isCareReportDraftUnchanged(context.currentDraft, finalizedDraft))
    ) {
      rejectCareReportSafety("echo_validation_rejected");
    }
    const { draft, sourceFactCitations: displayedSourceFactCitations } = polishSourceBackedDisplayDraft(
      finalizedDraft,
      sourceFactCitations,
    );
    assertObservationOnlyCareReport(draft);
    assertCareReportDraftPiiFree(draft);
    assertGroundedWeightGuidance(draft, context);

    return {
      draft,
      sourceFactCitations: displayedSourceFactCitations,
      usage,
    };
  } catch (error) {
    throw normalizeCareReportSafetyError(error);
  }
}

export async function generateCareReportDraft(
  context: CareReportContext,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<CareReportAiResult> {
  if (!serverEnv.deepseekApiKey) {
    throw new CareReportGenerationError();
  }

  const model = serverEnv.deepseekModel;
  const prompt = buildCareReportPrompt(context);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), generationTimeoutMs);

  try {
    const response = await (options.fetchImpl ?? fetch)(deepseekChatCompletionsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.deepseekApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildCareReportProviderRequestBody(model, prompt)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`DeepSeek 초안 생성에 실패했습니다. (${response.status})`);
    }

    let providerOutput: unknown;
    try {
      providerOutput = await response.json();
    } catch (error) {
      throw normalizeCareReportSafetyError(error);
    }
    const { draft, sourceFactCitations, usage } = parseAndValidateCareReportProviderOutput(
      providerOutput,
      context,
      { requireSemanticPlan: true },
    );

    return {
      draft,
      sourceFactCitations,
      model,
      inputHash: hashCareReportInput(model, context),
      usage,
      estimatedCostUsd: estimateDeepSeekV4FlashCostUsd(usage),
    };
  } catch (error) {
    if (error instanceof CareReportSafetyValidationError) throw error;
    throw new CareReportGenerationError();
  } finally {
    clearTimeout(timeout);
  }
}
