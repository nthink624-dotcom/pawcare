import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pricing keeps service and duration controls on one compact header row and widens only the pricing body", async () => {
  const [table, guide, control] = await Promise.all([
    readFile(new URL("../../src/components/owner-web/price-guide-native-inline-table.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/owner-initial-setup-guide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/price-guide-service-duration-control.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(table, /flex min-w-0 items-center gap-1/);
  assert.match(table, /min-h-11 min-w-0 flex-1/);
  assert.doesNotMatch(table, /min-w-\[196px\] flex-wrap/);
  assert.match(guide, /sm:w-\[min\(1120px,calc\(100vw-48px\)\)\]/);
  assert.match(guide, /sm:px-8 sm:py-8/);
  assert.match(control, /"시간 설정"/);
});
