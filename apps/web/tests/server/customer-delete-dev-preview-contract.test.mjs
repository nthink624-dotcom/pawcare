import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("customer delete geometry preview is development-only and uses de-identified local rows", async () => {
  const [page, client, fixture] = await Promise.all([
    source("src/app/dev/customer-delete-bottom-action-preview/page.tsx"),
    source("src/app/dev/customer-delete-bottom-action-preview/customer-delete-bottom-action-preview-client.tsx"),
    source("src/app/dev/customer-delete-bottom-action-preview/customer-delete-bottom-action-preview-fixture.ts"),
  ]);

  assert.match(page, /process\.env\.NODE_ENV !== "development"/);
  assert.match(page, /notFound\(\)/);
  assert.match(client, /<OwnerApp/);
  assert.match(client, /isPreviewDemo/);
  assert.match(client, /data-preview-auth="none"/);
  assert.match(client, /data-preview-persistence="disabled"/);
  assert.match(fixture, /const FIXTURE_CUSTOMER_COUNT = 36/);
  assert.match(fixture, /검수 고객 \$\{sequence\}/);
  assert.match(fixture, /검수 반려동물 \$\{sequence\}/);
  assert.doesNotMatch([page, client, fixture].join("\n"), /fetch\(|fetchApiJson|createClient|supabase|accessToken|session/);
});

test("preview blocks the product delete handler and keeps cancel and confirm inspectable", async () => {
  const client = await source(
    "src/app/dev/customer-delete-bottom-action-preview/customer-delete-bottom-action-preview-client.tsx",
  );

  assert.match(client, /onClickCapture=\{blockFixtureDelete\}/);
  assert.match(client, /customer-delete-bottom-action/);
  assert.match(client, /event\.preventDefault\(\)/);
  assert.match(client, /event\.stopPropagation\(\)/);
  assert.match(client, /role="dialog"/);
  assert.match(client, />\s*취소\s*<\/button>/);
  assert.match(client, />\s*확인\s*<\/button>/);
  assert.match(client, /확인을 눌러도 고객 데이터는 삭제되지 않습니다/);
  assert.doesNotMatch(client, /method:\s*["']DELETE["']/);
});
