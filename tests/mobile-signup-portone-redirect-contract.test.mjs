import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const signupForm = await readFile(new URL("../src/components/auth/signup-form.tsx", import.meta.url), "utf8");

test("Android signup uses a redirect flow that can resume PortOne verification", () => {
  assert.match(signupForm, /Capacitor\.getPlatform\(\) === "android"/);
  assert.match(signupForm, /mobile: useMobileRedirect \? "REDIRECTION" : "POPUP"/);
  assert.match(signupForm, /redirectUrl: buildPortoneSignupReturnUrl\(\), forceRedirect: true/);
  assert.match(signupForm, /PENDING_PORTONE_VERIFICATION_KEY/);
  assert.match(signupForm, /params\.get\("portoneReturn"\) !== "1"/);
  assert.match(signupForm, /returnedIdentityVerificationId !== pending\.identityVerificationId/);
  assert.match(signupForm, /fetch\("\/api\/auth\/verify-pass"/);
});

test("signup shows provider and network failures instead of silently stalling", () => {
  assert.match(signupForm, /result\?\.code \|\| !result\?\.identityVerificationId/);
  assert.match(signupForm, /setMessage\(result\?\.message \?\? "본인 인증을 완료하지 못했어요\."\)/);
  assert.match(signupForm, /본인 인증창을 열지 못했어요\. 네트워크 상태를 확인하고 다시 시도해 주세요\./);
});

test("redirect resume stores only opaque request metadata, not signup PII or passwords", () => {
  const pendingType = signupForm.match(/type PendingPortoneVerification = \{[\s\S]*?\n\};/)?.[0] ?? "";
  assert.match(pendingType, /verificationRequestId: string/);
  assert.match(pendingType, /identityVerificationId: string/);
  assert.doesNotMatch(pendingType, /password|email|phone|birth|name|address/i);
});
