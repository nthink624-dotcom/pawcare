import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("caller ID migration keeps raw caller numbers out of the event ledger", async () => {
  const migration = await read("../../supabase/migrations/20260921120000_call_id_foundation.sql");
  assert.match(migration, /create table if not exists public\.call_integrations/i);
  assert.match(migration, /create table if not exists public\.call_events/i);
  assert.match(migration, /phone_fingerprint char\(64\)/i);
  assert.match(migration, /phone_tail char\(4\)/i);
  assert.match(migration, /line_type text not null check \(line_type in \('landline', 'mobile'\)\)/i);
  assert.doesNotMatch(migration, /caller_phone|phone_number|raw_phone/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.call_events from public, anon, authenticated/i);
  assert.match(migration, /unique \(integration_id, provider_event_id\)/i);
  assert.match(migration, /PM_CALL_EVENT_INTEGRATION_SHOP_MISMATCH/);
  assert.match(migration, /PM_CALL_EVENT_GUARDIAN_SHOP_MISMATCH/);
});

test("caller ID webhook contract authenticates, bounds, matches, and deduplicates events", async () => {
  const route = await read("src/app/api/webhooks/calls/[integrationId]/route.ts");
  assert.match(route, /x-petmanager-call-webhook-token/);
  assert.match(route, /MAX_BODY_BYTES = 64 \* 1024/);
  assert.match(route, /hashCallPhone\(normalizedPhone\)/);
  assert.match(route, /from\("guardians"\)/);
  assert.match(route, /unique|23505/);
  assert.match(route, /replayed: true/);
  assert.doesNotMatch(route, /caller_number\s*:/i);
  assert.doesNotMatch(route, /rawBody\s*:/i);
});

test("caller ID owner setup returns the webhook token only on creation", async () => {
  const route = await read("src/app/api/owner/call-integrations/route.ts");
  assert.match(route, /createCallWebhookToken/);
  assert.match(route, /lineType/);
  assert.match(route, /webhookToken,/);
  const getSection = route.slice(0, route.indexOf("export async function POST"));
  assert.doesNotMatch(getSection, /webhookToken\s*[,}]/);
  assert.match(route, /assertOwnerOrManager/);
});

test("shared contract records caller ID privacy and provider boundaries", async () => {
  const contract = await read("docs/work-management/PM_CALL_ID_ADOPTION_20260921.md");
  assert.match(contract, /원본 전화번호 대신 서버 HMAC 지문과 끝 4자리/);
  assert.match(contract, /KT 통화매니저/);
  assert.match(contract, /공급사/);
});
