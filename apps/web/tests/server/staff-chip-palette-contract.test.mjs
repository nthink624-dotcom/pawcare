import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  findAvailableStaffChipColorIndex,
  getScheduleStaffIdentityTone,
  getStaffChipColorIndex,
  getStaffChipTone,
  normalizeStaffChipColorIndex,
  staffChipPalette,
} from "../../src/lib/staff-chip-colors.ts";

const expectedPalette = [
  ["#FBECEF", "#AE3D57"],
  ["#FDF0E8", "#D86B3D"],
  ["#FFFBE3", "#E4B92E"],
  ["#EAF6EF", "#258F60"],
  ["#EAF4FC", "#2686C7"],
  ["#EDF0F7", "#334574"],
  ["#F0EAF7", "#5B2B8A"],
  ["#F5EDE7", "#7A4F36"],
  ["#E6F6F7", "#008E9A"],
  ["#F7F2E9", "#B89460"],
];

test("canonical staff palette exposes the exact ten saved chip colors in order", () => {
  assert.equal(staffChipPalette.length, 10);
  assert.deepEqual(
    staffChipPalette.map(({ background, selectedBackground }) => [background, selectedBackground]),
    expectedPalette,
  );
  assert.equal(new Set(expectedPalette.map(([background]) => background)).size, 10);
  assert.equal(new Set(expectedPalette.map(([, accent]) => accent)).size, 10);
  assert.deepEqual(expectedPalette[0], ["#FBECEF", "#AE3D57"]);
  assert.deepEqual(expectedPalette[9], ["#F7F2E9", "#B89460"]);
  assert.equal(normalizeStaffChipColorIndex(9), 9);
  assert.equal(normalizeStaffChipColorIndex(10), null);
  for (const removedBackground of ["#F8EBEE", "#F3F0F8", "#FBF1C9", "#F3F4EA", "#EEE6F6", "#F9E9E5"]) {
    assert.equal(expectedPalette.some(([background]) => background === removedBackground), false);
  }
});

test("staff chip constraint errors have a short Korean recovery message instead of the database constraint", () => {
  const route = readFileSync(new URL("../../src/app/api/staff-members/route.ts", import.meta.url), "utf8");

  assert.match(route, /function isStaffChipColorIndexConstraintError/);
  assert.match(route, /error\?\.code === "23514"/);
  assert.match(route, /staff_members_chip_color_index_check/);
  assert.match(route, /선택한 개인 칩 색을 저장하지 못했습니다\. 다시 선택해 저장해 주세요\./);
  assert.match(route, /throw new OwnerApiError\(staffChipColorSaveError, 409\)/);
});

test("each saved staff index stays in the same token family for booking identity and schedule header", () => {
  for (let index = 0; index < staffChipPalette.length; index += 1) {
    const staffKey = `staff-${index}`;
    const tone = getStaffChipTone(staffKey, index);
    const scheduleTone = getScheduleStaffIdentityTone(staffKey, index);

    assert.equal(tone, staffChipPalette[index]);
    assert.equal(scheduleTone.background, tone.background);
    assert.equal(scheduleTone.color, tone.selectedBackground);
    assert.equal(scheduleTone.border, tone.border);
    assert.equal(scheduleTone.text, tone.text);
  }
});

test("occupied colors are not reissued and the API rejects a new same-shop duplicate", () => {
  const route = readFileSync(new URL("../../src/app/api/staff-members/route.ts", import.meta.url), "utf8");
  const picker = readFileSync(new URL("../../src/components/owner-web/staff-management-ui.tsx", import.meta.url), "utf8");
  const screen = readFileSync(new URL("../../src/components/owner-web/staff-management-screen.tsx", import.meta.url), "utf8");
  const bootstrap = readFileSync(new URL("../../src/server/bootstrap.ts", import.meta.url), "utf8");

  assert.equal(findAvailableStaffChipColorIndex("new-staff", Array.from({ length: 10 }, (_, index) => index)), null);
  assert.equal(findAvailableStaffChipColorIndex("new-staff", [0, 1, 2, 3, 4, 5, 6, 7, 8]) , 9);
  assert.match(route, /select\("id, chip_color_index"\)/);
  assert.match(route, /introducesDuplicateStaffChipColor\(/);
  assert.match(route, /이미 다른 직원이 사용 중인 개인 칩 색입니다\. 다른 색을 선택해 저장해 주세요\./);
  assert.match(bootstrap, /\.from\("staff_members"\)[\s\S]*?\.eq\("shop_id", shopId\)[\s\S]*?\.eq\("is_active", true\)/);
  assert.equal(getStaffChipColorIndex("legacy-staff", null), getStaffChipColorIndex("legacy-staff", undefined));
  assert.match(picker, /persistedSelfColorIndex\?: number \| null/);
  assert.match(picker, /const persistedSelfIndex = normalizeStaffChipColorIndex\(persistedSelfColorIndex\)/);
  assert.match(picker, /const isUnavailable = \(index: number\) => unavailableColorIndices\.has\(index\) && index !== persistedSelfIndex/);
  assert.doesNotMatch(picker, /const unavailable = !selected && unavailableColorIndices\.has\(index\)/);
  assert.match(picker, /disabled=\{unavailable\}/);
  assert.match(picker, /unavailable && "cursor-not-allowed hover:bg-white"/);
  assert.match(picker, /aria-label=\{`직원 칩 색 \$\{index \+ 1\}\$\{unavailable \? ", 이미 사용 중" : ""\}`\}/);
  assert.match(picker, /const persistedSelfColorIndex = getStaffChipColorIndex\(selectedStaff\.id, selectedStaff\.chipColorIndex\)/);
  assert.match(picker, /\.filter\(\(staffMember\) => staffMember\.id !== selectedStaff\.id\)[\s\S]*?\.map\(\(staffMember\) => getStaffChipColorIndex\(staffMember\.id, staffMember\.chipColorIndex\)\)/);
  assert.match(picker, /persistedSelfColorIndex=\{persistedSelfColorIndex\}/);
  assert.match(screen, /staff[\s\S]*?\.map\(\(staffMember\) => getStaffChipColorIndex\(staffMember\.id, staffMember\.chipColorIndex\)\)/);
  const newStaffForm = picker.slice(picker.indexOf("export function StaffDraftForm"), picker.indexOf("export function StaffScheduleEditModal"));
  assert.doesNotMatch(newStaffForm, /persistedSelfColorIndex/);
  assert.match(picker, /기존 개인 칩 색을 1~10번 중에서 다시 선택해 저장해 주세요\./);
});
