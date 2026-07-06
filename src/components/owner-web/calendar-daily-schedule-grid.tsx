"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { OwnerWebStaffColumn } from "@/components/owner-web/owner-web-staff-data";
import { getStaffChipTone } from "@/lib/staff-chip-colors";
import { getWrapIndicatorClass, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { cn } from "@/lib/utils";

type SummaryMetricKey = "today" | "completed" | "changes";
type BookingCardTone =
  | "confirmed"
  | "active"
  | "pickupReady"
  | "completed"
  | "changed"
  | "cancelled"
  | "rejected"
  | "noshow"
  | "missed";
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
type OffHoursRangeKey = "before" | "after" | "allDay";
type ExpandedOffHours = Record<OffHoursRangeKey, boolean>;
type ScheduleDisplaySegment = {
  key: OffHoursRangeKey | "business";
  kind: "business" | "off";
  start: number;
  end: number;
  top: number;
  height: number;
  collapsed: boolean;
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
const scheduleBodyInsetY = 0;
const quarterSlotHeight = pixelsPerHour / 4;
const collapsedOffHoursHeight = 18;
const scheduleSnapSegmentsPerHour = 4;
const expandableBookingDurationMax = 0.25;
const bookingCardWidth = "95%";
const bookingCardHorizontalInset = "2.5%";

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

function getStaffInitial(name: string) {
  return name.trim().slice(0, 1) || "?";
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

function getBookingCardTone(status: string): BookingCardTone {
  if (status === "방문 확인 필요" || status === "완료 확인 필요") return "missed";
  if (isOverduePendingBookingStatus(status)) return "missed";
  if (status === "진행 중") return "active";
  if (status === "픽업 준비") return "pickupReady";
  if (isCompletedBookingStatus(status)) return "completed";
  if (isRescheduledBookingStatus(status)) return "changed";
  if (status.includes("취소")) return "cancelled";
  if (status.includes("거절")) return "rejected";
  if (status.includes("노쇼")) return "noshow";
  return "confirmed";
}

function getBookingCardToneClass(tone: BookingCardTone, selected: boolean) {
  const base = "border-[#dbe2ea] hover:border-[#c5d0dc]";
  const selectedClass = selected ? "ring-1 ring-[#94a3b8]/35" : "";
  const backgroundClass: Record<BookingCardTone, string> = {
    confirmed: "bg-[#fbfdff]",
    active: "bg-[#fbfffc]",
    pickupReady: "bg-[#faffff]",
    completed: "bg-[#fbfcfe]",
    changed: "bg-[#fdfcff]",
    cancelled: "bg-[#fffafb]",
    rejected: "bg-[#fffafa]",
    noshow: "bg-[#fffdfb]",
    missed: "bg-[#fffbfd]",
  };
  return cn(base, backgroundClass[tone], tone === "cancelled" && "opacity-85", selectedClass);
}

function getBookingIndicatorTone(tone: BookingCardTone): StatusIndicatorTone {
  return tone;
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
  if (isOverduePendingBookingStatus(status)) return "border-[#e5c7cf] bg-[#fff8fa] text-[#a04455]";
  if (status === "방문 확인 필요" || status === "완료 확인 필요") return "border-[#ead9b8] bg-[#fffaf0] text-[#8a5b11]";
  if (status === "확정") return "border-[#c8d2dc] bg-[#f8fafc] text-[#607080]";
  if (status === "진행 중") return "border-[#c8d2dc] bg-[#f8fafc] text-[#607080]";
  if (status === "픽업 준비") return "border-[#c8d2dc] bg-[#f8fafc] text-[#607080]";
  if (status === "완료") return "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]";
  if (status.includes("변경")) return "border-[#ead9b8] bg-[#fffaf0] text-[#8a5b11]";
  if (status.includes("취소")) return "border-[#e5c7cf] bg-[#fff8fa] text-[#a04455]";
  if (status.includes("거절")) return "border-[#e5c7cf] bg-[#fff8fa] text-[#a04455]";
  if (status.includes("노쇼")) return "border-[#e5c7cf] bg-[#fff8fa] text-[#a04455]";
  return "border-[#dbe2ea] bg-[#f8fafc] text-[#334155]";
}

function getBookingResizeHandleClass(tone: BookingCardTone) {
  if (tone === "confirmed") return "bg-[#607080]/70";
  if (tone === "active") return "bg-[#607080]/70";
  if (tone === "pickupReady") return "bg-[#607080]/70";
  if (tone === "completed") return "bg-[#64748b]/62";
  if (tone === "changed") return "bg-[#b98121]/70";
  if (tone === "cancelled") return "bg-[#a04455]/68";
  if (tone === "rejected") return "bg-[#a04455]/68";
  if (tone === "noshow") return "bg-[#a04455]/68";
  return "bg-[#a04455]/68";
}

function getBookingTimeTextClass(tone: BookingCardTone) {
  if (tone === "confirmed") return "text-[#607080]";
  if (tone === "active") return "text-[#607080]";
  if (tone === "pickupReady") return "text-[#607080]";
  if (tone === "completed") return "text-[#64748b]";
  if (tone === "changed") return "text-[#8a5b11]";
  if (tone === "cancelled") return "text-[#a04455]";
  if (tone === "rejected") return "text-[#a04455]";
  if (tone === "noshow") return "text-[#a04455]";
  return "text-[#a04455]";
}

function getScheduleDisplayLayout(
  operatingWindow: { enabled: boolean; openHour: number; closeHour: number },
  expandedOffHours: ExpandedOffHours,
): ScheduleDisplayLayout {
  const segments: ScheduleDisplaySegment[] = [];
  let nextTop = scheduleBodyInsetY;
  const pushSegment = (segment: Omit<ScheduleDisplaySegment, "top" | "height">) => {
    const expandedHeight = (segment.end - segment.start) * pixelsPerHour;
    const height = segment.collapsed ? collapsedOffHoursHeight : expandedHeight;
    segments.push({ ...segment, top: nextTop, height });
    nextTop += height;
  };

  if (!operatingWindow.enabled) {
    pushSegment({
      key: "allDay",
      kind: "off",
      start: scheduleStartHour,
      end: scheduleEndHour,
      collapsed: !expandedOffHours.allDay,
    });

    return { segments, bodyHeight: nextTop + scheduleBodyInsetY };
  }

  const openHour = Math.max(scheduleStartHour, Math.min(scheduleEndHour, operatingWindow.openHour));
  const closeHour = Math.max(scheduleStartHour, Math.min(scheduleEndHour, operatingWindow.closeHour));
  const normalizedOpen = Math.min(openHour, closeHour);
  const normalizedClose = Math.max(openHour, closeHour);

  if (normalizedOpen > scheduleStartHour) {
    pushSegment({
      key: "before",
      kind: "off",
      start: scheduleStartHour,
      end: normalizedOpen,
      collapsed: !expandedOffHours.before,
    });
  }

  if (normalizedClose > normalizedOpen) {
    pushSegment({
      key: "business",
      kind: "business",
      start: normalizedOpen,
      end: normalizedClose,
      collapsed: false,
    });
  }

  if (normalizedClose < scheduleEndHour) {
    pushSegment({
      key: "after",
      kind: "off",
      start: normalizedClose,
      end: scheduleEndHour,
      collapsed: !expandedOffHours.after,
    });
  }

  return { segments, bodyHeight: nextTop + scheduleBodyInsetY };
}

function getSegmentLabel(segment: ScheduleDisplaySegment) {
  if (segment.key === "before") return `영업 전 ${formatHourLabel(segment.start)}-${formatHourLabel(segment.end)}`;
  if (segment.key === "after") return `영업 후 ${formatHourLabel(segment.start)}-${formatHourLabel(segment.end)}`;
  if (segment.key === "allDay") return `휴무 ${formatHourLabel(segment.start)}-${formatHourLabel(segment.end)}`;
  return "";
}

function getHourTop(hour: number, layout: ScheduleDisplayLayout) {
  const clampedHour = Math.max(scheduleStartHour, Math.min(scheduleEndHour, hour));
  const segment =
    layout.segments.find((item) => clampedHour >= item.start && (clampedHour < item.end || (item.end === scheduleEndHour && clampedHour === item.end))) ??
    layout.segments[layout.segments.length - 1];
  if (!segment) return scheduleBodyInsetY;

  if (segment.collapsed) {
    return segment.top + segment.height / 2;
  }

  return segment.top + (clampedHour - segment.start) * pixelsPerHour;
}

function getHourFromTop(pointerY: number, columnTop: number, layout: ScheduleDisplayLayout) {
  const y = Math.max(scheduleBodyInsetY, Math.min(layout.bodyHeight - scheduleBodyInsetY, pointerY - columnTop));
  const segment = layout.segments.find((item) => y >= item.top && y <= item.top + item.height) ?? layout.segments[layout.segments.length - 1];
  if (!segment) return scheduleStartHour;
  if (segment.collapsed) return segment.end;
  return segment.start + (y - segment.top) / pixelsPerHour;
}

function getBookingTop(start: number, layout: ScheduleDisplayLayout) {
  return getHourTop(start, layout);
}

function isBookingVisibleInDisplayLayout(booking: { start: number }, layout: ScheduleDisplayLayout) {
  const clampedStart = Math.max(scheduleStartHour, Math.min(scheduleEndHour, booking.start));
  const segment =
    layout.segments.find((item) => clampedStart >= item.start && (clampedStart < item.end || (item.end === scheduleEndHour && clampedStart === item.end))) ??
    layout.segments[layout.segments.length - 1];

  return !segment?.collapsed;
}

function getOffHoursBarTop(segment: ScheduleDisplaySegment) {
  const barHeight = 8;
  if (segment.collapsed) return segment.top + Math.max(0, (segment.height - barHeight) / 2);
  if (segment.key === "after") return segment.top + Math.max(0, segment.height - barHeight - 4);
  return segment.top + 4;
}

function getOffHoursToggleTop(segment: ScheduleDisplaySegment, bodyHeight: number) {
  if (segment.collapsed && (segment.key === "after" || segment.key === "allDay")) {
    return Math.max(segment.top, bodyHeight - 30);
  }
  return segment.collapsed ? segment.top + Math.max(0, (segment.height - 22) / 2) : getOffHoursBarTop(segment);
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
  bookings,
  staff,
  visibleStaff,
  activeMetric,
  manualApprovalEnabled,
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
  activeMetric: SummaryMetricKey;
  manualApprovalEnabled: boolean;
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
  const [verticalScrollbarWidth, setVerticalScrollbarWidth] = useState(0);
  const [draggingBookingId, setDraggingBookingId] = useState<string | null>(null);
  const [resizingBooking, setResizingBooking] = useState<BookingResizeState | null>(null);
  const [boardPanning, setBoardPanning] = useState(false);
  const [expandedMicroBookingId, setExpandedMicroBookingId] = useState<string | null>(null);
  const [expandedOffHours, setExpandedOffHours] = useState<ExpandedOffHours>({
    before: false,
    after: false,
    allDay: false,
  });
    const scheduleStaff = staff === "전체 직원" ? visibleStaff : visibleStaff.filter((item) => item.key === staff);
  const staffScopedBookings = bookings.filter((booking) => scheduleStaff.some((item) => item.key === booking.staffKey));
    const scheduleDisplayLayout = getScheduleDisplayLayout(operatingWindow, expandedOffHours);
    const nonOperatingBlocks = scheduleDisplayLayout.segments.filter((segment) => segment.kind === "off");
  const visibleBookings = staffScopedBookings.filter((booking) => isBookingVisibleInDisplayLayout(booking, scheduleDisplayLayout));
  const columnCount = scheduleStaff.length;
  const scrollable = columnCount > 4;
  const compactCards = columnCount >= 3;
  const columnFlexBasis = columnCount === 0
    ? "0 0 100%"
    : scrollable
      ? "0 0 calc((100% - 24px) / 4)"
      : `0 0 calc((100% - ${(columnCount - 1) * 8}px) / ${columnCount})`;
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
        if (segment.collapsed) return [];
        const start = Math.ceil(segment.start);
        const end = Math.floor(segment.end);
        return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index).filter((hour) => hour >= segment.start && hour <= segment.end);
      }),
    ),
  );

  function toggleOffHours(key: OffHoursRangeKey) {
    setExpandedOffHours((current) => ({ ...current, [key]: !current[key] }));
  }

  function renderScheduleLines(prefix: string) {
    return scheduleDisplayLayout.segments.flatMap((segment) => {
      if (segment.collapsed) return [];
      const segmentCount = Math.round((segment.end - segment.start) * 4);
      return Array.from({ length: segmentCount + 1 }).map((_, index) => (
        <div
          key={`${prefix}-line-${segment.key}-${index}`}
          className={cn(
            "absolute left-0 right-0 border-t",
            index % 4 === 0 ? "border-[#edf2f7]" : "border-[#f6f8fa]",
          )}
          style={{ top: segment.top + index * quarterSlotHeight }}
        />
      ));
    });
  }

  function renderOffHoursColumnBars(prefix: string) {
    return nonOperatingBlocks.map((segment) => (
      <div
        key={`${prefix}-off-bar-${segment.key}`}
        className={cn(
          "pointer-events-none absolute z-[4] rounded-full",
          segment.collapsed ? "left-2 right-4 bg-[#dbe2ea]" : "right-3 w-[24px] bg-transparent",
        )}
        style={{ top: getOffHoursBarTop(segment), height: segment.collapsed ? 8 : 22 }}
        aria-hidden="true"
      />
    ));
  }

  function renderOffHoursToggleControls(prefix: string) {
    return nonOperatingBlocks.map((segment) => (
      <button
        key={`${prefix}-off-toggle-${segment.key}`}
        type="button"
        aria-label={`${getSegmentLabel(segment)} ${segment.collapsed ? "펼치기" : "접기"}`}
        title={`${getSegmentLabel(segment)} ${segment.collapsed ? "펼치기" : "접기"}`}
        onClick={(event) => {
          event.stopPropagation();
          toggleOffHours(segment.key as OffHoursRangeKey);
        }}
        className={cn(
          "absolute z-[30] flex items-center justify-center overflow-visible rounded-full text-[#64748b] transition hover:text-[#475569]",
          segment.collapsed
            ? "right-1 w-[24px] bg-transparent"
            : "right-1 w-[24px] bg-white/95 shadow-[0_1px_5px_rgba(15,23,42,0.14)] ring-1 ring-[#dbe2ea] hover:bg-[#f8fafc]",
        )}
        style={{ top: getOffHoursToggleTop(segment, scheduleBodyHeight), height: 22 }}
      >
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#c4ceda] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.18)]">
          {segment.collapsed ? <ChevronDown className="h-[13px] w-[13px]" strokeWidth={2.8} /> : <ChevronUp className="h-[13px] w-[13px]" strokeWidth={2.8} />}
        </span>
      </button>
    ));
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
    const viewport = timelineViewportRef.current;
    if (!scroller) return;

    const updateMeasurements = () => {
      const nextWidth = Math.round(scroller.clientWidth);
      if (nextWidth > 0) {
        setScheduleTrackWidth(nextWidth);
      }
      if (viewport) {
        setVerticalScrollbarWidth(Math.max(0, viewport.offsetWidth - viewport.clientWidth));
      }
    };

    updateMeasurements();
    const resizeObserver = new ResizeObserver(updateMeasurements);
    resizeObserver.observe(scroller);
    if (viewport) {
      resizeObserver.observe(viewport);
    }

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

  function handleColumnDrop(event: DragEvent<HTMLElement>, staffMember: OwnerWebStaffColumn) {
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
    if (
      hasStaffBookingConflict(conflictBookings, bookingId, {
        staffKey: staffMember.key,
        start: nextStart,
        duration: booking.duration,
      })
    ) {
      onSelectBooking(bookingId);
      setDraggingBookingId(null);
      return;
    }

    onMoveBooking(bookingId, {
      staffKey: staffMember.key,
      staffName: staffMember.name,
      staff: staffMember.name,
      start: nextStart,
    });
    onSelectStaff(staffMember.key);
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
      <div className="flex shrink-0 bg-white">
        <div className="flex w-[76px] shrink-0 items-center justify-center border-r border-[#edf2f7] bg-white px-2 pt-2">
          <span className="inline-flex h-[40px] w-full items-center justify-center rounded-t-[8px] bg-white text-[12px] text-[#64748b]">
            시간
          </span>
        </div>
        <div
          ref={headerScrollerRef}
          onScroll={() => syncHorizontalScroll("header")}
          className="no-scrollbar min-w-0 flex-1 overflow-x-auto"
        >
          <div className="flex min-w-full gap-2 px-2 pb-0 pt-2 pr-9" style={scheduleTrackStyle}>
            {scheduleStaff.map((staffMember, staffIndex) => {
              const staffBookings = displayedVisibleBookings.filter((booking) => booking.staffKey === staffMember.key);
              const selectedStaff = selectedStaffKey === staffMember.key;
              const staffTone = getStaffChipTone(staffMember.key, staffMember.chipColorIndex ?? staffIndex);

              return (
                <section
                  key={staffMember.key}
                  onClick={() => onSelectStaff(staffMember.key)}
                  className={cn(
                    "min-w-[136px] cursor-pointer rounded-t-[8px] border border-b-0 px-2.5 py-1.5 transition hover:brightness-[0.98]",
                    selectedStaff && "shadow-[0_1px_0_rgba(15,23,42,0.04)] ring-1 ring-inset ring-white/45",
                  )}
                  style={{
                    flex: columnFlexBasis,
                    borderColor: staffTone.selectedBackground,
                    backgroundColor: staffTone.selectedBackground,
                  }}
                >
                  <div className="grid min-h-[42px] grid-cols-[30px_minmax(0,1fr)] items-center gap-2">
                    <span
                      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full border text-[13px] font-medium"
                      style={{
                        borderColor: "rgba(255,255,255,0.72)",
                        backgroundColor: "rgba(255,255,255,0.18)",
                        color: "#ffffff",
                      }}
                    >
                      {staffMember.profileImageUrl ? (
                        <img src={staffMember.profileImageUrl} alt={`${staffMember.name} 프로필`} className="h-full w-full object-cover" />
                      ) : (
                        getStaffInitial(staffMember.name)
                      )}
                    </span>
                    <div className="min-w-0">
                      <p
                        className="min-w-0 truncate text-[13px] font-semibold leading-[17px]"
                        style={{ color: "#ffffff" }}
                      >
                        {staffMember.name}
                      </p>
                      <p
                        className="min-w-0 truncate text-[11px] leading-[15px]"
                        style={{ color: "rgba(255,255,255,0.84)" }}
                      >
                        예약 {staffBookings.length}건
                      </p>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
        {verticalScrollbarWidth > 0 ? (
          <div className="shrink-0 bg-white" style={{ width: verticalScrollbarWidth }} aria-hidden="true" />
        ) : null}
      </div>

      <div
        ref={timelineViewportRef}
        onPointerDown={handleBoardPanPointerDown}
        onPointerMove={handleBoardPanPointerMove}
        onPointerUp={stopBoardPan}
        onPointerCancel={stopBoardPan}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto select-none",
          boardPanning && "cursor-grabbing snap-none",
          !boardPanning && scrollable && "cursor-grab",
        )}
      >
        <div className="flex">
          <div className="w-[76px] shrink-0 border-r border-[#edf2f7] bg-white px-2">
            <div className="relative" style={{ height: scheduleBodyHeight }}>
              {renderScheduleLines("time-rail")}
              {expandedTimeHours.map((hour) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 flex items-center gap-1 text-[12px] leading-none text-[#64748b]"
                  style={{ top: getHourTop(hour, scheduleDisplayLayout), transform: "translateY(-50%)" }}
                >
                  <span className="h-px flex-1 bg-[#edf2f7]" aria-hidden="true" />
                  <span className="shrink-0 bg-white px-1">{formatHourLabel(hour)}</span>
                  <span className="h-px flex-1 bg-[#edf2f7]" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>

          <div
            ref={bodyScrollerRef}
            data-schedule-scroller="true"
            onScroll={() => syncHorizontalScroll("body")}
            className="no-scrollbar min-w-0 flex-1 overflow-x-auto scroll-px-4"
          >
            <div className="relative min-w-full" style={scheduleTrackStyle}>
              {renderOffHoursToggleControls("schedule-body")}
              <div className="flex min-w-full gap-2 px-2 pb-2 pt-0 pr-9">
              {scheduleStaff.length === 0 ? (
                <section className="flex min-h-[360px] flex-1 items-center justify-center rounded-b-[8px] bg-white">
                  <div className="rounded-[8px] border border-dashed border-[#cbd5e1] bg-white px-5 py-4 text-center">
                    <p className="text-[14px] font-medium text-[#111827]">등록된 직원가 없습니다.</p>
                    <p className="mt-1 text-[13px] text-[#64748b]">아직 오늘 예약이 없습니다.</p>
                  </div>
                </section>
              ) : null}
              {scheduleStaff.map((staffMember) => {
                const staffBookings = displayedVisibleBookings
                  .filter((booking) => booking.staffKey === staffMember.key)
                  .sort((a, b) => a.start - b.start);
                const bookingLayouts = getStaffBookingLayouts(staffBookings);
                const selectedStaff = selectedStaffKey === staffMember.key;
                return (
                  <section
                    key={staffMember.key}
                    onClick={() => onSelectStaff(staffMember.key)}
                    onDragOver={handleColumnDragOver}
                    onDrop={(event) => handleColumnDrop(event, staffMember)}
                    className={cn(
                      "min-w-0 cursor-pointer rounded-b-[8px] border border-t-0 bg-white p-0 transition",
                      selectedStaff && "ring-1 ring-inset ring-[#cfd8e3]",
                      draggingBookingId && "ring-1 ring-inset ring-[#cfd8e3]",
                    )}
                    style={{ flex: columnFlexBasis, borderColor: "#dbe2ea" }}
                  >
                    <div className="relative" style={{ height: scheduleBodyHeight }}>
                      {renderOffHoursColumnBars(staffMember.key)}
                      {renderScheduleLines(staffMember.key)}
                      {staffBookings.length === 0 ? (
                        <div className="rounded-[8px] border border-dashed border-[#e5eaf0] bg-white px-3 py-4 text-center text-[12px] text-[#94a3b8]">
                          예약 없음
                        </div>
                      ) : (
                        staffBookings.map((booking) => {
                          const selected = selectedBookingId === booking.id;
                          const timeLabel = `${formatHourLabel(booking.start)}-${formatHourLabel(booking.start + booking.duration)}`;
                          const displayTimeLabel = booking.actualTimeLabel?.replace(/^실제\s*/, "") || timeLabel;
                          const changeStatus = isChangeBookingStatus(booking.status);
                          const cardTone = getBookingCardTone(booking.status);
                          const completedBooking = isCompletedBookingStatus(booking.sourceStatus ?? booking.status);
                          const canAdjustBookingTime = !changeStatus && !completedBooking;
                          const density = getBookingCardDensity(booking.duration);
                          const microCard = density === "micro";
                          const expandedMicro = density === "micro" && expandedMicroBookingId === booking.id;
                          const bookingHeight = getBookingHeight(booking.duration);
                          const bookingLayout = bookingLayouts.get(booking.id) ?? { lane: 0, laneCount: 1 };
                          const bookingLayoutStyle = getBookingLayoutStyle(bookingLayout.lane, bookingLayout.laneCount);
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
                                  onSelectStaff(booking.staffKey);
                                }}
                                className="absolute z-10 box-border flex h-[24px] items-center justify-center overflow-hidden rounded-full border border-[#dbe2ea] bg-white/90 px-2 text-[11px] leading-none text-[#607080] shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
                                style={{
                                  ...bookingLayoutStyle,
                                  top: getBookingTop(booking.start, scheduleDisplayLayout),
                                }}
                              >
                                <span className="min-w-0 truncate tabular-nums">
                                  예약 {booking.scheduledTimeLabel ?? timeLabel}
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
                                onSelectStaff(booking.staffKey);
                                setExpandedMicroBookingId(density === "micro" ? booking.id : null);
                              }}
                              className={cn(
                                "absolute z-20 box-border cursor-grab overflow-hidden rounded-[8px] border p-0 text-left transition-all active:cursor-grabbing",
                                !canAdjustBookingTime && "cursor-pointer active:cursor-pointer",
                                resizingBooking?.bookingId === booking.id && "cursor-ns-resize",
                                canAdjustBookingTime && "hover:-translate-y-0.5",
                                draggingBookingId === booking.id && "opacity-70 ring-1 ring-[#8ab9ab]/24",
                                expandedMicro &&
                                  (cardTone === "active"
                                    ? "z-50 shadow-none ring-1 ring-[#8ab9ab]/22"
                                    : "z-50 shadow-[0_16px_28px_rgba(15,23,42,0.12)] ring-1 ring-[#8ab9ab]/22"),
                                getBookingCardToneClass(cardTone, selected),
                                getWrapIndicatorClass(getBookingIndicatorTone(cardTone)),
                              )}
                              style={{
                                ...bookingLayoutStyle,
                                top: getBookingTop(booking.start, scheduleDisplayLayout),
                                height: bookingHeight,
                              }}
                            >
                              <div className="absolute inset-0 flex min-h-0 min-w-0 items-center overflow-hidden pl-4 pr-3 text-left">
                                <div
                                  className={cn(
                                    "grid w-full min-w-0 items-center gap-x-2",
                                    microCard ? "grid-cols-[minmax(0,1fr)_max-content]" : "grid-cols-[minmax(0,1fr)_auto]",
                                    microCard ? "grid-rows-[17px]" : "grid-rows-[17px_17px] gap-y-[2px]",
                                  )}
                                >
                                  <p
                                    className={cn(
                                      "min-w-0 truncate text-[13px] font-medium leading-[17px]",
                                      cardTone === "completed" ? "text-[#6b7280]" : "text-[#0f172a]",
                                    )}
                                  >
                                    {`${booking.pet} · ${booking.customer}`}
                                  </p>
                                  <span
                                    className={cn(
                                      "shrink-0 justify-self-end text-[13px] leading-[17px]",
                                      microCard
                                        ? "max-w-[92px] truncate whitespace-nowrap text-[#64748b]"
                                        : `relative -top-px whitespace-nowrap font-medium tabular-nums ${getBookingTimeTextClass(cardTone)}`,
                                    )}
                                  >
                                    {microCard ? booking.service : displayTimeLabel}
                                  </span>
                                  {!microCard ? (
                                    <div className="col-span-2 flex min-w-0 items-center gap-1.5">
                                      <span
                                        className={cn(
                                          "shrink-0 rounded-[6px] border px-2 py-[2px] text-[11px] font-semibold leading-none shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
                                          statusPillClass,
                                        )}
                                      >
                                        {statusLabel}
                                      </span>
                                      {pendingOverlapLabel ? (
                                        <span className="shrink-0 rounded-[6px] border border-[#e8c67e] bg-[#fffaf0] px-1.5 py-0.5 text-[11px] leading-none text-[#9a640f]">
                                          {pendingOverlapLabel}
                                        </span>
                                      ) : null}
                                      <p className="min-w-0 truncate text-[13px] leading-[16px] text-[#64748b]">
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
                                  <span className={cn("h-[5px] w-10 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.88)]", getBookingResizeHandleClass(cardTone))} />
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


