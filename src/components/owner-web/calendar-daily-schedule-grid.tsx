"use client";

import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { OwnerWebStaffColumn } from "@/components/owner-web/owner-web-staff-data";
import { getStaffChipTone } from "@/lib/staff-chip-colors";
import { getWrapIndicatorClass, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { cn } from "@/lib/utils";

type SummaryMetricKey = "today" | "completed" | "changes";
type BookingCardTone =
  | "pending"
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
};

const scheduleStartHour = 10;
const scheduleEndHour = 24;
const pixelsPerHour = 86.4;
const scheduleBodyInsetY = 8;
const scheduleGridHeight = (scheduleEndHour - scheduleStartHour) * pixelsPerHour;
const scheduleBodyHeight = scheduleGridHeight + scheduleBodyInsetY * 2;
const quarterSlotHeight = pixelsPerHour / 4;
const scheduleSnapSegmentsPerHour = 4;
const expandableBookingDurationMax = 0.25;
const bookingCardWidth = "95%";
const bookingCardHorizontalInset = "2.5%";
const timeRailHours = Array.from({ length: scheduleEndHour - scheduleStartHour + 1 }, (_, index) => `${scheduleStartHour + index}:00`);

function formatHourLabel(hour: number) {
  const fullHour = Math.floor(hour);
  const minute = Math.round((hour - fullHour) * 60);
  return `${String(fullHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isActiveBookingStatus(status: string) {
  return status === "진행 중" || status === "픽업 준비";
}

function isPendingBookingStatus(status: string) {
  return status === "승인 대기";
}

function isOverduePendingBookingStatus(status: string) {
  return status === "누락";
}

function isApprovalQueueBookingStatus(status: string) {
  return isPendingBookingStatus(status) || isOverduePendingBookingStatus(status);
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
  if (booking.status !== "확정") return booking.status;
  if (selectedDate !== new Date().toLocaleDateString("en-CA")) return booking.status;
  if (currentHour > booking.start + booking.duration) return "시작 지연";
  return booking.status;
}

function getBookingCardTone(status: string): BookingCardTone {
  if (status === "시작 지연") return "missed";
  if (isOverduePendingBookingStatus(status)) return "missed";
  if (isPendingBookingStatus(status)) return "pending";
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
    pending: "bg-[#fffdf7]",
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
  if (status === "시작 지연") return "지연";
  if (isOverduePendingBookingStatus(status)) return "누락";
  if (status === "승인 대기") return "대기";
  return status;
}

function getReservationStatusPillClass(booking: DailyBooking, selectedDate: string, currentHour: number) {
  const status = getTimedBookingStatus(booking, selectedDate, currentHour);
  if (status === "승인 대기") return "border-[#fde68a] bg-[#fffbeb] text-[#b45309]";
  if (isOverduePendingBookingStatus(status)) return "border-[#fbcfe8] bg-[#fdf2f8] text-[#be185d]";
  if (status === "시작 지연") return "border-[#fbcfe8] bg-[#fdf2f8] text-[#be185d]";
  if (status === "확정") return "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]";
  if (status === "진행 중") return "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]";
  if (status === "픽업 준비") return "border-[#a5f3fc] bg-[#ecfeff] text-[#0e7490]";
  if (status === "완료") return "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]";
  if (status.includes("변경")) return "border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]";
  if (status.includes("취소")) return "border-[#fecdd3] bg-[#fff1f2] text-[#be123c]";
  if (status.includes("거절")) return "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]";
  if (status.includes("노쇼")) return "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]";
  return "border-[#dbe2ea] bg-[#f8fafc] text-[#334155]";
}

function getBookingResizeHandleClass(tone: BookingCardTone) {
  if (tone === "pending") return "bg-[#f59e0b]/72";
  if (tone === "confirmed") return "bg-[#2563eb]/70";
  if (tone === "active") return "bg-[#16a34a]/72";
  if (tone === "pickupReady") return "bg-[#0891b2]/72";
  if (tone === "completed") return "bg-[#64748b]/62";
  if (tone === "changed") return "bg-[#7c3aed]/70";
  if (tone === "cancelled") return "bg-[#e11d48]/68";
  if (tone === "rejected") return "bg-[#b91c1c]/68";
  if (tone === "noshow") return "bg-[#ea580c]/70";
  return "bg-[#db2777]/70";
}

function getBookingTimeTextClass(tone: BookingCardTone) {
  if (tone === "pending") return "text-[#b45309]";
  if (tone === "confirmed") return "text-[#1d4ed8]";
  if (tone === "active") return "text-[#15803d]";
  if (tone === "pickupReady") return "text-[#0e7490]";
  if (tone === "completed") return "text-[#64748b]";
  if (tone === "changed") return "text-[#6d28d9]";
  if (tone === "cancelled") return "text-[#be123c]";
  if (tone === "rejected") return "text-[#991b1b]";
  if (tone === "noshow") return "text-[#c2410c]";
  return "text-[#be185d]";
}

function getBookingTop(start: number) {
  return scheduleBodyInsetY + (start - scheduleStartHour) * pixelsPerHour;
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

function getSnappedBookingStart(pointerY: number, columnTop: number, duration: number) {
  const rawHour = scheduleStartHour + (pointerY - columnTop - scheduleBodyInsetY) / pixelsPerHour;
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
  const scheduleStaff = staff === "전체 직원" ? visibleStaff : visibleStaff.filter((item) => item.key === staff);
  const staffScopedBookings = bookings.filter((booking) => scheduleStaff.some((item) => item.key === booking.staffKey));
  const visibleBookings = staffScopedBookings;
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

    const columnRect = event.currentTarget.getBoundingClientRect();
    const nextStart = getSnappedBookingStart(event.clientY, columnRect.top, booking.duration);
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
        <div className="flex w-[64px] shrink-0 items-center justify-center border-r border-[#edf2f7] bg-white px-2 pt-2">
          <span className="inline-flex h-[40px] w-full items-center justify-center rounded-t-[8px] bg-white text-[12px] text-[#64748b]">
            시간
          </span>
        </div>
        <div
          ref={headerScrollerRef}
          onScroll={() => syncHorizontalScroll("header")}
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-full gap-2 px-2 pb-0 pt-2 pr-4" style={scheduleTrackStyle}>
            {scheduleStaff.map((staffMember, staffIndex) => {
              const staffBookings = displayedVisibleBookings.filter((booking) => booking.staffKey === staffMember.key);
                const pendingStatusCount = staffBookings.filter((booking) => isApprovalQueueBookingStatus(booking.status)).length;
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
                        예약 {staffBookings.length}건 · 대기 {pendingStatusCount}건
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
          <div className="w-[64px] shrink-0 border-r border-[#edf2f7] bg-white px-2">
            <div className="relative" style={{ height: scheduleBodyHeight }}>
              {Array.from({ length: (scheduleEndHour - scheduleStartHour) * 4 + 1 }).map((_, index) => (
                <div
                  key={`time-rail-line-${index}`}
                  className={cn(
                    "absolute left-0 right-0 border-t",
                    index % 4 === 0 ? "border-[#e5eaf0]" : "border-[#f2f5f8]",
                  )}
                  style={{ top: scheduleBodyInsetY + index * quarterSlotHeight }}
                />
              ))}
              {timeRailHours.map((hour) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 flex items-center gap-1 text-[12px] leading-none text-[#64748b]"
                  style={{ top: scheduleBodyInsetY + (Number(hour.slice(0, 2)) - scheduleStartHour) * pixelsPerHour, transform: "translateY(-50%)" }}
                >
                  <span className="h-px flex-1 bg-[#edf2f7]" aria-hidden="true" />
                  <span className="shrink-0 bg-white px-1">{hour}</span>
                  <span className="h-px flex-1 bg-[#edf2f7]" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>

          <div
            ref={bodyScrollerRef}
            data-schedule-scroller="true"
            onScroll={() => syncHorizontalScroll("body")}
            className="min-w-0 flex-1 overflow-x-auto scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-w-full gap-2 px-2 pb-2 pt-0 pr-4" style={scheduleTrackStyle}>
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
                      {Array.from({ length: (scheduleEndHour - scheduleStartHour) * 4 + 1 }).map((_, index) => (
                        <div
                          key={`${staffMember.key}-line-${index}`}
                          className={cn(
                            "absolute left-0 right-0 border-t",
                            index % 4 === 0 ? "border-[#edf2f7]" : "border-[#f6f8fa]",
                          )}
                          style={{ top: scheduleBodyInsetY + index * quarterSlotHeight }}
                        />
                      ))}
                      {staffBookings.length === 0 ? (
                        <div className="rounded-[8px] border border-dashed border-[#e5eaf0] bg-white px-3 py-4 text-center text-[12px] text-[#94a3b8]">
                          예약 없음
                        </div>
                      ) : (
                        staffBookings.map((booking) => {
                          const selected = selectedBookingId === booking.id;
                          const timeLabel = `${formatHourLabel(booking.start)}-${formatHourLabel(booking.start + booking.duration)}`;
                          const changeStatus = isChangeBookingStatus(booking.status);
                          const cardTone = getBookingCardTone(booking.status);
                          const density = getBookingCardDensity(booking.duration);
                          const microCard = density === "micro";
                          const expandedMicro = density === "micro" && expandedMicroBookingId === booking.id;
                          const bookingHeight = getBookingHeight(booking.duration);
                          const bookingLayout = bookingLayouts.get(booking.id) ?? { lane: 0, laneCount: 1 };
                          const bookingLayoutStyle = getBookingLayoutStyle(bookingLayout.lane, bookingLayout.laneCount);
                          const statusLabel = getReservationStatusLabel(booking, selectedDate, currentHour);
                          const statusPillClass = getReservationStatusPillClass(booking, selectedDate, currentHour);
                          const pendingOverlapLabel = getPendingOverlapLabel(booking, conflictBookings);

                          return (
                            <button
                              key={booking.id}
                              type="button"
                              draggable={!resizingBooking && !changeStatus}
                              data-booking-id={booking.id}
                              data-booking-duration={booking.duration}
                              onDragStart={(event) => handleBookingDragStart(event, booking.id)}
                              onDragEnd={() => setDraggingBookingId(null)}
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelectBooking(booking.id);
                                onSelectStaff(booking.staffKey);
                                setExpandedMicroBookingId(density === "micro" && cardTone !== "pending" ? booking.id : null);
                              }}
                              className={cn(
                                "absolute z-20 box-border cursor-grab overflow-hidden rounded-[8px] border p-0 text-left transition-all active:cursor-grabbing",
                                changeStatus && "cursor-default active:cursor-default",
                                resizingBooking?.bookingId === booking.id && "cursor-ns-resize",
                                cardTone !== "pending" && !changeStatus && "hover:-translate-y-0.5",
                                draggingBookingId === booking.id && "opacity-70 ring-1 ring-[#8ab9ab]/24",
                                expandedMicro &&
                                  (cardTone === "pending"
                                    ? "z-50 ring-1 ring-[#f2c94c]/18"
                                    : cardTone === "active"
                                      ? "z-50 shadow-none ring-1 ring-[#8ab9ab]/22"
                                      : "z-50 shadow-[0_16px_28px_rgba(15,23,42,0.12)] ring-1 ring-[#8ab9ab]/22"),
                                getBookingCardToneClass(cardTone, selected),
                                getWrapIndicatorClass(getBookingIndicatorTone(cardTone)),
                              )}
                              style={{
                                ...bookingLayoutStyle,
                                top: getBookingTop(booking.start),
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
                                    {microCard ? booking.service : timeLabel}
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
                              {selected && !changeStatus ? (
                                <div
                                  role="separator"
                                  aria-label="예약 종료 시간 조정"
                                  aria-orientation="horizontal"
                                  onPointerDown={(event) => handleResizePointerDown(event, booking)}
                                  onPointerMove={handleResizePointerMove}
                                  onPointerUp={finishResizeBooking}
                                  onPointerCancel={finishResizeBooking}
                                  className="absolute inset-x-3 bottom-0 z-30 flex h-3 cursor-ns-resize touch-none items-end justify-center pb-1"
                                >
                                  <span className={cn("h-1 w-10 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.88)]", getBookingResizeHandleClass(cardTone))} />
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
  );
}


