"use client";

import { ChevronDown, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { isConfirmedPriceGuideDuration } from "@/lib/price-guide-duration-confirmation";
import { explicitDurationUpdates } from "@/lib/price-guide-explicit-durations";
import { proposeWeightDurations, type WeightDurationTarget, type WeightDurationUpdate } from "@/lib/price-guide-weight-duration-proposal";

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

export default function PriceGuideServiceDurationControl({ serviceName, groupName, targets, onApply }: {
  serviceName: string; groupName: string; targets: Target[]; onApply: (updates: WeightDurationUpdate[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<number, string>>({});
  const [baseMinutes, setBaseMinutes] = useState("");
  const [stepKg, setStepKg] = useState<2 | 3>(2);
  const [error, setError] = useState("");
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
  function applyWeightRule() {
    const parsedBaseMinutes = Number(baseMinutes);
    if (!Number.isInteger(parsedBaseMinutes) || !isConfirmedPriceGuideDuration(parsedBaseMinutes)) {
      setError("2kg 이하 기준 시간을 15~480분으로 입력해 주세요.");
      return;
    }
    const proposed = proposeWeightDurations(targets, {
      baseKg: 2,
      baseMinutes: parsedBaseMinutes,
      stepKg,
      incrementMinutes: 10,
    });
    if (proposed.some((target) => target.proposedDurationMinutes === null)) {
      setError("체중 구간을 확인한 뒤 다시 계산해 주세요.");
      return;
    }
    setValues(Object.fromEntries(proposed.map((target) => [target.rowIndex, String(target.proposedDurationMinutes)])));
    setError("");
  }
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); triggerRef.current?.focus(); };
  }, [open]);
  return <>
    <button ref={triggerRef} type="button" onClick={() => { setValues(Object.fromEntries(targets.map(target => [target.rowIndex, target.durationMinutes === null ? "" : String(target.durationMinutes)]))); setBaseMinutes(""); setError(""); setOpen(true); }} aria-haspopup="dialog" aria-expanded={open} aria-label={`${groupName} ${serviceName} 예상시간: ${statusLabel}. 예상시간 설정`} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-[8px] border-0 bg-transparent px-2.5 text-[16px] font-medium leading-6 text-[#42536a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" data-price-guide-service-duration-trigger="true">
      시간 설정<ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
    </button>
    {open && typeof document !== "undefined" ? createPortal(
      <dialog ref={dialogRef} aria-label={`${groupName} ${serviceName} 예상시간`} onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md overflow-y-auto rounded-[14px] border border-[#dbe2ea] bg-white p-4 text-[#172033] shadow-xl backdrop:bg-black/30" data-price-guide-service-duration-dialog="true">
        <header className="flex items-center justify-between gap-2"><h3 className="text-[20px] font-semibold leading-7">{groupName} · {serviceName}</h3><button type="button" onClick={close} aria-label="예상시간 설정 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px]"><X size={20} aria-hidden /></button></header>
        <section className="mt-4 rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] p-3" aria-label="체중별 예상시간 자동 설정" data-price-guide-weight-duration-rule>
          <p className="text-[16px] font-medium leading-6">체중별 시간 자동 설정</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <label className="min-w-0 text-[16px] leading-6"><span className="block text-[#526174]">2kg 이하 기준 시간</span><span className="mt-1 flex items-center gap-2"><input aria-label="2kg 이하 기준 시간" type="number" inputMode="numeric" min={15} max={480} step={5} value={baseMinutes} onChange={event => { setBaseMinutes(event.target.value); setError(""); }} className="h-11 min-w-0 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-2 text-[16px] font-normal leading-6" placeholder="예: 40" /><span>분</span></span></label>
            <label className="text-[16px] leading-6"><span className="block text-[#526174]">증가 간격</span><select aria-label="체중 증가 간격" value={stepKg} onChange={event => setStepKg(Number(event.target.value) as 2 | 3)} className="mt-1 h-11 rounded-[8px] border border-[#cbd5e1] bg-white px-2 text-[16px] font-medium leading-6"><option value={2}>2kg마다</option><option value={3}>3kg마다</option></select></label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[16px] leading-6 text-[#526174]">선택한 간격마다 10분씩 추가돼요.</p><button type="button" onClick={applyWeightRule} className="min-h-11 rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[16px] font-medium leading-6 text-[#172033]">계산해서 채우기</button></div>
        </section>
        <div className="mt-3 space-y-3">{targets.map(target => <label key={target.rowIndex} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 text-[16px] leading-6">
          <span>{weightLabel(target)}</span><span className="flex items-center gap-2"><input aria-label={`${weightLabel(target)} 예상시간`} type="number" inputMode="numeric" min={15} max={480} step={1} value={values[target.rowIndex] ?? ""} placeholder="미정" onKeyDown={event => { if (event.key !== "Enter" || event.nativeEvent.isComposing) return; event.preventDefault(); event.stopPropagation(); const inputs = Array.from(dialogRef.current?.querySelectorAll<HTMLInputElement>('input') ?? []); const next = inputs[inputs.indexOf(event.currentTarget) + 1]; if (next) { next.focus(); next.select(); } else applyRef.current?.focus(); }} onChange={event => { setValues(current => ({ ...current, [target.rowIndex]: event.target.value })); setError(""); }} className="h-11 min-w-0 w-full rounded-[8px] border border-[#cbd5e1] px-2 text-[16px] font-normal leading-6" /><span>분</span></span>
        </label>)}</div>
        {error && <p role="alert" className="mt-3 text-[16px] leading-6 text-[#a04455]">{error}</p>}
        <footer className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={close} className="min-h-11 rounded-[10px] border border-[#cbd5e1] text-[16px] font-medium leading-6">취소</button><button ref={applyRef} type="button" onClick={apply} className="min-h-11 rounded-[10px] bg-[#111a30] text-[16px] font-medium leading-6 text-white">적용</button></footer>
      </dialog>, document.body,
    ) : null}
  </>;
}
