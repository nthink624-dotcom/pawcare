import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schedule = readFileSync(
  new URL("../src/components/owner/owner-booking-day-schedule.tsx", import.meta.url),
  "utf8",
);

function classNameAfter(pattern) {
  const match = schedule.match(pattern);
  assert.ok(match, `className contract not found: ${pattern}`);
  return match[1];
}

test("staff lane chip restores its square outer edge without clipping its photo or color bar", () => {
  const chipClass = classNameAfter(
    /data-testid="staff-lane-chip"[\s\S]*?className="([^"]+)"/,
  );

  assert.doesNotMatch(chipClass, /(?:^|\s)rounded(?:-|\s|$)/);
  assert.doesNotMatch(chipClass, /overflow-hidden/);
  assert.match(schedule, /h-\[52px\] w-\[52px\][^"\n]+rounded-full/);
  assert.match(schedule, /data-testid="staff-name-row"/);
  assert.match(schedule, /data-testid="staff-summary-row"/);
  assert.match(schedule, /data-testid="staff-chip-color-bar"[^>]+bottom-0[^>]+h-\[2px\] w-4\/5/);
  assert.match(schedule, /backgroundColor: staff\.background \?\? "#ffffff"/);
});

test("appointment interaction and surface restore the original rounded-lg radius without changing geometry", () => {
  const appointmentButtonClass = classNameAfter(
    /data-appointment-id=\{appointment\.id\}[\s\S]*?className="([^"]+)"/,
  );
  const appointmentSurfaceClass = classNameAfter(
    /data-testid="appointment-card-surface"[\s\S]*?className="([^"]+)"/,
  );

  assert.match(appointmentButtonClass, /(?:^|\s)rounded-lg(?:\s|$)/);
  assert.match(appointmentSurfaceClass, /(?:^|\s)rounded-lg(?:\s|$)/);
  assert.doesNotMatch(appointmentButtonClass, /rounded-\[10px\]/);
  assert.doesNotMatch(appointmentSurfaceClass, /rounded-\[10px\]/);
  assert.match(appointmentSurfaceClass, /(?:^|\s)overflow-hidden(?:\s|$)/);
  assert.match(schedule, /left: `calc\(\$\{column \* width\}% \+ 8px\)`/);
  assert.match(schedule, /width: `calc\(\$\{width\}% - 12px\)`/);
  assert.match(schedule, /minHeight: Math\.max\(height, 44\)/);
  assert.match(schedule, /top: edgeInsets\.top, bottom: edgeInsets\.bottom/);
  assert.match(schedule, /onClick=\{\(\) => onOpenAppointment\(appointment\)\}/);
});
