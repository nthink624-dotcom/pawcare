import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const signupForm = await readFile(
  new URL("../src/components/auth/signup-form.tsx", import.meta.url),
  "utf8",
);

test("signup uses the approved compact field and action geometry", () => {
  assert.match(signupForm, /auth-type-control h-\[48px\] min-h-\[48px\] w-full [^"]*rounded-\[10px\]/);
  assert.match(signupForm, /bg-white px-\[14px\]/);
  assert.match(signupForm, /BUTTON_PRIMARY[\s\S]*h-\[48px\] min-h-\[48px\] rounded-\[10px\]/);
  assert.match(signupForm, /BUTTON_SECONDARY[\s\S]*h-\[48px\] min-h-\[48px\] rounded-\[10px\]/);
  assert.match(signupForm, /auth-type-label mb-2 block/);
});

test("signup gives every ordinary field the same 16px spacing", () => {
  assert.match(signupForm, /<div className="grid items-start gap-4" data-signup-profile-fields>/);
  assert.match(signupForm, /return <section className="space-y-4">/);
  assert.doesNotMatch(signupForm, /grid items-start gap-6/);
  assert.doesNotMatch(signupForm, /md:grid-cols-2/);
  assert.doesNotMatch(signupForm, /title="계정 정보"|title="매장 정보"/);
  assert.doesNotMatch(signupForm, /계정과 매장 정보를 입력해 주세요/);
  assert.doesNotMatch(signupForm, /<ServiceBrand/);
});

test("address and password affordances remain mobile-safe", () => {
  assert.match(signupForm, /min-h-\[48px\] w-full scroll-mb-\[calc\(env\(safe-area-inset-bottom\)\+96px\)\] items-center justify-between gap-3 rounded-\[10px\]/);
  assert.match(signupForm, /\[overflow-wrap:anywhere\]/);
  assert.equal(signupForm.match(/className="flex h-11 w-11 items-center justify-center rounded-\[8px\]/g)?.length, 2);
});

test("signup inputs and address text use regular weight locally", () => {
  assert.match(signupForm, /px-\[14px\] !font-normal text-\[#111827\]/);
  assert.match(signupForm, /placeholder:!font-normal/);
  assert.match(signupForm, /auth-type-control !font-normal text-left/);
});

test("profile actions stay fixed above the safe area without covering content", () => {
  assert.match(signupForm, /data-signup-action-bar="fixed"/);
  assert.match(signupForm, /fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-\[430px\]/);
  assert.match(signupForm, /px-5 pb-\[calc\(env\(safe-area-inset-bottom\)\+12px\)\] pt-3/);
  assert.match(signupForm, /pb-\[calc\(env\(safe-area-inset-bottom\)\+88px\)\]/);
  assert.match(signupForm, /scroll-mb-\[calc\(env\(safe-area-inset-bottom\)\+96px\)\]/);
  assert.match(signupForm, /<SignupConsentDialog/);
});

test("the page keeps safe-area padding without viewport-height push layout", () => {
  assert.match(signupForm, /pt-\[calc\(env\(safe-area-inset-top\)\+8px\)\]/);
  assert.doesNotMatch(signupForm, /flex min-h-dvh w-full max-w-\[430px\] flex-col/);
});
