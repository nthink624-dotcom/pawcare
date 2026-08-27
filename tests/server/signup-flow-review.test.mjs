import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildSignupFlowReviewManifest,
  signupFlowCaptureIds,
  signupFlowReviewItems,
} from "../../src/lib/admin/signup-flow-review-contract.ts";

test("actual signup source inventory contains exactly the three current UI stages", () => {
  const inventory = signupFlowReviewItems.filter((item) => item.group === "happy_path");
  assert.deepEqual(inventory.map((item) => item.screenName), ["약관 동의", "계정 정보", "매장 정보"]);
  assert.equal(inventory.every((item) => item.route === "/signup"), true);
  assert.equal(inventory.every((item) => item.status === "captured"), true);
});

test("captured review states are allowlisted and use local synthetic fixtures", () => {
  const captured = signupFlowReviewItems.filter((item) => item.status === "captured");
  assert.equal(captured.length, signupFlowCaptureIds.length);
  assert.equal(captured.every((item) => item.source === "actual_local_capture"), true);
  assert.equal(captured.every((item) => item.fixture && item.viewport === "390x844"), true);
  assert.equal(captured.every((item) => item.captureId && signupFlowCaptureIds.includes(item.captureId)), true);
});

test("AI price-guide states are not misrepresented as signup captures", () => {
  const aiStates = signupFlowReviewItems.filter((item) => item.id.startsWith("state-ai-price"));
  assert.equal(aiStates.length, 3);
  assert.equal(aiStates.every((item) => item.status === "implementation_waiting"), true);
  assert.equal(aiStates.every((item) => !item.captureUrl), true);
  assert.equal(aiStates.every((item) => item.source === "source_inventory"), true);
});

test("manifest counts only actual current signup stages as inventory", () => {
  const manifest = buildSignupFlowReviewManifest("2026-08-27T00:00:00.000Z");
  assert.equal(manifest.inventoryCount, 3);
  assert.equal(manifest.capturedInventoryCount, 3);
  assert.equal(manifest.generatedAt, "2026-08-27T00:00:00.000Z");
});

test("review metadata contains no private query, token, or raw credential values", () => {
  const serialized = JSON.stringify(signupFlowReviewItems);
  assert.equal(/(?:access|refresh|verification)[_-]?token/i.test(serialized), false);
  assert.equal(/[?&](?:email|phone|token|password)=/i.test(serialized), false);
  assert.equal(/\b\d{3}-\d{3,4}-\d{4}\b/.test(serialized), false);
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized), false);
});

test("gallery uses the admin type system and approved radius roles", async () => {
  const source = await readFile(new URL("../../src/components/admin/signup-flow-review-gallery.tsx", import.meta.url), "utf8");
  assert.match(source, /ADMIN_TYPOGRAPHY as T/);
  assert.equal((source.match(/text-\[(?:\d|clamp|calc)/g) ?? []).length, 0);
  assert.equal((source.match(/rounded-(?:xl|lg|md|sm)|rounded-\[(?!(?:8|10|14|18)px\])/g) ?? []).length, 0);
});
