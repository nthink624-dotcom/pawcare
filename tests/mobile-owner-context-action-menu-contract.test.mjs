import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const menuPath = new URL("../src/components/owner/owner-context-action-menu.tsx", import.meta.url);
const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const menu = await readFile(menuPath, "utf8");
const ownerApp = await readFile(ownerAppPath, "utf8");

test("the quick-menu trigger keeps a 44px hit area around a compact 40px visual circle", () => {
  assert.match(menu, /MessageSquareWarning, Plus/);
  assert.match(menu, /scheduleAppearance\?: boolean/);
  assert.match(menu, /scheduleAppearance = false/);
  assert.match(menu, /BUTTON_SIZE_PX = 44/);
  assert.match(menu, /className="inline-flex h-11 w-11 touch-none items-center justify-center rounded-full bg-transparent/);
  assert.match(menu, /data-testid="owner-context-action-trigger-visual"/);
  assert.match(menu, /inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-\[0_2px_8px_rgba\(17,26,48,0\.14\)\]/);
  assert.match(menu, /scheduleAppearance \? "border-\[#2f5fb3\] bg-\[#2f5fb3\] text-white" : "text-\[#111a30\]"/);
  assert.match(menu, /scheduleAppearance \? <Plus className="h-4 w-4"/);
  assert.match(menu, /: isTester \? "border-\[#d8c59c\] bg-\[#fff5d9\]" : "border-\[#cfd8e3\] bg-white"/);
  assert.doesNotMatch(menu, /shadow-\[0_5px_16px_rgba/);
});

test("the owner app enables the same blue plus for all four owner tabs", () => {
  assert.match(ownerApp, /scheduleAppearance=\{activeTab === "home" \|\| activeTab === "book" \|\| activeTab === "customers" \|\| activeTab === "settings"\}/);
  assert.equal(ownerApp.match(/scheduleAppearance=/g)?.length, 1);
});

test("open, close, permission, focus, drag, and safe-area contracts stay intact", () => {
  assert.match(ownerApp, /\{!isStaffApp && !modal \? \(/);
  assert.match(menu, /onOpenChange\(!isOpen\)/);
  assert.match(menu, /if \(!isSuppressed \|\| !isOpen\) return/);
  assert.match(menu, /onOpenChange\(false\)/);
  assert.match(menu, /document\.addEventListener\("pointerdown", closeOnOutsidePointer\)/);
  assert.match(menu, /event\.key !== "Escape"/);
  assert.match(menu, /firstActionRef\.current\?\.focus\(\)/);
  assert.match(menu, /triggerRef\.current\?\.focus\(\)/);
  assert.match(menu, /tabIndex=\{isSuppressed \? -1 : undefined\}/);
  assert.match(menu, /runAction\(onAddReservation\)/);
  assert.match(menu, /runAction\(\(\) => onOpenFeedback\("inquiry"\)\)/);
  assert.match(menu, /runAction\(\(\) => onOpenFeedback\("bug"\)\)/);
  assert.match(menu, /fixed z-40/);
  assert.match(menu, /BOTTOM_NAV_CLEARANCE_PX = 84/);
  assert.match(menu, /bottom-\[calc\(env\(safe-area-inset-bottom\)\+84px\)\]/);
  assert.match(menu, /data-suppressed=\{isSuppressed \? "true" : "false"\}/);
});
