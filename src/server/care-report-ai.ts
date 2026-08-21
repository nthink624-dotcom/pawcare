import { createHash } from "node:crypto";

import { serverEnv } from "@/lib/server-env";
import {
  careReportDraftSchema,
  type CareReportDraft,
  type CareReportGenerationUsage,
  type CareReportObservations,
} from "@/types/care-report";

const deepseekChatCompletionsUrl = "https://api.deepseek.com/chat/completions";
const generationTimeoutMs = 15_000;

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
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: DeepSeekUsage;
};

export type CareReportAiResult = {
  draft: CareReportDraft;
  model: string;
  inputHash: string;
  usage: CareReportGenerationUsage;
  estimatedCostUsd: number;
};

function safeJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function buildCareReportPrompt(context: CareReportContext) {
  return {
    system: [
      "당신은 반려동물 미용실 오너가 직접 입력하거나 말한 내용을 보호자에게 전달하기 좋은 한국어로 다듬는 편집자입니다.",
      "오너 입력은 유일한 사람 판단 근거입니다. 입력에 담긴 관찰, 조치, 반응, 주의사항을 빠뜨리거나 의미를 바꾸지 마세요.",
      "currentDraft가 있으면 이것은 오너가 현재 화면에서 확인하거나 편집 중인 초안입니다. 최신 오너 요청에 필요한 부분만 수정하고, 요청하지 않은 기존 사실과 표현은 유지하세요.",
      "최신 오너 요청이 currentDraft의 내용을 삭제하거나 바꾸라는 뜻이 아니라면 기존 내용을 임의로 빼거나 전혀 다른 리포트로 다시 쓰지 마세요.",
      "자동 사실 데이터는 서비스명, 실제 작업 시간, 예상 작업 시간, 같은 아이의 몸무게 기록, 다음 권장일을 설명할 때만 사용하세요.",
      "입력과 자동 사실에 없는 미용 품질, 감정, 피부·귀·털 상태, 미용 반응, 홈케어 필요성을 만들지 마세요.",
      "몸무게는 같은 아이의 이전 측정값 또는 최근 기록 평균과만 비교하세요. 품종 평균으로 표현하지 마세요.",
      "체중과 최근 평균만으로 정상·과체중·저체중 또는 감량 필요를 판단하지 마세요. 오너 입력에 체형 평가나 체중 관리 지시가 명시된 경우에만 그 내용을 부드럽게 정리하세요.",
      "의료 진단, 질환 단정, 치료 지시를 하지 마세요.",
      "건강 관련 표현은 '관찰됨', '예민해 보임', '보호자가 확인해 주세요' 수준으로만 작성하세요.",
      "따뜻하지만 과장되지 않은 존댓말을 사용하고, 같은 내용을 반복하지 마세요.",
      "oneLineSummary는 1~3개의 짧은 문장과 160자 이내로 작성하세요. 오너 입력이 있으면 그 내용을 가장 먼저 보존해서 다듬고, 남는 범위에서 실제 서비스·작업 시간·몸무게 사실을 덧붙이세요.",
      "오너 입력이 비어 있으면 확인 가능한 서비스 완료, 실제 작업 시간, 몸무게 기록만 사용한 안전한 문장을 작성하세요.",
      "반드시 JSON 객체만 출력하세요.",
    ].join(" "),
    user: safeJson({
      pet: { name: context.petName, breed: context.petBreed || "미입력" },
      ownerSourceText: context.voiceTranscript || undefined,
      currentDraft: context.currentDraft,
      automaticFacts: {
        serviceName: context.serviceName,
        ...context.automaticFacts,
        weightAverageBasis: "같은 아이의 최근 실제 측정 기록",
      },
      extractedOwnerObservations: context.observations,
      output: {
        oneLineSummary: "오너 입력을 우선 보존해 자연스럽게 다듬은 디자이너의 한마디",
        treatmentSummary: "자동 사실에 있는 서비스와 실제 작업 시간만 사용",
        conditionSummary: "오너가 실제로 남긴 상태만 사용. 없으면 별도 상태 기록이 없다고 작성",
        groomingResponse: "오너가 실제로 남긴 반응만 사용. 없으면 별도 반응 기록이 없다고 작성",
        homeCareTips: ["오너 입력에 근거가 있는 안내만 작성. 없으면 별도 홈케어 안내가 없다고 작성"],
        nextVisitGuide: "자동 사실의 다음 권장일만 사용. 없으면 날짜를 임의로 만들지 않기",
      },
    }),
  };
}

export function hashCareReportInput(model: string, context: CareReportContext) {
  return createHash("sha256").update(`${model}:${safeJson(context)}`).digest("hex");
}

export function normalizeCareReportUsage(usage: DeepSeekUsage | undefined): CareReportGenerationUsage {
  const promptTokens = Math.max(0, usage?.prompt_tokens ?? 0);
  const completionTokens = Math.max(0, usage?.completion_tokens ?? 0);
  const promptCacheHitTokens = Math.max(0, usage?.prompt_cache_hit_tokens ?? 0);
  const explicitMissTokens = Math.max(0, usage?.prompt_cache_miss_tokens ?? 0);
  const promptCacheMissTokens = explicitMissTokens || Math.max(0, promptTokens - promptCacheHitTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens: Math.max(promptTokens + completionTokens, usage?.total_tokens ?? 0),
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
];

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
    throw new Error("AI 초안에 의료 진단처럼 보이는 표현이 포함되어 다시 작성이 필요합니다.");
  }
}

export async function generateCareReportDraft(
  context: CareReportContext,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<CareReportAiResult> {
  if (!serverEnv.deepseekApiKey) {
    throw new Error("DEEPSEEK_API_KEY 서버 설정을 확인해 주세요.");
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
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.3,
        thinking: { type: "disabled" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`DeepSeek 초안 생성에 실패했습니다. (${response.status})`);
    }

    const data = (await response.json()) as DeepSeekChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek가 빈 초안을 반환했습니다.");

    const draft = careReportDraftSchema.parse(JSON.parse(content));
    assertObservationOnlyCareReport(draft);
    const usage = normalizeCareReportUsage(data.usage);

    return {
      draft,
      model,
      inputHash: hashCareReportInput(model, context),
      usage,
      estimatedCostUsd: estimateDeepSeekV4FlashCostUsd(usage),
    };
  } finally {
    clearTimeout(timeout);
  }
}
