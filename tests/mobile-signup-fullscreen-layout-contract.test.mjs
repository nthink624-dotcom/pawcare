import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const signupForm = await readFile(
  new URL("../src/components/auth/signup-form.tsx", import.meta.url),
  "utf8",
);

test("signup profile uses a full-screen canvas without the old centered card", () => {
  assert.match(signupForm, /data-signup-shell="fullscreen"/);
  assert.match(signupForm, /min-h-dvh w-full bg-white/);
  assert.match(signupForm, /max-w-\[430px\]/);
  assert.doesNotMatch(
    signupForm,
    /rounded-\[18px\] border border-\[#e8edf3\] bg-white px-5 pb-8 pt-6/,
  );
});

test("signup profile uses stacked labels and keeps only the top-left page title", () => {
  assert.match(signupForm, /data-signup-field-style="stacked"/);
  assert.match(signupForm, /auth-type-label mb-2 block/);
  assert.doesNotMatch(signupForm, /absolute -top-2\.5 left-3/);
  assert.doesNotMatch(signupForm, /계정과 매장 정보를 입력해 주세요/);
  assert.doesNotMatch(signupForm, /<ServiceBrand/);
  assert.doesNotMatch(signupForm, /title="계정 정보"/);
  assert.doesNotMatch(signupForm, /title="매장 정보"/);
  assert.match(signupForm, /flex min-h-11 items-center gap-2/);
  assert.match(signupForm, />회원가입<\/h1>/);
  assert.doesNotMatch(signupForm, /shrink-0 border-b border-\[#e8edf3\] pb-5/);
});

test("signup profile keeps one mobile column at every viewport width", () => {
  assert.doesNotMatch(signupForm, /md:grid-cols-2/);
  assert.match(signupForm, /min-h-\[48px\].*border border-\[#dbe2ea\]/);
  assert.match(signupForm, /주소를 검색해 주세요/);
  assert.doesNotMatch(signupForm, /md:w-\[360px\]/);
});

test("signup page flows naturally instead of stretching controls to the viewport bottom", () => {
  assert.match(signupForm, /mx-auto w-full max-w-\[430px\] px-5/);
  assert.doesNotMatch(signupForm, /mx-auto flex min-h-dvh w-full max-w-\[430px\] flex-col/);
  assert.doesNotMatch(signupForm, /<div className="flex-1 py-7 sm:py-8">/);
  assert.match(signupForm, /className=\{cn\([\s\S]*"pt-4"[\s\S]*step === "profile"/);
});

test("signup remembers accepted current-version terms only for the active signup session", () => {
  assert.match(signupForm, /petmanager:signup-agreements:\$\{OWNER_SIGNUP_TERMS_VERSION\}/);
  assert.match(signupForm, /window\.sessionStorage\.getItem\(SIGNUP_AGREEMENT_STORAGE_KEY\)/);
  assert.match(signupForm, /writeSignupAgreementReceipt\(agreements\);/);
  assert.match(signupForm, /clearSignupAgreementReceipt\(\);/);
  assert.doesNotMatch(signupForm, /window\.localStorage/);
});
