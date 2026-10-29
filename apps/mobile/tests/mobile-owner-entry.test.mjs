import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

class ApiRequestError extends Error { constructor(status) { super("fixture failure"); this.status = status; } }
const runtimeModule = { exports: {} };
const output = ts.transpileModule(readFileSync(new URL("../src/lib/owner-entry.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
Function("require", "module", "exports", output)(name => {
  assert.equal(name, "@/lib/api"); return { ApiRequestError };
}, runtimeModule, runtimeModule.exports);
const { loadOwnerEntry } = runtimeModule.exports;
const bootstrap = { mode: "supabase", shop: { id: "shop-a" } };

test("a supported API requires just one entry request and returns its current summary", async () => {
  const calls = [];
  const entry = { version: 1, bootstrap, shops: [{ id: "shop-a" }], subscriptionSummary: { shopId: "shop-a", status: "active" } };
  assert.deepEqual(await loadOwnerEntry("shop-a", true, async path => { calls.push(path); return entry; }), entry);
  assert.equal(calls.length, 1); assert.match(calls[0], /includeSubscription=1&shopId=shop-a/);
});
test("Android and first setup can omit pre-render billing", async () => {
  await loadOwnerEntry(null, false, async path => {
    assert.equal(path, "/api/owner/entry?includeSubscription=0");
    return { version: 1, bootstrap, shops: [{ id: "shop-a" }], subscriptionSummary: null };
  });
});
for (const status of [401, 402, 403, 500, 503]) test(`a current entry denial (${status}) is not retried through another path`, async () => {
  let count = 0;
  await assert.rejects(loadOwnerEntry(null, true, async () => { count++; throw new ApiRequestError(status); }));
  assert.equal(count, 1);
});
test("an older API uses the canonical endpoints without repeating a successful bootstrap", async () => {
  const calls = [];
  const result = await loadOwnerEntry("shop-a", true, async path => {
    calls.push(path); if (path.startsWith("/api/owner/entry")) throw new ApiRequestError(404);
    return path === "/api/owner/shops" ? [{ id: "shop-a" }] : bootstrap;
  });
  assert.equal(calls.length, 3); assert.equal(result.bootstrap, bootstrap); assert.equal(result.subscriptionSummary, null);
});
test("a removed shop hint selects a currently accessible shop before accepting its bootstrap", async () => {
  const calls = [];
  const result = await loadOwnerEntry("removed-shop", true, async path => {
    calls.push(path);
    if (path.startsWith("/api/owner/entry") || path.includes("removed-shop")) throw new ApiRequestError(403);
    return path === "/api/owner/shops" ? [{ id: "shop-a" }] : bootstrap;
  });
  assert.equal(result.bootstrap.shop.id, "shop-a"); assert.equal(calls.length, 4);
  assert.equal(calls.at(-1), "/api/bootstrap?shopId=shop-a&phase=launch");
});
test("malformed successful responses do not fall back or expose an owner screen", async () => {
  let count = 0;
  await assert.rejects(loadOwnerEntry(null, false, async () => { count++; return { version: 2, bootstrap, shops: [] }; }));
  assert.equal(count, 1);
});
