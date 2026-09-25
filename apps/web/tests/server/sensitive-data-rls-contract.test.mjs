import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../../supabase/migrations/20260922100000_harden_sensitive_shared_data_rls.sql", import.meta.url),
  "utf8",
);

test("sensitive shared data is fail-closed for direct PostgREST roles", () => {
  for (const table of [
    "shops",
    "guardians",
    "pets",
    "appointments",
    "grooming_records",
    "media_assets",
    "media_variants",
    "notification_media_attachments",
    "media_send_attempts",
    "shop_media_usage_months",
    "shop_media_limits",
  ]) {
    assert.match(source, new RegExp(`'${table}'`));
  }
  assert.match(source, /customer_search_profiles/);
  assert.match(source, /enable row level security/);
  assert.match(source, /revoke all on table public\.%I from public, anon, authenticated/);
  assert.match(source, /increment_shop_media_usage\(text, date, integer, bigint, integer, bigint\)/);
  assert.match(source, /set search_path = pg_catalog, public/);
  assert.match(source, /shop_alimtalk_credit_summaries/);
  assert.match(source, /security_invoker = true/);
  assert.match(source, /create_appointment_with_capacity_lock/);
  assert.match(source, /update_appointment_with_capacity_lock/);
  assert.doesNotMatch(source, /revoke all on table public\.%I from service_role/);
});
