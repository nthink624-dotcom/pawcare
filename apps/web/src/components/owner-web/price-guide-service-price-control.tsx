"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type Target = {
  rowIndex: number;
  minKg: number | null;
  maxKg: number | null;
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  label?: string;
};

export type WeightPriceUpdate = {
  rowIndex: number;
  priceMinKrw: number;
  priceMaxKrw: number | null;
};

function targetLabel(target: Target) {
  if (target.label?.trim()) return target.label;
  if (target.maxKg !== null) return target.minKg === null ? `${target.maxKg}kg 이하` : `${target.minKg}~${target.maxKg}kg`;
  if (target.minKg !== null) return `${target.minKg}kg 이상`;
  return "체중 미정";
}

export default function PriceGuideServicePriceControl({
  serviceName,
  groupName,
  targets,
  onApply,
}: {
  serviceName: string;
  groupName: string;
  targets: Target[];
  onApply: (updates: WeightPriceUpdate[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<number, string>>({});
  const [basePrice, setBasePrice] = useState("");
  const [incrementPrice, setIncrementPrice] = useState("5000");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const applyRef = useRef<HTMLButtonElement>(null);

  function openDialog() {
    setValues(Object.fromEntries(targets.map((target) => [target.rowIndex, target.priceMinKrw === null ? "" : String(target.priceMinKrw)])));
    setBasePrice(targets[0]?.priceMinKrw === null || targets[0]?.priceMinKrw === undefined ? "" : String(targets[0].priceMinKrw));
    setIncrementPrice("5000");
    setError("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function updatePriceRule(nextBasePrice: string, nextIncrementPrice: string) {
    if (!nextBasePrice.trim() || !nextIncrementPrice.trim()) return;
    const base = Number(nextBasePrice);
    const increment = Number(nextIncrementPrice);
    if (!Number.isInteger(base) || base < 0 || base > 100_000_000) {
      setError("첫 가격을 0~1억원으로 입력해 주세요.");
      return;
    }
    if (!Number.isInteger(increment) || increment < 0 || increment > 100_000_000) {
      setError("구간별 추가 금액을 0~1억원으로 입력해 주세요.");
      return;
    }
    const nextValues: Record<number, string> = {};
    for (const [index, target] of targets.entries()) {
      const nextPrice = base + index * increment;
      if (!Number.isSafeInteger(nextPrice) || nextPrice > 100_000_000) {
        setError("계산한 가격이 1억원을 넘습니다. 기준 금액이나 추가 금액을 줄여 주세요.");
        return;
      }
      nextValues[target.rowIndex] = String(nextPrice);
    }
    setValues(nextValues);
    setError("");
  }

  function apply() {
    const updates = targets.flatMap((target) => {
      const priceMinKrw = Number(values[target.rowIndex]);
      if (!Number.isInteger(priceMinKrw) || priceMinKrw < 0 || priceMinKrw > 100_000_000) return [];
      const range = target.priceMinKrw !== null && target.priceMaxKrw !== null
        ? target.priceMaxKrw - target.priceMinKrw
        : null;
      const priceMaxKrw = range === null ? target.priceMaxKrw : priceMinKrw + range;
      if (priceMaxKrw !== null && priceMaxKrw > 100_000_000) return [];
      return [{ rowIndex: target.rowIndex, priceMinKrw, priceMaxKrw }];
    });
    if (updates.length !== targets.length) {
      setError("각 가격을 확인해 주세요. 빈칸은 기존 가격을 유지합니다.");
      return;
    }
    onApply(updates);
    close();
  }

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [open]);

  return <>
    <button type="button" onClick={openDialog} aria-haspopup="dialog" aria-label={`${groupName} ${serviceName} 가격 설정`} title="가격 설정" className="inline-flex min-h-11 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-[8px] px-1 text-[14px] font-medium text-[#42536a] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" data-price-guide-service-price-trigger="true">
      가격
    </button>
    {open && typeof document !== "undefined" ? createPortal(
      <dialog ref={dialogRef} aria-label={`${groupName} ${serviceName} 가격 설정`} onCancel={(event) => { event.preventDefault(); close(); }} className="owner-font pm-owner-web fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-xl overflow-y-auto rounded-[14px] border border-[#dbe2ea] bg-white p-3 text-[#172033] shadow-xl backdrop:bg-black/30" data-price-guide-service-price-dialog="true">
        <header className="flex items-center justify-between gap-2"><h3 className="text-[20px] font-semibold leading-7">{groupName} · {serviceName}</h3><button type="button" onClick={close} aria-label="가격 설정 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px]"><X size={20} aria-hidden /></button></header>
        <section className="mt-3 rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] p-3" aria-label="체중별 가격 자동 설정">
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[16px] leading-6 text-[#172033]">
              <span className="whitespace-nowrap">첫 체중 구간은</span>
              <input aria-label="첫 체중 구간 가격" type="number" inputMode="numeric" min={0} max={100000000} step={1000} value={basePrice} onChange={(event) => { const value = event.target.value; setBasePrice(value); updatePriceRule(value, incrementPrice); }} className="h-10 w-[68px] appearance-none rounded-[8px] border border-[#cbd5e1] bg-white px-1.5 text-center text-[16px] leading-6 text-[#172033] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" placeholder="원" />
              <span className="whitespace-nowrap">원,</span>
              <span className="whitespace-nowrap">다음 체중 구간마다</span>
              <input aria-label="구간마다 추가할 금액" type="number" inputMode="numeric" min={0} max={100000000} step={1000} value={incrementPrice} onChange={(event) => { const value = event.target.value; setIncrementPrice(value); updatePriceRule(basePrice, value); }} className="h-10 w-[68px] appearance-none rounded-[8px] border border-[#cbd5e1] bg-white px-1.5 text-center text-[16px] leading-6 text-[#172033] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <span className="whitespace-nowrap">원씩 더해요</span>
          </div>
        </section>
        <div className="mt-2 space-y-1.5">{targets.map((target) => <label key={target.rowIndex} className="grid grid-cols-[minmax(0,1fr)_104px] items-center gap-2 text-[16px] leading-6">
          <span>{targetLabel(target)}</span><span className="flex items-center gap-1"><input aria-label={`${targetLabel(target)} 가격`} type="number" inputMode="numeric" min={0} max={100000000} step={1000} value={values[target.rowIndex] ?? ""} placeholder="미정" onKeyDown={(event) => { if (event.key !== "Enter" || event.nativeEvent.isComposing) return; event.preventDefault(); const inputs = Array.from(dialogRef.current?.querySelectorAll<HTMLInputElement>('input[type="number"]') ?? []); const next = inputs[inputs.indexOf(event.currentTarget) + 1]; if (next) { next.focus(); next.select(); } else applyRef.current?.focus(); }} onChange={(event) => { setValues((current) => ({ ...current, [target.rowIndex]: event.target.value })); setError(""); }} className="h-10 min-w-0 w-full appearance-none rounded-[8px] border border-[#cbd5e1] px-2 text-center text-[16px] leading-6 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" /><span>원</span></span>
        </label>)}</div>
        {error ? <p role="alert" className="mt-3 text-[14px] leading-5 text-[#a04455]">{error}</p> : null}
        <footer className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={close} className="min-h-11 rounded-[10px] border border-[#cbd5e1] text-[16px] font-medium leading-6">취소</button><button ref={applyRef} type="button" onClick={apply} className="min-h-11 rounded-[10px] bg-[#111a30] text-[16px] font-medium leading-6 text-white">적용</button></footer>
      </dialog>, document.body,
    ) : null}
  </>;
}
