import { createPriceGuidePhotoSupportCode } from "@/lib/media/price-guide-upload-correlation";

export const MEDIA_UPLOAD_INTENT_STAGE_CODES = [
  "MEDIA_POLICY_LOOKUP_FAILED",
  "MEDIA_SIGNING_FAILED",
  "MEDIA_USAGE_LOOKUP_FAILED",
  "MEDIA_METADATA_INSERT_FAILED",
] as const;

export type MediaUploadIntentStageCode = (typeof MEDIA_UPLOAD_INTENT_STAGE_CODES)[number];

export const MEDIA_METADATA_INSERT_FAILURE_CLASSES = [
  "schema_cache",
  "check_or_fk",
  "permission",
  "unique",
  "unexpected",
] as const;

export type MediaMetadataInsertFailureClass = (typeof MEDIA_METADATA_INSERT_FAILURE_CLASSES)[number];

type MediaUploadIntentStageDiagnostic = {
  failureClass?: MediaMetadataInsertFailureClass;
  requestCorrelationFingerprint?: string;
  elapsedMs?: number;
};

const schemaCacheCodes = new Set([
  "42P01",
  "42703",
  "PGRST002",
  "PGRST200",
  "PGRST201",
  "PGRST202",
  "PGRST203",
  "PGRST204",
  "PGRST205",
]);
const checkOrForeignKeyCodes = new Set(["23502", "23503", "23514"]);
const permissionCodes = new Set(["28000", "28P01", "42501", "PGRST300", "PGRST301", "PGRST302", "PGRST303"]);
const uniqueCodes = new Set(["23505"]);
const safeCorrelationPattern = /^[a-f0-9]{64}$/i;

const MEDIA_UPLOAD_INTENT_STAGE_MESSAGES = {
  MEDIA_POLICY_LOOKUP_FAILED: "사진 업로드 정책을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  MEDIA_SIGNING_FAILED: "사진 업로드 연결을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  MEDIA_USAGE_LOOKUP_FAILED: "사진 업로드 사용량을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  MEDIA_METADATA_INSERT_FAILED: "사진 업로드 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
} satisfies Record<MediaUploadIntentStageCode, string>;

export const MEDIA_UPLOAD_INTENT_GENERIC_FAILURE = {
  status: 503,
  body: {
    code: "MEDIA_UPLOAD_INTENT_FAILED",
    message: "사진 업로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },
} as const;

export class MediaUploadIntentStageError extends Error {
  readonly code: MediaUploadIntentStageCode;
  readonly failureClass: MediaMetadataInsertFailureClass | null;
  readonly requestCorrelationFingerprint: string | null;
  readonly supportCode: string | null;
  readonly elapsedMs: number;

  constructor(code: MediaUploadIntentStageCode, diagnostic?: MediaUploadIntentStageDiagnostic) {
    super(code);
    this.name = "MediaUploadIntentStageError";
    this.code = code;
    this.failureClass = diagnostic?.failureClass ?? null;
    this.requestCorrelationFingerprint = safeCorrelationPattern.test(diagnostic?.requestCorrelationFingerprint ?? "")
      ? diagnostic?.requestCorrelationFingerprint ?? null
      : null;
    this.supportCode = this.requestCorrelationFingerprint
      ? createPriceGuidePhotoSupportCode(this.requestCorrelationFingerprint)
      : null;
    this.elapsedMs = Math.max(0, Math.round(diagnostic?.elapsedMs ?? 0));
  }
}

function getSafeErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return "";
  const normalized = code.trim().toUpperCase();
  return /^[A-Z0-9_]{1,32}$/.test(normalized) ? normalized : "";
}

export function classifyMediaMetadataInsertFailure(error: unknown): MediaMetadataInsertFailureClass {
  const code = getSafeErrorCode(error);
  if (schemaCacheCodes.has(code)) return "schema_cache";
  if (checkOrForeignKeyCodes.has(code)) return "check_or_fk";
  if (permissionCodes.has(code)) return "permission";
  if (uniqueCodes.has(code)) return "unique";
  return "unexpected";
}

export function logSafeMediaUploadIntentDiagnostic(error: unknown) {
  if (
    !(error instanceof MediaUploadIntentStageError) ||
    error.code !== "MEDIA_METADATA_INSERT_FAILED" ||
    !error.failureClass ||
    !error.requestCorrelationFingerprint ||
    !safeCorrelationPattern.test(error.requestCorrelationFingerprint)
  ) {
    return false;
  }

  console.error(
    JSON.stringify({
      event: "owner_media_upload_intent_metadata_failed",
      failureClass: error.failureClass,
      requestCorrelationFingerprint: error.requestCorrelationFingerprint,
      supportCode: error.supportCode,
      elapsedMs: error.elapsedMs,
    }),
  );
  return true;
}

export async function runMediaUploadIntentStage<T>(
  code: MediaUploadIntentStageCode,
  operation: () => Promise<T>,
  diagnostic?: Pick<MediaUploadIntentStageDiagnostic, "requestCorrelationFingerprint">,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } catch (error) {
    if (code === "MEDIA_METADATA_INSERT_FAILED") {
      throw new MediaUploadIntentStageError(code, {
        failureClass: classifyMediaMetadataInsertFailure(error),
        requestCorrelationFingerprint: diagnostic?.requestCorrelationFingerprint,
        elapsedMs: performance.now() - startedAt,
      });
    }
    throw new MediaUploadIntentStageError(code, {
      requestCorrelationFingerprint: diagnostic?.requestCorrelationFingerprint,
      elapsedMs: performance.now() - startedAt,
    });
  }
}

export function toSafeMediaUploadIntentStageHttpResponse(error: unknown) {
  if (!(error instanceof MediaUploadIntentStageError)) return null;

  return {
    status: 503,
    body: {
      code: error.code,
      message: MEDIA_UPLOAD_INTENT_STAGE_MESSAGES[error.code],
    },
  } as const;
}
