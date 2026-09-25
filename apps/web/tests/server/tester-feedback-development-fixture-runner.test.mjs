import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runnerPath = new URL("../../scripts/run-development-tester-feedback-fixture.mjs", import.meta.url);

test("runner import is no-network and target/env helpers fail closed", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("network_forbidden_in_contract_test");
  };
  try {
    const {
      EXPECTED_DEVELOPMENT_PROJECT_REF,
      RUNNER_ENV_KEYS,
      assertDevelopmentTarget,
      parseOneTimeEnv,
      validateAclSnapshot,
    } = await import(runnerPath.href);

    assert.equal(fetchCount, 0);
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
      "SUPABASE_URL=https://qefxdtmdtvnzgupmjlom.supabase.co/\nSUPABASE_SERVICE_ROLE_KEY=contract-test-only",
    );
    assert.equal(parsed.SUPABASE_URL, "https://qefxdtmdtvnzgupmjlom.supabase.co/");
    assert.equal(parsed.SUPABASE_SERVICE_ROLE_KEY, "contract-test-only");
    assert.throws(() => parseOneTimeEnv("SUPABASE_URL=x\nEXTRA=y"), /env_key_invalid/);

    const current = "S-1-5-21-1000";
    assert.equal(validateAclSnapshot({
      protected: true,
      current,
      owner: current,
      rules: [{ sid: current, type: "Allow", inherited: false }],
    }), true);
    assert.throws(() => validateAclSnapshot({
      protected: true,
      current,
      owner: current,
      rules: [{ sid: "S-1-1-0", type: "Allow", inherited: false }],
    }), /env_acl_too_broad/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runner consumes one protected env file and never logs secrets or raw fixture identifiers", async () => {
  const source = await readFile(runnerPath, "utf8");
  assert.match(source, /process\.argv\.length !== 3/);
  assert.match(source, /path\.isAbsolute\(filePath\)/);
  assert.match(source, /validateAclSnapshot\(readProtectedWindowsAcl\(filePath\)\)/);
  assert.ok(source.indexOf("await unlink(filePath)") < source.indexOf("return parseOneTimeEnv(text)"));
  assert.doesNotMatch(source, /dotenv|\.env\.local|SUPABASE_DB_URL|listUsers|migration (?:up|repair|apply)/i);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)|password.*stdout|email.*stdout/i);

  const publicResult = source.slice(source.indexOf('status: "passed"'), source.indexOf("async function main"));
  assert.doesNotMatch(publicResult, /runId|email|userId|shopId|password|requestIds|feedbackId|serviceRole|SUPABASE_/i);
  assert.match(publicResult, /runFingerprint/);
  assert.match(publicResult, /cleanupResidue: 0/);
});

test("runner creates only marker dependencies and covers pilot, tenant, replay, duplicate, rate and admin contracts", async () => {
  const source = await readFile(runnerPath, "utf8");
  assert.match(source, /auth\.admin\.createUser/);
  assert.match(source, /pm-feedback-r10-/);
  assert.match(source, /owner_shop_memberships/);
  assert.match(source, /owner_pilot_cohort_memberships/);
  assert.match(source, /status: "active"/);
  assert.match(source, /PM_TESTER_FEEDBACK_MEMBER_REQUIRED/);
  assert.match(source, /PM_TESTER_FEEDBACK_IDEMPOTENCY_CONFLICT/);
  assert.match(source, /PM_TESTER_FEEDBACK_RATE_LIMIT/);
  assert.match(source, /p_category: "bug"/);
  assert.match(source, /"improvement"/);
  assert.match(source, /contentDuplicateMutationCount: 0/);
  assert.match(source, /exactReplayMutationCount: 0/);
  assert.match(source, /rows\.length !== 5/);
  assert.match(source, /forbiddenKeys = \["owner_user_id", "request_id", "request_fingerprint", "content_fingerprint"\]/);
  assert.match(source, /update\(\{ status: "reviewing"/);
  assert.match(source, /statusUpdatedCount/);
  assert.doesNotMatch(source, /\.from\("(?:customers|guardians|pets|appointments|services|grooming_records)"\)/);
  assert.doesNotMatch(source, /provider|analytics|storage\.|upload|photo|audio/i);
});

test("runner always deletes exact task rows in reverse dependency order and verifies residue zero", async () => {
  const source = await readFile(runnerPath, "utf8");
  const cleanup = source.slice(source.indexOf("async function cleanupFixture"), source.indexOf("async function verifyResidueZero"));
  const order = [
    "tester_feedback_submissions",
    "owner_pilot_cohort_memberships",
    "owner_shop_memberships",
    "shops",
    "deleteUser",
  ].map((token) => cleanup.indexOf(token));
  assert.ok(order.every((position) => position >= 0));
  assert.deepEqual(order, [...order].sort((left, right) => left - right));
  assert.match(cleanup, /\.eq\("shop_id", fixture\.shopId\)[\s\S]*\.eq\("owner_user_id", state\.userId\)/);

  const finallyIndex = source.indexOf("} finally {");
  assert.ok(finallyIndex > source.indexOf("await createFixture"));
  assert.match(source.slice(finallyIndex), /cleanupFixture[\s\S]*verifyResidueZero/);
  assert.match(source, /auth\.admin\.getUserById\(state\.userId\)/);
  assert.match(source, /if \(counts\.some\(\(count\) => count !== 0\)\) fail\("residue_nonzero"\)/);
});
