import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detail = readFileSync(new URL("../../src/components/admin/owner-admin-detail-panel.tsx", import.meta.url), "utf8");
const screen = readFileSync(new URL("../../src/components/admin/owner-admin-screen.tsx", import.meta.url), "utf8");
const typography = readFileSync(new URL("../../src/components/admin/admin-typography.ts", import.meta.url), "utf8");

test("account management keeps one persistent primary save action", () => {
  assert.equal((detail.match(/"변경사항 저장"/g) ?? []).length, 1);
  assert.match(detail, /sticky bottom-0/);
  assert.match(detail, /bg-\[#1D4ED8\]/);
});

test("account management uses the approved blue, neutral, and Korean type roles", () => {
  assert.match(screen, /bg-\[#F4F4F4\]/);
  assert.match(screen, /bg-\[#EFF6FF\]/);
  assert.match(detail, /focus-visible:ring-\[#2563EB\]/);
  assert.match(typography, /label: "text-\[14px\] leading-5 font-medium"/);
  assert.match(typography, /control: "text-\[16px\] leading-6 font-medium"/);
  assert.match(typography, /body: "text-\[16px\] leading-6 font-normal"/);
  assert.match(typography, /sectionTitle: "text-\[20px\] leading-7 font-semibold"/);
  assert.doesNotMatch(typography, /font-bold|font-extrabold/);
});
