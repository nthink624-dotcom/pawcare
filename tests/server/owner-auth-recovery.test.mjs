import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

global.window = {
  localStorage: new MemoryStorage(),
  sessionStorage: new MemoryStorage(),
  atob: (value) => Buffer.from(value, "base64url").toString("utf8"),
};

const authCache = await import("../../src/lib/auth/owner-auth-handoff.ts");

function jwt(expSeconds) {
  return `header.${Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url")}.signature`;
}

test("expired access token leaves a refresh-only recovery credential", () => {
  authCache.clearOwnerAuthTokenCache();
  authCache.writeOwnerAuthTokenCache(jwt(Math.floor(Date.now() / 1000) - 60), "refresh-expired-access");
  assert.equal(authCache.readOwnerAuthTokenCache(), null);
  assert.equal(authCache.readOwnerAuthRefreshTokenCache(), "refresh-expired-access");
});

test("invalidating only access preserves refresh for the 401 retry", () => {
  authCache.clearOwnerAuthTokenCache();
  authCache.writeOwnerAuthTokenCache(jwt(Math.floor(Date.now() / 1000) + 3600), "refresh-after-401");
  authCache.clearOwnerAccessTokenCache();
  assert.equal(authCache.readOwnerAuthTokenCache(), null);
  assert.equal(authCache.readOwnerAuthRefreshTokenCache(), "refresh-after-401");
});

test("invalid refresh cleanup removes the complete session before relogin", () => {
  authCache.writeOwnerAuthTokenCache(jwt(Math.floor(Date.now() / 1000) + 3600), "invalid-refresh");
  authCache.clearOwnerAuthTokenCache();
  assert.equal(authCache.readOwnerAuthTokenCache(), null);
  assert.equal(authCache.readOwnerAuthRefreshTokenCache(), null);
});

test("relogin replaces a previously cleared invalid session", () => {
  authCache.clearOwnerAuthTokenCache();
  const nextAccessToken = jwt(Math.floor(Date.now() / 1000) + 3600);
  authCache.writeOwnerAuthSessionCache({ accessToken: nextAccessToken, refreshToken: "fresh-relogin" });
  assert.equal(authCache.readOwnerAuthTokenCache(), nextAccessToken);
  assert.equal(authCache.readOwnerAuthRefreshTokenCache(), "fresh-relogin");
});

test("authenticated API retries exactly on HTTP 401 and preserves refresh until refresh fails", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/lib/api.ts"), "utf8");
  assert.match(source, /error instanceof ApiResponseError/);
  assert.match(source, /error\.status !== 401/);
  assert.match(source, /clearOwnerAccessTokenCache\(\)/);
  assert.match(source, /refreshAccessTokenForRetry\(\)/);
  assert.match(source, /catch \(error\) \{\s*clearOwnerAuthTokenCache\(\)/);
});

test("essential bootstrap keeps owner authorization and defers noncritical reads", () => {
  const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/bootstrap/route.ts"), "utf8");
  const ownerPage = fs.readFileSync(path.join(process.cwd(), "src/app/owner/page.tsx"), "utf8");
  assert.match(route, /const owner = await requireOwnerShop/);
  assert.match(route, /includeNotifications: phase === "full"/);
  assert.match(route, /includeGroomingRecords: phase === "full"/);
  assert.match(route, /includeOwnerExtras: phase === "full"/);
  assert.match(ownerPage, /loadBootstrap\(resolvedShopId, "full"\)/);
  assert.ok(ownerPage.indexOf('setData(bootstrap)') < ownerPage.indexOf('loadBootstrap(resolvedShopId, "full")'));
});
