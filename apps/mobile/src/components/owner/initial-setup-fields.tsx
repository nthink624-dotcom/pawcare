"use client";

import type { BusinessHours } from "@/types/domain";
import styles from "./initial-setup-layout.module.css";

export const setupInput = "min-h-11 min-w-0 w-full rounded-[10px] border border-[#d9e1ec] bg-white px-3 text-[16px] leading-6";
export const setupButton = "min-h-12 rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium text-white disabled:opacity-50";
const days = ["일", "월", "화", "수", "목", "금", "토"];

export function SetupHoursFields({ hours, onChange, monthlyClosure = false }: {
  hours: BusinessHours; onChange: (value: BusinessHours) => void;
  monthlyClosure?: boolean;
}) {
  return <div className={`${styles.hours} space-y-3`}>
    {days.map((day, index) => {
      const value = hours[index] ?? { enabled: false, open: "", close: "" };
      const update = (patch: Partial<typeof value>) => onChange({ ...hours, [index]: { ...value, ...patch } });
      return <div key={day} className="grid items-center gap-2" style={{ gridTemplateColumns: "44px minmax(0, 1fr) minmax(0, 1fr)" }}>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#111a30]" checked={value.enabled} onChange={(event) => update({ enabled: event.target.checked })} />{day}</label>
        <input aria-label={`${day}요일 영업 시작`} className={setupInput} style={{ paddingInline: 8 }} type="time" disabled={!value.enabled && !monthlyClosure} value={value.open} onChange={(event) => update({ open: event.target.value })} />
        <input aria-label={`${day}요일 영업 종료`} className={setupInput} style={{ paddingInline: 8 }} type="time" disabled={!value.enabled && !monthlyClosure} value={value.close} onChange={(event) => update({ close: event.target.value })} />
      </div>;
    })}
  </div>;
}

