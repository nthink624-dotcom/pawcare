import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

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
process.env.BOOKING_ACCESS_SECRET = "appointment-flow-test-secret";

const { addDate, currentDateInTimeZone } = await import("../../src/lib/utils.ts");
const { getMockStore, resetMockStore } = await import("../../src/server/mock-store.ts");
const {
  createAppointment,
  updateAppointmentDetails,
  updateAppointmentStatus,
} = await import("../../src/server/owner-mutations.ts");

function getFixture() {
  const store = getMockStore();
  const guardian = store.guardians.find((item) => item.notification_settings.enabled) ?? store.guardians[0];
  const pet = store.pets.find((item) => item.guardian_id === guardian.id);
  const service = store.services.find((item) => item.id === "svc-care") ?? store.services[0];
  const staff = store.staffMembers[0] ?? null;

  assert.ok(guardian, "guardian fixture is required");
  assert.ok(pet, "pet fixture is required");
  assert.ok(service, "service fixture is required");

  return { store, guardian, pet, service, staff };
}

async function createAvailableOwnerAppointment(overrides = {}) {
  const { guardian, pet, service, staff } = getFixture();
  let lastError = null;

  for (let offset = 3; offset <= 30; offset += 1) {
    const appointmentDate = addDate(currentDateInTimeZone(), offset);
    for (const appointmentTime of ["10:00", "10:30", "11:00", "14:00", "15:00", "16:00"]) {
      try {
        return await createAppointment({
          shopId: "demo-shop",
          guardianId: guardian.id,
          petId: pet.id,
          serviceId: service.id,
          staffId: staff?.id ?? null,
          appointmentDate,
          appointmentTime,
          memo: "flow test",
          source: "owner",
          ...overrides,
        });
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error("No available appointment slot found");
}

async function rescheduleToAvailableSlot(appointment, overrides = {}) {
  const { service, staff } = getFixture();
  let lastError = null;

  for (let offset = 31; offset <= 60; offset += 1) {
    const appointmentDate = addDate(currentDateInTimeZone(), offset);
    for (const appointmentTime of ["10:00", "10:30", "11:00", "14:00", "15:00", "16:00"]) {
      try {
        return await updateAppointmentDetails({
          appointmentId: appointment.id,
          shopId: appointment.shop_id,
          serviceId: service.id,
          staffId: staff?.id ?? null,
          appointmentDate,
          appointmentTime,
          memo: "rescheduled by flow test",
          eventType: "booking_rescheduled_confirmed",
          notifyCustomer: true,
          ...overrides,
        });
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error("No available reschedule slot found");
}

function notificationsFor(appointmentId, type) {
  return getMockStore().notifications.filter((item) => item.appointment_id === appointmentId && item.type === type);
}

function getAppointment(appointmentId) {
  const appointment = getMockStore().appointments.find((item) => item.id === appointmentId);
  assert.ok(appointment, `appointment ${appointmentId} should exist`);
  return appointment;
}

beforeEach(() => {
  resetMockStore();
});

describe("appointment and alimtalk flow guards", () => {
  it("creates an owner appointment and records one booking confirmation notification", async () => {
    const appointment = await createAvailableOwnerAppointment();

    assert.equal(getAppointment(appointment.id).status, "confirmed");

    const confirmations = notificationsFor(appointment.id, "booking_confirmed");
    assert.equal(confirmations.length, 1);
    assert.equal(confirmations[0].status, "mocked");
  });

  it("reschedules a confirmed appointment and sends only a real change notification", async () => {
    const appointment = await createAvailableOwnerAppointment({ source: "customer" });
    const updated = await rescheduleToAvailableSlot(appointment);

    assert.equal(getAppointment(appointment.id).appointment_date, updated.appointment_date);
    assert.notEqual(updated.appointment_date, appointment.appointment_date);

    const rescheduled = notificationsFor(appointment.id, "booking_rescheduled_confirmed");
    assert.equal(rescheduled.length, 1);
    assert.equal(rescheduled[0].status, "mocked");

    await assert.rejects(
      () =>
        updateAppointmentDetails({
          appointmentId: updated.id,
          shopId: updated.shop_id,
          serviceId: updated.service_id,
          staffId: updated.staff_id ?? null,
          appointmentDate: updated.appointment_date,
          appointmentTime: updated.appointment_time,
          memo: updated.memo,
          eventType: "booking_rescheduled_confirmed",
          notifyCustomer: true,
        }),
      /변경 사항이 없습니다/,
    );
  });

  it("blocks cancelled appointments from being resurrected into active statuses", async () => {
    const appointment = await createAvailableOwnerAppointment({ source: "customer" });

    await updateAppointmentStatus({
      appointmentId: appointment.id,
      status: "cancelled",
    });

    assert.equal(getAppointment(appointment.id).status, "cancelled");
    assert.equal(notificationsFor(appointment.id, "booking_cancelled").length, 1);

    await assert.rejects(
      () =>
        updateAppointmentStatus({
          appointmentId: appointment.id,
          status: "in_progress",
          mediaAssetIds: ["before-photo"],
        }),
      /이미 종료된 예약/,
    );

    await assert.rejects(
      () =>
        updateAppointmentStatus({
          appointmentId: appointment.id,
          status: "confirmed",
        }),
      /이미 종료된 예약/,
    );
  });

  it("completes grooming with appointment status, actual times, and one linked grooming record", async () => {
    const appointment = await createAvailableOwnerAppointment({ source: "customer" });

    await updateAppointmentStatus({
      appointmentId: appointment.id,
      status: "in_progress",
      mediaAssetIds: ["before-photo"],
    });
    await updateAppointmentStatus({
      appointmentId: appointment.id,
      status: "almost_done",
      mediaAssetIds: ["pickup-photo"],
    });
    await updateAppointmentStatus({
      appointmentId: appointment.id,
      status: "completed",
    });

    const completed = getAppointment(appointment.id);
    assert.equal(completed.status, "completed");
    assert.ok(completed.actual_started_at);
    assert.ok(completed.actual_completed_at);

    const records = getMockStore().groomingRecords.filter((record) => record.appointment_id === appointment.id);
    assert.equal(records.length, 1);
    assert.equal(records[0].pet_id, appointment.pet_id);

    assert.equal(notificationsFor(appointment.id, "grooming_started").length, 1);
    assert.equal(notificationsFor(appointment.id, "grooming_almost_done").length, 1);
    assert.equal(notificationsFor(appointment.id, "grooming_completed").length, 1);

    await assert.rejects(
      () =>
        updateAppointmentStatus({
          appointmentId: appointment.id,
          status: "cancelled",
        }),
      /이미 종료된 예약/,
    );
  });

  it("respects guardian alimtalk opt-out when appointment status changes", async () => {
    await updateAppointmentStatus({
      appointmentId: "a-3",
      status: "cancelled",
    });

    const cancellation = notificationsFor("a-3", "booking_cancelled")[0];
    assert.equal(cancellation.status, "skipped");
    assert.equal(cancellation.metadata.guardianNotificationBlocked, true);
    assert.equal(cancellation.metadata.notificationOptOutScope, "shop_guardian");
  });
});
