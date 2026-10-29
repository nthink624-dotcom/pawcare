import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(file, modules) {
  const runtime = { exports: {} };
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  Function("require", "module", "exports", output)(name => {
    assert.ok(name in modules, name); return modules[name];
  }, runtime, runtime.exports);
  return runtime.exports;
}

const user = "owner-a";
const member = (shopId, role = "manager", ownerId = user) => ({ owner_user_id: ownerId, shop_id: shopId, role, is_primary: false });
const staff = (shopId, ownerId = user, active = true) => ({ id: `staff-${shopId}`, shop_id: shopId, auth_user_id: ownerId, is_active: active });
const shop = (id, own = false, members = [], bindings = []) => ({
  id, owner_user_id: own ? user : "other-owner", name: id, address: "fixture address",
  customer_page_settings: { hero_image_url: `fixture-${id}`, private: "must not be projected" },
  entry_members: members, entry_staff: bindings,
});

function harness(responses) {
  const calls = [];
  const admin = { from(table) {
    const call = { table, operations: [] }; calls.push(call);
    const query = {
      then(resolve, reject) {
        const response = responses.shift(); assert.ok(response, "unexpected extra database request");
        return Promise.resolve(response).then(resolve, reject);
      },
    };
    for (const operation of ["select", "eq", "order", "or", "in", "maybeSingle"]) {
      query[operation] = (...args) => { call.operations.push([operation, ...args]); return query; };
    }
    return query;
  } };
  const auth = load("../../src/server/owner-api-auth.ts", {
    "@/lib/billing/owner-subscription": {}, "@/lib/server-env": {},
    "@/lib/supabase/server": { getSupabaseAdmin: () => admin }, "@/server/owner-billing": {},
  });
  const readers = load("../../src/server/owner-shop-list.ts", {
    "@/lib/supabase/server": { getSupabaseAdmin: () => admin }, "@/server/owner-api-auth": auth,
  });
  return { ...readers, calls, responses };
}

test("one fresh query lists owned, manager and actively bound staff shops without leaking access records", async () => {
  const rows = [shop("owned", true), shop("manager", false, [member("manager")]),
    shop("staff", false, [member("staff", "staff")], [staff("staff")])];
  const h = harness([{ data: rows, error: null }]);
  assert.deepEqual(await h.readOwnerShopSummaries(user), rows.map(row => ({
    id: row.id, name: row.name, address: row.address, heroImageUrl: `fixture-${row.id}`,
  })));
  assert.equal(h.calls.length, 1);
  assert.ok(h.calls[0].operations.some(([op, field, value]) => op === "eq" && field === "entry_members.owner_user_id" && value === user));
  assert.ok(h.calls[0].operations.some(([op, field, value]) => op === "eq" && field === "entry_staff.auth_user_id" && value === user));
  assert.ok(h.calls[0].operations.some(([op]) => op === "or"));
});

for (const [reason, row] of [
  ["unrelated owner", shop("a")],
  ["another user's membership", shop("a", false, [member("a", "manager", "other")])],
  ["membership belonging to another shop", shop("a", false, [member("b")])],
  ["staff without a binding", shop("a", false, [member("a", "staff")])],
  ["inactive staff", shop("a", false, [member("a", "staff")], [staff("a", user, false)])],
  ["another user's staff binding", shop("a", false, [member("a", "staff")], [staff("a", "other")])],
  ["staff binding belonging to another shop", shop("a", false, [member("a", "staff")], [staff("b")])],
  ["unknown membership role", shop("a", false, [member("a", "invalid")])],
]) test(`${reason} does not grant a shop`, async () => {
  const h = harness([{ data: [row], error: null }]);
  await assert.rejects(h.readOwnerShopSummaries(user), error => error.status === 403);
  assert.equal(h.calls.length, 1);
});

test("direct ownership remains valid when a redundant staff membership has no active binding", async () => {
  const h = harness([{ data: [shop("a", true, [member("a", "staff")])], error: null }]);
  assert.equal((await h.readOwnerShopSummaries(user))[0].id, "a");
});

test("membership revocation is observed on the next call without reusing a completed snapshot", async () => {
  const h = harness([{ data: [shop("a", false, [member("a")])], error: null }, { data: [], error: null }]);
  assert.equal((await h.readOwnerShopSummaries(user)).length, 1);
  await assert.rejects(h.readOwnerShopSummaries(user), error => error.status === 403);
  assert.equal(h.calls.length, 2);
});

for (const code of ["42501", "PGRST301", "500", "NETWORK"]) test(`${code} never falls through to a different access path`, async () => {
  const h = harness([{ data: null, error: { code, message: "fixture failure" } }]);
  await assert.rejects(h.readOwnerShopSummaries(user), error => error.status === 500);
  assert.equal(h.calls.length, 1);
});

test("a missing embedding relationship retains the existing canonical access path", async () => {
  const h = harness([
    { data: null, error: { code: "PGRST200", message: "fixture schema mismatch" } },
    { data: [{ id: "a" }], error: null }, { data: [], error: null },
    { data: [{ id: "a", name: "a", address: "fixture", customer_page_settings: {} }], error: null },
  ]);
  assert.deepEqual(await h.readOwnerShopSummaries(user), [{ id: "a", name: "a", address: "fixture", heroImageUrl: "" }]);
  assert.equal(h.responses.length, 0);
});

test("malformed successful snapshots fail closed instead of trying another source", async () => {
  const h = harness([{ data: [{ ...shop("a", true), entry_members: null }], error: null }]);
  await assert.rejects(h.readOwnerShopSummaries(user), error => error.status === 503);
  assert.equal(h.calls.length, 1);
});
