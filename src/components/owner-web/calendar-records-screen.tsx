"use client";

import { ChevronDown, ChevronLeft, ChevronRight, PawPrint, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { OwnerMediaUploadPanel } from "@/components/owner-web/media-upload-panel";
import { AssetIcon, WebSurface } from "@/components/owner-web/owner-web-ui";
import { getDotIndicatorClass, getWrapIndicatorClass, statusIndicatorBgClass, type StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import { cn, currentDateInTimeZone, formatClockTime } from "@/lib/utils";
import type { AppointmentStatus, BootstrapPayload } from "@/types/domain";

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

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

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

    return {
      id: appointment.id,
      guardianId: appointment.guardian_id,
      petId: appointment.pet_id,
      pet: displayText(pet?.name, "반려동물 미등록"),
      breed: displayText(pet?.breed, "품종 미입력"),
      customer: displayText(guardian?.name, "보호자 미등록"),
      phone: guardian?.phone ?? "",
      service: displayText(service?.name, "서비스 미등록"),
      status: appointmentStatusLabels[appointment.status],
      note: customerRequest || "요청 메모가 없습니다.",
      customerRequest,
      staffComment,
      date: appointment.appointment_date,
      time: appointment.appointment_time,
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
  return `${String(parsed.getFullYear()).slice(-2)}년 ${parsed.getMonth() + 1}월`;
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
        .map((reservation) => ({
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
          status: reservation.status,
          note: reservation.note,
          customerRequest: reservation.customerRequest,
          staffComment: reservation.staffComment,
          time: reservation.time,
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
        }))
    : [];

  return [...reservationItems, ...completedReservationRecordItems, ...recordItems].sort((first, second) =>
    (first.time ?? "99:99").localeCompare(second.time ?? "99:99"),
  );
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
  if (item.status === "승인 대기") return "border-[#ead28e]";
  return "border-[#c8ded6]";
}

function getBadgeTone(item: DayItem) {
  if (item.type === "record") return "text-[#475569]";
  if (item.status === "승인 대기") return "text-[#8a5a00]";
  return "text-[#1f6b5b]";
}

function getTimeTone(item: DayItem) {
  if (item.type === "record") return "text-[#475569]";
  if (item.status === "승인 대기") return "text-[#8a5a00]";
  return "text-[#1f6b5b]";
}

function getStatusAccent(item: DayItem): StatusIndicatorTone {
  if (item.type === "record") return "slate";
  if (item.status === "승인 대기") return "amber";
  if (item.status === "취소" || item.status === "거절" || item.status === "노쇼") return "burgundy";
  return "teal";
}

function getCalendarCellTone(active: boolean, isToday: boolean, hasItems: boolean) {
  if (active) return "border-[#2f7866] bg-white shadow-[inset_3px_0_0_#2f7866,0_8px_20px_rgba(15,23,42,0.08)]";
  if (isToday) return "border-[#d6e8e1] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.035)]";
  if (hasItems) return "border-white bg-[linear-gradient(to_bottom,#fff_0%,#fff_62%,#fbfefd_100%)] shadow-[0_1px_4px_rgba(15,23,42,0.035)] hover:border-[#d5e7df] hover:shadow-[0_6px_16px_rgba(15,23,42,0.055)]";
  return "border-white bg-[linear-gradient(to_bottom,#fff_0%,#fff_72%,#fcfefd_100%)] shadow-[0_1px_4px_rgba(15,23,42,0.032)] hover:border-[#dbe8e2] hover:bg-white hover:shadow-[0_5px_14px_rgba(15,23,42,0.05)]";
}

type CalendarStatusIndicator = {
  key: "pending" | "confirmed" | "completed" | "changed" | "cancelled";
  label: string;
  tone: StatusIndicatorTone;
};

const calendarStatusIndicators: CalendarStatusIndicator[] = [
  { key: "confirmed", label: "확정", tone: "teal" },
  { key: "pending", label: "승인대기", tone: "amber" },
  { key: "completed", label: "완료", tone: "slate" },
  { key: "changed", label: "변경", tone: "amber" },
  { key: "cancelled", label: "취소", tone: "burgundy" },
];

function getCalendarStatusCounts(items: DayItem[]) {
  const reservationItems = items.filter((item) => item.type === "reservation");

  return {
    pending: reservationItems.filter((item) => item.status.includes("승인")).length,
    confirmed: reservationItems.filter((item) => item.status === "확정" || item.status === "진행 중" || item.status === "픽업 준비").length,
    completed: items.filter((item) => item.type === "record" || item.status.includes("완료")).length,
    changed: reservationItems.filter((item) => item.status.includes("변경")).length,
    cancelled: reservationItems.filter((item) => item.status.includes("취소") || item.status.includes("거절") || item.status.includes("노쇼")).length,
  };
}

function getCalendarStatusBarClass(tone: StatusIndicatorTone) {
  return cn("h-[3px] w-3 rounded-full", statusIndicatorBgClass[tone]);
}

export default function CalendarRecordsScreen({ initialData }: { initialData: BootstrapPayload }) {
  const records = useMemo(() => buildRecordsFromBootstrap(initialData), [initialData]);
  const initialReservations = useMemo(() => buildReservationsFromBootstrap(initialData), [initialData]);
  const [reservations, setReservations] = useState<ReservationRow[]>(() => initialReservations);
  const [selectedDate, setSelectedDate] = useState(currentDateInTimeZone());
  const [monthAnchor, setMonthAnchor] = useState(currentDateInTimeZone());
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<DayItem | null>(null);

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
      matchesCalendarSearch([record.pet, record.customer, record.date, record.service, record.memo, record.customerRequest, record.staffComment, record.next], query),
    );
  }, [query, records]);
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
      ),
    );
  }, [query, reservations]);

  const monthDates = useMemo(() => getMonthDates(monthAnchor), [monthAnchor]);
  const dayItemsByDate = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    for (const date of monthDates) {
      if (!date) continue;
      map.set(date, buildDayItems(filteredRecords, filteredReservations, date));
    }
    return map;
  }, [filteredRecords, filteredReservations, monthDates]);
  const selectedItems = dayItemsByDate.get(selectedDate) ?? [];

  function confirmReservation(reservationId: string) {
    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === reservationId
          ? {
              ...reservation,
              status: "확정",
            }
          : reservation,
      ),
    );
    setSelectedItem((current) =>
      current?.id === reservationId && current.type === "reservation"
        ? {
            ...current,
            status: "확정",
          }
        : current,
    );
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
    <div className="space-y-3">
      <WebSurface className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e2e8f0] px-5 py-2">
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthAnchor((current) => moveMonth(current, -1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[130px] text-center text-[18px] font-medium text-[#111827]">{formatMonthLabel(monthAnchor)}</p>
            <button
              type="button"
              onClick={() => setMonthAnchor((current) => moveMonth(current, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]"
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <label className="flex h-11 min-w-[280px] flex-1 items-center gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[#64748b]">
            <AssetIcon src="/icons/phosphor/MagnifyingGlass.svg" className="h-5 w-5 text-[#94a3b8]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-[16px] text-[#111827] outline-none placeholder:text-[#94a3b8]"
              placeholder="반려동물명, 보호자명, 메모 검색"
            />
          </label>
        </div>

        <div className="grid min-h-0 items-start xl:grid-cols-[minmax(0,1fr)_392px]">
          <section className="min-w-0 bg-[#f1f5f9] xl:border-r xl:border-[#edf2f7]">
            <div className="grid grid-cols-7 border-b border-[#e8eef5] bg-[#fbfcfd]">
              {weekdayLabels.map((label) => (
                <div key={label} className="px-2 py-2 text-center text-[13px] font-medium text-[#64748b]">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-[#eef2f7] p-px">
              {monthDates.map((date, index) => {
                const items = date ? dayItemsByDate.get(date) ?? [] : [];
                const recordCount = items.filter((item) => item.type === "record").length;
                const reservationCount = items.filter((item) => item.type === "reservation").length;
                const active = date === selectedDate;
                const hasItems = items.length > 0;
                const isToday = date === currentDateInTimeZone();
                const statusCounts = getCalendarStatusCounts(items);
                const visibleStatuses = calendarStatusIndicators.filter((indicator) => statusCounts[indicator.key] > 0);

                if (!date) {
                  return <div key={`empty-${index}`} className="min-h-[106px] rounded-[8px] bg-[#fdfefe]" />;
                }

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => openDate(date)}
                    className={cn(
                      "relative flex min-h-[112px] flex-col justify-between rounded-[8px] border px-3 py-2.5 text-left transition duration-150",
                      getCalendarCellTone(active, isToday, hasItems),
                    )}
                    aria-label={`${date} 예약 ${reservationCount}건`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "leading-5",
                          isToday
                            ? "text-[15px] font-bold text-[#1f6b5b]"
                            : active
                              ? "text-[13px] font-bold text-[#1f6b5b]"
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
                      ) : null}
                    </div>
                    {visibleStatuses.length > 0 ? (
                      <div className="flex items-end justify-between gap-2">
                        <div className="flex h-5 flex-col-reverse items-start justify-start gap-0.5">
                          {visibleStatuses
                            .filter((indicator) => indicator.key !== "completed")
                            .map((indicator) => (
                              <span
                                key={indicator.key}
                                className={getCalendarStatusBarClass(indicator.tone)}
                                title={`${indicator.label} ${statusCounts[indicator.key]}건`}
                              />
                            ))}
                        </div>
                        {statusCounts.completed > 0 ? (
                          <span
                            className={getCalendarStatusBarClass("slate")}
                            title={`기록 ${statusCounts.completed}건`}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <GroomingDatePanel date={selectedDate} items={selectedItems} onSelectItem={openItem} onConfirmReservation={confirmReservation} />
        </div>
      </WebSurface>

      {selectedItem ? (
        <GroomingRecordSheet shopId={initialData.shop.id} item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}
    </div>
  );
}

function GroomingDatePanel({
  date,
  items,
  onSelectItem,
  onConfirmReservation,
}: {
  date: string;
  items: DayItem[];
  onSelectItem: (item: DayItem) => void;
  onConfirmReservation: (reservationId: string) => void;
}) {
  const isPastDate = date < currentDateInTimeZone();
  const visibleItems = isPastDate ? items.filter((item) => item.type === "record") : items;

  return (
    <aside className="self-start bg-white">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-normal text-[#334155]">{formatFullDate(date)}</h3>
          <span className="text-[13px] text-[#94a3b8]">{visibleItems.length}건</span>
        </div>

        <div className="mt-3">
          {visibleItems.length > 0 ? (
            <DayItemSection title="일정" count={visibleItems.length} items={visibleItems} onSelectItem={onSelectItem} onConfirmReservation={onConfirmReservation} hideHeader />
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#dbe2ea] bg-[#f8fafc] px-4 py-6 text-center text-[13px] text-[#94a3b8]">
              {isPastDate ? "이 날짜에는 기록이 없습니다." : "이 날짜에는 예약이나 기록이 없습니다."}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function DayItemSection({
  title,
  count,
  items,
  onSelectItem,
  onConfirmReservation,
  hideHeader = false,
}: {
  title: string;
  count: number;
  items: DayItem[];
  onSelectItem: (item: DayItem) => void;
  onConfirmReservation: (reservationId: string) => void;
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
            const confirmable = item.type === "reservation" && item.status === "승인 대기";
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
                    className="h-8 w-full rounded-[7px] bg-[#dca93b] text-[13px] font-medium text-white transition hover:bg-[#c79024]"
                  >
                    예약 확정
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
function GroomingRecordSheet({ shopId, item, onClose }: { shopId: string; item: DayItem; onClose: () => void }) {
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

function GroomingRecordSheet({ shopId, item, onClose }: { shopId: string; item: DayItem; onClose: () => void }) {
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

          <RecordHistoryCard item={item} sourceLabel={sourceLabel} />

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
  const shouldShowConfirmed = item.type === "record" || !item.status.includes("승인");
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

function RecordHistoryCard({ item, sourceLabel }: { item: DayItem; sourceLabel: string }) {
  const [open, setOpen] = useState(false);
  const historyItems = buildRecordHistoryTimeline(item, sourceLabel);
  const lastItem = historyItems[historyItems.length - 1];

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
        </div>
      ) : null}
    </section>
  );
}
