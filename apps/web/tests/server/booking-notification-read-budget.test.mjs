import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

const state = { queries: [], authCalls: 0, hang: false, authError: null, authWait: null };
class OwnerApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
// Exercise the installed Supabase query builder and its cancellation transport.
// No network, real account, production key, or database is used by this test.
const supabase = createClient("https://supabase.invalid", "test-only-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    const signal = init?.signal;
    state.queries.push({ url, signal });
    signal?.throwIfAborted();
    if (state.hang) return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
    return Response.json([{ id: "notice-fixture", appointment_id: "booking-fixture" }]);
  } },
});
const runtime = { exports: {} };
const source = readFileSync(new URL("../../src/app/api/owner/booking-notification-snapshot/route.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
Function("module", "exports", "require", output)(runtime, runtime.exports, name => {
  if (name === "@/lib/supabase/server") return { getSupabaseAdmin: () => supabase };
  if (name === "@/server/owner-api-auth") return {
    OwnerApiError,
    requireOwnerShop: async (request, shopId) => {
      state.authCalls++;
      assert.equal(shopId, "requested-shop");
      if (state.authError) throw new OwnerApiError("Access denied", state.authError);
      if (state.authWait) await state.authWait;
      return { shopId: "authorized-shop" };
    },
  };
  if (name === "@/server/owner-mobile-cors") return {
    ownerMobileCorsJson: (request, body, init) => Response.json(body, init),
    ownerMobileCorsPreflight: () => new Response(null, { status: 204 }),
  };
  throw Error("Unexpected import: " + name);
});
const { GET, maxDuration } = runtime.exports;

async function clock(run) {
  const original = { set: globalThis.setTimeout, clear: globalThis.clearTimeout };
  let time = 0, id = 0;
  const timers = new Map();
  globalThis.setTimeout = (callback, delay) => { timers.set(++id, { callback, at: time + delay }); return id; };
  globalThis.clearTimeout = key => timers.delete(key);
  const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
  const advance = async duration => {
    const end = time + duration;
    while (true) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      time = due[1].at; timers.delete(due[0]); due[1].callback(); await settle();
    }
    time = end; await settle();
  };
  state.queries = []; state.authCalls = 0; state.hang = false; state.authError = null; state.authWait = null;
  try { await run({ advance, settle, timers }); }
  finally { globalThis.setTimeout = original.set; globalThis.clearTimeout = original.clear; }
}
const request = signal => new Request("https://fixture.invalid/api/owner/booking-notification-snapshot?shopId=requested-shop", { signal });

test("authorized snapshot preserves filters and response, and releases its deadline", async () => clock(async ({ timers }) => {
  assert.equal(maxDuration, 15);
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(await response.json(), { notifications: [{ id: "notice-fixture", appointmentId: "booking-fixture" }] });
  assert.equal(state.authCalls, 1); assert.equal(state.queries.length, 1);
  const { url, signal } = state.queries[0];
  assert.equal(url.pathname, "/rest/v1/notifications");
  assert.equal(url.searchParams.get("shop_id"), "eq.authorized-shop");
  assert.equal(url.searchParams.get("type"), "eq.owner_booking_requested");
  assert.equal(url.searchParams.get("status"), "eq.sent");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(signal.aborted, false); assert.equal(timers.size, 0);
}));

test("an eight-second stalled DB fetch is aborted once and returns retryable unavailable", async () => clock(async ({ advance, settle, timers }) => {
  state.hang = true;
  const pending = GET(request()); await settle();
  assert.equal(state.queries.length, 1);
  await advance(7_999); assert.equal(state.queries[0].signal.aborted, false);
  await advance(1); assert.equal(state.queries[0].signal.aborted, true);
  const response = await pending;
  assert.equal(response.status, 503); assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(state.queries.length, 1); assert.equal(timers.size, 0);
}));

test("client disconnect cancels the Supabase transport and clears the deadline", async () => clock(async ({ settle, timers }) => {
  const controller = new AbortController(); state.hang = true;
  const pending = GET(request(controller.signal)); await settle(); controller.abort();
  assert.equal((await pending).status, 503);
  assert.equal(state.queries[0].signal.aborted, true);
  assert.equal(timers.size, 0);
}));

test("already-aborted requests perform no auth or database work", async () => clock(async ({ timers }) => {
  const controller = new AbortController(); controller.abort();
  assert.equal((await GET(request(controller.signal))).status, 503);
  assert.equal(state.authCalls, 0); assert.equal(state.queries.length, 0); assert.equal(timers.size, 0);
}));

test("a deadline reached during auth prevents a later notification query", async () => clock(async ({ advance, settle, timers }) => {
  let release;
  state.authWait = new Promise(resolve => { release = resolve; });
  const pending = GET(request()); await settle(); await advance(8_000);
  release();
  assert.equal((await pending).status, 503);
  assert.equal(state.queries.length, 0); assert.equal(timers.size, 0);
}));

for (const status of [401, 402, 403]) {
  test(`auth/shop/subscription denial ${status} still blocks data access`, async () => clock(async ({ timers }) => {
    state.authError = status;
    assert.equal((await GET(request())).status, status);
    assert.equal(state.queries.length, 0); assert.equal(timers.size, 0);
  }));
}
