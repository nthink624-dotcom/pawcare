import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const migration = read("../../supabase/migrations/20260903003614_booking_payment_tenant_integrity.sql");
const repairMigration = read("../../supabase/migrations/20260903020522_booking_payment_pending_repair.sql");
const pendingRejectedRepairMigration = read("../../supabase/migrations/20260903023147_pending_rejected_status_rpc_repair.sql");
const assignedStaffOverlapTriggerRepair = read("../../supabase/migrations/20260903025911_assigned_staff_overlap_trigger_repair.sql");
const overlapGuard = read("../../supabase/migrations/20260803145206_serialize_staff_appointment_overlap_checks.sql");
const customerBookings = read("src/server/customer-bookings.ts");
const completeBooking = read("src/app/api/payments/complete-booking/route.ts");
const paymentBookingSchema = read("src/server/payment-booking-schema.ts");
const ownerMutations = read("src/server/owner-mutations.ts");

test("customer booking uses a service-role-only atomic RPC with request replay protection", () => {
  assert.match(migration, /create table if not exists private\.customer_booking_requests/);
  assert.match(migration, /idempotency_key_hash char\(64\) primary key/);
  assert.match(migration, /payload_hash char\(64\) not null/);
  assert.match(migration, /alter table private\.customer_booking_requests enable row level security/);
  assert.match(migration, /revoke all on table private\.customer_booking_requests from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update on table private\.customer_booking_requests to service_role/);
  assert.match(migration, /create or replace function public\.create_customer_booking_atomic_v1/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /for update/);
  assert.match(migration, /booking request fingerprints are invalid/);
  assert.match(migration, /revoke all on function public\.create_customer_booking_atomic_v1\(text, text, jsonb\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.create_customer_booking_atomic_v1\(text, text, jsonb\) to service_role/);
  assert.match(customerBookings, /createHmac\("sha256", serverEnv\.bookingAccessSecret\)/);
  assert.match(customerBookings, /rpc\("create_customer_booking_atomic_v1"/);
});

test("atomic booking rejects cross-shop relations and persists every participant", () => {
  for (const relation of [
    "appointments_guardian_shop_tenant_fk",
    "appointments_pet_guardian_shop_tenant_fk",
    "appointments_service_shop_tenant_fk",
    "appointments_staff_shop_tenant_fk",
    "appointment_pet_participants_guardian_shop_tenant_fk",
    "appointment_pet_participants_pet_guardian_shop_tenant_fk",
    "appointment_pet_participants_appointment_shop_tenant_fk",
    "appointment_pet_participants_service_shop_tenant_fk",
  ]) {
    assert.match(migration, new RegExp(relation));
  }
  assert.match(migration, /insert into public\.appointment_pet_participants \([\s\S]+?'primary'/);
  assert.match(migration, /for v_extra_pet in select value from jsonb_array_elements/);
  assert.match(migration, /'additional'/);
  assert.match(migration, /appointment exceeds shop capacity/);
  assert.match(overlapGuard, /pg_advisory_xact_lock/);
  assert.match(overlapGuard, /appointment overlaps another active appointment for the same staff member/);
  assert.match(migration, /notifications_assert_tenant_integrity/);
  assert.match(migration, /media_assets_assert_tenant_integrity/);
  assert.match(migration, /appointment guardian does not match linked guardian/);
  assert.match(migration, /appointment pet does not match linked pet/);
  assert.match(migration, /pet does not belong to linked guardian/);
});

test("additional-pet booking repair removes the RETURNS TABLE conflict ambiguity without weakening replay protection", () => {
  assert.match(repairMigration, /unique using index appointment_pet_participants_appointment_pet_unique_idx/);
  assert.match(repairMigration, /add constraint appointment_pet_participants_appointment_pet_unique/);
  assert.match(repairMigration, /on conflict on constraint appointment_pet_participants_appointment_pet_unique do nothing/);
  assert.doesNotMatch(repairMigration, /on conflict \(appointment_id, pet_id\) do nothing/);
  assert.match(repairMigration, /create or replace function public\.create_customer_booking_atomic_v1/);
  assert.match(repairMigration, /returns table \(\s*appointment_id uuid,/);
  assert.match(repairMigration, /security definer/);
  assert.match(repairMigration, /set search_path = ''/);
  assert.match(repairMigration, /idempotency_key_hash = p_idempotency_key_hash/);
  assert.match(repairMigration, /return query select v_request\.appointment_id, v_request\.guardian_id, v_request\.primary_pet_id, true/);
  assert.match(repairMigration, /revoke all on function public\.create_customer_booking_atomic_v1\(text, text, jsonb\) from public, anon, authenticated/);
  assert.match(repairMigration, /grant execute on function public\.create_customer_booking_atomic_v1\(text, text, jsonb\) to service_role/);
});

test("repair restores pending to the database status contract while unknown values remain rejected", () => {
  assert.match(repairMigration, /drop constraint if exists appointments_status_check/);
  assert.match(repairMigration, /add constraint appointments_status_check/);
  assert.match(repairMigration, /check \(status in \([\s\S]*'pending'[\s\S]*'confirmed'[\s\S]*'in_progress'[\s\S]*'almost_done'[\s\S]*'completed'[\s\S]*'cancelled'[\s\S]*'rejected'[\s\S]*'noshow'[\s\S]*\)\)/);
  assert.doesNotMatch(repairMigration, /'unknown'/);
  assert.match(repairMigration, /revoke all on function public\.update_appointment_status_atomic_v1/);
  assert.match(repairMigration, /grant execute on function public\.update_appointment_status_atomic_v1[\s\S]*to service_role/);
});

test("paid booking binds one provider payment and order to one atomic booking request", () => {
  assert.match(migration, /payment_id text unique/);
  assert.match(migration, /provider_order_id text/);
  assert.match(migration, /customer_booking_requests_provider_order_id_unique/);
  assert.match(migration, /where provider_order_id is not null/);
  assert.match(completeBooking, /import \{ paymentBookingSchema \} from "@\/server\/payment-booking-schema"/);
  assert.doesNotMatch(completeBooking, /export const paymentBookingSchema/);
  assert.match(paymentBookingSchema, /orderId: z\.string\(\)\.min\(1\)/);
  assert.match(completeBooking, /orderId !== payload\.orderId/);
  assert.match(completeBooking, /payment: \{ paymentId: payload\.paymentId, providerOrderId: orderId \}/);
});

test("status CAS commits status, completion media, and history through one server-only transaction", () => {
  assert.match(migration, /create or replace function public\.update_appointment_status_atomic_v1/);
  assert.match(migration, /where id = v_before\.id\s+and status = p_expected_previous_status/);
  assert.match(migration, /insert into public\.grooming_records/);
  assert.match(migration, /update public\.media_assets/);
  assert.match(migration, /insert into public\.appointment_change_events/);
  assert.match(migration, /appointment status changed concurrently/);
  assert.match(migration, /if p_next_status = 'pending' then\s+raise exception using errcode = '22023', message = 'pending is creation-only'/);
  assert.match(migration, /revoke all on function public\.update_appointment_status_atomic_v1/);
  assert.match(migration, /grant execute on function public\.update_appointment_status_atomic_v1[\s\S]*to service_role/);
  assert.match(ownerMutations, /rpc\("update_appointment_status_atomic_v1"/);
  assert.match(ownerMutations, /p_expected_previous_status: currentAppointment\.status/);
  assert.doesNotMatch(ownerMutations, /\.neq\("status", payload\.status\)/);
});

test("pending-rejected RPC repair changes only the rejected predecessor set", () => {
  assert.match(pendingRejectedRepairMigration, /create or replace function public\.update_appointment_status_atomic_v1/);
  assert.match(pendingRejectedRepairMigration, /p_next_status = 'pending'[\s\S]+?pending is creation-only/);
  assert.match(pendingRejectedRepairMigration, /v_before\.status = 'pending' and p_next_status not in \('confirmed', 'cancelled', 'rejected'\)/);
  assert.match(pendingRejectedRepairMigration, /p_next_status = 'rejected' and v_before\.status not in \('pending', 'confirmed'\)/);
  assert.match(pendingRejectedRepairMigration, /p_next_status = 'noshow' and v_before\.status <> 'confirmed'/);
  assert.match(pendingRejectedRepairMigration, /where id = v_before\.id\s+and status = p_expected_previous_status/);
  assert.match(pendingRejectedRepairMigration, /insert into public\.grooming_records/);
  assert.match(pendingRejectedRepairMigration, /update public\.media_assets/);
  assert.match(pendingRejectedRepairMigration, /insert into public\.appointment_change_events/);
  assert.match(pendingRejectedRepairMigration, /security definer/);
  assert.match(pendingRejectedRepairMigration, /set search_path = ''/);
  assert.match(pendingRejectedRepairMigration, /revoke all on function public\.update_appointment_status_atomic_v1/);
  assert.match(pendingRejectedRepairMigration, /grant execute on function public\.update_appointment_status_atomic_v1[\s\S]*to service_role/);
});

test("assigned-staff overlap trigger is bound, enabled, and preserves the guard's negative matrix", () => {
  assert.match(assignedStaffOverlapTriggerRepair, /drop trigger if exists appointments_prevent_staff_overlap on public\.appointments/);
  assert.match(assignedStaffOverlapTriggerRepair, /create trigger appointments_prevent_staff_overlap\s+before insert or update of shop_id, staff_id, status, start_at, end_at\s+on public\.appointments\s+for each row\s+execute function public\.prevent_overlapping_staff_appointments\(\)/);
  assert.match(assignedStaffOverlapTriggerRepair, /enable trigger appointments_prevent_staff_overlap/);
  assert.match(assignedStaffOverlapTriggerRepair, /pg_catalog\.pg_trigger/);
  assert.match(assignedStaffOverlapTriggerRepair, /trigger_metadata\.tgenabled = 'O'/);
  assert.match(assignedStaffOverlapTriggerRepair, /'public\.prevent_overlapping_staff_appointments\(\)'::regprocedure/);
  assert.match(overlapGuard, /if new\.staff_id is null then\s+return new/);
  assert.match(overlapGuard, /new\.status not in \('confirmed', 'in_progress', 'almost_done'\)/);
  assert.match(overlapGuard, /existing\.shop_id = new\.shop_id/);
  assert.match(overlapGuard, /existing\.staff_id = new\.staff_id/);
  assert.match(overlapGuard, /tstzrange\(existing\.start_at, existing\.end_at, '\[\)'\)\s+&& tstzrange\(new\.start_at, new\.end_at, '\[\)'\)/);
  assert.match(overlapGuard, /errcode = '23P01'/);
});
