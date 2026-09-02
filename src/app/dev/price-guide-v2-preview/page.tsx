"use client";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import PriceGuidePhotoOnboarding from "@/components/owner-web/price-guide-photo-onboarding";
import { createPriceGuidePhotoImportFixture } from "@/lib/price-guide-photo-import-fixture";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

function PriceGuideV2PreviewSurface() {
  const searchParams = useSearchParams();
  const state = searchParams.get("state") === "saved" ? "saved" : "empty";
  const [document, setDocument] = useState<PriceGuideV2 | null>(() =>
    state === "saved" ? createPriceGuidePhotoImportFixture().document : null,
  );

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#f5f7fa] px-4 py-6 sm:px-6" data-preview-source="fixture" data-preview-state={state} data-persisted="false">
      <div className="mx-auto w-full max-w-[960px] rounded-[18px] bg-white p-4 sm:p-6">
        <p className="mb-4 text-[13px] font-medium leading-5 text-[#64748b]">검수용 예시 · 저장 없음</p>
        <PriceGuidePhotoOnboarding
          key={state}
          shopId="price-guide-v2-preview"
          fixtureMode
          initialDocument={document}
          onApply={async (next) => {
            if ("schemaVersion" in next) setDocument(next);
            return true;
          }}
        />
      </div>
    </main>
  );
}

export default function PriceGuideV2PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <Suspense fallback={null}>
      <PriceGuideV2PreviewSurface />
    </Suspense>
  );
}
