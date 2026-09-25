#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  CARE_REPORT_SAFETY_RULE_CODES,
  CareReportSafetyValidationError,
  buildCareReportPrompt,
  generateCareReportDraft,
} from "../src/server/care-report-ai.ts";
import { assertCareReportTextPiiFree } from "../src/lib/care-report-draft.ts";

export const CARE_REPORT_PROVIDER_EXECUTION_FLAG = "--execute-approved-once";
const SYNTHETIC_SOURCE = "오늘 작업은 전체적으로 괜찮았고 차분하게 마무리했어요.";
const RUNNER_ERROR_CODES = new Set(["execution_flag_required", "synthetic_context_invalid", "provider_request_count_invalid", "provider_request_limit_exceeded", "provider_generation_failed", "provider_output_rejected", "cleanup_failed"]);

class CareReportProviderRunnerError extends Error {
  constructor(code) {
    super(code);
    this.name = "CareReportProviderRunnerError";
    this.code = code;
  }
}

function fail(code) {
  throw new CareReportProviderRunnerError(code);
}

export function createSyntheticCareReportContext() {
  return { sourceText: SYNTHETIC_SOURCE };
}

export function assertSyntheticCareReportProviderInput(context) {
  if (context?.sourceText !== SYNTHETIC_SOURCE || context?.currentReportText !== undefined || context?.revisionRequest !== undefined) fail("synthetic_context_invalid");
  try {
    assertCareReportTextPiiFree(context.sourceText);
  } catch {
    fail("synthetic_context_invalid");
  }
  const prompt = buildCareReportPrompt(context);
  let providerInput;
  try {
    providerInput = JSON.parse(prompt.user);
  } catch {
    fail("synthetic_context_invalid");
  }
  if (providerInput?.sourceText !== SYNTHETIC_SOURCE || Object.keys(providerInput).join(",") !== "sourceText") fail("synthetic_context_invalid");
  return true;
}

function sanitizeRunnerError(error) {
  if (error instanceof CareReportProviderRunnerError && RUNNER_ERROR_CODES.has(error.code)) return { errorCode: error.code };
  if (error instanceof CareReportSafetyValidationError) {
    return { errorCode: "provider_output_rejected", ...(CARE_REPORT_SAFETY_RULE_CODES.includes(error.ruleCode) ? { safetyRuleCode: error.ruleCode } : {}) };
  }
  return { errorCode: "provider_generation_failed" };
}

function summarizeSuccess(result, providerRequestCount) {
  return {
    status: "passed",
    providerRequestCount,
    retryCount: 0,
    persistenceWriteCount: 0,
    publishCount: 0,
    notificationCount: 0,
    resultShape: { reportText: Boolean(result?.reportText), fieldCount: result && typeof result === "object" && typeof result.reportText === "string" ? 1 : 0 },
    estimatedCostUsd: result?.usage?.totalTokens > 0 && Number.isFinite(result?.estimatedCostUsd) ? result.estimatedCostUsd : null,
  };
}

export async function runCareReportProviderValidationOnce({
  generate = (context, fetchImpl) => generateCareReportDraft(context, { fetchImpl }),
  fetchImpl = globalThis.fetch,
  cleanup = async () => {},
} = {}) {
  const context = createSyntheticCareReportContext();
  let providerRequestCount = 0;
  let providerRequestAttempts = 0;
  let report;
  let cleanupCount = 0;
  const exactOneFetch = async (...args) => {
    providerRequestAttempts += 1;
    if (providerRequestAttempts > 1) fail("provider_request_limit_exceeded");
    providerRequestCount += 1;
    return fetchImpl(...args);
  };
  try {
    assertSyntheticCareReportProviderInput(context);
    const result = await generate(context, exactOneFetch);
    if (providerRequestCount !== 1) fail("provider_request_count_invalid");
    report = summarizeSuccess(result, providerRequestCount);
  } catch (error) {
    report = { status: "failed", ...sanitizeRunnerError(error), providerRequestCount, retryCount: 0, persistenceWriteCount: 0, publishCount: 0, notificationCount: 0, estimatedCostUsd: null };
  } finally {
    context.sourceText = "";
    try {
      await cleanup();
      cleanupCount = 1;
    } catch {
      report = { status: "failed", errorCode: "cleanup_failed", providerRequestCount, retryCount: 0, persistenceWriteCount: 0, publishCount: 0, notificationCount: 0, estimatedCostUsd: null };
    }
  }
  return { ...report, cleanupCount };
}

export async function main(args = process.argv.slice(2), write = (value) => process.stdout.write(value)) {
  if (args.length !== 1 || args[0] !== CARE_REPORT_PROVIDER_EXECUTION_FLAG) {
    const report = { status: "failed", errorCode: "execution_flag_required", providerRequestCount: 0, retryCount: 0, persistenceWriteCount: 0, publishCount: 0, notificationCount: 0, estimatedCostUsd: null, cleanupCount: 0 };
    write(`${JSON.stringify(report)}\n`);
    return 1;
  }
  const report = await runCareReportProviderValidationOnce();
  write(`${JSON.stringify(report)}\n`);
  return report.status === "passed" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().then((exitCode) => { process.exitCode = exitCode; });
}
