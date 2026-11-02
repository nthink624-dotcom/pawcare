import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const staffChipColors = await import(new URL("../../src/lib/staff-chip-colors.ts", import.meta.url));

test("daily schedule keeps staff identity, selection, and current-time colors in separate roles", () => {
  const staffColors = source("src/lib/staff-chip-colors.ts");
  const header = source("src/components/owner-web/calendar-staff-lane-header.tsx");
  const grid = source("src/components/owner-web/calendar-daily-schedule-grid.tsx");
  const rail = source("src/components/owner-web/calendar-time-rail.tsx");
  const staffManagement = source("src/components/owner-web/staff-management-ui.tsx");
  const staffManagementScreen = source("src/components/owner-web/staff-management-screen.tsx");
  const staffManagementModals = source("src/components/owner-web/staff-management-modals.tsx");
  const staffManagementModel = source("src/components/owner-web/staff-management-model.ts");
  const monthlySchedule = source("src/components/owner-web/staff-monthly-schedule.tsx");
  const staffRoute = source("src/app/api/staff-members/route.ts");
  const ownerPreview = source("src/components/owner-web/owner-web-preview.tsx");
  const globalStyles = source("src/app/globals.css");
  const calendarRecords = source("src/components/owner-web/calendar-records-screen.tsx");
  const toolbar = source("src/components/owner-web/calendar-toolbar.tsx");
  const actionStyles = source("src/components/owner-web/owner-web-action-button-styles.ts");

  assert.match(staffColors, /export const staffChipColorIndexMax = staffChipPalette\.length - 1/);
  assert.match(staffColors, /value > staffChipColorIndexMax/);
  assert.match(staffColors, /background: "#FCE5E5"/);
  assert.match(staffColors, /background: "#FDEFE2"/);
  assert.match(staffColors, /background: "#FFF8D8"/);
  assert.match(staffColors, /background: "#E4F2EB"/);
  assert.match(staffColors, /background: "#E3EDFD"/);
  assert.match(staffColors, /background: "#EAEEF2"/);
  assert.match(staffColors, /background: "#F0EAF9"/);
  assert.match(staffColors, /background: "#E1DDDA"/);
  assert.match(staffColors, /background: "#D6E8E9"/);
  assert.match(staffColors, /background: "#FAECF3"/);
  assert.doesNotMatch(staffColors, /calendarStaffHeaderPalette|getCalendarStaffHeaderTone/);
  assert.match(staffColors, /return staffKey \? hashStaffKey\(staffKey\) % staffChipPalette\.length : 0/);
  assert.match(staffColors, /return staffChipPalette\[getStaffChipColorIndex\(staffKey, paletteIndex\)\]!/);
  assert.match(header, /const headerTone = getStaffChipTone\(staffKey, chipColorIndex\)/);
  assert.match(header, /h-\[64px\]/);
  assert.match(header, /data-schedule-staff-header-accent="true"/);
  assert.match(header, /borderColor: headerTone\.selectedBackground/);
  assert.doesNotMatch(header, /data-staff-identity-dot|selected && "z-10 ring/);
  assert.doesNotMatch(header, /shadow-\[0_2px_5px_rgba\(15,23,42,0\.06\)\]/);
  assert.match(header, /after:w-px after:bg-\[#cbd5e1\]\/70/);
  assert.doesNotMatch(header, /identityTone/);
  assert.match(header, /focus-visible:outline-none.*focus-visible:ring-2.*focus-visible:ring-\[#2563eb\]/);
  assert.match(grid, /selectedLane && "border-\[#d6e0ea\] bg-white"/);
  assert.match(grid, /data-schedule-time-grid-line=\{selected \? "selected" : "default"\}/);
  assert.match(grid, /data-schedule-time-grid-interval=\{lineInterval\}/);
  assert.match(grid, /selected\s*\? "border-\[#d6e0ea\]"/);
  assert.match(grid, /backgroundColor: "#3b6fd8"/);
  assert.doesNotMatch(grid, /data-schedule-current-time-wash="true"/);
  assert.match(grid, /data-schedule-current-time-line="true"/);
  assert.match(grid, /selectedLane \? "border-\[#d6e0ea\]" : "border-\[#f5f6f8\]"/);
  assert.match(rail, /background: "#ffffff"/);
  assert.match(rail, /border: "#d9e0e8"/);
  assert.match(rail, /current: "#3b6fd8"/);
  assert.match(grid, /border-l-\[3px\]/);
  assert.doesNotMatch(grid, /getScheduleStaffIdentityTone|data-booking-staff-identity|--pm-booking-status-edge/);
  assert.match(grid, /getStaffChipTone\(booking\.staffKey, bookingStaff\?\.chipColorIndex\)/);
  assert.match(grid, /backgroundColor: completedBooking \? "#f8fafc" : identityTone\.background/);
  assert.match(grid, /borderColor: completedBooking \? "#dde5ef" : identityTone\.border/);
  assert.match(grid, /text-\[#17243c\]/);
  assert.match(grid, /rounded-full border px-2 text-\[14px\] font-medium leading-5/);
  assert.match(grid, /data-booking-density=\{density\}/);
  assert.match(staffManagement, /backgroundColor: tone\.selectedBackground, borderColor: tone\.selectedBackground/);
  assert.doesNotMatch(staffManagement, /backgroundColor: tone\.background, borderColor: tone\.border/);
  assert.match(grid, /borderLeftColor: identityTone\.selectedBackground/);
  assert.match(staffManagement, /getScheduleStaffIdentityTone\(staffMember\.id, staffMember\.chipColorIndex\)/);
  assert.match(staffManagement, /getStaffChipTone\(staffMember\.id, staffMember\.chipColorIndex\)/);
  assert.doesNotMatch(staffManagement, /chipColorIndex \?\? staffIndex/);
  assert.doesNotMatch(staffManagement, /staff\.map\(\(staffMember, staffIndex\)/);
  assert.match(staffManagement, /data-staff-identity-card=\{staffMember\.id\}/);
  assert.doesNotMatch(staffManagement, /data-staff-identity-accent/);
  assert.match(staffManagement, /<StableAvatar identity=\{staffId\} name=\{name\} imageUrl=\{imageUrl\}/);
  assert.match(staffManagement, /borderLeftWidth: 3/);
  assert.match(staffManagement, /borderLeftColor: staffTone\.selectedBackground/);
  assert.match(
    globalStyles,
    /\.pm-owner-web button\[data-staff-identity-card\] \{\s*border-left-width: 3px !important;\s*border-left-color: var\(--pm-wrap-indicator-color\) !important;/,
  );
  assert.doesNotMatch(staffManagementScreen, /staff\.length % staffChipPalette\.length/);
  assert.match(staffManagementScreen, /findAvailableStaffChipColorIndex\(nextStaffId, occupiedChipColorIndices\)/);
  assert.match(monthlySchedule, /getStaffChipTone\(staffMember\.id, staffMember\.chipColorIndex\)/);
  assert.doesNotMatch(monthlySchedule, /chipColorIndex \?\? staffIndex/);
  assert.doesNotMatch(staffManagementModals, /fallbackColorIndex/);
  assert.match(staffRoute, /import \{ staffChipColorIndexMax \} from "@\/lib\/staff-chip-colors"/);
  assert.match(staffRoute, /max\(staffChipColorIndexMax\)/);
  assert.doesNotMatch(staffRoute, /max\(7\)/);
  const initialSetupSaveBoundary = staffManagementModel.slice(
    staffManagementModel.indexOf("export async function persistInitialSetupStaffDraft"),
    staffManagementModel.indexOf("export function getStaffRank"),
  );
  assert.match(initialSetupSaveBoundary, /chipColorIndex: draft\.chipColorIndex/);
  assert.doesNotMatch(initialSetupSaveBoundary, /chipColorIndex: selectedStaff\?\.chipColorIndex/);
  const staffSaveBoundary = ownerPreview.slice(ownerPreview.indexOf("async function handleStaffMembersChange"), ownerPreview.indexOf("function handleScreenSelect"));
  assert.equal((staffSaveBoundary.match(/method: "PATCH"/g) ?? []).length, 2);
  assert.equal((staffSaveBoundary.match(/cache: "no-store"/g) ?? []).length, 2);
  assert.match(staffSaveBoundary, /\/api\/bootstrap\?shopId=\$\{encodeURIComponent\(shopId\)\}&phase=essential/);
  assert.match(staffSaveBoundary, /setLiveStaffMembers\(refreshed\.staffMembers\)/);
  assert.match(staffSaveBoundary, /applyOwnerData\(refreshed\)/);
  assert.match(staffManagement, /order-3 basis-full sm:absolute sm:left-1\/2/);
  assert.match(calendarRecords, /data-calendar-month-layout="true"/);
  assert.match(calendarRecords, /lg:grid-cols-\[minmax\(0,1fr\)_clamp\(300px,24vw,380px\)\]/);
  assert.match(calendarRecords, /data-calendar-month-grid="true"/);
  assert.match(calendarRecords, /gridTemplateRows: `repeat\(\$\{calendarWeekRows\}, minmax\(0, 1fr\)\)`/);
  assert.match(calendarRecords, /OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS/);
  assert.match(calendarRecords, /overflow-hidden rounded-\[18px\]/);
  assert.match(calendarRecords, /rounded-b-\[14px\]/);
  assert.match(calendarRecords, /rounded-\[10px\] border px-3 py-2 text-left/);
  assert.match(toolbar, /OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS/);
  assert.match(actionStyles, /bg-\[#1677ff\].*hover:bg-\[#0e65d8\]/);
});

test("persisted staff chip indices stay equal across reordered surfaces and missing values hash by staff id", () => {
  const fixture = [
    { id: "staff-teal", chipColorIndex: 0 },
    { id: "staff-clay", chipColorIndex: 7 },
    { id: "staff-ochre", chipColorIndex: 8 },
    { id: "staff-charcoal", chipColorIndex: 9 },
  ];
  const reordered = [...fixture].reverse();

  for (const staffMember of fixture) {
    const index = staffChipColors.getStaffChipColorIndex(staffMember.id, staffMember.chipColorIndex);
    const tone = staffChipColors.getStaffChipTone(staffMember.id, staffMember.chipColorIndex);
    assert.equal(index, staffMember.chipColorIndex);
    assert.equal(tone, staffChipColors.staffChipPalette[index]);
    assert.equal(staffChipColors.getScheduleStaffIdentityTone(staffMember.id, staffMember.chipColorIndex).background, tone.background);
    assert.equal(staffChipColors.getScheduleStaffIdentityTone(staffMember.id, staffMember.chipColorIndex).color, tone.selectedBackground);
  }

  for (const staffMember of reordered) {
    assert.equal(
      staffChipColors.getStaffChipColorIndex(staffMember.id, staffMember.chipColorIndex),
      staffMember.chipColorIndex,
    );
  }

  const missingIndex = staffChipColors.getStaffChipColorIndex("staff-missing", null);
  assert.equal(missingIndex, staffChipColors.getStaffChipColorIndex("staff-missing", undefined));
  assert.notEqual(missingIndex, staffChipColors.getStaffChipColorIndex("other-staff", null));
  assert.equal(staffChipColors.normalizeStaffChipColorIndex(-1), null);
  assert.equal(staffChipColors.normalizeStaffChipColorIndex(10), null);
  assert.equal(staffChipColors.normalizeStaffChipColorIndex(7.5), null);
});
