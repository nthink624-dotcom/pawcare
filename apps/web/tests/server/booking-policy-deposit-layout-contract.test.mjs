import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(new URL("../../src/components/owner-web/booking-policy-panel.tsx", import.meta.url), "utf8");

test("deposit controls stay readable while loading and the enable switch lives in the settings header", () => {
  assert.match(panel, /<fieldset disabled=\{busy \|\| !editable\}[^\n]*disabled:opacity-100/);
  assert.match(panel, /<h3 className="text-\[20px\] font-semibold leading-7">\{depositSection === "settings" \? "[^"]+" : "[^"]+"\}<\/h3>[\s\S]*role="switch" aria-label="[^"]+"/);
  const depositNavigation = panel.match(/<aside className="[^"]*rounded-\[14px\] border border-\[#e4e7ec\] bg-white[^"]*">([\s\S]*?)<\/aside>/)?.[1] ?? "";
  assert.notEqual(depositNavigation, "");
  assert.doesNotMatch(depositNavigation, /role="switch" aria-label="[^"]+"/);
  assert.match(panel, /<BookingDepositAlimtalkPreview shopId=\{shopId\} policy=\{policy\} loaded=\{loaded\} \/>/);
});

test("deposit mode switch persists immediately through the scoped API", () => {
  assert.match(panel, /async function updateDepositMode\(nextMode: BookingPolicy\["depositMode"\]\)/);
  assert.match(panel, /method: "PATCH"[\s\S]*JSON\.stringify\(\{ shopId, version, depositMode: nextMode \}\)/);
  // Selected customers must pay before confirmation; the retired customer-optional mode is not the enable target.
  assert.match(panel, /onClick=\{\(\) => void updateDepositMode\(policy\.depositMode === "off" \? "required" : "off"\)\}/);
  assert.match(panel, /if \(depositBeforeEdit\) \{\s*setDepositModeSaving\(true\);\s*try \{ await save\(\{ \.\.\.policy, depositMode: nextMode \}\); \}/);
  assert.match(panel, /disabled=\{!loaded \|\| busy \|\| !editable \|\| !depositBeforeEdit \|\| depositHoldMinutesExceedsMax\}/);
  assert.match(panel, /catch \(error\) \{\s*setPolicy\(current => \(\{ \.\.\.current, depositMode: previousMode \}\)\)/);
  assert.match(panel, /<fieldset className="m-0 flex min-h-0 min-w-0 flex-1 flex-col border-0 p-0">/);
  assert.doesNotMatch(panel, /fieldset disabled=\{policy\.depositMode === "off"/);
  assert.match(panel, /policy\.depositMode === "off" \? "opacity-50" : ""/);
  assert.doesNotMatch(panel, /deposit-setup-title|showDepositSetupPrompt/);
});

test("bank picker puts the most-used everyday banks first and remains full width with a custom affordance", () => {
  assert.match(panel, /const BANK_OPTIONS = \["KB국민은행", "NH농협은행", "신한은행", "우리은행", "하나은행"/);
  assert.match(panel, /relative w-full min-w-0 max-w-\[480px\]/);
  assert.match(panel, /focus:ring-4 focus:ring-blue-100/);
  assert.match(panel, /aria-label="은행 목록 열기" aria-expanded=\{bankMenuOpen\}/);
});

test("deposit and consent editors share the same footer region and action sizes", () => {
  assert.match(panel, /const policyFooterClass = "flex shrink-0 items-center gap-3 border-t border-\[#edf0f4\] bg-white px-5 py-3"/);
  assert.match(panel, /const policyCancelButtonClass = "min-h-11/);
  assert.match(panel, /const policySaveButtonClass = "min-h-11/);
  assert.equal((panel.match(/\$\{policyFooterClass\}/g) ?? []).length, 2);
  assert.equal((panel.match(/className=\{policyCancelButtonClass\}/g) ?? []).length, 2);
  assert.equal((panel.match(/policySaveButtonClass/g) ?? []).length, 3); // declaration and two save buttons
});
