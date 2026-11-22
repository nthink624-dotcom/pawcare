const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const guardPath = require.resolve("./react-flight-dev-memory-guard.cjs");
const { withDevelopmentMemoryGuard } = require(guardPath);

function child(source, env = {}) {
  const result = spawnSync(process.execPath, ["-e", source], {
    cwd: __dirname,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 20_000,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}

test("real bundled React debug tracking is suppressed while async request contexts work", () => {
  child(`
    const assert = require('node:assert/strict');
    const { AsyncLocalStorage, createHook } = require('node:async_hooks');
    const guard = require(${JSON.stringify(guardPath)});
    const state = guard.installReactFlightDebugGuard();
    let promiseEvents = 0;
    const observer = require('node:async_hooks').createHook({
      init(id, type) { if (type === 'PROMISE') promiseEvents++; }
    }).enable();
    require('next/dist/compiled/next-server/app-page-turbo.runtime.dev.js');
    assert.ok(state.blockedHooks >= 1, 'Installed React callback signature did not match');
    const storage = new AsyncLocalStorage();
    Promise.all(['request-a', 'request-b'].map(id => storage.run(id, async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(storage.getStore(), id);
      await Promise.resolve();
      assert.equal(storage.getStore(), id);
    }))).then(() => {
      assert.ok(promiseEvents > 0, 'Ordinary async hooks stopped working');
      observer.disable();
    }).catch(error => { console.error(error); process.exitCode = 1; });
  `, { NODE_ENV: "development" });
});

test("production does not modify async hooks", () => {
  child(`
    const assert = require('node:assert/strict');
    const hooks = require('node:async_hooks');
    const before = hooks.createHook;
    const guard = require(${JSON.stringify(guardPath)});
    assert.equal(guard.installReactFlightDebugGuard(), null);
    assert.equal(hooks.createHook, before);
  `, { NODE_ENV: "production" });
});

test("preload preserves existing Node flags and boots with the generated NODE_OPTIONS", () => {
  const options = withDevelopmentMemoryGuard("--max-old-space-size=4096 --enable-source-maps");
  assert.ok(options.startsWith("--max-old-space-size=4096 --enable-source-maps "));
  assert.equal(withDevelopmentMemoryGuard(options), options);
  child(`
    const assert = require('node:assert/strict');
    assert.ok(require.cache[${JSON.stringify(guardPath)}]);
  `, { NODE_ENV: "production", NODE_OPTIONS: options });
});

test("default development budget is applied by Node rather than reserving half the workstation", () => {
  child(`
    const assert = require('node:assert/strict');
    const heapLimit = require('node:v8').getHeapStatistics().heap_size_limit;
    assert.ok(heapLimit <= 2304 * 1024 * 1024, 'Default development heap budget was not applied');
  `, { NODE_ENV: "development", NODE_OPTIONS: withDevelopmentMemoryGuard() });
});
