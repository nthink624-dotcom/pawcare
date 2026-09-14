"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Appointment, StaffScheduleOverride } from "@/types/domain";
import { currentDateInTimeZone, currentMinutesInTimeZone } from "@/lib/utils";
import { assignAppointmentsToStaffLanes } from "@/lib/owner-schedule-lanes";
import { getAdjacentScheduleCardEdgeInsets } from "@/lib/owner-schedule-card-gaps";
import { getReservationDateDisplay } from "@/lib/reservation-date-display";
import { StaffProfilePhoto } from "@/components/owner/staff-profile-photo";

const START_HOUR = 9;
const END_HOUR = 19;
const HOUR_HEIGHT = 72;
const BOARD_TOP_PADDING = 16;
// This is clearance after the real 19:00 boundary, not an additional booking slot.
// It keeps the final label and grid edge above the fixed bottom navigation and FAB.
const BOARD_BOTTOM_CLEARANCE = 72;
const BOARD_HEIGHT = BOARD_TOP_PADDING + (END_HOUR - START_HOUR) * HOUR_HEIGHT + BOARD_BOTTOM_CLEARANCE;

const STATUS_PRESENTATION: Record<Appointment["status"], { label: string; color: string; tint: string }> = {
  pending: { label: "승인 대기", color: "#b98121", tint: "#fff9ee" },
  confirmed: { label: "예약 확정", color: "#1f9d55", tint: "#f0faf4" },
  in_progress: { label: "진행 중", color: "#2563eb", tint: "#eff6ff" },
  almost_done: { label: "픽업 준비", color: "#7c3aed", tint: "#f5f3ff" },
  completed: { label: "미용 완료", color: "#64748b", tint: "#f1f5f9" },
  cancelled: { label: "취소", color: "#a04455", tint: "#fff8fa" },
  rejected: { label: "거절", color: "#a04455", tint: "#fff8fa" },
  noshow: { label: "노쇼", color: "#a04455", tint: "#fff8fa" },
};

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
  onChangeDate: (direction: "previous" | "next") => void;
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
  staffIdentity,
}: Pick<Props, "petNames" | "guardianNames" | "serviceNames" | "serviceDurations" | "onOpenAppointment"> & {
  appointments: Appointment[];
  staffIdentity: Pick<StaffOption, "color">;
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
        return (
          <button
            key={appointment.id}
            type="button"
            data-appointment-id={appointment.id}
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
              className="absolute inset-x-0 overflow-hidden rounded-lg border border-l-[3px] border-[#d8dee7] px-2 py-1.5 shadow-none"
              style={{ top: edgeInsets.top, bottom: edgeInsets.bottom, borderLeftColor: status.color, backgroundColor: status.tint }}
            >
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium leading-5 text-[#42526a] [font-variant-numeric:tabular-nums]">
                  <span data-testid="staff-identity-marker" aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: staffIdentity.color }} />
                  <span className="truncate">{appointment.appointment_time.slice(0, 5)} · {status.label}</span>
                </span>
                <span className="block truncate text-[14px] font-medium leading-5 text-[#172033]">
                  {petNames[appointment.pet_id] ?? "반려동물"} · {guardianNames[appointment.guardian_id] ?? "보호자"}
                </span>
                {minutes >= 75 ? (
                  <span className="block truncate text-[13px] font-normal leading-5 text-[#526174]">
                    {serviceNames[appointment.service_id] ?? "서비스"}{appointment.memo ? ` · ${appointment.memo}` : ""}
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
    selectedStaffId, staffScheduleOverrides, isShopClosed, onSelectStaff, onChangeDate,
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
  const { dateLabel, weekdayLabel, relativeDateLabel } = getReservationDateDisplay(date, today);

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
    const left = Math.max(0, Math.min(selected.offsetLeft, viewport.scrollWidth - viewport.clientWidth));
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
      <header data-testid="reservation-date-navigation" className="sticky top-[env(safe-area-inset-top)] z-40 flex min-h-14 items-center justify-between border-b border-[#d8dee7] bg-white px-2 py-1.5">
        <button type="button" aria-label="이전 날짜" onClick={() => onChangeDate("previous")} className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" aria-label={`${dateLabel}${weekdayLabel ? ` ${weekdayLabel}` : ""}${relativeDateLabel ? ` ${relativeDateLabel}` : ""} 날짜 선택`} onClick={onOpenDatePicker} className="absolute inset-y-0 left-1/2 flex min-h-11 w-[calc(100%-88px)] -translate-x-1/2 items-center justify-center rounded-lg px-2 text-center focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
          <span className="relative inline-flex shrink-0">
            <span data-testid="date-primary" className="whitespace-nowrap text-[16px] font-medium leading-6 text-[#172033] [font-variant-numeric:tabular-nums]">{dateLabel}</span>
            {weekdayLabel ? <span data-testid="weekday-label" className="pointer-events-none absolute left-full top-1/2 ml-2 inline-flex shrink-0 -translate-y-1/2 whitespace-nowrap text-[16px] font-medium leading-6 text-[#526174]">{weekdayLabel}</span> : null}
            {relativeDateLabel ? <span data-testid="relative-date-label" className="pointer-events-none absolute left-full top-1/2 ml-2 inline-flex shrink-0 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#edf4ff] px-2 py-1 text-[13px] font-medium leading-5 text-[#1d4ed8]">{relativeDateLabel}</span> : null}
          </span>
        </button>
        <button type="button" aria-label="다음 날짜" onClick={() => onChangeDate("next")} className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"><ChevronRight className="h-5 w-5" /></button>
      </header>

      {laneOptions.length === 0 ? (
        <div className="flex min-h-44 items-center justify-center px-6 text-center text-[14px] leading-5 text-[#526174]">표시할 직원이 없습니다.</div>
      ) : (
        <div className="grid grid-cols-[48px_minmax(0,1fr)] min-[410px]:grid-cols-[52px_minmax(0,1fr)]">
          <div className="sticky left-0 z-30 border-r border-[#c8d1dc] bg-white">
            <div data-testid="time-header" className="flex h-[68px] items-center justify-center border-b border-[#d8dee7] bg-white text-[13px] font-medium leading-5 text-[#42526a]">시간</div>
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
                const workStart = override?.status === "work" ? override.start_time : staff.startTime;
                const workEnd = override?.status === "work" ? override.end_time : staff.endTime;
                const workHoursLabel = unavailable ? "근무하지 않음" : workStart && workEnd ? `${workStart.slice(0, 5)}–${workEnd.slice(0, 5)}` : "근무시간 미설정";
                return (
                  <div key={staff.id} data-staff-id={staff.id} data-lane-appointment-count={laneAppointments.length} className={isSingleStaffLane ? "w-full min-w-0 max-w-none flex-1 shrink-0 border-r border-[#d8dee7]" : "w-[calc((100vw-48px)*0.88)] min-w-[260px] max-w-[332px] shrink-0 snap-start border-r border-[#d8dee7] min-[410px]:w-[calc((100vw-52px)*0.88)] md:w-[240px]"}>
                    <button type="button" data-testid="staff-lane-chip" aria-pressed={!unavailable && selectedStaffId === staff.id} aria-disabled={unavailable} disabled={unavailable} onClick={() => onSelectStaff(staff.id)} className="relative flex h-[68px] w-full items-center justify-start gap-3 border-b border-b-[#d8dee7] px-3 text-left text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb] disabled:cursor-default" style={{ backgroundColor: staff.background ?? "#ffffff" }}>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef2f6]" style={{ color: staff.color, backgroundColor: staff.bookingBackground, boxShadow: staff.bookingBorder ? `inset 0 0 0 1px ${staff.bookingBorder}` : undefined }}>
                        <StaffProfilePhoto key={`${staff.id}:${staff.profileImageUrl ?? ""}:${staff.profileImageFallbackKey ?? ""}`} src={staff.profileImageUrl} fallbackKey={staff.profileImageFallbackKey} alt={`${staff.label} 프로필 사진`} />
                      </span>
                      <span data-testid="staff-lane-copy" className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[16px] font-medium leading-6">{staff.label}</span>
                        <span className="block truncate text-[13px] font-medium leading-5 text-[#526174] [font-variant-numeric:tabular-nums]">{workHoursLabel} · 예약 {laneAppointments.length}건</span>
                      </span>
                      <span data-testid="staff-chip-color-bar" aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-[2px] w-4/5 -translate-x-1/2" style={{ backgroundColor: staff.color }} />
                    </button>
                    <div data-testid="staff-lane-board" className="relative bg-white" style={{ height: BOARD_HEIGHT }}>
                      {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => <span key={index} className="absolute inset-x-0 border-t border-[#e3e8ef]" style={{ top: BOARD_TOP_PADDING + index * HOUR_HEIGHT }} />)}
                      {unavailable ? <div className="absolute inset-0 z-[1] flex items-start justify-center bg-[#f1f4f7]/80 pt-4 text-[13px] leading-5 text-[#526174]">근무하지 않음</div> : null}
                      <ScheduleLane appointments={laneAppointments} staffIdentity={staff} petNames={petNames} guardianNames={guardianNames} serviceNames={serviceNames} serviceDurations={serviceDurations} onOpenAppointment={onOpenAppointment} />
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
