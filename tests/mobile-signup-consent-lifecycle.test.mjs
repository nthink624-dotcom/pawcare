import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React, { act, createElement, useEffect, useState } from "react";
import ts from "typescript";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const signupForm = (await readFile(
  new URL("../src/components/auth/signup-form.tsx", import.meta.url),
  "utf8",
)).replace(/\r\n/g, "\n");

const signupSourceFile = ts.createSourceFile(
  "signup-form.tsx",
  signupForm,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function declarationText(name) {
  const declaration = signupSourceFile.statements.find(
    (statement) =>
      (ts.isFunctionDeclaration(statement) && statement.name?.text === name) ||
      (ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (item) => ts.isIdentifier(item.name) && item.name.text === name,
        )),
  );
  assert.ok(declaration, `missing declaration ${name}`);
  return declaration.getText(signupSourceFile);
}

const agreementHelperJavaScript = ts.transpileModule(
  [
    'const OWNER_SIGNUP_TERMS_VERSION = "2026-03-31";',
    "let window;",
    declarationText("SIGNUP_AGREEMENT_STORAGE_KEY"),
    declarationText("readSignupAgreementReceipt"),
    declarationText("writeSignupAgreementReceipt"),
    "export { readSignupAgreementReceipt, writeSignupAgreementReceipt };",
    "export function setWindow(value) { window = value; }",
  ].join("\n"),
  {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  },
).outputText;

const agreementHelpers = await import(
  `data:text/javascript;base64,${Buffer.from(agreementHelperJavaScript).toString("base64")}`
);

function createSessionStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const initialAgreements = {
  service: false,
  privacy: false,
  location: false,
  marketing: false,
};

function ConsentLifecycleHarness({
  initialStart = "email",
  mountId,
  priceGuideFixtureEnabled = false,
  trace,
}) {
  const [step, setStep] = useState(initialStart === "email" ? "profile" : "entry");
  const [startTarget, setStartTarget] = useState(null);
  const [agreements, setAgreements] = useState(initialAgreements);
  const requiredAgreed = agreements.service && agreements.privacy;

  useEffect(() => {
    trace.push({ mountId, reason: "mount", receiptPresent: Boolean(agreementHelpers.readSignupAgreementReceipt()) });
    return () => {
      trace.push({ mountId, reason: "unmount", receiptPresent: Boolean(agreementHelpers.readSignupAgreementReceipt()) });
    };
  }, [mountId, trace]);

  useEffect(() => {
    if (initialStart !== "email") return;
    setStep(priceGuideFixtureEnabled ? "price-guide" : "profile");
    if (priceGuideFixtureEnabled) {
      trace.push({ mountId, reason: "initial-fixture", receiptPresent: Boolean(agreementHelpers.readSignupAgreementReceipt()) });
      setStartTarget(null);
      return;
    }

    const storedAgreements = agreementHelpers.readSignupAgreementReceipt();
    trace.push({ mountId, reason: "initial-effect", receiptPresent: Boolean(storedAgreements) });
    if (storedAgreements) {
      setAgreements(storedAgreements);
      setStartTarget(null);
      return;
    }

    setStartTarget("email");
  }, [initialStart, mountId, priceGuideFixtureEnabled, trace]);

  const openStart = () => {
    const storedAgreements = agreementHelpers.readSignupAgreementReceipt();
    trace.push({ mountId, reason: "manual-open", receiptPresent: Boolean(storedAgreements) });
    if (storedAgreements) {
      setAgreements(storedAgreements);
      setStartTarget(null);
      setStep(priceGuideFixtureEnabled ? "price-guide" : "profile");
      return;
    }

    setStartTarget("email");
  };

  const continueStart = () => {
    if (!requiredAgreed || !startTarget) return;
    const agreementReceiptStored = agreementHelpers.writeSignupAgreementReceipt(agreements);
    trace.push({ mountId, reason: "continue", receiptPresent: agreementReceiptStored });
    if (!agreementReceiptStored) return;
    setStartTarget(null);
    setStep(priceGuideFixtureEnabled ? "price-guide" : "profile");
  };

  return createElement(
    "div",
    { "data-mount-id": mountId, "data-step": step },
    createElement(
      "button",
      { "data-action": "open", onClick: openStart, type: "button" },
      "open",
    ),
    startTarget
      ? createElement(
          "section",
          { "data-sheet": "consent" },
          createElement("input", {
            "data-term": "service",
            checked: agreements.service,
            onChange: (event) =>
              setAgreements((previous) => ({ ...previous, service: event.target.checked })),
            type: "checkbox",
          }),
          createElement("input", {
            "data-term": "privacy",
            checked: agreements.privacy,
            onChange: (event) =>
              setAgreements((previous) => ({ ...previous, privacy: event.target.checked })),
            type: "checkbox",
          }),
          createElement(
            "button",
            {
              "data-action": "continue",
              disabled: !requiredAgreed,
              onClick: continueStart,
              type: "button",
            },
            "continue",
          ),
        )
      : null,
  );
}

async function loadTestRenderer() {
  const moduleSpecifier = process.env.PM_REACT_TEST_RENDERER_MODULE || new URL("../node_modules/.cache/pm-signup-consent-fresh/node_modules/react-test-renderer/index.js", import.meta.url).href;
  try {
    return await import(moduleSpecifier);
  } catch (error) {
    throw new Error("Required React renderer unavailable; install or provide PM_REACT_TEST_RENDERER_MODULE", { cause: error });
  }
}

function findByProps(root, props) {
  return root.find((node) =>
    Object.entries(props).every(([key, value]) => node.props[key] === value),
  );
}

function hasConsentSheet(root) {
  return root.findAll((node) => node.props["data-sheet"] === "consent").length > 0;
}

function withoutImports(source) {
  const imports = ts.createSourceFile("fixture.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).statements
    .filter((statement) => ts.isImportDeclaration(statement))
    .sort((left, right) => right.getFullStart() - left.getFullStart());

  return imports.reduce(
    (result, statement) =>
      result.slice(0, statement.getFullStart()) + result.slice(statement.getEnd()),
    source,
  );
}

function instrumentConsentLifecycle(source) {
  let storedAgreementReadIndex = 0;
  let instrumented = source.replace(
    /const storedAgreements = readSignupAgreementReceipt\(\);/g,
    (match) => {
      storedAgreementReadIndex += 1;
      const reason = storedAgreementReadIndex === 1 ? "initial-effect-check" : "manual-open-check";
      return `${match}\n    __traceConsent(${JSON.stringify(reason)}, Boolean(storedAgreements), __consentMountId);`;
    },
  );

  instrumented = instrumented.replace(
    "  const router = useRouter();",
    `  const [__consentMountId] = useState(() => \`mount-\${++__consentMountSequence}\`);\n  useEffect(() => {\n    __traceConsent("mount", Boolean(readSignupAgreementReceipt()), __consentMountId);\n    return () => __traceConsent("unmount", Boolean(readSignupAgreementReceipt()), __consentMountId);\n  }, [__consentMountId]);\n  const router = useRouter();`,
  );
  instrumented = instrumented.replace(
    "    const agreementReceiptStored = writeSignupAgreementReceipt(agreements);",
    `    const agreementReceiptStored = writeSignupAgreementReceipt(agreements);\n    __traceConsent("continue-write", agreementReceiptStored, __consentMountId);`,
  );
  instrumented = instrumented.replace(
    "    setMessage(null);\n    setStartTarget(null);\n    setStep(priceGuideFixtureEnabled ? \"price-guide\" : \"identity\");",
    `    setMessage(null);\n    __traceConsent("continue-close", Boolean(readSignupAgreementReceipt()), __consentMountId);\n    setStartTarget(null);\n    setStep(priceGuideFixtureEnabled ? "price-guide" : "identity");`,
  );
  return instrumented;
}

let componentLoadSequence = 0;
async function loadInstrumentedSignupForm(source = signupForm) {
  globalThis.document ??= { body: { style: { overflow: "" } } };
  const reactModuleUrl = new URL("../node_modules/react/index.js", import.meta.url).href;
  const prelude = `
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from ${JSON.stringify(reactModuleUrl)};
const __router = { replace() {}, refresh() {} };
let __consentMountSequence = 0;
function __traceConsent(reason, receiptPresent, mountId) {
  globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__?.push({ mountId, reason, receiptPresent });
}
function useRouter() { return __router; }
function passthroughElement(tag) {
  return function Passthrough({ children, ...props }) {
    return React.createElement(tag, props, children);
  };
}
const Image = passthroughElement("img");
const Link = passthroughElement("a");
const Check = passthroughElement("span");
const ChevronLeft = passthroughElement("span");
const Eye = passthroughElement("span");
const EyeOff = passthroughElement("span");
const Smartphone = passthroughElement("span");
const MobileAiPriceGuideFixture = passthroughElement("div");
const KakaoPostcodeSheet = passthroughElement("div");
const MobileBackLinkButton = passthroughElement("button");
function MobileBackButton({ label, ...props }) {
  return React.createElement("button", { ...props, "aria-label": label });
}
const OWNER_SIGNUP_TERMS_VERSION = "2026-03-31";
const OWNER_MARKETING_CONSENT_DOCUMENT_VERSION = "fixture";
const ownerSignupTerms = [
  { id: "service", title: "service", required: true },
  { id: "privacy", title: "privacy", required: true },
  { id: "location", title: "location", required: false },
  { id: "marketing", title: "marketing", required: false },
];
function isValidBirthDate8() { return true; }
function isValidOwnerEmail() { return true; }
function isValidOwnerPassword() { return true; }
function normalizeOwnerEmail(value) { return value.trim().toLowerCase(); }
const ownerPasswordRuleMessage = "password rule";
function clearOwnerAuthTokenCache() {}
function writeOwnerAuthHandoff() {}
function writeOwnerAuthSessionCache() {}
function getSafeNextPath(value, fallback) { return value || fallback; }
const env = {
  portoneStoreId: globalThis.__kcpComponentFixture ? "fixture-store" : null,
  portoneIdentityChannelKey: null,
  portoneIdentityPhoneChannelKey: null,
  portoneIdentityDanalChannelKey: null,
  portoneIdentityUnifiedChannelKey: null,
};
function getSupabaseRuntimeStage() { return "development"; }
const PUBLIC_LEGAL_URLS = { terms: "/terms", privacy: "/privacy" };
const UI_BUTTON_PRIMARY = "";
const UI_BUTTON_SECONDARY = "";
const INLINE_ERROR = "";
const INLINE_HELP = "";
const INPUT_BASE = "";
const UI_PAGE_TITLE = "";
function cn(...values) { return values.filter(Boolean).join(" "); }
const anonymousClient = { auth: {
  async getSession() { return { data: { session: null }, error: null }; },
  onAuthStateChange() {},
} };
function getSupabaseBrowserClient() { if (globalThis.__signupAuthClient === "throw") throw new Error("fixture client failure"); return globalThis.__signupAuthClient === undefined ? anonymousClient : globalThis.__signupAuthClient; }
`;
  const consentSource = withoutImports(await readFile(new URL("../src/components/auth/signup-consent-dialog.tsx", import.meta.url), "utf8")).replace("export default function", "function");
  const componentSource = consentSource + "\n" + instrumentConsentLifecycle(withoutImports(source));
  const timerPrelude = `const setTimeout = (...args) => { const timer = globalThis.setTimeout(...args); timer.unref?.(); return timer; };`;
  const compiled = ts.transpileModule(`${prelude}\n${timerPrelude}\n${componentSource}`, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${++componentLoadSequence}`);
}

function nodeText(node) {
  if (typeof node === "string") return node;
  if (!node?.children) return "";
  return node.children.map(nodeText).join("");
}

function findButton(root, label) {
  return root.find(
    (node) => node.type === "button" && nodeText(node).trim() === label,
  );
}

function hasProductionConsentSheet(root) {
  return root.findAll(
    (node) =>
      node.type === "h2" &&
      nodeText(node) === "약관 동의",
  ).length > 0;
}

async function acceptRequiredTerms(renderer) {
  const checkboxes = renderer.root.findAll(
    (node) => node.type === "input" && node.props.type === "checkbox",
  );
  const requiredCheckboxes = checkboxes.length === 5 ? checkboxes.slice(1, 3) : checkboxes.slice(0, 2);
  assert.equal(requiredCheckboxes.length, 2);
  for (const checkbox of requiredCheckboxes) {
    await act(async () => {
      checkbox.props.onChange({ target: { checked: true } });
    });
  }

  const continueButton = findButton(renderer.root, "계속하기");
  assert.equal(continueButton.props.disabled, false);
  await act(async () => {
    continueButton.props.onClick();
  });
}

test("React mount, effects, and explicit continuation do not reopen accepted current-version consent", async (context) => {
  const rendererModule = await loadTestRenderer();
  assert.ok("create" in rendererModule, "React renderer is required; never skip lifecycle coverage");
  const { create } = rendererModule;
  const sessionStorage = createSessionStorage();
  agreementHelpers.setWindow({ sessionStorage });
  const trace = [];
  let renderer;

  await act(async () => {
    renderer = create(
      createElement(ConsentLifecycleHarness, { mountId: "mount-1", trace }),
    );
  });
  assert.equal(hasConsentSheet(renderer.root), true);
  assert.deepEqual(trace.at(-1), {
    mountId: "mount-1",
    reason: "initial-effect",
    receiptPresent: false,
  });

  await act(async () => {
    findByProps(renderer.root, { "data-term": "service" }).props.onChange({
      target: { checked: true },
    });
  });
  await act(async () => {
    findByProps(renderer.root, { "data-term": "privacy" }).props.onChange({
      target: { checked: true },
    });
  });
  assert.equal(findByProps(renderer.root, { "data-action": "continue" }).props.disabled, false);

  await act(async () => {
    findByProps(renderer.root, { "data-action": "continue" }).props.onClick();
  });
  assert.equal(hasConsentSheet(renderer.root), false);
  assert.deepEqual(trace.at(-1), {
    mountId: "mount-1",
    reason: "continue",
    receiptPresent: true,
  });

  await act(async () => {
    renderer.update(
      createElement(ConsentLifecycleHarness, { mountId: "mount-1", trace }),
    );
  });
  assert.equal(hasConsentSheet(renderer.root), false);

  await act(async () => {
    findByProps(renderer.root, { "data-action": "open" }).props.onClick();
  });
  assert.equal(hasConsentSheet(renderer.root), false);
  assert.deepEqual(trace.at(-1), {
    mountId: "mount-1",
    reason: "manual-open",
    receiptPresent: true,
  });

  await act(async () => {
    renderer.update(
      createElement(ConsentLifecycleHarness, {
        mountId: "mount-1",
        priceGuideFixtureEnabled: true,
        trace,
      }),
    );
  });
  await act(async () => {
    renderer.update(
      createElement(ConsentLifecycleHarness, {
        mountId: "mount-1",
        priceGuideFixtureEnabled: false,
        trace,
      }),
    );
  });
  assert.equal(hasConsentSheet(renderer.root), false);
  assert.deepEqual(trace.at(-1), {
    mountId: "mount-1",
    reason: "initial-effect",
    receiptPresent: true,
  });

  await act(async () => {
    renderer.unmount();
  });
  await act(async () => {
    renderer = create(
      createElement(ConsentLifecycleHarness, { mountId: "mount-2", trace }),
    );
  });
  assert.equal(hasConsentSheet(renderer.root), false);
  assert.deepEqual(trace.at(-1), {
    mountId: "mount-2",
    reason: "initial-effect",
    receiptPresent: true,
  });

  assert.deepEqual(agreementHelpers.readSignupAgreementReceipt(), {
    service: true,
    privacy: true,
    location: false,
    marketing: false,
  });
  assert.equal(
    trace.some(
      (event) =>
        event.reason === "initial-effect" &&
        event.receiptPresent &&
        event.mountId === "mount-2",
    ),
    true,
  );

  await act(async () => {
    renderer.unmount();
  });
});

test("initial and manual entry check the receipt before opening consent", () => {
  const initialEffect = signupForm.slice(
    signupForm.indexOf("// The development-only price guide fixture starts before the consent/profile flow."),
    signupForm.indexOf("const updateField"),
  );
  const openStart = signupForm.slice(
    signupForm.indexOf("const openStart"),
    signupForm.indexOf("const continueStart"),
  );

  assert.equal(signupForm.match(/setStartTarget\("email"\)/g)?.length, 2);
  assert.match(initialEffect, /readSignupAgreementReceipt\(\)[\s\S]*setStartTarget\("email"\)/);
  assert.match(openStart, /readSignupAgreementReceipt\(\)[\s\S]*setStartTarget\("email"\)/);
  assert.match(signupForm, /onContinue=\{continueStart\}/);
});

test("required-only consent survives real identity/profile inputs, both back buttons, errors and duplicate Continue", async (context) => {
  const rendererModule = await loadTestRenderer();
  assert.ok("create" in rendererModule, "React renderer is required; never skip lifecycle coverage");
  const { default: SignupForm } = await loadInstrumentedSignupForm();
  const sessionStorage = createSessionStorage();
  globalThis.window = { sessionStorage };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => { assert.ok(String(url).startsWith("/api/auth/check-email?")); return { ok: true, json: async () => ({ available: true }) }; };
  let renderer;
  context.after(async () => {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.fetch = originalFetch;
    delete globalThis.window;
  });
  const props = { initialStart: "email", supabaseReady: true, portoneReady: false };
  await act(async () => { renderer = rendererModule.create(createElement(SignupForm, props)); });
  const closed = () => assert.equal(hasProductionConsentSheet(renderer.root), false);
  const click = async (label) => {
    await act(async () => { await findButton(renderer.root, label).props.onClick(); });
    closed();
  };
  const input = async (placeholder, value) => {
    const node = renderer.root.find((item) => item.type === "input" && item.props.placeholder === placeholder);
    await act(async () => node.props.onChange({ target: { value } }));
    closed();
  };
  const stage = (name) => assert.equal(renderer.root.findAll(
    (node) => node.type === "footer" && node.props["data-signup-stage-footer"] === name,
  ).length, 1);

  assert.equal(hasProductionConsentSheet(renderer.root), true);
  assert.equal(findButton(renderer.root, "계속하기").props.disabled, true);
  const boxes = renderer.root.findAll((node) => node.type === "input" && node.props.type === "checkbox");
  await act(async () => boxes[1].props.onChange({ target: { checked: true } }));
  assert.equal(findButton(renderer.root, "계속하기").props.disabled, true);
  await act(async () => boxes[2].props.onChange({ target: { checked: true } }));
  assert.equal(boxes[3].props.checked, false);
  assert.equal(boxes[4].props.checked, false);
  const continueClick = findButton(renderer.root, "계속하기").props.onClick;
  await act(async () => { await continueClick(); await continueClick(); });
  closed();
  stage("identity");
  await click("다음"); // Missing representative data: recover without asking for terms again.
  stage("identity");
  assert.ok(nodeText(renderer.root).includes("대표자 이름을 입력해 주세요."));
  await input("대표자 이름", "테스트");
  await input("010-0000-0000", "01000000000");
  await input("예: 1999-03-21", "19990321");
  await input("example@petmanager.co.kr", "fixture@example.invalid");
  await input("비밀번호 입력", "Fixture!234");
  await input("비밀번호 다시 입력", "Fixture!234");
  await click("다음");
  stage("profile");
  const profileInput = renderer.root.findAll((node) => node.type === "input")[0];
  await act(async () => profileInput.props.onChange({ target: { value: "fixture@example.invalid" } }));
  closed();
  await click("이전");
  stage("identity");

  for (const back of ["footer", "header"]) {
    {
      const button = renderer.root.find((node) => node.type === "button" &&
        node.props["aria-label"] === "회원가입 시작으로 돌아가기");
      await act(async () => button.props.onClick());
      closed();
    }
    assert.ok(findButton(renderer.root, "일반 회원가입 시작하기"));
    await click("일반 회원가입 시작하기");
    stage("identity");
    assert.equal(renderer.root.find((node) => node.type === "input" && node.props.placeholder === "대표자 이름").props.value, "");
    await input("대표자 이름", "테스트");
    await input("010-0000-0000", "01000000000");
    await input("예: 1999-03-21", "19990321");
  await input("example@petmanager.co.kr", "fixture@example.invalid");
  await input("비밀번호 입력", "Fixture!234");
  await input("비밀번호 다시 입력", "Fixture!234");
    await click("다음");
    stage("profile");
    assert.equal(renderer.root.findAll((node) => node.type === "input")[0].props.value, "");
    const headerBack = back === "footer" ? findButton(renderer.root, "이전") : renderer.root.find((node) => node.type === "button" && node.props["aria-label"] === "대표자 정보로 돌아가기");
    await act(async () => headerBack.props.onClick());
    closed();
    stage("identity");
  }
  await act(async () => renderer.update(createElement(SignupForm, props)));
  closed();
  await act(async () => renderer.unmount());
  renderer = null;
  await act(async () => { renderer = rendererModule.create(createElement(SignupForm, props)); });
  closed();
  agreementHelpers.setWindow({ sessionStorage });
  assert.deepEqual(agreementHelpers.readSignupAgreementReceipt(), {
    service: true, privacy: true, location: false, marketing: false,
  });

  await act(async () => renderer.unmount());
  renderer = null;
  sessionStorage.setItem("petmanager:signup-agreements:2026-03-31", JSON.stringify({
    version: "obsolete", agreements: { service: true, privacy: true, location: false, marketing: false },
  }));
  const { default: FreshSignupForm } = await loadInstrumentedSignupForm();
  await act(async () => { renderer = rendererModule.create(createElement(FreshSignupForm, props)); });
  assert.equal(hasProductionConsentSheet(renderer.root), true);
  assert.equal(findButton(renderer.root, "계속하기").props.disabled, true);
});

test("negative control: reopening mutations in both back callbacks are detected", async (context) => {
  const rendererModule = await loadTestRenderer();
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async url => { assert.ok(String(url).startsWith("/api/auth/check-email?")); return { ok: true, json: async () => ({ available: true }) }; };
  context.after(() => { globalThis.fetch = oldFetch; delete globalThis.window; });
  for (const back of ["header", "footer"]) {
    const normalized = signupForm.replace(/\r\n/g, "\n");
    const marker = back === "header" ? '                  setStep("entry");' : '    setStep("identity");\n  };\n\n  const copyRepresentativePhoneToShop';
    const mutated = normalized.replace(marker, marker.replace(/setStep\("(?:entry|identity)"\)/, 'setStartTarget("email")'));
    assert.notEqual(mutated, normalized);
    const { default: SignupForm } = await loadInstrumentedSignupForm(mutated);
    globalThis.window = { sessionStorage: createSessionStorage() };
    let renderer;
    try {
      await act(async () => { renderer = rendererModule.create(createElement(SignupForm, { initialStart: "email", supabaseReady: true, portoneReady: false })); });
      await acceptRequiredTerms(renderer);
      if (back === "footer") {
        for (const [placeholder, value] of [["대표자 이름", "가상대표"], ["010-0000-0000", "01000000000"], ["예: 1999-03-21", "19990321"], ["example@petmanager.co.kr", "fixture@example.invalid"], ["비밀번호 입력", "Fixture!234"], ["비밀번호 다시 입력", "Fixture!234"]]) {
          await act(async () => renderer.root.find(n => n.type === "input" && n.props.placeholder === placeholder).props.onChange({ target: { value } }));
        }
        await act(async () => findButton(renderer.root, "다음").props.onClick());
      }
      assert.equal(hasProductionConsentSheet(renderer.root), false);
      const button = back === "footer" ? findButton(renderer.root, "이전") : renderer.root.find(n => n.type === "button" && n.props["aria-label"] === "회원가입 시작으로 돌아가기");
      await act(async () => button.props.onClick());
      assert.equal(hasProductionConsentSheet(renderer.root), true, back);
    } finally { if (renderer) await act(async () => renderer.unmount()); }
  }
});

test("the full SignupForm closes after Continue and stays closed through rerender, remount, and manual entry", async (context) => {
  const rendererModule = await loadTestRenderer();
  assert.ok("create" in rendererModule, "React renderer is required; never skip lifecycle coverage");
  const { create } = rendererModule;
  const { default: SignupForm } = await loadInstrumentedSignupForm();
  const sessionStorage = createSessionStorage();
  globalThis.window = { sessionStorage };
  globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__ = [];
  const props = {
    initialStart: "email",
    nextPath: "/owner",
    portoneReady: false,
    priceGuideFixtureEnabled: false,
    supabaseReady: true,
  };
  let renderer;

  await act(async () => {
    renderer = create(createElement(SignupForm, props));
  });
  assert.equal(hasProductionConsentSheet(renderer.root), true);
  assert.deepEqual(globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__.at(-1), {
    mountId: "mount-1",
    reason: "initial-effect-check",
    receiptPresent: false,
  });

  await acceptRequiredTerms(renderer);
  assert.equal(hasProductionConsentSheet(renderer.root), false);
  assert.deepEqual(
    globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__.slice(-2),
    [
      { mountId: "mount-1", reason: "continue-write", receiptPresent: true },
      { mountId: "mount-1", reason: "continue-close", receiptPresent: true },
    ],
  );

  await act(async () => {
    renderer.update(createElement(SignupForm, props));
  });
  assert.equal(hasProductionConsentSheet(renderer.root), false);

  await act(async () => {
    renderer.update(
      createElement(SignupForm, { ...props, priceGuideFixtureEnabled: true }),
    );
  });
  await act(async () => {
    renderer.update(createElement(SignupForm, props));
  });
  assert.equal(hasProductionConsentSheet(renderer.root), false);
  assert.deepEqual(globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__.at(-1), {
    mountId: "mount-1",
    reason: "initial-effect-check",
    receiptPresent: true,
  });

  await act(async () => {
    renderer.unmount();
  });
  await act(async () => {
    renderer = create(createElement(SignupForm, props));
  });
  assert.equal(hasProductionConsentSheet(renderer.root), false);
  assert.deepEqual(globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__.at(-1), {
    mountId: "mount-2",
    reason: "initial-effect-check",
    receiptPresent: true,
  });

  await act(async () => {
    renderer.unmount();
  });
  await act(async () => {
    renderer = create(
      createElement(SignupForm, { ...props, initialStart: null }),
    );
  });
  assert.equal(hasProductionConsentSheet(renderer.root), false);
  await act(async () => {
    findButton(renderer.root, "일반 회원가입 시작하기").props.onClick();
  });
  assert.equal(hasProductionConsentSheet(renderer.root), false);
  assert.deepEqual(globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__.at(-1), {
    mountId: "mount-3",
    reason: "manual-open-check",
    receiptPresent: true,
  });

  agreementHelpers.setWindow({ sessionStorage });
  assert.deepEqual(agreementHelpers.readSignupAgreementReceipt(), {
    service: true,
    privacy: true,
    location: false,
    marketing: false,
  });

  await act(async () => {
    renderer.unmount();
  });
  delete globalThis.window;
  delete globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__;
});

test("duplicate component roots are distinguishable from StrictMode and a separate browsing context", async (context) => {
  const rendererModule = await loadTestRenderer();
  assert.ok("create" in rendererModule, "React renderer is required; never skip lifecycle coverage");
  const { create } = rendererModule;
  const { default: SignupForm } = await loadInstrumentedSignupForm();
  const props = {
    initialStart: "email",
    nextPath: "/owner",
    portoneReady: false,
    priceGuideFixtureEnabled: false,
    supabaseReady: true,
  };

  const sharedStorage = createSessionStorage();
  globalThis.window = { sessionStorage: sharedStorage };
  globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__ = [];
  let firstRoot;
  let secondRoot;
  await act(async () => {
    firstRoot = create(createElement(SignupForm, props));
    secondRoot = create(createElement(SignupForm, props));
  });
  assert.equal(hasProductionConsentSheet(firstRoot.root), true);
  assert.equal(hasProductionConsentSheet(secondRoot.root), true);
  const committedMountIds = new Set(
    globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__
      .filter((event) => event.reason === "mount")
      .map((event) => event.mountId),
  );
  assert.equal(committedMountIds.size, 2);

  await acceptRequiredTerms(firstRoot);
  assert.equal(hasProductionConsentSheet(firstRoot.root), false);
  assert.equal(hasProductionConsentSheet(secondRoot.root), true);
  agreementHelpers.setWindow({ sessionStorage: sharedStorage });
  assert.equal(Boolean(agreementHelpers.readSignupAgreementReceipt()), true);

  await act(async () => {
    firstRoot.unmount();
    secondRoot.unmount();
  });

  const strictModeStorage = createSessionStorage();
  globalThis.window = { sessionStorage: strictModeStorage };
  globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__ = [];
  const { default: StrictSignupForm } = await loadInstrumentedSignupForm();
  let strictRoot;
  await act(async () => {
    strictRoot = create(
      createElement(React.StrictMode, null, createElement(StrictSignupForm, props)),
    );
  });
  assert.equal(hasProductionConsentSheet(strictRoot.root), true);
  await acceptRequiredTerms(strictRoot);
  assert.equal(hasProductionConsentSheet(strictRoot.root), false);
  const strictMountIds = new Set(
    globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__
      .filter((event) => event.reason === "mount")
      .map((event) => event.mountId),
  );
  assert.equal(strictMountIds.size, 1);

  await act(async () => {
    strictRoot.unmount();
  });

  const separateContextStorage = createSessionStorage();
  globalThis.window = { sessionStorage: separateContextStorage };
  globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__ = [];
  const { default: SeparateSignupForm } = await loadInstrumentedSignupForm();
  let separateRoot;
  await act(async () => {
    separateRoot = create(createElement(SeparateSignupForm, props));
  });
  assert.equal(hasProductionConsentSheet(separateRoot.root), true);
  assert.equal(
    globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__.some(
      (event) => event.reason === "initial-effect-check" && !event.receiptPresent,
    ),
    true,
  );

  await act(async () => {
    separateRoot.unmount();
  });
  delete globalThis.window;
  delete globalThis.__PM_SIGNUP_CONSENT_TEST_TRACE__;
});


test("actual form drops passwords on remount, clears restart and observes auth while unmounted", async (context) => {
  const rendererModule = await loadTestRenderer();
  assert.ok("create" in rendererModule, "actual mount renderer is required");
  let authCallback;
  globalThis.__signupAuthClient = { auth: { async getSession() { return { data: { session: null }, error: null }; }, onAuthStateChange(callback) { authCallback = callback; } } };
  globalThis.window = { sessionStorage: createSessionStorage() };
  const { default: SignupForm } = await loadInstrumentedSignupForm();
  const props = { initialStart: "email", supabaseReady: true, portoneReady: false };
  let renderer;
  context.after(async () => {
    if (renderer) await act(async () => renderer.unmount());
    delete globalThis.__signupAuthClient;
    delete globalThis.window;
  });
  const mount = async () => { await act(async () => { renderer = rendererModule.create(createElement(SignupForm, props)); }); };
  const input = async (placeholder, value) => {
    const node = renderer.root.find(n => n.type === "input" && n.props.placeholder === placeholder);
    await act(async () => node.props.onChange({ target: { value } }));
  };
  const click = async label => { await act(async () => findButton(renderer.root, label).props.onClick()); };
  const identity = async () => {
    await input("대표자 이름", "가상대표");
    await input("010-0000-0000", "01000000000");
    await input("예: 1999-03-21", "19990321");

  };
  await mount();
  await acceptRequiredTerms(renderer);
  await identity();
  for (const node of renderer.root.findAll(n => n.type === "input" && n.props.type === "password")) {
    await act(async () => node.props.onChange({ target: { value: "Fixture-only!234" } }));
  }
  await act(async () => renderer.unmount()); renderer = null;
  await mount();
  assert.equal(renderer.root.findAll(n => n.type === "input" && n.props.type === "password").length, 2);
  for (const node of renderer.root.findAll(n => n.type === "input" && n.props.type === "password")) assert.equal(node.props.value, "");
  for (const node of renderer.root.findAll(n => n.type === "input" && n.props.type === "password")) {
    await act(async () => node.props.onChange({ target: { value: "Restart-only!234" } }));
  }
  assert.equal(renderer.root.find(n => n.type === "input" && n.props.placeholder === "대표자 이름").props.value, "가상대표");
  await act(async () => renderer.root.find(n => n.type === "button" && n.props["aria-label"] === "회원가입 시작으로 돌아가기").props.onClick());
  await click("일반 회원가입 시작하기");
  assert.equal(renderer.root.find(n => n.type === "input" && n.props.placeholder === "대표자 이름").props.value, "");
  await identity();
  for (const node of renderer.root.findAll(n => n.type === "input" && n.props.type === "password")) assert.equal(node.props.value, "");
  await act(async () => authCallback("SIGNED_IN", { user: { id: "fixture-other" } }));
  assert.ok(findButton(renderer.root, "일반 회원가입 시작하기"));
  await click("일반 회원가입 시작하기");
  assert.equal(hasProductionConsentSheet(renderer.root), true);
  await acceptRequiredTerms(renderer); await identity();
  await act(async () => renderer.unmount()); renderer = null;
  authCallback("SIGNED_OUT", null);
  await mount();
  assert.equal(hasProductionConsentSheet(renderer.root), true);
  assert.equal(renderer.root.find(n => n.type === "input" && n.props.placeholder === "대표자 이름").props.value, "");
});

test("actual mounted form expires without extending lifetime on edits", async (context) => {
  const rendererModule = await loadTestRenderer();
  assert.ok("create" in rendererModule);
  globalThis.window = { sessionStorage: createSessionStorage() };
  const { default: SignupForm } = await loadInstrumentedSignupForm(signupForm.replace(
    "const VOLATILE_SIGNUP_DRAFT_TTL_MS = 20 * 60 * 1000;", "const VOLATILE_SIGNUP_DRAFT_TTL_MS = 200;"));
  let renderer;
  context.after(async () => { if (renderer) await act(async () => renderer.unmount()); delete globalThis.window; });
  await act(async () => { renderer = rendererModule.create(createElement(SignupForm, { initialStart: "email", supabaseReady: true, portoneReady: false })); });
  await acceptRequiredTerms(renderer);
  await act(async () => {
    renderer.root.find(n => n.type === "input" && n.props.placeholder === "대표자 이름").props.onChange({ target: { value: "가상대표" } });
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 240)); });
  assert.ok(findButton(renderer.root, "일반 회원가입 시작하기"));
  await act(async () => findButton(renderer.root, "일반 회원가입 시작하기").props.onClick());
  assert.equal(renderer.root.find(n => n.type === "input" && n.props.placeholder === "대표자 이름").props.value, "");
});


test("session errors never expose retained inputs; retry requires confirmed anonymous state", async (context) => {
  const rendererModule = await loadTestRenderer();
  assert.ok("create" in rendererModule, "actual renderer is required");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("Network forbidden"); };
  let renderer;
  context.after(async () => {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.fetch = originalFetch;
    delete globalThis.__signupAuthClient;
    delete globalThis.window;
  });
  for (const outcome of ["error-null", "reject", "malformed", "missing-client", "throw-client", "unready-client", "anonymous", "authenticated", "unmount"]) {
    delete globalThis.__signupAuthClient;
    globalThis.window = { sessionStorage: createSessionStorage() };
    const { default: SignupForm } = await loadInstrumentedSignupForm();
    const props = { initialStart: "email", supabaseReady: true, portoneReady: false };
    await act(async () => { renderer = rendererModule.create(createElement(SignupForm, props)); });
    await acceptRequiredTerms(renderer);
    await act(async () => renderer.root.find(n => n.type === "input" && n.props.placeholder === "대표자 이름").props.onChange({ target: { value: "이전가상대표" } }));
    await act(async () => renderer.unmount()); renderer = null;
    let resolveSession;
    let rejectSession;
    let signOutCount = 0;
    const pending = new Promise((resolve, reject) => { resolveSession = resolve; rejectSession = reject; });
    globalThis.__signupAuthClient = outcome === "missing-client" ? null : outcome === "throw-client" ? "throw" : { auth: {
      getSession: () => pending,
      onAuthStateChange() {},
      async signOut() { signOutCount += 1; return { error: null }; },
    } };
    await act(async () => { renderer = rendererModule.create(createElement(SignupForm, { ...props, supabaseReady: outcome !== "unready-client" })); });
    if (!["missing-client", "throw-client", "unready-client"].includes(outcome)) assert.equal(renderer.toJSON(), null);
    if (outcome === "unmount") {
      await act(async () => renderer.unmount()); renderer = null;
      await act(async () => resolveSession({ data: { session: { access_token: "fixture" } }, error: null }));
      assert.equal(signOutCount, 0);
      continue;
    }
    await act(async () => {
      if (outcome === "reject") rejectSession(new Error("fixture failure"));
      else resolveSession(outcome === "malformed" ? { data: {} } : {
        data: { session: outcome === "authenticated" ? { access_token: "fixture" } : null },
        error: outcome === "error-null" ? { message: "fixture failure" } : null,
      });
    });
    if (outcome === "anonymous") {
      assert.equal(renderer.root.find(n => n.type === "input" && n.props.placeholder === "대표자 이름").props.value, "이전가상대표");
    } else if (outcome === "authenticated") {
      assert.equal(signOutCount, 1);
      assert.equal(renderer.root.findAll(n => n.type === "input").length, 0);
      assert.ok(findButton(renderer.root, "일반 회원가입 시작하기"));
    } else {
      assert.equal(renderer.root.findAll(n => n.type === "input").length, 0);
      assert.ok(nodeText(renderer.root).includes("로그인 상태를 확인하지 못했어요"));
      let resolveRetry;
      globalThis.__signupAuthClient = { auth: {
        onAuthStateChange() {},
        getSession: () => new Promise(resolve => { resolveRetry = resolve; }),
      } };
      if (outcome === "unready-client") await act(async () => renderer.update(createElement(SignupForm, props)));
      else await act(async () => findButton(renderer.root, "다시 시도하기").props.onClick());
      assert.equal(renderer.toJSON(), null);
      await act(async () => resolveRetry({ data: { session: null }, error: null }));
      assert.equal(renderer.root.find(n => n.type === "input" && n.props.placeholder === "대표자 이름").props.value, "이전가상대표");
    }
    await act(async () => renderer.unmount()); renderer = null;
  }
});


test("mounted signup offers only KCP and preserves inputs through cancel, failure, close and retry", async (context) => {
  const rendererModule = await loadTestRenderer();
  assert.ok("create" in rendererModule);
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const originalKey = process.env.NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY;
  const calls = [];
  const requests = [];
  const token = Buffer.from(JSON.stringify({ purpose: "signup", expiresAt: Date.now() + 600000 })).toString("base64url") + ".fixture-signature";
  let outcome = "cancel";
  globalThis.window = { sessionStorage: createSessionStorage() };
  globalThis.document = { activeElement: null, body: { style: { overflow: "" } } };
  globalThis.__kcpComponentFixture = true;
  process.env.NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY = "fixture-kcp";
  globalThis.__kcpSdk = { async requestIdentityVerification(input) {
    calls.push(input);
    if (outcome === "failure") throw new Error("private-fixture-error");
    if (outcome === "cancel") return undefined;
    return { identityVerificationId: input.identityVerificationId };
  } };
  globalThis.fetch = async (url, options) => { requests.push({ url: String(url), body: options?.body && JSON.parse(options.body) }); return { ok: !String(url).endsWith("/signup"), status: String(url).endsWith("/signup") ? 503 : 200, async json() {
    if (String(url).includes("check-email")) return { available: true };
    if (String(url).includes("request-verification-code")) return { verificationRequestId: "fixture-request", providerIdentityVerificationId: "fixture-provider", verificationState: "a".repeat(64) };
    if (String(url).includes("verify-pass")) return { verificationToken: token };
    if (String(url).endsWith("/signup")) return { success: false };
    throw new Error("unexpected fixture request");
  } }; };
  let renderer;
  context.after(async () => {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.fetch = originalFetch; globalThis.document = originalDocument;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY;
    else process.env.NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY = originalKey;
    delete globalThis.window; delete globalThis.__kcpSdk; delete globalThis.__kcpComponentFixture;
  });
  const { default: SignupForm } = await loadInstrumentedSignupForm(signupForm.replace('import("@portone/browser-sdk/v2")', 'Promise.resolve(globalThis.__kcpSdk)'));
  await act(async () => { renderer = rendererModule.create(createElement(SignupForm, { initialStart: "email", portoneReady: true, supabaseReady: true })); });
  await acceptRequiredTerms(renderer);
  const input = async (placeholder, value) => { await act(async () => renderer.root.find(n => n.type === "input" && n.props.placeholder === placeholder).props.onChange({ target: { value } })); };
  const click = async label => { await act(async () => { await findButton(renderer.root, label).props.onClick(); }); };
  await input("대표자 이름", "가상대표"); await input("010-0000-0000", "01000000000"); await input("예: 1999-03-21", "19990321");
  await input("example@petmanager.co.kr", "fixture@example.invalid");
  await input("비밀번호 입력", "Fixture!234"); await input("비밀번호 다시 입력", "Fixture!234");
  await click("다음");
  await input("예: 포근한 발바닥 미용실", "가상매장"); await input("010-0000-0000", "01000000000");
  await input("매장 주소를 입력해 주세요", "가상주소");
  const assertOnlyKcp = () => {
    assert.equal(renderer.root.findAll(n => n.type === "dialog").length, 0);
    assert.doesNotMatch(nodeText(renderer.root), /카카오|네이버|토스|통신사 선택/);
  };
  assertOnlyKcp();
  for (const nextOutcome of ["cancel", "failure", "success"]) {
    outcome = nextOutcome;
    await click(outcome === "cancel" ? "본인인증하고 가입하기" : "본인인증 다시 하기");
    for (let i = 0; i < 30 && renderer.root.findAll(n => n.type === "button" && /확인 중|가입 중/.test(nodeText(n))).length; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(calls.at(-1).channelKey, "fixture-kcp");
    assert.equal(calls.at(-1).bypass, undefined);
    assert.equal(hasProductionConsentSheet(renderer.root), false);
    assertOnlyKcp();
    assert.doesNotMatch(nodeText(renderer.root), /PM-ID-|private-fixture-error/);
    if (outcome !== "success") assert.equal(requests.filter(r => r.url.endsWith("/signup")).length, 0);
    await click("이전");
    assert.equal(renderer.root.find(n => n.type === "input" && n.props.placeholder === "비밀번호 입력").props.value, "Fixture!234");
    await click("다음");
    assert.equal(renderer.root.find(n => n.type === "input" && n.props.placeholder === "예: 포근한 발바닥 미용실").props.value, "가상매장");
  }
  const signup = requests.filter(r => r.url.endsWith("/signup"));
  assert.equal(signup.length, 1);
  assert.equal(signup[0].body.identityVerificationToken, token);
  assert.equal(signup[0].body.password, "Fixture!234");
  assert.ok(findButton(renderer.root, "가입 다시 시도하기"));
});
