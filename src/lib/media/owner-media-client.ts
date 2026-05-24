"use client";

import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  compressImageForPetmanager,
  compressImageVariantsForPetmanager,
  type PetmanagerCompressedImage,
} from "@/lib/media/client-image-compression";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MediaAsset, MediaKind, MediaVariant } from "@/types/domain";

export type OwnerMediaContext = {
  shopId: string;
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  groomingRecordId?: string | null;
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
      visibility: "customer_shared",
      retentionPolicy: "standard",
      uploadedFrom: "owner_web",
      guardianId: context.guardianId ?? null,
      petId: context.petId ?? null,
      appointmentId: context.appointmentId ?? null,
      groomingRecordId: context.groomingRecordId ?? null,
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
): Promise<OwnerMediaUploadResult> {
  const compressed = await compressImageForPetmanager(file);
  const intent = await createUploadIntent(context, mediaKind, compressed);

  await uploadCompressedFile({
    bucket: intent.upload.bucket,
    path: intent.upload.path,
    signedUrl: intent.upload.signedUrl,
    token: intent.upload.token,
    method: intent.upload.method,
    headers: intent.upload.headers,
    file: compressed.file,
  });

  const completed = await completeUpload(context, intent.mediaAsset.id, compressed);
  const variant = await createProviderReadyVariant(context, intent.mediaAsset.id, file);

  return {
    mediaAsset: completed.mediaAsset,
    variant,
  };
}
