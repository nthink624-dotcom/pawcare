"use client";

import { CalendarDays, Check, ChevronDown, LockKeyhole } from "lucide-react";

import { OWNER_TYPOGRAPHY } from "@/components/owner-web/owner-typography";
import { currentDateInTimeZone } from "@/lib/utils";
import type { Service } from "@/types/domain";

export type GroomingCompletionDetails = {
  treatmentNotes: string;
  specialNotes: string;
  internalNotes: string;
  nextRecommendedVisitDate: string | null;
};

const internalNoteSuggestions = ["보호자 안내 완료", "다음 방문 상담", "사진 확인 필요"];

function toggleSuggestion(value: string, suggestion: string) {
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.includes(suggestion)
    ? lines.filter((line) => line !== suggestion).join("\n")
    : [...lines, suggestion].join("\n");
}

function SuggestionChips({
  items,
  value,
  onChange,
  disabled,
  quiet,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  quiet?: boolean;
}) {
  const selectedItems = value.split("\n").map((line) => line.trim());

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const selected = selectedItems.includes(item);
        return (
          <button
            key={item}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(toggleSuggestion(value, item))}
            disabled={disabled}
            className={`${OWNER_TYPOGRAPHY.label} inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 transition disabled:opacity-50 ${
              selected
                ? quiet
              ? "border-[#9fb0c3] bg-[#e8eef5] text-[#31445a]"
              : "border-[#8fb8e8] bg-[#eaf3ff] text-[#285f9d] shadow-[0_3px_12px_rgba(47,111,214,0.12)]"
                : "border-[#e4e8ee] bg-white text-[#64748b] hover:border-[#cfd7e1] hover:bg-[#fbfcfd]"
            }`}
          >
            {selected ? <Check className="h-3.5 w-3.5" /> : null}
            {item}
          </button>
        );
      })}
    </div>
  );
}

export function CalendarGroomingCompletionFields({
  value,
  onChange,
  serviceId,
  serviceName,
  services = [],
  onServiceChange,
  disabled,
  saveError,
  onRetrySave,
}: {
  value: GroomingCompletionDetails;
  onChange: (value: GroomingCompletionDetails) => void;
  serviceId?: string;
  serviceName?: string;
  services?: Service[];
  onServiceChange?: (serviceId: string) => Promise<void> | void;
  disabled?: boolean;
  saveError?: string;
  onRetrySave?: () => void;
}) {
  const bookedService = serviceName?.trim() || value.treatmentNotes.trim() || "예약 서비스";
  const internalLines = value.internalNotes.split("\n").map((line) => line.trim()).filter(Boolean);
  const selectedInternalNotes = internalLines.filter((line) => internalNoteSuggestions.includes(line));
  const customInternalNotes = internalLines.filter((line) => !internalNoteSuggestions.includes(line)).join("\n");
  const today = currentDateInTimeZone();
  const activeServices = services.filter((service) => service.is_active || service.id === serviceId);

  return (
      <div className="space-y-4">
        <div className="flex min-h-[72px] items-center justify-between gap-5 rounded-[10px] border border-[#dce7f2] bg-white px-4 py-3">
          <p className={`${OWNER_TYPOGRAPHY.body} shrink-0 text-[#607b98]`}>예약 서비스</p>
          {activeServices.length > 0 ? (
              <div className="relative w-full max-w-[360px]">
                <select
                  aria-label="예약 서비스 수정"
                  value={serviceId ?? ""}
                  onChange={(event) => void onServiceChange?.(event.target.value)}
                  disabled={disabled || !onServiceChange}
                  className={`${OWNER_TYPOGRAPHY.bodyStrong} h-10 w-full appearance-none rounded-[8px] border border-[#d5e0eb] bg-white pl-3 pr-10 text-[#172c46] outline-none transition hover:border-[#b9cbe0] focus:border-[#7eaae0] disabled:cursor-default disabled:opacity-70`}
                >
                  {!serviceId ? <option value="">{bookedService}</option> : null}
                  {activeServices.map((service) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7f95]" />
              </div>
            ) : (
              <p className={`${OWNER_TYPOGRAPHY.bodyStrong} min-w-0 text-right text-[#172c46]`}>{bookedService}</p>
            )}
        </div>

        <details className="group rounded-[10px] border border-[#e5e9ee] bg-white">
          <summary className={`${OWNER_TYPOGRAPHY.bodyStrong} flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[#34485f]`}>
            <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> 매장 내부 메모 <em className={`${OWNER_TYPOGRAPHY.label} not-italic text-[#7d8c9d]`}>· 고객 비공개 · 선택</em></span>
            <span className={`${OWNER_TYPOGRAPHY.helper} text-[#8a98a7] group-open:hidden`}>필요할 때만 열기</span>
            <span className={`${OWNER_TYPOGRAPHY.helper} hidden text-[#8a98a7] group-open:inline`}>고객에게 보이지 않음</span>
          </summary>
          <div className="space-y-3 border-t border-[#edf0f3] px-3.5 py-3">
            <SuggestionChips
              items={internalNoteSuggestions}
              value={value.internalNotes}
              onChange={(internalNotes) => onChange({ ...value, internalNotes })}
              disabled={disabled}
              quiet
            />
            <textarea
              value={customInternalNotes}
              onChange={(event) => onChange({
                ...value,
                internalNotes: [...selectedInternalNotes, event.target.value].filter(Boolean).join("\n"),
              })}
              disabled={disabled}
              maxLength={4000}
              placeholder="다음 방문 때 직원끼리 확인할 내용"
              className={`${OWNER_TYPOGRAPHY.body} min-h-[80px] w-full resize-y rounded-[8px] border border-[#dde3e9] bg-[#fbfcfd] px-3.5 py-3 text-[#334155] outline-none focus:border-[#aebac7] disabled:opacity-60`}
            />
          </div>
        </details>

        <div className="rounded-[10px] border border-[#dce7f2] bg-white px-3.5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <span className={`${OWNER_TYPOGRAPHY.bodyStrong} flex items-center gap-2 text-[#263b53]`}><CalendarDays className="h-4 w-4 text-[#2f6fd6]" /> 재예약 알림</span>
            <button
              type="button"
              onClick={() => onChange({ ...value, nextRecommendedVisitDate: null })}
              disabled={disabled}
              className={`${OWNER_TYPOGRAPHY.badge} shrink-0 rounded-full border px-3 py-1 transition disabled:opacity-50 ${
                value.nextRecommendedVisitDate === null
                  ? "border-[#9fb0c3] bg-[#e8eef5] text-[#31445a]"
                  : "border-[#dce3eb] bg-white text-[#728196] hover:bg-[#f7f9fb]"
              }`}
            >
              알림 안 함
            </button>
          </div>
          <label className="mt-3 flex items-center justify-between gap-3 rounded-[8px] bg-[#f7faff] px-3 py-2.5">
            <span className={`${OWNER_TYPOGRAPHY.label} text-[#61758d]`}>날짜 지정</span>
            <input
              type="date"
              min={today}
              value={value.nextRecommendedVisitDate ?? ""}
              onChange={(event) => onChange({ ...value, nextRecommendedVisitDate: event.target.value || null })}
              disabled={disabled}
              className={`${OWNER_TYPOGRAPHY.body} h-10 min-w-[170px] rounded-[8px] border border-[#d5e0eb] bg-white px-3 text-[#334155] outline-none focus:border-[#7eaae0] disabled:opacity-60`}
            />
          </label>
        </div>

        {saveError ? (
      <div className={`${OWNER_TYPOGRAPHY.label} flex items-center justify-between gap-3 rounded-[8px] bg-[#eef5fd] px-3.5 py-2.5 text-[#315f8e]`}>
            <span>{saveError}</span>
            {onRetrySave ? <button type="button" onClick={onRetrySave} className="shrink-0 font-semibold underline underline-offset-2">다시 저장</button> : null}
          </div>
        ) : null}
      </div>
  );
}
