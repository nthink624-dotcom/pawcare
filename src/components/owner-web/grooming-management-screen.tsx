"use client";

import { Camera, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { groomingRecords, reservationRows } from "@/components/owner-web/owner-web-data";
import { ToolbarRow, WebSurface } from "@/components/owner-web/owner-web-ui";
import { addDate, cn, currentDateInTimeZone } from "@/lib/utils";

type GroomingRecord = (typeof groomingRecords)[number];
type ReservationRow = (typeof reservationRows)[number] & { date: string };
type DayItem = {
  id: string;
  type: "record" | "reservation";
  pet: string;
  customer: string;
  service: string;
  status: string;
  note: string;
  date: string;
  next?: string;
  time?: string;
  staff?: string;
  phone?: string;
  channel?: string;
};

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

const reservationDates: ReservationRow[] = reservationRows.map((reservation, index) => ({
  ...reservation,
  date: addDate(currentDateInTimeZone(), index === 4 ? 1 : 0),
}));

function normalizeRecordDate(date: string) {
  return date.replaceAll(".", "-");
}

function formatMonthLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월`;
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getMonth() + 1}.${parsed.getDate()}`;
}

function getMonthDates(monthAnchor: string) {
  const parsed = new Date(`${monthAnchor}T00:00:00`);
  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const dates: Array<string | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) dates.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) dates.push(new Date(year, month, day).toLocaleDateString("en-CA"));
  while (dates.length % 7 !== 0) dates.push(null);

  return dates;
}

function moveMonth(date: string, offset: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setMonth(parsed.getMonth() + offset);
  return parsed.toLocaleDateString("en-CA");
}

function buildDayItems(records: GroomingRecord[], reservations: ReservationRow[], date: string): DayItem[] {
  const recordItems: DayItem[] = records
    .filter((record) => normalizeRecordDate(record.date) === date)
    .map((record) => ({
      id: record.id,
      type: "record" as const,
      pet: record.pet,
      customer: record.customer,
      service: record.service,
      status: "기록 완료",
      note: record.memo,
      next: record.next,
      date,
    }));

  const reservationItems: DayItem[] = reservations
    .filter((reservation) => reservation.date === date)
    .map((reservation) => ({
      id: reservation.id,
      type: "reservation" as const,
      pet: reservation.pet,
      customer: reservation.customer,
      service: reservation.service,
      status: reservation.status,
      note: reservation.note,
      time: reservation.time,
      staff: reservation.staff,
      phone: reservation.phone,
      channel: reservation.channel,
      date,
    }));

  return [...reservationItems, ...recordItems].sort((first, second) => (first.time ?? "99:99").localeCompare(second.time ?? "99:99"));
}

function getRecordTone(item: DayItem) {
  if (item.type === "record") return "border-[#d8e2ea] bg-white";
  if (item.status === "승인 대기") return "border-[#f1e3bf] bg-[#fffdf6]";
  return "border-[#d8e7e1] bg-[#f9fdfb]";
}

function getBadgeTone(item: DayItem) {
  if (item.type === "record") return "bg-[#eef2f7] text-[#475569]";
  if (item.status === "승인 대기") return "bg-[#fff1b8] text-[#8a5a00]";
  return "bg-[#e6f3ef] text-[#1f6b5b]";
}

function getCalendarCellTone(active: boolean, hasItems: boolean) {
  if (active) return "border-[#2f7866] bg-[#eef7f4] shadow-[inset_0_0_0_1px_#2f7866]";
  if (hasItems) return "border-[#dfe9e5] bg-[#fbfefd] hover:bg-[#f5fbf8]";
  return "border-[#eef2f7] bg-white hover:bg-[#fbfcfd]";
}

export default function GroomingManagementScreen() {
  const records = groomingRecords;
  const [selectedDate, setSelectedDate] = useState(currentDateInTimeZone());
  const [monthAnchor, setMonthAnchor] = useState(currentDateInTimeZone());
  const [query, setQuery] = useState("");
  const [notesOnly, setNotesOnly] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DayItem | null>(null);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      const haystack = [record.pet, record.customer, record.date, record.service, record.memo, record.next].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesNotes = !notesOnly || /민감|예민|요청|체크|주의|확인/.test(`${record.memo} ${record.next}`);
      return matchesQuery && matchesNotes;
    });
  }, [notesOnly, query, records]);

  const monthDates = useMemo(() => getMonthDates(monthAnchor), [monthAnchor]);
  const dayItemsByDate = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    for (const date of monthDates) {
      if (!date) continue;
      map.set(date, buildDayItems(filteredRecords, reservationDates, date));
    }
    return map;
  }, [filteredRecords, monthDates]);
  const selectedItems = dayItemsByDate.get(selectedDate) ?? [];

  function openDate(date: string) {
    setSelectedDate(date);
    setSelectedItem(null);
    setDateSheetOpen(true);
  }

  function openItem(item: DayItem) {
    setSelectedDate(item.date);
    setDateSheetOpen(false);
    setSelectedItem(item);
  }

  return (
    <div className="space-y-3">
      <ToolbarRow>
        <label className="flex h-10 min-w-[240px] flex-1 items-center gap-3 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[#64748b]">
          <Search className="h-4 w-4 text-[#94a3b8]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#94a3b8]"
            placeholder="반려동물명, 보호자명, 메모 검색"
          />
        </label>
        <button
          type="button"
          onClick={() => setNotesOnly((current) => !current)}
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center rounded-[8px] border px-3 text-[13px] transition",
            notesOnly
              ? "border-[#2f7866] bg-[#eef7f4] text-[#1f6b5b]"
              : "border-[#dbe2ea] bg-white text-[#334155] hover:bg-[#f8fafc]",
          )}
        >
          {notesOnly ? "전체 보기" : "주의사항"}
        </button>
      </ToolbarRow>

      <WebSurface className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthAnchor((current) => moveMonth(current, -1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[130px] text-center text-[18px] font-medium text-[#111827]">{formatMonthLabel(monthAnchor)}</p>
            <button
              type="button"
              onClick={() => setMonthAnchor((current) => moveMonth(current, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]"
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const today = currentDateInTimeZone();
                setSelectedDate(today);
                setMonthAnchor(today);
                setSelectedItem(null);
                setDateSheetOpen(true);
              }}
              className="ml-1 h-8 rounded-[8px] border border-[#dbe2ea] px-3 text-[13px] text-[#334155] hover:bg-[#f8fafc]"
            >
              오늘
            </button>
          </div>
          <p className="text-[13px] text-[#64748b]">날짜를 선택하면 오른쪽 시트에서 예약과 기록을 확인합니다.</p>
        </div>

        <div className="grid grid-cols-7 border-b border-[#e2e8f0] bg-[#f8fafc]">
          {weekdayLabels.map((label) => (
            <div key={label} className="px-3 py-2 text-center text-[15px] text-[#64748b]">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {monthDates.map((date, index) => {
            const items = date ? dayItemsByDate.get(date) ?? [] : [];
            const recordCount = items.filter((item) => item.type === "record").length;
            const reservationCount = items.filter((item) => item.type === "reservation").length;
            const active = date === selectedDate;
            const hiddenCount = Math.max(0, items.length - 2);
            const hasItems = items.length > 0;

            if (!date) {
              return <div key={`empty-${index}`} className="min-h-[124px] border-b border-r border-[#eef2f7] bg-[#fbfcfd]" />;
            }

            return (
              <button
                key={date}
                type="button"
                onClick={() => openDate(date)}
                className={cn(
                  "min-h-[124px] border-b border-r p-3 text-left transition",
                  getCalendarCellTone(active, hasItems),
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("text-[13px]", hasItems || active ? "text-[#111827]" : "text-[#94a3b8]")}>{Number(date.slice(-2))}</span>
                  {hasItems ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#1f6b5b] shadow-[0_0_0_1px_rgba(219,226,234,0.72)]">
                      {items.length}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {reservationCount > 0 ? (
                      <span className="rounded-full bg-[#e6f3ef] px-2 py-0.5 text-[11px] font-medium text-[#1f6b5b]">예약 {reservationCount}</span>
                    ) : null}
                    {recordCount > 0 ? (
                      <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[11px] font-medium text-[#475569]">기록 {recordCount}</span>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                  {items.slice(0, 2).map((item) => (
                    <span key={`${item.type}-${item.id}`} className="block truncate text-[12px] leading-5 text-[#111827]">
                      {item.pet} · {item.service}
                    </span>
                  ))}
                  {hiddenCount > 0 ? <span className="block text-[12px] text-[#64748b]">+{hiddenCount} 더보기</span> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </WebSurface>

      {dateSheetOpen && !selectedItem ? (
        <GroomingDateSheet
          date={selectedDate}
          items={selectedItems}
          onClose={() => setDateSheetOpen(false)}
          onSelectItem={openItem}
        />
      ) : null}
      {selectedItem ? <GroomingRecordSheet item={selectedItem} onClose={() => setSelectedItem(null)} /> : null}
    </div>
  );
}

function GroomingDateSheet({
  date,
  items,
  onClose,
  onSelectItem,
}: {
  date: string;
  items: DayItem[];
  onClose: () => void;
  onSelectItem: (item: DayItem) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-[430px] flex-col border-l border-[#dbe2ea] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#edf2f7] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.12em] text-[#94a3b8]">날짜 내역</p>
            <h3 className="mt-2 text-[24px] font-semibold text-[#111827]">{formatShortDate(date)}</h3>
            <p className="mt-1 text-[14px] text-[#64748b]">예약과 기록 {items.length}건</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className={cn("w-full rounded-[8px] border px-4 py-3 text-left transition hover:bg-[#f8fafc]", getRecordTone(item))}
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <p className="truncate text-[15px] font-semibold text-[#111827]">
                      {item.pet} · {item.customer}
                    </p>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", getBadgeTone(item))}>{item.type === "record" ? "기록" : item.status}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[13px] text-[#64748b]">
                    <span className="truncate">{item.service}</span>
                    {item.time ? <span className="shrink-0 tabular-nums">{item.time}</span> : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-[#475569]">{item.note || "메모가 없습니다."}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#dbe2ea] bg-[#f8fafc] px-4 py-8 text-center text-[13px] text-[#94a3b8]">
              이 날짜에는 예약이나 기록이 없습니다.
            </div>
          )}
        </div>

      </aside>
    </div>
  );
}

function GroomingRecordSheet({ item, onClose }: { item: DayItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-[430px] flex-col border-l border-[#dbe2ea] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#edf2f7] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.12em] text-[#94a3b8]">{item.type === "record" ? "기록 상세" : "예약 내역"}</p>
            <h3 className="mt-2 truncate text-[24px] font-semibold text-[#111827]">{item.pet} · {item.customer}</h3>
            <p className="mt-1 text-[14px] text-[#64748b]">{formatShortDate(item.date)}{item.time ? ` · ${item.time}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-2 gap-2">
            <InfoTile label="구분" value={item.type === "record" ? "기록" : "예약"} />
            <InfoTile label="상태" value={item.status} />
            <InfoTile label="서비스" value={item.service} />
            <InfoTile label="담당" value={item.staff ?? "미지정"} />
          </div>

          <section className="mt-5 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-4">
            <p className="text-[12px] font-semibold text-[#64748b]">{item.type === "record" ? "시술 메모" : "고객 요청"}</p>
            <p className="mt-2 text-[15px] leading-6 text-[#111827]">{item.note || "요청 내용이 없습니다."}</p>
          </section>

          {item.next ? (
            <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <p className="text-[12px] font-semibold text-[#64748b]">다음 체크</p>
              <p className="mt-2 text-[15px] leading-6 text-[#111827]">{item.next}</p>
            </section>
          ) : null}

          <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
            <p className="text-[12px] font-semibold text-[#64748b]">사진</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {["전", "후", "주의"].map((label) => (
                <div key={label} className="flex aspect-square items-center justify-center rounded-[8px] border border-dashed border-[#cfd8e3] bg-[#f8fafc] text-[13px] text-[#64748b]">
                  <Camera className="mr-1 h-4 w-4" />
                  {label}
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-3">
      <p className="text-[12px] text-[#94a3b8]">{label}</p>
      <p className="mt-1 truncate text-[15px] font-semibold text-[#111827]">{value}</p>
    </div>
  );
}
