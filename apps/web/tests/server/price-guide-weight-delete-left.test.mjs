import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("weight deletion stays with the sticky weight cell and confirms before changing the guide", async () => {
  const source = await readFile(new URL("../../src/components/owner-web/price-guide-native-inline-table.tsx", import.meta.url), "utf8");
  assert.match(source, /tableWidth = Math\.max\(760, 120 \+ group\.serviceNames\.length \* 210\)/);
  assert.match(source, /sticky left-0 z-20 w-\[120px\]/);
  assert.match(source, /!w-auto min-w-0 flex-1 px-1\.5/);
  assert.match(source, /data-price-guide-weight-delete=\{weightIndex\}/);
  assert.match(source, /window\.confirm\(`\$\{groupName\} \$\{weightLabel\} 체급을 삭제할까요\?\\n이 몸무게 구간의 모든 서비스 요금이 삭제됩니다\.`\)/);
  assert.match(source, /if \(!window\.confirm[\s\S]*\) return;[\s\S]*removeDirectPriceGuideWeightBand\(guide, groupIndex, weightIndex\)/);
  assert.doesNotMatch(source, /행 관리/);
});
