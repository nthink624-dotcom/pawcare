import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationRaw = readFileSync(
  new URL("../../supabase/migrations/20260903044404_harden_revenue_alimtalk_acl.sql", import.meta.url),
  "utf8",
);
const migration = migrationRaw.replace(/\s+/g, " ");
const migrationBody = migrationRaw.replace(/^--.*$/gm, "").replace(/\s+/g, " ");
const creditService = readFileSync(new URL("../../src/server/alimtalk-credit-service.ts", import.meta.url), "utf8");
const profitability = readFileSync(new URL("../../src/server/profitability-analytics.ts", import.meta.url), "utf8");
const supabaseServer = readFileSync(new URL("../../src/lib/supabase/server.ts", import.meta.url), "utf8");
const creditMigration = readFileSync(
  new URL("../../supabase/migrations/202605190006_shop_alimtalk_credits.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

const signatures = [
  "grant_shop_alimtalk_credits(text, integer, text, text, jsonb)",
  "reset_shop_alimtalk_included_credits(text, integer, timestamptz, timestamptz, text, jsonb)",
  "consume_shop_alimtalk_credit(text, uuid, uuid, text, text, jsonb)",
  "refund_shop_alimtalk_credit(text, uuid, uuid, uuid, text, text, jsonb)",
];

test("revenue ledger is RLS-enabled and denies every client table privilege", () => {
  assert.match(migration, /alter table public\.shop_revenue_entries enable row level security;/i);
  assert.match(migration, /revoke all on table public\.shop_revenue_entries from public, anon, authenticated;/i);
  assert.match(migration, /grant select, insert, update, delete on table public\.shop_revenue_entries to service_role;/i);
  assert.doesNotMatch(migration, /grant .*shop_revenue_entries.* to (public|anon|authenticated)/i);
});

test("every credit mutation signature revokes default client execution and retains only service_role", () => {
  for (const signature of signatures) {
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${escaped} from public, anon, authenticated;`, "i"),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${escaped} to service_role;`, "i"),
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`grant execute on function public\\.${escaped} to (public|anon|authenticated)`, "i"),
    );
  }
});

test("legitimate revenue and credit callers remain server-only and function bodies are not replaced", () => {
  assert.match(supabaseServer, /createClient\(serverEnv\.supabaseUrl, serverEnv\.supabaseServiceRoleKey/);
  assert.match(creditService, /import \{ getSupabaseAdmin \} from "@\/lib\/supabase\/server"/);
  assert.match(creditService, /const admin = getAdmin\(\);/);
  assert.match(profitability, /const supabase = getSupabaseAdmin\(\);/);

  for (const name of [
    "grant_shop_alimtalk_credits",
    "reset_shop_alimtalk_included_credits",
    "consume_shop_alimtalk_credit",
    "refund_shop_alimtalk_credit",
  ]) {
    assert.match(creditService, new RegExp(`admin\\.rpc\\("${name}"`));
    assert.match(
      creditMigration,
      new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?security definer set search_path = public`, "i"),
    );
  }

  assert.doesNotMatch(migrationBody, /create\s+or\s+replace\s+function|language\s+plpgsql|security\s+definer/i);
});

test("migration is a repeatable privilege boundary and cannot introduce PUBLIC defaults", () => {
  const statements = migrationBody.split(";").map((statement) => statement.trim()).filter(Boolean);
  assert.equal(statements.length, 11);
  assert.ok(statements.every((statement) => /^(alter table|revoke all|grant (select|execute))/i.test(statement)));
  assert.doesNotMatch(migration, /grant .* to (public|anon|authenticated)/i);
  assert.doesNotMatch(migrationBody, /\b(create|drop|truncate)\b/i);
  assert.doesNotMatch(migrationBody, /\b(insert into|update public|delete from)\b/i);
});
