/* Generated contract artifact. Source of truth: D:/petmanager/src/lib/price-guide-core.ts */
import { z } from "zod";

export const PRICE_GUIDE_CORE_VERSION = "2.0.0" as const;
export const PRICE_GUIDE_CORE_SOURCE_HASH = "82b9a57e7f0c868f1e876bfa204e7fda3e07e79e81b8b94ec3f221a4613fe33b" as const;

export const mobilePriceGuideCoreContractSchema = z.object({
  version: z.literal(PRICE_GUIDE_CORE_VERSION),
  sourceHash: z.literal(PRICE_GUIDE_CORE_SOURCE_HASH),
}).strict();

const nullableText = (maxLength: number) => z.string().trim().min(1).max(maxLength).nullable();
const nullableMoney = z.number().int().min(0).max(100_000_000).nullable();
const nullableKg = z.number().min(0).max(1_000).nullable();
const speciesSchema = z.enum(["dog", "cat", "all", "unknown"]);
const sizeClassSchema = z.enum(["small", "medium", "large", "extra-large", "all", "unknown"]);
const priceKindSchema = z.enum(["fixed", "starting", "range", "unknown"]);

const weightBandSchema = z.object({
  label: z.string().trim().min(1).max(80),
  minKg: nullableKg,
  maxKg: nullableKg,
  note: nullableText(500),
}).strict().superRefine((band, context) => {
  if (band.minKg !== null && band.maxKg !== null && band.minKg > band.maxKg) {
    context.addIssue({ code: "custom", path: ["maxKg"], message: "maxKg must be greater than or equal to minKg" });
  }
});

const rowSchema = z.object({
  sourceItemId: z.string().trim().min(1).max(80).optional(),
  serviceName: nullableText(120),
  species: speciesSchema,
  breedNames: z.array(z.string().trim().min(1).max(80)).max(100),
  breedGroup: nullableText(160),
  sizeClass: sizeClassSchema,
  minKg: nullableKg,
  maxKg: nullableKg,
  weightBandLabel: nullableText(80).optional(),
  priceKind: priceKindSchema,
  priceMinKrw: nullableMoney,
  priceMaxKrw: nullableMoney,
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
    context.addIssue({ code: "custom", path: ["priceMinKrw"], message: "price requires priceMinKrw" });
  }
  if (row.priceKind === "starting" && row.priceMaxKrw !== null) {
    context.addIssue({ code: "custom", path: ["priceMaxKrw"], message: "starting price cannot contain priceMaxKrw" });
  }
  if (row.priceKind === "fixed" && row.priceMaxKrw !== null && row.priceMaxKrw !== row.priceMinKrw) {
    context.addIssue({ code: "custom", path: ["priceMaxKrw"], message: "fixed priceMaxKrw must match priceMinKrw" });
  }
  if (row.priceKind === "range" && (
    row.priceMinKrw === null || row.priceMaxKrw === null || row.priceMinKrw > row.priceMaxKrw
  )) {
    context.addIssue({ code: "custom", path: ["priceMaxKrw"], message: "range price requires ordered bounds" });
  }
});

export const mobilePriceGuideV2Schema = z.object({
  schemaVersion: z.literal(2),
  source: z.enum(["ai_imported", "owner_corrected", "vision", "fixture", "manual", "owner_confirmed", "legacy"]),
  overallNote: nullableText(4_000),
  rows: z.array(rowSchema).max(200),
  tableGroups: z.array(z.object({
    sourceLabel: z.string().trim().min(1).max(160),
    species: speciesSchema,
    breedNames: z.array(z.string().trim().min(1).max(80)).max(100),
    sizeClass: sizeClassSchema,
    weightBands: z.array(weightBandSchema).max(40),
    serviceNames: z.array(z.string().trim().min(1).max(120)).max(40),
    note: nullableText(1_000),
  }).strict()).max(40).optional(),
  surcharges: z.array(z.object({
    condition: nullableText(200),
    amountKrw: nullableMoney,
    percent: z.number().min(0).max(1_000).nullable(),
    note: nullableText(1_000),
  }).strict()).max(100),
  aiReview: z.array(z.object({
    targetId: z.string().trim().min(1).max(160),
    field: z.string().trim().min(1).max(80),
    rawText: z.string().max(500),
    confidence: z.enum(["medium", "low"]),
    userConfirmed: z.boolean(),
    userCorrected: z.boolean(),
  }).strict()).max(500),
}).strict();

export type MobilePriceGuideV2 = z.infer<typeof mobilePriceGuideV2Schema>;
export type MobilePriceGuideRow = MobilePriceGuideV2["rows"][number];
export type MobilePriceGuideTableGroup = NonNullable<MobilePriceGuideV2["tableGroups"]>[number];
export type MobilePriceGuideWeightBand = MobilePriceGuideTableGroup["weightBands"][number];
export type MobilePriceKind = MobilePriceGuideRow["priceKind"];

export function assertMobilePriceGuideCoreContract(value: unknown) {
  mobilePriceGuideCoreContractSchema.parse(value);
}

export function getMobilePriceGuideCoreContract() {
  return {
    version: PRICE_GUIDE_CORE_VERSION,
    sourceHash: PRICE_GUIDE_CORE_SOURCE_HASH,
  } as const;
}
