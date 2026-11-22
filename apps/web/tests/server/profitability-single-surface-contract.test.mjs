import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = name => readFileSync(new URL(`../../src/components/owner-web/${name}.tsx`, import.meta.url), "utf8");
const screen = read("profitability-analytics-screen");
test("revenue keeps one scroll surface and distinct reusable regions", () => {
  assert.equal((screen.match(/data-profitability-main-surface/g) ?? []).length, 1);
  for (const region of ["RevenueControls", "RevenueChart", "RevenueTransactions", "RevenueCashDialog"]) assert.ok(screen.includes(region));
  assert.ok(screen.split("\n").length < 500);
  assert.doesNotMatch(screen, /border-dashed|font-bold/);
});
test("new cash analytics contract includes full historical lookup, export and transaction actions", () => {
  const all = screen + read("revenue-controls") + read("revenue-transactions");
  for (const text of ["snapshotAt", "contractVersion", "AbortController", "期間 CSV".replace("期間", "기간"), "조회 시작일", "조회 종료일", "매출 담당자", "매출 결제수단", "수금 확인", "환불 기록", "해당 예약 열기"]) assert.ok(all.includes(text), text);
  assert.ok(screen.includes('state.key === key && state.status === "ready"'));
  assert.ok(screen.includes('data-profitability-state="error"'));
  assert.ok(screen.includes('data-profitability-state="loading"'));
});
