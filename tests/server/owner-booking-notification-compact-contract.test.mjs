import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("reservation notification preferences use one compact list without changing their state contract", async () => {
  const [panel, revisit, compactSwitch] = await Promise.all([
    source("src/components/owner-web/settings-alerts-panel.tsx"),
    source("src/components/owner-web/settings-revisit-reminder-default.tsx"),
    source("src/components/owner-web/settings-alert-switch.tsx"),
  ]);

  for (const key of [
    "bookingConfirmedEnabled",
    "bookingCancelledEnabled",
    "bookingRescheduledEnabled",
  ]) {
    assert.match(panel, new RegExp(`key: "${key}"`), key);
  }
  for (const type of [
    "booking_confirmed",
    "booking_cancelled",
    "booking_time_proposed",
    "booking_rescheduled_confirmed",
  ]) {
    assert.match(panel, new RegExp(`"${type}"`), type);
  }

  assert.match(panel, /const isReservationGroup = group\.key === "reservation"/);
  assert.match(panel, /isReservationGroup \? "예약 알림" : group\.title/);
  assert.match(panel, /!isReservationGroup \? \([\s\S]*?\{group\.items\.length\}개/);
  assert.match(panel, /className="min-w-0 rounded-\[12px\] border border-\[#e5e7eb\] bg-white p-3"/);
  assert.match(panel, /isReservationGroup\s*\? "grid gap-2 sm:grid-cols-2"/);
  assert.match(panel, /flex min-h-14 min-w-0 cursor-pointer items-center justify-between gap-2 rounded-\[10px\] border border-\[#e5e7eb\] bg-white px-3 py-1\.5/);
  assert.doesNotMatch(panel, /border-t border-\[#e8edf3\] sm:grid-cols-2/);
  assert.ok([...panel.matchAll(/<AlertSettingsSwitch/g)].length >= 3, "alert toggles use the shared compact presentation");

  assert.match(panel, /checked=\{checked\}/);
  assert.match(panel, /disabled=\{disabled\}/);
  assert.match(panel, /aria-label=\{`\$\{item\.title\} 알림`\}/);
  assert.match(panel, /setSelectedAlertType\(item\.type\);\s*update\(item\.key, nextChecked\);/);
  assert.match(panel, /onChange\(\{ \.\.\.value, \[key\]: checked \}\)/);
  assert.match(
    panel,
    /visitReminderEnabled \? "bg-\[#eff6ff\] text-\[#1d4ed8\]" : "bg-\[#f1f5f9\] text-\[#64748b\]"/,
  );
  assert.doesNotMatch(
    panel,
    /visitReminderEnabled \? "bg-\[#e9f5f0\] text-\[#287667\]"/,
    "automatic visit reminder badges must not regress to the mint status palette",
  );

  assert.match(
    compactSwitch,
    /h-11 w-11 border-transparent bg-transparent before:absolute before:h-6 before:w-11[\s\S]*data-\[checked\]:before:border-\[#2563eb\][\s\S]*data-\[checked\]:before:bg-\[#2563eb\]/,
  );
  assert.match(compactSwitch, /thumbClassName="relative z-10 h-5 w-5"/);
  assert.match(compactSwitch, /focus-visible:outline-\[#2563eb\]/);
  assert.doesNotMatch(compactSwitch, /#2f7866/);

  assert.match(revisit, /rounded-\[12px\] border border-\[#e5e7eb\] bg-white p-3/);
  assert.doesNotMatch(revisit, /bg-\[#f8fbff\]/);
  assert.match(revisit, /<AlertSettingsSwitch[\s\S]*checked=\{enabled\}[\s\S]*onCheckedChange=\{onEnabledChange\}/);
  assert.match(revisit, /value=\{inputValue\}[\s\S]*onBlur=\{commitDays\}/);
  assert.match(revisit, /min=\{1\}[\s\S]*max=\{365\}/);
});
