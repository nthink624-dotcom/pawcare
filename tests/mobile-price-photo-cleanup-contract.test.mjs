import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/price-photo/mobile-price-photo-cleanup.ts", import.meta.url), "utf8");

function loadModule() {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  Function("module", "exports", output)(loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { createTransientCleanupRegistry } = loadModule();

test("concurrent cleanup for one media id performs one DELETE", async () => {
  let release;
  let calls = 0;
  const registry = createTransientCleanupRegistry(async () => {
    calls += 1;
    await new Promise((resolve) => { release = resolve; });
  });
  registry.acquire("one");
  const first = registry.cleanup("one");
  const second = registry.cleanup("one");
  release();
  await Promise.all([first, second]);
  await registry.cleanup("one");
  assert.equal(calls, 1);
});

test("failed DELETE remains pending and retryable", async () => {
  let calls = 0;
  const registry = createTransientCleanupRegistry(async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary");
  });
  registry.acquire("retry");
  await assert.rejects(registry.cleanup("retry"), /temporary/);
  await registry.retryPending();
  await registry.cleanup("retry");
  assert.equal(calls, 2);
});

test("native bridge clears stale cache, releases handed-off files, and wipes copy buffers", async () => {
  const java = await readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/ExternalCameraPlugin.java", import.meta.url), "utf8");
  const js = await readFile(new URL("../src/lib/media/external-camera.ts", import.meta.url), "utf8");
  assert.match(java, /public void load\(\)[\s\S]*clearStaleOutputFiles\(\)/);
  assert.match(java, /handleOnResume\(\)[\s\S]*clearStaleOutputFiles\(\)/);
  assert.match(java, /name\.startsWith\(FILE_PREFIX\)/);
  assert.match(java, /Arrays\.fill\(buffer, \(byte\) 0\)/);
  assert.match(java, /public void release\(PluginCall call\)[\s\S]*file\.delete\(\)/);
  assert.match(java, /detachPendingOutput\(\)/);
  assert.doesNotMatch(java, /Base64\.encode|ByteArrayOutputStream/);
  assert.match(js, /bytes\.fill\(0\)/);
  assert.match(js, /result\.base64 = ""/);
  assert.match(js, /ExternalCamera\.release/);
});
