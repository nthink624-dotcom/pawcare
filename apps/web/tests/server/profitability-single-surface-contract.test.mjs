import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(
  new URL("../../src/components/owner-web/profitability-analytics-screen.tsx", import.meta.url),
  "utf8",
);

test("profitability uses one main surface and divider-only internal regions", () => {
  assert.equal((screen.match(/data-profitability-main-surface/g) ?? []).length, 1);
  assert.match(screen, /data-profitability-main-surface className="[^"]*rounded-\[14px\] border border-\[#e8edf3\] bg-white/);
  assert.match(screen, /data-profitability-kpi-strip className="[^"]*gap-px[^"]*bg-\[#e8edf3\]/);
  assert.doesNotMatch(screen, /rounded-\[10px\] border border-\[#e2e7ee\]|rounded-\[8px\] border border-\[#e7ebf0\]|border-dashed/);
  assert.equal((screen.match(/data-profitability-section=/g) ?? []).length, 4);
  assert.match(screen, /data-profitability-section="insights" className="border-b/);
  assert.match(screen, /divide-y divide-\[#e8edf3\]/);
});

test("profitability preserves its data contract and controls", () => {
  assert.match(screen, /\/api\/owner\/profitability\?shopId=\$\{encodeURIComponent\(shopId\)\}&range=\$\{range\}/);
  assert.match(screen, /reloadKey > 0 \? "&refresh=1" : ""/);
  assert.match(screen, /const rangeOptions:[\s\S]*최근 30일[\s\S]*최근 90일[\s\S]*최근 1년/);
  assert.match(screen, /min-h-11 min-w-\[88px\]/);
  assert.match(screen, /aria-label="분석 새로고침"[\s\S]{0,260}h-11 w-11/);
  for (const label of ["실수령 매출", "시간당 매출", "평균 예상 차이", "분석 완료 건", "할인 영향", "분석 기간", "표본", "현재 평균 → 권장"]) {
    assert.match(screen, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("profitability keeps typography, states, and local table scrolling", () => {
  assert.doesNotMatch(screen, /font-(?:bold|extrabold|black)/);
  assert.match(screen, /text-\[20px\] font-semibold leading-7/);
  assert.match(screen, /text-\[18px\] font-semibold leading-\[26px\]/);
  assert.match(screen, /text-\[14px\] font-normal leading-5 tabular-nums/);
  assert.match(screen, /data-profitability-state="error"/);
  assert.match(screen, /data-profitability-state="loading"/);
  assert.match(screen, /분석할 완료 기록이 아직 없습니다/);
  assert.equal((screen.match(/overflow-x-auto border-t border-\[#e8edf3\]/g) ?? []).length, 2);
  assert.match(screen, /min-w-\[520px\]/);
  assert.match(screen, /min-w-\[900px\]/);
});
