import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import type { Appointment, BootstrapStaffMember, Pet, Service, Shop, StaffScheduleOverride } from "@/types/domain";
import {
  confirmedSlotCapacity,
  manualPendingHoldCapacity,
  normalizeBookingSlotIntervalMinutes,
  normalizeBookingSlotOffsetMinutes,
  normalizeBookingAvailableTime,
  defaultBookingAvailableStartTime,
  defaultBookingAvailableEndTime,
} from "@/lib/booking-slot-settings";
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
  staffId?: string | null;
  staffMembers?: BootstrapStaffMember[];
  staffScheduleOverrides?: StaffScheduleOverride[];
}) {
  const {
    date,
    serviceId,
    durationMinutesOverride,
    shop,
    services,
    appointments,
    excludeAppointmentId,
    staffId,
    staffMembers = [],
    staffScheduleOverrides = [],
  } = params;
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
  const bookingStart = minutesFromTime(
    normalizeBookingAvailableTime(shop.booking_available_start_time, defaultBookingAvailableStartTime),
  );
  const bookingEnd = minutesFromTime(
    normalizeBookingAvailableTime(shop.booking_available_end_time, defaultBookingAvailableEndTime),
  );
  const nowMinutes = currentMinutesInTimeZone();
  const isToday = date === currentDateInTimeZone();
  const slots: string[] = [];
  const slotIntervalMinutes = normalizeBookingSlotIntervalMinutes(shop.booking_slot_interval_minutes);
  const slotOffsetMinutes = normalizeBookingSlotOffsetMinutes(
    shop.booking_slot_offset_minutes,
    slotIntervalMinutes,
  );
  const firstSlotMinute = alignToSlotPattern(Math.max(open, bookingStart), slotIntervalMinutes, slotOffsetMinutes);

  for (let cursor = firstSlotMinute; cursor <= bookingEnd && cursor + durationMinutes <= close; cursor += slotIntervalMinutes) {
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
        approvalMode: shop.approval_mode,
        excludeAppointmentId,
      })
      && isStaffSlotAvailable({
        date,
        startMinute: cursor,
        durationMinutes,
        staffId,
        staffMembers,
        staffScheduleOverrides,
        appointments,
        services,
        excludeAppointmentId,
      })
    ) {
      slots.push(timeFromMinutes(cursor));
    }
  }
  return slots;
}

function isStaffSlotAvailable(params: {
  date: string;
  startMinute: number;
  durationMinutes: number;
  staffId?: string | null;
  staffMembers: BootstrapStaffMember[];
  staffScheduleOverrides: StaffScheduleOverride[];
  appointments: Appointment[];
  services: Service[];
  excludeAppointmentId?: string;
}): boolean {
  const { date, startMinute, durationMinutes, staffId, staffMembers, staffScheduleOverrides, appointments, services, excludeAppointmentId } = params;
  if (!staffId) {
    if (staffMembers.length === 0) return true;
    return staffMembers.some((staffMember) => isStaffSlotAvailable({ ...params, staffId: staffMember.id }));
  }

  const staffMember = staffMembers.find((item) => item.id === staffId);
  if (!staffMember) return false;

  const endMinute = startMinute + durationMinutes;
  const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
  const dayKey = weekdayKeys[weekday];
  const override = staffScheduleOverrides.find((item) => item.staff_id === staffId && item.work_date === date);

  if (override) {
    if (override.status === "off" || override.status === "annual") return false;

    if (override.status === "half") {
      const splitMinute = minutesFromTime("13:00");
      const availableStart = override.period === "오전" ? splitMinute : minutesFromTime(staffMember.startTime);
      const availableEnd = override.period === "오후" ? splitMinute : minutesFromTime(staffMember.endTime);
      if (startMinute < availableStart || endMinute > availableEnd) return false;
    }

    if (override.status === "work") {
      const availableStart = minutesFromTime(override.start_time ?? staffMember.startTime);
      const availableEnd = minutesFromTime(override.end_time ?? staffMember.endTime);
      if (startMinute < availableStart || endMinute > availableEnd) return false;
    }
  } else {
    if (!staffMember.defaultDays.includes(dayKey)) return false;
    if (startMinute < minutesFromTime(staffMember.startTime) || endMinute > minutesFromTime(staffMember.endTime)) return false;
  }

  return !appointments.some((appointment) => {
    if (appointment.id === excludeAppointmentId) return false;
    if (appointment.appointment_date !== date) return false;
    if (appointment.staff_id !== staffId) return false;
    if (["cancelled", "rejected", "noshow"].includes(appointment.status)) return false;

    const service = services.find((item) => item.id === appointment.service_id);
    const appointmentDurationMinutes = getAppointmentDurationMinutes(appointment) ?? service?.duration_minutes;
    if (!appointmentDurationMinutes) return false;

    const appointmentStart = minutesFromTime(appointment.appointment_time);
    const appointmentEnd = appointmentStart + appointmentDurationMinutes;
    return appointmentStart < endMinute && startMinute < appointmentEnd;
  });
}

export function isSlotAvailable(params: {
  date: string;
  startMinute: number;
  durationMinutes: number;
  appointments: Appointment[];
  services: Service[];
  approvalMode: Shop["approval_mode"];
  excludeAppointmentId?: string;
}) {
  const { date, startMinute, durationMinutes, appointments, services, approvalMode, excludeAppointmentId } = params;
  const endMinute = startMinute + durationMinutes;
  const activeAppointments = appointments.filter(
    (appointment) =>
      appointment.appointment_date === date &&
      !["cancelled", "rejected", "noshow"].includes(appointment.status) &&
      appointment.id !== excludeAppointmentId,
  );

  const overlapBoundaries = new Set<number>([startMinute, endMinute]);
  const overlappingAppointments = activeAppointments.flatMap((appointment) => {
    const service = services.find((item) => item.id === appointment.service_id);
    const appointmentDurationMinutes = getAppointmentDurationMinutes(appointment) ?? service?.duration_minutes;
    if (!appointmentDurationMinutes) return [];

    const appointmentStart = minutesFromTime(appointment.appointment_time);
    const appointmentEnd = appointmentStart + appointmentDurationMinutes;
    const overlapsWindow = appointmentStart < endMinute && startMinute < appointmentEnd;
    if (!overlapsWindow) return [];

    overlapBoundaries.add(Math.max(startMinute, appointmentStart));
    overlapBoundaries.add(Math.min(endMinute, appointmentEnd));

    return [{ appointmentStart, appointmentEnd, status: appointment.status }];
  });

  const sortedBoundaries = Array.from(overlapBoundaries).sort((a, b) => a - b);

  for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
    const segmentStart = sortedBoundaries[index];
    const segmentEnd = sortedBoundaries[index + 1];
    if (segmentStart === segmentEnd) continue;

    const probeMinute = segmentStart + 0.5;
    const overlaps = overlappingAppointments.filter(
      ({ appointmentStart, appointmentEnd }) =>
        appointmentStart <= probeMinute && probeMinute < appointmentEnd,
    );

    const confirmedLikeOverlaps = overlaps.filter(({ status }) => status !== "pending");
    if (confirmedLikeOverlaps.length >= confirmedSlotCapacity) {
      return false;
    }

    const allowedHolds = approvalMode === "manual" ? manualPendingHoldCapacity : confirmedSlotCapacity;
    if (overlaps.length >= allowedHolds) {
      return false;
    }
  }
  return true;
}

function getAppointmentDurationMinutes(appointment: Appointment) {
  const start = new Date(appointment.start_at).getTime();
  const end = new Date(appointment.end_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60 / 1000);
}

function alignToSlotPattern(openMinute: number, intervalMinutes: number, offsetMinutes: number) {
  const normalizedInterval = normalizeBookingSlotIntervalMinutes(intervalMinutes);
  const normalizedOffset = normalizeBookingSlotOffsetMinutes(offsetMinutes, normalizedInterval);
  const remainder = ((openMinute - normalizedOffset) % normalizedInterval + normalizedInterval) % normalizedInterval;

  if (remainder === 0) {
    return openMinute;
  }

  return openMinute + (normalizedInterval - remainder);
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
