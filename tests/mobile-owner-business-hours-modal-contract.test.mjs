import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settings = await readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8");
const closuresSection = settings.slice(
  settings.indexOf("  const closuresSection = ("),
  settings.indexOf("  const priceGuideSection = ("),
);
const businessHoursDialog = settings.slice(
  settings.indexOf("function BusinessHoursSheet("),
  settings.indexOf("function ClosedDatePickerSheet("),
);

test("business-hour overview uses one consistent chevron row pattern", () => {
  assert.doesNotMatch(closuresSection, /일괄 적용/);
  assert.match(closuresSection, /전체 시간 설정<\/span>[\s\S]{0,300}<ChevronRight aria-hidden="true"/);
  assert.match(closuresSection, /w-14 shrink-0 items-center whitespace-nowrap text-\[16px\] leading-6[\s\S]{0,220}\{weekdayLabels\[day\]\}요일/);
});

test("business-hour editor is a centered accessible modal", () => {
  assert.match(businessHoursDialog, /fixed inset-0 z-40 flex items-center justify-center bg-black\/30 px-4 py-6/);
  assert.match(businessHoursDialog, /role="dialog"[\s\S]{0,120}aria-modal="true"[\s\S]{0,260}max-w-\[398px\][\s\S]{0,120}rounded-\[18px\]/);
  assert.match(businessHoursDialog, /<div className="space-y-3">/);
  assert.doesNotMatch(businessHoursDialog, /space-y-2\.5 rounded-\[10px\] border border-\[var\(--border\)\] bg-\[var\(--surface\)\] p-3\.5/);
  assert.doesNotMatch(businessHoursDialog, /items-end justify-center|rounded-t-\[28px\]|h-1\.5 w-12 rounded-full bg-stone-200/);
});

test("closed-day control keeps a compact track inside a full-row button", () => {
  assert.match(businessHoursDialog, /role="switch"[\s\S]{0,100}aria-checked=\{draft\.closed\}[\s\S]{0,260}min-h-14 w-full/);
  assert.match(businessHoursDialog, /inline-flex h-7 w-\[52px\][\s\S]{0,360}block h-6 w-6/);
  assert.doesNotMatch(businessHoursDialog, /<Switch[\s\S]{0,240}h-11 w-\[52px\]/);
});
