"use client";

import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

import { AlertSettingsSwitch } from "@/components/owner-web/settings-alert-switch";

function clampDays(value: number) {
  return Math.min(Math.max(Math.round(value), 1), 365);
}

export function SettingsRevisitReminderDefault({
  enabled,
  disabled = false,
  days,
  onEnabledChange,
  onDaysChange,
}: {
  enabled: boolean;
  disabled?: boolean;
  days: number;
  onEnabledChange: (enabled: boolean) => void;
  onDaysChange: (days: number) => void;
}) {
  const [inputValue, setInputValue] = useState(String(days));

  useEffect(() => {
    setInputValue(String(days));
  }, [days]);

  function commitDays() {
    const parsed = Number(inputValue);
    const nextDays = clampDays(Number.isFinite(parsed) ? parsed : days);
    setInputValue(String(nextDays));
    if (nextDays !== days) onDaysChange(nextDays);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#eaf3ff] text-[#2f6fd6]">
          <CalendarClock className="h-4 w-4" />
        </span>
        <p className="text-[18px] font-medium leading-[26px] text-[#15213b]">재예약 알림 기본 시점</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 flex-wrap items-center gap-2">
          <span className="text-[16px] font-normal leading-6 text-[#475569]">미용 완료일 기준</span>
          <span className="inline-flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={365}
              value={inputValue}
              disabled={disabled || !enabled}
              onChange={(event) => setInputValue(event.target.value)}
              onBlur={commitDays}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="h-9 w-16 rounded-[7px] border border-[#cfdbe7] bg-white px-2 text-right text-[16px] font-medium leading-6 text-[#172c46] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:bg-[#f3f6f9] disabled:text-[#94a3b8]"
            />
            <span className="text-[16px] font-normal leading-6 text-[#475569]">일 후</span>
          </span>
        </label>
        <AlertSettingsSwitch
          checked={enabled}
          disabled={disabled}
          aria-label="재예약 알림 기본 사용"
          onCheckedChange={onEnabledChange}
        />
      </div>
    </div>
  );
}
