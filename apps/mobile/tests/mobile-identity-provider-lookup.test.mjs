import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/app/api/auth/verify-pass/route.ts", import.meta.url), "utf8");
const binding = {
  purpose: "signup", verificationRequestId: "11111111-1111-4111-8111-111111111111",
  identityVerificationId: "pm_fixture", verificationState: "a".repeat(64),
};
const verified = { id: binding.identityVerificationId, status: "VERIFIED" };

function harness(replies, { bindingValid = true, expiresBeforeCompletion = false, identitySecret } = {}) {
  let now = 0, completed = 0, validated = 0;
  const calls = [], waits = [], timeouts = [], logs = [];
  const mocks = {
    "@/lib/auth/owner-identity": { identityVerificationPurposeSchema: require("zod").z.enum(["signup", "find-email", "reset-password"]) },
    "@/lib/server-env": { hasSupabaseServerEnv: () => true, hasPortoneIdentityServerEnv: () => true, serverEnv: { portoneApiSecret: "PRIVATE_API_SECRET", portoneIdentityApiSecret: identitySecret, portoneStoreId: "fixture-store" } },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/server/owner-identity-verification": {
      validatePortoneIdentityVerificationRequest: async () => { validated += 1; return bindingValid; },
      completePortoneIdentityVerification: async (input) => {
        completed += 1;
        assert.deepEqual(input, { ...binding, identityVerification: verified });
        return expiresBeforeCompletion ? { ok: false, message: "expired" } : { ok: true, verificationToken: "fixture-token" };
      },
    },
  };
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("exports", "require", "fetch", "Date", "setTimeout", "AbortSignal", "console", js)(
    exports,
    (id) => { if (id in mocks) return mocks[id]; if (id.startsWith("@/")) throw Error(`Unexpected module ${id}`); return require(id); },
    async (url, init) => {
      calls.push({ url, init });
      const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
      if (reply.advance) now += reply.advance;
      if (reply.error) throw reply.error;
      if (reply.malformed) return new Response("PRIVATE_PROVIDER_DATA", { status: 200 });
      return Response.json(reply.body, { status: reply.status ?? 200 });
    },
    class extends Date { static now() { return now; } },
    (fn, ms) => { waits.push(ms); now += ms; fn(); return 0; },
    { timeout(ms) { timeouts.push(ms); return new AbortController().signal; } },
    { warn(...args) { logs.push(args); } },
  );
  return {
    run: () => exports.POST({ json: async () => binding }), calls, waits, timeouts, logs,
    completed: () => completed, validated: () => validated, elapsed: () => now,
  };
}

test("a delayed VERIFIED read completes without asking the user to authenticate again", async () => {
  const h = harness([{ body: { id: binding.identityVerificationId, status: "READY" } }, { body: verified }]);
  const response = await h.run();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).verificationToken, "fixture-token");
  assert.equal(h.calls.length, 2); assert.equal(h.completed(), 1); assert.equal(h.validated(), 1);
  assert.deepEqual(h.waits, [350]); assert.equal(h.logs.length, 0);
  for (const { url, init } of h.calls) {
    assert.equal(new URL(url).pathname, "/identity-verifications/pm_fixture");
    assert.equal(new URL(url).searchParams.get("storeId"), "fixture-store");
    assert.equal(init.method, undefined); assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
  }
});

test("transient HTTP and transport failures retry reads only", async () => {
  for (const first of [{ status: 503, body: { message: "PRIVATE_PROVIDER_DATA" } }, { error: Error("PRIVATE_PROVIDER_DATA") }, { status: 404, body: {} }]) {
    const h = harness([first, { body: verified }]);
    assert.equal((await h.run()).status, 200); assert.equal(h.calls.length, 2); assert.equal(h.completed(), 1);
  }
});

test("identity lookup can use its dedicated credential independently of the billing credential", async () => {
  const h = harness([{ body: verified }], { identitySecret: "PRIVATE_IDENTITY_SECRET" });
  assert.equal((await h.run()).status, 200);
  assert.equal(h.calls[0].init.headers.Authorization, "PortOne PRIVATE_IDENTITY_SECRET");
});

test("credential rejection and terminal FAILED results stop without issuing a token", async () => {
  for (const reply of [{ status: 401, body: { message: "PRIVATE_PROVIDER_DATA" } }, { status: 403, body: {} }, { body: { id: binding.identityVerificationId, status: "FAILED" } }]) {
    const h = harness([reply, { body: verified }]);
    const response = await h.run();
    assert.equal(response.status, 502); assert.equal(h.calls.length, 1); assert.equal(h.completed(), 0);
    assert.ok(!(await response.text()).includes("PRIVATE"));
  }
});

test("permanently pending, malformed, or unreachable results have a finite read budget", async () => {
  for (const reply of [{ body: { id: binding.identityVerificationId, status: "READY" } }, { malformed: true }, { error: Error("PRIVATE_PROVIDER_DATA") }]) {
    const h = harness([reply]);
    assert.equal((await h.run()).status, 502); assert.equal(h.calls.length, 3); assert.equal(h.completed(), 0);
    assert.deepEqual(h.waits, [350, 700]); assert.ok(h.timeouts.every(ms => ms <= 2500));
    const logs = JSON.stringify(h.logs);
    for (const privateValue of ["PRIVATE_PROVIDER_DATA", "PRIVATE_API_SECRET", binding.identityVerificationId, binding.verificationState, "https:"]) assert.ok(!logs.includes(privateValue));
  }
});

test("overall read deadline bounds subsequent attempts", async () => {
  const h = harness([{ body: { id: binding.identityVerificationId, status: "READY" }, advance: 4000 }]);
  assert.equal((await h.run()).status, 502);
  assert.equal(h.calls.length, 2); assert.equal(h.completed(), 0); assert.deepEqual(h.waits, [350]);
});

test("expired or tampered bindings cannot start a provider lookup", async () => {
  const h = harness([{ body: verified }], { bindingValid: false });
  assert.equal((await h.run()).status, 400); assert.equal(h.calls.length, 0); assert.equal(h.completed(), 0);
});

test("a request expiring while polling remains rejected by final completion validation", async () => {
  const h = harness([{ body: { id: binding.identityVerificationId, status: "READY" } }, { body: verified }], { expiresBeforeCompletion: true });
  assert.equal((await h.run()).status, 400); assert.equal(h.calls.length, 2); assert.equal(h.completed(), 1);
});
