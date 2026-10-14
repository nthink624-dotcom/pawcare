import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (name) => readFileSync(new URL(`../../src/components/owner-web/${name}.tsx`, import.meta.url), "utf8");

test("customer table uses requested 16/24 body with regular pet names and medium customer names", () => {
  const table = source("customer-management-table");
  assert.match(table, /data-customer-management-table[^>]*text-\[16px\] font-normal leading-6/);
  assert.match(table, /text-center text-\[16px\] font-medium leading-6[^>]*title=\{row.name\}/);
  assert.match(table, /text-center font-normal[^>]*title=\{row.pets/);
});

test("editable customer body is exempt from compact button typography", () => {
  const detail = source("customer-detail-panel").split("function InlineEditableText(")[1];
  assert.ok(detail);
  assert.match(detail, /onClick=\{\(\) => setEditing\(true\)\}[\s\S]*?data-owner-control-size="content"/);
  assert.match(detail, /text-left text-\[16px\] font-normal leading-6/);
});

test("customer creation labels and title use distinct typography roles", () => {
  const modal = source("customer-management-screen").split("function NewCustomerModal(")[1].split("function CustomerDetailSheet(")[0];
  assert.match(modal, /text-\[20px\] font-semibold leading-7/);
  assert.match(modal, /text-\[14px\] font-medium leading-5[^>]*>반려동물 이름/);
  assert.doesNotMatch(modal, /<span[^>]*text-\[16px\][^>]*text-\[#64748b\]/);
});
