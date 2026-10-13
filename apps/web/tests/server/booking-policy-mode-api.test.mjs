import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { DEFAULT_BOOKING_POLICY } from "@petmanager/shared/contracts/booking-preparation";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(new URL("../../src/app/api/owner/booking-policy/route.ts", import.meta.url), "utf8");
function fixture() {
  let state = { policy: { ...DEFAULT_BOOKING_POLICY, depositMode: "optional", bankAccount: "TEST-ACCOUNT", templates: [{ id: "preserved" }], firstNoshowRule: "deposit" }, version: 4 };
  let writes = 0;
  class OwnerApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const deps = {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    "zod": require("zod"),
    "@/server/owner-api-auth": { OwnerApiError, requireOwnerShop: async (_, shopId) => { if (shopId !== "authorized-shop") throw new OwnerApiError("Forbidden", 403); return { shopId }; }, assertOwnerOrManager: () => {} },
    "@/server/booking-preparation": { readBookingPolicy: async () => structuredClone(state), saveBookingPolicy: async (shopId, policy, version) => { assert.equal(shopId, "authorized-shop"); assert.equal(version, state.version); writes++; state = { policy, version: version + 1 }; return structuredClone(state); } },
  };
  const context = { exports: {}, require: (name) => { assert.ok(name in deps, name); return deps[name]; } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return { patch: async (body) => context.exports.PATCH({ json: async () => body }), state: () => state, writes: () => writes };
}
test("deposit mode change preserves account, no-show and consent settings", async () => {
  const f = fixture(), before = structuredClone(f.state().policy);
  const result = await f.patch({ shopId: "authorized-shop", version: 4, depositMode: "off", policy: { bankAccount: "UNTRUSTED" } });
  assert.equal(result.status, 200);
  assert.deepEqual(structuredClone(f.state().policy), { ...before, depositMode: "off" });
  assert.equal(f.state().version, 5);
});
test("stale cross-screen update cannot overwrite a newer policy", async () => {
  const f = fixture();
  const result = await f.patch({ shopId: "authorized-shop", version: 3, depositMode: "off" });
  assert.equal(result.status, 409); assert.equal(f.writes(), 0);
});
test("deposit switch requires the authorized shop and a valid mode", async () => {
  const f = fixture();
  assert.equal((await f.patch({ shopId: "other-shop", version: 4, depositMode: "off" })).status, 403);
  assert.equal((await f.patch({ shopId: "authorized-shop", version: 4, depositMode: "invalid" })).status, 400);
  assert.equal(f.writes(), 0);
});
