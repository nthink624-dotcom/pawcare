"use client";

import { Plus, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";

import MobilePriceGuideExtras from "@/components/auth/mobile-price-guide-extras";

import {
  addMobilePriceGuideGroup,
  addMobilePriceGuideService,
  addMobilePriceGuideWeightBand,
  readMobilePriceGuideMatrix,
  readPreservedMobilePriceGuideRows,
  removeMobilePriceGuideGroup,
  removeMobilePriceGuideService,
  removeMobilePriceGuideWeightBand,
  updateMobilePriceGuideCell,
  updateMobilePriceGuideGroup,
  updateMobilePriceGuideService,
  updateMobilePriceGuideWeightBand,
} from "@/lib/price-photo/mobile-price-guide-matrix";
import {
  MAX_SERVICE_PRICE_KRW,
  type MobilePriceGuideRow,
  type MobilePriceGuideV2,
} from "@/lib/price-photo/mobile-price-photo-adapter";

// PRICE_GUIDE_UI_HARD_CONTRACT: 16/24 only; compact geometry and centered price + duration share one nowrap row.
const inputClass = "h-11 w-full min-w-0 rounded-[8px] border border-slate-300 bg-white px-2.5 text-[16px] font-normal leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3 text-[16px] font-medium leading-6 text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
const iconClass = "inline-grid size-11 shrink-0 place-items-center rounded-[8px] text-slate-500 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
const KNOWN_BREEDS = ["말티즈", "믹스", "말티푸", "푸들", "포메라니안", "비숑", "시츄", "치와와", "요크셔테리어", "스피츠", "슈나우저", "비글", "페키니즈", "꼬똥드툴레아", "코카스파니엘", "웰시코기", "베들링턴테리어", "빠삐용"];

function normalizedKey(value: string) {
  return value.replace(/\s+/g, "").trim().toLocaleLowerCase("ko-KR");
}

function nullableInteger(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function compactCellLabel(row: MobilePriceGuideRow) {
  const price = row.priceMinKrw === null
    ? "미정"
    : row.priceKind === "range" && row.priceMaxKrw !== null
      ? `${row.priceMinKrw.toLocaleString("ko-KR")}~${row.priceMaxKrw.toLocaleString("ko-KR")}원`
      : `${row.priceMinKrw.toLocaleString("ko-KR")}원${row.priceKind === "starting" ? "부터" : ""}`;
  return `${price} · ${row.durationMinutes === null ? "미정" : `${row.durationMinutes}분`}`;
}

function priceDisplayLabel(row: MobilePriceGuideRow) {
  if (row.priceMinKrw === null) return "미정";
  if (row.priceKind === "range") {
    return row.priceMaxKrw === null
      ? `${row.priceMinKrw.toLocaleString("ko-KR")}원부터`
      : `${row.priceMinKrw.toLocaleString("ko-KR")}~${row.priceMaxKrw.toLocaleString("ko-KR")}원`;
  }
  return `${row.priceMinKrw.toLocaleString("ko-KR")}원${row.priceKind === "starting" ? "부터" : ""}`;
}

function PriceDurationCell({
  row,
  editing: _editing,
  editingField,
  onStartEdit,
  onOpenDurationSetup,
  onChange,
  onAdvance,
}: {
  row: MobilePriceGuideRow;
  editing?: boolean;
  editingField: "price" | "duration" | null;
  onStartEdit: (field: "price" | "duration") => void;
  onOpenDurationSetup: () => void;
  onChange: (patch: Partial<MobilePriceGuideRow>) => void;
  onAdvance: () => void;
}) {
  const durationInputRef = useRef<HTMLInputElement>(null);
  if (!editingField) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-0" data-mobile-price-duration-cell data-mobile-price-left-time-right>
        <button type="button" onClick={() => onStartEdit("price")} className="min-h-11 min-w-0 rounded-[8px] px-1 text-center text-[16px] font-normal leading-6 tabular-nums text-slate-900 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"><span className={`block min-w-0 truncate whitespace-nowrap text-center ${row.priceMinKrw === null ? "text-slate-500" : "text-slate-900"}`} data-price-side="left">{priceDisplayLabel(row)}</span></button>
        <button type="button" onClick={onOpenDurationSetup} className="min-h-11 min-w-0 rounded-[8px] px-1 text-center text-[16px] font-normal leading-6 tabular-nums outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600" aria-label={`${row.durationMinutes === null ? "미정" : `${row.durationMinutes}분`} 예상시간 빠른 설정`} data-mobile-price-duration-quick-trigger><span className={`flex min-w-0 items-center justify-center whitespace-nowrap border-l border-slate-200 ${row.durationMinutes === null ? "text-slate-500" : "text-slate-900"}`} data-duration-side="right">{row.durationMinutes === null ? "미정" : `${row.durationMinutes}분`}</span></button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5" data-mobile-price-duration-cell data-mobile-price-duration-edit>
      <label className="min-w-0">
        <span className="sr-only">가격</span>
          <input autoFocus={editingField === "price"} data-mobile-price-cell enterKeyHint="next" value={row.priceMinKrw ?? ""} inputMode="numeric" min={0} max={MAX_SERVICE_PRICE_KRW} placeholder="미정" className={`${inputClass} text-center tabular-nums`} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); durationInputRef.current?.focus(); } }} onChange={(event) => {
          const priceMinKrw = nullableInteger(event.target.value);
          onChange({ priceMinKrw, ...(priceMinKrw !== null && row.priceKind === "unknown" ? { priceKind: "fixed" as const } : {}) });
        }} />
      </label>
      <label className="min-w-0">
        <span className="sr-only">예상시간</span>
          <input ref={durationInputRef} autoFocus={editingField === "duration"} data-mobile-duration-cell enterKeyHint="next" value={row.durationMinutes ?? ""} inputMode="numeric" min={1} max={1440} placeholder="미정" className={`${inputClass} text-center tabular-nums`} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onAdvance(); } }} onChange={(event) => onChange({ durationMinutes: nullableInteger(event.target.value) })} />
      </label>
      {row.priceKind === "range" ? (
        <label className="col-span-2 min-w-0">
          <span className="sr-only">최대 가격</span>
          <input value={row.priceMaxKrw ?? ""} inputMode="numeric" min={0} max={MAX_SERVICE_PRICE_KRW} placeholder="최대 가격" className={`${inputClass} text-center tabular-nums`} onChange={(event) => onChange({ priceMaxKrw: nullableInteger(event.target.value) })} />
        </label>
      ) : null}
    </div>
  );
}

type MobileDurationTarget = {
  weightIndex: number;
  label: string;
  minKg: number | null;
  maxKg: number | null;
  durationMinutes: number | null;
};

function durationFromWeightRule(target: MobileDurationTarget, baseMinutes: number, stepKg: 2 | 3) {
  const anchorKg = target.maxKg ?? target.minKg;
  if (!Number.isFinite(anchorKg) || anchorKg === null || anchorKg < 0) return null;
  const minutes = baseMinutes + Math.ceil(Math.max(0, anchorKg - 2) / stepKg) * 10;
  return Number.isInteger(minutes) && minutes >= 15 && minutes <= 480 ? minutes : null;
}

function MobileServiceDurationDialog({
  groupName,
  serviceName,
  targets,
  onClose,
  onApply,
}: {
  groupName: string;
  serviceName: string;
  targets: MobileDurationTarget[];
  onClose: () => void;
  onApply: (updates: Array<{ weightIndex: number; durationMinutes: number }>) => void;
}) {
  const [baseMinutes, setBaseMinutes] = useState(() => {
    const firstDuration = targets[0]?.durationMinutes;
    return firstDuration === null || firstDuration === undefined ? "" : String(firstDuration);
  });
  const [stepKg, setStepKg] = useState<2 | 3>(2);
  const [values, setValues] = useState<Record<number, string>>(() => Object.fromEntries(targets.map((target) => [target.weightIndex, target.durationMinutes === null ? "" : String(target.durationMinutes)])));
  const [error, setError] = useState("");

  function calculate(baseOverride?: number) {
    const parsedBaseMinutes = baseOverride ?? Number(baseMinutes);
    if (!Number.isInteger(parsedBaseMinutes) || parsedBaseMinutes < 15 || parsedBaseMinutes > 480) {
      setError("2kg 이하 기준 시간을 15~480분으로 입력해 주세요.");
      return;
    }
    const nextValues: Record<number, string> = {};
    for (const target of targets) {
      const durationMinutes = durationFromWeightRule(target, parsedBaseMinutes, stepKg);
      if (durationMinutes === null) {
        setError("체중 구간을 확인한 뒤 다시 계산해 주세요.");
        return;
      }
      nextValues[target.weightIndex] = String(durationMinutes);
    }
    setValues(nextValues);
    setError("");
  }

  function chooseQuickBase(minutes: number) {
    setBaseMinutes(String(minutes));
    calculate(minutes);
  }

  function apply() {
    const updates: Array<{ weightIndex: number; durationMinutes: number }> = [];
    for (const target of targets) {
      const value = values[target.weightIndex]?.trim();
      if (!value) continue;
      const durationMinutes = Number(value);
      if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
        setError("예상시간은 15~480분 사이의 정수로 입력해 주세요.");
        return;
      }
      if (durationMinutes !== target.durationMinutes) updates.push({ weightIndex: target.weightIndex, durationMinutes });
    }
    onApply(updates);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" aria-label={`${groupName} ${serviceName} 예상시간 설정`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[calc(100dvh-32px)] w-full max-w-md overflow-y-auto rounded-[14px] border border-slate-200 bg-white p-4 text-slate-900 shadow-xl" data-mobile-price-guide-service-duration-dialog>
        <header className="flex items-center justify-between gap-2"><h2 className="text-[20px] font-semibold leading-7">{groupName} · {serviceName}</h2><button type="button" onClick={onClose} className={iconClass} aria-label="예상시간 설정 닫기"><X size={20} aria-hidden="true" /></button></header>
        <section className="mt-4 rounded-[10px] border border-slate-200 bg-slate-50 p-3" aria-label="체중별 예상시간 자동 설정" data-mobile-price-guide-weight-duration-rule>
          <p className="text-[16px] font-medium leading-6">체중별 시간 자동 설정</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <label className="min-w-0 text-[16px] leading-6"><span className="block text-slate-600">2kg 이하 기준 시간</span><span className="mt-1 flex items-center gap-2"><input aria-label="2kg 이하 기준 시간" type="number" inputMode="numeric" min={15} max={480} step={5} value={baseMinutes} onChange={(event) => { setBaseMinutes(event.target.value); setError(""); }} placeholder="예: 40" className={inputClass} /><span>분</span></span></label>
            <label className="text-[16px] leading-6"><span className="block text-slate-600">증가 간격</span><select aria-label="체중 증가 간격" value={stepKg} onChange={(event) => setStepKg(Number(event.target.value) as 2 | 3)} className="mt-1 h-11 rounded-[8px] border border-slate-300 bg-white px-2 text-[16px] font-medium leading-6"><option value={2}>2kg마다</option><option value={3}>3kg마다</option></select></label>
          </div>
          <div className="mt-3" data-mobile-price-guide-duration-quick-options>
            <p className="text-[16px] leading-6 text-slate-600">기본 시간 빠른 선택</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[20, 30, 40, 50, 60, 75, 90].map((minutes) => <button key={minutes} type="button" onClick={() => chooseQuickBase(minutes)} aria-pressed={baseMinutes === String(minutes)} className={`min-h-11 rounded-[8px] border px-3 text-[16px] font-medium leading-6 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${baseMinutes === String(minutes) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>{minutes}분</button>)}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[16px] leading-6 text-slate-600">선택한 간격마다 10분씩 추가돼요.</p><button type="button" onClick={() => calculate()} className={actionClass}>계산해서 채우기</button></div>
        </section>
        <div className="mt-4 space-y-3">{targets.map((target) => <label key={target.weightIndex} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 text-[16px] leading-6"><span>{target.label || "체중 구간 입력"}</span><span className="flex items-center gap-2"><input aria-label={`${target.label || "체중 구간"} 예상시간`} type="number" inputMode="numeric" min={15} max={480} step={1} value={values[target.weightIndex] ?? ""} onChange={(event) => { setValues((current) => ({ ...current, [target.weightIndex]: event.target.value })); setError(""); }} placeholder="미정" className={inputClass} /><span>분</span></span></label>)}</div>
        {error ? <p role="alert" className="mt-3 text-[16px] leading-6 text-[#9a5e4e]">{error}</p> : null}
        <footer className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={onClose} className="min-h-11 rounded-[10px] border border-slate-300 text-[16px] font-medium leading-6 text-slate-700">취소</button><button type="button" onClick={apply} className="min-h-11 rounded-[10px] bg-[#111a30] text-[16px] font-medium leading-6 text-white">적용</button></footer>
      </div>
    </div>
  );
}

function MobileBreedDialog({
  initialBreeds,
  unavailableBreeds,
  onClose,
  onSave,
}: {
  initialBreeds: string[];
  unavailableBreeds: string[];
  onClose: () => void;
  onSave: (breeds: string[]) => void;
}) {
  const [breeds, setBreeds] = useState(initialBreeds);
  const [input, setInput] = useState("");
  const [customBreedMode, setCustomBreedMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const unavailable = new Set(unavailableBreeds.map(normalizedKey));
  const selected = new Set(breeds.map(normalizedKey));
  const value = input.trim();
  const blocked = unavailable.has(normalizedKey(value));
  const duplicate = selected.has(normalizedKey(value));
  const suggestions = KNOWN_BREEDS.filter((breed) => !unavailable.has(normalizedKey(breed)) && !selected.has(normalizedKey(breed)));

  function addBreed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value || blocked || duplicate) return;
    setBreeds((current) => [...current, value]);
    setInput("");
    setCustomBreedMode(false);
  }

  function startCustomBreedInput() {
    setInput("");
    setCustomBreedMode(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4" role="dialog" aria-modal="true" aria-labelledby="mobile-breed-dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div className="max-h-[82dvh] w-full max-w-sm overflow-y-auto rounded-[18px] bg-white p-5 shadow-xl">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
          <span aria-hidden="true" />
          <h2 id="mobile-breed-dialog-title" className="text-center text-[20px] font-semibold leading-7 text-slate-900">품종 선택</h2>
          <button type="button" className={iconClass} onClick={onClose} aria-label="품종 선택 닫기"><X size={20} /></button>
        </div>
        <form className="mt-4" onSubmit={addBreed}>
          <div><label htmlFor="mobile-price-guide-breed-name" className="block text-[16px] font-medium leading-6 text-slate-800">{customBreedMode ? "기타 품종명" : "추가할 품종"}</label><span className="mt-2 flex gap-2"><input id="mobile-price-guide-breed-name" ref={inputRef} autoFocus value={input} onChange={(event) => setInput(event.target.value)} className={inputClass} placeholder={customBreedMode ? "원하는 품종 입력" : "품종 검색 또는 입력"} />
          <button type="submit" className={`${actionClass} min-w-[72px] whitespace-nowrap !text-[16px] !leading-6`} disabled={!value || blocked || duplicate}>추가</button>
          </span></div>
        </form>
        {blocked ? <p role="alert" className="mt-2 text-[13px] text-[#9a5e4e]">다른 분류에 이미 등록된 품종입니다.</p> : null}
        {duplicate ? <p role="alert" className="mt-2 text-[13px] text-[#9a5e4e]">이미 선택한 품종입니다.</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {breeds.map((breed) => <button key={breed} type="button" className="min-h-11 rounded-full border border-blue-200 bg-blue-50 px-3 text-[16px] font-medium leading-6 text-blue-800" onClick={() => setBreeds((current) => current.filter((item) => item !== breed))} aria-label={`${breed} 선택 해제`}>{breed} ×</button>)}
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="text-[16px] font-medium leading-6 text-slate-700">선택 가능한 품종</p>
          <div className="mt-2 flex flex-wrap gap-2">{suggestions.map((breed) => <button key={breed} type="button" className="min-h-11 rounded-full border border-slate-200 px-3 text-[16px] font-medium leading-6 text-slate-700" onClick={() => setBreeds((current) => [...current, breed])}>{breed}</button>)}<button type="button" className="min-h-11 rounded-full border border-slate-300 bg-white px-4 text-[16px] font-medium leading-6 text-slate-800" onClick={startCustomBreedInput} aria-pressed={customBreedMode} data-mobile-custom-breed>기타</button></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" className={`${actionClass} !text-[16px] !leading-6`} onClick={onClose}>취소</button><button type="button" className="min-h-11 rounded-[8px] bg-[#111a30] px-4 text-[16px] font-medium leading-6 text-white" onClick={() => onSave(breeds)}>완료</button></div>
      </div>
    </div>
  );
}

export default function MobilePriceGuideMatrix({ document, onChange }: { document: MobilePriceGuideV2; onChange: (document: MobilePriceGuideV2) => void }) {
  const groups = useMemo(() => readMobilePriceGuideMatrix(document), [document]);
  const preservedRows = useMemo(() => readPreservedMobilePriceGuideRows(document), [document]);
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editingWeight, setEditingWeight] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ key: string; field: "price" | "duration" } | null>(null);
  const [breedGroup, setBreedGroup] = useState<number | null>(null);
  const [durationSetupTarget, setDurationSetupTarget] = useState<{ groupIndex: number; serviceIndex: number } | null>(null);

  function removeWeightBand(groupIndex: number, weightIndex: number) {
    const group = groups[groupIndex];
    const band = group?.weightBands[weightIndex];
    if (!band || group.weightBands.length <= 1) return;
    if (!window.confirm(`${group.sourceLabel || "분류"} ${band.label || "몸무게"} 구간을 삭제할까요?\n해당 몸무게 구간의 모든 서비스 요금이 삭제됩니다.`)) return;
    const next = removeMobilePriceGuideWeightBand(document, groupIndex, weightIndex);
    setEditingWeight(null);
    setEditingCell(null);
    onChange(next);
  }


  return (
    <div className="min-w-0 max-w-full space-y-5" data-mobile-price-guide-matrix data-mobile-dynamic-price-guide>
      {groups.map((group, groupIndex) => (
        <section key={`${group.sourceLabel}-${groupIndex}`} className="min-w-0 max-w-full overflow-hidden rounded-[14px] border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <div className="flex items-start gap-1" data-mobile-price-guide-breed-chips>
              {editingGroup === groupIndex ? <label className="min-w-0 flex-1"><span className="sr-only">요금 분류</span><input autoFocus value={group.sourceLabel} placeholder="예: 소형견" className={inputClass} onChange={(event) => onChange(updateMobilePriceGuideGroup(document, groupIndex, { sourceLabel: event.target.value }))} /></label> : <button type="button" onClick={() => setEditingGroup(groupIndex)} className="min-h-11 shrink-0 rounded-[8px] px-2 text-left text-[16px] font-medium leading-6 text-slate-900 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600">{group.sourceLabel || "분류 입력"} 요금 :</button>}
              <button type="button" onClick={() => setBreedGroup(groupIndex)} className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-[8px] px-2 py-2 text-left text-[16px] leading-6 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600">
                {group.breedNames.length ? group.breedNames.join(", ") : <span className="text-slate-500">품종 선택</span>}
              </button>
              {groups.length > 1 ? <button type="button" className={iconClass} aria-label={`${group.sourceLabel || "분류"} 삭제`} onClick={() => onChange(removeMobilePriceGuideGroup(document, groupIndex))}><Trash2 size={18} aria-hidden="true" /></button> : null}
            </div>
          </div>

          <div className="relative w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain" data-mobile-price-guide-matrix-scroll>
            <table className="w-max min-w-full table-auto border-collapse text-center" style={{ minWidth: `${96 + group.serviceNames.length * 168 + (group.weightBands.length > 1 ? 44 : 0)}px` }}>
              <thead><tr className="bg-slate-50">
                <th className="sticky left-0 z-10 w-[96px] min-w-[96px] bg-slate-50 border-b border-r border-slate-200 px-2 py-0 text-center align-middle text-[16px] font-medium leading-6 text-slate-600">몸무게</th>
                {group.serviceNames.map((serviceName, serviceIndex) => {
                  const serviceKey = `${groupIndex}:${serviceIndex}`;
                  return <th key={`service-${serviceIndex}`} className="w-[168px] border-b border-r border-slate-200 px-1 py-0 text-center align-middle">
                    {editingService === serviceKey ? <div className="flex items-start gap-1"><label className="min-w-0 flex-1"><span className="sr-only">서비스명</span><input autoFocus value={serviceName} placeholder="서비스명 입력" className={`${inputClass} text-center font-medium`} onChange={(event) => onChange(updateMobilePriceGuideService(document, groupIndex, serviceIndex, event.target.value))} /></label>{group.serviceNames.length > 1 ? <button type="button" className={iconClass} aria-label={`${serviceName || `서비스 ${serviceIndex + 1}`} 열 삭제`} onClick={() => { setEditingService(null); onChange(removeMobilePriceGuideService(document, groupIndex, serviceIndex)); }}><Trash2 size={17} aria-hidden="true" /></button> : null}</div> : <div className="flex items-center gap-1"><button type="button" className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-[8px] px-1 text-center text-[16px] font-medium leading-6 text-slate-900 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setEditingService(serviceKey)} aria-label={`${serviceName || `서비스 ${serviceIndex + 1}`} 이름 수정`} data-mobile-price-guide-service-subheaders>{serviceName || <span className="text-slate-500">서비스명 입력</span>}</button><button type="button" className="min-h-11 shrink-0 rounded-[8px] px-1 text-center text-[16px] font-medium leading-6 text-slate-600 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setDurationSetupTarget({ groupIndex, serviceIndex })} aria-label={`${serviceName || `서비스 ${serviceIndex + 1}`} 예상시간 설정`} data-mobile-price-guide-service-duration-trigger>시간</button></div>}
                  </th>;
                })}
                {group.weightBands.length > 1 ? <th className="sticky right-0 z-20 w-11 min-w-11 border-b border-slate-200 bg-slate-50 p-0" aria-label="몸무게 구간 관리" /> : null}
              </tr></thead>
              <tbody>{group.weightBands.map((band, weightIndex) => {
                const weightKey = `${groupIndex}:${weightIndex}`;
                return <tr key={weightKey}>
                  <th className="sticky left-0 z-0 w-[96px] min-w-[96px] border-b border-r border-slate-200 bg-white p-0 text-center align-middle" data-mobile-weight-cell>{editingWeight === weightKey ? <label className="block min-w-0 px-1"><span className="sr-only">몸무게 기준</span><input autoFocus value={band.label} placeholder="예: 4kg" className={`${inputClass} text-center`} onChange={(event) => onChange(updateMobilePriceGuideWeightBand(document, groupIndex, weightIndex, event.target.value))} /></label> : <button type="button" className="min-h-11 w-full rounded-[8px] px-2 text-center text-[16px] font-medium leading-6 text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setEditingWeight(weightKey)}>{band.label || "몸무게 입력"}{band.note ? <span className="mt-0.5 block text-[16px] font-normal leading-6 text-slate-500">{band.note}</span> : null}</button>}</th>
                  {group.serviceNames.map((serviceName, serviceIndex) => {
                    const cellKey = `${groupIndex}:${weightIndex}:${serviceIndex}`;
                    const editingField = editingCell?.key === cellKey ? editingCell.field : null;
                    return <td key={`${serviceName}-${weightIndex}`} className="border-b border-r border-slate-200 p-0 text-center align-middle"><PriceDurationCell row={group.cells[weightIndex][serviceIndex]} editing={editingField !== null} editingField={editingField} onStartEdit={(field) => setEditingCell({ key: cellKey, field })} onOpenDurationSetup={() => setDurationSetupTarget({ groupIndex, serviceIndex })} onChange={(patch) => onChange(updateMobilePriceGuideCell(document, groupIndex, weightIndex, serviceIndex, patch))} onAdvance={() => {
                      const nextWeightIndex = weightIndex + 1;
                      const nextCellKey = nextWeightIndex < group.weightBands.length
                        ? `${groupIndex}:${nextWeightIndex}:${serviceIndex}`
                        : serviceIndex + 1 < group.serviceNames.length
                          ? `${groupIndex}:0:${serviceIndex + 1}`
                          : null;
                      setEditingCell(nextCellKey ? { key: nextCellKey, field: "duration" } : null);
                    }} /></td>;
                  })}
                  {group.weightBands.length > 1 ? <td className="sticky right-0 z-10 w-11 min-w-11 border-b border-slate-200 bg-white p-0 text-center align-middle"><button type="button" className={`${iconClass} mx-auto`} aria-label={`${group.sourceLabel || "분류"} ${band.label || "몸무게"} 삭제`} onClick={() => removeWeightBand(groupIndex, weightIndex)} data-mobile-weight-delete><Trash2 size={17} aria-hidden="true" /></button></td> : null}
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 p-3"><button type="button" className={actionClass} onClick={() => onChange(addMobilePriceGuideWeightBand(document, groupIndex))}><Plus size={16} aria-hidden="true" /> 몸무게</button><button type="button" className={actionClass} onClick={() => { const nextServiceIndex = group.serviceNames.length; onChange(addMobilePriceGuideService(document, groupIndex)); setEditingService(`${groupIndex}:${nextServiceIndex}`); }}><Plus size={16} aria-hidden="true" /> 서비스</button></div>
        </section>
      ))}
      <button type="button" className={actionClass} onClick={() => onChange(addMobilePriceGuideGroup(document))}><Plus size={16} aria-hidden="true" /> 분류 추가</button>
      <MobilePriceGuideExtras document={document} onChange={onChange} />
      {durationSetupTarget && groups[durationSetupTarget.groupIndex] ? (() => {
        const group = groups[durationSetupTarget.groupIndex];
        const serviceIndex = durationSetupTarget.serviceIndex;
        return <MobileServiceDurationDialog
          key={`${durationSetupTarget.groupIndex}:${serviceIndex}`}
          groupName={group.sourceLabel || "요금표"}
          serviceName={group.serviceNames[serviceIndex] || `서비스 ${serviceIndex + 1}`}
          targets={group.weightBands.map((band, weightIndex) => ({
            weightIndex,
            label: band.label,
            minKg: band.minKg,
            maxKg: band.maxKg,
            durationMinutes: group.cells[weightIndex][serviceIndex]?.durationMinutes ?? null,
          }))}
          onClose={() => setDurationSetupTarget(null)}
          onApply={(updates) => {
            let nextDocument = document;
            for (const update of updates) {
              nextDocument = updateMobilePriceGuideCell(nextDocument, durationSetupTarget.groupIndex, update.weightIndex, serviceIndex, { durationMinutes: update.durationMinutes });
            }
            onChange(nextDocument);
          }}
        />;
      })() : null}
      {preservedRows.length ? <details className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2" data-mobile-preserved-price-guide><summary className="min-h-11 cursor-pointer py-2 text-[16px] font-medium leading-6 text-slate-700">표에 배치되지 않은 기존 항목 {preservedRows.length}개 보존됨</summary><p className="text-[16px] leading-6 text-slate-600">자동으로 지우거나 다른 서비스로 추정하지 않았습니다.</p><ul className="mt-2 text-[16px] leading-6 text-slate-700">{preservedRows.map((row, index) => <li key={row.sourceItemId ?? index}>· {row.serviceName ?? "서비스명 확인 필요"} · {compactCellLabel(row)}</li>)}</ul></details> : null}
      {breedGroup !== null && groups[breedGroup] ? <MobileBreedDialog initialBreeds={groups[breedGroup].breedNames} unavailableBreeds={groups.flatMap((group, index) => index === breedGroup ? [] : group.breedNames)} onClose={() => setBreedGroup(null)} onSave={(breedNames) => { onChange(updateMobilePriceGuideGroup(document, breedGroup, { breedNames })); setBreedGroup(null); }} /> : null}
    </div>
  );
}
