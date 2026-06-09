import { fetchApiJson, fetchApiJsonWithAuth } from "@/lib/api";
import { addDate } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload, Guardian, Pet, PetStaffNote, Service } from "@/types/domain";

export type OwnerScheduleRangeResponse = Pick<BootstrapPayload, "appointments" | "groomingRecords" | "notifications"> & {
  shopId: string;
  from: string;
  to: string;
};

const bookingStatusToAppointmentStatus: Partial<Record<string, AppointmentStatus>> = {
  "승인 대기": "pending",
  "확정": "confirmed",
  "진행 중": "in_progress",
  "픽업 준비": "almost_done",
  "완료": "completed",
  "취소": "cancelled",
  "거절": "rejected",
  "노쇼": "noshow",
};

function timeToHour(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour + minute / 60;
}

function formatHourLabel(hour: number) {
  const fullHour = Math.floor(hour);
  const minute = Math.round((hour - fullHour) * 60);
  return `${String(fullHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

export async function postOwnerAppointment(payload: unknown) {
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

export async function patchOwnerAppointmentStatus(payload: unknown) {
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

export async function patchOwnerPetStaffNote(payload: unknown) {
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

export async function fetchOwnerScheduleRange(shopId: string, from: string, to: string) {
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

export async function postOwnerGuardian(payload: unknown) {
  try {
    return await fetchApiJsonWithAuth<Guardian>("/api/guardians", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Supabase 연결") || message.includes("로그인이 필요")) {
      return fetchApiJson<Guardian>("/api/guardians", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    throw error;
  }
}

export async function patchOwnerGuardian(payload: unknown) {
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

export async function postOwnerPet(payload: unknown) {
  try {
    return await fetchApiJsonWithAuth<Pet>("/api/pets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Supabase 연결") || message.includes("로그인이 필요")) {
      return fetchApiJson<Pet>("/api/pets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    throw error;
  }
}

export async function postOwnerService(payload: unknown) {
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

export function normalizeSchedulePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function formatSchedulePhone(value: string) {
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

export function buildLocalGuardian(params: { shopId: string; name: string; phone: string; memo?: string }): Guardian {
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

export function buildLocalPet(params: { shopId: string; guardianId: string; name: string }): Pet {
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

export function buildLocalOwnerAppointment(params: {
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
    visit_reminder_offset_minutes: 10,
    pickup_ready_eta_minutes: 5,
    source: "owner",
    created_at: now,
    updated_at: now,
  };
}

export function replaceAppointmentInBootstrap(data: BootstrapPayload, appointment: Appointment): BootstrapPayload {
  return {
    ...data,
    appointments: data.appointments.map((item) => (item.id === appointment.id ? { ...item, ...appointment } : item)),
  };
}

export function getAppointmentCustomServiceId(appointmentId: string) {
  return `appointment-${appointmentId}-service`;
}

export function replaceScheduleRangeInBootstrap(data: BootstrapPayload, range: OwnerScheduleRangeResponse): BootstrapPayload {
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

export function getAppointmentStatusFromBookingStatus(status: string) {
  return bookingStatusToAppointmentStatus[status] ?? null;
}
