#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

export const EXPECTED_DEVELOPMENT_PROJECT_REF = "qefxdtmdtvnzgupmjlom";
export const RUNNER_ENV_KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

const SAFE_ACL_SIDS = new Set(["S-1-5-18", "S-1-5-32-544"]); // SYSTEM, Administrators
const FIXTURE_ADMIN_EMAIL = "tester-feedback-r10@example.invalid";
const FIXTURE_APP_VERSION = "0.0.0-r10";
const FIXTURE_BUSINESS_HOURS = Object.freeze(Object.fromEntries(
  Array.from({ length: 7 }, (_, weekday) => [
    String(weekday),
    Object.freeze({ open: "10:00", close: "19:00", enabled: true }),
  ]),
));

class FixtureRunnerError extends Error {
  constructor(code) {
    super(code);
    this.name = "FixtureRunnerError";
    this.code = code;
  }
}

function fail(code) {
  throw new FixtureRunnerError(code);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function parseOneTimeEnv(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) fail("env_format_invalid");
    const key = line.slice(0, separator).trim();
    if (!RUNNER_ENV_KEYS.includes(key) || values.has(key)) fail("env_key_invalid");
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!value) fail("env_value_missing");
    values.set(key, value);
  }
  if (values.size !== RUNNER_ENV_KEYS.length) fail("env_required_keys_missing");
  return Object.fromEntries(values);
}

export function assertDevelopmentTarget(supabaseUrl) {
  let parsed;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    fail("target_url_invalid");
  }
  const expectedHost = `${EXPECTED_DEVELOPMENT_PROJECT_REF}.supabase.co`;
  if (parsed.protocol !== "https:" || parsed.hostname !== expectedHost || parsed.pathname !== "/") {
    fail("target_project_mismatch");
  }
  return EXPECTED_DEVELOPMENT_PROJECT_REF;
}

function readProtectedWindowsAcl(filePath) {
  if (process.platform !== "win32") fail("windows_acl_required");
  const powershell = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const command = [
    "$acl=Get-Acl -LiteralPath $env:PM_FIXTURE_ENV_PATH",
    "$current=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
    "$owner=$acl.Owner",
    "try{$owner=(New-Object Security.Principal.NTAccount($owner)).Translate([Security.Principal.SecurityIdentifier]).Value}catch{}",
    "$rules=@($acl.Access|ForEach-Object{$sid=$_.IdentityReference.Value;try{$sid=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value}catch{};[pscustomobject]@{sid=$sid;type=$_.AccessControlType.ToString();inherited=$_.IsInherited}})",
    "[pscustomobject]@{protected=$acl.AreAccessRulesProtected;current=$current;owner=$owner;rules=$rules}|ConvertTo-Json -Depth 4 -Compress",
  ].join("; ");
  try {
    return JSON.parse(execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], {
      encoding: "utf8",
      windowsHide: true,
      env: {
        SystemRoot: process.env.SystemRoot || "C:\\Windows",
        WINDIR: process.env.WINDIR || "C:\\Windows",
        TEMP: process.env.TEMP || os.tmpdir(),
        TMP: process.env.TMP || os.tmpdir(),
        PM_FIXTURE_ENV_PATH: filePath,
      },
    }));
  } catch {
    fail("env_acl_unreadable");
  }
}

export function validateAclSnapshot(snapshot) {
  if (!snapshot?.protected || typeof snapshot.current !== "string") fail("env_acl_not_protected");
  const allowed = new Set([...SAFE_ACL_SIDS, snapshot.current]);
  if (!allowed.has(snapshot.owner)) fail("env_acl_owner_invalid");
  for (const rule of Array.isArray(snapshot.rules) ? snapshot.rules : []) {
    if (rule?.type === "Allow" && (!allowed.has(rule.sid) || rule.inherited === true)) {
      fail("env_acl_too_broad");
    }
  }
  return true;
}

async function consumeOneTimeCredentials(filePath) {
  if (!path.isAbsolute(filePath)) fail("env_path_must_be_absolute");
  const fileStat = await lstat(filePath).catch(() => null);
  if (!fileStat?.isFile() || fileStat.isSymbolicLink()) fail("env_file_missing");
  validateAclSnapshot(readProtectedWindowsAcl(filePath));
  const text = await readFile(filePath, "utf8");
  await unlink(filePath).catch(() => fail("env_file_consume_failed"));
  return parseOneTimeEnv(text);
}

function requireNoError(result, code) {
  if (result?.error) fail(code);
  return result?.data;
}

function expectRpcError(result, expectedFragment, code) {
  if (!result?.error || !String(result.error.message ?? "").includes(expectedFragment)) fail(code);
}

async function exactCount(query, code) {
  const result = await query;
  if (result.error || typeof result.count !== "number") fail(code);
  return result.count;
}

function readFeedbackResult(result, code) {
  const data = requireNoError(result, code);
  const row = Array.isArray(data) ? data[0] : data;
  if (
    !row ||
    typeof row.feedback_id !== "string" ||
    typeof row.feedback_status !== "string" ||
    typeof row.replayed !== "boolean"
  ) fail(code);
  return row;
}

function createFixtureIdentity() {
  const runId = randomUUID();
  const suffix = runId.replaceAll("-", "");
  return {
    runId,
    runFingerprint: sha256(runId).slice(0, 16),
    shopId: `pm-feedback-r10-${runId}`,
    foreignShopId: `pm-feedback-r10-foreign-${randomUUID()}`,
    email: `pm-feedback-r10-${suffix}@example.invalid`,
    password: `${randomBytes(24).toString("base64url")}Aa1!`,
    requestIds: Array.from({ length: 7 }, () => randomUUID()),
  };
}

async function preflightSchema(admin, fixture) {
  requireNoError(
    await admin.from("tester_feedback_submissions")
      .select("id")
      .eq("shop_id", fixture.shopId)
      .limit(1),
    "tester_feedback_schema_missing",
  );
  requireNoError(
    await admin.from("owner_pilot_cohort_memberships")
      .select("cohort_position")
      .order("cohort_position", { ascending: true }),
    "pilot_cohort_schema_missing",
  );
  const collisions = await Promise.all([
    exactCount(
      admin.from("shops").select("id", { count: "exact", head: true }).eq("id", fixture.shopId),
      "preflight_collision_check_failed",
    ),
    exactCount(
      admin.from("tester_feedback_submissions").select("id", { count: "exact", head: true }).eq("shop_id", fixture.shopId),
      "preflight_collision_check_failed",
    ),
  ]);
  if (collisions.some((count) => count !== 0)) fail("fixture_marker_collision");

  const positions = requireNoError(
    await admin.from("owner_pilot_cohort_memberships").select("cohort_position"),
    "pilot_cohort_position_read_failed",
  );
  const occupied = new Set(positions.map((row) => Number(row.cohort_position)));
  const cohortPosition = Array.from({ length: 20 }, (_, index) => index + 1).find((position) => !occupied.has(position));
  if (!cohortPosition) fail("pilot_cohort_full");
  return cohortPosition;
}

async function createFixture(admin, fixture, state, cohortPosition) {
  const auth = await admin.auth.admin.createUser({
    email: fixture.email,
    password: fixture.password,
    email_confirm: true,
  });
  if (auth.error || !auth.data.user) fail("auth_fixture_create_failed");
  state.userId = auth.data.user.id;

  requireNoError(await admin.from("shops").insert({
    id: fixture.shopId,
    owner_user_id: state.userId,
    name: "비식별 테스터 피드백 검수 매장",
    phone: "01000000000",
    address: "비식별 검수 주소",
    business_hours: FIXTURE_BUSINESS_HOURS,
    booking_available_start_time: "10:00",
    booking_available_end_time: "19:00",
  }), "shop_fixture_create_failed");
  state.shopCreated = true;

  requireNoError(await admin.from("owner_shop_memberships").insert({
    owner_user_id: state.userId,
    shop_id: fixture.shopId,
    role: "owner",
    is_primary: true,
  }), "membership_fixture_create_failed");
  state.membershipCreated = true;

  const nonPilot = await admin.rpc("submit_tester_feedback_v1", {
    p_owner_user_id: state.userId,
    p_shop_id: fixture.shopId,
    p_request_id: fixture.requestIds[0],
    p_category: "bug",
    p_body: "테스터 등록 전 제출은 저장되지 않아야 합니다.",
    p_screen_key: "schedule",
    p_app_version: FIXTURE_APP_VERSION,
  });
  expectRpcError(nonPilot, "PM_TESTER_FEEDBACK_MEMBER_REQUIRED", "non_pilot_denial_failed");

  requireNoError(await admin.from("owner_pilot_cohort_memberships").insert({
    shop_id: fixture.shopId,
    owner_user_id: state.userId,
    cohort_position: cohortPosition,
    status: "active",
    recognition_state: "not_decided",
    created_by_admin_email: FIXTURE_ADMIN_EMAIL,
  }), "pilot_cohort_fixture_create_failed");
  state.cohortCreated = true;

  const foreignTenant = await admin.rpc("submit_tester_feedback_v1", {
    p_owner_user_id: state.userId,
    p_shop_id: fixture.foreignShopId,
    p_request_id: fixture.requestIds[0],
    p_category: "bug",
    p_body: "다른 매장으로 결속된 제출은 저장되지 않아야 합니다.",
    p_screen_key: "schedule",
    p_app_version: FIXTURE_APP_VERSION,
  });
  expectRpcError(foreignTenant, "PM_TESTER_FEEDBACK_MEMBER_REQUIRED", "tenant_denial_failed");
}

function feedbackParams(state, fixture, requestId, category, body, screenKey) {
  return {
    p_owner_user_id: state.userId,
    p_shop_id: fixture.shopId,
    p_request_id: requestId,
    p_category: category,
    p_body: body,
    p_screen_key: screenKey,
    p_app_version: FIXTURE_APP_VERSION,
  };
}

async function exerciseFeedbackContracts(admin, fixture, state) {
  state.feedbackTouched = true;
  const bugParams = feedbackParams(
    state,
    fixture,
    fixture.requestIds[1],
    "bug",
    "예약 일정 저장 뒤 목록 갱신을 확인하는 비식별 검수 내용입니다.",
    "schedule",
  );
  const bug = readFeedbackResult(await admin.rpc("submit_tester_feedback_v1", bugParams), "bug_submit_failed");
  if (bug.replayed || bug.feedback_status !== "new") fail("bug_submit_result_invalid");

  const replay = readFeedbackResult(await admin.rpc("submit_tester_feedback_v1", bugParams), "exact_replay_failed");
  if (!replay.replayed || replay.feedback_id !== bug.feedback_id) fail("exact_replay_mutated");

  const replayConflict = await admin.rpc("submit_tester_feedback_v1", {
    ...bugParams,
    p_body: "같은 요청 식별자에 다른 본문은 저장되지 않아야 합니다.",
  });
  expectRpcError(replayConflict, "PM_TESTER_FEEDBACK_IDEMPOTENCY_CONFLICT", "replay_conflict_denial_failed");

  const improvementParams = feedbackParams(
    state,
    fixture,
    fixture.requestIds[2],
    "improvement",
    "직원 선택 흐름을 더 간결하게 개선하면 좋겠습니다.",
    "staff",
  );
  const improvement = readFeedbackResult(
    await admin.rpc("submit_tester_feedback_v1", improvementParams),
    "improvement_submit_failed",
  );
  if (improvement.replayed || improvement.feedback_status !== "new") fail("improvement_submit_result_invalid");

  const duplicate = readFeedbackResult(
    await admin.rpc("submit_tester_feedback_v1", { ...improvementParams, p_request_id: fixture.requestIds[3] }),
    "content_duplicate_check_failed",
  );
  if (!duplicate.replayed || duplicate.feedback_id !== improvement.feedback_id) fail("content_duplicate_mutated");

  const fillerBodies = [
    "서비스 목록 첫 화면의 정렬 상태를 확인하는 검수 내용입니다.",
    "매장 설정 저장 결과 안내를 확인하는 비식별 검수 내용입니다.",
    "알림 설정 화면 이동 동작을 확인하는 비식별 검수 내용입니다.",
  ];
  for (let index = 0; index < fillerBodies.length; index += 1) {
    const created = readFeedbackResult(
      await admin.rpc("submit_tester_feedback_v1", feedbackParams(
        state,
        fixture,
        fixture.requestIds[index + 4],
        index === 1 ? "improvement" : "bug",
        fillerBodies[index],
        ["services", "shop_settings", "notifications"][index],
      )),
      "rate_fixture_submit_failed",
    );
    if (created.replayed || created.feedback_status !== "new") fail("rate_fixture_result_invalid");
  }

  const rateLimited = await admin.rpc("submit_tester_feedback_v1", feedbackParams(
    state,
    fixture,
    randomUUID(),
    "bug",
    "시간당 제출 상한을 넘는 요청은 저장되지 않아야 합니다.",
    "home",
  ));
  expectRpcError(rateLimited, "PM_TESTER_FEEDBACK_RATE_LIMIT", "rate_limit_denial_failed");

  state.firstFeedbackId = bug.feedback_id;
  return {
    exactReplayMutationCount: 0,
    contentDuplicateMutationCount: 0,
    nonPilotDenialCount: 1,
    tenantDenialCount: 1,
    rateDenialCount: 1,
  };
}

async function verifyAdminProjection(admin, fixture, state) {
  const rows = requireNoError(
    await admin.from("tester_feedback_submissions")
      .select("id,shop_id,category,body,screen_key,app_version,status,created_at,updated_at,shops(name)")
      .eq("shop_id", fixture.shopId)
      .order("created_at", { ascending: false }),
    "admin_projection_read_failed",
  );
  if (rows.length !== 5) fail("feedback_count_mismatch");
  const forbiddenKeys = ["owner_user_id", "request_id", "request_fingerprint", "content_fingerprint"];
  if (rows.some((row) => forbiddenKeys.some((key) => Object.hasOwn(row, key)))) fail("admin_projection_not_redacted");

  const update = requireNoError(
    await admin.from("tester_feedback_submissions")
      .update({ status: "reviewing", updated_at: new Date().toISOString() })
      .eq("id", state.firstFeedbackId)
      .eq("shop_id", fixture.shopId)
      .select("id,status")
      .single(),
    "admin_status_update_failed",
  );
  if (update.id !== state.firstFeedbackId || update.status !== "reviewing") fail("admin_status_readback_failed");

  const reviewingCount = await exactCount(
    admin.from("tester_feedback_submissions")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", fixture.shopId)
      .eq("status", "reviewing"),
    "admin_status_count_failed",
  );
  if (reviewingCount !== 1) fail("admin_status_count_mismatch");

  return { savedCount: rows.length, adminRedactedCount: rows.length, statusUpdatedCount: reviewingCount };
}

async function cleanupFixture(admin, fixture, state) {
  const failures = [];
  const remove = async (promise) => {
    try {
      const result = await promise;
      if (result?.error) failures.push(true);
    } catch {
      failures.push(true);
    }
  };

  if (state.feedbackTouched && state.userId) {
    await remove(admin.from("tester_feedback_submissions")
      .delete()
      .eq("shop_id", fixture.shopId)
      .eq("owner_user_id", state.userId));
  }
  if (state.cohortCreated && state.userId) {
    await remove(admin.from("owner_pilot_cohort_memberships")
      .delete()
      .eq("shop_id", fixture.shopId)
      .eq("owner_user_id", state.userId));
  }
  if (state.membershipCreated && state.userId) {
    await remove(admin.from("owner_shop_memberships")
      .delete()
      .eq("shop_id", fixture.shopId)
      .eq("owner_user_id", state.userId));
  }
  if (state.shopCreated) {
    await remove(admin.from("shops").delete().eq("id", fixture.shopId));
  }
  if (state.userId) {
    const authDelete = await admin.auth.admin.deleteUser(state.userId);
    if (authDelete.error) failures.push(true);
  }
  if (failures.length) fail("cleanup_failed");
}

async function verifyResidueZero(admin, fixture, state) {
  if (!state.userId) return;
  const counts = await Promise.all([
    exactCount(
      admin.from("tester_feedback_submissions").select("id", { count: "exact", head: true })
        .eq("shop_id", fixture.shopId).eq("owner_user_id", state.userId),
      "residue_check_failed",
    ),
    exactCount(
      admin.from("owner_pilot_cohort_memberships").select("shop_id", { count: "exact", head: true })
        .eq("shop_id", fixture.shopId).eq("owner_user_id", state.userId),
      "residue_check_failed",
    ),
    exactCount(
      admin.from("owner_shop_memberships").select("shop_id", { count: "exact", head: true })
        .eq("shop_id", fixture.shopId).eq("owner_user_id", state.userId),
      "residue_check_failed",
    ),
    exactCount(
      admin.from("shops").select("id", { count: "exact", head: true }).eq("id", fixture.shopId),
      "residue_check_failed",
    ),
  ]);
  if (counts.some((count) => count !== 0)) fail("residue_nonzero");
  const authRead = await admin.auth.admin.getUserById(state.userId);
  if (!authRead.error && authRead.data?.user) fail("auth_residue_nonzero");
}

export async function runDevelopmentTesterFeedbackFixture(envFilePath) {
  const credentials = await consumeOneTimeCredentials(envFilePath);
  const targetProjectRef = assertDevelopmentTarget(credentials.SUPABASE_URL);
  const fixture = createFixtureIdentity();
  const state = {
    userId: null,
    shopCreated: false,
    membershipCreated: false,
    cohortCreated: false,
    feedbackTouched: false,
    firstFeedbackId: null,
  };
  const admin = createClient(credentials.SUPABASE_URL, credentials.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }) },
  });
  let verification = null;
  let failure = null;

  try {
    const cohortPosition = await preflightSchema(admin, fixture);
    await createFixture(admin, fixture, state, cohortPosition);
    const feedback = await exerciseFeedbackContracts(admin, fixture, state);
    const adminProjection = await verifyAdminProjection(admin, fixture, state);
    verification = { ...feedback, ...adminProjection };
  } catch (error) {
    failure = error instanceof FixtureRunnerError ? error : new FixtureRunnerError("fixture_run_failed");
  } finally {
    try {
      await cleanupFixture(admin, fixture, state);
      await verifyResidueZero(admin, fixture, state);
    } catch (cleanupError) {
      failure = cleanupError instanceof FixtureRunnerError ? cleanupError : new FixtureRunnerError("cleanup_failed");
    }
  }

  if (failure) throw failure;
  return {
    status: "passed",
    targetProjectRef,
    runFingerprint: fixture.runFingerprint,
    verification,
    cleanupResidue: 0,
  };
}

async function main() {
  if (process.argv.length !== 3) fail("usage_env_path_only");
  const result = await runDevelopmentTesterFeedbackFixture(process.argv[2]);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    const code = error instanceof FixtureRunnerError ? error.code : "fixture_runner_failed";
    process.stderr.write(`${JSON.stringify({ status: "failed", code })}\n`);
    process.exitCode = 1;
  });
}
