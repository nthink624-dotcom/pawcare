import { z } from "zod";

import {
  ensurePriceGuideV2SourceItemIds,
  priceGuideV2Schema,
  resolvePriceGuideV2Reviews,
  type PriceGuideV2,
  type PriceGuideV2ReviewResolution,
} from "@/types/price-guide-photo-import";

export const PRICE_GUIDE_CORE_VERSION = "2.0.0" as const;
export const PRICE_GUIDE_CORE_SOURCE_HASH = "82b9a57e7f0c868f1e876bfa204e7fda3e07e79e81b8b94ec3f221a4613fe33b" as const;

export const priceGuideCoreContractSchema = z.object({
  version: z.literal(PRICE_GUIDE_CORE_VERSION),
  sourceHash: z.literal(PRICE_GUIDE_CORE_SOURCE_HASH),
}).strict();

export type PriceGuideCoreContract = z.infer<typeof priceGuideCoreContractSchema>;

export function getPriceGuideCoreContract(): PriceGuideCoreContract {
  return {
    version: PRICE_GUIDE_CORE_VERSION,
    sourceHash: PRICE_GUIDE_CORE_SOURCE_HASH,
  };
}

const legacyCellSchema = z.object({
  price: z.string(),
  durationMinutes: z.string(),
}).passthrough();

const legacyItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  durationMinutes: z.string().optional(),
  prices: z.record(z.string(), z.string()).optional(),
  cells: z.record(z.string(), legacyCellSchema).optional(),
}).passthrough();

const legacySectionSchema = z.object({
  id: z.string(),
  species: z.enum(["dog", "cat"]).optional(),
  title: z.string(),
  note: z.string(),
  weightBands: z.array(z.string()),
  items: z.array(legacyItemSchema),
}).passthrough();

/** Explicit legacy shape. Passthrough preserves fields from older stored guides. */
export const legacyServicePriceGuideSchema = z.object({
  enabled: z.boolean(),
  weightBands: z.array(z.string()),
  items: z.array(legacyItemSchema),
  sections: z.array(legacySectionSchema).optional(),
  extraNote: z.string(),
  extraFees: z.array(z.object({
    id: z.string(),
    label: z.string(),
    price: z.string(),
  }).passthrough()),
  canonicalV2: priceGuideV2Schema.optional(),
}).passthrough();

export const servicePriceGuideInputSchema = z.union([
  priceGuideV2Schema,
  legacyServicePriceGuideSchema,
  z.object({}).strict(),
]);

export type ServicePriceGuideInput = z.infer<typeof servicePriceGuideInputSchema>;

function redactReviewRawText(document: PriceGuideV2): PriceGuideV2 {
  return {
    ...document,
    aiReview: document.aiReview.map((review) => ({ ...review, rawText: "" })),
  };
}

export function normalizeCanonicalPriceGuide(document: PriceGuideV2): PriceGuideV2 {
  return priceGuideV2Schema.parse(ensurePriceGuideV2SourceItemIds(document));
}

export function readCanonicalPriceGuide(value: unknown): PriceGuideV2 | null {
  const root = priceGuideV2Schema.safeParse(value);
  if (root.success) return normalizeCanonicalPriceGuide(root.data);
  const legacy = legacyServicePriceGuideSchema.safeParse(value);
  if (!legacy.success || !legacy.data.canonicalV2) return null;
  return normalizeCanonicalPriceGuide(legacy.data.canonicalV2);
}

export function projectCanonicalPriceGuidesForRead<T extends { price_guide?: unknown }>(services: T[]): T[] {
  return services.map((service) => {
    const canonical = readCanonicalPriceGuide(service.price_guide);
    return canonical ? { ...service, price_guide: canonical } : service;
  });
}

/**
 * Validates the only accepted save shapes, assigns stable row identities, removes
 * captured OCR text, then validates the final storage value a second time.
 */
export function preparePriceGuideForStorage(value: unknown): ServicePriceGuideInput {
  const parsed = servicePriceGuideInputSchema.parse(value);
  const root = priceGuideV2Schema.safeParse(parsed);
  if (root.success) {
    return priceGuideV2Schema.parse(redactReviewRawText(normalizeCanonicalPriceGuide(root.data)));
  }

  if (Object.keys(parsed).length === 0) return {};

  const legacy = legacyServicePriceGuideSchema.parse(parsed);
  if (!legacy.canonicalV2) return legacyServicePriceGuideSchema.parse(legacy);
  return legacyServicePriceGuideSchema.parse({
    ...legacy,
    canonicalV2: redactReviewRawText(normalizeCanonicalPriceGuide(legacy.canonicalV2)),
  });
}

export function resolveCanonicalPriceGuideReviews(
  document: PriceGuideV2,
  matches: Parameters<typeof resolvePriceGuideV2Reviews>[1],
  resolution: PriceGuideV2ReviewResolution,
) {
  return normalizeCanonicalPriceGuide(resolvePriceGuideV2Reviews(document, matches, resolution));
}
