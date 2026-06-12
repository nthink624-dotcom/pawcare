"use client";

import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  Phone,
  Play,
  QrCode,
  Scissors,
  Send,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ScheduleCreateDialog } from "@/components/owner-web/calendar-create-dialog";
import { DailyScheduleGrid } from "@/components/owner-web/calendar-daily-schedule-grid";
import {
  buildLocalGuardian,
  buildLocalOwnerAppointment,
  buildLocalPet,
  fetchOwnerScheduleRange,
  formatSchedulePhone,
  getApiErrorMessage,
  getAppointmentCustomServiceId,
  getAppointmentStatusFromBookingStatus,
  normalizeSchedulePhone,
  patchOwnerAppointmentStatus,
  patchOwnerGuardian,
  patchOwnerPet,
  patchOwnerPetStaffNote,
  postOwnerAppointment,
  postOwnerGuardian,
  postOwnerPet,
  postOwnerService,
  replaceAppointmentInBootstrap,
  replaceScheduleRangeInBootstrap,
} from "@/components/owner-web/calendar-owner-api";
import { MonthlyScheduleOverview, WeeklyScheduleOverview } from "@/components/owner-web/calendar-overviews";
import { CalendarToolbar } from "@/components/owner-web/calendar-toolbar";
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
import { fetchApiJsonWithAuth } from "@/lib/api";
import { createOwnerMediaAssetFromFile } from "@/lib/media/owner-media-client";
import { getPetBiteLevelLabel, normalizePetBiteLevel } from "@/lib/pet-bite-level";
import { cn, currentDateInTimeZone } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload, Guardian, MediaKind, NotificationType, Pet, PetBiteLevel, PetStaffNote, Service } from "@/types/domain";

type SummaryMetricKey = "today" | "completed" | "changes";
type ReservationStatusFilter = "all" | "pending" | "confirmed";
type BookingCardTone = "confirmed" | "active" | "pending" | "completed" | "changed" | "cancelled";
const overduePendingStatusLabel = "기한 지남";
type ScheduleMetric = { key: SummaryMetricKey; label: string; value?: string };
type RecentStatusOverride = {
  status: AppointmentStatus;
  createdAt: number;
};
type PhotoStatusAction = {
  bookingId: string;
  nextStatus: "진행 중" | "완료";
  mediaKind: Extract<MediaKind, "grooming_before" | "grooming_after">;
  title: string;
  description: string;
  buttonLabel: string;
  skipLabel: string;
  mobileDescription: string;
};
type StaffKey = string;
type StaffFilter = "전체 직원" | StaffKey;
type StaffAssignments = Record<string, StaffKey>;
const staffWeekdayKeys: OwnerWebWeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const timeWheelHours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const timeWheelMinutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
const recentStatusOverrideTtlMs = 30_000;
const visitReminderOffsetOptions = [10, 20, 30, 60] as const;
const pickupReadyEtaOptions = [5, 10, 15, 20] as const;
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
  return `${String(year).slice(-2)}년 ${month}월 ${day}일`;
}

function formatSchedulePickerDateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${String(year).slice(-2)}년 ${String(month).padStart(2, "0")}월 ${String(day).padStart(2, "0")}일`;
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
  const durationMinutes = Math.round(duration * 60);
  const nowMinute = Math.ceil((getCurrentDayHour() * 60) / 15) * 15;
  const firstMinute = Math.ceil(openMinute / 15) * 15;
  const latestStartMinute = closeMinute - durationMinutes;
  const slots: string[] = [];

  for (let cursor = firstMinute; cursor <= latestStartMinute; cursor += 15) {
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

function isOverduePendingBookingStatus(status: string) {
  return status === overduePendingStatusLabel;
}

function isApprovalQueueBookingStatus(status: string) {
  return isPendingBookingStatus(status) || isOverduePendingBookingStatus(status);
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

function isTimelineBookingStatus(status: string) {
  return !isChangeBookingStatus(status);
}

function getTimedBookingStatus(
  booking: { status: string; start: number; duration: number; changeAcknowledged?: boolean },
  selectedDate: string,
  currentHour: number,
) {
  if (isPendingBookingStatus(booking.status)) {
    const today = currentDateInTimeZone();
    if (selectedDate < today || (selectedDate === today && currentHour >= booking.start)) return overduePendingStatusLabel;
    return booking.status;
  }

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
    options.push({ key: "pending", label: "대기", count: bookableBookings.filter((booking) => isApprovalQueueBookingStatus(booking.status)).length });
  }

  options.push(
    { key: "confirmed", label: "확정", count: bookableBookings.filter((booking) => isConfirmedBookingStatus(booking.status)).length },
  );

  return options;
}

function matchesReservationFilter(booking: DailyBooking, filter: ReservationStatusFilter) {
  if (filter === "all" && isChangeBookingStatus(booking.status)) return true;
  if (!isBookableStatus(booking.status)) return false;
  if (filter === "pending") return isApprovalQueueBookingStatus(booking.status);
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
  return `${String(parsed.getFullYear()).slice(-2)}년 ${parsed.getMonth() + 1}월`;
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
  if (isOverduePendingBookingStatus(status)) return "cancelled";
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
  if (isOverduePendingBookingStatus(sourceStatus)) return overduePendingStatusLabel;
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
  if (isOverduePendingBookingStatus(sourceStatus)) return "border-[#ead6dc] bg-[#fffafa] text-[#8f2438]";
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
  if (!isApprovalQueueBookingStatus(booking.sourceStatus ?? booking.status)) return [];

  return bookings.filter((item) => {
    if (item.id === booking.id) return false;
    if (item.staffKey !== booking.staffKey) return false;
    if (!isApprovalQueueBookingStatus(item.sourceStatus ?? item.status)) return false;
    return bookingWindowsOverlap(booking, item);
  });
}

function getPendingOverlapLabel(booking: DailyBooking, bookings: DailyBooking[]) {
  return "";
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
    if (booking.id === bookingId || booking.staffKey !== next.staffKey) return false;
    if (booking.status && !isBookableStatus(booking.status)) return false;
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
    visitReminderOffsetMinutes: appointment.visit_reminder_offset_minutes ?? 10,
    pickupReadyEtaMinutes: appointment.pickup_ready_eta_minutes ?? 5,
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
  visitReminderOffsetMinutes?: number;
  pickupReadyEtaMinutes?: number;
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
    pending: bookings.filter((booking) => isApprovalQueueBookingStatus(booking.status)).length,
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
  onSavePetProfile,
  onSaveNotificationTiming,
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
  onSavePetProfile: (
    booking: DailyBooking,
    values: { name: string; breed: string; birthday: string | null; weight: number | null; biteLevel: PetBiteLevel },
  ) => Promise<void>;
  onSaveNotificationTiming: (
    booking: DailyBooking,
    values: { visitReminderOffsetMinutes?: number; pickupReadyEtaMinutes?: number },
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
  const [petProfileSaving, setPetProfileSaving] = useState(false);
  const [petProfileDraft, setPetProfileDraft] = useState({
    name: "",
    breed: "",
    birthday: "",
    weight: "",
    biteLevel: "none" as PetBiteLevel,
  });
  const [timingSaving, setTimingSaving] = useState(false);
  const [timingPickerOpen, setTimingPickerOpen] = useState<"visit" | "pickup" | null>(null);
  const [detailNotice, setDetailNotice] = useState("");
  const [detailEditMode, setDetailEditMode] = useState<"time" | "service" | "price" | null>(null);
  const detailNoticeTimerRef = useRef<number | null>(null);
  const timeEditorRef = useRef<HTMLDivElement | null>(null);
  const selectedPet = selectedBooking?.petId
    ? bootstrapData.pets.find((pet) => pet.id === selectedBooking.petId) ?? null
    : null;

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
    setTimingPickerOpen(null);
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
    setPetProfileDraft({
      name: selectedPet?.name ?? selectedBooking.pet,
      breed: selectedPet?.breed ?? selectedBooking.petBreed ?? "",
      birthday: selectedPet?.birthday ?? "",
      weight: typeof selectedPet?.weight === "number" ? String(selectedPet.weight) : "",
      biteLevel: normalizePetBiteLevel(selectedPet?.bite_level ?? selectedBooking.petBiteLevel),
    });
    setDetailNotice("");
  }, [
    selectedBooking?.id,
    selectedBooking?.start,
    selectedBooking?.duration,
    selectedBooking?.guardianPhone,
    selectedBooking?.service,
    selectedBooking?.servicePrice,
    selectedPet?.name,
    selectedPet?.breed,
    selectedPet?.birthday,
    selectedPet?.weight,
    selectedPet?.bite_level,
  ]);

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
  const overduePending = isOverduePendingBookingStatus(sourceStatus);
  const mainAction = isPendingBookingStatus(sourceStatus)
      ? { label: "예약 확정", onClick: () => onChangeStatus(selectedBooking.id, "확정"), enabled: true }
      : overduePending
        ? { label: "기한 지남", onClick: () => {}, enabled: false }
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
  const workflowPending = isApprovalQueueBookingStatus(sourceStatus);
  const workflowCompleted = isCompletedBookingStatus(sourceStatus) || isCompletedBookingStatus(displayStatus);
  const canResendCurrentNotification = !workflowPending && !changeEventSelected;
  const canSendVisitReminder = sourceStatus === "확정" || sourceStatus === "진행 중" || sourceStatus === "픽업 준비";
  const showWorkflowFooter = !workflowCompleted;
  const showVisitReminderTiming = sourceStatus === "확정" && !workflowPending && !changeEventSelected && !rescheduledEventSelected;
  const showPickupReadyTiming =
    (sourceStatus === "진행 중" || sourceStatus === "픽업 준비") &&
    !workflowPending &&
    !changeEventSelected &&
    !rescheduledEventSelected;
  const showNotificationTimingPanel = showPickupReadyTiming;
  const recentVisitHistory = selectedBooking
    ? getRecentVisitHistory(bootstrapData, selectedBooking)
    : { totalCount: 0, items: [] };
  const panelStatusBadgeLabel = workflowCompleted ? "기록 완료" : displayStatus || sourceStatus;
  const panelPhoneLabel = formatPanelPhoneNumber(editablePhone || selectedBooking.guardianPhone || "") || "연락처 없음";

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

  async function savePetProfile() {
    if (!selectedBooking) return;
    if (!selectedBooking.petId) {
      showTemporaryDetailNotice("반려동물 정보를 찾을 수 없습니다.");
      return;
    }

    const name = petProfileDraft.name.trim();
    const breed = petProfileDraft.breed.trim();
    const weightText = petProfileDraft.weight.trim().replace(/,/g, ".");
    const weight = weightText ? Number.parseFloat(weightText.replace(/[^0-9.]/g, "")) : null;

    if (!name) {
      showTemporaryDetailNotice("반려동물 이름을 입력해 주세요.");
      return;
    }
    if (!breed) {
      showTemporaryDetailNotice("품종을 입력해 주세요.");
      return;
    }
    if (weightText && (!Number.isFinite(weight) || (weight ?? 0) <= 0)) {
      showTemporaryDetailNotice("몸무게를 숫자로 입력해 주세요.");
      return;
    }

    setPetProfileSaving(true);
    try {
      await onSavePetProfile(selectedBooking, {
        name: selectedPet?.name ?? selectedBooking.pet,
        breed: selectedPet?.breed ?? selectedBooking.petBreed ?? breed,
        birthday: petProfileDraft.birthday.trim() || null,
        weight,
        biteLevel: normalizePetBiteLevel(petProfileDraft.biteLevel),
      });
      showTemporaryDetailNotice("저장되었습니다.");
    } catch (error) {
      showTemporaryDetailNotice(getApiErrorMessage(error, "반려동물 정보 저장 중 문제가 발생했습니다."));
    } finally {
      setPetProfileSaving(false);
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

  async function saveNotificationTiming(values: { visitReminderOffsetMinutes?: number; pickupReadyEtaMinutes?: number }) {
    if (!selectedBooking || timingSaving) return;
    setTimingSaving(true);
    setNotificationNotice("");
    try {
      await onSaveNotificationTiming(selectedBooking, values);
      setTimingPickerOpen(null);
      showTemporaryDetailNotice("저장되었습니다.");
    } catch (error) {
      showTemporaryDetailNotice(getApiErrorMessage(error, "알림 시간을 저장하지 못했습니다."));
    } finally {
      setTimingSaving(false);
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
            <div className="rounded-[8px] border border-[#e2e8f0] bg-white p-3">
              <div className="flex items-center gap-3">
                <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-[#dbe2ea] bg-[#f8fafc]">
                  <img src="/images/default-pet-profile.png" alt="" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="grid min-w-0 grid-rows-[24px_22px_22px] items-center gap-y-0.5">
                    <p className="flex h-6 min-w-0 items-center gap-2 leading-6">
                      <span className="min-w-0 truncate text-[17px] font-semibold text-[#111827]">{selectedBooking.pet}</span>
                      <span className="shrink-0 text-[15px] text-[#cbd5e1]">|</span>
                      <span className="relative top-px min-w-0 truncate text-[16px] text-[#64748b]">{breedLabel}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-[#eefaf5] px-2.5 py-1 text-[13px] leading-none text-[#2f7866]">
                        {panelStatusBadgeLabel}
                      </span>
                    </p>
                    <p className="flex h-[22px] min-w-0 items-center truncate text-[16px] leading-[22px] text-[#334155]">{selectedBooking.customer} 보호자</p>
                    <p className="flex h-[22px] min-w-0 items-center gap-1.5 text-[15px] leading-[22px] text-[#64748b]">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[#64748b]" />
                      <span className="whitespace-nowrap tabular-nums">{panelPhoneLabel}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 border-t border-[#edf2f7] pt-2.5">
                <div className="grid grid-cols-[0.74fr_1.26fr] gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[15px] leading-5 text-[#64748b]">몸무게</span>
                    <input
                      value={petProfileDraft.weight}
                      onChange={(event) => setPetProfileDraft((current) => ({ ...current, weight: event.target.value }))}
                      inputMode="decimal"
                      placeholder="kg"
                      className="h-9 w-full rounded-[9px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] leading-6 text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[15px] leading-5 text-[#64748b]">아이 생일</span>
                    <input
                      type="date"
                      value={petProfileDraft.birthday}
                      onChange={(event) => setPetProfileDraft((current) => ({ ...current, birthday: event.target.value }))}
                      className="h-9 w-full rounded-[9px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] leading-6 text-[#0f172a] outline-none focus:border-[#2f7866]"
                    />
                  </label>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="shrink-0 text-[15px] leading-5 text-[#64748b]">입질</span>
                  <select
                    value={petProfileDraft.biteLevel}
                    onChange={(event) => setPetProfileDraft((current) => ({ ...current, biteLevel: normalizePetBiteLevel(event.target.value) }))}
                    className="h-9 w-[176px] appearance-none rounded-[9px] border border-[#dbe2ea] bg-white bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2216%22%20height=%2216%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%2364748b%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[length:15px_15px] bg-[right_14px_center] bg-no-repeat px-2.5 pr-10 text-[16px] leading-6 text-[#0f172a] outline-none transition focus:border-[#64748b]"
                  >
                    {(["none", "mild", "watch", "bite", "strong"] as PetBiteLevel[]).map((level) => (
                      <option key={level} value={level}>
                        {getPetBiteLevelLabel(level)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void savePetProfile()}
                    disabled={petProfileSaving}
                    className="ml-auto inline-flex h-9 min-w-[64px] items-center justify-center rounded-[9px] border border-[#dbe2ea] bg-white px-3 text-[15px] text-[#334155] shadow-[0_1px_0_rgba(15,23,42,0.03)] transition hover:border-[#94a3b8] hover:bg-[#f8fafc] disabled:cursor-wait disabled:opacity-70"
                  >
                    {petProfileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white px-3.5 pb-3">
            <div className="flex min-h-[24px] items-center gap-1.5 text-left">
              <ClipboardList className="h-[18px] w-[18px] shrink-0 text-[#334155]" />
              <span className="text-[16px] font-normal text-[#334155]">서비스 내역</span>
            </div>
            <section className="mt-1.5 rounded-[8px] border border-[#dbe2ea] bg-white p-3">
              <div className="space-y-1.5">
                <BookingDetailInfoRow label="시술명" value={editableServiceName || "시술명 없음"} />
                <BookingDetailInfoRow label="가격" value={editablePrice || "0"} tabular />
                <BookingDetailInfoRow label="예약 시간" value={timeRange} tabular />
                <BookingDetailInfoRow label="담당자" value={selectedBooking.staffName || selectedBooking.staff || "담당 미지정"} />
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
                "mt-1.5 rounded-[8px] border border-[#dbe2ea] bg-[#fbfdff] px-3 py-2.5 text-[16px] leading-7 text-[#334155]",
                hasRequestText ? "min-h-[78px]" : "min-h-[48px]",
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
            <div className="mt-1.5 min-h-[78px] rounded-[8px] border border-[#dbe2ea] bg-[#fbfdff] px-3 py-2.5 text-[16px] leading-7 text-[#334155]">
              {staffComment.trim() ? (
                staffComment.split("\n").map((line, index) => <p key={`${line}-${index}`}>{line}</p>)
              ) : (
                <p className="text-[#64748b]">공유 코멘트가 없습니다.</p>
              )}
            </div>
          </section>

          <section className="py-1.5">
            <div className="flex min-h-[24px] items-center gap-1.5 text-left">
              <History className="h-[18px] w-[18px] shrink-0 text-[#334155]" />
              <span className="shrink-0 text-[16px] font-normal text-[#334155]">최근 방문이력</span>
              <span className="ml-auto text-[14px] text-[#64748b]">총 {recentVisitHistory.totalCount}회</span>
            </div>
            <div className="mt-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2">
              {recentVisitHistory.items.length > 0 ? (
                <div>
                  <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-[#edf2f7] pb-2 text-[13px] text-[#94a3b8]">
                    <span>방문일</span>
                    <span className="text-right">서비스</span>
                  </div>
                  {recentVisitHistory.items.map((visit) => (
                    <div key={visit.id} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-[#edf2f7] py-2.5 last:border-b-0 last:pb-0">
                      <span className="shrink-0 text-[16px] font-normal tabular-nums text-[#0f172a]">{visit.date}</span>
                      <p className="min-w-0 truncate text-right text-[16px] font-normal text-[#64748b]">{visit.service}</p>
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

          {showWorkflowFooter ? (
          <section className="shrink-0 bg-white px-3.5 pb-3 pt-2.5">
            {showNotificationTimingPanel ? (
              <div className="mb-2 rounded-[8px] bg-[#f8fafc] px-3 py-2">
                <div className="grid gap-2">
                  {showVisitReminderTiming ? (
                    <div className="relative flex items-center justify-between gap-3">
                      <span className="text-[15px] text-[#475569]">방문 전 알림</span>
                      <button
                        type="button"
                        disabled={timingSaving}
                        onClick={() => setTimingPickerOpen((current) => (current === "visit" ? null : "visit"))}
                        className="inline-flex h-9 min-w-[96px] items-center justify-center rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[15px] text-[#334155] transition hover:bg-[#f8fafc]"
                      >
                        {selectedBooking.visitReminderOffsetMinutes ?? 10}분 전
                      </button>
                      {timingPickerOpen === "visit" ? (
                        <div className="absolute right-0 top-10 z-20 grid w-[120px] overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white p-1 shadow-[0_10px_28px_rgba(15,23,42,0.14)]">
                          {visitReminderOffsetOptions.map((minutes) => (
                            <button
                              key={minutes}
                              type="button"
                              disabled={timingSaving}
                              onClick={() => void saveNotificationTiming({ visitReminderOffsetMinutes: minutes })}
                              className={cn(
                                "h-9 rounded-[6px] px-3 text-left text-[15px] transition hover:bg-[#f8fafc]",
                                (selectedBooking.visitReminderOffsetMinutes ?? 10) === minutes
                                  ? "text-[#0f172a]"
                                  : "text-[#334155]",
                              )}
                            >
                              {minutes}분 전
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {showPickupReadyTiming ? (
                      <div className="relative">
                        <div className="grid h-10 grid-cols-[112px_minmax(0,1fr)] overflow-visible rounded-[8px] border border-[#dbe2ea] bg-white">
                        <button
                          type="button"
                          disabled={timingSaving}
                          onClick={() => setTimingPickerOpen((current) => (current === "pickup" ? null : "pickup"))}
                            className="inline-flex min-w-0 items-center justify-center border-r border-[#e2e8f0] px-3 text-[15px] text-[#334155] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="픽업 안내 시간 선택"
                        >
                          {selectedBooking.pickupReadyEtaMinutes ?? 5}분 후
                        </button>
                          <button
                            type="button"
                            disabled={notificationSending}
                            onClick={() => void sendWorkflowAlimtalk("grooming_almost_done", "픽업 안내 알림톡 발송 요청이 완료되었습니다.")}
                            className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-r-[8px] bg-[#334155] px-3 text-[15px] text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Send className="h-4 w-4 shrink-0" />
                            픽업 안내
                          </button>
                        </div>
                        {timingPickerOpen === "pickup" ? (
                          <div className="absolute bottom-11 left-0 z-30 grid w-[112px] overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white p-1 shadow-[0_10px_28px_rgba(15,23,42,0.14)]">
                            {pickupReadyEtaOptions.map((minutes) => (
                              <button
                                key={minutes}
                              type="button"
                              disabled={timingSaving}
                              onClick={() => void saveNotificationTiming({ pickupReadyEtaMinutes: minutes })}
                              className={cn(
                                "h-9 rounded-[6px] px-3 text-left text-[15px] transition hover:bg-[#f8fafc]",
                                (selectedBooking.pickupReadyEtaMinutes ?? 5) === minutes
                                  ? "text-[#0f172a]"
                                  : "text-[#334155]",
                              )}
                            >
                              {minutes}분 후
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="grid gap-2">
              {changeEventSelected ? (
                <button
                  type="button"
                  onClick={() => onAcknowledgeChange(selectedBooking.id)}
                  className="h-10 rounded-[8px] bg-[#334155] text-[16px] text-white transition hover:bg-[#1f2937]"
                >
                  변경/취소 확인
                </button>
                ) : isPendingBookingStatus(sourceStatus) ? (
                <button
                  type="button"
                  onClick={() => onChangeStatus(selectedBooking.id, "확정")}
                  className="h-10 rounded-[8px] bg-[#334155] text-[16px] text-white transition hover:bg-[#1f2937]"
                >
                  예약 확정
                </button>
              ) : sourceStatus === "확정" ? (
                <button
                  type="button"
                  onClick={() => onChangeStatus(selectedBooking.id, "진행 중")}
                  className="h-10 rounded-[8px] bg-[#334155] text-[16px] text-white transition hover:bg-[#1f2937]"
                >
                  미용 시작
                </button>
              ) : sourceStatus === "진행 중" ? (
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeStatus(selectedBooking.id, "픽업 준비")}
                    className="h-10 rounded-[8px] bg-[#334155] text-[16px] text-white transition hover:bg-[#1f2937]"
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
                      className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[16px] text-[#334155] transition hover:bg-[#f8fafc]"
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
                    className="h-10 rounded-[8px] bg-[#334155] text-[16px] text-white transition hover:bg-[#1f2937]"
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
                    <div className="relative grid h-10 grid-cols-[minmax(0,1fr)_auto] overflow-visible rounded-[8px] border border-[#dbe2ea] bg-white">
                      <button
                        type="button"
                        disabled={!canSendVisitReminder || notificationSending}
                        onClick={() => void sendWorkflowAlimtalk("appointment_reminder_10m", "방문 안내 알림톡 발송 요청이 완료되었습니다.")}
                        className="inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-l-[8px] px-3 text-[15px] text-[#475569] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send className="h-4 w-4 shrink-0 text-[#64748b]" />
                        방문 전 알림
                      </button>
                      <button
                        type="button"
                        disabled={timingSaving}
                        onClick={() => setTimingPickerOpen((current) => (current === "visit" ? null : "visit"))}
                        className="inline-flex min-w-[76px] items-center justify-center border-l border-[#e2e8f0] px-2.5 text-[14px] text-[#334155] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="방문 전 알림 시간 선택"
                      >
                        {selectedBooking.visitReminderOffsetMinutes ?? 10}분 전
                      </button>
                      {timingPickerOpen === "visit" ? (
                        <div className="absolute bottom-11 right-0 z-30 grid w-[112px] overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white p-1 shadow-[0_10px_28px_rgba(15,23,42,0.14)]">
                          {visitReminderOffsetOptions.map((minutes) => (
                            <button
                              key={minutes}
                              type="button"
                              disabled={timingSaving}
                              onClick={() => void saveNotificationTiming({ visitReminderOffsetMinutes: minutes })}
                              className={cn(
                                "h-9 rounded-[6px] px-3 text-left text-[15px] transition hover:bg-[#f8fafc]",
                                (selectedBooking.visitReminderOffsetMinutes ?? 10) === minutes
                                  ? "text-[#0f172a]"
                                  : "text-[#334155]",
                              )}
                            >
                              {minutes}분 전
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {notificationNotice ? <p className="text-[15px] leading-6 text-[#64748b]">{notificationNotice}</p> : null}
            </div>
          </section>
          ) : null}
      </WebSurface>
    </aside>
  );

}

type TimeProposalRow = { id: string; start: string; end: string };

const timeProposalDefaultMessage =
  "신청해주신 예약 시간은 매장 사정으로 인해 확정이 어려워, 가능한 다른 시간을 안내드립니다. 아래 추천 시간 중 편하신 일정을 선택해 주세요.";

const cancelDefaultMessage =
  "신청해주신 예약은 매장 사정으로 인해 부득이하게 취소 처리되었습니다. 이용에 불편을 드려 죄송합니다.";

function formatPanelDateLabel(date: string) {
  if (date === currentDateInTimeZone()) return "오늘";
  const match = date.slice(0, 10).match(/^(\d{4})[-.](\d{2})[-.](\d{2})$/);
  if (match) return `${match[1].slice(-2)}.${match[2]}.${match[3]}`;
  const [year, month, day] = date.split("-").map(Number);
  return `${String(year).slice(-2)}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
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

function getRecentVisitHistory(
  data: BootstrapPayload,
  booking: DailyBooking,
): { totalCount: number; items: RecentVisitHistoryItem[] } {
  const records = data.groomingRecords
    .filter((record) => {
      if (booking.petId && record.pet_id === booking.petId) return true;
      if (booking.guardianId && record.guardian_id === booking.guardianId) return true;
      return false;
    })
    .sort((first, second) => second.groomed_at.localeCompare(first.groomed_at));

  return {
    totalCount: records.length,
    items: records
    .slice(0, 3)
    .map((record) => {
      const service = data.services.find((item) => item.id === record.service_id);
      return {
        id: record.id,
        date: formatPanelDateLabel(record.groomed_at.slice(0, 10)),
        service: service?.name ?? booking.service,
        note: [record.style_notes, record.memo].map((item) => item?.trim()).filter(Boolean).join(" · "),
      };
    }),
  };
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

function BookingDetailInfoRow({
  label,
  value,
  tabular = false,
}: {
  label: string;
  value: ReactNode;
  tabular?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[92px_minmax(0,1fr)] items-center gap-2 text-[16px] leading-7">
      <span className="text-[#0f172a]">{label}</span>
      <span className={cn("min-w-0 truncate text-[#64748b]", tabular && "tabular-nums")}>{value}</span>
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
            <button type="button" onClick={onStart} className="h-9 rounded-[8px] bg-[#334155] px-3 text-[13px] font-medium text-white hover:bg-[#1f2937]">
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
                ? "bg-[#334155] text-white shadow-[0_10px_20px_rgba(15,23,42,0.12)] hover:bg-[#1f2937]"
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
  const isPending = isApprovalQueueBookingStatus(sourceStatus);

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
            <button type="button" onClick={() => onChangeStatus(booking.id, "진행 중")} className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#334155] text-[18px] font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.12)] hover:bg-[#1f2937]">
              <Play className="h-5 w-5" />
              미용 시작하기
            </button>
          ) : canComplete ? (
            <button type="button" onClick={() => onChangeStatus(booking.id, "픽업 준비")} className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#334155] text-[18px] font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.12)] hover:bg-[#1f2937]">
              <Scissors className="h-5 w-5" />
              미용 완료하기
            </button>
          ) : canFinish ? (
            <button type="button" onClick={() => onChangeStatus(booking.id, "완료")} className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#334155] text-[18px] font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.12)] hover:bg-[#1f2937]">
              <CheckCircle2 className="h-5 w-5" />
              완료 처리하기
            </button>
          ) : completed ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="h-11 rounded-[8px] bg-[#334155] text-[14px] font-medium text-white hover:bg-[#1f2937]">완료 내역 보기</button>
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
  const overdue = isOverduePendingBookingStatus(booking.sourceStatus ?? booking.status);
  const badgeClass = overdue
    ? "border-[#ead6dc] bg-[#fffafa] text-[#8f2438]"
    : "border-[#e8c67e] bg-[#fff7ed] text-[#9a640f]";

  return (
    <>
      <section className={cn("rounded-[8px] border bg-white p-5", overdue ? "border-[#ead6dc]" : "border-[#ead7c7]")}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className={cn("inline-flex rounded-full border px-3 py-1.5 text-[15px] font-medium", badgeClass)}>
              {overdue ? overduePendingStatusLabel : "승인대기 예약"}
            </span>
            <p className={cn("mt-3 text-[15px] font-medium", overdue ? "text-[#8f2438]" : "text-[#9a640f]")}>
              {overdue ? "처리 기한이 지난 예약입니다. 다른 시간 안내 또는 예약 거절로 정리해 주세요." : "고객이 예약 확정을 기다리는 중입니다."}
            </p>
            <p className="mt-3 text-[26px] font-semibold tracking-[-0.03em] text-[#111827]">{formatPanelDateLabel(selectedDate)} {timeRange}</p>
            <p className="mt-2 text-[20px] font-semibold text-[#111827]">{booking.pet} · {profile.breed} · {profile.weight}</p>
            <p className="mt-1 text-[16px] font-medium text-[#334155]">{booking.service}</p>
          </div>
          <PetImageBlock pet={booking.pet} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {overdue ? (
            <div className="col-span-2 rounded-[8px] border border-[#ead6dc] bg-[#fffafa] px-4 py-3 text-[15px] leading-6 text-[#8f2438]">
              지난 예약은 바로 확정할 수 없습니다.
            </div>
          ) : (
            <button type="button" onClick={() => onChangeStatus(booking.id, "확정")} className="col-span-2 min-h-[56px] rounded-[8px] bg-[#b98121] text-[18px] font-semibold text-white shadow-[0_10px_20px_rgba(185,129,33,0.16)] hover:bg-[#9a640f]">
              예약 확정
            </button>
          )}
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
          <InfoRow label="담당자" value={booking.staffName || booking.staff || "담당 미지정"} />
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

        <div className="mb-4">
          <h3 className="text-[18px] font-medium text-[#111827]">{action.title}</h3>
          {action.description ? (
            <p className="mt-1 text-[14px] leading-6 text-[#64748b]">{action.description}</p>
          ) : null}
        </div>

        <div className="rounded-[10px] bg-[#fbfcfd] p-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-[#2f7866]" />
            <p className="text-[15px] font-medium text-[#111827]">모바일로 촬영하기</p>
          </div>
          <div className="mt-3 flex justify-center rounded-[10px] bg-white p-3">
            <img src={qrImageUrl} alt="모바일 오너 촬영 QR 코드" className="h-[176px] w-[176px]" />
          </div>
          <p className="mt-3 text-center text-[13px] leading-5 text-[#64748b]">
            {action.mobileDescription}
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
            className="inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[#334155] px-3 text-[15px] text-white hover:bg-[#1f2937] disabled:opacity-60"
          >
            {saving ? "처리 중" : action.skipLabel}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] text-[#334155] hover:bg-[#f8fafc] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {action.buttonLabel}
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
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#334155] px-3 text-[14px] font-medium text-white transition hover:bg-[#1f2937] disabled:cursor-wait disabled:opacity-70"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            알림톡 보내기
          </button>
        </div>
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
            const timedStatus = getTimedBookingStatus(normalizedBooking, selectedDate, scheduleStatusHour);
            const sourceStatus = isOverduePendingBookingStatus(timedStatus) ? timedStatus : normalizedBooking.status;
            return {
              ...normalizedBooking,
              sourceStatus,
              status: timedStatus,
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

  const filteredBookings = displayScopedBookings.filter((booking) => isTimelineBookingStatus(booking.status));

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

  async function persistBookingPetProfileChange(
    booking: DailyBooking,
    values: { name: string; breed: string; birthday: string | null; weight: number | null; biteLevel: PetBiteLevel },
  ) {
    if (!booking.petId) throw new Error("반려동물 정보를 찾을 수 없습니다.");

    const currentPet = bootstrapData.pets.find((item) => item.id === booking.petId);
    const savedPet = await patchOwnerPet({
      shopId: bootstrapData.shop.id,
      petId: booking.petId,
      name: values.name,
      breed: values.breed,
      birthday: values.birthday,
      weight: values.weight,
      biteLevel: values.biteLevel,
      notes: currentPet?.notes ?? booking.petNotes ?? "",
      groomingCycleWeeks: currentPet?.grooming_cycle_weeks ?? 4,
    });

    const nextBootstrapData = {
      ...bootstrapData,
      pets: bootstrapData.pets.map((item) => (item.id === savedPet.id ? { ...item, ...savedPet } : item)),
    };

    setBootstrapData(nextBootstrapData);
    onDataChange?.(nextBootstrapData);
    setBookings((current) =>
      current.map((item) =>
        item.petId === savedPet.id
          ? {
              ...item,
              pet: savedPet.name,
              petBreed: savedPet.breed,
              petWeight: savedPet.weight,
              petAge: savedPet.age,
              petNotes: savedPet.notes,
              petBiteLevel: normalizePetBiteLevel(savedPet.bite_level),
            }
          : item,
      ),
    );
  }

  async function persistBookingNotificationTiming(
    booking: DailyBooking,
    values: { visitReminderOffsetMinutes?: number; pickupReadyEtaMinutes?: number },
  ) {
    const appointment = bootstrapData.appointments.find((item) => item.id === booking.id);
    if (!appointment) throw new Error("예약 정보를 찾을 수 없습니다.");

    const updatedAppointment = await fetchApiJsonWithAuth<Appointment>("/api/appointments", {
      method: "PATCH",
      body: JSON.stringify({
        appointmentId: appointment.id,
        shopId: bootstrapData.shop.id,
        serviceId: appointment.service_id,
        staffId: appointment.staff_id ?? booking.staffKey,
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointment.appointment_time.slice(0, 5),
        durationMinutes: Math.round(minutesBetween(appointment.start_at, appointment.end_at) ?? booking.duration * 60),
        memo: appointment.memo ?? "",
        visitReminderOffsetMinutes:
          values.visitReminderOffsetMinutes ?? appointment.visit_reminder_offset_minutes ?? 10,
        pickupReadyEtaMinutes:
          values.pickupReadyEtaMinutes ?? appointment.pickup_ready_eta_minutes ?? 5,
        enforceShopCapacity: false,
        allowOutsideShopHours: true,
        notifyCustomer: false,
        preserveStatus: true,
      }),
    });

    const nextBootstrapData = replaceAppointmentInBootstrap(bootstrapData, updatedAppointment);
    setBootstrapData(nextBootstrapData);
    onDataChange?.(nextBootstrapData);
    setBookings((current) =>
      current.map((item) =>
        item.id === booking.id
          ? {
              ...item,
              visitReminderOffsetMinutes:
                updatedAppointment.visit_reminder_offset_minutes ?? values.visitReminderOffsetMinutes ?? 10,
              pickupReadyEtaMinutes:
                updatedAppointment.pickup_ready_eta_minutes ?? values.pickupReadyEtaMinutes ?? 5,
            }
          : item,
      ),
    );
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
      buttonLabel: "사진 선택",
      skipLabel: "사진 없이 미용 완료",
      mobileDescription: "휴대폰으로 QR을 스캔해 사진을 촬영하고 미용 완료를 처리하세요.",
    });
  }

  function requestBeforePhotoStatusChange(booking: DailyBooking) {
    setPhotoStatusAction({
      bookingId: booking.id,
      nextStatus: "진행 중",
      mediaKind: "grooming_before",
      title: "미용 전 사진",
      description: "",
      buttonLabel: "사진 선택",
      skipLabel: "사진 없이 미용 시작",
      mobileDescription: "휴대폰으로 QR을 스캔해 미용 전 상태를 촬영하고 미용을 시작하세요.",
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

    if (targetBooking && nextStatus === "진행 중" && canStartGrooming(targetBooking.status)) {
      void applyBookingStatusChange(bookingId, nextStatus);
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
        if (message.includes("로그인이 필요")) {
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
        if (message.includes("로그인이 필요")) {
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
          getAvailableSlots={({ date, duration, staffKey }) => {
            const dateBookings =
              date === selectedDate
                ? bookings
                : buildDailyBookingsFromBootstrap(bootstrapData, date, staffAssignments, visibleStaff);
            return buildOwnerCreateAvailableSlots({
              shop: bootstrapData.shop,
              date,
              duration,
              staffKey,
              staffMembers,
              staffScheduleOverrides: bootstrapData.staffScheduleOverrides,
              bookings: dateBookings,
            });
          }}
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
                className="h-11 rounded-[8px] bg-[#334155] text-[15px] font-medium text-white transition hover:bg-[#1f2937]"
              >
                변경하기
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {boardError ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/25 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-board-error-title"
          onClick={() => setBoardError("")}
        >
          <div
            className="w-full max-w-[420px] rounded-[12px] border border-[#ead6dc] bg-white p-5 shadow-[0_22px_70px_rgba(15,23,42,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 id="schedule-board-error-title" className="text-[18px] font-semibold text-[#111827]">
                  처리할 수 없어요
                </h3>
                <p className="mt-2 text-[16px] leading-7 text-[#475569]">{boardError}</p>
              </div>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setBoardError("")}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setBoardError("")}
              className="mt-5 h-11 w-full rounded-[8px] bg-[#334155] text-[16px] font-medium text-white transition hover:bg-[#1f2937]"
            >
              확인
            </button>
          </div>
        </div>
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
            onSavePetProfile={persistBookingPetProfileChange}
            onSaveNotificationTiming={persistBookingNotificationTiming}
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
                className="h-10 rounded-[8px] bg-[#334155] text-[14px] font-medium text-white hover:bg-[#1f2937]"
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






