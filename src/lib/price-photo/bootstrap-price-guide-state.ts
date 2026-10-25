import type { BootstrapPayload } from "@/types/domain";
import type { PriceGuideSessionState } from "@/components/auth/mobile-ai-price-guide-fixture";
import { ensureMobilePriceGuideSourceItemIds } from "@/lib/price-photo/mobile-price-photo-adapter";
import { isMobilePriceGuideV2, toMobilePriceDrafts } from "@/lib/price-photo/mobile-price-photo-http-adapter";

export function readBootstrapPriceGuideState(services: BootstrapPayload["services"]): PriceGuideSessionState | null {
  for (const service of services) {
    if (!isMobilePriceGuideV2(service.price_guide)) continue;
    const document = ensureMobilePriceGuideSourceItemIds(service.price_guide);
    return {
      serviceId: service.id,
      document,
      resumeMode: document.source === "manual" ? "manual" : "review",
      rows: toMobilePriceDrafts(document).map((row) => ({
        id: row.clientId,
        rowIndex: row.rowIndex,
        name: row.serviceName,
        priceKind: row.priceKind,
        price: String(row.fixedPrice ?? row.minimumPrice ?? ""),
        maximumPrice: String(row.maximumPrice ?? ""),
        durationMinutes: row.durationMinutes === null ? "" : String(row.durationMinutes),
      })),
    };
  }
  return null;
}
