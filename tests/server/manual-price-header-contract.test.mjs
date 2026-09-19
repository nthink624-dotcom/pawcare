import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("direct price registration starts at the matrix while other table consumers retain their headers", async () => {
  const [manual, inlineTable] = await Promise.all([
    source("src/components/owner-web/price-guide-manual-onboarding.tsx"),
    source("src/components/owner-web/price-guide-native-inline-table.tsx"),
  ]);

  assert.match(manual, /!manualMatrixMode \? \([\s\S]*등록 방식으로 돌아가기/);
  assert.match(manual, /priceFirstDurationControls=\{manualMatrixMode\}[\s\S]*hideHeader=\{manualMatrixMode\}/);
  assert.doesNotMatch(manual, /headerSlot=|data-price-guide-manual-header|aria-label="등록 방식으로 돌아가기"/);
  assert.match(inlineTable, /headerSlot\?: ReactNode/);
  assert.match(inlineTable, /hideHeader\?: boolean/);
  assert.match(inlineTable, /hideHeader \? null : headerSlot \? \([\s\S]*<header className="pb-2">\{headerSlot\}<\/header>/);
  assert.match(inlineTable, /hideHeader \? "mt-0 space-y-3" : "mt-4 space-y-3"/);
  assert.match(inlineTable, /<header className="border-b border-\[#e2e8f0\] pb-3">[\s\S]*\{heading\}/);
  assert.match(inlineTable, /<h3 className="text-\[18px\] font-semibold leading-\[26px\][\s\S]*서비스별 예상시간/);
  assert.match(inlineTable, /text-\[16px\] font-medium leading-6 text-\[#52657a\][\s\S]*시간 미설정 \{unresolvedDurationGroups\.length\}개/);
});
