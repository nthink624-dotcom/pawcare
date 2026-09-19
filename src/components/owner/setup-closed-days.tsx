"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { SetupClosureCycle } from "@/lib/initial-setup-hours-policy";
import { setupInput, setupButton } from "./initial-setup-fields";
import SetupModal from "@/components/ui/setup-modal";
import styles from "./initial-setup-layout.module.css";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const dateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export default function SetupClosedDays({ cycle, onCycleChange, dates, onDatesChange }: {
  cycle: SetupClosureCycle; onCycleChange: (value: SetupClosureCycle) => void;
  dates: string[]; onDatesChange: (value: string[]) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const closeCalendar = () => {
    setCalendarOpen(false);
    requestAnimationFrame(() => calendarButtonRef.current?.focus());
  };
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthLength = new Date(year, monthIndex + 1, 0).getDate();
  const toggleDate = (key: string) => onDatesChange(dates.includes(key) ? dates.filter((value) => value !== key) : [...dates, key].sort());

  return <div className="mt-5 space-y-4">
    <div className={styles.holidayRow}>
      <label htmlFor="setup-closure-cycle" className={styles.holidayLabel}>추가 정기휴무</label>
      <div className={styles.selectWrap}>
      <select id="setup-closure-cycle" className={`${setupInput} ${styles.settingControl} font-medium`} value={cycle} onChange={(event) => onCycleChange(event.target.value as SetupClosureCycle)}>
        <option value="weekly">없음</option>
        <option value="monthly_1_3">첫째·셋째 주</option><option value="monthly_2_4">둘째·넷째 주</option>
      </select>
      <ChevronDown className={styles.selectArrow} aria-hidden="true" size={16} />
      </div>
        <button ref={calendarButtonRef} type="button" aria-label="캘린더" title="특정일 휴무 캘린더" aria-haspopup="dialog" aria-expanded={calendarOpen} onClick={() => setCalendarOpen(true)} className={`${styles.settingControl} flex items-center justify-center rounded-[10px] border border-[#d9e1ec]`}>
          <CalendarDays aria-hidden="true" size={22} />
        </button>
    </div>
      {calendarOpen && createPortal(<SetupModal hideScrollbar label="특정일 휴무 캘린더" onCancel={closeCalendar}>
      <section id="setup-holiday-calendar" className="space-y-3 p-5">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-semibold leading-7">특정일 휴무</h2>
          <button type="button" aria-label="캘린더 닫기" onClick={closeCalendar} className="flex h-11 w-11 items-center justify-center"><X aria-hidden="true" size={20} /></button>
        </header>
        <div className="flex items-center justify-between">
          <button type="button" aria-label="이전 달" className="flex h-11 w-11 items-center justify-center" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><ChevronLeft aria-hidden="true" size={20} /></button>
          <p aria-live="polite" className="text-[16px] font-medium leading-6">{year}년 {monthIndex + 1}월</p>
          <button type="button" aria-label="다음 달" className="flex h-11 w-11 items-center justify-center" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><ChevronRight aria-hidden="true" size={20} /></button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {weekdays.map((day) => <span key={day} className="py-2 text-[13px] leading-5 text-[#64748b]">{day}</span>)}
          {Array.from({ length: month.getDay() }, (_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: monthLength }, (_, index) => {
            const day = index + 1; const key = dateKey(year, monthIndex, day); const selected = dates.includes(key);
            return <button key={key} type="button" aria-label={`${year}년 ${monthIndex + 1}월 ${day}일 휴무`} aria-pressed={selected} onClick={() => toggleDate(key)} className={`min-h-11 min-w-0 rounded-[8px] text-[16px] font-medium leading-6 ${selected ? "bg-[#111a30] text-white" : "hover:bg-[#f3f5f7]"}`}>{day}</button>;
          })}
        </div>
        <button type="button" className={`${setupButton} w-full`} onClick={closeCalendar}>완료</button>
      </section>
      </SetupModal>, document.body)}
      {dates.length > 0 && <ul aria-label="선택한 특정일 휴무" className="flex flex-wrap gap-2">{[...dates].sort().map((date) => <li key={date}><button type="button" aria-label={`${date} 휴무 해제`} onClick={() => toggleDate(date)} className="flex min-h-11 items-center gap-2 rounded-[8px] bg-[#f3f5f7] px-3 text-[14px] leading-5">{date}<X aria-hidden="true" size={14} /></button></li>)}</ul>}
  </div>;
}
