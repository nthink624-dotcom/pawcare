"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function shiftMonth(value: string, amount: number) {
  const base = new Date(`${monthStart(value)}T00:00:00`);
  const next = new Date(base.getFullYear(), base.getMonth() + amount, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function calendarCells(month: string) {
  const base = new Date(`${month}-01T00:00:00`);
  const startOffset = base.getDay();
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return Array.from({ length: startOffset + lastDay }, (_, index) => {
    const day = index - startOffset + 1;
    return day > 0 ? `${month}-${String(day).padStart(2, "0")}` : null;
  });
}

export default function OwnerBookingDatePicker({ open, selectedDate, onClose, onSelectDate, quickDates }: { open: boolean; selectedDate: string; onClose: () => void; onSelectDate: (date: string) => void; quickDates?: Array<{ key: string; label: string }> }) {
  const [month, setMonth] = useState(() => selectedDate.slice(0, 7));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMonth(selectedDate.slice(0, 7));
  }
  const cells = useMemo(() => calendarCells(month), [month]);
  const monthLabel = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(new Date(`${month}-01T00:00:00`));
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/30 sm:items-center sm:justify-center sm:px-5" onClick={onClose}>
      <section aria-label="예약 조회 날짜 선택" className="w-full rounded-t-[20px] bg-white p-5 shadow-[0_-12px_36px_rgba(15,23,42,0.14)] sm:max-w-[360px] sm:rounded-[18px]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3"><div><p className="text-[18px] font-semibold tracking-[-0.02em] text-[#172033]">날짜 선택</p><p className="mt-0.5 text-[12px] text-[#718096]">하루 예약표를 확인합니다.</p></div><button type="button" onClick={onClose} aria-label="닫기" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f2f5f9] text-[#526276] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"><X className="h-4 w-4" /></button></div>
        {quickDates?.length ? <div className="mt-4 grid grid-cols-3 gap-1.5" role="group" aria-label="빠른 날짜 선택">{quickDates.map((option) => <button key={option.key} type="button" aria-pressed={option.key === selectedDate} onClick={() => onSelectDate(option.key)} className={`min-h-11 rounded-[10px] border px-2 text-[14px] font-medium leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${option.key === selectedDate ? "border-[#bfd6ff] bg-[#eef4ff] text-[#1d4ed8]" : "border-[#e3e8ef] bg-white text-[#475569] hover:bg-[#f8fafc]"}`}>{option.label}</button>)}</div> : null}
        <div className="mt-5 flex items-center justify-between"><button type="button" onClick={() => setMonth((value) => shiftMonth(value, -1))} aria-label="이전 달" className="inline-flex h-11 w-11 items-center justify-center rounded-[9px] border border-[#e3e8ef] text-[#4b5b72] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"><ChevronLeft className="h-4 w-4" /></button><p className="text-[16px] font-semibold text-[#25324a]">{monthLabel}</p><button type="button" onClick={() => setMonth((value) => shiftMonth(value, 1))} aria-label="다음 달" className="inline-flex h-11 w-11 items-center justify-center rounded-[9px] border border-[#e3e8ef] text-[#4b5b72] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"><ChevronRight className="h-4 w-4" /></button></div>
        <div className="mt-4 grid grid-cols-7 gap-y-2 text-center">{["일", "월", "화", "수", "목", "금", "토"].map((weekday) => <span key={weekday} className="text-[12px] font-semibold text-[#94a1b2]">{weekday}</span>)}{cells.map((date, index) => date ? <button key={date} type="button" onClick={() => onSelectDate(date)} className="flex h-11 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]" aria-pressed={date === selectedDate}><span className={`flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-semibold ${date === selectedDate ? "bg-[#2f6fd6] text-white shadow-[0_6px_12px_rgba(47,111,214,0.24)]" : "text-[#42516a] hover:bg-[#eef3fa]"}`}>{Number(date.slice(8, 10))}</span></button> : <span key={`blank-${index}`} className="h-11" />)}</div>
      </section>
    </div>
  );
}
