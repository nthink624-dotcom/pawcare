import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  classifyMediaMetadataInsertFailure,
  logSafeMediaUploadIntentDiagnostic,
  MEDIA_METADATA_INSERT_FAILURE_CLASSES,
  MEDIA_UPLOAD_INTENT_GENERIC_FAILURE,
  MEDIA_UPLOAD_INTENT_STAGE_CODES,
  MediaUploadIntentStageError,
  runMediaUploadIntentStage,
  toSafeMediaUploadIntentStageHttpResponse,
} from "../../src/server/media-upload-intent-errors.ts";

const expectedResponses = new Map([
  ["MEDIA_POLICY_LOOKUP_FAILED", "사진 업로드 정책을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."],
  ["MEDIA_SIGNING_FAILED", "사진 업로드 연결을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요."],
  ["MEDIA_USAGE_LOOKUP_FAILED", "사진 업로드 사용량을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."],
  ["MEDIA_METADATA_INSERT_FAILED", "사진 업로드 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."],
]);
const REQUEST_FINGERPRINT = "a".repeat(64);

test("every upload-intent stage failure discards its raw cause and maps to one fixed Korean response", async () => {
  assert.deepEqual(MEDIA_UPLOAD_INTENT_STAGE_CODES, [...expectedResponses.keys()]);

  for (const code of MEDIA_UPLOAD_INTENT_STAGE_CODES) {
    const rawCause = `raw-db-or-signing-secret-${code}`;
    let captured;

    try {
      await runMediaUploadIntentStage(code, async () => {
        throw new Error(rawCause);
      });
      assert.fail(`${code} must reject`);
    } catch (error) {
      captured = error;
    }

    assert.ok(captured instanceof MediaUploadIntentStageError);
    assert.equal(captured.code, code);
    assert.equal(captured.message, code);
    assert.equal("cause" in captured, false);

    const response = toSafeMediaUploadIntentStageHttpResponse(captured);
    assert.deepEqual(response, {
      status: 503,
      body: { code, message: expectedResponses.get(code) },
    });
    assert.doesNotMatch(JSON.stringify(response), new RegExp(rawCause));
  }
});

test("the stage wrapper preserves successful values and unrelated errors receive no diagnostic mapping", async () => {
  const value = await runMediaUploadIntentStage("MEDIA_SIGNING_FAILED", async () => ({ signed: true }));
  assert.deepEqual(value, { signed: true });
  assert.equal(toSafeMediaUploadIntentStageHttpResponse(new Error("raw unexpected failure")), null);
  assert.deepEqual(MEDIA_UPLOAD_INTENT_GENERIC_FAILURE, {
    status: 503,
    body: {
      code: "MEDIA_UPLOAD_INTENT_FAILED",
      message: "사진 업로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    },
  });
  assert.doesNotMatch(JSON.stringify(MEDIA_UPLOAD_INTENT_GENERIC_FAILURE), /raw unexpected failure/);
});

test("metadata insert failures use only the five allowlisted internal classes", () => {
  assert.deepEqual(MEDIA_METADATA_INSERT_FAILURE_CLASSES, [
    "schema_cache",
    "check_or_fk",
    "permission",
    "unique",
    "unexpected",
  ]);

  const cases = [
    ...["42P01", "42703", "PGRST002", "PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]
      .map((code) => [{ code, message: "raw schema detail" }, "schema_cache"]),
    ...["23502", "23503", "23514"]
      .map((code) => [{ code, details: "raw integrity detail" }, "check_or_fk"]),
    ...["28000", "28P01", "42501", "PGRST300", "PGRST301", "PGRST302", "PGRST303"]
      .map((code) => [{ code, hint: "raw permission detail" }, "permission"]),
    [{ code: "23505", message: "raw unique detail" }, "unique"],
    [{ code: "XX000", message: "raw unexpected detail" }, "unexpected"],
    [{ code: "42501\nsecret-value", message: "raw unsafe code" }, "unexpected"],
    [{ message: "permission denied but no safe code" }, "unexpected"],
    [new Error("raw no-code error"), "unexpected"],
  ];

  for (const [error, expected] of cases) {
    assert.equal(classifyMediaMetadataInsertFailure(error), expected);
  }
});

test("metadata diagnostics retain only an allowlisted class and a generated safe correlation", async () => {
  const rawCause = {
    code: "42501",
    message: "permission denied for owner@example.com using secret-key-value",
    details: "insert into media_assets with signed-url-value",
    hint: "use another-secret-value",
  };
  let captured;

  try {
    await runMediaUploadIntentStage("MEDIA_METADATA_INSERT_FAILED", async () => {
      throw rawCause;
    }, { requestCorrelationFingerprint: REQUEST_FINGERPRINT });
    assert.fail("metadata insert failure must reject");
  } catch (error) {
    captured = error;
  }

  assert.ok(captured instanceof MediaUploadIntentStageError);
  assert.equal(captured.code, "MEDIA_METADATA_INSERT_FAILED");
  assert.equal(captured.failureClass, "permission");
  assert.equal(captured.requestCorrelationFingerprint, REQUEST_FINGERPRINT);
  assert.match(captured.supportCode, /^PG-[A-F0-9]{12}$/);
  assert.equal("cause" in captured, false);
  assert.doesNotMatch(JSON.stringify(captured), /owner@example\.com|secret-key-value|signed-url-value|another-secret-value/);

  const originalConsoleError = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    assert.equal(logSafeMediaUploadIntentDiagnostic(captured), true);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1);
  const logged = JSON.parse(calls[0][0]);
  assert.deepEqual(Object.keys(logged).sort(), ["elapsedMs", "event", "failureClass", "requestCorrelationFingerprint", "supportCode"]);
  assert.equal(logged.event, "owner_media_upload_intent_metadata_failed");
  assert.equal(logged.failureClass, "permission");
  assert.equal(logged.requestCorrelationFingerprint, REQUEST_FINGERPRINT);
  assert.equal(logged.supportCode, captured.supportCode);
  assert.doesNotMatch(JSON.stringify(calls), /owner@example\.com|secret-key-value|signed-url-value|another-secret-value/);

  assert.deepEqual(toSafeMediaUploadIntentStageHttpResponse(captured), {
    status: 503,
    body: {
      code: "MEDIA_METADATA_INSERT_FAILED",
      message: "사진 업로드 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    },
  });
});

test("non-metadata and malformed diagnostic errors never emit a controlled log", () => {
  const originalConsoleError = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    assert.equal(logSafeMediaUploadIntentDiagnostic(new Error("raw unexpected failure")), false);
    assert.equal(logSafeMediaUploadIntentDiagnostic(new MediaUploadIntentStageError("MEDIA_SIGNING_FAILED")), false);
    assert.equal(
      logSafeMediaUploadIntentDiagnostic(
        new MediaUploadIntentStageError("MEDIA_METADATA_INSERT_FAILED", {
          failureClass: "unexpected",
          requestCorrelationFingerprint: "unsafe-correlation\nsecret-value",
        }),
      ),
      false,
    );
  } finally {
    console.error = originalConsoleError;
  }
  assert.deepEqual(calls, []);
});

function hasAllStageBindings(source) {
  return [
    /runMediaUploadIntentStage\("MEDIA_POLICY_LOOKUP_FAILED", \(\) =>\s*getShopMediaLimitPolicy\(owner\.shopId\),[\s\S]*?intentDiagnostic/s,
    /runMediaUploadIntentStage\("MEDIA_SIGNING_FAILED", \(\) =>\s*createMediaSignedUploadUrl\([\s\S]*?intentDiagnostic/s,
    /runMediaUploadIntentStage\("MEDIA_USAGE_LOOKUP_FAILED", \(\) =>\s*getMonthlyUsageRow\(owner\.shopId, getUsageMonth\(\)\),[\s\S]*?intentDiagnostic/s,
    /runMediaUploadIntentStage\("MEDIA_METADATA_INSERT_FAILED", async \(\) => \{[\s\S]*?\.from\("media_assets"\)\.insert\(insertPayload\)\.select\("\*"\)\.single\(\)[\s\S]*?intentDiagnostic/,
  ].every((pattern) => pattern.test(source));
}

test("createOwnerMediaUploadIntent binds each external boundary to its exact diagnostic stage", async () => {
  const mediaService = await readFile(new URL("../../src/server/media-service.ts", import.meta.url), "utf8");
  const start = mediaService.indexOf("export async function createOwnerMediaUploadIntent");
  const end = mediaService.indexOf("export async function completeOwnerMediaUpload", start);
  const createIntent = mediaService.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.equal(hasAllStageBindings(createIntent), true);
  assert.doesNotMatch(createIntent, /result\.error\.message/);

  for (const code of MEDIA_UPLOAD_INTENT_STAGE_CODES) {
    const mutated = createIntent.replace(code, `${code}_MUTATED`);
    assert.equal(hasAllStageBindings(mutated), false, `${code} mutation must fail the binding contract`);
  }
});

test("upload-intents route emits diagnostics first and never returns unexpected 5xx error text", async () => {
  const route = await readFile(
    new URL("../../src/app/api/owner/media/upload-intents/route.ts", import.meta.url),
    "utf8",
  );
  const diagnosticIndex = route.indexOf("toSafeMediaUploadIntentStageHttpResponse(error)");
  const ownerErrorIndex = route.indexOf("error instanceof OwnerApiError");
  const diagnosticBranch = route.slice(diagnosticIndex, ownerErrorIndex);

  assert.ok(diagnosticIndex >= 0 && diagnosticIndex < ownerErrorIndex);
  assert.match(route, /error instanceof OwnerApiError && error\.status < 500/);
  assert.match(route, /MEDIA_UPLOAD_INTENT_GENERIC_FAILURE\.body/);
  assert.match(route, /status: MEDIA_UPLOAD_INTENT_GENERIC_FAILURE\.status/);
  assert.match(route, /logSafeMediaUploadIntentDiagnostic\(error\)/);
  assert.doesNotMatch(route, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(route, /Could not create media upload intent/);
  assert.doesNotMatch(diagnosticBranch, /error\.(?:message|details|hint|cause)/);
});
