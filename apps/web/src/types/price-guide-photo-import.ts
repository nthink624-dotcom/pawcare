import { z } from "zod";

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

export const priceGuideV2WeightBandSchema = z.object({
  label: z.string().trim().min(1).max(80),
  minKg: nullableKg,
  maxKg: nullableKg,
  note: nullableText(500),
}).strict().superRefine((band, context) => {
  if (band.minKg !== null && band.maxKg !== null && band.minKg > band.maxKg) {
    context.addIssue({ code: "custom", path: ["maxKg"], message: "maxKg must be greater than or equal to minKg" });
  }
});

export const priceGuideV2TableGroupSchema = z.object({
  sourceLabel: z.string().trim().min(1).max(160),
  species: priceGuideV2SpeciesSchema,
  breedNames: z.array(z.string().trim().min(1).max(80)).max(100),
  sizeClass: priceGuideV2SizeClassSchema,
  weightBands: z.array(priceGuideV2WeightBandSchema).max(40),
  serviceNames: z.array(z.string().trim().min(1).max(120)).max(40),
  note: nullableText(1_000),
}).strict();

export const priceGuideV2RowSchema = z.object({
  /** Stable local identity for customer exposure. It is assigned by PetManager, never inferred by the provider. */
  sourceItemId: z.string().trim().min(1).max(80).optional(),
  serviceName: nullableText(120),
  species: priceGuideV2SpeciesSchema,
  breedNames: z.array(z.string().trim().min(1).max(80)).max(100),
  breedGroup: nullableText(160),
  sizeClass: priceGuideV2SizeClassSchema,
  minKg: nullableKg,
  maxKg: nullableKg,
  /** Exact visible row heading from the photographed table; optional for stored V2 compatibility. */
  weightBandLabel: nullableText(80).optional(),
  priceKind: priceGuideV2PriceKindSchema,
  priceMinKrw: nullableNonNegativeInteger,
  priceMaxKrw: nullableNonNegativeInteger,
  durationMinutes: z.number().int().min(1).max(1_440).nullable(),
  note: nullableText(1_000),
}).strict().superRefine((row, context) => {
  if (row.minKg !== null && row.maxKg !== null && row.minKg > row.maxKg) {
    context.addIssue({ code: "custom", path: ["maxKg"], message: "maxKg must be greater than or equal to minKg" });
  }
  if (row.priceKind === "unknown" && row.priceMaxKrw !== null) {
    context.addIssue({ code: "custom", path: ["priceMaxKrw"], message: "unknown priceKind cannot contain a maximum price" });
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
  /** Source table axes, including rows that contain only a surcharge note and no price cell. */
  tableGroups: z.array(priceGuideV2TableGroupSchema).max(40).optional(),
  surcharges: z.array(priceGuideV2SurchargeSchema).max(100),
  aiReview: z.array(priceGuideV2AiReviewSchema).max(500),
}).strict();

export type PriceGuideV2 = z.infer<typeof priceGuideV2Schema>;
export type PriceGuideV2Row = z.infer<typeof priceGuideV2RowSchema>;
export type PriceGuideV2TableGroup = z.infer<typeof priceGuideV2TableGroupSchema>;
export type PriceGuideV2WeightBand = z.infer<typeof priceGuideV2WeightBandSchema>;
export type PriceGuideV2Surcharge = z.infer<typeof priceGuideV2SurchargeSchema>;
export type PriceGuideV2AiReview = z.infer<typeof priceGuideV2AiReviewSchema>;

function normalizeSourceIdentityText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function stableSourceIdentityHash(value: string) {
  function hashWithSeed(seed: number) {
    let hash = seed >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619) >>> 0;
    }
    return hash.toString(36).padStart(7, "0");
  }
  return `${hashWithSeed(2_166_136_261)}${hashWithSeed(3_332_248_983)}`;
}

function getLegacyRowIdentity(row: PriceGuideV2Row) {
  return JSON.stringify([
    normalizeSourceIdentityText(row.serviceName),
    row.species,
    row.breedNames.map(normalizeSourceIdentityText).sort(),
    normalizeSourceIdentityText(row.breedGroup),
    row.sizeClass,
    row.minKg,
    row.maxKg,
    normalizeSourceIdentityText(row.weightBandLabel),
  ]);
}

/**
 * Hydrates older JSON documents with durable row identities before editing or
 * customer projection. Price, duration, and notes intentionally do not take
 * part in the identity, so ordinary source edits update the same customer row.
 */
export function ensurePriceGuideV2SourceItemIds(document: PriceGuideV2): PriceGuideV2 {
  const occurrenceByIdentity = new Map<string, number>();
  let changed = false;
  const rows = document.rows.map((row) => {
    const identity = getLegacyRowIdentity(row);
    const occurrence = (occurrenceByIdentity.get(identity) ?? 0) + 1;
    occurrenceByIdentity.set(identity, occurrence);
    if (row.sourceItemId) return row;
    changed = true;
    return {
      ...row,
      sourceItemId: `pgi_${stableSourceIdentityHash(`${identity}\u0000${occurrence}`)}`,
    };
  });
  return changed ? { ...document, rows } : document;
}

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

export type PriceGuidePhotoHardPurgeReceipt = {
  hardPurged: true;
  alreadyPurged: boolean;
  requestCorrelationFingerprint: string;
  correlationFingerprint: string;
  assetFingerprint: string;
  objectLifecycleFingerprint: string;
  objectResidueCount: 0;
  metadataResidueCount: 0;
  receiptFingerprint: string;
};

export type PriceGuidePhotoImportResponse = {
  document: PriceGuideV2;
  /** @deprecated Explicit read adapter for clients that still consume ServicePriceGuide. */
  guide: unknown;
  summary: string;
  issues: PriceGuidePhotoImportIssue[];
  sourceMediaAssetIds: string[];
  cleanupReceipt?: PriceGuidePhotoHardPurgeReceipt | null;
  model: string;
};
