import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const toolbarPath = new URL("../src/components/owner/owner-customer-list-toolbar.tsx", import.meta.url);
const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const [toolbar, ownerApp] = await Promise.all([
  readFile(toolbarPath, "utf8"),
  readFile(ownerAppPath, "utf8"),
]);

test("customer toolbar keeps the search and delete actions compact and accessible", () => {
  assert.match(toolbar, /data-testid="customer-list-toolbar"/);
  assert.match(toolbar, /flex h-11 min-w-0 flex-1 items-center rounded-\[14px\]/);
  assert.match(toolbar, /aria-label="고객 검색"/);
  assert.match(toolbar, /inline-flex h-11 w-11/);
  assert.match(toolbar, /focus-visible:ring-2 focus-visible:ring-\[#2563eb\]/);
});

test("customer filter controls remove the stale monthly visit option", () => {
  assert.match(toolbar, /aria-label="고객 분류 필터"/);
  assert.match(toolbar, /min-h-11/);
  assert.match(toolbar, /aria-pressed=\{selected\}/);
  assert.match(toolbar, /key: "all"/);
  assert.match(toolbar, /key: "loyal"/);
  assert.match(toolbar, /key: "first_visit"/);
  assert.doesNotMatch(toolbar, /이번 달 방문/);
});

test("owner app connects canonical customer filters and the delete-mode handler", () => {
  assert.match(ownerApp, /<OwnerCustomerListToolbar/);
  assert.match(ownerApp, /customerSearch=\{customerSearch\}/);
  assert.match(ownerApp, /customerFilter=\{customerFilter\}/);
  assert.match(ownerApp, /customerFilterCounts=\{customerFilterCounts\}/);
  assert.match(ownerApp, /onCustomerSearchChange=\{setCustomerSearch\}/);
  assert.match(ownerApp, /onCustomerFilterChange=\{setCustomerFilter\}/);
  assert.match(ownerApp, /customer_visit_type === "first_visit"/);
  assert.match(ownerApp, /customer_grade_override/);
  assert.doesNotMatch(ownerApp, /isRecent: recentActivity/);
  assert.match(ownerApp, /if \(prev\) setSelectedGuardianIds\(\[\]\)/);
});
