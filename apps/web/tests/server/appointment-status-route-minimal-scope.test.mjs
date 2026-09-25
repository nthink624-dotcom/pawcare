import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
process.env.BOOKING_ACCESS_SECRET = "appointment-status-minimal-scope-test-secret";

const { addDate, currentDateInTimeZone } = await import("../../src/lib/utils.ts");
const { getMockStore, resetMockStore, setMockStore } = await import("../../src/server/mock-store.ts");
const { updateAppointmentStatus } = await import("../../src/server/owner-mutations.ts");

function prepareConfirmedAppointment() {
  const store = getMockStore();
  const guardian = store.guardians[0];
  const pet = store.pets.find((item) => item.guardian_id === guardian?.id);
  const service = store.services[0];
  const staff = store.staffMembers[0];
  const appointment = store.appointments[0];

  assert.ok(guardian);
  assert.ok(pet);
  assert.ok(service);
  assert.ok(staff);
  assert.ok(appointment);

  const appointmentDate = addDate(currentDateInTimeZone(), 14);
  const prepared = {
    ...appointment,
    shop_id: store.shop.id,
    guardian_id: guardian.id,
    pet_id: pet.id,
    service_id: service.id,
    staff_id: staff.id,
    appointment_date: appointmentDate,
    appointment_time: "10:00",
    start_at: `${appointmentDate}T10:00:00+09:00`,
    end_at: `${appointmentDate}T11:00:00+09:00`,
    status: "confirmed",
    actual_started_at: null,
    actual_completed_at: null,
  };

  setMockStore({
    ...store,
    shop: {
      ...store.shop,
      regular_closed_days: [],
      temporary_closed_dates: [],
      booking_available_start_time: "09:00",
      booking_available_end_time: "19:00",
      business_hours: Object.fromEntries(
        Array.from({ length: 7 }, (_, weekday) => [weekday, { open: "09:00", close: "19:00", enabled: true }]),
      ),
    },
    staffMembers: store.staffMembers.map((item) =>
      item.id === staff.id
        ? {
            ...item,
            defaultDays: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
            startTime: "09:00",
            endTime: "19:00",
          }
        : item,
    ),
    appointments: [prepared],
  });

  return prepared;
}

function ownerAccess(appointment) {
  return { shopId: appointment.shop_id, role: "owner", staffId: null };
}

beforeEach(() => {
  resetMockStore();
});

test("status PATCH source takes the tenant-scoped mutation path before detail bootstrap", async () => {
  const route = await readFile(new URL("../../src/app/api/appointments/route.ts", import.meta.url), "utf8");
  const statusStart = route.indexOf('if (typeof body?.status === "string")');
  const detailBootstrapStart = route.indexOf("const bootstrap = await getBootstrap(owner.shopId);", statusStart);
  const statusBranch = route.slice(statusStart, detailBootstrapStart);

  assert.ok(statusStart >= 0 && detailBootstrapStart > statusStart);
  assert.match(statusBranch, /updateAppointmentStatus\(body/);
  assert.match(statusBranch, /ownerAccess: owner/);
  assert.match(statusBranch, /allowCompletedReplay: true/);
  assert.match(statusBranch, /deferNotifications: \(task\) => after\(task\)/);
  assert.doesNotMatch(statusBranch, /getBootstrap|updateAppointmentDetails/);
});

test("authorized status success returns the committed appointment and a failed transition leaves it unchanged", async () => {
  const appointment = prepareConfirmedAppointment();
  const access = ownerAccess(appointment);

  await assert.rejects(
    () => updateAppointmentStatus(
      { appointmentId: appointment.id, status: "almost_done", notifyCustomer: false },
      { ownerAccess: access },
    ),
    /픽업 준비는 미용 시작 후에만/,
  );
  assert.equal(getMockStore().appointments[0].status, "confirmed");

  const updated = await updateAppointmentStatus(
    { appointmentId: appointment.id, status: "in_progress", mediaAssetIds: [], notifyCustomer: false },
    { ownerAccess: access },
  );
  assert.equal(updated.status, "in_progress");
  assert.equal(getMockStore().appointments[0].status, "in_progress");
});

test("tenant and staff assignment mismatches fail closed without changing the appointment", async () => {
  const appointment = prepareConfirmedAppointment();

  await assert.rejects(
    () => updateAppointmentStatus(
      { appointmentId: appointment.id, status: "in_progress", notifyCustomer: false },
      { ownerAccess: { shopId: "other-shop", role: "owner", staffId: null } },
    ),
    (error) => error?.status === 404 && error.message === "예약을 찾을 수 없습니다.",
  );
  await assert.rejects(
    () => updateAppointmentStatus(
      { appointmentId: appointment.id, status: "in_progress", notifyCustomer: false },
      { ownerAccess: { shopId: appointment.shop_id, role: "staff", staffId: "different-staff" } },
    ),
    (error) => error?.status === 404 && error.message === "예약을 찾을 수 없습니다.",
  );
  await assert.rejects(
    () => updateAppointmentStatus(
      { appointmentId: appointment.id, status: "in_progress", notifyCustomer: false },
      { ownerAccess: { shopId: appointment.shop_id, role: "staff", staffId: null } },
    ),
    (error) => error?.status === 404 && error.message === "예약을 찾을 수 없습니다.",
  );
  assert.equal(getMockStore().appointments[0].status, "confirmed");
});

test("completed replay returns the authoritative row without scheduling another notification", async () => {
  const appointment = prepareConfirmedAppointment();
  const store = getMockStore();
  const completed = {
    ...appointment,
    status: "completed",
    actual_started_at: appointment.start_at,
    actual_completed_at: appointment.end_at,
  };
  setMockStore({ ...store, appointments: [completed] });
  const deferredTasks = [];

  const replayed = await updateAppointmentStatus(
    { appointmentId: completed.id, status: "completed" },
    {
      ownerAccess: ownerAccess(completed),
      allowCompletedReplay: true,
      deferNotifications(task) {
        deferredTasks.push(task);
      },
    },
  );

  assert.deepEqual(replayed, completed);
  assert.equal(deferredTasks.length, 0);
  assert.equal(getMockStore().appointments[0].status, "completed");
});

test("notification work runs after commit and a delivery failure cannot roll the status back", async () => {
  const appointment = prepareConfirmedAppointment();
  const deferredTasks = [];
  const updated = await updateAppointmentStatus(
    { appointmentId: appointment.id, status: "in_progress", mediaAssetIds: [] },
    {
      ownerAccess: ownerAccess(appointment),
      deferNotifications(task) {
        deferredTasks.push(task);
      },
    },
  );

  assert.equal(updated.status, "in_progress");
  assert.equal(getMockStore().appointments[0].status, "in_progress");
  assert.equal(deferredTasks.length, 1);

  const committedStore = getMockStore();
  setMockStore({ ...committedStore, guardians: [] });
  await assert.doesNotReject(() => deferredTasks[0]());

  const afterNotification = getMockStore();
  assert.equal(afterNotification.appointments[0].status, "in_progress");
  assert.equal(
    afterNotification.notifications.find(
      (item) => item.appointment_id === appointment.id && item.type === "grooming_started",
    )?.status,
    "failed",
  );
});
