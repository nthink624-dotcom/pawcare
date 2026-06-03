"use client";

import { getMiniWrapIndicatorClass, getWrapIndicatorClass, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { cn, currentDateInTimeZone } from "@/lib/utils";

type DailyBooking = {
  id: string;
  pet: string;
  customer: string;
  service: string;
  status: string;
  start: number;
  duration: number;
};

type BookingCardTone = "confirmed" | "active" | "pending" | "completed" | "changed" | "cancelled";

type ScheduleDaySummary = {
  date: string;
  bookings: DailyBooking[];
  counts: ReturnType<typeof getBookingCounts>;
};

const scheduleStartHour = 10;
const scheduleEndHour = 24;
const todayScheduleDate = currentDateInTimeZone();
const weekdayShortLabels = ["일", "월", "화", "수", "목", "금", "토"];

function formatHourLabel(hour: number) {
  const fullHour = Math.floor(hour);
  const minute = Math.round((hour - fullHour) * 60);
  return `${String(fullHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseScheduleDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatScheduleDateKey(date: Date) {
  return date.toLocaleDateString("en-CA");
}

function getWeekScheduleDates(referenceDate = todayScheduleDate) {
  const current = parseScheduleDate(referenceDate);
  const start = new Date(current);
  start.setDate(current.getDate() - current.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return formatScheduleDateKey(date);
  });
}

function getMonthScheduleDates(referenceDate = todayScheduleDate) {
  const current = parseScheduleDate(referenceDate);
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const dates: Array<string | null> = [];
  for (let index = 0; index < firstDay.getDay(); index += 1) dates.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    dates.push(formatScheduleDateKey(new Date(year, month, day)));
  }
  while (dates.length % 7 !== 0) dates.push(null);
  return dates;
}

function formatScheduleShortDate(date: string) {
  const parsed = parseScheduleDate(date);
  return `${parsed.getMonth() + 1}.${parsed.getDate()} ${weekdayShortLabels[parsed.getDay()]}`;
}

function getScheduleMonthLabel(referenceDate = todayScheduleDate) {
  const parsed = parseScheduleDate(referenceDate);
  return `${String(parsed.getFullYear()).slice(-2)}년 ${parsed.getMonth() + 1}월`;
}

function isPendingBookingStatus(status: string) {
  return status === "승인 대기" || status === "예약 요청";
}

function isCompletedBookingStatus(status: string) {
  return status === "완료";
}

function isChangeBookingStatus(status: string) {
  return status.includes("변경") || status.includes("취소");
}

function getBookingCardTone(status: string): BookingCardTone {
  if (isPendingBookingStatus(status)) return "pending";
  if (status === "진행 중" || status === "픽업 준비") return "active";
  if (isCompletedBookingStatus(status)) return "completed";
  if (isChangeBookingStatus(status)) return "changed";
  if (status === "취소" || status === "거절" || status === "노쇼") return "cancelled";
  return "confirmed";
}

function getBookingCardToneClass(tone: BookingCardTone, selected: boolean) {
  const base = "bg-white border-[#dbe2ea] hover:border-[#c5d0dc]";
  const selectedClass = selected ? "ring-1 ring-[#94a3b8]/35" : "";
  if (tone === "pending") return cn(base, "border-[#e7c980]", selectedClass);
  if (tone === "active") return cn(base, "border-[#a8cfc4]", selectedClass);
  if (tone === "completed") return cn(base, "border-[#d2d9e3]", selectedClass);
  if (tone === "changed") return cn(base, "border-[#e0b7c1]", selectedClass);
  if (tone === "cancelled") return cn(base, "border-[#e1bac3] opacity-80", selectedClass);
  return cn(base, selectedClass);
}

function getBookingIndicatorTone(tone: BookingCardTone): StatusIndicatorTone {
  if (tone === "pending") return "amber";
  if (tone === "changed" || tone === "cancelled") return "burgundy";
  if (tone === "completed") return "slate";
  if (tone === "active" || tone === "confirmed") return "teal";
  return "neutral";
}

function getBookingTimeTextClass(tone: BookingCardTone) {
  if (tone === "pending") return "text-[#9f6f00]";
  if (tone === "changed" || tone === "cancelled") return "text-[#8f2438]";
  if (tone === "completed") return "text-[#64748b]";
  return "text-[#1f6b5b]";
}

function getPreviewBookingsForBucket(bookings: DailyBooking[], bucketIndex: number, bucketCount: number) {
  return bookings.filter((_, index) => index % bucketCount === bucketIndex);
}

function getBookingCounts(bookings: DailyBooking[]) {
  return bookings.reduce(
    (counts, booking) => ({
      total: counts.total + 1,
      pending: counts.pending + (isPendingBookingStatus(booking.status) ? 1 : 0),
      changes: counts.changes + (isChangeBookingStatus(booking.status) ? 1 : 0),
      completed: counts.completed + (isCompletedBookingStatus(booking.status) ? 1 : 0),
    }),
    { total: 0, pending: 0, changes: 0, completed: 0 },
  );
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

function getDaySummaries(bookings: DailyBooking[], dates: string[]) {
  return dates.map((date, index) => {
    const dayBookings = getPreviewBookingsForBucket(bookings, index, dates.length);
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
        ? "bg-[#f8eef1] text-[#8f2438]"
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
  bookings: DailyBooking[];
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
              className={cn(
                "min-h-[260px] rounded-[8px] border bg-[#f8fafc] p-3",
                isToday ? "border-[#2f7866] ring-1 ring-[#2f7866]/15" : "border-[#e2e8f0]",
              )}
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
                  <button
                    key={`${date}-${booking.id}`}
                    type="button"
                    onClick={() => onSelectBooking(booking.id)}
                    className={cn(
                      "relative w-full overflow-hidden rounded-[8px] border py-2 pl-4 pr-3 text-left transition",
                      getBookingCardToneClass(getBookingCardTone(booking.status), selectedBookingId === booking.id),
                      getWrapIndicatorClass(getBookingIndicatorTone(getBookingCardTone(booking.status))),
                    )}
                  >
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
                      {(() => {
                        const tone = getBookingCardTone(booking.status);
                        return (
                          <>
                            <p className="min-w-0 truncate text-[13px] font-medium text-[#111827]">{booking.pet} · {booking.customer}</p>
                            <span className={cn("shrink-0 tabular-nums text-[11px]", getBookingTimeTextClass(tone))}>
                              {formatHourLabel(booking.start)}-{formatHourLabel(booking.start + booking.duration)}
                            </span>
                            <p className="col-span-2 mt-0.5 truncate text-[12px] text-[#64748b]">{booking.service}</p>
                          </>
                        );
                      })()}
                    </div>
                  </button>
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
  onSelectBooking,
}: {
  bookings: DailyBooking[];
  selectedDate: string;
  onSelectBooking: (id: string) => void;
}) {
  const monthDates = getMonthScheduleDates(selectedDate);
  const realDates = monthDates.filter(Boolean) as string[];
  const daySummaries = getDaySummaries(bookings, realDates);
  const monthCounts = sumDayCounts(daySummaries);
  const activeDayCount = daySummaries.filter((day) => day.counts.total > 0).length;
  const busiestDays = getBusiestDays(daySummaries, 3);

  return (
    <div className="bg-white p-4">
      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-[18px] font-medium text-[#111827]">{getScheduleMonthLabel(selectedDate)}</p>
          <p className="mt-1 text-[13px] text-[#64748b]">한 달 예약 밀도와 승인 대기, 변경/취소가 있는 날짜를 확인합니다.</p>
          <div className="mt-3 grid max-w-[520px] grid-cols-4 gap-2">
            <WeeklySummaryMetric label="예약" value={`${monthCounts.total}건`} />
            <WeeklySummaryMetric label="예약일" value={`${activeDayCount}일`} />
            <WeeklySummaryMetric label="대기" value={`${monthCounts.pending}건`} />
            <WeeklySummaryMetric label="변경" value={`${monthCounts.changes}건`} />
          </div>
        </div>

        <section className="rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
          <p className="text-[13px] font-semibold text-[#111827]">예약이 많은 날짜</p>
          <div className="mt-3 space-y-2">
            {busiestDays.length > 0 ? (
              busiestDays.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => day.bookings[0] && onSelectBooking(day.bookings[0].id)}
                  className="flex w-full items-center justify-between rounded-[8px] bg-white px-3 py-2 text-left transition hover:bg-[#eef7f4]"
                >
                  <div>
                    <p className="text-[13px] font-medium text-[#111827]">{formatScheduleShortDate(day.date)}</p>
                    <p className="mt-0.5 text-[12px] text-[#64748b]">예약 {day.counts.total}건 · 대기 {day.counts.pending}건</p>
                  </div>
                  <span className="text-[12px] font-semibold text-[#1f6b5b]">{getLoadLabel(day.counts.total)}</span>
                </button>
              ))
            ) : (
              <p className="rounded-[8px] bg-white px-3 py-3 text-[13px] text-[#94a3b8]">이번 달 예약이 없습니다.</p>
            )}
          </div>
        </section>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-[12px] text-[#64748b]">
        <span className="inline-flex items-center gap-1"><span className={getMiniWrapIndicatorClass("teal")} />예약 많음</span>
        <span className="inline-flex items-center gap-1"><span className={getMiniWrapIndicatorClass("neutral")} />예약 있음</span>
        <span className="inline-flex items-center gap-1"><span className={getMiniWrapIndicatorClass("amber")} />승인 대기</span>
        <span className="inline-flex items-center gap-1"><span className={getMiniWrapIndicatorClass("burgundy")} />변경/취소</span>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-[8px] border border-[#e2e8f0]">
        {weekdayShortLabels.map((label) => (
          <div key={label} className="border-b border-[#e2e8f0] bg-[#f8fafc] px-2 py-2 text-center text-[12px] text-[#64748b]">
            {label}
          </div>
        ))}
        {monthDates.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="min-h-[112px] border-b border-r border-[#eef2f7] bg-[#fbfcfd]" />;
          }

          const dateIndex = realDates.indexOf(date);
          const day = daySummaries[dateIndex];
          const counts = day.counts;
          const firstBooking = day.bookings[0];
          const isToday = date === todayScheduleDate;
          const densityClass = counts.total >= 7 ? "bg-[#dff0eb]" : counts.total >= 1 ? "bg-[#f5fbf8]" : "bg-white";

          return (
            <button
              key={date}
              type="button"
              onClick={() => firstBooking && onSelectBooking(firstBooking.id)}
              className={cn(
                "min-h-[112px] border-b border-r border-[#eef2f7] p-2 text-left transition hover:bg-[#eef7f4]",
                densityClass,
                isToday && "ring-2 ring-inset ring-[#2f7866]",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#111827]">{Number(date.slice(-2))}</span>
                {counts.total > 0 ? <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#1f6b5b]">{counts.total}건</span> : null}
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                <div className={cn("h-full rounded-full", getLoadTone(counts.total))} style={{ width: `${Math.min(100, counts.total * 12)}%` }} />
              </div>

              <div className="mt-3 space-y-1">
                {counts.total > 0 ? <p className="truncate text-[12px] font-medium text-[#111827]">{getLoadLabel(counts.total)}</p> : null}
                {counts.pending > 0 ? <p className="truncate text-[11px] text-[#9f6f00]">승인 대기 {counts.pending}건</p> : null}
                {counts.changes > 0 ? <p className="truncate text-[11px] text-[#8f2438]">변경/취소 {counts.changes}건</p> : null}
              </div>
              <div className="mt-3 flex gap-1">
                {counts.pending > 0 ? <span className={getMiniWrapIndicatorClass("amber")} /> : null}
                {counts.changes > 0 ? <span className={getMiniWrapIndicatorClass("burgundy")} /> : null}
                {counts.completed > 0 ? <span className={getMiniWrapIndicatorClass("slate")} /> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
