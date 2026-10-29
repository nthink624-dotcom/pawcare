import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function loadClient({ deferred = false, failFirst = false } = {}) {
  const calls = [];
  const releases = [];
  let accessToken = "fixture-not-a-credential";
  let elapsedMs = 0;
  const runtimeModule = { exports: {} };
  const require = name => {
    if (name === "@/lib/env") return {
      buildMobileApiUrl: value => new URL(value, "https://www.petmanager.co.kr").toString(),
      buildAppSameOriginApiUrl: value => new URL(value, "https://app.petmanager.co.kr").toString(),
      getMobileApiOrigin: () => "https://www.petmanager.co.kr",
    };
    if (name === "@/lib/auth/owner-auth-handoff") return { readOwnerAuthTokenCache: () => accessToken, setCurrentOwnerAccessToken() {} };
    if (name === "@/lib/supabase/client") return { getSupabaseBrowserClient: () => null };
    throw new Error("Unexpected module " + name);
  };
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (deferred) await new Promise(resolve => releases.push(resolve));
    if (failFirst && calls.length === 1) return new Response(JSON.stringify({ message: "fixture failure" }), { status: 503, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ fixture: true }), { headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
  };
  Function("require", "module", "exports", "fetch", "performance", output)(require, runtimeModule, runtimeModule.exports, fetch, { now: () => elapsedMs });
  return { client: runtimeModule.exports, calls, advanceTime: value => { elapsedMs += value; }, setAccessToken: value => { accessToken = value; }, release: () => releases.shift()?.(), releaseAll: () => releases.splice(0).forEach(resolve => resolve()) };
}

test("startup reads reuse preflight permission while retaining per-request authorization", async () => {
  const { client, calls } = loadClient();
  for (const path of ["/api/bootstrap?phase=launch", "/api/owner/shops", "/api/subscription?shopId=fixture-shop"]) {
    const result = await client.fetchApiJsonWithAuth(path, { cache: "no-store" });
    assert.deepEqual(result, { fixture: true });
  }
  assert.equal(calls.length, 3);
  for (const { init } of calls) {
    assert.equal(init.cache, "default");
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.get("Authorization"), "Bearer fixture-not-a-credential");
  }
});

test("unrelated reads and every mutation retain the caller's cache policy", async () => {
  const { client, calls } = loadClient();
  await client.fetchApiJsonWithAuth("/api/owner/media/assets", { cache: "no-store" });
  await client.fetchApiJsonWithAuth("/api/bootstrap", { method: "POST", cache: "no-store", body: "{}" });
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[1].init.cache, "no-store");
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[1].init.body, "{}");
});

test("explicit reload semantics are preserved", async () => {
  const { client, calls } = loadClient();
  await client.fetchApiJsonWithAuth("/api/bootstrap", { cache: "reload" });
  assert.equal(calls[0].init.cache, "reload");
});

test("an untrusted API origin is rejected before any request is sent", async () => {
  const { client, calls } = loadClient();
  await assert.rejects(client.fetchApiJsonWithAuth("https://untrusted.example/api/bootstrap", { cache: "no-store" }), /요청 원점/);
  assert.equal(calls.length, 0);
});

test("concurrent identical startup reads share a request but completed reads are not cached", async () => {
  const { client, calls } = loadClient();
  await Promise.all([client.fetchApiJsonWithAuth("/api/subscription?shopId=fixture"), client.fetchApiJsonWithAuth("/api/subscription?shopId=fixture")]);
  assert.equal(calls.length, 1);
  await client.fetchApiJsonWithAuth("/api/subscription?shopId=fixture");
  assert.equal(calls.length, 2);
});

test("different shops, phases, or cancellation signals never share a request", async () => {
  const { client, calls } = loadClient();
  await Promise.all([
    client.fetchApiJsonWithAuth("/api/bootstrap?shopId=a&phase=launch"),
    client.fetchApiJsonWithAuth("/api/bootstrap?shopId=b&phase=launch"),
    client.fetchApiJsonWithAuth("/api/bootstrap?shopId=a&phase=full"),
    client.fetchApiJsonWithAuth("/api/bootstrap?shopId=a&phase=launch", { signal: new AbortController().signal }),
  ]);
  assert.equal(calls.length, 4);
});

test("an account or token change never joins the previous authenticated request", async () => {
  const runtime = loadClient({ deferred: true });
  const previousAccountRead = runtime.client.fetchApiJsonWithAuth("/api/bootstrap?phase=launch");
  for (let i = 0; i < 5; i++) await Promise.resolve();
  runtime.setAccessToken("fixture-second-account-not-a-credential");
  const nextAccountRead = runtime.client.fetchApiJsonWithAuth("/api/bootstrap?phase=launch");
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(runtime.calls.length, 2);
  assert.notEqual(runtime.calls[0].init.headers.get("Authorization"), runtime.calls[1].init.headers.get("Authorization"));
  runtime.releaseAll();
  await Promise.all([previousAccountRead, nextAccountRead]);
});

test("failed reads release their slot so an explicit retry can make a fresh request", async () => {
  const { client, calls } = loadClient({ failFirst: true });
  await assert.rejects(client.fetchApiJsonWithAuth("/api/bootstrap"), /fixture failure/);
  assert.deepEqual(await client.fetchApiJsonWithAuth("/api/bootstrap"), { fixture: true });
  assert.equal(calls.length, 2);
});

test("retrying after a second does not join a hung request or lose the newer pending slot", async () => {
  const runtime = loadClient({ deferred: true });
  const oldRead = runtime.client.fetchApiJsonWithAuth("/api/bootstrap");
  for (let i = 0; i < 5; i++) await Promise.resolve();
  runtime.advanceTime(1001);
  const retry = runtime.client.fetchApiJsonWithAuth("/api/bootstrap");
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(runtime.calls.length, 2);
  runtime.release();
  await oldRead;
  const joinedRetry = runtime.client.fetchApiJsonWithAuth("/api/bootstrap");
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(runtime.calls.length, 2);
  runtime.releaseAll();
  await Promise.all([retry, joinedRetry]);
});

test("a mutation invalidates pending reads without an old completion clearing a newer request", async () => {
  const runtime = loadClient({ deferred: true });
  const oldRead = runtime.client.fetchApiJsonWithAuth("/api/bootstrap");
  for (let i = 0; i < 5; i++) await Promise.resolve();
  const mutation = runtime.client.fetchApiJsonWithAuth("/api/appointments", { method: "POST", body: "{}" });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  const newRead = runtime.client.fetchApiJsonWithAuth("/api/bootstrap");
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(runtime.calls.length, 3);
  runtime.release();
  await oldRead;
  const joinedRead = runtime.client.fetchApiJsonWithAuth("/api/bootstrap");
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(runtime.calls.length, 3);
  runtime.releaseAll();
  await Promise.all([mutation, newRead, joinedRead]);
});
