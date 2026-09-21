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
  assert.doesNotMatch(businessHoursDialog, /items-end justify-center|rounded-t-\[28px\]|h-1\.5 w-12 rounded-full bg-stone-200/);
});
