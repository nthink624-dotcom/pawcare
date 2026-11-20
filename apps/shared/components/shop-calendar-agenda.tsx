"use client";

import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import type { CalendarRequest, ShopCalendarEvent, ShopCalendarEventInput } from "../contracts/owner-calendar";
import { isCalendarDate, seoulCalendarDate, seoulCalendarInstant, seoulCalendarTime, shiftCalendarDate } from "../lib/owner-calendar";
import { CalendarDialog, calendarFieldClass, calendarPrimaryButtonClass, calendarSecondaryButtonClass } from "./calendar-dialog";
import { WheelTimeField } from "./ui/wheel-time-field";

export function CalendarHolidayLabel({ names }: { names?: string[] }) {
  if (!names?.length) return null;
  return <p data-calendar-holiday className="break-keep text-[13px] font-medium leading-5 text-[#a04455]">{names.join(" · ")}</p>;
}

function eventTimeLabel(event: ShopCalendarEvent, date: string) {
  if (event.allDay) return "종일";
  const startDay = seoulCalendarDate(event.startsAt);
  const endDay = seoulCalendarDate(event.endsAt);
  const start = seoulCalendarTime(event.startsAt);
  const end = seoulCalendarTime(event.endsAt);
  if (startDay < date && date < endDay) return "종일";
  if (startDay < date) return `${end}까지`;
  if (endDay > date) return `${start}부터`;
  return start === end ? start : `${start}–${end}`;
}

type Editor = { id: string; event?: ShopCalendarEvent };

export function ShopCalendarAgenda({ date, shopId, events, canEdit, loading, error, request, onRefresh }: {
  date: string;
  shopId: string;
  events: ShopCalendarEvent[];
  canEdit: boolean;
  loading: boolean;
  error: boolean;
  request: CalendarRequest;
  onRefresh: () => void;
}) {
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <section aria-label="매장 일정" className="min-w-0 border-t border-[#e8edf3] bg-white py-2">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-2">
        <h3 className="text-[16px] font-medium leading-6 text-[#25324a]">매장 일정</h3>
        {canEdit ? <button type="button" className={calendarSecondaryButtonClass} onClick={() => setEditor({ id: crypto.randomUUID() })}>
          <IconPlus size={16} stroke={1.75} aria-hidden="true" /> 일정 추가
        </button> : null}
      </div>
      {error ? <div role="status" className="flex flex-wrap items-center gap-2 text-[14px] text-[#526175]">
        매장 일정을 불러오지 못했어요.
        <button type="button" className="min-h-11 rounded-md px-1.5 text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={onRefresh}>다시 조회</button>
      </div> : !events.length ? <p role="status" className="py-1 text-[14px] leading-5 text-[#526175]">{loading ? "매장 일정을 불러오는 중…" : "등록된 매장 일정이 없어요."}</p> : null}
      {events.length ? <ul className="divide-y divide-[#e8edf3]">
        {events.map(event => {
          const row = (
            <>
              <span className="shrink-0 text-[13px] text-[#526175] tabular-nums">{eventTimeLabel(event, date)}</span>
              <span className="min-w-0 flex-1 break-words text-[14px] leading-5 text-[#25324a]">{event.title}</span>
              {event.source === "ics" ? <span className="shrink-0 rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[12px] leading-[18px] text-[#31588f]">가져온 일정</span> : null}
            </>
          );
          return <li key={event.id}>
            {canEdit ? <button type="button" onClick={() => setEditor({ id: event.id, event })} className="flex min-h-11 w-full items-center gap-2 rounded-md px-1.5 py-2 text-left hover:bg-[#f1f5fa] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600">
              {row}<IconChevronRight size={14} aria-hidden="true" />
            </button> : <div className="flex min-h-11 items-center gap-2 px-1.5 py-2">{row}</div>}
          </li>;
        })}
      </ul> : null}
      {editor ? <ShopCalendarEditor editor={editor} date={date} shopId={shopId} request={request} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); onRefresh(); }} /> : null}
    </section>
  );
}

function ShopCalendarEditor({ editor, date, shopId, request, onClose, onSaved }: {
  editor: Editor;
  date: string;
  shopId: string;
  request: CalendarRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const event = editor.event;
  const [title, setTitle] = useState(event?.title ?? "");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startDate, setStartDate] = useState(event ? seoulCalendarDate(event.startsAt) : date);
  const [endDate, setEndDate] = useState(event
    ? (event.allDay ? shiftCalendarDate(seoulCalendarDate(event.endsAt), -1) : seoulCalendarDate(event.endsAt))
    : date);
  const [startTime, setStartTime] = useState(event && !event.allDay ? seoulCalendarTime(event.startsAt) : "09:00");
  const [endTime, setEndTime] = useState(event && !event.allDay ? seoulCalendarTime(event.endsAt) : "10:00");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const url = `/api/owner/calendar-events?${new URLSearchParams({ shopId, id: editor.id })}`;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || confirmDelete || !title.trim()) return;
    if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) { setError("시작일과 종료일을 선택해 주세요."); return; }
    const exclusiveEnd = allDay ? shiftCalendarDate(endDate, 1) : endDate;
    const keepOriginal = (original: string | undefined, day: string, time: string) => original && allDay === event?.allDay
      && day === seoulCalendarDate(original) && (allDay || time === seoulCalendarTime(original));
    const startsAt = event && keepOriginal(event.startsAt, startDate, startTime)
      ? new Date(event.startsAt).toISOString()
      : seoulCalendarInstant(startDate, allDay ? "00:00" : startTime);
    let endsAt = event && keepOriginal(event.endsAt, exclusiveEnd, endTime)
      ? new Date(event.endsAt).toISOString()
      : seoulCalendarInstant(exclusiveEnd, allDay ? "00:00" : endTime);
    // Preserve the single-instant representation when editing an imported point event.
    if (event && !allDay && startsAt === endsAt && Date.parse(event.endsAt) - Date.parse(event.startsAt) === 1) {
      endsAt = new Date(Date.parse(startsAt) + 1).toISOString();
    }
    if (endsAt <= startsAt) { setError("종료는 시작보다 뒤로 설정해 주세요."); return; }
    const input: ShopCalendarEventInput = { title: title.trim(), startsAt, endsAt, allDay };
    setBusy(true);
    setError("");
    try {
      await request(url, { method: event ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "일정을 저장하지 못했어요.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!event || busy || !confirmDelete) return;
    setBusy(true);
    setError("");
    try { await request(url, { method: "DELETE" }); onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "일정을 삭제하지 못했어요."); }
    finally { setBusy(false); }
  }

  return <CalendarDialog title={event ? "매장 일정 수정" : "매장 일정 추가"} busy={busy} onClose={onClose}>
    <form onSubmit={save} className="space-y-4 p-4 text-[14px] text-[#334155]">
      <label className="grid gap-1.5">제목<input className={calendarFieldClass} value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required disabled={busy} /></label>
      <label className="flex min-h-11 items-center gap-2"><input className="size-5 accent-blue-600" type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} disabled={busy} />종일 일정</label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="grid min-w-0 gap-1.5">시작일<input type="date" min="1970-01-01" max="2100-12-31" className={calendarFieldClass} value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} disabled={busy} required /></label>
        <label className="grid min-w-0 gap-1.5">종료일<input type="date" min={startDate} max="2100-12-31" className={calendarFieldClass} value={endDate} onChange={e => setEndDate(e.target.value)} disabled={busy} required /></label>
        {!allDay ? <>
          <div className="grid min-w-0 gap-1.5"><span>시작 시간</span><WheelTimeField value={startTime} onValueChange={setStartTime} aria-label="시작 시간" disabled={busy} /></div>
          <div className="grid min-w-0 gap-1.5"><span>종료 시간</span><WheelTimeField value={endTime} onValueChange={setEndTime} aria-label="종료 시간" disabled={busy} /></div>
        </> : null}
      </div>
      {error ? <p role="alert" className="break-words text-[14px] leading-5 text-[#a04455]">{error}</p> : null}
      {confirmDelete ? (
        <div className="border-t border-[#e8edf3] pt-3">
          <p className="mb-2 text-[14px] font-medium">이 매장 일정을 삭제할까요?</p>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={busy} className={calendarSecondaryButtonClass} onClick={() => setConfirmDelete(false)}>돌아가기</button>
            <button type="button" disabled={busy} className="min-h-11 rounded-[8px] bg-[#a04455] px-4 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a04455] disabled:opacity-50" onClick={() => void remove()}>삭제</button>
          </div>
        </div>
      ) : <footer className="flex items-center justify-end gap-2 border-t border-[#e8edf3] pt-3">
        {event ? <button type="button" disabled={busy} className="mr-auto min-h-11 rounded-md px-1.5 text-[#a04455] focus-visible:outline-2 focus-visible:outline-[#a04455]" onClick={() => setConfirmDelete(true)}>일정 삭제</button> : null}
        <button type="button" disabled={busy} className={calendarSecondaryButtonClass} onClick={onClose}>취소</button>
        <button type="submit" disabled={busy || !title.trim()} className={calendarPrimaryButtonClass}>{busy ? "저장 중…" : "저장"}</button>
      </footer>}
    </form>
  </CalendarDialog>;
}
