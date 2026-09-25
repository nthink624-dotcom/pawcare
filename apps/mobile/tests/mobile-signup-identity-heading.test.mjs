import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const signupForm = await readFile(
  new URL("../src/components/auth/signup-form.tsx", import.meta.url),
  "utf8",
);

const identityStart = signupForm.indexOf('{step === "identity" ? (');
const identityEnd = signupForm.indexOf('{step === "profile" ? (', identityStart);
const identityScreen = signupForm.slice(identityStart, identityEnd);

test("identity step removes only the visible representative heading and its gap", () => {
  assert.ok(identityStart >= 0);
  assert.ok(identityEnd > identityStart);
  assert.doesNotMatch(identityScreen, />대표자 정보<\/h2>/);
  assert.match(identityScreen, /<div data-signup-identity-fields>\s*<AuthSectionBlock>/);
  assert.doesNotMatch(identityScreen, /data-signup-identity-fields[^>]*gap-/);
});

test("identity step keeps all representative fields and state handlers", () => {
  for (const [label, field] of [
    ["이름", "name"],
    ["대표자 휴대폰", "phoneNumber"],
    ["생년월일", "birthDate"],
  ]) {
    assert.match(identityScreen, new RegExp(`label="${label}"`));
    assert.match(identityScreen, new RegExp(`updateField\\("${field}"`));
  }
});

test("profile back navigation keeps its representative accessibility label", () => {
  assert.match(
    signupForm,
    /label=\{step === "profile" \? "대표자 정보로 돌아가기" : "회원가입 시작으로 돌아가기"\}/,
  );
});
