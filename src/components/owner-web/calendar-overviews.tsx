"use client";

import { useMemo, useState } from "react";

import { cn, currentDateInTimeZone } from "@/lib/utils";

type OverviewBookingTone = "confirmed" | "active" | "pending" | "completed" | "changed" | "cancelled";

export type CalendarOverviewBooking = {
  id: string;
  dateKey?: string;
  start: number;
  duration: number;
  customer: string;
  pet: string;
  service: string;
  status: string;
  memo?: string;
};

export type ScheduleViewMode = "month" | "week" | "day";
export type MonthlyPanelFilter = "all" | "pending" | "confirmed" | "in_progress" | "almost_done" | "completed" | "changes" | "records";

type ScheduleDaySummary = {
  date: string;
  bookings: CalendarOverviewBooking[];
  counts: ReturnType<typeof getBookingCounts>;
};

const weekdayShortLabels = ["일", "월", "화", "수", "목", "금", "토"];
const todayScheduleDate = currentDateInTimeZone();

function parseScheduleDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatScheduleDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addScheduleDays(date: string, days: number) {
  const nextDate = parseScheduleDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return formatScheduleDateKey(nextDate);
}

export function addScheduleMonths(date: string, months: number) {
  const nextDate = parseScheduleDate(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return formatScheduleDateKey(nextDate);
}

export function addSchedulePeriod(date: string, mode: ScheduleViewMode, delta: number) {
  if (mode === "month") return addScheduleMonths(date, delta);
  if (mode === "week") return addScheduleDays(date, delta * 7);
  return addScheduleDays(date, delta);
}

export function getWeekScheduleDates(referenceDate = todayScheduleDate) {
  const date = parseScheduleDate(referenceDate);
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  return Array.from({ length: 7 }, (_, index) => addScheduleDays(referenceDate, mondayOffset + index));
}

export function getMonthScheduleDates(referenceDate = todayScheduleDate) {
  const date = parseScheduleDate(referenceDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingEmptyDays = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => formatScheduleDateKey(new Date(year, month, index + 1))),
  ];
  return dates.concat(Array.from({ length: (7 - (dates.length % 7)) % 7 }, () => null));
}

export function formatScheduleShortDate(date: string) {
  const parsed = parseScheduleDate(date);
  return `${parsed.getMonth() + 1}/${parsed.getDate()} ${weekdayShortLabels[parsed.getDay()]}`;
}

export function formatScheduleFullDateLabel(date = todayScheduleDate) {
  const parsed = parseScheduleDate(date);
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일 ${weekdayShortLabels[parsed.getDay()]}요일`;
}

export function getScheduleMonthLabel(referenceDate = todayScheduleDate) {
  const parsed = parseScheduleDate(referenceDate);
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월`;
}

export function getScheduleToolbarLabel(date: string, mode: ScheduleViewMode) {
  if (mode === "month") return getScheduleMonthLabel(date);
  if (mode === "week") {
    const weekDates = getWeekScheduleDates(date);
    return `${formatScheduleShortDate(weekDates[0])} - ${formatScheduleShortDate(weekDates[6])}`;
  }
  const parsed = parseScheduleDate(date);
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
}

function formatHourLabel(hour: number) {
  const fullHour = Math.floor(hour);
  const minute = Math.round((hour - fullHour) * 60);
  return `${String(fullHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isPendingBookingStatus(status: string) {
  return status === "승인 대기";
}

function isActiveBookingStatus(status: string) {
  return status === "진행 중" || status === "픽업 준비";
}

function isRescheduledBookingStatus(status: string) {
  return status === "변경";
}

function isChangeBookingStatus(status: string) {
  return isRescheduledBookingStatus(status) || status === "취소" || status === "거절" || status === "노쇼";
}

function getBookingCardTone(status: string): OverviewBookingTone {
  if (status === "완료") return "completed";
  if (isRescheduledBookingStatus(status)) return "changed";
  if (isChangeBookingStatus(status)) return "cancelled";
  if (isPendingBookingStatus(status)) return "pending";
  if (isActiveBookingStatus(status)) return "active";
  return "confirmed";
}

function getBookingCardToneClass(tone: OverviewBookingTone, selected: boolean) {
  if (tone === "pending") return cn("border-[#eee2c4] bg-white", selected && "border-[#e5cc72] ring-1 ring-[#f2c94c]/18");
  if (tone === "completed") return cn("border-[#e5e7eb] bg-white text-[#6b7280]", selected && "border-[#cbd5e1] ring-1 ring-[#94a3b8]/18");
  if (tone === "changed") return cn("border-[#f2d4b7] bg-white", selected && "border-[#db8a3a] ring-1 ring-[#f0a35a]/20");
  if (tone === "cancelled") return cn("border-[#ead6dc] bg-white", selected && "border-[#b45a6a] ring-1 ring-[#8f2438]/18");
  return cn("border-[#dce7e3] bg-white", selected && "border-[#b9d1ca] ring-1 ring-[#8ab9ab]/18");
}

function getBookingIndicatorClass(tone: OverviewBookingTone) {
  if (tone === "pending") return "bg-[#edbd3f]";
  if (tone === "completed") return "bg-[#d5dde6]";
  if (tone === "changed") return "bg-[#e68a2e]";
  if (tone === "cancelled") return "bg-[#8f2438]";
  return "bg-[#4f9b88]";
}

function getBookingTimeTextClass(tone: OverviewBookingTone) {
  if (tone === "pending") return "text-[#9f6f00]";
  if (tone === "completed") return "text-[#64748b]";
  if (tone === "changed") return "text-[#a75f12]";
  if (tone === "cancelled") return "text-[#8f2438]";
  return "text-[#1f6b5b]";
}

function getStatusLabel(status: string) {
  if (status === "승인 대기") return "대기";
  if (status === "진행 중") return "진행";
  if (status === "픽업 준비") return "픽업";
  if (isChangeBookingStatus(status)) return "취소변경";
  return status;
}

function getStatusBadgeClass(status: string) {
  if (status === "승인 대기") return "border-[#efd58e] bg-[#fff8db] text-[#9f6f00]";
  if (status === "진행 중") return "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]";
  if (status === "픽업 준비") return "border-[#bae6fd] bg-[#ecfeff] text-[#0e7490]";
  if (status === "완료") return "border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]";
  if (isChangeBookingStatus(status)) return "border-[#f1c5c5] bg-[#fff1f2] text-[#b42318]";
  return "border-[#b9d8cf] bg-[#eef7f4] text-[#1f6b5b]";
}

function matchesPanelFilter(booking: CalendarOverviewBooking, filter: MonthlyPanelFilter) {
  if (filter === "all") return true;
  if (filter === "pending") return booking.status === "승인 대기";
  if (filter === "confirmed") return booking.status === "확정";
  if (filter === "in_progress") return booking.status === "진행 중";
  if (filter === "almost_done") return booking.status === "픽업 준비";
  if (filter === "completed") return booking.status === "완료";
  if (filter === "changes") return isChangeBookingStatus(booking.status);
  return false;
}

function sortPanelBookings(bookings: CalendarOverviewBooking[]) {
  const priority = (booking: CalendarOverviewBooking) => {
    if (booking.status === "승인 대기") return 0;
    if (isChangeBookingStatus(booking.status)) return 1;
    return 2;
  };

  return [...bookings].sort((first, second) => priority(first) - priority(second) || first.start - second.start);
}

function getPreviewBookingsForBucket(bookings: CalendarOverviewBooking[], bucketIndex: number, bucketCount: number) {
  return bookings
    .filter((_, index) => index % bucketCount === bucketIndex)
    .sort((a, b) => a.start - b.start);
}

function getBookingsForDate(bookings: CalendarOverviewBooking[], date: string, bucketIndex: number, bucketCount: number) {
  const datedBookings = bookings.filter((booking) => booking.dateKey === date);
  if (datedBookings.length > 0) return datedBookings.sort((a, b) => a.start - b.start);
  if (bookings.some((booking) => booking.dateKey)) return [];
  return getPreviewBookingsForBucket(bookings, bucketIndex, bucketCount);
}

function getBookingCounts(bookings: CalendarOverviewBooking[]) {
  return {
    total: bookings.length,
    pending: bookings.filter((booking) => booking.status === "승인 대기").length,
    confirmed: bookings.filter((booking) => booking.status === "확정").length,
    inProgress: bookings.filter((booking) => booking.status === "진행 중").length,
    almostDone: bookings.filter((booking) => booking.status === "픽업 준비").length,
    changes: bookings.filter((booking) => isChangeBookingStatus(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === "완료").length,
    records: 0,
  };
}

function getLoadLabel(total: number) {
  if (total >= 7) return "많음";
  if (total >= 4) return "보통";
  if (total >= 1) return "여유";
  return "비어 있음";
}

function getLoadTone(total: number) {
  if (total >= 7) return "bg-[#1f6b5b]";
  if (total >= 4) return "bg-[#6fb09f]";
  if (total >= 1) return "bg-[#b9d8cf]";
  return "bg-[#e2e8f0]";
}

function getDaySummaries(bookings: CalendarOverviewBooking[], dates: string[]) {
  return dates.map((date, index) => {
    const dayBookings = getBookingsForDate(bookings, date, index, dates.length);
    return {
      date,
      bookings: dayBookings,
      counts: getBookingCounts(dayBookings),
    };
  });
}

function sumDayCounts(days: ScheduleDaySummary[]) {
  return days.reduce(
    (total, day) => ({
      total: total.total + day.counts.total,
      pending: total.pending + day.counts.pending,
      changes: total.changes + day.counts.changes,
      completed: total.completed + day.counts.completed,
    }),
    { total: 0, pending: 0, changes: 0, completed: 0 },
  );
}

function getBusiestDays(days: ScheduleDaySummary[], limit: number) {
  return [...days]
    .filter((day) => day.counts.total > 0)
    .sort((first, second) => second.counts.total - first.counts.total || first.date.localeCompare(second.date))
    .slice(0, limit);
}

function WeeklySummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[72px] rounded-[8px] border border-[#e2e8f0] bg-white px-3 py-2">
      <p className="text-[11px] text-[#64748b]">{label}</p>
      <p className="mt-1 text-[16px] font-semibold text-[#111827]">{value}</p>
    </div>
  );
}

function SmallCount({ label, value, tone }: { label: string; value: number; tone: "pending" | "change" | "done" }) {
  const toneClass =
    tone === "pending"
      ? "bg-[#fff7d6] text-[#9f6f00]"
      : tone === "change"
        ? "bg-[#fff1f1] text-[#b42318]"
        : "bg-[#e6f3ef] text-[#1f6b5b]";

  return (
    <div className={cn("rounded-[8px] px-2 py-1.5", toneClass)}>
      <p className="text-[11px]">{label}</p>
      <p className="text-[13px] font-semibold">{value}건</p>
    </div>
  );
}

export function WeeklyScheduleOverview({
  bookings,
  selectedDate,
  selectedBookingId,
  onSelectBooking,
}: {
  bookings: CalendarOverviewBooking[];
  selectedDate: string;
  selectedBookingId: string;
  onSelectBooking: (id: string) => void;
}) {
  const weekDates = getWeekScheduleDates(selectedDate);
  const daySummaries = getDaySummaries(bookings, weekDates);
  const weekCounts = sumDayCounts(daySummaries);
  const busiestDays = getBusiestDays(daySummaries, 2);

  return (
    <div className="bg-white p-4">
      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[18px] font-semibold text-[#111827]">이번 주 예약 흐름</p>
              <p className="mt-1 text-[13px] leading-5 text-[#64748b]">요일별 예약 밀도와 승인 대기, 변경/취소만 빠르게 확인합니다.</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <WeeklySummaryMetric label="예약" value={`${weekCounts.total}건`} />
              <WeeklySummaryMetric label="대기" value={`${weekCounts.pending}건`} />
              <WeeklySummaryMetric label="변경/취소" value={`${weekCounts.changes}건`} />
              <WeeklySummaryMetric label="완료" value={`${weekCounts.completed}건`} />
            </div>
          </div>
        </section>

        <section className="rounded-[8px] border border-[#e2e8f0] bg-white p-4">
          <p className="text-[13px] font-semibold text-[#111827]">이번 주 체크할 날짜</p>
          <div className="mt-3 space-y-2">
            {busiestDays.length > 0 ? (
              busiestDays.map((day) => (
                <div key={day.date} className="flex items-center justify-between rounded-[8px] bg-[#f8fafc] px-3 py-2">
                  <div>
                    <p className="text-[13px] font-medium text-[#111827]">{formatScheduleShortDate(day.date)}</p>
                    <p className="mt-0.5 text-[12px] text-[#64748b]">예약 {day.counts.total}건 · 대기 {day.counts.pending}건</p>
                  </div>
                  <span className={cn("h-2.5 w-2.5 rounded-full", getLoadTone(day.counts.total))} />
                </div>
              ))
            ) : (
              <p className="rounded-[8px] bg-[#f8fafc] px-3 py-3 text-[13px] text-[#94a3b8]">이번 주 예약이 없습니다.</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-2 xl:grid-cols-7">
        {daySummaries.map(({ date, bookings: dayBookings, counts }) => {
          const isToday = date === todayScheduleDate;
          const visibleBookings = dayBookings.slice(0, 3);

          return (
            <section
              key={date}
              className={cn("min-h-[260px] rounded-[8px] border bg-[#f8fafc] p-3", isToday ? "border-[#2f7866] ring-1 ring-[#2f7866]/15" : "border-[#e2e8f0]")}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-medium text-[#111827]">{formatScheduleShortDate(date)}</p>
                  <p className="mt-1 text-[12px] text-[#64748b]">{getLoadLabel(counts.total)} · 예약 {counts.total}건</p>
                </div>
                {isToday ? <span className="rounded-full bg-[#e6f3ef] px-2 py-1 text-[11px] text-[#1f6b5b]">오늘</span> : null}
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className={cn("h-full rounded-full", getLoadTone(counts.total))} style={{ width: `${Math.min(100, counts.total * 12)}%` }} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                <SmallCount label="대기" value={counts.pending} tone="pending" />
                <SmallCount label="변경" value={counts.changes} tone="change" />
                <SmallCount label="완료" value={counts.completed} tone="done" />
              </div>

              <div className="mt-3 space-y-2">
                {visibleBookings.map((booking) => (
                  <OverviewBookingButton
                    key={`${date}-${booking.id}`}
                    booking={booking}
                    selected={selectedBookingId === booking.id}
                    onSelectBooking={onSelectBooking}
                  />
                ))}
                {dayBookings.length > visibleBookings.length ? (
                  <div className="rounded-[8px] border border-dashed border-[#cfd8e3] bg-white/70 px-3 py-2 text-center text-[12px] text-[#64748b]">
                    +{dayBookings.length - visibleBookings.length}건 더 보기
                  </div>
                ) : null}
                {dayBookings.length === 0 ? (
                  <div className="rounded-[8px] border border-dashed border-[#dbe2ea] bg-white/70 px-3 py-6 text-center text-[12px] text-[#94a3b8]">
                    예약 없음
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function MonthlyScheduleOverview({
  bookings,
  selectedDate,
  onSelectDate,
  onSelectBooking,
  onOpenDayView,
  onAddSchedule,
}: {
  bookings: CalendarOverviewBooking[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectBooking: (id: string) => void;
  onOpenDayView: () => void;
  onAddSchedule: () => void;
}) {
  const [panelFilter, setPanelFilter] = useState<MonthlyPanelFilter>("all");
  const [recordsOpen, setRecordsOpen] = useState(false);
  const monthDates = getMonthScheduleDates(selectedDate);
  const realDates = monthDates.filter(Boolean) as string[];
  const daySummaries = getDaySummaries(bookings, realDates);
  const monthCounts = sumDayCounts(daySummaries);
  const selectedDay = daySummaries.find((day) => day.date === selectedDate) ?? daySummaries.find((day) => day.counts.total > 0) ?? daySummaries[0];
  const selectedCounts = selectedDay?.counts ?? getBookingCounts([]);
  const selectedDayBookings = selectedDay?.bookings ?? [];
  const filteredPanelBookings = useMemo(
    () => sortPanelBookings(selectedDayBookings.filter((booking) => matchesPanelFilter(booking, panelFilter))),
    [panelFilter, selectedDayBookings],
  );
  const filterOptions: Array<{ key: MonthlyPanelFilter; label: string; count: number }> = [
    { key: "all", label: "전체", count: selectedCounts.total },
    { key: "pending", label: "승인대기", count: selectedCounts.pending },
    { key: "confirmed", label: "확정", count: selectedCounts.confirmed },
    { key: "in_progress", label: "진행중", count: selectedCounts.inProgress },
    { key: "almost_done", label: "픽업준비", count: selectedCounts.almostDone },
    { key: "completed", label: "완료", count: selectedCounts.completed },
    { key: "changes", label: "취소변경", count: selectedCounts.changes },
    { key: "records", label: "기록", count: selectedCounts.records },
  ];

  return (
    <div className="grid min-h-[720px] bg-white xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="min-w-0 border-r border-[#e2e8f0]">
        <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
          <div>
            <p className="text-[18px] font-medium text-[#111827]">{getScheduleMonthLabel(selectedDate)}</p>
            <p className="mt-0.5 text-[12px] text-[#64748b]">월간 캘린더는 예약 밀도와 처리 필요 상태만 요약합니다.</p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#64748b]">
            <span>예약 {monthCounts.total}건</span>
            <span className="h-1 w-1 rounded-full bg-[#cbd5e1]" />
            <span>대기 {monthCounts.pending}건</span>
            <span className="h-1 w-1 rounded-full bg-[#cbd5e1]" />
            <span>취소변경 {monthCounts.changes}건</span>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-[#e2e8f0]">
          {weekdayShortLabels.map((label) => (
            <div key={label} className="bg-[#f8fafc] px-2 py-2 text-center text-[12px] text-[#64748b]">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {monthDates.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="min-h-[126px] border-b border-r border-[#eef2f7] bg-[#fbfcfd]" />;
            }

            const dateIndex = realDates.indexOf(date);
            const day = daySummaries[dateIndex];
            const counts = day.counts;
            const isToday = date === todayScheduleDate;
            const selected = date === selectedDate;
            const summaryMode = counts.total >= 6;
            const visibleBookings = day.bookings.slice(0, 2);

            return (
              <button
                key={date}
                type="button"
                onClick={() => onSelectDate(date)}
                className={cn(
                  "min-h-[126px] border-b border-r border-[#eef2f7] bg-white p-2 text-left transition hover:bg-[#f8fbfa]",
                  selected && "border-[#2f7866] bg-[#eef8f4] ring-1 ring-inset ring-[#2f7866]",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-[13px]", selected ? "font-semibold text-[#0f172a]" : "text-[#111827]")}>{Number(date.slice(-2))}</span>
                  {isToday ? <span className="rounded-full border border-[#dbe2ea] bg-white px-1.5 py-0.5 text-[10px] text-[#64748b]">오늘</span> : null}
                </div>

                <div className="mt-2 min-h-[78px] space-y-1.5">
                  {counts.total === 0 ? (
                    counts.records > 0 ? <p className="text-[11px] text-[#64748b]">기록 {counts.records}</p> : null
                  ) : summaryMode ? (
                    <div className="rounded-[8px] bg-[#f8fafc] px-2 py-2">
                      <p className="text-[12px] font-medium text-[#111827]">예약 {counts.total}건</p>
                      <p className="mt-1 text-[11px] text-[#64748b]">대기 {counts.pending} · 진행 {counts.inProgress}</p>
                      {counts.records > 0 ? <p className="mt-0.5 text-[11px] text-[#64748b]">기록 {counts.records}</p> : null}
                    </div>
                  ) : (
                    <>
                      {visibleBookings.map((booking) => (
                        <div key={`${date}-${booking.id}`} className={cn("truncate rounded-[6px] border px-1.5 py-1 text-[11px]", getStatusBadgeClass(booking.status))}>
                          <span className="tabular-nums">{formatHourLabel(booking.start)}</span> {booking.pet} · {getStatusLabel(booking.status)}
                        </div>
                      ))}
                      {counts.total > visibleBookings.length ? <p className="text-[11px] text-[#64748b]">+{counts.total - visibleBookings.length}건</p> : null}
                    </>
                  )}
                </div>

                {(counts.pending > 0 || counts.changes > 0 || counts.records > 0) ? (
                  <div className="mt-1 flex gap-1">
                    {counts.pending > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-[#edbd3f]" /> : null}
                    {counts.changes > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-[#b42318]" /> : null}
                    {counts.records > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-[#94a3b8]" /> : null}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="sticky top-0 flex max-h-[calc(100vh-92px)] min-w-0 flex-col bg-white">
        <div className="border-b border-[#e2e8f0] p-4">
          <p className="text-[22px] font-medium tracking-[-0.03em] text-[#111827]">{formatScheduleFullDateLabel(selectedDate)}</p>
          <p className="mt-2 text-[13px] text-[#64748b]">
            예약 {selectedCounts.total}건 / 승인대기 {selectedCounts.pending}건 / 진행중 {selectedCounts.inProgress}건 / 기록 {selectedCounts.records}건
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPanelFilter(option.key)}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-[12px] transition",
                  panelFilter === option.key ? "border-[#2f7866] bg-[#eef7f4] text-[#1f6b5b]" : "border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]",
                )}
              >
                {option.label} {option.count}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {panelFilter === "records" ? null : (
            <div className="space-y-2">
              {filteredPanelBookings.length > 0 ? (
                filteredPanelBookings.map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onSelectBooking(booking.id)}
                    className="w-full rounded-[8px] border border-[#dbe2ea] bg-white p-3 text-left transition hover:bg-[#f8fafc]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] tabular-nums text-[#111827]">{formatHourLabel(booking.start)}-{formatHourLabel(booking.start + booking.duration)}</span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", getStatusBadgeClass(booking.status))}>{getStatusLabel(booking.status)}</span>
                    </div>
                    <p className="mt-2 truncate text-[15px] font-medium text-[#111827]">{booking.pet} · {booking.customer}</p>
                    <p className="mt-1 truncate text-[13px] text-[#64748b]">{booking.service}{booking.memo ? ` · ${booking.memo}` : ""}</p>
                    {booking.status === "승인 대기" ? (
                      <span className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-[8px] bg-[#1f6b5b] text-[13px] font-medium text-white">
                        예약 확정
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="rounded-[8px] border border-dashed border-[#dbe2ea] bg-[#f8fafc] px-3 py-8 text-center text-[13px] text-[#94a3b8]">
                  표시할 예약이 없습니다.
                </div>
              )}
            </div>
          )}

          <section className="mt-4 rounded-[8px] border border-[#e2e8f0] bg-white">
            <button
              type="button"
              onClick={() => setRecordsOpen((current) => !current)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-medium text-[#111827]"
            >
              기록 {selectedCounts.records}건 <span className="text-[#94a3b8]">{recordsOpen ? "접기" : "펼치기"}</span>
            </button>
            {recordsOpen ? (
              <div className="border-t border-[#edf2f7] px-3 py-3 text-[13px] text-[#94a3b8]">
                작성된 기록이 없습니다.
              </div>
            ) : null}
          </section>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[#e2e8f0] bg-white p-4">
          <button type="button" onClick={onOpenDayView} className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium text-[#334155]">
            일간 상세 보기
          </button>
          <button type="button" onClick={onAddSchedule} className="h-10 rounded-[8px] bg-[#1f6b5b] text-[14px] font-medium text-white">
            예약 추가
          </button>
        </div>
      </aside>
    </div>
  );
}

function OverviewBookingButton({
  booking,
  selected,
  onSelectBooking,
}: {
  booking: CalendarOverviewBooking;
  selected: boolean;
  onSelectBooking: (id: string) => void;
}) {
  const tone = getBookingCardTone(booking.status);

  return (
    <button
      type="button"
      onClick={() => onSelectBooking(booking.id)}
      className={cn("relative w-full overflow-hidden rounded-[8px] border py-2 pl-4 pr-3 text-left transition", getBookingCardToneClass(tone, selected))}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
        <span className={cn("absolute bottom-0 left-0 top-0 w-1 rounded-l-[8px]", getBookingIndicatorClass(tone))} aria-hidden="true" />
        <p className="min-w-0 truncate text-[13px] font-medium text-[#111827]">{booking.pet} · {booking.customer}</p>
        <span className={cn("shrink-0 tabular-nums text-[11px]", getBookingTimeTextClass(tone))}>
          {formatHourLabel(booking.start)}-{formatHourLabel(booking.start + booking.duration)}
        </span>
        <p className="col-span-2 mt-0.5 truncate text-[12px] text-[#64748b]">{booking.service}</p>
      </div>
    </button>
  );
}
