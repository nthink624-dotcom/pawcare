import { minutesFromTime } from "@/lib/utils";
import type { BookingBlockedWindow, RegularClosedCycle, ReservationPolicySettings } from "@/types/domain";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const regularClosedCycles = new Set<RegularClosedCycle>(["weekly", "biweekly", "monthly_1_3", "monthly_2_4"]);

export const defaultReservationPolicySettings: ReservationPolicySettings = {
  cancel_window: "2h",
  customer_change_enabled: true,
  booking_blocked_windows: [
    { id: "lunch", start: "13:00", end: "14:00", label: "점심시간" },
    { id: "cleaning", start: "16:00", end: "16:30", label: "정리 시간" },
  ],
};

export function normalizeBookingBlockedWindows(value: unknown): BookingBlockedWindow[] {
  if (!Array.isArray(value)) return [];

  const normalized: BookingBlockedWindow[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const candidate = item as Partial<BookingBlockedWindow>;
    const start = typeof candidate.start === "string" ? candidate.start : "";
    const end = typeof candidate.end === "string" ? candidate.end : "";
    if (!timePattern.test(start) || !timePattern.test(end) || start >= end) return;

    normalized.push({
      id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `blocked-${index + 1}`,
      start,
      end,
      label: typeof candidate.label === "string" ? candidate.label.trim() : "",
    });
  });

  return normalized;
}

export function normalizeReservationPolicySettings(value: unknown): ReservationPolicySettings {
  const source = value && typeof value === "object" ? (value as Partial<ReservationPolicySettings>) : {};
  const hasBlockedWindows = Object.prototype.hasOwnProperty.call(source, "booking_blocked_windows");
  const cancelWindow =
    source.cancel_window && ["none", "1h", "2h", "6h", "24h"].includes(source.cancel_window)
      ? source.cancel_window
      : defaultReservationPolicySettings.cancel_window;
  const regularClosedCycle = regularClosedCycles.has(source.regular_closed_cycle as RegularClosedCycle)
    ? (source.regular_closed_cycle as RegularClosedCycle)
    : "weekly";
  const regularClosedAnchorDate =
    typeof source.regular_closed_anchor_date === "string" && source.regular_closed_anchor_date
      ? source.regular_closed_anchor_date
      : null;

  return {
    cancel_window: cancelWindow,
    customer_change_enabled:
      typeof source.customer_change_enabled === "boolean" ? source.customer_change_enabled : cancelWindow !== "none",
    booking_blocked_windows: hasBlockedWindows
      ? normalizeBookingBlockedWindows(source.booking_blocked_windows)
      : defaultReservationPolicySettings.booking_blocked_windows,
    regular_closed_cycle: regularClosedCycle,
    regular_closed_anchor_date: regularClosedCycle === "biweekly" ? regularClosedAnchorDate : null,
  };
}

export function hasBlockedWindowOverlap(
  reservationPolicySettings: ReservationPolicySettings | null | undefined,
  startMinute: number,
  endMinute: number,
) {
  return normalizeBookingBlockedWindows(reservationPolicySettings?.booking_blocked_windows).some((windowItem) => {
    const blockedStart = minutesFromTime(windowItem.start);
    const blockedEnd = minutesFromTime(windowItem.end);
    return startMinute < blockedEnd && blockedStart < endMinute;
  });
}
