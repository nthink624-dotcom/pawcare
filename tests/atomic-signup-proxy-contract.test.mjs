import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proxy = await import("../src/lib/auth/atomic-signup-proxy.ts");
const {
  ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
  MAX_SIGNUP_REQUEST_BYTES,
  MAX_SIGNUP_RESPONSE_BYTES,
  forwardAtomicSignupRequest,
  readAtomicSignupRequest,
} = proxy;

const payload = JSON.stringify({
  signupRequestId: "9d4ca3b5-a85f-4b52-a094-517237abc999",
  identityVerificationToken: "fixture-token",
  servicePrices: [{ id: "fixture-1", name: "목욕", price: 25000 }],
});
const localProxy = (overrides = {}) => ({
  enabled: true,
  mainOrigin: "http://127.0.0.1:3000",
  nodeEnv: "development",
  allowLocalFixture: true,
  payload,
  ...overrides,
});
const stream = (chunks) => new ReadableStream({
  start(controller) {
    for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
    controller.close();
  },
});

test("blocks signup before the atomic migration is enabled", async () => {
  const result = await forwardAtomicSignupRequest(localProxy({ enabled: false }));
  assert.equal(result.status, 503);
  assert.equal(JSON.parse(result.body).code, "ATOMIC_SIGNUP_MIGRATION_REQUIRED");
});

test("does not send upstream when the operation is gated", async () => {
  let called = false;
  await forwardAtomicSignupRequest(localProxy({ enabled: false, fetchImpl: async () => { called = true; return new Response("unexpected"); } }));
  assert.equal(called, false);
});

test("rejects declared, missing-header chunked, and false-header oversized requests", async () => {
  const oversized = "x".repeat(MAX_SIGNUP_REQUEST_BYTES + 1);
  for (const input of [
    { contentLength: String(MAX_SIGNUP_REQUEST_BYTES + 1), body: stream(["{}"]), contentType: "application/json" },
    { contentLength: null, body: stream([oversized]), contentType: "application/json" },
    { contentLength: "2", body: stream([oversized]), contentType: "application/json" },
  ]) {
    const result = await readAtomicSignupRequest(input);
    assert.equal(result.error.status, 413);
  }
});

test("forwards identical retry unchanged with the fixed contract header", async () => {
  let received;
  const result = await forwardAtomicSignupRequest(localProxy({
    fetchImpl: async (url, init) => {
      received = { url, init };
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
    },
  }));
  assert.equal(received.url, "http://127.0.0.1:3000/api/auth/signup");
  assert.equal(received.init.body, payload);
  assert.equal(received.init.headers["x-petmanager-signup-contract-version"], ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION);
  assert.equal(result.status, 200);
});

test("does not allow request-provided contract header to override the fixed value", async () => {
  let received;
  await forwardAtomicSignupRequest(localProxy({
    fetchImpl: async (_url, init) => {
      received = init;
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
    },
  }));
  assert.equal(received.headers["x-petmanager-signup-contract-version"], ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION);
});

test("preserves approved 409 and 400 main contract responses", async () => {
  for (const [status, code] of [[409, "SIGNUP_PAYLOAD_MISMATCH"], [409, "SIGNUP_COMPENSATION_PENDING"], [409, "CONTRACT_VERSION_MISMATCH"], [400, "IDENTITY_VERIFICATION_FAILED"]]) {
    const result = await forwardAtomicSignupRequest(localProxy({
      fetchImpl: async () => new Response(JSON.stringify({ code }), { status, headers: { "content-type": "application/json" } }),
    }));
    assert.equal(result.status, status);
    assert.equal(JSON.parse(result.body).code, code);
  }
});

test("fails closed for timeout, client abort, redirect, invalid JSON, and oversized response", async () => {
  const timeout = await forwardAtomicSignupRequest(localProxy({ fetchImpl: async (_url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))) }));
  assert.equal(timeout.status, 503);

  const disconnect = new AbortController();
  const disconnectRequest = forwardAtomicSignupRequest(localProxy({
    signal: disconnect.signal,
    fetchImpl: async (_url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))),
  }));
  disconnect.abort();
  assert.equal((await disconnectRequest).status, 503);

  for (const response of [
    new Response("", { status: 302, headers: { location: "https://example.test", "content-type": "application/json" } }),
    new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
    new Response(JSON.stringify({ error: "x".repeat(MAX_SIGNUP_RESPONSE_BYTES) }), { status: 200, headers: { "content-type": "application/json" } }),
  ]) {
    const result = await forwardAtomicSignupRequest(localProxy({ fetchImpl: async () => response }));
    assert.equal(result.status, 503);
  }
});

test("rejects HTTP, wrong host, userinfo, path, query, and fragment origins", async () => {
  const invalidOrigins = [
    "http://www.petmanager.co.kr",
    "https://evil.example",
    "https://user@www.petmanager.co.kr",
    "https://www.petmanager.co.kr/not-api",
    "https://www.petmanager.co.kr?target=evil",
    "https://www.petmanager.co.kr#fragment",
    "https://127.0.0.1:3000",
  ];
  for (const mainOrigin of invalidOrigins) {
    const result = await forwardAtomicSignupRequest(localProxy({ mainOrigin, nodeEnv: "production", allowLocalFixture: false }));
    assert.equal(result.status, 503);
  }
});

test("F signup route contains no direct write or PII logging code", async () => {
  const source = await readFile(new URL("../src/app/api/auth/signup/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /getSupabase|auth\.admin|auth\.signUp|\.from\(|console\./);
  assert.match(source, /readAtomicSignupRequest/);
  assert.match(source, /forwardAtomicSignupRequest/);
});

test("signup client sends one atomic payload and navigates only after success", async () => {
  const source = await readFile(new URL("../src/components/auth/signup-form.tsx", import.meta.url), "utf8");
  for (const field of ["signupRequestId", "identityVerificationToken", "servicePrices"]) assert.match(source, new RegExp(`\\b${field}\\b`));
  assert.match(source, /if \(loading\) return;/);
  assert.ok(source.indexOf("if (!response.ok || !result.success)") < source.indexOf("message=signup-success"));
});
