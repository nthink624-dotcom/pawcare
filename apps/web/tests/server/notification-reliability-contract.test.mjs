import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("notification dispatch keeps duplicate, scheduling, and failure states explicit", async () => {
  const dispatch = await read("src/server/notification-dispatch.ts");

  assert.match(dispatch, /evaluateNotificationAbusePolicy/);
  assert.match(dispatch, /input\.skipIfExists && hasExistingNotification/);
  assert.match(dispatch, /const scheduledAt = input\.scheduledAt \?\? null/);
  assert.match(dispatch, /status = "failed"/);
  assert.match(dispatch, /fail_reason: failReason/);
  assert.match(dispatch, /scheduled_at: scheduledAt/);
  assert.match(dispatch, /provider_message_id: providerMessageId/);
});

test("Alimtalk failures refund consumed credits and preserve media delivery state", async () => {
  const dispatch = await read("src/server/notification-dispatch.ts");
  const migration = await read("../../supabase/migrations/202605220007_notification_delivery_audit.sql");

  assert.match(dispatch, /refundShopAlimtalkCredit/);
  assert.match(dispatch, /if \(creditReservation\?\.consumed\)/);
  assert.match(dispatch, /markNotificationMediaDeliveryResult/);
  assert.match(migration, /provider_delivery_status/);
  assert.match(migration, /credit_refund_event_id uuid/);
  assert.match(migration, /notification_delivery_checks/);
  assert.match(migration, /notifications_provider_message_idx/);
});

test("provider logs do not include recipient or relay secret payloads", async () => {
  const provider = await read("src/server/alimtalk-provider.ts");

  assert.match(provider, /relayUrlHost/);
  assert.match(provider, /relayUrlPathname/);
  const logLines = provider.split(/\r?\n/).filter((line) => /console\.(?:log|error)/.test(line));
  assert.equal(logLines.length, 3);
  assert.match(provider, /logOperationalEvent\("alimtalk\.relay_request_failed"/);
  for (const line of logLines) {
    assert.doesNotMatch(line, /input\.to|recipientName|alimtalkRelaySecret|alimtalkApiKey/);
  }
});

test("notification dispatch logs do not include phone tails", async () => {
  const dispatch = await read("src/server/notification-dispatch.ts");

  assert.doesNotMatch(dispatch, /function getPhoneTail|initialPhoneTail|phoneTail/);
});
