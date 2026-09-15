import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const handoffPath = new URL("../src/lib/auth/owner-auth-handoff.ts", import.meta.url);
const ownerPagePath = new URL("../src/app/owner/mobile/page.tsx", import.meta.url);
const loginFormPath = new URL("../src/components/auth/login-form.tsx", import.meta.url);
const handoffSource = await readFile(handoffPath, "utf8");
const ownerPageSource = await readFile(ownerPagePath, "utf8");
const loginFormSource = await readFile(loginFormPath, "utf8");

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

function loadHandoffModule() {
  const output = ts.transpileModule(handoffSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  const storage = createStorage();
  const fakeWindow = { sessionStorage: storage, localStorage: storage, atob: (value) => Buffer.from(value, "base64").toString("utf8") };
  Function("module", "exports", "window", output)(compiledModule, compiledModule.exports, fakeWindow);
  return { api: compiledModule.exports, storage };
}

test("handoff remains readable until cache persistence explicitly clears it", () => {
  const { api } = loadHandoffModule();
  const session = { accessToken: "header.payload.signature", refreshToken: "refresh" };
  api.writeOwnerAuthHandoff(session);
  assert.deepEqual(api.peekOwnerAuthHandoff(), session);
  assert.deepEqual(api.peekOwnerAuthHandoff(), session);
  api.clearOwnerAuthHandoff();
  assert.equal(api.peekOwnerAuthHandoff(), null);
});

test("double effect shares access recovery and only the latest run bootstraps once", async () => {
  const { api } = loadHandoffModule();
  const gate = api.createLatestOwnerAccessGate();
  let resolveAccess;
  let accessCalls = 0;
  let bootstrapCalls = 0;
  const accessPromise = new Promise((resolve) => { resolveAccess = resolve; });
  const factory = () => { accessCalls += 1; return accessPromise; };
  const first = gate.begin(factory);
  const second = gate.begin(factory);
  resolveAccess({ accessToken: "opaque" });
  for (const run of [first, second]) {
    await run.access;
    if (gate.isLatest(run.runId)) bootstrapCalls += 1;
  }
  assert.equal(accessCalls, 1);
  assert.equal(bootstrapCalls, 1);
});

test("owner redirect is canonical, non-nesting, and single-navigation", () => {
  assert.match(ownerPageSource, /const requestedOwnerMobilePath = "\/owner\/mobile"/);
  assert.doesNotMatch(ownerPageSource, /window\.location\.pathname.*window\.location\.search/);
  assert.match(ownerPageSource, /ownerAccessGateRef\.current\.begin\(\(\) =>/);
  assert.match(ownerPageSource, /withOwnerMobileTimeout\(\(\) => getOwnerAccessContext\(\), 12_000\)/);
  assert.match(ownerPageSource, /!active \|\| !ownerAccessGateRef\.current\.isLatest/);
  assert.doesNotMatch(ownerPageSource, /router\.replace\(`\/login\?next=.*\n\s*router\.refresh\(\)/);
  assert.equal((loginFormSource.match(/router\.replace\("\/owner\/mobile"/g) ?? []).length, 1);
  assert.doesNotMatch(loginFormSource, /router\.replace\("\/owner\/mobile"[\s\S]{0,120}router\.refresh/);
});
