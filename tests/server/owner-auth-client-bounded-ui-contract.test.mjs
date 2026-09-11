import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createBoundedAbortController } from "../../src/lib/auth/bounded-abort-controller.ts";

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

  assert.match(reset, /const identityApiAbortControllerRef = useRef<AbortController \| null>\(null\)/);
  assert.match(reset, /const identityUiAbortControllerRef = useRef<AbortController \| null>\(null\)/);
  assert.match(reset, /const passwordResetAbortControllerRef = useRef<AbortController \| null>\(null\)/);
  assert.match(reset, /apiTimeout = createBoundedAbortController\(IDENTITY_API_TIMEOUT_MS\)/);
  assert.match(reset, /uiTimeout = createBoundedAbortController\(PORTONE_IDENTITY_UI_TIMEOUT_MS\)/);
  assert.match(reset, /fetch\(`\/api\/auth\/check-email\?email=\$\{encodeURIComponent\(values\.email\)\}`, \{\s+signal: apiTimeout\.controller\.signal/);
  assert.match(reset, /fetch\("\/api\/auth\/reset-password", \{[\s\S]{0,360}signal: requestController\.signal/);
  assert.match(reset, /if \(!isCurrentIdentityAttempt\(\) \|\| (?:apiTimeout|uiTimeout)\.controller\.signal\.aborted\) return;/);
  assert.match(reset, /if \(!isCurrentPasswordResetAttempt\(\)\) return;/);
  assert.match(reset, /catch \{[\s\S]{0,120}if \(identityAttemptIdRef\.current !== identityAttemptId\) return;/);
  assert.match(reset, /catch \{[\s\S]{0,120}if \(passwordResetAttemptIdRef\.current !== passwordResetAttemptId\) return;/);
  assert.match(reset, /\{loading \? "확인 중\.\.\." : "다음"\}/);
  assert.match(reset, /\{loading \|\| isSubmitting \? "변경 중\.\.\." : "비밀번호 변경"\}/);
});

test("reset password fake clock keeps the PortOne UI alive after the API timeout boundary", () => {
  let now = 0;
  let nextId = 1;
  const tasks = new Map();
  const scheduler = {
    setTimeout(callback, delayMs) {
      const id = nextId++;
      tasks.set(id, { callback, dueAt: now + delayMs });
      return id;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
  };
  const tick = (elapsedMs) => {
    now += elapsedMs;
    for (const [id, task] of [...tasks.entries()].sort((left, right) => left[1].dueAt - right[1].dueAt)) {
      if (task.dueAt > now) continue;
      tasks.delete(id);
      task.callback();
    }
  };

  const apiPreparation = createBoundedAbortController(10_000, scheduler);
  tick(2_000);
  apiPreparation.dispose();

  const portoneUi = createBoundedAbortController(120_000, scheduler);
  tick(10_001);
  assert.equal(apiPreparation.controller.signal.aborted, false);
  assert.equal(portoneUi.controller.signal.aborted, false);

  tick(109_999);
  assert.equal(portoneUi.controller.signal.aborted, true);
  assert.equal(portoneUi.didTimeout(), true);
});
