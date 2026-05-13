"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, CircleHelp, MessageCircle } from "lucide-react";
import type { DragEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { calendarBookings } from "@/components/owner-web/owner-web-data";
import {
  WebSurface,
} from "@/components/owner-web/owner-web-ui";
import { computeAvailableSlots } from "@/lib/availability";
import { fetchApiJson, fetchApiJsonWithAuth } from "@/lib/api";
import { buildDemoBootstrap } from "@/lib/mock-data";
import { addDate, cn, currentDateInTimeZone } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload } from "@/types/domain";

type SummaryMetricKey = "today" | "completed" | "changes";
type ReservationStatusFilter = "all" | "pending" | "confirmed";
type ScheduleView = "day" | "week" | "month";
type BookingPhase = "now" | "upcoming" | "past";
type BookingCardTone = "confirmed" | "active" | "pending" | "completed";
type ScheduleMetric = { key: SummaryMetricKey; label: string; value?: string };
type StaffAssignments = Record<string, StaffKey>;
type ScheduleCreateFormState = {
  petId: string;
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

const demoStaffColumns = [
  { key: "staff-1", name: "정우진", role: "원장" },
  { key: "staff-2", name: "서하늘", role: "서브" },
  { key: "staff-3", name: "민서윤", role: "디자이너" },
  { key: "staff-4", name: "강리오", role: "목욕" },
  { key: "staff-5", name: "오다은", role: "파트타임" },
  { key: "staff-6", name: "한지우", role: "파트타임" },
] as const;
const defaultVisibleStaffCount = 6;
type StaffKey = (typeof demoStaffColumns)[number]["key"];
type StaffFilter = "전체 스태프" | StaffKey;
const scheduleStartHour = 10;
const scheduleEndHour = 24;
const pixelsPerHour = 86.4;
const scheduleBodyInsetY = 8;
const scheduleGridHeight = (scheduleEndHour - scheduleStartHour) * pixelsPerHour;
const scheduleBodyHeight = scheduleGridHeight + scheduleBodyInsetY * 2;
const quarterSlotHeight = pixelsPerHour / 4;
const scheduleSnapSegmentsPerHour = 4;
const scheduleAnchorInset = 16;
const currentWorkCatchThreshold = 240;
const currentWorkCatchResetDistance = 420;
const expandableBookingDurationMax = 0.25;
const bookingCardWidth = "95%";
const bookingCardHorizontalInset = "2.5%";
const timeRailHours = Array.from({ length: scheduleEndHour - scheduleStartHour + 1 }, (_, index) => `${scheduleStartHour + index}:00`);
const todayScheduleDate = currentDateInTimeZone();
const todayScheduleDateLabel = formatScheduleDateLabel(todayScheduleDate);
const scheduleViewOptions: Array<{ key: ScheduleView; label: string }> = [
  { key: "day", label: "일간" },
  { key: "week", label: "주간" },
  { key: "month", label: "월간" },
];
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

function normalizeBookingForApprovalMode(booking: DailyBooking, manualApprovalEnabled: boolean): DailyBooking {
  if (manualApprovalEnabled || !isPendingBookingStatus(booking.status)) return booking;
  return { ...booking, status: "확정" };
}

function isScheduleAnchorCandidateStatus(status?: string) {
  if (!status) return true;
  return !isPendingBookingStatus(status) && !isCompletedBookingStatus(status) && !isChangeBookingStatus(status);
}

function buildScheduleMetrics(bookings: DailyBooking[]): ScheduleMetric[] {
  const bookableCount = bookings.filter((booking) => isBookableStatus(booking.status)).length;
  const completedCount = bookings.filter((booking) => isCompletedBookingStatus(booking.status)).length;
  const changesCount = bookings.filter((booking) => isChangeBookingStatus(booking.status)).length;

  return [
    { key: "today", label: "예약 현황", value: `${bookableCount}건` },
    { key: "changes", label: "변경 · 취소 관리", value: `${changesCount}건` },
    { key: "completed", label: "완료 내역", value: `${completedCount}건` },
  ];
}

function getReservationFilterOptions(bookings: DailyBooking[], manualApprovalEnabled: boolean) {
  const bookableBookings = bookings.filter((booking) => isBookableStatus(booking.status));
  const options: Array<{ key: ReservationStatusFilter; label: string; count: number }> = [
    { key: "all", label: "전체", count: bookableBookings.length },
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

function getBookingPhase(booking: { start: number; duration: number }, currentHour: number): BookingPhase {
  if (currentHour >= booking.start && currentHour < booking.start + booking.duration) return "now";
  if (currentHour < booking.start) return "upcoming";
  return "past";
}

function getPhaseLabel(phase: BookingPhase) {
  if (phase === "now") return "진행 중";
  if (phase === "upcoming") return "예정";
  return "지난 일정";
}

function getBookingCardTone(status: string, _phase: BookingPhase): BookingCardTone {
  if (status === "완료") return "completed";
  if (isPendingBookingStatus(status)) return "pending";
  if (isActiveBookingStatus(status)) return "active";
  return "confirmed";
}

function getBookingCardToneClass(tone: BookingCardTone, selected: boolean) {
  if (tone === "active") {
    return cn(
      "border-2 border-[#1f6b5b] bg-[#f2fbf7] text-[#0f172a] shadow-none ring-1 ring-[#1f6b5b]/20",
      selected && "ring-2 ring-[#1f6b5b]/30",
    );
  }

  if (tone === "pending") {
    return cn(
      "border-[#f1e3bf] bg-[#fffdf6] text-[#17211f] shadow-none",
      selected && "border-[#e3c476] ring-1 ring-[#e3c476]/18",
    );
  }

  if (tone === "completed") {
    return cn(
      "border-[#e5e7eb] bg-white text-[#6b7280] shadow-none",
      selected && "ring-1 ring-[#94a3b8]/30",
    );
  }

  return cn(
    "border-[#d7e7e1] bg-[#f9fdfb] text-[#111827] shadow-none",
    selected && "border-[#a8d0c4] ring-1 ring-[#a8d0c4]/30",
  );
}

function getBookingDotClass(tone: BookingCardTone) {
  if (tone === "active") return "bg-[#4f9a89]";
  if (tone === "completed") return "bg-[#94a3b8]";
  if (tone === "pending") return "bg-[#d6a33a]";
  return "bg-[#3f8d7d]";
}

function getBookingTimeTextClass(tone: BookingCardTone) {
  if (tone === "pending") return "text-[#9a6a12]";
  if (tone === "completed") return "text-[#64748b]";
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

function appointmentToDailyBooking(
  appointment: Appointment,
  data: BootstrapPayload,
  selectedDate: string,
  staffAssignments: StaffAssignments,
  fallbackStaff: (typeof demoStaffColumns)[number],
): DailyBooking {
  const guardian = data.guardians.find((item) => item.id === appointment.guardian_id);
  const pet = data.pets.find((item) => item.id === appointment.pet_id);
  const service = data.services.find((item) => item.id === appointment.service_id);
  const assignedStaff = staffAssignments[appointment.id]
    ? demoStaffColumns.find((item) => item.key === staffAssignments[appointment.id])
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

function getPriorityBookingId(bookings: Array<{ id: string; start: number; duration: number; status?: string }>, currentHour: number) {
  const currentBooking = getCurrentWorkBookings(bookings, currentHour)[0];
  if (currentBooking) return currentBooking.id;

  const nextBooking = [...bookings]
    .filter((booking) => isScheduleAnchorCandidateStatus(booking.status) && getBookingPhase(booking, currentHour) === "upcoming")
    .sort((a, b) => a.start - b.start)[0];
  return nextBooking?.id ?? bookings[0]?.id ?? "";
}

function getCurrentWorkBookings<T extends { id: string; start: number; duration: number; status?: string }>(bookings: T[], currentHour: number) {
  const timeMatchedBookings = bookings
    .filter((booking) => isScheduleAnchorCandidateStatus(booking.status) && getBookingPhase(booking, currentHour) === "now")
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));

  if (timeMatchedBookings.length > 0) return timeMatchedBookings;

  return bookings
    .filter((booking) => booking.status && isActiveBookingStatus(booking.status))
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

function getNextScheduleBooking<T extends { id: string; start: number; duration: number; status?: string }>(bookings: T[], currentHour: number) {
  return [...bookings]
    .filter((booking) => isScheduleAnchorCandidateStatus(booking.status) && getBookingPhase(booking, currentHour) === "upcoming")
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))[0];
}

function getScheduleBoardAnchor(bookings: Array<{ id: string; start: number; duration: number; status?: string }>, currentHour: number) {
  const currentWorkBooking = getCurrentWorkBookings(bookings, currentHour)[0];
  if (currentWorkBooking) {
    return {
      kind: "current-work" as const,
      booking: currentWorkBooking,
      hour: currentWorkBooking.start,
      key: `current-work-${currentWorkBooking.id}-${currentWorkBooking.start}-${currentWorkBooking.duration}`,
    };
  }

  const nextBooking = getNextScheduleBooking(bookings, currentHour);
  if (nextBooking) {
    return {
      kind: "next-booking" as const,
      booking: nextBooking,
      hour: nextBooking.start,
      key: `next-booking-${nextBooking.id}-${nextBooking.start}-${nextBooking.duration}`,
    };
  }

  const clampedCurrentHour =
    currentHour >= scheduleStartHour && currentHour <= scheduleEndHour ? currentHour : scheduleStartHour;
  return {
    kind: "current-time" as const,
    booking: null,
    hour: clampedCurrentHour,
    key: `current-time-${Math.floor(clampedCurrentHour * 4) / 4}`,
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

function staffColumnForIndex(index: number) {
  return demoStaffColumns[index % demoStaffColumns.length];
}

function buildDailyBookingsFromBootstrap(data: BootstrapPayload, selectedDate: string, staffAssignments: StaffAssignments = {}): DailyBooking[] {
  const selectedDateAppointments = data.appointments
    .filter((appointment) => appointment.appointment_date === selectedDate)
    .sort((first, second) => first.appointment_time.localeCompare(second.appointment_time));

  return selectedDateAppointments.map((appointment, index) => {
    const staffColumn = staffColumnForIndex(index);
    return appointmentToDailyBooking(appointment, data, selectedDate, staffAssignments, staffColumn);
  });
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
    <div className="flex flex-wrap items-center gap-1">
      {metrics.map((metric) => (
        <button
          key={metric.key}
          type="button"
          onClick={() => onSelectMetric(metric.key as SummaryMetricKey)}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-[8px] px-3 text-left text-[13px] transition",
            activeMetric === metric.key ? "bg-[#e9f5f1] text-[#1f6b5b]" : "text-[#475569] hover:bg-[#f8fafc]",
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onSelectFilter(option.key)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium transition",
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
  staffComments: Record<string, string>;
  onChangeStaffComment: (commentKey: string, value: string) => void;
}) {
  const timeRange = selectedBooking
    ? `${formatHourLabel(selectedBooking.start)}-${formatHourLabel(selectedBooking.start + selectedBooking.duration)}`
    : "";
  const commentKey = selectedBooking ? getCustomerCommentKey(selectedBooking) : "";
  const staffComment = commentKey ? staffComments[commentKey] ?? "" : "";
  const customerRequest = selectedBooking ? getCustomerRequest(selectedBooking.id) || "요청이 없습니다." : "";
  const startEnabled = selectedBooking ? canStartGrooming(selectedBooking.status) : false;
  const completeEnabled = selectedBooking ? canMarkGroomingComplete(selectedBooking.status) : false;
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
                    <p className="mt-1 text-[20px] font-medium tracking-[-0.03em] text-[#1f6b5b]">{selectedBooking.service}</p>
                  </div>
                </div>

                {isPendingBookingStatus(selectedBooking.status) ? (
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
                      {startEnabled ? "미용 시작" : "확정 후 시작"}
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
                      {completeEnabled ? "미용 완료" : "시작 후 완료"}
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
                  <span className="text-[11px] text-[#94a3b8]">고객관리 공유</span>
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
                  <span className="rounded-full bg-[#fff1b8] px-2 py-1 text-[11px] text-[#8a5a00]">{sortedApprovalModeBookings.length}건</span>
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
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#e4b44c] transition" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-[14px] font-medium text-[#111827]">{booking.pet} · {booking.customer}</p>
                              <span className="shrink-0 text-[11px] tabular-nums text-[#8a5a00]">{timeRange}</span>
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

function ScheduleViewSwitch({
  value,
  onChange,
  action,
}: {
  value: ScheduleView;
  onChange: (view: ScheduleView) => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 py-2">
      <div className="inline-flex rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-1">
        {scheduleViewOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              "h-8 rounded-[6px] px-3 text-[13px] transition",
              value === option.key ? "bg-white text-[#1f6b5b] shadow-[0_1px_4px_rgba(15,23,42,0.08)]" : "text-[#64748b] hover:text-[#111827]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1">{action}</div>
    </div>
  );
}

function CalendarToolbar({
  selectedDate,
  staff,
  visibleStaff,
  demoStaffCount,
  onDateChange,
  onStaffChange,
  onDemoStaffCountChange,
}: {
  selectedDate: string;
  staff: StaffFilter;
  visibleStaff: Array<(typeof demoStaffColumns)[number]>;
  demoStaffCount: number;
  onDateChange: (date: string) => void;
  onStaffChange: (staff: StaffFilter) => void;
  onDemoStaffCountChange: (count: number) => void;
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
          <button
            type="button"
            onClick={() => onDateChange(currentDateInTimeZone())}
            className="ml-1 inline-flex h-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] text-[#334155]"
          >
            오늘
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <label className="grid h-9 min-w-[172px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-3">
            <span className="text-[12px] text-[#64748b]">데모</span>
            <select
              value={demoStaffCount}
              onChange={(event) => onDemoStaffCountChange(Number(event.target.value))}
              className="min-w-0 justify-self-end bg-transparent pr-1 text-right text-[14px] text-[#111827] outline-none"
            >
              {[1, 2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  스태프 {count}명
                </option>
              ))}
            </select>
          </label>
          <label className="grid h-9 min-w-[188px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-3">
            <span className="text-[12px] text-[#64748b]">담당</span>
            <select
              value={staff}
              onChange={(event) => onStaffChange(event.target.value as StaffFilter)}
              className="min-w-0 justify-self-end bg-transparent pr-1 text-right text-[14px] text-[#111827] outline-none"
            >
              <option value="전체 스태프">전체 스태프</option>
              {visibleStaff.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
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
  onSelectBooking,
  onMoveBooking,
}: {
  bookings: DailyBooking[];
  staff: StaffFilter;
  visibleStaff: Array<(typeof demoStaffColumns)[number]>;
  activeMetric: SummaryMetricKey;
  manualApprovalEnabled: boolean;
  selectedBookingId: string;
  onSelectBooking: (id: string) => void;
  onMoveBooking: (bookingId: string, next: { staffKey: StaffKey; staffName: string; staff: string; start: number }) => void;
}) {
  const lastAutoSelectedRef = useRef<string | null>(null);
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const headerScrollerRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollerRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const positionedTimelineRef = useRef<string | null>(null);
  const currentWorkCatchRef = useRef<{ bookingId: string | null; caught: boolean }>({ bookingId: null, caught: false });
  const currentWorkCatchTimerRef = useRef<number | null>(null);
  const programmaticTimelineScrollRef = useRef(false);
  const boardPanRef = useRef<BoardPanState | null>(null);
  const [currentHour, setCurrentHour] = useState(() => getCurrentDayHour());
  const [scheduleTrackWidth, setScheduleTrackWidth] = useState<number | null>(null);
  const [verticalScrollbarWidth, setVerticalScrollbarWidth] = useState(0);
  const [draggingBookingId, setDraggingBookingId] = useState<string | null>(null);
  const [boardPanning, setBoardPanning] = useState(false);
  const [caughtBookingId, setCaughtBookingId] = useState<string | null>(null);
  const [expandedMicroBookingId, setExpandedMicroBookingId] = useState<string | null>(null);
  const scheduleStaff = staff === "전체 스태프" ? visibleStaff : visibleStaff.filter((item) => item.key === staff);
  const staffScopedBookings = bookings.filter((booking) => scheduleStaff.some((item) => item.key === booking.staffKey));
  const metricFilteredBookings = staffScopedBookings.filter((booking) => {
    if (activeMetric === "completed") return isCompletedBookingStatus(booking.status);
    if (activeMetric === "changes") return isChangeBookingStatus(booking.status);
    if (activeMetric === "today") return isBookableStatus(booking.status);
    return true;
  });
  // 현재 작업 중인 예약은 스케줄보드의 핵심 anchor라 필터와 관계없이 항상 표시한다.
  const currentWorkBookings = getCurrentWorkBookings(staffScopedBookings, currentHour);
  const currentWorkBookingIds = new Set(currentWorkBookings.map((booking) => booking.id));
  const visibleBookings =
    currentWorkBookings.length > 0
      ? [...currentWorkBookings, ...metricFilteredBookings.filter((booking) => !currentWorkBookingIds.has(booking.id))]
      : metricFilteredBookings;
  const columnCount = scheduleStaff.length;
  const scrollable = columnCount > 4;
  const compactCards = columnCount >= 3;
  const columnFlexBasis = scrollable ? "0 0 calc((100% - 24px) / 4)" : `0 0 calc((100% - ${(columnCount - 1) * 8}px) / ${columnCount})`;
  const scheduleTrackStyle = scheduleTrackWidth ? { width: scheduleTrackWidth, minWidth: scheduleTrackWidth } : undefined;
  const scheduleAnchor = getScheduleBoardAnchor(staffScopedBookings, currentHour);
  const currentBookingId = scheduleAnchor.booking?.id;

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentHour(getCurrentDayHour()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (currentWorkCatchTimerRef.current) {
        window.clearTimeout(currentWorkCatchTimerRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    if (!currentBookingId || lastAutoSelectedRef.current === currentBookingId) return;
    lastAutoSelectedRef.current = currentBookingId;
    onSelectBooking(currentBookingId);
  }, [activeMetric, currentBookingId, onSelectBooking]);

  useEffect(() => {
    if (!selectedBookingId) return;
    const viewport = timelineViewportRef.current;
    const target = viewport?.querySelector<HTMLElement>(`[data-booking-id="${selectedBookingId}"]`);
    if (!viewport || !target) return;

    const viewportRect = viewport.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextScrollTop =
      selectedBookingId === currentBookingId
        ? Math.max(0, viewport.scrollTop + targetRect.top - viewportRect.top - scheduleAnchorInset)
        : Math.max(0, viewport.scrollTop + targetRect.top - viewportRect.top - (viewport.clientHeight - targetRect.height) / 2);

    programmaticTimelineScrollRef.current = true;
    viewport.scrollTo({ top: nextScrollTop, behavior: "smooth" });

    const bodyScroller = bodyScrollerRef.current;
    if (bodyScroller) {
      const bodyRect = bodyScroller.getBoundingClientRect();
      const nextScrollLeft = Math.max(
        0,
        bodyScroller.scrollLeft + targetRect.left - bodyRect.left - (bodyScroller.clientWidth - targetRect.width) / 2,
      );
      bodyScroller.scrollTo({ left: nextScrollLeft, behavior: "smooth" });
    }

    setCaughtBookingId(selectedBookingId);

    if (currentWorkCatchTimerRef.current) {
      window.clearTimeout(currentWorkCatchTimerRef.current);
    }
    currentWorkCatchTimerRef.current = window.setTimeout(() => {
      setCaughtBookingId(null);
      currentWorkCatchTimerRef.current = null;
      programmaticTimelineScrollRef.current = false;
    }, 850);
  }, [currentBookingId, selectedBookingId]);

  useLayoutEffect(() => {
    if (!timelineViewportRef.current) return;
    const anchorHour = scheduleAnchor.hour;
    const anchorKey = scheduleAnchor.key;
    if (positionedTimelineRef.current === anchorKey) return;
    const nextScrollTop = Math.max(0, getBookingTop(anchorHour) - scheduleAnchorInset);
    programmaticTimelineScrollRef.current = true;
    timelineViewportRef.current.scrollTop = nextScrollTop;
    window.requestAnimationFrame(() => {
      if (timelineViewportRef.current) {
        timelineViewportRef.current.scrollTop = nextScrollTop;
      }
    });
    window.setTimeout(() => {
      programmaticTimelineScrollRef.current = false;
    }, 360);
    positionedTimelineRef.current = anchorKey;
    if (scheduleAnchor.booking) {
      currentWorkCatchRef.current = { bookingId: scheduleAnchor.booking.id, caught: false };
    }
  }, [scheduleAnchor.hour, scheduleAnchor.key]);

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

  useEffect(() => {
    const viewport = timelineViewportRef.current;
    const currentWorkBooking = scheduleAnchor.booking;
    if (!viewport || scheduleAnchor.kind !== "current-work" || !currentWorkBooking) return;
    const timelineElement = viewport;
    const anchorBooking = currentWorkBooking;

    function handleWheel(event: globalThis.WheelEvent) {
      if (programmaticTimelineScrollRef.current || event.deltaY === 0) return;

      if (currentWorkCatchRef.current.bookingId !== anchorBooking.id) {
        currentWorkCatchRef.current = { bookingId: anchorBooking.id, caught: false };
      }

      const targetScrollTop = Math.max(0, getBookingTop(anchorBooking.start) - scheduleAnchorInset);
      const distance = Math.abs(timelineElement.scrollTop - targetScrollTop);

      if (distance > currentWorkCatchResetDistance) {
        currentWorkCatchRef.current.caught = false;
        return;
      }

      if (distance > currentWorkCatchThreshold || currentWorkCatchRef.current.caught) return;

      event.preventDefault();
      currentWorkCatchRef.current.caught = true;
      setCaughtBookingId(anchorBooking.id);
      timelineElement.scrollTo({ top: targetScrollTop, behavior: "smooth" });

      if (currentWorkCatchTimerRef.current) {
        window.clearTimeout(currentWorkCatchTimerRef.current);
      }
      currentWorkCatchTimerRef.current = window.setTimeout(() => {
        setCaughtBookingId(null);
        currentWorkCatchTimerRef.current = null;
      }, 650);
    }

    timelineElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => timelineElement.removeEventListener("wheel", handleWheel);
  }, [scheduleAnchor.booking, scheduleAnchor.kind]);

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

  function handleTimelineScroll() {
    const viewport = timelineViewportRef.current;
    const currentWorkBooking = scheduleAnchor.booking;
    if (programmaticTimelineScrollRef.current) return;
    if (scheduleAnchor.kind !== "current-work") return;
    if (!viewport || !currentWorkBooking) return;

    if (currentWorkCatchRef.current.bookingId !== currentWorkBooking.id) {
      currentWorkCatchRef.current = { bookingId: currentWorkBooking.id, caught: false };
    }

    const targetScrollTop = Math.max(0, getBookingTop(currentWorkBooking.start) - scheduleAnchorInset);
    const distance = Math.abs(viewport.scrollTop - targetScrollTop);

    if (distance > currentWorkCatchResetDistance) {
      currentWorkCatchRef.current.caught = false;
      return;
    }

    if (distance > currentWorkCatchThreshold || currentWorkCatchRef.current.caught) {
      return;
    }

    currentWorkCatchRef.current.caught = true;
    setCaughtBookingId(currentWorkBooking.id);
    viewport.scrollTo({ top: targetScrollTop, behavior: "smooth" });

    if (currentWorkCatchTimerRef.current) {
      window.clearTimeout(currentWorkCatchTimerRef.current);
    }
    currentWorkCatchTimerRef.current = window.setTimeout(() => {
      setCaughtBookingId(null);
      currentWorkCatchTimerRef.current = null;
    }, 650);
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
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", bookingId);
    setDraggingBookingId(bookingId);
    onSelectBooking(bookingId);
  }

  function handleColumnDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleColumnDrop(event: DragEvent<HTMLElement>, staffMember: (typeof demoStaffColumns)[number]) {
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
      hasStaffBookingConflict(bookings, bookingId, {
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
              const staffBookings = visibleBookings.filter((booking) => booking.staffKey === staffMember.key);
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
        data-schedule-timeline="true"
        onScroll={handleTimelineScroll}
        onPointerDown={handleBoardPanPointerDown}
        onPointerMove={handleBoardPanPointerMove}
        onPointerUp={stopBoardPan}
        onPointerCancel={stopBoardPan}
        className={cn(
          "max-h-[504px] scroll-pt-4 overflow-y-auto scroll-smooth select-none",
          boardPanning && "cursor-grabbing snap-none",
          !boardPanning && scrollable && "cursor-grab snap-y snap-proximity",
          !boardPanning && !scrollable && "snap-y snap-proximity",
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
                const staffBookings = visibleBookings
                  .filter((booking) => booking.staffKey === staffMember.key)
                  .map((booking) => ({ ...booking, phase: getBookingPhase(booking, currentHour) }))
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
                          const activeStatus = isActiveBookingStatus(booking.status);
                          const cardTone = getBookingCardTone(booking.status, booking.phase);
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
                              draggable
                              data-booking-id={booking.id}
                              data-booking-duration={booking.duration}
                              data-current-booking={activeStatus ? "true" : undefined}
                              onDragStart={(event) => handleBookingDragStart(event, booking.id)}
                              onDragEnd={() => setDraggingBookingId(null)}
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelectBooking(booking.id);
                                setExpandedMicroBookingId(density === "micro" && cardTone !== "pending" ? booking.id : null);
                              }}
                              className={cn(
                                "absolute z-20 box-border cursor-grab overflow-hidden rounded-[8px] border p-0 text-left transition-all active:cursor-grabbing",
                                cardTone !== "pending" && "hover:-translate-y-0.5",
                                booking.id === currentBookingId && "snap-start snap-always",
                                draggingBookingId === booking.id && "opacity-70 ring-2 ring-[#2f7866]/25",
                                caughtBookingId === booking.id &&
                                  (cardTone === "pending"
                                    ? "ring-1 ring-[#e3c476]/30"
                                    : cardTone === "active"
                                      ? "shadow-none ring-1 ring-[#9fc9bd]/35"
                                      : "shadow-none ring-2 ring-[#2f7866]/25"),
                                expandedMicro &&
                                  (cardTone === "pending"
                                    ? "z-50 ring-1 ring-[#e3c476]/30"
                                    : cardTone === "active"
                                      ? "z-50 shadow-none ring-1 ring-[#9fc9bd]/35"
                                      : "z-50 shadow-[0_20px_38px_rgba(15,23,42,0.18)] ring-2 ring-[#2f7866]/35"),
                                getBookingCardToneClass(cardTone, selected),
                              )}
                              style={{
                                ...bookingLayoutStyle,
                                top: getBookingTop(booking.start),
                                height: bookingHeight,
                              }}
                            >
                              <div className={cn("absolute inset-0 flex min-h-0 min-w-0 items-center overflow-hidden text-left", microCard ? "px-2" : "px-3")}>
                                <div
                                  className={cn(
                                    "grid w-full min-w-0 items-center gap-x-2",
                                    microCard ? "grid-cols-[8px_minmax(0,1fr)_max-content]" : "grid-cols-[8px_minmax(0,1fr)_auto]",
                                    microCard ? "grid-rows-[16px]" : "grid-rows-[16px_16px] gap-y-[2.5px]",
                                  )}
                                >
                                  <span className={cn("h-2 w-2 shrink-0 rounded-full text-[13px]", getBookingDotClass(cardTone))} aria-hidden="true" />
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
                                    <p className="col-start-2 col-span-2 min-w-0 truncate text-[13px] leading-[16px] text-[#64748b]">
                                      {booking.service}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
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

  return (
    <div className="bg-white p-4">
      <div className="grid gap-2 xl:grid-cols-7">
        {weekDates.map((date, index) => {
          const dayBookings = getPreviewBookingsForBucket(bookings, index, 7);
          const counts = getBookingCounts(dayBookings);
          const isToday = date === todayScheduleDate;

          return (
            <section
              key={date}
              className={cn(
                "min-h-[430px] rounded-[8px] border bg-[#f8fafc] p-3",
                isToday ? "border-[#2f7866] ring-1 ring-[#2f7866]/15" : "border-[#e2e8f0]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-medium text-[#111827]">{formatScheduleShortDate(date)}</p>
                  <p className="mt-1 text-[12px] text-[#64748b]">예약 {counts.total}건 · 대기 {counts.pending}건</p>
                </div>
                {isToday ? <span className="rounded-full bg-[#e6f3ef] px-2 py-1 text-[11px] text-[#1f6b5b]">오늘</span> : null}
              </div>

              <div className="mt-3 space-y-2">
                {dayBookings.slice(0, 5).map((booking) => (
                  <button
                    key={`${date}-${booking.id}`}
                    type="button"
                    onClick={() => onSelectBooking(booking.id)}
                    className={cn(
                      "w-full rounded-[8px] border px-3 py-2 text-left transition",
                      getBookingCardToneClass(getBookingCardTone(booking.status, "upcoming"), selectedBookingId === booking.id),
                    )}
                  >
                    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2">
                      {(() => {
                        const tone = getBookingCardTone(booking.status, "upcoming");
                        return (
                          <>
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", getBookingDotClass(tone))} aria-hidden="true" />
                            <p className="min-w-0 truncate text-[13px] font-medium text-[#111827]">{booking.pet} · {booking.customer}</p>
                            <span className={cn("shrink-0 tabular-nums text-[11px]", getBookingTimeTextClass(tone))}>
                              {formatHourLabel(booking.start)}-{formatHourLabel(booking.start + booking.duration)}
                            </span>
                            <p className="col-start-2 mt-0.5 truncate text-[12px] text-[#64748b]">{booking.service}</p>
                          </>
                        );
                      })()}
                    </div>
                  </button>
                ))}
                {dayBookings.length > 5 ? (
                  <div className="rounded-[8px] border border-dashed border-[#cfd8e3] bg-white/70 px-3 py-2 text-center text-[12px] text-[#64748b]">
                    +{dayBookings.length - 5}건 더 보기
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

  return (
    <div className="bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[18px] font-medium text-[#111827]">{getScheduleMonthLabel(selectedDate)}</p>
          <p className="mt-1 text-[12px] text-[#64748b]">날짜별 예약 밀도, 승인 대기, 변경 취소를 한눈에 봅니다.</p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#64748b]">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#1f6b5b]" />많음</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" />대기</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ef4444]" />변경/취소</span>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-[8px] border border-[#e2e8f0]">
        {weekdayShortLabels.map((label) => (
          <div key={label} className="border-b border-[#e2e8f0] bg-[#f8fafc] px-2 py-2 text-center text-[12px] text-[#64748b]">
            {label}
          </div>
        ))}
        {monthDates.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="min-h-[108px] border-b border-r border-[#eef2f7] bg-[#fbfcfd]" />;
          }

          const dateIndex = realDates.indexOf(date);
          const dayBookings = getPreviewBookingsForBucket(bookings, dateIndex, realDates.length);
          const counts = getBookingCounts(dayBookings);
          const firstBooking = dayBookings[0];
          const isToday = date === todayScheduleDate;
          const densityClass = counts.total >= 3 ? "bg-[#dff0eb]" : counts.total >= 1 ? "bg-[#f1f8f5]" : "bg-white";

          return (
            <button
              key={date}
              type="button"
              onClick={() => firstBooking && onSelectBooking(firstBooking.id)}
              className={cn(
                "min-h-[108px] border-b border-r border-[#eef2f7] p-2 text-left transition hover:bg-[#eef7f4]",
                densityClass,
                isToday && "ring-2 ring-inset ring-[#2f7866]",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#111827]">{Number(date.slice(-2))}</span>
                {counts.total > 0 ? <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#1f6b5b]">{counts.total}</span> : null}
              </div>
              {firstBooking ? (
                <div className="mt-3 space-y-1">
                  <p className="truncate text-[12px] font-medium text-[#111827]">{firstBooking.pet} · {firstBooking.customer}</p>
                  <p className="truncate text-[11px] text-[#64748b]">{formatHourLabel(firstBooking.start)} · {firstBooking.service}</p>
                </div>
              ) : null}
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

function buildDefaultScheduleForm(data: BootstrapPayload, visibleStaff: Array<(typeof demoStaffColumns)[number]>, selectedDate: string, staff: StaffFilter): ScheduleCreateFormState {
  const initialStaff = staff === "전체 스태프" ? visibleStaff[0] : visibleStaff.find((item) => item.key === staff) ?? visibleStaff[0];
  return {
    petId: data.pets[0]?.id ?? "",
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
  visibleStaff: Array<(typeof demoStaffColumns)[number]>;
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
  const canSubmit = Boolean(form.petId && form.serviceId && form.staffKey && form.date && form.time && !saving);

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

        <div className="mt-5 grid gap-3 md:grid-cols-2">
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
            {selectedPet && selectedGuardian ? (
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
  manualApprovalEnabled: controlledManualApprovalEnabled,
  onManualApprovalChange,
}: {
  initialData?: BootstrapPayload;
  manualApprovalEnabled?: boolean;
  onManualApprovalChange?: (enabled: boolean) => void;
}) {
  const initialBootstrapData = useMemo(() => initialData ?? buildDemoBootstrap(), [initialData]);
  const [bootstrapData, setBootstrapData] = useState(() => initialBootstrapData);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignments>({});
  const [selectedDate, setSelectedDate] = useState(() => currentDateInTimeZone());
  const selectedDateBookings = useMemo(
    () => buildDailyBookingsFromBootstrap(bootstrapData, selectedDate, staffAssignments),
    [bootstrapData, selectedDate, staffAssignments],
  );
  const [staff, setStaff] = useState<StaffFilter>("전체 스태프");
  const [demoStaffCount, setDemoStaffCount] = useState(defaultVisibleStaffCount);
  const [activeMetric, setActiveMetric] = useState<SummaryMetricKey>("today");
  const [reservationStatusFilter, setReservationStatusFilter] = useState<ReservationStatusFilter>("all");
  const [scheduleView, setScheduleView] = useState<ScheduleView>("day");
  const [bookings, setBookings] = useState<DailyBooking[]>(() => selectedDateBookings);
  const [selectedBookingId, setSelectedBookingId] = useState(() => getPriorityBookingId(selectedDateBookings, getCurrentDayHour()));
  const [staffComments, setStaffComments] = useState<Record<string, string>>(() => initialStaffComments);
  const [internalManualApprovalEnabled, setInternalManualApprovalEnabled] = useState(true);
  const [earlyStartBooking, setEarlyStartBooking] = useState<DailyBooking | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleCreateFormState>(() =>
    buildDefaultScheduleForm(initialBootstrapData, demoStaffColumns.slice(0, defaultVisibleStaffCount), currentDateInTimeZone(), "전체 스태프"),
  );
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const manualApprovalEnabled = controlledManualApprovalEnabled ?? internalManualApprovalEnabled;
  const visibleStaff = useMemo(() => demoStaffColumns.slice(0, demoStaffCount), [demoStaffCount]);
  const staffScopedBookings = useMemo(
    () =>
      (staff === "전체 스태프" ? bookings : bookings.filter((item) => item.staffKey === staff)).filter((booking) =>
        visibleStaff.some((item) => item.key === booking.staffKey),
      ),
    [bookings, staff, visibleStaff],
  );
  const displayScopedBookings = useMemo(
    () => staffScopedBookings.map((booking) => normalizeBookingForApprovalMode(booking, manualApprovalEnabled)),
    [manualApprovalEnabled, staffScopedBookings],
  );
  const summaryMetrics = useMemo(() => buildScheduleMetrics(displayScopedBookings), [displayScopedBookings]);
  const reservationFilterOptions = useMemo(
    () => getReservationFilterOptions(displayScopedBookings, manualApprovalEnabled),
    [displayScopedBookings, manualApprovalEnabled],
  );

  useEffect(() => {
    setBootstrapData(initialBootstrapData);
    setScheduleForm(buildDefaultScheduleForm(initialBootstrapData, visibleStaff, selectedDate, staff));
  }, [initialBootstrapData]);

  useEffect(() => {
    const nextBookings = manualApprovalEnabled
      ? selectedDateBookings
      : selectedDateBookings.map((booking) => normalizeBookingForApprovalMode(booking, false));
    setBookings(nextBookings);
    setSelectedBookingId(nextBookings.length > 0 ? getPriorityBookingId(nextBookings, getCurrentDayHour()) : "");
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

  const selectedBooking =
    filteredBookings.find((item) => item.id === selectedBookingId) ??
    filteredBookings[0];

  function handleMetricSelect(metric: SummaryMetricKey) {
    setActiveMetric(metric);
    const nextReservationFilter: ReservationStatusFilter = "all";
    setReservationStatusFilter(nextReservationFilter);

    const nextBookings = displayScopedBookings.filter((booking) => {
        if (metric === "completed") return isCompletedBookingStatus(booking.status);
        if (metric === "changes") return isChangeBookingStatus(booking.status);
        if (metric === "today") return matchesReservationFilter(booking, nextReservationFilter);
        return true;
      });

    if (nextBookings[0]) {
      setSelectedBookingId(getPriorityBookingId(nextBookings, getCurrentDayHour()));
    } else {
      setSelectedBookingId("");
    }
  }

  function handleReservationStatusFilterChange(filter: ReservationStatusFilter) {
    setActiveMetric("today");
    setReservationStatusFilter(filter);
    const nextBookings = displayScopedBookings.filter((booking) => matchesReservationFilter(booking, filter));
    setSelectedBookingId(nextBookings[0] ? getPriorityBookingId(nextBookings, getCurrentDayHour()) : "");
  }

  function handleDemoStaffCountChange(count: number) {
    const nextVisibleStaff = demoStaffColumns.slice(0, count);
    setDemoStaffCount(count);
    if (staff !== "전체 스태프" && !nextVisibleStaff.some((item) => item.key === staff)) {
      setStaff("전체 스태프");
    }
    const nextBookings = bookings.filter((booking) => nextVisibleStaff.some((item) => item.key === booking.staffKey));
    if (nextBookings.length > 0) {
      setSelectedBookingId(getPriorityBookingId(nextBookings, getCurrentDayHour()));
    } else {
      setSelectedBookingId("");
    }
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

  function isBeforeBookingStart(booking: DailyBooking) {
    const selectedDay = parseScheduleDate(selectedDate).getTime();
    const todayDay = parseScheduleDate(currentDateInTimeZone()).getTime();
    return selectedDay > todayDay || (selectedDay === todayDay && getCurrentDayHour() < booking.start);
  }

  function applyBookingStatusChange(bookingId: string, nextStatus: string) {
    setBookings((current) =>
      current.map((booking) => {
        if (booking.id !== bookingId) return booking;
        if (nextStatus === "진행 중" && !canStartGrooming(booking.status)) return booking;
        if (nextStatus === "픽업 준비" && !canMarkGroomingComplete(booking.status)) return booking;
        return { ...booking, status: nextStatus };
      }),
    );
  }

  function handleChangeBookingStatus(bookingId: string, nextStatus: string) {
    const targetBooking = bookings.find((booking) => booking.id === bookingId);
    if (targetBooking && nextStatus === "진행 중" && canStartGrooming(targetBooking.status) && isBeforeBookingStart(targetBooking)) {
      setEarlyStartBooking(targetBooking);
      return;
    }

    applyBookingStatusChange(bookingId, nextStatus);
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
    const selectedPet = bootstrapData.pets.find((pet) => pet.id === scheduleForm.petId);
    const selectedService = bootstrapData.services.find((service) => service.id === scheduleForm.serviceId);
    const targetStaff = visibleStaff.find((item) => item.key === scheduleForm.staffKey);

    if (!selectedPet || !selectedService || !targetStaff || !scheduleForm.date || !scheduleForm.time) {
      setScheduleError("고객, 서비스, 담당자, 날짜와 시간을 모두 선택해 주세요.");
      return;
    }

    const duration = selectedService.duration_minutes / 60;
    const dateBookings = scheduleForm.date === selectedDate ? bookings : buildDailyBookingsFromBootstrap(bootstrapData, scheduleForm.date, staffAssignments);
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
    const payload = {
      shopId: bootstrapData.shop.id,
      guardianId: selectedPet.guardian_id,
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
      setScheduleView("day");
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SummaryStrip activeMetric={activeMetric} metrics={summaryMetrics} onSelectMetric={handleMetricSelect} />
        <button
          type="button"
          onClick={handleAddSchedule}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#1f6b5b] px-4 text-[14px] font-medium text-white transition hover:bg-[#185848]"
        >
          <CalendarPlus className="h-4 w-4" />
          스케줄 추가
        </button>
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
          <ScheduleViewSwitch
            value={scheduleView}
            onChange={setScheduleView}
            action={
              activeMetric === "today" && manualApprovalEnabled ? (
                <ReservationFilterStrip
                  activeFilter={reservationStatusFilter}
                  options={reservationFilterOptions}
                  onSelectFilter={handleReservationStatusFilterChange}
                />
              ) : null
            }
          />
          <CalendarToolbar
            selectedDate={selectedDate}
            staff={staff}
            visibleStaff={visibleStaff}
            demoStaffCount={demoStaffCount}
            onDateChange={setSelectedDate}
            onStaffChange={setStaff}
            onDemoStaffCountChange={handleDemoStaffCountChange}
          />
          {scheduleView === "day" ? (
            <DailyScheduleGrid
              bookings={filteredBookings}
              staff={staff}
              visibleStaff={visibleStaff}
              activeMetric={activeMetric}
              manualApprovalEnabled={manualApprovalEnabled}
              selectedBookingId={selectedBooking?.id ?? ""}
              onSelectBooking={setSelectedBookingId}
              onMoveBooking={handleMoveBooking}
            />
          ) : scheduleView === "week" ? (
            <WeeklyScheduleOverview
              bookings={filteredBookings}
              selectedDate={selectedDate}
              selectedBookingId={selectedBooking?.id ?? ""}
              onSelectBooking={setSelectedBookingId}
            />
          ) : (
            <MonthlyScheduleOverview
              bookings={filteredBookings}
              selectedDate={selectedDate}
              onSelectBooking={setSelectedBookingId}
            />
          )}
        </WebSurface>

        <BookingSidePanel
          activeMetric={activeMetric}
          manualApprovalEnabled={manualApprovalEnabled}
          selectedBooking={selectedBooking}
          selectedBookingId={selectedBookingId}
          approvalModeBookings={[]}
          onManualApprovalChange={handleManualApprovalChange}
          onChangeStatus={handleChangeBookingStatus}
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
