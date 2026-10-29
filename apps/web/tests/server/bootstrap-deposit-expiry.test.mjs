import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const runtime = { exports: {} };
const javascript = ts.transpileModule(readFileSync(new URL("../../src/server/bootstrap-deposit-expiry.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
Function("module", "exports", javascript)(runtime, runtime.exports);
const { expireBootstrapDeposits } = runtime.exports;

test("fresh absence of pending holds performs no unnecessary database mutation", async () => {
  const count = await expireBootstrapDeposits(Promise.resolve({ pendingDepositPreparationExists: false }), async () => {
    assert.fail("No expiry RPC should run when the fresh canonical snapshot has no pending holds");
  });
  assert.equal(count, 0);
});

test("a newly added pending hold on the next snapshot still runs expiry and returns its count", async () => {
  let calls = 0;
  const expire = async () => { calls++; return 2; };
  assert.equal(await expireBootstrapDeposits(Promise.resolve({ pendingDepositPreparationExists: false }), expire), 0);
  assert.equal(await expireBootstrapDeposits(Promise.resolve({ pendingDepositPreparationExists: true }), expire), 2);
  assert.equal(calls, 1);
});

for (const snapshot of [null, Promise.resolve(null), Promise.resolve({})]) {
  test("legacy or unknown deposit state preserves the original expiry operation", async () => {
    let calls = 0;
    assert.equal(await expireBootstrapDeposits(snapshot, async () => { calls++; return 1; }), 1);
    assert.equal(calls, 1);
  });
}

test("a failed canonical read cannot turn into a successful or mutating fallback", async () => {
  let calls = 0;
  await assert.rejects(expireBootstrapDeposits(Promise.reject(new Error("fixture read failure")), async () => { calls++; return 0; }));
  assert.equal(calls, 0);
});

test("required expiry failures still reject instead of returning an unclean snapshot", async () => {
  await assert.rejects(expireBootstrapDeposits(Promise.resolve({ pendingDepositPreparationExists: true }), async () => { throw new Error("fixture expiry failure"); }));
});
