"use client";

import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  compressImageBundleForPetmanager,
  compressImageForPetmanager,
  compressImageVariantsForPetmanager,
  type PetmanagerImageCompressionOptions,
  type PetmanagerCompressedImage,
  type PetmanagerCompressedImageVariant,
} from "@/lib/media/client-image-compression";
import {
  bindPriceGuideUploadCleanup,
  buildPriceGuideHardPurgeRequest,
  createAnonymousPriceGuideUploadCorrelation,
  createPriceGuidePhotoSupportCode,
  createPriceGuideRequestCorrelationFingerprint,
  getOrCreatePriceGuideCleanupRequest,
  validatePriceGuideHardPurgeReceipt,
  type PriceGuideUploadCleanupBinding,
  type PriceGuideUploadHardPurgeReceipt,
} from "@/lib/media/price-guide-upload-correlation";
import {
  PriceGuidePhotoLifecycleError,
  reportPriceGuidePhotoLifecycle,
  type PriceGuidePhotoFailureClass,
} from "@/lib/media/price-guide-photo-lifecycle";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MediaAsset, MediaKind, MediaVariant } from "@/types/domain";

export type OwnerMediaContext = {
  shopId: string;
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  groomingRecordId?: string | null;
  staffId?: string | null;
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
  cleanupProof?: string | null;
  cleanupBinding?: {
    requestCorrelationFingerprint?: string | null;
    correlationFingerprint: string;
    assetFingerprint: string;
    objectLifecycleFingerprint: string;
  } | null;
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

export type OwnerMediaSignedUrlItem = {
  mediaAssetId: string;
  signedUrl: string;
};

type SignedUrlsResponse = {
  items: OwnerMediaSignedUrlItem[];
};

export type OwnerMediaUploadResult = {
  mediaAsset: MediaAsset;
  variant: MediaVariant | null;
  metrics: OwnerMediaUploadMetrics;
  priceGuideCleanup: PriceGuideUploadCleanupBinding | null;
  priceGuideLifecycle: {
    requestCorrelationFingerprint: string;
    supportCode: string;
    startedAtMs: number;
  } | null;
};

export type OwnerMediaUploadMetrics = {
  sourceByteSize: number;
  uploadedByteSize: number;
  compressionMs: number;
  transferMs: number;
  totalMs: number;
};

type OwnerMediaUploadOptions = {
  createProviderReadyVariant?: boolean;
  providerReadyMode?: "wait" | "background" | "skip";
  compressionOptions?: PetmanagerImageCompressionOptions;
};

const SIGNED_URL_CACHE_TTL_MS = 8 * 60 * 1000;
const signedUrlCache = new Map<string, { signedUrl: string; expiresAt: number }>();
const signedUrlRequests = new Map<string, Promise<SignedUrlsResponse>>();
const priceGuideCleanupRequests = new Map<string, Promise<PriceGuideUploadHardPurgeReceipt>>();

function signedUrlCacheKey(shopId: string, mediaAssetId: string, variant: string) {
  return `${shopId}:${variant}:${mediaAssetId}`;
}

async function requestOwnerMediaSignedUrls(
  shopId: string,
  mediaAssetIds: string[],
  variant: "original" | "thumbnail" | "preview" | "optimized" | "provider_ready",
) {
  const requestKey = `${shopId}:${variant}:${[...mediaAssetIds].sort().join(",")}`;
  const existingRequest = signedUrlRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const runRequest = () => fetchApiJsonWithAuth<SignedUrlsResponse>("/api/owner/media/signed-urls", {
    method: "POST",
    body: JSON.stringify({ shopId, mediaAssetIds, variant }),
  });
  const request = (async () => {
    try {
      return await runRequest();
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      return runRequest();
    }
  })().finally(() => {
    signedUrlRequests.delete(requestKey);
  });

  signedUrlRequests.set(requestKey, request);
  return request;
}

export async function getOwnerMediaSignedUrls(
  shopId: string,
  mediaAssetIds: string[],
  variant: "original" | "thumbnail" | "preview" | "optimized" | "provider_ready" = "original",
) {
  const ids = [...new Set(mediaAssetIds.map((item) => item.trim()).filter(Boolean))];
  const now = Date.now();
  const missingIds = ids.filter((mediaAssetId) => {
    const cached = signedUrlCache.get(signedUrlCacheKey(shopId, mediaAssetId, variant));
    return !cached || cached.expiresAt <= now;
  });

  if (missingIds.length > 0) {
    const result = await requestOwnerMediaSignedUrls(shopId, missingIds, variant);
    const expiresAt = Date.now() + SIGNED_URL_CACHE_TTL_MS;
    for (const item of result.items) {
      signedUrlCache.set(signedUrlCacheKey(shopId, item.mediaAssetId, variant), {
        signedUrl: item.signedUrl,
        expiresAt,
      });
    }
  }

  return ids.flatMap((mediaAssetId) => {
    const cached = signedUrlCache.get(signedUrlCacheKey(shopId, mediaAssetId, variant));
    return cached && cached.expiresAt > Date.now()
      ? [{ mediaAssetId, signedUrl: cached.signedUrl }]
      : [];
  });
}

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
      credentials: "omit",
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

async function createUploadIntent(
  context: OwnerMediaContext,
  mediaKind: MediaKind,
  compressed: PetmanagerCompressedImage,
  clientCorrelationId: string | null,
  requestCorrelationFingerprint: string | null,
) {
  return fetchApiJsonWithAuth<UploadIntentResponse>("/api/owner/media/upload-intents", {
    method: "POST",
    credentials: "omit",
    body: JSON.stringify({
      shopId: context.shopId,
      originalFileName: compressed.file.name,
      contentType: compressed.file.type,
      byteSize: compressed.file.size,
      sourceByteSize: compressed.sourceByteSize,
      width: compressed.width,
      height: compressed.height,
      mediaKind,
      visibility: mediaKind === "shop_profile" || mediaKind === "staff_profile"
        ? "public"
        : mediaKind === "price_guide_source" || mediaKind === "feedback_screenshot"
          ? "private"
          : "customer_shared",
      retentionPolicy: mediaKind === "price_guide_source"
        ? "archive"
        : mediaKind === "feedback_screenshot"
          ? "transient"
          : "standard",
      uploadedFrom: "owner_web",
      guardianId: context.guardianId ?? null,
      petId: context.petId ?? null,
      appointmentId: context.appointmentId ?? null,
      groomingRecordId: context.groomingRecordId ?? null,
      clientCorrelationId,
      requestCorrelationFingerprint,
      metadata: context.staffId ? { staffId: context.staffId } : null,
    }),
  });
}

async function completeUpload(context: OwnerMediaContext, mediaAssetId: string, compressed: PetmanagerCompressedImage) {
  return fetchApiJsonWithAuth<CompleteUploadResponse>("/api/owner/media/complete", {
    method: "POST",
    credentials: "omit",
    body: JSON.stringify({
      shopId: context.shopId,
      mediaAssetId,
      byteSize: compressed.file.size,
      width: compressed.width,
      height: compressed.height,
    }),
  });
}

export function cleanupOwnerPriceGuideSourceUpload(
  context: OwnerMediaContext,
  binding: PriceGuideUploadCleanupBinding,
) {
  return getOrCreatePriceGuideCleanupRequest(
    priceGuideCleanupRequests,
    binding.correlationFingerprint,
    async () => {
      const startedAt = performance.now();
      reportPriceGuidePhotoLifecycle({
        requestCorrelationFingerprint: binding.requestCorrelationFingerprint,
        stage: "cleanup",
        status: "started",
        elapsedMs: 0,
        counts: { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 0, cleanupCount: 1 },
      });
      try {
        const result = await fetchApiJsonWithAuth<{
          hardPurged: true;
          cleanupReceipt?: PriceGuideUploadHardPurgeReceipt | null;
        }>("/api/owner/price-guide-photo-import", {
          method: "DELETE",
          credentials: "omit",
          body: JSON.stringify({
            shopId: context.shopId,
            ...buildPriceGuideHardPurgeRequest(binding),
          }),
        });
        const receipt = validatePriceGuideHardPurgeReceipt(binding, result.cleanupReceipt);
        reportPriceGuidePhotoLifecycle({
          requestCorrelationFingerprint: binding.requestCorrelationFingerprint,
          stage: "cleanup",
          status: "succeeded",
          elapsedMs: performance.now() - startedAt,
          counts: { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 0, cleanupCount: 1 },
          receipt,
        });
        return receipt;
      } catch {
        reportPriceGuidePhotoLifecycle({
          requestCorrelationFingerprint: binding.requestCorrelationFingerprint,
          stage: "cleanup",
          status: "failed",
          elapsedMs: performance.now() - startedAt,
          counts: { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 0, cleanupCount: 1 },
          failureClass: "cleanup",
        });
        throw new PriceGuidePhotoLifecycleError(binding.requestCorrelationFingerprint, "cleanup");
      }
    },
  );
}

export function rememberOwnerPriceGuideHardPurgeReceipt(
  binding: PriceGuideUploadCleanupBinding,
  receipt: PriceGuideUploadHardPurgeReceipt | null | undefined,
) {
  const verified = validatePriceGuideHardPurgeReceipt(binding, receipt);
  priceGuideCleanupRequests.set(binding.correlationFingerprint, Promise.resolve(verified));
  reportPriceGuidePhotoLifecycle({
    requestCorrelationFingerprint: binding.requestCorrelationFingerprint,
    stage: "cleanup",
    status: "succeeded",
    elapsedMs: 0,
    counts: { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 1, cleanupCount: 1 },
    receipt: verified,
  });
  return verified;
}

async function createProviderReadyVariant(
  context: OwnerMediaContext,
  mediaAssetId: string,
  variant: PetmanagerCompressedImageVariant,
) {
  const intent = await fetchApiJsonWithAuth<VariantUploadIntentResponse>("/api/owner/media/variants/upload-intents", {
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
  });

  await uploadCompressedFile({
    bucket: intent.upload.bucket,
    path: intent.upload.path,
    signedUrl: intent.upload.signedUrl,
    token: intent.upload.token,
    method: intent.upload.method,
    headers: intent.upload.headers,
    file: variant.file,
  });

  const result = await fetchApiJsonWithAuth<VariantCompleteResponse>("/api/owner/media/variants/complete", {
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
  });

  return result.variant;
}

export async function createOwnerMediaAssetFromFile(
  context: OwnerMediaContext,
  mediaKind: MediaKind,
  file: File,
  options: OwnerMediaUploadOptions = {},
): Promise<OwnerMediaUploadResult> {
  const startedAt = performance.now();
  const clientCorrelationId = mediaKind === "price_guide_source"
    ? createAnonymousPriceGuideUploadCorrelation()
    : null;
  const requestCorrelationFingerprint = clientCorrelationId
    ? await createPriceGuideRequestCorrelationFingerprint(clientCorrelationId)
    : null;
  const priceGuideLifecycle = requestCorrelationFingerprint
    ? {
        requestCorrelationFingerprint,
        supportCode: createPriceGuidePhotoSupportCode(requestCorrelationFingerprint),
        startedAtMs: startedAt,
      }
    : null;
  let activeStage: "prepare" | "upload_intent" | "upload" = "prepare";
  let uploadIntentCount: 0 | 1 = 0;
  let uploadCount: 0 | 1 = 0;
  const providerReadyMode = options.createProviderReadyVariant === false
    ? "skip"
    : options.providerReadyMode ?? "wait";
  let priceGuideCleanup: PriceGuideUploadCleanupBinding | null = null;
  if (requestCorrelationFingerprint) {
    reportPriceGuidePhotoLifecycle({
      requestCorrelationFingerprint,
      stage: "prepare",
      status: "started",
      elapsedMs: 0,
      counts: { uploadIntentCount, uploadCount, providerRequestCount: 0, cleanupCount: 0 },
    });
  }
  try {
    const bundle = providerReadyMode === "wait"
      ? await compressImageBundleForPetmanager(file, ["provider_ready"])
      : { original: await compressImageForPetmanager(file, options.compressionOptions), variants: [] };
    const compressed = bundle.original;
    const providerReadyVariant = bundle.variants[0] ?? null;
    const compressionCompletedAt = performance.now();
    if (requestCorrelationFingerprint) {
      reportPriceGuidePhotoLifecycle({
        requestCorrelationFingerprint,
        stage: "prepare",
        status: "succeeded",
        elapsedMs: compressionCompletedAt - startedAt,
        counts: { uploadIntentCount, uploadCount, providerRequestCount: 0, cleanupCount: 0 },
      });
      activeStage = "upload_intent";
      uploadIntentCount = 1;
      reportPriceGuidePhotoLifecycle({
        requestCorrelationFingerprint,
        stage: "upload_intent",
        status: "started",
        elapsedMs: compressionCompletedAt - startedAt,
        counts: { uploadIntentCount, uploadCount, providerRequestCount: 0, cleanupCount: 0 },
      });
    }
    const intent = await createUploadIntent(
      context,
      mediaKind,
      compressed,
      clientCorrelationId,
      requestCorrelationFingerprint,
    );
    priceGuideCleanup = clientCorrelationId && requestCorrelationFingerprint
      ? bindPriceGuideUploadCleanup({
          clientCorrelationId,
          requestCorrelationFingerprint,
          mediaAssetId: intent.mediaAsset.id,
          cleanupProof: intent.cleanupProof,
          cleanupBinding: intent.cleanupBinding,
        })
      : null;
    if (requestCorrelationFingerprint) {
      reportPriceGuidePhotoLifecycle({
        requestCorrelationFingerprint,
        stage: "upload_intent",
        status: "succeeded",
        elapsedMs: performance.now() - startedAt,
        counts: { uploadIntentCount, uploadCount, providerRequestCount: 0, cleanupCount: 0 },
      });
      activeStage = "upload";
      uploadCount = 1;
      reportPriceGuidePhotoLifecycle({
        requestCorrelationFingerprint,
        stage: "upload",
        status: "started",
        elapsedMs: performance.now() - startedAt,
        counts: { uploadIntentCount, uploadCount, providerRequestCount: 0, cleanupCount: 0 },
      });
    }
    const originalUpload = (async () => {
      await uploadCompressedFile({
        bucket: intent.upload.bucket,
        path: intent.upload.path,
        signedUrl: intent.upload.signedUrl,
        token: intent.upload.token,
        method: intent.upload.method,
        headers: intent.upload.headers,
        file: compressed.file,
      });
      return completeUpload(context, intent.mediaAsset.id, compressed);
    })();
    const providerReadyUpload = providerReadyVariant
    ? createProviderReadyVariant(context, intent.mediaAsset.id, providerReadyVariant)
    : providerReadyMode === "background"
      ? compressImageVariantsForPetmanager(compressed.file, ["provider_ready"])
          .then(([backgroundVariant]) => (
            backgroundVariant
              ? createProviderReadyVariant(context, intent.mediaAsset.id, backgroundVariant)
              : null
          ))
      : Promise.resolve(null);

    let completed: CompleteUploadResponse;
    let variant: MediaVariant | null = null;
    if (providerReadyMode === "wait") {
      [completed, variant] = await Promise.all([originalUpload, providerReadyUpload]);
    } else {
      completed = await originalUpload;
      if (providerReadyMode === "background") {
        void providerReadyUpload.catch(() => {
          // Delivery falls back to the optimized original when a background variant fails.
        });
      }
    }

    const completedAt = performance.now();
    if (requestCorrelationFingerprint) {
      reportPriceGuidePhotoLifecycle({
        requestCorrelationFingerprint,
        stage: "upload",
        status: "succeeded",
        elapsedMs: completedAt - startedAt,
        counts: { uploadIntentCount, uploadCount, providerRequestCount: 0, cleanupCount: 0 },
      });
    }

    return {
      mediaAsset: completed.mediaAsset,
      variant,
      priceGuideCleanup,
      priceGuideLifecycle,
      metrics: {
        sourceByteSize: file.size,
        uploadedByteSize: compressed.file.size,
        compressionMs: Math.round(compressionCompletedAt - startedAt),
        transferMs: Math.round(completedAt - compressionCompletedAt),
        totalMs: Math.round(completedAt - startedAt),
      },
    };
  } catch (error) {
    if (!requestCorrelationFingerprint) throw error;
    const aborted = error instanceof Error && error.name === "AbortError";
    let failureClass: PriceGuidePhotoFailureClass = aborted
      ? "aborted"
      : activeStage === "upload_intent"
        ? "upload_intent"
        : activeStage === "upload"
          ? "upload"
          : "unexpected";
    reportPriceGuidePhotoLifecycle({
      requestCorrelationFingerprint,
      stage: activeStage,
      status: aborted ? "aborted" : "failed",
      elapsedMs: performance.now() - startedAt,
      counts: { uploadIntentCount, uploadCount, providerRequestCount: 0, cleanupCount: 0 },
      failureClass,
    });
    if (priceGuideCleanup) {
      try {
        await cleanupOwnerPriceGuideSourceUpload(context, priceGuideCleanup);
      } catch {
        failureClass = "cleanup";
      }
    }
    throw new PriceGuidePhotoLifecycleError(requestCorrelationFingerprint, failureClass);
  }
}

export async function getOwnerMediaSignedUrl(
  shopId: string,
  mediaAssetId: string,
  variant: "original" | "thumbnail" | "preview" | "optimized" | "provider_ready" = "original",
) {
  const [result] = await getOwnerMediaSignedUrls(shopId, [mediaAssetId], variant);
  if (!result) {
    throw new Error("사진을 불러오지 못했습니다.");
  }
  return result.signedUrl;
}

export async function createOwnerShopProfileMediaAssetFromFile(
  context: OwnerMediaContext,
  file: File,
) {
  return createOwnerMediaAssetFromFile(context, "shop_profile", file, {
    createProviderReadyVariant: false,
    compressionOptions: {
      maxLongEdge: 1280,
      quality: 0.64,
      targetBytes: 180 * 1024,
      maxBytes: 700 * 1024,
    },
  });
}

export async function createOwnerShopProfileImageFromFile(
  context: OwnerMediaContext,
  file: File,
) {
  const uploaded = await createOwnerShopProfileMediaAssetFromFile(context, file);
  const signedUrl = await getOwnerMediaSignedUrl(context.shopId, uploaded.mediaAsset.id, uploaded.variant ? "provider_ready" : "original");

  return {
    ...uploaded,
    signedUrl,
  };
}

export async function createOwnerStaffProfileImageFromFile(
  context: OwnerMediaContext,
  file: File,
) {
  const uploaded = await createOwnerMediaAssetFromFile(context, "staff_profile", file, {
    createProviderReadyVariant: false,
  });
  const signedUrl = await getOwnerMediaSignedUrl(context.shopId, uploaded.mediaAsset.id, uploaded.variant ? "provider_ready" : "original");

  return {
    ...uploaded,
    signedUrl,
  };
}
