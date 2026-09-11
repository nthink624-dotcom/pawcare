import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createPriceGuidePhotoImportFixture } from "../../src/lib/price-guide-photo-import-fixture.ts";

const pagePath = new URL(
  "../../src/app/dev/price-guide-inline-matrix-preview/page.tsx",
  import.meta.url,
);
const clientPath = new URL(
  "../../src/app/dev/price-guide-inline-matrix-preview/price-guide-inline-matrix-preview-client.tsx",
  import.meta.url,
);
const tablePath = new URL(
  "../../src/components/owner-web/price-guide-native-inline-table.tsx",
  import.meta.url,
);

test("inline matrix preview is development-only and has no auth or network path", async () => {
  const [page, client] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(clientPath, "utf8"),
  ]);

  assert.match(page, /process\.env\.NODE_ENV !== "development"/);
  assert.match(page, /notFound\(\)/);
  assert.match(client, /data-preview-source="fixture"/);
  assert.match(client, /data-network-mode="none"/);
  assert.match(client, /data-persisted="false"/);
  assert.doesNotMatch(
    `${page}\n${client}`,
    /fetch\(|axios|createClient|supabase|signIn|signUp|upload|provider|R2|\/api\//i,
  );
});

test("preview reuses the shared inline editor and its document change handler", async () => {
  const client = await readFile(clientPath, "utf8");

  assert.match(client, /PriceGuideNativeInlineTable/);
  assert.match(client, /createPriceGuidePhotoImportFixture\(\)\.document/);
  assert.match(client, /document=\{draft\}/);
  assert.match(client, /onChange=\{setDraft\}/);
  assert.match(client, /photoReviewMode/);
  assert.doesNotMatch(client, /dialog|modal|drawer|card/i);
});

test("fixture contains exactly two service columns across the four weight rows", () => {
  const fixture = createPriceGuidePhotoImportFixture().document;
  const services = [...new Set(fixture.rows.map((row) => row.serviceName))];
  const weightRows = [...new Set(fixture.rows.map((row) => row.weightBandLabel))];

  assert.deepEqual(services, ["목욕", "발톱"]);
  assert.deepEqual(weightRows, ["2kg 미만", "4kg 미만", "6kg 미만", "8kg 미만"]);
  assert.equal(fixture.rows.length, services.length * weightRows.length);
});

test("shared table keeps one service per column and edits price and duration inside one cell", async () => {
  const table = await readFile(tablePath, "utf8");

  assert.match(table, /group\.serviceNames\.map\(\(serviceName, serviceIndex\)/);
  assert.match(table, /data-price-guide-price-duration-cell=\{rowIndex\}/);
  assert.match(table, /data-price-guide-inline-edit="price-duration"/);
  assert.match(table, /\{priceLabel\(row\)\} \/ \{row\.durationMinutes/);
  assert.match(table, /sticky left-0/);
  assert.match(table, /sticky top-0/);
  assert.match(table, /overflow-auto/);
  assert.doesNotMatch(table, /<dialog|role="dialog"|data-price-guide-editor-page/);
});
