import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../../src/components/owner-web/discount-service-scope.ts", import.meta.url), "utf8");
const { buildDiscountServiceScopeOptions } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const option = (id, category, overrides = {}) => ({ id, category, displayName: "목욕", sourceName: `${category} / 목욕`, price: 10000, durationMinutes: 30, ...overrides });

test("benefit scope groups species and weight-price variants while retaining every target ID", () => {
  const rows = buildDiscountServiceScopeOptions([
    option("dog-small", "강아지 / 소형견"),
    option("dog-large", "강아지 / 소형견", {price: 20000, durationMinutes: 50}),
    option("cat", "고양이 / 소형견", {aliasIds: ["legacy-cat"]}),
    option("medium", "강아지 / 중형견"),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].sourceName, "소형견 / 목욕");
  assert.deepEqual(rows[0].linkedOptionIds, ["dog-small", "dog-large", "cat", "legacy-cat"]);
  assert.equal(rows[1].sourceName, "중형견 / 목욕");
  const selectedIds = [...rows[0].linkedOptionIds, ...rows[1].linkedOptionIds];
  assert.deepEqual(selectedIds.filter(id => !rows[0].linkedOptionIds.includes(id)), ["medium"]);
});

test("unclassified services remain service-only and different service names stay distinct", () => {
  const rows = buildDiscountServiceScopeOptions([option("one", "강아지"), option("two", "고양이", {displayName:"전체 미용"})]);
  assert.deepEqual(rows.map(row => row.sourceName), ["목욕", "전체 미용"]);
});
