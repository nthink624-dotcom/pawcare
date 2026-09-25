export type PriceGuideUploadCleanupBinding = {
  mediaAssetId: string;
  clientCorrelationId: string;
  requestCorrelationFingerprint: string;
  cleanupProof: string;
  correlationFingerprint: string;
  assetFingerprint: string;
  objectLifecycleFingerprint: string;
};

export type PriceGuideUploadHardPurgeReceipt = {
  hardPurged: true;
  alreadyPurged: boolean;
  requestCorrelationFingerprint: string;
  correlationFingerprint: string;
  assetFingerprint: string;
  objectLifecycleFingerprint: string;
  objectResidueCount: 0;
  metadataResidueCount: 0;
  receiptFingerprint: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const REQUEST_FINGERPRINT_DOMAIN = "petmanager:price-guide-photo-request:v1";

export function createAnonymousPriceGuideUploadCorrelation(
  randomUuid: () => string = () => globalThis.crypto.randomUUID(),
) {
  const correlationId = randomUuid();
  if (!UUID_PATTERN.test(correlationId)) {
    throw new Error("요금표 사진 요청을 안전하게 시작하지 못했습니다.");
  }
  return correlationId;
}

export async function createPriceGuideRequestCorrelationFingerprint(clientCorrelationId: string) {
  if (!UUID_PATTERN.test(clientCorrelationId)) {
    throw new Error("요금표 사진 요청을 안전하게 시작하지 못했습니다.");
  }
  const encoded = new TextEncoder().encode(`${REQUEST_FINGERPRINT_DOMAIN}\n${clientCorrelationId}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export function createPriceGuidePhotoSupportCode(requestCorrelationFingerprint: string) {
  if (!FINGERPRINT_PATTERN.test(requestCorrelationFingerprint)) {
    throw new Error("요금표 사진 요청 코드를 확인하지 못했습니다.");
  }
  return `PG-${requestCorrelationFingerprint.slice(0, 12).toUpperCase()}`;
}

export function bindPriceGuideUploadCleanup(input: {
  clientCorrelationId: string;
  requestCorrelationFingerprint: string;
  mediaAssetId: string;
  cleanupProof: string | null | undefined;
  cleanupBinding: {
    requestCorrelationFingerprint?: string | null;
    correlationFingerprint?: string | null;
    assetFingerprint?: string | null;
    objectLifecycleFingerprint?: string | null;
  } | null | undefined;
}): PriceGuideUploadCleanupBinding {
  if (!UUID_PATTERN.test(input.clientCorrelationId) || !UUID_PATTERN.test(input.mediaAssetId)) {
    throw new Error("요금표 사진 정리 대상을 확인하지 못했습니다.");
  }
  const correlationFingerprint = input.cleanupBinding?.correlationFingerprint ?? "";
  const requestCorrelationFingerprint = input.cleanupBinding?.requestCorrelationFingerprint ?? "";
  const assetFingerprint = input.cleanupBinding?.assetFingerprint ?? "";
  const objectLifecycleFingerprint = input.cleanupBinding?.objectLifecycleFingerprint ?? "";
  if (
    requestCorrelationFingerprint !== input.requestCorrelationFingerprint
    || ![input.cleanupProof, requestCorrelationFingerprint, correlationFingerprint, assetFingerprint, objectLifecycleFingerprint].every((value) =>
    FINGERPRINT_PATTERN.test(value ?? ""),
    )
  ) {
    throw new Error("요금표 사진 정리 정보를 확인하지 못했습니다.");
  }
  return {
    clientCorrelationId: input.clientCorrelationId,
    requestCorrelationFingerprint,
    mediaAssetId: input.mediaAssetId,
    cleanupProof: input.cleanupProof as string,
    correlationFingerprint,
    assetFingerprint,
    objectLifecycleFingerprint,
  };
}

export function buildPriceGuideHardPurgeRequest(binding: PriceGuideUploadCleanupBinding) {
  return {
    mediaAssetIds: [binding.mediaAssetId],
    cleanupProofs: [{
      mediaAssetId: binding.mediaAssetId,
      proof: binding.cleanupProof,
      clientCorrelationId: binding.clientCorrelationId,
      requestCorrelationFingerprint: binding.requestCorrelationFingerprint,
      correlationFingerprint: binding.correlationFingerprint,
      assetFingerprint: binding.assetFingerprint,
      objectLifecycleFingerprint: binding.objectLifecycleFingerprint,
    }],
  };
}

export function getOrCreatePriceGuideCleanupRequest<T>(
  requests: Map<string, Promise<T>>,
  correlationFingerprint: string,
  operation: () => Promise<T>,
) {
  if (!FINGERPRINT_PATTERN.test(correlationFingerprint)) {
    throw new Error("요금표 사진 정리 요청을 확인하지 못했습니다.");
  }
  const existing = requests.get(correlationFingerprint);
  if (existing) return existing;
  const request = operation();
  requests.set(correlationFingerprint, request);
  return request;
}

export function validatePriceGuideHardPurgeReceipt(
  binding: PriceGuideUploadCleanupBinding,
  receipt: PriceGuideUploadHardPurgeReceipt | null | undefined,
) {
  const matches = receipt?.hardPurged === true
    && receipt.objectResidueCount === 0
    && receipt.metadataResidueCount === 0
    && receipt.requestCorrelationFingerprint === binding.requestCorrelationFingerprint
    && receipt.correlationFingerprint === binding.correlationFingerprint
    && receipt.assetFingerprint === binding.assetFingerprint
    && receipt.objectLifecycleFingerprint === binding.objectLifecycleFingerprint
    && FINGERPRINT_PATTERN.test(receipt.receiptFingerprint);
  if (!matches) throw new Error("요금표 사진의 안전한 정리 결과를 확인하지 못했습니다.");
  return receipt as PriceGuideUploadHardPurgeReceipt;
}
