import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = (await readFile(
  new URL("../src/components/auth/signup-form.tsx", import.meta.url),
  "utf8",
)).replace(/\r\n/g, "\n");

const sourceFile = ts.createSourceFile(
  "signup-form.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function variableStatementText(name) {
  let result = null;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      result = node.parent.parent.getText(sourceFile);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(result, `missing variable declaration: ${name}`);
  return result;
}

const cacheStart = source.indexOf("type RetainedSignupStep =");
const cacheEnd = source.indexOf("function AuthField", cacheStart);
const cacheSource = source.slice(cacheStart, cacheEnd);
const cacheJavaScript = ts.transpileModule(cacheSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const createVolatileCache = new Function(
  "window",
  "OWNER_SIGNUP_TERMS_VERSION",
  `${cacheJavaScript}; return {
    read: readVolatileSignupDraft,
    write: writeVolatileSignupDraft,
    clear: clearVolatileSignupDraft,
    ttl: VOLATILE_SIGNUP_DRAFT_TTL_MS,
  };`,
);

function signupDraft() {
  return {
    savedAt: 1_000,
    signupRequestId: "signup-request-test",
    step: "profile",
    agreements: { service: true, privacy: true, location: false, marketing: true },
    fields: {
      name: "테스트 대표",
      birthDate: "19900321",
      phoneNumber: "01012345678",
      verificationCode: "123456",
      email: "retained@example.invalid",
      password: "Testpass!234",
      passwordConfirm: "Testpass!234",
      shopName: "테스트 매장",
      shopPhone: "01012345678",
      shopAddress: "테스트 주소",
    },
    shopDetailAddress: "테스트 상세주소",
    shopPostalCode: "00000",
    checkedEmail: "retained@example.invalid",
    selectedVerificationMethod: "phone",
    verificationSheetOpen: false,
    verificationDetailSheetOpen: true,
    phoneCarrier: "SKT",
    message: "휴대폰 본인 인증 채널이 아직 연결되지 않았어요.",
  };
}

test("volatile remount draft retains the profile, inputs, consent, modal, and error without storage", () => {
  const cache = createVolatileCache({}, "2026-03-31");
  const draft = signupDraft();
  cache.write(draft, 1_000);
  draft.fields.name = "외부 변경";

  const restored = cache.read("email", 1_001);
  assert.equal(restored.step, "profile");
  assert.equal(restored.fields.name, "테스트 대표");
  assert.equal(restored.fields.password, undefined);
  assert.equal(restored.fields.passwordConfirm, undefined);
  assert.equal(restored.fields.verificationCode, undefined);
  assert.deepEqual(restored.agreements, {
    service: true,
    privacy: true,
    location: false,
    marketing: true,
  });
  assert.equal(restored.verificationDetailSheetOpen, true);
  assert.match(restored.message, /채널/);

  restored.fields.email = "mutated@example.invalid";
  assert.equal(cache.read("email", 1_002).fields.email, "retained@example.invalid");
  cache.write(signupDraft(), 2_000);
  assert.equal(cache.read("email", 2_001).savedAt, 1_000);
  assert.equal(cache.read("email", 1_000 + cache.ttl), null);
  assert.doesNotMatch(cacheSource, /localStorage|sessionStorage|indexedDB/);
});

test("component initializers and initialStart effect restore instead of resetting a remount", () => {
  assert.match(source, /const \[restoredDraft, setRestoredDraft\] = useState\(\(\) => readVolatileSignupDraft\(initialStart\)\)/);
  assert.match(source, /restoredDraft\?\.step \?\?/);
  assert.ok(source.includes("...createInitialSignupFields(), ...restoredDraft?.fields"));
  const initialStartEffect = source.slice(
    source.indexOf('useEffect(() => {\n    if (initialStart !== "email") return;', source.indexOf("restoredDraftRef")),
    source.indexOf("const updateField", source.indexOf("restoredDraftRef")),
  );
  assert.match(initialStartEffect, /if \(!restoredDraftRef\.current\)[\s\S]*setStep/);
  assert.match(initialStartEffect, /restoredDraftRef\.current\?\.agreements\.service/);
  assert.doesNotMatch(initialStartEffect, /localStorage/);
});

const waitSource = source.slice(
  source.indexOf("function waitForIdentityOperation"),
  source.indexOf("type AtomicSignupServicePrice"),
);
const verifySource = variableStatementText("verifyPortoneIdentity").replace(
  'import("@portone/browser-sdk/v2")',
  "Promise.resolve(portoneSdk)",
).replace(
  "const reportFailure = (code: string, guidance: string) => {",
  "const reportFailure = (code: string, guidance: string) => { trace.failureBranches.push(code);",
);
assert.ok(verifySource.includes("trace.failureBranches.push(code)"), "safe-error branch instrumentation must bind to the actual handler");

const lifecycleEffects = [];
function collectLifecycle(node) {
  if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === "useEffect") {
    const text = node.getText(sourceFile);
    if (/useEffect\(\(\) => \(\) => \{ (signupFlowRef|providerAttemptRef)\.current\?\.abort\(\); \}, \[\]\)/.test(text)) lifecycleEffects.push(text);
  }
  ts.forEachChild(node, collectLifecycle);
}
collectLifecycle(sourceFile);
assert.equal(lifecycleEffects.length, 2, "both real flow/provider unmount cleanups must be exercised");

const harnessSource = `
${waitSource}
export function createFailureHarness({ requestMode = "success", verifyMode = "success", sdkOutcomes = ["success"] } = {}) {
  const env = { portoneStoreId: "store-test" };
  const portoneReady = true;
  let loading = false;
  const checkingEmail = false;
  const signupFlowRef = { current: null };
  const verificationPurpose = "signup";
  const fields = { name: "테스트 대표", birthDate: "19900321", phoneNumber: "01012345678" };
  const isValidBirthDate8 = (value) => /^\\d{8}$/.test(value);
  const identityRevisionRef = { current: 0 };
  const providerAttemptRef = { current: null };
  const verificationTokenRevisionRef = { current: null };
  const trace = { step: "profile", message: null, token: null, loadings: [], fetches: [], sdkCalls: [], failureBranches: [] };
  const setStep = (value) => { trace.step = value; };
  const setMessage = (value) => { trace.message = value; };
  const setVerificationToken = (value) => { trace.token = value; };
  const setLoading = (value) => { loading = value; trace.loadings.push(value); };
  const makeResponse = (ok, payload) => ({ ok, async json() { return payload; } });
  const fetch = async (url) => {
    trace.fetches.push(String(url));
    if (url === "/api/auth/request-verification-code") {
      if (requestMode === "failure") return makeResponse(false, { message: "채널 요청 실패" });
      return makeResponse(true, {
        verificationRequestId: "request-test",
        providerIdentityVerificationId: "provider-test",
        verificationState: "a".repeat(64),
      });
    }
    if (url === "/api/auth/verify-pass") {
      if (verifyMode === "failure") return makeResponse(false, { message: "인증 확인 실패" });
      return makeResponse(true, { verificationToken: "token-test" });
    }
    throw new Error("unexpected fetch " + url);
  };
  let delayedResolve;
  const delayed = new Promise((resolve) => { delayedResolve = resolve; });
  const outcomes = [...sdkOutcomes];
  const portoneSdk = {
    async requestIdentityVerification(input) {
      trace.sdkCalls.push(input);
      const outcome = outcomes.shift() ?? "success";
      if (outcome === "throw") throw new Error("sdk failure");
      if (outcome === "cancel") return {};
      if (outcome === "code") return { code: "CHANNEL_NOT_FOUND" };
      if (outcome === "delayed") return delayed;
      return { identityVerificationId: input.identityVerificationId };
    },
  };

  ${verifySource}
  ${variableStatementText("cancelProviderAttempt")}
  ${variableStatementText("returnToRepresentativeStep")}
  const cleanups = [];
  const useEffect = effect => cleanups.push(effect());
  ${lifecycleEffects.join(";\n")}

  const run = (channelKey = "phone-test") => verifyPortoneIdentity({
    channelKey,
    successMessage: "인증 성공",
    missingEnvMessage: "휴대폰 본인 인증 채널이 아직 연결되지 않았어요.",
  });
  return {
    fields,
    trace,
    run,
    runMissing: () => verifyPortoneIdentity({
      channelKey: undefined,
      successMessage: "인증 성공",
      missingEnvMessage: "휴대폰 본인 인증 채널이 아직 연결되지 않았어요.",
    }),
    cancel: cancelProviderAttempt,
    back: returnToRepresentativeStep,
    unmount: () => cleanups.forEach(cleanup => cleanup()),
    flow: signupFlowRef,
    resolveDelayed: (value) => delayedResolve(value),
  };
}
`;
const harnessJavaScript = ts.transpileModule(harnessSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createFailureHarness } = await import(
  `data:text/javascript;base64,${Buffer.from(harnessJavaScript).toString("base64")}`
);

test("missing channel, request API failure, SDK cancel, and verify API failure retain profile inputs", async () => {
  const cases = [
    { harness: createFailureHarness(), run: "runMissing", message: "휴대폰 본인 인증 채널이 아직 연결되지 않았어요.", fetches: [], sdk: 0, branch: [] },
    { harness: createFailureHarness({ requestMode: "failure" }), run: "run", message: "본인인증을 완료하지 못했어요. 다시 시도해 주세요.", fetches: ["/api/auth/request-verification-code"], sdk: 0, branch: ["REQUEST_REJECTED"] },
    { harness: createFailureHarness({ sdkOutcomes: ["cancel"] }), run: "run", message: "본인인증을 취소했어요.", fetches: ["/api/auth/request-verification-code"], sdk: 1, branch: ["SDK_CANCELLED"] },
    { harness: createFailureHarness({ verifyMode: "failure" }), run: "run", message: "본인인증을 완료하지 못했어요. 다시 시도해 주세요.", fetches: ["/api/auth/request-verification-code", "/api/auth/verify-pass"], sdk: 1, branch: ["VERIFY_REJECTED"] },
  ];
  for (const item of cases) {
    const before = { ...item.harness.fields };
    await item.harness[item.run]();
    assert.equal(item.harness.trace.step, "profile");
    assert.deepEqual(item.harness.fields, before);
    assert.deepEqual(item.harness.trace.fetches, item.fetches, "must reach intended error branch, not catch a missing helper");
    assert.equal(item.harness.trace.sdkCalls.length, item.sdk);
    assert.equal(item.harness.trace.message, item.message);
    assert.deepEqual(item.harness.trace.failureBranches, item.branch, "must execute intended safe-error branch, not an unexpected exception fallback");
    assert.equal(item.harness.trace.token, null);
    if (item.fetches.length) assert.deepEqual(item.harness.trace.loadings, [true, false]);
  }
});

test("a delayed provider result is cancelled without resetting and a failed attempt can retry", async () => {
  const delayed = createFailureHarness({ sdkOutcomes: ["delayed"] });
  const pending = delayed.run();
  for (let index = 0; index < 20 && delayed.trace.sdkCalls.length === 0; index += 1) await Promise.resolve();
  assert.equal(delayed.trace.sdkCalls.length, 1);
  delayed.cancel();
  delayed.resolveDelayed({ identityVerificationId: "provider-test" });
  await pending;
  assert.equal(delayed.trace.step, "profile");
  assert.equal(delayed.trace.token, null);
  assert.equal(delayed.fields.name, "테스트 대표");

  const retry = createFailureHarness({ sdkOutcomes: ["cancel", "success"] });
  await retry.run();
  assert.equal(retry.trace.token, null);
  await retry.run();
  assert.equal(retry.trace.step, "profile");
  assert.equal(retry.trace.token, "token-test");
  assert.equal(retry.trace.message, "인증 성공");
});

test("direct-flow back preserves fields while idle and cannot interrupt an active KCP attempt", async () => {
  const idle = createFailureHarness(), before = { ...idle.fields };
  idle.back(); assert.equal(idle.trace.step, "identity"); assert.deepEqual(idle.fields, before);
  const active = createFailureHarness({ sdkOutcomes: ["delayed"] });
  const run = active.run();
  for (let i = 0; i < 100 && active.trace.sdkCalls.length === 0; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(active.trace.sdkCalls.length, 1);
  active.back(); assert.equal(active.trace.step, "profile");
  active.cancel(); active.resolveDelayed({ identityVerificationId: "provider-test" }); await run;
  assert.equal(active.trace.token, null); assert.equal(active.trace.fetches.length, 1); assert.deepEqual(active.fields, before);
});

test("actual signup/provider unmount cleanups abort flow and discard late callback without clearing fields", async () => {
  const h = createFailureHarness({ sdkOutcomes: ["delayed"] }); const before = { ...h.fields };
  h.flow.current = new AbortController(); const run = h.run();
  for (let i = 0; i < 100 && h.trace.sdkCalls.length === 0; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.trace.sdkCalls.length, 1); h.unmount(); assert.equal(h.flow.current.signal.aborted, true);
  h.resolveDelayed({ identityVerificationId: "provider-test" }); await run;
  assert.equal(h.trace.token, null); assert.equal(h.trace.fetches.length, 1); assert.equal(h.trace.step, "profile"); assert.deepEqual(h.fields, before);
});

test("volatile draft is cleared only on an explicit restart or completed signup", () => {
  assert.match(source, /const openStart = \(\) => \{\s*resetSignup\(\);/);
  assert.match(source, /clearVolatileSignupDraft\(\);\s*clearSignupAgreementReceipt\(\);/);
  assert.match(source, /resetSignup\(\);\s*setStep\("entry"\);/);
});
