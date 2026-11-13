import assert from "node:assert/strict";
import { mock, test } from "node:test";

let phase = "success";
let calls = [];
const uid = "00000000-0000-4000-8000-000000000001";
const auth = { auth: {
  getUser: async () => ({ data: { user: { id: uid, email: "fixture@example.invalid" } } }),
  signInWithPassword: async () => {
    calls.push("reauth");
    return phase === "password" ? { error: new Error("invalid fixture password"), data: {} }
      : { data: { user: { id: uid } } };
  },
} };
const admin = {
  from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) }),
  rpc: async (name) => {
    calls.push(name);
    if (phase === "claim" && name.startsWith("claim_")) return { error: { message: "fixture blocked" } };
    if (phase === "purge" && name.startsWith("finalize_")) return { error: new Error("fixture purge failure") };
    if (phase === "complete" && name.startsWith("complete_")) return { error: new Error("fixture complete failure") };
    return { data: { request_id: uid, state: "prepared", shop_ids: [] } };
  },
  auth: { admin: {
    signOut: async () => { calls.push("signOut"); return {}; },
    deleteUser: async (id) => {
      assert.equal(id, uid);
      calls.push("deleteUser");
      return phase === "delete" ? { error: new Error("fixture auth failure") } : {};
    },
  } },
};

mock.module(new URL("../../src/lib/server-env.ts", import.meta.url).href, {
  namedExports: { hasSupabaseServerEnv: () => phase !== "environment" },
});
mock.module(new URL("../../src/lib/supabase/server.ts", import.meta.url).href, {
  namedExports: { getSupabaseAdmin: () => admin, getSupabaseAuthClient: () => auth },
});
mock.module(new URL("../../src/server/media-storage.ts", import.meta.url).href, {
  namedExports: { removeMediaStorageObjects: async () => {}, verifyMediaStorageObjectsAbsent: async () => true },
});

const { NextRequest } = await import("next/server.js");
const { OPTIONS, POST } = await import("../../src/app/api/owner/account-deletion/route.ts");
const url = "https://www.petmanager.co.kr/api/owner/account-deletion";
const validBody = { confirmation: true, currentPassword: "fixture-only", idempotencyKey: uid };
const origin = "https://app.petmanager.co.kr";

function post(body = validBody, authorized = true) {
  return new NextRequest(url, { method: "POST", headers: {
    Origin: origin, "Content-Type": "application/json", ...(authorized ? { Authorization: "Bearer fixture" } : {}),
  }, body: JSON.stringify(body) });
}

test("iPhone and hosted app preflights allow POST; foreign origins and unrelated methods remain denied", async () => {
  for (const allowedOrigin of [origin, "capacitor://localhost"]) {
    const response = await OPTIONS(new NextRequest(url, { method: "OPTIONS", headers: {
      Origin: allowedOrigin, "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    } }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
    assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
    assert.match(response.headers.get("access-control-allow-headers"), /Authorization/);
    assert.equal(response.headers.get("vary"), "Origin");
  }
  const foreign = await OPTIONS(new NextRequest(url, { method: "OPTIONS", headers: {
    Origin: "https://foreign.example", "Access-Control-Request-Method": "POST",
  } }));
  assert.equal(foreign.headers.get("access-control-allow-origin"), null);
  const denied = await OPTIONS(new NextRequest(url, { method: "OPTIONS", headers: {
    Origin: origin, "Access-Control-Request-Method": "DELETE",
  } }));
  assert.equal(denied.status, 405);
  assert.deepEqual(calls, []);
});

test("invalid input, missing session, and failed password stay readable to the app and cannot delete", async () => {
  for (const [mode, body, authorized, expected] of [
    ["success", {}, true, 400], ["success", validBody, false, 401], ["password", validBody, true, 401],
  ]) {
    phase = mode; calls = [];
    const response = await POST(post(body, authorized));
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.ok(!(await response.json()).success);
    assert.ok(!calls.some((call) => call.startsWith("claim_") || call === "deleteUser"));
  }
});

test("all server failures preserve CORS and authenticated no-store headers", async () => {
  for (const mode of ["environment", "claim", "purge", "delete", "complete"]) {
    phase = mode; calls = [];
    const response = await POST(post());
    assert.equal(response.status, 503, mode);
    assert.equal(response.headers.get("access-control-allow-origin"), origin, mode);
    assert.equal(response.headers.get("cache-control"), "private, no-store", mode);
    assert.ok(!(await response.json()).success, mode);
  }
});

test("successful deletion still reauthenticates, signs out, purges data, deletes Auth, and records completion in order", async () => {
  phase = "success"; calls = [];
  const response = await POST(post());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(calls, ["reauth", "claim_owner_account_deletion_v1", "signOut",
    "finalize_owner_account_deletion_v1", "deleteUser", "complete_owner_account_deletion_v1"]);
});
