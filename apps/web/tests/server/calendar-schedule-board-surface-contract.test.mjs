import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("daily schedule uses the approved shared outer surface with a flush board layout", () => {
  const screen = source("src/components/owner-web/calendar-management-screen.tsx");
  const grid = source("src/components/owner-web/calendar-daily-schedule-grid.tsx");
  const shell = source("src/components/owner-web/owner-web-app-shell.tsx");

  const flushMatch = /const ownerWebFlushCoreScreens = new Set<OwnerWebScreenKey>\(\[([\s\S]*?)\]\);/.exec(shell);
  assert.ok(flushMatch, "the shared shell must keep an explicit flush-screen allowlist");
  const flushScreens = [...flushMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(flushScreens.includes("schedule"), "the schedule board must keep its approved flush layout");
  assert.match(shell, /const usesFlushCore = ownerWebFlushCoreScreens\.has\(activeScreen\);/);
  assert.match(
    shell,
    /className="pm-owner-main-surface h-full min-h-0 min-w-0 shadow-none"[\s\S]*data-owner-main-surface="true"[\s\S]*data-owner-main-screen=\{activeScreen\}[\s\S]*data-owner-main-surface-layout=\{usesFlushCore \? "flush" : "inset"\}/,
  );
  assert.match(shell, /usesFlushCore[\s\S]*\? "overflow-visible"[\s\S]*: "overflow-hidden p-3 sm:p-4"/);
  assert.match(screen, /style=\{\{ height: "calc\(100vh - 92px\)" \}\}/);
  assert.match(screen, /data-schedule-board-root="true"/);
  assert.match(screen, /<CalendarToolbar[\s\S]*?<DailyScheduleGrid/);
  assert.match(grid, /data-schedule-board-grid="true"/);
  assert.doesNotMatch(grid, /flex min-h-0 flex-1 flex-col bg-\[#f8fafc\] p-2/);
  assert.match(grid, /flex shrink-0 overflow-hidden border-b border-\[#e3eaf2\] bg-white/);
  assert.match(grid, /data-schedule-board-grid="true" className="flex min-h-0 flex-1 flex-col bg-white"/);
  assert.match(grid, /pm-schedule-y-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white select-none/);
  assert.match(grid, /min-w-\[240px\][^"\n]*border-\[#e8eef5\][^"\n]*bg-white/);
  assert.match(grid, /selectedLane && "border-\[#d6e0ea\] bg-white"/);
  assert.doesNotMatch(grid, /bg-\[#f8fbff\]|bg-\[#f4f0e8\]|border-\[#e5ded2\]|border-\[#ede7dd\]/);
  assert.match(grid, /data-schedule-current-time-wash="true"[\s\S]*?bg-\[#edf3ff\]/);
  assert.match(grid, /data-schedule-current-time-line="true"[\s\S]*?backgroundColor: "#3b6fd8"/);
  assert.match(grid, /backgroundColor: bookingIdentityTone\.background/);
  assert.match(grid, /borderLeftColor: statusIndicatorColor\[statusTone\]/);
});
