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
export const FIXTURE_BUSINESS_HOURS = Object.freeze(Object.fromEntries(
  Array.from({ length: 7 }, (_, weekday) => [
    String(weekday),
    Object.freeze({ open: "10:00", close: "19:00", enabled: true }),
  ]),
));
const SAFE_ACL_SIDS = new Set(["S-1-5-18", "S-1-5-32-544"]); // SYSTEM, Administrators

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

export function buildFixtureEventKey(eventName, evidence) {
  return `${eventName}:${sha256(evidence)}`;
}

export function formatKstDate(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return `${read("year")}-${read("month")}-${read("day")}`;
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

function requireStatus(result, expected, code) {
  const data = requireNoError(result, code);
  if (data?.status !== expected) fail(code);
  return data;
}

async function exactCount(query, code) {
  const result = await query;
  if (result.error || typeof result.count !== "number") fail(code);
  return result.count;
}

function createFixtureIdentity() {
  const runId = randomUUID();
  const suffix = runId.replaceAll("-", "");
  const userIdHint = randomUUID();
  return {
    runId,
    runFingerprint: sha256(runId).slice(0, 16),
    acquisitionId: randomUUID(),
    signupRequestId: randomUUID(),
    shopId: `pm-acq-r9-${runId}`,
    guardianId: randomUUID(),
    petId: randomUUID(),
    serviceId: `pm-acq-r9-service-${runId}`,
    appointmentId: randomUUID(),
    ownerRequestId: randomUUID(),
    email: `pm-acq-r9-${suffix}@example.invalid`,
    password: `${randomBytes(24).toString("base64url")}Aa1!`,
    phone: `010${String(BigInt(`0x${suffix.slice(0, 12)}`) % 100000000n).padStart(8, "0")}`,
    userIdHint,
  };
}

async function preflightSchema(admin, fixture) {
  requireNoError(
    await admin.from("marketing_acquisitions").select("acquisition_id").eq("acquisition_id", fixture.acquisitionId).limit(1),
    "first_touch_schema_missing",
  );
  requireNoError(
    await admin.from("appointments")
      .select("id,purpose,created_by_owner_user_id,owner_request_id,marketing_acquisition_id")
      .eq("id", fixture.appointmentId)
      .limit(1),
    "readiness_schema_missing",
  );
  requireNoError(
    await admin.from("owner_operational_activity_events").select("event_id").eq("event_id", fixture.acquisitionId).limit(1),
    "activity_schema_missing",
  );
  const emptyChecks = [
    exactCount(admin.from("marketing_acquisitions").select("acquisition_id", { count: "exact", head: true }).eq("acquisition_id", fixture.acquisitionId), "preflight_collision_check_failed"),
    exactCount(admin.from("signup_idempotency_requests").select("signup_request_id", { count: "exact", head: true }).eq("signup_request_id", fixture.signupRequestId), "preflight_collision_check_failed"),
    exactCount(admin.from("shops").select("id", { count: "exact", head: true }).eq("id", fixture.shopId), "preflight_collision_check_failed"),
    exactCount(admin.from("appointments").select("id", { count: "exact", head: true }).eq("id", fixture.appointmentId), "preflight_collision_check_failed"),
  ];
  if ((await Promise.all(emptyChecks)).some((count) => count !== 0)) fail("fixture_marker_collision");

  // A no-op exact-marker delete proves cleanup authority before any fixture is
  // written. Random task identifiers were proven absent immediately above.
  for (const deletion of [
    admin.from("owner_operational_activity_events").delete().eq("event_id", fixture.acquisitionId),
    admin.from("marketing_acquisition_events").delete().eq("acquisition_id", fixture.acquisitionId),
    admin.from("marketing_acquisition_bindings").delete().eq("acquisition_id", fixture.acquisitionId),
    admin.from("marketing_acquisitions").delete().eq("acquisition_id", fixture.acquisitionId),
    admin.from("signup_idempotency_requests").delete().eq("signup_request_id", fixture.signupRequestId),
    admin.from("appointments").delete().eq("id", fixture.appointmentId),
    admin.from("services").delete().eq("id", fixture.serviceId),
    admin.from("pets").delete().eq("id", fixture.petId),
    admin.from("guardians").delete().eq("id", fixture.guardianId),
    admin.from("owner_shop_memberships").delete().eq("owner_user_id", fixture.userIdHint),
    admin.from("owner_profiles").delete().eq("user_id", fixture.userIdHint),
    admin.from("shops").delete().eq("id", fixture.shopId),
  ]) {
    requireNoError(await deletion, "cleanup_authority_missing");
  }
}

async function createFixture(admin, fixture, state) {
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
    name: "비식별 유입 검수 매장",
    phone: fixture.phone,
    address: "비식별 검수 주소",
    business_hours: FIXTURE_BUSINESS_HOURS,
    booking_available_start_time: "10:00",
    booking_available_end_time: "19:00",
  }), "shop_fixture_create_failed");
  requireNoError(await admin.from("owner_profiles").insert({
    user_id: state.userId,
    shop_id: fixture.shopId,
    login_id: fixture.email,
    name: "비식별 검수 대표",
    birth_date: "19900101",
    phone_number: fixture.phone,
    agreements: {},
  }), "profile_fixture_create_failed");
  requireNoError(await admin.from("owner_shop_memberships").insert({
    owner_user_id: state.userId,
    shop_id: fixture.shopId,
    role: "owner",
    is_primary: true,
  }), "membership_fixture_create_failed");
  requireNoError(await admin.from("signup_idempotency_requests").insert({
    signup_request_id: fixture.signupRequestId,
    payload_hash: sha256(`fixture:${fixture.runId}`),
    status: "completed",
    auth_user_id: state.userId,
    shop_id: fixture.shopId,
  }), "signup_fixture_create_failed");

  requireStatus(await admin.rpc("record_marketing_acquisition_touch_v1", {
    p_acquisition_id: fixture.acquisitionId,
    p_source_kind: "direct",
    p_utm_source: null,
    p_utm_medium: null,
    p_utm_campaign: null,
    p_utm_content: null,
    p_utm_term: null,
    p_event_name: "landing_view",
    p_event_key: "landing_view",
    p_cta_id: null,
  }), "recorded", "first_touch_record_failed");
  requireStatus(await admin.rpc("record_marketing_acquisition_touch_v1", {
    p_acquisition_id: fixture.acquisitionId,
    p_source_kind: "direct",
    p_utm_source: null,
    p_utm_medium: null,
    p_utm_campaign: null,
    p_utm_content: null,
    p_utm_term: null,
    p_event_name: "landing_view",
    p_event_key: "landing_view",
    p_cta_id: null,
  }), "duplicate", "first_touch_replay_failed");

  const t0 = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const signupKey = buildFixtureEventKey("signup_completed", fixture.signupRequestId);
  requireNoError(await admin.from("marketing_acquisition_bindings").insert({
    acquisition_id: fixture.acquisitionId,
    signup_request_id: fixture.signupRequestId,
    owner_user_id: state.userId,
    shop_id: fixture.shopId,
  }), "signup_binding_fixture_failed");
  requireNoError(await admin.from("marketing_acquisition_events").insert({
    acquisition_id: fixture.acquisitionId,
    shop_id: fixture.shopId,
    event_name: "signup_completed",
    event_key: signupKey,
    occurred_at: t0.toISOString(),
  }), "signup_event_fixture_failed");

  for (const stepKey of ["operating_hours", "staff_hours", "services"]) {
    const eventKey = buildFixtureEventKey("setup_step_completed", `${fixture.runId}:${stepKey}`);
    requireStatus(await admin.rpc("record_bound_marketing_acquisition_milestone_v1", {
      p_owner_user_id: state.userId,
      p_shop_id: fixture.shopId,
      p_event_name: "setup_step_completed",
      p_event_key: eventKey,
      p_step_key: stepKey,
      p_booking_source: null,
      p_plan_code: null,
      p_days_from_signup: null,
      p_activation_rule_version: null,
    }), "recorded", "setup_milestone_failed");
  }

  const paidKey = buildFixtureEventKey("paid_conversion", `${fixture.runId}:paid`);
  requireStatus(await admin.rpc("record_bound_marketing_acquisition_milestone_v1", {
    p_owner_user_id: state.userId,
    p_shop_id: fixture.shopId,
    p_event_name: "paid_conversion",
    p_event_key: paidKey,
    p_step_key: null,
    p_booking_source: null,
    p_plan_code: "fixture_no_provider",
    p_days_from_signup: null,
    p_activation_rule_version: null,
  }), "recorded", "paid_milestone_failed");

  requireNoError(await admin.from("guardians").insert({
    id: fixture.guardianId,
    shop_id: fixture.shopId,
    name: "비식별 보호자",
    phone: fixture.phone,
    memo: "",
  }), "guardian_fixture_create_failed");
  requireNoError(await admin.from("pets").insert({
    id: fixture.petId,
    shop_id: fixture.shopId,
    guardian_id: fixture.guardianId,
    name: "비식별 반려동물",
    breed: "검수",
    notes: "",
  }), "pet_fixture_create_failed");
  requireNoError(await admin.from("services").insert({
    id: fixture.serviceId,
    shop_id: fixture.shopId,
    name: "비식별 검수 서비스",
    price: 10000,
    duration_minutes: 60,
  }), "service_fixture_create_failed");

  requireNoError(await admin.from("appointments").insert({
    id: fixture.appointmentId,
    shop_id: fixture.shopId,
    guardian_id: fixture.guardianId,
    pet_id: fixture.petId,
    service_id: fixture.serviceId,
    appointment_date: "2099-01-01",
    appointment_time: "10:00",
    status: "confirmed",
    memo: "비식별 초기설정 테스트 예약",
    start_at: "2099-01-01T10:00:00+09:00",
    end_at: "2099-01-01T11:00:00+09:00",
    source: "owner",
    purpose: "owner_readiness_test",
    created_by_owner_user_id: state.userId,
    owner_request_id: fixture.ownerRequestId,
  }), "readiness_booking_create_failed");
  const appointment = requireNoError(await admin.from("appointments")
    .select("id,shop_id,purpose,created_by_owner_user_id,owner_request_id,marketing_acquisition_id")
    .eq("id", fixture.appointmentId)
    .eq("shop_id", fixture.shopId)
    .eq("created_by_owner_user_id", state.userId)
    .eq("owner_request_id", fixture.ownerRequestId)
    .single(), "readiness_booking_readback_failed");
  if (appointment?.purpose !== "owner_readiness_test" || appointment.marketing_acquisition_id !== fixture.acquisitionId) {
    fail("readiness_booking_binding_mismatch");
  }

  const testBookingKey = buildFixtureEventKey("test_booking_created", fixture.appointmentId);
  const testBookingParams = {
    p_owner_user_id: state.userId,
    p_shop_id: fixture.shopId,
    p_event_name: "test_booking_created",
    p_event_key: testBookingKey,
    p_step_key: null,
    p_booking_source: "owner",
    p_plan_code: null,
    p_days_from_signup: null,
    p_activation_rule_version: null,
  };
  requireStatus(await admin.rpc("record_bound_marketing_acquisition_milestone_v1", testBookingParams), "recorded", "test_booking_event_failed");
  requireStatus(await admin.rpc("record_bound_marketing_acquisition_milestone_v1", testBookingParams), "duplicate", "test_booking_replay_failed");

  const day1 = new Date(t0.getTime() + 24 * 60 * 60 * 1000);
  requireNoError(await admin.from("owner_operational_activity_events").insert({
    acquisition_id: fixture.acquisitionId,
    owner_user_id: state.userId,
    shop_id: fixture.shopId,
    activity_source: "operating_hours",
    request_key: sha256(`operating_hours:${fixture.runId}:day1`),
    activity_date_kst: formatKstDate(day1),
    occurred_at: day1.toISOString(),
  }), "activity_day1_fixture_failed");

  const secondActivityParams = {
    p_owner_user_id: state.userId,
    p_shop_id: fixture.shopId,
    p_activity_source: "services",
    p_request_key: sha256(`services:${fixture.runId}:day2`),
  };
  requireStatus(await admin.rpc("record_owner_operational_activity_v1", secondActivityParams), "recorded", "activity_day2_failed");
  requireStatus(await admin.rpc("record_owner_operational_activity_v1", secondActivityParams), "duplicate", "activity_replay_failed");

  const day7Key = buildFixtureEventKey("activated_day_7", `${fixture.shopId}:day7_v1`);
  const day7Params = {
    p_owner_user_id: state.userId,
    p_shop_id: fixture.shopId,
    p_rule_version: "day7_v1",
    p_event_key: day7Key,
  };
  requireStatus(await admin.rpc("evaluate_marketing_day7_activation_v1", day7Params), "recorded", "day7_evaluation_failed");
  requireStatus(await admin.rpc("evaluate_marketing_day7_activation_v1", day7Params), "duplicate", "day7_replay_failed");

  const tenantDenial = await admin.rpc("record_owner_operational_activity_v1", {
    p_owner_user_id: state.userId,
    p_shop_id: `pm-acq-r9-foreign-${randomUUID()}`,
    p_activity_source: "services",
    p_request_key: sha256(`foreign:${fixture.runId}`),
  });
  if (!tenantDenial.error) fail("tenant_denial_failed");
}

async function verifyFixture(admin, fixture, state) {
  const eventCount = await exactCount(
    admin.from("marketing_acquisition_events").select("event_id", { count: "exact", head: true }).eq("acquisition_id", fixture.acquisitionId),
    "event_count_failed",
  );
  const setupCount = await exactCount(
    admin.from("marketing_acquisition_events").select("event_id", { count: "exact", head: true })
      .eq("acquisition_id", fixture.acquisitionId).eq("event_name", "setup_step_completed"),
    "setup_count_failed",
  );
  const activityCount = await exactCount(
    admin.from("owner_operational_activity_events").select("event_id", { count: "exact", head: true })
      .eq("owner_user_id", state.userId).eq("shop_id", fixture.shopId),
    "activity_count_failed",
  );
  const activityDates = requireNoError(await admin.from("owner_operational_activity_events")
    .select("activity_date_kst")
    .eq("owner_user_id", state.userId)
    .eq("shop_id", fixture.shopId), "activity_dates_failed");
  if (eventCount !== 8 || setupCount !== 3 || activityCount !== 2 || new Set(activityDates.map((row) => row.activity_date_kst)).size !== 2) {
    fail("fixture_count_mismatch");
  }
  return { eventCount, setupCount, activityCount, distinctKstDays: 2 };
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
  if (state.userId) {
    await remove(admin.from("owner_operational_activity_events").delete().eq("owner_user_id", state.userId).eq("shop_id", fixture.shopId));
  }
  await remove(admin.from("appointments").delete().eq("id", fixture.appointmentId).eq("shop_id", fixture.shopId));
  await remove(admin.from("services").delete().eq("id", fixture.serviceId).eq("shop_id", fixture.shopId));
  await remove(admin.from("pets").delete().eq("id", fixture.petId).eq("shop_id", fixture.shopId));
  await remove(admin.from("guardians").delete().eq("id", fixture.guardianId).eq("shop_id", fixture.shopId));
  await remove(admin.from("marketing_acquisition_events").delete().eq("acquisition_id", fixture.acquisitionId));
  await remove(admin.from("marketing_acquisition_bindings").delete().eq("acquisition_id", fixture.acquisitionId).eq("shop_id", fixture.shopId));
  await remove(admin.from("marketing_acquisitions").delete().eq("acquisition_id", fixture.acquisitionId));
  await remove(admin.from("signup_idempotency_requests").delete().eq("signup_request_id", fixture.signupRequestId).eq("shop_id", fixture.shopId));
  if (state.userId) {
    await remove(admin.from("owner_shop_memberships").delete().eq("owner_user_id", state.userId).eq("shop_id", fixture.shopId));
    await remove(admin.from("owner_profiles").delete().eq("user_id", state.userId).eq("shop_id", fixture.shopId));
  }
  await remove(admin.from("shops").delete().eq("id", fixture.shopId));
  if (state.userId) {
    const authDelete = await admin.auth.admin.deleteUser(state.userId);
    if (authDelete.error) failures.push(true);
  }
  if (failures.length) fail("cleanup_failed");
}

async function verifyResidueZero(admin, fixture, state) {
  const checks = [
    exactCount(admin.from("marketing_acquisitions").select("acquisition_id", { count: "exact", head: true }).eq("acquisition_id", fixture.acquisitionId), "residue_check_failed"),
    exactCount(admin.from("marketing_acquisition_events").select("event_id", { count: "exact", head: true }).eq("acquisition_id", fixture.acquisitionId), "residue_check_failed"),
    exactCount(admin.from("marketing_acquisition_bindings").select("acquisition_id", { count: "exact", head: true }).eq("acquisition_id", fixture.acquisitionId), "residue_check_failed"),
    exactCount(admin.from("signup_idempotency_requests").select("signup_request_id", { count: "exact", head: true }).eq("signup_request_id", fixture.signupRequestId).eq("shop_id", fixture.shopId), "residue_check_failed"),
    exactCount(admin.from("appointments").select("id", { count: "exact", head: true }).eq("id", fixture.appointmentId).eq("shop_id", fixture.shopId), "residue_check_failed"),
    exactCount(admin.from("services").select("id", { count: "exact", head: true }).eq("id", fixture.serviceId).eq("shop_id", fixture.shopId), "residue_check_failed"),
    exactCount(admin.from("pets").select("id", { count: "exact", head: true }).eq("id", fixture.petId).eq("shop_id", fixture.shopId), "residue_check_failed"),
    exactCount(admin.from("guardians").select("id", { count: "exact", head: true }).eq("id", fixture.guardianId).eq("shop_id", fixture.shopId), "residue_check_failed"),
    exactCount(admin.from("shops").select("id", { count: "exact", head: true }).eq("id", fixture.shopId), "residue_check_failed"),
  ];
  if (state.userId) {
    checks.push(exactCount(admin.from("owner_operational_activity_events").select("event_id", { count: "exact", head: true }).eq("owner_user_id", state.userId).eq("shop_id", fixture.shopId), "residue_check_failed"));
    checks.push(exactCount(admin.from("owner_shop_memberships").select("owner_user_id", { count: "exact", head: true }).eq("owner_user_id", state.userId).eq("shop_id", fixture.shopId), "residue_check_failed"));
    checks.push(exactCount(admin.from("owner_profiles").select("user_id", { count: "exact", head: true }).eq("user_id", state.userId).eq("shop_id", fixture.shopId), "residue_check_failed"));
  }
  const counts = await Promise.all(checks);
  if (counts.some((count) => count !== 0)) fail("residue_nonzero");
  if (state.userId) {
    const authRead = await admin.auth.admin.getUserById(state.userId);
    if (!authRead.error && authRead.data?.user) fail("auth_residue_nonzero");
  }
}

export async function runDevelopmentFixture(envFilePath) {
  const credentials = await consumeOneTimeCredentials(envFilePath);
  const targetProjectRef = assertDevelopmentTarget(credentials.SUPABASE_URL);
  const fixture = createFixtureIdentity();
  const state = { userId: null };
  const admin = createClient(credentials.SUPABASE_URL, credentials.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }) },
  });
  let verification = null;
  let failure = null;
  try {
    await preflightSchema(admin, fixture);
    await createFixture(admin, fixture, state);
    verification = await verifyFixture(admin, fixture, state);
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
  const result = await runDevelopmentFixture(process.argv[2]);
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
