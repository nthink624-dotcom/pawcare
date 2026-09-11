import { createPriceGuidePhotoSupportCode } from "@/lib/media/price-guide-upload-correlation";

export const PRICE_GUIDE_PHOTO_LIFECYCLE_STAGES = [
  "prepare",
  "upload_intent",
  "upload",
  "provider",
  "cleanup",
] as const;

export const PRICE_GUIDE_PHOTO_FAILURE_CLASSES = [
  "request_invalid",
  "upload_intent",
  "upload",
  "provider_timeout",
  "provider_rejected",
  "provider_invalid_response",
  "cleanup",
  "aborted",
  "unexpected",
] as const;

export type PriceGuidePhotoLifecycleStage = (typeof PRICE_GUIDE_PHOTO_LIFECYCLE_STAGES)[number];
export type PriceGuidePhotoFailureClass = (typeof PRICE_GUIDE_PHOTO_FAILURE_CLASSES)[number];

type PriceGuidePhotoLifecycleStatus = "started" | "succeeded" | "failed" | "aborted";
type PriceGuidePhotoLifecycleCounts = {
  uploadIntentCount: 0 | 1;
  uploadCount: 0 | 1;
  providerRequestCount: 0 | 1;
  cleanupCount: 0 | 1;
};

type PriceGuidePhotoLifecycleReceipt = {
  hardPurged: true;
  receiptFingerprint: string;
  objectResidueCount: 0;
  metadataResidueCount: 0;
};

export type PriceGuidePhotoLifecycleEvent = {
  requestCorrelationFingerprint: string;
  stage: PriceGuidePhotoLifecycleStage;
  status: PriceGuidePhotoLifecycleStatus;
  elapsedMs: number;
  counts: PriceGuidePhotoLifecycleCounts;
  failureClass?: PriceGuidePhotoFailureClass;
  receipt?: PriceGuidePhotoLifecycleReceipt;
};

type LifecycleReporter = (serialized: string) => void;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const SUPPORT_CODE_PATTERN = /^PG-[A-F0-9]{12}$/;

function boundedElapsedMs(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(Math.round(value), 86_400_000)) : 0;
}

export function reportPriceGuidePhotoLifecycle(
  input: PriceGuidePhotoLifecycleEvent,
  reporter: LifecycleReporter = (serialized) => console.info(serialized),
) {
  if (!FINGERPRINT_PATTERN.test(input.requestCorrelationFingerprint)) return false;
  if (!PRICE_GUIDE_PHOTO_LIFECYCLE_STAGES.includes(input.stage)) return false;
  if (input.failureClass && !PRICE_GUIDE_PHOTO_FAILURE_CLASSES.includes(input.failureClass)) return false;
  if (input.receipt && (
    input.receipt.hardPurged !== true
    || input.receipt.objectResidueCount !== 0
    || input.receipt.metadataResidueCount !== 0
    || !FINGERPRINT_PATTERN.test(input.receipt.receiptFingerprint)
  )) return false;

  const supportCode = createPriceGuidePhotoSupportCode(input.requestCorrelationFingerprint);
  const payload = {
    event: "price_guide_photo_lifecycle",
    requestCorrelationFingerprint: input.requestCorrelationFingerprint,
    supportCode,
    stage: input.stage,
    status: input.status,
    elapsedMs: boundedElapsedMs(input.elapsedMs),
    counts: input.counts,
    ...(input.failureClass ? { failureClass: input.failureClass } : {}),
    ...(input.receipt ? { hardPurge: input.receipt } : {}),
  };
  reporter(JSON.stringify(payload));
  return true;
}

export class PriceGuidePhotoLifecycleError extends Error {
  readonly requestCorrelationFingerprint: string;
  readonly supportCode: string;
  readonly failureClass: PriceGuidePhotoFailureClass;

  constructor(requestCorrelationFingerprint: string, failureClass: PriceGuidePhotoFailureClass) {
    const supportCode = createPriceGuidePhotoSupportCode(requestCorrelationFingerprint);
    super(`요금표 사진을 읽지 못했습니다. 다시 시도해 주세요. 문의 코드: ${supportCode}`);
    this.name = "PriceGuidePhotoLifecycleError";
    this.requestCorrelationFingerprint = requestCorrelationFingerprint;
    this.supportCode = supportCode;
    this.failureClass = failureClass;
  }
}

export function readPriceGuidePhotoSupportCode(reason: unknown) {
  if (reason instanceof PriceGuidePhotoLifecycleError) return reason.supportCode;
  if (!(reason instanceof Error)) return null;
  const supportCode = reason.message.match(/\bPG-[A-F0-9]{12}\b/)?.[0] ?? null;
  return supportCode && SUPPORT_CODE_PATTERN.test(supportCode) ? supportCode : null;
}
