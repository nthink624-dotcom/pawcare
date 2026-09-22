"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Appointment, StaffScheduleOverride } from "@/types/domain";
import { addDate, currentDateInTimeZone, currentMinutesInTimeZone } from "@/lib/utils";
import { assignAppointmentsToStaffLanes } from "@/lib/owner-schedule-lanes";
import { getAdjacentScheduleCardEdgeInsets } from "@/lib/owner-schedule-card-gaps";
import { getReservationDateDisplay } from "@/lib/reservation-date-display";
import { getAppointmentIdentityTone } from "@/lib/appointment-identity-colors";
import { StaffProfilePhoto } from "@/components/owner/staff-profile-photo";

const START_HOUR = 9;
const END_HOUR = 19;
const HOUR_HEIGHT = 72;
const BOARD_TOP_PADDING = 16;
// This is clearance after the real 19:00 boundary, not an additional booking slot.
// It keeps the final label and grid edge above the fixed bottom navigation and FAB.
const BOARD_BOTTOM_CLEARANCE = 72;
const BOARD_HEIGHT = BOARD_TOP_PADDING + (END_HOUR - START_HOUR) * HOUR_HEIGHT + BOARD_BOTTOM_CLEARANCE;
const CURRENT_TIME_LABEL_COLLISION_DISTANCE = 24;

const STATUS_PRESENTATION: Record<Appointment["status"], { label: string; compactLabel: string; color: string; badgeBackground: string; badgeBorder: string }> = {
  pending: { label: "승인 대기", compactLabel: "대기", color: "#8a5b11", badgeBackground: "#fffaf0", badgeBorder: "#ead9b8" },
  confirmed: { label: "예약 확정", compactLabel: "확정", color: "#24784b", badgeBackground: "#f5fbf7", badgeBorder: "#cfe3d7" },
  in_progress: { label: "진행 중", compactLabel: "진행", color: "#2563eb", badgeBackground: "#f5f8fe", badgeBorder: "#cdddf7" },
  almost_done: { label: "픽업 준비", compactLabel: "픽업", color: "#6d50a0", badgeBackground: "#faf8fd", badgeBorder: "#ddd3f1" },
  completed: { label: "미용 완료", compactLabel: "완료", color: "#64748b", badgeBackground: "#f8f9fa", badgeBorder: "#d9e0e7" },
  cancelled: { label: "취소", compactLabel: "취소", color: "#a04455", badgeBackground: "#fff8fa", badgeBorder: "#ead6dc" },
  rejected: { label: "거절", compactLabel: "거절", color: "#a04455", badgeBackground: "#fff8fa", badgeBorder: "#ead6dc" },
  noshow: { label: "노쇼", compactLabel: "노쇼", color: "#a04455", badgeBackground: "#fff8fa", badgeBorder: "#ead6dc" },
};

const DETAILED_BOOKING_MINUTES = 90;

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type StaffOption = {
  id: string;
  label: string;
  color?: string;
  background?: string;
  bookingBackground?: string;
  bookingBorder?: string;
  profileImageUrl?: string | null;
  profileImageFallbackKey?: string | null;
  startTime?: string;
  endTime?: string;
  unavailable?: boolean;
};
type LaneItem = { appointment: Appointment; column: number; collisionColumns: number };

type Props = {
  date: string;
  appointments: Appointment[];
  petNames: Record<string, string>;
  guardianNames: Record<string, string>;
  serviceNames: Record<string, string>;
  serviceDurations: Record<string, number>;
  staffOptions: StaffOption[];
  selectedStaffId: string;
  staffScheduleOverrides: StaffScheduleOverride[];
  isShopClosed: boolean;
  onSelectStaff: (staffId: string) => void;
  onSelectDate: (date: string) => void;
  onOpenDatePicker: () => void;
  onOpenAppointment: (appointment: Appointment) => void;
};

function clockMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function appointmentDuration(appointment: Appointment, serviceDurations: Record<string, number>) {
  const start = clockMinutes(appointment.appointment_time);
  const end = appointment.end_at ? new Date(appointment.end_at) : null;
  const startAt = appointment.start_at ? new Date(appointment.start_at) : null;
  if (end && startAt && Number.isFinite(end.getTime()) && Number.isFinite(startAt.getTime())) {
    return Math.max(15, Math.round((end.getTime() - startAt.getTime()) / 60_000));
  }
  return Math.max(15, serviceDurations[appointment.service_id] ?? 60);
}

function formatClock(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

function weekdayLabel(value: string) {
  return WEEKDAY_LABELS[new Date(`${value}T00:00:00`).getDay()] ?? "";
}

function weekDatesFor(value: string) {
  const selectedDayIndex = new Date(`${value}T00:00:00`).getDay();
  return Array.from({ length: 7 }, (_, index) => addDate(value, index - selectedDayIndex));
}

function currentTimeBadgeOverlapsHourLabel(currentTop: number, hourTop: number) {
  return Math.abs(currentTop - hourTop) < CURRENT_TIME_LABEL_COLLISION_DISTANCE;
}

function assignCollisionColumns(appointments: Appointment[], serviceDurations: Record<string, number>): LaneItem[] {
  const active: Array<{ end: number; column: number }> = [];
  return [...appointments]
    .sort((a, b) => clockMinutes(a.appointment_time) - clockMinutes(b.appointment_time))
    .map((appointment) => {
      const start = clockMinutes(appointment.appointment_time);
      const end = start + appointmentDuration(appointment, serviceDurations);
      for (let index = active.length - 1; index >= 0; index -= 1) {
        if (active[index].end <= start) active.splice(index, 1);
      }
      const used = new Set(active.map((item) => item.column));
      let column = 0;
      while (used.has(column)) column += 1;
      active.push({ end, column });
      return { appointment, column, collisionColumns: Math.max(column + 1, active.length) };
    });
}

function ScheduleLane({
  appointments,
  petNames,
  guardianNames,
  serviceNames,
  serviceDurations,
  onOpenAppointment,
}: Pick<Props, "petNames" | "guardianNames" | "serviceNames" | "serviceDurations" | "onOpenAppointment"> & {
  appointments: Appointment[];
}) {
  const items = assignCollisionColumns(appointments, serviceDurations);
  const cardEdgeInsets = getAdjacentScheduleCardEdgeInsets(
    items.map(({ appointment, column }) => {
      const startMinutes = clockMinutes(appointment.appointment_time);
      return {
        id: appointment.id,
        column,
        startMinutes,
        endMinutes: startMinutes + appointmentDuration(appointment, serviceDurations),
      };
    }),
  );
  return (
    <div className="absolute inset-0">
      {items.map(({ appointment, column, collisionColumns }) => {
        const start = clockMinutes(appointment.appointment_time);
        const minutes = appointmentDuration(appointment, serviceDurations);
        const top = BOARD_TOP_PADDING + ((start - START_HOUR * 60) / 60) * HOUR_HEIGHT;
        const height = (minutes / 60) * HOUR_HEIGHT;
        const status = STATUS_PRESENTATION[appointment.status];
        const identityTone = getAppointmentIdentityTone(appointment.pet_id || appointment.id);
        const completed = appointment.status === "completed";
        const detailedCard = minutes >= DETAILED_BOOKING_MINUTES;
        const memo = appointment.memo?.trim() ?? "";
        const memoLabel = memo ? `고객 메모 ${memo}` : "고객 메모 없음";
        const width = 100 / collisionColumns;
        const edgeInsets = cardEdgeInsets.get(appointment.id) ?? { top: 0, bottom: 0 };
        return (
          <button
            key={appointment.id}
            type="button"
            data-appointment-id={appointment.id}
            data-booking-density={detailedCard ? "detailed" : "compact"}
            onClick={() => onOpenAppointment(appointment)}
            className="absolute rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-1"
            style={{
              top,
              left: `calc(${column * width}% + 8px)`,
              width: `calc(${width}% - 12px)`,
              minHeight: Math.max(height, 44),
              zIndex: 2 + column,
            }}
          >
            <span
              data-testid="appointment-card-surface"
              className="absolute inset-x-0 overflow-hidden rounded-[10px] border border-l-[3px] px-2.5 py-1.5 shadow-none"
              style={{
                top: edgeInsets.top, bottom: edgeInsets.bottom,
                borderColor: identityTone.border,
                borderLeftColor: identityTone.accent,
                backgroundColor: completed ? identityTone.mutedBackground : identityTone.background,
              }}
            >
              {detailedCard ? (
                <span className="flex min-w-0 flex-col">
                  <span className="flex min-w-0 items-center justify-between gap-1.5 text-[12px] font-medium leading-[18px] [font-variant-numeric:tabular-nums]">
                    <span className="truncate text-[#526174]">{appointment.appointment_time.slice(0, 5)}</span>
                    <span
                      data-testid="appointment-status-badge"
                      className="shrink-0 rounded-full border px-1.5 leading-[18px]"
                      style={{ color: status.color, backgroundColor: status.badgeBackground, borderColor: status.badgeBorder }}
                    >
                      {status.label}
                    </span>
                  </span>
                  <span className="block truncate text-[14px] font-medium leading-5" style={{ color: completed ? "#64748b" : identityTone.text }}>
                    {petNames[appointment.pet_id] ?? "반려동물"} · {guardianNames[appointment.guardian_id] ?? "보호자"}
                  </span>
                  <span className="block truncate text-[13px] font-normal leading-5 text-[#526174]">
                    {serviceNames[appointment.service_id] ?? "서비스"}
                  </span>
                  <span className="block truncate text-[12px] font-normal leading-[18px] text-[#64748b]" title={memoLabel} aria-label={memoLabel} data-booking-customer-memo={memo ? "present" : "empty"}>
                    <span className="font-medium text-[#475569]">고객 메모</span>{" "}{memo || "없음"}
                  </span>
                </span>
              ) : (
                <span className="flex h-full min-w-0 items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium leading-5" style={{ color: completed ? "#64748b" : identityTone.text }}>
                    {petNames[appointment.pet_id] ?? "반려동물"}
                  </span>
                  <span className="shrink-0 text-[12px] font-medium leading-[18px] text-[#526174] [font-variant-numeric:tabular-nums]">
                    {appointment.appointment_time.slice(0, 5)}
                  </span>
                  <span
                    data-testid="appointment-status-badge"
                    className="shrink-0 rounded-full border px-1.5 text-[11px] font-medium leading-[18px]"
                    style={{ color: status.color, backgroundColor: status.badgeBackground, borderColor: status.badgeBorder }}
                  >
                    {status.compactLabel}
                  </span>
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function OwnerBookingDaySchedule(props: Props) {
  const {
    date, appointments, petNames, guardianNames, serviceNames, serviceDurations, staffOptions,
    selectedStaffId, staffScheduleOverrides, isShopClosed, onSelectStaff, onSelectDate,
    onOpenDatePicker, onOpenAppointment,
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const laneDragRef = useRef<{
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
    verticalScrollContainer: HTMLElement | null;
    isHorizontal: boolean;
    isVertical: boolean;
    suppressClick: boolean;
    suppressClickTimer: number;
  }>({ pointerId: -1, pointerType: "", startX: 0, startY: 0, startScrollLeft: 0, startScrollTop: 0, verticalScrollContainer: null, isHorizontal: false, isVertical: false, suppressClick: false, suppressClickTimer: 0 });
  const [, setNow] = useState(() => new Date());
  const today = currentDateInTimeZone();
  const isToday = date === today;
  const { dateLabel } = getReservationDateDisplay(date, today);
  const selectedWeekdayLabel = weekdayLabel(date);
  const weekDates = useMemo(() => weekDatesFor(date), [date]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.appointment_date === date && appointment.status !== "rejected"),
    [appointments, date],
  );
  const laneOptions = useMemo(() => staffOptions.filter((staff) => staff.id !== "all"), [staffOptions]);
  const isSingleStaffLane = laneOptions.length === 1;
  const appointmentsByLane = useMemo(
    () => assignAppointmentsToStaffLanes(laneOptions.map((staff) => staff.id), visibleAppointments),
    [laneOptions, visibleAppointments],
  );
  useEffect(() => {
    const viewport = scrollRef.current;
    const selected = viewport?.querySelector<HTMLElement>(`[data-staff-id="${CSS.escape(selectedStaffId)}"]`);
    if (!viewport || !selected) return;
    const left = Math.max(0, Math.min(selected.offsetLeft - viewport.offsetLeft, viewport.scrollWidth - viewport.clientWidth));
    viewport.scrollTo({ left, behavior: "smooth" });
  }, [selectedStaffId]);

  const beginLaneDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const viewport = scrollRef.current;
    if (!viewport) return;
    const drag = laneDragRef.current;
    window.clearTimeout(drag.suppressClickTimer);
    drag.pointerId = event.pointerId;
    drag.pointerType = event.pointerType;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.startScrollLeft = viewport.scrollLeft;
    drag.verticalScrollContainer = viewport.closest("main");
    drag.startScrollTop = drag.verticalScrollContainer?.scrollTop ?? 0;
    drag.isHorizontal = false;
    drag.isVertical = false;
    drag.suppressClick = false;
  };

  const moveLaneDrag = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = scrollRef.current;
    const drag = laneDragRef.current;
    if (!viewport || drag.pointerId !== event.pointerId) return;
    const offsetX = event.clientX - drag.startX;
    const offsetY = event.clientY - drag.startY;
    if (!drag.isHorizontal && !drag.isVertical) {
      if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) < 8) return;
      if (Math.abs(offsetX) > Math.abs(offsetY)) {
        drag.isHorizontal = true;
      } else if (drag.pointerType === "mouse") {
        drag.isVertical = true;
      } else {
        return;
      }
      drag.suppressClick = true;
      viewport.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    if (drag.isHorizontal) viewport.scrollLeft = drag.startScrollLeft - offsetX;
    if (drag.isVertical && drag.verticalScrollContainer) drag.verticalScrollContainer.scrollTop = drag.startScrollTop - offsetY;
  };

  const endLaneDrag = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = scrollRef.current;
    const drag = laneDragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    drag.pointerId = -1;
    drag.verticalScrollContainer = null;
    if (drag.suppressClick) drag.suppressClickTimer = window.setTimeout(() => { drag.suppressClick = false; }, 0);
  };

  const suppressLaneClickAfterDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const drag = laneDragRef.current;
    if (!drag.suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    drag.suppressClick = false;
  };

  const nowMinutes = currentMinutesInTimeZone();
  const nowTop = BOARD_TOP_PADDING + ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const showNow = isToday && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;

  return (
    <section className="min-w-0 overflow-hidden bg-white text-[#172033]">
      <header data-testid="reservation-date-navigation" className="sticky top-[env(safe-area-inset-top)] z-40 border-b border-[#e8edf3] bg-white">
        <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 pt-1">
          <button type="button" aria-label={`${dateLabel} ${selectedWeekdayLabel}요일 날짜 선택`} onClick={onOpenDatePicker} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">
            <span data-testid="date-primary" className="whitespace-nowrap text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#172033] [font-variant-numeric:tabular-nums]">{dateLabel}</span>
            <span data-testid="weekday-label" className="whitespace-nowrap text-[14px] font-medium leading-5 text-[#64748b]">{selectedWeekdayLabel}</span>
          </button>
          <span data-testid="date-total" className="shrink-0 whitespace-nowrap text-[14px] font-medium leading-5 text-[#37557a] [font-variant-numeric:tabular-nums]">예약 {visibleAppointments.length}건</span>
        </div>
        <div data-testid="schedule-week-strip" className="grid grid-cols-7 gap-0.5 px-2 pb-2">
          {weekDates.map((optionDate) => {
            const isSelected = optionDate === date;
            const optionLabel = `${Number(optionDate.slice(5, 7))}월 ${Number(optionDate.slice(8, 10))}일 ${weekdayLabel(optionDate)}요일`;
            return (
              <button key={optionDate} type="button" aria-label={optionLabel} aria-current={isSelected ? "date" : undefined} onClick={() => onSelectDate(optionDate)} className="flex h-11 min-w-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-1">
                <span className={isSelected ? "flex h-9 w-9 items-center justify-center rounded-full bg-[#2f5fb3] text-[14px] font-medium leading-5 text-white [font-variant-numeric:tabular-nums]" : "flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-medium leading-5 text-[#25364d] [font-variant-numeric:tabular-nums]"}>{Number(optionDate.slice(8, 10))}</span>
              </button>
            );
          })}
        </div>
      </header>

      {laneOptions.length === 0 ? (
        <div className="flex min-h-44 items-center justify-center px-6 text-center text-[14px] leading-5 text-[#526174]">표시할 직원이 없습니다.</div>
      ) : (
        <div className="grid grid-cols-[48px_minmax(0,1fr)] min-[410px]:grid-cols-[52px_minmax(0,1fr)]">
          <div className="sticky left-0 z-30 border-r border-[#c8d1dc] bg-white">
            <div data-testid="time-header" className="flex h-16 items-center justify-center border-b border-[#d8dee7] bg-white text-[13px] font-medium leading-5 text-[#42526a]">시간</div>
            <div data-testid="time-rail" className="relative bg-white" style={{ height: BOARD_HEIGHT }}>
              {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
                const hourTop = BOARD_TOP_PADDING + index * HOUR_HEIGHT;
                return (
                  <span key={index} className="absolute inset-x-0 top-0 flex -translate-y-1/2 justify-center whitespace-nowrap text-[13px] font-medium leading-5 text-[#526174] [font-variant-numeric:tabular-nums]" style={{ top: hourTop, visibility: showNow && currentTimeBadgeOverlapsHourLabel(nowTop, hourTop) ? "hidden" : undefined }}>{formatClock(START_HOUR + index)}</span>
                );
              })}
              {showNow ? (
                <span data-testid="current-time-marker" className="absolute inset-x-0 z-20 flex -translate-y-1/2 items-center" style={{ top: nowTop }} aria-label={`현재 시간 ${formatMinutes(nowMinutes)}`}>
                  <span data-testid="current-time-label" className="relative z-10 inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full bg-[#2f5fb3] px-1.5 text-[13px] font-medium leading-5 text-white [font-variant-numeric:tabular-nums]">{formatMinutes(nowMinutes)}</span>
                  <span data-testid="current-time-line" className="h-px min-w-0 flex-1 bg-[#2f5fb3]" />
                </span>
              ) : null}
            </div>
          </div>

          <div ref={scrollRef} data-testid="staff-lane-scroller" tabIndex={0} aria-label="직원별 예약 시간표" onPointerDown={beginLaneDrag} onPointerMove={moveLaneDrag} onPointerUp={endLaneDrag} onPointerCancel={endLaneDrag} onClickCapture={suppressLaneClickAfterDrag} className="no-scrollbar min-w-0 overflow-x-auto overscroll-x-contain bg-white [touch-action:pan-y] [scroll-snap-type:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]">
            <div data-staff-lane-layout={isSingleStaffLane ? "single" : "multiple"} className={isSingleStaffLane ? "flex w-full min-w-full" : "flex w-max min-w-full"}>
              {laneOptions.map((staff) => {
                const laneAppointments = appointmentsByLane.get(staff.id) ?? [];
                const override = staffScheduleOverrides.find((item) => item.staff_id === staff.id && item.work_date === date);
                const unavailable = staff.unavailable ?? (isShopClosed || override?.status === "off" || override?.status === "annual");
                const workStart = override?.status === "work" ? override.start_time : staff.startTime;
                const workEnd = override?.status === "work" ? override.end_time : staff.endTime;
                const workHoursLabel = unavailable ? "근무하지 않음" : workStart && workEnd ? `${workStart.slice(0, 5)}–${workEnd.slice(0, 5)}` : "근무시간 미설정";
                const totalMinutes = laneAppointments.reduce((sum, appointment) => sum + appointmentDuration(appointment, serviceDurations), 0);
                const staffSummaryLabel = `${workHoursLabel} · ${laneAppointments.length}건 · ${formatDuration(totalMinutes)}`;
                return (
                  <div key={staff.id} data-staff-id={staff.id} data-lane-appointment-count={laneAppointments.length} className={isSingleStaffLane ? "w-full min-w-0 max-w-none flex-1 shrink-0 border-r border-[#d8dee7]" : "w-[calc((100vw-48px)*0.88)] min-w-[280px] max-w-[332px] shrink-0 snap-start border-r border-[#d8dee7] min-[410px]:w-[calc((100vw-52px)*0.88)] md:w-[280px]"}>
                    <button type="button" data-testid="staff-lane-chip" aria-label={`${staff.label}, ${staffSummaryLabel}`} aria-pressed={!unavailable && selectedStaffId === staff.id} aria-disabled={unavailable} disabled={unavailable} onClick={() => onSelectStaff(staff.id)} className="relative flex h-16 w-full items-center justify-start gap-2 border-b border-b-[#d8dee7] px-2 text-left text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb] disabled:cursor-default" style={{ backgroundColor: staff.background ?? "#ffffff" }}>
                      <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef2f6]" style={{ color: staff.color, backgroundColor: staff.bookingBackground, boxShadow: staff.bookingBorder ? `inset 0 0 0 1px ${staff.bookingBorder}` : undefined }}>
                        <StaffProfilePhoto key={`${staff.id}:${staff.profileImageUrl ?? ""}:${staff.profileImageFallbackKey ?? ""}`} src={staff.profileImageUrl} fallbackKey={staff.profileImageFallbackKey} alt={`${staff.label} 프로필 사진`} />
                      </span>
                      <span data-testid="staff-lane-copy" className="grid min-w-0 flex-1 grid-rows-[24px_20px] content-center text-left">
                        <span data-testid="staff-name-row" className="block min-w-0 whitespace-nowrap text-[16px] font-medium leading-6">{staff.label}</span>
                        <span data-testid="staff-summary-row" className="block min-w-0 whitespace-nowrap text-[13px] font-medium leading-5 text-[#526174] [font-variant-numeric:tabular-nums]">{staffSummaryLabel}</span>
                      </span>
                      <span data-testid="staff-chip-color-bar" aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-[2px] w-4/5 -translate-x-1/2" style={{ backgroundColor: staff.color }} />
                    </button>
                    <div data-testid="staff-lane-board" className="relative bg-white" style={{ height: BOARD_HEIGHT }}>
                      {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => <span key={index} className="absolute inset-x-0 border-t border-[#e3e8ef]" style={{ top: BOARD_TOP_PADDING + index * HOUR_HEIGHT }} />)}
                      {unavailable ? <div className="absolute inset-0 z-[1] flex items-start justify-center bg-[#f1f4f7]/80 pt-4 text-[13px] leading-5 text-[#526174]">근무하지 않음</div> : null}
                      <ScheduleLane appointments={laneAppointments} petNames={petNames} guardianNames={guardianNames} serviceNames={serviceNames} serviceDurations={serviceDurations} onOpenAppointment={onOpenAppointment} />
                      {showNow ? <span className="absolute inset-x-0 z-20 h-px bg-[#2f5fb3]" style={{ top: nowTop }} aria-hidden="true" /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
