import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

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
const { getBootstrap } = await import("../../src/server/bootstrap.ts");
const { updateAppointmentStatus } = await import("../../src/server/owner-mutations.ts");
const { appointmentStatusSchema } = await import("../../src/server/schemas.ts");
const { addDate, currentDateInTimeZone } = await import("../../src/lib/utils.ts");

const appointmentStatuses = [
  "pending",
  "confirmed",
  "in_progress",
  "almost_done",
  "completed",
  "cancelled",
  "rejected",
  "noshow",
];

afterEach(() => {
  resetMockStore();
});

function setFirstAppointmentStatus(status) {
  const store = getMockStore();
  const appointment = store.appointments[0];
  assert.ok(appointment);
  const appointmentDate = addDate(currentDateInTimeZone(), 14);
  setMockStore({
    ...store,
    appointments: store.appointments.map((item) =>
      item.id === appointment.id
        ? {
            ...item,
            status,
            appointment_date: appointmentDate,
            appointment_time: "10:00",
            start_at: `${appointmentDate}T10:00:00+09:00`,
            end_at: `${appointmentDate}T11:00:00+09:00`,
          }
        : item,
    ),
  });
  return appointment.id;
}

test("the shared DTO accepts every supported appointment status and rejects unknown values", () => {
  for (const status of appointmentStatuses) {
    assert.equal(appointmentStatusSchema.safeParse({ appointmentId: "appointment-1", status }).success, true);
  }

  assert.equal(appointmentStatusSchema.safeParse({ appointmentId: "appointment-1", status: "waiting_review" }).success, false);
});

test("bootstrap preserves legacy pending and fails closed for an unknown stored status", async () => {
  const appointmentId = setFirstAppointmentStatus("pending");
  const bootstrap = await getBootstrap("demo-shop");
  assert.equal(bootstrap.appointments.find((appointment) => appointment.id === appointmentId)?.status, "pending");

  setFirstAppointmentStatus("waiting_review");
  await assert.rejects(() => getBootstrap("demo-shop"), /알 수 없는 예약 상태/);
});

test("pending is labeled and may transition only to confirmed, cancelled, or rejected", async () => {
  const appointmentId = setFirstAppointmentStatus("pending");

  await assert.rejects(
    () => updateAppointmentStatus({ appointmentId, status: "pending" }),
    /이미 '예약 대기' 상태/,
  );
  await assert.rejects(
    () => updateAppointmentStatus({ appointmentId, status: "in_progress" }),
    /예약 대기는 확정, 취소 또는 거절로만 변경/,
  );

  const updated = await updateAppointmentStatus({ appointmentId, status: "confirmed", notifyCustomer: false });
  assert.equal(updated.status, "confirmed");
});

test("status updates never create pending and leave every prior status unchanged", async () => {
  for (const status of appointmentStatuses) {
    const appointmentId = setFirstAppointmentStatus(status);
    await assert.rejects(
      () => updateAppointmentStatus({ appointmentId, status: "pending", notifyCustomer: false }),
      status === "pending"
        ? /이미 '예약 대기' 상태/
        : /예약 대기 상태는 새 예약 생성에서만|이미 종료된 예약은 다시 상태를 변경할 수 없어요/,
    );
    assert.equal(getMockStore().appointments.find((appointment) => appointment.id === appointmentId)?.status, status);
  }
});

test("a pending appointment still permits the three existing terminal-or-confirm transitions", async () => {
  for (const nextStatus of ["confirmed", "cancelled", "rejected"]) {
    const appointmentId = setFirstAppointmentStatus("pending");
    const updated = await updateAppointmentStatus({ appointmentId, status: nextStatus, notifyCustomer: false });
    assert.equal(updated.status, nextStatus);
  }
});

test("rejected and noshow preserve their exact pending and confirmed predecessor rules", async () => {
  const pendingRejectedId = setFirstAppointmentStatus("pending");
  const pendingRejected = await updateAppointmentStatus({ appointmentId: pendingRejectedId, status: "rejected", notifyCustomer: false });
  assert.equal(pendingRejected.status, "rejected");

  const confirmedRejectedId = setFirstAppointmentStatus("confirmed");
  const confirmedRejected = await updateAppointmentStatus({ appointmentId: confirmedRejectedId, status: "rejected", notifyCustomer: false });
  assert.equal(confirmedRejected.status, "rejected");

  const confirmedNoshowId = setFirstAppointmentStatus("confirmed");
  const confirmedNoshow = await updateAppointmentStatus({ appointmentId: confirmedNoshowId, status: "noshow", notifyCustomer: false });
  assert.equal(confirmedNoshow.status, "noshow");

  const pendingNoshowId = setFirstAppointmentStatus("pending");
  await assert.rejects(
    () => updateAppointmentStatus({ appointmentId: pendingNoshowId, status: "noshow", notifyCustomer: false }),
    /예약 대기는 확정, 취소 또는 거절로만 변경/,
  );
  assert.equal(getMockStore().appointments.find((appointment) => appointment.id === pendingNoshowId)?.status, "pending");
});
