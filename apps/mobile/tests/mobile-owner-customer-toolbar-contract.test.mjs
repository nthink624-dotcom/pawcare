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
  assert.match(toolbar, /<input[\s\S]*?className="block h-11 w-full/);
  assert.match(toolbar, /aria-label="고객 검색"/);
  assert.match(toolbar, /inline-flex h-11 w-11/);
  assert.match(toolbar, /focus-visible:ring-2 focus-visible:ring-\[#2563eb\]/);
});

test("customer toolbar no longer shows the all/loyal/new filter chips", () => {
  assert.doesNotMatch(toolbar, /aria-label="고객 분류 필터"/);
  assert.doesNotMatch(toolbar, /key: "loyal"/);
  assert.doesNotMatch(toolbar, /key: "first_visit"/);
  assert.doesNotMatch(toolbar, /이번 달 방문/);
});

test("owner app connects customer search and the delete-mode handler without a filter", () => {
  assert.match(ownerApp, /<OwnerCustomerListToolbar/);
  assert.match(ownerApp, /customerSearch=\{customerSearch\}/);
  assert.match(ownerApp, /onCustomerSearchChange=\{setCustomerSearch\}/);
  assert.doesNotMatch(ownerApp, /customerFilter=\{customerFilter\}/);
  assert.doesNotMatch(ownerApp, /onCustomerFilterChange=/);
  assert.doesNotMatch(ownerApp, /isRecent: recentActivity/);
  assert.match(ownerApp, /if \(prev\) setSelectedGuardianIds\(\[\]\)/);
});
