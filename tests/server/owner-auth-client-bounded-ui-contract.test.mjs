import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("owner auth client forms keep one bounded attempt and discard late UI results", () => {
  const login = read("src/components/auth/login-form.tsx");
  const findEmail = read("src/components/auth/find-email-form.tsx");
  const reset = read("src/components/auth/reset-password-form.tsx");
  const loginScreen = read("src/components/auth/mobile-login-screen-template.tsx");

  assert.match(login, /const LOGIN_REQUEST_TIMEOUT_MS = 10_000/);
  assert.match(login, /const loginAbortControllerRef = useRef<AbortController \| null>\(null\)/);
  assert.match(login, /const loginAttemptId = \+\+loginAttemptIdRef\.current/);
  assert.match(login, /signal: requestController\.signal/);
  assert.match(login, /if \(!isCurrentLoginAttempt\(\)\) return;/);
  assert.match(login, /catch \(error\) \{[\s\S]{0,240}if \(loginAttemptIdRef\.current !== loginAttemptId\) return;/);
  assert.match(loginScreen, /data-testid="owner-login-submit"[\s\S]{0,600}focus-visible:outline-\[#2563eb\]/);

  assert.match(findEmail, /const FIND_EMAIL_REQUEST_TIMEOUT_MS = 10_000/);
  assert.match(findEmail, /const findEmailAbortControllerRef = useRef<AbortController \| null>\(null\)/);
  assert.match(findEmail, /Promise\.race\(\[\s+findEmailWithKcpIdentityVerification\(\),\s+waitForClientAbort\(requestController\.signal\)/);
  assert.match(findEmail, /if \(!isCurrentFindEmailAttempt\(\)\) return;/);
  assert.match(findEmail, /catch \{[\s\S]{0,120}if \(findEmailAttemptIdRef\.current !== findEmailAttemptId\) return;/);
  assert.match(findEmail, /"본인인증 확인 시간이 길어 요청을 중단했어요\. 다시 시도해 주세요\."/);

  assert.match(reset, /const AUTH_REQUEST_TIMEOUT_MS = 10_000/);
  assert.match(reset, /const identityAbortControllerRef = useRef<AbortController \| null>\(null\)/);
  assert.match(reset, /const passwordResetAbortControllerRef = useRef<AbortController \| null>\(null\)/);
  assert.match(reset, /fetch\(`\/api\/auth\/check-email\?email=\$\{encodeURIComponent\(values\.email\)\}`, \{\s+signal: requestController\.signal/);
  assert.match(reset, /fetch\("\/api\/auth\/reset-password", \{[\s\S]{0,360}signal: requestController\.signal/);
  assert.match(reset, /if \(!isCurrentIdentityAttempt\(\)\) return;/);
  assert.match(reset, /if \(!isCurrentPasswordResetAttempt\(\)\) return;/);
  assert.match(reset, /catch \{[\s\S]{0,120}if \(identityAttemptIdRef\.current !== identityAttemptId\) return;/);
  assert.match(reset, /catch \{[\s\S]{0,120}if \(passwordResetAttemptIdRef\.current !== passwordResetAttemptId\) return;/);
  assert.match(reset, /\{loading \? "확인 중\.\.\." : "다음"\}/);
  assert.match(reset, /\{loading \|\| isSubmitting \? "변경 중\.\.\." : "비밀번호 변경"\}/);
});
