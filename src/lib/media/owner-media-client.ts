"use client";

import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  compressImageForPetmanager,
  compressImageVariantsForPetmanager,
  type PetmanagerCompressedImage,
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

export type OwnerMediaUploadResult = {
  mediaAsset: MediaAsset;
  variant: MediaVariant | null;
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

async function createProviderReadyVariant(context: OwnerMediaContext, mediaAssetId: string, sourceFile: File) {
  const [variant] = await compressImageVariantsForPetmanager(sourceFile, ["provider_ready"]);
  if (!variant) return null;

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
  options?: { createProviderReadyVariant?: boolean; waitForProviderReadyVariant?: boolean },
): Promise<OwnerMediaUploadResult> {
  const compressed = await traceOwnerMediaStep("compress-original", () => compressImageForPetmanager(file));
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

  const completed = await traceOwnerMediaStep("complete-upload-readback", () => completeUpload(context, intent.mediaAsset.id, compressed));
  let variant: MediaVariant | null = null;
  if (options?.createProviderReadyVariant !== false) {
    const createVariant = () => traceOwnerMediaStep(
      "create-provider-ready-variant",
      () => createProviderReadyVariant(context, intent.mediaAsset.id, file),
    );
    if (options?.waitForProviderReadyVariant === false) {
      void createVariant().catch(() => {
        // The original asset is authoritative; a failed AI-ready derivative
        // must not roll back a confirmed upload or delay a status commit.
      });
    } else {
      variant = await createVariant();
    }
  }

  return {
    mediaAsset: completed.mediaAsset,
    variant,
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
