import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const templatePath = new URL("../src/components/auth/mobile-login-screen-template.tsx", import.meta.url);
const formPath = new URL("../src/components/auth/login-form.tsx", import.meta.url);
const routePath = new URL("../src/app/api/auth/login/route.ts", import.meta.url);
const timeoutPath = new URL("../src/lib/auth/owner-login-timeout.ts", import.meta.url);
const [template, form, route, timeout] = await Promise.all([
  readFile(templatePath, "utf8"), readFile(formPath, "utf8"), readFile(routePath, "utf8"), readFile(timeoutPath, "utf8"),
]);

test("mobile owner login is a full-viewport page without modal chrome", () => {
  assert.match(template, /<main className="min-h-\[100dvh\] w-full bg-white/);
  assert.match(template, /<form[\s\S]*className="mx-auto flex min-h-\[100dvh\] w-full max-w-\[430px\]/);
  assert.match(template, /env\(safe-area-inset-top\)/);
  assert.match(template, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(template, /<section[^>]+rounded-/);
  assert.doesNotMatch(template, /<section[^>]+shadow-/);
  assert.doesNotMatch(template, /<section[^>]+border /);
  assert.doesNotMatch(template, /backdrop|role="dialog"|aria-modal/);
});

test("a normal login button activation crosses the native form submit boundary exactly once", () => {
  assert.match(template, /<form[\s\S]*onSubmit=\{\(event\) => \{/);
  assert.match(template, /event\.preventDefault\(\)/);
  assert.match(template, /if \(!loading\) onLogin\(\)/);
  assert.match(template, /data-testid="owner-login-submit"[\s\S]*type="submit"/);
  assert.doesNotMatch(template, /data-testid="owner-login-submit"[\s\S]{0,120}onClick=\{onLogin\}/);
});

test("login controls preserve accessible mobile sizing and error recovery", () => {
  assert.match(template, /data-testid="owner-login-email"/);
  assert.match(template, /data-testid="owner-login-password"/);
  assert.match(template, /data-testid="owner-login-submit"/);
  assert.match(template, /auth-type-control min-h-\[52px\]/);
  assert.match(template, /auth-type-control min-h-\[56px\]/);
  assert.match(template, /focus:border-\[#2563eb\] focus:ring-2/);
  assert.match(template, /canResendConfirmation/);
  assert.match(template, /인증 메일 다시 받기/);
});

test("authentication and session handoff navigate once to the canonical owner route", () => {
  assert.match(form, /fetch\("\/api\/auth\/login"/);
  assert.doesNotMatch(form, /getSupabaseBrowserClient|supabase\.auth\.setSession/);
  assert.match(form, /writeOwnerAuthHandoff\(handoff\)/);
  assert.match(form, /writeOwnerAuthSessionCache\(handoff\)/);
  assert.match(form, /router\.replace\("\/owner\/mobile" as never\)/);
  assert.doesNotMatch(form, /router\.refresh\(\)/);
});

test("the login surface removes only server-rejected Supabase session cookies", () => {
  assert.match(form, /clearRejectedSupabaseSessionCookies/);
  assert.match(form, /\^sb-\.\*-auth-token/);
  assert.match(form, /Max-Age=0; Path=\/; SameSite=Lax/);
  assert.match(form, /SAVED_EMAIL_KEY/);
});

test("login request and session handoff always finish within a bounded timeout", () => {
  assert.match(route, /withOwnerLoginTimeout\(\(signal\) => executeLogin\(request, signal\), OWNER_LOGIN_ROUTE_TIMEOUT_MS\)/);
  assert.match(route, /abortSignal\(signal\)/);
  assert.match(route, /getSupabaseAuthClient\(signal\)/);
  assert.doesNotMatch(route, /updateUserById|email_confirm/);
  assert.match(route, /status: 504/);
  assert.match(form, /new AbortController\(\)/);
  assert.match(form, /signal: requestController\.signal/);
  assert.match(form, /traceOwnerMobileStartupStep\("login-api"/);
  assert.match(form, /로그인 응답이 지연되고 있습니다/);
  assert.match(timeout, /Promise\.race/);
  assert.match(timeout, /clearTimeout\(timer\)/);
});

test("valid Supabase credentials are distinguished from a missing app owner profile", () => {
  const credentialsCheck = route.indexOf('traceLoginDecision("credentials-rejected", 401)');
  const profileCheck = route.indexOf('traceLoginDecision("profile-missing", 403)');
  assert.ok(credentialsCheck >= 0);
  assert.ok(profileCheck > credentialsCheck);
  assert.match(route, /Google Play 테스트 참여 계정과 앱 로그인 계정은 별개입니다/);
  assert.match(route, /!profileResult\.data\?\.user_id \|\| data\.user\.id !== profileResult\.data\.user_id/);
  assert.doesNotMatch(route, /등록되지 않은 이메일입니다\. 이메일을 확인해 주세요/);
});
