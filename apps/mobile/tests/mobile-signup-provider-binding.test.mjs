import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/server/owner-identity-verification.ts", import.meta.url), "utf8");
const requestSource = await readFile(new URL("../src/app/api/auth/request-verification-code/route.ts", import.meta.url), "utf8");
const verifySource = await readFile(new URL("../src/app/api/auth/verify-pass/route.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/components/auth/signup-form.tsx", import.meta.url), "utf8");
function moduleFrom(text, mocks, fetchImpl) {
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("exports", "require", "fetch", js)(exports, (id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/")) throw new Error(`Unmocked module ${id}`);
    return require(id);
  }, fetchImpl ?? (() => { throw new Error("Network forbidden"); }));
  return exports;
}

// In-memory query emulator executes conditional updates at await time, including
// zero-row concurrent losers. It never loads credentials or contacts a database.
function fixture({ failInsert = false, failUpdate = false, expireOnUpdate = false } = {}) {
  const rows = new Map();
  const issued = new Map();
  const db = { from() {
    let update, insert, single = false;
    const predicates = [];
    const q = {
      select() { return q; },
      insert(row) { insert = row; return q; },
      update(row) { update = row; return q; },
      eq(k, v) { predicates.push((r) => r[k] === v); return q; },
      is(k, v) { predicates.push((r) => (r[k] ?? null) === v); return q; },
      gt(k, v) { predicates.push((r) => Date.parse(r[k]) > Date.parse(v)); return q; },
      maybeSingle() { single = true; return q; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          if (insert) {
            if (failInsert) return { data: null, error: { code: "PGRST205", message: "SECRET check constraint detail" } };
            rows.set(insert.id, { ...insert });
            return { data: null, error: null };
          }
          if (update && failUpdate) return { data: null, error: { message: "SECRET database error" } };
          if (update && expireOnUpdate) for (const row of rows.values()) row.provider_request_expires_at = "2000-01-01";
          const matches = [...rows.values()].filter((r) => predicates.every((fn) => fn(r)));
          if (update) for (const row of matches) Object.assign(row, update);
          return { data: single ? (matches[0] ? { ...matches[0] } : null) : matches, error: null };
        }).then(resolve, reject);
      },
    };
    return q;
  } };
  const identity = {
    identityVerificationPurposeSchema: require("zod").z.enum(["signup", "find-email", "reset-password"]),
    issueVerifiedIdentityToken(value) { const token = `fixture-token-${issued.size}`; issued.set(token, value); return token; },
    readVerifiedIdentityToken(token) { return issued.get(token); },
  };
  const mocks = {
    "@/lib/server-env": { getSupabaseServerRuntimeStage: () => "development", hasSupabaseServerEnv: () => true, hasPortoneServerEnv: () => true, serverEnv: { portoneApiSecret: "fixture", portoneStoreId: "fixture" } },
    "@/lib/auth/owner-credentials": { normalizeOwnerPhoneNumber: (s) => s.replace(/\D/g, ""), isValidBirthDate8: () => true, isValidOwnerEmail: () => true, normalizeOwnerEmail: (s) => s.trim() },
    "@/lib/auth/owner-identity": identity,
    "@/lib/supabase/server": { getSupabaseAdmin: () => db },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
  };
  const service = moduleFrom(source, mocks);
  mocks["@/server/owner-identity-verification"] = service;
  return { rows, issued, mocks, service };
}
const person = { purpose: "signup", name: "테스트", birthDate: "19900101", phoneNumber: "01000000000" };
async function request(f) {
  const r = await f.service.createProviderIdentityVerificationRequest(person);
  return { verificationRequestId: r.verificationRequestId, purpose: "signup", identityVerificationId: r.providerIdentityVerificationId, verificationState: r.verificationState };
}
function verified(binding, overrides = {}) {
  return { id: binding.identityVerificationId, status: "VERIFIED", verifiedCustomer: { name: person.name, birthDate: person.birthDate, phoneNumber: person.phoneNumber }, ...overrides };
}
const post = (body) => ({ json: async () => body });

test("server issues independent unpredictable bindings and persists only the real hash with five-minute expiry", async () => {
  const f = fixture(); const a = await request(f); const b = await request(f);
  assert.notEqual(a.verificationState, b.verificationState);
  assert.notEqual(a.identityVerificationId, b.identityVerificationId);
  assert.match(a.verificationState, /^[a-f0-9]{64}$/);
  const row = f.rows.get(a.verificationRequestId);
  assert.equal(row.provider_request_state_hash, createHash("sha256").update(a.verificationState).digest("hex"));
  assert.ok(!JSON.stringify(row).includes(a.verificationState));
  assert.ok(Date.parse(row.provider_request_expires_at) - Date.now() <= 300_000);
  assert.ok(Date.parse(row.provider_request_expires_at) - Date.now() > 295_000);
});

for (const [label, mutate] of [
  ["state", (b) => { b.verificationState = "0".repeat(64); }],
  ["provider ID", (b) => { b.identityVerificationId = "other"; }],
  ["purpose", (b) => { b.purpose = "find-email"; }],
  ["request ID", (b) => { b.verificationRequestId = "00000000-0000-4000-8000-000000000000"; }],
  ["expiry", (b, r) => { r.provider_request_expires_at = "2000-01-01"; }],
  ["malformed expiry", (b, r) => { r.provider_request_expires_at = "invalid"; }],
  ["missing hash", (b, r) => { r.provider_request_state_hash = null; }],
  ["consumed", (b, r) => { r.consumed_at = new Date().toISOString(); }],
  ["verified replay", (b, r) => { r.status = "verified"; }],
  ["failed", (b, r) => { r.status = "failed"; }],
  ["local method", (b, r) => { r.verification_method = "local"; }],
]) test(`rejects ${label} before provider lookup or token issuance`, async () => {
  const f = fixture(); const b = await request(f); mutate(b, f.rows.get(b.verificationRequestId));
  let calls = 0;
  const api = moduleFrom(verifySource, f.mocks, async () => { calls++; throw new Error("must not fetch"); });
  assert.equal((await api.POST(post(b))).status, 400);
  assert.equal(calls, 0); assert.equal(f.issued.size, 0);
});

for (const [label, change] of [
  ["provider result ID", (v) => { v.id = "wrong"; }],
  ["not VERIFIED", (v) => { v.status = "READY"; }],
  ["unverified customer fallback", (v) => { v.customer = v.verifiedCustomer; delete v.verifiedCustomer; }],
  ["name", (v) => { v.verifiedCustomer.name = "다른사람"; }],
  ["phone", (v) => { v.verifiedCustomer.phoneNumber = "01011111111"; }],
  ["birth", (v) => { v.verifiedCustomer.birthDate = "20000101"; }],
]) test(`rejects mismatched ${label}`, async () => {
  const f = fixture(); const b = await request(f); const v = verified(b); change(v);
  assert.equal((await f.service.completePortoneIdentityVerification({ ...b, identityVerification: v })).ok, false);
  assert.equal(f.issued.size, 0);
});

test("concurrent completion mints one token; replay and concurrent consumption have one winner", async () => {
  const f = fixture(); const b = await request(f);
  const results = await Promise.all([1, 2].map(() => f.service.completePortoneIdentityVerification({ ...b, identityVerification: verified(b) })));
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(f.issued.size, 1);
  assert.equal(await f.service.validatePortoneIdentityVerificationRequest(b), false);
  const token = results.find((r) => r.ok).verificationToken;
  const row = await f.service.getVerifiedIdentityForToken({ verificationToken: token, purpose: "signup", expectedName: person.name, expectedBirthDate: person.birthDate, expectedPhoneNumber: person.phoneNumber });
  assert.ok(row);
  assert.equal(await f.service.consumeVerifiedIdentity({ verificationId: row.id, tokenId: row.tokenId, action: "find-email" }), false);
  const consumed = await Promise.all([1, 2].map(() => f.service.consumeVerifiedIdentity({ verificationId: row.id, tokenId: row.tokenId, action: "signup" })));
  assert.equal(consumed.filter(Boolean).length, 1);
  assert.equal(await f.service.getVerifiedIdentityForToken({ verificationToken: token, purpose: "signup" }), null);
});

test("expiry during provider lookup or a failed update cannot mint a token", async () => {
  for (const options of [{ expireOnUpdate: true }, { failUpdate: true }]) {
    const f = fixture(options); const b = await request(f);
    const api = moduleFrom(verifySource, f.mocks, async () => Response.json(verified(b)));
    const response = await api.POST(post(b));
    assert.notEqual(response.status, 200); assert.equal(f.issued.size, 0);
    assert.ok(!(await response.text()).includes("SECRET"));
  }
});

test("expired verified token cannot be consumed", async () => {
  const f = fixture(); const b = await request(f);
  await f.service.completePortoneIdentityVerification({ ...b, identityVerification: verified(b) });
  const row = f.rows.get(b.verificationRequestId); row.verified_expires_at = "2000-01-01";
  assert.equal(await f.service.consumeVerifiedIdentity({ verificationId: row.id, tokenId: row.verification_token_id, action: "signup" }), false);
});

test("request API supplies binding; DB failure has safe error and no development provider fallback", async () => {
  for (const failInsert of [false, true]) {
    const f = fixture({ failInsert }); const api = moduleFrom(requestSource, f.mocks);
    const response = await api.POST(post({ ...person, method: "portone" })); const body = await response.json();
    assert.equal(response.status, failInsert ? 503 : 200);
    if (!failInsert) { assert.ok(body.providerIdentityVerificationId); assert.ok(body.verificationState); }
    else { assert.equal(f.rows.size, 0); assert.equal(body.code, "IDENTITY_REQUEST_FAILED"); }
    assert.ok(!JSON.stringify(body).includes("SECRET"));
  }
});

test("provider errors, already-verified responses, and timeout do not leak or reuse tokens", async () => {
  for (const mode of ["denied", "already verified", "timeout"]) {
    const f = fixture(); const b = await request(f);
    const api = moduleFrom(verifySource, f.mocks, async (_url, init) => {
      assert.ok(init.signal instanceof AbortSignal);
      if (mode === "timeout") throw new Error("SECRET timeout");
      return Response.json({ message: `SECRET ${mode}` }, { status: 400 });
    });
    const response = await api.POST(post(b));
    assert.ok(!response.ok); assert.ok(!(await response.text()).includes("SECRET")); assert.equal(f.issued.size, 0);
  }
});

test("verify API returns token only after exact server-queried result", async () => {
  const f = fixture(); const b = await request(f);
  const api = moduleFrom(verifySource, f.mocks, async (url) => {
    assert.equal(new URL(url).pathname, `/identity-verifications/${b.identityVerificationId}`);
    return Response.json(verified(b));
  });
  const response = await api.POST(post(b)); const body = await response.json();
  assert.equal(response.status, 200); assert.ok(body.verificationToken);
  assert.equal((await api.POST(post(b))).status, 400);
});


const uiAst = ts.createSourceFile("signup.tsx", ui, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function uiDeclaration(name) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) found = `const ${node.getText(uiAst)};`;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(uiAst);
    ts.forEachChild(node, visit);
  }
  visit(uiAst); assert.ok(found, `Missing active declaration ${name}`); return found;
}
function uiHarness({ sdkMode = "success", missingPhone = false, pendingSdk = false, bindingPatch = {}, pendingVerify = false } = {}) {
  const calls = [], messages = [], tokens = [];
  const attempt = { current: null }, revision = { current: 0 };
  let resolveSdk, resolveVerify;
  const sdk = { async requestIdentityVerification(input) {
    calls.push({ sdk: input });
    if (pendingSdk) return new Promise(resolve => { resolveSdk = resolve; });
    if (sdkMode === "cancel") return undefined;
    return { identityVerificationId: sdkMode === "mismatch" ? "wrong" : input.identityVerificationId, ...(sdkMode === "error" ? { code: "FAIL", message: "SECRET" } : {}) };
  } };
  const binding = { verificationRequestId: "11111111-1111-4111-8111-111111111111", providerIdentityVerificationId: "server-provider-id", verificationState: "a".repeat(64), ...bindingPatch };
  const env = { portoneStoreId: "fixture", portoneIdentityPhoneChannelKey: "legacy-phone-must-not-fallback", portoneIdentityUnifiedChannelKey: "legacy-unified-must-not-fallback" };
  const fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (url.endsWith("request-verification-code")) return Response.json(binding);
    if (pendingVerify) return new Promise(resolve => { resolveVerify = resolve; });
    return Response.json({ verificationToken: "fixture-token" });
  };
  const body = ["waitForIdentityOperation", "verifyPortoneIdentity", "startPhoneIdentity"].map(uiDeclaration).join("\n").replace('import("@portone/browser-sdk/v2")', 'Promise.resolve(sdk)') + "\nreturn { startPhoneIdentity };";
  const args = { sdk, env, process: { env: { NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY: missingPhone ? undefined : "fixture-kcp" } }, fetch, providerAttemptRef: attempt, identityRevisionRef: revision, verificationTokenRevisionRef: { current: null }, fields: { ...person }, loading: false, portoneReady: true, isValidBirthDate8: () => true, verificationPurpose: "signup", setLoading() {}, setMessage: v => messages.push(v), setVerificationToken: v => tokens.push(v) };
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const methods = new Function(...Object.keys(args), js)(...Object.values(args));
  return { ...methods, binding, calls, messages, tokens, attempt, revision, finish: () => resolveSdk({ identityVerificationId: binding.providerIdentityVerificationId }), finishVerify: () => resolveVerify(Response.json({ verificationToken: "late-token" })) };
}
async function waitForCalls(h, count) {
  for (let i = 0; i < 100 && h.calls.length < count; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.length, count, "expected branch was not reached");
}

// Replaces five obsolete provider entry cases with five distinct server bindings
// through the active KCP entry. No legacy provider entry is restored or skipped.
for (let index = 0; index < 5; index++) test(`KCP preserves server binding variant ${index + 1} through SDK and verify`, async () => {
  const h = uiHarness({ bindingPatch: { providerIdentityVerificationId: `pm_server_${index}`, verificationState: String(index + 1).repeat(64) } }); await h.startPhoneIdentity();
  assert.equal(h.calls.length, 3);
  assert.equal(h.calls[1].sdk.identityVerificationId, h.binding.providerIdentityVerificationId);
  assert.equal(h.calls[1].sdk.channelKey, "fixture-kcp"); assert.equal(h.calls[1].sdk.bypass, undefined);
  assert.equal(JSON.parse(h.calls[1].sdk.customData).petmanagerIdentityState, h.binding.verificationState);
  assert.equal(h.calls[2].body.verificationRequestId, h.binding.verificationRequestId);
  assert.equal(h.calls[2].body.verificationState, h.binding.verificationState);
  assert.equal(h.calls[2].body.identityVerificationId, h.binding.providerIdentityVerificationId);
  assert.equal(h.tokens.at(-1), "fixture-token");
});
test("inactive unified-provider entry is absent from the approved direct KCP signup", () => {
  const declarations = [];
  function visit(node) { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.push(node.name.text); ts.forEachChild(node, visit); }
  visit(uiAst); assert.ok(declarations.includes("startPhoneIdentity")); assert.ok(!declarations.includes("startUnifiedIdentity"));
  assert.match(uiDeclaration("moveToVerificationStep"), /await startPhoneIdentity\(\)/);
  assert.doesNotMatch(uiDeclaration("startPhoneIdentity"), /portoneIdentityUnifiedChannelKey|directAgency/);
});
test("missing KCP channel never falls back to configured legacy phone/unified channels", async () => {
  const h = uiHarness({ missingPhone: true }); await h.startPhoneIdentity(); assert.equal(h.calls.length, 0); assert.equal(h.tokens.filter(Boolean).length, 0);
  assert.equal(h.messages.at(-1), "KCP 본인인증 채널이 아직 연결되지 않았어요.");
});
for (const sdkMode of ["cancel", "error", "mismatch"]) test(`SDK ${sdkMode} cannot reach verify`, async () => {
  const h = uiHarness({ sdkMode }); await h.startPhoneIdentity(); assert.equal(h.calls.length, 2); assert.equal(h.tokens.filter(Boolean).length, 0);
  assert.ok(!h.messages.join().includes("SECRET"));
});
test("duplicate KCP click and cancelled late SDK callback cannot issue a token", async () => {
  const h = uiHarness({ pendingSdk: true }); const first = h.startPhoneIdentity(); await waitForCalls(h, 2);
  await h.startPhoneIdentity(); assert.equal(h.calls.length, 2); h.attempt.current.abort(); h.finish(); await first;
  assert.equal(h.calls.length, 2); assert.equal(h.tokens.filter(Boolean).length, 0);
});
for (const field of ["verificationRequestId", "providerIdentityVerificationId", "verificationState"]) test(`missing server ${field} never opens SDK`, async () => {
  const h = uiHarness({ bindingPatch: { [field]: null } }); await h.startPhoneIdentity(); assert.equal(h.calls.length, 1); assert.equal(h.tokens.filter(Boolean).length, 0);
});
test("identity revision change discards a late SDK success", async () => {
  const h = uiHarness({ pendingSdk: true }); const run = h.startPhoneIdentity(); await waitForCalls(h, 2); h.revision.current++; h.finish(); await run;
  assert.equal(h.calls.length, 2); assert.equal(h.tokens.filter(Boolean).length, 0);
});
test("identity revision change discards a late server token", async () => {
  const h = uiHarness({ pendingVerify: true }); const run = h.startPhoneIdentity(); await waitForCalls(h, 3); h.revision.current++; h.finishVerify(); await run;
  assert.equal(h.tokens.filter(Boolean).length, 0);
});
