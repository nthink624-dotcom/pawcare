import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../../supabase/migrations/20260922102000_add_explicit_sensitive_data_deny_policies.sql", import.meta.url),
  "utf8",
);

test("sensitive shared tables have an explicit deny policy for direct client roles", () => {
  for (const table of ["shops", "guardians", "pets", "appointments", "grooming_records", "media_assets", "media_variants", "notification_media_attachments", "media_send_attempts", "shop_media_usage_months", "shop_media_limits"]) {
    assert.match(source, new RegExp(`'${table}'`));
  }
  assert.match(source, /create policy pm_deny_direct_access/);
  assert.match(source, /to anon, authenticated using \(false\) with check \(false\)/);
});
