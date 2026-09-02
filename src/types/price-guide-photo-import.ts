import { z } from "zod";

import type { ServicePriceGuide } from "@/components/owner-web/service-price-guide";

export const PRICE_GUIDE_V2_SCHEMA_VERSION = 2 as const;

export const priceGuideV2SourceSchema = z.enum([
  "ai_imported",
  "owner_corrected",
  "vision",
  "fixture",
  "manual",
  "owner_confirmed",
  "legacy",
]);

export const priceGuideV2SpeciesSchema = z.enum(["dog", "cat", "all", "unknown"]);
export const priceGuideV2SizeClassSchema = z.enum([
  "small",
  "medium",
  "large",
  "extra-large",
  "all",
  "unknown",
]);
export const priceGuideV2PriceKindSchema = z.enum(["fixed", "starting", "range", "unknown"]);
export const priceGuideV2ReviewConfidenceSchema = z.enum(["medium", "low"]);

const nullableText = (maxLength: number) => z.string().trim().min(1).max(maxLength).nullable();
const nullableNonNegativeInteger = z.number().int().min(0).max(100_000_000).nullable();
const nullableKg = z.number().min(0).max(1_000).nullable();

export const priceGuideV2RowSchema = z.object({
  serviceName: nullableText(120),
  species: priceGuideV2SpeciesSchema,
  breedNames: z.array(z.string().trim().min(1).max(80)).max(100),
  breedGroup: nullableText(160),
  sizeClass: priceGuideV2SizeClassSchema,
  minKg: nullableKg,
  maxKg: nullableKg,
  priceKind: priceGuideV2PriceKindSchema,
  priceMinKrw: nullableNonNegativeInteger,
  priceMaxKrw: nullableNonNegativeInteger,
  durationMinutes: z.number().int().min(1).max(1_440).nullable(),
  note: nullableText(1_000),
}).strict().superRefine((row, context) => {
  if (row.minKg !== null && row.maxKg !== null && row.minKg > row.maxKg) {
    context.addIssue({ code: "custom", path: ["maxKg"], message: "maxKg must be greater than or equal to minKg" });
  }
  if (row.priceKind === "unknown" && (row.priceMinKrw !== null || row.priceMaxKrw !== null)) {
    context.addIssue({ code: "custom", path: ["priceKind"], message: "unknown priceKind cannot contain price values" });
  }
  if ((row.priceKind === "fixed" || row.priceKind === "starting") && row.priceMinKrw === null) {
    context.addIssue({ code: "custom", path: ["priceMinKrw"], message: `${row.priceKind} price requires priceMinKrw` });
  }
  if (row.priceKind === "starting" && row.priceMaxKrw !== null) {
    context.addIssue({ code: "custom", path: ["priceMaxKrw"], message: "starting price cannot contain priceMaxKrw" });
  }
  if (row.priceKind === "fixed" && row.priceMaxKrw !== null && row.priceMaxKrw !== row.priceMinKrw) {
    context.addIssue({ code: "custom", path: ["priceMaxKrw"], message: "fixed priceMaxKrw must be null or equal to priceMinKrw" });
  }
  if (row.priceKind === "range") {
    if (row.priceMinKrw === null || row.priceMaxKrw === null) {
      context.addIssue({ code: "custom", path: ["priceMaxKrw"], message: "range price requires both price bounds" });
    } else if (row.priceMinKrw > row.priceMaxKrw) {
      context.addIssue({ code: "custom", path: ["priceMaxKrw"], message: "priceMaxKrw must be greater than or equal to priceMinKrw" });
    }
  }
});

export const priceGuideV2SurchargeSchema = z.object({
  condition: nullableText(200),
  amountKrw: nullableNonNegativeInteger,
  percent: z.number().min(0).max(1_000).nullable(),
  note: nullableText(1_000),
}).strict();

export const priceGuideV2AiReviewSchema = z.object({
  targetId: z.string().trim().min(1).max(160),
  field: z.string().trim().min(1).max(80),
  rawText: z.string().max(500),
  confidence: priceGuideV2ReviewConfidenceSchema,
  userConfirmed: z.boolean(),
  userCorrected: z.boolean(),
}).strict();

export const priceGuideV2Schema = z.object({
  schemaVersion: z.literal(PRICE_GUIDE_V2_SCHEMA_VERSION),
  source: priceGuideV2SourceSchema,
  overallNote: nullableText(4_000),
  rows: z.array(priceGuideV2RowSchema).max(200),
  surcharges: z.array(priceGuideV2SurchargeSchema).max(100),
  aiReview: z.array(priceGuideV2AiReviewSchema).max(500),
}).strict();

export type PriceGuideV2 = z.infer<typeof priceGuideV2Schema>;
export type PriceGuideV2Row = z.infer<typeof priceGuideV2RowSchema>;
export type PriceGuideV2Surcharge = z.infer<typeof priceGuideV2SurchargeSchema>;
export type PriceGuideV2AiReview = z.infer<typeof priceGuideV2AiReviewSchema>;

export type PriceGuideV2ReviewResolution = "confirmed" | "corrected";

const aiDerivedPriceGuideSources = new Set<PriceGuideV2["source"]>([
  "ai_imported",
  "owner_corrected",
  "vision",
  "fixture",
  "owner_confirmed",
]);

export function resolvePriceGuideV2Reviews(
  document: PriceGuideV2,
  matches: (review: PriceGuideV2AiReview) => boolean,
  resolution: PriceGuideV2ReviewResolution,
): PriceGuideV2 {
  let matched = false;
  const aiReview = document.aiReview.map((review) => {
    if (!matches(review)) return review;
    matched = true;
    return {
      ...review,
      userConfirmed: resolution === "confirmed",
      userCorrected: resolution === "corrected",
    };
  });
  if (!matched) return document;

  let source = document.source;
  if (aiDerivedPriceGuideSources.has(source)) {
    if (source === "owner_corrected" || aiReview.some((review) => review.userCorrected)) {
      source = "owner_corrected";
    } else if (aiReview.length > 0 && aiReview.every((review) => review.userConfirmed)) {
      source = "owner_confirmed";
    } else {
      source = "ai_imported";
    }
  }

  return { ...document, source, aiReview };
}

export type PriceGuideV2ClassificationIssue = {
  rowIndex: number;
  field: "species" | "sizeClass";
};

export function findPriceGuideV2ClassificationIssues(
  document: Pick<PriceGuideV2, "rows">,
): PriceGuideV2ClassificationIssue[] {
  return document.rows.flatMap((row, rowIndex) => [
    ...(row.species === "unknown" ? [{ rowIndex, field: "species" as const }] : []),
    ...(row.sizeClass === "unknown" ? [{ rowIndex, field: "sizeClass" as const }] : []),
  ]);
}

export type PriceGuidePhotoImportIssue = {
  path: string;
  message: string;
  confidence: "medium" | "low";
};

export type PriceGuidePhotoImportResponse = {
  document: PriceGuideV2;
  /** @deprecated Explicit read adapter for clients that still consume ServicePriceGuide. */
  guide: ServicePriceGuide;
  summary: string;
  issues: PriceGuidePhotoImportIssue[];
  sourceMediaAssetIds: string[];
  model: string;
};
