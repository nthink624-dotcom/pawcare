import type { Shop } from "@/types/domain";

export const bookingSlotIntervalOptions = [10, 15, 20, 30, 60] as const;
export const defaultBookingSlotIntervalMinutes = 30;
export const defaultBookingSlotOffsetMinutes = 0;
export const defaultBookingAvailableStartTime = "10:00";
export const defaultBookingAvailableEndTime = "17:00";
export const confirmedSlotCapacity = 1;
export const manualPendingHoldCapacity = 1;
export const defaultManualPendingHoldLimit = 2;
export const maxManualPendingHoldCapacity = 3;
export const defaultConcurrentCapacity = confirmedSlotCapacity;

export function concurrentCapacityForApprovalMode(approvalMode: "manual" | "auto" | null | undefined) {
  return approvalMode === "manual" ? manualPendingHoldCapacity : confirmedSlotCapacity;
}

export function normalizeConcurrentCapacity(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : defaultConcurrentCapacity;
  return Math.min(manualPendingHoldCapacity, Math.max(confirmedSlotCapacity, numeric));
}

export function normalizePendingHoldLimit(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : defaultManualPendingHoldLimit;
  return Math.min(maxManualPendingHoldCapacity, Math.max(manualPendingHoldCapacity, numeric));
}

export function normalizeBookingSlotIntervalMinutes(value: number | null | undefined) {
  if (typeof value === "number" && bookingSlotIntervalOptions.includes(value as (typeof bookingSlotIntervalOptions)[number])) {
    return value;
  }

  return defaultBookingSlotIntervalMinutes;
}

export function normalizeBookingSlotOffsetMinutes(
  value: number | null | undefined,
  interval = defaultBookingSlotIntervalMinutes,
) {
  const normalizedInterval = normalizeBookingSlotIntervalMinutes(interval);
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : defaultBookingSlotOffsetMinutes;

  if (numeric < 0 || numeric >= normalizedInterval || numeric % 5 !== 0) {
    return defaultBookingSlotOffsetMinutes;
  }

  return numeric;
}

export function normalizeBookingAvailableTime(value: string | null | undefined, fallback: string) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value.slice(0, 5) : fallback;
}

export function slotOffsetOptionsForInterval(interval: number) {
  const normalizedInterval = normalizeBookingSlotIntervalMinutes(interval);
  const offsets: number[] = [];

  for (let offset = 0; offset < normalizedInterval; offset += 5) {
    offsets.push(offset);
  }

  return offsets;
}

export function normalizeShopBookingSettings<
  T extends Pick<Shop, "concurrent_capacity"> &
    Partial<Pick<Shop, "booking_slot_interval_minutes" | "booking_slot_offset_minutes" | "booking_available_start_time" | "booking_available_end_time">>,
>(
  shop: T,
): T & {
  concurrent_capacity: number;
  booking_slot_interval_minutes: number;
  booking_slot_offset_minutes: number;
  booking_available_start_time: string;
  booking_available_end_time: string;
} {
  const bookingSlotIntervalMinutes = normalizeBookingSlotIntervalMinutes(shop.booking_slot_interval_minutes);
  const bookingAvailableStartTime = normalizeBookingAvailableTime(
    shop.booking_available_start_time,
    defaultBookingAvailableStartTime,
  );
  const bookingAvailableEndTime = normalizeBookingAvailableTime(
    shop.booking_available_end_time,
    defaultBookingAvailableEndTime,
  );

  return {
    ...shop,
    concurrent_capacity: normalizeConcurrentCapacity(shop.concurrent_capacity),
    booking_slot_interval_minutes: bookingSlotIntervalMinutes,
    booking_slot_offset_minutes: normalizeBookingSlotOffsetMinutes(
      shop.booking_slot_offset_minutes,
      bookingSlotIntervalMinutes,
    ),
    booking_available_start_time: bookingAvailableStartTime,
    booking_available_end_time:
      bookingAvailableStartTime < bookingAvailableEndTime
        ? bookingAvailableEndTime
        : defaultBookingAvailableEndTime,
  };
}
