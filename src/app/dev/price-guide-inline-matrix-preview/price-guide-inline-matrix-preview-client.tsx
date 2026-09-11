"use client";

import { useState } from "react";

import PriceGuideNativeInlineTable from "@/components/owner-web/price-guide-native-inline-table";
import { createPriceGuidePhotoImportFixture } from "@/lib/price-guide-photo-import-fixture";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

export default function PriceGuideInlineMatrixPreviewClient() {
  const [draft, setDraft] = useState<PriceGuideV2>(
    () => createPriceGuidePhotoImportFixture().document,
  );

  return (
    <main
      className="min-h-dvh overflow-x-hidden bg-[#f5f7fa] px-3 py-5 text-[#172033] sm:px-6 sm:py-8"
      data-preview-source="fixture"
      data-network-mode="none"
      data-persisted="false"
    >
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="mb-4 px-1 sm:mb-5">
          <p className="text-[13px] font-medium leading-5 text-[#64748b]">
            Development 전용 · 저장 없음
          </p>
          <h1 className="mt-1 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[#172033]">
            사진 분석 요금표 편집
          </h1>
          <p className="mt-2 text-[14px] font-normal leading-5 text-[#64748b]">
            금액과 예상시간을 같은 칸에서 바로 수정할 수 있어요.
          </p>
        </header>

        <section className="min-w-0 rounded-[14px] border border-[#dbe2ea] bg-white p-3 sm:p-5">
          <PriceGuideNativeInlineTable
            document={draft}
            onChange={setDraft}
            validationIssues={[]}
            heading="분석한 요금표 확인"
            photoReviewMode
          />
        </section>
      </div>
    </main>
  );
}
