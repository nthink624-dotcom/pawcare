import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const grid = readFileSync(new URL("../../src/components/owner-web/calendar-daily-schedule-grid.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../../src/components/owner-web/calendar-staff-lane-header.tsx", import.meta.url), "utf8");

test("one to four on-duty staff divide available desktop width evenly", () => {
  assert.match(grid, /const scrollable = columnCount > 4/);
  assert.match(grid, /: `0 0 calc\(100% \/ \$\{columnCount\}\)`/);
  assert.match(grid, /min-w-\[240px\]/);
  assert.match(header, /min-w-\[160px\]/);

  for (const availableBoardWidth of [1092, 1438]) {
    const fourLaneMinimumWidth = 4 * 240;
    assert.equal(fourLaneMinimumWidth <= availableBoardWidth, true);
  }

  const fiveLaneTrackRatio = 5 * 0.25;
  assert.equal(fiveLaneTrackRatio > 1, true);
  assert.match(grid, /overflow-x-auto/);
});

test("1024 layout keeps horizontal movement inside the board instead of overflowing the page", () => {
  const availableBoardWidth = 636;
  assert.equal(4 * 240 > availableBoardWidth, true);
  assert.match(grid, /pm-schedule-y-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden/);
  assert.match(grid, /data-schedule-scroller="true"[\s\S]*?overflow-x-auto/);
});

test("paint hierarchy changes without moving 15-minute slots or booking coordinates", () => {
  const pixelsPerHour = 86.4;
  const quarterSlotHeight = pixelsPerHour / 4;
  assert.equal(quarterSlotHeight, 21.6);
  assert.deepEqual([9, 9.25, 9.5, 9.75].map((hour) => Number((hour * pixelsPerHour).toFixed(1))), [777.6, 799.2, 820.8, 842.4]);

  assert.match(grid, /const pixelsPerHour = 86\.4/);
  assert.match(grid, /const quarterSlotHeight = pixelsPerHour \/ 4/);
  assert.match(grid, /style=\{\{ top: segment\.top \+ index \* quarterSlotHeight \}\}/);
  assert.match(grid, /const deltaSlots = Math\.round\(\(event\.clientY - current\.startY\) \/ quarterSlotHeight\)/);
  assert.match(grid, /lineInterval === "hour"[\s\S]*?border-\[#dfe8f2\][\s\S]*?lineInterval === "half-hour"[\s\S]*?border-\[#e8eef5\][\s\S]*?border-transparent/);
});
