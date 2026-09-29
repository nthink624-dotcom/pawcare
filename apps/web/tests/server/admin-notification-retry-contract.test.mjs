import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("admin notification failure route is authenticated and lists redacted failures", async () => {
  const route = await read("src/app/api/admin/notifications/failures/route.ts");

  assert.match(route, /requireAdminSession/);
  assert.match(route, /\.eq\("status", "failed"\)/);
  assert.match(route, /limit\(100\)/);
  assert.match(route, /function safeFailure/);
  assert.match(route, /function safeFailureReason/);
  assert.match(route, /phone-redacted/);
  const safeFailureBody = route.match(/function safeFailure[\s\S]*?\n}\n\nfunction parseNotificationType/)?.[0] ?? "";
  assert.doesNotMatch(safeFailureBody, /recipient_phone/);
  assert.doesNotMatch(safeFailureBody, /message:/);
});

test("admin notification retry is replay-safe, rehydrates current recipient data, and writes an audit event", async () => {
  const route = await read("src/app/api/admin/notifications/failures/route.ts");

  assert.match(route, /source\.status !== "failed"/);
  assert.match(route, /notification_media_attachments/);
  assert.match(route, /dispatchNotification/);
  assert.match(route, /retryOfNotificationId/);
  assert.match(route, /skipIfExists: true/);
  assert.match(route, /force: false/);
  assert.match(route, /owner_activity_events/);
  assert.match(route, /admin_notification_retry/);
  assert.match(route, /status === "failed" \? 502 : 200/);
});
