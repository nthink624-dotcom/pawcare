import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildOwnerOperationalActivityRequestKey,
  MARKETING_DAY7_ACTIVATION_RULE_VERSION,
  OWNER_OPERATIONAL_ACTIVITY_SOURCES,
} from "../../src/server/marketing-acquisition.ts";

const migrationPath = new URL(
  "../../supabase/migrations/20260908100000_marketing_owner_readiness_activity.sql",
  import.meta.url,
);
const testBookingRoutePath = new URL(
  "../../src/app/api/owner/readiness-test-bookings/route.ts",
  import.meta.url,
);
const setupRoutePath = new URL(
  "../../src/app/api/owner/initial-setup/acquisition-milestone/route.ts",
  import.meta.url,
);
const mutationPath = new URL("../../src/server/owner-mutations.ts", import.meta.url);
const normalAppointmentRoutePath = new URL("../../src/app/api/owner/schedule/route.ts", import.meta.url);

test("activity request keys are deterministic one-way evidence for the fixed allowlist", () => {
  assert.deepEqual(OWNER_OPERATIONAL_ACTIVITY_SOURCES, [
    "operating_hours",
    "staff_hours",
    "services",
    "test_booking",
  ]);
  assert.equal(MARKETING_DAY7_ACTIVATION_RULE_VERSION, "day7_v1");
  const evidence = "appointment-raw-evidence-that-must-not-be-the-key";
  const first = buildOwnerOperationalActivityRequestKey("test_booking", evidence);
  assert.equal(first, buildOwnerOperationalActivityRequestKey("test_booking", evidence));
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(first, /appointment|evidence/);
});

test("migration binds server-owned test appointments to an exact owner shop and request", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /purpose text not null default 'booking'/);
  assert.match(migration, /created_by_owner_user_id uuid references auth\.users\(id\)/);
  assert.match(migration, /owner_request_id uuid/);
  assert.match(migration, /marketing_acquisition_id uuid references public\.marketing_acquisitions/);
  assert.match(migration, /purpose = 'owner_readiness_test'[\s\S]*source = 'owner'/);
  assert.match(migration, /appointments_owner_readiness_request_unique[\s\S]*shop_id, created_by_owner_user_id, owner_request_id/);
  assert.match(migration, /where id = new\.shop_id and owner_user_id = new\.created_by_owner_user_id/);
  assert.match(migration, /where shop_id = new\.shop_id[\s\S]*owner_user_id = new\.created_by_owner_user_id/);
  assert.match(migration, /PM_OWNER_READINESS_TENANT_MISMATCH/);
});

test("activity ledger is tenant-bound, KST-dated, replay-safe and service-role only", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /create table if not exists public\.owner_operational_activity_events/);
  assert.match(migration, /activity_source in \([\s\S]*'operating_hours'[\s\S]*'test_booking'/);
  assert.match(migration, /request_key ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /\(clock_timestamp\(\) at time zone 'Asia\/Seoul'\)::date/);
  assert.match(migration, /unique \(owner_user_id, shop_id, activity_source, request_key\)/);
  assert.match(migration, /where id = p_shop_id and owner_user_id = p_owner_user_id/);
  assert.match(migration, /on conflict \(owner_user_id, shop_id, activity_source, request_key\) do nothing/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.owner_operational_activity_events from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.record_owner_operational_activity_v1[\s\S]*to service_role/);
});

test("day7 v1 waits 168 hours and requires setup, an eligible booking and two KST dates", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const evaluator = migration.slice(migration.indexOf("evaluate_marketing_day7_activation_v1"));
  assert.match(evaluator, /p_rule_version <> 'day7_v1'/);
  assert.match(evaluator, /clock_timestamp\(\) < v_signup_completed_at \+ interval '168 hours'/);
  assert.match(evaluator, /count\(distinct e\.step_key\)[\s\S]*<> 3/);
  assert.match(evaluator, /e\.step_key in \('operating_hours', 'staff_hours', 'services'\)/);
  assert.match(evaluator, /a\.status not in \('cancelled', 'rejected', 'noshow'\)/);
  assert.match(evaluator, /count\(distinct a\.activity_date_kst\)[\s\S]*< 2/);
  assert.match(evaluator, /'activated_day_7'[\s\S]*p_event_key[\s\S]*7, p_rule_version/);
  assert.match(evaluator, /on conflict do nothing/);
});

test("dedicated owner route creates, rereads, then records best-effort appointment evidence", async () => {
  const [route, mutation, normalRoute] = await Promise.all([
    readFile(testBookingRoutePath, "utf8"),
    readFile(mutationPath, "utf8"),
    readFile(normalAppointmentRoutePath, "utf8"),
  ]);
  assert.match(route, /bodySchema[\s\S]*\.strict\(\)/);
  assert.doesNotMatch(route.slice(0, route.indexOf("type ReadinessAppointmentRow")), /purpose:|source:/);
  const auth = route.indexOf("requireOwnerShop(request, body.shopId)");
  const create = route.indexOf("await createAppointment", auth);
  const reread = route.indexOf("appointmentId: appointment.id", create);
  const evidence = route.indexOf("await recordBestEffortAttribution(row)", reread);
  assert.ok(auth >= 0 && create > auth && reread > create && evidence > reread);
  assert.match(route, /owner\.role !== "owner"/);
  assert.match(route, /purpose", "owner_readiness_test"/);
  assert.match(route, /created_by_owner_user_id", input\.ownerUserId/);
  assert.match(route, /ownerReadinessTest: \{ createdByOwnerUserId: owner\.userId, requestId: body\.requestId \}/);
  assert.match(route, /authoritativeEventId: row\.id/);
  assert.match(route, /Promise\.allSettled/);
  assert.match(mutation, /if \(options\?\.ownerReadinessTest\)[\s\S]*테스트 예약 기록 구성을 확인해 주세요/);
  assert.match(mutation, /!options\?\.ownerReadinessTest && appointment\.status === "confirmed"/);
  assert.doesNotMatch(normalRoute, /ownerReadinessTest|owner_readiness_test/);
});

test("canonical setup requery supplies only operational evidence and attribution cannot roll back saves", async () => {
  const route = await readFile(setupRoutePath, "utf8");
  const requery = route.indexOf("const canonical = await getBootstrap");
  const readiness = route.indexOf("if (!readiness.steps[body.step])", requery);
  const activity = route.indexOf("recordBoundOwnerOperationalActivity", readiness);
  assert.ok(requery >= 0 && readiness > requery && activity > readiness);
  assert.match(route, /Promise\.allSettled/);
  assert.match(route, /business_hours/);
  assert.match(route, /defaultDays: staff\.defaultDays/);
  assert.match(route, /durationMinutes: service\.duration_minutes/);
  assert.doesNotMatch(route, /staff\.name|staff\.phone|guardian|customer/);
});
