"use client";

import { CalendarDays, Check, LockKeyhole, Sparkles } from "lucide-react";

import type { GroomingRecordDraftSaveStatus } from "@/components/owner-web/use-grooming-record-draft";

export type GroomingCompletionDetails = {
  treatmentNotes: string;
  specialNotes: string;
  internalNotes: string;
  nextRecommendedVisitDate: string | null;
};

const conditionSuggestions = ["피부 상태 양호", "귀 상태 확인 필요", "발톱 관리 완료", "엉킴 있음", "예민 반응 있음"];
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
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition disabled:opacity-50 ${
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

function getDraftStatusCopy(status: GroomingRecordDraftSaveStatus | undefined, lastSavedAt?: string | null) {
  if (status === "loading") return "이전 기록 불러오는 중";
  if (status === "local") return "입력 내용 저장 중";
  if (status === "saving") return "자동 저장 중";
  if (status === "saved") {
    const date = lastSavedAt ? new Date(lastSavedAt) : null;
    const time = date && !Number.isNaN(date.getTime())
      ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      : null;
    return time ? `${time} 자동 저장` : "자동 저장됨";
  }
  if (status === "offline") return "기기에 보관 중 · 연결되면 동기화";
  if (status === "error") return "자동 저장 연결 확인 필요";
  return "선택하면 자동 저장됩니다";
}

export function CalendarGroomingCompletionFields({
  value,
  onChange,
  serviceName,
  disabled,
  draftStatus,
  lastSavedAt,
  saveError,
  onRetrySave,
}: {
  value: GroomingCompletionDetails;
  onChange: (value: GroomingCompletionDetails) => void;
  serviceName?: string;
  disabled?: boolean;
  draftStatus?: GroomingRecordDraftSaveStatus;
  lastSavedAt?: string | null;
  saveError?: string;
  onRetrySave?: () => void;
}) {
  const bookedService = serviceName?.trim() || value.treatmentNotes.trim() || "예약 서비스";
  const specialLines = value.specialNotes.split("\n").map((line) => line.trim()).filter(Boolean);
  const selectedConditions = specialLines.filter((line) => conditionSuggestions.includes(line));
  const customSpecialNotes = specialLines.filter((line) => !conditionSuggestions.includes(line)).join("\n");
  const internalLines = value.internalNotes.split("\n").map((line) => line.trim()).filter(Boolean);
  const selectedInternalNotes = internalLines.filter((line) => internalNoteSuggestions.includes(line));
  const customInternalNotes = internalLines.filter((line) => !internalNoteSuggestions.includes(line)).join("\n");

  return (
    <section className="mt-4 overflow-hidden rounded-[14px] border border-[#d5e3f2] bg-[#f7faff]">
      <div className="flex items-start justify-between gap-3 border-b border-[#dfe9f4] bg-white px-4 py-3.5">
        <div>
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[#172c46]">
            <Sparkles className="h-4 w-4 text-[#2f6fd6]" />
            오늘 상태만 간단히 체크해 주세요
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#667b92]">예약한 서비스는 이미 반영되어 있어 다시 선택하지 않습니다.</p>
        </div>
        <p className={`shrink-0 pt-0.5 text-[11px] ${draftStatus === "offline" || draftStatus === "error" ? "text-[#b94d5c]" : "text-[#8f7f86]"}`}>
          {getDraftStatusCopy(draftStatus, lastSavedAt)}
        </p>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[#dce7f2] bg-white px-3.5 py-3">
          <div>
            <p className="text-[11px] font-semibold text-[#6481a1]">예약 서비스</p>
            <p className="mt-0.5 text-[14px] font-semibold text-[#172c46]">{bookedService}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#eaf3ff] px-2.5 py-1 text-[11px] font-semibold text-[#2f6fd6]">자동 반영</span>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-[#263b53]">오늘 확인한 내용 <span className="font-normal text-[#8193a7]">· 선택</span></p>
          <span className="text-[11px] text-[#8c9db0]">여러 개 선택 가능</span>
          </div>
          <SuggestionChips
            items={conditionSuggestions}
            value={value.specialNotes}
            onChange={(specialNotes) => onChange({ ...value, specialNotes })}
            disabled={disabled}
          />
          <textarea
            value={customSpecialNotes}
            onChange={(event) => onChange({
              ...value,
              specialNotes: [...selectedConditions, event.target.value].filter(Boolean).join("\n"),
            })}
            disabled={disabled}
            maxLength={2000}
            placeholder="추가로 알려줄 내용이 있을 때만 짧게 적어주세요."
          className="mt-3 min-h-[72px] w-full resize-y rounded-[10px] border border-[#d9e4ef] bg-white px-3.5 py-3 text-[14px] leading-5 text-[#263b53] outline-none transition placeholder:text-[#9aa9b9] focus:border-[#7eaae0] focus:ring-2 focus:ring-[#deebfa] disabled:opacity-60"
          />
        </div>

        <details className="group rounded-[10px] border border-[#e5e9ee] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-[13px] font-semibold text-[#4b5969]">
            <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" /> 매장 내부 메모 <em className="not-italic font-normal text-[#929eab]">· 고객 비공개 · 선택</em></span>
            <span className="text-[11px] font-normal text-[#9aa5b1] group-open:hidden">필요할 때만 열기</span>
            <span className="hidden text-[11px] font-normal text-[#9aa5b1] group-open:inline">고객에게 보이지 않음</span>
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
              className="min-h-[64px] w-full resize-y rounded-[8px] border border-[#dde3e9] bg-[#fbfcfd] px-3 py-2.5 text-[13px] leading-5 text-[#334155] outline-none focus:border-[#aebac7] disabled:opacity-60"
            />
          </div>
        </details>

        <label className="flex items-center justify-between gap-4 rounded-[10px] border border-[#e5e9ee] bg-white px-3.5 py-3">
          <span>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#4b5969]"><CalendarDays className="h-3.5 w-3.5" /> 다음 권장 방문일</span>
            <span className="mt-0.5 block text-[11px] text-[#98a3af]">필요하면 날짜만 선택하세요.</span>
          </span>
          <input
            type="date"
            value={value.nextRecommendedVisitDate ?? ""}
            onChange={(event) => onChange({ ...value, nextRecommendedVisitDate: event.target.value || null })}
            disabled={disabled}
            className="h-9 min-w-[150px] rounded-[8px] border border-[#dce2e8] bg-white px-2.5 text-[13px] text-[#334155] outline-none focus:border-[#aebac7] disabled:opacity-60"
          />
        </label>

        {saveError ? (
      <div className="flex items-center justify-between gap-3 rounded-[8px] bg-[#eef5fd] px-3 py-2 text-[11px] text-[#315f8e]">
            <span>{saveError}</span>
            {onRetrySave ? <button type="button" onClick={onRetrySave} className="shrink-0 font-semibold underline underline-offset-2">다시 저장</button> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
