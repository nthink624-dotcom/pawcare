import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loginTemplate = await readFile(
  new URL("../src/components/auth/mobile-login-screen-template.tsx", import.meta.url),
  "utf8",
);

const helperLinksStart = loginTemplate.indexOf("data-login-helper-links");
const helperLinksEnd = loginTemplate.indexOf(
  '<div className="auth-type-helper mt-1',
  helperLinksStart,
);
const helperLinksMarkup = loginTemplate.slice(helperLinksStart - 220, helperLinksEnd);

test("login recovery and signup links use the 16px customer control scale", () => {
  assert.ok(helperLinksStart > 0);
  assert.match(helperLinksMarkup, /text-\[16px\]/);
  assert.match(helperLinksMarkup, /leading-6/);
  assert.match(helperLinksMarkup, /font-medium/);
  assert.doesNotMatch(helperLinksMarkup, /auth-type-helper/);
});

test("login helper links keep 44px targets and whole Korean labels", () => {
  assert.match(helperLinksMarkup, /inline-flex min-h-11 items-center whitespace-nowrap/);
  assert.match(helperLinksMarkup, /flex flex-wrap/);
});

test("login helper labels and destinations remain unchanged", () => {
  assert.match(loginTemplate, /\{ href: "\/login\/find-email", label: "이메일 찾기" \}/);
  assert.match(loginTemplate, /\{ href: "\/login\/reset", label: "비밀번호 재설정" \}/);
  assert.match(
    loginTemplate,
    /\{ href: `\/signup\?next=\$\{encodeURIComponent\(nextPath\)\}`, label: "회원가입" \}/,
  );
});

test("privacy policy typography remains on the shared helper token", () => {
  assert.match(
    loginTemplate,
    /<div className="auth-type-helper mt-1 text-center text-\[#64748b\]">[\s\S]*PUBLIC_LEGAL_URLS\.privacy/,
  );
});
