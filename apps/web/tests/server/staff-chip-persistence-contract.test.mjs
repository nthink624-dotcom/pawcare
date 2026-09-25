import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getStaffChipColorIndex,
  staffChipColorIndexMax,
} from "../../src/lib/staff-chip-colors.ts";
import { saveStaffMembersWithDeferredRefresh } from "../../src/components/owner-web/staff-members-save-sync.ts";
import {
  getNextStaffProfileOptionalColumn,
  isMissingRequiredStaffPreferenceColumn,
  omitStaffProfileColumns,
} from "../../src/server/staff-profile-column-compat.ts";

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("staff chip indices 0 through 9 remain exact request values and route derives its upper bound", () => {
  const route = source("src/app/api/staff-members/route.ts");
  const model = source("src/components/owner-web/staff-management-model.ts");
  const migration = source("../../supabase/migrations/20260904021251_expand_staff_chip_color_index_palette.sql");
  const payloadIndices = [0, 8, 9];

  assert.equal(staffChipColorIndexMax, 9);
  for (const chipColorIndex of payloadIndices) {
    assert.equal(getStaffChipColorIndex(`staff-${chipColorIndex}`, chipColorIndex), chipColorIndex);
  }
  assert.match(route, /chipColorIndex: z\.number\(\)\.int\(\)\.min\(0\)\.max\(staffChipColorIndexMax\)/);
  assert.match(route, /chip_color_index: staffMember\.chipColorIndex/);
  assert.match(route, /return ownerMobileCorsJson\(request, \{\s*staffMembers:/);
  assert.doesNotMatch(route, /max\(7\)/);
  assert.match(model, /chipColorIndex: draft\.chipColorIndex/);
  assert.doesNotMatch(model, /chipColorIndex: selectedStaff\?\.chipColorIndex/);
  assert.match(migration, /drop constraint if exists staff_members_chip_color_index_check/);
  assert.match(migration, /add constraint staff_members_chip_color_index_check/);
  assert.match(migration, /chip_color_index is null or chip_color_index between 0 and 9/);
  assert.doesNotMatch(migration, /enable row level security|grant |revoke |avatar|appointment/i);
});

test("local delayed-refresh interception acknowledges PATCH before exactly one background bootstrap refresh", async () => {
  const calls = [];
  let resolveRefresh;
  const delayedRefresh = new Promise((resolve) => {
    resolveRefresh = resolve;
  });
  let acknowledged = null;
  let refreshSettled = false;

  const result = await saveStaffMembersWithDeferredRefresh({
    patch: async () => {
      calls.push("PATCH");
      return { staffMembers: [{ id: "staff-8", chipColorIndex: 8 }] };
    },
    applyAcknowledged: (value) => {
      calls.push("ACK");
      acknowledged = value;
    },
    refresh: async () => {
      calls.push("GET:no-store");
      await delayedRefresh;
      refreshSettled = true;
    },
  });

  assert.deepEqual(calls, ["PATCH", "ACK", "GET:no-store"]);
  assert.equal(acknowledged.staffMembers[0].chipColorIndex, 8);
  assert.equal(refreshSettled, false);
  resolveRefresh();
  await result.backgroundRefresh;
  assert.equal(refreshSettled, true);
  assert.equal(calls.filter((call) => call === "PATCH").length, 1);
  assert.equal(calls.filter((call) => call === "GET:no-store").length, 1);
});

test("local failed PATCH keeps the draft path and starts no bootstrap refresh", async () => {
  const calls = [];
  await assert.rejects(
    saveStaffMembersWithDeferredRefresh({
      patch: async () => {
        calls.push("PATCH");
        throw new Error("save failed");
      },
      applyAcknowledged: () => calls.push("ACK"),
      refresh: async () => calls.push("GET:no-store"),
    }),
    /save failed/,
  );
  assert.deepEqual(calls, ["PATCH"]);
});

test("an absent optional profile column keeps requested chip and message fields, while absent requested columns fail closed", () => {
  const omittedColumns = new Set();
  const displayNameColumnMissing = {
    code: "PGRST204",
    message: "Could not find the 'display_name' column of 'staff_members' in the schema cache",
  };
  const profileMessageColumnMissing = {
    code: "PGRST204",
    message: "Could not find the 'profile_message' column of 'staff_members' in the schema cache",
  };
  const chipColorColumnMissing = {
    code: "42703",
    message: "column staff_members.chip_color_index does not exist",
  };

  omittedColumns.add(getNextStaffProfileOptionalColumn(displayNameColumnMissing, omittedColumns));
  const compatibleRow = omitStaffProfileColumns({
    display_name: "담당자",
    profile_message: "차분한 미용을 도와드려요.",
    chip_color_index: 9,
  }, omittedColumns);

  assert.equal(compatibleRow.display_name, undefined);
  assert.equal(compatibleRow.profile_message, "차분한 미용을 도와드려요.");
  assert.equal(compatibleRow.chip_color_index, 9);
  assert.equal(isMissingRequiredStaffPreferenceColumn(profileMessageColumnMissing), true);
  assert.equal(isMissingRequiredStaffPreferenceColumn(chipColorColumnMissing), true);
  assert.equal(getNextStaffProfileOptionalColumn(profileMessageColumnMissing, new Set()), null);
  assert.equal(getNextStaffProfileOptionalColumn(chipColorColumnMissing, new Set()), null);
});

test("unverified PATCH acknowledgement does not open success feedback or start a bootstrap refresh", async () => {
  const calls = [];
  await assert.rejects(
    saveStaffMembersWithDeferredRefresh({
      patch: async () => {
        calls.push("PATCH");
        return { staffMembers: [{ id: "staff-9", profileMessage: "기본값", chipColorIndex: null }] };
      },
      verifyAcknowledged: () => false,
      applyAcknowledged: () => calls.push("ACK"),
      refresh: async () => calls.push("GET:no-store"),
    }),
    /저장 결과에서 개인 칩 색과 프로필 멘트를 확인하지 못했습니다/,
  );
  assert.deepEqual(calls, ["PATCH"]);
});

test("a no-store requery failure leaves the acknowledged state intact and rejects the success path", async () => {
  const calls = [];
  const result = await saveStaffMembersWithDeferredRefresh({
    patch: async () => {
      calls.push("PATCH");
      return { staffMembers: [{ id: "staff-9", profileMessage: "저장한 멘트", chipColorIndex: 9 }] };
    },
    verifyAcknowledged: () => true,
    applyAcknowledged: () => calls.push("ACK"),
    refresh: async () => {
      calls.push("GET:no-store");
      throw new Error("refresh failed");
    },
  });

  await assert.rejects(result.backgroundRefresh, /refresh failed/);
  assert.deepEqual(calls, ["PATCH", "ACK", "GET:no-store"]);
});

test("staff saves acknowledge immediately, then revalidate without blocking the saved state", () => {
  const preview = source("src/components/owner-web/owner-web-preview.tsx");
  const shell = source("src/components/owner-web/owner-web-app-shell.tsx");
  const screen = source("src/components/owner-web/staff-management-screen.tsx");
  const actions = source("src/components/owner-web/staff-management-ui.tsx");

  assert.match(preview, /saveStaffMembersWithDeferredRefresh\(/);
  assert.match(preview, /verifyAcknowledged: \(acknowledged\) => hasAcknowledgedStaffPreferences/);
  assert.match(preview, /저장 결과를 다시 확인하지 못했습니다\. 입력 내용은 유지했습니다\./);
  assert.match(preview, /setLiveStaffMembers\(acknowledged\.staffMembers\)/);
  assert.match(preview, /cache: "no-store"/);
  assert.match(preview, /function preloadStaffManagementScreen\(\)[\s\S]*?void import\("@\/components\/owner-web\/staff-management-screen"\)/);
  assert.match(preview, /window\.setTimeout\(preloadStaffManagementScreen, 1_200\)/);
  assert.match(preview, /onScreenPrefetch=\{handleScreenPrefetch\}/);
  assert.match(shell, /onMouseEnter=\{\(\) => onScreenPrefetch\?\.\(screen\.key\)\}/);
  assert.match(shell, /onFocus=\{\(\) => onScreenPrefetch\?\.\(screen\.key\)\}/);
  assert.match(screen, /\{ deferEssentialRefresh: true \}/);
  assert.match(screen, /setStaffDetailDialogOpen\(false\)/);
  assert.match(screen, /result\?\.backgroundRefresh/);
  assert.match(screen, /void result\.backgroundRefresh\.catch/);
  assert.doesNotMatch(screen, /await result\.backgroundRefresh/);
  assert.match(screen, /직원 정보는 저장됐지만 최신 정보를 다시 확인하지 못했습니다\./);
  assert.doesNotMatch(screen, /저장한 직원 색은 반영됐습니다/);
  assert.match(preview, /onSaveSuccess=\{undefined\}/);
  assert.doesNotMatch(preview, /onSaveSuccess=\{initialSetupMode/);
  const demoSaveBoundary = preview.slice(preview.indexOf("if (demoMode)"), preview.indexOf("try {", preview.indexOf("if (demoMode)")));
  assert.match(demoSaveBoundary, /applyOwnerData\(nextOwnerData\);/);
  assert.doesNotMatch(demoSaveBoundary, /applyOwnerData\(nextOwnerData, true\)/);
  assert.match(actions, /disabled=\{isSaving\}/);
  assert.match(actions, /className="inline-flex h-11 min-h-11 items-center justify-center rounded-\[8px\] bg-\[#111827\]/);
  assert.doesNotMatch(actions, /h-\[40px\]/);
  assert.match(actions, /\{isSaving \? "저장 중\.\.\." : "저장"\}/);
});

test("route and bootstrap do not silently strip profile message or chip color, and initial setup uses its draft message", () => {
  const route = source("src/app/api/staff-members/route.ts");
  const bootstrap = source("src/server/bootstrap.ts");
  const model = source("src/components/owner-web/staff-management-model.ts");

  assert.match(route, /omitStaffProfileColumns\(row, omittedColumns\)/);
  assert.match(route, /isMissingRequiredStaffPreferenceColumn\(upsertResult\.error\)/);
  assert.doesNotMatch(route, /legacyRows/);
  assert.match(bootstrap, /loadBootstrapStaffMemberRows\(supabase, shopId\)/);
  assert.match(bootstrap, /isMissingRequiredStaffPreferenceColumn\(result\.error\)/);
  assert.doesNotMatch(bootstrap, /legacyStaffMembersRes/);
  assert.match(model, /profileMessage: draft\.profileMessage\.trim\(\)/);
});
