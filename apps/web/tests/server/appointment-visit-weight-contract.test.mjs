import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../../src/app/api/owner/appointment-visit-weight/route.ts", import.meta.url), "utf8");
const server = readFileSync(new URL("../../src/server/appointment-visit-weight.ts", import.meta.url), "utf8");
const screen = readFileSync(new URL("../../src/components/owner-web/calendar-management-screen.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../../src/components/owner-web/appointment-visit-weight-editor.tsx", import.meta.url), "utf8");
const completionFields = readFileSync(new URL("../../src/components/owner-web/calendar-grooming-completion-fields.tsx", import.meta.url), "utf8");
const mutations = readFileSync(new URL("../../src/server/owner-mutations.ts", import.meta.url), "utf8");
const careReports = readFileSync(new URL("../../src/app/api/owner/care-reports/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20260908112107_appointment_visit_weight_measurements.sql", import.meta.url), "utf8");
const demoSeed = readFileSync(new URL("../../src/server/mongshop-development-demo-seed.ts", import.meta.url), "utf8");

test("the visible 5.2 source is a pet-profile fixture, not a visit measurement", () => {
  assert.match(demoSeed, /"보리", "비숑", 5\.2/);
  assert.match(screen, /프로필 몸무게/);
  assert.doesNotMatch(screen, /currentWeightKg:\s*selectedPet\?\.weight/);
  assert.match(screen, /currentWeightKg:\s*null/);
});

test("the API authorizes the shop and returns no-store current/recent projections", () => {
  assert.match(route, /requireOwnerShop\(request, shopId\)/);
  assert.match(route, /readAppointmentVisitWeight\(owner, appointmentId\)/);
  assert.match(route, /Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /methods: "GET, PUT, OPTIONS"/);
});

test("appointment, shop, pet, and staff scope are checked before a mutation", () => {
  assert.match(server, /from\("appointments"\)[\s\S]*?\.eq\("id", appointmentId\)[\s\S]*?\.eq\("shop_id", owner\.shopId\)/);
  assert.match(server, /owner\.role === "staff" && appointment\.staff_id !== owner\.staffId/);
  assert.match(server, /shop_id: owner\.shopId,[\s\S]*?appointment_id: appointment\.id,[\s\S]*?pet_id: appointment\.pet_id/);
  assert.match(server, /measured_by_user_id: owner\.userId/);
});

test("today and recent weights are distinct and pet profile weight is never a today fallback", () => {
  assert.match(server, /current: serializeMeasurement\(latestRow\(scoped\.filter\(\(row\) => row\.appointment_id === appointment\.id\)\)\)/);
  assert.match(server, /recent: serializeMeasurement\(latestRow\(scoped\.filter\(\(row\) => row\.appointment_id !== appointment\.id\)\)\)/);
  assert.match(server, /\.neq\("appointment_id", appointment\.id\)/);
  assert.doesNotMatch(server, /pet\.weight/);
  assert.doesNotMatch(careReports, /currentRecord\?\.pet_weight_snapshot \?\? petResult\.data\.weight/);
});

test("save requests are immutable, hashed, and replay-safe", () => {
  assert.match(server, /createHash\("sha256"\)/);
  assert.match(server, /idempotency_key_hash: requestHash/);
  assert.match(server, /같은 저장 요청의 내용이 달라 다시 저장할 수 없습니다/);
  assert.match(migration, /unique \(shop_id, appointment_id, idempotency_key_hash\)/);
  assert.match(migration, /measured_at timestamptz not null default now\(\)/);
  assert.match(migration, /revoke all on table public\.appointment_visit_weight_measurements from public, anon, authenticated/);
});

test("PC booking detail requires an explicit 44px save and canonical readback", () => {
  assert.match(screen, /<AppointmentVisitWeightEditor shopId=\{shopId\} appointmentId=\{selectedBooking\.id\}/);
  assert.match(editor, /putOwnerAppointmentVisitWeight/);
  assert.match(editor, /const canonical = await fetchOwnerAppointmentVisitWeight/);
  assert.match(editor, /오늘 몸무게가 저장되었습니다/);
  assert.match(editor, /최근 몸무게/);
  assert.match(editor, /min-h-11/);
  assert.doesNotMatch(editor, /onBlur=.*save/);
});

test("completion and care-report projections use only the canonical visit measurement", () => {
  assert.match(mutations, /readCurrentVisitWeightForCompletion/);
  assert.match(mutations, /petWeightSnapshot: currentVisitWeight\?\.weightKg \?\? existingRecord\.data\?\.pet_weight_snapshot \?\? null/);
  assert.match(mutations, /pet_weight_snapshot: currentVisitWeight\?\.weightKg \?\? existingRecord\?\.pet_weight_snapshot \?\? null/);
  assert.match(careReports, /currentVisitWeight\?\.weightKg \?\? currentRecord\?\.pet_weight_snapshot/);
  assert.match(completionFields, /onWeightSave/);
  assert.match(completionFields, /오늘 몸무게가 저장되었습니다|weightStatus/);
});

test("the source migration is additive and remains server-only", () => {
  assert.match(migration, /create table if not exists public\.appointment_visit_weight_measurements/);
  assert.match(migration, /weight_kg numeric\(5, 2\) not null check \(weight_kg between 0\.1 and 200\)/);
  assert.match(migration, /alter table public\.appointment_visit_weight_measurements enable row level security/);
  assert.match(migration, /grant all on table public\.appointment_visit_weight_measurements to service_role/);
});
