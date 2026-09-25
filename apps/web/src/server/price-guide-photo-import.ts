import { z } from "zod";

import type {
  ServicePriceGuide,
  ServicePriceGuideSection,
} from "@/components/owner-web/service-price-guide";
import { buildPriceGuideV2Compatibility } from "@/lib/auth/signup-service-pricing";
import {
  findPriceGuideStructuredConsistencyIssues,
  normalizeImportedPriceGuideStructure,
  parsePriceGuideGroupHeading,
  preparePriceGuidePhotoDraftForReview,
  reconcilePriceGuideStructuredDraft,
  type PriceGuideStructuredConsistencyIssue,
} from "@/lib/price-guide-structured-table";
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
export const PRICE_GUIDE_PROVIDER_TIMEOUT_MS = 60_000;
export const PRICE_GUIDE_PROVIDER_MAX_OUTPUT_TOKENS = 7_000;
export const PRICE_GUIDE_PROVIDER_REASONING_EFFORT = "low" as const;
export const PRICE_GUIDE_PROVIDER_TEXT_VERBOSITY = "low" as const;

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
  required: ["schemaVersion", "source", "overallNote", "tableGroups", "surcharges", "rows", "aiReview"],
  properties: {
    schemaVersion: { type: "integer", const: 2 },
    source: { type: "string", enum: ["ai_imported", "owner_corrected", "vision", "fixture", "manual", "owner_confirmed", "legacy"] },
    overallNote: { type: ["string", "null"], maxLength: 4_000 },
    tableGroups: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceLabel", "species", "breedNames", "sizeClass", "weightBands", "serviceNames", "note"],
        properties: {
          sourceLabel: {
            type: "string",
            minLength: 1,
            maxLength: 160,
            description: "사진의 단일 요금 분류 header/cell 원문. 실제 label을 동적으로 보존하며 서로 다른 셀의 텍스트를 합치지 않음",
          },
          species: { type: "string", enum: ["dog", "cat", "all", "unknown"] },
          breedNames: {
            type: "array",
            maxItems: 100,
            items: { type: "string", minLength: 1, maxLength: 80 },
          },
          sizeClass: { type: "string", enum: ["small", "medium", "large", "extra-large", "all", "unknown"] },
          weightBands: {
            type: "array",
            maxItems: 40,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "minKg", "maxKg", "note"],
              properties: {
                label: { type: "string", minLength: 1, maxLength: 80 },
                minKg: { type: ["number", "null"], minimum: 0, maximum: 1_000 },
                maxKg: { type: ["number", "null"], minimum: 0, maximum: 1_000 },
                note: { type: ["string", "null"], maxLength: 500 },
              },
            },
          },
          serviceNames: {
            type: "array",
            maxItems: 40,
            items: { type: "string", minLength: 1, maxLength: 120 },
          },
          note: { type: ["string", "null"], maxLength: 1_000 },
        },
      },
    },
    surcharges: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["condition", "amountKrw", "percent", "note"],
        properties: {
          condition: { type: ["string", "null"], maxLength: 200 },
          amountKrw: { type: ["integer", "null"], minimum: 0, maximum: 100_000_000 },
          percent: { type: ["number", "null"], minimum: 0, maximum: 1_000 },
          note: { type: ["string", "null"], maxLength: 1_000 },
        },
      },
    },
    rows: {
      type: "array",
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "g",
          "w",
          "s",
          "k",
          "p",
          "x",
          "t",
          "d",
          "n",
        ],
        properties: {
          g: { type: "integer", minimum: 0, description: "tableGroups index" },
          w: {
            anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
            description: "weightBands index; null only when the source group explicitly has no weight axis",
          },
          s: { type: "integer", minimum: 0, description: "serviceNames index" },
          k: { type: "string", enum: ["fixed", "starting", "range", "unknown"] },
          p: { type: ["integer", "null"], minimum: 0, maximum: 100_000_000, description: "minimum or visible price" },
          x: { type: ["integer", "null"], minimum: 0, maximum: 100_000_000, description: "maximum range price" },
          t: {
            type: "string",
            maxLength: 80,
            description: "해당 교차 셀에 보이는 가격 문자열의 공백·구분자·단위를 포함한 원문 전사",
          },
          d: {
            anyOf: [
              { type: "integer", minimum: 1, maximum: 1_440 },
              { type: "string", enum: [""] },
              { type: "null" },
            ],
            description: "explicit duration minutes; empty means unreadable",
          },
          n: { type: ["string", "null"], maxLength: 1_000, description: "cell note" },
        },
      },
    },
    aiReview: {
      type: "array",
      maxItems: 500,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["targetId", "field", "rawText", "confidence", "userConfirmed", "userCorrected"],
        properties: {
          targetId: { type: "string", minLength: 1, maxLength: 160 },
          field: { type: "string", minLength: 1, maxLength: 80 },
          rawText: { type: "string", maxLength: 500 },
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
  | "VISION_TIMEOUT"
  | "VISION_NO_ROWS";

export const PRICE_GUIDE_PROVIDER_VALIDATION_SAFE_SUBTYPES = [
  "NO_ROWS",
  "AXIS_INVALID",
  "SHAPE_INVALID",
  "SCHEMA_INVALID",
] as const;

export type PriceGuideProviderValidationSafeSubtype =
  (typeof PRICE_GUIDE_PROVIDER_VALIDATION_SAFE_SUBTYPES)[number];

export const PRICE_GUIDE_PROVIDER_INVALID_RESPONSE_CODE = "VISION_PROVIDER_INVALID_RESPONSE" as const;
export const PRICE_GUIDE_PROVIDER_INVALID_RESPONSE_MESSAGE =
  "사진 속 요금표 구조를 확인하지 못했습니다. 더 선명한 사진으로 다시 시도하거나 직접 입력해 주세요.";

export class PriceGuidePhotoImportError extends Error {
  public readonly code: PriceGuidePhotoImportErrorCode;
  public readonly status: number;
  public readonly incompleteReason?: string;
  public readonly retryAfterSeconds?: number;
  public readonly safeSubtype?: PriceGuideProviderValidationSafeSubtype;

  constructor(
    code: PriceGuidePhotoImportErrorCode,
    message: string,
    status: number,
    incompleteReason?: string,
    retryAfterSeconds?: number,
    safeSubtype?: PriceGuideProviderValidationSafeSubtype,
  ) {
    super(message);
    this.name = "PriceGuidePhotoImportError";
    this.code = code;
    this.status = status;
    this.incompleteReason = incompleteReason;
    this.retryAfterSeconds = retryAfterSeconds;
    this.safeSubtype = safeSubtype;
  }
}

export function toSafePriceGuideProviderValidationResponse(error: unknown) {
  if (!(error instanceof PriceGuidePhotoImportError)) return null;
  if (error.code !== "VISION_RESPONSE_SCHEMA_INVALID" && error.code !== "VISION_NO_ROWS") return null;
  const safeSubtype = error.safeSubtype
    && PRICE_GUIDE_PROVIDER_VALIDATION_SAFE_SUBTYPES.includes(error.safeSubtype)
    ? error.safeSubtype
    : null;
  return {
    code: PRICE_GUIDE_PROVIDER_INVALID_RESPONSE_CODE,
    ...(safeSubtype ? { safeSubtype } : {}),
    message: PRICE_GUIDE_PROVIDER_INVALID_RESPONSE_MESSAGE,
  };
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

const providerRowKeys = new Set([
  "g",
  "w",
  "s",
  "k",
  "p",
  "x",
  "t",
  "d",
  "n",
]);

function priceGuideSchemaError() {
  return new PriceGuidePhotoImportError(
    "VISION_RESPONSE_SCHEMA_INVALID",
    "사진 판독 결과 형식을 확인하지 못했습니다. 다시 촬영하거나 직접 입력해 주세요.",
    502,
    undefined,
    undefined,
    "SCHEMA_INVALID",
  );
}

function readProviderCoordinate(value: unknown, upperBound: number) {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < upperBound
    ? value as number
    : null;
}

function normalizeProviderNullableText(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function providerAxisTextKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[‐‑‒–—―−]/gu, "-")
    .replace(/[～〜]/gu, "~")
    .replace(/㎏|(?:킬로그램|키로그램|킬로|키로)/gu, "kg")
    .replace(/\s+/gu, "")
    .trim();
}

function providerWeightAxisKey(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const band = value as Record<string, unknown>;
  const normalizedLabel = providerAxisTextKey(band.label);
  const noteKey = band.note === null ? "" : providerAxisTextKey(band.note);
  if (normalizedLabel === null || noteKey === null) return null;
  const labelKey = normalizedLabel
    .replace(/(\d+(?:\.\d+)?)kg(?=[~-]\d)/gu, "$1")
    .replace(/-/gu, "~");
  if (!labelKey) return "";
  return JSON.stringify([
    labelKey,
    band.minKg,
    band.maxKg,
    noteKey,
  ]);
}

type ProviderAxisMaps = {
  weightBands: unknown[];
  serviceNames: unknown[];
  weightIndexMap: number[];
  serviceIndexMap: number[];
};

type ProviderTopologyIssue = {
  path: string;
};

type ExpandedProviderPriceGuideRows = {
  priceCellTexts: string[];
  canonicalRows: unknown[];
  topologyIssues: ProviderTopologyIssue[];
};

type PriceGuideAxisEvidenceRecovery = {
  document: PriceGuideV2;
  issues: PriceGuidePhotoImportIssue[];
  recovered: boolean;
};

function priceGuideGroupEvidenceKey(value: string | null | undefined) {
  return providerAxisTextKey(parsePriceGuideGroupHeading(value ?? null).sourceLabel) ?? "";
}

/**
 * Keeps independently proven table blocks when a separate repeated block is
 * empty or duplicated. Numeric/label contradictions remain document-level
 * failures; omitted evidence is never corrected or copied from a neighbor.
 */
function retainConfirmedPriceGuideAxisEvidence(
  document: PriceGuideV2,
  axisIssues: PriceGuideStructuredConsistencyIssue[],
): PriceGuideAxisEvidenceRecovery {
  if (!document.tableGroups?.length || axisIssues.length === 0) {
    return { document, issues: [], recovered: false };
  }
  // Numeric/label boundary contradictions stay document-level fail-closed.
  // Only an independently separable empty/duplicate physical block may be
  // omitted while other confirmed blocks remain editable.
  if (axisIssues.some((issue) => issue.code === "INVALID_AXIS")) {
    return { document, issues: [], recovered: false };
  }

  const removedGroupIndexes = new Set<number>();

  axisIssues.forEach((issue) => {
    const groupMatch = /^tableGroups:(\d+)(?:\.|$)/u.exec(issue.path);
    if (groupMatch) {
      removedGroupIndexes.add(Number(groupMatch[1]));
      return;
    }
    const rowMatch = /^rows:(\d+)\.weightBandLabel$/u.exec(issue.path);
    if (issue.code === "INVALID_AXIS" && rowMatch) {
      const row = document.rows[Number(rowMatch[1])];
      const rowGroupKey = priceGuideGroupEvidenceKey(row?.breedGroup);
      document.tableGroups?.forEach((group, groupIndex) => {
        if (priceGuideGroupEvidenceKey(group.sourceLabel) === rowGroupKey) {
          removedGroupIndexes.add(groupIndex);
        }
      });
    }
  });

  const removedGroupKeys = new Set(
    [...removedGroupIndexes].map((index) => priceGuideGroupEvidenceKey(document.tableGroups?.[index]?.sourceLabel)),
  );
  const tableGroups = document.tableGroups.filter((group) => (
    !removedGroupKeys.has(priceGuideGroupEvidenceKey(group.sourceLabel))
  ));

  const nextRowIndexBySourceIndex = new Map<number, number>();
  const rows = document.rows.flatMap((row, rowIndex) => {
    const groupKey = priceGuideGroupEvidenceKey(row.breedGroup);
    if (removedGroupKeys.has(groupKey)) return [];
    nextRowIndexBySourceIndex.set(rowIndex, nextRowIndexBySourceIndex.size);
    return [row];
  });

  if (tableGroups.length === 0 || rows.length === 0) {
    return { document, issues: [], recovered: false };
  }

  const aiReview = document.aiReview.flatMap((review) => {
    const rowTarget = /^rows:(\d+)$/u.exec(review.targetId);
    if (!rowTarget) return [review];
    const nextIndex = nextRowIndexBySourceIndex.get(Number(rowTarget[1]));
    return nextIndex === undefined ? [] : [{ ...review, targetId: `rows:${nextIndex}` }];
  });
  const recoveredDocument = { ...document, tableGroups, rows, aiReview };
  const remainingAxisIssues = findPriceGuideStructuredConsistencyIssues(recoveredDocument)
    .filter((issue) => (
      issue.code === "DUPLICATE_AXIS"
      || issue.code === "EMPTY_AXIS"
      || issue.code === "INVALID_AXIS"
    ));
  if (remainingAxisIssues.length > 0) {
    return { document, issues: [], recovered: false };
  }

  return {
    document: recoveredDocument,
    recovered: true,
    issues: axisIssues.map((issue) => ({
      path: issue.path,
      message: "구조를 확정할 수 없는 요금 분류·무게 구간만 제외했습니다. 사진과 비교해 입력해 주세요.",
      confidence: "low",
    })),
  };
}

function clearUncertainProviderGroupBreeds(document: PriceGuideV2) {
  if (!document.tableGroups?.length) return document;
  const uncertainGroupKeys = new Set<string>();
  document.aiReview.forEach((review) => {
    if (review.field !== "breedNames" || review.userConfirmed || review.userCorrected) return;
    const rowTarget = /^rows:(\d+)$/u.exec(review.targetId);
    const row = rowTarget ? document.rows[Number(rowTarget[1])] : undefined;
    const groupKey = priceGuideGroupEvidenceKey(row?.breedGroup);
    if (groupKey) uncertainGroupKeys.add(groupKey);
  });
  if (uncertainGroupKeys.size === 0) return document;
  return {
    ...document,
    tableGroups: document.tableGroups.map((group) => (
      uncertainGroupKeys.has(priceGuideGroupEvidenceKey(group.sourceLabel))
        ? { ...group, breedNames: [] }
        : group
    )),
  };
}

function dedupeProviderAxis<T>(
  values: T[],
  referencedIndexes: ReadonlySet<number>,
  keyFor: (value: T) => string | null,
) {
  const next: T[] = [];
  const indexMap: number[] = [];
  const seen = new Map<string, number>();
  values.forEach((value, sourceIndex) => {
    const key = keyFor(value);
    if (key === "" && !referencedIndexes.has(sourceIndex)) {
      indexMap[sourceIndex] = -1;
      return;
    }
    const existingIndex = key ? seen.get(key) : undefined;
    if (existingIndex !== undefined) {
      indexMap[sourceIndex] = existingIndex;
      return;
    }
    const targetIndex = next.length;
    next.push(value);
    indexMap[sourceIndex] = targetIndex;
    if (key) seen.set(key, targetIndex);
  });
  return { values: next, indexMap };
}

/**
 * Collapses only evidence-equivalent duplicate axes emitted for one physical
 * row or column. Coordinates are resolved against the original arrays first,
 * so no cell can move to a neighboring axis by position.
 */
function canonicalizeProviderAxisDuplicates(decoded: Record<string, unknown>) {
  if (!Array.isArray(decoded.tableGroups) || !Array.isArray(decoded.rows)) return decoded;
  const tableGroups = decoded.tableGroups;
  const rows = decoded.rows;

  const referencedWeights = tableGroups.map(() => new Set<number>());
  const referencedServices = tableGroups.map(() => new Set<number>());
  const resolvedRows = new Map<number, { groupIndex: number; weightBandIndex: number | null; serviceIndex: number }>();

  rows.forEach((rawRow, rowIndex) => {
    if (!rawRow || typeof rawRow !== "object") return;
    const row = rawRow as Record<string, unknown>;
    const groupIndex = readProviderCoordinate(row.g, tableGroups.length);
    if (groupIndex === null) return;
    const rawGroup = tableGroups[groupIndex];
    if (!rawGroup || typeof rawGroup !== "object") return;
    const group = rawGroup as Record<string, unknown>;
    if (!Array.isArray(group.weightBands) || !Array.isArray(group.serviceNames)) return;
    const coordinate = resolveProviderCellCoordinate(row, group.weightBands.length, group.serviceNames.length);
    if (!coordinate) return;
    if (coordinate.weightBandIndex !== null) referencedWeights[groupIndex].add(coordinate.weightBandIndex);
    referencedServices[groupIndex].add(coordinate.serviceIndex);
    resolvedRows.set(rowIndex, { groupIndex, ...coordinate });
  });

  const axisMaps: Array<ProviderAxisMaps | null> = tableGroups.map((rawGroup, groupIndex) => {
    if (!rawGroup || typeof rawGroup !== "object") {
      return null;
    }
    const group = rawGroup as Record<string, unknown>;
    if (!Array.isArray(group.weightBands) || !Array.isArray(group.serviceNames)) {
      return null;
    }
    const weights = dedupeProviderAxis(
      group.weightBands,
      referencedWeights[groupIndex],
      providerWeightAxisKey,
    );
    const services = dedupeProviderAxis(
      group.serviceNames,
      referencedServices[groupIndex],
      providerAxisTextKey,
    );
    return {
      weightBands: weights.values,
      serviceNames: services.values,
      weightIndexMap: weights.indexMap,
      serviceIndexMap: services.indexMap,
    };
  });

  return {
    ...decoded,
    tableGroups: tableGroups.map((rawGroup, groupIndex) => {
      const maps = axisMaps[groupIndex];
      if (!maps || !rawGroup || typeof rawGroup !== "object") return rawGroup;
      return {
        ...(rawGroup as Record<string, unknown>),
        weightBands: maps.weightBands,
        serviceNames: maps.serviceNames,
      };
    }),
    rows: rows.map((rawRow, rowIndex) => {
      const coordinate = resolvedRows.get(rowIndex);
      if (!coordinate || !rawRow || typeof rawRow !== "object") return rawRow;
      const maps = axisMaps[coordinate.groupIndex];
      if (!maps) return rawRow;
      return {
        ...(rawRow as Record<string, unknown>),
        g: coordinate.groupIndex,
        w: coordinate.weightBandIndex === null ? null : maps.weightIndexMap[coordinate.weightBandIndex],
        s: maps.serviceIndexMap[coordinate.serviceIndex],
      };
    }),
  };
}

function providerGroupIdentity(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const group = value as Record<string, unknown>;
  const sourceLabel = providerAxisTextKey(group.sourceLabel);
  const note = group.note === null ? "" : providerAxisTextKey(group.note);
  if (!sourceLabel || note === null || !Array.isArray(group.breedNames)) return null;
  const breedNames = group.breedNames.map(providerAxisTextKey);
  if (breedNames.some((breedName) => breedName === null)) return null;
  return JSON.stringify([
    sourceLabel,
    group.species,
    group.sizeClass,
    [...breedNames].sort(),
    note,
  ]);
}

function providerAxisIndexByEvidence<T>(values: T[], keyFor: (value: T) => string | null) {
  const indexes = new Map<string, number>();
  for (const [index, value] of values.entries()) {
    const key = keyFor(value);
    if (!key || indexes.has(key)) return null;
    indexes.set(key, index);
  }
  return indexes;
}

/**
 * Repeated physical blocks may describe one named classification in different
 * axis orders. Merge them only when every surviving axis has an explicit,
 * one-to-one evidence key; values are never copied into a neighboring cell.
 */
function canonicalizeProviderRepeatedGroups(decoded: Record<string, unknown>) {
  if (!Array.isArray(decoded.tableGroups) || !Array.isArray(decoded.rows)) return decoded;

  const groups = decoded.tableGroups;
  const canonicalGroups: unknown[] = [];
  const canonicalIndexes = new Map<string, number>();
  const groupIndexMap: number[] = [];
  const weightIndexMaps: Array<number[] | null> = [];
  const serviceIndexMaps: Array<number[] | null> = [];

  groups.forEach((rawGroup, sourceGroupIndex) => {
    const identity = providerGroupIdentity(rawGroup);
    if (!rawGroup || typeof rawGroup !== "object" || identity === null) {
      groupIndexMap[sourceGroupIndex] = canonicalGroups.length;
      canonicalGroups.push(rawGroup);
      weightIndexMaps[sourceGroupIndex] = null;
      serviceIndexMaps[sourceGroupIndex] = null;
      return;
    }

    const group = rawGroup as Record<string, unknown>;
    if (!Array.isArray(group.weightBands) || !Array.isArray(group.serviceNames)) {
      groupIndexMap[sourceGroupIndex] = canonicalGroups.length;
      canonicalGroups.push(rawGroup);
      weightIndexMaps[sourceGroupIndex] = null;
      serviceIndexMaps[sourceGroupIndex] = null;
      return;
    }

    const sourceWeights = providerAxisIndexByEvidence(group.weightBands, providerWeightAxisKey);
    const sourceServices = providerAxisIndexByEvidence(group.serviceNames, providerAxisTextKey);
    const existingGroupIndex = canonicalIndexes.get(identity);
    if (existingGroupIndex === undefined || sourceWeights === null || sourceServices === null) {
      const canonicalGroupIndex = canonicalGroups.length;
      canonicalIndexes.set(identity, canonicalGroupIndex);
      groupIndexMap[sourceGroupIndex] = canonicalGroupIndex;
      canonicalGroups.push(rawGroup);
      weightIndexMaps[sourceGroupIndex] = group.weightBands.map((_, index) => index);
      serviceIndexMaps[sourceGroupIndex] = group.serviceNames.map((_, index) => index);
      return;
    }

    const canonicalGroup = canonicalGroups[existingGroupIndex] as Record<string, unknown>;
    const canonicalWeights = canonicalGroup.weightBands as unknown[];
    const canonicalServices = canonicalGroup.serviceNames as string[];
    const canonicalWeightIndexes = providerAxisIndexByEvidence(canonicalWeights, providerWeightAxisKey);
    const canonicalServiceIndexes = providerAxisIndexByEvidence(canonicalServices, providerAxisTextKey);
    if (canonicalWeightIndexes === null || canonicalServiceIndexes === null) {
      groupIndexMap[sourceGroupIndex] = canonicalGroups.length;
      canonicalGroups.push(rawGroup);
      weightIndexMaps[sourceGroupIndex] = null;
      serviceIndexMaps[sourceGroupIndex] = null;
      return;
    }

    const weightIndexMap = group.weightBands.map((band) => canonicalWeightIndexes.get(providerWeightAxisKey(band) ?? "") ?? -1);
    const serviceIndexMap = group.serviceNames.map((service) => canonicalServiceIndexes.get(providerAxisTextKey(service) ?? "") ?? -1);
    if (weightIndexMap.includes(-1) || serviceIndexMap.includes(-1)) {
      groupIndexMap[sourceGroupIndex] = canonicalGroups.length;
      canonicalGroups.push(rawGroup);
      weightIndexMaps[sourceGroupIndex] = null;
      serviceIndexMaps[sourceGroupIndex] = null;
      return;
    }
    groupIndexMap[sourceGroupIndex] = existingGroupIndex;
    weightIndexMaps[sourceGroupIndex] = weightIndexMap;
    serviceIndexMaps[sourceGroupIndex] = serviceIndexMap;
  });

  return {
    ...decoded,
    tableGroups: canonicalGroups,
    rows: decoded.rows.map((rawRow) => {
      if (!rawRow || typeof rawRow !== "object") return rawRow;
      const row = rawRow as Record<string, unknown>;
      const sourceGroupIndex = readProviderCoordinate(row.g, groups.length);
      if (sourceGroupIndex === null) return rawRow;
      const sourceGroup = groups[sourceGroupIndex] as Record<string, unknown> | undefined;
      if (!sourceGroup || !Array.isArray(sourceGroup.weightBands) || !Array.isArray(sourceGroup.serviceNames)) return rawRow;
      const coordinate = resolveProviderCellCoordinate(row, sourceGroup.weightBands.length, sourceGroup.serviceNames.length);
      const weightIndexMap = weightIndexMaps[sourceGroupIndex];
      const serviceIndexMap = serviceIndexMaps[sourceGroupIndex];
      if (!coordinate || !weightIndexMap || !serviceIndexMap) return rawRow;
      const weightBandIndex = coordinate.weightBandIndex === null
        ? null
        : weightIndexMap[coordinate.weightBandIndex];
      const serviceIndex = serviceIndexMap[coordinate.serviceIndex];
      if (
        weightBandIndex === undefined
        || serviceIndex === undefined
        || (weightBandIndex !== null && weightBandIndex < 0)
        || serviceIndex < 0
      ) return rawRow;
      return { ...row, g: groupIndexMap[sourceGroupIndex], w: weightBandIndex, s: serviceIndex };
    }),
  };
}

/**
 * Canonicalizes only transport variants that carry the same explicit evidence.
 * It never parses missing text into a price, duration, axis, or taxonomy value.
 */
function normalizeProviderPriceGuideDocument(decoded: Record<string, unknown>) {
  return canonicalizeProviderRepeatedGroups(canonicalizeProviderAxisDuplicates({
    ...decoded,
    overallNote: normalizeProviderNullableText(decoded.overallNote),
    tableGroups: Array.isArray(decoded.tableGroups)
      ? decoded.tableGroups.map((rawGroup) => {
          if (!rawGroup || typeof rawGroup !== "object") return rawGroup;
          const group = rawGroup as Record<string, unknown>;
          return {
            ...group,
            note: normalizeProviderNullableText(group.note),
            weightBands: Array.isArray(group.weightBands)
              ? group.weightBands.map((rawBand) => {
                  if (!rawBand || typeof rawBand !== "object") return rawBand;
                  const band = rawBand as Record<string, unknown>;
                  return { ...band, note: normalizeProviderNullableText(band.note) };
                })
              : group.weightBands,
          };
        })
      : decoded.tableGroups,
    surcharges: Array.isArray(decoded.surcharges)
      ? decoded.surcharges.map((rawSurcharge) => {
          if (!rawSurcharge || typeof rawSurcharge !== "object") return rawSurcharge;
          const surcharge = rawSurcharge as Record<string, unknown>;
          return {
            ...surcharge,
            condition: normalizeProviderNullableText(surcharge.condition),
            note: normalizeProviderNullableText(surcharge.note),
          };
        })
      : decoded.surcharges,
    rows: Array.isArray(decoded.rows)
      ? decoded.rows.map((rawRow) => {
          if (!rawRow || typeof rawRow !== "object") return rawRow;
          const row = rawRow as Record<string, unknown>;
          return {
            ...row,
            d: row.d === "" ? null : row.d,
            n: normalizeProviderNullableText(row.n),
          };
        })
      : decoded.rows,
  }));
}

function resolveProviderCellCoordinate(
  row: Record<string, unknown>,
  weightBandCount: number,
  serviceCount: number,
) {
  if (weightBandCount === 0 && row.w === null) {
    const serviceIndex = readProviderCoordinate(row.s, serviceCount);
    return serviceIndex === null ? null : { weightBandIndex: null, serviceIndex };
  }
  const directWeightIndex = readProviderCoordinate(row.w, weightBandCount);
  const directServiceIndex = readProviderCoordinate(row.s, serviceCount);
  if (directWeightIndex !== null && directServiceIndex !== null) {
    return { weightBandIndex: directWeightIndex, serviceIndex: directServiceIndex };
  }

  // A transposed provider row is recoverable only when the declared w/s
  // interpretation is impossible and the opposite interpretation is unique.
  const transposedWeightIndex = readProviderCoordinate(row.s, weightBandCount);
  const transposedServiceIndex = readProviderCoordinate(row.w, serviceCount);
  return transposedWeightIndex !== null && transposedServiceIndex !== null
    ? { weightBandIndex: transposedWeightIndex, serviceIndex: transposedServiceIndex }
    : null;
}

/**
 * The provider sends table axes once and price cells by their three indices.
 * Canonical V2 rows are expanded here, so transport compaction can never
 * invent a group, band, service, breed, or bound.
 */
function expandProviderPriceGuideRows(decoded: Record<string, unknown>) {
  if (!Array.isArray(decoded.tableGroups) || !Array.isArray(decoded.rows)) throw priceGuideSchemaError();
  const tableGroups = decoded.tableGroups;
  const rows = decoded.rows;

  const priceCellTexts: string[] = [];
  const canonicalRows: unknown[] = [];
  const topologyIssues: ProviderTopologyIssue[] = [];
  rows.forEach((rawRow, rowIndex) => {
    if (!rawRow || typeof rawRow !== "object") throw priceGuideSchemaError();
    const row = rawRow as Record<string, unknown>;
    if (Object.keys(row).some((key) => !providerRowKeys.has(key))) throw priceGuideSchemaError();

    const groupIndex = readProviderCoordinate(row.g, tableGroups.length);
    if (groupIndex === null) {
      topologyIssues.push({ path: `providerRows:${rowIndex}` });
      return;
    }
    const group = tableGroups[groupIndex];
    if (!group || typeof group !== "object") {
      topologyIssues.push({ path: `providerRows:${rowIndex}` });
      return;
    }
    const groupRecord = group as Record<string, unknown>;
    if (!Array.isArray(groupRecord.weightBands) || !Array.isArray(groupRecord.serviceNames)) {
      topologyIssues.push({ path: `providerRows:${rowIndex}` });
      return;
    }

    const coordinate = resolveProviderCellCoordinate(
      row,
      groupRecord.weightBands.length,
      groupRecord.serviceNames.length,
    );
    if (!coordinate) {
      topologyIssues.push({ path: `providerRows:${rowIndex}` });
      return;
    }
    const { weightBandIndex, serviceIndex } = coordinate;
    const weightBand = weightBandIndex === null ? null : groupRecord.weightBands[weightBandIndex];
    const serviceName = groupRecord.serviceNames[serviceIndex];
    if ((weightBandIndex !== null && (!weightBand || typeof weightBand !== "object")) || typeof serviceName !== "string") {
      topologyIssues.push({ path: `providerRows:${rowIndex}` });
      return;
    }

    const priceCellText = row.t;
    if (typeof priceCellText !== "string" || priceCellText.length > 80) throw priceGuideSchemaError();
    const band = weightBand as Record<string, unknown> | null;
    priceCellTexts.push(priceCellText);
    canonicalRows.push({
      serviceName,
      species: groupRecord.species,
      breedNames: groupRecord.breedNames,
      breedGroup: groupRecord.sourceLabel,
      sizeClass: groupRecord.sizeClass,
      minKg: band?.minKg ?? null,
      maxKg: band?.maxKg ?? null,
      weightBandLabel: band?.label ?? null,
      priceKind: row.k,
      priceMinKrw: row.p,
      priceMaxKrw: row.x,
      durationMinutes: row.d,
      note: row.n,
    });
  });
  return { priceCellTexts, canonicalRows, topologyIssues } satisfies ExpandedProviderPriceGuideRows;
}

export function parsePriceGuideResponsesPayload(payload: unknown): PriceGuideV2 {
  return parsePriceGuideResponsesPayloadInternal(payload).document;
}

function parsePriceGuideResponsesPayloadInternal(payload: unknown): {
  document: PriceGuideV2;
  topologyIssues: ProviderTopologyIssue[];
} {
  if (!payload || typeof payload !== "object") {
    throw priceGuideSchemaError();
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
    throw priceGuideSchemaError();
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw priceGuideSchemaError();
  const normalizedDecoded = normalizeProviderPriceGuideDocument(decoded as Record<string, unknown>);
  const { priceCellTexts, canonicalRows, topologyIssues } = expandProviderPriceGuideRows(normalizedDecoded);
  const parsed = priceGuideV2Schema.safeParse({
    ...normalizedDecoded,
    rows: canonicalRows,
  });
  if (!parsed.success) {
    throw priceGuideSchemaError();
  }
  const verified = rejectUnverifiedPriceCellDigits(parsed.data, priceCellTexts);
  const hasExplicitWeightlessRows = Array.isArray(normalizedDecoded.rows)
    && normalizedDecoded.rows.some((rawRow) => rawRow && typeof rawRow === "object" && (rawRow as Record<string, unknown>).w === null);
  return {
    document: {
      ...verified,
      // A no-weight fixed-price list is intentionally not a matrix axis. Keep
      // its explicit rows, but remove the empty transport group before the
      // matrix validator so no synthetic weight band is needed.
      tableGroups: hasExplicitWeightlessRows
        ? verified.tableGroups?.filter((group) => group.weightBands.length > 0)
        : verified.tableGroups,
    },
    topologyIssues,
  };
}

const priceCellAmountPattern = /(?:₩\s*)?(?:\d+(?:\.\d+)?\s*만\s*원?|\d{1,3}(?:[,\.\s]\d{3})+\s*원?|\d+\s*원?)/gu;
const trailingDashThousandsPattern = /^(\d{1,3})\s*[-‐‑‒–—―]\s*$/u;
const explicitThousandsUnitPattern = /(?:단위\s*[:：]?\s*(?:1(?:[,\.\s]?000)\s*원|천\s*원)|[（(]\s*(?:단위\s*[:：]?\s*)?천\s*원\s*[）)])/u;

function parsePriceCellAmount(token: string) {
  const compact = token.normalize("NFKC").replace(/[₩\s원,]/gu, "");
  if (compact.endsWith("만")) {
    const units = Number(compact.slice(0, -1));
    const amount = units * 10_000;
    return Number.isSafeInteger(amount) && amount >= 0 && amount <= 100_000_000 ? amount : null;
  }
  const amount = Number(compact.replace(/\./gu, ""));
  return Number.isSafeInteger(amount) && amount >= 0 && amount <= 100_000_000 ? amount : null;
}

function readTrailingDashThousandsAmount(value: string) {
  const match = trailingDashThousandsPattern.exec(value.normalize("NFKC").trim());
  if (!match) return null;
  const amount = Number(match[1]) * 1_000;
  return Number.isSafeInteger(amount) && amount >= 0 && amount <= 100_000_000 ? amount : null;
}

function priceCellPricingGroupKey(row: PriceGuideV2["rows"][number]) {
  const group = providerAxisTextKey(row.breedGroup);
  return group ? `${row.species}:${group}` : null;
}

function hasExplicitThousandsUnitEvidence(document: PriceGuideV2, rowIndex: number) {
  const row = document.rows[rowIndex];
  const groupKey = priceCellPricingGroupKey(row);
  const group = groupKey
    ? document.tableGroups?.find((candidate) => (
      `${candidate.species}:${providerAxisTextKey(candidate.sourceLabel)}` === groupKey
    ))
    : null;
  return [document.overallNote, group?.sourceLabel, group?.note]
    .some((value) => explicitThousandsUnitPattern.test(value ?? ""));
}

function hasConsistentTrailingDashThousandsContext(
  document: PriceGuideV2,
  priceCellTexts: string[],
  rowIndex: number,
) {
  if (hasExplicitThousandsUnitEvidence(document, rowIndex)) return true;
  const groupKey = priceCellPricingGroupKey(document.rows[rowIndex]);
  if (!groupKey) return false;

  const candidates = document.rows.flatMap((row, candidateIndex) => {
    if (priceCellPricingGroupKey(row) !== groupKey) return [];
    const amount = readTrailingDashThousandsAmount(priceCellTexts[candidateIndex] ?? "");
    return amount === null ? [] : [{ amount, row }];
  });
  return candidates.length >= 2 && candidates.every(({ amount, row }) => {
    const expected = expectedPriceCellAmounts(row);
    return expected.length === 1 && expected[0] === amount;
  });
}

function readExplicitPriceCellAmounts(value: string, allowTrailingDashThousands = false) {
  const normalized = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!normalized) return { amounts: [] as number[], ambiguous: false };
  const trailingDashThousands = readTrailingDashThousandsAmount(normalized);
  if (trailingDashThousands !== null) {
    return allowTrailingDashThousands
      ? { amounts: [trailingDashThousands], ambiguous: false }
      : { amounts: [] as number[], ambiguous: true };
  }
  const matches = [...normalized.matchAll(priceCellAmountPattern)];
  const amounts = matches.flatMap((match) => {
    const amount = parsePriceCellAmount(match[0]);
    return amount === null ? [] : [amount];
  });
  const residue = normalized
    .replace(priceCellAmountPattern, " ")
    .replace(/(?:정가|부터|이상|이하|부가세|포함|별도)/gu, " ")
    .replace(/[~～〜\-‐‑‒–—―:：/|,.()（）\s]/gu, "");
  const hasExplicitRangeSeparator = /[~～〜\-‐‑‒–—―]|부터[\s\S]*까지/u.test(normalized);
  const hasNonPriceUnitOrComparator = /(?:kg|㎏|킬로|키로|분|시간|초|이하|미만|이상|초과|[<>≤≥])/iu.test(normalized)
    || /^[-‐‑‒–—―]\s*\d/u.test(normalized);
  return {
    amounts,
    ambiguous: matches.length !== amounts.length
      || residue.length > 0
      || hasNonPriceUnitOrComparator
      || (amounts.length > 1 && !hasExplicitRangeSeparator),
  };
}

function expectedPriceCellAmounts(row: PriceGuideV2["rows"][number]) {
  if (row.priceMinKrw === null) return [];
  if (row.priceKind === "range" && row.priceMaxKrw !== null) {
    return [row.priceMinKrw, row.priceMaxKrw];
  }
  return [row.priceMinKrw];
}

function rejectUnverifiedPriceCellDigits(document: PriceGuideV2, priceCellTexts: string[]): PriceGuideV2 {
  const aiReview = [...document.aiReview];
  const rows = document.rows.map((row, rowIndex) => {
    const expected = expectedPriceCellAmounts(row);
    const evidence = readExplicitPriceCellAmounts(
      priceCellTexts[rowIndex] ?? "",
      hasConsistentTrailingDashThousandsContext(document, priceCellTexts, rowIndex),
    );
    const evidenceMatches = !evidence.ambiguous
      && expected.length === evidence.amounts.length
      && expected.every((amount, amountIndex) => amount === evidence.amounts[amountIndex]);
    const hasUnverifiedEvidence = evidence.ambiguous || evidence.amounts.length > 0;
    if (evidenceMatches || (expected.length === 0 && !hasUnverifiedEvidence)) return row;

    const targetId = `rows:${rowIndex}`;
    if (!aiReview.some((review) => review.targetId === targetId && (
      review.field === "priceMinKrw" || review.field === "priceMaxKrw"
    ))) {
      aiReview.push({
        targetId,
        field: "priceMinKrw",
        rawText: "",
        confidence: "low",
        userConfirmed: false,
        userCorrected: false,
      });
    }
    return {
      ...row,
      priceKind: "unknown" as const,
      priceMinKrw: null,
      priceMaxKrw: null,
    };
  });
  return { ...document, rows, aiReview };
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

export function createPriceGuideResponsesFixture(
  document: PriceGuideV2,
  options?: { priceCellTexts?: Record<number, string> },
) {
  const parsedDocument = priceGuideV2Schema.parse(document);
  const tableGroups = [...(parsedDocument.tableGroups ?? [])];
  const fixtureTextKey = (value: string | null | undefined) => (value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .replace(/[～〜]/gu, "~");
  const sameFixtureBand = (
    band: { label: string; minKg: number | null; maxKg: number | null },
    row: PriceGuideV2["rows"][number],
  ) => (
    band.minKg === row.minKg
    && band.maxKg === row.maxKg
    && (fixtureTextKey(band.label) === fixtureTextKey(row.weightBandLabel)
      || (row.weightBandLabel !== null && row.weightBandLabel !== undefined))
  );
  const providerRows = parsedDocument.rows.map((row, rowIndex) => {
    const hasExplicitWeightlessRow = row.weightBandLabel === null;
    const hasWeightAxis = !hasExplicitWeightlessRow;
    let createdGroup = false;
    let groupIndex = tableGroups.findIndex((group) => (
      group.sourceLabel === row.breedGroup
      && group.species === row.species
      && group.sizeClass === row.sizeClass
      && group.serviceNames.some((serviceName) => fixtureTextKey(serviceName) === fixtureTextKey(row.serviceName))
      && (hasWeightAxis
        ? group.weightBands.some((band) => sameFixtureBand(band, row))
        : group.weightBands.length === 0)
    ));
    if (groupIndex < 0) {
      tableGroups.push({
        sourceLabel: row.breedGroup ?? `fixture-${rowIndex + 1}`,
        species: row.species,
        breedNames: row.breedNames,
        sizeClass: row.sizeClass,
        weightBands: hasWeightAxis ? [{
          label: row.weightBandLabel ?? `fixture-band-${rowIndex + 1}`,
          minKg: row.minKg,
          maxKg: row.maxKg,
          note: null,
        }] : [],
        serviceNames: [row.serviceName ?? `fixture-service-${rowIndex + 1}`],
        note: null,
      });
      groupIndex = tableGroups.length - 1;
      createdGroup = true;
    }
    const group = tableGroups[groupIndex];
    const weightBandIndex = hasWeightAxis
      ? (createdGroup ? 0 : group.weightBands.findIndex((band) => sameFixtureBand(band, row)))
      : null;
    const serviceIndex = createdGroup ? 0 : group.serviceNames.findIndex((serviceName) => fixtureTextKey(serviceName) === fixtureTextKey(row.serviceName));
    if ((weightBandIndex !== null && weightBandIndex < 0) || serviceIndex < 0) throw new Error("Fixture row cannot resolve a table coordinate.");
    return {
      g: groupIndex,
      w: weightBandIndex,
      s: serviceIndex,
      k: row.priceKind,
      p: row.priceMinKrw,
      x: row.priceMaxKrw,
      t: options?.priceCellTexts?.[rowIndex] ?? (() => {
        if (row.priceMinKrw === null) return "";
        const minimum = `${row.priceMinKrw.toLocaleString("en-US")}원`;
        return row.priceKind === "range" && row.priceMaxKrw !== null
          ? `${minimum}~${row.priceMaxKrw.toLocaleString("en-US")}원`
          : minimum;
      })(),
      d: row.durationMinutes,
      n: row.note,
    };
  });
  const providerDocument = {
    schemaVersion: parsedDocument.schemaVersion,
    source: parsedDocument.source,
    overallNote: parsedDocument.overallNote,
    tableGroups,
    surcharges: parsedDocument.surcharges,
    rows: providerRows,
    aiReview: parsedDocument.aiReview,
  };
  return {
    status: "completed",
    incomplete_details: null,
    output: [{
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: JSON.stringify(providerDocument) }],
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
  if (imageUrls.length !== 1) {
    throw new Error("요금표 분석 이미지는 정확히 한 장이어야 합니다.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.min(Math.max(options?.timeoutMs ?? PRICE_GUIDE_PROVIDER_TIMEOUT_MS, 5_000), PRICE_GUIDE_PROVIDER_TIMEOUT_MS),
  );
  try {
    const body = {
      model: PRICE_GUIDE_VISION_MODEL,
      store: false,
      max_output_tokens: PRICE_GUIDE_PROVIDER_MAX_OUTPUT_TOKENS,
      reasoning: { effort: PRICE_GUIDE_PROVIDER_REASONING_EFFORT },
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "한국 반려동물 미용실 요금표 사진을 PriceGuideV2로 구조화하세요.",
              "입력은 개인정보 확인과 메타데이터 제거를 마친 요금표 사진 정확히 한 장입니다. 사진 전체를 한 번만 읽으세요.",
              "사진에 실제로 보이는 내용만 옮기고 가격, 시간, 동물종, 견종, 체급, 무게 구간을 추측하지 마세요.",
              "확인할 수 없는 값은 반드시 null 또는 unknown으로 두고 숫자 기본값을 만들지 마세요.",
              "먼저 사진의 셀 경계, 병합 범위, 반복 block을 보고 서로 분리된 표마다 요금 분류·서비스·무게 구간 축을 확정한 다음 가격 셀을 교차 좌표에 대응하세요.",
              "서비스와 무게 구간의 물리적 행·열 방향이 표마다 반대여도 각 header와 교차 셀의 구조 관계가 유일할 때만 의미 축으로 변환하세요.",
              "여러 줄이나 병합 셀로 표시된 헤더는 하나의 물리 header cell 안에 있는 글자만 순서대로 이어 하나의 축 이름으로 만들고, 같은 물리 축을 중복 생성하지 마세요.",
              "서비스 열 이름은 해당 header cell 안에서 읽힌 글자만 사용하세요. 사진 하단 각주·안내문에 있는 발톱, 귀청소 같은 단어를 흐린 서비스 header의 대체 이름으로 가져오지 마세요. header 원문이 불명확하면 흔한 미용 서비스명으로 추측하지 말고 그 축과 대응 셀을 생략해 확인 대상으로 남기세요.",
              "표 왼쪽 위의 빈 모서리 셀과 장식용 숫자·기호는 체급 또는 서비스 축으로 만들지 마세요. 축 이름이 데이터만으로 유일하지 않으면 그 축과 대응 셀을 생략하세요.",
              "표의 상단 분류 묶음은 요금 분류(sourceLabel), 그 아래 견종은 breedNames, 세로 체중 행은 weightBands, 가로 서비스 열은 serviceNames로 서로 분리하세요.",
              "요금 분류 값은 사진의 해당 header/cell에서 동적으로 읽은 원문만 sourceLabel에 보존하세요. 특정 분류명을 만들거나 allowlist로 제한하지 마세요.",
              "슬래시 문자의 유무만으로 텍스트를 합치거나 나누지 마세요. 하나의 병합 header cell이라는 표 구조가 명확할 때만 그 셀 원문 전체를 하나의 요금 분류로 보존하세요.",
              "섹션 제목과 괄호 안 품종이 한 헤더에 붙어 있으면 sourceLabel에는 보이는 전체 헤더를 그대로 두고, 명확한 괄호 안 품종만 breedNames에도 옮기세요.",
              "tableGroups에는 사진에 보이는 각 요금 분류 원문, 견종, 무게 구간 축 순서, 서비스 축 순서를 그대로 보존하세요. 가격 셀이 없는 명시적 무게 구간도 tableGroups.weightBands에는 남기세요.",
              "서비스 축은 요금 분류마다 독립적입니다. 모든 분류에 하나의 전역 서비스 목록을 복사하거나 강제하지 마세요.",
              "요금 분류마다 반복되는 작은 표는 각각 독립 tableGroup으로 유지하고, 한 분류 안의 여러 견종은 breedNames에만 두세요.",
              "응답은 tableGroups 다음에 surcharges를 먼저 완결하고, 마지막에 rows를 내보내세요. 출력 공간이 부족하면 overallNote·행 메모·섹션 메모는 비우되, 사진에 명확히 따로 적힌 추가요금 이름+금액 또는 비율 한 쌍은 절대 생략하지 마세요.",
              "주 matrix를 읽은 뒤 사진의 오른쪽과 아래쪽 분리 구역을 각각 한 번 더 끝까지 훑으세요. 독립 무게 축과 여러 가격 셀이 있는 추가 서비스 표는 별도 tableGroup과 rows로, 이름+금액 또는 비율 한 쌍만 있는 목록은 surcharges로 보존하세요.",
              "주 표 아래의 시작가 서비스, 품종·체급별 별도 서비스, 얼굴컷 추가금, 호텔 같은 독립 이름+금액도 누락하지 마세요. '부터'가 보이면 starting으로 보존하고, 추가금은 surcharges로, 독립 서비스 가격은 체급 축이 없는 별도 tableGroup과 row로 보존하세요.",
              "surcharges에는 주 matrix의 오른쪽이나 아래쪽에 별도로 놓인 추가 서비스·추가요금 이름과 금액 또는 비율 한 쌍만 넣고, 주 matrix의 서비스 축에 억지로 합치지 마세요. 같은 이름·같은 금액 또는 비율은 한 번만, 이름 또는 금액·비율이 불명확하거나 서로 충돌하면 넣지 마세요. 체급 행에 붙은 kg당 규칙은 surcharge가 아니라 해당 weightBands.note에만 남기세요.",
              "요금 분류명과 견종 설명은 물리적으로 어느 merged header cell에 속하는지 따로 판독하세요. 장식 문구·색상 범례·각주를 분류명이나 견종으로 만들지 말고, 견종 글자가 불명확하면 해당 breedNames만 aiReview로 남겨 가격 셀과 확인된 요금 분류 축은 보존하세요.",
              "rows는 금액 전체가 명확히 보이고 정확히 하나의 tableGroups 섹션·서비스 열과 일치하는 조합만 만드세요. 체급 축이 명시된 표에서는 짧은 키 g/w/s를 각각 tableGroups와 그 안의 weightBands·serviceNames의 0부터 시작하는 위치로 두세요. 체급 축이 전혀 없는 정액표는 weightBands를 빈 배열로 두고 w만 null로 하며, 서비스·가격·시간은 그대로 행으로 만드세요. k/p/x/t/d/n은 가격방식/최소가격/최대가격/셀 원문/시간/메모입니다. 빈 셀, 일부만 읽힌 금액, 확인 필요 문구는 행으로 만들지 말고 표의 빈 교차 셀로 남기세요.",
              "'상담 후 결정', '문의', '별도 상담'처럼 숫자가 아닌 결정 문구가 병합 가격 셀에 보이면 숫자를 만들거나 빈칸으로 버리지 마세요. 해당 weightBands.note 또는 tableGroup.note에 보이는 문구를 그대로 남기고 aiReview에도 확인 대상으로 기록하세요.",
              "사진의 물리 방향과 무관하게 w는 의미상 weightBands 위치이고 s는 의미상 serviceNames 위치입니다. 둘을 바꾸지 마세요.",
              "5~8kg와 5kg~8kg처럼 숫자 임계값과 포함 관계가 같은 표기만 같은 체급으로 보세요. 숫자 임계값이나 이하·미만·이상·초과가 다르면 절대 합치지 마세요.",
              "품종명을 서비스명으로 만들지 말고, 4kg·6kg·8kg 같은 다른 요금표의 기본 체급이나 고정 서비스 열을 추가하지 마세요.",
              "가격이 있는 각 표 셀마다 canonical row를 정확히 하나 만들고, 같은 섹션·체급·서비스 조합을 누락하거나 중복하지 마세요.",
              "가격 셀은 이웃 셀과 독립적으로 읽고, 주변 가격을 복사·보간하거나 가격 규칙을 추론하지 마세요. 한 좌표에 두 값이 보이거나 좌표가 모호하면 그 셀을 만들지 마세요.",
              "각 row의 t에는 해당 교차 셀에서 실제로 보이는 가격 문자열을 공백, 쉼표, 구분자, 원·만원 단위까지 그대로 전사하세요.",
              "p와 x는 오직 같은 row의 t에서 변환하세요. 원문 숫자와 구조화 숫자가 다르거나 숫자 한 자리가 모호하면 가격 숫자를 추측하지 말고 null로 두세요.",
              "가격 교차 셀의 '숫자-'처럼 마지막 대시가 000 생략임을 같은 표의 명시적 천원 단위 또는 반복된 가격 셀 표기가 입증할 때만 해당 숫자에 1,000을 곱해 p로 옮기고 t 원문은 그대로 보존하세요.",
              "숫자~숫자와 숫자-숫자는 가격 범위, 앞쪽 대시는 음수 또는 기호로 따로 판독하세요. kg·무게 비교기호·분·시간·콤마 금액·만원 표기를 마지막 대시 축약 규칙과 섞지 마세요.",
              "tableGroups.weightBands.label에는 사진에 보이는 체급 문구를 그대로 적고, minKg/maxKg는 그 문구에서 숫자 경계가 명시된 경우에만 옮기세요.",
              "tableGroups.weightBands.label에서 읽은 숫자 경계와 minKg/maxKg는 정확히 같아야 합니다. 서로 다르면 임의로 고치지 말고 해당 숫자 필드를 null로 두세요.",
              "단일 금액만 보인다고 fixed로 추측하지 마세요. 정가·부터·범위가 명시되지 않으면 priceKind는 unknown으로 두되 보이는 금액은 priceMinKrw에 보존하세요.",
              "가격은 fixed, starting, range, unknown을 구분하고 범위의 두 숫자를 하나로 합치지 마세요.",
              "소요 시간은 사진 셀이나 같은 행에 분·시간 단위로 명시된 경우에만 durationMinutes로 변환하고, 가격이나 서비스명으로 시간을 추정하지 마세요.",
              "견종 배열과 모든 명확한 금액/비율 추가요금 쌍을 빠뜨리지 마세요. 체급 행에 붙은 kg당 규칙을 전역 추가요금으로 다시 만들지 마세요.",
              "사진에 없는 축이나 가려진 글자를 추측하거나 복원하지 마세요. 축 전체가 읽히지 않으면 그 축과 대응 셀을 만들지 마세요.",
              "각 필드를 독립적으로 판독하고 medium/low 확신, 누락, 사진 간 모순이 있는 모든 필드는 aiReview에 rows:{index} 또는 surcharges:{index} targetId, 정확한 필드명, 보이는 원문을 남기세요.",
              "개인 이름, 전화번호, 주소처럼 요금표가 아닌 개인정보는 결과와 rawText에 절대 포함하지 마세요.",
              "AI가 만든 문서이므로 source는 ai_imported, userConfirmed와 userCorrected는 false입니다.",
            ].join("\n"),
          },
          ...imageUrls.map((imageUrl) => ({ type: "input_image", image_url: imageUrl, detail: "original" })),
        ],
      }],
      text: {
        verbosity: PRICE_GUIDE_PROVIDER_TEXT_VERBOSITY,
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

    const { document: parsedDocument, topologyIssues } = parsePriceGuideResponsesPayloadInternal(payload);
    const normalizedDocument = normalizeImportedPriceGuideStructure(
      priceGuideV2Schema.parse({ ...parsedDocument, source: "ai_imported" }),
    );
    const axisIssues = findPriceGuideStructuredConsistencyIssues(normalizedDocument)
      .filter((issue) => (
        issue.code === "DUPLICATE_AXIS"
        || issue.code === "EMPTY_AXIS"
        || issue.code === "INVALID_AXIS"
      ));
    const axisRecovery = retainConfirmedPriceGuideAxisEvidence(normalizedDocument, axisIssues);
    if (axisIssues.length > 0 && !axisRecovery.recovered) {
      const hasInvalidBounds = axisIssues.some((issue) => issue.code === "INVALID_AXIS");
      throw new PriceGuidePhotoImportError(
        "VISION_RESPONSE_SCHEMA_INVALID",
        hasInvalidBounds
          ? "사진 속 체급 표기와 숫자 경계가 서로 맞지 않습니다. 더 선명한 사진으로 다시 시도해 주세요."
          : "사진 속 요금 분류·서비스·무게 구간을 구분하지 못했습니다. 더 선명한 사진으로 다시 시도해 주세요.",
        422,
        undefined,
        undefined,
        "AXIS_INVALID",
      );
    }
    const recovered = reconcilePriceGuideStructuredDraft(
      preparePriceGuidePhotoDraftForReview(clearUncertainProviderGroupBreeds(axisRecovery.document)),
    );
    const document = recovered.document;
    if (!document.rows.some((row) => row.serviceName?.trim() && row.priceMinKrw !== null)) {
      throw new PriceGuidePhotoImportError(
        "VISION_NO_ROWS",
        "사진에서 서비스명과 가격이 함께 확인된 요금표 행을 찾지 못했습니다. 더 선명한 사진으로 다시 시도해 주세요.",
        422,
        undefined,
        undefined,
        "NO_ROWS",
      );
    }
    if (findPriceGuideStructuredConsistencyIssues(document).length > 0) {
      throw new PriceGuidePhotoImportError(
        "VISION_RESPONSE_SCHEMA_INVALID",
        "사진 속 요금표의 행과 열을 정확히 맞추지 못했습니다. 더 선명한 사진으로 다시 시도해 주세요.",
        422,
        undefined,
        undefined,
        "SHAPE_INVALID",
      );
    }
    const compatibility = buildPriceGuideV2Compatibility(document);
    const providerUsage = getResponseUsage(payload);
    return {
      document,
      guide: compatibility.guide,
      summary: `요금 ${document.rows.length}개 행과 추가요금 ${document.surcharges.length}개를 읽었습니다.`,
      issues: [
        ...axisRecovery.issues,
        ...topologyIssues.map((issue): PriceGuidePhotoImportIssue => ({
          path: issue.path,
          message: "행과 열을 한 칸으로 확정할 수 없어 제외했습니다. 사진과 비교해 해당 칸을 입력해 주세요.",
          confidence: "low",
        })),
        ...recovered.issues.map((issue): PriceGuidePhotoImportIssue => ({
          path: issue.path,
          message: issue.code === "DUPLICATE_CELL"
            ? "겹치거나 서로 다른 값은 빈칸으로 남겼습니다. 사진과 비교해 입력해 주세요."
            : issue.code === "DUPLICATE_SURCHARGE"
              ? "같은 추가요금은 한 번만 남겼습니다. 사진과 비교해 주세요."
              : issue.code === "CONFLICTING_SURCHARGE"
                ? "금액이 서로 다른 추가요금은 제외했습니다. 사진과 비교해 입력해 주세요."
                : issue.code === "UNPLACED_SURCHARGE"
                  ? "표 행 규칙과 겹치거나 이름·금액을 확정할 수 없는 추가요금은 제외했습니다. 사진과 비교해 주세요."
                  : "행과 열을 한 칸으로 확정할 수 없어 빈칸으로 남겼습니다. 사진과 비교해 입력해 주세요.",
          confidence: "low",
        })),
        ...compatibility.issues,
      ],
      model: PRICE_GUIDE_VISION_MODEL,
      providerUsage,
      providerCostMicroUsd: calculatePriceGuideProviderCostMicroUsd(PRICE_GUIDE_VISION_MODEL, providerUsage),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new PriceGuidePhotoImportError(
        "VISION_TIMEOUT",
        "사진을 읽는 시간이 초과됐습니다. 잠시 후 다시 시도하거나 뒤로 가서 직접 등록해 주세요.",
        504,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
