import assert from "node:assert/strict";
import test from "node:test";

import { clearPendingSocialAccountLink, getSocialLinkCallbackUrl, getSocialLinkProviderError, isSafeSocialLinkRedirect, readPendingSocialAccountLink, readSocialAccountResources, SOCIAL_LINK_MAX_AGE_MS, SOCIAL_LINK_STORAGE_KEY, writePendingSocialAccountLink } from "../../src/lib/auth/social-account-link.ts";
import { completeSocialLogin } from "../../src/lib/auth/social-login.ts";

const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
};

test("connection reads consume a ready provider body while shop headers are still delayed", async () => {
  let resolveShops;
  const delayedShops = new Promise(resolve => { resolveShops = resolve; });
  let providerBodyConsumed = false;
  let providerExpired = false;
  const availability = { naver: true, kakao: false, google: true };
  const reading = readSocialAccountResources("fixture-token", async (url, init) => {
    assert.equal(init.cache, "no-store");
    if (url === "/api/owner/shops") {
      assert.equal(init.headers.Authorization, "Bearer fixture-token");
      return delayedShops;
    }
    assert.equal(url, "/api/auth/social/providers");
    return { ok: true, json: async () => {
      providerBodyConsumed = true;
      if (providerExpired) throw new DOMException("Unread body expired", "AbortError");
      return availability;
    } };
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(providerBodyConsumed, true);
  providerExpired = true;
  resolveShops(Response.json([{ id: "fixture-shop" }]));
  assert.deepEqual(await reading, availability);
});

test("connection resource reads still reject denied, empty, demo and malformed responses", async () => {
  const valid = { naver: true, kakao: true, google: true };
  for (const [shops, availability, shopStatus] of [
    [[], valid, 200], [[{ id: "demo-shop" }], valid, 200], [[{ id: "" }], valid, 200],
    [[{ id: "fixture-shop" }], valid, 403], [[{ id: "fixture-shop" }], { ...valid, naver: "true" }, 200],
  ]) await assert.rejects(readSocialAccountResources("fixture-token", async url => url === "/api/owner/shops" ? Response.json(shops, { status: shopStatus }) : Response.json(availability)), /unavailable/);
});

test("link flow is bound to the verified principal, requested provider and bounded time window", () => {
  const s = storage();
  writePendingSocialAccountLink(s, "fixture-owner", "kakao", 1000);
  assert.deepEqual(readPendingSocialAccountLink(s, "kakao", 2000), { userId: "fixture-owner", provider: "kakao", startedAt: 1000 });
  assert.equal(readPendingSocialAccountLink(s, "naver", 2000), null);
  assert.equal(readPendingSocialAccountLink(s, "kakao", 999), null);
  assert.equal(readPendingSocialAccountLink(s, "kakao", 1001 + SOCIAL_LINK_MAX_AGE_MS), null);
  s.setItem(SOCIAL_LINK_STORAGE_KEY, '{"userId":"fixture-owner","provider":"kakao","startedAt":"1000"}');
  assert.equal(readPendingSocialAccountLink(s, "kakao", 2000), null);
  s.setItem(SOCIAL_LINK_STORAGE_KEY, "malformed");
  assert.equal(readPendingSocialAccountLink(s, "kakao", 2000), null);
  clearPendingSocialAccountLink(s);
  assert.equal(s.getItem(SOCIAL_LINK_STORAGE_KEY), null);
});

test("only the correct Supabase or official provider authorization destination can start linking", () => {
  const base = "https://fixture.supabase.co";
  assert.equal(isSafeSocialLinkRedirect(base + "/auth/v1/authorize?provider=kakao", "kakao", base), true);
  assert.equal(isSafeSocialLinkRedirect("https://kauth.kakao.com/oauth/authorize?state=fixture", "kakao", base), true);
  assert.equal(isSafeSocialLinkRedirect("https://nid.naver.com/oauth2/authorize", "naver", base), true);
  assert.equal(isSafeSocialLinkRedirect("https://accounts.google.com/o/oauth2/v2/auth", "google", base), true);
  for (const url of ["https://evil.invalid/auth/v1/authorize", "https://kauth.kakao.com.evil.invalid/oauth/authorize", "http://kauth.kakao.com/oauth/authorize", "https://kauth.kakao.com/oauth/authorize#fragment", "https://user:password@kauth.kakao.com/oauth/authorize", "https://kauth.kakao.com/logout"]) assert.equal(isSafeSocialLinkRedirect(url, "kakao", base), false, url);
  assert.equal(isSafeSocialLinkRedirect("https://nid.naver.com/oauth2/authorize", "kakao", base), false);
  const callback = new URL(getSocialLinkCallbackUrl("http://127.0.0.1:3000", "kakao"));
  assert.equal(callback.pathname, "/auth/callback");
  assert.equal(callback.searchParams.get("intent"), "link");
  assert.equal(callback.searchParams.get("provider"), "kakao");
  assert.equal(callback.searchParams.get("next"), "/owner/social-accounts");
  assert.equal(getSocialLinkProviderError("server_error", "identity_already_exists"), "already-linked");
  assert.equal(getSocialLinkProviderError("access_denied"), "cancelled");
});

test("a linked callback cannot switch the canonical account before any shop read or handoff", async () => {
  let signedOut = 0;
  let shopReads = 0;
  const auth = {
    exchangeCodeForSession: async () => ({ data: { session: { access_token: "fixture-access", refresh_token: "fixture-refresh", user: { id: "other-owner" } } }, error: null }),
    signOut: async options => { assert.deepEqual(options, { scope: "local" }); signedOut += 1; return { error: null }; },
  };
  await assert.rejects(completeSocialLogin({ auth, code: "fixture-code", expectedUserId: "canonical-owner", fetchShops: async () => { shopReads += 1; return Response.json([{ id: "fixture-shop" }]); } }), { reason: "social-failed" });
  assert.equal(signedOut, 1);
  assert.equal(shopReads, 0);
  auth.exchangeCodeForSession = async () => ({ data: { session: { access_token: "fixture-access", refresh_token: "fixture-refresh", user: { id: "canonical-owner" } } }, error: null });
  const result = await completeSocialLogin({ auth, code: "fixture-code", expectedUserId: "canonical-owner", fetchShops: async () => Response.json([{ id: "fixture-shop" }]) });
  assert.equal(result.shopId, "fixture-shop");
  assert.equal(signedOut, 1);
});
