import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function readTerms(source) {
  const exports = {};
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("exports", "require", js)(exports, id => {
    if (id === "@/lib/brand") return { PETMANAGER_LEGAL_OPERATOR_NAME: "Operator", PETMANAGER_SERVICE_NAME: "Service" };
    if (id === "@/lib/legal/legal-info") return { LEGAL_OPERATOR_NAME: "Operator", LEGAL_SERVICE_NAME: "Service" };
    throw Error(`Unexpected terms dependency ${id}`);
  });
  return exports;
}

test("mobile presents the same current terms version and complete published text accepted by the signup server", async () => {
  const mobile = readTerms(await readFile(new URL("../src/lib/auth/owner-signup-terms.ts", import.meta.url), "utf8"));
  const main = readTerms(await readFile(new URL("../../web/src/lib/auth/owner-signup-terms.ts", import.meta.url), "utf8"));
  assert.equal(mobile.OWNER_SIGNUP_TERMS_VERSION, main.OWNER_SIGNUP_TERMS_VERSION);
  assert.equal(mobile.OWNER_MARKETING_CONSENT_DOCUMENT_VERSION, main.OWNER_MARKETING_CONSENT_DOCUMENT_VERSION);
  assert.equal(mobile.OWNER_MARKETING_TRIAL_BENEFIT_CODE, main.OWNER_MARKETING_TRIAL_BENEFIT_CODE);
  assert.equal(mobile.OWNER_MARKETING_TRIAL_BENEFIT_DAYS, main.OWNER_MARKETING_TRIAL_BENEFIT_DAYS);
  assert.deepEqual(mobile.ownerSignupTerms, main.ownerSignupTerms);
});
