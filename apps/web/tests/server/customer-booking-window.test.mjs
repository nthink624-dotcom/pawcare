import assert from "node:assert/strict";
import test from "node:test";

const {
  CUSTOMER_BOOKING_HORIZON_DAYS,
  DEFAULT_REVISIT_REMINDER_DAYS,
  getCustomerBookingDateRange,
  getDefaultRevisitReminderDate,
  validateCustomerBookingDate,
} = await import("../../src/lib/customer-booking-window.ts");

test("customer bookings are limited to a rolling 60-day window", () => {
  const range = getCustomerBookingDateRange("2026-08-21");

  assert.equal(CUSTOMER_BOOKING_HORIZON_DAYS, 60);
  assert.deepEqual(range, { minDate: "2026-08-21", maxDate: "2026-10-19" });
  assert.equal(validateCustomerBookingDate("2026-08-21", "2026-08-21").ok, true);
  assert.equal(validateCustomerBookingDate("2026-10-19", "2026-08-21").ok, true);
  assert.equal(validateCustomerBookingDate("2026-10-20", "2026-08-21").ok, false);
  assert.equal(validateCustomerBookingDate("2026-08-20", "2026-08-21").ok, false);
});

test("revisit reminder defaults to 45 days after completion", () => {
  assert.equal(DEFAULT_REVISIT_REMINDER_DAYS, 45);
  assert.equal(getDefaultRevisitReminderDate("2026-08-21"), "2026-10-05");
  assert.equal(getDefaultRevisitReminderDate("2026-08-21", 30), "2026-09-20");
});
