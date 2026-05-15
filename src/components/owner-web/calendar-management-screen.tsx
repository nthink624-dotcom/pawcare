"use client";

import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, MessageCircle } from "lucide-react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { calendarBookings } from "@/components/owner-web/owner-web-data";
import {
  defaultOwnerWebStaff,
  toOwnerWebStaffColumn,
  type OwnerWebStaffColumn,
  type OwnerWebStaffMember,
} from "@/components/owner-web/owner-web-staff-data";
import {
  SoftSelect,
  WebSurface,
} from "@/components/owner-web/owner-web-ui";
import { computeAvailableSlots } from "@/lib/availability";
import { fetchApiJson, fetchApiJsonWithAuth } from "@/lib/api";
import { addDate, cn, currentDateInTimeZone } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload, Guardian, Pet } from "@/types/domain";

type SummaryMetricKey = "today" | "completed" | "changes";
type ReservationStatusFilter = "all" | "pending" | "confirmed";
type BookingCardTone = "confirmed" | "active" | "pending" | "completed" | "cancelled";
type ScheduleMetric = { key: SummaryMetricKey; label: string; value?: string };
type StaffKey = string;
type StaffFilter = "전체 스태프" | StaffKey;
type StaffAssignments = Record<string, StaffKey>;
type ScheduleCreateFormState = {
  customerMode: "new" | "existing";
  petId: string;
  customerName: string;
  petName: string;
  customerPhone: string;
  serviceId: string;
  staffKey: StaffKey;
  date: string;
  time: string;
  memo: string;
};
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

const fallbackStaffColumns = defaultOwnerWebStaff.map(toOwnerWebStaffColumn);
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
const todayScheduleDate = currentDateInTimeZone();
const todayScheduleDateLabel = formatScheduleDateLabel(todayScheduleDate);
const weekdayShortLabels = ["일", "월", "화", "수", "목", "금", "토"];

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  pending: "승인 대기",
  confirmed: "확정",
  in_progress: "진행 중",
  almost_done: "픽업 준비",
  completed: "완료",
  cancelled: "취소",
  rejected: "거절",
  noshow: "노쇼",
};

const dailyBookingTimes: Record<string, { start: number; duration: number }> = {
  "C-01": { start: 10, duration: 1.5 },
  "C-02": { start: 12.5, duration: 1.5 },
  "C-03": { start: 12, duration: 1.5 },
  "C-04": { start: 14, duration: 1.5 },
  "C-05": { start: 16, duration: 1.5 },
};

function getCurrentDayHour() {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

function formatHourLabel(hour: number) {
  const fullHour = Math.floor(hour);
  const minute = Math.round((hour - fullHour) * 60);
  return `${String(fullHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatScheduleDateLabel(date = currentDateInTimeZone()) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function timeToHour(time: string) {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) + Number(minute) / 60;
}

function minutesBetween(startAt: string, endAt: string) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return (end - start) / 60 / 1000;
}

function isActiveBookingStatus(status: string) {
  return status === "진행 중" || status === "픽업 준비";
}

function isPendingBookingStatus(status: string) {
  return status === "승인 대기";
}

function isConfirmedBookingStatus(status: string) {
  return status === "확정";
}

function isCompletedBookingStatus(status: string) {
  return status === "완료";
}

function canStartGrooming(status: string) {
  return isConfirmedBookingStatus(status);
}

function canMarkGroomingComplete(status: string) {
  return status === "진행 중";
}

function isChangeBookingStatus(status: string) {
  return status === "취소" || status === "거절" || status === "노쇼";
}

function isBookableStatus(status: string) {
  return !isChangeBookingStatus(status) && !isCompletedBookingStatus(status);
}

function getTimedBookingStatus(
  booking: { status: string; start: number; duration: number },
  selectedDate: string,
  currentHour: number,
) {
  if (isPendingBookingStatus(booking.status) || isChangeBookingStatus(booking.status) || isCompletedBookingStatus(booking.status)) {
    return booking.status;
  }

  const today = currentDateInTimeZone();
  if (selectedDate < today) return "완료";
  if (selectedDate > today) return isActiveBookingStatus(booking.status) ? "확정" : booking.status;

  const endHour = booking.start + booking.duration;
  if (currentHour >= endHour) return "완료";
  if (booking.status === "픽업 준비") return "픽업 준비";
  if (booking.status === "진행 중" || currentHour >= booking.start) return "진행 중";
  return "확정";
}

function canSendCompletionNotice(sourceStatus: string, displayStatus: string) {
  if (isPendingBookingStatus(sourceStatus) || isChangeBookingStatus(sourceStatus)) return false;
  if (isCompletedBookingStatus(sourceStatus) || sourceStatus === "픽업 준비") return false;
  return displayStatus === "진행 중" || displayStatus === "픽업 준비" || displayStatus === "완료";
}

function normalizeBookingForApprovalMode(booking: DailyBooking, manualApprovalEnabled: boolean): DailyBooking {
  if (manualApprovalEnabled || !isPendingBookingStatus(booking.status)) return booking;
  return { ...booking, status: "확정" };
}

function buildScheduleMetrics(bookings: DailyBooking[]): ScheduleMetric[] {
  const bookableCount = bookings.filter((booking) => isBookableStatus(booking.status)).length;
  const completedCount = bookings.filter((booking) => isCompletedBookingStatus(booking.status)).length;
  const changesCount = bookings.filter((booking) => isChangeBookingStatus(booking.status)).length;
  const visibleTodayCount = bookableCount + changesCount;

  return [
    { key: "today", label: "예약 현황", value: `${visibleTodayCount}건` },
    { key: "changes", label: "변경 · 취소 관리", value: `${changesCount}건` },
    { key: "completed", label: "완료 내역", value: `${completedCount}건` },
  ];
}

function getReservationFilterOptions(bookings: DailyBooking[], manualApprovalEnabled: boolean) {
  const bookableBookings = bookings.filter((booking) => isBookableStatus(booking.status));
  const changeBookings = bookings.filter((booking) => isChangeBookingStatus(booking.status));
  const options: Array<{ key: ReservationStatusFilter; label: string; count: number }> = [
    { key: "all", label: "전체", count: bookableBookings.length + changeBookings.length },
  ];

  if (manualApprovalEnabled) {
    options.push({ key: "pending", label: "대기", count: bookableBookings.filter((booking) => isPendingBookingStatus(booking.status)).length });
  }

  options.push(
    { key: "confirmed", label: "확정", count: bookableBookings.filter((booking) => isConfirmedBookingStatus(booking.status)).length },
  );

  return options;
}

function matchesReservationFilter(booking: DailyBooking, filter: ReservationStatusFilter) {
  if (filter === "all" && isChangeBookingStatus(booking.status)) return true;
  if (!isBookableStatus(booking.status)) return false;
  if (filter === "pending") return isPendingBookingStatus(booking.status);
  if (filter === "confirmed") return isConfirmedBookingStatus(booking.status);
  return true;
}

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

function addScheduleDays(date: string, days: number) {
  const nextDate = parseScheduleDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return formatScheduleDateKey(nextDate);
}

function getWeekScheduleDates(referenceDate = todayScheduleDate) {
  const date = parseScheduleDate(referenceDate);
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  return Array.from({ length: 7 }, (_, index) => addScheduleDays(referenceDate, mondayOffset + index));
}

function getMonthScheduleDates(referenceDate = todayScheduleDate) {
  const date = parseScheduleDate(referenceDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return [
    ...Array.from({ length: firstOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => formatScheduleDateKey(new Date(year, month, index + 1))),
  ];
}

function formatScheduleShortDate(date: string) {
  const parsed = parseScheduleDate(date);
  return `${parsed.getMonth() + 1}/${parsed.getDate()} ${weekdayShortLabels[parsed.getDay()]}`;
}

function getScheduleMonthLabel(referenceDate = todayScheduleDate) {
  const parsed = parseScheduleDate(referenceDate);
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월`;
}

function getPhaseLabel(phase: "now" | "upcoming" | "past") {
  if (phase === "now") return "진행 중";
  if (phase === "upcoming") return "예정";
  return "지난 일정";
}

function getBookingCardTone(status: string): BookingCardTone {
  if (status === "완료") return "completed";
  if (isChangeBookingStatus(status)) return "cancelled";
  if (isPendingBookingStatus(status)) return "pending";
  if (isActiveBookingStatus(status)) return "active";
  return "confirmed";
}

function getBookingCardToneClass(tone: BookingCardTone, selected: boolean) {
  if (tone === "active") {
    return cn(
      "border-[#dce7e3] bg-white text-[#0f172a] shadow-none",
      selected && "border-[#b9d1ca] ring-1 ring-[#8ab9ab]/20",
    );
  }

  if (tone === "pending") {
    return cn(
      "border-[#eee2c4] bg-white text-[#17211f] shadow-none",
      selected && "border-[#e5cc72] ring-1 ring-[#f2c94c]/18",
    );
  }

  if (tone === "completed") {
    return cn(
      "border-[#e5e7eb] bg-white text-[#6b7280] shadow-none",
      selected && "border-[#cbd5e1] ring-1 ring-[#94a3b8]/18",
    );
  }

  if (tone === "cancelled") {
    return cn(
      "border-[#ead6dc] bg-white text-[#17211f] shadow-none",
      selected && "border-[#b45a6a] ring-1 ring-[#8f2438]/18",
    );
  }

  return cn(
    "border-[#dce7e3] bg-white text-[#111827] shadow-none",
    selected && "border-[#b9d1ca] ring-1 ring-[#8ab9ab]/18",
  );
}

function getBookingIndicatorClass(tone: BookingCardTone) {
  if (tone === "pending") return "bg-[#edbd3f]";
  if (tone === "completed") return "bg-[#d5dde6]";
  if (tone === "cancelled") return "bg-[#8f2438]";
  return "bg-[#4f9b88]";
}

function getBookingResizeHandleClass(tone: BookingCardTone) {
  if (tone === "active") return "bg-[#4f9a89]/70";
  if (tone === "completed") return "bg-[#94a3b8]/70";
  if (tone === "pending") return "bg-[#edbd3f]/80";
  if (tone === "cancelled") return "bg-[#8f2438]/70";
  return "bg-[#3f8d7d]/70";
}

function getBookingTimeTextClass(tone: BookingCardTone) {
  if (tone === "pending") return "text-[#9f6f00]";
  if (tone === "completed") return "text-[#64748b]";
  if (tone === "cancelled") return "text-[#8f2438]";
  return "text-[#1f6b5b]";
}

function getBookingTop(start: number) {
  return scheduleBodyInsetY + Math.max(0, (start - scheduleStartHour) * pixelsPerHour);
}

function getBookingHeight(duration: number) {
  return Math.max(quarterSlotHeight, duration * pixelsPerHour);
}

function getBookingCardDensity(duration: number) {
  if (duration <= expandableBookingDurationMax) return "micro";
  if (duration <= 0.75) return "compact";
  if (duration <= 1.25) return "standard";
  return "comfortable";
}

function getStaffBookingLayouts<T extends { id: string; start: number; duration: number }>(bookings: T[]) {
  const sorted = [...bookings].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const layouts = new Map<string, { lane: number; laneCount: number }>();

  for (let index = 0; index < sorted.length;) {
    const group = [sorted[index]];
    let groupEnd = sorted[index].start + sorted[index].duration;
    index += 1;

    while (index < sorted.length && sorted[index].start < groupEnd) {
      group.push(sorted[index]);
      groupEnd = Math.max(groupEnd, sorted[index].start + sorted[index].duration);
      index += 1;
    }

    const laneEnds: number[] = [];
    const groupLanes = new Map<string, number>();

    group.forEach((booking) => {
      const lane = laneEnds.findIndex((end) => end <= booking.start);
      const nextLane = lane === -1 ? laneEnds.length : lane;
      laneEnds[nextLane] = booking.start + booking.duration;
      groupLanes.set(booking.id, nextLane);
    });

    const laneCount = Math.max(1, laneEnds.length);
    group.forEach((booking) => {
      layouts.set(booking.id, {
        lane: groupLanes.get(booking.id) ?? 0,
        laneCount,
      });
    });
  }

  return layouts;
}

function getBookingLayoutStyle(lane: number, laneCount: number) {
  if (laneCount <= 1) {
    return {
      left: bookingCardHorizontalInset,
      width: bookingCardWidth,
    };
  }

  return {
    left: `calc(${bookingCardHorizontalInset} + ${lane} * (${bookingCardWidth} / ${laneCount}))`,
    width: `calc(${bookingCardWidth} / ${laneCount} - 4px)`,
  };
}

function getSnappedBookingStart(pointerY: number, columnTop: number, duration: number) {
  const rawStart = scheduleStartHour + (pointerY - columnTop - scheduleBodyInsetY) / pixelsPerHour;
  const snappedStart = Math.round(rawStart * scheduleSnapSegmentsPerHour) / scheduleSnapSegmentsPerHour;
  return Math.min(scheduleEndHour - duration, Math.max(scheduleStartHour, snappedStart));
}

function getSnappedBookingDuration(start: number, duration: number) {
  const snappedDuration = Math.round(duration * scheduleSnapSegmentsPerHour) / scheduleSnapSegmentsPerHour;
  return Math.min(scheduleEndHour - start, Math.max(1 / scheduleSnapSegmentsPerHour, snappedDuration));
}

function bookingTimesOverlap(first: { start: number; duration: number }, second: { start: number; duration: number }) {
  return first.start < second.start + second.duration && second.start < first.start + first.duration;
}

function hasStaffBookingConflict(
  bookings: Array<{ id: string; staffKey: string; start: number; duration: number; status?: string }>,
  bookingId: string,
  next: { staffKey: string; start: number; duration: number },
) {
  return bookings.some((booking) => {
    if (booking.id === bookingId || booking.staffKey !== next.staffKey || booking.status === "취소") return false;
    return bookingTimesOverlap(next, booking);
  });
}

function findNextAvailableBookingStart(
  bookings: Array<{ id: string; staffKey: string; start: number; duration: number; status?: string }>,
  staffKey: StaffKey,
  duration: number,
) {
  for (let start = scheduleStartHour; start <= scheduleEndHour - duration; start += 0.25) {
    if (!hasStaffBookingConflict(bookings, "__new-booking__", { staffKey, start, duration })) {
      return start;
    }
  }

  return null;
}

function findPreviewBookingStart(
  bookings: Array<{ id: string; staffKey: string; start: number; duration: number; status?: string }>,
  staffKey: StaffKey,
  duration: number,
  preferredStart: number,
) {
  const firstStart = Math.min(scheduleEndHour - duration, Math.max(scheduleStartHour, Math.round(preferredStart * 4) / 4));

  for (let start = firstStart; start <= scheduleEndHour - duration; start += 0.25) {
    if (!hasStaffBookingConflict(bookings, "__preview-booking__", { staffKey, start, duration })) {
      return start;
    }
  }

  for (let start = scheduleStartHour; start < firstStart; start += 0.25) {
    if (!hasStaffBookingConflict(bookings, "__preview-booking__", { staffKey, start, duration })) {
      return start;
    }
  }

  return null;
}

function appointmentToDailyBooking(
  appointment: Appointment,
  data: BootstrapPayload,
  selectedDate: string,
  staffAssignments: StaffAssignments,
  fallbackStaff: OwnerWebStaffColumn,
  staffColumns: OwnerWebStaffColumn[],
): DailyBooking {
  const guardian = data.guardians.find((item) => item.id === appointment.guardian_id);
  const pet = data.pets.find((item) => item.id === appointment.pet_id);
  const service = data.services.find((item) => item.id === appointment.service_id);
  const assignedStaff = staffAssignments[appointment.id]
    ? staffColumns.find((item) => item.key === staffAssignments[appointment.id])
    : null;
  const staffColumn = assignedStaff ?? fallbackStaff;
  const durationMinutes = minutesBetween(appointment.start_at, appointment.end_at) ?? service?.duration_minutes ?? 60;

  return {
    id: appointment.id,
    day: "오늘",
    start: timeToHour(appointment.appointment_time),
    duration: Math.max(0.25, durationMinutes / 60),
    lane: 0,
    customer: guardian?.name ?? "보호자 미등록",
    pet: pet?.name ?? "반려동물 미등록",
    service: service?.name ?? "서비스 미등록",
    staff: staffColumn.role,
    status: appointmentStatusLabels[appointment.status],
    date: formatScheduleDateLabel(selectedDate),
    staffKey: staffColumn.key,
    staffName: staffColumn.name,
    memo: appointment.memo,
    source: appointment.source,
  };
}

const baseDailyBookings = calendarBookings.map((booking) => ({
  ...booking,
  ...(dailyBookingTimes[booking.id] ?? {}),
  date: todayScheduleDateLabel,
  staffKey: booking.staff === "원장" ? "staff-1" : "staff-2",
  staffName: booking.staff === "원장" ? "정우진" : "서하늘",
}));

const extraDailyBookings = [
  {
    id: "C-06",
    day: "화",
    start: 12.25,
    duration: 0.25,
    lane: 0,
    customer: "문채원",
    pet: "토리",
    service: "목욕",
    staff: "디자이너",
    status: "확정",
    date: todayScheduleDateLabel,
    staffKey: "staff-3",
    staffName: "민서윤",
  },
  {
    id: "C-07",
    day: "화",
    start: 11,
    duration: 3,
    lane: 0,
    customer: "장하린",
    pet: "루나",
    service: "부분 미용",
    staff: "목욕",
    status: "진행 중",
    date: todayScheduleDateLabel,
    staffKey: "staff-4",
    staffName: "강리오",
  },
  {
    id: "C-08",
    day: "화",
    start: 11,
    duration: 1,
    lane: 0,
    customer: "노유나",
    pet: "밤이",
    service: "위생 미용",
    staff: "파트타임",
    status: "확정",
    date: todayScheduleDateLabel,
    staffKey: "staff-5",
    staffName: "오다은",
  },
  {
    id: "C-09",
    day: "화",
    start: 15,
    duration: 1,
    lane: 0,
    customer: "최민규",
    pet: "두부",
    service: "목욕",
    staff: "파트타임",
    status: "완료",
    date: todayScheduleDateLabel,
    staffKey: "staff-6",
    staffName: "한지우",
  },
  {
    id: "C-10",
    day: "화",
    start: 17.5,
    duration: 1.25,
    lane: 0,
    customer: "이도윤",
    pet: "콩이",
    service: "목욕 + 부분정리",
    staff: "원장",
    status: "확정",
    date: todayScheduleDateLabel,
    staffKey: "staff-1",
    staffName: "정우진",
  },
  {
    id: "C-11",
    day: "화",
    start: 17.5,
    duration: 0.75,
    lane: 0,
    customer: "한서진",
    pet: "라떼",
    service: "위생 미용",
    staff: "서브",
    status: "픽업 준비",
    date: todayScheduleDateLabel,
    staffKey: "staff-2",
    staffName: "서하늘",
  },
  {
    id: "C-12",
    day: "화",
    start: 18.25,
    duration: 1,
    lane: 0,
    customer: "배지후",
    pet: "모카",
    service: "목욕",
    staff: "디자이너",
    status: "승인 대기",
    date: todayScheduleDateLabel,
    staffKey: "staff-3",
    staffName: "민서윤",
  },
  {
    id: "C-13",
    day: "화",
    start: 19,
    duration: 1.5,
    lane: 0,
    customer: "오하린",
    pet: "설기",
    service: "전체 미용",
    staff: "목욕",
    status: "확정",
    date: todayScheduleDateLabel,
    staffKey: "staff-4",
    staffName: "강리오",
  },
  {
    id: "C-14",
    day: "화",
    start: 20.25,
    duration: 0.75,
    lane: 0,
    customer: "윤채아",
    pet: "베리",
    service: "목욕",
    staff: "파트타임",
    status: "확정",
    date: todayScheduleDateLabel,
    staffKey: "staff-5",
    staffName: "오다은",
  },
  {
    id: "C-15",
    day: "화",
    start: 21,
    duration: 1,
    lane: 0,
    customer: "김태오",
    pet: "하루",
    service: "부분 미용",
    staff: "파트타임",
    status: "진행 중",
    date: todayScheduleDateLabel,
    staffKey: "staff-6",
    staffName: "한지우",
  },
  {
    id: "C-16",
    day: "화",
    start: 22,
    duration: 1,
    lane: 0,
    customer: "서이준",
    pet: "구름",
    service: "전체 미용",
    staff: "원장",
    status: "확정",
    date: todayScheduleDateLabel,
    staffKey: "staff-1",
    staffName: "정우진",
  },
  {
    id: "C-17",
    day: "화",
    start: 23,
    duration: 0.75,
    lane: 0,
    customer: "박나은",
    pet: "단추",
    service: "목욕",
    staff: "서브",
    status: "확정",
    date: todayScheduleDateLabel,
    staffKey: "staff-2",
    staffName: "서하늘",
  },
  {
    id: "C-18",
    day: "화",
    start: 23.5,
    duration: 0.5,
    lane: 0,
    customer: "정라온",
    pet: "초코",
    service: "위생 미용",
    staff: "디자이너",
    status: "승인 대기",
    date: todayScheduleDateLabel,
    staffKey: "staff-3",
    staffName: "민서윤",
  },
  {
    id: "C-19",
    day: "월",
    start: 10.75,
    duration: 0.5,
    lane: 0,
    customer: "최나영",
    pet: "두부",
    service: "목욕",
    staff: "서브",
    status: "취소",
    date: todayScheduleDateLabel,
    staffKey: "staff-2",
    staffName: "서하늘",
  },
] satisfies Array<(typeof baseDailyBookings)[number]>;

const dailyBookings = [...baseDailyBookings, ...extraDailyBookings];
type DailyBooking = {
  id: string;
  day: string;
  start: number;
  duration: number;
  lane: number;
  customer: string;
  pet: string;
  service: string;
  staff: string;
  status: string;
  sourceStatus?: string;
  date: string;
  staffKey: StaffKey;
  staffName: string;
  memo?: string;
  source?: "owner" | "customer";
};

function getPreviewBookingsForBucket(bookings: DailyBooking[], bucketIndex: number, bucketCount: number) {
  return bookings
    .filter((_, index) => index % bucketCount === bucketIndex)
    .sort((a, b) => a.start - b.start);
}

function getBookingCounts(bookings: DailyBooking[]) {
  return {
    total: bookings.length,
    pending: bookings.filter((booking) => booking.status === "승인 대기").length,
    changes: bookings.filter((booking) => booking.status === "취소").length,
    completed: bookings.filter((booking) => booking.status === "완료").length,
  };
}

function staffColumnForIndex(index: number, staffColumns: OwnerWebStaffColumn[]) {
  return staffColumns[index % staffColumns.length] ?? fallbackStaffColumns[0];
}

function buildDailyBookingsFromBootstrap(data: BootstrapPayload, selectedDate: string, staffAssignments: StaffAssignments = {}, staffColumns = fallbackStaffColumns): DailyBooking[] {
  const selectedDateAppointments = data.appointments
    .filter((appointment) => appointment.appointment_date === selectedDate)
    .sort((first, second) => first.appointment_time.localeCompare(second.appointment_time));

  if (selectedDate === todayScheduleDate && selectedDateAppointments.length === 0) {
    return buildLocalPreviewDailyBookings(selectedDate, staffColumns);
  }

  return selectedDateAppointments.map((appointment, index) => {
    const staffColumn = staffColumnForIndex(index, staffColumns);
    return appointmentToDailyBooking(appointment, data, selectedDate, staffAssignments, staffColumn, staffColumns);
  });
}

function buildLocalPreviewDailyBookings(selectedDate: string, staffColumns: OwnerWebStaffColumn[]) {
  const columns = staffColumns.length > 0 ? staffColumns : fallbackStaffColumns;
  const previewSourceBookings = [
    ...dailyBookings,
    ...dailyBookings.map((booking, index) => {
      const offset = [0.5, 1, 1.5, 2][index % 4];

      return {
        ...booking,
        id: `${booking.id}-extra-${index + 1}`,
        start: Math.min(scheduleEndHour - booking.duration, booking.start + offset),
        status: index % 5 === 0 ? "승인 대기" : booking.status,
      };
    }),
  ];
  const scheduledBookings: DailyBooking[] = [];

  for (const [index, booking] of previewSourceBookings.entries()) {
    const fallbackStaffIndex = fallbackStaffColumns.findIndex((staffColumn) => staffColumn.key === booking.staffKey);
    const preferredColumnIndex = (fallbackStaffIndex >= 0 ? fallbackStaffIndex : index) % columns.length;
    const candidateColumns = [
      ...columns.slice(preferredColumnIndex),
      ...columns.slice(0, preferredColumnIndex),
    ];
    const placement = candidateColumns
      .map((staffColumn) => ({
        staffColumn,
        start: findPreviewBookingStart(scheduledBookings, staffColumn.key, booking.duration, booking.start),
      }))
      .find((candidate): candidate is { staffColumn: OwnerWebStaffColumn; start: number } => candidate.start !== null);

    if (!placement) continue;

    scheduledBookings.push({
      ...booking,
      id: `local-preview-${selectedDate}-${booking.id}`,
      start: placement.start,
      date: formatScheduleDateLabel(selectedDate),
      staff: placement.staffColumn.role,
      staffKey: placement.staffColumn.key,
      staffName: placement.staffColumn.name,
    });
  }

  return scheduledBookings;
}

const staffCommentStorageKey = "petmanager.ownerWeb.staffComments";
const initialStaffComments: Record<string, string> = {
  "우유|정유진": "첫 방문 때 긴장했음. 목 주변은 잡아주면 안정됨.",
  "몽이|김민지": "물 온도 낮으면 싫어함. 시작 전에 충분히 적셔주기.",
};
const customerRequestByBookingId: Record<string, string> = {
  "C-01": "배 쪽은 저자극 샴푸로 부탁드려요.",
  "C-03": "이전처럼 얼굴은 둥글게 정리해 주세요.",
  "C-07": "부분 미용만 깔끔하게 부탁드려요.",
};

function getCustomerRequest(bookingId: string) {
  return customerRequestByBookingId[bookingId] || "";
}

function getCustomerCommentKey(booking: Pick<DailyBooking, "pet" | "customer">) {
  return `${booking.pet}|${booking.customer}`;
}

function SummaryStrip({
  activeMetric,
  metrics,
  onSelectMetric,
}: {
  activeMetric: SummaryMetricKey;
  metrics: ScheduleMetric[];
  onSelectMetric: (metric: SummaryMetricKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {metrics.map((metric) => (
        <button
          key={metric.key}
          type="button"
          onClick={() => onSelectMetric(metric.key as SummaryMetricKey)}
          className={cn(
            "inline-flex h-[36px] items-center gap-2 rounded-[8px] border px-3 text-left text-[15px] font-normal transition",
            activeMetric === metric.key
              ? "border-[#dbe2ea] bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              : "border-transparent text-[#475569] hover:border-[#e2e8f0] hover:bg-white",
          )}
        >
          <span>{metric.label}</span>
          {metric.value ? <span className="text-[#111827]">{metric.value}</span> : null}
        </button>
      ))}
    </div>
  );
}

function ReservationFilterStrip({
  activeFilter,
  options,
  onSelectFilter,
}: {
  activeFilter: ReservationStatusFilter;
  options: Array<{ key: ReservationStatusFilter; label: string; count: number }>;
  onSelectFilter: (filter: ReservationStatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onSelectFilter(option.key)}
          className={cn(
            "inline-flex h-[38px] items-center gap-2 rounded-[8px] border px-3.5 text-[15px] font-normal transition",
            activeFilter === option.key
              ? "border-[#2f7866] bg-[#eef7f4] text-[#1f6b5b]"
              : "border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc]",
          )}
        >
          <span>{option.label}</span>
          <span className={activeFilter === option.key ? "text-[#1f6b5b]" : "text-[#111827]"}>{option.count}</span>
        </button>
      ))}
    </div>
  );
}

function BookingSidePanel({
  activeMetric,
  manualApprovalEnabled,
  selectedBooking,
  selectedBookingId,
  approvalModeBookings,
  onManualApprovalChange,
  onChangeStatus,
  onSelectBooking,
  onAcknowledgeChange,
  staffComments,
  onChangeStaffComment,
}: {
  activeMetric: SummaryMetricKey;
  manualApprovalEnabled: boolean;
  selectedBooking: DailyBooking | undefined;
  selectedBookingId: string;
  approvalModeBookings: DailyBooking[];
  onManualApprovalChange: (enabled: boolean) => void;
  onChangeStatus: (bookingId: string, nextStatus: string) => void;
  onSelectBooking: (id: string) => void;
  onAcknowledgeChange: (bookingId: string) => void;
  staffComments: Record<string, string>;
  onChangeStaffComment: (commentKey: string, value: string) => void;
}) {
  const timeRange = selectedBooking
    ? `${formatHourLabel(selectedBooking.start)}-${formatHourLabel(selectedBooking.start + selectedBooking.duration)}`
    : "";
  const commentKey = selectedBooking ? getCustomerCommentKey(selectedBooking) : "";
  const staffComment = commentKey ? staffComments[commentKey] ?? "" : "";
  const customerRequest = selectedBooking ? getCustomerRequest(selectedBooking.id) || "요청이 없습니다." : "";
  const sourceStatus = selectedBooking?.sourceStatus ?? selectedBooking?.status ?? "";
  const displayStatus = selectedBooking?.status ?? "";
  const changeEventSelected = selectedBooking ? isChangeBookingStatus(selectedBooking.status) : false;
  const startEnabled = selectedBooking ? canStartGrooming(sourceStatus) && displayStatus === "확정" : false;
  const completeEnabled = selectedBooking ? canSendCompletionNotice(sourceStatus, displayStatus) : false;
  const startLabel = startEnabled ? "미용 시작" : displayStatus === "진행 중" ? "자동 진행 중" : displayStatus === "완료" ? "완료됨" : "확정 후 시작";
  const completeLabel =
    completeEnabled ? "미용 완료" : sourceStatus === "픽업 준비" ? "알림 완료" : displayStatus === "완료" ? "완료됨" : "진행 후 완료";
  const [activePanelTab, setActivePanelTab] = useState<"details" | "comments">("details");

  useEffect(() => {
    setActivePanelTab("details");
  }, [selectedBooking?.id]);

  return (
    <aside className="min-w-0 space-y-4">
      <WebSurface className="min-w-0 overflow-hidden">
        {selectedBooking ? (
          <div className="p-4">
            <div className="border-b border-[#edf2f7] pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="break-keep text-[22px] font-medium leading-7 tracking-[-0.03em] text-[#111827]">{selectedBooking.pet} · {selectedBooking.customer}</h3>
                  <p className="mt-1 text-[13px] text-[#64748b]">담당 {selectedBooking.staffName}</p>
                </div>
                <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e2e8f0] bg-[#f8fafc] p-0.5 text-[12px] text-[#64748b]">
                <button
                  type="button"
                  onClick={() => setActivePanelTab("details")}
                  className={cn(
                    "rounded-full px-2.5 py-1 transition",
                    activePanelTab === "details" ? "bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.06)]" : "hover:bg-white",
                  )}
                >
                  상세
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanelTab("comments")}
                  className={cn(
                    "rounded-full px-2.5 py-1 transition",
                    activePanelTab === "comments" ? "bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.06)]" : "hover:bg-white",
                  )}
                >
                  코멘트 <span className="ml-0.5 text-[#94a3b8]">{staffComment.trim() ? 1 : 0}</span>
                </button>
              </div>
              </div>
            </div>

            {activePanelTab === "details" ? (
              <>
                <div className="mt-4">
                  <p className="text-[12px] text-[#94a3b8]">시간</p>
                  <p className="mt-1 text-[26px] font-medium tracking-[-0.04em] text-[#111827]">{timeRange}</p>
                  <div className="mt-3">
                    <p className="text-[12px] text-[#94a3b8]">작업</p>
                    <p className="mt-1 text-[20px] font-medium tracking-[-0.03em] text-[#111827]">{selectedBooking.service}</p>
                  </div>
                </div>

                {changeEventSelected ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[8px] border border-[#ead6dc] bg-[#fffafa] px-3 py-3">
                      <p className="text-[12px] text-[#9f6b78]">변경 · 취소 확인</p>
                      <p className="mt-1 text-[15px] font-medium text-[#8f2438]">{selectedBooking.status}된 예약입니다.</p>
                      <p className="mt-1 text-[13px] leading-5 text-[#64748b]">확인하면 스케줄 보드와 변경 · 취소 관리에서 더 이상 보이지 않습니다.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAcknowledgeChange(selectedBooking.id)}
                      className="inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[#8f2438] px-3 text-[14px] font-medium text-white transition hover:bg-[#782033]"
                    >
                      확인
                    </button>
                  </div>
                ) : isPendingBookingStatus(selectedBooking.status) ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onChangeStatus(selectedBooking.id, "확정")}
                      className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#1f6b5b] px-3 text-[14px] font-medium text-white transition hover:bg-[#185848]"
                    >
                      예약 확정
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeStatus(selectedBooking.id, "거절")}
                      className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#ead7c7] bg-white px-3 text-[14px] font-medium text-[#9a4f1f] transition hover:bg-[#fff7ed]"
                    >
                      예약 거절
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!startEnabled}
                      onClick={() => {
                        if (startEnabled) onChangeStatus(selectedBooking.id, "진행 중");
                      }}
                      className={cn(
                        "inline-flex h-11 items-center justify-center rounded-[8px] border px-3 text-[14px] font-medium transition",
                        startEnabled
                          ? "border-[#cfded8] bg-white text-[#1f6b5b] hover:bg-[#f6fbf9]"
                          : "border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8] cursor-not-allowed",
                      )}
                    >
                      {startLabel}
                    </button>
                    <button
                      type="button"
                      disabled={!completeEnabled}
                      onClick={() => {
                        if (completeEnabled) onChangeStatus(selectedBooking.id, "픽업 준비");
                      }}
                      className={cn(
                        "inline-flex h-11 items-center justify-center gap-2 rounded-[8px] px-3 text-[14px] font-medium transition",
                        completeEnabled ? "bg-[#2f7866] text-white hover:bg-[#286a5a]" : "bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed",
                      )}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {completeLabel}
                    </button>
                  </div>
                )}

                <div className="mt-4 border-t border-[#edf2f7] pt-4">
                  <p className="text-[12px] text-[#94a3b8]">고객 요청</p>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-[#111827]">{customerRequest}</p>
                </div>
              </>
            ) : (
              <div id="staff-comment" className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] text-[#94a3b8]">스태프 코멘트</p>
                  <span className="text-[11px] text-[#94a3b8]">고객 관리 공유</span>
                </div>
                <textarea
                  value={staffComment}
                  onChange={(event) => onChangeStaffComment(commentKey, event.target.value)}
                  placeholder="전 작업자가 남긴 특징이나 다음 작업 팁을 적어주세요."
                  className="mt-2 h-[190px] w-full resize-none rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-[14px] leading-6 text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#cfded8] focus:bg-white"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <p className="text-[13px] text-[#64748b]">예약을 선택하면 상세와 알림을 확인할 수 있습니다.</p>
          </div>
        )}
      </WebSurface>
    </aside>
  );
}

function PendingApprovalPanel({
  approvalModeBookings,
  manualApprovalEnabled,
  selectedBooking,
  selectedBookingId,
  onManualApprovalChange,
  onSelectBooking,
  onChangeStatus,
}: {
  approvalModeBookings: DailyBooking[];
  manualApprovalEnabled: boolean;
  selectedBooking: DailyBooking | undefined;
  selectedBookingId: string;
  onManualApprovalChange: (enabled: boolean) => void;
  onSelectBooking: (id: string) => void;
  onChangeStatus: (bookingId: string, nextStatus: string) => void;
}) {
  const panelTitle = manualApprovalEnabled ? "승인 대기" : "바로 확정";
  const policyStatus = manualApprovalEnabled ? "현재 상태: 승인 후 예약이 확정됩니다." : "현재 상태: 예약이 바로 확정됩니다.";
  const listTitle = manualApprovalEnabled ? "대기 예약" : "확정 예약";
  const selectedLabel = manualApprovalEnabled ? "선택한 대기 예약" : "선택한 확정 예약";
  const emptyLabel = manualApprovalEnabled ? "승인 대기 예약이 없습니다." : "바로 확정된 예약이 없습니다.";
  const approvalHelp = manualApprovalEnabled
    ? "고객 예약은 승인 대기로 들어오고, 예약 확정 후에만 미용을 시작할 수 있습니다."
    : "가능한 시간은 고객 예약 즉시 확정되고, 스케줄에 바로 반영됩니다.";
  const sortedApprovalModeBookings = useMemo(
    () => [...approvalModeBookings].sort((first, second) => first.start - second.start || first.id.localeCompare(second.id)),
    [approvalModeBookings],
  );

  return (
    <aside className="min-w-0 space-y-4">
      <WebSurface className="min-w-0 overflow-hidden">
        <div className="p-4">
          <div className="border-b border-[#edf2f7] pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[22px] font-medium tracking-[-0.03em] text-[#111827]">{panelTitle}</h3>
                <p className="mt-1 text-[13px] text-[#64748b]">{policyStatus}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={manualApprovalEnabled}
                  onClick={() => onManualApprovalChange(!manualApprovalEnabled)}
                  className={cn(
                    "relative h-8 w-14 shrink-0 rounded-full transition",
                    manualApprovalEnabled ? "bg-[#1f6b5b]" : "bg-[#cbd5e1]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgba(15,23,42,0.18)] transition",
                      manualApprovalEnabled ? "left-7" : "left-1",
                    )}
                  />
                </button>
                <div className="group/help relative">
                  <button
                    type="button"
                    aria-label={approvalHelp}
                    title={approvalHelp}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#8b9bb0] transition hover:bg-[#f1f5f9] hover:text-[#1f6b5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5b]"
                  >
                    <CircleHelp className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <p className="pointer-events-none absolute right-0 top-9 z-30 hidden w-[248px] rounded-[8px] border border-[#d8e2ea] bg-white px-3 py-2 text-[12px] leading-5 text-[#475569] shadow-[0_10px_24px_rgba(15,23,42,0.12)] group-hover/help:block group-focus-within/help:block">
                    {approvalHelp}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {manualApprovalEnabled ? (
            <>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] text-[#111827]">{listTitle}</p>
                  <span className="rounded-full bg-[#fff5c7] px-2 py-1 text-[11px] text-[#9f6f00]">{sortedApprovalModeBookings.length}건</span>
                </div>

                <div className="mt-2 max-h-[280px] overflow-y-auto rounded-[8px] border border-[#edf2f7] bg-white">
                  {sortedApprovalModeBookings.length > 0 ? (
                    sortedApprovalModeBookings.map((booking) => {
                      const selected = selectedBookingId === booking.id;
                      const timeRange = `${formatHourLabel(booking.start)}-${formatHourLabel(booking.start + booking.duration)}`;

                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => onSelectBooking(booking.id)}
                          className={cn(
                            "group flex w-full items-center gap-3 border-b border-[#edf2f7] px-3 py-2.5 text-left transition last:border-b-0 hover:bg-[#fffdf2]",
                            selected && "bg-[#fff8dc]",
                          )}
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#edbd3f] transition" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-[14px] font-medium text-[#111827]">{booking.pet} · {booking.customer}</p>
                              <span className="shrink-0 text-[11px] tabular-nums text-[#9f6f00]">{timeRange}</span>
                            </div>
                            <p className="mt-0.5 truncate text-[12px] text-[#64748b]">{booking.service}</p>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-[8px] border border-dashed border-[#dbe2ea] bg-[#f8fafc] px-3 py-5 text-center text-[13px] text-[#94a3b8]">
                      {emptyLabel}
                    </div>
                  )}
                </div>
              </div>

              {selectedBooking ? (
                <div className="mt-4 border-t border-[#edf2f7] pt-4">
                  <p className="text-[12px] text-[#94a3b8]">{selectedLabel}</p>
                  <h4 className="mt-1 text-[20px] font-medium tracking-[-0.03em] text-[#111827]">{selectedBooking.pet} · {selectedBooking.customer}</h4>
                  <p className="mt-1 text-[13px] text-[#64748b]">
                    {formatHourLabel(selectedBooking.start)}-{formatHourLabel(selectedBooking.start + selectedBooking.duration)} · {selectedBooking.service}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onChangeStatus(selectedBooking.id, "확정")}
                      className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#1f6b5b] px-3 text-[14px] font-medium text-white transition hover:bg-[#185848]"
                    >
                      예약 확정
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeStatus(selectedBooking.id, "거절")}
                      className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#ead7c7] bg-white px-3 text-[14px] font-medium text-[#9a4f1f] transition hover:bg-[#fff7ed]"
                    >
                      예약 거절
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3 text-[13px] leading-5 text-[#64748b]">
                  리스트나 보드에서 대기 예약을 선택하면 같은 예약이 함께 강조됩니다.
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-[8px] border border-[#d8e7e1] bg-[#f9fdfb] p-4">
                <p className="text-[13px] font-semibold text-[#1f6b5b]">바로 확정 모드</p>
                <p className="mt-2 text-[13px] leading-5 text-[#475569]">
                  고객 예약은 접수 즉시 확정됩니다. 별도의 확정 예약 목록은 만들지 않고, 모든 관리는 예약 현황에서 처리합니다.
                </p>
              </div>
              <div className="rounded-[8px] border border-[#e2e8f0] bg-white p-4">
                <p className="text-[13px] font-semibold text-[#111827]">화면 기준</p>
                <p className="mt-2 text-[13px] leading-5 text-[#64748b]">
                  확정된 예약은 스케줄 보드에서 초록 카드로 표시됩니다. 미용 시작, 시간 이동, 취소 처리는 예약 현황 카드에서 진행합니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </WebSurface>
    </aside>
  );
}

function ApprovalModeSettingsPanel({
  manualApprovalEnabled,
  onManualApprovalChange,
}: {
  manualApprovalEnabled: boolean;
  onManualApprovalChange: (enabled: boolean) => void;
}) {
  const modes = [
    {
      key: "manual",
      title: "승인 후 확정",
      description: "고객 예약은 승인 대기로 들어오고, 오너가 확정해야 스케줄에 반영됩니다.",
      selected: manualApprovalEnabled,
      onClick: () => onManualApprovalChange(true),
    },
    {
      key: "instant",
      title: "바로 확정",
      description: "가능한 시간에 접수된 고객 예약은 즉시 확정되고, 예약 현황에서 바로 관리합니다.",
      selected: !manualApprovalEnabled,
      onClick: () => onManualApprovalChange(false),
    },
  ];

  return (
    <WebSurface className="min-w-0 p-5">
      <div className="max-w-[760px]">
        <p className="text-[12px] font-semibold tracking-[0.12em] text-[#94a3b8]">예약 접수 방식</p>
        <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">예약을 어떻게 확정할까요?</h3>
        <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
          바로 확정 모드에서는 별도 승인 보드가 필요 없습니다. 승인 대기를 사용할 때만 대기 예약을 확인하고 확정/거절을 처리합니다.
        </p>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={mode.onClick}
            className={cn(
              "rounded-[8px] border p-4 text-left transition",
              mode.selected ? "border-[#2f7866] bg-[#f6fbf9] ring-1 ring-[#2f7866]/15" : "border-[#dbe2ea] bg-white hover:bg-[#f8fafc]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-semibold text-[#111827]">{mode.title}</p>
                <p className="mt-2 text-[13px] leading-5 text-[#64748b]">{mode.description}</p>
              </div>
              <span
                className={cn(
                  "mt-1 h-5 w-5 shrink-0 rounded-full border",
                  mode.selected ? "border-[#2f7866] bg-[#2f7866] shadow-[inset_0_0_0_4px_white]" : "border-[#cbd5e1] bg-white",
                )}
                aria-hidden="true"
              />
            </div>
          </button>
        ))}
      </div>
    </WebSurface>
  );
}

function CalendarToolbar({
  selectedDate,
  staff,
  visibleStaff,
  onDateChange,
  onStaffChange,
  onAddSchedule,
}: {
  selectedDate: string;
  staff: StaffFilter;
  visibleStaff: OwnerWebStaffColumn[];
  onDateChange: (date: string) => void;
  onStaffChange: (staff: StaffFilter) => void;
  onAddSchedule: () => void;
}) {
  const staffLabel = staff === "전체 스태프" ? "전체 스태프" : visibleStaff.find((item) => item.key === staff)?.name ?? "전체 스태프";

  return (
    <div className="border-b border-[#e2e8f0] px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, -1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDateChange(currentDateInTimeZone())}
            className="inline-flex min-w-[178px] items-center justify-center rounded-[8px] px-2 text-[17px] font-medium text-[#111827] hover:bg-[#f8fafc]"
          >
            {formatScheduleDateLabel(selectedDate)}
          </button>
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <SoftSelect<StaffFilter>
            label="담당"
            value={staff}
            onChange={onStaffChange}
            options={[
              { value: "전체 스태프", label: "전체 스태프" },
              ...visibleStaff.map((option) => ({ value: option.key, label: option.name })),
            ]}
            className="min-w-[188px]"
            buttonClassName="h-9"
          />
          <button
            type="button"
            onClick={onAddSchedule}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-[#1f6b5b] px-4 text-[14px] font-medium text-white transition hover:bg-[#185848]"
          >
            <CalendarPlus className="h-4 w-4" />
            스케줄 추가
          </button>
        </div>
      </div>
    </div>
  );
}

function DailyScheduleGrid({
  bookings,
  staff,
  visibleStaff,
  activeMetric,
  manualApprovalEnabled,
  selectedBookingId,
  conflictBookings,
  onSelectBooking,
  onMoveBooking,
  onResizeBooking,
}: {
  bookings: DailyBooking[];
  staff: StaffFilter;
  visibleStaff: OwnerWebStaffColumn[];
  activeMetric: SummaryMetricKey;
  manualApprovalEnabled: boolean;
  selectedBookingId: string;
  conflictBookings: DailyBooking[];
  onSelectBooking: (id: string) => void;
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
  const scheduleStaff = staff === "전체 스태프" ? visibleStaff : visibleStaff.filter((item) => item.key === staff);
  const staffScopedBookings = bookings.filter((booking) => scheduleStaff.some((item) => item.key === booking.staffKey));
  const metricFilteredBookings = staffScopedBookings.filter((booking) => {
    if (activeMetric === "completed") return isCompletedBookingStatus(booking.status);
    if (activeMetric === "changes") return isChangeBookingStatus(booking.status);
    if (activeMetric === "today") return isBookableStatus(booking.status) || isChangeBookingStatus(booking.status);
    return true;
  });
  const visibleBookings = metricFilteredBookings;
  const columnCount = scheduleStaff.length;
  const scrollable = columnCount > 4;
  const compactCards = columnCount >= 3;
  const columnFlexBasis = scrollable ? "0 0 calc((100% - 24px) / 4)" : `0 0 calc((100% - ${(columnCount - 1) * 8}px) / ${columnCount})`;
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
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", bookingId);
    setDraggingBookingId(bookingId);
    onSelectBooking(bookingId);
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
      staff: staffMember.role,
      start: nextStart,
    });
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
    <div className="bg-white">
      <div className="flex bg-white">
        <div className="flex w-[64px] shrink-0 items-center justify-center border-r border-[#e2e8f0] bg-[#f8fafc] px-2 pt-2">
          <span className="inline-flex h-[40px] w-full items-center justify-center rounded-t-[8px] bg-[#f3f4f6] text-[12px] text-[#64748b]">
            시간
          </span>
        </div>
        <div
          ref={headerScrollerRef}
          onScroll={() => syncHorizontalScroll("header")}
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-full gap-2 px-2 pb-0 pt-2 pr-4" style={scheduleTrackStyle}>
            {scheduleStaff.map((staffMember) => {
              const staffBookings = displayedVisibleBookings.filter((booking) => booking.staffKey === staffMember.key);
              const activeStatusCount = staffBookings.filter((booking) => isActiveBookingStatus(booking.status)).length;

              return (
                <section
                  key={staffMember.key}
                  className="min-w-0 rounded-t-[8px] bg-[#f3f4f6] px-3 py-2"
                  style={{ flex: columnFlexBasis }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-medium text-[#111827]">{staffMember.name}</p>
                        <span className="text-[12px] text-[#64748b]">{staffBookings.length}</span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[11px]",
                        activeStatusCount > 0 ? "bg-[#e6f3ef] text-[#1f6b5b]" : "bg-white text-[#94a3b8]",
                      )}
                    >
                      {activeStatusCount > 0 ? "진행" : "대기"}
                    </span>
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
          "max-h-[504px] overflow-y-auto select-none",
          boardPanning && "cursor-grabbing snap-none",
          !boardPanning && scrollable && "cursor-grab",
        )}
      >
        <div className="flex">
          <div className="w-[64px] shrink-0 border-r border-[#e2e8f0] bg-[#f8fafc] px-2">
            <div className="relative" style={{ height: scheduleBodyHeight }}>
              {Array.from({ length: (scheduleEndHour - scheduleStartHour) * 4 + 1 }).map((_, index) => (
                <div
                  key={`time-rail-line-${index}`}
                  className={cn(
                    "absolute left-0 right-0 border-t",
                    index % 4 === 0 ? "border-[#dbe2ea]" : "border-[#e9eef4]",
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
                  <span className="h-px flex-1 bg-[#dbe2ea]" aria-hidden="true" />
                  <span className="shrink-0 bg-[#f8fafc] px-1">{hour}</span>
                  <span className="h-px flex-1 bg-[#dbe2ea]" aria-hidden="true" />
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
              {scheduleStaff.map((staffMember) => {
                const staffBookings = displayedVisibleBookings
                  .filter((booking) => booking.staffKey === staffMember.key)
                  .sort((a, b) => a.start - b.start);
                const bookingLayouts = getStaffBookingLayouts(staffBookings);
                return (
                  <section
                    key={staffMember.key}
                    onDragOver={handleColumnDragOver}
                    onDrop={(event) => handleColumnDrop(event, staffMember)}
                    className={cn(
                      "min-w-0 rounded-b-[8px] bg-[#f3f4f6] p-0 transition",
                      draggingBookingId && "ring-1 ring-inset ring-[#2f7866]/20",
                    )}
                    style={{ flex: columnFlexBasis }}
                  >
                    <div className="relative" style={{ height: scheduleBodyHeight }}>
                      {Array.from({ length: (scheduleEndHour - scheduleStartHour) * 4 + 1 }).map((_, index) => (
                        <div
                          key={`${staffMember.key}-line-${index}`}
                          className={cn(
                            "absolute left-0 right-0 border-t",
                            index % 4 === 0 ? "border-white" : "border-white/55",
                          )}
                          style={{ top: scheduleBodyInsetY + index * quarterSlotHeight }}
                        />
                      ))}
                      {staffBookings.length === 0 ? (
                        <div className="rounded-[8px] border border-dashed border-[#d1d5db] bg-white/60 px-3 py-4 text-center text-[12px] text-[#94a3b8]">
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
                              )}
                              style={{
                                ...bookingLayoutStyle,
                                top: getBookingTop(booking.start),
                                height: bookingHeight,
                              }}
                            >
                              <span className={cn("absolute bottom-0 left-0 top-0 w-1 rounded-l-[8px]", getBookingIndicatorClass(cardTone))} aria-hidden="true" />
                              <div className="absolute inset-0 flex min-h-0 min-w-0 items-center overflow-hidden pl-4 pr-3 text-left">
                                <div
                                  className={cn(
                                    "grid w-full min-w-0 items-center gap-x-2",
                                    microCard ? "grid-cols-[minmax(0,1fr)_max-content]" : "grid-cols-[minmax(0,1fr)_auto]",
                                    microCard ? "grid-rows-[16px]" : "grid-rows-[16px_16px] gap-y-[2.5px]",
                                  )}
                                >
                                  <p
                                    className={cn(
                                      "min-w-0 truncate text-[13px] font-medium leading-[16px]",
                                      cardTone === "completed" ? "text-[#6b7280]" : "text-[#0f172a]",
                                    )}
                                  >
                                    {`${booking.pet} · ${booking.customer}`}
                                  </p>
                                  <span
                                    className={cn(
                                      "shrink-0 justify-self-end text-[13px] leading-[16px]",
                                      microCard
                                        ? "max-w-[92px] truncate whitespace-nowrap text-[#64748b]"
                                        : `whitespace-nowrap tabular-nums ${getBookingTimeTextClass(cardTone)}`,
                                    )}
                                  >
                                    {microCard ? booking.service : timeLabel}
                                  </span>
                                  {!microCard ? (
                                    <p className="col-span-2 min-w-0 truncate text-[13px] leading-[16px] text-[#64748b]">
                                      {booking.service}
                                    </p>
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

type ScheduleDaySummary = {
  date: string;
  bookings: DailyBooking[];
  counts: ReturnType<typeof getBookingCounts>;
};

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
        ? "bg-[#fff1f1] text-[#b42318]"
        : "bg-[#e6f3ef] text-[#1f6b5b]";

  return (
    <div className={cn("rounded-[8px] px-2 py-1.5", toneClass)}>
      <p className="text-[11px]">{label}</p>
      <p className="text-[13px] font-semibold">{value}건</p>
    </div>
  );
}

function WeeklyScheduleOverview({
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
                    )}
                  >
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
                      {(() => {
                        const tone = getBookingCardTone(booking.status);
                        return (
                          <>
                            <span className={cn("absolute bottom-0 left-0 top-0 w-1 rounded-l-[8px]", getBookingIndicatorClass(tone))} aria-hidden="true" />
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

function MonthlyScheduleOverview({
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
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#1f6b5b]" />예약 많음</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#b9d8cf]" />예약 있음</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" />승인 대기</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ef4444]" />변경/취소</span>
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
                {counts.changes > 0 ? <p className="truncate text-[11px] text-[#b42318]">변경/취소 {counts.changes}건</p> : null}
              </div>
              <div className="mt-3 flex gap-1">
                {counts.pending > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" /> : null}
                {counts.changes > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" /> : null}
                {counts.completed > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-[#1f6b5b]" /> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildDefaultScheduleForm(data: BootstrapPayload, visibleStaff: OwnerWebStaffColumn[], selectedDate: string, staff: StaffFilter): ScheduleCreateFormState {
  const initialStaff = staff === "전체 스태프" ? visibleStaff[0] : visibleStaff.find((item) => item.key === staff) ?? visibleStaff[0];
  return {
    customerMode: "new",
    petId: data.pets[0]?.id ?? "",
    customerName: "",
    petName: "",
    customerPhone: "",
    serviceId: data.services.find((service) => service.is_active)?.id ?? data.services[0]?.id ?? "",
    staffKey: initialStaff?.key ?? "staff-1",
    date: selectedDate,
    time: "",
    memo: "",
  };
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

async function postOwnerAppointment(payload: unknown) {
  try {
    return await fetchApiJsonWithAuth<Appointment>("/api/appointments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Supabase 연결") || message.includes("로그인이 필요")) {
      return fetchApiJson<Appointment>("/api/appointments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    throw error;
  }
}

async function postOwnerGuardian(payload: unknown) {
  try {
    return await fetchApiJsonWithAuth<Guardian>("/api/guardians", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Supabase ?곌껐") || message.includes("濡쒓렇?몄씠 ?꾩슂")) {
      return fetchApiJson<Guardian>("/api/guardians", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    throw error;
  }
}

async function postOwnerPet(payload: unknown) {
  try {
    return await fetchApiJsonWithAuth<Pet>("/api/pets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Supabase ?곌껐") || message.includes("濡쒓렇?몄씠 ?꾩슂")) {
      return fetchApiJson<Pet>("/api/pets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    throw error;
  }
}

function normalizeSchedulePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function buildLocalGuardian(params: { shopId: string; name: string; phone: string; memo?: string }): Guardian {
  const now = new Date().toISOString();
  return {
    id: `local-guardian-${crypto.randomUUID()}`,
    shop_id: params.shopId,
    name: params.name,
    phone: params.phone,
    memo: params.memo ?? "",
    notification_settings: {
      enabled: true,
      revisit_enabled: true,
      booking_confirmed_enabled: true,
      booking_rejected_enabled: true,
      booking_cancelled_enabled: true,
      booking_rescheduled_enabled: true,
      appointment_reminder_10m_enabled: true,
      grooming_started_enabled: true,
      grooming_almost_done_enabled: true,
      grooming_completed_enabled: true,
      birthday_greeting_enabled: true,
    },
    created_at: now,
    updated_at: now,
  };
}

function buildLocalPet(params: { shopId: string; guardianId: string; name: string }): Pet {
  const now = new Date().toISOString();
  return {
    id: `local-pet-${crypto.randomUUID()}`,
    shop_id: params.shopId,
    guardian_id: params.guardianId,
    name: params.name,
    breed: "미입력",
    weight: null,
    age: null,
    notes: "",
    birthday: null,
    grooming_cycle_weeks: 4,
    avatar_seed: params.name.trim().slice(0, 1) || "P",
    created_at: now,
    updated_at: now,
  };
}

function buildLocalOwnerAppointment(params: {
  shopId: string;
  guardianId: string;
  petId: string;
  serviceId: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  memo: string;
}): Appointment {
  const startMinute = Math.round(timeToHour(params.appointmentTime) * 60);
  const endMinute = startMinute + params.durationMinutes;
  const endDate = addDate(params.appointmentDate, Math.floor(endMinute / (24 * 60)));
  const now = new Date().toISOString();

  return {
    id: `local-${crypto.randomUUID()}`,
    shop_id: params.shopId,
    guardian_id: params.guardianId,
    pet_id: params.petId,
    service_id: params.serviceId,
    appointment_date: params.appointmentDate,
    appointment_time: params.appointmentTime,
    status: "confirmed",
    memo: params.memo,
    rejection_reason: null,
    start_at: `${params.appointmentDate}T${params.appointmentTime}:00+09:00`,
    end_at: `${endDate}T${formatHourLabel((endMinute % (24 * 60)) / 60)}:00+09:00`,
    source: "owner",
    created_at: now,
    updated_at: now,
  };
}

type ScheduleDropdownOption = {
  value: string;
  label: string;
  meta?: string;
};

function ScheduleDropdown({
  label,
  value,
  options,
  placeholder = "선택",
  onChange,
}: {
  label: string;
  value: string;
  options: ScheduleDropdownOption[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative space-y-1.5">
      <span className="text-[12px] text-[#64748b]">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-[8px] border bg-white px-3 text-left text-[14px] outline-none transition",
          open ? "border-[#1f6b5b] ring-[3px] ring-[#1f6b5b]/10" : "border-[#dbe2ea] hover:border-[#b8c8d8]",
        )}
      >
        <span className="min-w-0">
          <span className={cn("block truncate", selected ? "text-[#111827]" : "text-[#94a3b8]")}>
            {selected?.label ?? placeholder}
          </span>
          {selected?.meta ? <span className="mt-0.5 block truncate text-[11px] text-[#64748b]">{selected.meta}</span> : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#64748b] transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[68px] z-[70] overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
          <div className="max-h-[220px] overflow-y-auto p-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-[7px] px-3 py-2.5 text-left transition",
                  option.value === value ? "bg-[#e8f4f0] text-[#1f6b5b]" : "text-[#111827] hover:bg-[#f8fafc]",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px]">{option.label}</span>
                  {option.meta ? <span className="mt-0.5 block truncate text-[12px] text-[#64748b]">{option.meta}</span> : null}
                </span>
                {option.value === value ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#1f6b5b]" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleCreateDialog({
  data,
  bookings,
  form,
  selectedDate,
  visibleStaff,
  staffAssignments,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  data: BootstrapPayload;
  bookings: DailyBooking[];
  form: ScheduleCreateFormState;
  selectedDate: string;
  visibleStaff: OwnerWebStaffColumn[];
  staffAssignments: StaffAssignments;
  saving: boolean;
  error: string;
  onChange: (form: ScheduleCreateFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const petRows = data.pets.map((pet) => ({
    pet,
    guardian: data.guardians.find((guardian) => guardian.id === pet.guardian_id),
  }));
  const activeServices = data.services.filter((service) => service.is_active);
  const customerModeOptions: ScheduleDropdownOption[] = [
    { value: "new", label: "신규 고객 입력", meta: "고객명, 연락처, 반려동물명을 직접 입력" },
    { value: "existing", label: "기존 고객 선택", meta: "등록된 고객과 반려동물에서 선택" },
  ];
  const petOptions = petRows.map(({ pet, guardian }) => ({
    value: pet.id,
    label: `${pet.name} · ${guardian?.name ?? "보호자 미등록"}`,
    meta: guardian?.phone ?? undefined,
  }));
  const serviceOptions = activeServices.map((service) => ({
    value: service.id,
    label: service.name,
    meta: `${service.duration_minutes}분 · ${service.price.toLocaleString()}원`,
  }));
  const staffOptions = visibleStaff.map((staffMember) => ({
    value: staffMember.key,
    label: staffMember.name,
    meta: staffMember.role,
  }));
  const selectedService = data.services.find((service) => service.id === form.serviceId);
  const duration = selectedService ? selectedService.duration_minutes / 60 : 1;
  const dateBookings =
    form.date === selectedDate
      ? bookings
      : buildDailyBookingsFromBootstrap(data, form.date, staffAssignments);
  const availableSlots = selectedService
    ? computeAvailableSlots({
        date: form.date,
        serviceId: selectedService.id,
        shop: data.shop,
        services: data.services,
        appointments: data.appointments,
      }).filter((slot) => !hasStaffBookingConflict(dateBookings, "__new-booking__", { staffKey: form.staffKey, start: timeToHour(slot), duration }))
    : [];
  const selectedPet = data.pets.find((pet) => pet.id === form.petId);
  const selectedGuardian = selectedPet ? data.guardians.find((guardian) => guardian.id === selectedPet.guardian_id) : null;
  const hasCustomerInfo =
    form.customerMode === "existing"
      ? Boolean(form.petId)
      : Boolean(form.customerName.trim() && form.petName.trim() && normalizeSchedulePhone(form.customerPhone).length >= 10);
  const canSubmit = Boolean(hasCustomerInfo && form.serviceId && form.staffKey && form.date && form.time && !saving);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[560px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[20px] font-medium text-[#111827]">스케줄 추가</h3>
            <p className="mt-1 text-[13px] text-[#64748b]">기존 고객을 선택해 예약을 바로 등록합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 rounded-[8px] border border-[#dbe2ea] px-3 text-[13px] text-[#475569]">
            닫기
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <ScheduleDropdown
            label="고객 등록 방식"
            value={form.customerMode}
            options={customerModeOptions}
            onChange={(value) => onChange({ ...form, customerMode: value as "new" | "existing", time: "" })}
          />

          {form.customerMode === "existing" ? (
            <ScheduleDropdown
              label="고객 / 반려동물"
              value={form.petId}
              options={petOptions}
              placeholder="기존 고객을 선택해 주세요"
              onChange={(value) => onChange({ ...form, petId: value })}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-[12px] text-[#64748b]">고객명</span>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(event) => onChange({ ...form, customerName: event.target.value })}
                  className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none transition focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10"
                  placeholder="예: 김민지"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[12px] text-[#64748b]">반려동물 이름</span>
                <input
                  type="text"
                  value={form.petName}
                  onChange={(event) => onChange({ ...form, petName: event.target.value })}
                  className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none transition focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10"
                  placeholder="예: 몽이"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[12px] text-[#64748b]">고객 연락처</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.customerPhone}
                  onChange={(event) => onChange({ ...form, customerPhone: normalizeSchedulePhone(event.target.value) })}
                  className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none transition focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10"
                  placeholder="01012345678"
                />
              </label>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <ScheduleDropdown
              label="서비스"
              value={form.serviceId}
              options={serviceOptions}
              onChange={(value) => onChange({ ...form, serviceId: value, time: "" })}
            />
            <ScheduleDropdown
              label="담당"
              value={form.staffKey}
              options={staffOptions}
              onChange={(value) => onChange({ ...form, staffKey: value as StaffKey, time: "" })}
            />
            <label className="space-y-1.5">
              <span className="text-[12px] text-[#64748b]">날짜</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => onChange({ ...form, date: event.target.value, time: "" })}
                className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none transition focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10"
              />
            </label>
          </div>
        </div>

        <div className="hidden">
          <label className="space-y-1.5">
            <span className="text-[12px] text-[#64748b]">고객 / 반려동물</span>
            <select
              value={form.petId}
              onChange={(event) => onChange({ ...form, petId: event.target.value })}
              className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none focus:border-[#1f6b5b]"
            >
              {petRows.map(({ pet, guardian }) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name} · {guardian?.name ?? "보호자 미등록"}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[12px] text-[#64748b]">서비스</span>
            <select
              value={form.serviceId}
              onChange={(event) => onChange({ ...form, serviceId: event.target.value, time: "" })}
              className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none focus:border-[#1f6b5b]"
            >
              {activeServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.duration_minutes}분
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[12px] text-[#64748b]">담당자</span>
            <select
              value={form.staffKey}
              onChange={(event) => onChange({ ...form, staffKey: event.target.value as StaffKey, time: "" })}
              className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none focus:border-[#1f6b5b]"
            >
              {visibleStaff.map((staffMember) => (
                <option key={staffMember.key} value={staffMember.key}>
                  {staffMember.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[12px] text-[#64748b]">날짜</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => onChange({ ...form, date: event.target.value, time: "" })}
              className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none focus:border-[#1f6b5b]"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-[#64748b]">가능 시간</p>
            {form.customerMode === "new" && form.petName.trim() && form.customerName.trim() ? (
              <p className="truncate text-[12px] text-[#64748b]">
                {form.petName.trim()} · {form.customerName.trim()}
              </p>
            ) : selectedPet && selectedGuardian ? (
              <p className="truncate text-[12px] text-[#64748b]">
                {selectedPet.name} · {selectedGuardian.name}
              </p>
            ) : null}
          </div>
          <div className="mt-2 max-h-[144px] overflow-y-auto rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] p-2">
            {availableSlots.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onChange({ ...form, time: slot })}
                    className={cn(
                      "h-9 rounded-[8px] border text-[13px] tabular-nums transition",
                      form.time === slot
                        ? "border-[#1f6b5b] bg-[#1f6b5b] text-white"
                        : "border-[#dbe2ea] bg-white text-[#334155] hover:border-[#9fc9bd]",
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] text-[#64748b]">선택한 담당자와 서비스로 등록 가능한 시간이 없습니다.</p>
            )}
          </div>
        </div>

        <label className="mt-4 block space-y-1.5">
          <span className="text-[12px] text-[#64748b]">메모</span>
          <textarea
            value={form.memo}
            onChange={(event) => onChange({ ...form, memo: event.target.value })}
            className="min-h-[84px] w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#1f6b5b]"
            placeholder="고객 요청사항이나 직원 참고 메모를 적어주세요."
          />
        </label>

        {error ? <p className="mt-3 rounded-[8px] bg-[#fff7ed] px-3 py-2 text-[13px] text-[#9a3412]">{error}</p> : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] text-[#334155]">
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="h-11 rounded-[8px] bg-[#1f6b5b] text-[14px] font-medium text-white disabled:bg-[#cbd5e1]"
          >
            {saving ? "등록 중" : "예약 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarManagementScreen({
  initialData,
  staffMembers = defaultOwnerWebStaff,
  manualApprovalEnabled: controlledManualApprovalEnabled,
  onManualApprovalChange,
}: {
  initialData: BootstrapPayload;
  staffMembers?: OwnerWebStaffMember[];
  manualApprovalEnabled?: boolean;
  onManualApprovalChange?: (enabled: boolean) => void;
}) {
  const initialBootstrapData = useMemo(() => initialData, [initialData]);
  const visibleStaff = useMemo(() => {
    const columns = staffMembers.map(toOwnerWebStaffColumn);
    return columns.length > 0 ? columns : fallbackStaffColumns;
  }, [staffMembers]);
  const [bootstrapData, setBootstrapData] = useState(() => initialBootstrapData);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignments>({});
  const [selectedDate, setSelectedDate] = useState(() => currentDateInTimeZone());
  const selectedDateBookings = useMemo(
    () => buildDailyBookingsFromBootstrap(bootstrapData, selectedDate, staffAssignments, visibleStaff),
    [bootstrapData, selectedDate, staffAssignments, visibleStaff],
  );
  const [staff, setStaff] = useState<StaffFilter>("전체 스태프");
  const [activeMetric, setActiveMetric] = useState<SummaryMetricKey>("today");
  const [reservationStatusFilter, setReservationStatusFilter] = useState<ReservationStatusFilter>("all");
  const [bookings, setBookings] = useState<DailyBooking[]>(() => selectedDateBookings);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [scheduleStatusHour, setScheduleStatusHour] = useState(() => getCurrentDayHour());
  const [staffComments, setStaffComments] = useState<Record<string, string>>(() => initialStaffComments);
  const [acknowledgedChangeBookingIds, setAcknowledgedChangeBookingIds] = useState<Set<string>>(() => new Set());
  const [internalManualApprovalEnabled, setInternalManualApprovalEnabled] = useState(true);
  const [earlyStartBooking, setEarlyStartBooking] = useState<DailyBooking | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleCreateFormState>(() =>
    buildDefaultScheduleForm(initialBootstrapData, fallbackStaffColumns, currentDateInTimeZone(), "전체 스태프"),
  );
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const manualApprovalEnabled = controlledManualApprovalEnabled ?? internalManualApprovalEnabled;
  const staffScopedBookings = useMemo(
    () =>
      (staff === "전체 스태프" ? bookings : bookings.filter((item) => item.staffKey === staff)).filter((booking) =>
        visibleStaff.some((item) => item.key === booking.staffKey),
      ),
    [bookings, staff, visibleStaff],
  );
  const displayScopedBookings = useMemo(
    () =>
      staffScopedBookings
        .filter((booking) => !(isChangeBookingStatus(booking.status) && acknowledgedChangeBookingIds.has(booking.id)))
        .map((booking) => {
          const normalizedBooking = normalizeBookingForApprovalMode(booking, manualApprovalEnabled);
          return {
            ...normalizedBooking,
            sourceStatus: normalizedBooking.status,
            status: getTimedBookingStatus(normalizedBooking, selectedDate, scheduleStatusHour),
          };
        }),
    [acknowledgedChangeBookingIds, manualApprovalEnabled, scheduleStatusHour, selectedDate, staffScopedBookings],
  );
  const summaryMetrics = useMemo(() => buildScheduleMetrics(displayScopedBookings), [displayScopedBookings]);
  const reservationFilterOptions = useMemo(
    () => getReservationFilterOptions(displayScopedBookings, manualApprovalEnabled),
    [displayScopedBookings, manualApprovalEnabled],
  );

  useEffect(() => {
    setBootstrapData(initialBootstrapData);
    setScheduleForm(buildDefaultScheduleForm(initialBootstrapData, visibleStaff, selectedDate, staff));
  }, [initialBootstrapData, staff, selectedDate, visibleStaff]);

  useEffect(() => {
    const timer = window.setInterval(() => setScheduleStatusHour(getCurrentDayHour()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (staff !== "전체 스태프" && !visibleStaff.some((item) => item.key === staff)) {
      setStaff("전체 스태프");
    }
  }, [staff, visibleStaff]);

  useEffect(() => {
    const nextBookings = manualApprovalEnabled
      ? selectedDateBookings
      : selectedDateBookings.map((booking) => normalizeBookingForApprovalMode(booking, false));
    setBookings(nextBookings);
    setScheduleStatusHour(getCurrentDayHour());
    setSelectedBookingId((current) => (current && nextBookings.some((booking) => booking.id === current) ? current : ""));
  }, [manualApprovalEnabled, selectedDateBookings]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(staffCommentStorageKey);
      if (stored) {
        setStaffComments({ ...initialStaffComments, ...(JSON.parse(stored) as Record<string, string>) });
      }
    } catch {
      window.localStorage.removeItem(staffCommentStorageKey);
    }
  }, []);

  function handleStaffCommentChange(commentKey: string, value: string) {
    setStaffComments((current) => {
      const next = { ...current, [commentKey]: value };
      window.localStorage.setItem(staffCommentStorageKey, JSON.stringify(next));
      return next;
    });
  }

  const filteredBookings = useMemo(
    () =>
      displayScopedBookings.filter((booking) => {
        if (activeMetric === "completed") return isCompletedBookingStatus(booking.status);
        if (activeMetric === "changes") return isChangeBookingStatus(booking.status);
        if (activeMetric === "today") return matchesReservationFilter(booking, reservationStatusFilter);
        return true;
      }),
    [activeMetric, displayScopedBookings, reservationStatusFilter],
  );

  const selectedBooking = displayScopedBookings.find((item) => item.id === selectedBookingId);

  function handleMetricSelect(metric: SummaryMetricKey) {
    setActiveMetric(metric);
    const nextReservationFilter: ReservationStatusFilter = "all";
    setReservationStatusFilter(nextReservationFilter);

    setSelectedBookingId("");
  }

  function handleReservationStatusFilterChange(filter: ReservationStatusFilter) {
    setActiveMetric("today");
    setReservationStatusFilter(filter);
    setSelectedBookingId("");
  }

  function handleMoveBooking(bookingId: string, next: { staffKey: StaffKey; staffName: string; staff: string; start: number }) {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId
          ? {
              ...booking,
              ...next,
            }
          : booking,
      ),
    );
  }

  function handleResizeBooking(bookingId: string, duration: number) {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId
          ? {
              ...booking,
              duration,
            }
          : booking,
      ),
    );
  }

  function isBeforeBookingStart(booking: DailyBooking) {
    const selectedDay = parseScheduleDate(selectedDate).getTime();
    const todayDay = parseScheduleDate(currentDateInTimeZone()).getTime();
    return selectedDay > todayDay || (selectedDay === todayDay && getCurrentDayHour() < booking.start);
  }

  function applyBookingStatusChange(bookingId: string, nextStatus: string) {
    setBookings((current) =>
      current.map((booking) => {
        if (booking.id !== bookingId) return booking;
        const displayStatus = getTimedBookingStatus(booking, selectedDate, getCurrentDayHour());
        if (nextStatus === "진행 중" && !canStartGrooming(booking.status)) return booking;
        if (nextStatus === "픽업 준비" && !canMarkGroomingComplete(booking.status) && !canSendCompletionNotice(booking.status, displayStatus)) {
          return booking;
        }
        return { ...booking, status: nextStatus };
      }),
    );
    setScheduleStatusHour(getCurrentDayHour());
  }

  function handleChangeBookingStatus(bookingId: string, nextStatus: string) {
    const targetBooking = bookings.find((booking) => booking.id === bookingId);
    if (targetBooking && nextStatus === "진행 중" && canStartGrooming(targetBooking.status) && isBeforeBookingStart(targetBooking)) {
      setEarlyStartBooking(targetBooking);
      return;
    }

    applyBookingStatusChange(bookingId, nextStatus);
  }

  function handleAcknowledgeChangeBooking(bookingId: string) {
    setAcknowledgedChangeBookingIds((current) => new Set(current).add(bookingId));
    setSelectedBookingId((current) => (current === bookingId ? "" : current));
  }

  function handleManualApprovalChange(enabled: boolean) {
    if (controlledManualApprovalEnabled === undefined) {
      setInternalManualApprovalEnabled(enabled);
    }
    onManualApprovalChange?.(enabled);
    if (!enabled) {
      setBookings((current) =>
        current.map((booking) => (isPendingBookingStatus(booking.status) ? { ...booking, status: "확정" } : booking)),
      );
    }
    if (!enabled && reservationStatusFilter === "pending") {
      setReservationStatusFilter("all");
    }
  }

  function handleAddSchedule() {
    const targetStaff =
      staff === "전체 스태프" ? visibleStaff[0] : visibleStaff.find((item) => item.key === staff) ?? visibleStaff[0];
    setScheduleForm({
      ...buildDefaultScheduleForm(bootstrapData, visibleStaff, selectedDate, staff),
      staffKey: targetStaff?.key ?? "staff-1",
      date: selectedDate,
    });
    setScheduleError("");
    setScheduleDialogOpen(true);
  }

  async function handleCreateSchedule() {
    let selectedPet = bootstrapData.pets.find((pet) => pet.id === scheduleForm.petId) ?? null;
    let selectedGuardian = selectedPet ? bootstrapData.guardians.find((guardian) => guardian.id === selectedPet?.guardian_id) ?? null : null;
    const selectedService = bootstrapData.services.find((service) => service.id === scheduleForm.serviceId);
    const targetStaff = visibleStaff.find((item) => item.key === scheduleForm.staffKey);
    const newCustomerName = scheduleForm.customerName.trim();
    const newPetName = scheduleForm.petName.trim();
    const newCustomerPhone = normalizeSchedulePhone(scheduleForm.customerPhone);

    if (scheduleForm.customerMode === "new") {
      if (!newCustomerName || !newPetName || newCustomerPhone.length < 10) {
        setScheduleError("고객명, 반려동물 이름, 고객 연락처를 모두 입력해 주세요.");
        return;
      }
    } else if (!selectedPet || !selectedGuardian) {
      setScheduleError("기존 고객과 반려동물을 선택해 주세요.");
      return;
    }

    if (!selectedService || !targetStaff || !scheduleForm.date || !scheduleForm.time) {
      setScheduleError("고객, 서비스, 담당자, 날짜와 시간을 모두 선택해 주세요.");
      return;
    }

    const duration = selectedService.duration_minutes / 60;
    const dateBookings = scheduleForm.date === selectedDate ? bookings : buildDailyBookingsFromBootstrap(bootstrapData, scheduleForm.date, staffAssignments, visibleStaff);
    if (
      hasStaffBookingConflict(dateBookings, "__new-booking__", {
        staffKey: targetStaff.key,
        start: timeToHour(scheduleForm.time),
        duration,
      })
    ) {
      setScheduleError("선택한 담당자에게 같은 시간 예약이 있습니다.");
      return;
    }

    setScheduleSaving(true);
    setScheduleError("");
    let createdGuardian: Guardian | null = null;
    let createdPet: Pet | null = null;

    if (scheduleForm.customerMode === "new") {
      try {
        selectedGuardian = await postOwnerGuardian({
          shopId: bootstrapData.shop.id,
          name: newCustomerName,
          phone: newCustomerPhone,
          memo: "",
        });
      } catch (error) {
        const message = getApiErrorMessage(error, "");
        if (message.includes("濡쒓렇?몄씠 ?꾩슂")) {
          selectedGuardian = buildLocalGuardian({
            shopId: bootstrapData.shop.id,
            name: newCustomerName,
            phone: newCustomerPhone,
          });
        } else {
          setScheduleError(getApiErrorMessage(error, "고객 저장 중 문제가 발생했습니다."));
          setScheduleSaving(false);
          return;
        }
      }

      createdGuardian = selectedGuardian;

      try {
        selectedPet = await postOwnerPet({
          shopId: bootstrapData.shop.id,
          guardianId: selectedGuardian.id,
          name: newPetName,
          breed: "미입력",
          groomingCycleWeeks: 4,
        });
      } catch (error) {
        const message = getApiErrorMessage(error, "");
        if (message.includes("濡쒓렇?몄씠 ?꾩슂")) {
          selectedPet = buildLocalPet({
            shopId: bootstrapData.shop.id,
            guardianId: selectedGuardian.id,
            name: newPetName,
          });
        } else {
          setScheduleError(getApiErrorMessage(error, "반려동물 저장 중 문제가 발생했습니다."));
          setScheduleSaving(false);
          return;
        }
      }

      createdPet = selectedPet;
    }

    if (!selectedPet || !selectedGuardian) {
      setScheduleError("고객과 반려동물 정보를 확인해 주세요.");
      setScheduleSaving(false);
      return;
    }

    const payload = {
      shopId: bootstrapData.shop.id,
      guardianId: selectedGuardian.id,
      petId: selectedPet.id,
      serviceId: selectedService.id,
      appointmentDate: scheduleForm.date,
      appointmentTime: scheduleForm.time,
      memo: scheduleForm.memo,
      source: "owner",
    };

    const applyCreatedAppointment = (appointment: Appointment) => {
      const nextAssignments = { ...staffAssignments, [appointment.id]: targetStaff.key };
      const nextBootstrapData = {
        ...bootstrapData,
        guardians: createdGuardian
          ? [...bootstrapData.guardians.filter((item) => item.id !== createdGuardian.id), createdGuardian]
          : bootstrapData.guardians,
        pets: createdPet ? [...bootstrapData.pets.filter((item) => item.id !== createdPet.id), createdPet] : bootstrapData.pets,
        appointments: [...bootstrapData.appointments.filter((item) => item.id !== appointment.id), appointment],
      };
      const nextBookings = buildDailyBookingsFromBootstrap(nextBootstrapData, scheduleForm.date, nextAssignments);

      setStaffAssignments(nextAssignments);
      setBootstrapData(nextBootstrapData);
      setSelectedDate(scheduleForm.date);
      setBookings(manualApprovalEnabled ? nextBookings : nextBookings.map((booking) => normalizeBookingForApprovalMode(booking, false)));
      setSelectedBookingId(appointment.id);
      setActiveMetric("today");
      setReservationStatusFilter("all");
      setScheduleDialogOpen(false);
    };

    try {
      const appointment = await postOwnerAppointment(payload);
      applyCreatedAppointment(appointment);
    } catch (error) {
      const message = getApiErrorMessage(error, "예약 등록 중 문제가 발생했습니다.");
      if (message.includes("로그인이 필요")) {
        applyCreatedAppointment(
          buildLocalOwnerAppointment({
            ...payload,
            durationMinutes: selectedService.duration_minutes,
          }),
        );
        return;
      }
      setScheduleError(getApiErrorMessage(error, "예약 등록 중 문제가 발생했습니다."));
    } finally {
      setScheduleSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe2ea] pb-2">
        <SummaryStrip activeMetric={activeMetric} metrics={summaryMetrics} onSelectMetric={handleMetricSelect} />
        {activeMetric === "today" && manualApprovalEnabled ? (
          <ReservationFilterStrip
            activeFilter={reservationStatusFilter}
            options={reservationFilterOptions}
            onSelectFilter={handleReservationStatusFilterChange}
          />
        ) : null}
      </div>
      {scheduleDialogOpen ? (
        <ScheduleCreateDialog
          data={bootstrapData}
          bookings={bookings}
          form={scheduleForm}
          selectedDate={selectedDate}
          visibleStaff={visibleStaff}
          staffAssignments={staffAssignments}
          saving={scheduleSaving}
          error={scheduleError}
          onChange={setScheduleForm}
          onClose={() => {
            if (!scheduleSaving) {
              setScheduleDialogOpen(false);
              setScheduleError("");
            }
          }}
          onSubmit={handleCreateSchedule}
        />
      ) : null}

      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <WebSurface className="min-w-0 overflow-hidden">
          <CalendarToolbar
            selectedDate={selectedDate}
            staff={staff}
            visibleStaff={visibleStaff}
            onDateChange={setSelectedDate}
            onStaffChange={setStaff}
            onAddSchedule={handleAddSchedule}
          />
          <DailyScheduleGrid
            bookings={filteredBookings}
            staff={staff}
            visibleStaff={visibleStaff}
            activeMetric={activeMetric}
            manualApprovalEnabled={manualApprovalEnabled}
            selectedBookingId={selectedBookingId}
            conflictBookings={displayScopedBookings}
            onSelectBooking={setSelectedBookingId}
            onMoveBooking={handleMoveBooking}
            onResizeBooking={handleResizeBooking}
          />
        </WebSurface>

        <BookingSidePanel
          activeMetric={activeMetric}
          manualApprovalEnabled={manualApprovalEnabled}
          selectedBooking={selectedBooking}
          selectedBookingId={selectedBookingId}
          approvalModeBookings={[]}
          onManualApprovalChange={handleManualApprovalChange}
          onChangeStatus={handleChangeBookingStatus}
          onAcknowledgeChange={handleAcknowledgeChangeBooking}
          onSelectBooking={setSelectedBookingId}
          staffComments={staffComments}
          onChangeStaffComment={handleStaffCommentChange}
        />
      </div>
      {earlyStartBooking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-4" onClick={() => setEarlyStartBooking(null)}>
          <div className="w-full max-w-[360px] rounded-[10px] border border-[#dbe2ea] bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-[17px] font-medium text-[#111827]">예약 시간 전입니다</h3>
            <p className="mt-2 text-[13px] leading-5 text-[#64748b]">
              {earlyStartBooking.pet} · {earlyStartBooking.customer} 예약은 {formatHourLabel(earlyStartBooking.start)} 시작입니다. 그래도 미용을 시작할까요?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEarlyStartBooking(null)} className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium text-[#334155]">
                아니요
              </button>
              <button
                type="button"
                onClick={() => {
                  applyBookingStatusChange(earlyStartBooking.id, "진행 중");
                  setEarlyStartBooking(null);
                }}
                className="h-10 rounded-[8px] bg-[#1f6b5b] text-[14px] font-medium text-white"
              >
                시작할게요
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
