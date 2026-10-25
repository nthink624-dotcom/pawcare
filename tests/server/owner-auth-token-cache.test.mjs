import assert from "node:assert/strict";
import test from "node:test";

import {
  clearOwnerAuthAccessTokenCache,
  clearOwnerAuthTokenCache,
  readOwnerAuthRefreshTokenCache,
  readOwnerAuthTokenCache,
  setCurrentOwnerAccessToken,
  writeOwnerAuthSessionCache,
} from "../../src/lib/auth/owner-auth-handoff.ts";

const CACHE_KEY = "petmanager.ownerAuthTokenCache";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  clear() {
    this.#values.clear();
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();

function makeAccessToken(expiresAt) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(expiresAt / 1000) })).toString("base64url");
  return `synthetic.${payload}.signature`;
}

function installWindow() {
  globalThis.window = {
    atob(value) {
      return Buffer.from(value, "base64").toString("utf8");
    },
    localStorage,
    sessionStorage,
  };
}

test.beforeEach(() => {
  installWindow();
  localStorage.clear();
  sessionStorage.clear();
  setCurrentOwnerAccessToken(null);
});

test.after(() => {
  delete globalThis.window;
});

test("an expired access token does not delete the refresh recovery credential", () => {
  const refreshToken = "synthetic-valid-refresh";
  writeOwnerAuthSessionCache({
    accessToken: makeAccessToken(Date.now() + 10 * 60_000),
    refreshToken,
  });

  for (const storage of [localStorage, sessionStorage]) {
    const payload = JSON.parse(storage.getItem(CACHE_KEY));
    storage.setItem(CACHE_KEY, JSON.stringify({ ...payload, expiresAt: Date.now() - 1 }));
  }
  setCurrentOwnerAccessToken(null);

  assert.equal(readOwnerAuthTokenCache(), null);
  assert.equal(readOwnerAuthRefreshTokenCache(), refreshToken);
});

test("access-only invalidation preserves refresh recovery until it succeeds or fails", () => {
  const refreshToken = "synthetic-valid-refresh";
  writeOwnerAuthSessionCache({
    accessToken: makeAccessToken(Date.now() + 10 * 60_000),
    refreshToken,
  });

  clearOwnerAuthAccessTokenCache();

  assert.equal(readOwnerAuthTokenCache(), null);
  assert.equal(readOwnerAuthRefreshTokenCache(), refreshToken);
});

test("full auth cleanup removes both access and refresh credentials", () => {
  writeOwnerAuthSessionCache({
    accessToken: makeAccessToken(Date.now() + 10 * 60_000),
    refreshToken: "synthetic-invalid-refresh",
  });

  clearOwnerAuthTokenCache();

  assert.equal(readOwnerAuthTokenCache(), null);
  assert.equal(readOwnerAuthRefreshTokenCache(), null);
});
