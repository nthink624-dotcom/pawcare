import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const [ownerApp, customerDetailUi] = await Promise.all([
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-customer-detail-ui.tsx", import.meta.url), "utf8"),
]);

test("customer empty state keeps the list surface consistent and omits helper copy", () => {
  assert.match(
    ownerApp,
    /activeTab === "customers" && !selectedGuardian && "bg-\[#f6f9fc\]"/,
    "the customer scroll surface should keep the same pale blue background below the list",
  );
  assert.match(
    ownerApp,
    /<CustomerEmptyState\s+title=\{customerEmptyTitle\}\s+action=/,
    "the standard customer empty state should render without a description",
  );
  assert.doesNotMatch(
    ownerApp,
    /<CustomerEmptyState\s+title=\{customerEmptyTitle\}\s+description=/,
    "the removed helper description must not return",
  );
  assert.match(customerDetailUi, /description\?: string/);
  assert.match(customerDetailUi, /border-\[#dce7f2\] bg-white/);
  assert.doesNotMatch(customerDetailUi, /CustomerEmptyState[\s\S]{0,300}bg-\[#fcfaf7\]/);
});
