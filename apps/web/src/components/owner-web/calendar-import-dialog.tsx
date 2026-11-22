"use client";

import { IconFileImport } from "@tabler/icons-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import type { CalendarImportPreview } from "@petmanager/shared/contracts/owner-calendar";
import { CalendarDialog, calendarFieldClass, calendarPrimaryButtonClass, calendarSecondaryButtonClass } from "@petmanager/shared/components/calendar-dialog";
import { calendarMonthBounds, seoulCalendarDate, seoulCalendarTime, shiftCalendarDate } from "@petmanager/shared/lib/owner-calendar";
import { fetchApiJsonWithAuth } from "@/lib/api";

const maxFileBytes = 500_000;

export default function CalendarImportDialog({ shopId, month, onClose, onImported }: {
  shopId: string;
  month: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const bounds = calendarMonthBounds(month);
  const [from, setFrom] = useState(bounds.from);
  const [to, setTo] = useState(shiftCalendarDate(bounds.until, -1));
  const [file, setFile] = useState<File | null>(null);
  const [ics, setIcs] = useState("");
  const [preview, setPreview] = useState<CalendarImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const url = `/api/owner/calendar-events/import?${new URLSearchParams({ shopId })}`;

  function updateFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    if (!chosen) { setFile(null); return; }
    if (!chosen.name.toLowerCase().endsWith(".ics") || chosen.size > maxFileBytes) {
      setError("500KB 이하의 .ics 파일을 선택해 주세요.");
      event.target.value = "";
      setFile(null);
      return;
    }
    setError("");
    setFile(chosen);
  }

  async function requestPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const text = await file.text();
      const next = await fetchApiJsonWithAuth<CalendarImportPreview>(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ics: text, from, to }),
      });
      setIcs(text);
      setPreview(next);
      setSelected(new Set());
    } catch (failure) { setError(failure instanceof Error ? failure.message : "일정을 미리 볼 수 없어요."); }
    finally { setBusy(false); }
  }

  async function importSelection() {
    if (!preview || !selected.size || busy) return;
    setBusy(true);
    setError("");
    try {
      const summary = await fetchApiJsonWithAuth<{ imported: number; duplicates: number }>(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ics, from, to, selectedKeys: [...selected] }),
      });
      setResult(summary);
      setIcs("");
      setFile(null);
      onImported();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "일정을 가져오지 못했어요."); }
    finally { setBusy(false); }
  }

  const newItems = preview?.items.filter(item => !item.alreadyImported) ?? [];
  return (
    <CalendarDialog title="네이버 일정 가져오기" busy={busy} onClose={onClose}>
      <div className="p-4 text-[14px] leading-5 text-[#334155]">
        {result ? <div className="space-y-3">
          <p role="status" className="font-medium">매장 일정 {result.imported}건을 가져왔어요.</p>
          {result.duplicates ? <p className="text-[#526175]">이미 가져온 일정 {result.duplicates}건은 건너뛰었어요.</p> : null}
          <div className="flex justify-end"><button type="button" className={calendarPrimaryButtonClass} onClick={onClose}>확인</button></div>
        </div> : preview ? <div className="space-y-3">
          <p className="text-[#526175]">선택한 일정의 제목과 시간이 매장 직원에게 표시됩니다.</p>
          {preview.skipped ? <p role="status" className="text-[#a04455]">날짜를 확인할 수 없는 일정 {preview.skipped}건을 건너뛰었어요.</p> : null}
          {!preview.items.length ? <p role="status" className="rounded-md bg-[#f1f5fa] p-3">선택한 기간에 일정이 없어요.</p> : <>
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-2">
              <p role="status" className="font-medium">{selected.size}/{newItems.length}건 선택</p>
              {newItems.length ? <button type="button" className={calendarSecondaryButtonClass} disabled={busy} onClick={() => setSelected(current => current.size === newItems.length ? new Set() : new Set(newItems.map(item => item.key)))}>
                {selected.size === newItems.length ? "전체 해제" : "모두 선택"}
              </button> : null}
            </div>
            <ul aria-label="가져올 일정" className="max-h-[35dvh] divide-y divide-[#e8edf3] overflow-y-auto rounded-[8px] border border-[#e8edf3] px-2">
              {preview.items.map(item => {
                const date = seoulCalendarDate(item.startsAt);
                const end = item.allDay ? shiftCalendarDate(seoulCalendarDate(item.endsAt), -1) : seoulCalendarDate(item.endsAt);
                const timeLabel = item.allDay ? (date === end ? "종일" : `${end}까지 · 종일`) : `${seoulCalendarTime(item.startsAt)}–${date === end ? "" : `${end} `}${seoulCalendarTime(item.endsAt)}`;
                return <li key={item.key}>
                  <label className="flex min-h-11 items-center gap-2 py-2">
                    <input type="checkbox" checked={selected.has(item.key)} disabled={busy || item.alreadyImported} className="size-[18px] shrink-0 accent-blue-600" onChange={event => setSelected(current => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(item.key); else next.delete(item.key);
                      return next;
                    })} />
                    <span className="min-w-0 flex-1 break-words"><span className="block font-medium">{item.title}</span><span className="block text-[13px] text-[#526175]">{date} · {timeLabel}</span></span>
                    {item.alreadyImported ? <span className="shrink-0 text-[12px] text-[#64748b]">가져옴</span> : null}
                  </label>
                </li>;
              })}
            </ul>
          </>}
          {error ? <p role="alert" className="text-[#a04455]">{error}</p> : null}
          <footer className="flex flex-wrap justify-end gap-2 border-t border-[#e8edf3] pt-3">
            <button type="button" disabled={busy} className={calendarSecondaryButtonClass} onClick={() => { setPreview(null); setIcs(""); setError(""); }}>파일·기간 변경</button>
            <button type="button" disabled={busy || !selected.size} className={calendarPrimaryButtonClass} onClick={() => void importSelection()}>{busy ? "가져오는 중…" : "선택 일정 가져오기"}</button>
          </footer>
        </div> : <form onSubmit={requestPreview} className="space-y-4">
          <label className="relative inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-[8px] border border-[#dbe2ea] px-3 font-medium focus-within:outline-2 focus-within:outline-blue-600">
            <IconFileImport size={18} stroke={1.75} aria-hidden="true" /> <span>파일 선택</span>
            <input type="file" accept=".ics,text/calendar" onChange={updateFile} disabled={busy} className="sr-only" />
          </label>
          {file ? <p className="break-all text-[13px] text-[#526175]">{file.name}</p> : null}
          <p className="text-[#526175]">네이버 캘린더에서 내보낸 .ics 파일을 선택해 주세요.</p>
          <fieldset>
            <legend className="mb-2 font-medium">가져올 기간</legend>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="grid min-w-0 gap-1.5">시작일<input type="date" min="1970-01-01" max="2100-12-31" className={calendarFieldClass} required disabled={busy} value={from} onChange={event => { setFrom(event.target.value); if (to < event.target.value) setTo(event.target.value); }} /></label>
              <label className="grid min-w-0 gap-1.5">종료일<input type="date" min={from} max="2100-12-31" className={calendarFieldClass} required disabled={busy} value={to} onChange={event => setTo(event.target.value)} /></label>
            </div>
          </fieldset>
          {error ? <p role="alert" className="text-[#a04455]">{error}</p> : null}
          <footer className="flex justify-end gap-2 border-t border-[#e8edf3] pt-3">
            <button type="button" disabled={busy} className={calendarSecondaryButtonClass} onClick={onClose}>취소</button>
            <button type="submit" disabled={busy || !file} className={calendarPrimaryButtonClass}>{busy ? "불러오는 중…" : "미리보기"}</button>
          </footer>
        </form>}
      </div>
    </CalendarDialog>
  );
}
