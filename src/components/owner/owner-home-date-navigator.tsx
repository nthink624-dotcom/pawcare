"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { getOwnerTodayRelativeLabel } from "@/lib/owner-mobile-today";

function formatKstDate(dateKey: string) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  })
    .formatToParts(new Date(`${dateKey}T12:00:00+09:00`));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("month")}월 ${value("day")}일`;
}

export default function OwnerHomeDateNavigator({
  selectedDate,
  todayDate,
  onMoveDate,
  onOpenDatePicker,
}: {
  selectedDate: string;
  todayDate: string;
  onMoveDate: (direction: "prev" | "next") => void;
  onOpenDatePicker: () => void;
}) {
  const selectedDateLabel = formatKstDate(selectedDate);
  const relativeLabel = getOwnerTodayRelativeLabel(selectedDate, todayDate);

  return (
    <div aria-label="오늘 화면 날짜 선택" className="flex shrink-0 items-center gap-1">
      <button type="button" aria-label="이전 날짜" onClick={() => onMoveDate("prev")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[#334155] transition hover:bg-[#f1f5f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" aria-label={`${selectedDateLabel} ${relativeLabel} 날짜 선택`} onClick={onOpenDatePicker} className="inline-flex h-11 w-[92px] shrink-0 items-center justify-center gap-1 rounded-[10px] px-1 text-[#101a31] transition hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
        <span className="tabular-nums whitespace-nowrap text-[16px] font-medium leading-6 tracking-[-0.01em]">{selectedDateLabel}</span>
        <span className="whitespace-nowrap text-[13px] font-medium leading-5 text-[#64748b]">{relativeLabel}</span>
      </button>
      <button type="button" aria-label="다음 날짜" onClick={() => onMoveDate("next")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[#334155] transition hover:bg-[#f1f5f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
