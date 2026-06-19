import type { Appointment, Service } from "@/types/domain";

import { minutesFromTime } from "@/lib/utils";

const defaultTimeZone = "Asia/Seoul";
const activeActualTimeStatuses = new Set<Appointment["status"]>(["in_progress", "almost_done", "completed"]);

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

  if (!activeActualTimeStatuses.has(appointment.status)) {
    return {
      date: appointment.appointment_date,
      startMinute: scheduledStartMinute,
      endMinute: scheduledEndMinute,
      durationMinutes: scheduledDurationMinutes,
      usesActualTime: false,
    };
  }

  const actualStart = getDateTimePartsInTimeZone(appointment.actual_started_at);
  const actualCompleted = getDateTimePartsInTimeZone(appointment.actual_completed_at);

  if (actualStart && actualStart.date === appointment.appointment_date) {
    const actualEndMinute =
      appointment.status === "completed" &&
      actualCompleted &&
      actualCompleted.date === actualStart.date &&
      actualCompleted.minuteOfDay > actualStart.minuteOfDay
        ? actualCompleted.minuteOfDay
        : actualStart.minuteOfDay + scheduledDurationMinutes;

    return {
      date: actualStart.date,
      startMinute: actualStart.minuteOfDay,
      endMinute: actualEndMinute,
      durationMinutes: Math.max(1, actualEndMinute - actualStart.minuteOfDay),
      usesActualTime: true,
    };
  }

  if (
    appointment.status === "completed" &&
    actualCompleted &&
    actualCompleted.date === appointment.appointment_date &&
    actualCompleted.minuteOfDay > scheduledStartMinute
  ) {
    return {
      date: appointment.appointment_date,
      startMinute: scheduledStartMinute,
      endMinute: actualCompleted.minuteOfDay,
      durationMinutes: Math.max(1, actualCompleted.minuteOfDay - scheduledStartMinute),
      usesActualTime: true,
    };
  }

  return {
    date: appointment.appointment_date,
    startMinute: scheduledStartMinute,
    endMinute: scheduledEndMinute,
    durationMinutes: scheduledDurationMinutes,
    usesActualTime: false,
  };
}
