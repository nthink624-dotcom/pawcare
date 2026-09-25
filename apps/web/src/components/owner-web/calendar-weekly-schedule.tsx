"use client";

import { cn } from "@/lib/utils";

export type WeeklyScheduleBooking = {
  id: string;
  pet: string;
  customer: string;
  service: string;
  status: string;
  start: number;
  duration: number;
  staffKey: string;
  staffName: string;
  appointmentDate: string;
};

type ScheduleViewStaff = "전체 직원" | string;

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const pixelsPerHour = 86.4;
const timeRailWidth = 72;
const scheduleBodyInsetY = 7;
const quarterSlotHeight = pixelsPerHour / 4;

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatDayHeading(date: string) {
  const parsed = parseDate(date);
  return {
    day: parsed.getDate(),
    weekday: weekdayLabels[parsed.getDay()] ?? "",
  };
}

function formatHour(hour: number) {
  const fullHour = Math.floor(hour);
  const minute = Math.round((hour - fullHour) * 60);
  return `${String(fullHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getHourTop(hour: number, startHour: number) {
  return scheduleBodyInsetY + (hour - startHour) * pixelsPerHour;
}

function renderScheduleLines(startHour: number, endHour: number, prefix: string) {
  const segmentCount = Math.max(0, Math.round((endHour - startHour) * 4));
  return Array.from({ length: segmentCount + 1 }).map((_, index) => (
    <div
      key={`${prefix}-line-${index}`}
      className={cn(
        "absolute left-0 right-0 border-t",
        index % 4 === 0 ? "border-[#f1f4f7]" : "border-[#f8fafc]",
      )}
      style={{ top: scheduleBodyInsetY + index * quarterSlotHeight }}
    />
  ));
}

function getWeekHours(bookings: WeeklyScheduleBooking[]) {
  const earliest = bookings.length > 0 ? Math.floor(Math.min(...bookings.map((booking) => booking.start))) : 9;
  const latest = bookings.length > 0
    ? Math.ceil(Math.max(...bookings.map((booking) => booking.start + booking.duration)))
    : 19;

  const startHour = Math.max(0, Math.min(9, earliest));
  const endHour = Math.min(24, Math.max(19, latest));
  return Array.from({ length: Math.max(1, endHour - startHour) + 1 }, (_, index) => startHour + index);
}

function getBookingToneClass(booking: Pick<WeeklyScheduleBooking, "service" | "status">) {
  const service = booking.service.replaceAll(" ", "");
  if (service.includes("목욕")) return "border-[#b9dfc5] bg-[#e6f4ea]";
  if (service.includes("위생")) return "border-[#d5c2ef] bg-[#eee7fa]";
  if (/(부분|발톱|발바닥|얼굴|귀|항문낭)/.test(service)) return "border-[#f0c8a8] bg-[#fce8d8]";
  if (/(미용|가위|클리핑)/.test(service)) return "border-[#b9d6f5] bg-[#e5f0ff]";
  return "border-[#d4dce6] bg-[#f1f4f7]";
}

function getStatusTextClass(status: string) {
  if (status === "진행 중") return "text-[#2563eb]";
  if (status === "픽업 준비") return "text-[#7c3aed]";
  if (status === "완료") return "text-[#64748b]";
  if (status.includes("변경") || status.includes("확인 필요")) return "text-[#a46710]";
  if (status.includes("취소") || status.includes("거절") || status.includes("노쇼")) return "text-[#a04455]";
  return "text-[#24784b]";
}

function sortBookings(bookings: WeeklyScheduleBooking[]) {
  return [...bookings].sort(
    (first, second) => first.start - second.start || first.staffName.localeCompare(second.staffName) || first.id.localeCompare(second.id),
  );
}

type WeekBookingLayout = { lane: number; laneCount: number };

function getDayBookingLayouts(bookings: WeeklyScheduleBooking[]) {
  const sortedBookings = sortBookings(bookings);
  const placed = new Map<string, { lane: number }>();
  const activeBookings: Array<{ end: number; lane: number }> = [];
  let laneCount = 1;

  sortedBookings.forEach((booking) => {
    for (let index = activeBookings.length - 1; index >= 0; index -= 1) {
      if (activeBookings[index].end <= booking.start) activeBookings.splice(index, 1);
    }

    const occupiedLanes = new Set(activeBookings.map((activeBooking) => activeBooking.lane));
    let lane = 0;
    while (occupiedLanes.has(lane)) lane += 1;

    activeBookings.push({ end: booking.start + booking.duration, lane });
    placed.set(booking.id, { lane });
    laneCount = Math.max(laneCount, lane + 1);
  });

  return new Map<string, WeekBookingLayout>(
    sortedBookings.map((booking) => [booking.id, { lane: placed.get(booking.id)?.lane ?? 0, laneCount }]),
  );
}

function getBookingLaneStyle(layout: WeekBookingLayout) {
  const laneWidth = 100 / layout.laneCount;
  const laneGap = 4;
  const outerInset = 6;

  return {
    left: `calc(${layout.lane * laneWidth}% + ${outerInset + layout.lane * laneGap}px)`,
    width: `calc(${laneWidth}% - ${outerInset * 2 + (layout.laneCount - 1) * laneGap}px)`,
  };
}

function WeeklyDayHeader({
  date,
  selectedDate,
  onOpenDay,
  sticky = false,
}: {
  date: string;
  selectedDate: string;
  onOpenDay: (date: string) => void;
  sticky?: boolean;
}) {
  const heading = formatDayHeading(date);
  const selected = date === selectedDate;

  return (
    <button
      type="button"
      onClick={() => onOpenDay(date)}
      className={cn(
        "flex h-[54px] min-h-[54px] flex-col items-center justify-center border-b px-2 text-center outline-none transition hover:bg-[#f8fbff] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1677ff]/60",
        sticky && "sticky top-0 z-20",
        selected ? "border-b-[#1677ff] bg-[#eff6ff] text-[#1677ff]" : "border-b-[#e8edf3] bg-white text-[#334155]",
      )}
      aria-label={`${heading.day}일 ${heading.weekday}요일 일간 보기`}
    >
      <span className="text-[11px] leading-4">{heading.weekday}</span>
      <span className="text-[18px] font-semibold leading-5 tabular-nums">{heading.day}</span>
    </button>
  );
}

function WeekBookingCard({
  booking,
  compact = false,
  showStaff = false,
  onClick,
}: {
  booking: WeeklyScheduleBooking;
  compact?: boolean;
  showStaff?: boolean;
  onClick: () => void;
}) {
  const timeLabel = `${formatHour(booking.start)}-${formatHour(booking.start + booking.duration)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-full w-full overflow-hidden rounded-[6px] border text-left outline-none transition hover:brightness-[0.985] focus-visible:ring-2 focus-visible:ring-[#1677ff]/70 focus-visible:ring-offset-1",
        compact ? "px-2 py-1.5" : "px-2.5 py-2",
        getBookingToneClass(booking),
      )}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5">
        <p className={cn("min-w-0 truncate font-semibold text-[#263445]", compact ? "text-[10px] leading-[13px]" : "text-[12px] leading-4")}>
          {booking.pet} · {booking.customer}
        </p>
        <span className={cn("shrink-0 tabular-nums text-[#41546a]", compact ? "text-[9px] leading-[13px]" : "text-[10px] leading-4")}>
          {timeLabel}
        </span>
        <p className={cn("col-span-2 min-w-0 truncate", compact ? "text-[9px] leading-[12px]" : "mt-0.5 text-[10px] leading-[14px]", getStatusTextClass(booking.status))}>
          {booking.status} · {booking.service}
        </p>
        {showStaff ? (
          <p className={cn("col-span-2 min-w-0 truncate text-[#56687b]", compact ? "text-[9px] leading-[12px]" : "text-[10px] leading-[14px]")}>
            담당 {booking.staffName}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function IndividualWeeklyTimeline({
  bookings,
  weekDates,
  selectedDate,
  showStaff = false,
  onOpenDay,
  onSelectBooking,
}: {
  bookings: WeeklyScheduleBooking[];
  weekDates: string[];
  selectedDate: string;
  showStaff?: boolean;
  onOpenDay: (date: string) => void;
  onSelectBooking: (booking: WeeklyScheduleBooking) => void;
}) {
  const hours = getWeekHours(bookings);
  const startHour = hours[0] ?? 9;
  const endHour = hours[hours.length - 1] ?? 19;
  const bodyHeight = Math.max(520, (endHour - startHour) * pixelsPerHour + scheduleBodyInsetY * 2);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      <div className="min-w-[840px]" style={{ display: "grid", gridTemplateColumns: `${timeRailWidth}px repeat(${weekDates.length}, minmax(0, 1fr))` }}>
        <div className="sticky left-0 top-0 z-30 flex h-[54px] items-center justify-center border-b border-r border-[#f0f3f6] bg-[#fcfdff] text-[12px] text-[#64748b]">
          시간
        </div>
        {weekDates.map((date) => (
          <WeeklyDayHeader key={date} date={date} selectedDate={selectedDate} onOpenDay={onOpenDay} sticky />
        ))}

        <div className="sticky left-0 z-10 w-[72px] border border-l-0 border-t-0 border-[#f0f3f6] bg-[#fcfdff]">
          <div className="relative" style={{ height: bodyHeight }}>
            {renderScheduleLines(startHour, endHour, "time-rail")}
          {hours.slice(0, -1).map((hour) => (
            <div
              key={hour}
              className="absolute inset-x-0 flex items-center gap-1 text-[12px] leading-none text-[#64748b]"
              style={{ top: getHourTop(hour, startHour), transform: "translateY(-50%)" }}
            >
              <span className="h-px flex-1 bg-[#f0f2f4]" aria-hidden="true" />
              <span className="shrink-0 bg-[#fcfdff] px-1">{formatHour(hour)}</span>
              <span className="h-px flex-1 bg-[#f0f2f4]" aria-hidden="true" />
            </div>
          ))}
          </div>
        </div>

        {weekDates.map((date) => {
          const dayBookings = sortBookings(bookings.filter((booking) => booking.appointmentDate === date));
          const bookingLayouts = getDayBookingLayouts(dayBookings);
          return (
            <div key={date} className="relative border-r border-[#edf1f5] bg-white" style={{ height: bodyHeight }}>
              {renderScheduleLines(startHour, endHour, `day-${date}`)}
              {dayBookings.length === 0 ? (
                <p className="absolute inset-x-2 text-center text-[11px] text-[#a0acb9]" style={{ top: getHourTop(startHour, startHour) + 24 }}>
                  예약 없음
                </p>
              ) : null}
              {dayBookings.map((booking) => {
                const top = Math.max(scheduleBodyInsetY + 3, getHourTop(booking.start, startHour) + 3);
                const height = Math.max(38, booking.duration * pixelsPerHour - 6);
                const bookingLayout = bookingLayouts.get(booking.id) ?? { lane: 0, laneCount: 1 };
                return (
                  <div key={booking.id} className="absolute" style={{ ...getBookingLaneStyle(bookingLayout), top, height }}>
                    <WeekBookingCard booking={booking} compact showStaff={showStaff} onClick={() => onSelectBooking(booking)} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AllStaffWeeklyOverview({
  bookings,
  weekDates,
  selectedDate,
  onOpenDay,
  onSelectBooking,
}: {
  bookings: WeeklyScheduleBooking[];
  weekDates: string[];
  selectedDate: string;
  onOpenDay: (date: string) => void;
  onSelectBooking: (booking: WeeklyScheduleBooking) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#eef2f6] px-3 py-2.5">
        <p className="text-[13px] text-[#64748b]">날짜를 누르면 해당 일자의 스태프별 일간 보드로 이동합니다.</p>
        <span className="shrink-0 text-[12px] text-[#2563eb]">전체 직원 주간 현황</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-3">
        <div
          className="grid min-h-full min-w-0 gap-3"
          style={{ gridTemplateColumns: `repeat(${weekDates.length}, minmax(0, 1fr))` }}
        >
          {weekDates.map((date) => {
            const dayBookings = bookings
              .filter((booking) => booking.appointmentDate === date)
              .sort((left, right) => left.start - right.start || left.staffName.localeCompare(right.staffName));
            const isSelected = date === selectedDate;

            return (
              <section
                key={date}
                className={`flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white ${
                  isSelected ? "border-[#93c5fd] shadow-[0_4px_12px_rgba(37,99,235,0.08)]" : "border-[#e2e8f0]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpenDay(date)}
                  className={`flex items-center justify-between border-b px-4 py-3 text-left transition-colors hover:bg-[#f8fafc] ${
                    isSelected ? "border-[#bfdbfe] bg-[#eff6ff]" : "border-[#eef2f6]"
                  }`}
                >
                  <span>
                    <span className="block text-[12px] font-medium text-[#64748b]">{weekdayLabels[parseDate(date).getDay()]}</span>
                    <span className="mt-0.5 block text-[21px] font-bold leading-none text-[#17233a]">{parseDate(date).getDate()}</span>
                  </span>
                  <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-[12px] font-medium text-[#52627a]">
                    {dayBookings.length}건
                  </span>
                </button>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                  {dayBookings.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onOpenDay(date)}
                      className="flex min-h-28 w-full items-center justify-center rounded-lg border border-dashed border-[#dbe4ee] text-[13px] text-[#94a3b8] transition-colors hover:border-[#93c5fd] hover:bg-[#f8fbff]"
                    >
                      예약 없음
                    </button>
                  ) : (
                    dayBookings.map((booking) => {
                      const endMinutes = booking.start + booking.duration;
                      const toneClass = getBookingToneClass(booking);

                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => onSelectBooking(booking)}
                          className={`w-full rounded-lg border border-l-[3px] px-3 py-2.5 text-left transition-transform hover:-translate-y-0.5 hover:shadow-sm ${toneClass}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 truncate text-[14px] font-semibold text-[#17233a]">
                              {booking.pet} · {booking.customer}
                            </span>
                            <span className="shrink-0 text-[11px] font-medium text-[#475569]">
                              {formatHour(booking.start)}–{formatHour(endMinutes)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[12px] text-[#52627a]">{booking.service}</p>
                          <p className={`mt-1 text-[11px] font-medium ${getStatusTextClass(booking.status)}`}>
                            {booking.status} · 담당 {booking.staffName}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function WeeklySchedule({
  bookings,
  weekDates,
  selectedDate,
  staff,
  onOpenDay,
  onSelectBooking,
}: {
  bookings: WeeklyScheduleBooking[];
  weekDates: string[];
  selectedDate: string;
  staff: ScheduleViewStaff;
  onOpenDay: (date: string) => void;
  onSelectBooking: (booking: WeeklyScheduleBooking) => void;
}) {
  const weekBookingSet = new Set(weekDates);
  const visibleBookings = bookings.filter((booking) => weekBookingSet.has(booking.appointmentDate));

  return staff === "전체 직원" ? (
    <AllStaffWeeklyOverview
      bookings={visibleBookings}
      weekDates={weekDates}
      selectedDate={selectedDate}
      onOpenDay={onOpenDay}
      onSelectBooking={onSelectBooking}
    />
  ) : (
    <IndividualWeeklyTimeline
      bookings={visibleBookings}
      weekDates={weekDates}
      selectedDate={selectedDate}
      onOpenDay={onOpenDay}
      onSelectBooking={onSelectBooking}
    />
  );
}
