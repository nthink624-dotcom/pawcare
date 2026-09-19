import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(
  new URL("../../src/components/owner-web/profitability-analytics-screen.tsx", import.meta.url),
  "utf8",
);

test("profitability typography uses the approved Korean roles", () => {
  assert.doesNotMatch(screen, /font-(?:bold|extrabold|black)/);
  assert.doesNotMatch(screen, /text-\[(?:10|11|15|17|19|21|22|23|25|26|27|29|30|31)px\]/);
  assert.match(screen, /text-\[20px\] font-semibold leading-7[\s\S]*시간당 수익 분석/);
  assert.match(screen, /text-\[18px\] font-semibold leading-\[26px\]/);
  assert.match(screen, /text-\[14px\] font-medium leading-5 text-\[#526174\]/);
  assert.match(screen, /text-\[14px\] font-normal leading-5 tabular-nums/);
  assert.equal((screen.match(/<th className="[^"]*font-medium/g) ?? []).length, 13);
  assert.doesNotMatch(screen, /<th className="(?![^"]*font-medium)[^"]*"/);
});

test("profitability removes redundant service explanation but preserves numeric meaning", () => {
  assert.doesNotMatch(screen, /실제 미용시간과 받은 금액을 연결해|시간당 매출이 낮은 순서입니다/);
  for (const requiredCopy of [
    "실수령 매출",
    "시간당 매출",
    "평균 예상 차이",
    "분석 완료 건",
    "할인 영향",
    "분석 기간",
    "선정 기준 · 평균 10분 이상 지연 · 시간당 매출 매장 기준 대비 -10% 이하",
  ]) {
    assert.match(screen, new RegExp(requiredCopy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("profitability preserves controls and full recommendation labels at narrow widths", () => {
  assert.match(screen, /min-h-11 min-w-\[88px\]/);
  assert.match(screen, /h-11 w-11/);
  assert.match(screen, /overflow-x-auto border-t border-\[#e8edf3\]/);
  assert.match(screen, /whitespace-normal break-words text-\[14px\][^\n]+\[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(screen, /segmentLabel[\s\S]{0,180}(?:truncate|line-clamp)/);
});
