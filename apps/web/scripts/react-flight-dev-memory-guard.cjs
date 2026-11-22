"use strict";

const asyncHooks = require("node:async_hooks");

const STATE = Symbol.for("petmanager.reactFlightDevMemoryGuard");

// React Flight's development-only ancestry tracker can retain completed async
// histories for a long-lived server (react/react#36836). Match its full callback
// signature so request AsyncLocalStorage and every other async hook stay active.
function isReactFlightDebugHook(callbacks) {
  if (!callbacks || !["init", "before", "promiseResolve", "destroy"].every(
    (name) => typeof callbacks[name] === "function",
  )) return false;
  const source = (name) => Function.prototype.toString.call(callbacks[name]);
  return source("init").includes("pendingOperations.get")
    && source("before").includes("lastRanAwait")
    && source("promiseResolve").includes("A Promise should never be an IO_NODE")
    && source("destroy").includes("pendingOperations.delete");
}

function installReactFlightDebugGuard() {
  if (process.env.NODE_ENV !== "development") return null;
  if (asyncHooks[STATE]) return asyncHooks[STATE];
  const originalCreateHook = asyncHooks.createHook;
  const state = { blockedHooks: 0 };
  asyncHooks.createHook = function createHook(callbacks) {
    const hook = Reflect.apply(originalCreateHook, this, [callbacks]);
    if (isReactFlightDebugHook(callbacks)) {
      state.blockedHooks += 1;
      Object.defineProperty(hook, "enable", {
        value() { return this; },
        configurable: true,
      });
    }
    return hook;
  };
  Object.defineProperty(asyncHooks, STATE, { value: state });
  return state;
}

function withDevelopmentMemoryGuard(nodeOptions = "") {
  const filename = __filename.replaceAll("\\", "/");
  let options = nodeOptions.trim();
  // Next otherwise grants this 32 GiB workstation a 16 GiB V8 heap. Collect
  // transient development allocations sooner while honoring explicit budgets.
  if (!/(?:^|\s|")--max[-_]old[-_]space[-_]size(?:=|\s)/.test(options)) {
    options += " --max-old-space-size=2048";
  }
  if (!options.replaceAll("\\", "/").includes(filename)) {
    options += ` --require ${JSON.stringify(filename)}`;
  }
  return options.trim();
}

function isNextDevelopmentWorker() {
  return /\/next\/dist\/server\/lib\/start-server\.js$/i.test(
    (process.argv[1] || "").replaceAll("\\", "/"),
  );
}

if (isNextDevelopmentWorker()) installReactFlightDebugGuard();

module.exports = {
  isReactFlightDebugHook,
  installReactFlightDebugGuard,
  withDevelopmentMemoryGuard,
};
