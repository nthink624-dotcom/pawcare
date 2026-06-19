"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

const MINUTES_MIN = 1;
const MINUTES_MAX = 240;
const MINUTES_STEP = 5;

type NotificationTimingPopoverProps = {
  value: number;
  suffix: "전" | "뒤";
  saving?: boolean;
  className?: string;
  onSave: (minutes: number) => void;
};

export function NotificationTimingPopover({
  value,
  suffix,
  saving = false,
  className,
  onSave,
}: NotificationTimingPopoverProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const minutes = Number.parseInt(draft, 10);
  const canSave = Number.isFinite(minutes) && minutes >= MINUTES_MIN && minutes <= MINUTES_MAX;

  const setMinutes = (nextMinutes: number) => {
    const clampedMinutes = Math.min(MINUTES_MAX, Math.max(MINUTES_MIN, nextMinutes));
    setDraft(String(clampedMinutes));
  };

  const adjustMinutes = (direction: 1 | -1) => {
    const baseMinutes = Number.isFinite(minutes) ? minutes : value;
    setMinutes(baseMinutes + direction * MINUTES_STEP);
  };

  return (
    <div
      className={cn(
        "absolute z-30 grid w-[206px] gap-2.5 rounded-[14px] border border-[#dbe2ea] bg-white p-3 shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
        className,
      )}
    >
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold leading-5 text-[#1e293b]">알림 시간</span>
          <span className="text-[11px] leading-4 text-[#94a3b8]">1~240분</span>
        </div>
        <div
          onWheel={(event) => {
            event.preventDefault();
            adjustMinutes(event.deltaY < 0 ? 1 : -1);
          }}
          className="grid grid-cols-[minmax(0,1fr)_34px] items-center gap-1 rounded-[12px] border border-[#dbe2ea] bg-[#f8fafc] p-1"
        >
          <div className="flex h-12 items-baseline justify-center gap-1 rounded-[10px] bg-white px-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 3))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSave && !saving) onSave(minutes);
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  adjustMinutes(1);
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  adjustMinutes(-1);
                }
              }}
              inputMode="numeric"
              className="h-full w-14 border-0 bg-transparent text-right text-[22px] font-semibold leading-none text-[#0f172a] outline-none"
              aria-label="알림 시간"
            />
            <span className="shrink-0 text-[13px] font-medium text-[#64748b]">분 {suffix}</span>
          </div>
          <div className="grid h-12 grid-rows-2 gap-1">
            <button
              type="button"
              onClick={() => adjustMinutes(1)}
              className="flex min-h-0 items-center justify-center rounded-[8px] bg-white text-[#64748b] transition hover:text-[#0f172a]"
              aria-label="알림 시간 늘리기"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => adjustMinutes(-1)}
              className="flex min-h-0 items-center justify-center rounded-[8px] bg-white text-[#64748b] transition hover:text-[#0f172a]"
              aria-label="알림 시간 줄이기"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <button
        type="button"
        disabled={!canSave || saving}
        onClick={() => onSave(minutes)}
        className="h-9 rounded-[8px] bg-[#242424] text-[15px] text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-45"
      >
        저장
      </button>
    </div>
  );
}
