"use client";

import { ArrowLeft } from "lucide-react";

import PriceGuideV2ServiceDetail from "@/components/owner-web/price-guide-v2-service-detail";
import { buildDefaultPriceGuideV2Draft } from "@/components/owner-web/service-price-guide";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

export function createEmptyManualPriceGuideDocument(): PriceGuideV2 {
  return buildDefaultPriceGuideV2Draft();
}

export default function PriceGuideManualOnboarding({
  initialDocument,
  onBack,
  onSave,
  onSaveActionReady,
  manualMatrixMode = true,
}: {
  initialDocument?: PriceGuideV2 | null;
  onBack: () => void;
  onSave: (document: PriceGuideV2) => Promise<boolean>;
  onSaveActionReady?: (action: (() => Promise<void>) | null) => void;
  /** Only direct entry omits the review editor's price-kind controls. */
  manualMatrixMode?: boolean;
}) {
  const priceGuide = initialDocument ?? createEmptyManualPriceGuideDocument();

  return (
    <section className="min-w-0 space-y-3" data-testid="price-guide-manual-onboarding">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] px-2 text-[14px] font-medium leading-5 text-[#526174] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        직접 입력 닫기
      </button>
      <PriceGuideV2ServiceDetail
        document={priceGuide}
        onSave={onSave}
        startEditing
        manualMatrixMode={manualMatrixMode}
        onSaveActionReady={onSaveActionReady}
      />
    </section>
  );
}
