import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("owner shell gives every route one shared main surface while preserving direct core layouts", async () => {
  const [shell, preview, globals] = await Promise.all([
    source("src/components/owner-web/owner-web-app-shell.tsx"),
    source("src/components/owner-web/owner-web-preview.tsx"),
    source("src/app/globals.css"),
  ]);
  const allowlistMatch = /const ownerWebFlushCoreScreens = new Set<OwnerWebScreenKey>\(\[([\s\S]*?)\]\);/.exec(shell);

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

  assert.match(shell, /const usesFlushCore = ownerWebFlushCoreScreens\.has\(activeScreen\);/);
  assert.match(
    shell,
    /className="pm-owner-main-surface h-full min-h-0 min-w-0 shadow-none"[\s\S]*data-owner-main-surface="true"[\s\S]*data-owner-main-screen=\{activeScreen\}[\s\S]*data-owner-main-surface-layout=\{usesFlushCore \? "flush" : "inset"\}/,
    "every owner route must use the same shared outer surface",
  );
  assert.match(
    shell,
    /usesFlushCore[\s\S]*\? "overflow-visible"[\s\S]*: "overflow-hidden p-3 sm:p-4"/,
    "direct cores keep their own spacing while staff and benefits retain the accepted inset",
  );
  assert.match(preview, /data-owner-screen-root=\{activeScreen\}/, "route roots must expose a stable surface hook without changing screen logic");
  assert.match(globals, /--pm-owner-main-surface-background: #ffffff;/);
  assert.match(globals, /--pm-owner-main-surface-border: var\(--pm-ui-border\);/);
  assert.match(globals, /--pm-owner-main-surface-radius: 14px;/);
  assert.match(globals, /\.pm-owner-web \.pm-owner-main-surface \{[\s\S]*border: 1px solid var\(--pm-owner-main-surface-border\);[\s\S]*border-radius: var\(--pm-owner-main-surface-radius\);[\s\S]*overflow: visible;/);
  assert.match(globals, /\[data-schedule-board-root="true"\][\s\S]*\[data-owner-screen-root="customers"\] > div > section[\s\S]*border-width: 0 !important;/, "legacy direct cores must not create a second outer border");
  assert.match(globals, /\[data-owner-screen-root="calendarRecords"\] > div,[\s\S]*\[data-owner-screen-root="calendarRecords"\] > div > section[\s\S]*border-radius: var\(--pm-owner-main-surface-radius\) !important;/, "calendar outer corners must use the shared radius at the actual route DOM boundary");
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
