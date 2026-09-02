import { z } from "zod";

import type {
  ServicePriceGuide,
  ServicePriceGuideSection,
} from "@/components/owner-web/service-price-guide";
import { buildPriceGuideV2Compatibility } from "@/lib/auth/signup-service-pricing";
import { serverEnv } from "@/lib/server-env";
import {
  priceGuideV2Schema,
  type PriceGuidePhotoImportIssue,
  type PriceGuidePhotoImportResponse,
  type PriceGuideV2,
} from "@/types/price-guide-photo-import";

const openAiResponsesUrl = "https://api.openai.com/v1/responses";

export const PRICE_GUIDE_VISION_MODEL = "gpt-5.6-luna" as const;

export const PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD = 13_000;

export type PriceGuideProviderUsage = {
  inputTokens: number;
  outputTokens: number;
};

export function calculatePriceGuideProviderCostMicroUsd(
  model: string,
  usage: PriceGuideProviderUsage | null,
) {
  if (!usage || model !== PRICE_GUIDE_VISION_MODEL) {
    return PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD;
  }
  // gpt-5.6-luna: $0.20 / 1M input tokens, $1.20 / 1M output tokens.
  // micro-USD arithmetic: tokens * USD-per-million.
  const measured = Math.ceil((usage.inputTokens * 0.2) + (usage.outputTokens * 1.2));
  if (!Number.isSafeInteger(measured) || measured < 0) {
    return PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD;
  }
  return measured;
}

const confidenceSchema = z.enum(["high", "medium", "low"]);
const extractedCellSchema = z.object({
  weightBand: z.string(),
  price: z.string(),
  durationMinutes: z.string(),
  confidence: confidenceSchema,
  issue: z.string(),
});
const extractedItemSchema = z.object({
  label: z.string(),
  cells: z.array(extractedCellSchema),
});
const extractedSectionSchema = z.object({
  species: z.enum(["dog", "cat"]),
  title: z.string(),
  breeds: z.array(z.string()),
  weightBands: z.array(z.string()),
  items: z.array(extractedItemSchema),
});
const extractedExtraFeeSchema = z.object({
  label: z.string(),
  price: z.string(),
  confidence: confidenceSchema,
  issue: z.string(),
});
const extractionSchema = z.object({
  summary: z.string(),
  sections: z.array(extractedSectionSchema),
  extraFees: z.array(extractedExtraFeeSchema),
  extraNote: z.string(),
  warnings: z.array(z.string()),
});

type ExtractedPriceGuide = z.infer<typeof extractionSchema>;

export function redactPriceGuideRawTextForStorage(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactPriceGuideRawTextForStorage);
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === "rawText" ? "" : redactPriceGuideRawTextForStorage(item),
    ]),
  );
}

export const PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "source", "overallNote", "rows", "surcharges", "aiReview"],
  properties: {
    schemaVersion: { type: "integer", const: 2 },
    source: { type: "string", enum: ["ai_imported", "owner_corrected", "vision", "fixture", "manual", "owner_confirmed", "legacy"] },
    overallNote: { type: ["string", "null"] },
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "serviceName",
          "species",
          "breedNames",
          "breedGroup",
          "sizeClass",
          "minKg",
          "maxKg",
          "priceKind",
          "priceMinKrw",
          "priceMaxKrw",
          "durationMinutes",
          "note",
        ],
        properties: {
          serviceName: { type: ["string", "null"] },
          species: { type: "string", enum: ["dog", "cat", "all", "unknown"] },
          breedNames: { type: "array", items: { type: "string" } },
          breedGroup: { type: ["string", "null"] },
          sizeClass: { type: "string", enum: ["small", "medium", "large", "extra-large", "all", "unknown"] },
          minKg: { type: ["number", "null"], minimum: 0 },
          maxKg: { type: ["number", "null"], minimum: 0 },
          priceKind: { type: "string", enum: ["fixed", "starting", "range", "unknown"] },
          priceMinKrw: { type: ["integer", "null"], minimum: 0 },
          priceMaxKrw: { type: ["integer", "null"], minimum: 0 },
          durationMinutes: { type: ["integer", "null"], minimum: 1 },
          note: { type: ["string", "null"] },
        },
      },
    },
    surcharges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["condition", "amountKrw", "percent", "note"],
        properties: {
          condition: { type: ["string", "null"] },
          amountKrw: { type: ["integer", "null"], minimum: 0 },
          percent: { type: ["number", "null"], minimum: 0 },
          note: { type: ["string", "null"] },
        },
      },
    },
    aiReview: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["targetId", "field", "rawText", "confidence", "userConfirmed", "userCorrected"],
        properties: {
          targetId: { type: "string" },
          field: { type: "string" },
          rawText: { type: "string" },
          confidence: { type: "string", enum: ["medium", "low"] },
          userConfirmed: { type: "boolean" },
          userCorrected: { type: "boolean" },
        },
      },
    },
  },
} as const;

function cleanText(value: string, maxLength = 120) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanDigits(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 9);
}

function cleanPrice(value: string) {
  const digits = cleanDigits(value);
  if (!digits) return "";
  return value.includes("~") || value.includes("부터") ? `${digits}~` : digits;
}

function createStableId(prefix: string, parts: Array<string | number>) {
  const body = parts
    .map((part) => String(part).toLocaleLowerCase("ko-KR").replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-")
    .slice(0, 100);
  return `${prefix}_${body || "item"}`;
}

function distinctText(values: string[]) {
  return [...new Set(values.map((value) => cleanText(value, 60)).filter(Boolean))];
}

export function normalizePriceGuidePhotoExtraction(
  extracted: ExtractedPriceGuide,
): Pick<PriceGuidePhotoImportResponse, "guide" | "summary" | "issues"> {
  const issues: PriceGuidePhotoImportIssue[] = [];
  const sections: ServicePriceGuideSection[] = extracted.sections.flatMap((section, sectionIndex) => {
    const title = cleanText(section.title, 60) || `${section.species === "cat" ? "고양이" : "강아지"} 요금`;
    const allCellBands = section.items.flatMap((item) => item.cells.map((cell) => cell.weightBand));
    const weightBands = distinctText([...section.weightBands, ...allCellBands]);
    if (weightBands.length === 0) return [];

    const items = section.items.flatMap((item, itemIndex) => {
      const label = cleanText(item.label, 80);
      if (!label) return [];
      const cellByBand = new Map(item.cells.map((cell) => [cleanText(cell.weightBand, 60), cell]));
      return [{
        id: createStableId("photo_item", [sectionIndex, itemIndex, label]),
        label,
        cells: Object.fromEntries(weightBands.map((weightBand) => {
          const cell = cellByBand.get(weightBand);
          const price = cell ? cleanPrice(cell.price) : "";
          const durationMinutes = cell ? cleanDigits(cell.durationMinutes) : "";
          if (!cell || cell.confidence !== "high" || !price) {
            issues.push({
              path: `${title} / ${label} / ${weightBand}`,
              message: cleanText(cell?.issue || (!price ? "가격을 확인해 주세요." : "사진의 글자를 다시 확인해 주세요."), 160),
              confidence: cell?.confidence === "medium" ? "medium" : "low",
            });
          }
          return [weightBand, { price, durationMinutes }];
        })),
      }];
    });
    if (items.length === 0) return [];

    return [{
      id: createStableId("photo_section", [sectionIndex, section.species, title]),
      species: section.species,
      title,
      note: distinctText(section.breeds).join(", "),
      weightBands,
      items,
    }];
  });

  const extraFees = extracted.extraFees.flatMap((fee, index) => {
    const label = cleanText(fee.label, 80);
    if (!label) return [];
    const price = cleanPrice(fee.price);
    if (fee.confidence !== "high" || !price) {
      issues.push({
        path: `추가요금 / ${label}`,
        message: cleanText(fee.issue || "추가요금을 확인해 주세요.", 160),
        confidence: fee.confidence === "medium" ? "medium" : "low",
      });
    }
    return [{ id: createStableId("photo_fee", [index, label]), label, price }];
  });

  for (const warning of extracted.warnings) {
    const message = cleanText(warning, 160);
    if (message) issues.push({ path: "원본 전체", message, confidence: "low" });
  }

  const guide: ServicePriceGuide = {
    enabled: true,
    weightBands: sections[0]?.weightBands ?? [],
    items: [],
    sections,
    extraNote: extracted.extraNote.trim().slice(0, 2000),
    extraFees,
  };

  return {
    guide,
    summary: cleanText(extracted.summary, 240) || `요금표 ${sections.length}개 그룹을 읽었습니다.`,
    issues,
  };
}

export type PriceGuidePhotoImportErrorCode =
  | "VISION_CONFIG_MISSING"
  | "VISION_RATE_LIMITED"
  | "VISION_QUOTA_EXCEEDED"
  | "VISION_PROVIDER_HTTP_ERROR"
  | "VISION_RESPONSE_INCOMPLETE"
  | "VISION_RESPONSE_REFUSAL"
  | "VISION_RESPONSE_EMPTY"
  | "VISION_RESPONSE_SCHEMA_INVALID"
  | "VISION_RESPONSE_STATUS_INVALID"
  | "VISION_NO_ROWS";

export class PriceGuidePhotoImportError extends Error {
  public readonly code: PriceGuidePhotoImportErrorCode;
  public readonly status: number;
  public readonly incompleteReason?: string;
  public readonly retryAfterSeconds?: number;

  constructor(
    code: PriceGuidePhotoImportErrorCode,
    message: string,
    status: number,
    incompleteReason?: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "PriceGuidePhotoImportError";
    this.code = code;
    this.status = status;
    this.incompleteReason = incompleteReason;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function providerErrorCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  const type = (error as { type?: unknown }).type;
  return [code, type].find((value): value is string => typeof value === "string")?.toLowerCase() ?? "";
}

function normalizeRetryAfter(value: string | null | undefined) {
  const seconds = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(seconds) && seconds > 0 ? Math.min(seconds, 300) : 30;
}

export function classifyPriceGuideProviderHttpError(
  status: number,
  payload: unknown,
  retryAfter?: string | null,
) {
  const code = providerErrorCode(payload);
  if (status === 429 && ["insufficient_quota", "billing_hard_limit_reached", "usage_limit_reached"].includes(code)) {
    return new PriceGuidePhotoImportError(
      "VISION_QUOTA_EXCEEDED",
      "이번 달 사진 자동 입력 한도에 도달했습니다. 사진 없이 직접 입력해 주세요.",
      429,
    );
  }
  if (status === 429) {
    const retryAfterSeconds = normalizeRetryAfter(retryAfter);
    return new PriceGuidePhotoImportError(
      "VISION_RATE_LIMITED",
      "사진 분석 요청이 잠시 많습니다. 잠시 후 다시 시도하거나 사진 없이 직접 입력해 주세요.",
      429,
      undefined,
      retryAfterSeconds,
    );
  }
  if (status === 401 || status === 403) {
    return new PriceGuidePhotoImportError(
      "VISION_CONFIG_MISSING",
      "사진 자동 입력을 사용할 수 없습니다. 사진 없이 직접 입력해 주세요.",
      503,
    );
  }
  return new PriceGuidePhotoImportError(
    "VISION_PROVIDER_HTTP_ERROR",
    "사진 판독 서버가 응답하지 않았습니다. 잠시 후 다시 시도하거나 사진 없이 직접 입력해 주세요.",
    502,
  );
}

function getResponseOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const source = payload as { output_text?: unknown; output?: unknown };
  if (typeof source.output_text === "string") return source.output_text;
  if (!Array.isArray(source.output)) return "";
  for (const item of source.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        (block as { type?: unknown }).type !== "refusal" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        return (block as { text: string }).text;
      }
    }
  }
  return "";
}

function hasResponseRefusal(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return false;
  return output.some((item) => {
    if (!item || typeof item !== "object") return false;
    const content = (item as { content?: unknown }).content;
    return Array.isArray(content) && content.some((block) =>
      block && typeof block === "object" && (block as { type?: unknown }).type === "refusal",
    );
  });
}

export function parsePriceGuideResponsesPayload(payload: unknown): PriceGuideV2 {
  if (!payload || typeof payload !== "object") {
    throw new PriceGuidePhotoImportError(
      "VISION_RESPONSE_SCHEMA_INVALID",
      "사진 판독 결과 형식을 확인하지 못했습니다. 다시 촬영하거나 직접 입력해 주세요.",
      502,
    );
  }
  const response = payload as {
    status?: unknown;
    incomplete_details?: unknown;
  };
  if (response.status === "incomplete") {
    const details = response.incomplete_details;
    const reason = details && typeof details === "object" && typeof (details as { reason?: unknown }).reason === "string"
      ? (details as { reason: string }).reason.slice(0, 80)
      : "unknown";
    throw new PriceGuidePhotoImportError(
      "VISION_RESPONSE_INCOMPLETE",
      "사진 판독 결과가 중간에 끝났습니다. 사진을 나눠 촬영하거나 다시 시도해 주세요.",
      502,
      reason,
    );
  }
  if (typeof response.status === "string" && response.status !== "completed") {
    throw new PriceGuidePhotoImportError(
      "VISION_RESPONSE_STATUS_INVALID",
      "사진 판독이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.",
      502,
    );
  }
  if (hasResponseRefusal(payload)) {
    throw new PriceGuidePhotoImportError(
      "VISION_RESPONSE_REFUSAL",
      "이 사진은 자동 판독할 수 없습니다. 같은 화면에서 직접 입력해 주세요.",
      422,
    );
  }
  const outputText = getResponseOutputText(payload).trim();
  if (!outputText) {
    throw new PriceGuidePhotoImportError(
      "VISION_RESPONSE_EMPTY",
      "사진에서 판독 결과를 받지 못했습니다. 더 선명한 사진으로 다시 시도해 주세요.",
      502,
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(outputText);
  } catch {
    throw new PriceGuidePhotoImportError(
      "VISION_RESPONSE_SCHEMA_INVALID",
      "사진 판독 결과 형식을 확인하지 못했습니다. 다시 촬영하거나 직접 입력해 주세요.",
      502,
    );
  }
  const parsed = priceGuideV2Schema.safeParse(decoded);
  if (!parsed.success) {
    throw new PriceGuidePhotoImportError(
      "VISION_RESPONSE_SCHEMA_INVALID",
      "사진 판독 결과 형식을 확인하지 못했습니다. 다시 촬영하거나 직접 입력해 주세요.",
      502,
    );
  }
  return parsed.data;
}

function getResponseUsage(payload: unknown): PriceGuideProviderUsage | null {
  if (!payload || typeof payload !== "object") return null;
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = (usage as { input_tokens?: unknown }).input_tokens;
  const outputTokens = (usage as { output_tokens?: unknown }).output_tokens;
  if (!Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens)) return null;
  if ((inputTokens as number) < 0 || (outputTokens as number) < 0) return null;
  return { inputTokens: inputTokens as number, outputTokens: outputTokens as number };
}

export type PriceGuideResponsesClient = (input: {
  url: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
}) => Promise<unknown>;

export function createPriceGuideResponsesFixture(document: PriceGuideV2) {
  return {
    status: "completed",
    incomplete_details: null,
    output: [{
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: JSON.stringify(priceGuideV2Schema.parse(document)) }],
    }],
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  };
}

export async function extractPriceGuideFromImages(
  imageUrls: string[],
  options?: { timeoutMs?: number; responsesClient?: PriceGuideResponsesClient },
) {
  if (!options?.responsesClient && (!serverEnv.openaiPriceGuideEnabled || !serverEnv.openaiApiKey)) {
    throw new PriceGuidePhotoImportError(
      "VISION_CONFIG_MISSING",
      "사진 자동 입력을 사용할 수 없습니다. 사진 없이 직접 입력해 주세요.",
      503,
    );
  }
  if (imageUrls.length === 0 || imageUrls.length > 15) {
    throw new Error("요금표 분석 이미지는 1개부터 15개까지 사용할 수 있습니다.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(options?.timeoutMs ?? 60_000, 5_000), 60_000));
  try {
    const body = {
      model: PRICE_GUIDE_VISION_MODEL,
      store: false,
      max_output_tokens: 8_000,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "한국 반려동물 미용실 요금표 사진을 PriceGuideV2로 구조화하세요.",
              "사진에 실제로 보이는 내용만 옮기고 가격, 시간, 동물종, 견종, 체급, 무게 구간을 추측하지 마세요.",
              "확인할 수 없는 값은 반드시 null 또는 unknown으로 두고 숫자 기본값을 만들지 마세요.",
              "가격은 fixed, starting, range, unknown을 구분하고 범위의 두 숫자를 하나로 합치지 마세요.",
              "전체 메모, 행 메모, 금액/비율 추가요금, 견종 배열을 빠뜨리지 마세요.",
              "개인정보 보호를 위해 사진 위·아래와 가장자리가 가려질 수 있습니다. 가려진 글자를 추측하거나 복원하지 마세요.",
              "같은 원본의 전체 보기와 확대 크롭이 함께 들어올 수 있으므로 보이는 행을 중복 생성하지 마세요.",
              "각 필드를 독립적으로 판독하고 medium/low 확신, 누락, 사진 간 모순이 있는 모든 필드는 aiReview에 rows:{index} 또는 surcharges:{index} targetId, 정확한 필드명, 보이는 원문을 남기세요.",
              "개인 이름, 전화번호, 주소처럼 요금표가 아닌 개인정보는 결과와 rawText에 절대 포함하지 마세요.",
              "AI가 만든 문서이므로 source는 ai_imported, userConfirmed와 userCorrected는 false입니다.",
              "같은 요금표가 여러 사진에 겹쳐 보이면 중복 행을 만들지 마세요.",
            ].join("\n"),
          },
          ...imageUrls.map((imageUrl) => ({ type: "input_image", image_url: imageUrl, detail: "original" })),
        ],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "pet_grooming_price_guide_v2",
          strict: true,
          schema: PRICE_GUIDE_V2_RESPONSE_JSON_SCHEMA,
        },
      },
    } satisfies Record<string, unknown>;

    let payload: unknown;
    if (options?.responsesClient) {
      payload = await options.responsesClient({ url: openAiResponsesUrl, body, signal: controller.signal });
    } else {
      const response = await fetch(openAiResponsesUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverEnv.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        let providerPayload: unknown = null;
        try {
          providerPayload = await response.json() as unknown;
        } catch {
          providerPayload = null;
        }
        throw classifyPriceGuideProviderHttpError(
          response.status,
          providerPayload,
          response.headers.get("retry-after"),
        );
      }
      payload = await response.json() as unknown;
    }

    const parsedDocument = parsePriceGuideResponsesPayload(payload);
    const document = priceGuideV2Schema.parse({ ...parsedDocument, source: "ai_imported" });
    if (document.rows.length === 0) {
      throw new PriceGuidePhotoImportError(
        "VISION_NO_ROWS",
        "사진에서 요금표 행을 찾지 못했습니다. 더 선명한 사진으로 다시 시도해 주세요.",
        422,
      );
    }
    const compatibility = buildPriceGuideV2Compatibility(document);
    const providerUsage = getResponseUsage(payload);
    return {
      document,
      guide: compatibility.guide,
      summary: `요금 ${document.rows.length}개 행과 추가요금 ${document.surcharges.length}개를 읽었습니다.`,
      issues: compatibility.issues,
      model: PRICE_GUIDE_VISION_MODEL,
      providerUsage,
      providerCostMicroUsd: calculatePriceGuideProviderCostMicroUsd(PRICE_GUIDE_VISION_MODEL, providerUsage),
    };
  } finally {
    clearTimeout(timeout);
  }
}
