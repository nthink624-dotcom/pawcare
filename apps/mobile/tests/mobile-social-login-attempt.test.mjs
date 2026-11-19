import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({ resolve(specifier, context, next) {
  return next(specifier === "./safe-next-path" ? "./safe-next-path.ts" : specifier, context);
} });
const { beginMobileSocialAttempt, cancelMobileSocialAttempt, consumeMobileSocialReturn, getMobileSocialNextPath } = await import("../src/lib/auth/mobile-social-login-attempt.ts");

function storage() {
  const map = new Map();
  return { setItem: (key, value) => map.set(key, value), getItem: key => map.get(key) ?? null, removeItem: key => map.delete(key) };
}

test("native return must match the app callback and is consumed exactly once", () => {
  const data = storage();
  const url = beginMobileSocialAttempt(data, "/owner/mobile?tab=home");
  assert.match(url, /^kr\.petmanager\.owner:\/\/auth\/auth\/social\/callback\/[a-f0-9]{32}$/);
  assert.equal(consumeMobileSocialReturn(url.replace("://auth/", "://wrong/") + "?code=sample", data), null);
  assert.deepEqual(consumeMobileSocialReturn(url + "?code=sample", data), { nextPath: "/owner/mobile?tab=home", code: "sample" });
  assert.equal(consumeMobileSocialReturn(url + "?code=sample", data), null);
});

test("browser return must match the original mobile origin and attempt", () => {
  const data = storage(), origin = "https://app.petmanager.co.kr";
  const url = beginMobileSocialAttempt(data, "/owner/mobile", origin);
  assert.equal(consumeMobileSocialReturn(url.replace("app.petmanager", "www.petmanager") + "?code=sample", data, origin), null);
  assert.equal(consumeMobileSocialReturn(url + "?code=sample", data), null);
  assert.deepEqual(consumeMobileSocialReturn(url + "?code=sample", data, origin), { nextPath: "/owner/mobile", code: "sample" });
});

test("a superseded or cancelled attempt cannot replace an existing login", () => {
  const data = storage();
  const old = beginMobileSocialAttempt(data, "/owner/mobile");
  const current = beginMobileSocialAttempt(data, "/owner/mobile");
  assert.notEqual(old, current);
  assert.equal(consumeMobileSocialReturn(old + "?code=old", data), null);
  cancelMobileSocialAttempt(data);
  assert.equal(consumeMobileSocialReturn(current + "?code=current", data), null);
});

test("expired attempts, duplicate codes and token fragments cannot produce a session code", (t) => {
  const now = 1_800_000_000_000;
  const current = t.mock.method(Date, "now", () => now);
  const data = storage();
  const expired = beginMobileSocialAttempt(data, "/owner/mobile");
  current.mock.mockImplementation(() => now + 601_000);
  assert.equal(consumeMobileSocialReturn(expired + "?code=sample", data), null);
  const duplicate = beginMobileSocialAttempt(data, "/owner/mobile");
  assert.deepEqual(consumeMobileSocialReturn(duplicate + "?code=a&code=b", data), { nextPath: "/owner/mobile", error: "social-failed" });
  const fragment = beginMobileSocialAttempt(data, "/owner/mobile");
  assert.deepEqual(consumeMobileSocialReturn(fragment + "#access_token=fixture", data), { nextPath: "/owner/mobile", error: "social-failed" });
});

test("the provider cancellation message cannot redirect the user or exchange a code", () => {
  const data = storage();
  const url = beginMobileSocialAttempt(data, "https://foreign.example/");
  assert.deepEqual(consumeMobileSocialReturn(url + "#error=access_denied", data), { nextPath: "/owner/mobile", error: "social-cancelled" });
  for (const next of ["//foreign.example", "/owner/../admin", "/owner/%2e%2e/admin", "/admin", "/owner/mobile\\bad"]) {
    assert.equal(getMobileSocialNextPath(next), "/owner/mobile");
  }
});
