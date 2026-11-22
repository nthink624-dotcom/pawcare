import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const files = ["profitability-analytics-screen", "revenue-controls", "revenue-chart", "revenue-transactions", "revenue-cash-dialog"].map(name => readFileSync(new URL(`../../src/components/owner-web/${name}.tsx`, import.meta.url), "utf8"));
test("cash analytics uses approved typography roles across its complete surface", () => {
  for (const source of files) {
    assert.doesNotMatch(source, /font-(?:bold|extrabold|black)/);
    const sizes = [...source.matchAll(/text-\[(\d+)px\]/g)].map(match => Number(match[1]));
    assert.ok(sizes.every(size => [12, 13, 14, 16, 18, 20, 24, 28].includes(size)));
  }
});
test("controls, signed chart, errors and cash confirmation remain accessible", () => {
  const all = files.join("\n");
  for (const role of ['aria-busy', 'aria-pressed', 'aria-expanded', 'aria-labelledby', 'role="alert"', 'role="status"', 'min-h-11']) assert.ok(all.includes(role), role);
  for (const label of ["매출 분석", "실제 수금·환불일 기준", "비교", "미수·확인 필요", "실제 환불을 완료한 뒤", "가운데 선은 0원"]) assert.ok(all.includes(label), label);
});
