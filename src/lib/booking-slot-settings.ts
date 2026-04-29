import type { Shop } from "@/types/domain";

export const bookingSlotIntervalOptions = [10, 15, 20, 30, 60] as const;
export const defaultBookingSlotIntervalMinutes = 30;
export const defaultBookingSlotOffsetMinutes = 0;
export const defaultConcurrentCapacity = 2;

export function normalizeConcurrentCapacity(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : defaultConcurrentCapacity;
  return Math.min(5, Math.max(1, numeric));
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

export function slotOffsetOptionsForInterval(interval: number) {
  const normalizedInterval = normalizeBookingSlotIntervalMinutes(interval);
  const offsets: number[] = [];

  for (let offset = 0; offset < normalizedInterval; offset += 5) {
    offsets.push(offset);
  }

  return offsets;
}

export function normalizeShopBookingSettings<T extends Pick<Shop, "concurrent_capacity"> & Partial<Pick<Shop, "booking_slot_interval_minutes" | "booking_slot_offset_minutes">>>(
  shop: T,
): T & {
  concurrent_capacity: number;
  booking_slot_interval_minutes: number;
  booking_slot_offset_minutes: number;
} {
  const bookingSlotIntervalMinutes = normalizeBookingSlotIntervalMinutes(shop.booking_slot_interval_minutes);

  return {
    ...shop,
    concurrent_capacity: normalizeConcurrentCapacity(shop.concurrent_capacity),
    booking_slot_interval_minutes: bookingSlotIntervalMinutes,
    booking_slot_offset_minutes: normalizeBookingSlotOffsetMinutes(
      shop.booking_slot_offset_minutes,
      bookingSlotIntervalMinutes,
    ),
  };
}
