import assert from "node:assert/strict";
import test from "node:test";

import { getReleaseReadinessSummary, RELEASE_READINESS_ITEMS } from "../../src/lib/admin-release-readiness.ts";

test("release summary stays compact and keeps blockers visible", () => {
  const summary = getReleaseReadinessSummary();

  assert.equal(summary.releaseStatus, "blocked");
  assert.ok(summary.counts.p0 > 0);
  assert.equal(summary.important.length, 5);
  assert.equal(summary.actions.length, 3);
  assert.ok(summary.important.every((item) => !("detail" in item)));
  assert.ok(summary.important.filter((item) => item.priority === "P0").length >= 2);
});

test("details remain separate and approvals identify a real decision", () => {
  assert.ok(RELEASE_READINESS_ITEMS.length > 5);
  assert.ok(RELEASE_READINESS_ITEMS.every((item) => item.detail.length > 0));
  assert.ok(RELEASE_READINESS_ITEMS.filter((item) => item.approval).every((item) => item.nextAction.length > 0));
});
