"use client";

import { IconCalendarEvent, IconChevronRight, IconPlus } from "@tabler/icons-react";
import { NoteSectionIcon } from "./day-panel-icons";
import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { CalendarRequest, ShopCalendarEvent, ShopCalendarEventInput } from "../contracts/owner-calendar";
import { cn } from "../lib/cn";
import { isCalendarDate, seoulCalendarDate, seoulCalendarInstant, seoulCalendarTime, shiftCalendarDate, shopEventDayRange } from "../lib/owner-calendar";
import { calendarSecondaryButtonClass } from "./calendar-dialog";

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

export function ShopCalendarAgenda({ date, shopId, events, canEdit, loading, error, request, onRefresh, variant }: {
  date: string;
  shopId: string;
  events: ShopCalendarEvent[];
  canEdit: boolean;
  loading: boolean;
  error: boolean;
  request: CalendarRequest;
  onRefresh: () => void;
  variant?: "day-panel";
}) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const inDayPanel = variant === "day-panel";
  const editorDialog = editor ? <ShopCalendarEditor editor={editor} date={date} shopId={shopId} request={request} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); onRefresh(); }} /> : null;

  if (inDayPanel) {
    const openNew = () => setEditor({ id: crypto.randomUUID() });
    return (
      <section aria-label="노트" className="min-w-0">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2 px-0.5">
          <h3 className="flex min-w-0 items-center gap-1 text-[15px] font-semibold leading-[22px] text-[#1e293b]">
            <NoteSectionIcon className="mr-0.5 shrink-0" />
            <span className="truncate">노트</span>
            <span className="font-medium tabular-nums text-[#64748b]">{events.length}</span>
          </h3>
          {canEdit && events.length > 0 ? (
            <button type="button" data-owner-control-size="content" onClick={openNew} className="group -my-3 -mr-1.5 inline-flex min-h-11 shrink-0 items-center rounded-[6px] focus-visible:outline-2 focus-visible:outline-[#1677ff]">
              <span className="inline-flex h-7 items-center gap-0.5 rounded-[6px] px-1.5 text-[13px] font-semibold text-[#1677ff] transition-colors group-hover:bg-[#eef5ff] group-hover:text-[#0f62d6]">
                <IconPlus size={15} stroke={2.2} aria-hidden="true" />추가
              </span>
            </button>
          ) : null}
        </div>
        {error ? (
          <div role="status" className="flex flex-wrap items-center gap-2 overflow-hidden rounded-[10px] border border-[#e8edf3] bg-white px-3 py-0.5 text-[13px] text-[#6b7a90]">
            노트를 불러오지 못했어요.
            <button type="button" data-owner-control-size="content" className="min-h-10 rounded-md px-1.5 font-medium text-[#334155] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#1677ff]" onClick={onRefresh}>다시 조회</button>
          </div>
        ) : events.length === 0 ? (
          canEdit && !loading ? (
            <button type="button" data-owner-control-size="content" onClick={openNew} className="flex min-h-10 w-full items-center gap-1.5 rounded-[10px] border border-dashed border-[#bcd4f7] bg-white px-3 py-2 text-left text-[13px] font-medium leading-[18px] text-[#1677ff] transition-colors hover:border-[#8db8f5] hover:bg-[#f5f9ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1677ff]">
              <IconPlus size={15} stroke={2.2} aria-hidden="true" />노트 추가
            </button>
          ) : (
            <p role="status" className="overflow-hidden rounded-[10px] border border-[#e8edf3] bg-white px-3 py-3 text-center text-[13px] leading-[18px] text-[#6b7a90]">
              {loading ? "노트를 불러오는 중…" : "등록된 노트가 없어요"}
            </p>
          )
        ) : (
          <ul className="divide-y divide-[#edf1f5] overflow-hidden rounded-[10px] border border-[#e8edf3] bg-white">
            {events.map(event => {
              // Notes are day-long by default, so "종일" adds nothing; only show times for timed or imported events.
              const timeLabel = eventTimeLabel(event, date);
              const rangeLabel = noteRangeLabel(event);
              const showMeta = Boolean(rangeLabel) || timeLabel !== "종일" || event.source === "ics";
              const body = (
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-3 whitespace-pre-line break-keep text-[14px] font-medium leading-5 text-[#0f1b2d] [overflow-wrap:anywhere]">{event.title}</span>
                  {showMeta ? (
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[12px] leading-4 text-[#6b7a90]">
                      {rangeLabel ? <span className="whitespace-nowrap">{rangeLabel}</span> : null}
                      {timeLabel !== "종일" ? <span className="whitespace-nowrap tabular-nums">{timeLabel}</span> : null}
                      {event.source === "ics" ? <span>가져온 일정</span> : null}
                    </span>
                  ) : null}
                </span>
              );
              return <li key={event.id}>
                {canEdit ? (
                  <button type="button" data-owner-control-size="content" onClick={() => setEditor({ id: event.id, event })} className="flex min-h-11 w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#f8fafc] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1677ff]">
                    {body}<IconChevronRight size={14} className="mt-0.5 shrink-0 text-[#a3afbf]" aria-hidden="true" />
                  </button>
                ) : <div className="flex min-h-11 items-start gap-3 px-3 py-2.5">{body}</div>}
              </li>;
            })}
          </ul>
        )}
        {editorDialog}
      </section>
    );
  }

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
        {events.map(event => <li key={event.id}>
          {canEdit ? <button type="button" onClick={() => setEditor({ id: event.id, event })} className="flex min-h-11 w-full items-center gap-2 rounded-md px-1.5 py-2 text-left hover:bg-[#f1f5fa] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600">
            <span className="shrink-0 text-[13px] text-[#526175] tabular-nums">{eventTimeLabel(event, date)}</span>
            <span className="min-w-0 flex-1 break-words text-[14px] leading-5 text-[#25324a]">{event.title}</span>
            {event.source === "ics" ? <span className="shrink-0 rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[12px] leading-[18px] text-[#31588f]">가져온 일정</span> : null}
            <IconChevronRight size={14} aria-hidden="true" />
          </button> : <div className="flex min-h-11 items-center gap-2 px-1.5 py-2">
            <span className="shrink-0 text-[13px] text-[#526175] tabular-nums">{eventTimeLabel(event, date)}</span>
            <span className="min-w-0 flex-1 break-words text-[14px] leading-5 text-[#25324a]">{event.title}</span>
            {event.source === "ics" ? <span className="shrink-0 rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[12px] leading-[18px] text-[#31588f]">가져온 일정</span> : null}
          </div>}
        </li>)}
      </ul> : null}
      {editorDialog}
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
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(event?.title ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const url = `/api/owner/calendar-events?${new URLSearchParams({ shopId, id: editor.id })}`;
  const initialRange = event ? shopEventDayRange(event) : { first: date, last: date };
  const [startDate, setStartDate] = useState(initialRange.first);
  const [endDate, setEndDate] = useState(initialRange.last);
  const heading = event ? "노트 수정" : "노트 추가";

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    // showModal focuses the first date field; start in the text instead, with the cursor after the existing note.
    const text = textRef.current;
    text?.focus();
    text?.setSelectionRange(text.value.length, text.value.length);
    return () => dialog.close();
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = title.trim();
    if (busy || confirmDelete || !text) return;
    if (!isCalendarDate(startDate) || !isCalendarDate(endDate) || endDate < startDate) {
      setError("날짜를 다시 확인해 주세요.");
      return;
    }
    // Notes cover whole days from the start date through the end date (stored with an exclusive end midnight).
    // A timed (imported) event keeps its times of day and only moves by the days the dates moved.
    const input: ShopCalendarEventInput = !event || event.allDay
      ? { title: text, startsAt: seoulCalendarInstant(startDate), endsAt: seoulCalendarInstant(shiftCalendarDate(endDate, 1)), allDay: true }
      : {
        title: text,
        startsAt: new Date(Date.parse(event.startsAt) + calendarDayDiff(initialRange.first, startDate) * dayMs).toISOString(),
        endsAt: new Date(Date.parse(event.endsAt) + calendarDayDiff(initialRange.last, endDate) * dayMs).toISOString(),
        allDay: false,
      };
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      setError("날짜를 다시 확인해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await request(url, { method: event ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "노트를 저장하지 못했어요.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!event || busy || !confirmDelete) return;
    setBusy(true);
    setError("");
    try { await request(url, { method: "DELETE" }); onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "노트를 삭제하지 못했어요."); }
    finally { setBusy(false); }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
      className="fixed inset-0 m-auto h-fit w-[calc(100%-32px)] max-w-[400px] overflow-visible bg-transparent p-0 [filter:drop-shadow(0_24px_32px_rgba(15,23,42,0.28))] backdrop:bg-[#0f172a]/45"
    >
      <form onSubmit={save} className="relative flex min-h-[380px] flex-col bg-white px-7 pb-5 pt-7 text-[#0f1b2d]" style={{ clipPath: `polygon(0 0, calc(100% - ${noteFoldSize}px) 0, 100% ${noteFoldSize}px, 100% 100%, 0 100%)` }}>
        <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 rounded-bl-[4px]" style={{ width: noteFoldSize, height: noteFoldSize, background: "linear-gradient(to bottom left, transparent 50%, #eef1f5 50%, #d3d9e1 100%)" }} />
        <h2 id={titleId} className="sr-only">{heading}</h2>
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-0.5 gap-y-1 pr-12 text-[14px] text-[#334155]">
          <IconCalendarEvent size={17} stroke={1.8} className="mr-1 shrink-0 text-[#8a97a8]" aria-hidden="true" />
          <NoteDateField label="시작일" value={startDate} disabled={busy || confirmDelete} onChange={value => { setStartDate(value); if (endDate < value) setEndDate(value); }} />
          <span className="px-0.5 text-[#a3afbf]" aria-hidden="true">~</span>
          <NoteDateField label="종료일" value={endDate} min={startDate} disabled={busy || confirmDelete} onChange={value => setEndDate(value < startDate ? startDate : value)} />
        </div>
        <textarea
          ref={textRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={noteMaxLength}
          required
          disabled={busy || confirmDelete}
          aria-label="노트 내용"
          placeholder="메모를 적어 주세요"
          className="min-h-[200px] w-full flex-1 resize-none bg-transparent pr-8 text-[19px] leading-[1.55] text-[#0f1b2d] outline-none placeholder:text-[#a3afbf] [overflow-wrap:anywhere] disabled:opacity-70"
        />
        {error ? <p role="alert" className="mt-2 break-words text-[13px] leading-5 text-[#c62f37]">{error}</p> : null}
        <div className="mt-4 flex min-h-10 items-center gap-1.5">
          {confirmDelete ? (
            <>
              <p className="mr-auto min-w-0 text-[14px] font-medium text-[#334155]">이 노트를 삭제할까요?</p>
              <button type="button" data-owner-control-size="content" disabled={busy} className={noteGhostButtonClass} onClick={() => setConfirmDelete(false)}>돌아가기</button>
              <button type="button" data-owner-control-size="content" disabled={busy} className="inline-flex min-h-10 items-center rounded-[8px] bg-[#e5484d] px-4 text-[14px] font-semibold text-white hover:bg-[#d93d42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1677ff] disabled:opacity-50" onClick={() => void remove()}>삭제</button>
            </>
          ) : (
            <>
              <p className="mr-auto min-w-0 text-[12px] tabular-nums text-[#a3afbf]" aria-hidden="true">{title.length}/{noteMaxLength}</p>
              {event ? <button type="button" data-owner-control-size="content" disabled={busy} className={cn(noteGhostButtonClass, "text-[#c62f37] hover:bg-[#fff0f0] hover:text-[#a8232b]")} onClick={() => setConfirmDelete(true)}>삭제</button> : null}
              <button type="button" data-owner-control-size="content" disabled={busy} className={noteGhostButtonClass} onClick={onClose}>취소</button>
              <button type="submit" data-owner-control-size="content" disabled={busy || !title.trim()} className="inline-flex min-h-10 items-center rounded-[8px] bg-[#1e293b] px-4 text-[14px] font-semibold text-white hover:bg-[#0f172a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1677ff] disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]">{busy ? "저장 중…" : "저장"}</button>
            </>
          )}
        </div>
      </form>
    </dialog>
  );
}

function NoteDateField({ label, value, min, disabled, onChange }: {
  label: string;
  value: string;
  min?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <span className="relative inline-flex h-8 shrink-0 items-center rounded-[6px] px-1.5 font-medium transition-colors focus-within:outline-2 focus-within:outline-[#1677ff] hover:bg-[#f1f5f9] has-[:disabled]:opacity-60 has-[:disabled]:hover:bg-transparent">
      <span aria-hidden="true">{calendarDayLabel(value)}</span>
      <input
        type="date"
        aria-label={label}
        value={value}
        min={min}
        required
        disabled={disabled}
        onClick={e => { try { e.currentTarget.showPicker(); } catch { /* Keyboard entry still works where the picker can't open. */ } }}
        onChange={e => { if (isCalendarDate(e.target.value)) onChange(e.target.value); }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      />
    </span>
  );
}

function calendarDayLabel(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}월 ${day}일`;
}

function noteRangeLabel(event: ShopCalendarEvent) {
  const { first, last } = shopEventDayRange(event);
  if (first === last) return null;
  return first.slice(0, 7) === last.slice(0, 7) ? `${calendarDayLabel(first)} ~ ${Number(last.slice(8))}일` : `${calendarDayLabel(first)} ~ ${calendarDayLabel(last)}`;
}

function calendarDayDiff(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs);
}

const dayMs = 86_400_000;
const noteFoldSize = 44;
const noteMaxLength = 160;
const noteGhostButtonClass = "inline-flex min-h-10 items-center rounded-[8px] px-3 text-[14px] font-medium text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1677ff] disabled:opacity-40";
