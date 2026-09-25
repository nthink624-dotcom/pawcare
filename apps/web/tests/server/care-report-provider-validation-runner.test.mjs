import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});

const { CARE_REPORT_PROVIDER_EXECUTION_FLAG, assertSyntheticCareReportProviderInput, createSyntheticCareReportContext, main, runCareReportProviderValidationOnce } = await import("../../scripts/run-care-report-provider-validation-once.mjs");

test("runner permits only one fixed non-identifying source string", () => {
  const context = createSyntheticCareReportContext();
  assert.equal(assertSyntheticCareReportProviderInput(context), true);
  context.sourceText = "010-1234-5678";
  assert.throws(() => assertSyntheticCareReportProviderInput(context), /synthetic_context_invalid/);
});

test("one approved run dispatches exactly one provider request and reports one result field", async () => {
  const report = await runCareReportProviderValidationOnce({
    fetchImpl: async () => Response.json({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ reportText: "오늘 미용은 전체적으로 차분하게 잘 마무리했어요." }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
    }),
  });
  assert.equal(report.status, "passed");
  assert.equal(report.providerRequestCount, 1);
  assert.deepEqual(report.resultShape, { reportText: true, fieldCount: 1 });
  assert.equal(report.persistenceWriteCount, 0);
  assert.equal(report.publishCount, 0);
});

test("a second provider attempt is blocked and output stays allowlisted", async () => {
  const report = await runCareReportProviderValidationOnce({
    generate: async (_context, fetchImpl) => {
      await fetchImpl("https://example.test");
      await fetchImpl("https://example.test");
    },
    fetchImpl: async () => Response.json({}),
  });
  assert.equal(report.status, "failed");
  assert.equal(report.errorCode, "provider_request_limit_exceeded");
  assert.equal(report.providerRequestCount, 1);
  assert.doesNotMatch(JSON.stringify(report), /010-|authorization|api[_-]?key/i);
});

test("missing approval flag cannot dispatch a provider request", async () => {
  let output = "";
  const code = await main([], (value) => { output += value; });
  assert.equal(code, 1);
  assert.equal(JSON.parse(output).errorCode, "execution_flag_required");
  assert.equal(CARE_REPORT_PROVIDER_EXECUTION_FLAG, "--execute-approved-once");
});
