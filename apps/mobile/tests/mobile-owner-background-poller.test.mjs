import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const runtime = { exports: {} };
Function("module", "exports", ts.transpileModule(
  readFileSync(new URL("../src/lib/owner-background-poller.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText)(runtime, runtime.exports);
const { createOwnerBackgroundPoller, shouldPollOwnerData } = runtime.exports;

test("only visible online data screens poll, and editing always pauses automatic reads", () => {
  const ready = { visible: true, online: true, activeTab: "home", busy: false };
  for (const activeTab of ["home", "book", "customers"]) assert.equal(shouldPollOwnerData({ ...ready, activeTab }), true);
  for (const activeTab of ["settings", "community", "unknown"]) assert.equal(shouldPollOwnerData({ ...ready, activeTab }), false);
  for (const block of [{ visible: false }, { online: false }, { busy: true }]) assert.equal(shouldPollOwnerData({ ...ready, ...block }), false);
});

async function clock(run) {
  const original = { now: Date.now, set: globalThis.setTimeout, clear: globalThis.clearTimeout };
  let time = 0, id = 0;
  const timers = new Map();
  Date.now = () => time;
  globalThis.setTimeout = (callback, delay) => { timers.set(++id, { callback, at: time + delay }); return id; };
  globalThis.clearTimeout = key => timers.delete(key);
  const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const advance = async duration => {
    const end = time + duration;
    while (true) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      time = due[1].at; timers.delete(due[0]); due[1].callback(); await settle();
    }
    time = end; await settle();
  };
  try { await run({ advance, settle, timers, now: () => time }); }
  finally { Date.now = original.now; globalThis.setTimeout = original.set; globalThis.clearTimeout = original.clear; }
}

test("focus storms and ticks share one read, counting the interval from completion", async () => clock(async ({ advance, settle }) => {
  let calls = 0, release;
  const p = createOwnerBackgroundPoller({ intervalMs: 30_000, canRun: () => true,
    run: () => { calls++; return new Promise(resolve => { release = resolve; }); } });
  await advance(30_000); assert.equal(calls, 1);
  for (let i = 0; i < 20; i++) void p.request();
  await advance(10_000); assert.equal(calls, 1);
  release(); await settle();
  await advance(29_999); assert.equal(calls, 1);
  await advance(1); assert.equal(calls, 2);
  p.stop(); release();
}));

test("failed reads back off to five minutes and focus cannot bypass cooldown", async () => clock(async ({ advance, now }) => {
  const calls = [];
  const p = createOwnerBackgroundPoller({ intervalMs: 30_000, canRun: () => true,
    run: async () => { calls.push(now()); throw Error("unavailable"); } });
  await advance(30_000); assert.deepEqual(calls, [30_000]);
  await advance(59_999); await p.request(); assert.equal(calls.length, 1);
  await advance(1); assert.deepEqual(calls, [30_000, 90_000]);
  await advance(120_000); await advance(240_000); await advance(300_000);
  assert.deepEqual(calls, [30_000, 90_000, 210_000, 450_000, 750_000]); p.stop();
}));

test("successful recovery resets the next interval to thirty seconds", async () => clock(async ({ advance }) => {
  let calls = 0;
  const p = createOwnerBackgroundPoller({ intervalMs: 30_000, canRun: () => true,
    run: async () => { if (++calls === 1) throw Error(); } });
  await advance(30_000); await advance(60_000); assert.equal(calls, 2);
  await advance(30_000); assert.equal(calls, 3); p.stop();
}));

test("a twenty-second timeout aborts transport without overlapping an unsettled read", async () => clock(async ({ advance, settle }) => {
  let calls = 0, signal, release;
  const p = createOwnerBackgroundPoller({ intervalMs: 30_000, canRun: () => true,
    run: s => { calls++; signal = s; return new Promise(resolve => { release = resolve; }); } });
  await advance(30_000); await advance(20_000); assert.equal(signal.aborted, true);
  await advance(300_000); void p.request(); assert.equal(calls, 1);
  release(); await settle(); await advance(59_999); assert.equal(calls, 1);
  await advance(1); assert.equal(calls, 2); p.stop(); release();
}));

test("hidden, offline, editing and static tabs can suspend reads without destroying cooldown", async () => clock(async ({ advance }) => {
  let enabled = false, calls = 0;
  const p = createOwnerBackgroundPoller({ intervalMs: 30_000, canRun: () => enabled,
    run: async () => { calls++; } });
  await advance(300_000); assert.equal(calls, 0);
  enabled = true; await p.request(); assert.equal(calls, 1);
  enabled = false; await advance(60_000); assert.equal(calls, 1);
  enabled = true; await p.request(); assert.equal(calls, 2); p.stop();
}));

test("unmount aborts the request and never rearms timers when it later settles", async () => clock(async ({ advance, settle, timers }) => {
  let signal, release;
  const p = createOwnerBackgroundPoller({ intervalMs: 30_000, canRun: () => true,
    run: s => { signal = s; return new Promise(resolve => { release = resolve; }); } });
  await advance(30_000); p.stop(); p.stop(); assert.equal(signal.aborted, true);
  release(); await settle(); assert.equal(timers.size, 0);
  await advance(300_000); await p.request(); assert.equal(timers.size, 0);
}));

test("the real notification watcher keeps its cooldown on equivalent bootstrap rerenders and still delivers new bookings", async () => clock(async ({ advance, timers }) => {
  const old = { window: globalThis.window, document: globalThis.document, navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator") };
  const win = new EventTarget(), doc = new EventTarget();
  doc.visibilityState = "visible";
  globalThis.window = win; globalThis.document = doc;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
  let effectDeps, cleanup, calls = 0, lastSignal;
  const received = [];
  win.addEventListener("owner-push", event => received.push(event.detail));
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL("../src/components/owner/owner-booking-notification-watcher.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const req = name => {
    if (name === "react") return {
      useMemo: factory => factory(),
      useEffect: (effect, deps) => {
        if (effectDeps?.every((v, i) => v === deps[i])) return;
        cleanup?.(); effectDeps = deps; cleanup = effect();
      },
    };
    if (name === "@/lib/owner-background-poller") return { createOwnerBackgroundPoller };
    if (name === "@/lib/push/owner-push-notifications") return { OWNER_PUSH_RECEIVED_EVENT: "owner-push" };
    if (name === "@/lib/api") return { fetchApiJsonWithAuth: async (path, init) => {
      assert.match(path, /shopId=shop%20one/); assert.equal(init.cache, "no-store");
      lastSignal = init.signal; calls++;
      return { notifications: calls === 1 ? [{ id: "old", appointmentId: "a1" }] : [{ id: "old", appointmentId: "a1" }, { id: "new", appointmentId: "a2" }] };
    } };
    throw Error(`Unexpected import ${name}`);
  };
  try {
    Function("module", "exports", "require", code)(module, module.exports, req);
    const render = () => module.exports.default({ shopId: "shop one", initialNotifications: [{ id: "old", type: "owner_booking_requested", status: "sent" }] });
    render(); await advance(30_000); assert.equal(calls, 1); assert.equal(received.length, 0);
    render(); win.dispatchEvent(new Event("focus")); await advance(29_999); assert.equal(calls, 1);
    await advance(1); assert.equal(calls, 2); assert.equal(lastSignal instanceof AbortSignal, true);
    assert.deepEqual(received, [{ kind: "owner_booking_requested", shopId: "shop one", appointmentId: "a2", opened: false }]);
    doc.visibilityState = "hidden"; await advance(60_000); assert.equal(calls, 2);
    cleanup(); assert.equal(timers.size, 0);
  } finally {
    cleanup?.();
    if (old.window === undefined) delete globalThis.window; else globalThis.window = old.window;
    if (old.document === undefined) delete globalThis.document; else globalThis.document = old.document;
    if (old.navigator) Object.defineProperty(globalThis, "navigator", old.navigator); else delete globalThis.navigator;
  }
}));
