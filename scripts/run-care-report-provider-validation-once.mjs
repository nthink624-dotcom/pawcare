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

const SYNTHETIC_FACTS = Object.freeze([
  Object.freeze({
    id: "fact-synthetic-condition",
    category: "skin_ears",
    text: "눈물이 많아 눈가를 닦았어요.",
    source: "note",
  }),
  Object.freeze({
    id: "fact-synthetic-response",
    category: "behavior",
    text: "얼굴 드라이 때 잠시 긴장했어요.",
    source: "note",
  }),
  Object.freeze({
    id: "fact-synthetic-home-care",
    category: "special",
    text: "집에서는 눈가를 부드럽게 닦아 주세요.",
    source: "note",
  }),
]);

const RUNNER_ERROR_CODES = new Set([
  "execution_flag_required",
  "synthetic_context_invalid",
  "provider_request_count_invalid",
  "provider_request_limit_exceeded",
  "provider_generation_failed",
  "provider_output_rejected",
  "cleanup_failed",
]);

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
  return {
    petName: "반려동물",
    petBreed: "",
    serviceName: "전체 미용",
    automaticFacts: {
      actualDurationMinutes: 90,
      expectedDurationMinutes: null,
      currentWeightKg: null,
      previousWeightKg: null,
      weightChangeFromPreviousKg: null,
      recentAverageWeightKg: null,
      weightDifferenceFromRecentAverageKg: null,
      weightSampleCount: 0,
      nextRecommendedVisitDate: null,
    },
    observations: {
      coat: [],
      skin: [],
      ears: [],
      pawsAndNails: [],
      groomingResponse: [],
      customNote: "",
      sourceFacts: SYNTHETIC_FACTS.map((fact) => ({ ...fact })),
      sourceFactCitations: [],
      sourceVersion: "care-report-v2",
    },
    voiceTranscript: "",
  };
}

export function assertSyntheticCareReportProviderInput(context) {
  const facts = context?.observations?.sourceFacts;
  if (
    context?.petName !== "반려동물" ||
    context?.petBreed !== "" ||
    context?.serviceName !== "전체 미용" ||
    context?.voiceTranscript !== "" ||
    context?.currentDraft !== undefined ||
    context?.automaticFacts?.actualDurationMinutes !== 90 ||
    !Array.isArray(facts) ||
    JSON.stringify(facts) !== JSON.stringify(SYNTHETIC_FACTS)
  ) fail("synthetic_context_invalid");

  for (const text of [context.serviceName, ...facts.map((fact) => fact.text)]) {
    try {
      assertCareReportTextPiiFree(text);
    } catch {
      fail("synthetic_context_invalid");
    }
  }

  const prompt = buildCareReportPrompt(context);
  let providerInput;
  try {
    providerInput = JSON.parse(prompt.user);
  } catch {
    fail("synthetic_context_invalid");
  }
  if (
    providerInput?.petLabel !== "반려동물" ||
    providerInput?.verifiedFacts?.serviceName !== context.serviceName ||
    providerInput?.verifiedFacts?.actualDurationMinutes !== context.automaticFacts.actualDurationMinutes ||
    JSON.stringify(providerInput?.sourceFacts) !== JSON.stringify(SYNTHETIC_FACTS) ||
    "petName" in providerInput ||
    "petBreed" in providerInput ||
    "voiceTranscript" in providerInput ||
    "currentDraft" in providerInput ||
    "photo" in providerInput
  ) fail("synthetic_context_invalid");

  return true;
}

function sanitizeRunnerError(error) {
  if (error instanceof CareReportProviderRunnerError && RUNNER_ERROR_CODES.has(error.code)) {
    return { errorCode: error.code };
  }
  if (error instanceof CareReportSafetyValidationError) {
    return {
      errorCode: "provider_output_rejected",
      ...(CARE_REPORT_SAFETY_RULE_CODES.includes(error.ruleCode)
        ? { safetyRuleCode: error.ruleCode }
        : {}),
    };
  }
  return { errorCode: "provider_generation_failed" };
}

function clearSyntheticContext(context) {
  context.voiceTranscript = "";
  context.petBreed = "";
  context.observations.customNote = "";
  context.observations.sourceFacts.splice(0);
  context.observations.sourceFactCitations.splice(0);
}

function summarizeSuccess(result, providerRequestCount) {
  const citations = Array.isArray(result?.sourceFactCitations) ? result.sourceFactCitations : [];
  const citedFactIds = new Set(citations.flatMap((citation) => citation.sourceFactIds ?? []));
  const cost = result?.usage?.totalTokens > 0 && Number.isFinite(result?.estimatedCostUsd)
    ? result.estimatedCostUsd
    : null;

  return {
    status: "passed",
    providerRequestCount,
    retryCount: 0,
    fallbackCount: 0,
    persistenceWriteCount: 0,
    publishCount: 0,
    notificationCount: 0,
    draftShape: {
      oneLineSummary: Boolean(result?.draft?.oneLineSummary),
      treatmentSummary: Boolean(result?.draft?.treatmentSummary),
      conditionSummary: Boolean(result?.draft?.conditionSummary),
      groomingResponse: Boolean(result?.draft?.groomingResponse),
      homeCareTipCount: Array.isArray(result?.draft?.homeCareTips) ? result.draft.homeCareTips.length : 0,
    },
    provenance: {
      sourceFactCount: SYNTHETIC_FACTS.length,
      citationCount: citations.length,
      citedFactCount: citedFactIds.size,
    },
    estimatedCostUsd: cost,
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
    const sanitizedError = sanitizeRunnerError(error);
    report = {
      status: "failed",
      ...sanitizedError,
      providerRequestCount,
      retryCount: 0,
      fallbackCount: 0,
      persistenceWriteCount: 0,
      publishCount: 0,
      notificationCount: 0,
      estimatedCostUsd: null,
    };
  } finally {
    clearSyntheticContext(context);
    try {
      await cleanup();
      cleanupCount = 1;
    } catch {
      report = {
        status: "failed",
        errorCode: "cleanup_failed",
        providerRequestCount,
        retryCount: 0,
        fallbackCount: 0,
        persistenceWriteCount: 0,
        publishCount: 0,
        notificationCount: 0,
        estimatedCostUsd: null,
      };
    }
  }

  return { ...report, cleanupCount };
}

export async function main(args = process.argv.slice(2), write = (value) => process.stdout.write(value)) {
  if (args.length !== 1 || args[0] !== CARE_REPORT_PROVIDER_EXECUTION_FLAG) {
    const report = {
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
    };
    write(`${JSON.stringify(report)}\n`);
    return 1;
  }

  const report = await runCareReportProviderValidationOnce();
  write(`${JSON.stringify(report)}\n`);
  return report.status === "passed" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
