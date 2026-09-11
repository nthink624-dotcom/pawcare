import type { PriceGuideV2 } from "@/types/price-guide-photo-import";
import { isConfirmedPriceGuideDuration } from "@/lib/price-guide-duration-confirmation";

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
  const primary = document.rows.find((row) => (
    Boolean(row.serviceName?.trim())
    && row.priceMinKrw !== null
    && Number.isInteger(row.priceMinKrw)
    && isConfirmedPriceGuideDuration(row.durationMinutes)
  ));
  if (!primary) return null;
  return {
    name: primary.serviceName!.trim(),
    price: primary.priceMinKrw!,
    priceType: primary.priceKind === "fixed" ? "fixed" : "starting",
    durationMinutes: primary.durationMinutes!,
  };
}
