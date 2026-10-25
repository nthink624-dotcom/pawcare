import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const helperSource = await readFile(new URL("../src/lib/auth/safe-next-path.ts", import.meta.url), "utf8");
const loginPage = await readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
const signupPage = await readFile(new URL("../src/app/signup/page.tsx", import.meta.url), "utf8");
const loginForm = await readFile(new URL("../src/components/auth/login-form.tsx", import.meta.url), "utf8");
const signupForm = await readFile(new URL("../src/components/auth/signup-form.tsx", import.meta.url), "utf8");

const helperJavaScript = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getSafeNextPath } = await import(
  `data:text/javascript;base64,${Buffer.from(helperJavaScript).toString("base64")}`
);

test("safe next path preserves valid internal query and hash values", () => {
  for (const value of [
    "/owner",
    "/owner/mobile?entry=initial_setup#staff",
    "/owner/settings?label=%ED%95%9C%EA%B8%80#notifications",
    "/owner/a%20b?return=https%3A%2F%2Fdocs.example#details",
  ]) {
    assert.equal(getSafeNextPath(value, "/owner/mobile"), value);
  }
});

test("safe next path rejects external, encoded, normalized, and control-character bypasses", () => {
  const fallback = "/owner/mobile";
  for (const value of [
    undefined,
    null,
    "",
    "https://attacker.invalid/path",
    "javascript:alert(1)",
    "//attacker.invalid/path",
    "\\\\attacker.invalid\\path",
    "/\\attacker.invalid/path",
    "/%2f%2fattacker.invalid/path",
    "/%252f%252fattacker.invalid/path",
    "/%5c%5cattacker.invalid/path",
    "/%255c%255cattacker.invalid/path",
    "/%2e%2e//attacker.invalid/path",
    "/%252e%252e%252f%252fattacker.invalid/path",
    "/%EF%BC%BC%EF%BC%BCattacker.invalid/path",
    "/owner\u0000/mobile",
    "/owner%0aLocation:%20https://attacker.invalid",
    "/owner%250d%250aLocation:%20https://attacker.invalid",
  ]) {
    assert.equal(getSafeNextPath(value, fallback), fallback, String(value));
  }
});

test("login and signup server and router consumers use the shared guard", () => {
  assert.match(loginPage, /import \{ getSafeNextPath \} from "@\/lib\/auth\/safe-next-path"/);
  assert.match(loginPage, /getSafeLoginNextPath\([\s\S]*?getSafeNextPath,[\s\S]*?\)/);
  assert.match(signupPage, /getSafeNextPath\([\s\S]*?, "\/owner"\)/);
  assert.match(loginForm, /const safeNextPath = getSafeNextPath\(nextPath, "\/owner\/mobile"\)/);
  assert.match(loginForm, /router\.replace\(safeNextPath as never\)/);
  assert.match(loginForm, /nextPath=\{safeNextPath\}/);
  assert.match(signupForm, /const safeNextPath = getSafeNextPath\(nextPath, "\/owner"\)/);
  assert.match(signupForm, /router\.replace\(safeNextPath as never\)/);
  assert.match(signupForm, /resolveAtomicSignupNextPath\(result, safeNextPath\)/);
  assert.doesNotMatch(signupForm, /router\.replace\(nextPath as never\)/);
  assert.doesNotMatch(signupForm, /encodeURIComponent\(nextPath\)/);
});
