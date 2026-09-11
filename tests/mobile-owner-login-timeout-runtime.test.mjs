import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/auth/owner-login-timeout.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
Function("module", "exports", output)(module, module.exports);
const { OwnerLoginTimeoutError, withOwnerLoginTimeout } = module.exports;

test("a completed login result is returned before the deadline", async () => {
  assert.equal(await withOwnerLoginTimeout(() => Promise.resolve("ok"), 50), "ok");
});

test("a never-settling login dependency is aborted and ends with a typed timeout", async () => {
  const startedAt = Date.now();
  let receivedSignal;
  await assert.rejects(
    withOwnerLoginTimeout((signal) => {
      receivedSignal = signal;
      return new Promise(() => {});
    }, 20),
    (error) => error instanceof OwnerLoginTimeoutError,
  );
  assert.equal(receivedSignal?.aborted, true);
  assert.ok(Date.now() - startedAt < 250);
});
