"use client";

import { ChevronDown, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { PriceGuideV2WeightBand } from "@/types/price-guide-photo-import";

function buildWeightBands(bands: PriceGuideV2WeightBand[], firstMaxKg: number, stepKg: 2 | 3) {
  return bands.map((band, index) => {
    const minKg = index === 0 ? null : firstMaxKg + (index - 1) * stepKg;
    const maxKg = index === 0 ? firstMaxKg : index === bands.length - 1 ? null : firstMaxKg + index * stepKg;
    const label = maxKg === null ? `${minKg}kg 이상` : minKg === null ? `${maxKg}kg 이하` : `${minKg}~${maxKg}kg`;
    return { ...band, label, minKg, maxKg };
  });
}

export default function PriceGuideWeightBandControl({ groupName, bands, onApply }: {
  groupName: string;
  bands: PriceGuideV2WeightBand[];
  onApply: (nextBands: PriceGuideV2WeightBand[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [firstMaxKg, setFirstMaxKg] = useState("2");
  const [stepKg, setStepKg] = useState<2 | 3>(2);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstBand = bands[0];
  const preview = buildWeightBands(
    bands,
    Number(firstMaxKg) || 2,
    stepKg,
  );

  function openDialog() {
    setFirstMaxKg(String(firstBand?.maxKg ?? 2));
    setStepKg(2);
    setError("");
    setOpen(true);
  }

  function apply() {
    const cutoff = Number(firstMaxKg);
    if (!Number.isFinite(cutoff) || cutoff <= 0 || cutoff > 100) {
      setError("첫 구간의 끝 무게를 0보다 크고 100kg 이하로 입력해 주세요.");
      return;
    }
    onApply(buildWeightBands(bands, cutoff, stepKg));
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [open]);

  return <>
    <button type="button" onClick={openDialog} aria-haspopup="dialog" className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[15px] font-medium text-[#42536a] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" data-price-guide-weight-band-setup-trigger="true">
      체중 구간 간편 설정<ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
    </button>
    {open && typeof document !== "undefined" ? createPortal(
      <dialog ref={dialogRef} aria-label={`${groupName} 체중 구간 간편 설정`} onCancel={(event) => { event.preventDefault(); setOpen(false); }} className="owner-font pm-owner-web fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md overflow-y-auto rounded-[14px] border border-[#dbe2ea] bg-white p-4 text-[#172033] shadow-xl backdrop:bg-black/30" data-price-guide-weight-band-setup-dialog="true">
        <header className="flex items-center justify-between gap-2"><h3 className="text-[18px] font-semibold leading-6">{groupName} · 체중 구간</h3><button type="button" onClick={() => setOpen(false)} aria-label="체중 구간 설정 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px]"><X size={20} aria-hidden /></button></header>
        <p className="mt-2 text-[14px] leading-5 text-[#526174]">현재 구간 수({bands.length}개)는 유지하고 경계만 정리해요.</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <label className="inline-flex items-center gap-2 whitespace-nowrap text-[14px] leading-5 text-[#526174]"><span>첫 구간 끝</span>
            <span className="flex items-center gap-1"><input aria-label="첫 체중 구간 끝 무게" type="number" min={0.1} max={100} step={0.1} value={firstMaxKg} onChange={(event) => { setFirstMaxKg(event.target.value); setError(""); }} className="h-10 w-[64px] appearance-none rounded-[8px] border border-[#cbd5e1] px-1.5 text-center text-[16px] text-[#172033] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" /><span>kg</span></span>
          </label>
          <label className="inline-flex items-center gap-2 whitespace-nowrap text-[14px] leading-5 text-[#526174]"><span>이후 간격</span>
            <select aria-label="이후 체중 구간 간격" value={stepKg} onChange={(event) => setStepKg(Number(event.target.value) as 2 | 3)} className="h-10 rounded-[8px] border border-[#cbd5e1] bg-white px-2 text-[16px] text-[#172033]"><option value={2}>2kg씩</option><option value={3}>3kg씩</option></select>
          </label>
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="체중 구간 미리보기">{preview.map((band, index) => <li key={`${band.label}-${index}`} className="rounded-full border border-[#dbe2ea] bg-[#f8fafc] px-2.5 py-1 text-[14px] text-[#334155]">{band.label}</li>)}</ul>
        {error ? <p role="alert" className="mt-2 text-[14px] leading-5 text-[#a04455]">{error}</p> : null}
        <footer className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-[8px] border border-[#cbd5e1] text-[15px] font-medium">취소</button><button type="button" onClick={apply} className="min-h-11 rounded-[8px] bg-[#172033] text-[15px] font-medium text-white">적용</button></footer>
      </dialog>, document.body,
    ) : null}
  </>;
}
