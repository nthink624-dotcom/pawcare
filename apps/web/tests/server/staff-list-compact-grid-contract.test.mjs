import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../../src/components/owner-web/staff-management-ui.tsx", import.meta.url),
  "utf8",
);

const staffListStart = source.indexOf("export function StaffList");
const staffListEnd = source.indexOf("export function StaffDetailPanel", staffListStart);
const staffList = source.slice(staffListStart, staffListEnd);

test("직원 목록은 상세 기능을 유지한 2열 compact overview를 사용한다", () => {
  assert.match(staffList, /data-staff-list-grid[^>]+md:grid-cols-2/);
  assert.match(staffList, /data-staff-identity-card=\{staffMember\.id\}/);
  assert.match(staffList, /onClick=\{\(\) => onSelect\(staffMember\)\}/);
  assert.match(staffList, /min-h-\[112px\]/);
  assert.match(staffList, /text-\[14px\][^\n]+leading-5/);
  assert.match(staffList, /text-\[16px\][^\n]+font-semibold[^\n]+leading-6/);
  assert.match(staffList, /오늘 예약 \{staffMember\.todayBookings \?\? 0\}건/);
  assert.match(staffList, /주간 근무 \{weeklyDays\}일/);

  assert.doesNotMatch(staffList, /max-h-\[560px\]|overflow-y-auto/);
  assert.doesNotMatch(staffList, /StaffListMetric|주간 예약|남은 연차|고정 휴무일|다음 휴무\/연차/);
  assert.doesNotMatch(staffList, /truncate/);
});
