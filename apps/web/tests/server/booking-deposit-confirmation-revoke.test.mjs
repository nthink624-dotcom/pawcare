import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actOnDepositLedger, depositError, isLedgerAction } from "../../src/server/booking-deposit-ledger.ts";

test("confirmation revoke is a distinct owner ledger operation", () => {
  assert.equal(isLedgerAction("revoke_deposit"), true);
  assert.equal(isLedgerAction("correct_deposit"), true);
});
test("a customer cannot revoke an owner confirmation before any database work", async () => {
  await assert.rejects(actOnDepositLedger("fixture", "fixture", { action: "revoke_deposit", note: "권한 검사" }, { kind: "customer", userId: null }), error => error.status === 403);
});
test("used/refunded money gives an actionable manual-settlement reason", () => {
  assert.throws(() => depositError({ message: "DEPOSIT_MANUAL_SETTLEMENT_REQUIRED" }), error => error.status === 409 && error.message.includes("수동"));
});
test("revocation does not run the automatic outbox dispatcher", () => {
  const source = readFileSync(new URL("../../src/server/booking-preparation.ts", import.meta.url), "utf8");
  assert.match(source, /if \(input\.action !== "revoke_deposit"\) \{\s*try \{ after\(\(\) => flushDepositOutbox/);
});
test("the time-job hold is derived from audit decisions, not a customer-fraud flag", () => {
  const sql = readFileSync(new URL("../../../../supabase/migrations/20261018110924_booking_deposit_confirmation_revoke_fix.sql", import.meta.url), "utf8");
  assert.match(sql, /e\.action in \('revoke','confirm','correct','retry','waive'\)/);
  assert.match(sql, /pm_deposit_confirmation_review_required\(d\.id\) then continue/);
  assert.doesNotMatch(sql, /create table|add column|create policy|cron\.schedule/i);
});
