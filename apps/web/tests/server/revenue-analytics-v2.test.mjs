import assert from "node:assert/strict";
import test from "node:test";
import { buildRevenueChart, resolveRevenuePeriod, revenueComparison, revenueCsvCell, shiftRevenueMonth } from "../../src/lib/revenue-analytics.ts";
import { parseRevenueCashMutation, parseRevenueQuery } from "../../src/server/revenue-analytics.ts";
import { clearRevenueCashAttempt, persistRevenueCashAttempt, restoreRevenueCashAttempt } from "../../src/lib/revenue-cash-attempt.ts";

const now = new Date("2026-10-30T03:00:00Z");
test("presets use calendar months and matching previous dates in Korea", () => {
  assert.deepEqual(resolveRevenuePeriod("quarter", undefined, now), { preset: "quarter", from: "2026-08-01", to: "2026-10-30", previousFrom: "2026-05-01", previousTo: "2026-07-30" });
  assert.equal(resolveRevenuePeriod("year", undefined, now).previousFrom, "2025-01-01");
  assert.equal(resolveRevenuePeriod("year", undefined, now).previousTo, "2025-10-30");
  assert.equal(resolveRevenuePeriod("previous_month", undefined, now).previousTo, "2026-08-31");
  assert.equal(resolveRevenuePeriod("today", undefined, new Date("2026-10-29T15:01:00Z")).from, "2026-10-30");
  assert.equal(shiftRevenueMonth("2024-03-31", -1), "2024-02-29");
});
test("custom dates reject impossible, reversed, future and unbounded ranges", () => {
  for (const custom of [{ from: "2026-02-30", to: "2026-10-30" }, { from: "2026-10-30", to: "2026-10-29" }, { from: "2026-01-01", to: "2026-10-31" }, { from: "2000-01-01", to: "2026-10-30" }]) assert.throws(() => resolveRevenuePeriod("custom", custom, now));
  assert.equal(resolveRevenuePeriod("custom", { from: "2026-10-01", to: "2026-10-16" }, now).previousFrom, "2026-09-15");
});
test("snapshot pagination and exports retain their Korea calendar period after midnight", () => {
  for (const snapshotAt of ["2026-10-31T14:59:59Z", "2026-12-31T14:59:59Z"]) {
    const captured = new Date(snapshotAt);
    const afterMidnight = new Date(captured.getTime() + 120_000);
    for (const preset of ["today", "yesterday", "month", "previous_month", "quarter", "year"]) {
      const query = parseRevenueQuery(new URLSearchParams({ preset, page: "2", snapshotAt, cashSnapshot: "10:20:" }), afterMidnight);
      assert.deepEqual(query.period, resolveRevenuePeriod(preset, undefined, captured), `${preset} at ${snapshotAt}`);
      assert.equal(query.snapshotAt, snapshotAt);
    }
  }
  const query = parseRevenueQuery(new URLSearchParams({ preset: "month", date: "2026-10-31", snapshotAt: "2026-10-31T14:59:59Z", cashSnapshot: "10:20:" }), new Date("2026-10-31T15:01:00Z"));
  assert.equal(query.filters.date, "2026-10-31");
  const slightClockSkew = parseRevenueQuery(new URLSearchParams({ preset: "month", snapshotAt: "2026-10-31T15:00:00Z", cashSnapshot: "10:20:" }), new Date("2026-10-31T14:59:30Z"));
  assert.equal(slightClockSkew.period.to, "2026-10-31");
});
test("pending cash attempts survive remount, preserve identity, and clear only after acknowledgement", () => {
  const rows = new Map();
  const store = { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value), removeItem: key => rows.delete(key) };
  const scope = { shopId: "shop-a", entryId: "12345678-1234-4234-8234-123456789013", type: "payment" };
  const request = { requestId: "12345678-1234-4234-8234-123456789012", entryId: scope.entryId, type: "payment", occurredAt: "2026-10-30T01:00:00Z", tenders: [{ method: "cash", amount: 30 }] };
  persistRevenueCashAttempt(store, scope, request);
  assert.deepEqual(restoreRevenueCashAttempt(store, scope), request);
  assert.equal(restoreRevenueCashAttempt(store, { ...scope, shopId: "other-shop" }), null);
  assert.throws(() => persistRevenueCashAttempt(store, scope, { ...request, requestId: "12345678-1234-4234-8234-123456789014" }));
  clearRevenueCashAttempt(store, scope, "wrong-request");
  assert.deepEqual(restoreRevenueCashAttempt(store, scope), request);
  clearRevenueCashAttempt(store, scope, request.requestId);
  assert.equal(restoreRevenueCashAttempt(store, scope), null);
  assert.throws(() => persistRevenueCashAttempt({ ...store, setItem: () => { throw new Error("full"); } }, scope, request), /저장하지 않았습니다/);
});
test("zero previous revenue is distinct from no previous transactions", () => {
  assert.match(revenueComparison(10000, 0, 2), /이전 기간 0원/);
  assert.match(revenueComparison(10000, 0, 0), /이전 기간 거래 없음/);
  assert.equal(revenueComparison(15000, 10000, 1), "이전 기간보다 +50%");
});
test("signed chart buckets preserve negative refunds, totals and date boundaries", () => {
  const period = resolveRevenuePeriod("quarter", undefined, now);
  const rows = buildRevenueChart({ period, daily: [{ date: "2026-08-01", netAmount: 65000, collectedAmount: 65000, refundAmount: 0 }, { date: "2026-10-30", netAmount: -15000, collectedAmount: 0, refundAmount: 15000 }] });
  assert.equal(rows[0].from, period.from);
  assert.equal(rows.at(-1).to, period.to);
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), 50000);
  assert.ok(rows.some(row => row.amount < 0));
});
test("CSV prevents formula injection but retains signed numeric amounts", () => {
  for (const value of ["=WEBSERVICE(1)", " +SUM(A1)", "\t@bad", "-cmd"]) assert.ok(revenueCsvCell(value).startsWith('"\''));
  assert.equal(revenueCsvCell(-15000), "-15000");
  assert.equal(revenueCsvCell('미용,"항목"'), '"미용,""항목"""');
});
test("query and mutation inputs are bounded and cannot smuggle tenant/actor fields", () => {
  const query = parseRevenueQuery(new URLSearchParams("preset=quarter&paymentMethod=cash&page=2"), now);
  assert.equal(query.period.from, "2026-08-01");
  assert.equal(query.filters.paymentMethod, "cash");
  assert.throws(() => parseRevenueQuery(new URLSearchParams("page=0"), now));
  assert.throws(() => parseRevenueQuery(new URLSearchParams("snapshotAt=2026-10-01T00:00:00Z"), now));
  const payload = { requestId: "12345678-1234-4234-8234-123456789012", entryId: "12345678-1234-4234-8234-123456789013", type: "payment", occurredAt: "2026-10-30T01:00:00Z", tenders: [{ method: "card", amount: 5000 }, { method: "cash", amount: 15000 }] };
  assert.equal(parseRevenueCashMutation(payload, now).tenders.length, 2);
  assert.throws(() => parseRevenueCashMutation({ ...payload, shopId: "other-shop" }, now));
  assert.throws(() => parseRevenueCashMutation({ ...payload, type: "refund" }, now));
  assert.throws(() => parseRevenueCashMutation({ ...payload, tenders: [{ method: "card", amount: 1.5 }] }, now));
});
