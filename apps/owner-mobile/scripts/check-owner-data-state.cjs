const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(projectRoot, "src");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(srcRoot, request.slice(2)), parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(compiled.outputText, filename);
};

const { createMockOwnerDataProvider } = require("../src/services/mockOwnerDataProvider");
const { runOwnerDataProviderLoad } = require("../src/services/ownerDataLoader");

function waitForMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function collectStates(loadProvider) {
  const states = [];
  runOwnerDataProviderLoad({
    loadProvider,
    onState: (state) => states.push(state),
  });
  await waitForMicrotasks();
  return states;
}

async function checkReadyFlow() {
  const provider = createMockOwnerDataProvider();
  const states = await collectStates(() => provider);

  assert.deepEqual(
    states.map((state) => state.status),
    ["loading", "ready"],
  );
  assert.equal(states[1].provider, provider);
  assert.equal(states[1].error, null);
}

async function checkErrorFlow() {
  const error = new Error("mock loader failed");
  const states = await collectStates(() => {
    throw error;
  });

  assert.deepEqual(
    states.map((state) => state.status),
    ["loading", "error"],
  );
  assert.equal(states[1].provider, null);
  assert.equal(states[1].error, error);
}

async function checkRetryFlow() {
  let attempts = 0;
  const provider = createMockOwnerDataProvider();
  const states = [];
  const loadProvider = () => {
    attempts += 1;
    if (attempts === 1) throw new Error("first attempt failed");
    return provider;
  };
  const run = () =>
    runOwnerDataProviderLoad({
      loadProvider,
      onState: (state) => states.push(state),
    });

  run();
  await waitForMicrotasks();
  run();
  await waitForMicrotasks();

  assert.deepEqual(
    states.map((state) => state.status),
    ["loading", "error", "loading", "ready"],
  );
  assert.equal(states[3].provider, provider);
}

function checkAppNavigatorIsMockOnly() {
  const source = fs.readFileSync(path.join(srcRoot, "navigation", "AppNavigator.tsx"), "utf8");

  assert.match(source, /useOwnerDataProvider/);
  assert.doesNotMatch(source, /selectOwnerDataProvider/);
  assert.doesNotMatch(source, /createRealOwnerDataProvider/);
  assert.doesNotMatch(source, /loadRealOwnerBootstrap/);
}

async function main() {
  checkAppNavigatorIsMockOnly();
  await checkReadyFlow();
  await checkErrorFlow();
  await checkRetryFlow();
  console.log("Owner data state checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
