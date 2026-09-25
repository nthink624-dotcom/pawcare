import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("remaining owner menus share one neutral outer surface", async () => {
  const [shell, preview, globals] = await Promise.all([
    source("src/components/owner-web/owner-web-app-shell.tsx"),
    source("src/components/owner-web/owner-web-preview.tsx"),
    source("src/app/globals.css"),
  ]);

  for (const [key, label] of [
    ["schedule", "예약 관리"],
    ["calendarRecords", "캘린더"],
    ["customers", "고객 관리"],
    ["benefits", "혜택 관리"],
    ["staff", "직원 관리"],
  ]) {
    assert.match(shell, new RegExp(`\\{ key: "${key}", label: "${label}" \\}`));
  }

  assert.match(
    shell,
    /className="pm-owner-main-surface h-full min-h-0 min-w-0 shadow-none"[\s\S]*data-owner-main-surface="true"[\s\S]*data-owner-main-screen=\{activeScreen\}/,
  );
  assert.match(preview, /data-owner-screen-root=\{activeScreen\}/);
  assert.match(globals, /--pm-owner-main-surface-border: var\(--pm-ui-border\);/);
  assert.match(globals, /--pm-ui-border: #e8edf3;/);
  assert.match(globals, /--pm-owner-main-surface-radius: 14px;/);
  assert.match(
    globals,
    /\.pm-owner-web \.pm-owner-main-surface \{[\s\S]*border: 1px solid var\(--pm-owner-main-surface-border\);[\s\S]*border-radius: var\(--pm-owner-main-surface-radius\);/,
  );
});

test("remaining menu exceptions remove only duplicated outer borders", async () => {
  const [shell, globals, calendar, customers, staff] = await Promise.all([
    source("src/components/owner-web/owner-web-app-shell.tsx"),
    source("src/app/globals.css"),
    source("src/components/owner-web/calendar-records-screen.tsx"),
    source("src/components/owner-web/customer-management-screen.tsx"),
    source("src/components/owner-web/staff-management-screen.tsx"),
  ]);

  const flushMatch = /const ownerWebFlushCoreScreens = new Set<OwnerWebScreenKey>\(\[([\s\S]*?)\]\);/.exec(shell);
  assert.ok(flushMatch);
  const flushScreens = [...flushMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(flushScreens.includes("schedule"));
  assert.ok(flushScreens.includes("calendarRecords"));
  assert.ok(flushScreens.includes("customers"));
  assert.ok(!flushScreens.includes("benefits"));
  assert.ok(!flushScreens.includes("staff"));

  assert.match(
    globals,
    /\[data-schedule-board-root="true"\],[\s\S]*\[data-owner-screen-root="customers"\] > div > section \{[\s\S]*border-width: 0 !important;[\s\S]*box-shadow: none !important;/,
  );
  assert.doesNotMatch(globals, /\.pm-owner-web \.pm-owner-main-surface \*\s*\{[\s\S]*border(?:-width)?:\s*0/);

  assert.match(calendar, /border-b border-\[#e5e7eb\]/);
  assert.match(customers, /border-b border-\[#dbe2ea\]/);
  assert.match(staff, /<WebSurface className=\{cn\("overflow-hidden"/);
});
