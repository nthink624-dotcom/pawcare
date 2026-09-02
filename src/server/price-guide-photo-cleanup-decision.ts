import { createHmac, timingSafeEqual } from "node:crypto";

export type PriceGuideSourceCleanupAsset = {
  id: string;
  media_kind: string;
  deleted_at: string | null;
};

export type PriceGuideSourceCleanupProof = {
  mediaAssetId: string;
  proof: string;
};

export type PriceGuideSourceCleanupLookup =
  | { status: "ok"; assets: PriceGuideSourceCleanupAsset[] }
  | { status: "unavailable" };

export type PriceGuideSourceCleanupDecision =
  | { kind: "already_deleted" }
  | { kind: "invalid" }
  | { kind: "unavailable"; status: 503; code: "MEDIA_CLEANUP_FAILED" };

const CLEANUP_PROOF_DOMAIN = "petmanager:price-guide-source-cleanup:v1";

export function createPriceGuideSourceCleanupProof(input: {
  secret: string;
  shopId: string;
  mediaAssetId: string;
}) {
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
}) {
  if (!input.secret || !/^[a-f0-9]{64}$/i.test(input.proof ?? "")) return false;
  const expected = createPriceGuideSourceCleanupProof({
    secret: input.secret,
    shopId: input.shopId,
    mediaAssetId: input.mediaAssetId,
  });
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(input.proof as string, "hex"));
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
    }));

  return (matchesExactly && areSoftDeletedSources) || areHardDeletedSourcesWithProof
    ? { kind: "already_deleted" }
    : { kind: "invalid" };
}
