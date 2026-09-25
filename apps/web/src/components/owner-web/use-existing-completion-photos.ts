"use client";

import { useEffect, useState } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { getOwnerMediaSignedUrls } from "@/lib/media/owner-media-client";

export type ExistingCompletionPhoto = {
  mediaAssetId: string;
  signedUrl: string | null;
};

type CompletionMediaListResponse = {
  items: Array<{
    mediaAsset: {
      id: string;
    };
  }>;
};

type CompletionPhotoKind = "grooming_before" | "grooming_after";

async function loadCompletionPhoto(shopId: string, appointmentId: string, mediaKind: CompletionPhotoKind) {
  const query = new URLSearchParams({
    shopId,
    appointmentId,
    mediaKind,
    limit: "1",
    includeVariants: "false",
  });
  const response = await fetchApiJsonWithAuth<CompletionMediaListResponse>(
    `/api/owner/media/assets?${query.toString()}`,
    { cache: "no-store" },
  );
  const mediaAssetId = response.items[0]?.mediaAsset.id;
  if (!mediaAssetId) return null;

  const signedUrls = await getOwnerMediaSignedUrls(shopId, [mediaAssetId], "thumbnail");
  return { mediaAssetId, signedUrl: signedUrls[0]?.signedUrl ?? null } satisfies ExistingCompletionPhoto;
}

export function useExistingCompletionPhotos({
  shopId,
  appointmentId,
  enabled,
}: {
  shopId: string;
  appointmentId: string;
  enabled: boolean;
}) {
  const requestKey = enabled ? `${shopId}:${appointmentId}` : "";
  const [photoState, setPhotoState] = useState<{
    requestKey: string;
    beforePhoto: ExistingCompletionPhoto | null;
    afterPhoto: ExistingCompletionPhoto | null;
  }>({ requestKey: "", beforePhoto: null, afterPhoto: null });

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    void Promise.allSettled([
      loadCompletionPhoto(shopId, appointmentId, "grooming_before"),
      loadCompletionPhoto(shopId, appointmentId, "grooming_after"),
    ])
      .then(([beforeResult, afterResult]) => {
        if (!active) return;
        setPhotoState({
          requestKey: `${shopId}:${appointmentId}`,
          beforePhoto: beforeResult.status === "fulfilled" ? beforeResult.value : null,
          afterPhoto: afterResult.status === "fulfilled" ? afterResult.value : null,
        });
      });

    return () => {
      active = false;
    };
  }, [appointmentId, enabled, shopId]);

  return {
    beforePhoto: photoState.requestKey === requestKey ? photoState.beforePhoto : null,
    afterPhoto: photoState.requestKey === requestKey ? photoState.afterPhoto : null,
    loading: enabled && photoState.requestKey !== requestKey,
  };
}
