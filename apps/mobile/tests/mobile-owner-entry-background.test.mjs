import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const runtime = { exports: {} };
const source = readFileSync(new URL("../src/lib/owner-entry-background.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
Function("module", "exports", output)(runtime, runtime.exports);
const { scheduleOwnerEntryBackground } = runtime.exports;

function withFrames(run) {
  const previous = globalThis.window;
  let id = 0;
  const frames = new Map();
  const timers = new Map();
  globalThis.window = {
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame(key) { frames.delete(key); },
    setTimeout(callback, delay) { timers.set(++id, { callback, delay }); return id; },
    clearTimeout(key) { timers.delete(key); },
  };
  const paint = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback());
  };
  const flush = () => {
    const callbacks = [...timers.values()];
    timers.clear();
    callbacks.forEach(({ callback }) => callback());
  };
  try { run({ paint, flush, frames, timers }); }
  finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

test("background entry work yields to rendering and the initial interaction budget", () => {
  withFrames(({ paint, flush, timers }) => {
    let calls = 0;
    scheduleOwnerEntryBackground(() => calls++);
    flush(); assert.equal(calls, 0);
    paint(); flush(); assert.equal(calls, 0);
    paint(); assert.equal(calls, 0);
    assert.equal([...timers.values()][0].delay, 1500);
    flush(); assert.equal(calls, 1);
    paint(); flush(); assert.equal(calls, 1);
  });
});

for (const paintsBeforeCancel of [0, 1, 2]) {
  test(`unmount or a superseding entry cancels background work after ${paintsBeforeCancel} frames`, () => {
    withFrames(({ paint, flush, frames, timers }) => {
      let calls = 0;
      const cancel = scheduleOwnerEntryBackground(() => calls++);
      for (let i = 0; i < paintsBeforeCancel; i++) paint();
      cancel(); cancel();
      paint(); paint(); flush();
      assert.equal(calls, 0);
      assert.equal(frames.size + timers.size, 0);
    });
  });
}

test("server rendering never starts owner background work", () => {
  let calls = 0;
  const cancel = scheduleOwnerEntryBackground(() => calls++);
  cancel();
  assert.equal(calls, 0);
});
