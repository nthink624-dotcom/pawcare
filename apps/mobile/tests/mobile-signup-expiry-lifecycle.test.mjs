import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = (await readFile(new URL("../src/components/auth/signup-form.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const tree = ts.createSourceFile("signup-form.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expiryEffect;
let sdkTimeout;
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node.parent.parent.getText(tree));
  if (ts.isCallExpression(node)) {
    if (node.expression.getText(tree) === "useEffect" && node.getText(tree).includes("const expiresAt = draftStartedAtRef.current")) expiryEffect = node.getText(tree);
    if (node.expression.getText(tree) === "waitForIdentityOperation" && node.arguments[0]?.getText(tree).startsWith("requestIdentityVerification(")) sdkTimeout = node.arguments[2]?.getText(tree);
  }
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(expiryEffect && sdkTimeout, "exercise the real signup expiry effect and provider call");
const javascript = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function clock() {
  let now = 0, sequence = 0;
  const pending = new Map();
  return {
    Date: { now: () => now },
    setTimeout(callback, delay) { const id = ++sequence; pending.set(id, { callback, at: now + Math.max(0, delay) }); return id; },
    clearTimeout(id) { pending.delete(id); },
    advance(ms) {
      now += ms;
      for (let runs = 0; runs < 100; runs++) {
        const next = [...pending].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) return;
        pending.delete(next[0]); next[1].callback();
      }
      throw Error("Unexpected timer loop");
    },
    get pendingCount() { return pending.size; },
  };
}

function expiryHarness({ flow = false, provider = false, phase = "idle", loading = false, completing = false } = {}) {
  const time = clock();
  const state = {
    flow: { current: flow ? new AbortController() : null },
    provider: { current: provider ? new AbortController() : null },
    completing: { current: completing ? "session-handoff-test" : null }, phase, loading,
  };
  const listeners = new Map();
  let resets = 0, previous, cleanup;
  const reset = () => { resets++; };
  const useEffect = (effect, dependencies) => {
    if (!previous || dependencies.some((value, index) => !Object.is(value, previous[index]))) {
      cleanup?.(); previous = dependencies; cleanup = effect();
    }
  };
  const execute = new Function("useEffect", "draftStartedAtRef", "VOLATILE_SIGNUP_DRAFT_TTL_MS", "completingSessionTokenRef", "resetSignup", "signupRequestId", "Date", "setTimeout", "clearTimeout", "window", "signupFlowRef", "providerAttemptRef", "signupPhase", "loading", javascript(expiryEffect));
  const render = () => execute(useEffect, { current: 0 }, 20 * 60 * 1000, state.completing, reset, "request-test", time.Date, time.setTimeout, time.clearTimeout, {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  }, state.flow, state.provider, state.phase, state.loading);
  render();
  return { time, state, render, focus: () => listeners.get("focus")?.(), dispose: () => cleanup?.(), get resets() { return resets; } };
}

test("the 20-minute deadline and return focus do not reset an active identity request", () => {
  const h = expiryHarness({ flow: true, provider: true, phase: "verifying", loading: true });
  h.time.advance(20 * 60 * 1000 + 1); h.focus();
  assert.equal(h.resets, 0);
  h.dispose();
});

test("expiry cannot interrupt the signup API after provider verification", () => {
  const h = expiryHarness({ flow: true, phase: "submitting" });
  h.time.advance(20 * 60 * 1000); h.focus();
  assert.equal(h.resets, 0); h.dispose();
});

test("an idle form still expires at its original 20-minute privacy deadline", () => {
  const h = expiryHarness();
  h.time.advance(20 * 60 * 1000 - 1); assert.equal(h.resets, 0);
  h.time.advance(1); assert.equal(h.resets, 1); h.dispose();
});

test("ending a failed active attempt rechecks an already expired privacy deadline", () => {
  const h = expiryHarness({ flow: true, provider: true, phase: "verifying", loading: true });
  h.time.advance(20 * 60 * 1000); assert.equal(h.resets, 0);
  h.state.flow.current = null; h.state.provider.current = null;
  h.state.phase = "idle"; h.state.loading = false; h.render(); h.time.advance(0);
  assert.equal(h.resets, 1); h.dispose();
});

test("phase changes before expiry do not extend the original privacy deadline", () => {
  const h = expiryHarness({ flow: true, phase: "checking" });
  h.time.advance(10 * 60 * 1000);
  h.state.flow.current = null; h.state.phase = "idle"; h.render();
  h.time.advance(10 * 60 * 1000); assert.equal(h.resets, 1); h.dispose();
});

test("session handoff is preserved and stale loading alone cannot suppress expiry", () => {
  const handoff = expiryHarness({ completing: true });
  handoff.time.advance(20 * 60 * 1000); assert.equal(handoff.resets, 0); handoff.dispose();
  const stale = expiryHarness({ loading: true });
  stale.time.advance(20 * 60 * 1000); assert.equal(stale.resets, 1); stale.dispose();
});

test("unmount removes the expiry timer and focus listener", () => {
  const h = expiryHarness(); h.dispose(); h.time.advance(21 * 60 * 1000); h.focus();
  assert.equal(h.resets, 0);
});

function identityWaitHarness() {
  const start = source.indexOf("function waitForIdentityOperation");
  const end = source.indexOf("type AtomicSignupServicePrice", start);
  assert.ok(start >= 0 && end > start);
  const timeoutDeclaration = declarations.get(sdkTimeout) ?? "";
  const time = clock();
  const create = new Function("setTimeout", "clearTimeout", javascript(source.slice(start, end) + "\n" + timeoutDeclaration) + `; return { wait: waitForIdentityOperation, timeout: ${sdkTimeout} };`);
  return { time, ...create(time.setTimeout, time.clearTimeout) };
}

test("provider wait accepts the observed ten-minute verification without timing out", async () => {
  const h = identityWaitHarness(); let resolve;
  const operation = new Promise(done => { resolve = done; });
  const pending = h.wait(operation, new AbortController().signal, h.timeout);
  let state = "pending"; pending.then(() => { state = "complete"; }, () => { state = "timed-out"; });
  h.time.advance(120_001); await Promise.resolve(); assert.equal(state, "pending");
  h.time.advance(505_999); await Promise.resolve(); assert.equal(state, "pending");
  resolve({ identityVerificationId: "provider-test" });
  assert.deepEqual(await pending, { identityVerificationId: "provider-test" });
  assert.equal(h.time.pendingCount, 0);
});

test("the provider wait is bounded by the server request lifetime", async () => {
  const serverSource = await readFile(new URL("../src/server/owner-identity-verification.ts", import.meta.url), "utf8");
  const expression = serverSource.match(/const PORTONE_REQUEST_EXPIRES_IN_MS = ([^;]+);/)[1];
  const serverLifetime = new Function(`return (${expression});`)();
  const h = identityWaitHarness(); assert.equal(h.timeout, serverLifetime);
  const pending = h.wait(new Promise(() => {}), new AbortController().signal, h.timeout);
  const failure = assert.rejects(pending, /IDENTITY_TIMEOUT/);
  h.time.advance(h.timeout); await failure;
  assert.equal(h.time.pendingCount, 0);
});
