"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { MobilePriceGuideV2 } from "@/lib/price-photo/mobile-price-photo-adapter";

type MobileSurcharge = MobilePriceGuideV2["surcharges"][number];

const inputClass = "h-11 w-full min-w-0 rounded-[8px] border border-slate-300 bg-white px-2.5 text-[16px] font-normal leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20";
const fieldButtonClass = "min-h-11 w-full min-w-0 rounded-[8px] px-2.5 py-2 text-left text-[14px] font-normal leading-5 text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3 text-[14px] font-medium leading-5 text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
const iconClass = "inline-grid size-11 shrink-0 place-items-center rounded-[8px] text-slate-500 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

function textValue(value: string) {
  return value.trim() || null;
}

function integerValue(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function decimalValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function removeReviews(document: MobilePriceGuideV2, removedIndex: number) {
  return document.aiReview.flatMap((review) => {
    const match = /^surcharges:(\d+)$/.exec(review.targetId);
    if (!match) return [review];
    const index = Number(match[1]);
    if (index === removedIndex) return [];
    return [{ ...review, targetId: index > removedIndex ? `surcharges:${index - 1}` : review.targetId }];
  });
}

export default function MobilePriceGuideExtras({ document, onChange }: { document: MobilePriceGuideV2; onChange: (next: MobilePriceGuideV2) => void }) {
  const [activeField, setActiveField] = useState<string | null>(null);

  function emit(next: MobilePriceGuideV2) {
    onChange(document.source === "manual" ? next : { ...next, source: "owner_corrected" });
  }

  function update(index: number, field: keyof MobileSurcharge, value: string) {
    const patch: Partial<MobileSurcharge> = field === "amountKrw"
      ? { amountKrw: integerValue(value), percent: null }
      : field === "percent"
        ? { percent: decimalValue(value), amountKrw: null }
        : { [field]: textValue(value) };
    emit({
      ...document,
      surcharges: document.surcharges.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
      aiReview: document.aiReview.map((review) => review.targetId === `surcharges:${index}` && review.field === field ? { ...review, userConfirmed: false, userCorrected: true } : review),
    });
  }

  const fields: Array<{ field: keyof MobileSurcharge; label: string; placeholder: string; className?: string }> = [
    { field: "condition", label: "항목", placeholder: "예: 얼굴컷 추가", className: "col-span-2" },
    { field: "amountKrw", label: "가격", placeholder: "미정" },
    { field: "percent", label: "추가 비율", placeholder: "미정" },
    { field: "note", label: "설명", placeholder: "설명 추가", className: "col-span-2" },
  ];

  return (
    <section className="border-t border-slate-200 pt-5" aria-labelledby="mobile-price-guide-extras-title" data-mobile-price-guide-extras>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="mobile-price-guide-extras-title" className="text-[16px] font-semibold leading-6 text-slate-900">추가 서비스·요금</h3>
          <p className="mt-1 text-[13px] font-normal leading-5 text-slate-600">가위컷, 얼굴컷 추가, 호텔처럼 표 밖에 적힌 항목입니다.</p>
        </div>
        <button type="button" className={actionClass} onClick={() => {
          const nextIndex = document.surcharges.length;
          emit({ ...document, surcharges: [...document.surcharges, { condition: null, amountKrw: null, percent: null, note: null }] });
          setActiveField(`${nextIndex}:condition`);
        }}><Plus size={16} aria-hidden="true" />추가</button>
      </div>
      {document.surcharges.length ? <div className="mt-3 space-y-2">
        {document.surcharges.map((item, index) => <div key={index} className="grid grid-cols-2 gap-1.5 rounded-[10px] border border-slate-200 bg-white p-2" data-mobile-extra-item={index}>
          {fields.map(({ field, label, placeholder, className }) => {
            const key = `${index}:${field}`;
            const rawValue = item[field];
            const display = field === "amountKrw" ? rawValue === null ? "미정" : `${Number(rawValue).toLocaleString("ko-KR")}원` : field === "percent" ? rawValue === null ? "미정" : `${rawValue}%` : rawValue || placeholder;
            return <div key={field} className={`min-w-0 ${className ?? ""}`}>
              <span className="block px-2.5 text-[11px] font-normal leading-4 text-slate-500">{label}</span>
              {activeField === key ? <label><span className="sr-only">추가 서비스·요금 {index + 1} {label}</span><input autoFocus value={rawValue ?? ""} inputMode={field === "amountKrw" ? "numeric" : field === "percent" ? "decimal" : undefined} className={`${inputClass} mt-1 tabular-nums`} placeholder={placeholder} onChange={(event) => update(index, field, event.target.value)} /></label> : <button type="button" className={`${fieldButtonClass} ${rawValue === null ? "text-slate-500" : ""}`} onClick={() => setActiveField(key)} aria-label={`추가 서비스·요금 ${index + 1} ${label} 수정`}>{display}</button>}
            </div>;
          })}
          <div className="col-span-2 flex justify-end"><button type="button" className={iconClass} aria-label={`추가 서비스·요금 ${index + 1} 삭제`} onClick={() => {
            setActiveField(null);
            emit({ ...document, surcharges: document.surcharges.filter((_, itemIndex) => itemIndex !== index), aiReview: removeReviews(document, index) });
          }}><Trash2 size={17} aria-hidden="true" /></button></div>
        </div>)}
      </div> : null}
    </section>
  );
}
