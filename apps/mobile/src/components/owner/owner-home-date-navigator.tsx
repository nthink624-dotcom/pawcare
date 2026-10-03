"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

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
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  return (
    <div aria-label="오늘 화면 날짜 선택" className="flex shrink-0 items-center gap-0">
      <button type="button" aria-label="이전 날짜" onClick={() => onMoveDate("prev")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] transition hover:bg-[#f1f5f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={`${selectedDateLabel} ${relativeLabel} 날짜 선택. 좌우로 밀어 날짜 변경`}
        onPointerDown={(event) => {
          if (event.pointerType !== "touch" || !event.isPrimary) return;
          pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const start = pointerStart.current;
          pointerStart.current = null;
          if (!start || start.id !== event.pointerId) return;
          const deltaX = event.clientX - start.x;
          const deltaY = event.clientY - start.y;
          if (Math.abs(deltaX) < 36 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
          event.preventDefault();
          suppressClick.current = true;
          onMoveDate(deltaX < 0 ? "next" : "prev");
          window.setTimeout(() => { suppressClick.current = false; }, 350);
        }}
        onPointerCancel={() => { pointerStart.current = null; }}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }}
        onClick={onOpenDatePicker}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-[10px] px-0 text-[#101a31] transition hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] [touch-action:pan-y]"
      >
        <span className="tabular-nums whitespace-nowrap text-[16px] font-medium leading-6 tracking-[-0.01em]">{selectedDateLabel}</span>
        <span className="whitespace-nowrap text-[13px] font-medium leading-5 text-[#64748b]">{relativeLabel}</span>
      </button>
      <button type="button" aria-label="다음 날짜" onClick={() => onMoveDate("next")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] transition hover:bg-[#f1f5f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
