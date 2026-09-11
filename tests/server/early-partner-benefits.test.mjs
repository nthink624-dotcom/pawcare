import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const initialMigrationPath = path.join(repoRoot, "supabase", "migrations", "20260901033659_early_partner_benefits.sql");
const issueCompensationMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260901045307_separate_initial_partner_issue_compensation_cap.sql",
);
const initialMigration = fs.readFileSync(initialMigrationPath, "utf8");
const issueCompensationMigration = fs.readFileSync(issueCompensationMigrationPath, "utf8");
const serverModule = fs.readFileSync(path.join(repoRoot, "src", "server", "early-partner-benefits.ts"), "utf8");

test("early partner first-payment grant is ledger-triggered, serialized, and idempotent", () => {
  assert.match(initialMigration, /after insert or update of status on public\.owner_payment_ledger/i);
  assert.match(initialMigration, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\('early_partner_benefit_slots_v1'/i);
  assert.match(initialMigration, /first_payment_id text not null unique/i);
  assert.match(initialMigration, /idempotency_key text not null unique/i);
  assert.match(initialMigration, /slot_number smallint not null unique check \(slot_number between 1 and 20\)/i);
  assert.match(initialMigration, /new\.status <> 'PAID' or new\.plan_code <> 'single_monthly_v1'/i);
  assert.match(initialMigration, /first_payment_replayed/i);
  assert.match(initialMigration, /v_next_period_ends_at.*grant_type = 'first_payment_bonus'/is);
});

test("early partner grants atomically extend the subscription period and retain a structured audit trail", () => {
  assert.match(initialMigration, /current_period_ends_at = v_next_period_ends_at,/i);
  assert.match(initialMigration, /next_billing_at = v_next_billing_at,/i);
  assert.match(initialMigration, /benefit_window_ends_at.*interval '3 months'/is);
  assert.match(initialMigration, /cumulative_bonus_days.*between 30 and 60/is);
  assert.match(issueCompensationMigration, /cumulative_bonus_days.*between 30 and 90/is);
  assert.match(initialMigration, /create table if not exists public\.early_partner_benefit_audit_events/i);
  assert.match(initialMigration, /jsonb_build_object\(/i);
});

test("manual 7/14-day issue benefits are service-role-only and cap issue compensation at 60 days", () => {
  assert.match(initialMigration, /if current_user <> 'service_role'/i);
  assert.match(initialMigration, /if p_days not in \(7, 14\)/i);
  assert.match(initialMigration, /v_claim\.cumulative_bonus_days \+ p_days > 60/i);
  assert.match(issueCompensationMigration, /v_claim\.cumulative_bonus_days \+ p_days > 90/i);
  assert.match(initialMigration, /Re-check after locking the claim/i);
  assert.match(issueCompensationMigration, /cumulativeIssueBonusDays/i);
  assert.match(initialMigration, /grant execute on function public\.grant_early_partner_manual_bonus_v1\([^)]*\) to service_role/i);
  assert.doesNotMatch(initialMigration, /grant execute on function public\.grant_early_partner_manual_bonus_v1\([^)]*\) to authenticated/i);
  assert.match(serverModule, /grantEarlyPartnerManualBenefit/);
});
