import { createHash } from "node:crypto";

import { z } from "zod";

import {
  CARE_REPORT_GENERATION_RETRY_MESSAGE,
  hasCareReportExactSourceEcho,
  isCareReportTextUnchanged,
  normalizeCareReportComparisonText,
  prepareCareReportSourceText,
} from "@/lib/care-report-draft";
import { serverEnv } from "@/lib/server-env";
import {
  CARE_REPORT_SAFETY_RULE_CODES,
  CareReportSafetyValidationError,
  assertGeneratedCareReportFidelity,
  assertSingleTextCareReportSafety,
  rejectCareReportSafety,
  toSafeCareReportSafetyDiagnostic,
  toSafeCareReportSafetyHttpResponse,
  type CareReportSafetyRuleCode,
} from "@/server/care-report-fact-safety";
import { careReportDraftSchema, type CareReportGenerationUsage } from "@/types/care-report";

export {
  CARE_REPORT_SAFETY_RULE_CODES,
  CareReportSafetyValidationError,
  toSafeCareReportSafetyDiagnostic,
  toSafeCareReportSafetyHttpResponse,
  type CareReportSafetyRuleCode,
};

const deepseekChatCompletionsUrl = "https://api.deepseek.com/chat/completions";
const generationTimeoutMs = 20_000;
export const CARE_REPORT_PROVIDER_SCHEMA_MAX_COMPACT_CHARACTERS = 120;
export const CARE_REPORT_PROVIDER_MAX_OUTPUT_TOKENS = 1_500;
export const CARE_REPORT_PROMPT_VERSION = "care-report-natural-single-text-v2" as const;

export type CareReportContext = {
  sourceText: string;
  currentReportText?: string;
  revisionRequest?: string;
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
  reportText: string;
  model: string;
  inputHash: string;
  usage: CareReportGenerationUsage;
  estimatedCostUsd: number;
};

export class CareReportGenerationError extends Error {
  constructor() {
    super(CARE_REPORT_GENERATION_RETRY_MESSAGE);
    this.name = "CareReportGenerationError";
  }
}

export function toSafeCareReportGenerationHttpResponse(_error: unknown) {
  return { status: 502, body: { message: CARE_REPORT_GENERATION_RETRY_MESSAGE } } as const;
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function hashCareReportInput(model: string, context: CareReportContext) {
  return createHash("sha256").update(JSON.stringify({ model, ...context })).digest("hex");
}

export function buildCareReportPrompt(context: CareReportContext) {
  const revision = Boolean(context.currentReportText && context.revisionRequest);
  return {
    system: [
      "당신은 반려동물 미용실이 보호자에게 보내는 한국어 케어리포트 본문을 작성합니다.",
      "반드시 reportText 문자열 하나만 가진 JSON 객체로 답하세요.",
      "제목, 소제목, 항목명, 불릿, 번호, 표, 섹션 구분을 만들지 마세요.",
      "직원의 반말, 메모체, 끊긴 음성 인식 문장, 반복어를 뜻이 바뀌지 않게 자연스럽고 전문적인 존댓말로 다듬으세요.",
      "입력에 있는 서로 다른 관찰, 진행 내용, 반응, 일반 소감을 하나도 빠뜨리지 마세요.",
      "짧은 입력은 1~2문장으로 짧고 정확하게, 내용이 여러 가지면 2~5문장으로 읽기 좋게 연결하세요.",
      "문단을 나누지 말고 문장들이 자연스럽게 이어지는 하나의 고객용 본문으로 작성하세요.",
      "조사와 어미, 문장 연결에 필요한 표현만 보완하고 사실 의미는 넓히지 마세요.",
      "'괜찮았어' 같은 일반적인 소감은 '전반적으로 편안하게 진행되었습니다'처럼 자연스럽고 정중하게 다듬을 수 있습니다.",
      "'싫어했다'는 '불편해했다'로, '쉬엄쉬엄 했다'는 '중간중간 쉬어가며 진행했다'로 의미를 유지해 다듬을 수 있습니다.",
      "예: '귀뒤 엉킴 좀 있었고 빗질 싫어해서 쉬엄쉬엄 함'은 '귀 뒤쪽에 엉킴이 있어 정리했습니다. 빗질 중 불편해해 중간중간 쉬어가며 진행했습니다.'처럼 작성합니다.",
      "입력에 없는 사실, 수치, 단위, 좌우, 부위, 부정 의미를 추가하거나 뒤집지 마세요.",
      "의료 진단, 원인 단정, 치료·처방 지시, 확정적 안심 표현을 만들지 마세요.",
      "연락처, 이메일, 주소 같은 개인정보를 출력하지 마세요.",
      "입력에 없는 홈케어 조언, 권장사항, 보호자 호칭, 상투적인 칭찬이나 과장으로 분량을 채우지 마세요.",
      "응답 전 원문과 초안을 대조해 원문의 각 사실이 반영됐고 새로운 사실이 없는지 확인하되, 검토 과정은 출력하지 마세요.",
      revision
        ? "현재 본문 전체와 수정 요청을 반영해 reportText 전체를 새 문자열로 교체하세요. 부분 패치나 변경 목록은 쓰지 마세요."
        : "원문 전체를 바탕으로 매끄러운 reportText를 작성하세요.",
    ].join(" "),
    user: safeJson(revision
      ? { currentReportText: context.currentReportText, revisionRequest: context.revisionRequest }
      : { sourceText: context.sourceText }),
  };
}

export function normalizeGeneratedCareReportText(value: string) {
  return value
    .normalize("NFC")
    .replace(/\r\n?|\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

export function buildSafeNaturalCareReportFallback(sourceText: string) {
  const compact = normalizeCareReportComparisonText(sourceText);
  if (/^(?:오늘)?(?:작업|미용)(?:은|이)?(?:전체적(?:으로)?|전반적(?:으로)?)괜찮(?:았어|았음|았어요|았습니다|았다)?$/u.test(compact)) {
    return "오늘 미용은 전반적으로 편안하게 진행되었습니다.";
  }
  return null;
}

export function buildCareReportProviderRequestBody(model: string, prompt: { system: string; user: string }) {
  return {
    model,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: { type: "json_object" },
    stream: false,
    temperature: 0.2,
    max_tokens: CARE_REPORT_PROVIDER_MAX_OUTPUT_TOKENS,
  };
}

export function normalizeCareReportUsage(usage: DeepSeekUsage | undefined): CareReportGenerationUsage {
  const finite = (value: number | undefined) => Number.isFinite(value) && (value ?? 0) >= 0 ? Math.round(value ?? 0) : 0;
  const promptTokens = finite(usage?.prompt_tokens);
  const completionTokens = finite(usage?.completion_tokens);
  const totalTokens = finite(usage?.total_tokens) || promptTokens + completionTokens;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    promptCacheHitTokens: finite(usage?.prompt_cache_hit_tokens),
    promptCacheMissTokens: finite(usage?.prompt_cache_miss_tokens),
  };
}

export function estimateDeepSeekV4FlashCostUsd(usage: CareReportGenerationUsage) {
  const inputTokens = Math.max(0, usage.promptTokens - usage.promptCacheHitTokens);
  return Number(((inputTokens * 0.28 + usage.promptCacheHitTokens * 0.028 + usage.completionTokens * 0.42) / 1_000_000).toFixed(8));
}

export function parseAndValidateCareReportProviderOutput(providerOutput: unknown, context: CareReportContext) {
  const envelope = providerOutput as DeepSeekChatResponse;
  const choice = envelope.choices?.[0];
  if (!choice || choice.finish_reason === "length" || typeof choice.message?.content !== "string") {
    rejectCareReportSafety("structure_validation_rejected");
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(choice.message.content);
  } catch {
    rejectCareReportSafety("structure_validation_rejected");
  }
  const parsed = careReportDraftSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const value = parsedJson && typeof parsedJson === "object" ? Object.keys(parsedJson as Record<string, unknown>) : [];
    rejectCareReportSafety(value.some((key) => key !== "reportText") ? "unexpected_field_validation_rejected" : "structure_validation_rejected");
  }
  let reportText = normalizeGeneratedCareReportText(parsed.data.reportText);
  if (!careReportDraftSchema.safeParse({ reportText }).success) rejectCareReportSafety("structure_validation_rejected");
  const groundingText = context.currentReportText && context.revisionRequest
    ? `${context.currentReportText}\n${context.revisionRequest}`
    : context.sourceText;
  if (!context.currentReportText && hasCareReportExactSourceEcho(context.sourceText, reportText)) {
    reportText = buildSafeNaturalCareReportFallback(context.sourceText) ?? reportText;
    if (hasCareReportExactSourceEcho(context.sourceText, reportText)) rejectCareReportSafety("echo_validation_rejected");
  }
  assertSingleTextCareReportSafety(reportText, groundingText);
  if (!context.currentReportText) assertGeneratedCareReportFidelity(reportText, context.sourceText);
  if (context.currentReportText && context.revisionRequest && isCareReportTextUnchanged(context.currentReportText, reportText)) {
    rejectCareReportSafety("echo_validation_rejected");
  }
  return { reportText, usage: normalizeCareReportUsage(envelope.usage) };
}

export function assertCareReportTextSafeForSave(reportText: string) {
  assertSingleTextCareReportSafety(reportText, reportText);
}

export async function generateCareReportDraft(
  context: CareReportContext,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<CareReportAiResult> {
  if (!serverEnv.deepseekApiKey && !options.fetchImpl) throw new CareReportGenerationError();
  const safeContext: CareReportContext = {
    sourceText: prepareCareReportSourceText(context.sourceText),
    ...(context.currentReportText
      ? { currentReportText: prepareCareReportSourceText(context.currentReportText) }
      : {}),
    ...(context.revisionRequest
      ? { revisionRequest: prepareCareReportSourceText(context.revisionRequest).slice(0, 1000) }
      : {}),
  };
  const model = serverEnv.deepseekModel;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), generationTimeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(deepseekChatCompletionsUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${serverEnv.deepseekApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildCareReportProviderRequestBody(model, buildCareReportPrompt(safeContext))),
      signal: controller.signal,
    });
    if (!response.ok) throw new CareReportGenerationError();
    const providerOutput = await response.json();
    const result = parseAndValidateCareReportProviderOutput(providerOutput, safeContext);
    return {
      reportText: result.reportText,
      model,
      inputHash: hashCareReportInput(model, safeContext),
      usage: result.usage,
      estimatedCostUsd: estimateDeepSeekV4FlashCostUsd(result.usage),
    };
  } catch (error) {
    if (error instanceof CareReportSafetyValidationError || error instanceof CareReportGenerationError) throw error;
    throw new CareReportGenerationError();
  } finally {
    clearTimeout(timeout);
  }
}
