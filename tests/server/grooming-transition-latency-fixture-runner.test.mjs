import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  advanceRunnerState,
  assertDevelopmentTarget,
  assertLoopbackCdpUrl,
  CLEANUP_TABLES,
  EXPECTED_DEVELOPMENT_PROJECT_REF,
  EXPECTED_F_URL,
  parseOneTimeEnv,
  RUNNER_ENV_KEYS,
  TRANSITION_PLAN,
  validateAclSnapshot,
} from "../../scripts/run-development-grooming-transition-latency-fixture.mjs";

const runnerPath = new URL("../../scripts/run-development-grooming-transition-latency-fixture.mjs", import.meta.url);

test("runner accepts only the exact Development project and protected two-key handoff", () => {
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
    "SUPABASE_URL=https://qefxdtmdtvnzgupmjlom.supabase.co/\nSUPABASE_SERVICE_ROLE_KEY=test-only-secret",
  );
  assert.equal(parsed.SUPABASE_URL, "https://qefxdtmdtvnzgupmjlom.supabase.co/");
  assert.equal(parsed.SUPABASE_SERVICE_ROLE_KEY, "test-only-secret");
  assert.throws(() => parseOneTimeEnv("SUPABASE_URL=x\nEXTRA=y"), /env_key_invalid/);
  assert.throws(() => parseOneTimeEnv("SUPABASE_URL=x\nSUPABASE_URL=y"), /env_key_invalid/);

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
    protected: true,
    current,
    owner: current,
    rules: [{ sid: "S-1-1-0", type: "Allow", inherited: false }],
  }), /env_acl_too_broad/);
});

test("runner accepts only a loopback CDP endpoint and the exact F page", () => {
  assert.equal(EXPECTED_F_URL, "http://127.0.0.1:3100/owner/mobile");
  assert.equal(assertLoopbackCdpUrl("http://127.0.0.1:9222/"), "http://127.0.0.1:9222");
  for (const url of [
    "http://localhost:9222/",
    "http://127.0.0.1:9222/json",
    "https://127.0.0.1:9222/",
    "http://127.0.0.1/",
    "http://example.com:9222/",
  ]) assert.throws(() => assertLoopbackCdpUrl(url), /cdp_not_task_local/);
});

test("three transitions and lifecycle state machine are explicit and retry-free", () => {
  assert.deepEqual(TRANSITION_PLAN, [
    { from: "confirmed", to: "in_progress", action: "바로 시작", nextAction: "픽업 준비" },
    { from: "in_progress", to: "almost_done", action: "픽업 준비", nextAction: "미용 완료" },
    { from: "almost_done", to: "completed", action: "미용 완료", nextAction: null },
  ]);
  let state = "created";
  for (const event of [
    "capabilities_confirmed",
    "fixture_created",
    "session_bound",
    "measure",
    "restore",
    "clean",
    "residue_verified",
    "finish",
  ]) state = advanceRunnerState(state, event);
  assert.equal(state, "completed");
  assert.throws(() => advanceRunnerState("created", "fixture_created"), /state_transition_invalid/);
});

test("source consumes secrets first, proves prewrite capabilities, and never records sensitive payloads", async () => {
  const source = await readFile(runnerPath, "utf8");
  assert.match(source, /process\.argv\.length !== 4/);
  assert.match(source, /path\.isAbsolute\(filePath\)/);
  assert.match(source, /validateAclSnapshot\(readProtectedWindowsAcl\(filePath\)\)/);
  assert.ok(source.indexOf("await unlink(filePath)") < source.indexOf("return parseOneTimeEnv(text)"));
  assert.doesNotMatch(source, /dotenv|\.env\.local|SUPABASE_DB_URL|listUsers|migration (?:up|repair|apply)/i);

  const capabilityGate = source.slice(source.indexOf("cdp = await connectToExactF"), source.indexOf("await createFixture"));
  for (const token of [
    "storageSnapshotExpression",
    "verifyFSelectors",
    "verifySessionRestoreCapability",
    "verifyCleanupAuthority",
    '"capabilities_confirmed"',
  ]) assert.match(capabilityGate, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(source.indexOf("verifyCleanupAuthority(admin, fixture)") < source.indexOf("fixtureCreated = true"));
  assert.match(source, /exact_f_target_missing/);
  assert.match(source, /fixture_marker_collision/);
  assert.match(source, /cleanup_authority_missing/);
  assert.match(source, /session_restore_capability_missing/);
  assert.match(source, /credentials\.SUPABASE_SERVICE_ROLE_KEY = ""/);

  const publicResult = source.slice(source.indexOf('status: "passed"'), source.indexOf("async function main"));
  assert.doesNotMatch(publicResult, /email|password|accessToken|refreshToken|userId|shopId|appointmentId|marker|payload/i);
  assert.match(publicResult, /transitionRetries: 0/);
  assert.match(publicResult, /providerCalls: 0/);
  assert.doesNotMatch(source, /screenshot|Page\.captureScreenshot|Runtime\.getProperties|Network\.getResponseBody/);
});

test("one process binds F, measures PATCH/bootstrap/DOM marks, restores session, then purges exact residue", async () => {
  const source = await readFile(runnerPath, "utf8");
  assert.match(source, /auth\.admin\.createUser/);
  assert.match(source, /auth\.signInWithPassword/);
  assert.match(source, /petmanager\.ownerAuthHandoff/);
  assert.match(source, /petmanager:owner-current-shop/);
  assert.match(source, /method === 'PATCH' && pathname === '\/api\/appointments'/);
  assert.match(source, /method === 'GET' && pathname === '\/api\/bootstrap'/);
  assert.match(source, /tapToPatchResponseMs/);
  assert.match(source, /patchToBootstrapResponseMs/);
  assert.match(source, /bootstrapToDomReadyMs/);
  assert.match(source, /findActionExpression\(fixture\.marker, step\.action\)/);

  const finallyBody = source.slice(source.indexOf("} finally {"), source.indexOf("if (primaryError) throw primaryError"));
  assert.ok(finallyBody.indexOf("restoreOriginalSession") < finallyBody.indexOf("cleanupFixture"));
  assert.match(finallyBody, /verifyResidueZero/);
  assert.match(source, /process\.once\("SIGINT"/);
  assert.match(source, /process\.once\("SIGTERM"/);
  assert.match(source, /cleanupResidue: 0/);
  assert.match(source, /sessionRestored: true/);

  assert.deepEqual(CLEANUP_TABLES, [
    "notification_delivery_checks",
    "media_send_attempts",
    "notification_media_attachments",
    "appointment_status_event_media",
    "appointment_status_events",
    "notifications",
    "shop_revenue_entries",
    "grooming_record_drafts",
    "grooming_records",
    "appointment_change_events",
    "appointments",
    "services",
    "pets",
    "guardians",
    "owner_subscriptions",
    "owner_shop_memberships",
    "owner_profiles",
    "shops",
  ]);
  const cleanupFunction = source.slice(source.indexOf("async function cleanupFixture"), source.indexOf("async function verifyResidueZero"));
  const cleanup = cleanupFunction.slice(cleanupFunction.indexOf("const steps = ["));
  const order = CLEANUP_TABLES.slice(0, 3)
    .concat(CLEANUP_TABLES.slice(4))
    .map((table) => cleanup.indexOf(`\"${table}\"`));
  assert.ok(order.every((position) => position >= 0));
  assert.deepEqual(order, [...order].sort((left, right) => left - right));
  assert.match(cleanup, /deleteUser\(state\.userId\)/);
  assert.match(source, /notification_settings: \{ enabled: false \}/);
  assert.match(source, /notification_settings: \{ enabled: false, revisit_enabled: false \}/);
});
