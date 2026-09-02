"use client";

import { useState } from "react";

import { ServicePriceGuideV2View } from "@/components/owner-web/service-price-guide-v2-view";

import {
  priceGuideV2PreviewScenarios,
  type PriceGuideV2PreviewScenarioId,
} from "./price-guide-v2-preview-fixtures";

export default function PriceGuideV2PreviewClient() {
  const [scenarioId, setScenarioId] =
    useState<PriceGuideV2PreviewScenarioId>("owner-corrected");
  const scenario =
    priceGuideV2PreviewScenarios.find((candidate) => candidate.id === scenarioId) ??
    priceGuideV2PreviewScenarios[0];

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[#f1f3f7] px-3 py-6 text-[#172033] sm:px-6 sm:py-8"
      data-preview-source="fixture"
      data-persisted="false"
    >
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="rounded-[14px] border border-[#d9e3ef] bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-medium tracking-[0.08em] text-[#2563eb]">
                로그인 후 화면 검수
              </p>
              <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[#172033] sm:text-[24px]">
                상세 요금표 미리보기
              </h1>
              <p className="mt-2 max-w-[720px] text-[14px] leading-6 text-[#607080]">
                사진에서 읽은 요금표가 로그인 후 어떻게 보이는지 확인하는 화면입니다.
              </p>
            </div>
            <span className="inline-flex min-h-11 shrink-0 items-center rounded-[8px] border border-[#ead7b3] bg-[#fffaf0] px-3 text-[13px] font-medium text-[#8a641f]">
              검수용 예시 · 저장 없음
            </span>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="요금표 저장 상태 선택">
            {priceGuideV2PreviewScenarios.map((candidate) => {
              const selected = candidate.id === scenario.id;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setScenarioId(candidate.id)}
                  className={`min-h-11 rounded-[8px] border px-3 py-2 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/30 ${
                    selected
                      ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]"
                      : "border-[#dbe2ea] bg-white text-[#526174] hover:bg-[#f8fafc]"
                  }`}
                >
                  {candidate.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[13px] leading-5 text-[#607080]" aria-live="polite">
            {scenario.description}
          </p>
        </header>

        <section
          aria-labelledby="price-guide-v2-preview-title"
          className="mt-4 rounded-[14px] border border-[#d9e3ef] bg-white p-4 sm:p-6"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[#edf2f7] pb-4">
            <div>
              <p className="text-[12px] text-[#64748b]">로그인 후 · 매장 설정</p>
              <h2
                id="price-guide-v2-preview-title"
                className="mt-1 text-[20px] font-semibold tracking-[-0.025em] text-[#111827]"
              >
                미용 요금표
              </h2>
            </div>
            <p className="rounded-[8px] bg-[#f1f5f9] px-3 py-2 text-[12px] text-[#526174]">
              회원정보·요금표 저장 0건
            </p>
          </div>

          <ServicePriceGuideV2View document={scenario.document} />
        </section>
      </div>
    </main>
  );
}
