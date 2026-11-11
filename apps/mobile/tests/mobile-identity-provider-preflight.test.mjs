import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const { checkIdentityProvider } = require("../scripts/check-identity-provider.cjs");
const env = { VERCEL_ENV: "production", PORTONE_API_SECRET: "PRIVATE_SECRET", NEXT_PUBLIC_PORTONE_STORE_ID: "fixture-store" };

test("local and preview builds do not contact the identity provider", async () => {
  for (const stage of [undefined, "development", "preview"]) {
    const result = await checkIdentityProvider({ env: { VERCEL_ENV: stage }, fetchImpl: () => assert.fail("unexpected network") });
    assert.equal(result.skipped, true);
  }
});

test("production preflight performs one customer-free GET with the deployment credentials", async () => {
  let calls = 0;
  const result = await checkIdentityProvider({ env, createId: () => "fixture-uuid", fetchImpl: async (url, init) => {
    calls += 1;
    assert.equal(url.pathname, "/identity-verifications/pm_preflight_fixture-uuid");
    assert.equal(url.searchParams.get("storeId"), "fixture-store");
    assert.equal(init.method, "GET"); assert.equal(init.body, undefined);
    assert.equal(init.headers.Authorization, "PortOne PRIVATE_SECRET");
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json({ type: "IDENTITY_VERIFICATION_NOT_FOUND" }, { status: 404 });
  } });
  assert.equal(calls, 1); assert.deepEqual(result, { skipped: false, httpStatus: 404 });
});

test("production fails closed on rejected credentials with no provider detail leakage", async () => {
  for (const status of [401, 403]) {
    await assert.rejects(checkIdentityProvider({ env, fetchImpl: async () => Response.json({ message: "PRIVATE_PERSON_DATA" }, { status }) }), error => {
      assert.equal(error.message, `MOBILE_IDENTITY_PREFLIGHT_AUTH_${status}`);
      assert.ok(!error.message.includes("PRIVATE")); return true;
    });
  }
});

test("an unrelated 404 or unexpected success cannot pass the credential check", async () => {
  for (const [status, body] of [[404, { type: "STORE_NOT_FOUND" }], [200, { status: "VERIFIED" }], [503, { message: "PRIVATE_PERSON_DATA" }]]) {
    await assert.rejects(checkIdentityProvider({ env, fetchImpl: async () => Response.json(body, { status }) }), /MOBILE_IDENTITY_PREFLIGHT_UNEXPECTED_RESPONSE/);
  }
});

test("network errors and malformed responses do not expose credentials or customer information", async () => {
  for (const fetchImpl of [async () => { throw Error("PRIVATE_SECRET PRIVATE_PERSON_DATA"); }, async () => new Response("PRIVATE_PERSON_DATA")]) {
    await assert.rejects(checkIdentityProvider({ env, fetchImpl }), error => {
      assert.equal(error.message, "MOBILE_IDENTITY_PREFLIGHT_LOOKUP_UNAVAILABLE"); return true;
    });
  }
});

test("missing production configuration fails before any request", async () => {
  for (const partial of [{ VERCEL_ENV: "production" }, { ...env, PORTONE_API_SECRET: " " }, { ...env, NEXT_PUBLIC_PORTONE_STORE_ID: " " }]) {
    await assert.rejects(checkIdentityProvider({ env: partial, fetchImpl: () => assert.fail("unexpected network") }), /MOBILE_IDENTITY_PREFLIGHT_CONFIG_MISSING/);
  }
});
