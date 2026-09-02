import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260829084203_harden_sensitive_database_permissions.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const onceMigration = readFileSync(
  new URL("../../supabase/migrations/20260731115035_idempotent_alimtalk_credit_purchase.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const creditService = readFileSync(new URL("../../src/server/alimtalk-credit-service.ts", import.meta.url), "utf8");
const profitability = readFileSync(new URL("../../src/server/profitability-analytics.ts", import.meta.url), "utf8");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const expectDeniedToClientRoles = (objectPattern) => {
  assert.match(migration, new RegExp(`revoke all on ${objectPattern} from public, anon, authenticated;`, "i"));
};

test("static contract: revenue ledger and summaries deny client roles while preserving the server role", () => {
  assert.match(migration, /alter table public\.shop_revenue_entries enable row level security;/i);
  expectDeniedToClientRoles("table public\\.shop_revenue_entries");
  assert.match(migration, /grant select, insert, update, delete on table public\.shop_revenue_entries to service_role;/i);

  for (const view of ["shop_revenue_daily_summary", "shop_revenue_service_summary"]) {
    expectDeniedToClientRoles(`table public\\.${view}`);
    assert.match(migration, new RegExp(`grant select on table public\\.${view} to service_role;`, "i"));
  }
});

test("static contract: customer search projection revokes client roles and grants only service_role select", () => {
  expectDeniedToClientRoles("table public\\.customer_search_profiles");
  assert.match(migration, /grant select on table public\.customer_search_profiles to service_role;/i);
});

test("static contract: credit mutation RPCs deny client execution with exact signatures", () => {
  const signatures = [
    "grant_shop_alimtalk_credits\\(text, integer, text, text, jsonb\\)",
    "reset_shop_alimtalk_included_credits\\(text, integer, timestamptz, timestamptz, text, jsonb\\)",
    "consume_shop_alimtalk_credit\\(text, uuid, uuid, text, text, jsonb\\)",
    "refund_shop_alimtalk_credit\\(text, uuid, uuid, uuid, text, text, jsonb\\)",
  ];

  for (const signature of signatures) {
    expectDeniedToClientRoles(`function public\\.${signature}`);
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to service_role;`, "i"));
  }
});

test("static contract: existing idempotent grant remains protected and known callers use the admin boundary", () => {
  const onceSignature = "public.grant_shop_alimtalk_credits_once(text, integer, text, text, jsonb, text)";
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(onceMigration, new RegExp(`revoke all on function ${escapeRegExp(onceSignature)} from ${role};`, "i"));
  }
  assert.match(onceMigration, /grant execute on function public\.grant_shop_alimtalk_credits_once\(text, integer, text, text, jsonb, text\) to service_role;/i);
  assert.match(creditService, /import \{ getSupabaseAdmin \}/);
  assert.match(creditService, /const admin = getAdmin\(\);/);
  for (const rpc of ["grant_shop_alimtalk_credits", "reset_shop_alimtalk_included_credits", "consume_shop_alimtalk_credit", "refund_shop_alimtalk_credit"]) {
    assert.match(creditService, new RegExp(`admin\\.rpc\\("${rpc}"`));
  }
  assert.match(profitability, /const supabase = getSupabaseAdmin\(\);/);
  assert.match(profitability, /\.from\("shop_revenue_entries"\)/);
});

test("static contract: every statement is a repeatable forward-only privilege operation", () => {
  const statements = migration.split(";").map((statement) => statement.trim()).filter(Boolean);
  const repeatedStatements = [...statements, ...statements];
  assert.ok(repeatedStatements.every((statement) => /^(alter table|revoke all|grant (select|execute))/i.test(statement)));
  assert.ok(repeatedStatements.every((statement) => !/^(drop|truncate|insert|update|delete|create)\b/i.test(statement)));
  assert.doesNotMatch(migration, /grant .* to (public|anon|authenticated)/i);
});
