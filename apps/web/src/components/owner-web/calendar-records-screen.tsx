"use client";

import {
  IconSearch,
  IconCalendarEvent,
  IconCalendarPlus as CalendarPlus,
  IconFileImport,
  IconChevronDown as ChevronDown,
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconPaw as PawPrint,
  IconPlus,
  IconX as X,
} from "@tabler/icons-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarHolidayLabel, ShopCalendarAgenda } from "@petmanager/shared/components/shop-calendar-agenda";
import { SupportProgramList } from "@petmanager/shared/components/support-program-list";
import type { SupportProgram } from "@petmanager/shared/contracts/support-programs";
import { calendarSecondaryButtonClass } from "@petmanager/shared/components/calendar-dialog";
import { calendarHolidaysByDate, layoutShopEventBars, shopEventsOnDate } from "@petmanager/shared/lib/owner-calendar";
import { useCalendarHolidays, useShopCalendarEvents } from "@petmanager/shared/lib/use-owner-calendar";
import { useSupportPrograms } from "@petmanager/shared/lib/use-support-programs";

import { fetchOwnerScheduleRange, replaceScheduleRangeInBootstrap } from "@/components/owner-web/calendar-owner-api";
import { OwnerMediaUploadPanel } from "@/components/owner-web/media-upload-panel";
import { OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS } from "@/components/owner-web/owner-web-action-button-styles";
import { getDotIndicatorClass, getWrapIndicatorClass, statusIndicatorBgClass, statusIndicatorColor, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { fetchApiJson, fetchApiJsonWithAuth } from "@/lib/api";
import { isShopClosedOnDate } from "@/lib/availability";
import { cn, currentDateInTimeZone, formatClockTime } from "@/lib/utils";
import type { AppointmentChangeEvent, AppointmentStatus, BootstrapPayload } from "@/types/domain";

const BookingPreparationPanel = dynamic(() => import("@/components/booking/booking-preparation-panel"));
const CalendarImportDialog = dynamic(() => import("@/components/owner-web/calendar-import-dialog"));

type GroomingCalendarRecord = {
  id: string;
  guardianId: string;
  petId: string;
  appointmentId: string | null;
  pet: string;
  breed: string;
  customer: string;
  phone: string;
  service: string;
  memo: string;
  customerRequest: string;
  staffComment: string;
  next: string;
  date: string;
  time: string;
  staffId: string | null;
  staff: string;
  eventReceivedAt?: string | null;
  reservationConfirmedAt?: string | null;
  groomingStartedAt?: string | null;
  pickupReadyAt?: string | null;
  recordCreatedAt?: string | null;
  recordCompletedAt?: string | null;
};

type ReservationRow = {
  id: string;
  guardianId: string;
  petId: string;
  pet: string;
  breed: string;
  customer: string;
  service: string;
  status: string;
  note: string;
  customerRequest: string;
  staffComment: string;
  date: string;
  time: string;
  staffId: string | null;
  staff: string;
  phone: string;
  channel: string;
  eventReceivedAt?: string | null;
  eventUpdatedAt?: string | null;
  reservationConfirmedAt?: string | null;
  groomingStartedAt?: string | null;
  pickupReadyAt?: string | null;
  groomingCompletedAt?: string | null;
  actualCompletedAt?: string | null;
};

type DayItem = {
  id: string;
  type: "record" | "reservation";
  guardianId: string;
  petId: string;
  appointmentId?: string | null;
  groomingRecordId?: string | null;
  pet: string;
  breed?: string;
  customer: string;
  service: string;
  status: string;
  note: string;
  customerRequest?: string;
  staffComment?: string;
  date: string;
  next?: string;
  time?: string;
  staffId?: string | null;
  staff?: string;
  phone?: string;
  channel?: string;
  eventReceivedAt?: string | null;
  eventUpdatedAt?: string | null;
  reservationConfirmedAt?: string | null;
  groomingStartedAt?: string | null;
  pickupReadyAt?: string | null;
  groomingCompletedAt?: string | null;
  recordCreatedAt?: string | null;
  recordCompletedAt?: string | null;
  actualCompletedAt?: string | null;
};

type BirthdayItem = {
  id: string;
  petId: string;
  guardianId: string;
  pet: string;
  breed: string;
  customer: string;
  phone: string;
  birthday: string;
};

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const staffDayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  pending: "예약 대기",
  confirmed: "예약 확정",
  in_progress: "진행 중",
  almost_done: "픽업 준비",
  completed: "완료",
  cancelled: "취소",
  rejected: "거절",
  noshow: "노쇼",
};
function buildBootstrapLookup(data: BootstrapPayload) {
  const notificationsByAppointmentId = new Map<string, BootstrapPayload["notifications"]>();
  for (const notification of data.notifications ?? []) {
    if (!notification.appointment_id) continue;
    const current = notificationsByAppointmentId.get(notification.appointment_id) ?? [];
    current.push(notification);
    notificationsByAppointmentId.set(notification.appointment_id, current);
  }

  return {
    guardianById: new Map(data.guardians.map((guardian) => [guardian.id, guardian])),
    petById: new Map(data.pets.map((pet) => [pet.id, pet])),
    serviceById: new Map(data.services.map((service) => [service.id, service])),
    appointmentById: new Map(data.appointments.map((appointment) => [appointment.id, appointment])),
    staffById: new Map(data.staffMembers.map((staff) => [staff.id, staff])),
    staffNoteByPetId: new Map((data.petStaffNotes ?? []).filter((note) => note.pet_id).map((note) => [note.pet_id as string, note])),
    notificationsByAppointmentId,
  };
}

function displayText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function formatRecordPhone(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "연락처 미입력";

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return trimmed;
}

function getNotificationEventTime(notifications: BootstrapPayload["notifications"] | undefined, type: string) {
  return (notifications ?? [])
    .filter((notification) => notification.type === type)
    .map((notification) => notification.sent_at ?? notification.created_at)
    .filter((value): value is string => Boolean(value))
    .sort((first, second) => first.localeCompare(second))[0] ?? null;
}

function buildReservationsFromBootstrap(data: BootstrapPayload): ReservationRow[] {
  const { guardianById, petById, serviceById, staffById, staffNoteByPetId, notificationsByAppointmentId } = buildBootstrapLookup(data);

  return data.appointments.map((appointment) => {
    const guardian = guardianById.get(appointment.guardian_id);
    const pet = petById.get(appointment.pet_id);
    const service = serviceById.get(appointment.service_id);
    const staff = appointment.staff_id ? staffById.get(appointment.staff_id) : null;
    const customerRequest = appointment.memo?.trim() ?? "";
    const staffComment = staffNoteByPetId.get(appointment.pet_id)?.note?.trim() ?? "";
    const notifications = notificationsByAppointmentId.get(appointment.id);
    const status = appointmentStatusLabels[appointment.status] ?? appointment.status;

    return {
      id: appointment.id,
      guardianId: appointment.guardian_id,
      petId: appointment.pet_id,
      pet: displayText(pet?.name, "반려동물 미등록"),
      breed: displayText(pet?.breed, "품종 미입력"),
      customer: displayText(guardian?.name, "보호자 미등록"),
      phone: guardian?.phone ?? "",
      service: displayText(service?.name, "서비스 미등록"),
      status,
      note: customerRequest || "요청 메모가 없습니다.",
      customerRequest,
      staffComment,
      date: appointment.appointment_date,
      time: appointment.appointment_time,
      staffId: appointment.staff_id ?? null,
      staff: displayText(staff?.name, "담당 미지정"),
      channel: appointment.source === "customer" ? "고객 예약" : "오너 등록",
      eventReceivedAt: appointment.created_at,
      eventUpdatedAt: appointment.updated_at,
      reservationConfirmedAt: getNotificationEventTime(notifications, "booking_confirmed"),
      groomingStartedAt: appointment.actual_started_at ?? getNotificationEventTime(notifications, "grooming_started"),
      pickupReadyAt: getNotificationEventTime(notifications, "grooming_almost_done"),
      groomingCompletedAt: appointment.actual_completed_at ?? getNotificationEventTime(notifications, "grooming_completed"),
      actualCompletedAt: appointment.actual_completed_at,
    };
  });
}

function buildRecordsFromBootstrap(data: BootstrapPayload): GroomingCalendarRecord[] {
  const { guardianById, petById, serviceById, appointmentById, staffById, staffNoteByPetId, notificationsByAppointmentId } = buildBootstrapLookup(data);

  return data.groomingRecords.map((record) => {
    const linkedAppointment = record.appointment_id ? appointmentById.get(record.appointment_id) : null;
    const guardian = guardianById.get(record.guardian_id) ?? (linkedAppointment ? guardianById.get(linkedAppointment.guardian_id) : undefined);
    const pet = petById.get(record.pet_id) ?? (linkedAppointment ? petById.get(linkedAppointment.pet_id) : undefined);
    const service = serviceById.get(record.service_id) ?? (linkedAppointment ? serviceById.get(linkedAppointment.service_id) : undefined);
    const staff = linkedAppointment?.staff_id ? staffById.get(linkedAppointment.staff_id) : null;
    const staffNotePetId = pet?.id ?? linkedAppointment?.pet_id ?? record.pet_id;
    const customerRequest = linkedAppointment?.memo?.trim() || record.style_notes?.trim() || "";
    const staffComment = staffNoteByPetId.get(staffNotePetId)?.note?.trim() || record.memo?.trim() || "";
    const memoParts = [customerRequest, staffComment].map((item) => item?.trim()).filter(Boolean);
    const notifications = linkedAppointment ? notificationsByAppointmentId.get(linkedAppointment.id) : undefined;

    return {
      id: record.id,
      guardianId: guardian?.id ?? linkedAppointment?.guardian_id ?? record.guardian_id,
      petId: pet?.id ?? linkedAppointment?.pet_id ?? record.pet_id,
      appointmentId: record.appointment_id,
      pet: displayText(pet?.name, "반려동물 미등록"),
      breed: displayText(pet?.breed, "품종 미입력"),
      customer: displayText(guardian?.name, "보호자 미등록"),
      phone: guardian?.phone ?? "",
      service: displayText(service?.name, "서비스 미등록"),
      memo: memoParts.join(" · ") || "작성된 메모가 없습니다.",
      customerRequest,
      staffComment,
      next: "",
      date: record.groomed_at.slice(0, 10),
      time: getRecordClockTime(record.groomed_at),
      staffId: linkedAppointment?.staff_id ?? null,
      staff: displayText(staff?.name, "담당 미지정"),
      eventReceivedAt: linkedAppointment?.created_at ?? null,
      reservationConfirmedAt: getNotificationEventTime(notifications, "booking_confirmed"),
      groomingStartedAt: linkedAppointment?.actual_started_at ?? getNotificationEventTime(notifications, "grooming_started"),
      pickupReadyAt: getNotificationEventTime(notifications, "grooming_almost_done"),
      recordCreatedAt: record.created_at,
      recordCompletedAt: linkedAppointment?.actual_completed_at ?? getNotificationEventTime(notifications, "grooming_completed") ?? record.updated_at ?? record.groomed_at,
    };
  });
}

function normalizeRecordDate(date: string) {
  return date.replaceAll(".", "-");
}

function getRecordClockTime(value: string) {
  const timePart = value.includes("T") ? value.split("T")[1] : value.split(" ")[1];
  return timePart ? formatClockTime(timePart) : "";
}

function formatMonthLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월`;
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getMonth() + 1}.${parsed.getDate()}`;
}

function formatFullDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일 ${weekdayLabels[parsed.getDay()]}요일`;
}

function formatHistoryTimestamp(value?: string | null) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${getPart("month")}.${getPart("day")} (${getPart("weekday")}) ${getPart("hour").padStart(2, "0")}:${getPart("minute").padStart(2, "0")}`;
}

function formatHistoryFallback(date: string, time?: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getMonth() + 1}.${parsed.getDate()} (${weekdayLabels[parsed.getDay()]}) ${time || "-"}`;
}

function isSameMonthDay(sourceDate: string | null | undefined, targetDate: string) {
  if (!sourceDate) return false;
  const sourceParts = sourceDate.split("-");
  const targetParts = targetDate.split("-");
  if (sourceParts.length < 3 || targetParts.length < 3) return false;
  return sourceParts[1] === targetParts[1] && sourceParts[2] === targetParts[2];
}

function buildBirthdayItems(data: BootstrapPayload, date: string, query: string): BirthdayItem[] {
  const guardianById = new Map(data.guardians.map((guardian) => [guardian.id, guardian]));
  return data.pets
    .filter((pet) => isSameMonthDay(pet.birthday, date))
    .map((pet) => {
      const guardian = guardianById.get(pet.guardian_id);
      return {
        id: `birthday-${pet.id}-${date}`,
        petId: pet.id,
        guardianId: pet.guardian_id,
        pet: displayText(pet.name, "반려동물 미등록"),
        breed: displayText(pet.breed, "품종 미입력"),
        customer: displayText(guardian?.name, "보호자 미등록"),
        phone: guardian?.phone ?? "",
        birthday: pet.birthday ?? "",
      };
    })
    .filter((item) => matchesCalendarSearch([item.pet, item.breed, item.customer, item.phone], query))
    .sort((first, second) => first.pet.localeCompare(second.pet, "ko"));
}

function getMonthDates(monthAnchor: string) {
  const parsed = new Date(`${monthAnchor}T00:00:00`);
  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const dates: Array<string | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) dates.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) dates.push(new Date(year, month, day).toLocaleDateString("en-CA"));
  while (dates.length % 7 !== 0) dates.push(null);

  return dates;
}

function getMonthRange(monthAnchor: string) {
  const parsed = new Date(`${monthAnchor}T00:00:00`);
  const year = parsed.getFullYear();
  const month = parsed.getMonth();

  return {
    from: new Date(year, month, 1).toLocaleDateString("en-CA"),
    to: new Date(year, month + 1, 0).toLocaleDateString("en-CA"),
  };
}

function moveMonth(date: string, offset: number) {
  const parsed = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  parsed.setUTCMonth(parsed.getUTCMonth() + offset);
  return parsed.toISOString().slice(0, 10);
}

function buildDayItems(records: GroomingCalendarRecord[], reservations: ReservationRow[], date: string): DayItem[] {
  const shouldShowReservations = date >= currentDateInTimeZone();
  const recordItems: DayItem[] = records
    .filter((record) => normalizeRecordDate(record.date) === date)
    .map((record) => ({
      id: record.id,
      type: "record" as const,
      guardianId: record.guardianId,
      petId: record.petId,
      appointmentId: record.appointmentId,
      groomingRecordId: record.id,
      pet: record.pet,
      breed: record.breed,
      customer: record.customer,
      phone: record.phone,
      service: record.service,
      status: "기록 완료",
      note: record.memo,
      customerRequest: record.customerRequest,
      staffComment: record.staffComment,
      next: record.next,
      date,
      time: record.time,
      staffId: record.staffId,
      staff: record.staff,
      eventReceivedAt: record.eventReceivedAt,
      reservationConfirmedAt: record.reservationConfirmedAt,
      groomingStartedAt: record.groomingStartedAt,
      pickupReadyAt: record.pickupReadyAt,
      recordCreatedAt: record.recordCreatedAt,
      recordCompletedAt: record.recordCompletedAt,
    }));
  const recordAppointmentIds = new Set(recordItems.map((record) => record.appointmentId).filter(Boolean));

  const completedReservationRecordItems: DayItem[] = reservations
    .filter((reservation) => reservation.date === date)
    .filter((reservation) => reservation.status === "완료")
    .filter((reservation) => !recordAppointmentIds.has(reservation.id))
    .map((reservation) => ({
      id: reservation.id,
      type: "record" as const,
      guardianId: reservation.guardianId,
      petId: reservation.petId,
      appointmentId: reservation.id,
      groomingRecordId: null,
      pet: reservation.pet,
      breed: reservation.breed,
      customer: reservation.customer,
      service: reservation.service,
      status: "기록 완료",
      note: reservation.note,
      customerRequest: reservation.customerRequest,
      staffComment: reservation.staffComment,
      time: reservation.time,
      staffId: reservation.staffId,
      staff: reservation.staff,
      phone: reservation.phone,
      channel: reservation.channel,
      eventReceivedAt: reservation.eventReceivedAt,
      eventUpdatedAt: reservation.eventUpdatedAt,
      reservationConfirmedAt: reservation.reservationConfirmedAt,
      groomingStartedAt: reservation.groomingStartedAt,
      pickupReadyAt: reservation.pickupReadyAt,
      groomingCompletedAt: reservation.groomingCompletedAt,
      actualCompletedAt: reservation.actualCompletedAt,
      recordCompletedAt: reservation.actualCompletedAt ?? reservation.eventUpdatedAt,
      date,
    }));

  const reservationItems: DayItem[] = shouldShowReservations
    ? reservations
        .filter((reservation) => reservation.date === date)
        .filter((reservation) => reservation.status !== "완료")
        .filter((reservation) => !recordAppointmentIds.has(reservation.id))
        .map((reservation) => {
          const status = reservation.status;

          return {
            id: reservation.id,
            type: "reservation" as const,
            guardianId: reservation.guardianId,
            petId: reservation.petId,
            appointmentId: reservation.id,
            groomingRecordId: null,
            pet: reservation.pet,
            breed: reservation.breed,
            customer: reservation.customer,
            service: reservation.service,
            status,
            note: reservation.note,
            customerRequest: reservation.customerRequest,
            staffComment: reservation.staffComment,
            time: reservation.time,
            staffId: reservation.staffId,
            staff: reservation.staff,
            phone: reservation.phone,
            channel: reservation.channel,
            eventReceivedAt: reservation.eventReceivedAt,
            eventUpdatedAt: reservation.eventUpdatedAt,
            reservationConfirmedAt: reservation.reservationConfirmedAt,
            groomingStartedAt: reservation.groomingStartedAt,
            pickupReadyAt: reservation.pickupReadyAt,
            groomingCompletedAt: reservation.groomingCompletedAt,
            actualCompletedAt: reservation.actualCompletedAt,
            date,
          };
        })
    : reservations
        .filter((reservation) => reservation.date === date)
        .filter((reservation) => reservation.status !== "완료")
        .filter(
          (reservation) =>
            reservation.status.includes("취소") ||
            reservation.status.includes("거절") ||
            reservation.status.includes("노쇼") ||
            reservation.status.includes("변경"),
        )
        .filter((reservation) => !recordAppointmentIds.has(reservation.id))
        .map((reservation) => {
          const status = reservation.status;

          return {
            id: reservation.id,
            type: "reservation" as const,
            guardianId: reservation.guardianId,
            petId: reservation.petId,
            appointmentId: reservation.id,
            groomingRecordId: null,
            pet: reservation.pet,
            breed: reservation.breed,
            customer: reservation.customer,
            service: reservation.service,
            status,
            note: reservation.note,
            customerRequest: reservation.customerRequest,
            staffComment: reservation.staffComment,
            time: reservation.time,
            staffId: reservation.staffId,
            staff: reservation.staff,
            phone: reservation.phone,
            channel: reservation.channel,
            eventReceivedAt: reservation.eventReceivedAt,
            eventUpdatedAt: reservation.eventUpdatedAt,
            reservationConfirmedAt: reservation.reservationConfirmedAt,
            groomingStartedAt: reservation.groomingStartedAt,
            pickupReadyAt: reservation.pickupReadyAt,
            groomingCompletedAt: reservation.groomingCompletedAt,
            actualCompletedAt: reservation.actualCompletedAt,
            date,
          };
        });

  return sortOperationalItems([...reservationItems, ...completedReservationRecordItems, ...recordItems]);
}

function matchesCalendarSearch(fields: Array<string | undefined | null>, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  const queryDigits = query.replace(/\D/g, "");
  const haystackDigits = haystack.replace(/\D/g, "");

  return haystack.includes(normalizedQuery) || Boolean(queryDigits && haystackDigits.includes(queryDigits));
}

function getStatusAccent(item: DayItem): StatusIndicatorTone {
  if (item.type === "record") return "slate";
  if (item.status === "취소" || item.status === "거절" || item.status === "노쇼") return "burgundy";
  return "confirmed";
}

function getCalendarCellTone(active: boolean, isToday: boolean, hasItems: boolean, closed: boolean) {
  if (active) return "border-[#a8bfdf] bg-[#f8fbff] shadow-[0_2px_8px_rgba(37,99,235,0.06)]";
  if (closed) return "border-white bg-[linear-gradient(135deg,#f8fafc_0,#f8fafc_45%,#eef2f7_45%,#eef2f7_50%,#f8fafc_50%,#f8fafc_95%,#eef2f7_95%)] bg-[length:12px_12px] shadow-[0_1px_4px_rgba(15,23,42,0.03)]";
  if (isToday) return "border-[#dbe2ea] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.035)]";
  if (hasItems) return "border-white bg-[linear-gradient(to_bottom,#fff_0%,#fff_62%,#fbfefd_100%)] shadow-[0_1px_4px_rgba(15,23,42,0.035)] hover:border-[#d5e7df] hover:shadow-[0_6px_16px_rgba(15,23,42,0.055)]";
  return "border-white bg-[linear-gradient(to_bottom,#fff_0%,#fff_72%,#fcfefd_100%)] shadow-[0_1px_4px_rgba(15,23,42,0.032)] hover:border-[#dbe8e2] hover:bg-white hover:shadow-[0_5px_14px_rgba(15,23,42,0.05)]";
}

type CalendarStatusKey = "confirmed" | "completed" | "changed" | "cancelled";
type CalendarStatusFilter = "all" | CalendarStatusKey;
type CalendarStaffFilter = "all" | string;

function getItemStatusGroup(item: Pick<DayItem, "type" | "status">): CalendarStatusKey {
  if (item.type === "record" || item.status.includes("완료")) return "completed";
  if (item.status.includes("변경")) return "changed";
  if (item.status.includes("취소") || item.status.includes("거절") || item.status.includes("노쇼")) return "cancelled";
  return "confirmed";
}

// Each status gets its own row in a cell: one dot per item up to this many, above it the row ends with a "+" mark.
// Exact counts stay in the cell's title/aria-label and in the date panel.
const CALENDAR_CELL_MAX_STATUS_DOTS = 5;

// Notes are drawn as bars across the days they cover, at most this many stacked per week row.
// The top offset places the first bar right under the date line: 1px border + 8px padding + 20px date line + 2px gap.
const CALENDAR_NOTE_MAX_LANES = 2;
const CALENDAR_NOTE_BAR_HEIGHT = 18;
const CALENDAR_NOTE_BAR_STEP = 20;
const CALENDAR_NOTE_BAR_TOP = 31;
// Each note in the month gets the next tone in order of its first bar, so neighbouring and stacked notes never share a color
// and a note that wraps to the next week keeps its color. Hues stay clear of the green/slate/red status dots.
const CALENDAR_NOTE_TONES = [
  { background: "#fff0e3", accent: "#ef8a42", text: "#8f4512" },
  { background: "#f1ecff", accent: "#8b5cf6", text: "#5b3fa8" },
  { background: "#e3f6f8", accent: "#14a3b8", text: "#0e6170" },
  { background: "#fde8f1", accent: "#e0559a", text: "#9a2c63" },
  { background: "#e8eefe", accent: "#5b7bea", text: "#2f4aa8" },
  { background: "#fdf5d3", accent: "#d4a514", text: "#7a5d06" },
] as const;

function getCalendarCellStatusLines(items: DayItem[]) {
  const counts = { reserved: 0, completed: 0, cancelled: 0 };
  for (const item of items) {
    const group = getItemStatusGroup(item);
    if (group === "completed") counts.completed += 1;
    else if (group === "cancelled") counts.cancelled += 1;
    else counts.reserved += 1;
  }
  return [
    { key: "reserved", label: "예약", count: counts.reserved, color: statusIndicatorColor.confirmed },
    { key: "completed", label: "완료", count: counts.completed, color: statusIndicatorColor.completed },
    { key: "cancelled", label: "취소", count: counts.cancelled, color: statusIndicatorColor.cancelled },
  ].filter((line) => line.count > 0);
}

function matchesStatusFilter(item: Pick<DayItem, "type" | "status">, filter: CalendarStatusFilter) {
  return filter === "all" || getItemStatusGroup(item) === filter;
}

function getOperationalPriority(item: Pick<DayItem, "type" | "status">) {
  if (item.status.includes("변경")) return 1;
  if (item.status === "예약 확정" || item.status === "진행 중" || item.status === "픽업 준비") return 2;
  if (item.status.includes("취소") || item.status.includes("거절") || item.status.includes("노쇼")) return 3;
  return item.type === "record" ? 4 : 3;
}

function sortOperationalItems(items: DayItem[]) {
  return [...items].sort((first, second) => {
    const timeDiff = (first.time ?? "99:99").localeCompare(second.time ?? "99:99");
    if (timeDiff !== 0) return timeDiff;
    const priorityDiff = getOperationalPriority(first) - getOperationalPriority(second);
    if (priorityDiff !== 0) return priorityDiff;
    return first.id.localeCompare(second.id);
  });
}

function getStaffDayKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
  return staffDayKeys[weekday];
}

function getStaffWorkNotice(data: BootstrapPayload, date: string, staffFilter: CalendarStaffFilter) {
  if (isShopClosedOnDate(data.shop, date)) return { closed: true, label: "매장 휴무", description: "예약을 받지 않는 날입니다.", offLabel: "", halfLabel: "" };

  const staffMembers =
    staffFilter === "all"
      ? data.staffMembers
      : data.staffMembers.filter((staff) => staff.id === staffFilter);
  const dayKey = getStaffDayKey(date);
  const offStaff = staffMembers.filter((staff) => {
    const override = data.staffScheduleOverrides?.find((item) => item.staff_id === staff.id && item.work_date === date);
    if (override?.status === "off" || override?.status === "annual") return true;
    if (override?.status === "work" || override?.status === "half") return false;
    return !staff.defaultDays.includes(dayKey);
  });
  const halfStaff = staffMembers.filter((staff) => {
    const override = data.staffScheduleOverrides?.find((item) => item.staff_id === staff.id && item.work_date === date);
    return override?.status === "half";
  });

  const offLabel = offStaff.length > 0 ? `${offStaff.map((staff) => staff.name).join(", ")} 휴무` : "";
  const halfLabel = halfStaff.length > 0 ? `${halfStaff.map((staff) => staff.name).join(", ")} 반차` : "";
  const parts = [offLabel, halfLabel].filter(Boolean);

  return {
    closed: false,
    label: parts.length > 0 ? parts.join(" · ") : "근무 가능",
    description: parts.length > 0 ? "근무표 기준 예약 가능 여부를 확인해 주세요." : "근무표상 특이사항이 없습니다.",
    offLabel,
    halfLabel,
  };
}

export default function CalendarRecordsScreen({
  initialData,
  shopEventsEnabled = initialData.mode === "supabase",
  onDataChange,
  onCreateReservationForDate,
}: {
  initialData: BootstrapPayload;
  shopEventsEnabled?: boolean;
  onDataChange?: (data: BootstrapPayload) => void;
  onCreateReservationForDate?: (date: string) => void;
}) {
  const records = useMemo(() => buildRecordsFromBootstrap(initialData), [initialData]);
  const initialReservations = useMemo(() => buildReservationsFromBootstrap(initialData), [initialData]);
  const [reservations, setReservations] = useState<ReservationRow[]>(() => initialReservations);
  const [selectedDate, setSelectedDate] = useState(currentDateInTimeZone());
  const [monthAnchor, setMonthAnchor] = useState(currentDateInTimeZone());
  const [query, setQuery] = useState("");
  const [staffFilter, setStaffFilter] = useState<CalendarStaffFilter>("all");
  const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>("all");
  const [selectedItem, setSelectedItem] = useState<DayItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const month = monthAnchor.slice(0, 7);
  const { holidays, holidayError, reloadHolidays } = useCalendarHolidays(month, fetchApiJson);
  const { deadlines: supportDeadlines } = useSupportPrograms(true, fetchApiJson, initialData.shop.address ?? "");
  const { events, canEdit, eventsLoading, eventsError, reloadEvents } = useShopCalendarEvents(
    shopEventsEnabled ? initialData.shop.id : null, month, fetchApiJsonWithAuth,
  );
  const latestDataRef = useRef(initialData);
  const onDataChangeRef = useRef(onDataChange);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    latestDataRef.current = initialData;
  }, [initialData]);

  useEffect(() => {
    if (initialData.mode !== "supabase") return;

    let cancelled = false;
    let inFlight = false;
    const { from, to } = getMonthRange(monthAnchor);
    const syncMonthRange = async () => {
      if (document.visibilityState !== "visible" || inFlight) return;

      inFlight = true;
      try {
        const range = await fetchOwnerScheduleRange(initialData.shop.id, from, to);
        if (cancelled) return;

        const nextData = replaceScheduleRangeInBootstrap(latestDataRef.current, range);
        latestDataRef.current = nextData;
        onDataChangeRef.current?.(nextData);
      } catch (error) {
        console.error("[owner-calendar] failed to synchronize the visible month", error);
      } finally {
        inFlight = false;
      }
    };

    void syncMonthRange();
    const intervalId = window.setInterval(syncMonthRange, 15_000);
    window.addEventListener("focus", syncMonthRange);
    document.addEventListener("visibilitychange", syncMonthRange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncMonthRange);
      document.removeEventListener("visibilitychange", syncMonthRange);
    };
  }, [initialData.mode, initialData.shop.id, monthAnchor]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setReservations(initialReservations);
      setSelectedItem((current) => {
        if (!current) return null;
        const exists = [...initialReservations, ...records].some((item) => item.id === current.id);
        return exists ? current : null;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialReservations, records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) =>
      matchesCalendarSearch([record.pet, record.customer, record.date, record.service, record.memo, record.customerRequest, record.staffComment, record.next], query) &&
      (staffFilter === "all" || record.staffId === staffFilter) &&
      (statusFilter === "all" || statusFilter === "completed"),
    );
  }, [query, records, staffFilter, statusFilter]);
  const filteredReservations = useMemo(() => {
    return reservations.filter((reservation) =>
      matchesCalendarSearch(
        [
          reservation.pet,
          reservation.customer,
          reservation.service,
          reservation.status,
          reservation.note,
          reservation.customerRequest,
          reservation.staffComment,
          reservation.date,
          reservation.time,
          reservation.staff,
          reservation.phone,
          reservation.channel,
        ],
        query,
      ) &&
      (staffFilter === "all" || reservation.staffId === staffFilter) &&
      matchesStatusFilter(
        {
          type: "reservation",
          status: reservation.status,
        },
        statusFilter,
      ),
    );
  }, [query, reservations, staffFilter, statusFilter]);

  const monthDates = useMemo(() => getMonthDates(monthAnchor), [monthAnchor]);
  const holidaysByDate = useMemo(() => calendarHolidaysByDate(holidays), [holidays]);
  const shopEventsByDate = useMemo(() => new Map(monthDates.flatMap(date => date ? [[date, shopEventsOnDate(events, date)] as const] : [])), [events, monthDates]);
  const calendarWeekRows = Math.max(5, Math.ceil(monthDates.length / 7));
  const noteLayout = useMemo(() => layoutShopEventBars(events, monthDates, CALENDAR_NOTE_MAX_LANES), [events, monthDates]);
  const noteToneById = useMemo(() => {
    const ids = [...new Set(noteLayout.bars.map((bar) => bar.event.id))];
    return new Map(ids.map((id, index) => [id, CALENDAR_NOTE_TONES[index % CALENDAR_NOTE_TONES.length]]));
  }, [noteLayout]);
  const dayItemsByDate = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    for (const date of monthDates) {
      if (!date) continue;
      map.set(date, buildDayItems(filteredRecords, filteredReservations, date));
    }
    return map;
  }, [filteredRecords, filteredReservations, monthDates]);
  const birthdayItemsByDate = useMemo(() => {
    const map = new Map<string, BirthdayItem[]>();
    for (const date of monthDates) {
      if (!date) continue;
      map.set(date, buildBirthdayItems(initialData, date, query));
    }
    return map;
  }, [initialData, monthDates, query]);
  const selectedItems = dayItemsByDate.get(selectedDate) ?? [];
  const selectedBirthdays = birthdayItemsByDate.get(selectedDate) ?? [];
  const staffOptions = useMemo(
    () => [
      { value: "all", label: "전체 직원" },
      ...initialData.staffMembers.map((staff) => ({ value: staff.id, label: staff.displayName || staff.name })),
    ],
    [initialData.staffMembers],
  );
  const statusOptions: Array<{ value: CalendarStatusFilter; label: string }> = [
    { value: "all", label: "전체 상태" },
    { value: "confirmed", label: "예정/진행" },
    { value: "changed", label: "변경" },
    { value: "cancelled", label: "취소/거절" },
    { value: "completed", label: "완료" },
  ];

  function openDate(date: string) {
    setSelectedDate(date);
    setSelectedItem(null);
  }

  function changeMonth(amount: number) {
    const next = moveMonth(monthAnchor, amount);
    setMonthAnchor(next);
    openDate(next);
  }

  function openItem(item: DayItem) {
    setSelectedDate(item.date);
    setSelectedItem(item);
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[18px]">
      <section className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden rounded-[18px] bg-white sm:overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e7eb] bg-white px-3 py-2.5 sm:px-5">
          <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-start">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] transition hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1677ff]"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="order-first flex min-h-11 w-full min-w-0 items-center justify-center px-3 text-center text-[16px] font-medium text-[#111827] sm:order-none sm:w-auto sm:min-w-[110px]">{formatMonthLabel(monthAnchor)}</p>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] transition hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1677ff]"
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                const today = currentDateInTimeZone();
                setMonthAnchor(today);
                openDate(today);
              }}
              className="relative inline-flex h-10 items-center justify-center rounded-[8px] border border-[#e8edf3] bg-white px-4 text-[14px] font-medium text-[#334155] transition hover:border-[#cbd5e1] hover:bg-[#f8fbff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1677ff]"
            >
              오늘
            </button>
          </div>
          <label className="flex min-h-11 min-w-0 w-full flex-none items-center gap-3 rounded-[8px] border border-[#e5e7eb] bg-white px-3 text-[#64748b] sm:min-w-[280px] sm:flex-1">
            <IconSearch aria-hidden="true" className="shrink-0 h-4 w-4 text-[#94a3b8]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-[16px] font-normal leading-6 text-[#111827] outline-none placeholder:text-[#94a3b8]"
              placeholder="반려동물명, 보호자명, 메모 검색"
            />
          </label>
          <div className="ml-0 flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <label className="relative block min-w-0 flex-1 sm:flex-none">
              <select
                value={staffFilter}
                onChange={(event) => setStaffFilter(event.target.value)}
            className="min-h-11 min-w-0 w-full appearance-none rounded-[8px] border border-[#e5e7eb] bg-white pl-3 pr-10 text-[16px] font-medium leading-6 text-[#111827] outline-none focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20 sm:min-w-[132px] sm:w-auto"
              >
                {staffOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" aria-hidden="true" />
            </label>
            <label className="relative block min-w-0 flex-1 sm:flex-none">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as CalendarStatusFilter)}
            className="min-h-11 min-w-0 w-full appearance-none rounded-[8px] border border-[#e5e7eb] bg-white pl-3 pr-10 text-[16px] font-medium leading-6 text-[#111827] outline-none focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20 sm:min-w-[132px] sm:w-auto"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" aria-hidden="true" />
            </label>
            {canEdit ? <button type="button" className={calendarSecondaryButtonClass} onClick={() => setImportOpen(true)}>
              <IconFileImport size={16} stroke={1.75} aria-hidden="true" />일정 가져오기
            </button> : null}
          </div>
        </div>
        {holidayError ? <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#e8edf3] px-3 text-[13px] text-[#64748b] sm:px-5" role="status">
          공휴일을 불러오지 못했어요.
          <button className="min-h-11 rounded-md px-1.5 text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600" type="button" onClick={reloadHolidays}>공휴일 다시 조회</button>
        </div> : null}

        <div data-calendar-month-layout="true" className="grid min-h-0 flex-1 items-stretch overflow-visible rounded-b-[14px] sm:overflow-hidden lg:grid-cols-[minmax(0,1fr)_clamp(300px,24vw,380px)]">
          <section data-calendar-month-board="true" className="flex min-h-0 min-w-0 flex-col overflow-visible rounded-b-[14px] bg-[#f1f5f9] sm:overflow-hidden xl:border-r xl:border-[#edf2f7]">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto">
            <div className="grid min-w-[720px] shrink-0 grid-cols-7 border-b border-[#e5e7eb] bg-white lg:min-w-0">
              {weekdayLabels.map((label) => (
                <div key={label} className="flex h-9 items-center justify-center text-center text-[13px] font-medium">
                  <span className={cn("inline-flex h-6 min-w-8 items-center justify-center px-2", label === "일" ? "text-[#d6303a]" : "text-[#111827]")}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div
              data-calendar-month-grid="true"
              className="grid min-h-0 min-w-[720px] flex-1 grid-cols-7 gap-px bg-[#eef2f7] p-px lg:min-w-0"
              style={{ gridTemplateRows: `repeat(${calendarWeekRows}, minmax(0, 1fr))` }}
            >
              {monthDates.map((date, index) => {
                const items = date ? dayItemsByDate.get(date) ?? [] : [];
                const birthdays = date ? birthdayItemsByDate.get(date) ?? [] : [];
                const birthdayCount = birthdays.length;
                const active = date === selectedDate;
                const hasItems = items.length > 0 || birthdayCount > 0;
                const isToday = date === currentDateInTimeZone();
                // Explicit placement keeps the note bars below from shifting the auto-placed cells.
                const cellPlacement = { gridRow: Math.floor(index / 7) + 1, gridColumn: (index % 7) + 1 };
                if (!date) {
                  return <div key={`empty-${index}`} className="min-h-0 bg-[#fdfefe]" style={cellPlacement} />;
                }

                const workNotice = getStaffWorkNotice(initialData, date, staffFilter);
                const holidays = holidaysByDate.get(date) ?? [];
                const supportCount = supportDeadlines.get(date)?.length ?? 0;
                const noteCount = shopEventsByDate.get(date)?.length ?? 0;
                const statusLines = getCalendarCellStatusLines(items);
                const isRedDay = holidays.length > 0 || new Date(`${date}T00:00:00`).getDay() === 0;
                const noteLanes = noteLayout.lanesByRow[Math.floor(index / 7)] ?? 0;
                const cellLabel = [
                  date,
                  workNotice.closed ? "매장 휴무" : "",
                  ...statusLines.map((line) => `${line.label} ${line.count}건`),
                  holidays.join(" · "),
                  workNotice.closed ? "" : [workNotice.offLabel, workNotice.halfLabel].filter(Boolean).join(" · "),
                  noteCount ? `노트 ${noteCount}건` : "",
                  supportCount ? `지원사업 마감 ${supportCount}건` : "",
                ].filter(Boolean).join(", ");

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => openDate(date)}
                    style={cellPlacement}
                    className={cn(
                      "relative flex min-h-0 flex-col justify-between gap-1 overflow-hidden border px-3 py-2 text-left transition duration-150",
                      getCalendarCellTone(active, isToday, hasItems, workNotice.closed),
                    )}
                    aria-label={cellLabel}
                  >
                    <span className="@container/calendar-day block min-h-0 min-w-0 space-y-0.5 overflow-hidden">
                      <span className="flex items-baseline justify-between gap-1">
                        <span className={cn("shrink-0 text-[14px] font-medium leading-5", isRedDay ? "text-[#d6303a]" : "text-[#111827]")}>{Number(date.slice(-2))}</span>
                        {supportCount > 0 ? (
                          <span className="min-w-0 truncate text-right text-[12px] font-semibold leading-[18px] text-[#42658f]" title={`지원사업 마감 ${supportCount}건`} aria-hidden="true">
                            <span className="hidden @[84px]/calendar-day:inline">지원사업 {supportCount}건</span>
                            <span className="@[84px]/calendar-day:hidden"><span className="hidden @[56px]/calendar-day:inline">지원 </span>{supportCount}건</span>
                          </span>
                        ) : null}
                      </span>
                      {noteLanes > 0 ? <span className="block" style={{ height: noteLanes * CALENDAR_NOTE_BAR_STEP - (CALENDAR_NOTE_BAR_STEP - CALENDAR_NOTE_BAR_HEIGHT) }} aria-hidden="true" /> : null}
                      {holidays.length ? <span className="block truncate text-[12px] font-medium leading-[18px] text-[#d6303a]" title={holidays.join(" · ")}>{holidays.join(" · ")}</span> : null}
                      {workNotice.closed ? (
                        <span className="block truncate text-[12px] leading-[18px] text-[#64748b]">매장 휴무</span>
                      ) : workNotice.offLabel || workNotice.halfLabel ? (
                        <span className="line-clamp-1 text-[12px] leading-[18px]">
                          {workNotice.offLabel ? <span className="text-[#64748b]">{workNotice.offLabel}</span> : null}
                          {workNotice.offLabel && workNotice.halfLabel ? <span className="text-[#94a3b8]"> · </span> : null}
                          {workNotice.halfLabel ? <span className="text-[#64748b]">{workNotice.halfLabel}</span> : null}
                        </span>
                      ) : null}
                    </span>
                    {statusLines.length > 0 ? (
                      <span
                        className="flex shrink-0 flex-col gap-[3px]"
                        title={statusLines.map((line) => `${line.label} ${line.count}`).join(" · ")}
                        aria-hidden="true"
                      >
                        {statusLines.map((line) => (
                          <span key={line.key} className="flex h-2 items-center gap-[3px]">
                            {Array.from({ length: Math.min(line.count, CALENDAR_CELL_MAX_STATUS_DOTS) }, (_, index) => (
                              <span key={index} className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: line.color }} />
                            ))}
                            {line.count > CALENDAR_CELL_MAX_STATUS_DOTS ? (
                              <IconPlus size={9} stroke={3} className="shrink-0" style={{ color: line.color }} />
                            ) : null}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {noteLayout.bars.map((bar) => {
                const tone = noteToneById.get(bar.event.id) ?? CALENDAR_NOTE_TONES[0];
                return (
                <span
                  key={`${bar.event.id}/${bar.row}`}
                  aria-hidden="true"
                  title={bar.event.title}
                  data-calendar-note-bar="true"
                  className={cn(
                    "pointer-events-none relative z-[1] flex min-w-0 items-center self-start overflow-hidden px-1.5 text-[11px] font-medium leading-[18px]",
                    bar.continuesBefore ? "" : "ml-1.5 rounded-l-[4px] border-l-[3px]",
                    bar.continuesAfter ? "" : "mr-1.5 rounded-r-[4px]",
                  )}
                  style={{
                    gridRow: bar.row + 1,
                    gridColumn: `${bar.startColumn + 1} / ${bar.endColumn + 2}`,
                    marginTop: CALENDAR_NOTE_BAR_TOP + bar.lane * CALENDAR_NOTE_BAR_STEP,
                    height: CALENDAR_NOTE_BAR_HEIGHT,
                    backgroundColor: tone.background,
                    borderColor: tone.accent,
                    color: tone.text,
                  }}
                >
                  <span className="truncate">{bar.event.title.split("\n")[0]}</span>
                </span>
                );
              })}
            </div>
            </div>
          </section>

          <GroomingDatePanel
            date={selectedDate}
            items={selectedItems}
            birthdays={selectedBirthdays}
            holidayNames={holidaysByDate.get(selectedDate)}
            supportPrograms={supportDeadlines.get(selectedDate) ?? []}
            shopEventCount={shopEventsByDate.get(selectedDate)?.length ?? 0}
            shopAgenda={shopEventsEnabled ? <ShopCalendarAgenda
              key={`${initialData.shop.id}/${selectedDate}`}
              date={selectedDate}
              variant="day-panel"
              shopId={initialData.shop.id}
              events={shopEventsByDate.get(selectedDate) ?? []}
              canEdit={canEdit}
              loading={eventsLoading}
              error={eventsError}
              request={fetchApiJsonWithAuth}
              onRefresh={reloadEvents}
            /> : null}
            onSelectItem={openItem}
            onAddReservation={onCreateReservationForDate ? () => onCreateReservationForDate(selectedDate) : undefined}
          />
        </div>
      </section>

      {importOpen ? <CalendarImportDialog key={initialData.shop.id} shopId={initialData.shop.id} month={month} onClose={() => setImportOpen(false)} onImported={reloadEvents} /> : null}

      {selectedItem ? (
        <GroomingRecordSheet
          shopId={initialData.shop.id}
          item={selectedItem}
          changeEvents={(initialData.appointmentChangeEvents ?? []).filter(
            (event) => selectedItem.appointmentId && event.appointment_id === selectedItem.appointmentId,
          )}
          services={initialData.services}
          staffMembers={initialData.staffMembers}
          onPreparationChanged={() => {
            const { from, to } = getMonthRange(monthAnchor);
            void fetchOwnerScheduleRange(initialData.shop.id, from, to).then((range) => {
              const nextData = replaceScheduleRangeInBootstrap(latestDataRef.current, range);
              latestDataRef.current = nextData;
              onDataChangeRef.current?.(nextData);
            }).catch(() => { /* Keep the readable detail; normal synchronization can retry. */ });
          }}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </div>
  );
}

const dayPanelSectionClass = "px-4 pt-4";
const dayPanelCardClass = "overflow-hidden rounded-[10px] border border-[#e8edf3] bg-white";

type DayPanelSection = "items" | "shop" | "support";

type DayPanelStat = {
  key: string;
  label: string;
  value: number;
  alert?: boolean;
  target: DayPanelSection | null;
};

function GroomingDatePanel({
  date,
  items,
  birthdays,
  holidayNames,
  supportPrograms,
  shopEventCount,
  shopAgenda,
  onSelectItem,
  onAddReservation,
}: {
  date: string;
  items: DayItem[];
  birthdays: BirthdayItem[];
  holidayNames?: string[];
  supportPrograms: SupportProgram[];
  shopEventCount?: number;
  shopAgenda?: React.ReactNode;
  onSelectItem: (item: DayItem) => void;
  onAddReservation?: () => void;
}) {
  const sortedItems = sortOperationalItems(items);
  const visibleItems = sortedItems.filter((item) => getItemStatusGroup(item) !== "cancelled");
  const cancelledItems = sortedItems.filter((item) => getItemStatusGroup(item) === "cancelled");
  // Remember which date the 취소 list was opened for, so moving to another date falls back to the main list.
  const [cancelledListDate, setCancelledListDate] = useState<string | null>(null);
  const showCancelled = cancelledListDate === date && cancelledItems.length > 0;
  const listedItems = showCancelled ? cancelledItems : visibleItems;
  const bodyRef = useRef<HTMLDivElement>(null);
  const reservationRef = useRef<HTMLElement>(null);
  const shopRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const parsedDate = new Date(`${date}T00:00:00`);
  const today = currentDateInTimeZone();
  const itemLabel = date < today ? "기록" : "예약";

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [date]);

  function jumpTo(section: DayPanelSection) {
    const body = bodyRef.current;
    const target = section === "items" ? reservationRef.current : section === "shop" ? shopRef.current : supportRef.current;
    if (!body || !target) return;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (body.scrollHeight > body.clientHeight) body.scrollTo({ top: target.offsetTop, behavior });
    else target.scrollIntoView({ block: "start", behavior });
  }

  const stats: DayPanelStat[] = [
    { key: "items", label: itemLabel, value: visibleItems.length, target: "items" },
    ...(shopAgenda ? [{ key: "shop", label: "노트", value: shopEventCount ?? 0, target: "shop" as const }] : []),
    { key: "support", label: "마감", value: supportPrograms.length, alert: true, target: supportPrograms.length > 0 ? "support" : null },
  ];

  return (
    <aside data-calendar-month-detail-panel="true" className="min-h-0 min-w-0 overflow-y-auto rounded-b-[14px] bg-[#f2f5f8] lg:flex lg:flex-col lg:overflow-hidden">
      <div
        className={cn(
          "relative z-[1] border-b border-[#edf1f5] bg-white px-4 pb-3 pt-4 transition-shadow duration-200 lg:shrink-0",
          scrolled && "shadow-[0_8px_16px_-12px_rgba(15,27,45,0.16)]",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-baseline gap-x-1.5 text-[20px] font-semibold leading-7 tracking-[-0.01em] text-[#0f1b2d]">
              <time dateTime={date}>{parsedDate.getMonth() + 1}월 {parsedDate.getDate()}일</time>
              <span className="text-[14px] font-normal tracking-normal text-[#6b7a90]">{weekdayLabels[parsedDate.getDay()]}요일</span>
            </h3>
            <CalendarHolidayLabel names={holidayNames} />
          </div>
          {onAddReservation ? (
            <button
              type="button"
              data-owner-control-size="content"
              onClick={onAddReservation}
              className={cn(
                OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS,
                "h-9 min-h-9 shrink-0 gap-1 rounded-[8px] px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1677ff] focus-visible:ring-offset-2",
              )}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              예약 추가
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex divide-x divide-[#e6ebf1] rounded-[8px] bg-[#f7f9fb]">
          {stats.map((stat) => {
            const cellClass = "flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2 first:rounded-l-[8px] last:rounded-r-[8px]";
            const content = (
              <>
                <span className="truncate text-[12px] leading-5 text-[#6b7a90]">{stat.label}</span>
                <span className={cn("text-[14px] font-medium leading-5 tabular-nums text-[#0f1b2d]", stat.alert && stat.value > 0 && "text-[#d6303a]")}>{stat.value}</span>
              </>
            );
            const target = stat.target;
            return target ? (
              <button
                key={stat.key}
                type="button"
                data-owner-control-size="content"
                aria-label={`${stat.label} ${stat.value}건, 목록으로 이동`}
                onClick={() => jumpTo(target)}
                className={cn(cellClass, "transition-colors hover:bg-[#eef2f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1677ff]")}
              >
                {content}
              </button>
            ) : (
              <div key={stat.key} className={cellClass}>{content}</div>
            );
          })}
        </div>

      </div>

      <div
        ref={bodyRef}
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 2)}
        className="relative pb-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain [scrollbar-color:#d5deea_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#d5deea] [&::-webkit-scrollbar]:w-1.5"
      >
        <section ref={reservationRef} aria-label={itemLabel} className={dayPanelSectionClass}>
          {cancelledItems.length > 0 ? (
            <div className="mb-1 flex min-w-0 items-center gap-1 px-0.5">
              <span className="mr-0.5 inline-flex shrink-0 text-[#475569]" aria-hidden="true"><IconCalendarEvent size={18} stroke={1.8} /></span>
              <DayPanelListToggle label={itemLabel} count={visibleItems.length} selected={!showCancelled} onSelect={() => setCancelledListDate(null)} />
              <span className="mx-1 h-3.5 w-px shrink-0 bg-[#cbd5e1]" aria-hidden="true" />
              <DayPanelListToggle label="취소" count={cancelledItems.length} selected={showCancelled} onSelect={() => setCancelledListDate(date)} />
            </div>
          ) : (
            <DayPanelSectionLabel icon={<IconCalendarEvent size={18} stroke={1.8} />} title={itemLabel} count={visibleItems.length} />
          )}
          {listedItems.length > 0 ? (
            <DayItemSection items={listedItems} label={showCancelled ? "취소된 예약" : undefined} onSelectItem={onSelectItem} />
          ) : (
            <p className={cn(dayPanelCardClass, "px-3 py-3 text-center text-[13px] leading-[18px] text-[#6b7a90]")}>이 날은 {itemLabel}이 없어요</p>
          )}
        </section>
        {birthdays.length > 0 ? <BirthdaySection birthdays={birthdays} /> : null}
        {shopAgenda ? <div ref={shopRef} className={dayPanelSectionClass}>{shopAgenda}</div> : null}
        {supportPrograms.length > 0 ? (
          <div ref={supportRef} className={dayPanelSectionClass}>
            <SupportProgramList title="지원사업 마감" programs={supportPrograms} variant="day-panel" referenceDate={today} />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function DayPanelSectionLabel({ icon, title, count, tone = "neutral" }: {
  icon: React.ReactNode;
  title: string;
  count: number;
  tone?: "neutral" | "amber";
}) {
  return (
    <h3 className={cn("mb-1 flex min-w-0 items-center gap-1 px-0.5 text-[15px] font-semibold leading-[22px]", tone === "amber" ? "text-[#7a4f00]" : "text-[#1e293b]")}>
      <span className={cn("mr-0.5 inline-flex shrink-0", tone === "amber" ? "text-[#b98121]" : "text-[#475569]")} aria-hidden="true">{icon}</span>
      <span className="truncate">{title}</span>
      <span className={cn("font-medium tabular-nums", tone === "amber" ? "text-[#a8741a]" : "text-[#64748b]")}>{count}</span>
    </h3>
  );
}

function DayPanelListToggle({ label, count, selected, onSelect }: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-owner-control-size="content"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "-my-[5px] inline-flex h-8 min-w-0 items-center gap-1 rounded-[6px] px-1 text-[15px] font-semibold leading-[22px] transition-colors focus-visible:outline-2 focus-visible:outline-[#1677ff]",
        selected ? "text-[#1e293b]" : "text-[#94a3b8] hover:text-[#475569]",
      )}
    >
      <span className="truncate">{label}</span>
      <span className={cn("font-medium tabular-nums", selected ? "text-[#64748b]" : "text-[#a3afbf]")}>{count}</span>
    </button>
  );
}

function BirthdaySection({ birthdays }: { birthdays: BirthdayItem[] }) {
  return (
    <section aria-label="반려동물 생일" className={dayPanelSectionClass}>
      <DayPanelSectionLabel tone="amber" icon={<PawPrint size={18} stroke={1.8} />} title="반려동물 생일" count={birthdays.length} />
      <ul className={cn(dayPanelCardClass, "divide-y divide-[#edf1f5]")}>
        {birthdays.map((birthday) => (
          <li key={birthday.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium leading-5 text-[#0f1b2d]">{birthday.pet} · {birthday.breed}</p>
              <p className="mt-0.5 truncate text-[12px] leading-4 text-[#6b7a90]">{birthday.customer} 보호자</p>
            </div>
            {birthday.phone ? <span className="shrink-0 text-[12px] tabular-nums text-[#6b7a90]">{formatRecordPhone(birthday.phone)}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function getDayItemBadgeClass(item: Pick<DayItem, "type" | "status">) {
  const group = getItemStatusGroup(item);
  if (group === "cancelled") return "bg-[#fdf0f3] text-[#8f2438]";
  if (group === "changed" || item.status === appointmentStatusLabels.pending) return "bg-[#fff4dc] text-[#8a5a00]";
  if (group === "completed") return "bg-[#f1f4f8] text-[#5b6b82]";
  return "bg-[#e9f6ee] text-[#177a43]";
}

function DayItemSection({ items, label = "예약 및 기록", onSelectItem }: {
  items: DayItem[];
  label?: string;
  onSelectItem: (item: DayItem) => void;
}) {
  return (
    <ul aria-label={label} className={cn(dayPanelCardClass, "divide-y divide-[#edf1f5]")}>
      {items.map((item) => (
        <li key={`${item.type}-${item.id}`}>
          <button
            type="button"
            data-owner-control-size="content"
            onClick={() => onSelectItem(item)}
            className="grid min-h-11 w-full min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-x-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#f8fafc] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1677ff]"
          >
            <span className={cn("whitespace-nowrap text-[13px] font-medium leading-5 tabular-nums", item.time ? "text-[#334155]" : "text-[#a3afbf]")}>{item.time || "–"}</span>
            <span className="min-w-0">
              <span className="block break-keep text-[14px] font-medium leading-5 text-[#0f1b2d] [overflow-wrap:anywhere]">{item.pet} · {item.customer}</span>
              <span className="mt-0.5 block break-keep text-[12px] leading-4 text-[#6b7a90] [overflow-wrap:anywhere]">
                {item.service}
                {item.note ? ` · ${item.note}` : ""}
              </span>
            </span>
            <span className={cn("mt-px inline-flex h-[18px] max-w-[88px] items-center rounded-[5px] px-1.5 text-[11px] font-medium", getDayItemBadgeClass(item))}>
              <span className="truncate">{item.type === "record" ? "기록" : item.status}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/*
function GroomingRecordSheet({
  shopId,
  item,
  changeEvents,
  services,
  staffMembers,
  onClose,
}: {
  shopId: string;
  item: DayItem;
  changeEvents: AppointmentChangeEvent[];
  services: BootstrapPayload["services"];
  staffMembers: BootstrapPayload["staffMembers"];
  onClose: () => void;
}) {
  const sourceLabel = item.channel ?? (item.type === "record" ? "기록 등록" : "예약");
  const hasCustomerRequest = Boolean(item.customerRequest?.trim());
  const hasStaffComment = Boolean(item.staffComment?.trim());
  const customerRequest = item.customerRequest?.trim() || "고객 요청사항이 없습니다.";
  const staffComment = item.staffComment?.trim() || "직원 코멘트가 없습니다.";
  const staffLabel = item.staff?.trim() || "담당 미지정";
  const isUnassignedStaff = staffLabel === "담당 미지정" || staffLabel === "담당 미배정";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-[430px] flex-col border-l border-[#dbe2ea] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#edf2f7] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">{item.pet} · {item.customer}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-[#64748b]">
                <span>{formatShortDate(item.date)}{item.time ? ` · ${item.time}` : ""}</span>
                <span className="text-[#cbd5e1]">/</span>
                <span>{kindLabel}</span>
                <span className="text-[#cbd5e1]">/</span>
                <span>{item.status}</span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-5 pl-5 pr-1">
          <section className={cn("rounded-[8px] border bg-white p-4", getWrapIndicatorClass(getStatusAccent(item)))}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] text-[#94a3b8]">서비스</p>
                <p className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">{item.service}</p>
              </div>
              <span className="shrink-0 rounded-full border border-[#dbe2ea] bg-[#f8fafc] px-2.5 py-1 text-[13px] text-[#64748b]">
                {item.staff ?? "담당 미지정"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#edf2f7] pt-3">
              <RecordMeta label="품종" value={item.breed ?? "품종 미입력"} />
              <RecordMeta label="경로" value={sourceLabel} />
            </div>
          </section>

          <RecordMemoCard title="고객 요청사항" value={customerRequest} highlighted />
          <RecordMemoCard title="직원 코멘트" value={staffComment} />

          {item.next ? (
            <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <p className="text-[14px] text-[#64748b]">다음 체크</p>
              <p className="mt-2 text-[16px] leading-6 text-[#111827]">{item.next}</p>
            </section>
          ) : null}

          <div className="mt-4">
            <OwnerMediaUploadPanel
              context={{
                shopId,
                guardianId: item.guardianId,
                petId: item.petId,
                appointmentId: item.appointmentId ?? null,
                groomingRecordId: item.groomingRecordId ?? null,
              }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

function RecordMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-[#94a3b8]">{label}</p>
      <p className="mt-1 truncate text-[16px] text-[#111827]">{value}</p>
    </div>
  );
}

function RecordHistoryCard({ item, sourceLabel }: { item: DayItem; sourceLabel: string }) {
  return (
    <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] text-[#64748b]">기록 히스토리</p>
        <span className={cn("h-2 w-2 rounded-full", statusIndicatorBgClass[getStatusAccent(item)])} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <RecordMeta label="날짜" value={formatFullDate(item.date)} />
        <RecordMeta label="시간" value={item.time ?? "-"} />
        <RecordMeta label="상태" value={item.status} />
        <RecordMeta label="경로" value={sourceLabel} />
      </div>
    </section>
  );
}

function RecordHistoryCard({ item, sourceLabel }: { item: DayItem; sourceLabel: string }) {
  return (
    <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] text-[#64748b]">기록 히스토리</p>
        <span className={cn("h-2 w-2 rounded-full", statusIndicatorBgClass(getStatusAccent(item)))} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <RecordMeta label="날짜" value={formatFullDate(item.date)} />
        <RecordMeta label="시간" value={item.time ?? "-"} />
        <RecordMeta label="상태" value={item.status} />
        <RecordMeta label="경로" value={sourceLabel} />
      </div>
    </section>
  );
}

function RecordHistoryCard({ item, sourceLabel }: { item: DayItem; sourceLabel: string }) {
  return (
    <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] text-[#64748b]">기록 히스토리</p>
        <span className={cn("h-2 w-2 rounded-full", statusIndicatorBgClass(getStatusAccent(item)))} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <RecordMeta label="날짜" value={formatFullDate(item.date)} />
        <RecordMeta label="시간" value={item.time ?? "-"} />
        <RecordMeta label="상태" value={item.status} />
        <RecordMeta label="경로" value={sourceLabel} />
      </div>
    </section>
  );
}

function RecordMemoCard({ title, value, highlighted = false }: { title: string; value: string; highlighted?: boolean }) {
  return (
    <section
      className={cn(
        "mt-3 rounded-[8px] border p-4",
        highlighted ? "border-[#dbe2ea] bg-[#f8fafc]" : "border-[#dbe2ea] bg-white",
      )}
    >
      <p className="text-[14px] text-[#64748b]">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-[16px] leading-6 text-[#111827]">{value}</p>
    </section>
  );
}
*/

function GroomingRecordSheet({
  shopId,
  item,
  changeEvents,
  services,
  staffMembers,
  onPreparationChanged,
  onClose,
}: {
  shopId: string;
  item: DayItem;
  changeEvents: AppointmentChangeEvent[];
  services: BootstrapPayload["services"];
  staffMembers: BootstrapPayload["staffMembers"];
  onPreparationChanged: () => void;
  onClose: () => void;
}) {
  const sourceLabel = item.channel ?? (item.type === "record" ? "기록 등록" : "예약");
  const hasCustomerRequest = Boolean(item.customerRequest?.trim());
  const hasStaffComment = Boolean(item.staffComment?.trim());
  const customerRequest = item.customerRequest?.trim() || "고객 요청사항이 없습니다.";
  const staffComment = item.staffComment?.trim() || "직원 코멘트가 없습니다.";
  const staffLabel = item.staff?.trim() || "담당 미지정";
  const isUnassignedStaff = staffLabel === "담당 미지정" || staffLabel === "담당 미배정";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-[430px] flex-col border-l border-[#dbe2ea] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#edf2f7] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="break-keep text-[24px] font-semibold leading-8 tracking-[-0.03em] text-[#111827] [overflow-wrap:anywhere]">{item.pet}</h3>
                {item.breed ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d7eadf] bg-[#f2faf6] px-2 py-0.5 text-[14px] font-medium leading-5 text-[#2f7866]">
                    <PawPrint className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.breed}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[16px] font-normal leading-6 text-[#334155]">{item.customer}</p>
              <p className="mt-0.5 text-[14px] font-normal leading-5 text-[#64748b]">{formatRecordPhone(item.phone)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]"
              aria-label="닫기"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-5 pl-5 pr-1">
          <section className={cn("rounded-[8px] border bg-white px-3 py-2.5", getWrapIndicatorClass(getStatusAccent(item)))}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14px] font-normal leading-5 text-[#64748b]">서비스</p>
                <p className="break-keep text-[24px] font-semibold leading-8 tracking-[-0.03em] text-[#111827] [overflow-wrap:anywhere]">{item.service}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-medium leading-[18px]",
                  isUnassignedStaff ? "border-[#f0c27a] bg-[#fffaf0] text-[#9a5b12]" : "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]",
                )}
              >
                {staffLabel}
              </span>
            </div>
          </section>

          {item.appointmentId ? (
            <div className="mt-3 [&_.pm-deposit-header]:px-3 [&_.pm-deposit-controls]:pb-2.5 [&_.pm-deposit-controls_h3]:text-[14px] [&_.pm-deposit-controls_h3]:font-medium [&_.pm-deposit-controls_h3]:leading-5 [&_.pm-deposit-controls_h3]:text-[#64748b]">
              <BookingPreparationPanel
                key={item.appointmentId}
                shopId={shopId}
                appointmentId={item.appointmentId}
                onStatusChanged={onPreparationChanged}
              />
            </div>
          ) : null}

          <RecordMemoCard title="고객 요청사항" value={customerRequest} empty={!hasCustomerRequest} highlighted />
          <RecordMemoCard title="직원 코멘트" value={staffComment} empty={!hasStaffComment} />

          <RecordHistoryCard item={item} sourceLabel={sourceLabel} changeEvents={changeEvents} services={services} staffMembers={staffMembers} />

          {item.next ? (
            <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <p className="text-[14px] font-medium leading-5 text-[#64748b]">다음 체크</p>
              <p className="mt-2 text-[16px] leading-6 text-[#111827]">{item.next}</p>
            </section>
          ) : null}

          <div className="mt-4">
            <OwnerMediaUploadPanel
              context={{
                shopId,
                guardianId: item.guardianId,
                petId: item.petId,
                appointmentId: item.appointmentId ?? null,
                groomingRecordId: item.groomingRecordId ?? null,
              }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

function RecordMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[14px] font-medium leading-5 text-[#64748b]">{label}</p>
      <p className="mt-1 truncate text-[16px] font-normal leading-6 text-[#111827]">{value}</p>
    </div>
  );
}

function RecordMemoCard({ title, value, empty = false, highlighted = false }: { title: string; value: string; empty?: boolean; highlighted?: boolean }) {
  return (
    <section
      className={cn(
        "mt-3 rounded-[8px] border",
        empty ? "px-3 py-2.5" : "p-4",
        highlighted ? "border-[#dbe2ea] bg-[#f8fafc]" : "border-[#dbe2ea] bg-white",
      )}
    >
      <p className="text-[14px] font-medium leading-5 text-[#64748b]">{title}</p>
      <p className={cn("whitespace-pre-wrap", empty ? "mt-1 text-[14px] font-normal leading-5 text-[#64748b]" : "mt-2 text-[16px] font-normal leading-6 text-[#111827]")}>{value}</p>
    </section>
  );
}

type RecordHistoryTimelineItem = {
  key: string;
  title: string;
  description: string;
  time: string;
  hasTime: boolean;
  dotClassName: string;
};

function historyTime(value?: string | null) {
  const formatted = formatHistoryTimestamp(value);
  return {
    time: formatted || "시간 기록 없음",
    hasTime: Boolean(formatted),
  };
}

function buildRecordHistoryTimeline(item: DayItem, sourceLabel: string): RecordHistoryTimelineItem[] {
  const reservationTime = historyTime(item.eventReceivedAt);
  const confirmedNotificationTime = historyTime(item.reservationConfirmedAt);
  const groomingStartedTime = historyTime(item.groomingStartedAt);
  const pickupReadyTime = historyTime(item.pickupReadyAt);
  const groomingCompletedTime = historyTime(item.recordCompletedAt ?? item.groomingCompletedAt ?? item.actualCompletedAt);
  const shouldShowGroomingStarted = item.type === "record" || item.status === "진행 중" || item.status === "픽업 준비" || item.status === "완료";
  const shouldShowPickupReady = Boolean(item.pickupReadyAt) || item.status === "픽업 준비";
  const shouldShowCompleted = item.type === "record" || item.status === "완료";
  const items: RecordHistoryTimelineItem[] = [];

  items.push({
    key: "reservation-created",
    title: "예약 등록",
    description: `${sourceLabel}으로 예약이 바로 등록되었습니다.`,
    ...reservationTime,
    dotClassName: "bg-[#2f7866]",
  });

  if (item.reservationConfirmedAt) {
    items.push({
      key: "booking-confirmed-notification",
      title: "예약 확정 안내",
      description: "오너가 직접 등록한 예약의 확정 알림톡을 발송했습니다.",
      ...confirmedNotificationTime,
      dotClassName: "bg-[#2f7866]",
    });
  }

  if (shouldShowGroomingStarted) {
    items.push({
      key: "grooming-started",
      title: "미용 시작",
      description: "미용이 시작되었습니다.",
      ...groomingStartedTime,
      dotClassName: "bg-[#2563eb]",
    });
  }

  if (shouldShowPickupReady) {
    items.push({
      key: "pickup-ready",
      title: "픽업 준비중",
      description: "보호자에게 픽업 준비를 안내했습니다.",
      ...pickupReadyTime,
      dotClassName: "bg-[#7c3aed]",
    });
  }

  if (shouldShowCompleted) {
    items.push({
      key: "grooming-completed",
      title: "미용 완료",
      description: "미용이 완료되었습니다.",
      ...groomingCompletedTime,
      dotClassName: "bg-[#64748b]",
    });
  }

  return items;
}

const appointmentHistoryFields = [
  { key: "status", label: "상태" },
  { key: "appointment_date", label: "날짜" },
  { key: "appointment_time", label: "시간" },
  { key: "service_id", label: "서비스" },
  { key: "staff_id", label: "담당" },
  { key: "memo", label: "메모" },
  { key: "visit_reminder_offset_minutes", label: "방문 전 알림" },
] as const;

function historyRawValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function formatAppointmentHistoryValue(
  key: string,
  value: unknown,
  services: BootstrapPayload["services"],
  staffMembers: BootstrapPayload["staffMembers"],
) {
  if (value === null || value === undefined || value === "") return "없음";

  if (key === "status") {
    const status = String(value) as AppointmentStatus;
    return appointmentStatusLabels[status] ?? String(value);
  }

  if (key === "appointment_time") {
    return formatClockTime(String(value));
  }

  if (key === "service_id") {
    const service = services.find((item) => item.id === value);
    return service?.name ?? "삭제된 서비스";
  }

  if (key === "staff_id") {
    const staff = staffMembers.find((item) => item.id === value);
    return staff?.displayName || staff?.name || "담당 미지정";
  }

  if (key === "visit_reminder_offset_minutes") {
    return `${value}분`;
  }

  return String(value);
}

function buildAppointmentHistoryChanges(
  event: AppointmentChangeEvent,
  services: BootstrapPayload["services"],
  staffMembers: BootstrapPayload["staffMembers"],
) {
  return appointmentHistoryFields
    .map((field) => {
      const previousValue = event.previous_values[field.key];
      const nextValue = event.next_values[field.key];
      if (historyRawValue(previousValue) === historyRawValue(nextValue)) return null;
      return {
        key: field.key,
        label: field.label,
        previous: formatAppointmentHistoryValue(field.key, previousValue, services, staffMembers),
        next: formatAppointmentHistoryValue(field.key, nextValue, services, staffMembers),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function RecordHistoryCard({
  item,
  sourceLabel,
  changeEvents,
  services,
  staffMembers,
}: {
  item: DayItem;
  sourceLabel: string;
  changeEvents: AppointmentChangeEvent[];
  services: BootstrapPayload["services"];
  staffMembers: BootstrapPayload["staffMembers"];
}) {
  const [open, setOpen] = useState(false);
  const historyItems = buildRecordHistoryTimeline(item, sourceLabel);
  const lastItem = historyItems[historyItems.length - 1];
  const sortedChangeEvents = [...changeEvents].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className={cn("h-2 w-2 rounded-full", statusIndicatorBgClass[getStatusAccent(item)])} aria-hidden="true" />
            <span className="text-[14px] font-medium leading-5 text-[#334155]">기록 히스토리</span>
        {lastItem ? <span className="ml-auto truncate text-right text-[12px] text-[#64748b]">{lastItem.title} · {lastItem.time}</span> : null}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#94a3b8] transition", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div className="border-t border-[#edf2f7] px-3 py-2">
          <div className="space-y-0 pl-0.5">
            {historyItems.map((historyItem, index) => (
              <div key={historyItem.key} className="relative grid grid-cols-[18px_minmax(0,1fr)] gap-2 py-2 first:pt-0 last:pb-0">
                {index < historyItems.length - 1 ? <span className="absolute left-[5px] top-[18px] h-[calc(100%-8px)] w-px bg-[#e2e8f0]" aria-hidden="true" /> : null}
                <span className={cn("relative z-10 mt-2 h-2 w-2 rounded-full", historyItem.dotClassName)} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-[14px] font-medium leading-5 text-[#111827]">{historyItem.title}</p>
                    <span className={cn("ml-auto shrink-0 text-[12px] tabular-nums", historyItem.hasTime ? "text-[#64748b]" : "text-[#94a3b8]")}>
                      {historyItem.time}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-[#64748b]">{historyItem.description}</p>
                </div>
              </div>
            ))}
          </div>

          {sortedChangeEvents.length > 0 ? (
            <div className="mt-3 border-t border-[#edf2f7] pt-3">
            <p className="text-[14px] font-medium leading-5 text-[#334155]">변경/취소 이력</p>
              <div className="mt-2 space-y-2">
                {sortedChangeEvents.map((event) => {
                  const changes = buildAppointmentHistoryChanges(event, services, staffMembers);
                  return (
                    <div key={event.id} className="rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-3">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] text-[#111827]">{event.event_type === "status" ? "상태 변경" : "예약 변경"}</p>
                        <span className="ml-auto text-[12px] text-[#64748b]">{formatHistoryTimestamp(event.created_at)}</span>
                      </div>
                      {changes.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {changes.map((change) => (
                            <div key={change.key} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-[13px] leading-5">
                              <span className="text-[#64748b]">{change.label}</span>
                              <span className="min-w-0 text-[#334155]">
                                <span className="text-[#94a3b8]">{change.previous}</span>
                                <span className="mx-1 text-[#94a3b8]">→</span>
                                <span className="text-[#111827]">{change.next}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-[13px] text-[#64748b]">세부 변경 항목이 없습니다.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
