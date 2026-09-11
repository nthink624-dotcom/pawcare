import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const railPath = new URL("../../src/components/owner-web/calendar-time-rail.tsx", import.meta.url);

test("calendar time rail uses one readable numeric hierarchy without moving its geometry", async () => {
  const rail = await readFile(railPath, "utf8");

  assert.match(rail, /text-\[14px\] font-medium leading-5 tabular-nums/);
  assert.equal([...rail.matchAll(/text-\[14px\] font-medium leading-5 tabular-nums/g)].length, 2);
  assert.doesNotMatch(rail, /font-(?:bold|extrabold|black)/);

  assert.match(rail, /background: "#ffffff"/);
  assert.equal([...rail.matchAll(/backgroundColor: calendarTimeRailTone\.background/g)].length, 3);

  assert.match(rail, /h-\[68px\] w-\[68px\]/);
  assert.match(rail, /className="w-\[68px\] shrink-0/);
  assert.match(rail, /top: getLabelTop\(hour\)/);
  assert.match(rail, /top: Math\.max\(11, Math\.min\(currentTimeTop, height - 11\)\)/);
  assert.match(rail, /shadow-\[0_3px_10px_rgba\(15,23,42,0\.16\)\]/);
});
