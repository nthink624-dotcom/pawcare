import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const ownerPage = await readFile(new URL("../src/app/owner/mobile/page.tsx", import.meta.url), "utf8");
const signupForm = await readFile(new URL("../src/components/auth/signup-form.tsx", import.meta.url), "utf8");
const loginPage = await readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");

function extractFunction(source, name, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `missing function ${name}`);
  return declaration.getText(sourceFile).replace(/^function /, "export function ");
}

async function importFunction(source, name, fileName) {
  const javascript = ts.transpileModule(extractFunction(source, name, fileName), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

test("canonical readiness fails closed and preserves the exact next setup step", async () => {
  const { readOwnerInitialSetupReadiness } = await importFunction(
    ownerPage,
    "readOwnerInitialSetupReadiness",
    "owner-mobile-page.tsx",
  );
  const readiness = {
    shopId: "shop-1",
    steps: { hours: true, staff: false, pricing: false },
    completed: false,
    nextStep: "staff",
  };
  assert.deepEqual(readOwnerInitialSetupReadiness({ initialSetupReadiness: readiness }, "shop-1"), readiness);
  assert.throws(
    () => readOwnerInitialSetupReadiness({ initialSetupReadiness: readiness }, "other-shop"),
    /초기 설정 상태/,
  );
  assert.throws(() => readOwnerInitialSetupReadiness({}, "shop-1"), /초기 설정 상태/);
});

const setupFlow = await readFile(new URL("../src/components/owner/owner-initial-setup-flow.tsx", import.meta.url), "utf8");

test("first signup alone opens the wizard; a saved checkpoint never blocks the owner app", () => {
  assert.match(ownerPage, /firstSetupEntry/);
  assert.match(ownerPage, /roleContext\.appRole === "owner" && firstSetupEntry/);
  assert.doesNotMatch(ownerPage, /hasSetupCheckpoint/);
  assert.match(ownerPage, /bootstrap: canonicalBootstrap/);
  assert.match(setupFlow, /onDefer/);
  assert.doesNotMatch(setupFlow, /const \[paused,/);
  assert.match(setupFlow, /advance\("hours"\)/);
  assert.match(setupFlow, /advance\("staff"\)/);
  assert.match(setupFlow, /advance\("pricing"\)/);
  assert.match(setupFlow, /await reloadSetup/);
  assert.match(setupFlow, /fresh.initialSetupReadiness.completed/);
  assert.match(setupFlow, /매장 시작하기/);
  assert.doesNotMatch(setupFlow, /PC 오너 화면/);
});

test("signup consumes nextAction, persists a returned session, and separates recoverable atomic states", async () => {
  const { resolveAtomicSignupNextPath } = await importFunction(
    signupForm,
    "resolveAtomicSignupNextPath",
    "signup-form.tsx",
  );
  assert.equal(resolveAtomicSignupNextPath({ nextAction: "initial_setup" }, "/fallback"), "/owner/mobile?entry=initial_setup");
  assert.equal(resolveAtomicSignupNextPath({ nextAction: "billing" }, "/fallback"), "/owner/billing?compare=1");
  assert.equal(resolveAtomicSignupNextPath({}, "/fallback"), "/fallback");

  assert.match(signupForm, /supabase\.auth\.setSession/);
  assert.match(signupForm, /writeOwnerAuthHandoff/);
  assert.match(signupForm, /writeOwnerAuthSessionCache/);
  assert.match(signupForm, /REQUEST_IN_PROGRESS/);
  assert.match(signupForm, /COMPENSATION_PENDING/);
  assert.match(signupForm, /입력 내용은 유지/);
});

test("login continuation rejects protocol-relative and backslash paths and no longer promises email confirmation", async () => {
  const { getSafeLoginNextPath } = await importFunction(loginPage, "getSafeLoginNextPath", "login-page.tsx");
  assert.equal(getSafeLoginNextPath("/owner/mobile?entry=initial_setup"), "/owner/mobile?entry=initial_setup");
  assert.equal(getSafeLoginNextPath("//attacker.invalid"), "/owner/mobile");
  assert.equal(getSafeLoginNextPath("/\\attacker.invalid"), "/owner/mobile");
  assert.doesNotMatch(loginPage, /signup-success.*인증 메일/);
  assert.match(loginPage, /로그인하면 초기 설정을 시작합니다/);
});

const setupLib = await readFile(new URL("../src/lib/owner-initial-setup-flow.ts", import.meta.url), "utf8");

test("checkpoint resumes only after canonical prerequisites; defaults never skip first setup", async () => {
  const { readSetupCheckpoint } = await importFunction(setupLib.replace("export function readSetupCheckpoint", "function readSetupCheckpoint"), "readSetupCheckpoint", "setup.ts");
  let stored = null;
  globalThis.window = { sessionStorage: { getItem: () => stored } };
  const ready = { steps: { hours: true, staff: true, pricing: true }, completed: true };
  assert.equal(readSetupCheckpoint("a", ready), "hours");
  stored = "pricing";
  assert.equal(readSetupCheckpoint("a", ready), "pricing");
  assert.equal(readSetupCheckpoint("a", { ...ready, steps: { ...ready.steps, hours: false } }), "hours");
  assert.equal(readSetupCheckpoint("a", { ...ready, steps: { ...ready.steps, staff: false } }), "staff");
  stored = "complete";
  assert.equal(readSetupCheckpoint("a", ready), "complete");
  assert.equal(readSetupCheckpoint("a", { ...ready, completed: false }), "hours");
  stored = "unknown";
  assert.equal(readSetupCheckpoint("a", ready), "hours");
  delete globalThis.window;
});

test("invalid hours never reach the write; valid midnight and end times are accepted", async () => {
  const { validateSetupHours } = await importFunction(setupLib.replace("export function validateSetupHours", "function validateSetupHours"), "validateSetupHours", "setup.ts");
  assert.throws(() => validateSetupHours({}, "09:00", "18:00"));
  assert.throws(() => validateSetupHours({ 1: { enabled: true, open: "18:00", close: "09:00" } }, "09:00", "18:00"));
  assert.throws(() => validateSetupHours({ 1: { enabled: true, open: "09:00", close: "18:00" } }, "25:00", "26:00"));
  assert.doesNotThrow(() => validateSetupHours({ 1: { enabled: true, open: "00:00", close: "23:59" } }, "00:00", "23:59"));
});
