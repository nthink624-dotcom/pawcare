"use client";

import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NotebookPen, Scissors } from "lucide-react";

import {
  buildScheduleStaffLaneColumns,
  getScheduleLaneActiveStaff,
  type ScheduleStaffLaneColumn,
} from "@/components/owner-web/calendar-staff-lane-columns";
import { CalendarStaffLaneHeader } from "@/components/owner-web/calendar-staff-lane-header";
import { CalendarTimeRail, CalendarTimeRailHeader } from "@/components/owner-web/calendar-time-rail";
import type { OwnerWebStaffColumn, OwnerWebStaffMember } from "@/components/owner-web/owner-web-staff-data";
import { getStaffChipTone } from "@/lib/staff-chip-colors";
import { cn, currentDateInTimeZone } from "@/lib/utils";
import type { StaffScheduleOverride } from "@/types/domain";

type SummaryMetricKey = "today" | "completed" | "changes";
type StaffKey = string;
type StaffFilter = "전체 직원" | StaffKey;
type BoardPanState = {
  pointerId: number;
  startX: number;
  scrollLeft: number;
  moved: boolean;
};
type BookingResizeState = {
  bookingId: string;
  pointerId: number;
  startY: number;
  initialDuration: number;
  nextDuration: number;
};
type ScheduleDisplaySegment = {
  key: "business";
  start: number;
  end: number;
  top: number;
  height: number;
};
type ScheduleDisplayLayout = {
  segments: ScheduleDisplaySegment[];
  bodyHeight: number;
};
type DailyBooking = {
  id: string;
  pet: string;
  customer: string;
  service: string;
  petId?: string;
  status: string;
  sourceStatus?: string;
  start: number;
  duration: number;
  memo?: string;
  customerMemo?: string;
  petPhotoUrl?: string | null;
  staffKey: StaffKey;
  actualTimeLabel?: string;
  scheduledTimeLabel?: string;
  staleGroomingSession?: boolean;
  displayMode?: "reservation-chip";
  sourceAppointmentId?: string;
};

const scheduleStartHour = 0;
const scheduleEndHour = 24;
const pixelsPerHour = 112;
const minimumBookingCardHitTarget = 44;
const scheduleBodyInsetY = 7;
const quarterSlotHeight = pixelsPerHour / 4;
const scheduleSnapSegmentsPerHour = 4;
const bookingCardWidth = "96%";
const bookingCardHorizontalInset = "2%";
const detailedBookingMinimumDuration = 1;

function BookingChipContent({ booking, timeLabel, statusLabel, statusPillClass, height, pendingOverlapLabel }: {
  booking: DailyBooking;
  timeLabel: string;
  statusLabel: string;
  statusPillClass: string;
  height: number;
  pendingOverlapLabel?: string;
}) {
  const singleLine = height < 64;
  const service = booking.service || "서비스 미지정";
  const noteParts = [
    booking.customerMemo?.trim() ? `고객 메모 · ${booking.customerMemo.trim()}` : "",
    booking.memo?.trim() ? `예약 메모 · ${booking.memo.trim()}` : "",
  ].filter(Boolean);
  const memo = noteParts.join(" / ");
  if (singleLine) return (
    <span className="@container/chip flex h-full w-full min-w-0 items-center gap-2 px-3 text-[16px] font-normal leading-6 text-[#334155]">
      <span data-booking-content="identity" className="max-w-[25%] min-w-0 shrink-0 truncate font-medium text-[#17243c]">{booking.pet}</span>
      <span data-booking-content="service" className="min-w-0 flex-1 truncate" title={service}>{service}</span>
      <span data-booking-content="time" title={timeLabel} className="shrink-0 whitespace-nowrap tabular-nums text-[#526174]"><span className="@[300px]/chip:hidden">{timeLabel.split("-")[0]}</span><span className="hidden @[300px]/chip:inline">{timeLabel}</span></span>
      <span data-booking-status="true" className={cn("hidden shrink-0 rounded-full border px-2 text-[14px] font-medium leading-5 @[300px]/chip:inline", statusPillClass)}>{statusLabel}</span>
    </span>
  );
  return (
    <span className={cn("@container/chip flex h-full w-full min-w-0 flex-col gap-1 px-3 text-[16px] font-normal leading-6 text-[#334155]", height >= 100 ? "pb-3.5 pt-2.5" : "py-2")}>
      <span className="flex min-w-0 flex-col gap-0.5 @[300px]/chip:hidden">
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span data-booking-content="identity" title={[booking.pet, booking.customer].filter(Boolean).join(" · ")} className="min-w-0 truncate font-medium text-[#17243c]">{booking.pet}</span>
          {height >= 100 ? <span data-booking-status="true" className={cn("shrink-0 rounded-full border px-2 text-[14px] font-medium leading-5", statusPillClass)}>{statusLabel}</span> : <span data-booking-content="time" title={timeLabel} className="shrink-0 whitespace-nowrap tabular-nums text-[#526174]">{timeLabel.split("-")[0]}</span>}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span data-booking-content="service" title={service} className="min-w-0 flex-1 truncate text-[#526174]">{service}</span>
          {height < 100 ? <span data-booking-status="true" className={cn("shrink-0 rounded-full border px-2 text-[14px] font-medium leading-5", statusPillClass)}>{statusLabel}</span> : null}
        </span>
        {height >= 100 ? <span data-booking-content="time" className="whitespace-nowrap tabular-nums text-[#526174]">{timeLabel}</span> : null}
      </span>
      <span className="hidden min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 @[300px]/chip:grid">
        <span className="flex min-w-0 items-center gap-2.5">
          {height >= 100 ? (
            <span data-booking-avatar="true" className="hidden size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/80 bg-white/80 @[300px]/chip:inline-flex">
              <img src={booking.petPhotoUrl || "/images/default-pet-profile.png"} alt="" draggable={false} loading="lazy" className={cn("size-full", booking.petPhotoUrl ? "object-cover" : "object-contain")} onError={(event) => { if (!event.currentTarget.src.endsWith("/images/default-pet-profile.png")) event.currentTarget.src = "/images/default-pet-profile.png"; }} />
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span data-booking-content="identity" className="flex min-w-0 items-baseline gap-1.5" title={[booking.pet, booking.customer].filter(Boolean).join(" · ")}>
              <span className="min-w-0 truncate font-medium text-[#17243c]">{booking.pet}</span>
              {booking.customer ? <span className="hidden min-w-0 truncate text-[#64748b] @[380px]/chip:inline">· {booking.customer}</span> : null}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[#526174]">
              <Scissors aria-hidden="true" className="hidden size-4 shrink-0 @[300px]/chip:block" />
              <span data-booking-content="service" className="min-w-0 truncate" title={service}>{service}</span>
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span data-booking-content="time" className="whitespace-nowrap font-medium tabular-nums text-[#526174]">{timeLabel}</span>
          <span data-booking-status="true" className={cn("rounded-full border px-2 text-[14px] font-medium leading-5", statusPillClass)}>{statusLabel}</span>
        </span>
      </span>
      {pendingOverlapLabel ? <span className="truncate text-[14px] leading-5 text-[#a46710]">{pendingOverlapLabel}</span> : null}
      {height >= 100 && memo ? (
        <span className={cn("min-w-0 items-start gap-2 text-[#64748b]", height >= 140 ? "mt-auto flex" : "hidden @[300px]/chip:flex") }>
          <NotebookPen aria-hidden="true" className="mt-1 size-4 shrink-0" />
          <span data-booking-content="memo" data-booking-request-note="present" title={memo} className={cn("min-w-0", height >= 180 ? "line-clamp-2" : height >= 140 ? "truncate @[300px]/chip:line-clamp-2 @[300px]/chip:whitespace-normal" : "truncate")}>{memo}</span>
        </span>
      ) : null}
    </span>
  );
}

function formatHourLabel(hour: number) {
  const fullHour = Math.floor(hour);
  const minute = Math.round((hour - fullHour) * 60);
  return `${String(fullHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isActiveBookingStatus(status: string) {
  return status === "진행 중" || status === "픽업 준비";
}

function isPendingBookingStatus(status: string) {
  return false;
}

function isOverduePendingBookingStatus(status: string) {
  return false;
}

function isCompletedBookingStatus(status: string) {
  return status === "완료";
}

function isRescheduledBookingStatus(status: string) {
  return status.includes("변경");
}

function isChangeBookingStatus(status: string) {
  return status.includes("변경") || status.includes("취소") || status.includes("거절") || status.includes("노쇼");
}

function getTimedBookingStatus(booking: DailyBooking, selectedDate: string, currentHour: number) {
  const today = currentDateInTimeZone();
  if (booking.staleGroomingSession && isActiveBookingStatus(booking.status)) return "완료 확인 필요";
  if (booking.status === "확정") {
    if (selectedDate < today) return "방문 확인 필요";
    if (selectedDate === today && currentHour >= booking.start) return "방문 확인 필요";
    return booking.status;
  }
  if (booking.status === "진행 중") {
    if (selectedDate < today) return "완료 확인 필요";
    if (selectedDate === today && currentHour >= booking.start + booking.duration) return "완료 확인 필요";
  }
  return booking.status;
}

function getReservationStatusLabel(booking: DailyBooking, selectedDate: string, currentHour: number) {
  const status = getTimedBookingStatus(booking, selectedDate, currentHour);
  if (status === "방문 확인 필요") return "방문 확인";
  if (status === "완료 확인 필요") return "완료 확인";
  if (isOverduePendingBookingStatus(status)) return "누락";
  return status;
}

function getReservationStatusPillClass(booking: DailyBooking, selectedDate: string, currentHour: number) {
  const status = getTimedBookingStatus(booking, selectedDate, currentHour);
  if (isOverduePendingBookingStatus(status)) return "border-[#ead6dc] bg-white/70 text-[#a04455]";
  if (status === "방문 확인 필요" || status === "완료 확인 필요") return "border-[#ead9b8] bg-white/70 text-[#8a5b11]";
  if (status === "확정") return "border-[#cfe3d7] bg-white/70 text-[#24784b]";
  if (status === "진행 중") return "border-[#cdddf7] bg-white/70 text-[#2563eb]";
  if (status === "픽업 준비") return "border-[#ddd3f1] bg-white/70 text-[#6d50a0]";
  if (status === "완료") return "border-[#d9e0e7] bg-white/70 text-[#64748b]";
  if (status.includes("변경")) return "border-[#ead9b8] bg-white/70 text-[#8a5b11]";
  if (status.includes("취소") || status.includes("거절") || status.includes("노쇼")) return "border-[#ead6dc] bg-white/70 text-[#a04455]";
  return "border-[#dfe5ec] bg-white/70 text-[#475569]";
}

function getScheduleDisplayLayout(operatingWindow: { enabled: boolean; openHour: number; closeHour: number }): ScheduleDisplayLayout {
  const segments: ScheduleDisplaySegment[] = [];
  let nextTop = scheduleBodyInsetY;
  const pushSegment = (segment: Omit<ScheduleDisplaySegment, "top" | "height">) => {
    const height = Math.max(pixelsPerHour, (segment.end - segment.start) * pixelsPerHour);
    segments.push({ ...segment, top: nextTop, height });
    nextTop += height;
  };

  if (!operatingWindow.enabled) {
    pushSegment({
      key: "business",
      start: scheduleStartHour,
      end: scheduleEndHour,
    });

    return { segments, bodyHeight: nextTop + scheduleBodyInsetY };
  }

  const openHour = Math.max(scheduleStartHour, Math.min(scheduleEndHour, operatingWindow.openHour));
  const closeHour = Math.max(scheduleStartHour, Math.min(scheduleEndHour, operatingWindow.closeHour));
  const normalizedOpen = Math.min(openHour, closeHour);
  const normalizedClose = Math.max(openHour, closeHour);

  pushSegment({
    key: "business",
    start: normalizedOpen,
    end: normalizedClose > normalizedOpen ? normalizedClose : Math.min(scheduleEndHour, normalizedOpen + 1),
  });

  return { segments, bodyHeight: nextTop + scheduleBodyInsetY };
}

function getHourTop(hour: number, layout: ScheduleDisplayLayout) {
  const clampedHour = Math.max(scheduleStartHour, Math.min(scheduleEndHour, hour));
  const segment =
    layout.segments.find((item) => clampedHour >= item.start && (clampedHour < item.end || (item.end === scheduleEndHour && clampedHour === item.end))) ??
    layout.segments[layout.segments.length - 1];
  if (!segment) return scheduleBodyInsetY;

  const segmentHour = Math.max(segment.start, Math.min(segment.end, clampedHour));
  return segment.top + (segmentHour - segment.start) * pixelsPerHour;
}

function getHourFromTop(pointerY: number, columnTop: number, layout: ScheduleDisplayLayout) {
  const y = Math.max(scheduleBodyInsetY, Math.min(layout.bodyHeight - scheduleBodyInsetY, pointerY - columnTop));
  const segment = layout.segments.find((item) => y >= item.top && y <= item.top + item.height) ?? layout.segments[layout.segments.length - 1];
  if (!segment) return scheduleStartHour;
  return segment.start + (y - segment.top) / pixelsPerHour;
}

function getBookingTop(start: number, layout: ScheduleDisplayLayout) {
  return getHourTop(start, layout);
}

function isBookingVisibleInDisplayLayout(booking: { start: number }, layout: ScheduleDisplayLayout) {
  return layout.segments.length > 0 && Number.isFinite(booking.start);
}

function getBookingHeight(duration: number) {
  return Math.max(minimumBookingCardHitTarget, duration * pixelsPerHour - 4);
}

function getBookingCardDensity(duration: number) {
  return duration >= detailedBookingMinimumDuration ? "detailed" : "compact";
}

function getStaffBookingLayouts<T extends { id: string; start: number; duration: number }>(bookings: T[]) {
  const sorted = [...bookings].sort((first, second) => first.start - second.start || first.id.localeCompare(second.id));
  const lanes: Array<T[]> = [];
  const layouts = new Map<string, { lane: number; laneCount: number }>();
  sorted.forEach((booking) => {
    const laneIndex = lanes.findIndex((lane) => !lane.some((item) => bookingTimesOverlap(item, booking)));
    const nextLaneIndex = laneIndex >= 0 ? laneIndex : lanes.length;
    if (!lanes[nextLaneIndex]) lanes[nextLaneIndex] = [];
    lanes[nextLaneIndex].push(booking);
    layouts.set(booking.id, { lane: nextLaneIndex, laneCount: 1 });
  });
  sorted.forEach((booking) => {
    const overlapping = sorted.filter((item) => bookingTimesOverlap(item, booking));
    const laneCount = Math.max(1, ...overlapping.map((item) => (layouts.get(item.id)?.lane ?? 0) + 1));
    const current = layouts.get(booking.id);
    if (current) layouts.set(booking.id, { ...current, laneCount });
  });
  return layouts;
}

function getPendingOverlapLabel(booking: DailyBooking, bookings: DailyBooking[]) {
  return "";
}

function getBookingLayoutStyle(lane: number, laneCount: number) {
  const width = laneCount > 1 ? `calc(${bookingCardWidth} / ${laneCount})` : bookingCardWidth;
  const left = laneCount > 1 ? `calc(${bookingCardHorizontalInset} + (${bookingCardWidth} / ${laneCount}) * ${lane})` : bookingCardHorizontalInset;
  return { left, width };
}

function getSnappedBookingStart(pointerY: number, columnTop: number, duration: number, layout: ScheduleDisplayLayout) {
  const rawHour = getHourFromTop(pointerY, columnTop, layout);
  const snapped = Math.round(rawHour * scheduleSnapSegmentsPerHour) / scheduleSnapSegmentsPerHour;
  return Math.max(scheduleStartHour, Math.min(scheduleEndHour - duration, snapped));
}

function getSnappedBookingDuration(start: number, duration: number) {
  const snapped = Math.round(duration * scheduleSnapSegmentsPerHour) / scheduleSnapSegmentsPerHour;
  return Math.max(0.25, Math.min(scheduleEndHour - start, snapped));
}

function bookingTimesOverlap(first: { start: number; duration: number }, second: { start: number; duration: number }) {
  return first.start < second.start + second.duration && second.start < first.start + first.duration;
}

function hasStaffBookingConflict(bookings: DailyBooking[], bookingId: string, next: { staffKey: StaffKey; start: number; duration: number }) {
  return bookings.some((booking) => booking.id !== bookingId && booking.staffKey === next.staffKey && bookingTimesOverlap(booking, next));
}

export function DailyScheduleGrid({
  shopId,
  bookings,
  staff,
  visibleStaff,
  staffMembers,
  staffScheduleOverrides,
  activeMetric,
    selectedBookingId,
    selectedDate,
    operatingWindow,
    currentHour,
  conflictBookings,
  selectedStaffKey,
  onSelectBooking,
  onSelectStaff,
  onMoveBooking,
  onResizeBooking,
}: {
  shopId: string;
  bookings: DailyBooking[];
  staff: StaffFilter;
  visibleStaff: OwnerWebStaffColumn[];
  staffMembers: OwnerWebStaffMember[];
  staffScheduleOverrides?: StaffScheduleOverride[];
  activeMetric: SummaryMetricKey;
    selectedBookingId: string;
    selectedDate: string;
    operatingWindow: { enabled: boolean; openHour: number; closeHour: number };
    currentHour: number;
  conflictBookings: DailyBooking[];
  selectedStaffKey: StaffKey | null;
  onSelectBooking: (id: string) => void;
  onSelectStaff: (staffKey: StaffKey) => void;
  onMoveBooking: (bookingId: string, next: { staffKey: StaffKey; staffName: string; staff: string; start: number }) => void;
  onResizeBooking: (bookingId: string, duration: number) => void;
}) {
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const headerScrollerRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollerRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const boardPanRef = useRef<BoardPanState | null>(null);
  const [scheduleTrackWidth, setScheduleTrackWidth] = useState<number | null>(null);
  const [draggingBookingId, setDraggingBookingId] = useState<string | null>(null);
  const [resizingBooking, setResizingBooking] = useState<BookingResizeState | null>(null);
  const [boardPanning, setBoardPanning] = useState(false);
  const [expandedMicroBookingId, setExpandedMicroBookingId] = useState<string | null>(null);
    const scheduleStaff = staff === "전체 직원" ? visibleStaff : visibleStaff.filter((item) => item.key === staff);
  const staffScopedBookings = bookings.filter((booking) => scheduleStaff.some((item) => item.key === booking.staffKey));
  const scheduleLaneColumns = useMemo(
    () =>
      buildScheduleStaffLaneColumns({
        date: selectedDate,
        staffColumns: scheduleStaff,
        staffMembers,
        staffScheduleOverrides,
        bookings: staffScopedBookings,
      }),
    [selectedDate, scheduleStaff, staffMembers, staffScheduleOverrides, staffScopedBookings],
  );
    const scheduleDisplayLayout = getScheduleDisplayLayout(operatingWindow);
  const visibleBookings = staffScopedBookings.filter((booking) => isBookingVisibleInDisplayLayout(booking, scheduleDisplayLayout));
  const showCurrentTime = selectedDate === currentDateInTimeZone() && currentHour >= scheduleStartHour && currentHour <= scheduleEndHour;
  const currentTimeTop = showCurrentTime ? getHourTop(currentHour, scheduleDisplayLayout) : 0;
  const getTimeRailLabelTop = (hour: number) =>
    Math.max(10, Math.min(getHourTop(hour, scheduleDisplayLayout), scheduleBodyHeight - 10));
  const columnCount = scheduleLaneColumns.length;
  const scrollable = columnCount > 4;
  const compactCards = columnCount >= 3;
  const columnFlexBasis = columnCount === 0
    ? "0 0 100%"
    : scrollable
      ? "0 0 25%"
      : `0 0 calc(100% / ${columnCount})`;
  const scheduleTrackStyle = scheduleTrackWidth ? { width: scheduleTrackWidth, minWidth: scheduleTrackWidth } : undefined;
  const displayedVisibleBookings = resizingBooking
    ? visibleBookings.map((booking) =>
        booking.id === resizingBooking.bookingId ? { ...booking, duration: resizingBooking.nextDuration } : booking,
      )
    : visibleBookings;
  const scheduleBodyHeight = Math.max(
    scheduleDisplayLayout.bodyHeight,
    ...displayedVisibleBookings.map((booking) => getBookingTop(booking.start, scheduleDisplayLayout) + getBookingHeight(booking.duration) + 16),
  );
  const expandedTimeHours = Array.from(
    new Set(
      scheduleDisplayLayout.segments.flatMap((segment) => {
        const start = Math.ceil(segment.start);
        const end = Math.floor(segment.end);
        return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index).filter((hour) => hour >= segment.start && hour <= segment.end);
      }),
    ),
  );

  function renderScheduleLines(prefix: string, selected = false) {
    return scheduleDisplayLayout.segments.flatMap((segment) => {
      const segmentCount = Math.round((segment.end - segment.start) * 4);
      return Array.from({ length: segmentCount + 1 }).map((_, index) => {
        const lineInterval = index % 4 === 0 ? "hour" : index % 2 === 0 ? "half-hour" : "quarter-hour";
        return (
          <div
            key={`${prefix}-line-${segment.key}-${index}`}
            data-schedule-time-grid-line={selected ? "selected" : "default"}
            data-schedule-time-grid-interval={lineInterval}
            className={cn(
              "absolute left-0 right-0 border-t",
              lineInterval === "hour"
                ? selected
                  ? "border-[#d6e0ea]"
                  : "border-[#dfe8f2]"
                : lineInterval === "half-hour"
                  ? selected
                    ? "border-[#dfe8f2]"
                    : "border-[#e8eef5]"
                  : selected
                    ? "border-transparent"
                    : "border-transparent",
            )}
            style={{ top: segment.top + index * quarterSlotHeight }}
          />
        );
      });
    });
  }

  useEffect(() => {
    if (!expandedMicroBookingId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(`[data-booking-id="${expandedMicroBookingId}"]`)) return;
      setExpandedMicroBookingId(null);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [expandedMicroBookingId]);

  useLayoutEffect(() => {
    const scroller = bodyScrollerRef.current;
    if (!scroller) return;

    const updateMeasurements = () => {
      const nextWidth = Math.round(scroller.clientWidth);
      if (nextWidth > 0) {
        setScheduleTrackWidth(nextWidth);
      }
    };

    updateMeasurements();
    const resizeObserver = new ResizeObserver(updateMeasurements);
    resizeObserver.observe(scroller);

    return () => resizeObserver.disconnect();
  }, [columnCount]);

  function syncHorizontalScroll(source: "header" | "body") {
    if (syncingScrollRef.current) return;
    const from = source === "header" ? headerScrollerRef.current : bodyScrollerRef.current;
    const to = source === "header" ? bodyScrollerRef.current : headerScrollerRef.current;
    if (!from || !to) return;
    syncingScrollRef.current = true;
    to.scrollLeft = from.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  function shouldSkipBoardPan(target: EventTarget | null) {
    const element = target instanceof Element ? target : null;
    return Boolean(element?.closest('button, a, input, select, textarea, [role="button"], [data-booking-id], [draggable="true"]'));
  }

  function stopBoardPan(event?: ReactPointerEvent<HTMLDivElement>) {
    const pointerId = boardPanRef.current?.pointerId;
    if (event && pointerId !== undefined && event.currentTarget.hasPointerCapture(pointerId)) {
      event.currentTarget.releasePointerCapture(pointerId);
    }
    boardPanRef.current = null;
    setBoardPanning(false);
  }

  function handleBoardPanPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!scrollable) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (shouldSkipBoardPan(event.target)) return;

    const bodyScroller = bodyScrollerRef.current;
    if (!bodyScroller) return;

    boardPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: bodyScroller.scrollLeft,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setBoardPanning(true);
    event.preventDefault();
  }

  function handleBoardPanPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const panState = boardPanRef.current;
    const bodyScroller = bodyScrollerRef.current;
    if (!panState || panState.pointerId !== event.pointerId || !bodyScroller) return;

    const deltaX = event.clientX - panState.startX;
    if (Math.abs(deltaX) > 3) {
      panState.moved = true;
    }

    bodyScroller.scrollLeft = panState.scrollLeft - deltaX;
    if (headerScrollerRef.current) {
      headerScrollerRef.current.scrollLeft = bodyScroller.scrollLeft;
    }

    if (panState.moved) {
      event.preventDefault();
    }
  }

  function handleBookingDragStart(event: DragEvent<HTMLButtonElement>, bookingId: string) {
    if (resizingBooking) {
      event.preventDefault();
      return;
    }
    const booking = bookings.find((item) => item.id === bookingId);
    if (booking && isCompletedBookingStatus(booking.sourceStatus ?? booking.status)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", bookingId);
    setDraggingBookingId(bookingId);
    onSelectBooking(bookingId);
    if (booking) {
      onSelectStaff(booking.staffKey);
    }
  }

  function handleColumnDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleColumnDrop(event: DragEvent<HTMLElement>, laneColumn: ScheduleStaffLaneColumn) {
    event.preventDefault();
    const bookingId = event.dataTransfer.getData("text/plain");
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) {
      setDraggingBookingId(null);
      return;
    }
    if (isCompletedBookingStatus(booking.sourceStatus ?? booking.status)) {
      onSelectBooking(bookingId);
      setDraggingBookingId(null);
      return;
    }

    const columnRect = event.currentTarget.getBoundingClientRect();
    const nextStart = getSnappedBookingStart(event.clientY, columnRect.top, booking.duration, scheduleDisplayLayout);
    const activeStaff = getScheduleLaneActiveStaff(laneColumn, nextStart, booking.duration);
    if (!activeStaff) {
      onSelectBooking(bookingId);
      setDraggingBookingId(null);
      return;
    }
    if (
      hasStaffBookingConflict(conflictBookings, bookingId, {
        staffKey: activeStaff.key,
        start: nextStart,
        duration: booking.duration,
      })
    ) {
      onSelectBooking(bookingId);
      setDraggingBookingId(null);
      return;
    }

    onMoveBooking(bookingId, {
      staffKey: activeStaff.key,
      staffName: activeStaff.name,
      staff: activeStaff.name,
      start: nextStart,
    });
    onSelectStaff(activeStaff.key);
    onSelectBooking(bookingId);
    setDraggingBookingId(null);
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>, booking: DailyBooking) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (isCompletedBookingStatus(booking.sourceStatus ?? booking.status)) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectBooking(booking.id);
    setExpandedMicroBookingId(null);
    setResizingBooking({
      bookingId: booking.id,
      pointerId: event.pointerId,
      startY: event.clientY,
      initialDuration: booking.duration,
      nextDuration: booking.duration,
    });
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    setResizingBooking((current) => {
      if (!current || current.pointerId !== event.pointerId) return current;
      const booking = bookings.find((item) => item.id === current.bookingId);
      if (!booking) return current;
      const deltaSlots = Math.round((event.clientY - current.startY) / quarterSlotHeight);
      const nextDuration = getSnappedBookingDuration(
        booking.start,
        current.initialDuration + deltaSlots / scheduleSnapSegmentsPerHour,
      );
      return { ...current, nextDuration };
    });
  }

  function finishResizeBooking(event: ReactPointerEvent<HTMLDivElement>) {
    const current = resizingBooking;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const booking = bookings.find((item) => item.id === current.bookingId);
    if (booking) {
      const nextDuration = getSnappedBookingDuration(booking.start, current.nextDuration);
      const blocked = hasStaffBookingConflict(conflictBookings, booking.id, {
        staffKey: booking.staffKey,
        start: booking.start,
        duration: nextDuration,
      });
      if (!blocked) {
        onResizeBooking(booking.id, nextDuration);
      }
      onSelectBooking(booking.id);
    }
    setResizingBooking(null);
  }

  return (
    <div data-schedule-board-grid="true" className="flex min-h-0 flex-1 flex-col bg-white">
      <style>{`
        .pm-schedule-y-scroll {
          scrollbar-width: none;
        }
        .pm-schedule-y-scroll::-webkit-scrollbar {
          display: none;
          width: 0;
        }
      `}</style>
      <div className="flex shrink-0 overflow-hidden border-b border-[#e3eaf2] bg-white">
            <CalendarTimeRailHeader />
        <div
          ref={headerScrollerRef}
          onScroll={() => syncHorizontalScroll("header")}
          className="no-scrollbar min-w-0 flex-1 overflow-x-auto"
        >
          <div className="flex min-w-full gap-0 px-0 pb-0 pt-0 pr-0" style={scheduleTrackStyle}>
            {scheduleLaneColumns.map((laneColumn) => {
              const primaryStaff = laneColumn.segments[0];
              const laneBookings = displayedVisibleBookings.filter((booking) => laneColumn.staffKeys.includes(booking.staffKey));
              const selectedStaff = Boolean(selectedStaffKey && laneColumn.staffKeys.includes(selectedStaffKey));

              return (
                <CalendarStaffLaneHeader
                  key={laneColumn.key}
                  name={laneColumn.name}
                  staffKey={primaryStaff?.key ?? laneColumn.key}
                  avatarIdentity={`${shopId}:${primaryStaff?.key ?? laneColumn.key}`}
                  chipColorIndex={primaryStaff?.chipColorIndex}
                  profileImageUrl={primaryStaff?.profileImageUrl}
                  profileImageUrls={primaryStaff?.profileImageUrls}
                  profileImageAssetId={primaryStaff?.profileImageAssetIds?.[0]}
                  profileImageAssetIds={primaryStaff?.profileImageAssetIds}
                  profileImageFallbackKey={primaryStaff?.profileImageFallbackKey}
                  startLabel={primaryStaff ? formatHourLabel(primaryStaff.start) : undefined}
                  endLabel={primaryStaff ? formatHourLabel(primaryStaff.end) : undefined}
                  bookingCount={laneBookings.length}
                  selected={selectedStaff}
                  flexBasis={columnFlexBasis}
                  onSelect={() => {
                    if (primaryStaff) onSelectStaff(primaryStaff.key);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div
        ref={timelineViewportRef}
        onPointerDown={handleBoardPanPointerDown}
        onPointerMove={handleBoardPanPointerMove}
        onPointerUp={stopBoardPan}
        onPointerCancel={stopBoardPan}
        className={cn(
          "pm-schedule-y-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white select-none",
          boardPanning && "cursor-grabbing snap-none",
          !boardPanning && scrollable && "cursor-grab",
        )}
      >
        <div className="flex">
          <CalendarTimeRail
            hours={expandedTimeHours}
            height={scheduleBodyHeight}
            getLabelTop={getTimeRailLabelTop}
            formatHourLabel={formatHourLabel}
            showCurrentTime={showCurrentTime}
            currentTimeTop={currentTimeTop}
            currentHour={currentHour}
          />

          <div
            ref={bodyScrollerRef}
            data-schedule-scroller="true"
            onScroll={() => syncHorizontalScroll("body")}
            className="no-scrollbar min-w-0 flex-1 overflow-x-auto scroll-px-4"
          >
            <div className="relative min-w-full" style={scheduleTrackStyle}>
              <div className="flex min-w-full gap-0 px-0 pb-0 pt-0 pr-0">
              {scheduleLaneColumns.length === 0 ? (
                <section className="flex min-h-[360px] flex-1 items-center justify-center rounded-b-[8px] bg-white">
                  <div className="rounded-[8px] border border-dashed border-[#cbd5e1] bg-white px-5 py-4 text-center">
                    <p className="text-[14px] font-medium leading-5 text-[#111827]">오늘 근무자가 없습니다.</p>
                    <p className="mt-1 text-[13px] font-normal leading-5 text-[#64748b]">근무표를 확인하거나 직원을 추가해 주세요.</p>
                  </div>
                </section>
              ) : null}
              {scheduleLaneColumns.map((laneColumn) => {
                const laneBookings = displayedVisibleBookings
                  .filter((booking) => laneColumn.staffKeys.includes(booking.staffKey))
                  .sort((a, b) => a.start - b.start);
                const bookingLayouts = getStaffBookingLayouts(laneBookings);
                const firstStaffKey = laneColumn.segments[0]?.key ?? laneColumn.staffKeys[0] ?? laneColumn.key;
                const selectedLane = Boolean(selectedStaffKey && laneColumn.staffKeys.includes(selectedStaffKey));
                return (
                  <section
                    key={laneColumn.key}
                    data-schedule-staff-column={firstStaffKey}
                    data-schedule-staff-selected={selectedLane ? "true" : "false"}
                    onClick={() => {
                      const activeSegment =
                        laneColumn.segments.find((segment) => currentHour >= segment.start && currentHour < segment.end) ??
                        laneColumn.segments[0];
                      if (activeSegment) onSelectStaff(activeSegment.key);
                    }}
                    onDragOver={handleColumnDragOver}
                    onDrop={(event) => handleColumnDrop(event, laneColumn)}
                    className={cn(
                      "min-w-[240px] cursor-pointer border border-l-0 border-t-0 border-[#e8eef5] bg-white p-0 transition",
                      selectedLane && "border-[#d6e0ea] bg-white",
                      draggingBookingId && "ring-1 ring-inset ring-[#cfd8e3]",
                    )}
                    style={{ flex: columnFlexBasis }}
                  >
                    <div className="relative" style={{ height: scheduleBodyHeight }}>
                      {renderScheduleLines(laneColumn.key, selectedLane)}
                      {showCurrentTime ? (
                        <>
                          <div
                            data-schedule-current-time-wash="true"
                            className="pointer-events-none absolute left-0 right-0 z-[5] h-6 -translate-y-1/2 bg-[#edf3ff]"
                            style={{ top: currentTimeTop }}
                            aria-hidden="true"
                          />
                          <div
                            data-schedule-current-time-line="true"
                            className="pointer-events-none absolute left-0 right-0 z-30 h-px"
                            style={{ top: currentTimeTop, backgroundColor: "#3b6fd8" }}
                            aria-hidden="true"
                          />
                        </>
                      ) : null}
                      {laneColumn.segments.map((segment) => (
                        <div
                          key={`${laneColumn.key}-${segment.key}-work-segment`}
                          className={cn(
                            "pointer-events-none absolute left-0 right-0 z-[6] border-y bg-transparent",
                            selectedLane ? "border-[#d6e0ea]" : "border-[#f5f6f8]",
                          )}
                          style={{
                            top: getBookingTop(segment.start, scheduleDisplayLayout),
                            height: Math.max(18, getBookingTop(segment.end, scheduleDisplayLayout) - getBookingTop(segment.start, scheduleDisplayLayout)),
                          }}
                          aria-hidden="true"
                        />
                      ))}
                      {laneBookings.length === 0 ? (
                        <p className="absolute left-[5%] top-5 z-10 text-[12px] font-medium leading-[18px] text-[#a0acb9]">예약 없음</p>
                      ) : (
                        laneBookings.map((booking) => {
                          const selected = selectedBookingId === booking.id;
                          const timeLabel = `${formatHourLabel(booking.start)}-${formatHourLabel(booking.start + booking.duration)}`;
                          const displayTimeLabel = booking.scheduledTimeLabel ?? timeLabel;
                          const changeStatus = isChangeBookingStatus(booking.status);
                          const timedStatus = getTimedBookingStatus(booking, selectedDate, currentHour);
                          const completedBooking = isCompletedBookingStatus(booking.sourceStatus ?? booking.status);
                          const bookingStaff = visibleStaff.find((member) => member.key === booking.staffKey);
                          const identityTone = getStaffChipTone(booking.staffKey, bookingStaff?.chipColorIndex);
                          const canAdjustBookingTime = !changeStatus && !completedBooking;
                          const density = getBookingCardDensity(booking.duration);
                          const expandedMicro = density === "compact" && expandedMicroBookingId === booking.id;
                          const bookingHeight = getBookingHeight(booking.duration);
                          const showResizeHandleBar = booking.duration >= 1;
                          const bookingLayout = bookingLayouts.get(booking.id) ?? { lane: 0, laneCount: 1 };
                          const bookingLayoutStyle = getBookingLayoutStyle(bookingLayout.lane, bookingLayout.laneCount);
                          const statusLabel = getReservationStatusLabel(booking, selectedDate, currentHour);
                          const statusPillClass = getReservationStatusPillClass(booking, selectedDate, currentHour);
                          const pendingOverlapLabel = getPendingOverlapLabel(booking, conflictBookings);
                          const requestNote = [booking.customerMemo?.trim(), booking.memo?.trim()].filter(Boolean).join(" / ");
                          const requestNoteText = requestNote ? `고객 메모 ${requestNote}` : "고객 메모 없음";

                          if (booking.displayMode === "reservation-chip") {
                            return (
                              <button
                                key={booking.id}
                                type="button"
                                data-booking-id={booking.id}
                                aria-label={[booking.pet, booking.customer, booking.service, statusLabel, requestNoteText].filter(Boolean).join(" / ")}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (booking.sourceAppointmentId) onSelectBooking(booking.sourceAppointmentId);
                                  onSelectStaff(booking.staffKey || firstStaffKey);
                                }}
                                className={cn(
                                  "group/booking absolute z-20 box-border flex min-h-11 items-start justify-start overflow-hidden rounded-[14px] border border-l-[3px] p-0 text-left text-[#334155] shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-[filter,box-shadow] hover:brightness-[0.99] hover:shadow-[0_3px_10px_rgba(15,23,42,0.07)] focus-visible:ring-2 focus-visible:ring-[#1677ff]/70 focus-visible:ring-offset-1",
                                  selected && "!border-[#bcd5fa] shadow-[0_3px_12px_rgba(37,99,235,0.09)] ring-1 ring-[#bcd5fa]",
                                )}
                                style={{
                                  ...bookingLayoutStyle,
                                  top: getBookingTop(booking.start, scheduleDisplayLayout),
                                  height: bookingHeight,
                                  backgroundColor: completedBooking ? "#f8fafc" : `color-mix(in srgb, ${identityTone.background} 55%, white)`,
                                  borderColor: completedBooking ? "#dde5ef" : identityTone.border,
                                  borderLeftColor: identityTone.selectedBackground,
                                }}
                              >
                                <BookingChipContent booking={booking} timeLabel={booking.scheduledTimeLabel ?? timeLabel} statusLabel={statusLabel} statusPillClass={statusPillClass} height={bookingHeight} pendingOverlapLabel={pendingOverlapLabel} />
                              </button>
                            );
                          }

                          return (
                            <button
                              key={booking.id}
                              type="button"
                              draggable={!resizingBooking && canAdjustBookingTime}
                              data-booking-id={booking.id}
                                aria-label={[booking.pet, booking.customer, booking.service, statusLabel, requestNoteText].filter(Boolean).join(" / ")}
                              data-booking-duration={booking.duration}
                              data-booking-density={density}
                              onDragStart={(event) => handleBookingDragStart(event, booking.id)}
                              onDragEnd={() => setDraggingBookingId(null)}
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelectBooking(booking.id);
                                onSelectStaff(booking.staffKey || firstStaffKey);
                                setExpandedMicroBookingId(density === "compact" ? booking.id : null);
                              }}
                              className={cn(
                                "group/booking absolute z-20 box-border cursor-grab overflow-hidden rounded-[14px] border border-l-[3px] p-0 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-[filter,box-shadow] hover:brightness-[0.99] hover:shadow-[0_3px_10px_rgba(15,23,42,0.07)] focus-visible:ring-2 focus-visible:ring-[#1677ff]/70 focus-visible:ring-offset-1 active:cursor-grabbing",
                                !canAdjustBookingTime && "cursor-pointer active:cursor-pointer",
                                resizingBooking?.bookingId === booking.id && "cursor-ns-resize",
                                draggingBookingId === booking.id && "opacity-70 ring-1 ring-[#93c5fd]",
                                expandedMicro && "z-50 shadow-none",
                                selected && "!border-[#bcd5fa] shadow-[0_3px_12px_rgba(37,99,235,0.09)] ring-1 ring-[#bcd5fa]",
                              )}
                              style={{
                                ...bookingLayoutStyle,
                                top: getBookingTop(booking.start, scheduleDisplayLayout),
                                height: bookingHeight,
                                backgroundColor: completedBooking ? "#f8fafc" : `color-mix(in srgb, ${identityTone.background} 55%, white)`,
                                borderColor: completedBooking ? "#dde5ef" : identityTone.border,
                                borderLeftColor: identityTone.selectedBackground,
                              }}
                            >
                              <BookingChipContent booking={booking} timeLabel={displayTimeLabel} statusLabel={statusLabel} statusPillClass={statusPillClass} height={bookingHeight} pendingOverlapLabel={pendingOverlapLabel} />

                              {canAdjustBookingTime ? (
                              <div
                                  role="separator"
                                  aria-label="예약 종료 시간 조정"
                                  aria-orientation="horizontal"
                                  onPointerDown={(event) => handleResizePointerDown(event, booking)}
                                  onPointerMove={handleResizePointerMove}
                                  onPointerUp={finishResizeBooking}
                                  onPointerCancel={finishResizeBooking}
                                  className={cn("absolute inset-x-3 bottom-0.5 z-30 flex h-4 cursor-ns-resize touch-none items-center justify-center opacity-0 transition-opacity group-hover/booking:opacity-100 group-focus-within/booking:opacity-100 [@media(hover:none)]:opacity-100", (selected || resizingBooking?.bookingId === booking.id) && "opacity-100")}
                                >
                                  {showResizeHandleBar ? (
                                    <span className="h-[4px] w-8 rounded-full" style={{ backgroundColor: identityTone.selectedBackground }} />
                                  ) : null}
                                </div>
                              ) : null}
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
        </div>
      </div>
    </div>
  );
}


