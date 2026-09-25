import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ownerApp = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");
const dataStart = ownerApp.indexOf("const customerNotificationGroups");
const dataEnd = ownerApp.indexOf("const isAnyCustomerFieldEditing", dataStart);
const uiStart = ownerApp.indexOf('>개인 알림톡</p>');
const uiEnd = ownerApp.indexOf('<div className="space-y-2.5">', uiStart);
const notificationData = ownerApp.slice(dataStart, dataEnd);
const notificationUi = ownerApp.slice(uiStart, uiEnd);

test("customer notification settings keep the approved titles without persistent helper copy", () => {
  for (const title of [
    "알림톡 전체 수신",
    "예약 확정",
    "예약 취소",
    "예약 변경 확정",
    "직전·오늘·내일 안내",
    "미용 시작",
    "픽업 준비",
    "미용 완료",
  ]) {
    assert.match(`${notificationData}\n${notificationUi}`, new RegExp(title.replaceAll("·", "\\·")));
  }

  assert.doesNotMatch(notificationData, /description:/);
  assert.doesNotMatch(
    notificationUi,
    /이 고객에게 발송되는|예약이 확정되었을 때|확정된 예약이 취소되었을 때|변경된 일정이 확정되면|예약 시점에 맞춰|매장에서 미용을 시작했을 때|미용이 거의 끝나|미용이 끝나 고객이/,
  );
});

test("customer notification switches use blue enabled tracks and expose non-color state", () => {
  assert.match(notificationUi, /role="switch"/);
  assert.match(notificationUi, /aria-checked=\{guardianNotificationsEnabled\}/);
  assert.match(notificationUi, /aria-checked=\{active\}/);
  assert.equal((notificationUi.match(/bg-\[#2f6fd6\]/g) ?? []).length, 2);
  assert.doesNotMatch(notificationUi, /bg-\[#2fbf83\]/);
});

test("customer notification controls keep 44px hit targets without helper-height gaps", () => {
  assert.match(notificationUi, /h-11 w-11/);
  assert.match(notificationUi, /min-h-11 w-full/);
  assert.match(notificationUi, /focus-visible:outline/);
  assert.match(notificationUi, /motion-reduce:transition-none/);
  assert.doesNotMatch(notificationUi, /item\.description|mt-1 text-\[13px\]/);
});

test("customer notification section titles use the accessible dark neutral token", () => {
  assert.match(ownerApp, /text-\[#475569\][^>]*>개인 알림톡<\/p>/);
  assert.equal((notificationUi.match(/text-\[#475569\]/g) ?? []).length, 1);
  assert.doesNotMatch(notificationUi, /text-\[#64748b\]/);
});

test("customer notification updates keep the existing readback and save boundary", () => {
  assert.match(ownerApp, /async function updateGuardianNotifications\(guardianId: string, patch: Partial<GuardianNotificationSettings>\)/);
  assert.match(ownerApp, /notification_settings: \{[\s\S]*\.\.\.guardian\.notification_settings,[\s\S]*\.\.\.patch/);
  assert.match(ownerApp, /method: "PATCH",[\s\S]*notificationSettings: patch/);
  assert.match(notificationUi, /updateGuardianNotifications\(selectedGuardian\.id, \{ enabled: !guardianNotificationsEnabled \}\)/);
  assert.match(notificationUi, /updateGuardianNotifications\(selectedGuardian\.id, \{ \[item\.settingKey\]: !active \}\)/);
});
