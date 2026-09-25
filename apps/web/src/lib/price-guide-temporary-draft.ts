import { z } from "zod";
import { priceGuideV2Schema, priceGuideV2RowSchema, priceGuideV2TableGroupSchema, priceGuideV2WeightBandSchema, type PriceGuideV2 } from "@/types/price-guide-photo-import";

// Preserve incomplete edits without relaxing the canonical save schema.
const draftSchema = z.object({
  ...priceGuideV2Schema.shape,
  rows: z.array(z.object(priceGuideV2RowSchema.shape).strict()).max(200),
  tableGroups: z.array(z.object({
    ...priceGuideV2TableGroupSchema.shape,
    sourceLabel: z.string().max(160),
    serviceNames: z.array(z.string().max(120)).max(40),
    weightBands: z.array(z.object({ ...priceGuideV2WeightBandSchema.shape, label: z.string().max(80) }).strict()).max(40),
  }).strict()).max(40).optional(),
}).strict();

export const PRICE_GUIDE_DRAFT_TTL = 24 * 60 * 60 * 1000;
export const priceGuideDraftKey = (ownerId: string, shopId: string) => `petmanager:price-guide-draft:v1:${encodeURIComponent(ownerId)}:${encodeURIComponent(shopId)}`;
export function savePriceGuideTemporaryDraft(storage: Storage, key: string, document: PriceGuideV2, now = Date.now()) {
  // Strict schema rejects unknown properties such as upload URLs and auth metadata.
  const parsed = draftSchema.parse(document);
  storage.setItem(key, JSON.stringify({ version: 1, expiresAt: now + PRICE_GUIDE_DRAFT_TTL, document: parsed }));
}
export function readPriceGuideTemporaryDraft(storage: Storage, key: string, now = Date.now()): PriceGuideV2 | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Number.isFinite(data.expiresAt) || data.expiresAt <= now || data.expiresAt > now + PRICE_GUIDE_DRAFT_TTL) throw new Error("expired");
    return draftSchema.parse(data.document);
  } catch { storage.removeItem(key); return null; }
}
