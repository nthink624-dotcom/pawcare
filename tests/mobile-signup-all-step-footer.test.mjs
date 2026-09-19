import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const signupForm = await readFile(new URL("../src/components/auth/signup-form.tsx", import.meta.url), "utf8");
const consent = await readFile(new URL("../src/components/auth/signup-consent-dialog.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("signup.tsx", signupForm, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) found = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `missing handler ${name}`);
  return found;
}

test("signup stage footers share the approved mobile geometry", () => {
  assert.match(signupForm, /const ACTION_BUTTON_GRID = "grid grid-cols-2 gap-3"/);
  assert.match(signupForm, /shrink-0 border-t border-\[#e8edf3\] bg-white px-5 pb-\[calc\(env\(safe-area-inset-bottom\)\+12px\)\] pt-3/);
  assert.match(signupForm, /data-signup-stage-footer=\{step\}/);
  assert.match(consent, /data-signup-stage-footer="consent"/);
  assert.match(signupForm, /step === "identity" \|\| step === "profile"/);
});

test("consent content scrolls independently above a persistent footer", () => {
  assert.match(consent, /flex max-h-\[calc\(100dvh-32px\)\] flex-col/);
  assert.match(consent, /min-h-0 overflow-y-auto[^"\n]*" data-signup-sheet-body="consent"/);
  const footer = consent.slice(consent.indexOf('<footer'));
  assert.match(footer, /shrink-0/);
  assert.match(footer, /onClick=\{onClose\}[^>]*>닫기/);
  assert.match(footer, /onClick=\{onContinue\} disabled=\{!requiredAgreed\}/);
  assert.match(signupForm, /onContinue=\{continueStart\}/);
});

test("direct verification and submission share one guarded profile action", () => {
  const flow = handler("moveToVerificationStep");
  assert.ok(flow.indexOf("startPhoneIdentity()") < flow.indexOf("submitSignup(token, flow.signal)"));
  assert.match(flow, /if \(signupFlowRef.current \|\| loading \|\| checkingEmail\) return/);
  assert.match(signupForm, /onClick=\{\(\) => void moveToVerificationStep\(\)\}/);
  assert.match(signupForm, /disabled=\{signupPhase !== "idle" \|\| loading \|\| checkingEmail\}/);
});

test("KCP transitions directly without a method selection or extra completion step", () => {
  assert.doesNotMatch(signupForm, /<VerificationModal|data-signup-sheet-body="verification-(method|detail)"/);
  assert.match(handler("startPhoneIdentity"), /NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY/);
  assert.match(handler("moveToVerificationStep"), /await startPhoneIdentity\(\)/);
  assert.doesNotMatch(signupForm, />가입 완료<|통신사 선택|startUnifiedIdentity/);
});

test("representative next checks email before advancing and profile previous preserves inputs", () => {
  const next = handler("moveToProfileStep");
  assert.ok(next.indexOf("checkEmailAvailability(") < next.indexOf('setStep("profile")'));
  assert.match(next, /available && !flow.signal.aborted/);
  const back = handler("returnToRepresentativeStep");
  assert.match(back, /setStep\("identity"\)/);
  assert.doesNotMatch(back, /setFields|resetSignup|setStartTarget/);
});

test("native consent modal uses the top layer and restores body scrolling", () => {
  assert.match(signupForm, /fixed inset-x-0 bottom-0 z-30/);
  assert.match(consent, /dialog\?\.showModal\(\)/);
  assert.match(consent, /dialog\?\.close\(\)/);
  assert.match(consent, /document.body.style.overflow = overflow/);
  assert.match(consent, /aria-labelledby=\{titleId\}/);
});
