"use client";

import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  buildScheduleStaffLaneColumns,
  getScheduleLaneActiveStaff,
  type ScheduleStaffLaneColumn,
} from "@/components/owner-web/calendar-staff-lane-columns";
import type { OwnerWebStaffColumn, OwnerWebStaffMember } from "@/components/owner-web/owner-web-staff-data";
import { cn, currentDateInTimeZone } from "@/lib/utils";
import type { StaffScheduleOverride } from "@/types/domain";

type SummaryMetricKey = "today" | "completed" | "changes";
type BookingCardTone = "bath" | "grooming" | "hygiene" | "care" | "neutral";
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
  staffKey: StaffKey;
  actualTimeLabel?: string;
  scheduledTimeLabel?: string;
  displayMode?: "reservation-chip";
  sourceAppointmentId?: string;
};

const scheduleStartHour = 0;
const scheduleEndHour = 24;
const pixelsPerHour = 86.4;
const scheduleBodyInsetY = 7;
const quarterSlotHeight = pixelsPerHour / 4;
const scheduleSnapSegmentsPerHour = 4;
const expandableBookingDurationMax = 0.25;
const bookingCardWidth = "96%";
const bookingCardHorizontalInset = "2%";

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
  const today = new Date().toLocaleDateString("en-CA");
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

function getBookingCardTone(booking: Pick<DailyBooking, "service">): BookingCardTone {
  const service = booking.service.replaceAll(" ", "");
  if (service.includes("목욕")) return "bath";
  if (service.includes("위생")) return "hygiene";
  if (/(부분|발톱|발바닥|얼굴|귀|항문낭)/.test(service)) return "care";
  if (/(미용|가위|클리핑)/.test(service)) return "grooming";
  return "neutral";
}

function getBookingCardToneClass(tone: BookingCardTone) {
  const toneClass = {
    bath: "border-[#b9dfc5] bg-[#e6f4ea] hover:bg-[#dff0e4]",
    grooming: "border-[#b9d6f5] bg-[#e5f0ff] hover:bg-[#dceaff]",
    hygiene: "border-[#d5c2ef] bg-[#eee7fa] hover:bg-[#e8dff7]",
    care: "border-[#f0c8a8] bg-[#fce8d8] hover:bg-[#fae0cb]",
    neutral: "border-[#d4dce6] bg-[#f1f4f7] hover:bg-[#eaf0f5]",
  }[tone];
  return cn(
    "border shadow-[0_1px_2px_rgba(15,23,42,0.035)] transition-[background-color,box-shadow] hover:shadow-[0_5px_14px_rgba(15,23,42,0.07)]",
    toneClass,
  );
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
  if (isOverduePendingBookingStatus(status)) return "text-[#a04455]";
  if (status === "방문 확인 필요" || status === "완료 확인 필요") return "text-[#a46710]";
  if (status === "확정") return "text-[#24784b]";
  if (status === "진행 중") return "text-[#2563eb]";
  if (status === "픽업 준비") return "text-[#7c3aed]";
  if (status === "완료") return "text-[#64748b]";
  if (status.includes("변경")) return "text-[#a46710]";
  if (status.includes("취소")) return "text-[#a04455]";
  if (status.includes("거절")) return "text-[#a04455]";
  if (status.includes("노쇼")) return "text-[#a04455]";
  return "text-[#475569]";
}

function getBookingResizeHandleClass(tone: BookingCardTone) {
  if (tone === "bath") return "bg-[#4f8a64]/60";
  if (tone === "grooming") return "bg-[#527dab]/60";
  if (tone === "hygiene") return "bg-[#8066a5]/60";
  if (tone === "care") return "bg-[#b88939]/60";
  return "bg-[#718096]/55";
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
  return Math.max(24, duration * pixelsPerHour - 4);
}

function getBookingCardDensity(duration: number) {
  return duration <= expandableBookingDurationMax ? "micro" : "normal";
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

function getBookingLayoutStyle(lane: number, laneCount: number, columnCount: number) {
  if (columnCount === 1 && laneCount === 1) {
    return {
      left: "50%",
      width: "min(calc(100% - 56px), 560px)",
      transform: "translateX(-50%)",
    };
  }

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

  function renderScheduleLines(prefix: string) {
    return scheduleDisplayLayout.segments.flatMap((segment) => {
      const segmentCount = Math.round((segment.end - segment.start) * 4);
      return Array.from({ length: segmentCount + 1 }).map((_, index) => (
        <div
          key={`${prefix}-line-${segment.key}-${index}`}
          className={cn(
            "absolute left-0 right-0 border-t",
            index % 4 === 0 ? "border-[#f1f4f7]" : "border-[#f8fafc]",
          )}
          style={{ top: segment.top + index * quarterSlotHeight }}
        />
      ));
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
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <style>{`
        .pm-schedule-y-scroll {
          scrollbar-width: thin;
          scrollbar-color: #c4ceda transparent;
        }
        .pm-schedule-y-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .pm-schedule-y-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .pm-schedule-y-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: #c4ceda;
        }
      `}</style>
      <div className="flex shrink-0 bg-white">
          <div className="flex h-[54px] w-[64px] shrink-0 items-center justify-end border-b border-r border-[#e9eef4] bg-[#fbfcfe] pr-3 text-[11px] font-medium tracking-[0.04em] text-[#94a3b8]">
            시간
          </div>
        <div
          ref={headerScrollerRef}
          onScroll={() => syncHorizontalScroll("header")}
          className="no-scrollbar min-w-0 flex-1 overflow-x-auto"
        >
          <div className="flex min-w-full gap-0 px-0 pb-0 pt-0 pr-0" style={scheduleTrackStyle}>
            {scheduleLaneColumns.map((laneColumn, laneIndex) => {
              const primaryStaff = laneColumn.segments[0];
              const laneBookings = displayedVisibleBookings.filter((booking) => laneColumn.staffKeys.includes(booking.staffKey));
              const selectedStaff = Boolean(selectedStaffKey && laneColumn.staffKeys.includes(selectedStaffKey));
              const staffNameToneClass = selectedStaff ? "text-[#1677ff]" : "text-[#334155]";

              return (
                <section
                  key={laneColumn.key}
                  onClick={() => {
                    if (primaryStaff) onSelectStaff(primaryStaff.key);
                  }}
                  className={cn(
                    "h-[54px] min-w-[136px] cursor-pointer border border-t-0 border-l-0 border-[#f1f4f7] bg-white px-3 py-2 transition hover:bg-[#f8fbff]",
                    selectedStaff && "border-b-[#cbd1d8]",
                  )}
                  style={{ flex: columnFlexBasis }}
                >
                  <div className="flex h-full items-center pl-1">
                    <div className="min-w-0">
                      <p
                        className={cn("min-w-0 truncate text-[14px] font-semibold leading-[18px]", staffNameToneClass)}
                      >
                        {laneColumn.name}
                      </p>
                      <p
                        className="min-w-0 truncate text-[11px] leading-[15px]"
                        style={{ color: "#64748b" }}
                      >
                        {primaryStaff?.role ? `${primaryStaff.role} · ` : ""}예약 {laneBookings.length}건
                      </p>
                    </div>
                  </div>
                </section>
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
          "pm-schedule-y-scroll min-h-0 flex-1 overflow-y-auto select-none",
          boardPanning && "cursor-grabbing snap-none",
          !boardPanning && scrollable && "cursor-grab",
        )}
      >
        <div className="flex">
          <div className="w-[64px] shrink-0 border border-l-0 border-t-0 border-[#e9eef4] bg-[#fbfcfe]">
            <div className="relative" style={{ height: scheduleBodyHeight }}>
              {expandedTimeHours.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-0 z-10 flex items-center text-[11px] font-medium leading-none text-[#7b8ca1]"
                  style={{ top: getTimeRailLabelTop(hour), transform: "translateY(-50%)" }}
                >
                  <span className="bg-[#fbfcfe] pr-2">{formatHourLabel(hour)}</span>
                  <span className="h-px w-2 bg-[#dbe4ef]" aria-hidden="true" />
                </div>
              ))}
              {showCurrentTime ? (
                <div
                  className="absolute right-0 z-30 flex items-center"
                  style={{ top: Math.max(11, Math.min(currentTimeTop, scheduleBodyHeight - 11)), transform: "translateY(-50%)" }}
                  aria-label={`현재 시간 ${formatHourLabel(currentHour)}`}
                >
                  <span className="rounded-l-full bg-[#2563eb] px-2 py-1 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {formatHourLabel(currentHour)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

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
                    <p className="text-[14px] font-medium text-[#111827]">오늘 근무자가 없습니다.</p>
                    <p className="mt-1 text-[13px] text-[#64748b]">근무표를 확인하거나 직원을 추가해 주세요.</p>
                  </div>
                </section>
              ) : null}
              {scheduleLaneColumns.map((laneColumn) => {
                const laneBookings = displayedVisibleBookings
                  .filter((booking) => laneColumn.staffKeys.includes(booking.staffKey))
                  .sort((a, b) => a.start - b.start);
                const bookingLayouts = getStaffBookingLayouts(laneBookings);
                const firstStaffKey = laneColumn.segments[0]?.key ?? laneColumn.staffKeys[0] ?? laneColumn.key;
                return (
                  <section
                    key={laneColumn.key}
                    onClick={() => {
                      const activeSegment =
                        laneColumn.segments.find((segment) => currentHour >= segment.start && currentHour < segment.end) ??
                        laneColumn.segments[0];
                      if (activeSegment) onSelectStaff(activeSegment.key);
                    }}
                    onDragOver={handleColumnDragOver}
                    onDrop={(event) => handleColumnDrop(event, laneColumn)}
                    className={cn(
                      "min-w-0 cursor-pointer border border-l-0 border-t-0 border-[#f1f4f7] bg-white p-0 transition",
                       draggingBookingId && "ring-1 ring-inset ring-[#cfd8e3]",
                    )}
                    style={{ flex: columnFlexBasis }}
                  >
                    <div className="relative" style={{ height: scheduleBodyHeight }}>
                      {renderScheduleLines(laneColumn.key)}
                      {showCurrentTime ? (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-30 h-px bg-[#2563eb]/80"
                          style={{ top: currentTimeTop }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {laneColumn.segments.map((segment) => (
                        <div
                          key={`${laneColumn.key}-${segment.key}-work-segment`}
                          className="pointer-events-none absolute left-0 right-0 z-[6] border-y border-[#f5f6f8] bg-transparent"
                          style={{
                            top: getBookingTop(segment.start, scheduleDisplayLayout),
                            height: Math.max(18, getBookingTop(segment.end, scheduleDisplayLayout) - getBookingTop(segment.start, scheduleDisplayLayout)),
                          }}
                          aria-hidden="true"
                        />
                      ))}
                      {laneBookings.length === 0 ? (
                        <p className="absolute left-[5%] top-5 z-10 text-[12px] text-[#a0acb9]">예약 없음</p>
                      ) : (
                        laneBookings.map((booking) => {
                          const selected = selectedBookingId === booking.id;
                          const timeLabel = `${formatHourLabel(booking.start)}-${formatHourLabel(booking.start + booking.duration)}`;
                          const displayTimeLabel = booking.actualTimeLabel?.replace(/^실제\s*/, "") || timeLabel;
                          const changeStatus = isChangeBookingStatus(booking.status);
                          const cardTone = getBookingCardTone(booking);
                          const timedStatus = getTimedBookingStatus(booking, selectedDate, currentHour);
                          const completedBooking = isCompletedBookingStatus(booking.sourceStatus ?? booking.status);
                          const canAdjustBookingTime = !changeStatus && !completedBooking;
                          const density = getBookingCardDensity(booking.duration);
                          const microCard = density === "micro";
                          const expandedMicro = density === "micro" && expandedMicroBookingId === booking.id;
                          const bookingHeight = getBookingHeight(booking.duration);
                          const showResizeHandleBar = booking.duration >= 1;
                          const bookingLayout = bookingLayouts.get(booking.id) ?? { lane: 0, laneCount: 1 };
                          const bookingLayoutStyle = getBookingLayoutStyle(bookingLayout.lane, bookingLayout.laneCount, columnCount);
                          const statusLabel = getReservationStatusLabel(booking, selectedDate, currentHour);
                          const statusPillClass = getReservationStatusPillClass(booking, selectedDate, currentHour);
                          const pendingOverlapLabel = getPendingOverlapLabel(booking, conflictBookings);

                          if (booking.displayMode === "reservation-chip") {
                            return (
                              <button
                                key={booking.id}
                                type="button"
                                data-booking-id={booking.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (booking.sourceAppointmentId) onSelectBooking(booking.sourceAppointmentId);
                                  onSelectStaff(booking.staffKey || firstStaffKey);
                                }}
                                className={cn(
                                  "absolute z-20 box-border flex min-h-10 items-center justify-start overflow-hidden rounded-[9px] px-2.5 py-1.5 text-left text-[12px] font-medium leading-[14px] text-[#334155]",
                                  getBookingCardToneClass(cardTone),
                                )}
                                style={{
                                  ...bookingLayoutStyle,
                                  top: getBookingTop(booking.start, scheduleDisplayLayout),
                                }}
                              >
                                <span className="flex min-w-0 flex-col whitespace-nowrap tabular-nums">
                                  <span className="text-[10px] leading-[12px] text-[#64748b]">예약</span>
                                  <span className="leading-[14px]">{booking.scheduledTimeLabel ?? timeLabel}</span>
                                </span>
                              </button>
                            );
                          }

                          return (
                            <button
                              key={booking.id}
                              type="button"
                              draggable={!resizingBooking && canAdjustBookingTime}
                              data-booking-id={booking.id}
                              data-booking-duration={booking.duration}
                              onDragStart={(event) => handleBookingDragStart(event, booking.id)}
                              onDragEnd={() => setDraggingBookingId(null)}
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelectBooking(booking.id);
                                onSelectStaff(booking.staffKey || firstStaffKey);
                                setExpandedMicroBookingId(density === "micro" ? booking.id : null);
                              }}
                              className={cn(
                                "absolute z-20 box-border cursor-grab overflow-hidden rounded-[12px] p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff]/70 focus-visible:ring-offset-1 active:cursor-grabbing",
                                !canAdjustBookingTime && "cursor-pointer active:cursor-pointer",
                                resizingBooking?.bookingId === booking.id && "cursor-ns-resize",
                                draggingBookingId === booking.id && "opacity-70 ring-1 ring-[#93c5fd]",
                                expandedMicro && "z-50 shadow-none",
                                getBookingCardToneClass(cardTone),
                              )}
                              style={{
                                ...bookingLayoutStyle,
                                top: getBookingTop(booking.start, scheduleDisplayLayout),
                                height: bookingHeight,
                              }}
                            >
                              <div
                                className={cn(
                                  "absolute inset-0 flex min-h-0 min-w-0 items-start overflow-hidden text-left",
                                  microCard ? "px-3 py-2" : "px-3.5 py-2.5",
                                )}
                              >
                                <div
                                  className={cn(
                                    "grid w-full min-w-0 content-start items-center gap-x-1.5",
                                    microCard ? "grid-cols-[minmax(0,1fr)_max-content]" : "grid-cols-[minmax(0,1fr)_auto]",
                                    microCard ? "grid-rows-[16px]" : "grid-rows-[18px_17px] gap-y-0.5",
                                  )}
                                >
                                  <p
                                    className={cn(
                                      "min-w-0 truncate text-[14px] font-semibold leading-[18px]",
                                      timedStatus === "완료" ? "text-[#64748b]" : "text-[#263445]",
                                    )}
                                  >
                                    {`${booking.pet} · ${booking.customer}`}
                                  </p>
                                  <span
                                    className={cn(
                                      "shrink-0 justify-self-end text-[12px] leading-[18px]",
                                      microCard
                                        ? "max-w-[116px] truncate whitespace-nowrap text-[#64748b]"
                                        : "whitespace-nowrap font-medium tabular-nums text-[#41546a]",
                                    )}
                                  >
                                    {microCard ? booking.service : displayTimeLabel}
                                  </span>
                                  {!microCard ? (
                                    <div className="col-span-2 flex min-w-0 items-center gap-2 leading-[17px]">
                                      <span
                                        className={cn(
                                          "shrink-0 text-[11px] font-medium leading-[17px]",
                                          statusPillClass,
                                        )}
                                      >
                                        {statusLabel}
                                      </span>
                                      {pendingOverlapLabel ? (
                                        <span className="shrink-0 text-[11px] font-medium leading-[17px] text-[#a46710]">
                                          {pendingOverlapLabel}
                                        </span>
                                      ) : null}
                                      <p className="min-w-0 truncate text-[12px] leading-[17px] text-[#56687b]">
                                        {booking.service}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              {selected && canAdjustBookingTime ? (
                                <div
                                  role="separator"
                                  aria-label="예약 종료 시간 조정"
                                  aria-orientation="horizontal"
                                  onPointerDown={(event) => handleResizePointerDown(event, booking)}
                                  onPointerMove={handleResizePointerMove}
                                  onPointerUp={finishResizeBooking}
                                  onPointerCancel={finishResizeBooking}
                                  className="absolute inset-x-3 bottom-0.5 z-30 flex h-4 cursor-ns-resize touch-none items-center justify-center"
                                >
                                  {showResizeHandleBar ? (
                                    <span className={cn("h-[5px] w-10 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.88)]", getBookingResizeHandleClass(cardTone))} />
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


