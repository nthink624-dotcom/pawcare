import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("owner account deletion migration is server-only, idempotent, and redacts deletion audit data", () => {
  const migration = read("supabase/migrations/20260901143000_owner_account_deletion_contract.sql");
  assert.match(migration, /owner_account_deletion_requests/);
  assert.match(migration, /idempotency_key_hash char\(64\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /revoke all on table private\.owner_account_deletion_requests from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.claim_owner_account_deletion_v1/);
  assert.match(migration, /record_snapshot = jsonb_build_object\('schema_version', 2, 'redacted', true/);
  assert.doesNotMatch(migration, /to_jsonb\(old\)/);
});

test("self-delete route requires current-password reauthentication and reaches terminal auth deletion only after purge", () => {
  const route = read("src/app/api/owner/account-deletion/route.ts");
  assert.match(route, /currentPassword/);
  assert.match(route, /signInWithPassword/);
  assert.match(route, /claim_owner_account_deletion_v1/);
  assert.match(route, /finalize_owner_account_deletion_v1/);
  assert.match(route, /auth\.admin\.signOut\(user\.id, "global"\)/);
  assert.match(route, /auth\.admin\.deleteUser\(user\.id\)/);
  assert.doesNotMatch(route, /auth\.admin\.deleteUser\(user\.id,\s*true\)/);
  assert.match(route, /complete_owner_account_deletion_v1/);
  assert.ok(route.indexOf("signInWithPassword") < route.indexOf("claim_owner_account_deletion_v1"));
  assert.ok(route.indexOf("finalize_owner_account_deletion_v1") < route.indexOf("auth.admin.deleteUser"));
  assert.ok(route.indexOf("auth.admin.deleteUser") < route.indexOf("complete_owner_account_deletion_v1"));
  assert.doesNotMatch(route, /console\.(log|error|warn).*currentPassword/i);
});
