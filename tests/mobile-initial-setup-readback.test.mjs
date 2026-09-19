import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const source = readFileSync(new URL("../src/lib/owner-initial-setup-flow.ts", import.meta.url), "utf8");
function load({ data, role = "owner", token = "test-token", fetchImpl, onRead = () => {} } = {}) {
  const exports = {};
  const context = { exports, fetch: fetchImpl, URLSearchParams, window: { sessionStorage: new Map() }, require: (name) => {
    if (name === "@/lib/api") return { getAccessTokenWithRecovery: async () => token, fetchApiJsonWithAuth: async (url, options) => { onRead(url, options); return data; } };
    if (name === "@/lib/owner-customer-pet-integrity") return { assertOwnerBootstrapPayload: (value, shop) => { assert.equal(value.shop.id, shop); return value; }, resolveOwnerMobileRoleContext: () => ({ appRole: role }) };
    throw new Error(name);
  } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return exports;
}
const ready = () => ({ shop: { id: "shop-a" }, initialSetupReadiness: { shopId: "shop-a", steps: { hours: true, staff: true, pricing: true }, completed: true, nextStep: null } });

test("setup readback retains owner identity and does not cache completion", async () => {
  let read;
  await load({ data: ready(), onRead: (url, options) => { read = { url, options }; } }).reloadSetup("shop-a");
  assert.equal(read.url, "/api/bootstrap?shopId=shop-a");
  assert.equal(read.options.cache, "no-store");
});
test("completion readback rejects staff, mismatched shop and contradictory readiness", async () => {
  assert.equal((await load({ data: ready() }).reloadSetup("shop-a")).initialSetupReadiness.completed, true);
  await assert.rejects(load({ data: ready(), role: "staff" }).reloadSetup("shop-a"));
  const mismatch = ready(); mismatch.initialSetupReadiness.shopId = "shop-b";
  await assert.rejects(load({ data: mismatch }).reloadSetup("shop-a"));
  const contradiction = ready(); contradiction.initialSetupReadiness.steps.pricing = false;
  await assert.rejects(load({ data: contradiction }).reloadSetup("shop-a"));
});
test("saving without a session never sends a mutation", async () => {
  let calls = 0;
  await assert.rejects(load({ token: null, fetchImpl: async () => { calls++; } }).saveSetupStep("hours", {}));
  assert.equal(calls, 0);
});
test("step saving uses the authenticated fixed proxy and preserves failure", async () => {
  let request;
  const api = load({ fetchImpl: async (path, options) => { request = { path, options }; return { ok: false, json: async () => ({ message: "저장 거절" }) }; } });
  await assert.rejects(api.saveSetupStep("staff", { shopId: "shop-a" }), /저장 거절/);
  assert.equal(request.path, "/api/owner/initial-setup");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.equal(request.options.redirect, "error");
  assert.deepEqual(JSON.parse(request.options.body), { step: "staff", payload: { shopId: "shop-a" } });
});
