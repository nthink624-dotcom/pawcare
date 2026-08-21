import { addDate, currentDateInTimeZone } from "@/lib/utils";

export const CUSTOMER_BOOKING_HORIZON_DAYS = 60;
export const DEFAULT_REVISIT_REMINDER_DAYS = 45;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getCustomerBookingDateRange(today = currentDateInTimeZone()) {
  return {
    minDate: today,
    maxDate: addDate(today, CUSTOMER_BOOKING_HORIZON_DAYS - 1),
  };
}

export function getDefaultRevisitReminderDate(
  today = currentDateInTimeZone(),
  days = DEFAULT_REVISIT_REMINDER_DAYS,
) {
  return addDate(today, days);
}

export function validateCustomerBookingDate(date: string, today = currentDateInTimeZone()) {
  const { minDate, maxDate } = getCustomerBookingDateRange(today);
  if (!ISO_DATE_PATTERN.test(date)) {
    return { ok: false as const, message: "예약 날짜 형식을 확인해 주세요.", minDate, maxDate };
  }
  if (date < minDate) {
    return { ok: false as const, message: "지난 날짜에는 예약할 수 없어요.", minDate, maxDate };
  }
  if (date > maxDate) {
    return {
      ok: false as const,
      message: `예약은 오늘부터 ${CUSTOMER_BOOKING_HORIZON_DAYS}일 이내에서 선택해 주세요.`,
      minDate,
      maxDate,
    };
  }
  return { ok: true as const, minDate, maxDate };
}

export function assertCustomerBookingDate(date: string, today = currentDateInTimeZone()) {
  const result = validateCustomerBookingDate(date, today);
  if (!result.ok) throw new Error(result.message);
  return result;
}
