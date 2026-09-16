"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Appointment, StaffScheduleOverride } from "@/types/domain";
import { addDate, currentDateInTimeZone, currentMinutesInTimeZone } from "@/lib/utils";
import { assignAppointmentsToStaffLanes } from "@/lib/owner-schedule-lanes";
import { getAdjacentScheduleCardEdgeInsets } from "@/lib/owner-schedule-card-gaps";
import { getReservationDateDisplay } from "@/lib/reservation-date-display";
import { StaffProfilePhoto } from "@/components/owner/staff-profile-photo";

const START_HOUR = 9;
const END_HOUR = 19;
const HOUR_HEIGHT = 72;
const BOARD_TOP_PADDING = 0;
// This is clearance after the real 19:00 boundary, not an additional booking slot.
// It keeps the final label and grid edge above the fixed bottom navigation and FAB.
const BOARD_BOTTOM_CLEARANCE = 72;
const BOARD_HEIGHT = BOARD_TOP_PADDING + (END_HOUR - START_HOUR) * HOUR_HEIGHT + BOARD_BOTTOM_CLEARANCE;

const STATUS_PRESENTATION: Record<Appointment["status"], { label: string; color: string; tint: string }> = {
  pending: { label: "승인 대기", color: "#b98121", tint: "#f4f6f9" },
  confirmed: { label: "예약 확정", color: "#1f9d55", tint: "#f3f6fa" },
  in_progress: { label: "진행 중", color: "#2563eb", tint: "#eaf2fd" },
  almost_done: { label: "픽업 준비", color: "#7c3aed", tint: "#eef0fb" },
  completed: { label: "미용 완료", color: "#64748b", tint: "#f3f5f8" },
  cancelled: { label: "취소", color: "#a04455", tint: "#f5f3f5" },
  rejected: { label: "거절", color: "#a04455", tint: "#f5f3f5" },
  noshow: { label: "노쇼", color: "#a04455", tint: "#f5f3f5" },
};

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
        const width = 100 / collisionColumns;
        const edgeInsets = cardEdgeInsets.get(appointment.id) ?? { top: 0, bottom: 0 };
        const startLabel = appointment.appointment_time.slice(0, 5);
        const endLabel = formatMinutes(start + minutes);
        const durationLabel = formatDuration(minutes);
        const petName = petNames[appointment.pet_id] ?? "반려동물";
        const guardianName = guardianNames[appointment.guardian_id] ?? "보호자";
        const serviceName = serviceNames[appointment.service_id] ?? "서비스";
        return (
          <button
            key={appointment.id}
            type="button"
            data-appointment-id={appointment.id}
            aria-label={`${startLabel}부터 ${endLabel}까지, ${durationLabel}, ${petName}, 보호자 ${guardianName}, ${serviceName}, ${status.label}`}
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
              className="absolute inset-x-0 overflow-hidden rounded-lg border border-l-[3px] border-[#e1e6ed] px-2.5 py-1 shadow-none"
              style={{ top: edgeInsets.top, bottom: edgeInsets.bottom, borderLeftColor: status.color, backgroundColor: status.tint }}
            >
              <span className="block min-w-0">
                <span className="flex min-w-0 items-center justify-between gap-2 text-[12px] font-medium leading-[18px] text-[#42526a] [font-variant-numeric:tabular-nums]">
                  <span className="truncate">{startLabel}–{endLabel} · {durationLabel}</span>
                  <span className="shrink-0 text-[#526174]">{status.label}</span>
                </span>
                <span className="flex min-w-0 items-baseline gap-1.5 truncate text-[14px] leading-5">
                  <span className="truncate font-medium text-[#172033]">{petName}</span>
                  <span className="truncate font-normal text-[#526174]">{guardianName}</span>
                </span>
                {minutes >= 75 ? (
                  <span className="block truncate text-[13px] font-normal leading-5 text-[#526174]">
                    {serviceName}{appointment.memo ? ` · ${appointment.memo}` : ""}
                  </span>
                ) : null}
              </span>
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
          <div className="sticky left-0 z-30 border-r border-[#e8edf3] bg-white">
            <div data-testid="time-header" aria-hidden="true" className="h-[72px] border-b border-[#e8edf3] bg-white" />
            <div data-testid="time-rail" className="relative bg-white" style={{ height: BOARD_HEIGHT }}>
              {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
                <span key={index} className="absolute inset-x-0 top-0 flex -translate-y-1/2 justify-center whitespace-nowrap text-[13px] font-medium leading-5 text-[#526174] [font-variant-numeric:tabular-nums]" style={{ top: BOARD_TOP_PADDING + index * HOUR_HEIGHT }}>{formatClock(START_HOUR + index)}</span>
              ))}
              {showNow ? (
                <span data-testid="current-time-marker" className="absolute inset-x-0 z-20" style={{ top: nowTop }} aria-label={`현재 시간 ${formatMinutes(nowMinutes)}`}>
                  <span data-testid="current-time-line" className="absolute inset-x-0 top-0 h-px bg-[#2563eb]" />
                  <span data-testid="current-time-label" className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-white px-0.5 text-[13px] font-medium leading-5 text-[#2563eb] [font-variant-numeric:tabular-nums]">{formatMinutes(nowMinutes)}</span>
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
                const totalMinutes = laneAppointments.reduce((sum, appointment) => sum + appointmentDuration(appointment, serviceDurations), 0);
                const scheduleSummary = unavailable
                  ? `근무하지 않음 · 예약 ${laneAppointments.length}건`
                  : `${laneAppointments.length}건 · ${formatDuration(totalMinutes)}`;
                return (
                  <div key={staff.id} data-staff-id={staff.id} data-lane-appointment-count={laneAppointments.length} className={isSingleStaffLane ? "w-full min-w-0 max-w-none flex-1 shrink-0" : "w-[calc((100vw-48px)*0.88)] min-w-[260px] max-w-[332px] shrink-0 snap-start border-r border-[#e8edf3] min-[410px]:w-[calc((100vw-52px)*0.88)] md:w-[240px]"}>
                    <button type="button" data-testid="staff-lane-chip" aria-pressed={!unavailable && selectedStaffId === staff.id} aria-disabled={unavailable} disabled={unavailable} onClick={() => onSelectStaff(staff.id)} className="relative flex h-[72px] w-full items-center justify-start gap-2.5 border-b border-b-[#e8edf3] bg-white px-3 text-left text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb] disabled:cursor-default">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef2f6]" style={{ color: staff.color, backgroundColor: staff.bookingBackground, boxShadow: staff.bookingBorder ? `inset 0 0 0 1px ${staff.bookingBorder}` : undefined }}>
                        <StaffProfilePhoto key={`${staff.id}:${staff.profileImageUrl ?? ""}:${staff.profileImageFallbackKey ?? ""}`} src={staff.profileImageUrl} fallbackKey={staff.profileImageFallbackKey} alt={`${staff.label} 프로필 사진`} />
                      </span>
                      <span data-testid="staff-lane-copy" className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[16px] font-semibold leading-6">{staff.label}</span>
                        <span className="block truncate text-[13px] font-normal leading-5 text-[#64748b] [font-variant-numeric:tabular-nums]">{scheduleSummary}</span>
                      </span>
                      <span data-testid="staff-chip-color-bar" aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-[2px] w-4/5 -translate-x-1/2" style={{ backgroundColor: staff.color }} />
                    </button>
                    <div data-testid="staff-lane-board" className="relative bg-white" style={{ height: BOARD_HEIGHT }}>
                      {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => <span key={index} className="absolute inset-x-0 border-t border-[#eef2f6]" style={{ top: BOARD_TOP_PADDING + index * HOUR_HEIGHT }} />)}
                      {unavailable ? <div className="absolute inset-0 z-[1] flex items-start justify-center bg-[#f1f4f7]/80 pt-4 text-[13px] leading-5 text-[#526174]">근무하지 않음</div> : null}
                      <ScheduleLane appointments={laneAppointments} petNames={petNames} guardianNames={guardianNames} serviceNames={serviceNames} serviceDurations={serviceDurations} onOpenAppointment={onOpenAppointment} />
                      {showNow ? <span className="absolute inset-x-0 z-20 h-px bg-[#2563eb]" style={{ top: nowTop }} aria-hidden="true" /> : null}
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
