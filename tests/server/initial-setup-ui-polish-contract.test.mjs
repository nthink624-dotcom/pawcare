import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("initial setup polish keeps the hard gate while removing its footer", async () => {
  const modal = await source("src/components/owner-web/owner-initial-setup-blocking-modal.tsx");
  assert.match(modal, /border-\[#fecaca\] bg-\[#fef2f2\][\s\S]*text-\[#b91c1c\]/);
  assert.match(modal, /data-owner-setup-blocking-action/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.doesNotMatch(modal, /함께 고쳐요|도움 문의|aria-label="설정 도움"/);
});

test("initial setup keeps actions in one responsive header and promotes checklist controls", async () => {
  const guide = await source("src/components/owner-web/owner-initial-setup-guide.tsx");
  assert.match(guide, /data-testid="owner-initial-setup-title-actions"[\s\S]*저장하고 나중에[\s\S]*data-testid="owner-initial-setup-header-actions"[\s\S]*초기 설정 닫기/);
  assert.doesNotMatch(guide, /mt-3 flex min-h-11 min-w-0 justify-end empty:hidden/);
  assert.match(guide, /text-\[16px\] font-medium leading-6 text-\[#15213b\]/);
  assert.match(guide, /<OwnerInitialSetupPrimaryAction>[\s\S]*onSave[\s\S]*onNext/);
  assert.match(guide, /min-h-11[\s\S]*\$\{OWNER_TYPOGRAPHY\.control\}[\s\S]*저장하고 나중에/);
});

test("staff setup removes blank live-region space while keeping announcements and field roles", async () => {
  const panel = await source("src/components/owner-web/initial-setup-staff-management-panel.tsx");
  assert.match(panel, /const hasVisibleFeedback = Boolean\(feedback\) \|\| saveState === "dirty" \|\| saveState === "saved"/);
  assert.match(panel, /hasVisibleFeedback \? "mb-4" : "sr-only"/);
  assert.doesNotMatch(panel, /mb-4 min-h-5/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /text-\[18px\] font-semibold leading-\[26px\] text-\[#15213b\]">직원 목록/);
  assert.match(panel, /text-\[14px\] font-medium leading-5 text-\[#475569\]">이름/);
  assert.match(panel, /text-\[16px\] font-medium leading-6/);
});
