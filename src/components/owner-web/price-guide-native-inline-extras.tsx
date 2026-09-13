"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  resolvePriceGuideV2Reviews,
  type PriceGuideV2,
  type PriceGuideV2Surcharge,
} from "@/types/price-guide-photo-import";

type ValidationIssue = {
  key: string;
  inputId: string;
  message: string;
};

const inputClass = "h-11 min-w-0 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 !text-[16px] font-normal !leading-6 text-[#172033] outline-none placeholder:text-[#94a3b8] focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20";
const cellButtonClass = "min-h-11 w-full min-w-0 rounded-[8px] px-3 py-2 text-left !text-[14px] !font-normal !leading-5 text-[#334155] hover:bg-[#f7f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-3 !text-[14px] !font-medium !leading-5 text-[#42536a] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";
const iconButtonClass = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function nullableInteger(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function nullableDecimal(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function surchargeInputId(index: number, field: keyof PriceGuideV2Surcharge) {
  return `price-guide-surcharge-${index}-${field}`;
}

function removeSurchargeReviews(document: PriceGuideV2, removedIndex: number) {
  return document.aiReview.flatMap((review) => {
    const match = /^surcharges:(\d+)$/.exec(review.targetId);
    if (!match) return [review];
    const index = Number(match[1]);
    if (index === removedIndex) return [];
    return [{ ...review, targetId: index > removedIndex ? `surcharges:${index - 1}` : review.targetId }];
  });
}

function issueFor(issues: Map<string, ValidationIssue>, index: number, field: keyof PriceGuideV2Surcharge) {
  return issues.get(`surcharges:${index}.${field}`);
}

function InlineError({ issue }: { issue?: ValidationIssue }) {
  return issue ? <p id={`${issue.inputId}-error`} className="mt-1 text-[12px] font-medium leading-[18px] text-[#a04455]">{issue.message}</p> : null;
}

export default function PriceGuideNativeInlineExtras({
  document,
  onChange,
  activeField,
  setActiveField,
  validationIssues,
}: {
  document: PriceGuideV2;
  onChange: (next: PriceGuideV2) => void;
  activeField: string | null;
  setActiveField: (field: string | null) => void;
  validationIssues: ValidationIssue[];
}) {
  const issues = new Map(validationIssues.map((issue) => [issue.key, issue]));

  function emit(next: PriceGuideV2) {
    onChange(document.source === "manual" ? next : { ...next, source: "owner_corrected" });
  }

  function updateSurcharge(index: number, field: keyof PriceGuideV2Surcharge, value: string) {
    const patch: Partial<PriceGuideV2Surcharge> = field === "amountKrw"
      ? { amountKrw: nullableInteger(value), percent: null }
      : field === "percent"
        ? { percent: nullableDecimal(value), amountKrw: null }
        : { [field]: nullableText(value) };
    const next = {
      ...document,
      surcharges: document.surcharges.map((surcharge, surchargeIndex) => (
        surchargeIndex === index ? { ...surcharge, ...patch } : surcharge
      )),
    };
    emit(resolvePriceGuideV2Reviews(
      next,
      (review) => review.targetId === `surcharges:${index}` && review.field === field,
      "corrected",
    ));
  }

  return (
    <>
      <section className="mt-6 border-t border-[#e2e8f0] pt-5" aria-labelledby="price-guide-surcharge-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="price-guide-surcharge-title" className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#172033]">추가 서비스·요금</h3>
          <button
            type="button"
            onClick={() => {
              const nextIndex = document.surcharges.length;
              emit({
                ...document,
                surcharges: [...document.surcharges, { condition: null, amountKrw: null, percent: null, note: null }],
              });
              setActiveField(surchargeInputId(nextIndex, "condition"));
            }}
            className={actionClass}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />추가 항목
          </button>
        </div>
        {document.surcharges.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-[10px] border border-[#dbe2ea] bg-white">
            {document.surcharges.map((surcharge, index) => (
              <div key={`surcharge-${index}`} className="grid min-w-0 gap-1 border-b border-[#edf2f7] p-2 last:border-b-0 lg:grid-cols-[minmax(180px,1.3fr)_minmax(140px,.8fr)_minmax(140px,.8fr)_minmax(180px,1fr)_44px]">
                {(["condition", "amountKrw", "percent", "note"] as const).map((field) => {
                  const inputId = surchargeInputId(index, field);
                  const issue = issueFor(issues, index, field);
                  const rawValue = surcharge[field];
                  const displayValue = field === "amountKrw"
                    ? rawValue === null ? "추가 금액" : `${Number(rawValue).toLocaleString("ko-KR")}원`
                    : field === "percent"
                      ? rawValue === null ? "추가 비율" : `${rawValue}%`
                      : rawValue || (field === "condition" ? "적용 조건" : "메모 추가");
                  const placeholder = field === "condition" ? "적용 조건" : field === "amountKrw" ? "금액(원)" : field === "percent" ? "비율(%)" : "메모(선택)";
                  return activeField === inputId ? (
                    <div key={field} className="min-w-0">
                      <label htmlFor={inputId} className="sr-only">추가요금 {index + 1} {placeholder}</label>
                      <input
                        id={inputId}
                        autoFocus
                        value={rawValue ?? ""}
                        inputMode={field === "amountKrw" ? "numeric" : field === "percent" ? "decimal" : undefined}
                        onChange={(event) => updateSurcharge(index, field, event.target.value)}
                        aria-invalid={Boolean(issue)}
                        aria-describedby={issue ? `${inputId}-error` : undefined}
                        className={`${inputClass} ${field === "amountKrw" || field === "percent" ? "tabular-nums" : ""}`}
                        placeholder={placeholder}
                      />
                      <InlineError issue={issue} />
                    </div>
                  ) : (
                    <button
                      key={field}
                      id={inputId}
                      type="button"
                      onClick={() => setActiveField(inputId)}
                      className={`${cellButtonClass} ${rawValue === null ? "text-[#7a8798]" : ""}`}
                      aria-label={`추가요금 ${index + 1} ${placeholder} 수정`}
                    >
                      {displayValue}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setActiveField(null);
                    emit({
                      ...document,
                      surcharges: document.surcharges.filter((_, surchargeIndex) => surchargeIndex !== index),
                      aiReview: removeSurchargeReviews(document, index),
                    });
                  }}
                  aria-label={`추가요금 ${index + 1} 삭제`}
                  className={iconButtonClass}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-6 border-t border-[#e2e8f0] pt-5" aria-labelledby="price-guide-overall-note-title">
        <h3 id="price-guide-overall-note-title" className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#172033]">전체 메모</h3>
        {activeField === "price-guide-overall-note" ? (
          <div className="mt-3">
            <label htmlFor="price-guide-overall-note" className="sr-only">요금표 전체 메모</label>
            <textarea
              id="price-guide-overall-note"
              autoFocus
              value={document.overallNote ?? ""}
              onChange={(event) => emit(resolvePriceGuideV2Reviews(
                { ...document, overallNote: nullableText(event.target.value) },
                (review) => review.targetId === "overallNote" || review.field === "overallNote",
                "corrected",
              ))}
              aria-invalid={Boolean(issues.get("overallNote"))}
              aria-describedby={issues.get("overallNote") ? "price-guide-overall-note-error" : undefined}
              className="min-h-24 w-full rounded-[10px] border border-[#cbd5e1] bg-white px-3 py-3 text-[16px] font-normal leading-6 text-[#172033] outline-none placeholder:text-[#94a3b8] focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20"
              placeholder="전체 안내(선택)"
            />
            <InlineError issue={issues.get("overallNote")} />
          </div>
        ) : (
          <button
            id="price-guide-overall-note"
            type="button"
            onClick={() => setActiveField("price-guide-overall-note")}
            className="mt-3 min-h-11 w-full rounded-[10px] border border-[#dbe2ea] bg-white px-3 py-3 text-left text-[14px] font-normal leading-5 text-[#475569] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            {document.overallNote || <span className="text-[#7a8798]">전체 안내 추가</span>}
          </button>
        )}
      </section>
    </>
  );
}
