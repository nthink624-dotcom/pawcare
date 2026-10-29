import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const output = ts.transpileModule(readFileSync(new URL("../../src/app/api/owner/entry/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const corsModule = { exports: {} };
Function("require", "module", "exports", ts.transpileModule(readFileSync(new URL("../../src/server/owner-mobile-cors.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(require, corsModule, corsModule.exports);
class OwnerApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
class OwnerBillingError extends Error { constructor(message, status) { super(message); this.status = status; } }

function fixture(options = {}) {
  const calls = [];
  const owner = { shopId: "shop-a", userId: "owner-a", role: options.staff ? "staff" : "owner", staffId: options.staff ? "staff-a" : null };
  const bootstrap = { mode: "supabase", shop: { id: owner.shopId }, actor: owner,
    ownerProfile: options.delegated || options.staff ? null : { id: "owner-a" },
    initialSetupReadiness: { shopId: owner.shopId, completed: !options.incomplete } };
  const modules = {
    "@/lib/server-env": { hasSupabaseServerEnv: () => !options.noConfig },
    "@/server/owner-api-auth": { OwnerApiError, requireOwnerShop: async (request, hint, timing, guardOptions) => {
      calls.push("guard"); assert.equal(hint, "shop-a"); assert.equal(guardOptions.deferBillingMaintenance, true);
      if (options.denied) throw new OwnerApiError("denied", options.denied);
      timing("auth_user", 2); return owner;
    } },
    "@/server/owner-billing": { OwnerBillingError, getOwnerSubscriptionSummary: async (identity, shopId) => {
      calls.push("summary"); assert.ok(calls.includes("bootstrap-done")); assert.ok(calls.includes("shops"));
      assert.equal(identity.id, "owner-a"); return { shopId, status: "active" };
    } },
    "@/server/owner-billing-session": { requireOwnerBillingSession: async () => {
      calls.push("billing-read"); if (options.delegated || options.billingDenied) throw new OwnerBillingError("billing denied", 403);
      return { identity: { id: "owner-a" }, shopId: owner.shopId };
    } },
    "@/server/owner-bootstrap-snapshot": { getOwnerBootstrapSnapshot: async (context, phase) => {
      assert.equal(context, owner); assert.equal(phase, "launch");
      calls.push("bootstrap"); if (options.bootstrapError) throw new Error("unavailable");
      if (options.beforeBootstrap) await options.beforeBootstrap(calls);
      calls.push("bootstrap-done"); return bootstrap;
    } },
    "@/server/owner-shop-list": { readOwnerShopSummaries: async userId => {
      calls.push("shops"); assert.equal(userId, "owner-a"); return [{ id: options.wrongShop ? "shop-b" : owner.shopId }];
    } },
    "@/server/owner-mobile-cors": corsModule.exports,
  };
  const runtimeModule = { exports: {} };
  Function("require", "module", "exports", output)(name => modules[name] ?? require(name), runtimeModule, runtimeModule.exports);
  const request = new NextRequest(`https://www.petmanager.co.kr/api/owner/entry?shopId=shop-a&includeSubscription=${options.skipBilling ? "0" : "1"}`, {
    headers: { authorization: "Bearer fixture-not-a-credential", origin: "https://app.petmanager.co.kr" },
  });
  return { calls, run: () => runtimeModule.exports.GET(request) };
}

test("one entry returns canonical data and a primary-owner summary without permitting response caching", async () => {
  const { run, calls } = fixture({ beforeBootstrap: async calls => {
    assert.ok(calls.includes("billing-read")); assert.ok(!calls.includes("summary"));
  } });
  const response = await run();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), "https://app.petmanager.co.kr");
  assert.match(response.headers.get("server-timing"), /auth_user;dur=/);
  const payload = await response.json();
  assert.equal(payload.version, 1); assert.equal(payload.bootstrap.shop.id, "shop-a");
  assert.equal(payload.subscriptionSummary.shopId, "shop-a"); assert.equal(calls.filter(call => call === "guard").length, 1);
});
for (const status of [401, 402, 403]) test(`an existing guard denial (${status}) stops all data and billing reads`, async () => {
  const { run, calls } = fixture({ denied: status });
  assert.equal((await run()).status, status); assert.deepEqual(calls, ["guard"]);
});
for (const scenario of [{ staff: true }, { delegated: true }, { incomplete: true }, { skipBilling: true }]) {
  test(`entry preserves non-billing behavior for ${JSON.stringify(scenario)}`, async () => {
    const { run, calls } = fixture(scenario); const response = await run();
    assert.equal(response.status, 200); assert.equal((await response.json()).subscriptionSummary, null);
    assert.ok(!calls.includes("summary"));
    if (scenario.staff || scenario.skipBilling) assert.ok(!calls.includes("billing-read"));
  });
}
for (const scenario of [{ wrongShop: true, status: 403 }, { bootstrapError: true, status: 500 }, { billingDenied: true, status: 403 }]) {
  test(`entry fails closed for ${JSON.stringify(scenario)}`, async () => {
    const { run, calls } = fixture(scenario); const response = await run();
    assert.equal(response.status, scenario.status); assert.ok(!calls.includes("summary"));
    assert.equal((await response.json()).bootstrap, undefined);
  });
}
test("missing server configuration returns no demo or private data", async () => {
  const { run, calls } = fixture({ noConfig: true });
  assert.equal((await run()).status, 503); assert.deepEqual(calls, []);
});
