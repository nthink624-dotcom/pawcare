"use client";

import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock,
  Copy,
  History,
  ImagePlus,
  Loader2,
  MessageCircle,
  MoreVertical,
  NotebookPen,
  PawPrint,
  Play,
  QrCode,
  Scissors,
  Send,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import type { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { calendarBookings } from "@/components/owner-web/owner-web-data";
import {
  toOwnerWebStaffColumn,
  type OwnerWebStaffColumn,
  type OwnerWebStaffMember,
  type OwnerWebWeekdayKey,
} from "@/components/owner-web/owner-web-staff-data";
import {
  SoftSelect,
  WebSurface,
} from "@/components/owner-web/owner-web-ui";
import {
  getMiniWrapIndicatorClass,
  getWrapIndicatorClass,
  type StatusIndicatorTone,
} from "@/components/owner-web/status-indicators";
import { isShopClosedOnDate } from "@/lib/availability";
import { fetchApiJson, fetchApiJsonWithAuth } from "@/lib/api";
import { createOwnerMediaAssetFromFile } from "@/lib/media/owner-media-client";
import { getPetBiteLevelLabel, normalizePetBiteLevel } from "@/lib/pet-bite-level";
import { addDate, cn, currentDateInTimeZone } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload, Guardian, MediaKind, NotificationType, Pet, PetBiteLevel, PetStaffNote, Service } from "@/types/domain";

type SummaryMetricKey = "today" | "completed" | "changes";
type ReservationStatusFilter = "all" | "pending" | "confirmed";
type BookingCardTone = "confirmed" | "active" | "pending" | "completed" | "changed" | "cancelled";
type ScheduleMetric = { key: SummaryMetricKey; label: string; value?: string };
type OwnerScheduleRangeResponse = Pick<BootstrapPayload, "appointments" | "groomingRecords" | "notifications"> & {
  shopId: string;
  from: string;
  to: string;
};
type RecentStatusOverride = {
  status: AppointmentStatus;
  createdAt: number;
};
type PhotoStatusAction = {
  bookingId: string;
  nextStatus: "완료";
  mediaKind: Extract<MediaKind, "grooming_after">;
  title: string;
  description: string;
  buttonLabel: string;
};
type StaffKey = string;
type StaffFilter = "전체 직원" | StaffKey;
type StaffAssignments = Record<string, StaffKey>;
const staffWeekdayKeys: OwnerWebWeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const timeWheelHours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const timeWheelMinutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
const recentStatusOverrideTtlMs = 30_000;
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
export type OwnerScheduleCreateRequest = {
  requestId: number;
  guardianId: string;
  petId: string | null;
  date?: string;
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

const bookingStatusToAppointmentStatus: Partial<Record<string, AppointmentStatus>> = {
  "승인 대기": "pending",
  확정: "confirmed",
  "진행 중": "in_progress",
  "픽업 준비": "almost_done",
  완료: "completed",
  취소: "cancelled",
  거절: "rejected",
  노쇼: "noshow",
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

function timeInputToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function sanitizeTwentyFourHourInput(value: string) {
  return value.replace(/[^\d:]/g, "").slice(0, 5);
}

function normalizeTwentyFourHourInput(value: string) {
  const cleaned = value.trim();
  const colonMatch = /^(\d{1,2}):(\d{1,2})$/.exec(cleaned);
  if (colonMatch) {
    const candidate = `${String(Number(colonMatch[1])).padStart(2, "0")}:${String(Number(colonMatch[2])).padStart(2, "0")}`;
    return timeInputToMinutes(candidate) === null ? cleaned : candidate;
  }

  const digits = cleaned.replace(/\D/g, "");
  const candidate =
    digits.length === 3
      ? `0${digits.slice(0, 1)}:${digits.slice(1)}`
      : digits.length === 4
        ? `${digits.slice(0, 2)}:${digits.slice(2)}`
        : cleaned;
  return timeInputToMinutes(candidate) === null ? cleaned : candidate;
}

function formatScheduleDateLabel(date = currentDateInTimeZone()) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function formatSchedulePickerDateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${String(month).padStart(2, "0")}월 ${String(day).padStart(2, "0")}일`;
}

function formatSchedulePickerRelativeLabel(date: string, shop?: BootstrapPayload["shop"]) {
  if (shop && isShopClosedOnDate(shop, date)) return "휴무일";
  const today = currentDateInTimeZone();
  if (date === today) return "오늘";
  if (date === addScheduleDays(today, 1)) return "내일";
  if (date === addScheduleDays(today, 2)) return "모레";
  return formatSchedulePickerDateLabel(date);
}

function timeToHour(time: string) {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) + Number(minute) / 60;
}

function isOutsideShopOperatingHours(shop: BootstrapPayload["shop"], date: string, start: number, duration: number) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
  const hours = shop.business_hours[weekday];
  if (!hours?.enabled) return true;

  return start < timeToHour(hours.open) || start + duration > timeToHour(hours.close);
}

function buildOwnerCreateAvailableSlots({
  shop,
  date,
  duration,
  staffKey,
  staffMembers,
  staffScheduleOverrides,
  bookings,
}: {
  shop: BootstrapPayload["shop"];
  date: string;
  duration: number;
  staffKey: StaffKey;
  staffMembers: OwnerWebStaffMember[];
  staffScheduleOverrides: BootstrapPayload["staffScheduleOverrides"] | undefined;
  bookings: DailyBooking[];
}) {
  if (!staffKey || !Number.isFinite(duration) || duration <= 0 || isShopClosedOnDate(shop, date)) return [];

  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
  const hours = shop.business_hours[weekday];
  if (!hours?.enabled) return [];

  const openMinute = Math.round(timeToHour(hours.open) * 60);
  const closeMinute = Math.round(timeToHour(hours.close) * 60);
  const bookingStartMinute = Math.max(
    openMinute,
    Math.round(timeToHour(shop.booking_available_start_time || hours.open) * 60),
  );
  const bookingEndMinute = Math.min(
    closeMinute,
    Math.round(timeToHour(shop.booking_available_end_time || hours.close) * 60),
  );
  const durationMinutes = Math.round(duration * 60);
  const nowMinute = Math.ceil((getCurrentDayHour() * 60) / 15) * 15;
  const firstMinute = Math.ceil(bookingStartMinute / 15) * 15;
  const slots: string[] = [];

  for (let cursor = firstMinute; cursor <= bookingEndMinute && cursor + durationMinutes <= closeMinute; cursor += 15) {
    if (date === currentDateInTimeZone() && cursor <= nowMinute) continue;

    const start = cursor / 60;
    if (!isStaffWorkingWindow(staffMembers, staffScheduleOverrides, staffKey, date, start, duration)) continue;
    if (hasStaffBookingConflict(bookings, "__new-booking__", { staffKey, start, duration })) continue;

    slots.push(formatHourLabel(start));
  }

  return slots;
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

function isRescheduledBookingStatus(status: string) {
  return status === "변경";
}

function isChangeBookingStatus(status: string) {
  return isRescheduledBookingStatus(status) || status === "취소" || status === "거절" || status === "노쇼";
}

function isBookableStatus(status: string) {
  return !isChangeBookingStatus(status) && !isCompletedBookingStatus(status);
}

function getTimedBookingStatus(
  booking: { status: string; start: number; duration: number; changeAcknowledged?: boolean },
  selectedDate: string,
  currentHour: number,
) {
  if (isPendingBookingStatus(booking.status) || isChangeBookingStatus(booking.status) || isCompletedBookingStatus(booking.status)) {
    return booking.status;
  }

  const today = currentDateInTimeZone();
  const endHour = booking.start + booking.duration;
  const autoCompletable = isConfirmedBookingStatus(booking.status) || isActiveBookingStatus(booking.status);
  if (selectedDate < today && autoCompletable) return "완료";
  if (selectedDate === today && autoCompletable && currentHour >= endHour) return "완료";
  if (isActiveBookingStatus(booking.status)) return booking.status;
  if (booking.changeAcknowledged && isConfirmedBookingStatus(booking.status)) return booking.status;
  if (selectedDate !== today) return booking.status;

  if (isConfirmedBookingStatus(booking.status) && currentHour >= booking.start && currentHour < endHour) return "진행 중";
  return "확정";
}

function canSendCompletionNotice(sourceStatus: string, displayStatus: string) {
  return sourceStatus === "진행 중" && (displayStatus === "진행 중" || displayStatus === "픽업 준비" || displayStatus === "완료");
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
  if (isRescheduledBookingStatus(status)) return "changed";
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

  if (tone === "changed") {
    return cn(
      "border-[#f2d4b7] bg-white text-[#17211f] shadow-none",
      selected && "border-[#db8a3a] ring-1 ring-[#f0a35a]/20",
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

function getBookingIndicatorTone(tone: BookingCardTone): StatusIndicatorTone {
  if (tone === "pending") return "amber";
  if (tone === "completed") return "slate";
  if (tone === "changed") return "amber";
  if (tone === "cancelled") return "burgundy";
  return "teal";
}

function isMissedStartBooking(
  booking: Pick<DailyBooking, "status" | "sourceStatus" | "start">,
  selectedDate: string,
  currentHour: number,
  minutesAfterStart = 5,
) {
  const sourceStatus = booking.sourceStatus ?? booking.status;
  return selectedDate === currentDateInTimeZone() && canStartGrooming(sourceStatus) && currentHour >= booking.start + minutesAfterStart / 60;
}

function getReservationStatusLabel(booking: DailyBooking, selectedDate: string, currentHour: number) {
  const sourceStatus = booking.sourceStatus ?? booking.status;
  if (isMissedStartBooking(booking, selectedDate, currentHour)) return "시작 확인 필요";
  if (isPendingBookingStatus(sourceStatus)) return "승인대기";
  if (sourceStatus === "진행 중" || booking.status === "진행 중") return "진행중";
  if (isCompletedBookingStatus(sourceStatus) || isCompletedBookingStatus(booking.status)) return "완료";
  if (isChangeBookingStatus(sourceStatus)) return sourceStatus;
  if (canStartGrooming(sourceStatus)) return "확정";
  return sourceStatus;
}

function getReservationStatusPillClass(booking: DailyBooking, selectedDate: string, currentHour: number) {
  const sourceStatus = booking.sourceStatus ?? booking.status;
  if (isMissedStartBooking(booking, selectedDate, currentHour)) return "border-[#ead7c7] bg-[#fff7ed] text-[#9a4f1f]";
  if (isPendingBookingStatus(sourceStatus)) return "border-[#e8c67e] bg-[#fff8e7] text-[#9a640f]";
  if (sourceStatus === "진행 중" || booking.status === "진행 중") return "border-[#b7d8cd] bg-[#e8f5f1] text-[#1f6b5b]";
  if (isCompletedBookingStatus(sourceStatus) || isCompletedBookingStatus(booking.status)) return "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]";
  if (isChangeBookingStatus(sourceStatus)) return "border-[#ead6dc] bg-[#fffafa] text-[#8f2438]";
  return "border-[#b7d8cd] bg-[#eef8f4] text-[#1f6b5b]";
}

function getBookingResizeHandleClass(tone: BookingCardTone) {
  if (tone === "active") return "bg-[#347f70]/78";
  if (tone === "completed") return "bg-[#94a3b8]/70";
  if (tone === "pending") return "bg-[#edbd3f]/80";
  if (tone === "changed") return "bg-[#e68a2e]/75";
  if (tone === "cancelled") return "bg-[#8f2438]/70";
  return "bg-[#2f7866]/78";
}

function getBookingTimeTextClass(tone: BookingCardTone) {
  if (tone === "pending") return "text-[#9f6f00]";
  if (tone === "completed") return "text-[#64748b]";
  if (tone === "changed") return "text-[#a75f12]";
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

function bookingWindowsOverlap(first: Pick<DailyBooking, "start" | "duration">, second: Pick<DailyBooking, "start" | "duration">) {
  return first.start < second.start + second.duration && second.start < first.start + first.duration;
}

function getPendingOverlapBookings(booking: DailyBooking, bookings: DailyBooking[]) {
  if (!isPendingBookingStatus(booking.sourceStatus ?? booking.status)) return [];

  return bookings.filter((item) => {
    if (item.id === booking.id) return false;
    if (item.staffKey !== booking.staffKey) return false;
    if (!isPendingBookingStatus(item.sourceStatus ?? item.status)) return false;
    return bookingWindowsOverlap(booking, item);
  });
}

function getPendingOverlapLabel(booking: DailyBooking, bookings: DailyBooking[]) {
  const overlaps = getPendingOverlapBookings(booking, bookings);
  if (overlaps.length === 0) return "";
  return `겹친 승인대기 ${overlaps.length + 1}건`;
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

function isStaffWorkingWindow(
  staffMembers: OwnerWebStaffMember[],
  staffScheduleOverrides: BootstrapPayload["staffScheduleOverrides"] | undefined,
  staffKey: StaffKey,
  date: string,
  start: number,
  duration: number,
) {
  const staffMember = staffMembers.find((item) => item.id === staffKey);
  if (!staffMember) return true;

  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
  const dayKey = staffWeekdayKeys[weekday];

  const override = staffScheduleOverrides?.find((item) => item.staff_id === staffKey && item.work_date === date);
  if (override) {
    if (override.status === "off" || override.status === "annual") return false;
    if (override.status === "half") {
      const split = timeToHour("13:00");
      const availableStart = override.period === "오전" ? split : timeToHour(staffMember.startTime);
      const availableEnd = override.period === "오후" ? split : timeToHour(staffMember.endTime);
      return start >= availableStart && start + duration <= availableEnd;
    }
    if (override.status === "work") {
      return start >= timeToHour(override.start_time ?? staffMember.startTime) && start + duration <= timeToHour(override.end_time ?? staffMember.endTime);
    }
  }

  if (!staffMember.defaultDays.includes(dayKey)) return false;

  return start >= timeToHour(staffMember.startTime) && start + duration <= timeToHour(staffMember.endTime);
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
  const persistedStaffKey = appointment.staff_id ?? staffAssignments[appointment.id] ?? null;
  const assignedStaff = persistedStaffKey
    ? staffColumns.find((item) => item.key === persistedStaffKey)
    : null;
  const staffColumn = assignedStaff ?? fallbackStaff;
  const durationMinutes = minutesBetween(appointment.start_at, appointment.end_at) ?? service?.duration_minutes ?? 60;

  return {
    id: appointment.id,
    day: "오늘",
    start: timeToHour(appointment.appointment_time),
    duration: Math.max(0.25, durationMinutes / 60),
    lane: 0,
    guardianId: appointment.guardian_id,
    petId: appointment.pet_id,
    customer: guardian?.name ?? "보호자 미등록",
    pet: pet?.name ?? "반려동물 미등록",
    service: service?.name ?? "서비스 미등록",
    servicePrice: service?.price,
    guardianPhone: guardian?.phone ?? "",
    petBreed: pet?.breed ?? "",
    petWeight: pet?.weight ?? null,
    petAge: pet?.age ?? null,
    petNotes: pet?.notes ?? "",
    petBiteLevel: normalizePetBiteLevel(pet?.bite_level),
    staff: staffColumn.name,
    status: appointmentStatusLabels[appointment.status],
    date: formatScheduleDateLabel(selectedDate),
    staffKey: staffColumn.key,
    staffName: staffColumn.name,
    serviceId: appointment.service_id,
    memo: appointment.memo,
    source: appointment.source,
  };
}

function groomingRecordToDailyBooking(
  record: BootstrapPayload["groomingRecords"][number],
  data: BootstrapPayload,
  selectedDate: string,
  fallbackStaff: OwnerWebStaffColumn,
): DailyBooking {
  const guardian = data.guardians.find((item) => item.id === record.guardian_id);
  const pet = data.pets.find((item) => item.id === record.pet_id);
  const service = data.services.find((item) => item.id === record.service_id);
  const time = record.groomed_at.slice(11, 16) || "10:00";

  return {
    id: `grooming-record-${record.id}`,
    day: "오늘",
    start: timeToHour(time),
    duration: Math.max(0.25, (service?.duration_minutes ?? 60) / 60),
    lane: 0,
    guardianId: record.guardian_id,
    petId: record.pet_id,
    customer: guardian?.name ?? "보호자 미등록",
    pet: pet?.name ?? "반려동물 미등록",
    service: service?.name ?? "서비스 미등록",
    servicePrice: service?.price,
    guardianPhone: guardian?.phone ?? "",
    petBreed: pet?.breed ?? "",
    petWeight: pet?.weight ?? null,
    petAge: pet?.age ?? null,
    petNotes: pet?.notes ?? "",
    petBiteLevel: normalizePetBiteLevel(pet?.bite_level),
    staff: fallbackStaff.name,
    status: "완료",
    date: formatScheduleDateLabel(selectedDate),
    staffKey: fallbackStaff.key,
    staffName: fallbackStaff.name,
    serviceId: record.service_id,
    memo: [record.style_notes, record.memo].map((item) => item?.trim()).filter(Boolean).join(" · "),
  };
}

const baseDailyBookings = calendarBookings.map((booking) => ({
  ...booking,
  ...(dailyBookingTimes[booking.id] ?? {}),
  date: todayScheduleDateLabel,
  staffKey: booking.staff === "원장" ? "staff-1" : "staff-2",
  staffName: booking.staff === "원장" ? "정우진" : "서하늘",
}));

type DailyBooking = {
  id: string;
  day: string;
  start: number;
  duration: number;
  lane: number;
  guardianId?: string;
  petId?: string;
  customer: string;
  pet: string;
  service: string;
  servicePrice?: number;
  guardianPhone?: string;
  petBreed?: string;
  petWeight?: number | null;
  petAge?: number | null;
  petNotes?: string;
  petBiteLevel?: PetBiteLevel;
  staff: string;
  status: string;
  sourceStatus?: string;
  date: string;
  staffKey: StaffKey;
  staffName: string;
  serviceId?: string;
  memo?: string;
  source?: "owner" | "customer";
  previousStart?: number;
  previousDuration?: number;
  changeAcknowledged?: boolean;
};

type PendingOutOfHoursMove = {
  bookingId: string;
  nextBooking: DailyBooking;
  previousBookings: DailyBooking[];
};

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
  {
    id: "C-20",
    day: "월",
    start: 13.25,
    duration: 0.75,
    lane: 0,
    customer: "이도윤",
    pet: "라떼",
    service: "저자극 케어",
    staff: "디자이너",
    status: "변경",
    date: todayScheduleDateLabel,
    staffKey: "staff-3",
    staffName: "민서윤",
    previousStart: 10,
    previousDuration: 0.75,
  },
  {
    id: "C-21",
    day: "월",
    start: 13,
    duration: 0.5,
    lane: 0,
    customer: "윤하나",
    pet: "라떼",
    service: "목욕",
    staff: "파트타임",
    status: "취소",
    date: todayScheduleDateLabel,
    staffKey: "staff-5",
    staffName: "오다은",
  },
] satisfies DailyBooking[];

const dailyBookings = [...baseDailyBookings, ...extraDailyBookings];

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
  return staffColumns[index % staffColumns.length] ?? staffColumns[0]!;
}

function buildDailyBookingsFromBootstrap(data: BootstrapPayload, selectedDate: string, staffAssignments: StaffAssignments = {}, staffColumns: OwnerWebStaffColumn[] = []): DailyBooking[] {
  if (staffColumns.length === 0) return [];

  const selectedDateAppointments = data.appointments
    .filter((appointment) => appointment.appointment_date === selectedDate)
    .sort((first, second) => first.appointment_time.localeCompare(second.appointment_time));
  const appointmentIds = new Set(selectedDateAppointments.map((appointment) => appointment.id));
  const recordOnlyBookings = data.groomingRecords
    .filter((record) => record.groomed_at.slice(0, 10) === selectedDate)
    .filter((record) => !record.appointment_id || !appointmentIds.has(record.appointment_id))
    .map((record) => groomingRecordToDailyBooking(record, data, selectedDate, staffColumns[0]));

  return [
    ...selectedDateAppointments.map((appointment, index) => {
      const staffColumn = staffColumnForIndex(index, staffColumns);
      return appointmentToDailyBooking(appointment, data, selectedDate, staffAssignments, staffColumn, staffColumns);
    }),
    ...recordOnlyBookings,
  ].sort((first, second) => first.start - second.start || first.id.localeCompare(second.id));
}

function buildLocalPreviewDailyBookings(selectedDate: string, staffColumns: OwnerWebStaffColumn[]) {
  const columns = staffColumns;
  if (columns.length === 0) return [];
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
    const fallbackStaffIndex = columns.findIndex((staffColumn) => staffColumn.key === booking.staffKey);
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
      staff: placement.staffColumn.name,
      staffKey: placement.staffColumn.key,
      staffName: placement.staffColumn.name,
    });
  }

  return scheduledBookings;
}

function shouldUseOwnerWebPreviewBookings(data: BootstrapPayload) {
  return data.mode !== "supabase" && (data.shop.id === "demo-shop" || data.shop.id === "owner-demo");
}

function hasAppointmentsOnDate(data: BootstrapPayload, selectedDate: string) {
  return data.appointments.some((appointment) => appointment.appointment_date === selectedDate);
}

function hasScheduleItemsOnDate(data: BootstrapPayload, selectedDate: string) {
  return (
    hasAppointmentsOnDate(data, selectedDate) ||
    data.groomingRecords.some((record) => record.groomed_at.slice(0, 10) === selectedDate)
  );
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

function getCustomerCommentKey(booking: Pick<DailyBooking, "pet" | "customer" | "petId" | "guardianId">) {
  if (booking.petId) return `pet:${booking.petId}`;
  if (booking.guardianId) return `guardian:${booking.guardianId}`;
  return `${booking.pet}|${booking.customer}`;
}

function getStaffCommentValue(comments: Record<string, string>, booking: DailyBooking) {
  return comments[getCustomerCommentKey(booking)] ?? comments[`${booking.pet}|${booking.customer}`] ?? "";
}

function buildStaffCommentsFromBootstrap(data: BootstrapPayload) {
  const comments = { ...initialStaffComments };

  for (const note of data.petStaffNotes ?? []) {
    const value = note.note?.trim() ?? "";
    if (note.pet_id) {
      comments[`pet:${note.pet_id}`] = value;
      const pet = data.pets.find((item) => item.id === note.pet_id);
      const guardian = data.guardians.find((item) => item.id === note.guardian_id);
      if (pet && guardian) comments[`${pet.name}|${guardian.name}`] = value;
      continue;
    }

    comments[`guardian:${note.guardian_id}`] = value;
  }

  return comments;
}

function upsertPetStaffNoteInBootstrap(data: BootstrapPayload, note: PetStaffNote): BootstrapPayload {
  const existingNotes = data.petStaffNotes ?? [];
  return {
    ...data,
    petStaffNotes: [
      ...existingNotes.filter(
        (item) =>
          item.id !== note.id &&
          !(note.pet_id && item.pet_id === note.pet_id) &&
          !(!note.pet_id && !item.pet_id && item.guardian_id === note.guardian_id),
      ),
      note,
    ],
  };
}

function replaceGuardianInBootstrap(data: BootstrapPayload, guardian: Guardian): BootstrapPayload {
  return {
    ...data,
    guardians: data.guardians.map((item) => (item.id === guardian.id ? { ...item, ...guardian } : item)),
  };
}

function upsertServiceInBootstrap(data: BootstrapPayload, service: Service): BootstrapPayload {
  return {
    ...data,
    services: [...data.services.filter((item) => item.id !== service.id), service],
  };
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
  shopId,
  bootstrapData,
  manualApprovalEnabled,
  selectedBooking,
  selectedBookingId,
  selectedDate,
  currentHour,
  bookings,
  approvalModeBookings,
  onManualApprovalChange,
  onChangeStatus,
  onSuggestAlternativeTime,
  onSelectBooking,
  onAcknowledgeChange,
  staffComments,
  onChangeStaffComment,
  onSaveBookingPhone,
  onSaveBookingDetail,
}: {
  activeMetric: SummaryMetricKey;
  shopId: string;
  bootstrapData: BootstrapPayload;
  manualApprovalEnabled: boolean;
  selectedBooking: DailyBooking | undefined;
  selectedBookingId: string;
  selectedDate: string;
  currentHour: number;
  bookings: DailyBooking[];
  approvalModeBookings: DailyBooking[];
  onManualApprovalChange: (enabled: boolean) => void;
  onChangeStatus: (bookingId: string, nextStatus: string) => void;
  onSuggestAlternativeTime: (bookingId: string) => void;
  onSelectBooking: (id: string) => void;
  onAcknowledgeChange: (bookingId: string) => void;
  staffComments: Record<string, string>;
  onChangeStaffComment: (commentKey: string, value: string, booking?: DailyBooking) => void;
  onSaveBookingPhone: (booking: DailyBooking, phone: string) => Promise<void>;
  onSaveBookingDetail: (
    booking: DailyBooking,
    values: { startTime: string; endTime: string; phone: string; serviceName: string; price: number },
  ) => Promise<void>;
}) {
  const timeRange = selectedBooking
    ? `${formatHourLabel(selectedBooking.start)} - ${formatHourLabel(selectedBooking.start + selectedBooking.duration)}`
    : "";
  const pendingOverlapLabel = selectedBooking ? getPendingOverlapLabel(selectedBooking, bookings) : "";
  const previousTimeRange =
    selectedBooking?.previousStart !== undefined
      ? `${formatHourLabel(selectedBooking.previousStart)} - ${formatHourLabel(
          selectedBooking.previousStart + (selectedBooking.previousDuration ?? selectedBooking.duration),
        )}`
      : "";
  const commentKey = selectedBooking ? getCustomerCommentKey(selectedBooking) : "";
  const staffComment = selectedBooking ? getStaffCommentValue(staffComments, selectedBooking) : "";
  const sourceStatus = selectedBooking?.sourceStatus ?? selectedBooking?.status ?? "";
  const displayStatus = selectedBooking?.status ?? "";
  const changeEventSelected = selectedBooking ? isChangeBookingStatus(selectedBooking.status) : false;
  const rescheduledEventSelected = selectedBooking ? isRescheduledBookingStatus(selectedBooking.status) : false;
  const startEnabled = selectedBooking ? canStartGrooming(sourceStatus) : false;
  const pickupReadyEnabled = selectedBooking ? canSendCompletionNotice(sourceStatus, displayStatus) : false;
  const finishEnabled = selectedBooking ? sourceStatus === "픽업 준비" || (displayStatus === "완료" && sourceStatus !== "완료") : false;
  const finalActionEnabled = pickupReadyEnabled || finishEnabled;
  const finalActionStatus = finishEnabled ? "완료" : "픽업 준비";
  const startLabel = startEnabled ? "미용 시작" : displayStatus === "진행 중" ? "자동 진행 중" : displayStatus === "완료" ? "완료됨" : "확정 후 시작";
  const finalActionLabel =
    finishEnabled ? "완료 처리" : pickupReadyEnabled ? "픽업 준비 알림" : displayStatus === "완료" ? "완료됨" : "진행 후 완료";
  const [activePanelTab, setActivePanelTab] = useState<"details" | "comments">("details");
  const [notificationSending, setNotificationSending] = useState(false);
  const [notificationNotice, setNotificationNotice] = useState("");
  const [editableStartTime, setEditableStartTime] = useState("");
  const [editableEndTime, setEditableEndTime] = useState("");
  const [editablePhone, setEditablePhone] = useState("");
  const [editableServiceName, setEditableServiceName] = useState("");
  const [editablePrice, setEditablePrice] = useState("");
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailNotice, setDetailNotice] = useState("");
  const [detailEditMode, setDetailEditMode] = useState<"time" | "service" | "price" | null>(null);
  const detailNoticeTimerRef = useRef<number | null>(null);
  const timeEditorRef = useRef<HTMLDivElement | null>(null);

  function showTemporaryDetailNotice(message: string) {
    if (detailNoticeTimerRef.current !== null) {
      window.clearTimeout(detailNoticeTimerRef.current);
    }
    setDetailNotice(message);
    detailNoticeTimerRef.current = window.setTimeout(() => {
      setDetailNotice((current) => (current === message ? "" : current));
      detailNoticeTimerRef.current = null;
    }, 2000);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setActivePanelTab("details"));
    setNotificationNotice("");
    setPhoneEditing(false);
    setDetailEditMode(null);
    return () => {
      window.cancelAnimationFrame(frame);
      if (detailNoticeTimerRef.current !== null) {
        window.clearTimeout(detailNoticeTimerRef.current);
        detailNoticeTimerRef.current = null;
      }
    };
  }, [selectedBooking?.id]);

  useEffect(() => {
    if (!selectedBooking) return;
    setEditableStartTime(formatHourLabel(selectedBooking.start));
    setEditableEndTime(formatHourLabel(selectedBooking.start + selectedBooking.duration));
    setEditablePhone(formatSchedulePhone(selectedBooking.guardianPhone ?? ""));
    setEditableServiceName(selectedBooking.service);
    setEditablePrice(
      typeof selectedBooking.servicePrice === "number"
        ? selectedBooking.servicePrice.toLocaleString("ko-KR")
        : "",
    );
    setDetailNotice("");
  }, [selectedBooking?.id, selectedBooking?.start, selectedBooking?.duration, selectedBooking?.guardianPhone, selectedBooking?.service, selectedBooking?.servicePrice]);

  useEffect(() => {
    if (detailEditMode !== "time") return;

    const handlePointerDown = (event: MouseEvent) => {
      if (timeEditorRef.current?.contains(event.target as Node)) return;
      commitTimeEdit();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [detailEditMode, editableStartTime, editableEndTime, editablePhone, editableServiceName, editablePrice]);

  if (!selectedBooking) {
    return (
      <aside className="min-w-0">
        <WebSurface className="min-w-0 overflow-hidden">
          <div className="px-4 py-3">
            <p className="text-[14px] leading-6 text-[#64748b]">예약을 선택하면 상세와 알림을 확인할 수 있습니다.</p>
          </div>
        </WebSurface>
      </aside>
    );
  }

  const breedLabel = selectedBooking.petBreed || "견종 미입력";
  const biteLevel = normalizePetBiteLevel(selectedBooking.petBiteLevel);
  const rawRequestText = selectedBooking.memo?.trim() || getCustomerRequest(selectedBooking.id);
  const hasRequestText = Boolean(rawRequestText);
  const requestText = rawRequestText || "고객 요청사항이 없습니다.";
  const mainAction = isPendingBookingStatus(sourceStatus)
    ? { label: "예약 확정", onClick: () => onChangeStatus(selectedBooking.id, "확정"), enabled: true }
    : startEnabled
      ? { label: "미용 시작", onClick: () => onChangeStatus(selectedBooking.id, "진행 중"), enabled: true }
      : finalActionEnabled
        ? { label: finalActionLabel, onClick: () => onChangeStatus(selectedBooking.id, finalActionStatus), enabled: true }
        : changeEventSelected
          ? { label: "요청 확인", onClick: () => onAcknowledgeChange(selectedBooking.id), enabled: true }
          : { label: isCompletedBookingStatus(sourceStatus) || isCompletedBookingStatus(displayStatus) ? "처리 완료" : "처리할 액션 없음", onClick: () => {}, enabled: false };
  const previousAction =
    sourceStatus === "진행 중"
      ? { label: "이전", onClick: () => onChangeStatus(selectedBooking.id, "확정") }
      : sourceStatus === "픽업 준비"
        ? { label: "이전", onClick: () => onChangeStatus(selectedBooking.id, "진행 중") }
        : null;
  const workflowPending = isPendingBookingStatus(sourceStatus);
  const workflowCompleted = isCompletedBookingStatus(sourceStatus) || isCompletedBookingStatus(displayStatus);
  const canResendCurrentNotification = !workflowPending && !changeEventSelected;
  const canSendVisitReminder = sourceStatus === "확정" || sourceStatus === "진행 중" || sourceStatus === "픽업 준비";
  const recentVisitHistory = selectedBooking ? getRecentVisitHistory(bootstrapData, selectedBooking) : [];

  async function savePhoneOnBlur() {
    if (!selectedBooking) return;

    const phone = normalizeSchedulePhone(editablePhone);
    const currentPhone = normalizeSchedulePhone(selectedBooking.guardianPhone ?? "");

    if (phone === currentPhone) {
      setPhoneEditing(false);
      return;
    }

    if (phone.length < 10) {
      showTemporaryDetailNotice("연락처를 10자리 이상 입력해 주세요.");
      setEditablePhone(formatSchedulePhone(selectedBooking.guardianPhone ?? ""));
      setPhoneEditing(false);
      return;
    }

    setPhoneSaving(true);
    setDetailNotice("");
    try {
      await onSaveBookingPhone(selectedBooking, phone);
      showTemporaryDetailNotice("저장되었습니다.");
      setPhoneEditing(false);
    } catch (error) {
      showTemporaryDetailNotice(getApiErrorMessage(error, "연락처 저장 중 문제가 발생했습니다."));
    } finally {
      setPhoneSaving(false);
    }
  }

  async function saveEditableDetail(overrides?: { startTime?: string; endTime?: string }) {
    if (!selectedBooking) return;

    const startTime = overrides?.startTime ?? editableStartTime;
    const endTime = overrides?.endTime ?? editableEndTime;
    const startMinutes = timeInputToMinutes(startTime);
    const endMinutes = timeInputToMinutes(endTime);
    const phone = normalizeSchedulePhone(editablePhone);
    const serviceName = editableServiceName.trim();
    const priceText = editablePrice.replace(/\D/g, "");
    const price = priceText ? Number(priceText) : NaN;

    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      showTemporaryDetailNotice("예약 시간을 다시 확인해 주세요.");
      return;
    }
    if (endMinutes - startMinutes < 15) {
      showTemporaryDetailNotice("예약 시간은 최소 15분 이상으로 입력해 주세요.");
      return;
    }
    if (phone.length < 10) {
      showTemporaryDetailNotice("연락처를 10자리 이상 입력해 주세요.");
      return;
    }
    if (!serviceName) {
      showTemporaryDetailNotice("시술명을 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showTemporaryDetailNotice("가격을 숫자로 입력해 주세요.");
      return;
    }

    setDetailSaving(true);
    setDetailNotice("");
    try {
      await onSaveBookingDetail(selectedBooking, { startTime, endTime, phone, serviceName, price });
      showTemporaryDetailNotice("저장되었습니다.");
    } catch (error) {
      showTemporaryDetailNotice(getApiErrorMessage(error, "예약 상세 저장 중 문제가 발생했습니다."));
    } finally {
      setDetailSaving(false);
    }
  }

  function commitTimeEdit(overrides?: { startTime?: string; endTime?: string }) {
    void saveEditableDetail(overrides);
    setDetailEditMode((current) => (current === "time" ? null : current));
  }

  async function sendWorkflowAlimtalk(type: NotificationType, successMessage: string) {
    setNotificationSending(true);
    setNotificationNotice("");
    try {
      await fetchApiJsonWithAuth("/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          appointmentId: selectedBookingId,
          type,
          channel: "alimtalk",
          force: true,
          metadata: { source: "owner_schedule_detail_panel" },
        }),
      });
      setNotificationNotice(successMessage);
    } catch (error) {
      setNotificationNotice(getApiErrorMessage(error, "알림톡 발송 중 문제가 발생했습니다."));
    } finally {
      setNotificationSending(false);
    }
  }

  async function resendAlimtalk() {
    await sendWorkflowAlimtalk(getAlimtalkResendType(sourceStatus || displayStatus), "알림톡 발송 요청이 완료되었습니다.");
  }

  return (
    <aside className="min-h-0 min-w-0">
      <WebSurface className="flex h-[calc(100vh-112px)] min-h-[640px] min-w-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative bg-white px-3.5 py-3">
            <div className="flex items-center gap-3">
              <div className="h-[78px] w-[78px] shrink-0 overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc]">
                <img src="/images/default-pet-profile.png" alt="" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="grid min-w-0 grid-rows-[24px_24px_24px] items-center gap-y-0.5">
                  <p className="flex h-6 min-w-0 items-center gap-2 leading-6">
                    <span className="min-w-0 truncate text-[17px] font-semibold text-[#111827]">{selectedBooking.pet}</span>
                    <span className="shrink-0 text-[15px] text-[#cbd5e1]">|</span>
                  <span className="relative top-px min-w-0 truncate text-[16px] text-[#64748b]">{breedLabel}</span>
                  </p>
                  <p className="flex h-6 min-w-0 items-center truncate text-[16px] leading-6 text-[#334155]">{selectedBooking.customer} 보호자</p>
                  <PetBiteLevelScale level={biteLevel} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white px-3.5 pb-3">
            <section className="border-y border-[#edf2f7] py-2">
              <div>
              <CompactEditableInfoRow label="가격">
                <CompactReadonlyValue>{editablePrice || "0"}</CompactReadonlyValue>
              </CompactEditableInfoRow>
              <CompactEditableInfoRow label="시술명">
                <div className="min-w-0">
                  <CompactReadonlyValue>{editableServiceName || "시술명 없음"}</CompactReadonlyValue>
                </div>
              </CompactEditableInfoRow>
              <CompactEditableInfoRow label="연락처">
                <CompactReadonlyValue tabular>{editablePhone || "연락처 없음"}</CompactReadonlyValue>
              </CompactEditableInfoRow>
              <CompactEditableInfoRow label="예약 시간">
                <CompactReadonlyValue tabular>{timeRange}</CompactReadonlyValue>
              </CompactEditableInfoRow>
              {detailSaving || detailNotice ? (
                <p className={cn("min-w-0 text-[13px] leading-5", detailNotice === "저장되었습니다." ? "text-[#2f7866]" : "text-[#64748b]")}>
                  {detailSaving ? "저장 중입니다." : detailNotice}
                </p>
              ) : null}
            </div>
          </section>

          <section className="py-1.5">
            <div className="flex min-h-[24px] items-center gap-1.5 text-left">
              <ClipboardList className="h-[18px] w-[18px] shrink-0 text-[#334155]" />
              <span className="shrink-0 text-[16px] font-normal text-[#334155]">요청사항</span>
            </div>
            <div
              className={cn(
                "mt-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[16px] leading-7 text-[#334155]",
                hasRequestText ? "min-h-[86px]" : "min-h-0",
              )}
            >
              {requestText.split("\n").map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
            </div>
          </section>

          <section className="py-1.5">
            <div className="flex min-h-[24px] items-center gap-1.5 text-left">
              <NotebookPen className="h-[18px] w-[18px] shrink-0 text-[#334155]" />
              <span className="shrink-0 text-[16px] font-normal text-[#334155]">코멘트</span>
            </div>
            <textarea
              readOnly
              value={staffComment.trim() ? staffComment : ""}
              placeholder="공유 코멘트가 없습니다."
              className="mt-1.5 min-h-[86px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[16px] leading-7 text-[#334155] outline-none placeholder:text-[#64748b]"
            />
          </section>

          <section className="py-1.5">
            <div className="flex min-h-[24px] items-center gap-1.5 text-left">
              <History className="h-[18px] w-[18px] shrink-0 text-[#334155]" />
              <span className="shrink-0 text-[16px] font-normal text-[#334155]">최근 방문이력</span>
            </div>
            <div className="mt-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2">
              {recentVisitHistory.length > 0 ? (
                <div className="divide-y divide-[#edf2f7]">
                  {recentVisitHistory.map((visit) => (
                    <div key={visit.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="shrink-0 text-[15px] font-normal tabular-nums text-[#7b8794]">{visit.date}</span>
                        <p className="min-w-0 truncate text-right text-[16px] font-medium text-[#334155]">{visit.service}</p>
                      </div>
                      {visit.note ? <p className="mt-1 line-clamp-2 text-[14px] leading-5 text-[#64748b]">{visit.note}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[16px] leading-7 text-[#64748b]">방문이력이 없습니다.</p>
              )}
            </div>
          </section>
          </div>
        </div>

          <section className="shrink-0 bg-white px-3.5 pb-3 pt-2.5">
            <div className="grid gap-2">
              {changeEventSelected ? (
                <button
                  type="button"
                  onClick={() => onAcknowledgeChange(selectedBooking.id)}
                  className="h-10 rounded-[8px] bg-[#2f7866] text-[16px] text-white transition hover:bg-[#286a5a]"
                >
                  변경/취소 확인
                </button>
              ) : workflowPending ? (
                <button
                  type="button"
                  onClick={() => onChangeStatus(selectedBooking.id, "확정")}
                  className="h-10 rounded-[8px] bg-[#2f7866] text-[16px] text-white transition hover:bg-[#286a5a]"
                >
                  예약 확정
                </button>
              ) : sourceStatus === "확정" ? (
                <button
                  type="button"
                  onClick={() => onChangeStatus(selectedBooking.id, "진행 중")}
                  className="h-10 rounded-[8px] bg-[#2f7866] text-[16px] text-white transition hover:bg-[#286a5a]"
                >
                  미용 시작
                </button>
              ) : sourceStatus === "진행 중" ? (
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeStatus(selectedBooking.id, "픽업 준비")}
                    className="h-10 rounded-[8px] bg-[#2f7866] text-[16px] text-white transition hover:bg-[#286a5a]"
                  >
                    픽업 준비
                  </button>
                  <div className="grid grid-cols-[1fr_3fr] gap-2">
                    <button
                      type="button"
                      onClick={previousAction?.onClick}
                      className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[16px] text-[#334155] hover:bg-[#f8fafc]"
                    >
                      이전
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeStatus(selectedBooking.id, "완료")}
                      className="h-10 rounded-[8px] bg-white text-[16px] text-[#2f7866] ring-1 ring-inset ring-[#b7d8cd] transition hover:bg-[#f7fbfa]"
                    >
                      미용 완료
                    </button>
                  </div>
                </div>
              ) : sourceStatus === "픽업 준비" ? (
                <div className="grid grid-cols-[1fr_3fr] gap-2">
                  <button
                    type="button"
                    onClick={previousAction?.onClick}
                    className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[16px] text-[#334155] hover:bg-[#f8fafc]"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeStatus(selectedBooking.id, "완료")}
                    className="h-10 rounded-[8px] bg-[#2f7866] text-[16px] text-white transition hover:bg-[#286a5a]"
                  >
                    미용 완료
                  </button>
                </div>
              ) : workflowCompleted ? (
                <div className="flex h-10 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] text-[16px] text-[#64748b]">
                  처리 완료
                </div>
              ) : (
                <div className="flex h-10 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] text-[16px] text-[#94a3b8]">
                  처리할 상태 없음
                </div>
              )}

              {!isActiveBookingStatus(sourceStatus) ? (
                <div className="grid grid-cols-2 gap-2">
                  {previousAction && !changeEventSelected && !workflowCompleted ? (
                    <button
                      type="button"
                      onClick={previousAction.onClick}
                      className="inline-flex h-10 items-center justify-center rounded-[8px] px-3 text-[15px] text-[#334155] transition hover:bg-[#f8fafc]"
                    >
                      이전
                    </button>
                  ) : null}
                  {!workflowCompleted && !changeEventSelected ? (
                    <button
                      type="button"
                      onClick={() => onChangeStatus(selectedBooking.id, workflowPending ? "거절" : "취소")}
                      className={cn(
                        "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] text-[#475569] transition hover:bg-[#f8fafc]",
                        previousAction || sourceStatus === "확정" ? "" : "col-span-2",
                      )}
                    >
                      <X className="h-4 w-4 text-[#64748b]" />
                      {workflowPending ? "예약 거절" : "예약 취소"}
                    </button>
                  ) : null}
                  {sourceStatus === "확정" && !changeEventSelected ? (
                    <button
                      type="button"
                      disabled={!canSendVisitReminder || notificationSending}
                      onClick={() => void sendWorkflowAlimtalk("appointment_reminder_10m", "방문 안내 알림톡 발송 요청이 완료되었습니다.")}
                      className="inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] text-[#475569] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-4 w-4 text-[#64748b]" />
                      방문 전 알림
                    </button>
                  ) : null}
                </div>
              ) : null}
              {notificationNotice ? <p className="text-[15px] leading-6 text-[#64748b]">{notificationNotice}</p> : null}
            </div>
          </section>
      </WebSurface>
    </aside>
  );

  /*
  return (
    <aside className="min-w-0 space-y-4">
      <WebSurface className="min-w-0 overflow-hidden">
        {selectedBooking ? (
          <div className="p-4">
            <PersistentBookingPanelHero
              booking={selectedBooking}
              timeRange={timeRange}
              isPending={isPendingBookingStatus(selectedBooking.status)}
              startEnabled={startEnabled}
              finalActionEnabled={finalActionEnabled}
              finalActionStatus={finalActionStatus}
              finalActionLabel={finalActionLabel}
              pendingOverlapLabel={pendingOverlapLabel}
              onChangeStatus={onChangeStatus}
              onSuggestAlternativeTime={onSuggestAlternativeTime}
            />
            <div className="hidden">
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
                <div className="hidden">
                  <p className="text-[12px] text-[#94a3b8]">시간</p>
                  <p className="mt-1 text-[26px] font-medium tracking-[-0.04em] text-[#111827]">{timeRange}</p>
                  <div className="mt-3">
                    <p className="text-[12px] text-[#94a3b8]">작업</p>
                    <p className="mt-1 text-[20px] font-medium tracking-[-0.03em] text-[#111827]">{selectedBooking.service}</p>
                  </div>
                </div>

                {changeEventSelected ? (
                  <div className="mt-4 space-y-3">
                    <div
                      className={cn(
                        "rounded-[8px] border px-3 py-3",
                        rescheduledEventSelected ? "border-[#f2d4b7] bg-[#fffaf4]" : "border-[#ead6dc] bg-[#fffafa]",
                      )}
                    >
                      <p className={cn("text-[12px]", rescheduledEventSelected ? "text-[#a75f12]" : "text-[#9f6b78]")}>변경 · 취소 확인</p>
                      <p className={cn("mt-1 text-[15px] font-medium", rescheduledEventSelected ? "text-[#a75f12]" : "text-[#8f2438]")}>
                        {rescheduledEventSelected ? "예약 시간이 변경되었습니다." : `${selectedBooking.status}된 예약입니다.`}
                      </p>
                      {rescheduledEventSelected && previousTimeRange ? (
                        <div className="mt-3 rounded-[8px] border border-[#f4dfc8] bg-white px-3 py-2">
                          <p className="text-[12px] text-[#94a3b8]">변경 전 예약시간</p>
                          <p className="mt-1 text-[17px] font-medium tabular-nums text-[#111827]">{previousTimeRange}</p>
                        </div>
                      ) : null}
                      <p className="mt-2 text-[13px] leading-5 text-[#64748b]">
                        {rescheduledEventSelected
                          ? "확인하면 변경된 시간으로 확정되어 초록 카드로 표시됩니다."
                          : "확인하면 예약 보드와 변경 · 취소 관리에서 더 이상 보이지 않습니다."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAcknowledgeChange(selectedBooking.id)}
                      className={cn(
                        "inline-flex h-11 w-full items-center justify-center rounded-[8px] px-3 text-[14px] font-medium text-white transition",
                        rescheduledEventSelected ? "bg-[#c87424] hover:bg-[#a75f12]" : "bg-[#8f2438] hover:bg-[#782033]",
                      )}
                    >
                      확인
                    </button>
                  </div>
                ) : isPendingBookingStatus(selectedBooking.status) ? (
                  <div className="hidden">
                    <button
                      type="button"
                      onClick={() => onChangeStatus(selectedBooking.id, "확정")}
                      className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#1f6b5b] px-2 text-[13px] font-medium text-white transition hover:bg-[#185848]"
                    >
                      예약 확정
                    </button>
                    <button
                      type="button"
                      onClick={() => onSuggestAlternativeTime(selectedBooking.id)}
                      className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-[13px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                    >
                      다른 시간 안내
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeStatus(selectedBooking.id, "거절")}
                      className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#ead7c7] bg-white px-2 text-[13px] font-medium text-[#9a4f1f] transition hover:bg-[#fff7ed]"
                    >
                      예약 거절
                    </button>
                  </div>
                ) : (
                  <div className="hidden">
                    <div className="grid grid-cols-2 gap-2">
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
                        disabled={!finalActionEnabled}
                        onClick={() => {
                          if (finalActionEnabled) onChangeStatus(selectedBooking.id, finalActionStatus);
                        }}
                        className={cn(
                          "inline-flex h-11 items-center justify-center gap-2 rounded-[8px] px-3 text-[14px] font-medium transition",
                          finalActionEnabled ? "bg-[#2f7866] text-white hover:bg-[#286a5a]" : "bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed",
                        )}
                      >
                        <MessageCircle className="h-4 w-4" />
                        {finalActionLabel}
                      </button>
                    </div>
                    {selectedBooking && isBookableStatus(sourceStatus) ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onSuggestAlternativeTime(selectedBooking.id)}
                          className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                        >
                          다른 시간 안내
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeStatus(selectedBooking.id, "거절")}
                          className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#ead7c7] bg-white px-3 text-[13px] font-medium text-[#9a4f1f] transition hover:bg-[#fff7ed]"
                        >
                          예약 거절
                        </button>
                      </div>
                    ) : null}
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
                  <p className="text-[12px] text-[#94a3b8]">직원 코멘트</p>
                  <span className="text-[11px] text-[#94a3b8]">고객 관리 공유</span>
                </div>
                <textarea
                  value={staffComment}
                  onChange={(event) => onChangeStaffComment(commentKey, event.target.value, selectedBooking)}
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
  */
}

type TimeProposalRow = { id: string; start: string; end: string };

const timeProposalDefaultMessage =
  "신청해주신 예약 시간은 매장 사정으로 인해 확정이 어려워, 가능한 다른 시간을 안내드립니다. 아래 추천 시간 중 편하신 일정을 선택해 주세요.";

const cancelDefaultMessage =
  "신청해주신 예약은 매장 사정으로 인해 부득이하게 취소 처리되었습니다. 이용에 불편을 드려 죄송합니다.";

function formatPanelDateLabel(date: string) {
  if (date === currentDateInTimeZone()) return "오늘";
  const [year, month, day] = date.split("-").map(Number);
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

function formatDurationLabel(duration: number) {
  const minutes = Math.round(duration * 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest > 0) return `${hours}시간 ${rest}분`;
  if (hours > 0) return `${hours}시간`;
  return `${rest}분`;
}

type RecentVisitHistoryItem = {
  id: string;
  date: string;
  service: string;
  note: string;
};

function getRecentVisitHistory(data: BootstrapPayload, booking: DailyBooking): RecentVisitHistoryItem[] {
  return data.groomingRecords
    .filter((record) => {
      if (booking.petId && record.pet_id === booking.petId) return true;
      if (booking.guardianId && record.guardian_id === booking.guardianId) return true;
      return false;
    })
    .sort((first, second) => second.groomed_at.localeCompare(first.groomed_at))
    .slice(0, 3)
    .map((record) => {
      const service = data.services.find((item) => item.id === record.service_id);
      return {
        id: record.id,
        date: formatPanelDateLabel(record.groomed_at.slice(0, 10)),
        service: service?.name ?? booking.service,
        note: [record.style_notes, record.memo].map((item) => item?.trim()).filter(Boolean).join(" · "),
      };
    });
}

function getPetProfile(booking: DailyBooking) {
  const biteLevel = normalizePetBiteLevel(booking.petBiteLevel);
  const noteCautions = (booking.petNotes?.trim()
    ? booking.petNotes.split(/[,\n/]+/).map((item) => item.replace(/^고객 입력:\s*/, "").trim()).filter(Boolean)
    : []
  ).slice(0, 3);
  const cautions = [
    biteLevel !== "none" ? `입질 ${getPetBiteLevelLabel(biteLevel)}` : "",
    ...noteCautions,
  ].filter(Boolean);

  return {
    breed: booking.petBreed?.trim() || "견종 미입력",
    age: typeof booking.petAge === "number" && Number.isFinite(booking.petAge) ? `${booking.petAge}세` : "나이 미입력",
    sex: "성별 미입력",
    weight: typeof booking.petWeight === "number" && Number.isFinite(booking.petWeight) ? `${booking.petWeight.toLocaleString("ko-KR")}kg` : "몸무게 미입력",
    biteLevel,
    biteLabel: getPetBiteLevelLabel(biteLevel),
    cautions: cautions.length > 0 ? cautions : ["특이사항 없음"],
  };
}

function getVisitProfile(booking: DailyBooking) {
  const seed = Array.from(booking.pet).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const visits = (seed % 8) + 1;
  return {
    lastVisit: visits > 1 ? "2025.05.02" : "첫 방문",
    visitCount: `${visits}회`,
  };
}

function getGuardianPhone(booking: DailyBooking) {
  const seed = Array.from(booking.customer).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const suffix = String(1000 + (seed % 9000));
  return `010-1234-${suffix}`;
}

function formatPanelPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10 && digits.startsWith("02")) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

function getBookingRequestText(booking: DailyBooking) {
  return getCustomerRequest(booking.id) || "고객 요청사항이 없습니다.";
}

function getAlimtalkResendType(status: string): NotificationType {
  if (status === "진행 중") return "grooming_started";
  if (status === "픽업 준비") return "grooming_almost_done";
  if (status === "완료") return "grooming_completed";
  if (status === "취소") return "booking_cancelled";
  if (status === "거절") return "booking_rejected";
  return "booking_confirmed";
}

function DetailCard({ icon: Icon, title, children, className }: { icon: typeof User; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[8px] border border-[#e2e8f0] bg-white p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#2f7866]" />
        <h4 className="text-[15px] font-semibold text-[#111827]">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function GuardianInfoCard({ name, phone, onCopyPhone }: { name: string; phone: string; onCopyPhone: () => void }) {
  return (
    <DetailCard icon={User} title="보호자 정보">
      <div className="grid grid-cols-[56px_minmax(0,1fr)_112px] items-center gap-x-3 gap-y-2">
        <span className="text-[15px] leading-6 text-[#64748b]">보호자명</span>
        <span className="min-w-0 text-right text-[16px] font-semibold text-[#111827]">{name}</span>
        <span />
        <span className="text-[15px] leading-6 text-[#64748b]">연락처</span>
        <span className="min-w-0 text-right text-[16px] font-semibold leading-6 text-[#111827]">{phone}</span>
        <button
          type="button"
          onClick={onCopyPhone}
          className="inline-flex h-10 items-center justify-center gap-1 rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-[14px] font-medium text-[#334155] hover:bg-[#f8fafc]"
        >
          <Copy className="h-4 w-4 text-[#64748b]" />
          번호 복사
        </button>
      </div>
    </DetailCard>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[14px] leading-6">
      <span className="shrink-0 text-[#64748b]">{label}</span>
      <span className="min-w-0 text-right font-medium text-[#111827]">{value}</span>
    </div>
  );
}

function getTimeWheelParts(value: string) {
  const minutes = timeInputToMinutes(normalizeTwentyFourHourInput(value));
  if (minutes === null) return { hour: "00", minute: "00" };
  return {
    hour: String(Math.floor(minutes / 60)).padStart(2, "0"),
    minute: String(minutes % 60).padStart(2, "0"),
  };
}

function getWheelOffsetValue(values: string[], selectedValue: string, offset: number) {
  const selectedIndex = values.indexOf(selectedValue);
  const baseIndex = selectedIndex >= 0 ? selectedIndex : 0;
  return values[(baseIndex + offset + values.length) % values.length];
}

function TimeWheelInput({
  value,
  onChange,
  ariaLabel,
  editing = false,
  onActivate,
  onCommit,
  onSelectCommit,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  editing?: boolean;
  onActivate?: () => void;
  onCommit?: () => void;
  onSelectCommit?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const selected = getTimeWheelParts(value);
  const active = open || editing;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        onCommit?.();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onCommit, open]);

  const updateTime = (next: { hour?: string; minute?: string }) => {
    const hour = next.hour ?? selected.hour;
    const minute = next.minute ?? selected.minute;
    const nextValue = `${hour}:${minute}`;
    onChange(nextValue);
    return nextValue;
  };

  const selectAndCommit = (next: { hour?: string; minute?: string }) => {
    const nextValue = updateTime(next);
    setOpen(false);
    onSelectCommit?.(nextValue);
  };

  useEffect(() => {
    if (!open || !popupRef.current) return;
    const popup = popupRef.current;

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (Math.abs(event.deltaY) < 1) return;

      const rect = popup.getBoundingClientRect();
      const isHourColumn = event.clientX - rect.left < rect.width / 2;
      const offset = event.deltaY > 0 ? 1 : -1;
      if (isHourColumn) {
        updateTime({ hour: getWheelOffsetValue(timeWheelHours, selected.hour, offset) });
        return;
      }
      updateTime({ minute: getWheelOffsetValue(timeWheelMinutes, selected.minute, offset) });
    };

    popup.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => popup.removeEventListener("wheel", handleNativeWheel);
  }, [open, selected.hour, selected.minute]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => {
          onActivate?.();
          if (open) onCommit?.();
          setOpen((current) => !current);
        }}
        className={cn(
          "h-8 w-full rounded-[7px] border px-2.5 text-left text-[16px] tabular-nums text-[#64748b] outline-none transition",
          active
            ? "border-[#2f7866] bg-white shadow-[0_0_0_2px_rgba(47,120,102,0.08)]"
            : "border-transparent bg-transparent hover:bg-[#f8fafc]",
        )}
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        {value || "00:00"}
      </button>
      {open ? (
        <div
          ref={popupRef}
          className="absolute left-0 top-0 z-50 w-full overflow-hidden rounded-[7px] border border-[#2f7866] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.12)]"
        >
          <div className="relative grid h-[136px] grid-cols-[42px_42px] justify-center gap-1 overflow-hidden bg-white">
            <div className="pointer-events-none absolute inset-x-1 top-1/2 h-8 -translate-y-1/2 rounded-[6px] bg-[#f1f3f5]" />
            <div
              className="pointer-events-none absolute inset-0 z-20"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.72) 18%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.72) 82%, rgba(255,255,255,0.96) 100%)",
              }}
            />
            <WheelTimeColumn
              values={timeWheelHours}
              selectedValue={selected.hour}
              onSelect={(hour, options) => {
                if (options?.commit) {
                  selectAndCommit({ hour });
                  return;
                }
                updateTime({ hour });
              }}
            />
            <WheelTimeColumn
              values={timeWheelMinutes}
              selectedValue={selected.minute}
              onSelect={(minute, options) => {
                if (options?.commit) {
                  selectAndCommit({ minute });
                  return;
                }
                updateTime({ minute });
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WheelTimeColumn({
  values,
  selectedValue,
  onSelect,
}: {
  values: string[];
  selectedValue: string;
  onSelect: (value: string, options?: { commit?: boolean }) => void;
}) {
  const selectedIndex = values.indexOf(selectedValue);
  const dragYRef = useRef<number | null>(null);
  const visibleOffsets = [-2, -1, 0, 1, 2];

  const selectOffset = (offset: number) => {
    onSelect(getWheelOffsetValue(values, selectedValue, offset));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (dragYRef.current === null) return;
    const delta = event.clientY - dragYRef.current;
    if (Math.abs(delta) < 24) return;
    selectOffset(delta > 0 ? -1 : 1);
    dragYRef.current = event.clientY;
  };

  const handlePointerEnd = () => {
    dragYRef.current = null;
  };

  return (
    <div
      className="relative z-10 h-[136px] touch-none select-none overflow-hidden [perspective:220px]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
    >
      {visibleOffsets.map((offset) => {
        const baseIndex = selectedIndex >= 0 ? selectedIndex : 0;
        const item = values[(baseIndex + offset + values.length) % values.length];
        const selected = offset === 0;
        const distance = Math.abs(offset);
        const rowOffset = offset * 24;
        const visual =
          distance === 0
            ? { fontSize: 16, opacity: 1, transform: `translateY(calc(-50% + ${rowOffset}px)) rotateX(0deg)`, color: "#111827", fontWeight: 400 }
            : distance === 1
              ? { fontSize: 15, opacity: 0.82, transform: `translateY(calc(-50% + ${rowOffset}px)) rotateX(${-offset * 12}deg)`, color: "#4b5563", fontWeight: 400 }
              : distance === 2
                ? { fontSize: 14, opacity: 0.62, transform: `translateY(calc(-50% + ${rowOffset}px)) rotateX(${-offset * 16}deg)`, color: "#6b7280", fontWeight: 400 }
                : { fontSize: 13, opacity: 0.42, transform: `translateY(calc(-50% + ${rowOffset}px)) rotateX(${-offset * 20}deg)`, color: "#9aa4b2", fontWeight: 400 };
        return (
          <button
            key={`${item}-${offset}`}
            type="button"
            data-selected={selected}
            onClick={() => {
              const baseIndex = selectedIndex >= 0 ? selectedIndex : 0;
              const nextValue = values[(baseIndex + offset + values.length) % values.length];
              onSelect(nextValue, { commit: true });
            }}
            className="absolute inset-x-0 top-1/2 flex h-8 w-full items-center justify-center tabular-nums transition-[color,opacity,transform,font-size] duration-150"
            style={{ ...visual, transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

function CompactFullInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-start gap-x-2 text-[16px] leading-6">
      <span className="pt-1 text-[#334155]">{label}</span>
      <span className="min-w-0 truncate text-[#64748b]">{value}</span>
    </div>
  );
}

function CompactEditableInfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-start gap-x-2 text-[16px] leading-6">
      <span className="pt-1 text-[#334155]">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CompactReadonlyValue({ children, tabular = false }: { children: ReactNode; tabular?: boolean }) {
  return (
    <span className={cn("flex min-h-8 w-full items-center truncate px-2.5 text-[16px] text-[#64748b]", tabular && "tabular-nums")}>
      {children}
    </span>
  );
}

function PetBiteLevelScale({ level }: { level: PetBiteLevel }) {
  const activeIndexByLevel: Record<PetBiteLevel, number> = {
    none: 0,
    mild: 1,
    watch: 2,
    bite: 3,
    strong: 4,
  };
  const activeIndex = activeIndexByLevel[level];
  const activeColor =
    activeIndex <= 1
      ? "bg-[#2f7866]"
      : activeIndex <= 2
        ? "bg-[#d29a2f]"
        : activeIndex === 3
          ? "bg-[#c66a43]"
          : "bg-[#a04455]";

  return (
    <div className="flex h-6 w-full items-center gap-2" aria-label={`입질 ${getPetBiteLevelLabel(level)}`}>
      <span className="flex h-6 shrink-0 items-center text-[16px] leading-6 text-[#64748b]">입질</span>
      <div className="grid min-w-0 flex-1 grid-cols-5 items-center gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-[7px] rounded-[2px] bg-[#e5eaf0]",
              index === activeIndex && activeColor,
            )}
          />
        ))}
      </div>
    </div>
  );
}

function PetImageBlock({ pet }: { pet: string }) {
  return (
    <div className="flex h-[112px] w-[128px] shrink-0 items-center justify-center rounded-[8px] border border-[#d5dde7] bg-[#f8fafc]">
      <PawPrint className="h-9 w-9 text-[#9aa8ba]" />
      <span className="sr-only">{pet} 이미지</span>
    </div>
  );
}

function MissedStartAlert({
  booking,
  selectedDate,
  currentHour,
  onStart,
}: {
  booking: DailyBooking;
  selectedDate: string;
  currentHour: number;
  onStart: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !isMissedStartBooking(booking, selectedDate, currentHour)) return null;

  const strong = isMissedStartBooking(booking, selectedDate, currentHour, 15);
  return (
    <div className={cn("rounded-[8px] border px-4 py-3", strong ? "border-[#e8c67e] bg-[#fff7ed]" : "border-[#dbe2ea] bg-[#f8fafc]")}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn("mt-0.5 h-5 w-5", strong ? "text-[#b98121]" : "text-[#64748b]")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#e8c67e] bg-white px-2 py-0.5 text-[12px] font-medium text-[#9a640f]">시작 확인 필요</span>
            <p className="text-[14px] font-medium text-[#111827]">
              {strong
                ? `${booking.pet} 예약의 미용 시작 처리가 아직 되지 않았습니다.`
                : `${booking.pet} 예약 시간이 지났습니다.`}
            </p>
          </div>
          <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
            {strong
              ? "진행 상태를 확인해 주세요."
              : `미용을 시작했다면 '미용 시작하기'를 눌러주세요.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onStart} className="h-9 rounded-[8px] bg-[#2f7866] px-3 text-[13px] font-medium text-white">
              미용 시작하기
            </button>
            <button type="button" onClick={() => setDismissed(true)} className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-medium text-[#334155]">
              나중에
            </button>
          </div>
          {/* TODO: 시작 알림 사용 여부, 1차/2차 알림 시간, 자동 시작 처리 기본 OFF 설정을 매장 설정에 연결합니다. */}
        </div>
      </div>
    </div>
  );
}

function PersistentBookingPanelHero({
  booking,
  timeRange,
  isPending,
  startEnabled,
  finalActionEnabled,
  finalActionStatus,
  finalActionLabel,
  pendingOverlapLabel,
  onChangeStatus,
  onSuggestAlternativeTime,
}: {
  booking: DailyBooking;
  timeRange: string;
  isPending: boolean;
  startEnabled: boolean;
  finalActionEnabled: boolean;
  finalActionStatus: string;
  finalActionLabel: string;
  pendingOverlapLabel: string;
  onChangeStatus: (bookingId: string, nextStatus: string) => void;
  onSuggestAlternativeTime: (bookingId: string) => void;
}) {
  const profile = getPetProfile(booking);
  const statusClass = isPending
    ? "border-[#e8c67e] bg-[#fff7ed] text-[#9a640f]"
    : "border-[#b7d8cd] bg-[#eef8f4] text-[#1f6b5b]";

  return (
    <div className="border-b border-[#edf2f7] pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className={cn("inline-flex rounded-full border px-3 py-1.5 text-[15px] font-medium", statusClass)}>
            {isPending ? "승인대기 예약" : "예약 확정"}
          </span>
          {pendingOverlapLabel ? (
            <span className="ml-2 inline-flex rounded-full border border-[#e8c67e] bg-[#fffaf0] px-3 py-1.5 text-[13px] font-medium text-[#9a640f]">
              {pendingOverlapLabel}
            </span>
          ) : null}
          <p className="mt-3 text-[20px] font-semibold leading-7 tracking-[-0.02em] text-[#111827]">
            오늘 {timeRange} <span className="text-[14px] font-normal text-[#64748b]">(예상)</span>
          </p>
          <p className="mt-2 text-[17px] font-semibold leading-6 text-[#111827]">
            {booking.pet} · {profile.breed} · {profile.weight}
          </p>
          <p className="mt-1 text-[15px] font-medium text-[#334155]">{booking.service}</p>
        </div>
        <PetImageBlock pet={booking.pet} />
      </div>

      {isPending ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onChangeStatus(booking.id, "확정")}
            className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#b98121] px-2 text-[14px] font-semibold text-white transition hover:bg-[#9a640f]"
          >
            예약 확정
          </button>
          <button
            type="button"
            onClick={() => onSuggestAlternativeTime(booking.id)}
            className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-[13px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
          >
            다른 시간 제안
          </button>
          <button
            type="button"
            onClick={() => onChangeStatus(booking.id, "거절")}
            className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#ead6dc] bg-white px-2 text-[13px] font-medium text-[#8f2438] transition hover:bg-[#fffafa]"
          >
            예약 취소
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={!startEnabled && !finalActionEnabled}
            onClick={() => {
              if (startEnabled) onChangeStatus(booking.id, "진행 중");
              else if (finalActionEnabled) onChangeStatus(booking.id, finalActionStatus);
            }}
            className={cn(
              "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] px-3 text-[16px] font-semibold transition",
              startEnabled || finalActionEnabled
                ? "bg-[#2f7866] text-white shadow-[0_10px_20px_rgba(47,120,102,0.16)] hover:bg-[#286a5a]"
                : "cursor-not-allowed bg-[#f1f5f9] text-[#94a3b8]",
            )}
          >
            {startEnabled ? <Play className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
            {startEnabled ? "미용 시작하기" : finalActionLabel}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onSuggestAlternativeTime(booking.id)} className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]">
              예약 변경
            </button>
            <button type="button" onClick={() => onChangeStatus(booking.id, "거절")} className="h-10 rounded-[8px] border border-[#ead6dc] bg-white text-[13px] font-medium text-[#8f2438] hover:bg-[#fffafa]">
              예약 취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReservationDetailSheet({
  booking,
  selectedDate,
  currentHour,
  staffComments,
  onClose,
  onChangeStatus,
  onChangeStaffComment,
}: {
  booking: DailyBooking;
  selectedDate: string;
  currentHour: number;
  staffComments: Record<string, string>;
  onClose: () => void;
  onChangeStatus: (bookingId: string, nextStatus: string) => void;
  onChangeStaffComment: (commentKey: string, value: string, booking?: DailyBooking) => void;
}) {
  const sourceStatus = booking.sourceStatus ?? booking.status;
  const isPending = isPendingBookingStatus(sourceStatus);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/10" onClick={onClose}>
      <aside
        className="h-full w-full max-w-[760px] overflow-y-auto border-l border-[#dbe2ea] bg-white shadow-[-24px_0_60px_rgba(15,23,42,0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e2e8f0] bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-[13px] font-medium text-[#64748b]">예약 작업 패널</p>
            <h3 className="mt-0.5 text-[20px] font-semibold text-[#111827]">{booking.pet} · {booking.customer}</h3>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f1f5f9]" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {isPending ? (
            <PendingReservationDetail
              booking={booking}
              selectedDate={selectedDate}
              staffComments={staffComments}
              onChangeStatus={onChangeStatus}
              onChangeStaffComment={onChangeStaffComment}
            />
          ) : (
            <ConfirmedReservationDetail
              booking={booking}
              selectedDate={selectedDate}
              currentHour={currentHour}
              staffComments={staffComments}
              onChangeStatus={onChangeStatus}
              onChangeStaffComment={onChangeStaffComment}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function ConfirmedReservationDetail({
  booking,
  selectedDate,
  currentHour,
  staffComments,
  onChangeStatus,
  onChangeStaffComment,
}: {
  booking: DailyBooking;
  selectedDate: string;
  currentHour: number;
  staffComments: Record<string, string>;
  onChangeStatus: (bookingId: string, nextStatus: string) => void;
  onChangeStaffComment: (commentKey: string, value: string, booking?: DailyBooking) => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const profile = getPetProfile(booking);
  const visits = getVisitProfile(booking);
  const phone = getGuardianPhone(booking);
  const commentKey = getCustomerCommentKey(booking);
  const staffComment = getStaffCommentValue(staffComments, booking);
  const sourceStatus = booking.sourceStatus ?? booking.status;
  const timeRange = `${formatHourLabel(booking.start)} - ${formatHourLabel(booking.start + booking.duration)}`;
  const canStart = canStartGrooming(sourceStatus);
  const canComplete = sourceStatus === "진행 중" || booking.status === "진행 중";
  const canFinish = sourceStatus === "픽업 준비";
  const completed = isCompletedBookingStatus(sourceStatus) || isCompletedBookingStatus(booking.status);

  return (
    <>
      <MissedStartAlert booking={booking} selectedDate={selectedDate} currentHour={currentHour} onStart={() => onChangeStatus(booking.id, "진행 중")} />
      <section className="rounded-[8px] border border-[#dbe2ea] bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className={cn("inline-flex rounded-full border px-3 py-1.5 text-[15px] font-medium", getReservationStatusPillClass(booking, selectedDate, currentHour))}>
              {isMissedStartBooking(booking, selectedDate, currentHour) ? "시작 확인 필요" : "예약 확정"}
            </span>
            <p className="mt-3 text-[26px] font-semibold tracking-[-0.03em] text-[#111827]">{formatPanelDateLabel(selectedDate)} {timeRange}</p>
            <p className="mt-2 text-[20px] font-semibold text-[#111827]">{booking.pet} · {profile.breed} · {profile.weight}</p>
            <p className="mt-1 text-[16px] font-medium text-[#334155]">{booking.service}</p>
          </div>
          <PetImageBlock pet={booking.pet} />
        </div>

        <div className="mt-5">
          {canStart ? (
            <button type="button" onClick={() => onChangeStatus(booking.id, "진행 중")} className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#2f7866] text-[18px] font-semibold text-white shadow-[0_10px_20px_rgba(47,120,102,0.16)] hover:bg-[#286a5a]">
              <Play className="h-5 w-5" />
              미용 시작하기
            </button>
          ) : canComplete ? (
            <button type="button" onClick={() => onChangeStatus(booking.id, "픽업 준비")} className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#1f6b5b] text-[18px] font-semibold text-white shadow-[0_10px_20px_rgba(31,107,91,0.16)] hover:bg-[#185848]">
              <Scissors className="h-5 w-5" />
              미용 완료하기
            </button>
          ) : canFinish ? (
            <button type="button" onClick={() => onChangeStatus(booking.id, "완료")} className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#2f7866] text-[18px] font-semibold text-white shadow-[0_10px_20px_rgba(47,120,102,0.16)] hover:bg-[#286a5a]">
              <CheckCircle2 className="h-5 w-5" />
              완료 처리하기
            </button>
          ) : completed ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="h-11 rounded-[8px] bg-[#2f7866] text-[14px] font-medium text-white">완료 내역 보기</button>
              <button type="button" className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium text-[#334155]">다음 예약 등록</button>
            </div>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
          <button type="button" className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium text-[#334155]">예약 변경</button>
          <button type="button" onClick={() => setCancelOpen(true)} className="h-10 rounded-[8px] border border-[#ead6dc] bg-white text-[14px] font-medium text-[#8f2438]">예약 취소</button>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b]" aria-label="더보기">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </section>

      <ReservationInfoSections
        booking={booking}
        profile={profile}
        visits={visits}
        phone={phone}
        staffComment={staffComment}
        onCopyPhone={() => void navigator.clipboard?.writeText(phone)}
        onChangeStaffComment={(value) => onChangeStaffComment(commentKey, value, booking)}
      />

      {cancelOpen ? (
        <CancelReservationDialog
          onClose={() => setCancelOpen(false)}
          onConfirm={() => {
            onChangeStatus(booking.id, "취소");
            setCancelOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function PendingReservationDetail({
  booking,
  selectedDate,
  staffComments,
  onChangeStatus,
  onChangeStaffComment,
}: {
  booking: DailyBooking;
  selectedDate: string;
  staffComments: Record<string, string>;
  onChangeStatus: (bookingId: string, nextStatus: string) => void;
  onChangeStaffComment: (commentKey: string, value: string, booking?: DailyBooking) => void;
}) {
  const [proposalOpen, setProposalOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const profile = getPetProfile(booking);
  const visits = getVisitProfile(booking);
  const phone = getGuardianPhone(booking);
  const commentKey = getCustomerCommentKey(booking);
  const staffComment = getStaffCommentValue(staffComments, booking);
  const timeRange = `${formatHourLabel(booking.start)} - ${formatHourLabel(booking.start + booking.duration)}`;

  return (
    <>
      <section className="rounded-[8px] border border-[#ead7c7] bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex rounded-full border border-[#e8c67e] bg-[#fff7ed] px-3 py-1.5 text-[15px] font-medium text-[#9a640f]">승인대기 예약</span>
            <p className="mt-3 text-[15px] font-medium text-[#9a640f]">고객이 예약 확정을 기다리는 중입니다.</p>
            <p className="mt-3 text-[26px] font-semibold tracking-[-0.03em] text-[#111827]">{formatPanelDateLabel(selectedDate)} {timeRange}</p>
            <p className="mt-2 text-[20px] font-semibold text-[#111827]">{booking.pet} · {profile.breed} · {profile.weight}</p>
            <p className="mt-1 text-[16px] font-medium text-[#334155]">{booking.service}</p>
          </div>
          <PetImageBlock pet={booking.pet} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onChangeStatus(booking.id, "확정")} className="col-span-2 min-h-[56px] rounded-[8px] bg-[#b98121] text-[18px] font-semibold text-white shadow-[0_10px_20px_rgba(185,129,33,0.16)] hover:bg-[#9a640f]">
            예약 확정
          </button>
          <button type="button" onClick={() => setProposalOpen((current) => !current)} className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium text-[#334155]">
            다른 시간 제안
          </button>
          <button type="button" onClick={() => setCancelOpen(true)} className="h-11 rounded-[8px] border border-[#f2b8b8] bg-white text-[14px] font-medium text-[#b42318]">
            예약 취소
          </button>
        </div>
      </section>

      {proposalOpen ? (
        <TimeProposalForm booking={booking} onClose={() => setProposalOpen(false)} />
      ) : null}

      <ReservationInfoSections
        booking={booking}
        profile={profile}
        visits={visits}
        phone={phone}
        staffComment={staffComment}
        onCopyPhone={() => void navigator.clipboard?.writeText(phone)}
        onChangeStaffComment={(value) => onChangeStaffComment(commentKey, value, booking)}
      />

      {cancelOpen ? (
        <CancelReservationDialog
          onClose={() => setCancelOpen(false)}
          onConfirm={() => {
            onChangeStatus(booking.id, "거절");
            setCancelOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function ReservationInfoSections({
  booking,
  profile,
  visits,
  phone,
  staffComment,
  onCopyPhone,
  onChangeStaffComment,
}: {
  booking: DailyBooking;
  profile: ReturnType<typeof getPetProfile>;
  visits: ReturnType<typeof getVisitProfile>;
  phone: string;
  staffComment: string;
  onCopyPhone: () => void;
  onChangeStaffComment: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <GuardianInfoCard name={booking.customer} phone={phone} onCopyPhone={onCopyPhone} />

      <DetailCard icon={PawPrint} title="반려동물 정보">
        <div className="space-y-1.5">
          <InfoRow label="이름" value={booking.pet} />
          <InfoRow label="견종" value={profile.breed} />
          <InfoRow label="나이" value={profile.age} />
          <InfoRow label="성별" value={profile.sex} />
          <InfoRow label="몸무게" value={profile.weight} />
          <InfoRow label="입질 정도" value={profile.biteLabel} />
        </div>
      </DetailCard>

      <DetailCard icon={ClipboardList} title="서비스 정보">
        <div className="space-y-1.5">
          <InfoRow label="서비스명" value={booking.service.split("+")[0]?.trim() || booking.service} />
          <InfoRow label="옵션" value={booking.service.includes("+") ? booking.service.split("+").slice(1).join("+").trim() : "옵션 없음"} />
          <InfoRow label="예상 소요시간" value={formatDurationLabel(booking.duration)} />
        </div>
      </DetailCard>

      <DetailCard icon={MessageCircle} title="고객 요청사항">
        <p className="min-h-[48px] whitespace-pre-wrap text-[14px] leading-6 text-[#111827]">{getBookingRequestText(booking)}</p>
      </DetailCard>

      <DetailCard icon={NotebookPen} title="내부 메모">
        <textarea
          value={staffComment}
          onChange={(event) => onChangeStaffComment(event.target.value)}
          placeholder="오너/직원만 보는 메모를 입력해 주세요."
          className="min-h-[74px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2 text-[14px] leading-6 text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
        />
        <button type="button" className="mt-2 h-8 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[12px] font-medium text-[#334155]">메모 수정</button>
      </DetailCard>

      <DetailCard icon={History} title="방문 이력">
        <div className="space-y-1.5">
          <InfoRow label="최근 방문일" value={visits.lastVisit} />
          <InfoRow label="누적 방문" value={visits.visitCount} />
        </div>
      </DetailCard>

      <DetailCard icon={ShieldAlert} title="주의사항">
        <div className="flex flex-wrap gap-2">
          {profile.cautions.map((item) => (
            <span key={item} className="rounded-[7px] border border-[#e5d8f3] bg-[#faf5ff] px-2.5 py-1 text-[13px] font-medium text-[#6b4a8f]">
              {item}
            </span>
          ))}
        </div>
      </DetailCard>
    </div>
  );
}

function TimeProposalForm({ booking, onClose }: { booking: DailyBooking; onClose: () => void }) {
  const [rows, setRows] = useState<TimeProposalRow[]>(() => [
    {
      id: "proposal-1",
      start: formatHourLabel(Math.min(booking.start + 1, scheduleEndHour - booking.duration)),
      end: formatHourLabel(Math.min(booking.start + 1 + booking.duration, scheduleEndHour)),
    },
  ]);
  const [message, setMessage] = useState(timeProposalDefaultMessage);
  const [sent, setSent] = useState(false);
  const currentTime = `${formatHourLabel(booking.start)} - ${formatHourLabel(booking.start + booking.duration)}`;

  function updateRow(id: string, key: "start" | "end", value: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  }

  return (
    <section className="rounded-[8px] border border-[#e8c67e] bg-[#fffaf0] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[16px] font-semibold text-[#111827]">다른 시간 제안</h4>
          <p className="mt-1 text-[13px] text-[#64748b]">기존 신청 시간: {currentTime}</p>
        </div>
        <button type="button" onClick={onClose} className="text-[13px] font-medium text-[#64748b]">취소</button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row, index) => (
          <div key={row.id} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
            <span className="text-[13px] font-medium text-[#64748b]">{index + 1}</span>
            <input type="time" value={row.start} onChange={(event) => updateRow(row.id, "start", event.target.value)} className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px]" />
            <input type="time" value={row.end} onChange={(event) => updateRow(row.id, "end", event.target.value)} className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px]" />
          </div>
        ))}
      </div>
      {rows.length < 3 ? (
        <button
          type="button"
          onClick={() => setRows((current) => [...current, { id: `proposal-${current.length + 1}`, start: current[current.length - 1]?.start ?? "14:00", end: current[current.length - 1]?.end ?? "15:00" }])}
          className="mt-2 h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-medium text-[#334155]"
        >
          추천 시간 추가
        </button>
      ) : null}

      <label className="mt-4 block space-y-1.5">
        <span className="text-[13px] font-medium text-[#64748b]">고객 안내 메시지</span>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-[96px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] leading-6 text-[#111827]" />
      </label>
      <button
        type="button"
        onClick={() => {
          // TODO: time_proposed 상태 전환 API가 준비되면 추천 시간과 메시지를 함께 저장/발송합니다.
          setSent(true);
        }}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#b98121] text-[15px] font-semibold text-white"
      >
        <Send className="h-4 w-4" />
        제안 보내기
      </button>
      {sent ? <p className="mt-2 text-[13px] font-medium text-[#9a640f]">제안 보내기 mock 처리 완료. API 연결 전까지 화면 상태만 확인합니다.</p> : null}
    </section>
  );
}

function CancelReservationDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [reason, setReason] = useState("매장 일정상 어려움");
  const [message, setMessage] = useState(cancelDefaultMessage);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 px-4" onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-[12px] border border-[#ead6dc] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-[22px] font-semibold text-[#111827]">예약을 취소하시겠어요?</h3>
        <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
          이 예약은 고객에게 취소 안내가 발송됩니다. 다른 시간으로 받을 수 있다면 ‘다른 시간 제안’을 이용해 주세요.
        </p>
        <label className="mt-4 block space-y-1.5">
          <span className="text-[13px] font-medium text-[#64748b]">취소 사유</span>
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] text-[#111827]">
            <option>매장 일정상 어려움</option>
            <option>서비스 제공이 어려움</option>
            <option>고객 요청 취소</option>
            <option>기타</option>
          </select>
        </label>
        <label className="mt-3 block space-y-1.5">
          <span className="text-[13px] font-medium text-[#64748b]">고객 안내 메시지</span>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-[96px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2 text-[14px] leading-6 text-[#111827]" />
        </label>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium text-[#334155]">닫기</button>
          <button type="button" onClick={onConfirm} className="h-11 rounded-[8px] bg-[#a04455] text-[14px] font-semibold text-white">취소 안내 보내기</button>
        </div>
        <p className="mt-2 text-[12px] text-[#94a3b8]">선택 사유: {reason}</p>
      </div>
    </div>
  );
}

function PhotoStatusDialog({
  action,
  onClose,
  onSubmit,
  onSkip,
}: {
  action: PhotoStatusAction;
  onClose: () => void;
  onSubmit: (file: File) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mobileOwnerPath = `/owner/mobile?appointmentId=${encodeURIComponent(action.bookingId)}&statusAction=${encodeURIComponent(action.nextStatus)}`;
  const mobileOwnerUrl = typeof window === "undefined" ? mobileOwnerPath : `${window.location.origin}${mobileOwnerPath}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=176x176&margin=12&data=${encodeURIComponent(mobileOwnerUrl)}`;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file || saving) return;

    setSaving(true);
    setError("");
    try {
      await onSubmit(file);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "사진 저장 중 문제가 발생했습니다.");
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  async function handleSkip() {
    if (saving) return;

    setSaving(true);
    setError("");
    try {
      await onSkip();
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : "상태 변경 중 문제가 발생했습니다.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/30 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[392px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />

        <div className="rounded-[10px] bg-[#fbfcfd] p-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-[#2f7866]" />
            <p className="text-[15px] font-medium text-[#111827]">모바일로 촬영하기</p>
          </div>
          <div className="mt-3 flex justify-center rounded-[10px] bg-white p-3">
            <img src={qrImageUrl} alt="모바일 오너 촬영 QR 코드" className="h-[176px] w-[176px]" />
          </div>
          <p className="mt-3 text-center text-[13px] leading-5 text-[#64748b]">
            휴대폰으로 QR을 스캔해 사진을 촬영하고 미용 완료를 처리하세요.
          </p>
        </div>

        {error ? (
          <p className="mt-3 rounded-[8px] border border-[#f3c7c7] bg-[#fffafa] px-3 py-2 text-[13px] leading-5 text-[#b42318]">
            {error}
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={saving}
            className="inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[#1f6b5b] px-3 text-[15px] text-white hover:bg-[#185848] disabled:opacity-60"
          >
            {saving ? "처리 중" : "사진 없이 미용 완료"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] text-[#334155] hover:bg-[#f8fafc] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              사진 선택
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] text-[#334155] hover:bg-[#f8fafc] disabled:opacity-60"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlternativeTimeGuideDialog({
  booking,
  shopId,
  selectedDate,
  onClose,
}: {
  booking: DailyBooking;
  shopId: string;
  selectedDate: string;
  onClose: () => void;
}) {
  const suggestedStarts = [booking.start + 0.5, booking.start + 1, booking.start + 1.5]
    .filter((start) => start + booking.duration <= scheduleEndHour)
    .slice(0, 3);
  const [selectedStarts, setSelectedStarts] = useState<number[]>(() => suggestedStarts.slice(0, 2));
  const [message, setMessage] = useState(timeProposalDefaultMessage);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const selectedTimeLabels = selectedStarts.map((start) => `${formatHourLabel(start)}-${formatHourLabel(start + booking.duration)}`);
  const proposalMessage = [
    `[${booking.pet} 예약 시간 안내]`,
    "",
    message.trim(),
    "",
    "신청 시간",
    `${formatScheduleDateLabel(selectedDate)} · ${formatHourLabel(booking.start)}-${formatHourLabel(booking.start + booking.duration)}`,
    "",
    "추천 시간",
    ...selectedTimeLabels.map((item, index) => `${index + 1}. ${item}`),
  ]
    .filter(Boolean)
    .join("\n");

  function toggleSuggestedStart(start: number) {
    setSent(false);
    setError("");
    setSelectedStarts((current) => {
      if (current.includes(start)) return current.filter((item) => item !== start);
      if (current.length >= 3) return current;
      return [...current, start].sort((first, second) => first - second);
    });
  }

  async function sendProposal() {
    if (selectedStarts.length === 0) {
      setError("추천 시간을 1개 이상 선택해 주세요.");
      return;
    }

    setSending(true);
    setSent(false);
    setError("");

    try {
      await fetchApiJsonWithAuth("/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          appointmentId: booking.id,
          type: "booking_time_proposed",
          channel: "alimtalk",
          message: proposalMessage,
          metadata: {
            proposalDate: selectedDate,
            proposalTimes: selectedTimeLabels.join(", "),
            source: "owner_schedule_board",
          },
          force: true,
        }),
      });
      setSent(true);
    } catch (sendError) {
      setError(getApiErrorMessage(sendError, "다른 시간 제안 알림톡 발송에 실패했습니다."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[420px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#64748b]">예약 응대</p>
            <h3 className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">다른 시간 안내</h3>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
              {booking.pet} · {booking.customer} 예약에 안내할 후보 시간을 고릅니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-[8px] border border-[#edf2f7] bg-[#f8fafc] px-3 py-3">
          <p className="text-[12px] text-[#94a3b8]">기존 신청</p>
          <p className="mt-1 text-[17px] font-medium tabular-nums text-[#111827]">
            {formatScheduleDateLabel(selectedDate)} · {formatHourLabel(booking.start)}-{formatHourLabel(booking.start + booking.duration)}
          </p>
          <p className="mt-1 text-[13px] text-[#64748b]">{booking.service}</p>
        </div>

        <div className="mt-4">
          <p className="text-[13px] font-medium text-[#111827]">추천 시간</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {suggestedStarts.length > 0 ? (
              suggestedStarts.map((start) => (
                <button
                  key={start}
                  type="button"
                  onClick={() => toggleSuggestedStart(start)}
                  className={cn(
                    "inline-flex h-11 items-center justify-center rounded-[8px] border px-2 text-[13px] font-medium tabular-nums transition",
                    selectedStarts.includes(start)
                      ? "border-[#b98121] bg-[#fff7ed] text-[#9a640f]"
                      : "border-[#dbe2ea] bg-white text-[#334155] hover:bg-[#f8fafc]",
                  )}
                >
                  {formatHourLabel(start)}-{formatHourLabel(start + booking.duration)}
                </button>
              ))
            ) : (
              <p className="col-span-3 rounded-[8px] border border-dashed border-[#dbe2ea] bg-[#f8fafc] px-3 py-3 text-center text-[13px] text-[#94a3b8]">
                오늘 남은 추천 시간이 없습니다.
              </p>
            )}
          </div>
        </div>

        <label className="mt-4 block space-y-1.5">
          <span className="text-[13px] font-medium text-[#111827]">고객 안내 문구</span>
          <textarea
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setSent(false);
              setError("");
            }}
            className="min-h-[120px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2 text-[14px] leading-6 text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-[8px] border border-[#f3c7c7] bg-[#fffafa] px-3 py-2 text-[13px] leading-5 text-[#b42318]">
            {error}
          </p>
        ) : null}
        {sent ? (
          <p className="mt-3 rounded-[8px] border border-[#d8eadf] bg-[#f3fbf8] px-3 py-2 text-[13px] leading-5 text-[#1f6b5b]">
            추천 시간 안내 알림톡 발송을 요청했습니다.
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={sendProposal}
            disabled={sending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#1f6b5b] px-3 text-[14px] font-medium text-white transition hover:bg-[#185848] disabled:cursor-wait disabled:opacity-70"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            알림톡 보내기
          </button>
        </div>
      </div>
    </div>
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
    : "가능한 시간은 고객 예약 즉시 확정되고, 예약에 바로 반영됩니다.";
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
                      const timeRange = `${formatHourLabel(booking.start)} - ${formatHourLabel(booking.start + booking.duration)}`;

                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => onSelectBooking(booking.id)}
                          className={cn(
                            "group relative flex w-full items-center border-b border-[#edf2f7] py-2.5 pl-4 pr-3 text-left transition last:border-b-0 hover:bg-[#fffdf2]",
                            selected && "bg-[#fff8dc]",
                            getWrapIndicatorClass("amber"),
                          )}
                        >
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
                  확정된 예약은 예약 보드에서 초록 카드로 표시됩니다. 미용 시작, 시간 이동, 취소 처리는 예약 현황 카드에서 진행합니다.
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
      description: "고객 예약은 승인 대기로 들어오고, 오너가 확정해야 예약에 반영됩니다.",
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
  shop,
  selectedDate,
  staff,
  visibleStaff,
  onDateChange,
  onStaffChange,
  onAddSchedule,
}: {
  shop: BootstrapPayload["shop"];
  selectedDate: string;
  staff: StaffFilter;
  visibleStaff: OwnerWebStaffColumn[];
  onDateChange: (date: string) => void;
  onStaffChange: (staff: StaffFilter) => void;
  onAddSchedule: () => void;
}) {
  const singleStaff = visibleStaff.length <= 1;
  const staffLabel = singleStaff
    ? visibleStaff[0]?.name ?? "담당 없음"
    : staff === "전체 직원"
      ? "전체 직원"
      : visibleStaff.find((item) => item.key === staff)?.name ?? "전체 직원";

  return (
    <div className="border-b border-[#e2e8f0] px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, -1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="이전 날짜"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDateChange(currentDateInTimeZone())}
            className="inline-flex min-w-[178px] items-center justify-center rounded-[8px] px-2 text-[17px] font-medium text-[#111827] hover:bg-[#f8fafc]"
          >
            {formatSchedulePickerRelativeLabel(selectedDate, shop)}
          </button>
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="다음 날짜"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {singleStaff ? (
            <div className="inline-flex h-9 w-[152px] items-center justify-between rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] text-[#0f172a]">
              <span className="text-[16px] text-[#64748b]">담당</span>
              <span className="truncate font-normal">{staffLabel}</span>
            </div>
          ) : (
            <SoftSelect<StaffFilter>
              label="담당"
              value={staff}
              onChange={onStaffChange}
              options={[
                { value: "전체 직원", label: "전체 직원" },
                ...visibleStaff.map((option) => ({ value: option.key, label: option.name })),
              ]}
              className="w-[152px]"
              buttonClassName="h-9"
              labelClassName="text-[16px]"
              valueClassName="text-[16px] font-normal"
              menuClassName="w-[152px] min-w-0"
            />
          )}
          <button
            type="button"
            onClick={onAddSchedule}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-[#1f6b5b] px-4 text-[14px] font-medium text-white transition hover:bg-[#185848]"
          >
            <CalendarPlus className="h-4 w-4" />
            예약 추가
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
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
      <div className="flex shrink-0 bg-white">
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
              const selectedStaff = selectedStaffKey === staffMember.key;

              return (
                <section
                  key={staffMember.key}
                  onClick={() => onSelectStaff(staffMember.key)}
                  className={cn(
                    "min-w-0 cursor-pointer rounded-t-[8px] border border-b-0 px-3 py-2 transition",
                    selectedStaff
                      ? "border-[#b9d1ca] bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                      : "border-transparent bg-[#f3f4f6] hover:bg-[#eef1f4]",
                  )}
                  style={{ flex: columnFlexBasis }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("truncate text-[14px] font-medium", selectedStaff ? "text-[#1f6b5b]" : "text-[#111827]")}>
                          {staffMember.name}
                        </p>
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
          "min-h-0 flex-1 overflow-y-auto select-none",
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
              {scheduleStaff.length === 0 ? (
                <section className="flex min-h-[360px] flex-1 items-center justify-center rounded-b-[8px] bg-[#f8fafc]">
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
                      "min-w-0 cursor-pointer rounded-b-[8px] bg-[#f3f4f6] p-0 transition",
                      selectedStaff && "ring-1 ring-inset ring-[#2f7866]/20",
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
                                    <div className="col-span-2 flex min-w-0 items-center gap-1.5">
                                      <span className={cn("shrink-0 rounded-[6px] border px-1.5 py-0.5 text-[11px] leading-none", statusPillClass)}>
                                        {statusLabel}
                                      </span>
                                      {pendingOverlapLabel ? (
                                        <span className="shrink-0 rounded-[6px] border border-[#e8c67e] bg-[#fffaf0] px-1.5 py-0.5 text-[11px] leading-none text-[#9a640f]">
                                          겹침
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
        ? "bg-[#f8eef1] text-[#8f2438]"
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
                      getWrapIndicatorClass(getBookingIndicatorTone(getBookingCardTone(booking.status))),
                    )}
                  >
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
                      {(() => {
                        const tone = getBookingCardTone(booking.status);
                        return (
                          <>
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
        <span className="inline-flex items-center gap-1"><span className={getMiniWrapIndicatorClass("teal")} />예약 많음</span>
        <span className="inline-flex items-center gap-1"><span className={getMiniWrapIndicatorClass("neutral")} />예약 있음</span>
        <span className="inline-flex items-center gap-1"><span className={getMiniWrapIndicatorClass("amber")} />승인 대기</span>
        <span className="inline-flex items-center gap-1"><span className={getMiniWrapIndicatorClass("burgundy")} />변경/취소</span>
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
                {counts.changes > 0 ? <p className="truncate text-[11px] text-[#8f2438]">변경/취소 {counts.changes}건</p> : null}
              </div>
              <div className="mt-3 flex gap-1">
                {counts.pending > 0 ? <span className={getMiniWrapIndicatorClass("amber")} /> : null}
                {counts.changes > 0 ? <span className={getMiniWrapIndicatorClass("burgundy")} /> : null}
                {counts.completed > 0 ? <span className={getMiniWrapIndicatorClass("slate")} /> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildDefaultScheduleForm(data: BootstrapPayload, visibleStaff: OwnerWebStaffColumn[], selectedDate: string, staff: StaffFilter): ScheduleCreateFormState {
  const initialStaff = staff === "전체 직원" ? visibleStaff[0] : visibleStaff.find((item) => item.key === staff) ?? visibleStaff[0];
  return {
    customerMode: "new",
    petId: data.pets[0]?.id ?? "",
    customerName: "",
    petName: "",
    customerPhone: "",
    serviceId: data.services.find((service) => service.is_active)?.id ?? data.services[0]?.id ?? "",
    staffKey: initialStaff?.key ?? "",
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

async function patchOwnerAppointmentStatus(payload: unknown) {
  try {
    return await fetchApiJsonWithAuth<Appointment>("/api/appointments", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Supabase 연결") || message.includes("로그인이 필요")) {
      return fetchApiJson<Appointment>("/api/appointments", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    }
    throw error;
  }
}

async function patchOwnerPetStaffNote(payload: unknown) {
  try {
    return await fetchApiJsonWithAuth<PetStaffNote>("/api/pet-staff-notes", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Supabase 연결") || message.includes("로그인이 필요")) {
      return fetchApiJson<PetStaffNote>("/api/pet-staff-notes", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    }
    throw error;
  }
}

async function fetchOwnerScheduleRange(shopId: string, from: string, to: string) {
  const path = `/api/owner/schedule?${new URLSearchParams({ shopId, from, to }).toString()}`;
  try {
    return await fetchApiJsonWithAuth<OwnerScheduleRangeResponse>(path, {
      method: "GET",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Supabase 연결") || message.includes("로그인이 필요")) {
      return fetchApiJson<OwnerScheduleRangeResponse>(path, {
        method: "GET",
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

async function patchOwnerGuardian(payload: unknown) {
  try {
    return await fetchApiJsonWithAuth<Guardian>("/api/guardians", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Supabase 연결") || message.includes("로그인이 필요")) {
      return fetchApiJson<Guardian>("/api/guardians", {
        method: "PATCH",
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

async function postOwnerService(payload: unknown) {
  try {
    return await fetchApiJsonWithAuth<Service>("/api/services", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Supabase 연결") || message.includes("로그인이 필요")) {
      return fetchApiJson<Service>("/api/services", {
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

function formatSchedulePhone(value: string) {
  const digits = normalizeSchedulePhone(value);
  if (!digits) return "";

  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
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
  staffId?: string | null;
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
    staff_id: params.staffId ?? null,
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

function replaceAppointmentInBootstrap(data: BootstrapPayload, appointment: Appointment): BootstrapPayload {
  return {
    ...data,
    appointments: data.appointments.map((item) => (item.id === appointment.id ? { ...item, ...appointment } : item)),
  };
}

function getAppointmentCustomServiceId(appointmentId: string) {
  return `appointment-${appointmentId}-service`;
}

function replaceScheduleRangeInBootstrap(data: BootstrapPayload, range: OwnerScheduleRangeResponse): BootstrapPayload {
  const isAppointmentInRange = (appointment: Appointment) =>
    appointment.appointment_date >= range.from && appointment.appointment_date <= range.to;
  const isGroomingRecordInRange = (record: BootstrapPayload["groomingRecords"][number]) => {
    const recordDate = record.groomed_at.slice(0, 10);
    return recordDate >= range.from && recordDate <= range.to;
  };
  const notificationIds = new Set(range.notifications.map((item) => item.id));

  return {
    ...data,
    appointments: [
      ...data.appointments.filter((item) => !isAppointmentInRange(item)),
      ...range.appointments,
    ],
    groomingRecords: [
      ...data.groomingRecords.filter((item) => !isGroomingRecordInRange(item)),
      ...range.groomingRecords,
    ],
    notifications: [
      ...range.notifications,
      ...data.notifications.filter((item) => !notificationIds.has(item.id)),
    ]
      .sort((first, second) => (second.sent_at ?? second.created_at).localeCompare(first.sent_at ?? first.created_at))
      .slice(0, 200),
  };
}

function getAppointmentStatusFromBookingStatus(status: string) {
  return bookingStatusToAppointmentStatus[status] ?? null;
}

type ScheduleDropdownOption = {
  value: string;
  label: string;
  meta?: string;
  searchText?: string;
};

function ScheduleDropdown({
  label,
  value,
  options,
  placeholder = "선택",
  showMeta = true,
  showSelectedMeta = showMeta,
  showOptionMeta = showMeta,
  searchable = false,
  searchPlaceholder = "검색",
  onChange,
}: {
  label: string;
  value: string;
  options: ScheduleDropdownOption[];
  placeholder?: string;
  showMeta?: boolean;
  showSelectedMeta?: boolean;
  showOptionMeta?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const queryDigits = query.replace(/\D/g, "");
  const filteredOptions = normalizedQuery
    ? options.filter((option) => {
        const haystack = `${option.label} ${option.meta ?? ""} ${option.searchText ?? ""}`.toLowerCase();
        const haystackDigits = haystack.replace(/\D/g, "");
        return haystack.includes(normalizedQuery) || Boolean(queryDigits && haystackDigits.includes(queryDigits));
      })
    : options;

  return (
    <div className="relative space-y-1.5">
      <span className="text-[14px] text-[#64748b]">{label}</span>
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (open) setQuery("");
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-[8px] border bg-white px-3 text-left text-[14px] outline-none transition",
          open ? "border-[#b8c8d8] bg-[#fbfdff]" : "border-[#dbe2ea] hover:border-[#b8c8d8]",
        )}
      >
        <span className="min-w-0">
          <span className={cn("block truncate", selected ? "text-[#111827]" : "text-[#94a3b8]")}>
            {selected?.label ?? placeholder}
          </span>
          {showSelectedMeta && selected?.meta ? <span className="mt-0.5 block truncate text-[11px] text-[#64748b]">{selected.meta}</span> : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#64748b] transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[68px] z-[70] overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
          {searchable ? (
            <div className="border-b border-[#edf2f7] p-2">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] outline-none transition placeholder:text-[#94a3b8] focus:border-[#b8c8d8]"
                placeholder={searchPlaceholder}
              />
            </div>
          ) : null}
          <div className="max-h-[220px] overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-[7px] px-3 py-2.5 text-left transition",
                  option.value === value ? "bg-[#f8fafc] text-[#111827]" : "text-[#111827] hover:bg-[#f8fafc]",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px]">{option.label}</span>
                  {showOptionMeta && option.meta ? <span className="mt-0.5 block truncate text-[12px] text-[#64748b]">{option.meta}</span> : null}
                </span>
              </button>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-[13px] text-[#64748b]">검색 결과가 없습니다.</p>
            )}
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
  staffMembers,
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
  staffMembers: OwnerWebStaffMember[];
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
    meta: guardian?.phone ? formatSchedulePhone(guardian.phone) : undefined,
    searchText: `${pet.name} ${guardian?.name ?? ""} ${guardian?.phone ?? ""} ${guardian?.phone ? formatSchedulePhone(guardian.phone) : ""}`,
  }));
  const serviceOptions = activeServices.map((service) => ({
    value: service.id,
    label: service.name,
    meta: `${service.duration_minutes}분 · ${service.price.toLocaleString()}원`,
  }));
  const staffOptions = visibleStaff.map((staffMember) => ({
    value: staffMember.key,
    label: staffMember.name,
  }));
  const selectedService = data.services.find((service) => service.id === form.serviceId);
  const duration = selectedService ? selectedService.duration_minutes / 60 : 1;
  const dateBookings =
    form.date === selectedDate
      ? bookings
      : buildDailyBookingsFromBootstrap(data, form.date, staffAssignments, visibleStaff);
  const availableSlots = selectedService
    ? buildOwnerCreateAvailableSlots({
        shop: data.shop,
        date: form.date,
        duration,
        staffKey: form.staffKey,
        staffMembers,
        staffScheduleOverrides: data.staffScheduleOverrides,
        bookings: dateBookings,
      })
    : [];
  const normalizedCustomerPhone = normalizeSchedulePhone(form.customerPhone);
  const isCustomerPhoneIncomplete = form.customerMode === "new" && Boolean(form.customerPhone.trim()) && normalizedCustomerPhone.length < 10;
  const hasCustomerInfo =
    form.customerMode === "existing"
      ? Boolean(form.petId)
      : Boolean(form.customerName.trim() && form.petName.trim() && normalizedCustomerPhone.length >= 10);
  const canSubmit = Boolean(hasCustomerInfo && form.serviceId && form.staffKey && form.date && form.time && !saving);
  const dateInputRef = useRef<HTMLInputElement>(null);

  function updateDate(nextDate: string) {
    onChange({ ...form, date: nextDate, time: "" });
  }

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[560px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-center">
          <div className="relative flex min-w-0 items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => updateDate(addScheduleDays(form.date, -1))}
              className="inline-flex h-9 w-7 items-center justify-center rounded-[8px] text-[#475569] transition hover:bg-[#f8fafc]"
              aria-label="이전 날짜"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={openDatePicker}
              className={cn(
                "h-9 min-w-[154px] rounded-[8px] px-1 text-center text-[15px] text-[#111827] transition hover:bg-[#f8fafc]",
                form.date === currentDateInTimeZone() ? "font-bold" : "font-medium",
              )}
            >
              {formatSchedulePickerRelativeLabel(form.date, data.shop)}
            </button>
            <button
              type="button"
              onClick={() => updateDate(addScheduleDays(form.date, 1))}
              className="inline-flex h-9 w-7 items-center justify-center rounded-[8px] text-[#475569] transition hover:bg-[#f8fafc]"
              aria-label="다음 날짜"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={form.date}
              onChange={(event) => updateDate(event.target.value)}
              className="pointer-events-none absolute h-px w-px opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <ScheduleDropdown
            label="고객 등록 방식"
            value={form.customerMode}
            options={customerModeOptions}
            showMeta={false}
            onChange={(value) => onChange({ ...form, customerMode: value as "new" | "existing", time: "" })}
          />

          {form.customerMode === "existing" ? (
            <ScheduleDropdown
              label="고객 / 반려동물"
              value={form.petId}
              options={petOptions}
              placeholder="기존 고객을 선택해 주세요"
              showMeta={false}
              showOptionMeta
              searchable
              searchPlaceholder="고객명, 반려동물명, 연락처 검색"
              onChange={(value) => onChange({ ...form, petId: value })}
            />
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[14px] text-[#64748b]">고객명</span>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(event) => onChange({ ...form, customerName: event.target.value })}
                  className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none transition focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10"
                  placeholder="예: 김민지"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[14px] text-[#64748b]">반려동물 이름</span>
                <input
                  type="text"
                  value={form.petName}
                  onChange={(event) => onChange({ ...form, petName: event.target.value })}
                  className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none transition focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10"
                  placeholder="예: 몽이"
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-[14px] text-[#64748b]">고객 연락처</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.customerPhone}
                  onChange={(event) => onChange({ ...form, customerPhone: formatSchedulePhone(event.target.value) })}
                  className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none transition focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10"
                  placeholder="010-1234-5678"
                />
                {isCustomerPhoneIncomplete ? (
                  <span className="block text-[14px] text-[#64748b]">연락처를 10자리 이상 입력해 주세요.</span>
                ) : null}
              </label>
            </div>
          )}

          <div className="grid gap-2.5 md:grid-cols-2">
            <ScheduleDropdown
              label="서비스"
              value={form.serviceId}
              options={serviceOptions}
              showMeta={false}
              onChange={(value) => onChange({ ...form, serviceId: value, time: "" })}
            />
            <ScheduleDropdown
              label="담당"
              value={form.staffKey}
              options={staffOptions}
              showMeta={false}
              onChange={(value) => onChange({ ...form, staffKey: value as StaffKey, time: "" })}
            />
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

        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] text-[#64748b]">가능 시간</p>
          </div>
          <div className="mt-1.5 max-h-[128px] overflow-y-auto rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] p-2">
            {availableSlots.length > 0 ? (
              <div className="grid grid-cols-4 gap-1.5">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onChange({ ...form, time: slot })}
                    className={cn(
                      "h-8 rounded-[8px] border text-[13px] tabular-nums transition",
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

        <label className="mt-3 block space-y-1.5">
          <span className="text-[14px] text-[#64748b]">메모</span>
          <textarea
            value={form.memo}
            onChange={(event) => onChange({ ...form, memo: event.target.value })}
            className="min-h-[68px] w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#1f6b5b]"
            placeholder="고객 요청사항이나 직원 참고 메모를 적어주세요."
          />
        </label>

        {error ? <p className="mt-3 rounded-[8px] bg-[#fff7ed] px-3 py-2 text-[13px] text-[#9a3412]">{error}</p> : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
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
  onDataChange,
  staffMembers = [],
  manualApprovalEnabled: controlledManualApprovalEnabled,
  onManualApprovalChange,
  createRequest,
  onCreateRequestHandled,
}: {
  initialData: BootstrapPayload;
  onDataChange?: (data: BootstrapPayload) => void;
  staffMembers?: OwnerWebStaffMember[];
  manualApprovalEnabled?: boolean;
  onManualApprovalChange?: (enabled: boolean) => void;
  createRequest?: OwnerScheduleCreateRequest | null;
  onCreateRequestHandled?: (requestId: number) => void;
}) {
  const [bootstrapData, setBootstrapData] = useState(() => initialData);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignments>({});
  const [selectedDate, setSelectedDate] = useState(() => currentDateInTimeZone());
  const visibleStaff = useMemo(() => {
    return staffMembers.map(toOwnerWebStaffColumn);
  }, [staffMembers]);
  const selectedDateBookings = useMemo(
    () =>
      shouldUseOwnerWebPreviewBookings(bootstrapData)
        ? buildLocalPreviewDailyBookings(selectedDate, visibleStaff)
        : bootstrapData.mode === "supabase"
          ? buildDailyBookingsFromBootstrap(bootstrapData, selectedDate, staffAssignments, visibleStaff)
          : [],
    [bootstrapData, selectedDate, staffAssignments, visibleStaff],
  );
  const selectedDateBookingSource = shouldUseOwnerWebPreviewBookings(bootstrapData)
    ? "buildLocalPreviewDailyBookings"
    : bootstrapData.mode === "supabase"
      ? "buildDailyBookingsFromBootstrap"
      : "blocked-non-supabase-owner-data";
  const [staff, setStaff] = useState<StaffFilter>("전체 직원");
  const [activeMetric, setActiveMetric] = useState<SummaryMetricKey>("today");
  const [reservationStatusFilter, setReservationStatusFilter] = useState<ReservationStatusFilter>("all");
  const [bookings, setBookings] = useState<DailyBooking[]>(() => selectedDateBookings);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [selectedBoardStaffKey, setSelectedBoardStaffKey] = useState<StaffKey | null>(null);
  const [scheduleStatusHour, setScheduleStatusHour] = useState(() => getCurrentDayHour());
  const [staffComments, setStaffComments] = useState<Record<string, string>>(() => buildStaffCommentsFromBootstrap(initialData));
  const staffCommentSaveTimersRef = useRef<Record<string, number>>({});
  const [acknowledgedChangeBookingIds, setAcknowledgedChangeBookingIds] = useState<Set<string>>(() => new Set());
  const [internalManualApprovalEnabled, setInternalManualApprovalEnabled] = useState(true);
  const [earlyStartBooking, setEarlyStartBooking] = useState<DailyBooking | null>(null);
  const [photoStatusAction, setPhotoStatusAction] = useState<PhotoStatusAction | null>(null);
  const [alternativeTimeBooking, setAlternativeTimeBooking] = useState<DailyBooking | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleCreateFormState>(() =>
    buildDefaultScheduleForm(initialData, visibleStaff, currentDateInTimeZone(), "전체 직원"),
  );
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [boardError, setBoardError] = useState("");
  const [pendingOutOfHoursMove, setPendingOutOfHoursMove] = useState<PendingOutOfHoursMove | null>(null);
  const statusChangeInFlightRef = useRef(false);
  const recentStatusOverridesRef = useRef<Record<string, RecentStatusOverride>>({});
  const manualApprovalEnabled = controlledManualApprovalEnabled ?? internalManualApprovalEnabled;
  useEffect(() => {
    if (!createRequest) return;
    const targetDate = createRequest.date ?? selectedDate;
    const requestedPet =
      (createRequest.petId ? bootstrapData.pets.find((pet) => pet.id === createRequest.petId) : null) ??
      bootstrapData.pets.find((pet) => pet.guardian_id === createRequest.guardianId) ??
      null;
    const targetStaff =
      (selectedBoardStaffKey ? visibleStaff.find((item) => item.key === selectedBoardStaffKey) : null) ??
      (staff === "전체 직원" ? visibleStaff[0] : visibleStaff.find((item) => item.key === staff) ?? visibleStaff[0]);

    setSelectedDate(targetDate);
    setScheduleForm({
      ...buildDefaultScheduleForm(bootstrapData, visibleStaff, targetDate, staff),
      customerMode: requestedPet ? "existing" : "new",
      petId: requestedPet?.id ?? "",
      staffKey: targetStaff?.key ?? "",
      date: targetDate,
    });
    setScheduleError("");
    setScheduleDialogOpen(true);
    onCreateRequestHandled?.(createRequest.requestId);
  }, [bootstrapData, createRequest, onCreateRequestHandled, selectedBoardStaffKey, selectedDate, staff, visibleStaff]);
  const staffScopedBookings = useMemo(
    () => {
      const visibleStaffKeys = new Set(visibleStaff.map((item) => item.key));
      const fallbackStaff = visibleStaff[0] ?? null;
      const normalizedBookings = bookings.flatMap((booking) => {
        if (visibleStaffKeys.has(booking.staffKey)) return [booking];
        if (!fallbackStaff) return [];
        return [
          {
            ...booking,
            staff: fallbackStaff.name,
            staffKey: fallbackStaff.key,
            staffName: fallbackStaff.name,
          },
        ];
      });

      return staff === "전체 직원" ? normalizedBookings : normalizedBookings.filter((item) => item.staffKey === staff);
    },
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

  function applyRecentStatusOverrides(data: BootstrapPayload): BootstrapPayload {
    const now = Date.now();
    let changed = false;
    const appointments = data.appointments.map((appointment) => {
      const override = recentStatusOverridesRef.current[appointment.id];
      if (!override) return appointment;

      if (now - override.createdAt > recentStatusOverrideTtlMs) {
        delete recentStatusOverridesRef.current[appointment.id];
        return appointment;
      }

      if (appointment.status === override.status) return appointment;

      changed = true;
      return {
        ...appointment,
        status: override.status,
      };
    });

    return changed ? { ...data, appointments } : data;
  }

  useEffect(() => {
    console.log("[OWNER DEBUG] calendar-management-screen", {
      mode: bootstrapData.mode,
      shopId: bootstrapData.shop.id,
      selectedDate,
      bootstrapAppointmentsCount: bootstrapData.appointments?.length ?? 0,
      selectedDateAppointmentsCount: bootstrapData.appointments.filter((appointment) => appointment.appointment_date === selectedDate).length,
      bootstrapStaffCount: 0,
      staffColumnsSource: staffMembers.length > 0 ? "owner-web-preview-props" : "empty",
      finalStaffColumns: visibleStaff,
      dailyBookingsSource: selectedDateBookingSource,
      finalDailyBookingsCount: selectedDateBookings.length,
      finalDailyBookings: selectedDateBookings.map((booking) => ({
        id: booking.id,
        staffKey: booking.staffKey,
        staffName: booking.staffName,
        pet: booking.pet,
        customer: booking.customer,
        start: booking.start,
        duration: booking.duration,
        status: booking.status,
      })),
    });
  }, [bootstrapData, selectedDate, selectedDateBookingSource, selectedDateBookings, staffMembers.length, visibleStaff]);

  useEffect(() => {
    if (statusChangeInFlightRef.current) return;
    setBootstrapData(applyRecentStatusOverrides(initialData));
  }, [initialData]);

  useEffect(() => {
    if (scheduleDialogOpen) return;
    setScheduleForm(buildDefaultScheduleForm(bootstrapData, visibleStaff, selectedDate, staff));
  }, [bootstrapData, scheduleDialogOpen, staff, selectedDate, visibleStaff]);

  useEffect(() => {
    const timer = window.setInterval(() => setScheduleStatusHour(getCurrentDayHour()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (bootstrapData.mode !== "supabase") return;

    let cancelled = false;
    const syncScheduleRange = async () => {
      const canSync =
        typeof document === "undefined" ||
        (document.visibilityState === "visible" &&
          !scheduleDialogOpen &&
          !scheduleSaving &&
          !statusChangeInFlightRef.current &&
          !photoStatusAction &&
          !earlyStartBooking);

      if (!canSync) return;

      try {
        const range = await fetchOwnerScheduleRange(bootstrapData.shop.id, selectedDate, selectedDate);
        if (cancelled || statusChangeInFlightRef.current) return;
        const nextBootstrapData = applyRecentStatusOverrides(replaceScheduleRangeInBootstrap(bootstrapData, range));
        setBootstrapData(nextBootstrapData);
        onDataChange?.(nextBootstrapData);
      } catch {
        // External sync should never interrupt the board while the owner is working.
      }
    };

    const intervalId = window.setInterval(syncScheduleRange, 15_000);
    window.addEventListener("focus", syncScheduleRange);
    document.addEventListener("visibilitychange", syncScheduleRange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncScheduleRange);
      document.removeEventListener("visibilitychange", syncScheduleRange);
    };
  }, [
    bootstrapData,
    earlyStartBooking,
    onDataChange,
    photoStatusAction,
    scheduleDialogOpen,
    scheduleSaving,
    selectedDate,
  ]);

  useEffect(() => {
    if (visibleStaff.length === 1 && staff !== visibleStaff[0].key) {
      setStaff(visibleStaff[0].key);
      return;
    }
    if (staff !== "전체 직원" && !visibleStaff.some((item) => item.key === staff)) {
      setStaff("전체 직원");
    }
  }, [staff, visibleStaff]);

  useEffect(() => {
    if (visibleStaff.length === 0) {
      setSelectedBoardStaffKey(null);
      return;
    }

    if (visibleStaff.length === 1) {
      setSelectedBoardStaffKey(visibleStaff[0].key);
      return;
    }

    if (staff !== "전체 직원") {
      setSelectedBoardStaffKey(staff);
      return;
    }

    setSelectedBoardStaffKey((current) =>
      current && visibleStaff.some((item) => item.key === current) ? current : null,
    );
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
        setStaffComments((current) => ({ ...current, ...(JSON.parse(stored) as Record<string, string>) }));
      }
    } catch {
      window.localStorage.removeItem(staffCommentStorageKey);
    }
  }, []);

  useEffect(() => {
    setStaffComments((current) => ({ ...current, ...buildStaffCommentsFromBootstrap(bootstrapData) }));
  }, [bootstrapData.petStaffNotes]);

  useEffect(() => {
    return () => {
      Object.values(staffCommentSaveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function handleStaffCommentChange(commentKey: string, value: string, booking?: DailyBooking) {
    setStaffComments((current) => {
      const next = { ...current, [commentKey]: value };
      window.localStorage.setItem(staffCommentStorageKey, JSON.stringify(next));
      return next;
    });

    if (!booking?.guardianId) return;

    const pendingTimer = staffCommentSaveTimersRef.current[commentKey];
    if (pendingTimer) window.clearTimeout(pendingTimer);
    staffCommentSaveTimersRef.current[commentKey] = window.setTimeout(() => {
      void patchOwnerPetStaffNote({
        shopId: bootstrapData.shop.id,
        guardianId: booking.guardianId,
        petId: booking.petId ?? null,
        note: value,
      })
        .then((savedNote) => {
          setBootstrapData((current) => {
            const nextData = upsertPetStaffNoteInBootstrap(current, savedNote);
            onDataChange?.(nextData);
            return nextData;
          });
        })
        .catch((error) => {
          setBoardError(getApiErrorMessage(error, "직원 메모 저장 중 문제가 발생했습니다."));
        });
    }, 500);
  }

  const filteredBookings = displayScopedBookings;

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

  async function persistBoardBookingChange(nextBooking: DailyBooking, options: { allowOutsideShopHours?: boolean } = {}) {
    const appointment = bootstrapData.appointments.find((item) => item.id === nextBooking.id);
    if (!appointment) return;

    const updatedAppointment = await fetchApiJsonWithAuth<Appointment>("/api/appointments", {
      method: "PATCH",
      body: JSON.stringify({
        appointmentId: appointment.id,
        serviceId: appointment.service_id,
        staffId: nextBooking.staffKey,
        appointmentDate: appointment.appointment_date,
        appointmentTime: formatHourLabel(nextBooking.start),
        durationMinutes: Math.round(nextBooking.duration * 60),
        memo: appointment.memo ?? "",
        enforceShopCapacity: false,
        allowOutsideShopHours: options.allowOutsideShopHours ?? false,
        notifyCustomer: false,
        preserveStatus: true,
      }),
    });

    const nextBootstrapData = replaceAppointmentInBootstrap(bootstrapData, updatedAppointment);
    setBootstrapData(nextBootstrapData);
    onDataChange?.(nextBootstrapData);
    setStaffAssignments((current) => ({
      ...current,
      [updatedAppointment.id]: updatedAppointment.staff_id ?? nextBooking.staffKey,
    }));
  }

  async function refreshScheduleRangeAfterStatusChange(date: string, fallbackData: BootstrapPayload) {
    const range = await fetchOwnerScheduleRange(fallbackData.shop.id, date, date);
    const nextBootstrapData = applyRecentStatusOverrides(replaceScheduleRangeInBootstrap(fallbackData, range));
    setBootstrapData(nextBootstrapData);
    onDataChange?.(nextBootstrapData);
    return nextBootstrapData;
  }

  async function persistBookingStatusChange(
    bookingId: string,
    nextStatus: string,
    mediaAssetIds: string[] = [],
    options: { notifyCustomer?: boolean } = {},
  ) {
    const appointmentStatus = getAppointmentStatusFromBookingStatus(nextStatus);
    if (!appointmentStatus) return null;

    const updatedAppointment = await patchOwnerAppointmentStatus({
      appointmentId: bookingId,
      status: appointmentStatus,
      mediaAssetIds,
      notifyCustomer: options.notifyCustomer ?? true,
    });
    const nextBootstrapData = applyRecentStatusOverrides(replaceAppointmentInBootstrap(bootstrapData, updatedAppointment));
    setBootstrapData(nextBootstrapData);
    onDataChange?.(nextBootstrapData);

    if (appointmentStatus === "completed") {
      return refreshScheduleRangeAfterStatusChange(updatedAppointment.appointment_date, nextBootstrapData);
    }

    return nextBootstrapData;
  }

  async function persistBookingDetailChange(
    booking: DailyBooking,
    values: { startTime: string; endTime: string; phone: string; serviceName: string; price: number },
  ) {
    const appointment = bootstrapData.appointments.find((item) => item.id === booking.id);
    if (!appointment) throw new Error("예약 정보를 찾을 수 없습니다.");

    const currentGuardian = bootstrapData.guardians.find((item) => item.id === appointment.guardian_id);
    const currentService = bootstrapData.services.find((item) => item.id === appointment.service_id);
    const currentDurationMinutes = Math.max(
      15,
      Math.round(minutesBetween(appointment.start_at, appointment.end_at) ?? currentService?.duration_minutes ?? booking.duration * 60),
    );
    const startMinutes = timeInputToMinutes(values.startTime);
    const endMinutes = timeInputToMinutes(values.endTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      throw new Error("예약 시간을 다시 확인해 주세요.");
    }

    const durationMinutes = endMinutes - startMinutes;
    let nextBootstrapData = bootstrapData;

    if (normalizeSchedulePhone(currentGuardian?.phone ?? "") !== values.phone) {
      const updatedGuardian = await patchOwnerGuardian({
        shopId: bootstrapData.shop.id,
        guardianId: appointment.guardian_id,
        phone: values.phone,
      });
      nextBootstrapData = replaceGuardianInBootstrap(nextBootstrapData, updatedGuardian);
    }

    const currentServiceName = currentService?.name ?? booking.service;
    const currentServicePrice =
      typeof currentService?.price === "number"
        ? currentService.price
        : typeof booking.servicePrice === "number"
          ? booking.servicePrice
          : 0;
    const serviceChanged = currentServiceName !== values.serviceName || currentServicePrice !== values.price;
    const timeChanged = appointment.appointment_time.slice(0, 5) !== values.startTime || currentDurationMinutes !== durationMinutes;
    let nextServiceId = appointment.service_id;

    if (serviceChanged) {
      const customServiceId = appointment.service_id === getAppointmentCustomServiceId(appointment.id)
        ? appointment.service_id
        : getAppointmentCustomServiceId(appointment.id);
      const updatedService = await postOwnerService({
        shopId: bootstrapData.shop.id,
        serviceId: customServiceId,
        name: values.serviceName,
        price: values.price,
        priceType: currentService?.price_type ?? "fixed",
        durationMinutes,
        isActive: false,
      });
      nextBootstrapData = upsertServiceInBootstrap(nextBootstrapData, updatedService);
      nextServiceId = customServiceId;
    }

    if (serviceChanged || timeChanged) {
      const updatedAppointment = await fetchApiJsonWithAuth<Appointment>("/api/appointments", {
        method: "PATCH",
        body: JSON.stringify({
          appointmentId: appointment.id,
          serviceId: nextServiceId,
          staffId: appointment.staff_id ?? booking.staffKey,
          appointmentDate: appointment.appointment_date,
          appointmentTime: values.startTime,
          durationMinutes,
          memo: appointment.memo ?? "",
          enforceShopCapacity: false,
          allowOutsideShopHours: true,
          notifyCustomer: false,
          preserveStatus: true,
        }),
      });
      nextBootstrapData = replaceAppointmentInBootstrap(nextBootstrapData, updatedAppointment);
    }

    setBootstrapData(nextBootstrapData);
    onDataChange?.(nextBootstrapData);
  }

  async function persistBookingPhoneChange(booking: DailyBooking, phone: string) {
    const appointment = bootstrapData.appointments.find((item) => item.id === booking.id);
    if (!appointment) throw new Error("예약 정보를 찾을 수 없습니다.");

    const currentGuardian = bootstrapData.guardians.find((item) => item.id === appointment.guardian_id);
    if (normalizeSchedulePhone(currentGuardian?.phone ?? "") === phone) return;

    const updatedGuardian = await patchOwnerGuardian({
      shopId: bootstrapData.shop.id,
      guardianId: appointment.guardian_id,
      phone,
    });
    const nextBootstrapData = replaceGuardianInBootstrap(bootstrapData, updatedGuardian);
    setBootstrapData(nextBootstrapData);
    onDataChange?.(nextBootstrapData);
  }

  async function handleMoveBooking(bookingId: string, next: { staffKey: StaffKey; staffName: string; staff: string; start: number }) {
    const previousBookings = bookings;
    const targetBooking = bookings.find((booking) => booking.id === bookingId);
    if (!targetBooking) return;

    const nextBooking = { ...targetBooking, ...next };
    if (isOutsideShopOperatingHours(bootstrapData.shop, selectedDate, nextBooking.start, nextBooking.duration)) {
      setPendingOutOfHoursMove({ bookingId, nextBooking, previousBookings });
      return;
    }
    setBoardError("");
    setBookings((current) => current.map((booking) => (booking.id === bookingId ? nextBooking : booking)));

    try {
      await persistBoardBookingChange(nextBooking);
    } catch (error) {
      setBookings(previousBookings);
      setBoardError(getApiErrorMessage(error, "예약 위치 저장 중 문제가 발생했습니다."));
    }
  }

  function cancelOutOfHoursMove() {
    setPendingOutOfHoursMove(null);
  }

  async function confirmOutOfHoursMove() {
    if (!pendingOutOfHoursMove) return;
    const pending = pendingOutOfHoursMove;
    setPendingOutOfHoursMove(null);
    setBoardError("");
    setBookings((current) => current.map((booking) => (booking.id === pending.bookingId ? pending.nextBooking : booking)));

    try {
      await persistBoardBookingChange(pending.nextBooking, { allowOutsideShopHours: true });
    } catch (error) {
      setBookings(pending.previousBookings);
      setBoardError(getApiErrorMessage(error, "예약 위치 저장 중 문제가 발생했습니다."));
    }
  }

  async function handleResizeBooking(bookingId: string, duration: number) {
    const previousBookings = bookings;
    const targetBooking = bookings.find((booking) => booking.id === bookingId);
    if (!targetBooking) return;

    const nextBooking = { ...targetBooking, duration };
    setBoardError("");
    setBookings((current) => current.map((booking) => (booking.id === bookingId ? nextBooking : booking)));

    try {
      await persistBoardBookingChange(nextBooking);
    } catch (error) {
      setBookings(previousBookings);
      setBoardError(getApiErrorMessage(error, "예약 시간 저장 중 문제가 발생했습니다."));
    }
  }

  function isBeforeBookingStart(booking: DailyBooking) {
    const selectedDay = parseScheduleDate(selectedDate).getTime();
    const todayDay = parseScheduleDate(currentDateInTimeZone()).getTime();
    return selectedDay > todayDay || (selectedDay === todayDay && getCurrentDayHour() < booking.start);
  }

  function shouldSkipPhotoStatusChange(nextStatus: string) {
    const appointmentStatus = getAppointmentStatusFromBookingStatus(nextStatus);
    if (appointmentStatus === "in_progress") return true;
    if (appointmentStatus === "almost_done") return true;
    return false;
  }

  async function applyBookingStatusChange(
    bookingId: string,
    nextStatus: string,
    mediaAssetIds: string[] = [],
    options: { notifyCustomer?: boolean } = {},
  ) {
    const previousBookings = bookings;
    const targetBooking = bookings.find((booking) => booking.id === bookingId);
    if (!targetBooking) return;
    const nextAppointmentStatus = getAppointmentStatusFromBookingStatus(nextStatus);

    const displayStatus = getTimedBookingStatus(targetBooking, selectedDate, getCurrentDayHour());
    const rollbackToInProgress = nextStatus === "진행 중" && targetBooking.status === "픽업 준비";
    if (nextStatus === "진행 중" && !canStartGrooming(targetBooking.status) && !rollbackToInProgress) return;
    if (nextStatus === "픽업 준비" && !canMarkGroomingComplete(targetBooking.status)) return;
    if (
      nextStatus === "완료" &&
      !["확정", "진행 중", "픽업 준비"].includes(targetBooking.status) &&
      displayStatus !== "완료"
    ) return;

    const nextBooking = { ...targetBooking, status: nextStatus };
    setBoardError("");
    if (nextAppointmentStatus) {
      recentStatusOverridesRef.current[bookingId] = {
        status: nextAppointmentStatus,
        createdAt: Date.now(),
      };
    }
    setBookings((current) =>
      current.map((booking) => (booking.id === bookingId ? nextBooking : booking)),
    );
    setScheduleStatusHour(getCurrentDayHour());

    statusChangeInFlightRef.current = true;
    try {
      await persistBookingStatusChange(bookingId, nextStatus, mediaAssetIds, options);
    } catch (error) {
      delete recentStatusOverridesRef.current[bookingId];
      setBookings(previousBookings);
      setBoardError(getApiErrorMessage(error, "예약 상태 저장 중 문제가 발생했습니다."));
    } finally {
      statusChangeInFlightRef.current = false;
    }
  }

  function requestPhotoStatusChange(booking: DailyBooking, nextStatus: "완료") {
    setPhotoStatusAction({
      bookingId: booking.id,
      nextStatus,
      mediaKind: "grooming_after",
      title: "미용 완료 사진",
      description: "마무리된 모습을 한 장 촬영하면 미용 완료 알림에 함께 전송됩니다.",
      buttonLabel: "사진 찍고 미용 완료",
    });
  }

  async function handlePhotoStatusFile(file: File) {
    if (!photoStatusAction) return;
    const appointment = bootstrapData.appointments.find((item) => item.id === photoStatusAction.bookingId);
    const booking = bookings.find((item) => item.id === photoStatusAction.bookingId);
    if (!appointment || !booking) {
      setBoardError("사진을 연결할 예약 정보를 찾지 못했습니다.");
      return;
    }

    setBoardError("");
    const uploaded = await createOwnerMediaAssetFromFile(
      {
        shopId: bootstrapData.shop.id,
        guardianId: appointment.guardian_id,
        petId: appointment.pet_id,
        appointmentId: appointment.id,
        groomingRecordId: null,
      },
      photoStatusAction.mediaKind,
      file,
    );

    setPhotoStatusAction(null);
    await applyBookingStatusChange(booking.id, photoStatusAction.nextStatus, [uploaded.mediaAsset.id]);
  }

  function handleChangeBookingStatus(bookingId: string, nextStatus: string) {
    const targetBooking = bookings.find((booking) => booking.id === bookingId);
    const rollback =
      Boolean(targetBooking) &&
      ((targetBooking?.status === "진행 중" && nextStatus === "확정") ||
        (targetBooking?.status === "픽업 준비" && nextStatus === "진행 중"));
    if (rollback) {
      void applyBookingStatusChange(bookingId, nextStatus, [], { notifyCustomer: false });
      return;
    }

    if (targetBooking && nextStatus === "진행 중" && canStartGrooming(targetBooking.status) && isBeforeBookingStart(targetBooking)) {
      setEarlyStartBooking(targetBooking);
      return;
    }

    if (targetBooking && shouldSkipPhotoStatusChange(nextStatus)) {
      void applyBookingStatusChange(bookingId, nextStatus);
      return;
    }

    if (targetBooking && nextStatus === "완료") {
      requestPhotoStatusChange(targetBooking, nextStatus);
      return;
    }

    void applyBookingStatusChange(bookingId, nextStatus);
  }

  function handleSuggestAlternativeTime(bookingId: string) {
    const targetBooking = bookings.find((booking) => booking.id === bookingId);
    if (!targetBooking) return;
    setAlternativeTimeBooking(targetBooking);
  }

  function handleAcknowledgeChangeBooking(bookingId: string) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (booking && isRescheduledBookingStatus(booking.status)) {
      setBookings((current) =>
        current.map((item) =>
          item.id === bookingId
            ? {
                ...item,
                status: "확정",
                changeAcknowledged: true,
              }
            : item,
        ),
      );
      setSelectedBookingId(bookingId);
      return;
    }

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
      (selectedBoardStaffKey ? visibleStaff.find((item) => item.key === selectedBoardStaffKey) : null) ??
      (staff === "전체 직원" ? visibleStaff[0] : visibleStaff.find((item) => item.key === staff) ?? visibleStaff[0]);
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

    if (!isStaffWorkingWindow(staffMembers, bootstrapData.staffScheduleOverrides, targetStaff.key, scheduleForm.date, timeToHour(scheduleForm.time), duration)) {
      setScheduleError("선택한 담당자의 근무요일 또는 근무시간 밖입니다.");
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
      staffId: targetStaff.key,
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
      onDataChange?.(nextBootstrapData);
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
      {scheduleDialogOpen ? (
        <ScheduleCreateDialog
          data={bootstrapData}
          bookings={bookings}
          form={scheduleForm}
          selectedDate={selectedDate}
          visibleStaff={visibleStaff}
          staffMembers={staffMembers}
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
      {pendingOutOfHoursMove ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/25 px-4" onClick={cancelOutOfHoursMove}>
          <div
            className="w-full max-w-[380px] rounded-[10px] border border-[#dbe2ea] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-[18px] font-semibold text-[#111827]">운영시간 밖으로 이동합니다</h3>
            <p className="mt-2 text-[15px] leading-6 text-[#475569]">
              예약 시간이 매장 운영시간을 벗어납니다. 그래도 이 시간으로 변경하시겠습니까?
            </p>
            <div className="mt-4 rounded-[8px] border border-[#e5e7eb] bg-[#f8fafc] px-3 py-3 text-[15px] text-[#334155]">
              <p className="font-medium text-[#111827]">{pendingOutOfHoursMove.nextBooking.pet} · {pendingOutOfHoursMove.nextBooking.customer}</p>
              <p className="mt-1">
                {formatHourLabel(pendingOutOfHoursMove.nextBooking.start)} - {formatHourLabel(pendingOutOfHoursMove.nextBooking.start + pendingOutOfHoursMove.nextBooking.duration)}
              </p>
              <p className="mt-1 text-[#64748b]">담당 {pendingOutOfHoursMove.nextBooking.staffName}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={cancelOutOfHoursMove}
                className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[15px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmOutOfHoursMove()}
                className="h-11 rounded-[8px] bg-[#1f6b5b] text-[15px] font-medium text-white transition hover:bg-[#185848]"
              >
                변경하기
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {boardError ? (
        <p className="rounded-[8px] border border-[#f3c7c7] bg-[#fffafa] px-3 py-2 text-[13px] text-[#b42318]">
          {boardError}
        </p>
      ) : null}

      <div className="grid min-w-0 items-stretch gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <WebSurface className="flex h-[calc(100vh-112px)] min-h-[640px] min-w-0 flex-col overflow-hidden">
          <CalendarToolbar
            shop={bootstrapData.shop}
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
            selectedDate={selectedDate}
            currentHour={scheduleStatusHour}
            conflictBookings={displayScopedBookings}
            selectedStaffKey={selectedBoardStaffKey}
            onSelectBooking={setSelectedBookingId}
            onSelectStaff={setSelectedBoardStaffKey}
            onMoveBooking={handleMoveBooking}
            onResizeBooking={handleResizeBooking}
          />
        </WebSurface>

        <BookingSidePanel
          activeMetric={activeMetric}
          shopId={bootstrapData.shop.id}
          bootstrapData={bootstrapData}
          manualApprovalEnabled={manualApprovalEnabled}
          selectedBooking={selectedBooking}
          selectedBookingId={selectedBookingId}
          selectedDate={selectedDate}
          currentHour={scheduleStatusHour}
          bookings={displayScopedBookings}
          approvalModeBookings={[]}
          onManualApprovalChange={handleManualApprovalChange}
          onChangeStatus={handleChangeBookingStatus}
          onSuggestAlternativeTime={handleSuggestAlternativeTime}
          onAcknowledgeChange={handleAcknowledgeChangeBooking}
          onSelectBooking={setSelectedBookingId}
          staffComments={staffComments}
          onChangeStaffComment={handleStaffCommentChange}
          onSaveBookingPhone={persistBookingPhoneChange}
          onSaveBookingDetail={persistBookingDetailChange}
        />
      </div>
      {photoStatusAction ? (
        <PhotoStatusDialog
          action={photoStatusAction}
          onClose={() => setPhotoStatusAction(null)}
          onSubmit={handlePhotoStatusFile}
          onSkip={async () => {
            const action = photoStatusAction;
            if (!action) return;
            setPhotoStatusAction(null);
            await applyBookingStatusChange(action.bookingId, action.nextStatus);
          }}
        />
      ) : null}
      {alternativeTimeBooking ? (
        <AlternativeTimeGuideDialog
          booking={alternativeTimeBooking}
          shopId={bootstrapData.shop.id}
          selectedDate={selectedDate}
          onClose={() => setAlternativeTimeBooking(null)}
        />
      ) : null}
      {earlyStartBooking ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/25 px-4" onClick={() => setEarlyStartBooking(null)}>
          <div className="w-full max-w-[360px] rounded-[10px] border border-[#dbe2ea] bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-[17px] font-medium text-[#111827]">예약 시간 전입니다</h3>
            <p className="mt-2 text-[13px] leading-5 text-[#64748b]">
              <span className="block">
                {earlyStartBooking.pet} · {earlyStartBooking.customer} 예약은 {formatHourLabel(earlyStartBooking.start)} 시작입니다.
              </span>
              <span className="block">그래도 미용을 시작할까요?</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEarlyStartBooking(null)} className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium text-[#334155]">
                아니요
              </button>
              <button
                type="button"
                onClick={() => {
                  void applyBookingStatusChange(earlyStartBooking.id, "진행 중");
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
