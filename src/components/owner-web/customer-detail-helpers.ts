import { currentDateInTimeZone, formatClockTime, minutesFromTime, won } from "@/lib/utils";
import type {
  Appointment,
  AppointmentStatus,
  BootstrapPayload,
  GroomingRecord,
  Guardian,
  Notification,
  NotificationStatus,
  Pet,
  Service,
} from "@/types/domain";

const activeAppointmentStatuses = new Set<AppointmentStatus>(["pending", "confirmed", "in_progress", "almost_done"]);

export type CustomerDetailPet = Pet & {
  latestGroomingRecord: GroomingRecord | null;
  latestAppointment: Appointment | null;
  groomingRecords: GroomingRecord[];
  appointments: Appointment[];
  recentGroomingLabel: string;
  recentStyleLabel: string;
  nextVisitWindowLabel: string;
};

export type CustomerDetailModel = {
  guardian: Guardian;
  pets: CustomerDetailPet[];
  appointments: Appointment[];
  groomingRecords: GroomingRecord[];
  notifications: Notification[];
  servicesById: Map<string, Service>;
  selectedPet: CustomerDetailPet | null;
  upcomingAppointment: Appointment | null;
  recentAppointments: Appointment[];
  recentGroomingRecords: GroomingRecord[];
  recentNotifications: Notification[];
  latestGroomingRecord: GroomingRecord | null;
  recentVisitLabel: string;
  lastAppointmentStatusLabel: string;
  totalAppointments: number;
  totalGroomingRecords: number;
};

export function getGuardianPets(data: BootstrapPayload, guardianId: string) {
  return data.pets.filter((pet) => pet.guardian_id === guardianId);
}

export function getPetAppointments(data: BootstrapPayload, petId: string) {
  return data.appointments
    .filter((appointment) => appointment.pet_id === petId)
    .sort((first, second) => getAppointmentTimestamp(second).localeCompare(getAppointmentTimestamp(first)));
}

export function getPetGroomingRecords(data: BootstrapPayload, petId: string) {
  return data.groomingRecords
    .filter((record) => record.pet_id === petId)
    .sort((first, second) => second.groomed_at.localeCompare(first.groomed_at));
}

export function getLatestGroomingRecord(records: GroomingRecord[]) {
  return records[0] ?? null;
}

export function getUpcomingAppointment(appointments: Appointment[]) {
  const today = currentDateInTimeZone();
  return [...appointments]
    .filter((appointment) => appointment.appointment_date >= today && activeAppointmentStatuses.has(appointment.status))
    .sort((first, second) => getAppointmentTimestamp(first).localeCompare(getAppointmentTimestamp(second)))[0] ?? null;
}

export function getRecentNotificationsForCustomer(data: BootstrapPayload, guardianId: string, petIds: string[]) {
  const petIdSet = new Set(petIds);
  return data.notifications
    .filter((notification) => notification.guardian_id === guardianId || (notification.pet_id ? petIdSet.has(notification.pet_id) : false))
    .sort((first, second) => getNotificationTimestamp(second).localeCompare(getNotificationTimestamp(first)));
}

export function buildCustomerDetailFromBootstrap(
  data: BootstrapPayload,
  guardianId: string,
  selectedPetId?: string | null,
): CustomerDetailModel | null {
  const guardian = data.guardians.find((item) => item.id === guardianId && !item.deleted_at);
  if (!guardian) return null;

  const servicesById = new Map(data.services.map((service) => [service.id, service]));
  const rawPets = getGuardianPets(data, guardian.id);
  const petIds = rawPets.map((pet) => pet.id);
  const petIdSet = new Set(petIds);
  const appointments = data.appointments
    .filter((appointment) => appointment.guardian_id === guardian.id || petIdSet.has(appointment.pet_id))
    .sort((first, second) => getAppointmentTimestamp(second).localeCompare(getAppointmentTimestamp(first)));
  const groomingRecords = data.groomingRecords
    .filter((record) => record.guardian_id === guardian.id || petIdSet.has(record.pet_id))
    .sort((first, second) => second.groomed_at.localeCompare(first.groomed_at));
  const notifications = getRecentNotificationsForCustomer(data, guardian.id, petIds);
  const pets = rawPets.map((pet) => {
    const petAppointments = getPetAppointments(data, pet.id);
    const petGroomingRecords = getPetGroomingRecords(data, pet.id);
    const latestGroomingRecord = getLatestGroomingRecord(petGroomingRecords);
    const service = latestGroomingRecord ? servicesById.get(latestGroomingRecord.service_id) : null;

    return {
      ...pet,
      appointments: petAppointments,
      groomingRecords: petGroomingRecords,
      latestAppointment: petAppointments[0] ?? null,
      latestGroomingRecord,
      recentGroomingLabel: latestGroomingRecord
        ? `${formatTimestampDateTime(latestGroomingRecord.groomed_at)} ${service?.name ?? "서비스"}`
        : "기록 없음",
      recentStyleLabel: latestGroomingRecord?.style_notes?.trim() || "최근 스타일 없음",
      nextVisitWindowLabel: buildNextVisitWindow(latestGroomingRecord, pet.grooming_cycle_weeks),
    } satisfies CustomerDetailPet;
  });
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null;
  const upcomingAppointment = getUpcomingAppointment(selectedPet?.appointments ?? appointments);
  const latestGroomingRecord = selectedPet?.latestGroomingRecord ?? groomingRecords[0] ?? null;
  const recentCompletedAppointment = appointments.find((appointment) => appointment.status === "completed");

  return {
    guardian,
    pets,
    appointments,
    groomingRecords,
    notifications,
    servicesById,
    selectedPet,
    upcomingAppointment,
    recentAppointments: appointments.slice(0, 5),
    recentGroomingRecords: (selectedPet?.groomingRecords ?? groomingRecords).slice(0, 5),
    recentNotifications: notifications.slice(0, 5),
    latestGroomingRecord,
    recentVisitLabel: latestGroomingRecord
      ? formatTimestampDateTime(latestGroomingRecord.groomed_at)
      : recentCompletedAppointment
        ? formatDateTime(recentCompletedAppointment.appointment_date, recentCompletedAppointment.appointment_time)
        : "방문 기록 없음",
    lastAppointmentStatusLabel: appointments[0] ? getAppointmentStatusMeta(appointments[0].status).label : "예약 없음",
    totalAppointments: appointments.length,
    totalGroomingRecords: groomingRecords.length,
  };
}

export function getAppointmentStatusMeta(status: AppointmentStatus | string) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "승인 대기", className: "border-[#ead9b8] bg-[#fffaf0] text-[#8a5b11]" },
    confirmed: { label: "예약 확정", className: "border-[#c8ded8] bg-[#f4faf8] text-[#256b59]" },
    in_progress: { label: "진행 중", className: "border-[#c8ded8] bg-[#f4faf8] text-[#256b59]" },
    almost_done: { label: "픽업 준비", className: "border-[#ead9b8] bg-[#fffaf0] text-[#8a5b11]" },
    completed: { label: "완료", className: "border-[#dbe2ea] bg-[#f8fafc] text-[#475569]" },
    cancelled: { label: "취소", className: "border-[#efcaca] bg-[#fff5f5] text-[#a04455]" },
    rejected: { label: "거절", className: "border-[#efcaca] bg-[#fff5f5] text-[#a04455]" },
    noshow: { label: "노쇼", className: "border-[#efcaca] bg-[#fff5f5] text-[#a04455]" },
  };
  return map[status] ?? { label: status, className: "border-[#dbe2ea] bg-white text-[#64748b]" };
}

export function getNotificationStatusMeta(status: NotificationStatus | "success" | string) {
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: "대기", className: "border-[#dbe2ea] bg-white text-[#64748b]" },
    sent: { label: "성공", className: "border-[#c8ded8] bg-[#f4faf8] text-[#256b59]" },
    success: { label: "성공", className: "border-[#c8ded8] bg-[#f4faf8] text-[#256b59]" },
    mocked: { label: "테스트", className: "border-[#dbe2ea] bg-[#f8fafc] text-[#475569]" },
    skipped: { label: "건너뜀", className: "border-[#ead9b8] bg-[#fffaf0] text-[#8a5b11]" },
    failed: { label: "실패", className: "border-[#efcaca] bg-[#fff5f5] text-[#a04455]" },
  };
  return map[status] ?? { label: status, className: "border-[#dbe2ea] bg-white text-[#64748b]" };
}

export function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10 && digits.startsWith("02")) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, "0")}.${String(parsed.getDate()).padStart(2, "0")}`;
}

export function formatDateTime(date: string, time?: string) {
  return `${formatDate(date)}${time ? ` ${formatClockTime(time)}` : ""}`;
}

function formatTimestampDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const normalized = value.replace("T", " ");
  const [datePart = "", timePart = ""] = normalized.split(" ");
  return formatDateTime(datePart.slice(0, 10), timePart ? formatClockTime(timePart) : undefined);
}

export function formatMoney(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? won(value) : "-";
}

export function formatDuration(minutes: number | null | undefined) {
  return typeof minutes === "number" && Number.isFinite(minutes) ? `${minutes}분` : "미정";
}

export function getServiceName(servicesById: Map<string, Service>, serviceId: string) {
  return servicesById.get(serviceId)?.name ?? "서비스 미확인";
}

export function getServiceDuration(servicesById: Map<string, Service>, serviceId: string) {
  return servicesById.get(serviceId)?.duration_minutes ?? null;
}

export function splitNotes(value: string | null | undefined) {
  return (value ?? "")
    .split(/\n|ㆍ|•|;|\/|\./)
    .map((item) => item.replace(/^고객 입력:\s*/, "").trim())
    .filter(Boolean);
}

export function getAppointmentTimestamp(appointment: Appointment) {
  return `${appointment.appointment_date}T${appointment.appointment_time || "00:00"}`;
}

function getNotificationTimestamp(notification: Notification) {
  return notification.sent_at ?? notification.scheduled_at ?? notification.created_at;
}

function buildNextVisitWindow(record: GroomingRecord | null, cycleWeeks: number | null | undefined) {
  if (!record) return "추천 기준 없음";
  const weeks = typeof cycleWeeks === "number" && cycleWeeks > 0 ? cycleWeeks : 4;
  const start = new Date(record.groomed_at);
  if (Number.isNaN(start.getTime())) return "추천 기준 없음";
  start.setDate(start.getDate() + weeks * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return `${formatDate(start.toISOString())} ~ ${formatDate(end.toISOString())}`;
}
