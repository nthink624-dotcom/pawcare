"use client";

import type { BusinessHours } from "@/types/domain";
import SetupHoursBulkEditor from "./setup-hours-bulk-editor";
import SetupTimeField from "./setup-time-field";

export const setupInput = "min-h-11 min-w-0 w-full rounded-[10px] border border-[#d9e1ec] bg-white px-3 text-[16px] leading-6";
export const setupButton = "min-h-[50px] rounded-[10px] bg-[#111a30] px-4 text-[16px] font-normal text-white disabled:opacity-50";
const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const dayOrder = [1, 2, 3, 4, 5, 6, 0];

export function SetupHoursFields({ hours, onChange, monthlyClosure = false, onBulkEditingChange }: {
  hours: BusinessHours; onChange: (value: BusinessHours) => void;
  monthlyClosure?: boolean;
  onBulkEditingChange?: (editing: boolean) => void;
}) {
  const first = dayOrder.map((day) => hours[day]).find((value) => value?.enabled) ?? hours[1];

  return <div data-setup-hours-controls className="flex min-w-0 flex-1 flex-col">
    <SetupHoursBulkEditor initialOpen={first?.open || "10:00"} initialClose={first?.close || "19:00"} onEditingChange={onBulkEditingChange} onApply={(open, close) => {
      const next = { ...hours };
      for (const day of dayOrder) next[day] = { ...(hours[day] ?? { enabled: false }), open, close };
      onChange(next);
    }} />
    <div data-setup-hours-list>
    {dayOrder.map((index) => {
      const day = days[index];
      const value = hours[index] ?? { enabled: false, open: "", close: "" };
      const update = (patch: Partial<typeof value>) => onChange({ ...hours, [index]: { ...value, ...patch } });
      return <div key={day} data-setup-day={index} className="grid min-h-[49px] grid-cols-[48px_minmax(0,1fr)_44px] items-center gap-2 border-b border-[#e5e7eb] last:border-b-0">
        <span className={`whitespace-nowrap text-[16px] font-normal leading-6 ${value.enabled ? "text-[#15213b]" : "text-[#94a3b8]"}`}>{day}</span>
        <div className="flex min-w-0 items-center justify-center">
          {value.enabled || monthlyClosure ? <>
            <SetupTimeField label={`${day} 영업 시작`} value={value.open} onChange={(open) => update({ open })} />
            <span aria-hidden="true" className="mx-0.5 text-[16px] text-[#64748b]">–</span>
            <SetupTimeField label={`${day} 영업 종료`} value={value.close} onChange={(close) => update({ close })} />
          </> : <span className="text-[16px] leading-6 text-[#94a3b8]">휴무</span>}
        </div>
        <button type="button" role="switch" aria-label={`${day} 영업`} aria-checked={value.enabled} onClick={() => update({ enabled: !value.enabled })} className="flex h-11 w-11 items-center justify-end rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">
          <span aria-hidden="true" className={`relative h-[23px] w-[38px] rounded-full transition-colors ${value.enabled ? "bg-[#111a30]" : "bg-[#d1d5db]"}`}><span className={`absolute top-0.5 h-[19px] w-[19px] rounded-full bg-white transition-[left] motion-reduce:transition-none ${value.enabled ? "left-[17px]" : "left-0.5"}`} /></span>
        </button>
      </div>;
    })}
    </div>
  </div>;
}
