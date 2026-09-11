import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  checkPortoneRequestBinding,
  createPortoneRequestBinding,
} from "../../src/lib/auth/owner-identity-binding.ts";

const requestRoutePath = new URL("../../src/app/api/auth/request-verification-code/route.ts", import.meta.url);
const verifyRoutePath = new URL("../../src/app/api/auth/verify-pass/route.ts", import.meta.url);
const signupRoutePath = new URL("../../src/app/api/auth/signup/route.ts", import.meta.url);
const signupValidationPath = new URL("../../src/server/signup-price-guide-validation.ts", import.meta.url);
const identityServerPath = new URL("../../src/server/owner-identity-verification.ts", import.meta.url);
const identityClientPath = new URL("../../src/lib/portone/identity-verification-client.ts", import.meta.url);
const signupFormPath = new URL("../../src/components/auth/signup-form.tsx", import.meta.url);
const signupViewPath = new URL("../../src/components/auth/signup-redesign-view.tsx", import.meta.url);
const migrationPath = new URL("../../supabase/migrations/20260903064102_bind_owner_identity_request_state.sql", import.meta.url);

const requestId = "11111111-2222-4333-8444-555555555555";
const now = Date.parse("2026-09-03T00:00:00.000Z");
const binding = createPortoneRequestBinding({ verificationRequestId: requestId, now });
const requestedRow = {
  id: requestId,
  purpose: "signup",
  verification_method: "portone",
  status: "requested",
  consumed_at: null,
  provider_identity_verification_id: binding.providerIdentityVerificationId,
  provider_request_state_hash: binding.requestStateHash,
  provider_request_expires_at: binding.requestExpiresAt,
};

function check(overrides = {}, inputOverrides = {}) {
  return checkPortoneRequestBinding({
    row: { ...requestedRow, ...overrides },
    verificationRequestId: requestId,
    purpose: "signup",
    identityVerificationId: binding.providerIdentityVerificationId,
    verificationState: binding.requestState,
    allowedStatuses: ["requested"],
    now: now + 1,
    ...inputOverrides,
  });
}

test("server-generated PortOne id and state satisfy provider format and exact binding", () => {
  assert.match(binding.providerIdentityVerificationId, /^[A-Za-z0-9]{1,40}$/);
  assert.equal(binding.requestState.length >= 32, true);
  assert.deepEqual(check(), { ok: true });
});

test("request, purpose, provider id, state, expiry, status, and consumption replay mismatches fail closed", () => {
  assert.equal(check({}, { verificationRequestId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }).ok, false);
  assert.equal(check({}, { purpose: "reset-password" }).ok, false);
  assert.equal(check({}, { identityVerificationId: "pm00000000000000000000000000000000" }).ok, false);
  assert.equal(check({}, { verificationState: `${binding.requestState}x` }).ok, false);
  assert.deepEqual(check({}, { now: Date.parse(binding.requestExpiresAt) }), { ok: false, reason: "expired" });
  assert.deepEqual(check({ status: "verified" }), { ok: false, reason: "already_used" });
  assert.deepEqual(check({ status: "consumed", consumed_at: "2026-09-03T00:00:01.000Z" }), {
    ok: false,
    reason: "already_used",
  });
});

test("completed-token reuse is limited to the same unexpired exact request binding", () => {
  const verifiedRow = { ...requestedRow, status: "verified" };
  const accepted = checkPortoneRequestBinding({
    row: verifiedRow,
    verificationRequestId: requestId,
    purpose: "signup",
    identityVerificationId: binding.providerIdentityVerificationId,
    verificationState: binding.requestState,
    allowedStatuses: ["verified"],
    now: now + 1,
  });
  assert.deepEqual(accepted, { ok: true });
  assert.equal(checkPortoneRequestBinding({
    row: verifiedRow,
    verificationRequestId: requestId,
    purpose: "signup",
    identityVerificationId: binding.providerIdentityVerificationId,
    verificationState: "wrong-state-that-is-deliberately-long-enough-for-validation",
    allowedStatuses: ["verified"],
    now: now + 1,
  }).ok, false);
});

test("verify-pass validates the stored binding before any PortOne lookup and passes it to complete/reuse", async () => {
  const [route, server] = await Promise.all([
    readFile(verifyRoutePath, "utf8"),
    readFile(identityServerPath, "utf8"),
  ]);
  assert.ok(route.indexOf("validatePortoneIdentityVerificationBinding") < route.indexOf("fetchPortoneIdentityVerification(payload.identityVerificationId)"));
  assert.match(route, /verificationState: z\.string\(\)\.min\(PORTONE_REQUEST_STATE_MIN_LENGTH\)\.max\(PORTONE_REQUEST_STATE_MAX_LENGTH\)/);
  assert.match(route, /reuseCompletedPortoneIdentityVerification\(\{[\s\S]*verificationRequestId: payload\.verificationRequestId[\s\S]*verificationState: payload\.verificationState/);
  assert.match(server, /allowedStatuses: \["requested"\]/);
  assert.match(server, /allowedStatuses: \["verified"\]/);
  assert.match(server, /\.eq\("id", row!\.id\)[\s\S]*\.eq\("provider_request_state_hash", row!\.provider_request_state_hash!\)[\s\S]*\.eq\("verification_token_id", row!\.verification_token_id\)[\s\S]*\.is\("consumed_at", null\)/);
});

test("request route returns only the server-created provider id and plaintext state while storage keeps its hash", async () => {
  const [route, server, migration] = await Promise.all([
    readFile(requestRoutePath, "utf8"),
    readFile(identityServerPath, "utf8"),
    readFile(migrationPath, "utf8"),
  ]);
  assert.match(route, /providerIdentityVerificationId: result\.providerIdentityVerificationId/);
  assert.match(route, /verificationState: result\.verificationState/);
  assert.match(server, /provider_request_state_hash: binding\.requestStateHash/);
  assert.doesNotMatch(server, /provider_request_state:\s*binding\.requestState/);
  assert.match(migration, /provider_request_state_hash text/);
  assert.match(migration, /provider_request_expires_at timestamptz/);
  assert.match(migration, /provider_request_binding_migration_invalidated[\s\S]*status in \('requested', 'verified'\)/);
  assert.match(migration, /validate constraint owner_identity_verifications_portone_request_binding_check/);
});

test("signup uses bounded SDK and API waits with Korean recovery copy and never invents a provider id", async () => {
  const [client, form] = await Promise.all([
    readFile(identityClientPath, "utf8"),
    readFile(signupFormPath, "utf8"),
  ]);
  const start = form.slice(form.indexOf("const startKcpVerification"), form.indexOf("const submitSignup"));
  assert.match(client, /PORTONE_IDENTITY_UI_TIMEOUT_MS = 120_000/);
  assert.match(client, /IDENTITY_API_TIMEOUT_MS = 10_000/);
  assert.match(client, /new DOMException\("본인인증 시간이 길어 요청을 중단했어요\.", "TimeoutError"\)/);
  assert.match(start, /fetchIdentityApi\("\/api\/auth\/request-verification-code"/);
  assert.match(start, /identityVerificationId: requestResult\.providerIdentityVerificationId/);
  assert.match(start, /verificationState: requestResult\.verificationState/);
  assert.match(start, /본인인증 확인 시간이 길어 요청을 중단했어요\. 창을 닫고 다시 시도해 주세요\./);
  assert.doesNotMatch(start, /Date\.now\(\)|Math\.random\(\)/);
});

test("signup accepts and stores only the current server legal version", async () => {
  const [route, validation] = await Promise.all([
    readFile(signupRoutePath, "utf8"),
    readFile(signupValidationPath, "utf8"),
  ]);
  assert.match(validation, /termsVersion: z\.literal\(OWNER_SIGNUP_TERMS_VERSION\)/);
  assert.match(route, /terms_version: OWNER_SIGNUP_TERMS_VERSION/);
  assert.doesNotMatch(route + validation, /terms_version: payload\.termsVersion|termsVersion: z\.string\(\)\.optional/);
});

test("consent rows and policy links expose 44px targets without shrinking Korean type", async () => {
  const view = await readFile(signupViewPath, "utf8");
  assert.match(view, /htmlFor="all-terms" className="flex min-h-11/);
  assert.match(view, /htmlFor=\{term\.id\} className="flex min-h-11/);
  assert.match(view, /className="inline-flex min-h-11 min-w-11[^"]*text-\[13px\] font-medium leading-5/);
  assert.match(view, /marketing: "\/marketing-consent"/);
  assert.doesNotMatch(view, /marketing: "\/privacy"/);
  assert.match(view, /target=\{term\.id === "marketing" \? "_blank" : undefined\}/);
  assert.doesNotMatch(view, /font-(?:bold|extrabold|black)|font-\[(?:[7-9]00)\]/);
});
