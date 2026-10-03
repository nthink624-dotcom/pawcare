"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { MobilePriceGuideV2 } from "@/lib/price-photo/mobile-price-photo-adapter";

type MobileSurcharge = MobilePriceGuideV2["surcharges"][number];

const inputClass = "h-11 w-full min-w-0 rounded-[8px] border border-slate-300 bg-white px-2.5 text-[16px] font-normal leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20";
const fieldButtonClass = "flex min-h-11 w-full min-w-0 rounded-[8px] px-1.5 py-0.5 text-left outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600";
const actionClass = "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border border-slate-300 bg-white px-3 text-[16px] font-medium leading-6 text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
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

  const fields: Array<{ field: keyof MobileSurcharge; label: string; placeholder: string }> = [
    { field: "condition", label: "항목", placeholder: "예: 얼굴컷 추가" },
    { field: "amountKrw", label: "가격", placeholder: "미정" },
    { field: "percent", label: "추가 비율", placeholder: "미정" },
    { field: "note", label: "설명", placeholder: "설명 추가" },
  ];

  return (
    <section className="border-t border-slate-200 pt-3" aria-labelledby="mobile-price-guide-extras-title" data-mobile-price-guide-extras>
      <div className="flex items-center justify-between gap-3">
        <h3 id="mobile-price-guide-extras-title" className="min-w-0 text-[20px] font-semibold leading-7 text-slate-900">추가 서비스·요금</h3>
        <button type="button" className={actionClass} onClick={() => {
          const nextIndex = document.surcharges.length;
          emit({ ...document, surcharges: [...document.surcharges, { condition: null, amountKrw: null, percent: null, note: null }] });
          setActiveField(`${nextIndex}:condition`);
        }}><Plus size={16} aria-hidden="true" />추가</button>
      </div>
      {document.surcharges.length ? <div className="mt-2 overflow-hidden rounded-[14px] border border-slate-200 bg-white" data-mobile-extra-list>
        {document.surcharges.map((item, index) => <div key={index} className={`grid grid-cols-3 gap-x-2 gap-y-1 border-slate-200 px-3 py-1.5 ${index > 0 ? "border-t" : ""}`} data-mobile-extra-item={index}>
          {fields.map(({ field, label, placeholder }) => {
            const key = `${index}:${field}`;
            const rawValue = item[field];
            const display = field === "amountKrw" ? rawValue === null ? "미정" : `${Number(rawValue).toLocaleString("ko-KR")}원` : field === "percent" ? rawValue === null ? "미정" : `${rawValue}%` : rawValue || placeholder;
            const content = activeField === key
              ? <><span className="block text-[18px] font-medium leading-[26px] text-slate-600">{label}</span><label><span className="sr-only">추가 서비스·요금 {index + 1} {label}</span><input autoFocus value={rawValue ?? ""} inputMode={field === "amountKrw" ? "numeric" : field === "percent" ? "decimal" : undefined} className={`${inputClass} mt-1 tabular-nums`} placeholder={placeholder} onChange={(event) => update(index, field, event.target.value)} /></label></>
              : field === "condition"
                ? <button type="button" title={`${label}: ${display}`} className={`${fieldButtonClass} flex-row items-center gap-2`} onClick={() => setActiveField(key)} aria-label={`추가 서비스·요금 ${index + 1} ${label} 수정`}><span className="shrink-0 text-[18px] font-medium leading-[26px] text-slate-600">{label}</span><span className="min-w-0 truncate text-[16px] font-normal leading-6 text-slate-900">{display}</span></button>
                : <button type="button" title={`${label}: ${display}`} className={`${fieldButtonClass} flex-col items-start justify-center gap-0.5 ${rawValue === null ? "text-slate-500" : ""}`} onClick={() => setActiveField(key)} aria-label={`추가 서비스·요금 ${index + 1} ${label} 수정`}><span className="text-[18px] font-medium leading-[26px] text-slate-600">{label}</span><span className="w-full text-[16px] font-normal leading-6 text-slate-900 tabular-nums">{display}</span></button>;
            return field === "condition"
              ? <div key={field} className="col-span-3 grid grid-cols-[minmax(0,1fr)_44px] items-end gap-2">
                  <div className="min-w-0">{content}</div>
                  <button type="button" className={iconClass} aria-label={`추가 서비스·요금 ${index + 1} 삭제`} onClick={() => {
                    setActiveField(null);
                    emit({ ...document, surcharges: document.surcharges.filter((_, itemIndex) => itemIndex !== index), aiReview: removeReviews(document, index) });
                  }}><Trash2 size={17} aria-hidden="true" /></button>
                </div>
              : <div key={field} className="min-w-0">{content}</div>;
          })}
        </div>)}
      </div> : null}
    </section>
  );
}
