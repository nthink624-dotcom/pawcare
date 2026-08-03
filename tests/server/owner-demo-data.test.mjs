import assert from "node:assert/strict";
import test from "node:test";

import { buildOwnerDemoBootstrap } from "../../src/lib/owner-demo-data.ts";

function timeToMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

test("owner demo keeps the original seven-item day across four real staff members", () => {
  const data = buildOwnerDemoBootstrap();
  const today = data.appointments[0]?.appointment_date;
  const todayAppointments = data.appointments.filter((appointment) => appointment.appointment_date === today);
  const staffIds = new Set(data.staffMembers.map((staff) => staff.id));

  assert.equal(data.staffMembers.length, 4);
  assert.equal(todayAppointments.length, 7);
  assert.ok(todayAppointments.every((appointment) => appointment.staff_id && staffIds.has(appointment.staff_id)));

  const weekday = new Date(`${today}T00:00:00`).getDay();
  const businessHours = data.shop.business_hours[weekday];
  assert.equal(businessHours?.enabled, true);

  for (const staff of data.staffMembers) {
    const staffAppointments = todayAppointments
      .filter((appointment) => appointment.staff_id === staff.id)
      .sort((first, second) => first.appointment_time.localeCompare(second.appointment_time));

    assert.ok(staffAppointments.length >= 1);

    for (let index = 1; index < staffAppointments.length; index += 1) {
      const previous = staffAppointments[index - 1];
      const current = staffAppointments[index];
      const previousService = data.services.find((service) => service.id === previous.service_id);
      const previousEnd = timeToMinutes(previous.appointment_time) + (previousService?.duration_minutes ?? 60);

      assert.ok(previousEnd <= timeToMinutes(current.appointment_time));
    }

    const openingMinute = timeToMinutes(businessHours.open);
    const closingMinute = timeToMinutes(businessHours.close);
    for (const appointment of staffAppointments) {
      const service = data.services.find((item) => item.id === appointment.service_id);
      const startMinute = timeToMinutes(appointment.appointment_time);
      const endMinute = startMinute + (service?.duration_minutes ?? 60);
      assert.ok(openingMinute <= startMinute);
      assert.ok(endMinute <= closingMinute);
    }
  }
});
