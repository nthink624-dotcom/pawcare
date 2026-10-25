import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const signupForm = await readFile(
  new URL("../src/components/auth/signup-form.tsx", import.meta.url),
  "utf8",
);
const signupPage = await readFile(
  new URL("../src/app/signup/page.tsx", import.meta.url),
  "utf8",
);

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
    declarationText("clearSignupAgreementReceipt"),
    "export { readSignupAgreementReceipt, writeSignupAgreementReceipt, clearSignupAgreementReceipt };",
    "export function setWindow(value) { window = value; }",
  ].join("\n"),
  {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  },
).outputText;

const agreementHelpers = await import(
  `data:text/javascript;base64,${Buffer.from(agreementHelperJavaScript).toString("base64")}`
);

function createSessionStorage({ throwOnSet = false, silentSet = false, throwOnGet = false } = {}) {
  const values = new Map();
  return {
    getItem(key) {
      if (throwOnGet) throw new Error("session storage read blocked");
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (throwOnSet) throw new Error("session storage write blocked");
      if (!silentSet) values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const requiredOnlyAgreements = {
  service: true,
  privacy: true,
  location: false,
  marketing: false,
};

test("accepted current-version terms are restored before the consent sheet can reopen", () => {
  assert.match(
    signupForm,
    /const SIGNUP_AGREEMENT_STORAGE_KEY = `petmanager:signup-agreements:\$\{OWNER_SIGNUP_TERMS_VERSION\}`/,
  );

  const initialStartEffect = signupForm.slice(
    signupForm.indexOf("// The development-only price guide fixture starts before the consent/profile flow."),
    signupForm.indexOf("const updateField"),
  );
  assert.ok(initialStartEffect.indexOf("readSignupAgreementReceipt()") >= 0);
  assert.ok(initialStartEffect.indexOf("readSignupAgreementReceipt()") < initialStartEffect.indexOf('setStartTarget("email")'));
  assert.match(initialStartEffect, /if \(storedAgreements\)[\s\S]*setAgreements\(storedAgreements\);[\s\S]*setStartTarget\(null\);/);

  const openStart = signupForm.slice(
    signupForm.indexOf("const openStart"),
    signupForm.indexOf("const continueStart"),
  );
  assert.match(openStart, /readSignupAgreementReceipt\(\)/);
  assert.match(openStart, /setAgreements\(storedAgreements\)/);
  assert.match(openStart, /setStartTarget\(null\)/);
});

test("only an explicit required-term continuation writes the receipt", () => {
  const continueStart = signupForm.slice(
    signupForm.indexOf("const continueStart"),
    signupForm.indexOf("const checkEmailAvailability"),
  );
  const requiredGuard = continueStart.indexOf("if (!requiredAgreed || !startTarget)");
  const receiptWrite = continueStart.indexOf("const agreementReceiptStored = writeSignupAgreementReceipt(agreements)");
  const sheetClose = continueStart.indexOf("setStartTarget(null)");

  assert.ok(requiredGuard >= 0);
  assert.ok(receiptWrite > requiredGuard);
  assert.ok(sheetClose > receiptWrite);
  assert.match(continueStart, /setMessage\("필수 약관에 동의해 주세요\."\)/);
  assert.match(continueStart, /약관 동의 상태를 저장하지 못했습니다/);
  assert.match(continueStart, /if \(!agreementReceiptStored\)[\s\S]*return;/);
  assert.equal(signupForm.match(/writeSignupAgreementReceipt\(agreements\)/g)?.length, 1);
});

test("optional refusals are preserved and stale or malformed receipts fail closed", () => {
  const receiptReader = signupForm.slice(
    signupForm.indexOf("function readSignupAgreementReceipt"),
    signupForm.indexOf("function writeSignupAgreementReceipt"),
  );
  const receiptWriter = signupForm.slice(
    signupForm.indexOf("function writeSignupAgreementReceipt"),
    signupForm.indexOf("function clearSignupAgreementReceipt"),
  );

  assert.match(receiptReader, /receipt\.version !== OWNER_SIGNUP_TERMS_VERSION/);
  assert.match(receiptReader, /storedAgreements\.service !== true/);
  assert.match(receiptReader, /storedAgreements\.privacy !== true/);
  assert.match(receiptReader, /typeof storedAgreements\.location !== "boolean"/);
  assert.match(receiptReader, /typeof storedAgreements\.marketing !== "boolean"/);
  assert.match(receiptWriter, /const receipt = JSON\.stringify\(\{ version: OWNER_SIGNUP_TERMS_VERSION, agreements \}\)/);
  assert.match(receiptWriter, /return window\.sessionStorage\.getItem\(SIGNUP_AGREEMENT_STORAGE_KEY\) === receipt/);
  assert.match(receiptWriter, /catch \{\s*return false;/);
  assert.doesNotMatch(signupForm, /window\.localStorage/);
});

test("same-tab continuation survives remounts while check-only and a new tab stay unaccepted", () => {
  const sameTabStorage = createSessionStorage();
  agreementHelpers.setWindow({ sessionStorage: sameTabStorage });

  assert.equal(agreementHelpers.readSignupAgreementReceipt(), null);
  assert.equal(agreementHelpers.writeSignupAgreementReceipt(requiredOnlyAgreements), true);
  assert.deepEqual(agreementHelpers.readSignupAgreementReceipt(), requiredOnlyAgreements);

  agreementHelpers.setWindow({ sessionStorage: sameTabStorage });
  assert.deepEqual(agreementHelpers.readSignupAgreementReceipt(), requiredOnlyAgreements);

  const checkOnlyStorage = createSessionStorage();
  agreementHelpers.setWindow({ sessionStorage: checkOnlyStorage });
  assert.equal(agreementHelpers.readSignupAgreementReceipt(), null);

  const newTabStorage = createSessionStorage();
  agreementHelpers.setWindow({ sessionStorage: newTabStorage });
  assert.equal(agreementHelpers.readSignupAgreementReceipt(), null);
});

test("storage failure remains a separately guarded branch rather than lifecycle proof", () => {
  for (const sessionStorage of [
    createSessionStorage({ throwOnSet: true }),
    createSessionStorage({ silentSet: true }),
    createSessionStorage({ throwOnGet: true }),
  ]) {
    agreementHelpers.setWindow({ sessionStorage });
    assert.equal(agreementHelpers.writeSignupAgreementReceipt(requiredOnlyAgreements), false);
    assert.equal(agreementHelpers.readSignupAgreementReceipt(), null);
  }

  assert.match(signupForm, /role="alert"/);
  assert.match(signupForm, /message && !startTarget/);
});

test("the production call graph has one SignupForm mount and exactly two explicit reopen sites", () => {
  assert.equal(signupPage.match(/<SignupForm\b/g)?.length, 1);
  assert.equal(signupForm.match(/setStartTarget\("email"\)/g)?.length, 2);

  const initialStartEffect = signupForm.slice(
    signupForm.indexOf("// The development-only price guide fixture starts before the consent/profile flow."),
    signupForm.indexOf("const updateField"),
  );
  assert.match(initialStartEffect, /\}, \[initialStart, priceGuideFixtureEnabled\]\);/);
  assert.doesNotMatch(initialStartEffect, /focus|pageshow|popstate|visibilitychange/);

  const openStart = signupForm.slice(
    signupForm.indexOf("const openStart"),
    signupForm.indexOf("const continueStart"),
  );
  assert.match(openStart, /setStartTarget\("email"\)/);
  assert.doesNotMatch(openStart, /router\.|location\.|history\./);
});

test("invalid receipts require consent and successful-flow cleanup removes the receipt", () => {
  const sessionStorage = createSessionStorage();
  agreementHelpers.setWindow({ sessionStorage });
  const key = "petmanager:signup-agreements:2026-03-31";
  for (const raw of [
    "{invalid",
    JSON.stringify({ version: "obsolete", agreements: requiredOnlyAgreements }),
    JSON.stringify({ version: "2026-03-31", agreements: { ...requiredOnlyAgreements, privacy: false } }),
    JSON.stringify({ version: "2026-03-31", agreements: { ...requiredOnlyAgreements, location: "false" } }),
  ]) {
    sessionStorage.setItem(key, raw);
    assert.equal(agreementHelpers.readSignupAgreementReceipt(), null);
  }
  assert.equal(agreementHelpers.writeSignupAgreementReceipt(requiredOnlyAgreements), true);
  agreementHelpers.clearSignupAgreementReceipt();
  assert.equal(sessionStorage.getItem(key), null);
  assert.equal(agreementHelpers.readSignupAgreementReceipt(), null);
});

test("a completed signup clears the temporary consent receipt", () => {
  const failureGate = signupForm.indexOf("if (!response.ok || !result.success)");
  const receiptClear = signupForm.indexOf("clearSignupAgreementReceipt();", failureGate);
  const successNavigation = signupForm.indexOf("const resolvedNextPath", receiptClear);

  assert.ok(failureGate >= 0);
  assert.ok(receiptClear > failureGate);
  assert.ok(successNavigation > receiptClear);
});
