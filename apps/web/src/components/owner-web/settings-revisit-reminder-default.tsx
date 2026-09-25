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
    <div className="rounded-[12px] border border-[#e5e7eb] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#eaf3ff] text-[#2f6fd6]">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[18px] font-semibold leading-[26px] text-[#172c46]">재예약 알림 기본 시점</p>
            <p className="mt-1 text-[14px] font-normal leading-5 text-[#64748b]">
              케어리포트를 작성할 때 이 날짜가 기본으로 들어갑니다.
            </p>
          </div>
        </div>
        <AlertSettingsSwitch
          checked={enabled}
          disabled={disabled}
          aria-label="재예약 알림 기본 사용"
          onCheckedChange={onEnabledChange}
        />
      </div>
      <label className="mt-3 flex min-h-14 items-center justify-between gap-3 rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-1.5">
        <span className="text-[16px] font-normal leading-6 text-[#52677e]">미용 완료일 기준</span>
        <span className="inline-flex items-center gap-2">
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
            className="h-11 w-20 rounded-[8px] border border-[#cfdbe7] bg-white px-3 text-right text-[16px] font-medium leading-6 text-[#172c46] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:bg-[#f3f6f9] disabled:text-[#94a3b8]"
          />
          <span className="text-[16px] font-normal leading-6 text-[#52677e]">일 후</span>
        </span>
      </label>
    </div>
  );
}
