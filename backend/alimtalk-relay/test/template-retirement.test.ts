import assert from "node:assert/strict";
import test from "node:test";
import { retireTemplate } from "../src/template-retirement.js";
import { targetedTemplateReader } from "../src/template-catalog.js";

test("targeted lookup for three active codes never scans 100,000 retired provider records", async () => {
  let calls = 0, active = 0, peak = 0;
  const read = targetedTemplateReader(async code => { calls++; active++; peak = Math.max(peak, active); await Promise.resolve(); active--; return code; }, () => 300_000);
  const codes = ["ACTIVE_A", "ACTIVE_B", "PENDING_C"];
  const result = await Promise.all(Array.from({ length: 1_000 }, (_, i) => read.read(codes[i % 3])));
  assert.equal(result.length, 1_000); assert.equal(calls, 3); assert(peak <= 6);
});
test("concurrent batches share a global six-call detail pool", async () => {
  let active = 0, peak = 0;
  const read = targetedTemplateReader(async code => { active++; peak = Math.max(peak, active); await Promise.resolve(); active--; return code; }, () => 60_000);
  await Promise.all(Array.from({ length: 500 }, (_, i) => read.read(String(i))));
  assert.equal(peak, 6); assert.equal(active, 0);
});
test("approved template is stopped only after fresh read, and completion requires stopped readback", async () => {
  let service = "A", writes = 0, reads = 0;
  const read = async () => { reads++; return { inspectionStatus: "APR", serviceStatus: service }; };
  assert.equal(await retireTemplate("A", read, async () => { writes++; service = "S"; }, async () => { throw Error("wrong endpoint"); }), "stopped");
  assert.equal(reads, 2); assert.equal(writes, 1);
  assert.equal(await retireTemplate("A", read, async () => { writes++; }, async () => {}), "stopped");
  assert.equal(writes, 1);
});
test("uncertain stop is read back on next attempt instead of repeating the provider write", async () => {
  let service = "A", writes = 0;
  const read = async () => ({ inspectionStatus: "APR", serviceStatus: service });
  const stop = async () => { writes++; service = "S"; throw Error("timeout after acceptance"); };
  await assert.rejects(retireTemplate("A", read, stop, async () => {}));
  assert.equal(await retireTemplate("A", read, stop, async () => {}), "stopped");
  assert.equal(writes, 1);
});
test("provider acknowledgment without stopped state is not success; unknown review states are manual", async () => {
  assert.equal(await retireTemplate("A", async () => ({ inspectionStatus: "APR", serviceStatus: "A" }), async () => {}, async () => {}), "unknown");
  let writes = 0;
  assert.equal(await retireTemplate("A", async () => ({ inspectionStatus: "REG", serviceStatus: "R" }), async () => { writes++; }, async () => { writes++; }), "manual_review");
  assert.equal(writes, 0);
});
test("pending review cancellation is confirmed and never reported as provider deletion", async () => {
  let inspection = "REQ";
  assert.equal(await retireTemplate("A", async () => ({ inspectionStatus: inspection, serviceStatus: "R" }), async () => { throw Error("wrong endpoint"); }, async () => { inspection = "REG"; }), "review_cancelled");
});
