import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(
  new URL("../../src/components/customer/customer-booking-manage-panel.tsx", import.meta.url),
  "utf8",
);

test("customer booking tracker presents pending before confirmed without treating it as a confirmed booking", () => {
  assert.match(panel, /pending:\s*"예약 대기"/);
  assert.match(panel, /\{ status: "pending", label: "예약 대기" \},\s*\{ status: "confirmed", label: "확정" \}/);
  assert.match(panel, /if \(appointment\.status !== "confirmed"\) return false;/);
});
