export type StaffAvatarCandidate = {
  key: string;
  url: string;
};

export function buildStaffAvatarCandidates({
  identity,
  imageUrl,
  imageUrls,
  imageAssetId,
  imageAssetIds,
}: {
  identity: string;
  imageUrl?: string | null;
  imageUrls?: Array<string | null | undefined> | null;
  imageAssetId?: string | null;
  imageAssetIds?: Array<string | null | undefined> | null;
}): StaffAvatarCandidate[] {
  const rawCandidates = [
    { url: imageUrl, assetId: imageAssetId ?? imageAssetIds?.[0] },
    ...(imageUrls ?? []).map((url, index) => ({ url, assetId: imageAssetIds?.[index] })),
  ];
  const seenUrls = new Set<string>();

  return rawCandidates.flatMap(({ url, assetId }) => {
    const normalizedUrl = url?.trim() ?? "";
    if (!normalizedUrl || seenUrls.has(normalizedUrl)) return [];
    seenUrls.add(normalizedUrl);

    return [{
      key: `${identity}:${assetId?.trim() || "url"}:${normalizedUrl}`,
      url: normalizedUrl,
    }];
  });
}

export async function findFirstUsableStaffAvatarCandidate(
  candidates: StaffAvatarCandidate[],
  probe: (candidate: StaffAvatarCandidate) => Promise<boolean>,
  failedCandidates = new Set<string>(),
) {
  for (const candidate of candidates) {
    if (failedCandidates.has(candidate.key)) continue;
    if (await probe(candidate)) return candidate;
    failedCandidates.add(candidate.key);
  }

  return null;
}
