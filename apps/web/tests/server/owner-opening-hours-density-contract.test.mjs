import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = new URL("../../src/components/owner-web/operating-hours-settings.tsx", import.meta.url);

function compactBranch(source) {
  const start = source.indexOf("  if (compact) {");
  const end = source.indexOf("\n  return (", start);
  assert.notEqual(start, -1, "compact owner settings branch must exist");
  assert.notEqual(end, -1, "compact owner settings branch must have a dedicated return");
  return source.slice(start, end);
}

test("compact opening-hours booking controls stay dense without altering saved policy state", async () => {
  const compact = compactBranch(await readFile(sourcePath, "utf8"));

  assert.match(compact, /예약 가능 시간[\s\S]*TimeInput value=\{bookingSettings\.firstBookingTime\}[\s\S]*TimeInput value=\{bookingSettings\.lastBookingTime\}/);
  assert.doesNotMatch(compact, /예약 시작 가능 시간/, "the representative-facing label stays unchanged");
  assert.match(compact, /htmlFor="compact-booking-close-grace"[\s\S]*value=\{bookingSettings\.closeGraceMinutes\}/);
  assert.match(compact, /updateBookingSetting\("closeGraceMinutes", nextValue, true\)/, "the close grace draft persists through the existing path");
  assert.match(compact, /minutes === 15 \? " · 권장" : ""[\s\S]*영업 마감 뒤 허용할 종료 여유/, "the recommendation is presentation-only and the grace meaning stays concise");
  assert.doesNotMatch(compact, /마지막 예약 접수/, "the overlapping legacy setting is not rendered");

  assert.match(compact, /예약 금지 시간[\s\S]*금지 시간 추가/);
  const blockedWindowsStart = compact.indexOf("bookingSettings.blockedWindows.length > 0");
  assert.notEqual(blockedWindowsStart, -1, "blocked-window details must stay conditional");
  const beforeBlockedWindows = compact.slice(0, blockedWindowsStart);
  assert.doesNotMatch(beforeBlockedWindows, /금지 시간을 넣으면 서비스 소요 시간/, "empty state must not reserve a full-width warning panel");
  assert.match(compact.slice(blockedWindowsStart), /등록한 시간에는 예약을 받지 않습니다\.[\s\S]*updateBlockedWindow[\s\S]*removeBlockedWindow/);
  assert.match(compact, /min-h-11 min-w-11/, "blocked-window deletion remains a 44px target");
  assert.match(compact, /focus-visible:ring-2 focus-visible:ring-\[#2563eb\]/, "keyboard focus must remain clear-blue");
});
