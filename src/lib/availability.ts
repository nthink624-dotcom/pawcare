import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import type { Appointment, Pet, Service, Shop } from "@/types/domain";
import { currentDateInTimeZone, currentMinutesInTimeZone, minutesFromTime, timeFromMinutes } from "@/lib/utils";

export type RevisitStatus = "overdue" | "soon" | "ok" | "unknown";

export function isShopClosedOnDate(shop: Shop, date: string) {
  const day = parseISO(`${date}T00:00:00`);
  const weekday = day.getDay();
  const hours = shop.business_hours[weekday];

  if (shop.regular_closed_days.includes(weekday)) return true;
  if (shop.temporary_closed_dates.includes(date)) return true;
  if (!hours?.enabled) return true;

  return false;
}

export function computeAvailableSlots(params: {
  date: string;
  serviceId?: string;
  durationMinutesOverride?: number;
  shop: Shop;
  services: Service[];
  appointments: Appointment[];
  excludeAppointmentId?: string;
}) {
  const { date, serviceId, durationMinutesOverride, shop, services, appointments, excludeAppointmentId } = params;
  const day = parseISO(`${date}T00:00:00`);
  const weekday = day.getDay();
  if (isShopClosedOnDate(shop, date)) return [];
  const hours = shop.business_hours[weekday];
  if (!hours?.enabled) return [];
  const service = serviceId ? services.find((item) => item.id === serviceId) : null;
  const durationMinutes = durationMinutesOverride ?? service?.duration_minutes;
  if (!durationMinutes) return [];

  const open = minutesFromTime(hours.open);
  const close = minutesFromTime(hours.close);
  const nowMinutes = currentMinutesInTimeZone();
  const isToday = date === currentDateInTimeZone();
  const slots: string[] = [];

  for (let cursor = open; cursor + durationMinutes <= close; cursor += 30) {
    if (isToday && cursor <= nowMinutes) {
      continue;
    }

    if (
      isSlotAvailable({
        date,
        startMinute: cursor,
        durationMinutes,
        appointments,
        services,
        concurrentCapacity: shop.concurrent_capacity,
        excludeAppointmentId,
      })
    ) {
      slots.push(timeFromMinutes(cursor));
    }
  }
  return slots;
}

export function isSlotAvailable(params: {
  date: string;
  startMinute: number;
  durationMinutes: number;
  appointments: Appointment[];
  services: Service[];
  concurrentCapacity: number;
  excludeAppointmentId?: string;
}) {
  const { date, startMinute, durationMinutes, appointments, services, concurrentCapacity, excludeAppointmentId } = params;
  const endMinute = startMinute + durationMinutes;
  const activeAppointments = appointments.filter(
    (appointment) =>
      appointment.appointment_date === date &&
      !["cancelled", "rejected", "noshow"].includes(appointment.status) &&
      appointment.id !== excludeAppointmentId,
  );

  for (let minute = startMinute; minute < endMinute; minute += 30) {
    const overlaps = activeAppointments.filter((appointment) => {
      const service = services.find((item) => item.id === appointment.service_id);
      if (!service) return false;
      const appointmentStart = minutesFromTime(appointment.appointment_time);
      const appointmentEnd = appointmentStart + service.duration_minutes;
      return minute >= appointmentStart && minute < appointmentEnd;
    });
    if (overlaps.length >= concurrentCapacity) {
      return false;
    }
  }
  return true;
}

export function revisitInfo(
  pet: Pet,
  lastGroomedAt?: string | null,
  referenceDate = currentDateInTimeZone(),
): { dueDate: string | null; daysUntil: number | null; status: RevisitStatus } {
  if (!lastGroomedAt) return { dueDate: null, daysUntil: null, status: "unknown" };
  const due = addDays(parseISO(lastGroomedAt), pet.grooming_cycle_weeks * 7);
  const today = parseISO(`${referenceDate}T00:00:00`);
  const daysUntil = differenceInCalendarDays(due, today);
  return {
    dueDate: format(due, "yyyy-MM-dd"),
    daysUntil,
    status: daysUntil < 0 ? "overdue" : daysUntil <= 5 ? "soon" : "ok",
  };
}
