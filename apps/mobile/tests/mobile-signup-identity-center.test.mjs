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

test("identity stage uses the approved 32px top spacing without centering", () => {
  assert.match(signupForm, /<div className=\{PAGE_CONTENT\}>/);
  assert.match(signupForm, /step === "identity" \? "pt-8" : "pt-4"/);
  assert.match(
    identityScreen,
    /className="w-full text-left" data-signup-identity-stage="top"/,
  );
  assert.doesNotMatch(identityScreen, /my-auto|translate-y|top-1\/2/);
  assert.doesNotMatch(signupForm, /step === "identity" && "flex min-h-dvh flex-col"/);
  assert.doesNotMatch(signupForm, /step === "identity" && "flex flex-1 flex-col"/);
});

test("identity fields keep their order, width, spacing, values, and handlers", () => {
  const fields = [
    ["이름", "name"],
    ["대표자 휴대폰", "phoneNumber"],
    ["생년월일", "birthDate"],
  ];
  let previousIndex = -1;
  for (const [label, field] of fields) {
    const labelIndex = identityScreen.indexOf(`label="${label}"`);
    assert.ok(labelIndex > previousIndex);
    previousIndex = labelIndex;
    assert.match(identityScreen, new RegExp(`updateField\\("${field}"`));
  }
  assert.match(identityScreen, /<AuthSectionBlock>/);
  assert.match(identityScreen, /data-signup-identity-fields/);
  assert.match(identityScreen, /w-full text-left/);
});

test("identity error stays in the top-aligned flow while other steps keep their message", () => {
  const fieldsEnd = signupForm.indexOf("</fieldset>", identityStart);
  const alert = signupForm.indexOf('role="alert"', fieldsEnd);
  const footer = signupForm.indexOf('data-signup-action-bar="fixed"', fieldsEnd);
  assert.ok(fieldsEnd > identityStart && alert > fieldsEnd && footer > alert);
  assert.match(signupForm.slice(fieldsEnd, footer), /message && !startTarget/);
  assert.match(signupForm.slice(fieldsEnd, footer), /INLINE_ERROR/);
});

test("identity footer stays fixed and content reserves its safe area", () => {
  assert.match(signupForm, /data-signup-stage-footer=\{step\}/);
  assert.match(signupForm, /fixed inset-x-0 bottom-0 z-30/);
  assert.match(signupForm, /pb-\[calc\(env\(safe-area-inset-bottom\)\+88px\)\]/);
  assert.match(signupForm, /scroll-mb-\[calc\(env\(safe-area-inset-bottom\)\+96px\)\]/);
});
