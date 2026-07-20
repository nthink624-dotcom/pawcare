import { serverEnv } from "@/lib/server-env";
import type { AiBookingRecommendationMode } from "@/types/domain";

const deepseekChatCompletionsUrl = "https://api.deepseek.com/chat/completions";
const recommendationTimeoutMs = 2500;
const maxRecommendedSlots = 2;

type SlotRecommendationParams = {
  date: string;
  availableSlots: string[];
  baselineRecommendedSlots: string[];
  serviceName?: string;
  durationMinutes?: number;
  staffScoped: boolean;
  recommendationMode: AiBookingRecommendationMode;
  customInstruction: string;
  staffLoads: Array<{ staffId: string; bookingCount: number; bookedMinutes: number }>;
  eligibleStaffBySlot: Array<{ slot: string; staffIds: string[] }>;
};

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export type SlotRecommendationSource = "ai" | "rule";

type SlotRecommendationResult = {
  recommendedSlots: string[];
  source: SlotRecommendationSource;
};

const recommendationDedupeWindowMs = 5_000;
const recommendationRequests = new Map<
  string,
  { expiresAt: number; request: Promise<SlotRecommendationResult> }
>();

export function recommendAvailableSlotsWithAi(params: SlotRecommendationParams) {
  const requestKey = JSON.stringify(params);
  const now = Date.now();
  const cached = recommendationRequests.get(requestKey);
  if (cached && cached.expiresAt > now) {
    return cached.request;
  }

  for (const [key, entry] of recommendationRequests) {
    if (entry.expiresAt <= now) recommendationRequests.delete(key);
  }

  const request = computeAvailableSlotRecommendations(params);
  recommendationRequests.set(requestKey, {
    expiresAt: now + recommendationDedupeWindowMs,
    request,
  });
  return request;
}

async function computeAvailableSlotRecommendations(
  params: SlotRecommendationParams,
): Promise<SlotRecommendationResult> {
  const fallback = normalizeRecommendedSlots(params.baselineRecommendedSlots, params.availableSlots);

  if (
    params.availableSlots.length < 2 ||
    serverEnv.aiSlotRecommendationProvider.toLowerCase() === "off" ||
    !serverEnv.deepseekApiKey
  ) {
    return { recommendedSlots: fallback, source: "rule" as const };
  }

  try {
    const aiSlots = await requestDeepSeekSlotRecommendations(params);
    const normalized = normalizeRecommendedSlots(aiSlots, params.availableSlots);
    return normalized.length > 0
      ? { recommendedSlots: normalized, source: "ai" as const }
      : { recommendedSlots: fallback, source: "rule" as const };
  } catch {
    return { recommendedSlots: fallback, source: "rule" as const };
  }
}

function normalizeRecommendedSlots(recommendedSlots: string[], availableSlots: string[]) {
  const availableSlotSet = new Set(availableSlots);
  const normalized: string[] = [];

  for (const slot of recommendedSlots) {
    if (!availableSlotSet.has(slot) || normalized.includes(slot)) continue;
    normalized.push(slot);
    if (normalized.length >= maxRecommendedSlots) break;
  }

  return normalized;
}

function getRankingPolicy(params: SlotRecommendationParams) {
  const basePolicy = [
    "Return the best 2 slots in priority order.",
    "Never recommend a time outside availableSlots.",
  ];

  switch (params.recommendationMode) {
    case "staff_balance":
      return [
        "Prefer slots that can be handled by staff with fewer booked minutes and fewer bookings in staffLoads.",
        "Do not change a customer-selected staff member.",
        ...basePolicy,
      ];
    case "customer_convenience":
      return [
        "Prefer comfortable daytime slots and earlier practical choices when availability is similar.",
        "Avoid very late slots unless they are clearly the best available choice.",
        ...basePolicy,
      ];
    case "custom":
      return [
        "Follow the owner's customInstruction when it can be satisfied using availableSlots.",
        "When the instruction is ambiguous, prefer slots that reduce idle gaps.",
        ...basePolicy,
      ];
    case "continuity":
    default:
      return [
        "Prefer slots that reduce idle gaps before or after existing appointments.",
        "Prefer comfortable daytime slots over very late slots when choices are similar.",
        ...basePolicy,
      ];
  }
}

async function requestDeepSeekSlotRecommendations(params: SlotRecommendationParams) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), recommendationTimeoutMs);

  try {
    const response = await fetch(deepseekChatCompletionsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.deepseekApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.deepseekModel,
        messages: [
          {
            role: "system",
            content:
              "You rank grooming appointment start times. Output strict json only, with this shape: {\"recommendedSlots\":[\"HH:mm\"]}. Never invent slots outside availableSlots.",
          },
          {
            role: "user",
            content: JSON.stringify({
              date: params.date,
              serviceName: params.serviceName ?? "미용 서비스",
              durationMinutes: params.durationMinutes ?? null,
              staffScoped: params.staffScoped,
              availableSlots: params.availableSlots.slice(0, 40),
              currentRuleBasedRecommendations: params.baselineRecommendedSlots,
              recommendationMode: params.recommendationMode,
              customInstruction: params.customInstruction || undefined,
              staffLoads: params.staffLoads,
              eligibleStaffBySlot: params.eligibleStaffBySlot,
              rankingPolicy: getRankingPolicy(params),
              jsonExample: { recommendedSlots: ["13:00", "15:30"] },
            }),
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 120,
        temperature: 0.1,
        thinking: { type: "disabled" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const data = (await response.json()) as DeepSeekChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content) as { recommendedSlots?: unknown };
    return Array.isArray(parsed.recommendedSlots)
      ? parsed.recommendedSlots.filter((slot): slot is string => typeof slot === "string")
      : [];
  } finally {
    clearTimeout(timeout);
  }
}
