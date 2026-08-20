import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getAppointmentWriteErrorMessage } from "../../src/lib/appointment-write-errors.ts";
import { deliverCustomerBookingNotificationSafely } from "../../src/lib/customer-booking-notification.ts";

test("staff overlap persistence errors are safe and actionable for owners", () => {
  assert.equal(
    getAppointmentWriteErrorMessage({
      code: "23P01",
      message: "appointment overlaps another active appointment for the same staff member",
    }),
    "선택한 담당자에게 같은 시간 예약이 있습니다.",
  );
});

test("unrelated persistence errors preserve the server message", () => {
  assert.equal(
    getAppointmentWriteErrorMessage({ message: "database unavailable" }),
    "database unavailable",
  );
});

test("a notification failure cannot turn a completed customer booking mutation into an API failure", async () => {
  const logged = [];
  const result = await deliverCustomerBookingNotificationSafely(
    { appointmentId: "appointment-1", type: "booking_cancelled" },
    async () => {
      throw new Error("notification insert failed");
    },
    (message, context) => logged.push({ message, context }),
  );

  assert.equal(result, null);
  assert.equal(logged.length, 1);
  assert.match(logged[0].message, /after booking mutation/);
  assert.equal(logged[0].context.appointmentId, "appointment-1");
  assert.equal(logged[0].context.reason, "notification insert failed");
});

test("customer cancellation and rescheduling use the notification failure boundary", () => {
  const source = readFileSync(new URL("../../src/server/customer-bookings.ts", import.meta.url), "utf8");
  const updateSection = source.slice(source.indexOf("export async function updateCustomerBooking"));

  assert.doesNotMatch(updateSection, /await dispatchNotification\(/);
  assert.equal(
    updateSection.match(/await deliverCustomerBookingNotificationSafely\(/g)?.length,
    4,
  );
});
