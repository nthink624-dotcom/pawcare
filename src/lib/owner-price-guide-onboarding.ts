import { buildPriceGuideV2Compatibility } from "@/lib/auth/signup-service-pricing";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

export type OwnerPriceGuideServiceProjection = {
  name: string;
  price: number;
  priceType: "fixed" | "starting";
  durationMinutes: number;
};

/**
 * Projects the canonical document to the one legacy service summary required by
 * `/api/services`. The complete PriceGuideV2 remains the saved source of truth.
 */
export function getOwnerPriceGuideServiceProjection(
  document: PriceGuideV2,
): OwnerPriceGuideServiceProjection | null {
  const compatibility = buildPriceGuideV2Compatibility(document);
  if (!compatibility.storageValidation.complete) return null;
  const primary = compatibility.services[0];
  if (!primary) return null;
  return {
    name: primary.name,
    price: primary.price,
    priceType: primary.priceType ?? "starting",
    durationMinutes: primary.durationMinutes,
  };
}
