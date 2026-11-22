import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
const { checkSignupTransport } = createRequire(import.meta.url)("../scripts/check-signup-transport.cjs");
const env = { VERCEL_ENV: "production", PETMANAGER_MAIN_APP_ORIGIN: "https://www.petmanager.co.kr", AUTH_FLOW_SECRET: "PRIVATE_SIGNATURE_SECRET", ATOMIC_OWNER_SIGNUP_ENABLED: "true" };
const versions = () => ({ terms: "2026-10-06", marketing: "2026-09-14-v1" });
const rejected = () => Response.json({ message: "본인인증이 완료되지 않았습니다." }, { status: 400 });

test("non-production never contacts the shared signup server", async () => {
  assert.equal((await checkSignupTransport({ env: {}, fetchImpl: () => assert.fail("network") })).skipped, true);
});

test("probe uses only synthetic data and an unprovisioned verification identifier", async () => {
  let ids = 0;
  const result = await checkSignupTransport({ env, versions, createId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`, fetchImpl: async (url, init) => {
    assert.equal(url, "https://www.petmanager.co.kr/api/auth/signup"); assert.equal(init.redirect, "manual");
    const body = JSON.parse(init.body);
    assert.equal(body.email, "signup-preflight@example.invalid");
    const [payload, signature] = body.identityVerificationToken.split(".");
    assert.equal(signature, createHmac("sha256", env.AUTH_FLOW_SECRET).update(payload).digest("base64url"));
    const claims = JSON.parse(Buffer.from(payload, "base64url"));
    assert.equal(claims.verificationId, "00000000-0000-4000-8000-000000000001");
    assert.equal(claims.purpose, "signup"); assert.equal(claims.source, "portone");
    assert.ok(init.signal instanceof AbortSignal); return rejected();
  } });
  assert.equal(result.enabled, true); assert.equal(result.probeId, "00000000-0000-4000-8000-000000000001");
});

test("the missing handoff flag remains disabled and is not enabled by the probe", async () => {
  const result = await checkSignupTransport({ env: { ...env, ATOMIC_OWNER_SIGNUP_ENABLED: undefined }, versions, fetchImpl: async () => rejected() });
  assert.equal(result.enabled, false);
});

test("bad origins and missing signature configuration fail before any request", async () => {
  for (const bad of [{ ...env, PETMANAGER_MAIN_APP_ORIGIN: "https://example.invalid" }, { ...env, AUTH_FLOW_SECRET: "" }]) {
    await assert.rejects(checkSignupTransport({ env: bad, versions, fetchImpl: () => assert.fail("network") }), /MOBILE_SIGNUP_PREFLIGHT_/);
  }
});

test("redirects, unrelated errors, and network details cannot pass or leak", async () => {
  for (const fetchImpl of [async () => Response.json({ message: "PRIVATE_DATA" }, { status: 503 }), async () => Response.json({ success: true }), async () => { throw Error("PRIVATE_SIGNATURE_SECRET"); }]) {
    await assert.rejects(checkSignupTransport({ env, versions, fetchImpl }), e => { assert.ok(e.message.startsWith("MOBILE_SIGNUP_PREFLIGHT_")); assert.ok(!e.message.includes("PRIVATE")); return true; });
  }
});
