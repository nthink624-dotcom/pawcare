import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const migration = read("../../supabase/migrations/20260908011614_canonical_booking_start_window_close_grace.sql");
const availability = read("src/lib/availability.ts");
const cutoff = read("src/lib/booking-last-start-cutoff.ts");
const customerBookings = read("src/server/customer-bookings.ts");
const ownerMutations = read("src/server/owner-mutations.ts");
const settingsSchema = read("src/server/schemas.ts");
const operatingHours = read("src/components/owner-web/operating-hours-settings.tsx");
const legacyOwnerSettings = read("src/components/owner/owner-settings-panel.tsx");

test("canonical booking settings keep the visible label and add a zero-default close grace", () => {
  assert.match(settingsSchema, /booking_close_grace_minutes: z\.union\(\[z\.literal\(0\), z\.literal\(15\), z\.literal\(30\), z\.literal\(60\)\]\)\.default\(0\)/);
  assert.match(migration, /booking_close_grace_minutes/);
  assert.match(migration, /else 0/);
  assert.match(migration, /in \('0', '15', '30', '60'\)/);
  assert.match(operatingHours, /예약 가능 시간/);
  assert.doesNotMatch(operatingHours, /예약 시작 가능 시간/);
  assert.match(operatingHours, /마감 여유/);
  assert.match(operatingHours, /minutes === 15 \? " · 권장" : ""/);
  assert.doesNotMatch(operatingHours, /마지막 예약 접수/);
  assert.match(legacyOwnerSettings, /label="마감 여유"/);
  assert.match(legacyOwnerSettings, /booking_close_grace_minutes: bookingCloseGraceMinutes/);
  assert.doesNotMatch(legacyOwnerSettings, /마지막 예약 접수/);
});

test("the canonical predicate uses inclusive start and end boundaries", () => {
  assert.match(cutoff, /params\.startMinute >= earliestStartMinute/);
  assert.match(cutoff, /params\.startMinute <= params\.bookingEndMinute/);
  assert.match(cutoff, /params\.startMinute \+ params\.durationMinutes <= latestEndMinute/);
  assert.match(cutoff, /params\.staffEndMinute === params\.businessCloseMinute/);
  assert.match(availability, /isBookingWithinCanonicalWindow/);
  assert.match(availability, /getLatestBookingStartMinute/);
  assert.match(ownerMutations, /isBookingWithinCanonicalWindow/);
  assert.match(ownerMutations, /예약 가능 시간 또는 마감 여유/);
});

test("the database trigger preserves closures, staff eligibility, security, and the same grace rule", () => {
  assert.match(migration, /create or replace function private\.assert_appointment_booking_start_cutoff\(\)/);
  assert.match(migration, /new\.appointment_time < greatest\(v_business_open, v_booking_start\)[\s\S]*new\.appointment_time > v_booking_end/);
  assert.match(migration, /v_staff_end = v_business_close/);
  assert.match(migration, /\(new\.end_at at time zone 'Asia\/Seoul'\) > v_latest_end_local/);
  assert.match(migration, /temporary_closed_dates/);
  assert.match(migration, /regular_closed_cycle/);
  assert.match(migration, /booking_blocked_windows/);
  assert.match(migration, /staff_schedule_overrides/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /revoke all on function private\.assert_appointment_booking_start_cutoff\(\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function private\.assert_appointment_booking_start_cutoff\(\) to service_role/);
  assert.match(migration, /trigger_metadata\.tgenabled = 'O'/);
});

test("public and owner booking callers converge on the shared availability predicate", () => {
  assert.match(customerBookings, /computeAvailableSlots\(/);
  assert.match(customerBookings, /create_customer_booking_atomic_v1/);
  assert.match(ownerMutations, /computeAvailableSlots\(/);
  assert.match(ownerMutations, /isBookingWithinCanonicalWindow/);
});
