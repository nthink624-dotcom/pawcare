import type { Appointment, Service } from "@/types/domain";

import { normalizeBookingCloseGraceMinutes } from "@/lib/booking-last-start-cutoff";
import { getBusinessHoursForWeekday } from "@/lib/business-hours";
import { minutesFromTime } from "@/lib/utils";

const defaultTimeZone = "Asia/Seoul";
const activeGroomingStatuses = new Set<Appointment["status"]>(["in_progress", "almost_done"]);

export type AppointmentEffectiveWindow = {
  date: string;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  usesActualTime: boolean;
};

export function getDateTimePartsInTimeZone(value: string | null | undefined, timeZone = defaultTimeZone) {
  if (!value) return null;

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (!parts.year || !parts.month || !parts.day || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    minuteOfDay: hour * 60 + minute,
  };
}

export function getAppointmentDurationMinutes(appointment: Appointment, services: Service[]) {
  const start = new Date(appointment.start_at).getTime();
  const end = new Date(appointment.end_at).getTime();
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return Math.round((end - start) / 60 / 1000);
  }

  return services.find((item) => item.id === appointment.service_id)?.duration_minutes ?? null;
}

export function getAppointmentEffectiveWindow(
  appointment: Appointment,
  services: Service[],
): AppointmentEffectiveWindow | null {
  const scheduledDurationMinutes = getAppointmentDurationMinutes(appointment, services);
  if (!scheduledDurationMinutes) return null;

  const scheduledStartMinute = minutesFromTime(appointment.appointment_time);
  const scheduledEndMinute = scheduledStartMinute + scheduledDurationMinutes;

  return {
    date: appointment.appointment_date,
    startMinute: scheduledStartMinute,
    endMinute: scheduledEndMinute,
    durationMinutes: scheduledDurationMinutes,
    usesActualTime: false,
  };
}

export function getActualGroomingDurationMinutes(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
  timeZone = defaultTimeZone,
) {
  const actualStart = getDateTimePartsInTimeZone(startedAt, timeZone);
  const actualCompleted = getDateTimePartsInTimeZone(completedAt, timeZone);
  if (!actualStart || !actualCompleted || actualStart.date !== actualCompleted.date) return null;

  const started = new Date(startedAt as string).getTime();
  const completed = new Date(completedAt as string).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return null;
  return Math.min(Math.max(Math.round((completed - started) / 60_000), 0), 24 * 60);
}

export function isOvernightActualGroomingSession(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
  timeZone = defaultTimeZone,
) {
  const actualStart = getDateTimePartsInTimeZone(startedAt, timeZone);
  const actualCompleted = getDateTimePartsInTimeZone(completedAt, timeZone);
  return Boolean(actualStart && actualCompleted && actualStart.date !== actualCompleted.date);
}

export function isStaleGroomingSession({
  appointment,
  shop,
  now = new Date(),
  timeZone = defaultTimeZone,
}: {
  appointment: Appointment;
  shop: {
    business_hours: Parameters<typeof getBusinessHoursForWeekday>[0]["business_hours"];
    reservation_policy_settings?: { booking_close_grace_minutes?: unknown };
  };
  now?: Date | string;
  timeZone?: string;
}) {
  if (!activeGroomingStatuses.has(appointment.status)) return false;

  const current = getDateTimePartsInTimeZone(now instanceof Date ? now.toISOString() : now, timeZone);
  if (!current || current.date < appointment.appointment_date) return false;
  if (current.date > appointment.appointment_date) return true;

  const [year, month, day] = appointment.appointment_date.split("-").map(Number);
  if (![year, month, day].every(Number.isInteger)) return false;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const businessHours = getBusinessHoursForWeekday(shop, weekday);
  const closeMinute = minutesFromTime(businessHours.close);
  const closeGraceMinutes = normalizeBookingCloseGraceMinutes(
    shop.reservation_policy_settings?.booking_close_grace_minutes,
  );
  return current.minuteOfDay > closeMinute + closeGraceMinutes;
}
