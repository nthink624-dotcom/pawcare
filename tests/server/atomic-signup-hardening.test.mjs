import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260829023403_harden_atomic_owner_signup.sql", import.meta.url),
  "utf8",
);
const route = readFileSync(new URL("../../src/app/api/auth/signup/route.ts", import.meta.url), "utf8");
const rollback = readFileSync(
  new URL("../../supabase/rollback/20260829023403_harden_atomic_owner_signup.rollback.sql", import.meta.url),
  "utf8",
);

test("privileged v5 implementations are non-exposed and fixed-search-path", () => {
  assert.match(migration, /create schema if not exists pm_signup_private/);
  assert.equal((migration.match(/security definer\s+set search_path = ''/g) ?? []).length, 3);
  assert.equal((migration.match(/security invoker set search_path = ''/g) ?? []).length, 3);
  assert.match(migration, /revoke all on schema pm_signup_private from public, anon, authenticated/);
  assert.match(migration, /revoke all on all functions in schema pm_signup_private from public, anon, authenticated/);
});

test("only service_role can execute the exact v5 entry points", () => {
  for (const name of ["claim_owner_signup_v5", "mark_owner_signup_auth_created_v5", "complete_owner_signup_v5"]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\(`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\(`));
  }
  assert.doesNotMatch(migration, /grant execute[^;]+to\s+(?:public|anon|authenticated)/i);
});

test("v5 verifies Auth identity and refuses legacy fragments", () => {
  assert.match(migration, /from auth\.users where id = p_auth_user_id/);
  assert.match(migration, /v_auth_email <> v_email/);
  assert.match(migration, /PM_SIGNUP_AUTH_IDENTITY_MISMATCH/);
  assert.match(migration, /PM_SIGNUP_EXISTING_PARTIAL_DATA/);
  assert.match(migration, /public\.shops where owner_user_id = p_auth_user_id or id = v_shop_id/);
  assert.match(migration, /public\.owner_profiles where user_id = p_auth_user_id or login_id = v_email/);
  assert.match(migration, /public\.owner_shop_memberships where owner_user_id = p_auth_user_id/);
  assert.match(migration, /public\.owner_subscriptions where user_id = p_auth_user_id/);
});

test("stale and compensated request states have explicit retry behavior", () => {
  assert.match(migration, /status = 'failed_compensated'[\s\S]+set status = 'claimed'/);
  assert.match(migration, /STALE_CLAIM_REQUIRES_AUTH_RECONCILIATION/);
  assert.match(migration, /STALE_AUTH_CREATED_REQUIRES_RECONCILIATION/);
  assert.match(migration, /status = 'compensation_pending'/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('owner-signup:'/);
});

test("route fails closed on v5 availability before creating Auth and tags reconciliation metadata", () => {
  const claimIndex = route.indexOf('rpc("claim_owner_signup_v5"');
  const authIndex = route.indexOf("auth.admin.createUser");
  assert.ok(claimIndex >= 0 && authIndex > claimIndex);
  assert.match(route, /ATOMIC_SIGNUP_MIGRATION_REQUIRED/);
  assert.match(route, /signup_request_id: payload\.signupRequestId/);
  assert.match(route, /rpc\("mark_owner_signup_auth_created_v5"/);
  assert.match(route, /rpc\("complete_owner_signup_v5"/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/);
});

test("v5 rollback preserves prior data contract and blocks unsafe removal", () => {
  assert.match(rollback, /^begin;/m);
  assert.match(rollback, /^commit;/m);
  assert.match(rollback, /PM_SIGNUP_V5_ROLLBACK_BLOCKED_ACTIVE_REQUESTS/);
  assert.match(rollback, /status in \('claimed', 'auth_created'\)/);
  assert.match(rollback, /PM_SIGNUP_V5_ROLLBACK_BLOCKED_UNEXPECTED_SCHEMA_OBJECTS/);
  assert.match(rollback, /PM_SIGNUP_V5_ROLLBACK_BLOCKED_UNEXPECTED_FUNCTIONS/);
  assert.match(rollback, /PM_SIGNUP_V5_ROLLBACK_BLOCKED_UNEXPECTED_TYPES/);
  assert.match(rollback, /drop function if exists public\.complete_owner_signup_v5/);
  assert.match(rollback, /drop schema if exists pm_signup_private/);
  assert.doesNotMatch(rollback, /delete\s+from|truncate|drop\s+table/i);
  assert.doesNotMatch(rollback, /complete_owner_signup_v4[\s\S]*drop function/i);
});
