import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const toolbar = readFileSync(new URL("../../src/components/owner-web/calendar-toolbar.tsx", import.meta.url), "utf8");

test("schedule date navigation keeps every important target at 44px without changing date actions", () => {
  assert.match(
    toolbar,
    /onClick=\{\(\) => onDateChange\(addDate\(selectedDate, -dateStep\)\)\}[\s\S]*?className="inline-flex h-11 w-11[^"\n]*"[\s\S]*?aria-label="이전 날짜"/,
  );
  assert.match(
    toolbar,
    /onClick=\{\(\) => onDateChange\(currentDateInTimeZone\(\)\)\}[\s\S]*?className="inline-flex h-11 min-w-\[158px\][^"\n]*text-\[16px\] font-semibold[^"\n]*"/,
  );
  assert.match(
    toolbar,
    /onClick=\{\(\) => onDateChange\(addDate\(selectedDate, dateStep\)\)\}[\s\S]*?className="inline-flex h-11 w-11[^"\n]*"[\s\S]*?aria-label="다음 날짜"/,
  );
  assert.doesNotMatch(toolbar, /h-8 min-w-\[158px\]/);
});

test("schedule toolbar preserves the approved Korean date hierarchy and other 44px actions", () => {
  assert.match(toolbar, /if \(shop && isShopClosedOnDate\(shop, date\)\) return "휴무일"/);
  assert.match(toolbar, /if \(date === today\) return "오늘"/);
  assert.match(toolbar, /if \(date === addDate\(today, 1\)\) return "내일"/);
  assert.match(toolbar, /if \(date === addDate\(today, 2\)\) return "모레"/);
  assert.match(toolbar, /buttonClassName="!h-11"/);
  assert.match(toolbar, /OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS/);
  assert.match(toolbar, /!text-\[16px\] !font-medium !leading-6 !tracking-\[-0\.005em\]/);
});
