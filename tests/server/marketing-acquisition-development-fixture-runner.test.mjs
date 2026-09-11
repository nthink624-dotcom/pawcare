import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertDevelopmentTarget,
  buildFixtureEventKey,
  EXPECTED_DEVELOPMENT_PROJECT_REF,
  FIXTURE_BUSINESS_HOURS,
  formatKstDate,
  parseOneTimeEnv,
  RUNNER_ENV_KEYS,
  validateAclSnapshot,
} from "../../scripts/run-development-acquisition-fixture.mjs";

const runnerPath = new URL("../../scripts/run-development-acquisition-fixture.mjs", import.meta.url);

test("runner accepts only the exact Development target and two one-time secret keys", () => {
  assert.equal(EXPECTED_DEVELOPMENT_PROJECT_REF, "qefxdtmdtvnzgupmjlom");
  assert.deepEqual(RUNNER_ENV_KEYS, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  assert.equal(
    assertDevelopmentTarget("https://qefxdtmdtvnzgupmjlom.supabase.co/"),
    EXPECTED_DEVELOPMENT_PROJECT_REF,
  );
  for (const url of [
    "https://ysxykikqnneuhypybjry.supabase.co/",
    "http://qefxdtmdtvnzgupmjlom.supabase.co/",
    "https://qefxdtmdtvnzgupmjlom.supabase.co/rest/v1",
  ]) assert.throws(() => assertDevelopmentTarget(url), /target_project_mismatch/);

  const parsed = parseOneTimeEnv(
    "SUPABASE_URL=https://qefxdtmdtvnzgupmjlom.supabase.co/\nSUPABASE_SERVICE_ROLE_KEY=secret-for-test-only",
  );
  assert.equal(parsed.SUPABASE_URL, "https://qefxdtmdtvnzgupmjlom.supabase.co/");
  assert.equal(parsed.SUPABASE_SERVICE_ROLE_KEY, "secret-for-test-only");
  assert.throws(() => parseOneTimeEnv("SUPABASE_URL=x\nEXTRA_SECRET=y"), /env_key_invalid/);
  assert.throws(() => parseOneTimeEnv("SUPABASE_URL=x\nSUPABASE_URL=y"), /env_key_invalid/);
});

test("ACL validation rejects inherited or broad readers and permits only task owner/system/admin", () => {
  const current = "S-1-5-21-1000";
  assert.equal(validateAclSnapshot({
    protected: true,
    current,
    owner: current,
    rules: [
      { sid: current, type: "Allow", inherited: false },
      { sid: "S-1-5-18", type: "Allow", inherited: false },
      { sid: "S-1-5-32-544", type: "Allow", inherited: false },
    ],
  }), true);
  assert.throws(() => validateAclSnapshot({
    protected: false,
    current,
    owner: current,
    rules: [],
  }), /env_acl_not_protected/);
  assert.throws(() => validateAclSnapshot({
    protected: true,
    current,
    owner: current,
    rules: [{ sid: "S-1-1-0", type: "Allow", inherited: false }],
  }), /env_acl_too_broad/);
});

test("KST date and event keys are deterministic without exposing evidence", () => {
  assert.equal(formatKstDate(new Date("2026-09-07T15:30:00.000Z")), "2026-09-08");
  const key = buildFixtureEventKey("test_booking_created", "raw-appointment-id");
  assert.match(key, /^test_booking_created:[0-9a-f]{64}$/);
  assert.doesNotMatch(key, /raw-appointment-id/);
});

test("readiness booking fixture has a deterministic open booking window", () => {
  assert.deepEqual(Object.keys(FIXTURE_BUSINESS_HOURS), ["0", "1", "2", "3", "4", "5", "6"]);
  for (const hours of Object.values(FIXTURE_BUSINESS_HOURS)) {
    assert.deepEqual(hours, { open: "10:00", close: "19:00", enabled: true });
  }
});

test("runner is task-marker scoped, no-migration, replay checked, and always cleans in reverse", async () => {
  const source = await readFile(runnerPath, "utf8");
  assert.match(source, /process\.argv\.length !== 3/);
  assert.match(source, /path\.isAbsolute\(filePath\)/);
  assert.match(source, /validateAclSnapshot\(readProtectedWindowsAcl\(filePath\)\)/);
  assert.ok(source.indexOf("await unlink(filePath)") < source.indexOf("return parseOneTimeEnv(text)"));
  assert.doesNotMatch(source, /dotenv|\.env\.local|SUPABASE_DB_URL|listUsers|migration (?:up|repair|apply)/i);
  assert.doesNotMatch(source, /\.from\([^\n]+\)[\s\S]{0,120}\.update\(/);

  assert.match(source, /preflightSchema[\s\S]*fixture_marker_collision/);
  assert.match(source, /cleanup_authority_missing/);
  assert.match(source, /auth\.admin\.createUser/);
  assert.match(source, /pm-acq-r9-/);
  assert.match(source, /business_hours: FIXTURE_BUSINESS_HOURS/);
  assert.match(source, /booking_available_start_time: "10:00"/);
  assert.match(source, /booking_available_end_time: "19:00"/);
  assert.match(source, /record_marketing_acquisition_touch_v1/);
  assert.match(source, /\["operating_hours", "staff_hours", "services"\]/);
  assert.match(source, /p_event_name: "paid_conversion"[\s\S]*p_plan_code: "fixture_no_provider"/);
  assert.match(source, /purpose: "owner_readiness_test"/);
  assert.match(source, /created_by_owner_user_id: state\.userId/);
  assert.match(source, /marketing_acquisition_id !== fixture\.acquisitionId/);
  assert.match(source, /activity_date_kst: formatKstDate\(day1\)/);
  assert.match(source, /evaluate_marketing_day7_activation_v1/);
  assert.match(source, /"recorded", "day7_evaluation_failed"/);
  assert.match(source, /"duplicate", "day7_replay_failed"/);
  assert.match(source, /pm-acq-r9-foreign-/);
  assert.match(source, /if \(!tenantDenial\.error\) fail\("tenant_denial_failed"\)/);

  const finallyIndex = source.indexOf("} finally {");
  assert.ok(finallyIndex > source.indexOf("await createFixture"));
  assert.match(source.slice(finallyIndex), /cleanupFixture[\s\S]*verifyResidueZero/);
  const cleanup = source.slice(source.indexOf("async function cleanupFixture"), source.indexOf("async function verifyResidueZero"));
  const cleanupOrder = [
    "owner_operational_activity_events",
    "appointments",
    "services",
    "pets",
    "guardians",
    "marketing_acquisition_events",
    "marketing_acquisition_bindings",
    "marketing_acquisitions",
    "signup_idempotency_requests",
    "owner_shop_memberships",
    "owner_profiles",
    "shops",
    "deleteUser",
  ].map((token) => cleanup.indexOf(token));
  assert.ok(cleanupOrder.every((position) => position >= 0));
  assert.deepEqual(cleanupOrder, [...cleanupOrder].sort((left, right) => left - right));
  assert.match(source, /admin\.auth\.admin\.deleteUser\(state\.userId\)/);
  assert.match(source, /cleanupResidue: 0/);
  const publicResult = source.slice(source.indexOf('status: "passed"'), source.indexOf("async function main"));
  assert.doesNotMatch(publicResult, /runId|email|userId|shopId|password|serviceRole/i);
});
