import { minutesFromTime } from "@/lib/utils";
import type { BookingBlockedWindow, RegularClosedCycle, ReservationPolicySettings } from "@/types/domain";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const regularClosedCycles = new Set<RegularClosedCycle>(["weekly", "biweekly", "monthly_1_3", "monthly_2_4"]);

export const defaultReservationPolicySettings: ReservationPolicySettings = {
  cancel_window: "2h",
  customer_change_enabled: true,
  booking_blocked_windows: [],
  booking_close_grace_minutes: 0,
  ai_booking_time_optimization_enabled: true,
  ai_booking_recommendation_mode: "continuity",
  ai_booking_custom_instruction: "",
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
  const regularClosedCycle = regularClosedCycles.has(source.regular_closed_cycle as RegularClosedCycle)
    ? (source.regular_closed_cycle as RegularClosedCycle)
    : "weekly";
  const regularClosedAnchorDate =
    typeof source.regular_closed_anchor_date === "string" && source.regular_closed_anchor_date
      ? source.regular_closed_anchor_date
      : null;
  return {
    // 고객 변경·취소는 보안 관리 링크에서 예약 2시간 전까지 허용하는
    // 제품 공통 정책입니다. 매장별 저장값은 더 이상 동작을 바꾸지 않습니다.
    cancel_window: "2h",
    customer_change_enabled: true,
    booking_blocked_windows: hasBlockedWindows
      ? normalizeBookingBlockedWindows(source.booking_blocked_windows)
      : defaultReservationPolicySettings.booking_blocked_windows,
    booking_close_grace_minutes: [0, 15, 30, 60].includes(source.booking_close_grace_minutes ?? -1)
      ? source.booking_close_grace_minutes
      : 0,
    regular_closed_cycle: regularClosedCycle,
    regular_closed_anchor_date: regularClosedCycle === "biweekly" ? regularClosedAnchorDate : null,
    // These legacy keys remain in stored shop settings for backward compatibility.
    // Customer booking always uses the product-wide recommendation and assignment policy.
    ai_booking_time_optimization_enabled: true,
    ai_booking_recommendation_mode: "continuity",
    ai_booking_custom_instruction: "",
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
