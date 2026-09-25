import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/components/auth/signup-form.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("signup.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = `const ${node.getText(ast)};`;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, name);
  return found;
}
const token = (expiresAt = Date.now() + 60_000) => Buffer.from(JSON.stringify({ purpose: "signup", expiresAt })).toString("base64url") + ".fixture-signature";
function harness(options = {}) {
  const calls = [], messages = [], phases = [], routes = [];
  const fields = { name: "fixture", birthDate: "19900101", phoneNumber: "01000000000", email: "fixture@example.invalid", password: "Fixture!123", passwordConfirm: "Fixture!123", shopName: "fixture shop", shopPhone: "01000000000", shopAddress: "fixture address", ...options.fields };
  const signupFlowRef = { current: null }, providerAttemptRef = { current: null }, identityRevisionRef = { current: 0 }, verificationTokenRevisionRef = { current: options.cached ? 0 : null }, completingSessionTokenRef = { current: null };
  const args = {
    fields, signupFlowRef, providerAttemptRef, identityRevisionRef, verificationTokenRevisionRef, completingSessionTokenRef,
    loading: false, checkingEmail: false, requiredAgreed: options.agreed !== false, checkedEmail: null,
    verificationToken: options.cached ?? null, verificationPurpose: "signup", signupRequestId: "fixture-request",
    agreements: { service: true, privacy: true }, OWNER_SIGNUP_TERMS_VERSION: "fixture", OWNER_MARKETING_CONSENT_DOCUMENT_VERSION: "marketing-fixture", priceGuideFixtureRows: null, priceGuideFixtureEnabled: false,
    shopDetailAddress: "", safeNextPath: "/owner", portoneReady: true, env: { portoneStoreId: "fixture-store" },
    process: { env: { NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY: "fixture-kcp" } },
    isValidBirthDate8: v => /^\d{8}$/.test(v), normalizeOwnerEmail: v => v.trim().toLowerCase(), isValidOwnerEmail: v => v.includes("@"), isValidOwnerPassword: v => v.length >= 8, ownerPasswordRuleMessage: "password rule",
    setMessage: v => messages.push(v), setStep: v => calls.push(["step", v]), setSelectedVerificationMethod() {}, setVerificationDetailSheetOpen() {}, setVerificationSheetOpen() {},
    setSignupNavigating: value => calls.push(["navigating", value]), setFields() {}, createInitialSignupFields: () => ({}), setCheckingEmail() {}, setSignupPhase: v => phases.push(v), setIdentityAttempted() {}, setLoading() {}, setVerificationToken: v => { args.verificationToken = v; },
    checkEmailAvailability: async () => { calls.push(["email"]); if (options.emailWait) await options.emailWait; if (options.emailUnavailable) { messages.push("이미 가입된 이메일입니다."); return false; } return true; },
    clearVolatileSignupDraft() {}, clearSignupAgreementReceipt() {}, setSignupRequestId() {},
    resetSignup() { signupFlowRef.current?.abort(); signupFlowRef.current = null; },
    resolveAtomicSignupNextPath: () => "/owner", clearOwnerAuthTokenCache() {}, writeOwnerAuthHandoff() { calls.push(["handoff"]); }, writeOwnerAuthSessionCache() {},
    router: { replace: v => routes.push(v), refresh() {} },
    supabase: { auth: { setSession: async () => { if (options.sessionThrow) throw Error("fixture"); options.onSession?.(args); return { error: null }; } } },
    sdk: async input => { calls.push(["sdk", input]); if (options.sdkWait) await options.sdkWait; return options.cancel ? undefined : { identityVerificationId: input.identityVerificationId }; },
    fetch: async (url, init) => {
      const body = JSON.parse(init.body); calls.push([url, body]);
      if (url.endsWith("request-verification-code")) return { ok: true, json: async () => ({ verificationRequestId: "fixture-id", providerIdentityVerificationId: "fixture-provider", verificationState: "fixture-state" }) };
      if (url.endsWith("verify-pass")) return { ok: !options.verifyFail, json: async () => ({ verificationToken: token(), message: options.verifyMessage }) };
      if (url.endsWith("signup")) {
        if (options.signupWait) await options.signupWait;
        if (options.networkFail) throw Error("fixture network");
        return { ok: !options.signupFail, status: options.signupStatus ?? (options.signupFail ? 400 : 200), json: async () => ({ success: !options.signupFail, code: options.failureCode, session: { accessToken: "fixture-access", refreshToken: "fixture-refresh" } }) };
      }
      throw Error("Unexpected URL");
    },
  };
  const names = ["isSignupTokenFresh", "waitForIdentityOperation", "getRepresentativeIdentityError", "getRepresentativeAccountError", "moveToProfileStep", "returnToRepresentativeStep", "moveToVerificationStep", "verifyPortoneIdentity", "startPhoneIdentity", "submitSignup"];
  const body = names.map(declaration).join("\n").replace('import("@portone/browser-sdk/v2")', 'Promise.resolve({ requestIdentityVerification: sdk })');
  const js = ts.transpileModule(body + "\nreturn { run: moveToVerificationStep, next: moveToProfileStep, back: returnToRepresentativeStep, submitSignup, isSignupTokenFresh };", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return { ...new Function(...Object.keys(args), js)(...Object.values(args)), args, calls, messages, phases, routes };
}
const pending = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const settle = () => new Promise(r => setImmediate(r));
const signupCalls = h => h.calls.filter(c => c[0] === "/api/auth/signup");

test("fixture: one click validates then KCP then server verify then signup then completion", async () => {
  const h = harness(); await h.run();
  assert.deepEqual(h.calls.slice(0, 5).map(c => c[0]), ["email", "/api/auth/request-verification-code", "sdk", "/api/auth/verify-pass", "/api/auth/signup"]);
  assert.equal(h.calls[2][1].channelKey, "fixture-kcp");
  assert.equal(h.calls[3][1].verificationState, "fixture-state");
  assert.ok(signupCalls(h)[0][1].identityVerificationToken);
  assert.deepEqual(h.routes, ["/owner"]);
});
for (const options of [{ agreed: false }, { fields: { name: "" } }, { fields: { email: "bad" } }, { fields: { passwordConfirm: "wrong" } }, { fields: { shopAddress: "" } }]) test("fixture: invalid fields or consent never launch SDK", async () => {
  const h = harness(options); await h.run(); assert.equal(h.calls.filter(c => c[0] === "sdk").length, 0); assert.equal(signupCalls(h).length, 0);
});
for (const options of [{ cancel: true }, { verifyFail: true }]) test("fixture: cancellation/server rejection keeps fields and never signs up", async () => {
  const h = harness(options), before = { ...h.args.fields }; await h.run();
  assert.deepEqual(h.args.fields, before); assert.equal(signupCalls(h).length, 0); assert.ok(h.messages.filter(Boolean).length);
  assert.ok(!h.calls.some(c => c[0] === "step"));
});
test("fixture: synchronous duplicate click while checking sends one request", async () => {
  const wait = pending(), h = harness({ emailWait: wait.promise });
  const first = h.run(); await h.run(); wait.resolve(); await first;
  assert.equal(signupCalls(h).length, 1);
});
test("fixture: cancelled late SDK response cannot verify or submit", async () => {
  const wait = pending(), h = harness({ sdkWait: wait.promise }); const first = h.run(); await settle();
  h.args.signupFlowRef.current.abort(); h.args.providerAttemptRef.current.abort(); wait.resolve(); await first;
  assert.equal(signupCalls(h).length, 0); assert.ok(!h.calls.some(c => c[0] === "/api/auth/verify-pass"));
});
test("fixture: valid cached server token retries signup without SDK", async () => {
  const cached = token(), h = harness({ cached, signupFail: true }); await h.run();
  assert.ok(!h.calls.some(c => c[0] === "sdk")); assert.equal(signupCalls(h)[0][1].identityVerificationToken, cached);
  assert.equal(h.args.verificationToken, cached);
});
test("fixture: expired token reauthenticates", async () => {
  const h = harness({ cached: token(Date.now() - 1) }); await h.run(); assert.ok(h.calls.some(c => c[0] === "sdk"));
});
test("fixture: identity revision change invalidates cached token", async () => {
  const h = harness({ cached: token() }); h.args.identityRevisionRef.current++; await h.run(); assert.ok(h.calls.some(c => c[0] === "sdk"));
});
test("fixture: signup network failure preserves token and fields for retry", async () => {
  const h = harness({ networkFail: true }); await h.run(); assert.ok(h.args.verificationToken); assert.equal(h.args.fields.password, "Fixture!123"); assert.deepEqual(h.phases, ["checking", "verifying", "submitting", "idle"]);
});
test("fixture: aborted late signup response cannot navigate or hand off", async () => {
  const wait = pending(), h = harness({ signupWait: wait.promise }); const first = h.run(); await settle(); h.args.signupFlowRef.current.abort(); wait.resolve(); await first;
  assert.equal(h.routes.length, 0); assert.ok(!h.calls.some(c => c[0] === "handoff"));
});
test("fixture: completed signup with session failure navigates to login without resubmission", async () => {
  const h = harness({ sessionThrow: true }); await h.run(); assert.equal(signupCalls(h).length, 1); assert.match(h.routes[0], /signup-success/);
});
test("fixture: auth boundary ignores only the completing session; other identity resets", () => {
  const ref = { current: "fixture-access" }; let resets = 0;
  const js = ts.transpileModule(declaration("onAuthBoundary") + "; return onAuthBoundary;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const boundary = new Function("completingSessionTokenRef", "resetSignup", js)(ref, () => resets++);
  boundary("SIGNED_IN", { access_token: "fixture-access" }); assert.equal(resets, 0);
  boundary("SIGNED_IN", { access_token: "other" }); boundary("SIGNED_OUT"); assert.equal(resets, 2);
});
test("fixture: own SIGNED_IN during setSession completes routing", async () => {
  const h = harness({ onSession: args => {
    const js = ts.transpileModule(declaration("onAuthBoundary") + "; return onAuthBoundary;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("completingSessionTokenRef", "resetSignup", js)(args.completingSessionTokenRef, args.resetSignup)("SIGNED_IN", { access_token: "fixture-access" });
  } }); await h.run(); assert.deepEqual(h.routes, ["/owner"]);
});


test("two-step fixture: next checks email before profile without KCP or shop requirements", async () => {
  const h = harness({ fields: { shopName: "", shopPhone: "", shopAddress: "" } }); await h.next();
  assert.deepEqual(h.calls, [["email"], ["step", "profile"]]);
});
for (const fields of [{ name: "" }, { email: "bad" }, { passwordConfirm: "different" }]) test("two-step fixture: invalid representative/account stays at first step", () => {
  const h = harness({ fields }); h.next(); assert.equal(h.calls.length, 0); assert.ok(h.messages.filter(Boolean).length);
});
test("two-step fixture: back and next preserve every input including memory-only password", async () => {
  const h = harness(), before = { ...h.args.fields }; await h.next(); h.back(); await h.next();
  assert.deepEqual(h.args.fields, before); assert.deepEqual(h.calls, [["email"], ["step", "profile"], ["step", "identity"], ["email"], ["step", "profile"]]);
});
test("two-step fixture: account error at final submit returns to accessible first step", async () => {
  const h = harness({ fields: { email: "bad" } }); await h.run(); assert.deepEqual(h.calls, [["step", "identity"]]);
});
test("two-step fixture: navigation cannot disturb pending signup", () => {
  const h = harness(); h.args.signupFlowRef.current = new AbortController(); h.next(); h.back(); assert.equal(h.calls.length, 0);
});

for (const [field, message] of [
  ["이름", "본인확인 결과의 이름 정보가 일치하지 않습니다."],
  ["휴대폰번호", "본인확인 결과의 휴대폰번호가 일치하지 않습니다."],
  ["생년월일", "본인확인 결과의 생년월일이 일치하지 않습니다."],
]) test(`server ${field} mismatch explains correction and cannot issue signup token`, async () => {
  const h = harness({ verifyFail: true, verifyMessage: message }), before = { ...h.args.fields };
  await h.run();
  assert.ok(h.messages.some(m => m?.includes(`대표자 ${field}`) && m.includes("이전을 눌러")));
  assert.deepEqual(h.args.fields, before);
  assert.equal(signupCalls(h).length, 0);
  assert.equal(h.args.verificationToken, null);
  assert.ok(!h.calls.some(c => c[0] === "step"));
});
test("unknown verification error text is never echoed to customer", async () => {
  const h = harness({ verifyFail: true, verifyMessage: "PRIVATE_PROVIDER_CONTENT" }); await h.run();
  assert.ok(!h.messages.some(m => m?.includes("PRIVATE_PROVIDER_CONTENT")));
  assert.equal(signupCalls(h).length, 0);
});

for (const [code, expected] of [
  ["ATOMIC_SIGNUP_MIGRATION_REQUIRED", "가입 서버에 연결할 수 없어"],
  ["SIGNUP_REQUEST_TOO_LARGE", "가입 정보의 용량이 너무 커요"],
  ["INVALID_SIGNUP_REQUEST", "가입 요청 형식이 올바르지 않아요"],
]) test(`signup ${code} gives specific guidance and preserves verified token`, async () => {
  const cached = token(), h = harness({ cached, signupFail: true, failureCode: code }); await h.run();
  assert.ok(h.messages.some(m => m?.includes(expected)));
  assert.equal(h.args.verificationToken, cached);
  assert.equal(h.routes.length, 0);
  assert.equal(signupCalls(h).length, 1);
  assert.ok(!h.calls.some(c => c[0] === "sdk"));
});
test("unknown server failure is identified as a server error without exposing raw codes", async () => {
  const h = harness({ cached: token(), signupFail: true, signupStatus: 503, failureCode: "PRIVATE_UPSTREAM_CODE" }); await h.run();
  assert.ok(h.messages.some(m => m?.includes("가입 서버에서 오류")));
  assert.ok(!h.messages.some(m => m?.includes("PRIVATE_UPSTREAM_CODE")));
});

test("signup payload includes both agreed document versions", async () => {
  const h = harness(); await h.run();
  const payload = signupCalls(h)[0][1];
  assert.equal(payload.termsVersion, "fixture");
  assert.equal(payload.marketingConsentVersion, "marketing-fixture");
});

test("first next: duplicate email stays on identity and preserves all input", async () => {
  const h = harness({ emailUnavailable: true }), before = { ...h.args.fields };
  await h.next();
  assert.deepEqual(h.calls, [["email"]]);
  assert.deepEqual(h.args.fields, before);
  assert.ok(h.messages.includes("이미 가입된 이메일입니다."));
  assert.deepEqual(h.phases, ["checking", "idle"]);
});
test("first next: rapid double click waits for one email check", async () => {
  const wait = pending(), h = harness({ emailWait: wait.promise });
  const first = h.next(); await h.next();
  assert.deepEqual(h.calls, [["email"]]);
  wait.resolve(); await first;
  assert.deepEqual(h.calls, [["email"], ["step", "profile"]]);
});
test("first next: cancelled late check cannot advance", async () => {
  const wait = pending(), h = harness({ emailWait: wait.promise });
  const first = h.next(); h.args.signupFlowRef.current.abort(); wait.resolve(); await first;
  assert.deepEqual(h.calls, [["email"]]);
});

test("successful signup holds completion view and matching session through navigation", async () => {
  const h = harness(); await h.run();
  assert.ok(h.calls.some(c => c[0] === "navigating" && c[1] === true));
  assert.ok(!h.calls.some(c => c[0] === "step" && c[1] === "entry"));
  assert.equal(h.args.completingSessionTokenRef.current, "fixture-access");
});
test("completion ignores delayed same-account events but resets for signout or another account", () => {
  const ref = { current: "fixture-access" }; let resets = 0;
  const js = ts.transpileModule(declaration("onAuthBoundary") + "; return onAuthBoundary;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const boundary = new Function("completingSessionTokenRef", "resetSignup", js)(ref, () => resets++);
  boundary("SIGNED_IN", { access_token: "fixture-access" });
  boundary("INITIAL_SESSION", { access_token: "fixture-access" });
  assert.equal(resets, 0);
  boundary("SIGNED_IN", { access_token: "another" }); boundary("SIGNED_OUT"); assert.equal(resets, 2);
});
