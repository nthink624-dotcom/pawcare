"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { isConfirmedPriceGuideDuration } from "@/lib/price-guide-duration-confirmation";
import { explicitDurationUpdates } from "@/lib/price-guide-explicit-durations";
import type { WeightDurationTarget, WeightDurationUpdate } from "@/lib/price-guide-weight-duration-proposal";

export function serviceDurationStatusLabel({ confirmedDurations, unresolvedCount }: { confirmedDurations: number[]; unresolvedCount: number }) {
  if (unresolvedCount > 0) return confirmedDurations.length > 0 ? "일부 미설정" : "시간 설정";
  return confirmedDurations.length === 1 ? `${confirmedDurations[0]}분` : "개별 설정";
}

type Target = WeightDurationTarget & { label?: string };
function weightLabel(target: Target) {
  if (target.label?.trim()) return target.label;
  if (target.maxKg !== null) return target.minKg ? `${target.minKg}~${target.maxKg}kg` : `${target.maxKg}kg 이하`;
  return target.minKg !== null ? `${target.minKg}kg 이상` : "몸무게 미정";
}

export default function PriceGuideServiceDurationControl({ serviceName, groupName, targets, onApply, openRequest = 0 }: {
  serviceName: string; groupName: string; targets: Target[]; onApply: (updates: WeightDurationUpdate[]) => void; openRequest?: number;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<number, string>>({});
  const [baseMinutes, setBaseMinutes] = useState("");
  const [incrementMinutes, setIncrementMinutes] = useState("10");
  const [error, setError] = useState("");
  const targetsRef = useRef(targets);
  useEffect(() => { targetsRef.current = targets; }, [targets]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const applyRef = useRef<HTMLButtonElement>(null);
  const confirmedDurations = Array.from(new Set(targets.flatMap(target => isConfirmedPriceGuideDuration(target.durationMinutes) ? [target.durationMinutes] : [])));
  const unresolvedCount = targets.filter(target => !isConfirmedPriceGuideDuration(target.durationMinutes)).length;
  const statusLabel = serviceDurationStatusLabel({ confirmedDurations, unresolvedCount });
  function close() { setOpen(false); }
  function apply() {
    try { const updates = explicitDurationUpdates(targets, values); if (updates.length) onApply(updates); close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "예상시간을 확인해 주세요."); }
  }
  function updateWeightRule(nextBaseMinutes: string, nextIncrementMinutes: string) {
    const parsedBaseMinutes = Number(nextBaseMinutes);
    if (!Number.isInteger(parsedBaseMinutes) || !isConfirmedPriceGuideDuration(parsedBaseMinutes)) {
      setError("첫 체중 구간 시간을 15~480분으로 입력해 주세요.");
      return;
    }
    const parsedIncrementMinutes = Number(nextIncrementMinutes);
    if (!Number.isInteger(parsedIncrementMinutes) || parsedIncrementMinutes < 0 || parsedIncrementMinutes > 480) {
      setError("구간별 추가 시간은 0~480분으로 입력해 주세요.");
      return;
    }
    setValues(Object.fromEntries(targets.map((target, bandIndex) => [target.rowIndex, String(parsedBaseMinutes + bandIndex * parsedIncrementMinutes)])));
    setError("");
  }
  useEffect(() => {
    if (openRequest <= 0) return;
    const currentTargets = targetsRef.current;
    setValues(Object.fromEntries(currentTargets.map(target => [target.rowIndex, target.durationMinutes === null ? "" : String(target.durationMinutes)])));
    setBaseMinutes(currentTargets[0]?.durationMinutes === null || currentTargets[0]?.durationMinutes === undefined ? "" : String(currentTargets[0].durationMinutes));
    setIncrementMinutes("10");
    setError("");
    setOpen(true);
  }, [openRequest]);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); triggerRef.current?.focus(); };
  }, [open]);
  return <>
      <button ref={triggerRef} type="button" onClick={() => { setValues(Object.fromEntries(targets.map(target => [target.rowIndex, target.durationMinutes === null ? "" : String(target.durationMinutes)]))); setBaseMinutes(targets[0]?.durationMinutes === null || targets[0]?.durationMinutes === undefined ? "" : String(targets[0].durationMinutes)); setIncrementMinutes("10"); setError(""); setOpen(true); }} aria-haspopup="dialog" aria-expanded={open} aria-label={`${groupName} ${serviceName} 예상시간: ${statusLabel}. 예상시간 설정`} title="예상 시간 설정" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[8px] border-0 bg-transparent px-2 text-[14px] font-medium text-[#42536a] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" data-price-guide-service-duration-trigger="true">
      예상 시간
    </button>
    {open && typeof document !== "undefined" ? createPortal(
      <dialog ref={dialogRef} aria-label={`${groupName} ${serviceName} 예상시간`} onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }} className="owner-font pm-owner-web fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-lg overflow-y-auto rounded-[14px] border border-[#dbe2ea] bg-white p-3 text-[#172033] shadow-xl backdrop:bg-black/30" data-price-guide-service-duration-dialog="true">
        <header className="flex items-center justify-between gap-2"><h3 className="text-[20px] font-semibold leading-7">{groupName} · {serviceName}</h3><button type="button" onClick={close} aria-label="예상시간 설정 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px]"><X size={20} aria-hidden /></button></header>
        <section className="mt-3 rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] p-3" aria-label="체중별 예상시간 자동 설정" data-price-guide-weight-duration-rule>
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[16px] leading-6">
            <span className="whitespace-nowrap text-[#526174]">첫 체중 구간은</span>
            <input aria-label="첫 체중 구간 시간" type="number" inputMode="numeric" min={15} max={480} step={5} value={baseMinutes} onChange={event => { const value = event.target.value; setBaseMinutes(value); updateWeightRule(value, incrementMinutes); }} className="h-10 w-[56px] appearance-none rounded-[8px] border border-[#cbd5e1] bg-white px-1.5 text-center text-[16px] leading-6 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" placeholder="분" />
            <span className="whitespace-nowrap">분, 다음 체중 구간마다</span>
            <input aria-label="구간마다 추가할 시간" type="number" inputMode="numeric" min={0} max={480} step={5} value={incrementMinutes} onChange={event => { const value = event.target.value; setIncrementMinutes(value); updateWeightRule(baseMinutes, value); }} className="h-10 w-[56px] appearance-none rounded-[8px] border border-[#cbd5e1] bg-white px-1.5 text-center text-[16px] leading-6 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <span className="whitespace-nowrap">분씩 더해요</span>
          </div>
        </section>
        <div className="mt-2 space-y-1.5">{targets.map(target => <label key={target.rowIndex} className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-1.5 text-[16px] leading-6">
          <span>{weightLabel(target)}</span><span className="flex items-center gap-1"><input aria-label={`${weightLabel(target)} 예상시간`} type="number" inputMode="numeric" min={15} max={480} step={1} value={values[target.rowIndex] ?? ""} placeholder="미정" onKeyDown={event => { if (event.key !== "Enter" || event.nativeEvent.isComposing) return; event.preventDefault(); event.stopPropagation(); const inputs = Array.from(dialogRef.current?.querySelectorAll<HTMLInputElement>('input') ?? []); const next = inputs[inputs.indexOf(event.currentTarget) + 1]; if (next) { next.focus(); next.select(); } else applyRef.current?.focus(); }} onChange={event => { setValues(current => ({ ...current, [target.rowIndex]: event.target.value })); setError(""); }} className="h-10 min-w-0 w-full appearance-none rounded-[8px] border border-[#cbd5e1] px-1 text-center text-[16px] font-normal leading-6 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" /><span>분</span></span>
        </label>)}</div>
        {error && <p role="alert" className="mt-3 text-[16px] leading-6 text-[#a04455]">{error}</p>}
        <footer className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={close} className="min-h-11 rounded-[10px] border border-[#cbd5e1] text-[16px] font-medium leading-6">취소</button><button ref={applyRef} type="button" onClick={apply} className="min-h-11 rounded-[10px] bg-[#111a30] text-[16px] font-medium leading-6 text-white">적용</button></footer>
      </dialog>, document.body,
    ) : null}
  </>;
}
