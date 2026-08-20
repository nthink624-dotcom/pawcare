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
  observations: CareReportObservations;
  voiceTranscript: string;
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
      "당신은 반려동물 미용실 오너의 기록을 보호자에게 전달하기 좋은 한국어 케어리포트로 정리합니다.",
      "입력에 없는 사실을 만들지 마세요. 의료 진단, 질환 단정, 치료 지시를 하지 마세요.",
      "건강 관련 표현은 '관찰됨', '예민해 보임', '보호자가 확인해 주세요' 수준으로만 작성하세요.",
      "따뜻하지만 과장되지 않은 존댓말을 사용하고, 같은 내용을 반복하지 마세요.",
      "반드시 JSON 객체만 출력하세요.",
    ].join(" "),
    user: safeJson({
      pet: { name: context.petName, breed: context.petBreed || "미입력" },
      service: context.serviceName,
      observations: context.observations,
      voiceTranscript: context.voiceTranscript || undefined,
      output: {
        oneLineSummary: "오늘 케어의 핵심 한 문장",
        treatmentSummary: "오늘 진행한 미용",
        conditionSummary: "털·피부·귀·발·발톱에서 관찰한 상태",
        groomingResponse: "미용 중 아이의 반응",
        homeCareTips: ["집에서 할 수 있는 관리 팁 1~3개"],
        nextVisitGuide: "다음 관리 시점 안내. 날짜를 임의로 만들지 않기",
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
