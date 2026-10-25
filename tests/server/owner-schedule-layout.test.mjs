import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(new URL("../../src/components/owner-web/calendar-management-screen.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../../src/components/owner-web/calendar-create-dialog.tsx", import.meta.url), "utf8");
const demo = readFileSync(new URL("../../src/app/demo/owner-web/page.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../src/components/owner-web/owner-web-app-shell.tsx", import.meta.url), "utf8");

test("schedule inspector follows canonical schedulable staff count", () => {
  assert.match(screen, /const usesContextualInspector = visibleStaff\.length >= 3/);
  assert.match(screen, /usesContextualInspector \? "grid-cols-\[minmax\(0,1fr\)\]" : "lg:grid-cols-\[minmax\(0,1fr\)_360px\]"/);
  assert.match(screen, /desktopMode === "drawer"\) return null/);
  assert.match(screen, /\(!usesContextualInspector \|\| selectedBooking\) \? <BookingSidePanel/);
  assert.match(screen, /lg:w-\[clamp\(360px,28vw,420px\)\]/);
  assert.match(screen, /window\.addEventListener\("keydown", handleEscape\)/);
  assert.match(screen, /CSS\.escape\(bookingId\)/);
  assert.equal((screen.match(/예약을 선택하세요/g) ?? []).length, 1);
  assert.doesNotMatch(screen, /<WebSurface className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">/);
  assert.match(screen, /data-owner-screen-root="schedule"/);
  assert.match(shell, /data-owner-content-plane/);
  assert.match(shell, /pm-owner-content-plane h-full min-w-0 overflow-hidden rounded-\[14px\] border border-\[var\(--bd\)\] bg-white shadow-none/);
  assert.match(shell, /p-3 md:p-4">\{children\}<\/div>/);
});

test("schedule creation dialog uses monochrome interaction tokens", () => {
  assert.doesNotMatch(dialog, /#1f6b5b|#2f7866|#9fc9bd|green|emerald/i);
  assert.match(dialog, /focus:border-2 focus:border-\[#111111\]/);
  assert.match(dialog, /bg-\[#111111\] text-\[14px\] font-medium text-white/);
});

test("owner web demo uses local fixture data without a database bootstrap", () => {
  assert.match(demo, /buildDemoBootstrap\(\)/);
  assert.doesNotMatch(demo, /getBootstrap|getLandingDemoShopId/);
});
