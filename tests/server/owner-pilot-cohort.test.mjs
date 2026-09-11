import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  OWNER_PILOT_COHORT_LIMIT,
  OWNER_PILOT_FIRST_PAID_BONUS_DAYS,
  ownerPilotCohortStatuses,
  ownerPilotCohortStatusLabel,
  resolveOwnerPilotFeedbackDecision,
} from "../../src/lib/billing/owner-pilot-cohort.ts";

const migrationPath = new URL("../../supabase/migrations/20260907091000_owner_pilot_cohort_authority.sql", import.meta.url);
const routePath = new URL("../../src/app/api/admin/pilot-cohort/route.ts", import.meta.url);
const serverPath = new URL("../../src/server/owner-pilot-cohort.ts", import.meta.url);
const bootstrapPath = new URL("../../src/server/bootstrap.ts", import.meta.url);
const bootstrapRoutePath = new URL("../../src/app/api/bootstrap/route.ts", import.meta.url);
const staffPrivacyPath = new URL("../../src/server/staff-privacy.ts", import.meta.url);
const domainPath = new URL("../../src/types/domain.ts", import.meta.url);

test("the cohort has exactly 20 stable positions and five explicit lifecycle states", () => {
  assert.equal(OWNER_PILOT_COHORT_LIMIT, 20);
  assert.equal(OWNER_PILOT_FIRST_PAID_BONUS_DAYS, 30);
  assert.deepEqual(ownerPilotCohortStatuses, ["planned", "active", "paused", "completed", "excluded"]);
  assert.deepEqual(ownerPilotCohortStatuses.map(ownerPilotCohortStatusLabel), ["가입예정", "진행중", "중지", "완료", "제외"]);
});

test("every accepted feedback remains recorded while free-day grants stop safely at paid, inactive, or cap boundaries", () => {
  assert.deepEqual(resolveOwnerPilotFeedbackDecision({ status: "active", paid: false, initialBenefitEnrolled: true, totalFreeDays: 30, requestedDays: 3 }), { outcome: "granted", grantedDays: 3 });
  assert.deepEqual(resolveOwnerPilotFeedbackDecision({ status: "active", paid: false, initialBenefitEnrolled: true, totalFreeDays: 57, requestedDays: 3 }), { outcome: "granted", grantedDays: 3 });
  assert.deepEqual(resolveOwnerPilotFeedbackDecision({ status: "active", paid: false, initialBenefitEnrolled: true, totalFreeDays: 58, requestedDays: 3 }), { outcome: "recorded_cap_reached", grantedDays: 0 });
  assert.deepEqual(resolveOwnerPilotFeedbackDecision({ status: "active", paid: true, initialBenefitEnrolled: true, totalFreeDays: 42, requestedDays: 3 }), { outcome: "recorded_paid", grantedDays: 0 });
  assert.deepEqual(resolveOwnerPilotFeedbackDecision({ status: "completed", paid: false, initialBenefitEnrolled: true, totalFreeDays: 42, requestedDays: 3 }), { outcome: "recorded_completed", grantedDays: 0 });
  assert.deepEqual(resolveOwnerPilotFeedbackDecision({ status: "excluded", paid: false, initialBenefitEnrolled: true, totalFreeDays: 42, requestedDays: 3 }), { outcome: "recorded_excluded", grantedDays: 0 });
});

test("migration enforces tenant ownership, max20, one-key replay, min3/total60, and service-role-only access", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /cohort_position smallint not null unique check \(cohort_position between 1 and 20\)/);
  assert.match(migration, /shop_id text primary key[\s\S]*owner_user_id uuid not null unique/);
  assert.match(migration, /m\.role = 'owner'[\s\S]*s\.owner_user_id = p_owner_user_id/);
  assert.match(migration, /where user_id = p_owner_user_id and shop_id = p_shop_id/);
  assert.match(migration, /if v_position > 20 then[\s\S]*PM_PILOT_COHORT_FULL/);
  assert.match(migration, /p_requested_days < 3 or p_requested_days > 60/);
  assert.match(migration, /v_claim\.total_free_days \+ p_requested_days > 60/);
  assert.match(migration, /content_fingerprint text not null check \(content_fingerprint ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.doesNotMatch(migration, /severity|duplicate|known_issue|reproduced/);
  assert.match(migration, /revoke all on public\.owner_pilot_cohort_memberships from public, anon, authenticated/);
  assert.match(migration, /revoke execute[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);

  const feedbackLock = migration.indexOf("owner_pilot_feedback:");
  const feedbackReplay = migration.indexOf("where idempotency_key = p_idempotency_key", feedbackLock);
  const membershipLookup = migration.indexOf("from public.owner_pilot_cohort_memberships", feedbackReplay);
  const paidBoundary = migration.indexOf("status = 'PAID'", membershipLookup);
  assert.ok(feedbackLock >= 0 && feedbackReplay > feedbackLock && membershipLookup > feedbackReplay && paidBoundary > membershipLookup);
});

test("first-paid +30 is once per cohort shop and does not double the legacy first-20 grant", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /owner_pilot_first_paid_benefit_grants/);
  assert.match(migration, /shop_id text not null unique/);
  assert.match(migration, /payment_id text not null unique/);
  assert.match(migration, /granted_days smallint not null default 30 check \(granted_days = 30\)/);
  assert.match(migration, /grant_source text not null check \(grant_source in \('pilot_cohort', 'legacy_early_partner'\)\)/);
  assert.match(migration, /from public\.early_partner_benefit_grants[\s\S]*grant_type = 'first_payment_bonus'/);
  assert.match(migration, /if found then[\s\S]*v_source := 'legacy_early_partner'[\s\S]*else[\s\S]*interval '30 days'[\s\S]*v_source := 'pilot_cohort'/);
  assert.match(migration, /create trigger zz_owner_payment_ledger_pilot_cohort_first_paid_v1/);
  assert.doesNotMatch(migration, /drop trigger if exists owner_payment_ledger_early_partner_first_payment_v1/);
});

test("admin operations hash feedback server-side and expose no raw text in the persistence contract", async () => {
  const [route, server] = await Promise.all([readFile(routePath, "utf8"), readFile(serverPath, "utf8")]);
  assert.match(route, /requireAdminSession\(request\)/);
  assert.match(route, /feedbackText: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(4000\)/);
  assert.match(route, /createHash\("sha256"\)\.update\(body\.feedbackText\)\.digest\("hex"\)/);
  assert.doesNotMatch(server, /feedbackText/);
  assert.match(server, /upsert_owner_pilot_cohort_membership_v1/);
  assert.match(server, /record_owner_pilot_feedback_benefit_v1/);
  assert.match(server, /\.eq\("owner_user_id", input\.ownerUserId\)[\s\S]*\.eq\("shop_id", input\.shopId\)/);
  assert.doesNotMatch(server, /throw new OwnerPilotCohortError\(error\?\.message/);
});

test("authenticated owner bootstrap includes the shared cohort projection while public bootstrap does not", async () => {
  const [bootstrap, route, domain, staffPrivacy] = await Promise.all([
    readFile(bootstrapPath, "utf8"),
    readFile(bootstrapRoutePath, "utf8"),
    readFile(domainPath, "utf8"),
    readFile(staffPrivacyPath, "utf8"),
  ]);
  assert.match(domain, /pilotCohort\?: OwnerPilotCohortProjection/);
  assert.match(bootstrap, /getOwnerPilotCohortProjection\(\{ ownerUserId: rawShop\.owner_user_id, shopId \}\)/);
  assert.match(bootstrap, /pilotCohort,/);
  const publicScope = route.slice(route.indexOf('if (scope === "public")'), route.indexOf("const owner = await requireOwnerShop"));
  assert.match(publicScope, /includePilotCohort: false/);
  assert.doesNotMatch(publicScope, /pilotCohort: data\.pilotCohort/);
  assert.match(route, /scopeBootstrapForStaff\(data, owner\)/);
  assert.match(staffPrivacy, /pilotCohort: undefined/);
});
