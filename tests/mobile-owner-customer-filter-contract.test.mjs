import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/owner-customer-filter.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadedModule = { exports: {} };
Function("module", "exports", output)(loadedModule, loadedModule.exports);
const { matchesCanonicalCustomerFilter } = loadedModule.exports;

test("loyal and first-visit filters consume only canonical projection flags", () => {
  const loyal = { customerGradeOverride: "loyal", hasFirstVisit: false };
  const firstVisit = { customerGradeOverride: null, hasFirstVisit: true };
  const ordinary = { customerGradeOverride: "normal", hasFirstVisit: false };

  assert.equal(matchesCanonicalCustomerFilter(loyal, "all"), true);
  assert.equal(matchesCanonicalCustomerFilter(loyal, "loyal"), true);
  assert.equal(matchesCanonicalCustomerFilter(loyal, "first_visit"), false);
  assert.equal(matchesCanonicalCustomerFilter(firstVisit, "loyal"), false);
  assert.equal(matchesCanonicalCustomerFilter(firstVisit, "first_visit"), true);
  assert.equal(matchesCanonicalCustomerFilter(ordinary, "loyal"), false);
  assert.equal(matchesCanonicalCustomerFilter(ordinary, "first_visit"), false);
  assert.doesNotMatch(source, /created_at|visitCount|latestActivityAt|Date\(/);
});
