import assert from "node:assert/strict";
import test from "node:test";

import { completeSocialLogin, getSocialLoginCallbackUrl, getSocialLoginFailurePath, getSocialLoginReturnPath, readSocialLoginAvailability, SOCIAL_LOGIN_PROVIDERS } from "../../src/lib/auth/social-login.ts";

test("a transient availability failure gets one read retry without inventing readiness", async () => {
  const expected = { naver: true, kakao: false, google: true };
  let reads = 0;
  const result = await readSocialLoginAvailability(async (url, init) => {
    assert.equal(url, "/api/auth/social/providers"); assert.equal(init.cache, "no-store");
    reads += 1;
    return reads === 1 ? Response.json({ message: "unavailable" }, { status: 503 }) : Response.json(expected);
  });
  assert.deepEqual(result, expected); assert.equal(reads, 2);
  reads = 0;
  await assert.rejects(readSocialLoginAvailability(async () => { reads += 1; return Response.json({}, { status: 503 }); }), /unavailable/);
  assert.equal(reads, 2);
});

test("availability rejects malformed and denied responses, and retries a network abort once", async () => {
  for (const response of [Response.json({}, { status: 403 }), Response.json({ naver: "true", kakao: true, google: true })]) {
    let reads = 0;
    await assert.rejects(readSocialLoginAvailability(async () => { reads += 1; return response; }), /unavailable/);
    assert.equal(reads, 1);
  }
  let reads = 0;
  const expected = { naver: false, kakao: true, google: true };
  assert.deepEqual(await readSocialLoginAvailability(async () => { reads += 1; if (reads === 1) throw new DOMException("Read aborted", "AbortError"); return Response.json(expected); }), expected);
  assert.equal(reads, 2);
});

test("social return paths reject external, malformed and normalized traversal destinations", () => {
  for (const input of [undefined, "https://evil.invalid/owner", "//evil.invalid", "/owner/../../login", "/owner/%2e%2e/login", "/owner/\\evil.invalid", "/owner/\nlogin"]) {
    assert.equal(getSocialLoginReturnPath(input), "/owner", String(input));
  }
  for (const input of ["/owner", "/owner/settings?tab=account", "/owner?shopId=fixture", "/account-deletion"]) {
    assert.equal(getSocialLoginReturnPath(input), input);
  }
  const url = new URL(getSocialLoginCallbackUrl("https://www.petmanager.co.kr", "/owner/settings?tab=account"));
  assert.equal(url.pathname, "/auth/callback");
  assert.equal(url.searchParams.get("next"), "/owner/settings?tab=account");
  assert.deepEqual(SOCIAL_LOGIN_PROVIDERS.map(({ provider }) => provider), ["custom:naver", "kakao", "google"]);
  assert.equal(new URL(getSocialLoginFailurePath("social-cancelled", "//evil.invalid"), url.origin).searchParams.get("next"), "/owner");
});

function fixture({ exchangeError = false, status = 200, shops = [{ id: "authorized-shop" }], fetchError = false } = {}) {
  const calls = [];
  const auth = {
    exchangeCodeForSession: async (code) => {
      calls.push(["exchange", code]);
      return { data: { session: exchangeError ? null : { access_token: "fixture-access", refresh_token: "fixture-refresh" } }, error: exchangeError ? new Error("fixture") : null };
    },
    signOut: async (options) => { calls.push(["signOut", options]); return { error: null }; },
  };
  const fetchShops = async (url, options) => {
    calls.push(["shops", url, options]);
    if (fetchError) throw new Error("fixture network error");
    return Response.json(shops, { status });
  };
  return { auth, fetchShops, calls };
}

test("PKCE success hands off only after the existing server verifies shop access", async () => {
  const f = fixture();
  const result = await completeSocialLogin({ ...f, code: "fixture-code" });
  assert.equal(result.shopId, "authorized-shop");
  assert.equal(result.session.access_token, "fixture-access");
  assert.deepEqual(f.calls.map(([name]) => name), ["exchange", "shops"]);
  assert.equal(f.calls[1][1], "/api/owner/shops");
  assert.equal(f.calls[1][2].headers.Authorization, "Bearer fixture-access");
  assert.equal(f.calls[1][2].cache, "no-store");
  assert.ok(f.calls[1][2].signal instanceof AbortSignal);
});

test("invalid code never queries shops and clears the local session", async () => {
  const f = fixture({ exchangeError: true });
  await assert.rejects(completeSocialLogin({ ...f, code: "fixture-code" }), { reason: "social-failed" });
  assert.deepEqual(f.calls, [["exchange", "fixture-code"], ["signOut", { scope: "local" }]]);
});

test("unknown social identities require existing signup; suspension and invalid replies fail closed", async () => {
  for (const [options, reason] of [
    [{ status: 403, shops: { message: "접근할 수 있는 매장이 없습니다." } }, "social-account"],
    [{ shops: [] }, "social-account"],
    [{ status: 403, shops: { message: "이 계정은 운영자에 의해 일시 중지되었습니다." } }, "social-failed"],
    [{ status: 401, shops: { message: "로그인이 필요합니다." } }, "social-failed"],
    [{ status: 503, shops: { message: "fixture" } }, "social-failed"],
    [{ shops: [{ id: "demo-shop" }] }, "social-failed"],
    [{ shops: [{ name: "invalid" }] }, "social-failed"],
    [{ shops: { id: "invalid" } }, "social-failed"],
    [{ fetchError: true }, "social-failed"],
  ]) {
    const f = fixture(options);
    await assert.rejects(completeSocialLogin({ ...f, code: "fixture-code" }), { reason });
    assert.deepEqual(f.calls.at(-1), ["signOut", { scope: "local" }]);
  }
});
