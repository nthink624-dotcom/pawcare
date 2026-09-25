import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

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

test("customer self cancellation and rescheduling do not send a separate notification", () => {
  const source = readFileSync(new URL("../../src/server/customer-bookings.ts", import.meta.url), "utf8");
  const updateSection = source.slice(source.indexOf("export async function updateCustomerBooking"));

  assert.doesNotMatch(updateSection, /await dispatchNotification\(/);
  assert.doesNotMatch(updateSection, /await deliverCustomerBookingNotificationSafely\(/);
});

for (const mode of ["mock", "supabase"]) {
  test(`customer cancellation persists without notification in ${mode} mode`, async () => {
    const source = readFileSync(new URL("../../src/server/customer-bookings.ts", import.meta.url), "utf8");
    const functionSource = source.slice(source.indexOf("export async function updateCustomerBooking"));
    const compiled = ts.transpileModule(functionSource.replace("export async", "async"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const original = { id: "appointment-1", shop_id: "shop-1", guardian_id: "guardian-1", pet_id: "pet-1", status: "confirmed" };
    const payload = { action: "cancel", shopId: "shop-1", appointmentId: "appointment-1", accessToken: "test-only" };
    const writes = [];
    let shouldFail = false;
    const persist = async (id, values) => {
      if (shouldFail) throw new Error("persistence unavailable");
      writes.push({ id, values });
      return { ...original, ...values };
    };
    const deps = {
      customerBookingUpdateSchema: { parse: () => payload },
      verifyBookingAccessToken: () => ({ ...payload, action: "manage", guardianId: "guardian-1", petId: "pet-1" }),
      requireOwnerInitialSetupCompleteBootstrap: async () => ({ mode, shop: {}, appointments: [original], guardians: [{ id: "guardian-1" }], pets: [{ id: "pet-1" }] }),
      canManageAppointment: () => true,
      assertCustomerCanChangeBooking: () => {},
      nowIso: () => "2026-09-25T00:00:00.000Z",
      hasSupabaseServerEnv: () => mode === "supabase",
      updateMockAppointment: (id, update) => persist(id, update(original)),
      updateSupabaseAppointment: persist,
      dispatchNotification: () => assert.fail("customer cancellation must not dispatch"),
      deliverCustomerBookingNotificationSafely: () => assert.fail("customer cancellation must not schedule delivery"),
    };
    const update = new Function(...Object.keys(deps), `${compiled}; return updateCustomerBooking;`)(...Object.values(deps));
    const result = await update(payload);
    assert.equal(result.status, "cancelled");
    assert.equal(result.rejection_reason, null);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].id, payload.appointmentId);
    shouldFail = true;
    await assert.rejects(update(payload), /persistence unavailable/);
    assert.equal(writes.length, 1);
  });
}
