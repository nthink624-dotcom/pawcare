import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ts from "typescript";

const [helperSource, ownerAppSource, routeSource] = await Promise.all([
  readFile(new URL("../src/lib/appointments/owner-appointment-create.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/api/appointments/route.ts", import.meta.url), "utf8"),
]);

const helperOutput = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const helperModule = { exports: {} };
Function("module", "exports", "require", helperOutput)(helperModule, helperModule.exports, () => ({}));

function appointmentFixture(overrides = {}) {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    shop_id: "test-shop",
    guardian_id: "guardian",
    pet_id: "pet",
    service_id: "service",
    staff_id: "staff",
    appointment_date: "2099-12-31",
    appointment_time: "10:00",
    status: "confirmed",
    memo: "",
    staff_memo: "",
    rejection_reason: null,
    start_at: "2099-12-31T10:00:00+09:00",
    end_at: "2099-12-31T11:00:00+09:00",
    visit_reminder_offset_minutes: 10,
    pickup_ready_eta_minutes: 5,
    source: "owner",
    created_at: "2099-01-01T00:00:00.000Z",
    updated_at: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("owner appointment create gate rejects a synchronous duplicate click", async () => {
  const gate = helperModule.exports.createOwnerAppointmentCreateGate();
  let releaseFirst;
  const firstTask = gate.run(
    () => new Promise((resolve) => {
      releaseFirst = resolve;
    }),
  );
  const duplicate = await gate.run(async () => "duplicate");

  assert.deepEqual(duplicate, { accepted: false });
  releaseFirst("created");
  assert.deepEqual(await firstTask, { accepted: true, value: "created" });
});

test("owner appointment create readback must be authoritative for the current shop", () => {
  const created = appointmentFixture();
  assert.equal(
    helperModule.exports.assertOwnerAppointmentCreateReadback(created, "test-shop"),
    created,
  );
  assert.throws(
    () => helperModule.exports.assertOwnerAppointmentCreateReadback({ ...created, shop_id: "other-shop" }, "test-shop"),
    /예약 등록 결과를 확인하지 못했습니다/,
  );
  assert.throws(
    () => helperModule.exports.assertOwnerAppointmentCreateReadback({ ...created, status: "pending" }, "test-shop"),
    /예약 등록 결과를 확인하지 못했습니다/,
  );
});

test("created readback replaces the same id without duplicating the booking", () => {
  const created = appointmentFixture({ updated_at: "2099-01-02T00:00:00.000Z" });
  const stale = appointmentFixture({ updated_at: "2099-01-01T00:00:00.000Z" });
  const merged = helperModule.exports.mergeOwnerAppointmentCreateReadback([stale], created);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].updated_at, created.updated_at);
});

test("mobile create applies DB readback before non-blocking refresh", () => {
  const createStart = ownerAppSource.indexOf("async function createOwnerAppointment");
  const createEnd = ownerAppSource.indexOf("async function saveStaffMemberProfile", createStart);
  const createBlock = ownerAppSource.slice(createStart, createEnd);

  assert.match(createBlock, /fetchJson<Appointment>\("\/api\/appointments"/);
  assert.match(createBlock, /assertOwnerAppointmentCreateReadback/);
  assert.match(createBlock, /mergeOwnerAppointmentCreateReadback/);
  assert.match(createBlock, /void refreshSilently\(\)/);
  assert.doesNotMatch(createBlock, /await refresh\(/);
  assert.ok(createBlock.indexOf("setData") < createBlock.indexOf("void refreshSilently()"));
  assert.match(ownerAppSource, /saving \? "등록 중…" : "예약 등록"/);
});

test("route defers notification only after the guarded create returns", () => {
  const createIndex = routeSource.indexOf("const result = await createAppointment");
  const scheduleIndex = routeSource.indexOf("schedulePostCommit", createIndex);
  const afterIndex = routeSource.indexOf("after(async", scheduleIndex);
  const responseIndex = routeSource.indexOf("return NextResponse.json", afterIndex);

  assert.ok(createIndex >= 0);
  assert.ok(scheduleIndex > createIndex);
  assert.ok(afterIndex > scheduleIndex);
  assert.ok(responseIndex > afterIndex);
  assert.doesNotMatch(routeSource, /BOOKING_ACCESS_SECRET/);
});
