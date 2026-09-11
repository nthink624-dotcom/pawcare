import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createOwnerFeedbackPayload,
  ownerFeedbackBody,
  ownerFeedbackCategory,
  ownerFeedbackScreenKey,
} from "../../src/components/owner-web/owner-feedback-adapter.ts";

const dialogPath = new URL("../../src/components/owner-web/owner-feature-request-dialog.tsx", import.meta.url);
const shellPath = new URL("../../src/components/owner-web/owner-web-app-shell.tsx", import.meta.url);
const previewPath = new URL("../../src/app/dev/owner-feedback-preview/page.tsx", import.meta.url);

test("owner feedback adapter emits only the server allowlist and stable screen context", () => {
  const payload = createOwnerFeedbackPayload({
    shopId: "shop-1",
    requestId: "00000000-0000-4000-8000-000000000001",
    kind: "inquiry",
    body: "도와주세요",
    screen: "customers",
  });
  assert.deepEqual(Object.keys(payload), ["shopId", "requestId", "category", "body", "screenKey", "appVersion", "screenshot"]);
  assert.equal(payload.category, "inquiry");
  assert.equal(payload.body, "도와주세요");
  assert.equal(payload.screenshot, null);
  assert.equal(payload.screenKey, "customers");
  for (const forbidden of ["ownerName", "ownerPhone", "customer", "pet", "appointment", "photo", "audio", "device", "log", "url", "token", "userAgent"]) {
    assert.equal(forbidden in payload, false);
  }
  assert.equal(ownerFeedbackCategory("bug"), "bug");
  assert.equal(ownerFeedbackBody("  한 글자  "), "한 글자");
  assert.equal(ownerFeedbackScreenKey("operatingHours"), "shop_settings");
});

test("dialog is compact, one-submit guarded, draft-preserving, and explicit about screenshot privacy", async () => {
  const dialog = await readFile(dialogPath, "utf8");
  assert.match(dialog, /max-w-\[480px\]/);
  assert.match(dialog, /문의·의견 보내기/);
  assert.match(dialog, /ownerFeedbackKinds\.map/);
  assert.match(dialog, /body\.trim\(\)\.length > 0/);
  assert.doesNotMatch(dialog, /length >= 10|10자 이상|rating|contact|ownerPhone|ownerName|userAgent|location\.href/);
  assert.match(dialog, /submittingRef\.current/);
  assert.match(dialog, /requestIdRef\.current \?\? crypto\.randomUUID\(\)/);
  assert.match(dialog, /스크린샷 첨부/);
  assert.match(dialog, /자동으로 수집하지 않습니다/);
  assert.match(dialog, /uploadOwnerFeedbackScreenshot\(shopId, screenshot\)/);
  assert.match(dialog, /screenshotReceipt \?\?/);
  assert.match(dialog, /screenshotAccepted/);
  assert.match(dialog, /fetchApiJsonWithAuth<FeedbackAcknowledgement>\("\/api\/owner\/tester-feedback"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.ok((dialog.match(/h-11|min-h-11/g) ?? []).length >= 8);
});

test("global owner shell exposes one-tap neutral entry and tester-only amber emphasis", async () => {
  const shell = await readFile(shellPath, "utf8");
  assert.match(shell, /문의·의견 보내기/);
  assert.match(shell, /aria-label="한마디 메뉴 열기"/);
  assert.match(shell, /aria-haspopup="menu"/);
  assert.match(shell, /aria-controls=\{hanmadiMenuId\}/);
  assert.match(shell, /id=\{hanmadiMenuId\} role="menu"/);
  assert.match(shell, />새 예약 추가<\/button>/);
  assert.match(shell, />문의 남기기<\/button>/);
  assert.match(shell, />함께 고쳐요<\/button>/);
  assert.ok(shell.indexOf("새 예약 추가") < shell.indexOf("문의 남기기"));
  assert.ok(shell.indexOf("문의 남기기") < shell.indexOf("함께 고쳐요"));
  assert.match(shell, /hanmadiMenuItemRefs\.current\[0\]\?\.focus\(\)/);
  assert.match(shell, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(shell, /event\.key !== "Escape"/);
  assert.match(shell, /hanmadiTriggerRef\.current\?\.focus\(\)/);
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
    assert.match(shell, new RegExp(`event\\.key === "${key}"`));
  }
  assert.match(shell, /inline-flex h-12 w-12/);
  assert.ok((shell.match(/role="menuitem"[^>]+min-h-11/g) ?? []).length === 3);
  assert.match(shell, /isTester && "!border-\[#decda9\] !bg-\[#fffaf0\]/);
  assert.match(shell, /activeScreen=\{activeScreen\}/);
  assert.doesNotMatch(shell, />\s*기능 개선\s*</);
});

test("development preview renders ordinary and tester owner shells with an explicit intercepted transport", async () => {
  const preview = await readFile(previewPath, "utf8");
  assert.match(preview, /process\.env\.NODE_ENV !== "development"/);
  assert.match(preview, /tester === "1"/);
  assert.match(preview, /isPilotMember: tester/);
  assert.match(preview, /feedbackFixtureMode/);
  assert.doesNotMatch(preview, /fetch\(|supabase|api\//i);
});
