"use client";

import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  compressImageForPetmanagerFromSession,
  compressImageVariantsForPetmanagerFromSession,
  createPetmanagerImageCompressionSession,
  type PetmanagerCompressedImage,
  type PetmanagerCompressedImageVariant,
} from "@/lib/media/client-image-compression";
import { traceOwnerMediaStep } from "@/lib/media/owner-media-timing";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MediaAsset, MediaKind, MediaVariant } from "@/types/domain";

export type OwnerMediaContext = {
  shopId: string;
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  groomingRecordId?: string | null;
  metadata?: Record<string, string | boolean | number | null>;
};

export type MediaAssetListItem = {
  mediaAsset: MediaAsset;
  variants: MediaVariant[];
};

export type MediaAssetListResponse = {
  items: MediaAssetListItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextBeforeCreatedAt: string | null;
  };
};

type UploadIntentResponse = {
  mediaAsset: MediaAsset;
  upload: {
    bucket: string;
    path: string;
    provider?: "supabase" | "r2";
    signedUrl?: string;
    token?: string | null;
    method?: string;
    headers?: Record<string, string>;
    maxBytes: number;
  };
};

type CompleteUploadResponse = {
  mediaAsset: MediaAsset;
};

type VariantUploadIntentResponse = {
  upload: {
    bucket: string;
    path: string;
    provider?: "supabase" | "r2";
    signedUrl?: string;
    token?: string | null;
    method?: string;
    headers?: Record<string, string>;
    maxBytes: number;
  };
};

type VariantCompleteResponse = {
  variant: MediaVariant;
};

type SignedUrlResponse = {
  signedUrl: string;
};

type SignedUrlsResponse = {
  items: Array<{ mediaAssetId?: string; signedUrl?: string }>;
};

type OwnerMediaSignedUrlVariant = "original" | "thumbnail" | "preview" | "optimized" | "provider_ready";

export type OwnerMediaSignedUrlItem = {
  mediaAssetId: string;
  signedUrl: string | null;
};

export type OwnerMediaSignedUrlRecovery = {
  enqueue: (mediaAssetId: string, failedSignedUrl: string) => void;
  dispose: () => void;
};

type OwnerMediaSignedUrlRecoveryOptions = {
  resolveBatch: (
    mediaAssetIds: readonly string[],
    signal?: AbortSignal,
  ) => Promise<readonly OwnerMediaSignedUrlItem[]>;
  onResolved: (items: readonly { mediaAssetId: string; signedUrl: string }[]) => void;
  onExhausted?: (mediaAssetIds: readonly string[]) => void;
  signal?: AbortSignal;
  maxAttempts?: number;
  batchWindowMs?: number;
  retryDelayMs?: number;
};

export type OwnerMediaUploadResult = {
  mediaAsset: MediaAsset;
  variant: MediaVariant | null;
  providerReady: Promise<MediaVariant | null> | null;
};

async function uploadCompressedFile(params: {
  bucket: string;
  path: string;
  signedUrl?: string;
  token?: string | null;
  method?: string;
  headers?: Record<string, string>;
  file: File;
}) {
  if (params.method === "PUT" && params.signedUrl) {
    const response = await fetch(params.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": params.file.type,
        ...(params.headers ?? {}),
      },
      body: params.file,
    });

    if (!response.ok) {
      throw new Error(`사진 업로드에 실패했습니다. (${response.status})`);
    }
    return;
  }

  if (!params.token) {
    throw new Error("사진 업로드 토큰을 확인할 수 없습니다.");
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase 연결을 확인할 수 없습니다.");
  }

  const result = await supabase.storage
    .from(params.bucket)
    .uploadToSignedUrl(params.path, params.token, params.file, {
      contentType: params.file.type,
      upsert: false,
    });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function createUploadIntent(context: OwnerMediaContext, mediaKind: MediaKind, compressed: PetmanagerCompressedImage) {
  return fetchApiJsonWithAuth<UploadIntentResponse>("/api/owner/media/upload-intents", {
    method: "POST",
    body: JSON.stringify({
      shopId: context.shopId,
      originalFileName: compressed.file.name,
      contentType: compressed.file.type,
      byteSize: compressed.file.size,
      sourceByteSize: compressed.sourceByteSize,
      width: compressed.width,
      height: compressed.height,
      mediaKind,
      visibility: mediaKind === "shop_profile" ? "public" : "customer_shared",
      retentionPolicy: "standard",
      uploadedFrom: "owner_web",
      guardianId: context.guardianId ?? null,
      petId: context.petId ?? null,
      appointmentId: context.appointmentId ?? null,
      groomingRecordId: context.groomingRecordId ?? null,
      metadata: context.metadata ?? {},
    }),
  });
}

async function completeUpload(context: OwnerMediaContext, mediaAssetId: string, compressed: PetmanagerCompressedImage) {
  return fetchApiJsonWithAuth<CompleteUploadResponse>("/api/owner/media/complete", {
    method: "POST",
    body: JSON.stringify({
      shopId: context.shopId,
      mediaAssetId,
      byteSize: compressed.file.size,
      width: compressed.width,
      height: compressed.height,
    }),
  });
}

async function createProviderReadyVariant(
  context: OwnerMediaContext,
  mediaAssetId: string,
  compressedVariant: Promise<PetmanagerCompressedImageVariant | null>,
) {
  const variant = await compressedVariant;
  if (!variant) return null;

  const intent = await traceOwnerMediaStep(
    "create-provider-ready-intent",
    () => fetchApiJsonWithAuth<VariantUploadIntentResponse>("/api/owner/media/variants/upload-intents", {
      method: "POST",
      body: JSON.stringify({
        shopId: context.shopId,
        mediaAssetId,
        variantKey: variant.variantKey,
        contentType: variant.file.type,
        byteSize: variant.file.size,
        width: variant.width,
        height: variant.height,
      }),
    }),
  );

  await traceOwnerMediaStep("upload-provider-ready", () => uploadCompressedFile({
    bucket: intent.upload.bucket,
    path: intent.upload.path,
    signedUrl: intent.upload.signedUrl,
    token: intent.upload.token,
    method: intent.upload.method,
    headers: intent.upload.headers,
    file: variant.file,
  }));

  const result = await traceOwnerMediaStep(
    "complete-provider-ready",
    () => fetchApiJsonWithAuth<VariantCompleteResponse>("/api/owner/media/variants/complete", {
      method: "POST",
      body: JSON.stringify({
        shopId: context.shopId,
        mediaAssetId,
        variantKey: variant.variantKey,
        contentType: variant.file.type,
        byteSize: variant.file.size,
        width: variant.width,
        height: variant.height,
      }),
    }),
  );

  return result.variant;
}

export async function createOwnerMediaAssetFromFile(
  context: OwnerMediaContext,
  mediaKind: MediaKind,
  file: File,
  options?: { createProviderReadyVariant?: boolean; waitForProviderReadyVariant?: boolean },
): Promise<OwnerMediaUploadResult> {
  const { session, compressed } = await traceOwnerMediaStep("compress-original", async () => {
    const session = await createPetmanagerImageCompressionSession(file);
    const compressed = await compressImageForPetmanagerFromSession(session);
    return { session, compressed };
  });
  const providerReadyCompression = options?.createProviderReadyVariant === false
    ? null
    : traceOwnerMediaStep("compress-provider-ready", async () => {
        const [variant] = await compressImageVariantsForPetmanagerFromSession(session, ["provider_ready"]);
        return variant ?? null;
      }).catch(() => null);
  const intent = await traceOwnerMediaStep("create-upload-intent", () => createUploadIntent(context, mediaKind, compressed));

  await traceOwnerMediaStep("upload-original", () => uploadCompressedFile({
    bucket: intent.upload.bucket,
    path: intent.upload.path,
    signedUrl: intent.upload.signedUrl,
    token: intent.upload.token,
    method: intent.upload.method,
    headers: intent.upload.headers,
    file: compressed.file,
  }));

  const completed = await traceOwnerMediaStep(
    "complete-upload-readback",
    () => completeUpload(context, intent.mediaAsset.id, compressed),
  );
  let variant: MediaVariant | null = null;
  let providerReady: Promise<MediaVariant | null> | null = null;
  if (providerReadyCompression) {
    const task = createProviderReadyVariant(context, intent.mediaAsset.id, providerReadyCompression).catch(() => null);
    if (options?.waitForProviderReadyVariant === false) providerReady = task;
    else variant = await task;
  }

  return {
    mediaAsset: completed.mediaAsset,
    variant,
    providerReady,
  };
}

export async function getOwnerMediaSignedUrl(
  shopId: string,
  mediaAssetId: string,
  variant: "original" | "thumbnail" | "preview" | "optimized" | "provider_ready" = "original",
) {
  const requestSignedUrl = async (requestedVariant: typeof variant) => {
    const query = new URLSearchParams({ shopId, mediaAssetId });
    if (requestedVariant !== "original") query.set("variant", requestedVariant);
    const result = await fetchApiJsonWithAuth<SignedUrlResponse>(`/api/owner/media/signed-url?${query.toString()}`);
    return result.signedUrl;
  };
  try {
    return await requestSignedUrl(variant);
  } catch (error) {
    if (variant === "original") throw error;
    return requestSignedUrl("original");
  }
}

async function requestOwnerMediaSignedUrls(
  shopId: string,
  mediaAssetIds: readonly string[],
  variant: OwnerMediaSignedUrlVariant,
  options?: { signal?: AbortSignal },
) {
  if (!mediaAssetIds.length) return [];
  const result = await fetchApiJsonWithAuth<SignedUrlsResponse>("/api/owner/media/signed-urls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options?.signal,
    body: JSON.stringify({
      shopId,
      items: mediaAssetIds.map((mediaAssetId) => ({ mediaAssetId, variant })),
    }),
  });
  const requestedIds = new Set(mediaAssetIds);
  return result.items.flatMap((item) =>
    item.mediaAssetId && item.signedUrl && requestedIds.has(item.mediaAssetId)
      ? [{ mediaAssetId: item.mediaAssetId, signedUrl: item.signedUrl }]
      : [],
  );
}

export async function getOwnerMediaSignedUrlsWithOriginalFallback(
  shopId: string,
  mediaAssetIds: readonly string[],
  variant: "thumbnail" | "preview" | "optimized" | "provider_ready" = "provider_ready",
  options?: { signal?: AbortSignal },
) {
  const uniqueIds = [...new Set(mediaAssetIds.filter(Boolean))];
  let preferred: Array<{ mediaAssetId: string; signedUrl: string }> = [];
  try {
    preferred = options?.signal
      ? await requestOwnerMediaSignedUrls(shopId, uniqueIds, variant, options)
      : await requestOwnerMediaSignedUrls(shopId, uniqueIds, variant);
  } catch (error) {
    if (options?.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    // Missing derivative URLs are resolved in one original batch below.
  }
  const signedUrlByAssetId = new Map(preferred.map((item) => [item.mediaAssetId, item.signedUrl]));
  const missingIds = uniqueIds.filter((mediaAssetId) => !signedUrlByAssetId.has(mediaAssetId));
  try {
    const originals = options?.signal
      ? await requestOwnerMediaSignedUrls(shopId, missingIds, "original", options)
      : await requestOwnerMediaSignedUrls(shopId, missingIds, "original");
    for (const item of originals) signedUrlByAssetId.set(item.mediaAssetId, item.signedUrl);
  } catch (error) {
    if (options?.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    // Callers merge null entries with their last known durable preview.
  }
  return uniqueIds.map((mediaAssetId) => ({
    mediaAssetId,
    signedUrl: signedUrlByAssetId.get(mediaAssetId) ?? null,
  }));
}

export function createOwnerMediaSignedUrlRecovery({
  resolveBatch,
  onResolved,
  onExhausted,
  signal,
  maxAttempts = 2,
  batchWindowMs = 0,
  retryDelayMs = 250,
}: OwnerMediaSignedUrlRecoveryOptions): OwnerMediaSignedUrlRecovery {
  const attemptsByAssetId = new Map<string, number>();
  const failedUrlByAssetId = new Map<string, string>();
  const pendingAssetIds = new Set<string>();
  const inFlightAssetIds = new Set<string>();
  const exhaustedAssetIds = new Set<string>();
  const attemptLimit = Math.max(1, Math.floor(maxAttempts));
  const batchDelay = Math.max(0, batchWindowMs);
  const retryDelay = Math.max(0, retryDelayMs);
  let disposed = signal?.aborted ?? false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function isStopped() {
    return disposed || signal?.aborted === true;
  }

  function notifyExhausted(mediaAssetIds: readonly string[]) {
    const newlyExhausted = mediaAssetIds.filter((mediaAssetId) => {
      if (exhaustedAssetIds.has(mediaAssetId)) return false;
      exhaustedAssetIds.add(mediaAssetId);
      return true;
    });
    if (newlyExhausted.length > 0) onExhausted?.(newlyExhausted);
  }

  function schedule(delayMs: number) {
    if (isStopped() || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delayMs);
  }

  function queueRetry(mediaAssetIds: readonly string[]) {
    const exhausted: string[] = [];
    let queued = false;
    for (const mediaAssetId of mediaAssetIds) {
      if ((attemptsByAssetId.get(mediaAssetId) ?? 0) >= attemptLimit) {
        exhausted.push(mediaAssetId);
        continue;
      }
      pendingAssetIds.add(mediaAssetId);
      queued = true;
    }
    notifyExhausted(exhausted);
    if (queued) schedule(retryDelay);
  }

  async function flush() {
    if (isStopped() || inFlight) return;
    const mediaAssetIds = [...pendingAssetIds].filter(
      (mediaAssetId) => (attemptsByAssetId.get(mediaAssetId) ?? 0) < attemptLimit,
    );
    for (const mediaAssetId of mediaAssetIds) pendingAssetIds.delete(mediaAssetId);
    if (mediaAssetIds.length === 0) return;

    inFlight = true;
    for (const mediaAssetId of mediaAssetIds) {
      inFlightAssetIds.add(mediaAssetId);
      attemptsByAssetId.set(mediaAssetId, (attemptsByAssetId.get(mediaAssetId) ?? 0) + 1);
    }

    try {
      const resolved = await resolveBatch(mediaAssetIds, signal);
      if (isStopped()) return;
      const requestedIds = new Set(mediaAssetIds);
      const signedUrlByAssetId = new Map(
        resolved.flatMap((item) =>
          requestedIds.has(item.mediaAssetId) && item.signedUrl
            ? [[item.mediaAssetId, item.signedUrl] as const]
            : [],
        ),
      );
      const refreshed = mediaAssetIds.flatMap((mediaAssetId) => {
        const signedUrl = signedUrlByAssetId.get(mediaAssetId);
        return signedUrl && signedUrl !== failedUrlByAssetId.get(mediaAssetId)
          ? [{ mediaAssetId, signedUrl }]
          : [];
      });
      if (refreshed.length > 0) onResolved(refreshed);
      const refreshedIds = new Set(refreshed.map((item) => item.mediaAssetId));
      queueRetry(mediaAssetIds.filter((mediaAssetId) => !refreshedIds.has(mediaAssetId)));
    } catch (error) {
      if (!isStopped() && !(error instanceof Error && error.name === "AbortError")) {
        queueRetry(mediaAssetIds);
      }
    } finally {
      for (const mediaAssetId of mediaAssetIds) inFlightAssetIds.delete(mediaAssetId);
      inFlight = false;
      if (!isStopped() && pendingAssetIds.size > 0 && timer === null) schedule(batchDelay);
    }
  }

  function enqueue(mediaAssetId: string, failedSignedUrl: string) {
    if (isStopped() || !mediaAssetId || !failedSignedUrl) return;
    if (failedUrlByAssetId.get(mediaAssetId) === failedSignedUrl) return;
    failedUrlByAssetId.set(mediaAssetId, failedSignedUrl);
    if (pendingAssetIds.has(mediaAssetId) || inFlightAssetIds.has(mediaAssetId)) return;
    if ((attemptsByAssetId.get(mediaAssetId) ?? 0) >= attemptLimit) {
      notifyExhausted([mediaAssetId]);
      return;
    }
    pendingAssetIds.add(mediaAssetId);
    schedule(batchDelay);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pendingAssetIds.clear();
    signal?.removeEventListener("abort", dispose);
  }

  if (!disposed) signal?.addEventListener("abort", dispose, { once: true });

  return { enqueue, dispose };
}

export async function createOwnerShopProfileImageFromFile(
  context: OwnerMediaContext,
  file: File,
) {
  const uploaded = await createOwnerMediaAssetFromFile(context, "shop_profile", file);
  const signedUrl = await getOwnerMediaSignedUrl(context.shopId, uploaded.mediaAsset.id, uploaded.variant ? "provider_ready" : "original");

  return {
    ...uploaded,
    signedUrl,
  };
}
