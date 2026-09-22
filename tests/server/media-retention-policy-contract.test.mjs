import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PETMANAGER_MEDIA_TRANSIENT_RETENTION_DAYS,
  PETMANAGER_MEDIA_NOTICE_COPY,
} from "../../src/lib/media/media-policy.ts";
import { buildMediaStorageDirectory } from "../../src/server/media-storage-paths.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("temporary and retained media use separate lifecycle prefixes", () => {
  const common = {
    shopId: "shop-safe",
    mediaAssetId: "11111111-1111-4111-8111-111111111111",
    mediaKind: "message_image",
    createdAt: "2026-09-21T00:00:00.000Z",
  };

  assert.match(buildMediaStorageDirectory({ ...common, retentionPolicy: "transient" }), /^transient\//);
  assert.match(buildMediaStorageDirectory({ ...common, retentionPolicy: "standard" }), /^retained\//);
  assert.match(buildMediaStorageDirectory({ ...common, retentionPolicy: "archive" }), /^retained\//);
});

test("60-day policy, cleanup schedule, migration, provider routing, and public notice stay aligned", async () => {
  const [vercelConfig, migration, privacyPolicy, cleanupRoute, mediaStorage, mediaService] = await Promise.all([
    source("vercel.json"),
    source("supabase/migrations/20260921095436_media_transient_retention_60_days.sql"),
    source("src/lib/legal/privacy-policy.ts"),
    source("src/app/api/media/cleanup-expired/route.ts"),
    source("src/server/media-storage.ts"),
    source("src/server/media-service.ts"),
  ]);

  assert.equal(PETMANAGER_MEDIA_TRANSIENT_RETENTION_DAYS, 60);
  assert.match(PETMANAGER_MEDIA_NOTICE_COPY.uploadNotice, /60일/);
  assert.match(PETMANAGER_MEDIA_NOTICE_COPY.policySummary, /직접 삭제/);
  assert.match(vercelConfig, /\/api\/media\/cleanup-expired\?dryRun=false/);
  assert.match(migration, /set default 60/);
  assert.match(migration, /interval '60 days'/);
  assert.match(privacyPolicy, /60일 동안 보관하며, 보관기간 만료 후 일일 자동 정리 작업에서 삭제/);
  assert.match(privacyPolicy, /직접 삭제하거나 해당 매장·계정을 삭제할 때까지 보관/);
  assert.match(mediaService, /retentionPolicy === "archive"[\s\S]*allowOriginalArchive/);
  assert.match(cleanupRoute, /export async function GET[\s\S]*runCleanup\(request, false\)/);
  assert.match(mediaStorage, /transient\|retained[\s\S]*supabase/);
  assert.match(mediaStorage, /Mobile uploads created before lifecycle prefixes/);
});
