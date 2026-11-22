import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { NextRequest } from "next/server";

let role = "owner";
let actor = "11111111-1111-4111-8111-111111111111";
let calls = [];
let rpcError = null;
const totals = { collectedAmount: 0, refundAmount: 0, netAmount: 0, discountAmount: 0, paidCount: 0, eventCount: 0 };
const snapshot = { cashSnapshot: "10:20:", outstandingRevision: "d41d8cd98f00b204e9800998ecf8427e" };
let detailRevision = snapshot.outstandingRevision;
const report = { ...snapshot, summary: totals, previous: totals, daily: [], categories: [], staff: [], paymentMethods: [], staffOptions: [], outstanding: { amount: 0, count: 0, reviewRequiredCount: 0, through: "2026-10-30" } };
mock.module(new URL("../../src/lib/supabase/server.ts", import.meta.url).href, { namedExports: { getSupabaseAdmin: () => ({ rpc: async (name, params) => { calls.push({ name, params }); return { data: name === "owner_revenue_report_v2" ? report : name === "owner_revenue_transactions_v2" ? { ...snapshot, outstandingRevision: detailRevision, transactions: [], total: 0 } : { requestId: params.p_request_id, reused: false }, error: rpcError }; } }), getSupabaseAuthClient: () => null } });
const actualAuth = await import("../../src/server/owner-api-auth.ts");
mock.module(new URL("../../src/server/owner-api-auth.ts", import.meta.url).href, { namedExports: { ...actualAuth, requireOwnerShop: async (_request, shopId) => { if (!actor) throw new actualAuth.OwnerApiError("로그인이 필요합니다.", 401); if (shopId !== "shop-authorized") throw new actualAuth.OwnerApiError("권한이 없습니다.", 403); return { shopId: "shop-authorized", userId: actor, role, staffId: null }; } } });
let durationCalls = [];
mock.module(new URL("../../src/server/profitability-analytics.ts", import.meta.url).href, { namedExports: { loadProfitabilityPayload: async (shopId, range) => { durationCalls.push({ shopId, range }); return { durationRecommendations: [{ serviceId: "service-a", recommendedMinutes: 60 }], sales: { internal: true } }; } } });
const analytics = await import("../../src/app/api/owner/profitability/route.ts");
const durations = await import("../../src/app/api/owner/service-duration-recommendations/route.ts");
const cash = await import("../../src/app/api/owner/revenue/cash/route.ts");
const exporter = await import("../../src/app/api/owner/revenue/export/route.ts");
const req = (path, init) => new NextRequest("http://127.0.0.1:3000" + path, init);
const payload = { requestId: "12345678-1234-4234-8234-123456789012", entryId: "12345678-1234-4234-8234-123456789013", type: "payment", occurredAt: "2020-10-10T01:00:00Z", tenders: [{ method: "cash", amount: 5000 }] };
const post = body => req("/api/owner/revenue/cash?shopId=shop-authorized", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer fixture-only" }, body: JSON.stringify(body) });

test("cash analytics route/auth/transport contracts", async t => {
  await t.test("service duration keeps its completed-work contract and authorization", async () => {
    durationCalls = []; role = "staff";
    assert.equal((await durations.GET(req("/api/owner/service-duration-recommendations?shopId=shop-authorized"))).status, 403);
    assert.equal(durationCalls.length, 0); role = "owner";
    const response = await durations.GET(req("/api/owner/service-duration-recommendations?shopId=shop-authorized"));
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
    const result = await response.json(); assert.equal(result.durationRecommendations[0].recommendedMinutes, 60); assert.ok(!("sales" in result));
    assert.deepEqual(durationCalls, [{ shopId: "shop-authorized", range: "365d" }]);
  });
  await t.test("legacy clients receive update status rather than a mismatched payload", async () => { assert.equal((await analytics.GET(req("/api/owner/profitability?shopId=shop-authorized"))).status, 426); });
  await t.test("all real reads require owner/manager and exclude unauthorized shops", async () => {
    actor = null; calls = []; assert.equal((await analytics.GET(req("/api/owner/profitability?version=2&shopId=shop-authorized"))).status, 401); assert.equal(calls.length, 0);
    actor = "11111111-1111-4111-8111-111111111111"; role = "staff"; assert.equal((await analytics.GET(req("/api/owner/profitability?version=2&shopId=shop-authorized"))).status, 403); assert.equal(calls.length, 0);
    role = "owner"; assert.equal((await analytics.GET(req("/api/owner/profitability?version=2&shopId=other-shop"))).status, 403);
  });
  await t.test("summary and detail use authorized shop, same filters and same snapshot", async () => {
    calls = []; const response = await analytics.GET(req("/api/owner/profitability?version=2&shopId=shop-authorized&preset=quarter&paymentMethod=cash&staffId=staff-a"));
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal((await response.json()).contractVersion, 2); assert.equal(calls.length, 2);
    for (const call of calls) { assert.equal(call.params.p_shop_id, "shop-authorized"); assert.equal(call.params.p_staff_id, "staff-a"); assert.equal(call.params.p_method, "cash"); }
    assert.equal(calls[0].params.p_snapshot_at, calls[1].params.p_snapshot_at);
    assert.equal(calls[1].params.p_cash_snapshot, snapshot.cashSnapshot);
  });
  await t.test("cash write binds actor/shop on server and rejects body smuggling", async () => {
    calls = []; assert.equal((await cash.POST(post({ ...payload, shopId: "other-shop" }))).status, 400); assert.equal(calls.length, 0);
    const response = await cash.POST(post(payload)); assert.equal(response.status, 200); assert.equal(calls[0].params.p_actor_user_id, actor); assert.equal(calls[0].params.p_shop_id, "shop-authorized");
  });
  await t.test("cookie writes need same origin and demo writes/exports are forbidden", async () => {
    assert.equal((await cash.POST(req("/api/owner/revenue/cash?shopId=shop-authorized", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify(payload) }))).status, 403);
    assert.equal((await exporter.GET(req("/api/owner/revenue/export?shopId=demo-shop"))).status, 403);
  });
  await t.test("RPC conflicts and missing migration never become successful zero totals", async () => {
    rpcError = { code: "PGRST202", message: "function does not exist" }; assert.equal((await analytics.GET(req("/api/owner/profitability?version=2&shopId=shop-authorized"))).status, 503);
    rpcError = { code: "22023", message: "REVENUE_PAYMENT_EXCEEDS_DUE" }; assert.equal((await cash.POST(post(payload))).status, 409);
    rpcError = null;
  });
  await t.test("CSV chunks remain private and do not expose guardian identity", async () => {
    calls = []; const response = await exporter.GET(req("/api/owner/revenue/export?shopId=shop-authorized&page=1")); assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.done, true); assert.ok(result.csv.includes("환불 차감 수금 매출")); assert.ok(!result.csv.includes("보호자")); assert.equal(calls[0].params.p_page_size, 500);
  });
  await t.test("CSV chunk requests retain the displayed month across Korea midnight", async () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-31T14:59:30Z") });
    try {
      const snapshotAt = "2026-10-31T14:59:00Z";
      const params = new URLSearchParams({ shopId: "shop-authorized", preset: "month", snapshotAt, ...snapshot });
      calls = [];
      const first = await exporter.GET(req(`/api/owner/revenue/export?${params}&page=1`));
      assert.equal(first.status, 200);
      const firstChunk = await first.json();
      mock.timers.tick(90_000);
      const next = await exporter.GET(req(`/api/owner/revenue/export?${params}&page=2`));
      assert.equal(next.status, 200);
      const nextChunk = await next.json();
      assert.equal(nextChunk.filename, firstChunk.filename);
      assert.ok(firstChunk.csv.includes("2026-10-01 ~ 2026-10-31"));
      for (const call of calls) {
        assert.equal(call.params.p_from, "2026-10-01");
        assert.equal(call.params.p_to, "2026-10-31");
        assert.equal(call.params.p_snapshot_at, snapshotAt);
      }
    } finally { mock.timers.reset(); }
  });
  await t.test("same-count outstanding edits reject exports and mixed summary/detail reads", async () => {
    detailRevision = "11111111111111111111111111111111";
    const params = new URLSearchParams({ shopId: "shop-authorized", view: "outstanding", snapshotAt: new Date().toISOString(), ...snapshot });
    assert.equal((await exporter.GET(req(`/api/owner/revenue/export?${params}`))).status, 409);
    assert.equal((await analytics.GET(req("/api/owner/profitability?shopId=shop-authorized&version=2"))).status, 409);
    detailRevision = snapshot.outstandingRevision;
  });
});
