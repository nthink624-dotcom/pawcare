"use client";

import { useState } from "react";

import {
  parsePriceGuideRoughInput,
  type PriceGuideRoughInputField,
  type PriceGuideRoughInputResult,
} from "@/lib/price-guide-rough-input";

const fieldLabels: Record<PriceGuideRoughInputField, string> = {
  serviceName: "서비스명",
  species: "반려동물",
  sizeClass: "체급",
  weight: "체중 구간",
  price: "가격 방식·금액",
  durationMinutes: "소요 시간",
};

export default function PriceGuideRoughInputPanel({
  onCreateDraft,
}: {
  onCreateDraft: (result: PriceGuideRoughInputResult) => void;
}) {
  const [roughInput, setRoughInput] = useState("");
  const [lastResult, setLastResult] = useState<PriceGuideRoughInputResult | null>(null);

  function createDraft() {
    if (!roughInput.trim()) return;
    const result = parsePriceGuideRoughInput(roughInput);
    setLastResult(result);
    onCreateDraft(result);
  }

  return (
    <section className="rounded-[14px] border border-[#dbe3ec] bg-[#f8fafc] p-4" aria-labelledby="price-guide-rough-input-heading">
      <h2 id="price-guide-rough-input-heading" className="text-[16px] font-semibold leading-6 text-[#172033]">한 줄 메모로 초안 만들기</h2>
      <p className="mt-1 text-[13px] font-normal leading-5 text-[#607080]">적힌 내용만 옮깁니다. 빠진 동물·체급·가격 방식·가격 범위·시간은 확인 필요로 남아요.</p>
      <label htmlFor="price-guide-rough-input" className="mt-3 block text-[13px] font-medium leading-5 text-[#42536a]">
        요금 메모
        <textarea
          id="price-guide-rough-input"
          value={roughInput}
          maxLength={240}
          onChange={(event) => setRoughInput(event.target.value)}
          className="mt-1.5 min-h-[88px] w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 py-2.5 text-[16px] font-normal leading-6 text-[#172033] outline-none placeholder:text-[#94a3b8] focus-visible:border-[#1d3557] focus-visible:ring-2 focus-visible:ring-[#1d3557]/15"
          placeholder="예: 전체미용 5만원 1시간"
        />
      </label>
      <button
        type="button"
        onClick={createDraft}
        disabled={!roughInput.trim()}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#172033] px-4 text-[14px] font-medium leading-5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
      >
        편집 가능한 초안 만들기
      </button>
      {lastResult ? (
        <div className="mt-3 rounded-[10px] bg-white px-3 py-2.5 text-[12px] font-normal leading-5 text-[#526174]" aria-live="polite">
          <p><span className="font-medium text-[#334155]">옮긴 내용</span> · {lastResult.recognizedFields.length > 0 ? lastResult.recognizedFields.map((field) => fieldLabels[field]).join(", ") : "없음"}</p>
          <p className="mt-1"><span className="font-medium text-[#8a6418]">확인 필요</span> · {lastResult.missingFields.length > 0 ? lastResult.missingFields.map((field) => fieldLabels[field]).join(", ") : "없음"}</p>
        </div>
      ) : null}
    </section>
  );
}
