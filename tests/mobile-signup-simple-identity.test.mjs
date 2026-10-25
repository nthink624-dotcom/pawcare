import assert from "node:assert/strict";
import { errors as portoneErrors } from "@portone/browser-sdk/v2";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const signupForm = await readFile(
  new URL("../src/components/auth/signup-form.tsx", import.meta.url),
  "utf8",
);

const signupSourceFile = ts.createSourceFile(
  "signup-form.tsx",
  signupForm,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function sourceSlice(start, end) {
  const startIndex = signupForm.indexOf(start);
  const endIndex = signupForm.indexOf(end, startIndex);
  assert.ok(startIndex >= 0, `missing source marker: ${start}`);
  assert.ok(endIndex > startIndex, `missing source marker: ${end}`);
  return signupForm.slice(startIndex, endIndex);
}

function variableStatementText(name) {
  let result = null;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      result = node.parent.parent.getText(signupSourceFile);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(signupSourceFile);
  assert.ok(result, `missing variable declaration: ${name}`);
  return result;
}

test("representative identity and account are collected once before the shop screen", () => {
  assert.match(signupForm, /type Step = "entry" \| "price-guide" \| "identity" \| "profile"/);
  assert.match(signupForm, /data-signup-identity-fields/);
  assert.match(signupForm, /setStep\(priceGuideFixtureEnabled \? "price-guide" : "identity"\)/);
  assert.equal(signupForm.match(/updateField\("name"/g)?.length, 1);
  assert.equal(signupForm.match(/updateField\("birthDate"/g)?.length, 1);
  assert.equal(signupForm.match(/updateField\("phoneNumber"/g)?.length, 1);

  const identityScreen = sourceSlice('{step === "identity" ? (', '{step === "profile" ? (');
  for (const label of ["이름", "대표자 휴대폰", "생년월일", "이메일", "비밀번호", "비밀번호 확인"]) {
    assert.match(identityScreen, new RegExp(`label="${label}"`));
  }

  const profileScreen = sourceSlice('{step === "profile" ? (', '{message && !startTarget');
  for (const label of ["매장명", "매장 연락처", "매장 주소"]) {
    assert.match(profileScreen, new RegExp(`label="${label}"`));
  }
});

test("direct verification consumes central identity without additional personal inputs", () => {
  const provider = variableStatementText("verifyPortoneIdentity");
  for (const field of ["name", "birthDate", "phoneNumber"]) assert.ok(provider.includes(`fields.${field}`));
  assert.doesNotMatch(signupForm, /<VerificationModal|data-signup-sheet-body="verification-(method|detail)"/);
  for (const field of ["name", "birthDate", "phoneNumber"]) assert.equal(signupForm.split(`updateField("${field}"`).length - 1, 1);
});

test("only explicit KCP identity is offered without unified or carrier selection", () => {
  assert.doesNotMatch(signupForm, /KAKAO|NAVER|TOSS|inicisUnified|startUnifiedIdentity|phoneCarrier|통신사 선택/);
  assert.match(signupForm, /channelKey: process\.env\.NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY/);
  assert.match(variableStatementText("moveToVerificationStep"), /await startPhoneIdentity\(\)/);
});

test("identity edits synchronously invalidate request and token state and reject late results", () => {
  assert.match(signupForm, /identityRevisionRef\.current \+= 1/);
  assert.match(signupForm, /verificationTokenRevisionRef\.current = null/);
  assert.match(signupForm, /setVerificationRequestId\(null\)/);
  assert.match(signupForm, /setVerificationToken\(null\)/);
  assert.ok((signupForm.match(/identityRevisionRef\.current !== identityRevision/g) ?? []).length >= 3);
  assert.match(
    signupForm,
    /!isSignupTokenFresh\(token\) \|\| verificationTokenRevisionRef\.current !== identityRevisionRef\.current/,
  );
});

test("verified token and central values remain on the existing signup payload", () => {
  assert.match(signupForm, /identityVerificationToken: token/);
  assert.match(signupForm, /name: fields\.name\.trim\(\)/);
  assert.match(signupForm, /birthDate: fields\.birthDate/);
  assert.match(signupForm, /phoneNumber: fields\.phoneNumber/);
  assert.match(signupForm, /shopPhone: fields\.shopPhone/);
});

test("the existing mobile footer, spacing, max-width, and touch geometry stay intact", () => {
  assert.match(signupForm, /const ACTION_BUTTON_GRID = "grid grid-cols-2 gap-3"/);
  assert.match(signupForm, /data-signup-stage-footer=\{step\}/);
  assert.match(signupForm, /<SignupConsentDialog/);
  assert.match(signupForm, /max-w-\[430px\]/);
  assert.match(signupForm, /safe-area-inset-bottom/);
  assert.match(signupForm, /h-\[48px\] min-h-\[48px\]/);
  assert.match(signupForm, /!font-normal/);
  assert.doesNotMatch(signupForm, /overflow-x-scroll|whitespace-nowrap/);
});

const verifyPortoneIdentitySource = variableStatementText("verifyPortoneIdentity").replace(
  'import("@portone/browser-sdk/v2")',
  "(failureStageMock === \"SDK_IMPORT\" ? Promise.reject(new Error(\"private-import-detail\")) : Promise.resolve(portoneSdk))",
);
const startPhoneIdentitySource = variableStatementText("startPhoneIdentity");


const waitHelper = signupForm.slice(signupForm.indexOf("function waitForIdentityOperation"), signupForm.indexOf("type AtomicSignupServicePrice"));
const harnessSource = `
${waitHelper}
export function createIdentityHarness({ provider, requestFailure = false, verifyFailure = false, kcp = "kcp-test", failureStageMock = null }) {
  const process = { env: { NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY: kcp } };
  const env = {
    portoneStoreId: "store-test",
    portoneIdentityPhoneChannelKey: "phone-test",
    portoneIdentityDanalChannelKey: "phone-test",
    portoneIdentityUnifiedChannelKey: "unified-test",
  };
  const portoneReady = true;
  const verificationPurpose = "signup";
  const phoneCarrier = "SKT";
  const fields = { name: "김대표", birthDate: "19900321", phoneNumber: "01012345678" };
  const identityRevisionRef = { current: 0 };
  const providerAttemptRef = { current: null };
  const loading = false;
  const verificationTokenRevisionRef = { current: null };
  const trace = { fetches: [], identityInputs: [], loadings: [], messages: [], codes: [], token: null };
  const setLoading = (value) => trace.loadings.push(value);
  const setMessage = (value) => trace.messages.push(value);
  const setVerificationToken = (value) => { trace.token = value; };
  const isValidBirthDate8 = (value) => /^\\d{8}$/.test(value);
  const fetch = async (url, options = {}) => {
    if ((url === "/api/auth/request-verification-code" && failureStageMock === "REQUEST_FETCH") ||
      (url === "/api/auth/verify-pass" && failureStageMock === "VERIFY_FETCH")) throw new Error("private-fetch-detail");
    trace.fetches.push({ url: String(url), body: options.body ? JSON.parse(options.body) : null });
    if (url === "/api/auth/request-verification-code") {
      if (requestFailure) return { ok: false, async json() { return { message: "mock request failure" }; } };
      return { ok: true, async json() { if (failureStageMock === "REQUEST_JSON") throw new Error("private-json-detail"); return { verificationRequestId: "request-test", providerIdentityVerificationId: "server-provider-test", verificationState: "a".repeat(64) }; } };
    }
    if (url === "/api/auth/verify-pass") {
      if (verifyFailure) return { ok: false, async json() { return { message: "mock verify failure" }; } };
      return { ok: true, async json() { if (failureStageMock === "VERIFY_JSON") throw new Error("private-json-detail"); return { verificationToken: "token-test" }; } };
    }
    throw new Error("unexpected fetch " + url);
  };
  const portoneSdk = {
    async requestIdentityVerification(input) {
      trace.identityInputs.push(input);
      return provider(input);
    },
  };

  ${verifyPortoneIdentitySource.replace("const reportFailure = (code: string, guidance: string) => {", "const reportFailure = (code: string, guidance: string) => { trace.codes.push(code);")}
  ${startPhoneIdentitySource}


  return {
    fields,
    trace,
    runPhone: startPhoneIdentity,

    editIdentity(name) {
      fields.name = name;
      identityRevisionRef.current += 1;
      verificationTokenRevisionRef.current = null;
      setVerificationToken(null);
    },
  };
}
`;

const harnessJavaScript = ts.transpileModule(harnessSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createIdentityHarness } = await import(
  `data:text/javascript;base64,${Buffer.from(harnessJavaScript).toString("base64")}`
);

const flowCases = [{ name: "kcp", channelKey: "kcp-test", successMessage: "휴대폰 본인 인증이 완료되었어요." }];
async function runFlow(harness) { return harness.runPhone(); }

test("KCP flow handle mocked success, cancel, and failure", async () => {
  for (const flow of flowCases) {
    for (const outcome of ["success", "cancel", "failure"]) {
      const harness = createIdentityHarness({
        provider: async (input) => {
          if (outcome === "failure") throw new Error("mock provider failure");
          if (outcome === "cancel") return {};
          return { identityVerificationId: input.identityVerificationId };
        },
      });
      await runFlow(harness, flow);

      assert.equal(harness.trace.identityInputs.length, 1, `${flow.name} ${outcome}`);
      const identityInput = harness.trace.identityInputs[0];
      assert.equal(identityInput.channelKey, flow.channelKey);
      assert.deepEqual(identityInput.customer, {
        fullName: "김대표",
        phoneNumber: "01012345678",
        birthYear: "1990",
        birthMonth: "03",
        birthDay: "21",
      });
      assert.equal(identityInput.bypass, undefined);

      if (outcome === "success") {
        assert.equal(harness.trace.token, "token-test");
        assert.equal(harness.trace.codes.length, 0);
        assert.equal(harness.trace.messages.at(-1), flow.successMessage);
        assert.equal(harness.trace.fetches.filter(({ url }) => url === "/api/auth/verify-pass").length, 1);
      } else {
        assert.equal(harness.trace.token, null);
        assert.equal(harness.trace.fetches.filter(({ url }) => url === "/api/auth/verify-pass").length, 0);
        assert.match(
          harness.trace.messages.at(-1),
          outcome === "cancel" ? /본인인증을 취소했어요/ : /본인인증을 완료하지 못했어요/,
        );
      }
      assert.equal(harness.trace.loadings.at(-1), false);
    }
  }
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("overlapping late provider results cannot restore a token after representative data changes", async () => {
  const pending = [deferred(), deferred()];
  let callIndex = 0;
  const harness = createIdentityHarness({ provider: () => pending[callIndex++].promise });
  const first = harness.runPhone();
  const second = harness.runPhone();
  for (let index = 0; index < 20 && harness.trace.identityInputs.length < 1; index += 1) {
    await Promise.resolve();
  }
  assert.equal(harness.trace.identityInputs.length, 1);

  harness.editIdentity("변경된대표");
  pending[1].resolve({ identityVerificationId: "late-second" });
  pending[0].resolve({ identityVerificationId: "server-provider-test" });
  await Promise.all([first, second]);

  assert.equal(harness.trace.token, null);
  assert.equal(harness.trace.fetches.filter(({ url }) => url === "/api/auth/verify-pass").length, 0);
});

const copyRepresentativePhoneSource = variableStatementText("copyRepresentativePhoneToShop");
const copyHarnessSource = `
export function createCopyHarness(shopPhone) {
  let fields = { phoneNumber: "01012345678", shopPhone };
  const messages = [];
  const setMessage = (value) => messages.push(value);
  const updateField = (key, value) => { fields = { ...fields, [key]: value }; };
  ${copyRepresentativePhoneSource}
  return { run: copyRepresentativePhoneToShop, get fields() { return fields; }, messages };
}
`;
const copyHarnessJavaScript = ts.transpileModule(copyHarnessSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createCopyHarness } = await import(
  `data:text/javascript;base64,${Buffer.from(copyHarnessJavaScript).toString("base64")}`
);

test("shop contact copies explicitly but never overwrites an existing different number", () => {
  const empty = createCopyHarness("");
  empty.run();
  assert.equal(empty.fields.shopPhone, "01012345678");

  const different = createCopyHarness("0212345678");
  different.run();
  assert.equal(different.fields.shopPhone, "0212345678");
  assert.match(different.messages.at(-1), /이미 다른 매장 연락처/);
});



test("each provider rejects request, SDK code, mismatched callback and verify failures", async () => {
  for (const flow of flowCases) for (const failure of ["request", "code", "mismatch", "verify"]) {
    const harness = createIdentityHarness({
      requestFailure: failure === "request", verifyFailure: failure === "verify",
      provider: async input => failure === "code" ? { code: "MOCK_ERROR" } :
        { identityVerificationId: failure === "mismatch" ? "wrong" : input.identityVerificationId },
    });
    const before = { ...harness.fields };
    await runFlow(harness, flow);
    assert.equal(harness.trace.token, null, flow.name + failure);
    assert.deepEqual(harness.fields, before);
    assert.equal(harness.trace.identityInputs.length, failure === "request" ? 0 : 1);
    assert.equal(harness.trace.fetches.filter(f => f.url === "/api/auth/verify-pass").length, failure === "verify" ? 1 : 0);
  }
});

test("existing explicit KCP key selects phone SDK without Danal arguments and binds customData", async () => {
  const harness = createIdentityHarness({ kcp: "kcp-fixture", provider: async input => ({ identityVerificationId: input.identityVerificationId }) });
  await harness.runPhone();
  const input = harness.trace.identityInputs[0];
  assert.equal(input.channelKey, "kcp-fixture");
  assert.equal(input.bypass, undefined);
  assert.deepEqual(JSON.parse(input.customData), { petmanagerIdentityState: "a".repeat(64) });
  assert.equal(harness.trace.token, "token-test");
});


test("KCP distinguishes internal failure stages while exposing safe customer messages", async () => {
  for (const flow of flowCases) {
    for (const stage of ["REQUEST_FETCH", "REQUEST_JSON", "SDK_IMPORT", "SDK_CALL", "VERIFY_FETCH", "VERIFY_JSON", "CDN_LOAD", "POPUP_BLOCKED", "SDK_CALL_TIMEOUT"]) {
      const harness = createIdentityHarness({ failureStageMock: stage, provider: async input => {
        if (stage === "CDN_LOAD") throw new Error("[PortOne] Failed to load window.PortOne");
        if (stage === "POPUP_BLOCKED") throw { code: "POPUP_BLOCKED", message: "private-popup-detail" };
        if (stage === "SDK_CALL_TIMEOUT") throw new Error("IDENTITY_TIMEOUT");
        if (stage === "SDK_CALL") throw new Error("private-sdk-detail");
        return { identityVerificationId: input.identityVerificationId };
      } });
      const before = { ...harness.fields };
      await runFlow(harness, flow);
      assert.equal(harness.trace.token, null);
      assert.deepEqual(harness.fields, before);
      assert.equal(harness.trace.codes.at(-1), stage, flow.name + stage);
      assert.doesNotMatch(harness.trace.messages.at(-1), /PM-ID-/);
      assert.doesNotMatch(harness.trace.messages.at(-1), /private-|server-provider-test|store-test|a{64}|token-test/);
      assert.equal(harness.trace.loadings.at(-1), false);
    }
  }
});

test("installed SDK prepare errors retain inputs and keep diagnostic codes internal", async () => {
  const cases = [
    ["BadRequest", "SDK_BAD_REQUEST"], ["InvalidArgument", "SDK_INVALID_ARGUMENT"],
    ["RequestParseFailed", "SDK_REQUEST_PARSE"], ["ParseChannelFailed", "SDK_CHANNEL_PARSE"],
    ["ChannelNotFound", "SDK_CHANNEL_NOT_FOUND"], ["StoreNotFound", "SDK_STORE_NOT_FOUND"],
    ["PermissionDenied", "SDK_PERMISSION_DENIED"], ["Unauthenticated", "SDK_UNAUTHENTICATED"],
    ["FailedPrecondition", "SDK_PRECONDITION"], ["AllChannelsNotSatisfied", "SDK_CHANNEL_CONDITIONS"],
    ["PGProviderError", "SDK_PROVIDER_ERROR"], ["IdentityVerificationAlreadyVerified", "SDK_ALREADY_VERIFIED"],
    ["Unavailable", "SDK_UNAVAILABLE"], ["DeadlineExceeded", "SDK_DEADLINE"],
    ["ResourceExhausted", "SDK_RATE_LIMIT"], ["UnknownError", "SDK_CALL"],
    ["PRIVATE_UNKNOWN_CODE", "SDK_CALL"], ["__proto__", "SDK_CALL"], ["constructor", "SDK_CALL"],
  ];
  for (const [code, expected] of cases) {
    const error = new portoneErrors.IdentityVerificationError({
      code, message: "PRIVATE_MESSAGE", identityVerificationId: "PRIVATE_ID",
      identityVerificationTxId: "PRIVATE_TX", pgCode: "PRIVATE_PG", pgMessage: "PRIVATE_PG_MESSAGE",
    });
    const harness = createIdentityHarness({ provider: async () => { throw error; } });
    const before = { ...harness.fields };
    await harness.runPhone();
    assert.equal(harness.trace.token, null);
    assert.deepEqual(harness.fields, before);
    assert.equal(harness.trace.fetches.length, 1, "failure must not reach server verification");
    assert.equal(harness.trace.codes.at(-1), expected);
    assert.doesNotMatch(harness.trace.messages.at(-1), /PM-ID-/);
    assert.doesNotMatch(harness.trace.messages.at(-1), /PRIVATE_|server-provider-test|a{64}|token-test/);
    assert.equal(harness.trace.loadings.at(-1), false);
  }
});

test("KCP CDN-wrapped popup blocking gets fixed guidance without classifying other unknown failures", async () => {
  // Observed in the public KCP popup driver and CDN Xs catch; these are offline fixtures.
  const popupMessage = "본인인증 창 호출에 실패하였습니다. 팝업 차단으로 인해 정상적 실행에 실패했습니다.";
  for (const [code, message, expected] of [
    ["UnknownError", popupMessage, "POPUP_BLOCKED"],
    ["UnknownError", `${popupMessage} PRIVATE_DETAIL`, "SDK_CALL"],
    ["UnknownError", `PRIVATE_DETAIL ${popupMessage}`, "SDK_CALL"],
    ["UnknownError", "본인인증 창 호출에 실패하였습니다. Failed to fetch", "SDK_CALL"],
    ["UnknownError", "PRIVATE_DRIVER_LOAD_FAILURE", "SDK_CALL"],
    ["PRIVATE_CODE", popupMessage, "SDK_CALL"],
  ]) {
    const error = new portoneErrors.IdentityVerificationError({ code, message });
    const harness = createIdentityHarness({ provider: async () => { throw error; } });
    const before = { ...harness.fields };
    await harness.runPhone();
    assert.deepEqual(harness.fields, before);
    assert.equal(harness.trace.token, null);
    assert.equal(harness.trace.fetches.length, 1, "must not verify a failed SDK call");
    assert.equal(harness.trace.identityInputs.length, 1, "must not retry automatically");
    assert.equal(harness.trace.loadings.at(-1), false);
    assert.equal(harness.trace.codes.at(-1), expected);
    assert.equal(harness.trace.messages.at(-1), expected === "POPUP_BLOCKED" ? "팝업을 허용한 뒤 다시 시도해 주세요." : "본인인증을 완료하지 못했어요. 다시 시도해 주세요.");
    assert.doesNotMatch(harness.trace.messages.at(-1), /PRIVATE_|Failed to fetch|본인인증 창 호출에 실패하였습니다/);
  }
});

test("absent KCP key never falls back to phone or unified channels", async () => {
  const harness = createIdentityHarness({ kcp: "", provider: async () => { throw new Error("must not call"); } });
  await harness.runPhone();
  assert.equal(harness.trace.fetches.length, 0);
  assert.equal(harness.trace.identityInputs.length, 0);
  assert.equal(harness.trace.token, null);
  assert.match(harness.trace.messages.at(-1), /KCP/);
});
