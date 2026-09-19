import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const source = path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
test("photo and manual tables share scoped explicit weight-duration controls",async()=>{
 const table=await source("src/components/owner-web/price-guide-native-inline-table.tsx");
 const control=await source("src/components/owner-web/price-guide-service-duration-control.tsx");
 assert.doesNotMatch(table,/서비스별 예상시간|전체 체급에 적용|data-price-guide-average-time-notice/);
 assert.match(table,/\{durationGroup \? <PriceGuideServiceDurationControl/);
 assert.match(table,/applyWeightDurationUpdates\(guide, updates\)/);
 assert.match(table,/label: group.weightBands\[weightIndex\]\?\.label/);
 assert.match(table,/data-price-left-time-right="true"/);
 assert.match(control,/explicitDurationUpdates\(targets, values\)/);
 assert.doesNotMatch(control,/proposeWeightDurations|기준 체중|증가 시간/);
 assert.match(control,/placeholder="미정"/);
});