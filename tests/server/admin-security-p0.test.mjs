import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ADMIN_AUTH_RATE_LIMIT,
  assertAdminAuthAttemptAllowed,
  buildAdminAuthAttemptKey,
  clearAdminAuthFailures,
  recordAdminAuthFailure,
  resetAdminAuthRateLimitForTests,
} from "../../src/lib/admin-auth-rate-limit.ts";

const read = (relativePath) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("admin authentication blocks the sixth failed attempt and can recover", () => {
  resetAdminAuthRateLimitForTests();
  const key = buildAdminAuthAttemptKey({
    action: "login",
    loginId: "RootAdmin",
    clientAddress: "127.0.0.1",
  });
  const sameKey = buildAdminAuthAttemptKey({
    action: "login",
    loginId: " rootadmin ",
    clientAddress: "127.0.0.1",
  });
  assert.equal(key, sameKey);

  for (let index = 0; index < ADMIN_AUTH_RATE_LIMIT.maxFailures; index += 1) {
    assert.doesNotThrow(() => assertAdminAuthAttemptAllowed(key, 1_000));
    recordAdminAuthFailure(key, 1_000);
  }

  assert.throws(
    () => assertAdminAuthAttemptAllowed(key, 1_001),
    (error) => error instanceof Error && error.retryAfterSeconds > 0,
  );
  clearAdminAuthFailures(key);
  assert.doesNotThrow(() => assertAdminAuthAttemptAllowed(key, 1_001));
});

test("login and reset endpoints enforce the shared attempt limiter", () => {
  for (const route of [
    "src/app/api/admin/auth/login/route.ts",
    "src/app/api/admin/auth/reset-password/route.ts",
    "src/app/api/admin/auth/register/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /assertAdminAuthAttemptAllowed/);
    assert.match(source, /recordAdminAuthFailure/);
    assert.match(source, /clearAdminAuthFailures/);
    assert.match(source, /status: 429/);
    assert.match(source, /Retry-After/);
  }
});

test("every local high-risk mutation requires a super admin", () => {
  const routes = [
    "src/app/api/admin/owners/route.ts",
    "src/app/api/admin/owners/refund/route.ts",
    "src/app/api/admin/owners/withdraw/route.ts",
    "src/app/api/admin/owners/temporary-password/route.ts",
    "src/app/api/admin/owners/payment-method/reset/route.ts",
    "src/app/api/admin/alimtalk/credits/route.ts",
  ];

  for (const route of routes) {
    assert.match(read(route), /requireSuperAdminSession/);
  }

  const auth = read("src/server/admin-api-auth.ts");
  assert.match(auth, /if \(!account\.isSuperAdmin\)/);
  assert.match(auth, /throw new AdminApiError\([^]*403\)/);
});

test("credential reset is fail-closed and cannot mutate Auth without an atomic audit", () => {
  const source = read("src/app/api/admin/owners/temporary-password/route.ts");
  assert.ok(source.indexOf("requireSuperAdminSession") < source.indexOf("원자적 감사 절차"));
  assert.doesNotMatch(source, /updateUserById|randomBytes|temporaryPassword|owner_admin_events/);
  assert.match(source, /status: error\.status/);

  const panel = read("src/components/admin/owner-admin-password-panel.tsx");
  const screen = read("src/components/admin/owner-admin-screen.tsx");
  assert.doesNotMatch(panel, /temporaryPassword|clipboard|onIssue|임시비밀번호 발급<\/button>/);
  assert.doesNotMatch(screen, /issueOwnerTemporaryPassword|temporaryPasswords/);
  assert.match(panel, /원자적 감사와 추가 인증 절차/);
});

test("setup secrets use constant-time comparison", () => {
  for (const route of [
    "src/app/api/admin/auth/reset-password/route.ts",
    "src/app/api/admin/auth/register/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /safeAdminSecretEqual/);
    assert.doesNotMatch(source, /setupKey\s*!==\s*adminSetupKey/);
  }
});
