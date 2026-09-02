import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("owner shell uses the direct core plane only for the accepted route allowlist", async () => {
  const shell = await source("src/components/owner-web/owner-web-app-shell.tsx");
  const allowlistMatch = /const ownerWebSinglePlaneCoreScreens = new Set<OwnerWebScreenKey>\(\[([\s\S]*?)\]\);/.exec(shell);

  assert.ok(allowlistMatch, "the single-plane route allowlist must stay explicit in the shared shell");
  const allowlist = [...allowlistMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(allowlist, [
    "schedule",
    "calendarRecords",
    "customers",
    "profitability",
    "bookingLink",
    "shopInfo",
    "alerts",
  ]);
  assert.ok(!allowlist.includes("benefits"));
  assert.ok(!allowlist.includes("staff"));
  assert.ok(!allowlist.includes("billing"));

  assert.match(shell, /const usesSinglePlaneCore = ownerWebSinglePlaneCoreScreens\.has\(activeScreen\);/);
  assert.match(
    shell,
    /\{usesSinglePlaneCore \? \(\s*<div className="h-full min-h-0 min-w-0">\{children\}<\/div>\s*\) : \(/,
    "allowed routes must bypass the shell-level white wrapper while retaining the core footprint",
  );
  assert.match(
    shell,
    /\) : \(\s*<div\s+className="h-full min-w-0 overflow-hidden rounded-\[14px\] border border-\[var\(--bd\)\] bg-white shadow-none"/,
    "all non-allowlisted routes, including staff and benefits, must retain their existing wrapper",
  );
  assert.match(shell, /href="\/owner\/billing\?compare=1"/);
  assert.match(
    shell,
    /flex min-h-\[60px\] shrink-0 flex-wrap items-center gap-2[\s\S]*sm:flex-nowrap/,
    "the narrow header must allow its route control to reflow instead of shrinking utility controls",
  );
  assert.match(shell, /<div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">/);
  assert.match(
    shell,
    /className="order-3 basis-full min-w-0 sm:order-none sm:basis-auto sm:max-w-\[180px\]"[\s\S]*buttonClassName="h-11"[\s\S]*valueClassName="whitespace-nowrap"[\s\S]*menuClassName="\[&_\[role=option\]\]:h-auto \[&_\[role=option\]\]:min-h-11"/,
    "the mobile route trigger and its listbox options must retain 44px targets without changing the shared select",
  );
});
