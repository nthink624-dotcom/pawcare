import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import ts from "typescript";

const capacityPath = new URL("../src/server/appointment-capacity.ts", import.meta.url);
const ownerMutationsPath = new URL("../src/server/owner-mutations.ts", import.meta.url);
const customerBookingsPath = new URL("../src/server/customer-bookings.ts", import.meta.url);
const migrationPath = new URL(
  "../../petmanager/supabase/migrations/20260914214756_repair_appointment_atomic_write_overlap_guard.sql",
  import.meta.url,
);

const [capacitySource, ownerMutationsSource, customerBookingsSource, migrationSource] = await Promise.all([
  readFile(capacityPath, "utf8"),
  readFile(ownerMutationsPath, "utf8"),
  readFile(customerBookingsPath, "utf8"),
  readFile(migrationPath, "utf8"),
]);

function loadCapacityModule() {
  const output = ts.transpileModule(capacitySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

function createWriteClient({ insertResult, updateResult }) {
  const calls = [];
  const selectSingle = (result) => ({
    select(columns) {
      calls.push({ kind: "select", columns });
      return {
        async single() {
          calls.push({ kind: "single" });
          return result;
        },
      };
    },
  });

  return {
    calls,
    from(table) {
      calls.push({ kind: "from", table });
      return {
        insert(payload) {
          calls.push({ kind: "insert", payload });
          return selectSingle(insertResult);
        },
        update(payload) {
          calls.push({ kind: "update", payload });
          return {
            eq(column, value) {
              calls.push({ kind: "eq", column, value });
              return selectSingle(updateResult);
            },
          };
        },
      };
    },
  };
}

function appointmentFixture(overrides = {}) {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    shop_id: "test-shop",
    guardian_id: "20000000-0000-4000-8000-000000000001",
    pet_id: "30000000-0000-4000-8000-000000000001",
    service_id: "test-service",
    staff_id: "test-staff-a",
    appointment_date: "2099-12-31",
    appointment_time: "10:00",
    status: "confirmed",
    memo: "",
    staff_memo: "내부 메모",
    rejection_reason: null,
    start_at: "2099-12-31T01:00:00.000Z",
    end_at: "2099-12-31T02:00:00.000Z",
    visit_reminder_offset_minutes: 10,
    pickup_ready_eta_minutes: 5,
    source: "owner",
    created_at: "2099-01-01T00:00:00.000Z",
    updated_at: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("appointment create sends staff and memo fields in one direct insert", async () => {
  const { createAppointmentWithDatabaseGuard } = loadCapacityModule();
  const appointment = appointmentFixture();
  const client = createWriteClient({ insertResult: { data: appointment, error: null } });

  const result = await createAppointmentWithDatabaseGuard(client, appointment);

  assert.equal(result.id, appointment.id);
  assert.deepEqual(client.calls.map((call) => call.kind), ["from", "insert", "select", "single"]);
  assert.equal(client.calls[0].table, "appointments");
  assert.equal(client.calls[1].payload.staff_id, "test-staff-a");
  assert.equal(client.calls[1].payload.staff_memo, "내부 메모");
});

test("appointment detail edit sends staff, time window, and memo in one direct update", async () => {
  const { updateAppointmentWithDatabaseGuard } = loadCapacityModule();
  const values = {
    service_id: "test-service",
    staff_id: "test-staff-b",
    appointment_date: "2099-12-31",
    appointment_time: "11:00",
    memo: "고객 요청",
    staff_memo: "담당자 메모",
    status: "confirmed",
    rejection_reason: null,
    start_at: "2099-12-31T02:00:00.000Z",
    end_at: "2099-12-31T03:00:00.000Z",
    visit_reminder_offset_minutes: 10,
    pickup_ready_eta_minutes: 5,
    updated_at: "2099-01-01T00:00:00.000Z",
  };
  const updated = appointmentFixture({ ...values });
  const client = createWriteClient({ updateResult: { data: updated, error: null } });

  const result = await updateAppointmentWithDatabaseGuard(client, updated.id, values);

  assert.equal(result.staff_id, "test-staff-b");
  assert.deepEqual(client.calls.map((call) => call.kind), ["from", "update", "eq", "select", "single"]);
  assert.equal(client.calls[1].payload.staff_memo, "담당자 메모");
  assert.deepEqual(client.calls[2], { kind: "eq", column: "id", value: updated.id });
});

test("database overlap failures become an actionable Korean owner message", async () => {
  const { createAppointmentWithDatabaseGuard, updateAppointmentWithDatabaseGuard } = loadCapacityModule();
  const overlapError = {
    code: "23P01",
    message: "appointment overlaps another active appointment for the same staff member",
    details: null,
    hint: null,
  };
  const client = createWriteClient({
    insertResult: { data: null, error: overlapError },
    updateResult: { data: null, error: overlapError },
  });

  await assert.rejects(
    createAppointmentWithDatabaseGuard(client, appointmentFixture()),
    /선택한 담당자에게 같은 시간 예약이 있습니다/,
  );
  await assert.rejects(
    updateAppointmentWithDatabaseGuard(client, appointmentFixture().id, {
      service_id: "test-service",
      staff_id: "test-staff-a",
      appointment_date: "2099-12-31",
      appointment_time: "10:00",
      memo: "",
      status: "confirmed",
      rejection_reason: null,
      start_at: "2099-12-31T01:00:00.000Z",
      end_at: "2099-12-31T02:00:00.000Z",
      updated_at: "2099-01-01T00:00:00.000Z",
    }),
    /선택한 담당자에게 같은 시간 예약이 있습니다/,
  );
});

test("owner and customer mutation paths contain no legacy capacity RPC call", () => {
  const combinedSource = [capacitySource, ownerMutationsSource, customerBookingsSource].join("\n");
  assert.doesNotMatch(combinedSource, /create_appointment_with_capacity_lock/);
  assert.doesNotMatch(combinedSource, /update_appointment_with_capacity_lock/);
  assert.doesNotMatch(capacitySource, /\.rpc\s*\(/);
});

test("owner success side effects start only after the single database write resolves", () => {
  const createBlock = ownerMutationsSource.slice(
    ownerMutationsSource.indexOf("export async function createAppointment"),
    ownerMutationsSource.indexOf("export async function updateAppointmentStatus"),
  );
  const updateBlock = ownerMutationsSource.slice(
    ownerMutationsSource.indexOf("export async function updateAppointmentDetails"),
  );
  const databaseCreateBlock = createBlock.slice(createBlock.indexOf("const createdAppointment"));
  const databaseUpdateBlock = updateBlock.slice(updateBlock.indexOf("const resolvedAppointment"));

  assert.match(createBlock, /const createdAppointment = await createAppointmentWithDatabaseGuard\(supabase, appointment\)/);
  assert.doesNotMatch(createBlock, /postCreateValues|staffUpdate/);
  assert.ok(
    databaseCreateBlock.indexOf("await createAppointmentWithDatabaseGuard") <
      databaseCreateBlock.indexOf("await dispatchAppointmentNotificationWithLogs"),
  );

  assert.match(updateBlock, /const resolvedAppointment = await updateAppointmentWithDatabaseGuard\(supabase, payload\.appointmentId, nextValues\)/);
  assert.doesNotMatch(updateBlock, /staffMemoUpdate/);
  assert.ok(
    databaseUpdateBlock.indexOf("await updateAppointmentWithDatabaseGuard") <
      databaseUpdateBlock.indexOf("await persistAppointmentChangeEvent"),
  );
  assert.ok(
    databaseUpdateBlock.indexOf("await updateAppointmentWithDatabaseGuard") <
      databaseUpdateBlock.indexOf("await dispatchNotification"),
  );
});

test("availability prechecks scope existing appointments to the selected staff", () => {
  assert.match(ownerMutationsSource, /data\.appointments\.filter\(\(appointment\) => appointment\.staff_id === staffId\)/);
  assert.match(ownerMutationsSource, /data\.appointments\.filter\(\(candidate\) => candidate\.staff_id === nextStaffId\)/);
  assert.match(customerBookingsSource, /bootstrap\.appointments\.filter\(\(candidate\) => candidate\.staff_id === appointment\.staff_id\)/);
});

test("repair migration binds and enables the invoker overlap guard with least privilege", () => {
  assert.match(migrationSource, /add column if not exists staff_memo text/i);
  assert.match(migrationSource, /create trigger appointments_prevent_staff_overlap/i);
  assert.match(migrationSource, /before insert or update of shop_id, staff_id, status, start_at, end_at/i);
  assert.match(migrationSource, /execute function public\.prevent_overlapping_staff_appointments\(\)/i);
  assert.match(migrationSource, /enable trigger appointments_prevent_staff_overlap/i);
  assert.match(migrationSource, /trigger_metadata\.tgenabled = 'O'/i);
  assert.match(migrationSource, /function_metadata\.oid = 'public\.prevent_overlapping_staff_appointments\(\)'::regprocedure/i);
  assert.match(migrationSource, /not function_metadata\.prosecdef/i);
  assert.match(migrationSource, /revoke execute on function public\.prevent_overlapping_staff_appointments\(\) from public/i);
  assert.match(migrationSource, /revoke execute on function public\.prevent_overlapping_staff_appointments\(\) from anon, authenticated/i);
  assert.match(migrationSource, /grant execute on function public\.prevent_overlapping_staff_appointments\(\) to service_role/i);
  assert.doesNotMatch(migrationSource, /create or replace function public\.prevent_overlapping_staff_appointments/i);
});

test(
  "development DB serializes same-staff writes while allowing different staff and non-overlap",
  { skip: process.env.RUN_SUPABASE_APPOINTMENT_CONCURRENCY_TEST !== "1", timeout: 60_000 },
  async (t) => {
    const nextEnv = await import("@next/env");
    const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig;
    assert.equal(typeof loadEnvConfig, "function");
    loadEnvConfig(process.cwd(), true);
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.match(supabaseUrl ?? "", /^https:\/\/qefxdtmdtvnzgupmjlom\.supabase\.co\/?$/);
    assert.ok(serviceRoleKey, "development service role key is required");

    const { createClient } = await import("@supabase/supabase-js");
    const database = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { createAppointmentWithDatabaseGuard, updateAppointmentWithDatabaseGuard } = loadCapacityModule();
    const suffix = randomUUID();
    const shopId = `pm-concurrency-${suffix}`;
    const serviceId = `pm-service-${suffix}`;
    const staffA = `pm-staff-a-${suffix}`;
    const staffB = `pm-staff-b-${suffix}`;
    const guardianIds = Array.from({ length: 4 }, () => randomUUID());
    const petIds = Array.from({ length: 4 }, () => randomUUID());
    const appointmentIds = Array.from({ length: 4 }, () => randomUUID());

    const requireSuccess = async (label, operation) => {
      const result = await operation;
      assert.equal(result.error, null, `${label}: ${result.error?.message ?? "unknown database error"}`);
      return result.data;
    };

    t.after(async () => {
      for (const [table, column] of [
        ["notifications", "shop_id"],
        ["appointment_change_events", "shop_id"],
        ["appointments", "shop_id"],
        ["pets", "shop_id"],
        ["guardians", "shop_id"],
        ["services", "shop_id"],
        ["staff_members", "shop_id"],
      ]) {
        const cleanup = await database.from(table).delete().eq(column, shopId);
        assert.equal(cleanup.error, null, `cleanup ${table}: ${cleanup.error?.message ?? "unknown database error"}`);
      }
      const shopCleanup = await database.from("shops").delete().eq("id", shopId);
      assert.equal(shopCleanup.error, null, `cleanup shops: ${shopCleanup.error?.message ?? "unknown database error"}`);
      const remaining = await database.from("shops").select("id").eq("id", shopId);
      assert.equal(remaining.error, null);
      assert.equal(remaining.data.length, 0);
    });

    await requireSuccess(
      "shop setup",
      database.from("shops").insert({
        id: shopId,
        name: "[TEST] appointment concurrency",
        phone: "000-0000-0000",
        address: "test-only",
        business_hours: Object.fromEntries(
          Array.from({ length: 7 }, (_, weekday) => [
            String(weekday),
            { open: "00:00", close: "23:59", enabled: true },
          ]),
        ),
      }),
    );
    await requireSuccess(
      "staff setup",
      database.from("staff_members").insert([
        {
          id: staffA,
          shop_id: shopId,
          name: "[TEST] staff A",
          default_days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
          start_time: "00:00",
          end_time: "23:59",
        },
        {
          id: staffB,
          shop_id: shopId,
          name: "[TEST] staff B",
          default_days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
          start_time: "00:00",
          end_time: "23:59",
        },
      ]),
    );
    await requireSuccess(
      "guardian setup",
      database.from("guardians").insert(
        guardianIds.map((id, index) => ({
          id,
          shop_id: shopId,
          name: `[TEST] guardian ${index + 1}`,
          phone: `000-0000-00${String(index + 1).padStart(2, "0")}`,
        })),
      ),
    );
    await requireSuccess(
      "pet setup",
      database.from("pets").insert(
        petIds.map((id, index) => ({
          id,
          shop_id: shopId,
          guardian_id: guardianIds[index],
          name: `[TEST] pet ${index + 1}`,
          breed: "test-only",
        })),
      ),
    );
    await requireSuccess(
      "service setup",
      database.from("services").insert({
        id: serviceId,
        shop_id: shopId,
        name: "[TEST] service",
        price: 0,
        duration_minutes: 60,
      }),
    );

    const buildLiveAppointment = (index, staffId, startAt, endAt, appointmentTime) =>
      appointmentFixture({
        id: appointmentIds[index],
        shop_id: shopId,
        guardian_id: guardianIds[index],
        pet_id: petIds[index],
        service_id: serviceId,
        staff_id: staffId,
        appointment_time: appointmentTime,
        start_at: startAt,
        end_at: endAt,
        staff_memo: "[TEST] concurrency proof",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    const first = buildLiveAppointment(0, staffA, "2099-12-31T01:00:00.000Z", "2099-12-31T02:00:00.000Z", "10:00");
    const competing = buildLiveAppointment(1, staffA, "2099-12-31T01:00:00.000Z", "2099-12-31T02:00:00.000Z", "10:00");
    const concurrentResults = await Promise.allSettled([
      createAppointmentWithDatabaseGuard(database, first),
      createAppointmentWithDatabaseGuard(database, competing),
    ]);

    const concurrentSummary = concurrentResults.map((result) =>
      result.status === "fulfilled" ? "fulfilled" : `rejected:${result.reason?.message ?? "unknown"}`,
    );
    assert.equal(
      concurrentResults.filter((result) => result.status === "fulfilled").length,
      1,
      concurrentSummary.join(" | "),
    );
    assert.equal(concurrentResults.filter((result) => result.status === "rejected").length, 1);
    assert.match(
      concurrentResults.find((result) => result.status === "rejected").reason.message,
      /선택한 담당자에게 같은 시간 예약이 있습니다/,
    );

    const differentStaff = buildLiveAppointment(2, staffB, "2099-12-31T01:00:00.000Z", "2099-12-31T02:00:00.000Z", "10:00");
    await createAppointmentWithDatabaseGuard(database, differentStaff);

    const later = buildLiveAppointment(3, staffA, "2099-12-31T02:00:00.000Z", "2099-12-31T03:00:00.000Z", "11:00");
    await createAppointmentWithDatabaseGuard(database, later);

    await assert.rejects(
      updateAppointmentWithDatabaseGuard(database, later.id, {
        service_id: serviceId,
        staff_id: staffA,
        appointment_date: "2099-12-31",
        appointment_time: "10:30",
        memo: "",
        staff_memo: "[TEST] rejected update",
        status: "confirmed",
        rejection_reason: null,
        start_at: "2099-12-31T01:30:00.000Z",
        end_at: "2099-12-31T02:30:00.000Z",
        visit_reminder_offset_minutes: 10,
        pickup_ready_eta_minutes: 5,
        updated_at: new Date().toISOString(),
      }),
      /선택한 담당자에게 같은 시간 예약이 있습니다/,
    );

    const rows = await database
      .from("appointments")
      .select("id,staff_id,start_at,end_at")
      .eq("shop_id", shopId);
    assert.equal(rows.error, null);
    assert.equal(rows.data.length, 3);
    assert.equal(rows.data.filter((row) => row.staff_id === staffA && row.start_at === "2099-12-31T01:00:00+00:00").length, 1);
    assert.equal(rows.data.filter((row) => row.staff_id === staffB && row.start_at === "2099-12-31T01:00:00+00:00").length, 1);
    assert.equal(rows.data.some((row) => row.staff_id === null), false);
    const laterReadback = rows.data.find((row) => row.id === later.id);
    assert.equal(laterReadback.start_at, "2099-12-31T02:00:00+00:00");
    assert.equal(laterReadback.end_at, "2099-12-31T03:00:00+00:00");

    const notifications = await database
      .from("notifications")
      .select("id,appointment_id")
      .in("appointment_id", appointmentIds);
    assert.equal(notifications.error, null);
    assert.equal(notifications.data.length, 0);
  },
);
