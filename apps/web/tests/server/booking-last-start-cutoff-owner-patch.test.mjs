import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

for (const key of [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete process.env[key];
}

const { getMockStore, resetMockStore, setMockStore } = await import("../../src/server/mock-store.ts");
const { updateAppointmentDetails } = await import("../../src/server/owner-mutations.ts");

beforeEach(() => {
  resetMockStore();
});

test("owner PATCH cannot use allowOutsideShopHours to bypass the canonical booking window", async () => {
  const store = getMockStore();
  const service = store.services[0];
  const staff = store.staffMembers[0];
  const appointment = store.appointments[0];

  assert.ok(service);
  assert.ok(staff);
  assert.ok(appointment);

  store.shop.booking_available_start_time = "09:00";
  store.shop.booking_available_end_time = "17:00";
  store.shop.reservation_policy_settings = {
    ...store.shop.reservation_policy_settings,
    booking_close_grace_minutes: 0,
  };
  store.shop.regular_closed_days = [];
  store.shop.temporary_closed_dates = [];
  store.shop.business_hours = Object.fromEntries(
    Array.from({ length: 7 }, (_, weekday) => [weekday, { open: "09:00", close: "19:00", enabled: true }]),
  );
  staff.defaultDays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  staff.startTime = "09:00";
  staff.endTime = "19:00";
  store.appointments = [{
    ...appointment,
    service_id: service.id,
    staff_id: staff.id,
    appointment_date: "2030-06-03",
    appointment_time: "17:00",
    start_at: "2030-06-03T17:00:00+09:00",
    end_at: "2030-06-03T18:00:00+09:00",
    status: "confirmed",
  }];
  setMockStore(store);

  await assert.rejects(
    () => updateAppointmentDetails({
      appointmentId: appointment.id,
      shopId: store.shop.id,
      serviceId: service.id,
      staffId: staff.id,
      appointmentDate: "2030-06-03",
      appointmentTime: "17:01",
      memo: "cutoff regression",
      preserveStatus: true,
      enforceShopCapacity: false,
      allowOutsideShopHours: true,
      notifyCustomer: false,
    }),
    /예약 가능 시간 또는 마감 여유를 벗어납니다/,
  );

  const after = getMockStore().appointments.find((item) => item.id === appointment.id);
  assert.equal(after?.appointment_time, "17:00");
});
