import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260921114000_close_public_database_security_gaps.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

const serverOnlyFunctions = [
  "increment_shop_media_usage\\(text, date, integer, bigint, integer, bigint\\)",
  "grant_shop_alimtalk_credits\\(text, integer, text, text, jsonb\\)",
  "reset_shop_alimtalk_included_credits\\(text, integer, timestamptz, timestamptz, text, jsonb\\)",
  "consume_shop_alimtalk_credit\\(text, uuid, uuid, text, text, jsonb\\)",
  "refund_shop_alimtalk_credit\\(text, uuid, uuid, uuid, text, text, jsonb\\)",
];

test("production corrective closes the public revenue table and sensitive views", () => {
  assert.match(migration, /alter table public\.shop_revenue_entries enable row level security;/i);
  assert.match(migration, /revoke all on table public\.shop_revenue_entries from public, anon, authenticated;/i);
  assert.match(migration, /grant select, insert, update, delete on table public\.shop_revenue_entries to service_role;/i);

  for (const view of ["customer_search_profiles", "shop_alimtalk_credit_summaries"]) {
    assert.match(migration, new RegExp(`alter view public\\.${view} set \\(security_invoker = true\\);`, "i"));
    assert.match(migration, new RegExp(`revoke all on table public\\.${view} from public, anon, authenticated;`, "i"));
    assert.match(migration, new RegExp(`grant select on table public\\.${view} to service_role;`, "i"));
  }
});

test("production corrective keeps all mutation and metering RPCs server-only", () => {
  for (const signature of serverOnlyFunctions) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated;`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to service_role;`, "i"));
  }
  assert.match(
    migration,
    /alter function public\.increment_shop_media_usage\(text, date, integer, bigint, integer, bigint\) set search_path = pg_catalog, public;/i,
  );
  assert.doesNotMatch(migration, /grant .* to (public|anon|authenticated)/i);
});

test("production corrective changes privileges only and does not rewrite customer data", () => {
  const body = migration.replace(/^--.*$/gm, "");
  assert.doesNotMatch(body, /\b(insert into|update public\.|delete from|truncate|drop)\b/i);
  assert.doesNotMatch(body, /create\s+or\s+replace\s+(function|view)/i);
});
