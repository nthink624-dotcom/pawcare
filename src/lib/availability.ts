import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import type { Appointment, BootstrapStaffMember, Pet, Service, Shop, StaffScheduleOverride } from "@/types/domain";
import {
  confirmedSlotCapacity,
  normalizePendingHoldLimit,
  normalizeBookingSlotIntervalMinutes,
  normalizeBookingSlotOffsetMinutes,
  normalizeBookingAvailableTime,
  defaultBookingAvailableStartTime,
  defaultBookingAvailableEndTime,
} from "@/lib/booking-slot-settings";
import { getBusinessHoursForWeekday } from "@/lib/business-hours";
import { hasBlockedWindowOverlap } from "@/lib/reservation-policy-settings";
import { currentDateInTimeZone, currentMinutesInTimeZone, minutesFromTime, timeFromMinutes } from "@/lib/utils";

export type RevisitStatus = "overdue" | "soon" | "ok" | "unknown";

const slotBlockingAppointmentStatuses = new Set<Appointment["status"]>([
  "pending",
  "confirmed",
  "in_progress",
  "almost_done",
]);

function getWeekStart(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  next.setDate(next.getDate() - (day === 0 ? 6 : day - 1));
  next.setHours(0, 0, 0, 0);
  return next;
}

function isBiweeklyClosedWeek(date: Date, anchorDateKey?: string | null) {
  if (!anchorDateKey) return true;

  const anchor = new Date(`${anchorDateKey}T00:00:00`);
  if (!Number.isFinite(anchor.getTime())) return true;

  const diffDays = Math.round((getWeekStart(date).getTime() - getWeekStart(anchor).getTime()) / (24 * 60 * 60 * 1000));
  return Math.abs(Math.trunc(diffDays / 7)) % 2 === 0;
}

export function isRegularClosedOnDate(shop: Shop, date: string) {
  const day = parseISO(`${date}T00:00:00`);
  const weekday = day.getDay();
  const policyHasRegularClosedCycle = Object.prototype.hasOwnProperty.call(
    shop.reservation_policy_settings ?? {},
    "regular_closed_cycle",
  );
  const regularClosedCycle =
    policyHasRegularClosedCycle
      ? shop.reservation_policy_settings?.regular_closed_cycle ?? "weekly"
      : shop.regular_closed_cycle ?? "weekly";
  const regularClosedAnchorDate =
    policyHasRegularClosedCycle
      ? shop.reservation_policy_settings?.regular_closed_anchor_date ?? null
      : shop.regular_closed_anchor_date ?? null;

  if (!shop.regular_closed_days.includes(weekday)) return false;
  if (regularClosedCycle !== "biweekly") return true;
  return isBiweeklyClosedWeek(day, regularClosedAnchorDate);
}

export function isShopClosedOnDate(shop: Shop, date: string) {
  const day = parseISO(`${date}T00:00:00`);
  const weekday = day.getDay();
  const hours = getBusinessHoursForWeekday(shop, weekday);

  if (isRegularClosedOnDate(shop, date)) return true;
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
  const hours = getBusinessHoursForWeekday(shop, weekday);
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
  const candidateStartMinutes = new Set<number>();

  for (let cursor = firstSlotMinute; cursor <= bookingEnd && cursor + durationMinutes <= close; cursor += slotIntervalMinutes) {
    candidateStartMinutes.add(cursor);
  }

  for (const appointment of appointments) {
    if (!isAppointmentEndSlotCandidate({ appointment, date, staffId, excludeAppointmentId })) continue;

    const appointmentStart = minutesFromTime(appointment.appointment_time);
    const appointmentDurationMinutes =
      getAppointmentDurationMinutes(appointment) ??
      services.find((item) => item.id === appointment.service_id)?.duration_minutes;
    if (!appointmentDurationMinutes) continue;

    const appointmentEnd = appointmentStart + appointmentDurationMinutes;
    if (appointmentEnd < Math.max(open, bookingStart) || appointmentEnd > bookingEnd) continue;
    if (appointmentEnd + durationMinutes > close) continue;

    candidateStartMinutes.add(appointmentEnd);
  }

  for (const cursor of Array.from(candidateStartMinutes).sort((a, b) => a - b)) {
    if (isToday && cursor <= nowMinutes) {
      continue;
    }

    if (hasBlockedWindowOverlap(shop.reservation_policy_settings, cursor, cursor + durationMinutes)) {
      continue;
    }

    const shopWideSlotAvailable =
      staffMembers.length > 0
        ? true
        : isSlotAvailable({
            date,
            startMinute: cursor,
            durationMinutes,
            appointments,
            services,
            approvalMode: shop.approval_mode,
            pendingHoldLimit: shop.reservation_policy_settings?.pending_hold_limit,
            excludeAppointmentId,
          });

    if (
      shopWideSlotAvailable &&
      isStaffSlotAvailable({
        date,
        startMinute: cursor,
        durationMinutes,
        staffId,
        staffMembers,
        staffScheduleOverrides,
        appointments,
        services,
        approvalMode: shop.approval_mode,
        pendingHoldLimit: shop.reservation_policy_settings?.pending_hold_limit,
        excludeAppointmentId,
      })
    ) {
      slots.push(timeFromMinutes(cursor));
    }
  }
  return slots;
}

export function computeRecommendedAvailableSlots(params: {
  date: string;
  availableSlots: string[];
  appointments: Appointment[];
  services: Service[];
  excludeAppointmentId?: string;
  staffId?: string | null;
}) {
  const { date, availableSlots, appointments, services, excludeAppointmentId, staffId } = params;
  const availableSlotSet = new Set(availableSlots);
  const recommendedSlotMinutes = new Set<number>();

  for (const appointment of appointments) {
    if (!isAppointmentEndSlotCandidate({ appointment, date, staffId, excludeAppointmentId })) continue;

    const appointmentStart = minutesFromTime(appointment.appointment_time);
    const appointmentDurationMinutes =
      getAppointmentDurationMinutes(appointment) ??
      services.find((item) => item.id === appointment.service_id)?.duration_minutes;
    if (!appointmentDurationMinutes) continue;

    const appointmentEnd = appointmentStart + appointmentDurationMinutes;
    const appointmentEndSlot = timeFromMinutes(appointmentEnd);
    if (availableSlotSet.has(appointmentEndSlot)) {
      recommendedSlotMinutes.add(appointmentEnd);
    }
  }

  return Array.from(recommendedSlotMinutes)
    .sort((a, b) => a - b)
    .map((minute) => timeFromMinutes(minute));
}

function isAppointmentEndSlotCandidate(params: {
  appointment: Appointment;
  date: string;
  staffId?: string | null;
  excludeAppointmentId?: string;
}) {
  const { appointment, date, staffId, excludeAppointmentId } = params;
  if (appointment.id === excludeAppointmentId) return false;
  if (appointment.appointment_date !== date) return false;
  if (["cancelled", "rejected", "noshow"].includes(appointment.status)) return false;
  if (staffId && appointment.staff_id !== staffId) return false;
  return true;
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
  approvalMode: Shop["approval_mode"];
  pendingHoldLimit?: number | null;
  excludeAppointmentId?: string;
}): boolean {
  const { date, startMinute, durationMinutes, staffId, staffMembers, staffScheduleOverrides, appointments, services, approvalMode, pendingHoldLimit, excludeAppointmentId } = params;
  if (!staffId) {
    if (staffMembers.length === 0) return true;
    const unassignedAvailable = isSlotAvailable({
      date,
      startMinute,
      durationMinutes,
      appointments: appointments.filter((appointment) => !appointment.staff_id),
      services,
      approvalMode,
      pendingHoldLimit,
      excludeAppointmentId,
    });
    if (!unassignedAvailable) return false;
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

  return isSlotAvailable({
    date,
    startMinute,
    durationMinutes,
    appointments: appointments.filter((appointment) => appointment.staff_id === staffId),
    services,
    approvalMode,
    pendingHoldLimit,
    excludeAppointmentId,
  });
}

export function isSlotAvailable(params: {
  date: string;
  startMinute: number;
  durationMinutes: number;
  appointments: Appointment[];
  services: Service[];
  approvalMode: Shop["approval_mode"];
  pendingHoldLimit?: number | null;
  excludeAppointmentId?: string;
}) {
  const { date, startMinute, durationMinutes, appointments, services, approvalMode, pendingHoldLimit, excludeAppointmentId } = params;
  const endMinute = startMinute + durationMinutes;
  const activeAppointments = appointments.filter(
    (appointment) =>
      appointment.appointment_date === date &&
      slotBlockingAppointmentStatuses.has(appointment.status) &&
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

    const allowedHolds = approvalMode === "manual" ? normalizePendingHoldLimit(pendingHoldLimit) : confirmedSlotCapacity;
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
