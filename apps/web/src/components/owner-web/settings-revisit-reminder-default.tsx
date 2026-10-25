"use client";

import { useEffect, useState } from "react";

function clampDays(value: number) {
  return Math.min(Math.max(Math.round(value), 1), 365);
}

export function SettingsRevisitReminderDefault({
  enabled,
  disabled = false,
  days,
  onEnabledChange,
  onDaysChange,
  showEnabledControl = true,
}: {
  enabled: boolean;
  disabled?: boolean;
  days: number;
  onEnabledChange: (enabled: boolean) => void;
  onDaysChange: (days: number) => void;
  showEnabledControl?: boolean;
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
        {showEnabledControl ? <button type="button" data-alert-type-chip="revisit_notice" data-owner-control-size="content"
          aria-pressed={enabled} aria-label={`재예약 알림 ${enabled ? "ON" : "OFF"}`} disabled={disabled}
          onClick={() => onEnabledChange(!enabled)}
          className={`inline-flex min-h-11 items-center gap-3 rounded-full border px-3 py-2 text-[16px] font-medium leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60 ${enabled ? "border-[#94a3b8] bg-[#f1f5f9] text-[#15213b]" : "border-[#e1e4ea] bg-[#fafbfc] text-[#64748b]"}`}>
          <span>재예약 알림</span><span className="text-[13px]">{enabled ? "ON" : "OFF"}</span>
        </button> : <p className="text-[16px] font-normal text-[#475569]">재예약 알림 주기</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 flex-wrap items-center gap-2">
          <span className="text-[14px] font-normal leading-5 text-[#475569]">미용 완료일 기준</span>
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
            <span className="text-[14px] font-normal leading-5 text-[#475569]">일 후</span>
          </span>
        </label>
      </div>
    </div>
  );
}
