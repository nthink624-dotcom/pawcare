import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("daily schedule uses one expanded board surface without an inner card inset", () => {
  const screen = source("src/components/owner-web/calendar-management-screen.tsx");
  const grid = source("src/components/owner-web/calendar-daily-schedule-grid.tsx");
  const shell = source("src/components/owner-web/owner-web-app-shell.tsx");

  assert.match(shell, /const isScheduleBoard = activeScreen === "schedule"/);
  assert.match(shell, /\{isScheduleBoard \? \(\s*<div className="h-full min-h-0 min-w-0">\{children\}<\/div>/);
  assert.match(screen, /style=\{\{ height: "calc\(100vh - 92px\)" \}\}/);
  assert.match(screen, /data-schedule-board-root="true"/);
  assert.match(screen, /<CalendarToolbar[\s\S]*?<DailyScheduleGrid/);
  assert.match(grid, /data-schedule-board-grid="true"/);
  assert.doesNotMatch(grid, /flex min-h-0 flex-1 flex-col bg-\[#f8fafc\] p-2/);
  assert.match(grid, /flex shrink-0 overflow-hidden border-b border-\[#e3eaf2\] bg-white/);
  assert.match(grid, /pm-schedule-y-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-\[#f8fbff\] select-none/);
});
