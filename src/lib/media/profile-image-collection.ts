export type ResolvedProfileImageUrl = {
  mediaAssetId: string;
  signedUrl: string;
};

export type RecoverableProfileMediaAsset = {
  id: string;
  original_file_name?: string | null;
  source_byte_size?: number | null;
  width?: number | null;
  height?: number | null;
};

function uniqueNonEmptyStrings(values: string[], maxCount: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, maxCount);
}

export function mergeProfileMediaAssetIds(currentIds: string[], addedIds: string[], maxCount: number) {
  return uniqueNonEmptyStrings([...currentIds, ...addedIds], maxCount);
}

function recoveryFingerprint(asset: RecoverableProfileMediaAsset) {
  const fileName = asset.original_file_name?.trim().toLocaleLowerCase() ?? "";
  const sourceByteSize = Number(asset.source_byte_size ?? 0);
  const width = Number(asset.width ?? 0);
  const height = Number(asset.height ?? 0);
  if (!fileName || sourceByteSize <= 0 || width <= 0 || height <= 0) return "";
  return `${fileName}|${sourceByteSize}|${width}x${height}`;
}

export function mergeRecoveredProfileMediaAssetIds(params: {
  currentIds: string[];
  recoveredAssets: RecoverableProfileMediaAsset[];
  maxCount: number;
}) {
  const currentIds = uniqueNonEmptyStrings(params.currentIds, params.maxCount);
  const recoveredById = new Map(params.recoveredAssets.map((asset) => [asset.id, asset]));
  const seenFingerprints = new Set(
    currentIds
      .map((mediaAssetId) => recoveredById.get(mediaAssetId))
      .filter((asset): asset is RecoverableProfileMediaAsset => Boolean(asset))
      .map(recoveryFingerprint)
      .filter(Boolean),
  );
  const nextIds = [...currentIds];

  for (const asset of params.recoveredAssets) {
    if (nextIds.includes(asset.id)) continue;
    const fingerprint = recoveryFingerprint(asset);
    if (fingerprint && seenFingerprints.has(fingerprint)) continue;
    nextIds.push(asset.id);
    if (fingerprint) seenFingerprints.add(fingerprint);
    if (nextIds.length >= params.maxCount) break;
  }

  return nextIds;
}

export function mergeResolvedProfileImageUrls(params: {
  currentImageUrls: string[];
  currentMediaAssetIds: string[];
  resolvedItems: ResolvedProfileImageUrl[];
  maxCount: number;
  preserveCurrentUrlsAsLegacy?: boolean;
}) {
  const currentImageUrls = uniqueNonEmptyStrings(params.currentImageUrls, params.maxCount);
  const currentMediaAssetIds = uniqueNonEmptyStrings(params.currentMediaAssetIds, params.maxCount);
  const resolvedByAssetId = new Map(
    params.resolvedItems
      .filter((item) => item.mediaAssetId.trim() && item.signedUrl.trim())
      .map((item) => [item.mediaAssetId.trim(), item.signedUrl.trim()]),
  );

  // Persisted legacy URLs do not have media asset IDs. When every current URL can
  // be paired with an ID, pair from the right; otherwise preserve the current URLs
  // as legacy entries until the full canonical ID list has been resolved.
  const canPairCurrentUrls =
    !params.preserveCurrentUrlsAsLegacy &&
    currentMediaAssetIds.length > 0 &&
    currentImageUrls.length >= currentMediaAssetIds.length;
  const legacyImageCount = canPairCurrentUrls
    ? currentImageUrls.length - currentMediaAssetIds.length
    : currentImageUrls.length;
  const legacyImageUrls = currentImageUrls.slice(0, legacyImageCount);
  const currentUrlByAssetId = new Map<string, string>();

  if (canPairCurrentUrls) {
    currentMediaAssetIds.forEach((mediaAssetId, index) => {
      const currentUrl = currentImageUrls[legacyImageCount + index];
      if (currentUrl) currentUrlByAssetId.set(mediaAssetId, currentUrl);
    });
  }

  const resolvedAssetUrls = currentMediaAssetIds
    .map((mediaAssetId) => resolvedByAssetId.get(mediaAssetId) ?? currentUrlByAssetId.get(mediaAssetId) ?? "")
    .filter(Boolean);

  return {
    imageUrls: uniqueNonEmptyStrings([...legacyImageUrls, ...resolvedAssetUrls], params.maxCount),
    mediaAssetIds: currentMediaAssetIds,
  };
}
