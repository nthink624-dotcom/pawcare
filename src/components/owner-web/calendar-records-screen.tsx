"use client";

import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, PawPrint, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { OwnerMediaUploadPanel } from "@/components/owner-web/media-upload-panel";
import { patchOwnerAppointmentStatus, replaceAppointmentInBootstrap } from "@/components/owner-web/calendar-owner-api";
import { OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS } from "@/components/owner-web/owner-web-action-button-styles";
import { AssetIcon, WebSurface } from "@/components/owner-web/owner-web-ui";
import { getDotIndicatorClass, getWrapIndicatorClass, statusIndicatorBgClass, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { isShopClosedOnDate } from "@/lib/availability";
import { cn, currentDateInTimeZone, currentMinutesInTimeZone, formatClockTime, minutesFromTime } from "@/lib/utils";
import type { AppointmentChangeEvent, AppointmentStatus, BootstrapPayload } from "@/types/domain";

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
  confirmed: "확정",
  in_progress: "진행 중",
  almost_done: "픽업 준비",
  completed: "완료",
  cancelled: "취소",
  rejected: "거절",
  noshow: "노쇼",
};
function isOverduePendingStatus(status: string) {
  return false;
}

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
  return `${parsed.getMonth() + 1}월`;
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getMonth() + 1}.${parsed.getDate()}`;
}

function formatFullDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${String(parsed.getFullYear()).slice(-2)}년 ${parsed.getMonth() + 1}월 ${parsed.getDate()}일 ${weekdayLabels[parsed.getDay()]}요일`;
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

function moveMonth(date: string, offset: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setMonth(parsed.getMonth() + offset);
  return parsed.toLocaleDateString("en-CA");
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

function getRecordTone(item: DayItem) {
  if (item.type === "record") return "border-[#dbe2ea]";
  return "border-[#c8ded6]";
}

function getBadgeTone(item: DayItem) {
  return "text-[#111827]";
}

function getTimeTone(item: DayItem) {
  return "text-[#111827]";
}

function getStatusAccent(item: DayItem): StatusIndicatorTone {
  if (item.type === "record") return "slate";
  if (item.status === "취소" || item.status === "거절" || item.status === "노쇼") return "burgundy";
  return "teal";
}

function getCalendarCellTone(active: boolean, isToday: boolean, hasItems: boolean, closed: boolean) {
  if (active) return "border-[#111827] bg-white shadow-[inset_3px_0_0_#111827,0_8px_20px_rgba(15,23,42,0.08)]";
  if (closed) return "border-white bg-[linear-gradient(135deg,#f8fafc_0,#f8fafc_45%,#eef2f7_45%,#eef2f7_50%,#f8fafc_50%,#f8fafc_95%,#eef2f7_95%)] bg-[length:12px_12px] shadow-[0_1px_4px_rgba(15,23,42,0.03)]";
  if (isToday) return "border-[#dbe2ea] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.035)]";
  if (hasItems) return "border-white bg-[linear-gradient(to_bottom,#fff_0%,#fff_62%,#fbfefd_100%)] shadow-[0_1px_4px_rgba(15,23,42,0.035)] hover:border-[#d5e7df] hover:shadow-[0_6px_16px_rgba(15,23,42,0.055)]";
  return "border-white bg-[linear-gradient(to_bottom,#fff_0%,#fff_72%,#fcfefd_100%)] shadow-[0_1px_4px_rgba(15,23,42,0.032)] hover:border-[#dbe8e2] hover:bg-white hover:shadow-[0_5px_14px_rgba(15,23,42,0.05)]";
}

type CalendarStatusKey = "confirmed" | "completed" | "changed" | "cancelled";
type CalendarStatusFilter = "all" | CalendarStatusKey;
type CalendarStaffFilter = "all" | string;

type CalendarStatusIndicator = {
  key: CalendarStatusKey;
  label: string;
  tone: StatusIndicatorTone;
};

const calendarStatusIndicators: CalendarStatusIndicator[] = [
  { key: "confirmed", label: "확정", tone: "teal" },
  { key: "changed", label: "변경", tone: "amber" },
  { key: "cancelled", label: "취소", tone: "burgundy" },
  { key: "completed", label: "완료", tone: "slate" },
];

function getCalendarStatusCounts(items: DayItem[]) {
  const reservationItems = items.filter((item) => item.type === "reservation");

  return {
    confirmed: reservationItems.filter((item) => item.status === "확정" || item.status === "진행 중" || item.status === "픽업 준비").length,
    completed: items.filter((item) => item.type === "record" || item.status.includes("완료")).length,
    changed: reservationItems.filter((item) => item.status.includes("변경")).length,
    cancelled: reservationItems.filter((item) => item.status.includes("취소") || item.status.includes("거절") || item.status.includes("노쇼")).length,
  };
}

function getCalendarStatusSummaryClass(tone: StatusIndicatorTone) {
  if (tone === "amber") return "border-[#d6a34c] bg-[#fff2cf] text-[#7a4d0b] shadow-[0_1px_3px_rgba(185,129,33,0.18)]";
  if (tone === "teal") return "border-[#9aa8b6] bg-[#f5f7fa] text-[#334155] shadow-[0_1px_3px_rgba(96,112,128,0.16)]";
  if (tone === "burgundy") return "border-[#d9919d] bg-[#fff0f3] text-[#8f2438] shadow-[0_1px_3px_rgba(160,68,85,0.18)]";
  return "border-[#b9c3cf] bg-[#f8fafc] text-[#475569] shadow-[0_1px_3px_rgba(15,23,42,0.12)]";
}

function getCalendarStatusShortLabel(key: CalendarStatusKey) {
  if (key === "confirmed") return "확정";
  if (key === "completed") return "완료";
  if (key === "changed") return "변경";
  return "취소";
}

function getItemStatusGroup(item: Pick<DayItem, "type" | "status">): CalendarStatusKey {
  if (item.type === "record" || item.status.includes("완료")) return "completed";
  if (item.status.includes("변경")) return "changed";
  if (item.status.includes("취소") || item.status.includes("거절") || item.status.includes("노쇼")) return "cancelled";
  return "confirmed";
}

function matchesStatusFilter(item: Pick<DayItem, "type" | "status">, filter: CalendarStatusFilter) {
  return filter === "all" || getItemStatusGroup(item) === filter;
}

function getOperationalPriority(item: Pick<DayItem, "type" | "status">) {
  if (item.status.includes("변경")) return 1;
  if (item.status === "확정" || item.status === "진행 중" || item.status === "픽업 준비") return 2;
  if (item.status.includes("취소") || item.status.includes("거절") || item.status.includes("노쇼")) return 3;
  return item.type === "record" ? 4 : 3;
}

function sortOperationalItems(items: DayItem[]) {
  return [...items].sort((first, second) => {
    const priorityDiff = getOperationalPriority(first) - getOperationalPriority(second);
    if (priorityDiff !== 0) return priorityDiff;
    return (first.time ?? "99:99").localeCompare(second.time ?? "99:99");
  });
}

function getStaffDayKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
  return staffDayKeys[weekday];
}

function getStaffWorkNotice(data: BootstrapPayload, date: string, staffFilter: CalendarStaffFilter) {
  if (isShopClosedOnDate(data.shop, date)) return { closed: true, label: "매장 휴무", description: "예약을 받지 않는 날입니다." };

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

  const parts = [
    offStaff.length > 0 ? `${offStaff.map((staff) => staff.name).join(", ")} 휴무` : "",
    halfStaff.length > 0 ? `${halfStaff.map((staff) => staff.name).join(", ")} 반차` : "",
  ].filter(Boolean);

  return {
    closed: false,
    label: parts.length > 0 ? parts.join(" · ") : "근무 가능",
    description: parts.length > 0 ? "근무표 기준 예약 가능 여부를 확인해 주세요." : "근무표상 특이사항이 없습니다.",
  };
}

function isPastPendingReservation(date: string, time?: string) {
  const today = currentDateInTimeZone();
  if (date < today) return true;
  if (date > today) return false;
  if (!time) return false;
  return minutesFromTime(time) <= currentMinutesInTimeZone();
}

export default function CalendarRecordsScreen({
  initialData,
  onDataChange,
  onCreateReservationForDate,
}: {
  initialData: BootstrapPayload;
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
  const [confirmingReservationId, setConfirmingReservationId] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState("");

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
  const calendarWeekRows = Math.max(5, Math.ceil(monthDates.length / 7));
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
  const selectedWorkNotice = getStaffWorkNotice(initialData, selectedDate, staffFilter);
  const staffOptions = useMemo(
    () => [
      { value: "all", label: "전체 직원" },
      ...initialData.staffMembers.map((staff) => ({ value: staff.id, label: staff.displayName || staff.name })),
    ],
    [initialData.staffMembers],
  );
  const statusOptions: Array<{ value: CalendarStatusFilter; label: string }> = [
    { value: "all", label: "전체 상태" },
    { value: "confirmed", label: "확정/진행" },
    { value: "changed", label: "변경" },
    { value: "cancelled", label: "취소/거절" },
    { value: "completed", label: "완료" },
  ];

  async function confirmReservation(reservationId: string) {
    const reservation = reservations.find((item) => item.id === reservationId);
    if (!reservation) return;

    if (isPastPendingReservation(reservation.date, reservation.time)) {
      setCalendarError("이미 지난 예약 시간입니다. 다른 시간 안내 또는 예약 거절로 처리해 주세요.");
      return;
    }

    setCalendarError("");
    setConfirmingReservationId(reservationId);

    try {
      const updatedAppointment = await patchOwnerAppointmentStatus({
        appointmentId: reservationId,
        status: "confirmed",
      });
      const nextData = replaceAppointmentInBootstrap(initialData, updatedAppointment);
      const nextReservations = buildReservationsFromBootstrap(nextData);
      const updatedReservation = nextReservations.find((item) => item.id === reservationId);

      setReservations(nextReservations);
      setSelectedItem((current) =>
        current?.id === reservationId && current.type === "reservation" && updatedReservation
          ? {
              ...current,
              status: updatedReservation.status,
              eventUpdatedAt: updatedReservation.eventUpdatedAt,
              reservationConfirmedAt: updatedReservation.reservationConfirmedAt,
            }
          : current,
      );
      onDataChange?.(nextData);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "예약 확정 중 문제가 발생했습니다.");
    } finally {
      setConfirmingReservationId(null);
    }
  }

  function openDate(date: string) {
    setSelectedDate(date);
    setSelectedItem(null);
  }

  function openItem(item: DayItem) {
    setSelectedDate(item.date);
    setSelectedItem(item);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <WebSurface className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e7eb] bg-white px-5 py-2.5">
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthAnchor((current) => moveMonth(current, -1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] transition hover:bg-[#f8fafc]"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="flex h-9 min-w-[78px] items-center justify-center px-3 text-center text-[16px] font-medium text-[#111827]">{formatMonthLabel(monthAnchor)}</p>
            <button
              type="button"
              onClick={() => setMonthAnchor((current) => moveMonth(current, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] transition hover:bg-[#f8fafc]"
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const today = currentDateInTimeZone();
                setMonthAnchor(today);
                openDate(today);
              }}
              className="h-9 rounded-[8px] bg-[#111827] px-4 text-[14px] font-medium text-white hover:bg-[#1f2937]"
            >
              오늘
            </button>
          </div>
          <label className="flex h-9 min-w-[280px] flex-1 items-center gap-3 rounded-[8px] border border-[#e5e7eb] bg-white px-3 text-[#64748b]">
            <AssetIcon src="/icons/phosphor/MagnifyingGlass.svg" className="h-4 w-4 text-[#94a3b8]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-[15px] text-[#111827] outline-none placeholder:text-[#94a3b8]"
              placeholder="반려동물명, 보호자명, 메모 검색"
            />
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="relative block">
              <select
                value={staffFilter}
                onChange={(event) => setStaffFilter(event.target.value)}
                className="h-9 min-w-[132px] appearance-none rounded-[8px] border border-[#e5e7eb] bg-white pl-3 pr-10 text-[15px] font-normal text-[#111827] outline-none focus:border-[#111827]"
              >
                {staffOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
            </label>
            <label className="relative block">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as CalendarStatusFilter)}
                className="h-9 min-w-[132px] appearance-none rounded-[8px] border border-[#e5e7eb] bg-white pl-3 pr-10 text-[15px] font-normal text-[#111827] outline-none focus:border-[#111827]"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
            </label>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 items-stretch overflow-hidden xl:grid-cols-[minmax(0,1fr)_392px]">
          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#f1f5f9] xl:border-r xl:border-[#edf2f7]">
            <div className="grid grid-cols-7 border-b border-[#e5e7eb] bg-white">
              {weekdayLabels.map((label) => (
                <div key={label} className="flex h-9 items-center justify-center text-center text-[13px] font-medium">
                  <span className="inline-flex h-6 min-w-8 items-center justify-center px-2 text-[#111827]">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="grid min-h-0 flex-1 grid-cols-7 gap-px bg-[#eef2f7] p-px"
              style={{ gridTemplateRows: `repeat(${calendarWeekRows}, minmax(0, 1fr))` }}
            >
              {monthDates.map((date, index) => {
                const items = date ? dayItemsByDate.get(date) ?? [] : [];
                const birthdays = date ? birthdayItemsByDate.get(date) ?? [] : [];
                const recordCount = items.filter((item) => item.type === "record").length;
                const reservationCount = items.filter((item) => item.type === "reservation").length;
                const birthdayCount = birthdays.length;
                const active = date === selectedDate;
                const hasItems = items.length > 0 || birthdayCount > 0;
                const isToday = date === currentDateInTimeZone();
                if (!date) {
                  return <div key={`empty-${index}`} className="min-h-0 rounded-[8px] bg-[#fdfefe]" />;
                }

                const workNotice = getStaffWorkNotice(initialData, date, staffFilter);
                const statusCounts = getCalendarStatusCounts(items);
                const visibleStatuses = calendarStatusIndicators.filter((indicator) => statusCounts[indicator.key] > 0);
                const primaryStatuses = visibleStatuses.slice(0, 3);
                const hiddenStatusCount = visibleStatuses.length - primaryStatuses.length;

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => openDate(date)}
                    className={cn(
                      "relative flex min-h-0 flex-col justify-between overflow-hidden rounded-[8px] border px-3 py-2 text-left transition duration-150",
                      getCalendarCellTone(active, isToday, hasItems, workNotice.closed),
                    )}
                    aria-label={`${date} 예약 ${reservationCount}건`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "leading-5",
                          isToday
                            ? "text-[15px] font-bold text-[#111827]"
                            : active
                              ? "text-[13px] font-bold text-[#111827]"
                              : hasItems
                                ? "text-[13px] font-medium text-[#111827]"
                                : "text-[13px] font-medium text-[#111827]",
                        )}
                      >
                        {Number(date.slice(-2))}
                      </span>
                      {reservationCount > 0 ? (
                        <span className="pt-0.5 text-[11px] font-medium leading-4 text-[#64748b]">
                          {reservationCount}건
                        </span>
                      ) : birthdayCount > 0 ? (
                        <span className="pt-0.5 text-[11px] font-medium leading-4 text-[#b98121]">
                          생일 {birthdayCount}
                        </span>
                      ) : workNotice.closed ? (
                        <span className="rounded-full border border-[#dbe2ea] bg-white/85 px-2 py-0.5 text-[11px] font-normal text-[#64748b]">휴무</span>
                      ) : null}
                    </div>
                    {!workNotice.closed && workNotice.label !== "근무 가능" ? (
                      <span className="line-clamp-1 text-[11px] font-normal leading-4 text-[#94a3b8]">{workNotice.label}</span>
                    ) : null}
                    {visibleStatuses.length > 0 ? (
                      <div className="flex flex-wrap items-end gap-1">
                        {primaryStatuses.map((indicator) => (
                          <span
                            key={indicator.key}
                            className={cn(
                              "inline-flex h-5 min-w-[42px] items-center justify-center rounded-full border px-2 text-[11px] font-medium leading-none",
                              getCalendarStatusSummaryClass(indicator.tone),
                            )}
                            title={`${indicator.label} ${statusCounts[indicator.key]}건`}
                          >
                            {getCalendarStatusShortLabel(indicator.key)} {statusCounts[indicator.key]}
                          </span>
                        ))}
                        {hiddenStatusCount > 0 ? (
                          <span className="inline-flex h-5 min-w-[34px] items-center justify-center rounded-full border border-[#b9c3cf] bg-[#f8fafc] px-2 text-[11px] font-medium leading-none text-[#475569] shadow-[0_1px_3px_rgba(15,23,42,0.1)]">
                            +{hiddenStatusCount}
                          </span>
                        ) : null}
                      </div>
                    ) : birthdayCount > 0 ? (
                      <div className="flex flex-wrap items-end gap-1">
                        <span className="inline-flex h-5 min-w-[42px] items-center justify-center rounded-full border border-[#d6a34c] bg-[#fff2cf] px-2 text-[11px] font-medium leading-none text-[#7a4d0b] shadow-[0_1px_3px_rgba(185,129,33,0.16)]">
                          생일 {birthdayCount}
                        </span>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <GroomingDatePanel
            date={selectedDate}
            items={selectedItems}
            birthdays={selectedBirthdays}
            error={calendarError}
            workNotice={selectedWorkNotice}
            confirmingReservationId={confirmingReservationId}
            onSelectItem={openItem}
            onConfirmReservation={confirmReservation}
            onAddReservation={onCreateReservationForDate ? () => onCreateReservationForDate(selectedDate) : undefined}
          />
        </div>
      </WebSurface>

      {selectedItem ? (
        <GroomingRecordSheet
          shopId={initialData.shop.id}
          item={selectedItem}
          changeEvents={(initialData.appointmentChangeEvents ?? []).filter(
            (event) => selectedItem.appointmentId && event.appointment_id === selectedItem.appointmentId,
          )}
          services={initialData.services}
          staffMembers={initialData.staffMembers}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </div>
  );
}

function GroomingDatePanel({
  date,
  items,
  birthdays,
  error,
  workNotice,
  confirmingReservationId,
  onSelectItem,
  onConfirmReservation,
  onAddReservation,
}: {
  date: string;
  items: DayItem[];
  birthdays: BirthdayItem[];
  error: string;
  workNotice: ReturnType<typeof getStaffWorkNotice>;
  confirmingReservationId: string | null;
  onSelectItem: (item: DayItem) => void;
  onConfirmReservation: (reservationId: string) => void | Promise<void>;
  onAddReservation?: () => void;
}) {
  const visibleItems = sortOperationalItems(items);
  const hasVisibleContent = visibleItems.length > 0 || birthdays.length > 0;

  return (
    <aside className="self-start bg-white">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-normal text-[#334155]">{formatFullDate(date)}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {onAddReservation ? (
              <button
                type="button"
                onClick={onAddReservation}
                className={OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS}
              >
                <CalendarPlus className="h-4 w-4" />
                예약 추가
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3">
          {error ? (
            <div className="mb-2 rounded-[8px] border border-[#ead28e] bg-[#fff8e7] px-3 py-2 text-[13px] leading-5 text-[#8a5a00]">
              {error}
            </div>
          ) : null}
          {!hasVisibleContent ? (
            <div
              className={cn(
                "mb-2 rounded-[8px] border px-3 py-2 text-[13px] leading-5",
                workNotice.closed
                  ? "border-[#ead6dc] bg-[#fffafa] text-[#a04455]"
                  : "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]",
              )}
            >
              <p className="font-medium">{workNotice.label}</p>
              <p className="mt-0.5">{workNotice.description}</p>
            </div>
          ) : null}
          {visibleItems.length > 0 ? (
            <DayItemSection
              title="일정"
              count={visibleItems.length}
              items={visibleItems}
              confirmingReservationId={confirmingReservationId}
              onSelectItem={onSelectItem}
              onConfirmReservation={onConfirmReservation}
              hideHeader
            />
          ) : null}
          {birthdays.length > 0 ? <BirthdaySection birthdays={birthdays} /> : null}
        </div>
      </div>
    </aside>
  );
}

function BirthdaySection({ birthdays }: { birthdays: BirthdayItem[] }) {
  return (
    <section className="mt-2 rounded-[8px] border border-[#ead9b8] bg-[#fffaf0] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[#8a5a00]">반려동물 생일</p>
        <span className="text-[12px] text-[#b98121]">{birthdays.length}마리</span>
      </div>
      <div className="space-y-1.5">
        {birthdays.map((birthday) => (
          <div key={birthday.id} className="flex min-w-0 items-center gap-2 rounded-[8px] border border-[#f0dfbd] bg-white px-3 py-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff4dc] text-[#b98121]">
              <PawPrint className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[#111827]">{birthday.pet} · {birthday.breed}</p>
              <p className="mt-0.5 truncate text-[12px] text-[#64748b]">{birthday.customer} 보호자</p>
            </div>
            {birthday.phone ? <span className="shrink-0 text-[12px] tabular-nums text-[#64748b]">{formatRecordPhone(birthday.phone)}</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function DayItemSection({
  title,
  count,
  items,
  confirmingReservationId,
  onSelectItem,
  onConfirmReservation,
  hideHeader = false,
}: {
  title: string;
  count: number;
  items: DayItem[];
  confirmingReservationId: string | null;
  onSelectItem: (item: DayItem) => void;
  onConfirmReservation: (reservationId: string) => void | Promise<void>;
  hideHeader?: boolean;
}) {
  return (
    <section>
      {!hideHeader ? (
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#334155]">{title}</p>
          <span className="text-[12px] text-[#94a3b8]">{count}건</span>
        </div>
      ) : null}
      {items.length > 0 ? (
        <div className="space-y-1">
          {items.map((item) => {
            const confirming = confirmingReservationId === item.id;
            const confirmable = false;
            return (
            <div
              key={`${item.type}-${item.id}`}
              className={cn(
                "relative w-full overflow-hidden rounded-[8px] border bg-white transition hover:bg-[#f8fafc]",
                getRecordTone(item),
                getWrapIndicatorClass(getStatusAccent(item)),
              )}
            >
              <button type="button" onClick={() => onSelectItem(item)} className="w-full px-3 py-2 text-left">
                <div className="flex min-w-0 items-start justify-between gap-3 pl-1">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#111827]">{item.pet} · {item.customer}</p>
                  </div>
                  {item.time ? <span className={cn("shrink-0 text-[14px] font-normal tabular-nums", getTimeTone(item))}>{item.time}</span> : null}
                </div>
                <div className="mt-1 flex min-w-0 items-end justify-between gap-3 pl-1">
                  <p className="line-clamp-1 min-w-0 text-[12px] leading-4 text-[#64748b]">
                    {item.service}
                    {item.note ? ` · ${item.note}` : ""}
                  </p>
                  <span className={cn("shrink-0 bg-white px-0 py-0 text-[14px] font-normal leading-5", getBadgeTone(item))}>
                    {item.type === "record" ? "기록" : item.status}
                  </span>
                </div>
              </button>
              {confirmable ? (
                <div className="border-t border-[#f1e4c2] px-3 pb-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onConfirmReservation(item.id)}
                    disabled={confirming}
                    className="h-8 w-full rounded-[7px] bg-[#dca93b] text-[13px] font-medium text-white transition hover:bg-[#c79024] disabled:cursor-not-allowed disabled:bg-[#d8c6a7]"
                  >
                    {confirming ? "확정 중" : "예약 확정"}
                  </button>
                </div>
              ) : null}
            </div>
          );
          })}
        </div>
      ) : (
        <div className="rounded-[8px] border border-dashed border-[#dbe2ea] bg-white px-3 py-3 text-[12px] text-[#94a3b8]">
          표시할 항목이 없습니다.
        </div>
      )}
    </section>
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
            <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
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
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="truncate text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">{item.pet}</h3>
                {item.breed ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d7eadf] bg-[#f2faf6] px-2 py-0.5 text-[15px] text-[#2f7866]">
                    <PawPrint className="h-3.5 w-3.5" />
                    {item.breed}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[16px] text-[#334155]">{item.customer}</p>
              <p className="mt-0.5 text-[15px] text-[#64748b]">{formatRecordPhone(item.phone)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <section className={cn("rounded-[8px] border bg-white px-3 py-2.5", getWrapIndicatorClass(getStatusAccent(item)))}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] leading-5 text-[#64748b]">서비스</p>
                <p className="truncate text-[20px] font-semibold tracking-[-0.03em] text-[#111827]">{item.service}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[12px]",
                  isUnassignedStaff ? "border-[#f0c27a] bg-[#fffaf0] text-[#9a5b12]" : "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]",
                )}
              >
                {staffLabel}
              </span>
            </div>
          </section>

          <RecordMemoCard title="고객 요청사항" value={customerRequest} empty={!hasCustomerRequest} highlighted />
          <RecordMemoCard title="직원 코멘트" value={staffComment} empty={!hasStaffComment} />

          <RecordHistoryCard item={item} sourceLabel={sourceLabel} changeEvents={changeEvents} services={services} staffMembers={staffMembers} />

          {item.next ? (
            <section className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <p className="text-[15px] text-[#64748b]">다음 체크</p>
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
      <p className="text-[15px] text-[#64748b]">{label}</p>
      <p className="mt-1 truncate text-[16px] text-[#111827]">{value}</p>
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
      <p className="text-[15px] text-[#64748b]">{title}</p>
      <p className={cn("whitespace-pre-wrap", empty ? "mt-1 text-[15px] leading-5 text-[#64748b]" : "mt-2 text-[16px] leading-6 text-[#111827]")}>{value}</p>
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
  const confirmedTime = historyTime(item.reservationConfirmedAt);
  const groomingStartedTime = historyTime(item.groomingStartedAt);
  const pickupReadyTime = historyTime(item.pickupReadyAt);
  const groomingCompletedTime = historyTime(item.recordCompletedAt ?? item.groomingCompletedAt ?? item.actualCompletedAt);
  const shouldShowConfirmed = item.type === "record" || !isOverduePendingStatus(item.status);
  const shouldShowGroomingStarted = item.type === "record" || item.status === "진행 중" || item.status === "픽업 준비" || item.status === "완료";
  const shouldShowPickupReady = Boolean(item.pickupReadyAt) || item.status === "픽업 준비";
  const shouldShowCompleted = item.type === "record" || item.status === "완료";
  const items: RecordHistoryTimelineItem[] = [];

  items.push({
    key: "reservation-created",
    title: "예약 접수",
    description: `${sourceLabel}으로 예약이 접수되었습니다.`,
    ...reservationTime,
    dotClassName: "bg-[#b98121]",
  });

  if (shouldShowConfirmed) {
    items.push({
      key: "reservation-confirmed",
      title: "예약 확정",
      description: "예약이 확정되었습니다.",
      ...confirmedTime,
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
        <span className="text-[15px] text-[#334155]">기록 히스토리</span>
        {lastItem ? <span className="ml-auto truncate text-right text-[12px] text-[#64748b]">{lastItem.title} · {lastItem.time}</span> : null}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#94a3b8] transition", open && "rotate-180")} />
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
                    <p className="truncate text-[15px] text-[#111827]">{historyItem.title}</p>
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
              <p className="text-[15px] text-[#334155]">변경/취소 이력</p>
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
