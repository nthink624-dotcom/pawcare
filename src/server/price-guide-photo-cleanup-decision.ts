import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type PriceGuideSourceCleanupAsset = {
  id: string;
  media_kind: string;
  deleted_at: string | null;
};

export type PriceGuideSourceCleanupProof = {
  mediaAssetId: string;
  proof: string;
  clientCorrelationId?: string;
  requestCorrelationFingerprint?: string;
  correlationFingerprint?: string;
  assetFingerprint?: string;
  objectLifecycleFingerprint?: string;
};

export type PriceGuideSourceCleanupBinding = Required<Omit<PriceGuideSourceCleanupProof, "requestCorrelationFingerprint">>
  & Pick<PriceGuideSourceCleanupProof, "requestCorrelationFingerprint">;

export type PriceGuideSourceHardPurgeReceipt = {
  hardPurged: true;
  alreadyPurged: boolean;
  requestCorrelationFingerprint?: string;
  correlationFingerprint: string;
  assetFingerprint: string;
  objectLifecycleFingerprint: string;
  objectResidueCount: 0;
  metadataResidueCount: 0;
  receiptFingerprint: string;
};

export type PriceGuideSourceCleanupLookup =
  | { status: "ok"; assets: PriceGuideSourceCleanupAsset[] }
  | { status: "unavailable" };

export type PriceGuideSourceCleanupDecision =
  | { kind: "already_deleted" }
  | { kind: "invalid" }
  | { kind: "unavailable"; status: 503; code: "MEDIA_CLEANUP_FAILED" };

const CLEANUP_PROOF_DOMAIN = "petmanager:price-guide-source-cleanup:v1";
const CLEANUP_PROOF_V2_DOMAIN = "petmanager:price-guide-source-cleanup:v2";
const CLEANUP_PROOF_V3_DOMAIN = "petmanager:price-guide-source-cleanup:v3";
const REQUEST_FINGERPRINT_DOMAIN = "petmanager:price-guide-photo-request:v1";
const CORRELATION_DOMAIN = "petmanager:price-guide-source-correlation:v1";
const ASSET_DOMAIN = "petmanager:price-guide-source-asset:v1";
const OBJECT_DOMAIN = "petmanager:price-guide-source-object:v1";
const RECEIPT_DOMAIN = "petmanager:price-guide-source-hard-purge-receipt:v1";
const RECEIPT_V2_DOMAIN = "petmanager:price-guide-source-hard-purge-receipt:v2";

function hmacFingerprint(secret: string, domain: string, ...values: string[]) {
  if (!secret) throw new Error("Price-guide cleanup proof secret is required.");
  return createHmac("sha256", secret).update([domain, ...values].join("\n")).digest("hex");
}

function equalHex(left: string | null | undefined, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left ?? "")) return false;
  return timingSafeEqual(Buffer.from(left as string, "hex"), Buffer.from(right, "hex"));
}

export function createPriceGuideRequestCorrelationFingerprintForServer(clientCorrelationId: string) {
  return createHash("sha256")
    .update(`${REQUEST_FINGERPRINT_DOMAIN}\n${clientCorrelationId}`)
    .digest("hex");
}

export function createPriceGuideSourceCorrelationBinding(input: {
  secret: string;
  shopId: string;
  mediaAssetId: string;
  clientCorrelationId: string;
  requestCorrelationFingerprint?: string;
  bucket: string;
  storagePath: string;
}): PriceGuideSourceCleanupBinding {
  const expectedRequestFingerprint = createPriceGuideRequestCorrelationFingerprintForServer(input.clientCorrelationId);
  if (
    input.requestCorrelationFingerprint
    && !equalHex(input.requestCorrelationFingerprint, expectedRequestFingerprint)
  ) {
    throw new Error("Price-guide request correlation fingerprint mismatch.");
  }
  const requestCorrelationFingerprint = input.requestCorrelationFingerprint
    ? expectedRequestFingerprint
    : undefined;
  const correlationFingerprint = hmacFingerprint(
    input.secret,
    CORRELATION_DOMAIN,
    input.shopId,
    input.clientCorrelationId,
  );
  const assetFingerprint = hmacFingerprint(input.secret, ASSET_DOMAIN, input.shopId, input.mediaAssetId);
  const objectLifecycleFingerprint = hmacFingerprint(
    input.secret,
    OBJECT_DOMAIN,
    input.shopId,
    input.bucket,
    input.storagePath,
  );
  const proof = hmacFingerprint(
    input.secret,
    requestCorrelationFingerprint ? CLEANUP_PROOF_V3_DOMAIN : CLEANUP_PROOF_V2_DOMAIN,
    input.shopId,
    input.mediaAssetId,
    ...(requestCorrelationFingerprint ? [requestCorrelationFingerprint] : []),
    correlationFingerprint,
    assetFingerprint,
    objectLifecycleFingerprint,
  );
  return {
    mediaAssetId: input.mediaAssetId,
    clientCorrelationId: input.clientCorrelationId,
    ...(requestCorrelationFingerprint ? { requestCorrelationFingerprint } : {}),
    proof,
    correlationFingerprint,
    assetFingerprint,
    objectLifecycleFingerprint,
  };
}

export function derivePriceGuideSourceMediaAssetId(input: {
  secret: string;
  shopId: string;
  clientCorrelationId: string;
}) {
  const hex = hmacFingerprint(input.secret, ASSET_DOMAIN, input.shopId, input.clientCorrelationId);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function createPriceGuideSourceCleanupProof(input: {
  secret: string;
  shopId: string;
  mediaAssetId: string;
  clientCorrelationId?: string;
  requestCorrelationFingerprint?: string;
  correlationFingerprint?: string;
  assetFingerprint?: string;
  objectLifecycleFingerprint?: string;
}) {
  if (input.clientCorrelationId && input.correlationFingerprint && input.assetFingerprint && input.objectLifecycleFingerprint) {
    return hmacFingerprint(
      input.secret,
      input.requestCorrelationFingerprint ? CLEANUP_PROOF_V3_DOMAIN : CLEANUP_PROOF_V2_DOMAIN,
      input.shopId,
      input.mediaAssetId,
      ...(input.requestCorrelationFingerprint ? [input.requestCorrelationFingerprint] : []),
      input.correlationFingerprint,
      input.assetFingerprint,
      input.objectLifecycleFingerprint,
    );
  }
  if (!input.secret) throw new Error("Price-guide cleanup proof secret is required.");
  return createHmac("sha256", input.secret)
    .update(`${CLEANUP_PROOF_DOMAIN}\n${input.shopId}\n${input.mediaAssetId}`)
    .digest("hex");
}

export function verifyPriceGuideSourceCleanupProof(input: {
  secret: string | null | undefined;
  shopId: string;
  mediaAssetId: string;
  proof: string | null | undefined;
  clientCorrelationId?: string | null;
  requestCorrelationFingerprint?: string | null;
  correlationFingerprint?: string | null;
  assetFingerprint?: string | null;
  objectLifecycleFingerprint?: string | null;
}) {
  if (!input.secret || !/^[a-f0-9]{64}$/i.test(input.proof ?? "")) return false;
  if (input.clientCorrelationId) {
    if (input.requestCorrelationFingerprint) {
      const expectedRequestFingerprint = createPriceGuideRequestCorrelationFingerprintForServer(input.clientCorrelationId);
      if (!equalHex(input.requestCorrelationFingerprint, expectedRequestFingerprint)) return false;
    }
    const correlationFingerprint = hmacFingerprint(
      input.secret,
      CORRELATION_DOMAIN,
      input.shopId,
      input.clientCorrelationId,
    );
    const assetFingerprint = hmacFingerprint(input.secret, ASSET_DOMAIN, input.shopId, input.mediaAssetId);
    if (!equalHex(input.correlationFingerprint, correlationFingerprint) || !equalHex(input.assetFingerprint, assetFingerprint)) {
      return false;
    }
    if (!/^[a-f0-9]{64}$/i.test(input.objectLifecycleFingerprint ?? "")) return false;
    const expectedV2 = createPriceGuideSourceCleanupProof({
      secret: input.secret,
      shopId: input.shopId,
      mediaAssetId: input.mediaAssetId,
      clientCorrelationId: input.clientCorrelationId,
      requestCorrelationFingerprint: input.requestCorrelationFingerprint ?? undefined,
      correlationFingerprint,
      assetFingerprint,
      objectLifecycleFingerprint: input.objectLifecycleFingerprint as string,
    });
    return equalHex(input.proof, expectedV2);
  }
  const expected = createPriceGuideSourceCleanupProof({
    secret: input.secret,
    shopId: input.shopId,
    mediaAssetId: input.mediaAssetId,
  });
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(input.proof as string, "hex"));
}

export function createPriceGuideSourceHardPurgeReceipt(input: {
  secret: string;
  binding: PriceGuideSourceCleanupBinding;
  alreadyPurged: boolean;
}): PriceGuideSourceHardPurgeReceipt {
  const receiptFingerprint = hmacFingerprint(
    input.secret,
    input.binding.requestCorrelationFingerprint ? RECEIPT_V2_DOMAIN : RECEIPT_DOMAIN,
    ...(input.binding.requestCorrelationFingerprint ? [input.binding.requestCorrelationFingerprint] : []),
    input.binding.correlationFingerprint,
    input.binding.assetFingerprint,
    input.binding.objectLifecycleFingerprint,
    "hardPurged:true",
    `alreadyPurged:${input.alreadyPurged}`,
    "objectResidueCount:0",
    "metadataResidueCount:0",
  );
  return {
    hardPurged: true,
    alreadyPurged: input.alreadyPurged,
    ...(input.binding.requestCorrelationFingerprint
      ? { requestCorrelationFingerprint: input.binding.requestCorrelationFingerprint }
      : {}),
    correlationFingerprint: input.binding.correlationFingerprint,
    assetFingerprint: input.binding.assetFingerprint,
    objectLifecycleFingerprint: input.binding.objectLifecycleFingerprint,
    objectResidueCount: 0,
    metadataResidueCount: 0,
    receiptFingerprint,
  };
}

export function decidePriceGuideSourceCleanupRecovery(
  mediaAssetIds: string[],
  lookup: PriceGuideSourceCleanupLookup,
  verification?: {
    shopId: string;
    secret: string | null | undefined;
    cleanupProofs: PriceGuideSourceCleanupProof[];
  },
): PriceGuideSourceCleanupDecision {
  if (lookup.status === "unavailable") {
    return { kind: "unavailable", status: 503, code: "MEDIA_CLEANUP_FAILED" };
  }

  const requestedIds = new Set(mediaAssetIds);
  const matchesExactly = requestedIds.size === mediaAssetIds.length
    && lookup.assets.length === requestedIds.size
    && lookup.assets.every((asset) => requestedIds.has(asset.id));
  const areSoftDeletedSources = lookup.assets.every((asset) =>
    asset.media_kind === "price_guide_source" && Boolean(asset.deleted_at),
  );

  const proofByMediaAssetId = new Map(
    (verification?.cleanupProofs ?? []).map((item) => [item.mediaAssetId, item.proof]),
  );
  const areHardDeletedSourcesWithProof = lookup.assets.length === 0
    && requestedIds.size === mediaAssetIds.length
    && Boolean(verification)
    && mediaAssetIds.every((mediaAssetId) => verifyPriceGuideSourceCleanupProof({
      secret: verification?.secret,
      shopId: verification?.shopId ?? "",
      mediaAssetId,
      proof: proofByMediaAssetId.get(mediaAssetId),
      clientCorrelationId: (verification?.cleanupProofs ?? []).find((item) => item.mediaAssetId === mediaAssetId)?.clientCorrelationId,
      requestCorrelationFingerprint: (verification?.cleanupProofs ?? []).find((item) => item.mediaAssetId === mediaAssetId)?.requestCorrelationFingerprint,
      correlationFingerprint: (verification?.cleanupProofs ?? []).find((item) => item.mediaAssetId === mediaAssetId)?.correlationFingerprint,
      assetFingerprint: (verification?.cleanupProofs ?? []).find((item) => item.mediaAssetId === mediaAssetId)?.assetFingerprint,
      objectLifecycleFingerprint: (verification?.cleanupProofs ?? []).find((item) => item.mediaAssetId === mediaAssetId)?.objectLifecycleFingerprint,
    }));

  return (matchesExactly && areSoftDeletedSources) || areHardDeletedSourcesWithProof
    ? { kind: "already_deleted" }
    : { kind: "invalid" };
}
