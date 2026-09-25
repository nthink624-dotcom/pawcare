import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile media applies the shared 60-day temporary retention contract", async () => {
  const [policy, mediaClient, mediaService, privacyPolicy] = await Promise.all([
    source("src/lib/media/media-policy.ts"),
    source("src/lib/media/owner-media-client.ts"),
    source("src/server/owner-media-service.ts"),
    source("src/lib/legal/privacy-policy.ts"),
  ]);

  assert.match(policy, /PETMANAGER_MEDIA_TRANSIENT_RETENTION_DAYS = 60/);
  assert.match(mediaClient, /message_image[\s\S]*customer_shared[\s\S]*feedback_screenshot[\s\S]*"transient"/);
  assert.match(mediaService, /expiresAt\.setUTCDate\([\s\S]*PETMANAGER_MEDIA_TRANSIENT_RETENTION_DAYS/);
  assert.match(mediaService, /`\$\{lifecyclePrefix\}\/shops\//);
  assert.match(mediaService, /expires_at: getExpiresAt\(retentionPolicy\)/);
  assert.match(mediaService, /retentionPolicy === "archive"[\s\S]*OwnerApiError/);
  assert.match(privacyPolicy, /60일 동안 보관하며, 보관기간 만료 후 일일 자동 정리 작업에서 삭제/);
  assert.match(privacyPolicy, /직접 삭제하거나 해당 매장·계정을 삭제할 때까지 보관/);
});
