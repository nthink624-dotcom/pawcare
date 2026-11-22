import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test, { after } from "node:test";

Object.assign(process.env, {
  NODE_ENV: "test", VERCEL: "1", RELAY_ACCESS_MODE: "read-only", RELAY_SECRET: "local-test-secret",
  SSODAA_API_URL: "https://apis.ssodaa.com/kakao/send/alimtalk",
  SSODAA_API_KEY: "fixture-key", SSODAA_TOKEN_KEY: "fixture-token", SSODAA_SENDER_KEY: "fixture-sender",
});
const originalFetch = globalThis.fetch;
const providerCalls: string[] = [];
globalThis.fetch = (async input => {
  const url = new URL(String(input));
  providerCalls.push(url.pathname);
  assert.equal(url.pathname, "/kakao/template/category/all");
  return Response.json({ code: "200", content: [{ code: "test", name: "fixture" }] });
}) as typeof fetch;
const { default: app } = await import("../src/server.ts");
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Missing test listener");

async function call(method: string, path: string, secret = "local-test-secret", body?: unknown) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const request = http.request({ host: "127.0.0.1", port: address.port, method, path, headers: {
      "x-relay-secret": secret, ...(raw ? { "content-type": "application/json", "content-length": Buffer.byteLength(raw) } : {}),
    } }, response => {
      const chunks: Buffer[] = [];
      response.on("data", c => chunks.push(Buffer.from(c)));
      response.on("end", () => resolve({ status: response.statusCode || 0, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    request.on("error", reject); if (raw) request.write(raw); request.end();
  });
}

test("health advertises immutable read-only mode and catalog reads still work", async () => {
  assert.equal((await call("GET", "/health")).body.accessMode, "read-only");
  assert.equal((await call("GET", "/debug/templates")).status, 200);
  assert.equal((await call("GET", "/admin/templates/categories")).status, 200);
});

test("register, stop, send, history and configuration are rejected before any provider request", async () => {
  const before = providerCalls.length;
  for (const [method, path] of [["POST", "/alimtalk/send"], ["POST", "/admin/templates/register"], ["POST", "/admin/templates/retire"], ["POST", "/admin/templates/code-check"], ["POST", "/admin/sent-list"], ["PUT", "/admin/config"], ["GET", "/admin/config"], ["GET", "/admin/provider/diagnostics"]]) {
    const response = await call(method, path, "local-test-secret", method === "GET" ? undefined : { accessMode: "full" });
    assert.equal(response.status, 403, path);
    assert.equal(response.body.code, "RELAY_READ_ONLY", path);
  }
  assert.equal(providerCalls.length, before, "blocked operations must never reach the provider");
  assert.equal((await call("GET", "/health")).body.accessMode, "read-only");
  assert.equal((await call("POST", "/alimtalk/send", "wrong-secret", {})).status, 401);
});

after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
