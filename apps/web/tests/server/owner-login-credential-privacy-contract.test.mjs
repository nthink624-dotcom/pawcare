import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("owner login keeps unknown-email and wrong-password responses indistinguishable", () => {
  const route = read("src/app/api/auth/login/route.ts");
  const form = read("src/components/auth/login-form.tsx");

  assert.match(route, /const INVALID_CREDENTIALS_MESSAGE = "이메일 또는 비밀번호를 다시 확인해 주세요\."/);
  assert.equal((route.match(/reason: "invalid_credentials"/g) ?? []).length, 3);
  assert.doesNotMatch(route, /등록되지 않은 이메일/);
  assert.match(form, /reason\?: "invalid_credentials"/);
  assert.match(form, /result\.reason === "invalid_credentials" \|\| isInvalidCredentialMessage/);
  assert.doesNotMatch(form, /result\.reason === "email_not_registered"/);
  assert.match(form, /const LOGIN_REQUEST_TIMEOUT_MS = 10_000/);
});
