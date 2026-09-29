import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { claimOwnerDataExportRateLimit } from "../../src/server/owner-data-export-rate-limit.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("owner data export is authenticated, owner-only, shop-scoped, and non-cacheable", async () => {
  const route = await read("src/app/api/owner/data-export/route.ts");

  assert.match(route, /authClient\.auth\.getUser\(token\)/);
  assert.match(route, /loadOwnerShopAccessForUser\(user\.id\)/);
  assert.match(route, /access\.role !== "owner"/);
  assert.match(route, /searchParams\.get\("shopId"\)/);
  assert.match(route, /\.eq\("shop_id", shopId\)/);
  assert.match(route, /Cache-Control.*private, no-store/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /Authentication secrets, payment credentials, provider tokens/);
  assert.doesNotMatch(route, /service_role.*NextResponse|NextResponse.*service_role/i);
  assert.doesNotMatch(route, /console\.(log|error|warn).*token/i);
});

test("owner data export selects an explicit allowlist and excludes media binaries", async () => {
  const route = await read("src/app/api/owner/data-export/route.ts");
  const contracts = await read("../../docs/shared/data-contracts.md");

  for (const table of ["shops", "guardians", "pets", "services", "appointments", "grooming_records", "notifications"]) {
    assert.match(route, new RegExp(`\\"${table}\\"`));
  }
  assert.match(route, /Media binary objects are not included/);
  assert.match(route, /claimOwnerDataExportRateLimit/);
  assert.match(route, /status: 429/);
  assert.match(route, /EXPORT_SCHEMA_VERSION/);
  assert.doesNotMatch(route, /select\("\*"\)/);
  assert.match(contracts, /## Owner Data Export Contract/);
  assert.match(contracts, /Media binary objects are excluded/);
});

test("owner data export rate limit stores a hash and blocks repeated downloads", () => {
  const userId = `export-rate-limit-${Date.now()}-${Math.random()}`;
  const start = 1_700_000_000_000;
  assert.equal(claimOwnerDataExportRateLimit(userId, start).allowed, true);
  assert.equal(claimOwnerDataExportRateLimit(userId, start + 1).allowed, true);
  assert.equal(claimOwnerDataExportRateLimit(userId, start + 2).allowed, true);
  const blocked = claimOwnerDataExportRateLimit(userId, start + 3);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal(claimOwnerDataExportRateLimit(userId, start + 10 * 60 * 1000 + 1).allowed, true);
});

test("owner data export local fallback has a bounded key store", async () => {
  const limiter = await read("src/server/owner-data-export-rate-limit.ts");
  assert.match(limiter, /MAX_RATE_LIMIT_KEYS = 4096/);
  assert.match(limiter, /store\.size > MAX_RATE_LIMIT_KEYS/);
  assert.match(limiter, /timestamps\[timestamps\.length - 1\]/);
});
