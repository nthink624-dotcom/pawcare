import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../../../../supabase/migrations/20260929131500_revoke_policyless_browser_grants.sql", import.meta.url),
  "utf8",
);
const verification = await readFile(
  new URL("../../../../supabase/verification/verify_policyless_rls_acl.sql", import.meta.url),
  "utf8",
);
const ownerPushMigration = await readFile(
  new URL("../../../../supabase/migrations/20260930151901_revoke_owner_push_tokens_browser_grants.sql", import.meta.url),
  "utf8",
);
const allBrowserGrantsVerification = await readFile(
  new URL("../../../../supabase/verification/verify_public_browser_table_grants.sql", import.meta.url),
  "utf8",
);

function normalized(sql) {
  return sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().toLowerCase();
}

test("policyless RLS hardening revokes browser ACLs and preserves the server role", () => {
  const sql = normalized(migration);
  assert.match(sql, /do \$\$ declare table_name text;/);
  assert.match(sql, /if to_regclass\(format\('public\.%i', table_name\)\) is not null/);
  assert.match(sql, /revoke all on table public\.%i from anon, authenticated/);
  assert.match(sql, /grant all on table public\.%i to service_role/);
  assert.doesNotMatch(sql, /\b(drop|delete|truncate|alter table)\b/);
});

test("policyless RLS migration has a unique explicit target list", () => {
  const list = migration.match(/array\[(.*?)\]/s)?.[1] ?? "";
  const tables = [...list.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]);
  assert.ok(tables.length > 0);
  assert.equal(new Set(tables).size, tables.length);
  assert.ok(tables.includes("owner_profiles"));
  assert.ok(tables.includes("owner_subscriptions"));
});

test("policyless RLS verification fails closed until browser grants reach zero", () => {
  const sql = normalized(verification);
  assert.match(sql, /not exists \( select 1 from pg_policies/);
  assert.match(sql, /grantee in \('anon', 'authenticated'\)/);
  assert.match(sql, /when count\(\*\) = 0 then 'pass' else 'pending_migration'/);
});

test("push-token API table has only server-role privileges and a read-only audit query covers all public tables", () => {
  const migrationSql = normalized(ownerPushMigration);
  assert.match(migrationSql, /revoke all privileges on table public\.owner_push_tokens from public, anon, authenticated/);
  assert.match(migrationSql, /grant all privileges on table public\.owner_push_tokens to service_role/);
  assert.doesNotMatch(migrationSql, /\b(drop|delete|truncate|alter table)\b/);

  const verificationSql = normalized(allBrowserGrantsVerification);
  assert.match(verificationSql, /has_table_privilege\(r\.rolname, c\.oid, 'truncate'\)/);
  assert.match(verificationSql, /r\.rolname in \('anon', 'authenticated'\)/);
  assert.match(verificationSql, /n\.nspname = 'public'/);
});
