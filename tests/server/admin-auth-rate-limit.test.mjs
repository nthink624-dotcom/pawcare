import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildAdminAuthRateLimitHmac,
  resolveAdminAuthClientAddress,
  safeAdminSecretEqual,
} from "../../src/lib/admin-auth-rate-limit.ts";

const read = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("admin auth rate-limit subjects are action-scoped HMACs", () => {
  const first = buildAdminAuthRateLimitHmac({ secret: "test-secret", action: "login", subject: "identifier", value: " RootAdmin " });
  const same = buildAdminAuthRateLimitHmac({ secret: "test-secret", action: "login", subject: "identifier", value: " RootAdmin " });
  const differentAction = buildAdminAuthRateLimitHmac({ secret: "test-secret", action: "reset", subject: "identifier", value: " RootAdmin " });
  assert.equal(first, same);
  assert.notEqual(first, differentAction);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(safeAdminSecretEqual("same", "same"), true);
  assert.equal(safeAdminSecretEqual("same", "different"), false);
  assert.equal(resolveAdminAuthClientAddress(new Headers()), "local-unknown");
});

test("all admin authentication mutations claim the durable gate before credential work", () => {
  for (const route of [
    "src/app/api/admin/auth/login/route.ts",
    "src/app/api/admin/auth/register/route.ts",
    "src/app/api/admin/auth/reset-password/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /claimAdminAuthRateLimit/);
    assert.match(source, /AdminAuthRateLimitBlockedError/);
    assert.match(source, /status: 429/);
    assert.match(source, /Retry-After/);
    assert.match(source, /AdminAuthRateLimitUnavailableError/);
    assert.match(source, /status: 503/);
  }

  const login = read("src/app/api/admin/auth/login/route.ts");
  assert.ok(login.indexOf("claimAdminAuthRateLimit") < login.indexOf("getAdminAccountByLoginId"));
  const setupMigration = read("supabase/migrations/20260831184626_admin_auth_rate_limit.sql");
  assert.match(setupMigration, /security definer/);
  assert.match(setupMigration, /set search_path = ''/);
  assert.match(setupMigration, /pg_advisory_xact_lock/);
  assert.match(setupMigration, /revoke all on table public\.admin_auth_rate_limit_buckets/);
  assert.match(setupMigration, /grant execute on function public\.claim_admin_auth_rate_limit_v1/);
  assert.doesNotMatch(setupMigration, /login_id|password|setup_key|client_ip/);
});
