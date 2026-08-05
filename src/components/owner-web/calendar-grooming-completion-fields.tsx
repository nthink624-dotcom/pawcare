"use client";

import type { GroomingRecordDraftSaveStatus } from "@/components/owner-web/use-grooming-record-draft";

export type GroomingCompletionDetails = {
  treatmentNotes: string;
  specialNotes: string;
  internalNotes: string;
  nextRecommendedVisitDate: string | null;
};

const treatmentSuggestions = ["전체 미용", "위생 미용", "목욕", "가위컷", "클리핑", "얼굴 정리"];
const specialNoteSuggestions = ["피부 상태 양호", "귀 상태 확인 필요", "발톱 관리 완료", "엉킴 있음", "예민 반응 있음"];
const internalNoteSuggestions = ["보호자 안내 완료", "다음 방문 상담", "사진 확인 필요"];

function appendSuggestion(value: string, suggestion: string) {
  if (value.split("\n").some((line) => line.trim() === suggestion)) return value;
  return value.trim() ? `${value.trimEnd()}\n${suggestion}` : suggestion;
}

function SuggestionChips({
  items,
  value,
  onChange,
  disabled,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(appendSuggestion(value, item))}
          disabled={disabled}
          className="h-7 rounded-full border border-[#dfe5ec] bg-white px-2.5 text-[12px] text-[#526173] hover:border-[#b9c5d2] hover:bg-[#f8fafc] disabled:opacity-50"
        >
          + {item}
        </button>
      ))}
    </div>
  );
}

function getDraftStatusCopy(status: GroomingRecordDraftSaveStatus | undefined, lastSavedAt?: string | null) {
  if (status === "loading") return "이전 초안 확인 중";
  if (status === "local") return "입력 내용이 이 기기에 저장됨";
  if (status === "saving") return "서버에 임시저장 중";
  if (status === "saved") {
    const date = lastSavedAt ? new Date(lastSavedAt) : null;
    const time = date && !Number.isNaN(date.getTime())
      ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      : null;
    return time ? `${time} 임시저장됨` : "임시저장됨";
  }
  if (status === "offline") return "이 기기에 보관됨 · 연결되면 자동 동기화";
  if (status === "error") return "서버 초안을 불러오지 못함";
  return "입력하면 자동 임시저장";
}

export function CalendarGroomingCompletionFields({
  value,
  onChange,
  disabled,
  draftStatus,
  lastSavedAt,
  saveError,
  onRetrySave,
}: {
  value: GroomingCompletionDetails;
  onChange: (value: GroomingCompletionDetails) => void;
  disabled?: boolean;
  draftStatus?: GroomingRecordDraftSaveStatus;
  lastSavedAt?: string | null;
  saveError?: string;
  onRetrySave?: () => void;
}) {
  return (
    <div className="mt-4 space-y-4 rounded-[10px] border border-[#e7ebf0] bg-[#fbfcfd] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-[#111827]">미용 기록 메모</p>
          <p className="mt-0.5 text-[12px] leading-5 text-[#64748b]">고객 공개 내용과 매장 내부 메모를 나눠 기록합니다.</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-[11px] ${draftStatus === "offline" || draftStatus === "error" ? "text-[#a04455]" : "text-[#64748b]"}`}>
            {getDraftStatusCopy(draftStatus, lastSavedAt)}
          </p>
          {(draftStatus === "offline" || draftStatus === "error") && onRetrySave ? (
            <button type="button" onClick={onRetrySave} className="mt-1 text-[11px] font-medium text-[#334155] underline underline-offset-2">
              다시 저장
            </button>
          ) : null}
        </div>
      </div>
      <label className="block space-y-1.5">
        <span className="flex items-center justify-between gap-3 text-[13px] font-medium text-[#475569]">
          <span>시술 내용 <em className="not-italic font-normal text-[#2f7866]">· 고객 공개</em></span>
          <span className="text-[11px] font-normal text-[#94a3b8]">{value.treatmentNotes.length}/2000</span>
        </span>
        <SuggestionChips
          items={treatmentSuggestions}
          value={value.treatmentNotes}
          onChange={(treatmentNotes) => onChange({ ...value, treatmentNotes })}
          disabled={disabled}
        />
        <textarea
          value={value.treatmentNotes}
          onChange={(event) => onChange({ ...value, treatmentNotes: event.target.value })}
          disabled={disabled}
          maxLength={2000}
          placeholder="예: 6mm 클리핑, 얼굴 라인 정리, 발바닥 케어"
          className="min-h-[70px] w-full resize-y rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] leading-5 text-[#111827] outline-none transition focus:border-[#94a3b8] disabled:opacity-60"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="flex items-center justify-between gap-3 text-[13px] font-medium text-[#475569]">
          <span>홈케어·특이사항 <em className="not-italic font-normal text-[#2f7866]">· 고객 공개</em></span>
          <span className="text-[11px] font-normal text-[#94a3b8]">{value.specialNotes.length}/2000</span>
        </span>
        <SuggestionChips
          items={specialNoteSuggestions}
          value={value.specialNotes}
          onChange={(specialNotes) => onChange({ ...value, specialNotes })}
          disabled={disabled}
        />
        <textarea
          value={value.specialNotes}
          onChange={(event) => onChange({ ...value, specialNotes: event.target.value })}
          disabled={disabled}
          maxLength={2000}
          placeholder="예: 왼쪽 귀가 예민했어요. 다음 방문 때 상태를 다시 확인해 주세요."
          className="min-h-[62px] w-full resize-y rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] leading-5 text-[#111827] outline-none transition focus:border-[#94a3b8] disabled:opacity-60"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="flex items-center justify-between gap-3 text-[13px] font-medium text-[#475569]">
          <span>매장 내부 메모 <em className="not-italic font-normal text-[#8b5e3c]">· 고객 비공개</em></span>
          <span className="text-[11px] font-normal text-[#94a3b8]">{value.internalNotes.length}/4000</span>
        </span>
        <SuggestionChips
          items={internalNoteSuggestions}
          value={value.internalNotes}
          onChange={(internalNotes) => onChange({ ...value, internalNotes })}
          disabled={disabled}
        />
        <textarea
          value={value.internalNotes}
          onChange={(event) => onChange({ ...value, internalNotes: event.target.value })}
          disabled={disabled}
          maxLength={4000}
          placeholder="직원끼리만 확인할 주의사항, 상담 내용, 다음 작업 메모"
          className="min-h-[62px] w-full resize-y rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] leading-5 text-[#111827] outline-none transition focus:border-[#94a3b8] disabled:opacity-60"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium text-[#475569]">다음 권장 방문일</span>
        <input
          type="date"
          value={value.nextRecommendedVisitDate ?? ""}
          onChange={(event) => onChange({ ...value, nextRecommendedVisitDate: event.target.value || null })}
          disabled={disabled}
          className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#111827] outline-none transition focus:border-[#94a3b8] disabled:opacity-60"
        />
      </label>
      {saveError ? <p className="text-[11px] leading-4 text-[#a04455]">{saveError}</p> : null}
    </div>
  );
}
