import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CARE_REPORT_PROVIDER_EXECUTION_FLAG,
  assertSyntheticCareReportProviderInput,
  createSyntheticCareReportContext,
  main,
  runCareReportProviderValidationOnce,
} from "../../scripts/run-care-report-provider-validation-once.mjs";
import {
  CARE_REPORT_SAFETY_RULE_CODES,
  CareReportSafetyValidationError,
} from "../../src/server/care-report-ai.ts";

const runnerUrl = new URL("../../scripts/run-care-report-provider-validation-once.mjs", import.meta.url);

function generatedResult() {
  return {
    draft: {
      oneLineSummary: "눈가를 세정하고 마무리했습니다.",
      treatmentSummary: "전체 미용을 진행했고, 총 작업 시간은 1시간 30분이었어요.",
      conditionSummary: "눈물이 있어 눈가를 닦았습니다.",
      groomingResponse: "얼굴 드라이 중 잠시 긴장했습니다.",
      homeCareTips: ["집에서는 눈가를 부드럽게 닦아 주세요."],
      nextVisitGuide: "",
    },
    sourceFactCitations: [
      { field: "conditionSummary", sentence: "눈물이 있어 눈가를 닦았습니다.", sourceFactIds: ["fact-synthetic-condition"] },
      { field: "groomingResponse", sentence: "얼굴 드라이 중 잠시 긴장했습니다.", sourceFactIds: ["fact-synthetic-response"] },
      { field: "homeCareTips", sentence: "집에서는 눈가를 부드럽게 닦아 주세요.", sourceFactIds: ["fact-synthetic-home-care"] },
    ],
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      promptCacheHitTokens: 0,
      promptCacheMissTokens: 100,
    },
    estimatedCostUsd: 0.000028,
  };
}

test("runner permits only the fixed non-identifying synthetic provider input", () => {
  const context = createSyntheticCareReportContext();
  assert.equal(assertSyntheticCareReportProviderInput(context), true);
  assert.equal(context.petName, "반려동물");
  assert.equal(context.petBreed, "");
  assert.equal(context.voiceTranscript, "");
  assert.equal(context.currentDraft, undefined);
  assert.deepEqual(context.observations.sourceFacts.map(({ id, category, source }) => ({ id, category, source })), [
    { id: "fact-synthetic-condition", category: "skin_ears", source: "note" },
    { id: "fact-synthetic-response", category: "behavior", source: "note" },
    { id: "fact-synthetic-home-care", category: "special", source: "note" },
  ]);

  context.observations.sourceFacts[0].text = "010-1234-5678";
  assert.throws(() => assertSyntheticCareReportProviderInput(context), /synthetic_context_invalid/);
});

test("one approved run dispatches exactly one provider request and emits only a sanitized summary", async () => {
  let networkCalls = 0;
  let cleanupCalls = 0;
  let capturedContext;
  const report = await runCareReportProviderValidationOnce({
    fetchImpl: async () => {
      networkCalls += 1;
      return new Response("{}", { status: 200 });
    },
    generate: async (context, exactOneFetch) => {
      capturedContext = context;
      await exactOneFetch("https://provider.invalid/v1/generate", { method: "POST" });
      return generatedResult();
    },
    cleanup: async () => {
      cleanupCalls += 1;
    },
  });

  assert.equal(networkCalls, 1);
  assert.equal(cleanupCalls, 1);
  assert.deepEqual(report, {
    status: "passed",
    providerRequestCount: 1,
    retryCount: 0,
    fallbackCount: 0,
    persistenceWriteCount: 0,
    publishCount: 0,
    notificationCount: 0,
    draftShape: {
      oneLineSummary: true,
      treatmentSummary: true,
      conditionSummary: true,
      groomingResponse: true,
      homeCareTipCount: 1,
    },
    provenance: { sourceFactCount: 3, citationCount: 3, citedFactCount: 3 },
    estimatedCostUsd: 0.000028,
    cleanupCount: 1,
  });
  assert.equal(capturedContext.observations.sourceFacts.length, 0);
  assert.doesNotMatch(JSON.stringify(report), /눈가|드라이|homeCareTips|promptTokens|completionTokens|totalTokens|api[_-]?key|authorization/i);
});

test("a second provider attempt is blocked before network and failure output stays allowlisted", async () => {
  let networkCalls = 0;
  const report = await runCareReportProviderValidationOnce({
    fetchImpl: async () => {
      networkCalls += 1;
      return new Response("{}", { status: 200 });
    },
    generate: async (_context, exactOneFetch) => {
      await exactOneFetch("https://provider.invalid/v1/generate", { method: "POST" });
      await exactOneFetch("https://provider.invalid/v1/generate", { method: "POST" });
      return generatedResult();
    },
  });

  assert.equal(networkCalls, 1);
  assert.deepEqual(report, {
    status: "failed",
    errorCode: "provider_request_limit_exceeded",
    providerRequestCount: 1,
    retryCount: 0,
    fallbackCount: 0,
    persistenceWriteCount: 0,
    publishCount: 0,
    notificationCount: 0,
    estimatedCostUsd: null,
    cleanupCount: 1,
  });
});

test("every allowlisted safety rule is reported separately without exposing rejected content", async () => {
  for (const ruleCode of CARE_REPORT_SAFETY_RULE_CODES) {
    let networkCalls = 0;
    let cleanupCalls = 0;
    const report = await runCareReportProviderValidationOnce({
      fetchImpl: async () => {
        networkCalls += 1;
        return new Response("{}", { status: 200 });
      },
      generate: async (_context, exactOneFetch) => {
        await exactOneFetch("https://provider.invalid/v1/generate", { method: "POST" });
        throw new CareReportSafetyValidationError(ruleCode);
      },
      cleanup: async () => {
        cleanupCalls += 1;
      },
    });

    assert.equal(networkCalls, 1);
    assert.equal(cleanupCalls, 1);
    assert.deepEqual(report, {
      status: "failed",
      errorCode: "provider_output_rejected",
      safetyRuleCode: ruleCode,
      providerRequestCount: 1,
      retryCount: 0,
      fallbackCount: 0,
      persistenceWriteCount: 0,
      publishCount: 0,
      notificationCount: 0,
      estimatedCostUsd: null,
      cleanupCount: 1,
    });
    assert.doesNotMatch(
      JSON.stringify(report),
      /눈가|드라이|provider\.invalid|secret-provider-payload|api[_-]?key|authorization/i,
    );
  }
});

test("unknown safety rules and non-safety errors retain coarse redacted output", async () => {
  const rejectedDetail = "unknown-provider-claim-and-secret";
  const unknownSafetyError = new CareReportSafetyValidationError("unknown_rule");
  unknownSafetyError.message = rejectedDetail;
  const unknownSafetyReport = await runCareReportProviderValidationOnce({
    generate: async () => {
      throw unknownSafetyError;
    },
  });
  assert.equal(unknownSafetyReport.errorCode, "provider_output_rejected");
  assert.equal("safetyRuleCode" in unknownSafetyReport, false);
  assert.doesNotMatch(JSON.stringify(unknownSafetyReport), new RegExp(rejectedDetail));

  const unexpectedReport = await runCareReportProviderValidationOnce({
    generate: async () => {
      throw new Error(rejectedDetail);
    },
  });
  assert.equal(unexpectedReport.errorCode, "provider_generation_failed");
  assert.equal("safetyRuleCode" in unexpectedReport, false);
  assert.doesNotMatch(JSON.stringify(unexpectedReport), new RegExp(rejectedDetail));
});

test("unexpected errors and missing approval flag cannot leak details or dispatch a provider request", async () => {
  const rawSecret = "secret-provider-payload-and-credential";
  const report = await runCareReportProviderValidationOnce({
    generate: async () => {
      throw new Error(rawSecret);
    },
  });
  assert.equal(report.errorCode, "provider_generation_failed");
  assert.equal(report.providerRequestCount, 0);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(rawSecret));

  let output = "";
  const exitCode = await main([], (value) => { output += value; });
  assert.equal(exitCode, 1);
  assert.deepEqual(JSON.parse(output), {
    status: "failed",
    errorCode: "execution_flag_required",
    providerRequestCount: 0,
    retryCount: 0,
    fallbackCount: 0,
    persistenceWriteCount: 0,
    publishCount: 0,
    notificationCount: 0,
    estimatedCostUsd: null,
    cleanupCount: 0,
  });
  assert.equal(CARE_REPORT_PROVIDER_EXECUTION_FLAG, "--execute-approved-once");
});

test("runner source has no persistence, auth, notification, secret logging, retry, or raw-output path", async () => {
  const source = await readFile(runnerUrl, "utf8");
  assert.match(source, /generateCareReportDraft\(context, \{ fetchImpl \}\)/);
  assert.match(source, /providerRequestAttempts > 1/);
  assert.match(source, /CARE_REPORT_SAFETY_RULE_CODES\.includes\(error\.ruleCode\)/);
  assert.match(source, /\{ safetyRuleCode: error\.ruleCode \}/);
  assert.match(source, /finally \{[\s\S]*clearSyntheticContext\(context\)[\s\S]*await cleanup\(\)/);
  assert.doesNotMatch(source, /createClient|supabase|insert\(|update\(|upsert\(|delete\(|\bPATCH\b|\bPUT\b|publish\s*\(|sendNotification\s*\(|writeFile|appendFile|console\.|process\.env/i);
  assert.doesNotMatch(source, /JSON\.stringify\((?:result|error|context|prompt)\)/);
});
