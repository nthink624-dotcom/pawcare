#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

export const EXPECTED_DEVELOPMENT_PROJECT_REF = "qefxdtmdtvnzgupmjlom";
export const EXPECTED_F_URL = "http://127.0.0.1:3100/owner/mobile";
export const RUNNER_ENV_KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
export const TRANSITION_PLAN = Object.freeze([
  Object.freeze({ from: "confirmed", to: "in_progress", action: "바로 시작", nextAction: "픽업 준비" }),
  Object.freeze({ from: "in_progress", to: "almost_done", action: "픽업 준비", nextAction: "미용 완료" }),
  Object.freeze({ from: "almost_done", to: "completed", action: "미용 완료", nextAction: null }),
]);
export const CLEANUP_TABLES = Object.freeze([
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

const SAFE_ACL_SIDS = new Set(["S-1-5-18", "S-1-5-32-544"]); // SYSTEM, Administrators
const STORAGE_KEYS = Object.freeze([
  "petmanager.ownerAuthHandoff",
  "petmanager.ownerAuthTokenCache",
  "petmanager:owner-current-shop",
]);
const STORAGE_KEY_PREFIX = `sb-${EXPECTED_DEVELOPMENT_PROJECT_REF}-auth-token`;
const CDP_TIMEOUT_MS = 10_000;
const TRANSITION_TIMEOUT_MS = 20_000;

export class FixtureRunnerError extends Error {
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
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== `${EXPECTED_DEVELOPMENT_PROJECT_REF}.supabase.co` ||
    parsed.pathname !== "/"
  ) fail("target_project_mismatch");
  return EXPECTED_DEVELOPMENT_PROJECT_REF;
}

export function assertLoopbackCdpUrl(cdpBaseUrl) {
  let parsed;
  try {
    parsed = new URL(cdpBaseUrl);
  } catch {
    fail("cdp_url_invalid");
  }
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    !parsed.port
  ) fail("cdp_not_task_local");
  return parsed.origin;
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

export function advanceRunnerState(current, event) {
  const transitions = {
    created: { capabilities_confirmed: "preflight_ready", abort: "aborted", fail: "failed" },
    preflight_ready: { fixture_created: "fixture_created", abort: "aborted", fail: "failed" },
    fixture_created: { session_bound: "session_bound", restore: "restoring_session", fail: "failed" },
    session_bound: { measure: "measuring", restore: "restoring_session", fail: "failed" },
    measuring: { restore: "restoring_session", fail: "failed" },
    restoring_session: { clean: "cleaning", fail: "failed" },
    cleaning: { residue_verified: "verified", fail: "failed" },
    verified: { finish: "completed" },
  };
  const next = transitions[current]?.[event];
  if (!next) fail("state_transition_invalid");
  return next;
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

async function exactCount(query, code) {
  const result = await query;
  if (result.error || typeof result.count !== "number") fail(code);
  return result.count;
}

function createFixtureIdentity() {
  const runId = randomUUID();
  const suffix = runId.replaceAll("-", "");
  return {
    runFingerprint: sha256(runId).slice(0, 16),
    shopId: `pm-transition-r3-${runId}`,
    guardianId: randomUUID(),
    petId: randomUUID(),
    serviceId: `pm-transition-r3-service-${runId}`,
    appointmentId: randomUUID(),
    statusEventIdHint: randomUUID(),
    userIdHint: randomUUID(),
    marker: `PM-R3-${suffix.slice(0, 10)}`,
    email: `pm-transition-r3-${suffix}@example.invalid`,
    password: `${randomBytes(24).toString("base64url")}Aa1!`,
    phone: `010${String(BigInt(`0x${suffix.slice(0, 12)}`) % 100000000n).padStart(8, "0")}`,
  };
}

function kstAppointmentWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    time: `${read("hour")}:${read("minute")}:00`,
    startAt: new Date(now.getTime() - 60_000).toISOString(),
    endAt: new Date(now.getTime() + 59 * 60_000).toISOString(),
  };
}

class CdpSession {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      let message;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (!message.id || !this.pending.has(message.id)) return;
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new FixtureRunnerError("cdp_command_failed"));
      else pending.resolve(message.result ?? {});
    });
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new FixtureRunnerError("cdp_closed"));
      this.pending.clear();
    });
  }

  static async connect(webSocketDebuggerUrl) {
    const socket = new WebSocket(webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new FixtureRunnerError("cdp_connect_timeout")), CDP_TIMEOUT_MS);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new FixtureRunnerError("cdp_connect_failed")); }, { once: true });
    });
    return new CdpSession(socket);
  }

  async send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new FixtureRunnerError("cdp_command_timeout"));
      }, CDP_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, returnByValue = true) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) fail("runtime_evaluation_failed");
    return result.result?.value;
  }

  close() {
    this.socket.close();
  }
}

async function connectToExactF(cdpBaseUrl) {
  const origin = assertLoopbackCdpUrl(cdpBaseUrl);
  const response = await fetch(`${origin}/json/list`, { signal: AbortSignal.timeout(CDP_TIMEOUT_MS) }).catch(() => null);
  if (!response?.ok) fail("cdp_targets_unavailable");
  const targets = await response.json().catch(() => []);
  const target = targets.find((item) => item?.type === "page" && item?.url === EXPECTED_F_URL);
  if (!target?.webSocketDebuggerUrl) fail("exact_f_target_missing");
  const session = await CdpSession.connect(target.webSocketDebuggerUrl);
  await session.send("Runtime.enable");
  await session.send("Page.enable");
  return session;
}

function storageSnapshotExpression() {
  return `(() => {
    const exact = ${JSON.stringify(STORAGE_KEYS)};
    const prefix = ${JSON.stringify(STORAGE_KEY_PREFIX)};
    const take = (storage) => Object.keys(storage)
      .filter((key) => exact.includes(key) || key === prefix || key.startsWith(prefix + "."))
      .map((key) => [key, storage.getItem(key)]);
    return { local: take(localStorage), session: take(sessionStorage), href: location.href };
  })()`;
}

function restoreStorageExpression(snapshot) {
  return `(() => {
    const exact = ${JSON.stringify(STORAGE_KEYS)};
    const prefix = ${JSON.stringify(STORAGE_KEY_PREFIX)};
    const clear = (storage) => Object.keys(storage)
      .filter((key) => exact.includes(key) || key === prefix || key.startsWith(prefix + "."))
      .forEach((key) => storage.removeItem(key));
    clear(localStorage); clear(sessionStorage);
    for (const [key, value] of ${JSON.stringify(snapshot.local)}) localStorage.setItem(key, value);
    for (const [key, value] of ${JSON.stringify(snapshot.session)}) sessionStorage.setItem(key, value);
    return true;
  })()`;
}

async function verifySessionRestoreCapability(cdp, snapshot) {
  const sentinelKey = `pm-transition-r3-restore-${randomUUID()}`;
  const sentinelValue = randomUUID();
  const result = await cdp.evaluate(`(() => {
    const key = ${JSON.stringify(sentinelKey)};
    const before = sessionStorage.getItem(key);
    sessionStorage.setItem(key, ${JSON.stringify(sentinelValue)});
    const written = sessionStorage.getItem(key) === ${JSON.stringify(sentinelValue)};
    if (before === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, before);
    return written && sessionStorage.getItem(key) === before;
  })()`);
  if (result !== true || snapshot?.href !== EXPECTED_F_URL) fail("session_restore_capability_missing");
}

async function verifyFSelectors(cdp) {
  const ready = await cdp.evaluate(`(() => ({
    exactUrl: location.href === ${JSON.stringify(EXPECTED_F_URL)},
    ownerRoot: Boolean(document.querySelector('[data-testid="reservation-create-fab"]')),
    canClick: typeof HTMLElement.prototype.click === 'function',
    canMeasure: typeof performance.now === 'function'
  }))()`);
  if (!ready?.exactUrl || !ready.ownerRoot || !ready.canClick || !ready.canMeasure) fail("f_capability_missing");
}

async function verifyCleanupAuthority(admin, fixture) {
  const probes = [
    ["notification_delivery_checks", "appointment_id", fixture.appointmentId],
    ["media_send_attempts", "appointment_id", fixture.appointmentId],
    ["notification_media_attachments", "appointment_id", fixture.appointmentId],
    ["appointment_status_event_media", "event_id", fixture.statusEventIdHint],
    ["appointment_status_events", "appointment_id", fixture.appointmentId],
    ["notifications", "appointment_id", fixture.appointmentId],
    ["shop_revenue_entries", "appointment_id", fixture.appointmentId],
    ["grooming_record_drafts", "appointment_id", fixture.appointmentId],
    ["grooming_records", "appointment_id", fixture.appointmentId],
    ["appointment_change_events", "appointment_id", fixture.appointmentId],
    ["appointments", "id", fixture.appointmentId],
    ["services", "id", fixture.serviceId],
    ["pets", "id", fixture.petId],
    ["guardians", "id", fixture.guardianId],
    ["owner_subscriptions", "user_id", fixture.userIdHint],
    ["owner_shop_memberships", "owner_user_id", fixture.userIdHint],
    ["owner_profiles", "user_id", fixture.userIdHint],
    ["shops", "id", fixture.shopId],
  ];
  for (const [table, column, value] of probes) {
    const count = await exactCount(
      admin.from(table).select(column, { count: "exact", head: true }).eq(column, value),
      "cleanup_schema_or_read_missing",
    );
    if (count !== 0) fail("fixture_marker_collision");
    requireNoError(await admin.from(table).delete().eq(column, value), "cleanup_authority_missing");
  }
}

async function createFixture(admin, authClient, fixture, state) {
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 86_400_000).toISOString();
  const appointment = kstAppointmentWindow(now);
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
    name: fixture.marker,
    phone: fixture.phone,
    address: fixture.marker,
    description: "",
    business_hours: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [String(day), { open: "00:00", close: "23:59", enabled: true }])),
    regular_closed_days: [],
    temporary_closed_dates: [],
    concurrent_capacity: 1,
    approval_mode: "auto",
    notification_settings: { enabled: false },
  }), "shop_fixture_create_failed");
  requireNoError(await admin.from("owner_profiles").insert({
    user_id: state.userId,
    shop_id: fixture.shopId,
    login_id: fixture.email,
    name: fixture.marker,
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
  requireNoError(await admin.from("owner_subscriptions").insert({
    user_id: state.userId,
    shop_id: fixture.shopId,
    current_plan_code: "free",
    billing_cycle: "0m",
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEndsAt,
    payment_method_exists: false,
    subscription_status: "trialing",
    cancel_at_period_end: false,
    last_payment_status: "none",
    portone_customer_id: `pm-transition-r3-${state.userId}`,
    featured_plan_code: "free",
    auto_renew_plan_code: "free",
  }), "subscription_fixture_create_failed");
  requireNoError(await admin.from("guardians").insert({
    id: fixture.guardianId,
    shop_id: fixture.shopId,
    name: fixture.marker,
    phone: fixture.phone,
    memo: "",
    notification_settings: { enabled: false, revisit_enabled: false },
  }), "guardian_fixture_create_failed");
  requireNoError(await admin.from("pets").insert({
    id: fixture.petId,
    shop_id: fixture.shopId,
    guardian_id: fixture.guardianId,
    name: fixture.marker,
    breed: "비식별 검수",
    weight: 5,
    notes: "",
    grooming_cycle_weeks: 4,
    avatar_seed: "🐶",
  }), "pet_fixture_create_failed");
  requireNoError(await admin.from("services").insert({
    id: fixture.serviceId,
    shop_id: fixture.shopId,
    name: fixture.marker,
    price: 10000,
    duration_minutes: 60,
    is_active: true,
  }), "service_fixture_create_failed");
  requireNoError(await admin.from("appointments").insert({
    id: fixture.appointmentId,
    shop_id: fixture.shopId,
    guardian_id: fixture.guardianId,
    pet_id: fixture.petId,
    service_id: fixture.serviceId,
    appointment_date: appointment.date,
    appointment_time: appointment.time,
    status: "confirmed",
    memo: "",
    start_at: appointment.startAt,
    end_at: appointment.endAt,
    source: "owner",
  }), "appointment_fixture_create_failed");

  const signIn = await authClient.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
  if (signIn.error || !signIn.data.session) fail("synthetic_session_create_failed");
  state.syntheticSession = signIn.data.session;
}

async function bindSyntheticSession(cdp, fixture, state) {
  const handoff = {
    accessToken: state.syntheticSession.access_token,
    refreshToken: state.syntheticSession.refresh_token,
    expiresAt: state.syntheticSession.expires_at ?? null,
  };
  await cdp.evaluate(`(() => {
    const prefix = ${JSON.stringify(STORAGE_KEY_PREFIX)};
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key === prefix || key.startsWith(prefix + '.') || ${JSON.stringify(STORAGE_KEYS)}.includes(key)) storage.removeItem(key);
      }
    }
    sessionStorage.setItem('petmanager.ownerAuthHandoff', ${JSON.stringify(JSON.stringify(handoff))});
    localStorage.setItem('petmanager:owner-current-shop', ${JSON.stringify(fixture.shopId)});
    location.replace(${JSON.stringify(EXPECTED_F_URL)});
    return true;
  })()`);
  await waitFor(cdp, `Boolean(document.querySelector('[data-testid="reservation-create-fab"]')) && document.body.innerText.includes(${JSON.stringify(fixture.marker)})`, 20_000, state.signal);
}

async function installTimingProbe(cdp) {
  const installed = await cdp.evaluate(`(() => {
    if (window.__pmTransitionR3) return true;
    const state = { transitions: [], active: null };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const input = args[0];
      const init = args[1] || {};
      const method = String(init.method || (input && input.method) || 'GET').toUpperCase();
      let pathname = '';
      try { pathname = new URL(typeof input === 'string' ? input : input.url, location.href).pathname; } catch {}
      const active = state.active;
      if (active && method === 'PATCH' && pathname === '/api/appointments' && active.patchStartedAt === null) {
        active.patchStartedAt = performance.now();
      }
      if (active && method === 'GET' && pathname === '/api/bootstrap' && active.patchResponseAt !== null && active.bootstrapStartedAt === null) {
        active.bootstrapStartedAt = performance.now();
      }
      const response = await originalFetch(...args);
      if (active && method === 'PATCH' && pathname === '/api/appointments' && active.patchResponseAt === null) {
        active.patchResponseAt = performance.now();
        active.patchStatus = response.status;
      }
      if (active && method === 'GET' && pathname === '/api/bootstrap' && active.bootstrapStartedAt !== null && active.bootstrapResponseAt === null) {
        active.bootstrapResponseAt = performance.now();
        active.bootstrapStatus = response.status;
      }
      return response;
    };
    window.__pmTransitionR3 = state;
    return true;
  })()`);
  if (installed !== true) fail("timing_probe_install_failed");
}

async function waitFor(cdp, condition, timeoutMs, signal) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (signal?.aborted) fail("runner_aborted");
    if (await cdp.evaluate(`Boolean(${condition})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fail("f_transition_timeout");
}

function findActionExpression(marker, action) {
  return `(() => {
    const marker = ${JSON.stringify(marker)};
    const action = ${JSON.stringify(action)};
    const buttons = [...document.querySelectorAll('button')].filter((button) => button.textContent.trim() === action && !button.disabled);
    const button = buttons.find((candidate) => {
      let node = candidate;
      for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
        if ((node.textContent || '').includes(marker)) return true;
      }
      return false;
    });
    if (!button) return false;
    window.__pmTransitionR3.active = {
      from: ${JSON.stringify(action)},
      tapAt: performance.now(), patchStartedAt: null, patchResponseAt: null, patchStatus: null,
      bootstrapStartedAt: null, bootstrapResponseAt: null, bootstrapStatus: null, domReadyAt: null
    };
    button.click();
    return true;
  })()`;
}

async function measureTransition(cdp, fixture, step, signal) {
  const clicked = await cdp.evaluate(findActionExpression(fixture.marker, step.action));
  if (clicked !== true) fail("transition_action_missing");
  const nextCondition = step.nextAction
    ? `(() => {
        const action = ${JSON.stringify(step.nextAction)};
        const marker = ${JSON.stringify(fixture.marker)};
        return [...document.querySelectorAll('button')].some((button) => {
          if (button.textContent.trim() !== action) return false;
          let node = button;
          for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
            if ((node.textContent || '').includes(marker)) return true;
          }
          return false;
        });
      })()`
    : `(() => {
        const marker = ${JSON.stringify(fixture.marker)};
        return [...document.querySelectorAll('div')].some((node) => {
          if (!(node.textContent || '').includes(marker)) return false;
          return [...node.querySelectorAll('div')].some((child) => child.textContent.trim() === '완료');
        });
      })()`;
  await waitFor(
    cdp,
    `(() => { const item = window.__pmTransitionR3?.active; return item?.patchStatus >= 200 && item.patchStatus < 300 && item?.bootstrapStatus >= 200 && item.bootstrapStatus < 300 && (${nextCondition}); })()`,
    TRANSITION_TIMEOUT_MS,
    signal,
  );
  const timing = await cdp.evaluate(`(() => {
    const item = window.__pmTransitionR3.active;
    item.domReadyAt = performance.now();
    const result = {
      tapToPatchResponseMs: item.patchResponseAt - item.tapAt,
      patchToBootstrapResponseMs: item.bootstrapResponseAt - item.patchResponseAt,
      bootstrapToDomReadyMs: item.domReadyAt - item.bootstrapResponseAt,
      totalMs: item.domReadyAt - item.tapAt
    };
    window.__pmTransitionR3.transitions.push(result);
    window.__pmTransitionR3.active = null;
    return result;
  })()`);
  if (Object.values(timing ?? {}).some((value) => !Number.isFinite(value) || value < 0)) fail("timing_mark_invalid");
  return timing;
}

async function restoreOriginalSession(cdp, snapshot) {
  await cdp.evaluate(restoreStorageExpression(snapshot));
  await cdp.send("Page.navigate", { url: snapshot.href });
  await new Promise((resolve) => setTimeout(resolve, 500));
  await waitFor(cdp, `location.href === ${JSON.stringify(snapshot.href)}`, CDP_TIMEOUT_MS);
  const restored = await cdp.evaluate(`(() => {
    const now = ${storageSnapshotExpression()};
    return JSON.stringify(now.local) === ${JSON.stringify(JSON.stringify(snapshot.local))}
      && JSON.stringify(now.session) === ${JSON.stringify(JSON.stringify(snapshot.session))};
  })()`);
  if (restored !== true) fail("original_session_restore_failed");
}

async function cleanupFixture(admin, fixture, state) {
  const statusEvents = await admin
    .from("appointment_status_events")
    .select("id")
    .eq("appointment_id", fixture.appointmentId);
  if (statusEvents.error) fail("cleanup_failed");
  state.statusEventIds = (statusEvents.data ?? []).map((row) => row.id).filter(Boolean);
  const steps = [
    ["notification_delivery_checks", "appointment_id", fixture.appointmentId],
    ["media_send_attempts", "appointment_id", fixture.appointmentId],
    ["notification_media_attachments", "appointment_id", fixture.appointmentId],
    ["appointment_status_event_media", "event_id", state.statusEventIds ?? []],
    ["appointment_status_events", "appointment_id", fixture.appointmentId],
    ["notifications", "appointment_id", fixture.appointmentId],
    ["shop_revenue_entries", "appointment_id", fixture.appointmentId],
    ["grooming_record_drafts", "appointment_id", fixture.appointmentId],
    ["grooming_records", "appointment_id", fixture.appointmentId],
    ["appointment_change_events", "appointment_id", fixture.appointmentId],
    ["appointments", "id", fixture.appointmentId],
    ["services", "id", fixture.serviceId],
    ["pets", "id", fixture.petId],
    ["guardians", "id", fixture.guardianId],
    ["owner_subscriptions", "user_id", state.userId],
    ["owner_shop_memberships", "owner_user_id", state.userId],
    ["owner_profiles", "user_id", state.userId],
    ["shops", "id", fixture.shopId],
  ];
  let cleanupFailed = false;
  for (const [table, column, value] of steps) {
    if (!value || (Array.isArray(value) && value.length === 0)) continue;
    const query = Array.isArray(value)
      ? admin.from(table).delete().in(column, value)
      : admin.from(table).delete().eq(column, value);
    const result = await query;
    if (result.error) cleanupFailed = true;
  }
  if (state.userId) {
    const deleted = await admin.auth.admin.deleteUser(state.userId);
    if (deleted.error && !String(deleted.error.message).toLowerCase().includes("not found")) cleanupFailed = true;
  }
  if (cleanupFailed) fail("cleanup_failed");
}

async function verifyResidueZero(admin, fixture, state) {
  const probes = [
    ["notification_delivery_checks", "appointment_id", fixture.appointmentId],
    ["media_send_attempts", "appointment_id", fixture.appointmentId],
    ["notification_media_attachments", "appointment_id", fixture.appointmentId],
    ["appointment_status_events", "appointment_id", fixture.appointmentId],
    ["notifications", "appointment_id", fixture.appointmentId],
    ["shop_revenue_entries", "appointment_id", fixture.appointmentId],
    ["grooming_record_drafts", "appointment_id", fixture.appointmentId],
    ["grooming_records", "appointment_id", fixture.appointmentId],
    ["appointment_change_events", "appointment_id", fixture.appointmentId],
    ["appointments", "id", fixture.appointmentId],
    ["services", "id", fixture.serviceId],
    ["pets", "id", fixture.petId],
    ["guardians", "id", fixture.guardianId],
    ["owner_subscriptions", "user_id", state.userId],
    ["owner_shop_memberships", "owner_user_id", state.userId],
    ["owner_profiles", "user_id", state.userId],
    ["shops", "id", fixture.shopId],
  ];
  for (const [table, column, value] of probes) {
    if (!value) continue;
    if (await exactCount(admin.from(table).select(column, { count: "exact", head: true }).eq(column, value), "residue_check_failed") !== 0) {
      fail("fixture_residue_detected");
    }
  }
  if (state.userId) {
    const auth = await admin.auth.admin.getUserById(state.userId);
    if (!auth.error || auth.data?.user) fail("auth_fixture_residue_detected");
  }
}

export async function runFixture({ envPath, cdpBaseUrl }) {
  const credentials = await consumeOneTimeCredentials(envPath);
  assertDevelopmentTarget(credentials.SUPABASE_URL);
  const admin = createClient(credentials.SUPABASE_URL, credentials.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const authClient = createClient(credentials.SUPABASE_URL, credentials.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  credentials.SUPABASE_SERVICE_ROLE_KEY = "";

  const fixture = createFixtureIdentity();
  const state = { phase: "created", userId: null, syntheticSession: null, signal: null };
  const abortController = new AbortController();
  state.signal = abortController.signal;
  const onInterrupt = () => abortController.abort();
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);
  let cdp;
  let originalSession;
  let sessionRestored = false;
  let fixtureCreated = false;
  let timings = [];
  let primaryError = null;

  try {
    cdp = await connectToExactF(cdpBaseUrl);
    originalSession = await cdp.evaluate(storageSnapshotExpression());
    await verifyFSelectors(cdp);
    await verifySessionRestoreCapability(cdp, originalSession);
    await verifyCleanupAuthority(admin, fixture);
    state.phase = advanceRunnerState(state.phase, "capabilities_confirmed");

    fixtureCreated = true;
    await createFixture(admin, authClient, fixture, state);
    state.phase = advanceRunnerState(state.phase, "fixture_created");
    await bindSyntheticSession(cdp, fixture, state);
    state.phase = advanceRunnerState(state.phase, "session_bound");
    await installTimingProbe(cdp);
    state.phase = advanceRunnerState(state.phase, "measure");
    for (const step of TRANSITION_PLAN) timings.push(await measureTransition(cdp, fixture, step, state.signal));
  } catch (error) {
    primaryError = error;
  } finally {
    if (cdp && originalSession) {
      try {
        state.phase = "restoring_session";
        await restoreOriginalSession(cdp, originalSession);
        sessionRestored = true;
      } catch (error) {
        primaryError ??= error;
      }
    }
    if (fixtureCreated) {
      let cleanupError = null;
      try {
        state.phase = "cleaning";
        await cleanupFixture(admin, fixture, state);
      } catch (error) {
        cleanupError = error;
      }
      try {
        await verifyResidueZero(admin, fixture, state);
        if (!cleanupError) state.phase = "verified";
      } catch (error) {
        cleanupError ??= error;
      }
      primaryError ??= cleanupError;
    }
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onInterrupt);
    cdp?.close();
    state.syntheticSession = null;
  }

  if (primaryError) throw primaryError;
  if (!fixtureCreated || !sessionRestored || timings.length !== TRANSITION_PLAN.length) fail("runner_incomplete");
  state.phase = advanceRunnerState(state.phase, "finish");
  return {
    status: "passed",
    targetProjectRef: EXPECTED_DEVELOPMENT_PROJECT_REF,
    runFingerprint: fixture.runFingerprint,
    phase: state.phase,
    transitions: timings,
    sessionRestored: true,
    cleanupResidue: 0,
    transitionRetries: 0,
    providerCalls: 0,
  };
}

async function main() {
  if (process.argv.length !== 4) fail("usage_invalid");
  const result = await runFixture({ envPath: process.argv[2], cdpBaseUrl: process.argv[3] });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const code = error instanceof FixtureRunnerError ? error.code : "runner_failed";
    process.stderr.write(`${JSON.stringify({ status: "failed", code })}\n`);
    process.exitCode = code === "runner_aborted" ? 130 : 1;
  });
}
