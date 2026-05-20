import {
  PETMANAGER_MEDIA_BUCKET,
  PETMANAGER_MEDIA_VARIANT_PROFILES,
} from "@/lib/media/media-policy";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError } from "@/server/owner-api-auth";
import type { MediaAsset, MediaVariant, MediaVariantKey } from "@/types/domain";

type OwnerContext = {
  shopId: string;
  userId: string | null;
};

type CreateVariantUploadIntentInput = {
  mediaAssetId: string;
  variantKey: MediaVariantKey | string;
  contentType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
};

type CompleteVariantUploadInput = CreateVariantUploadIntentInput & {
  storagePath?: string | null;
};

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const variantKeys = new Set<MediaVariantKey>(["thumbnail", "preview", "optimized", "provider_ready"]);

function getAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerApiError("Supabase media connection is unavailable.", 503);
  }
  return admin;
}

function requiredUuid(value: string | null | undefined, label: string) {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new OwnerApiError(`${label} is invalid.`, 400);
  }
  return value;
}

function normalizeVariantKey(value: string | null | undefined) {
  if (!variantKeys.has(value as MediaVariantKey)) {
    throw new OwnerApiError("variantKey is invalid.", 400);
  }
  return value as MediaVariantKey;
}

function normalizeContentType(value: string) {
  const contentType = value.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!allowedContentTypes.has(contentType)) {
    throw new OwnerApiError("Variant images must be JPEG, PNG, or WebP.", 400);
  }
  return contentType;
}

function extensionForContentType(contentType: string) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  throw new OwnerApiError("Variant image content type is invalid.", 400);
}

function positiveInt(value: number | null | undefined, label: string) {
  if (!Number.isInteger(value) || !value || value <= 0) {
    throw new OwnerApiError(`${label} must be a positive integer.`, 400);
  }
  return value;
}

function nonNegativeInt(value: number | null | undefined, label: string) {
  if (!Number.isInteger(value) || value === null || value === undefined || value < 0) {
    throw new OwnerApiError(`${label} must be a non-negative integer.`, 400);
  }
  return value;
}

async function getMediaAsset(owner: OwnerContext, mediaAssetId: string) {
  const admin = getAdmin();
  const result = await admin
    .from("media_assets")
    .select("*")
    .eq("id", mediaAssetId)
    .eq("shop_id", owner.shopId)
    .is("deleted_at", null)
    .maybeSingle();

  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  if (!result.data) {
    throw new OwnerApiError("Media asset was not found.", 404);
  }

  return result.data as MediaAsset;
}

function getYearMonthFromAsset(mediaAsset: MediaAsset) {
  const createdAt = new Date(mediaAsset.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    const now = new Date();
    return {
      year: now.getUTCFullYear(),
      month: String(now.getUTCMonth() + 1).padStart(2, "0"),
    };
  }

  return {
    year: createdAt.getUTCFullYear(),
    month: String(createdAt.getUTCMonth() + 1).padStart(2, "0"),
  };
}

function buildVariantStoragePath(params: {
  mediaAsset: MediaAsset;
  variantKey: MediaVariantKey;
  contentType: string;
}) {
  const { year, month } = getYearMonthFromAsset(params.mediaAsset);
  const ext = extensionForContentType(params.contentType);
  return `shops/${params.mediaAsset.shop_id}/media/${year}/${month}/${params.mediaAsset.id}/${params.variantKey}.${ext}`;
}

function validateVariantByteSize(params: {
  variantKey: MediaVariantKey;
  byteSize: number;
}) {
  const profile = PETMANAGER_MEDIA_VARIANT_PROFILES[params.variantKey];
  if (params.byteSize > profile.maxBytes) {
    throw new OwnerApiError(`${params.variantKey} image is too large. Compress it before upload.`, 413);
  }
}

export async function createOwnerMediaVariantUploadIntent(
  owner: OwnerContext,
  input: CreateVariantUploadIntentInput,
) {
  const admin = getAdmin();
  const mediaAssetId = requiredUuid(input.mediaAssetId, "mediaAssetId");
  const variantKey = normalizeVariantKey(input.variantKey);
  const contentType = normalizeContentType(input.contentType);
  const byteSize = nonNegativeInt(input.byteSize, "byteSize");
  const width = positiveInt(input.width, "width");
  const height = positiveInt(input.height, "height");
  validateVariantByteSize({ variantKey, byteSize });

  const mediaAsset = await getMediaAsset(owner, mediaAssetId);
  const storagePath = buildVariantStoragePath({ mediaAsset, variantKey, contentType });
  const signedUpload = await admin.storage.from(PETMANAGER_MEDIA_BUCKET).createSignedUploadUrl(storagePath);

  if (signedUpload.error || !signedUpload.data) {
    throw new OwnerApiError(signedUpload.error?.message ?? "Could not create variant upload URL.", 500);
  }

  return {
    mediaAsset,
    variant: {
      variantKey,
      bucket: PETMANAGER_MEDIA_BUCKET,
      path: storagePath,
      contentType,
      byteSize,
      width,
      height,
      profile: PETMANAGER_MEDIA_VARIANT_PROFILES[variantKey],
    },
    upload: {
      bucket: PETMANAGER_MEDIA_BUCKET,
      path: storagePath,
      signedUrl: signedUpload.data.signedUrl,
      token: signedUpload.data.token,
      maxBytes: PETMANAGER_MEDIA_VARIANT_PROFILES[variantKey].maxBytes,
      expiresInSeconds: 2 * 60 * 60,
    },
  };
}

export async function completeOwnerMediaVariantUpload(
  owner: OwnerContext,
  input: CompleteVariantUploadInput,
) {
  const admin = getAdmin();
  const mediaAssetId = requiredUuid(input.mediaAssetId, "mediaAssetId");
  const variantKey = normalizeVariantKey(input.variantKey);
  const contentType = normalizeContentType(input.contentType);
  const byteSize = nonNegativeInt(input.byteSize, "byteSize");
  const width = positiveInt(input.width, "width");
  const height = positiveInt(input.height, "height");
  validateVariantByteSize({ variantKey, byteSize });

  const mediaAsset = await getMediaAsset(owner, mediaAssetId);
  const storagePath =
    input.storagePath?.trim() || buildVariantStoragePath({ mediaAsset, variantKey, contentType });
  const result = await admin
    .from("media_variants")
    .upsert(
      {
        media_asset_id: mediaAssetId,
        variant_key: variantKey,
        bucket: PETMANAGER_MEDIA_BUCKET,
        storage_path: storagePath,
        content_type: contentType,
        byte_size: byteSize,
        width,
        height,
      },
      { onConflict: "media_asset_id,variant_key" },
    )
    .select("*")
    .single();

  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  return {
    mediaAsset,
    variant: result.data as MediaVariant,
  };
}

export function getOwnerMediaVariantPolicy() {
  return {
    bucket: PETMANAGER_MEDIA_BUCKET,
    profiles: PETMANAGER_MEDIA_VARIANT_PROFILES,
    variantKeys: [...variantKeys],
  };
}
