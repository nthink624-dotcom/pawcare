import { randomUUID } from "node:crypto";

import {
  PETMANAGER_MEDIA_BUCKET,
  PETMANAGER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES,
  PETMANAGER_MEDIA_SIGNED_READ_SECONDS,
  PETMANAGER_MEDIA_VARIANT_PROFILES,
} from "@/lib/media/media-policy";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { OwnerApiError } from "@/server/owner-api-auth";
import type {
  MediaAsset,
  MediaKind,
  MediaRetentionPolicy,
  MediaVariant,
  MediaVariantKey,
  MediaVisibility,
} from "@/types/domain";

type MediaContext = {
  shopId: string;
  userId: string | null;
};

function assertSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);
  return supabase;
}

function cleanSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "bin";
}

function buildMediaPath(params: {
  shopId: string;
  mediaAssetId: string;
  contentType: string;
  originalFileName?: string | null;
  variantKey?: MediaVariantKey;
}) {
  const date = new Date();
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const fileBase = cleanSegment(params.originalFileName || params.mediaAssetId).replace(/\.[^.]+$/, "");
  const ext = extensionFromContentType(params.contentType);
  const variant = params.variantKey ? `/variants/${params.variantKey}` : "";
  return `${params.shopId}/${yyyy}/${mm}/${params.mediaAssetId}${variant}/${fileBase}.${ext}`;
}

function mediaAssetSelect() {
  return "*";
}

function mediaVariantSelect() {
  return "*";
}

export async function createMediaUploadIntent(
  context: MediaContext,
  input: {
    originalFileName?: string | null;
    contentType: string;
    byteSize: number;
    sourceByteSize?: number | null;
    width?: number | null;
    height?: number | null;
    mediaKind: MediaKind;
    visibility?: MediaVisibility;
    retentionPolicy?: MediaRetentionPolicy;
    uploadedFrom?: string;
    guardianId?: string | null;
    petId?: string | null;
    appointmentId?: string | null;
    groomingRecordId?: string | null;
    metadata?: Record<string, string | boolean | number | null>;
  },
) {
  if (!input.contentType.startsWith("image/")) {
    throw new OwnerApiError("이미지 파일만 업로드할 수 있습니다.", 400);
  }
  if (input.byteSize > PETMANAGER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES) {
    throw new OwnerApiError("업로드 파일 용량이 너무 큽니다.", 400);
  }

  const supabase = assertSupabase();
  const mediaAssetId = randomUUID();
  const now = nowIso();
  const storagePath = buildMediaPath({
    shopId: context.shopId,
    mediaAssetId,
    contentType: input.contentType,
    originalFileName: input.originalFileName,
  });
  const mediaAsset: MediaAsset = {
    id: mediaAssetId,
    shop_id: context.shopId,
    guardian_id: input.guardianId ?? null,
    pet_id: input.petId ?? null,
    appointment_id: input.appointmentId ?? null,
    grooming_record_id: input.groomingRecordId ?? null,
    bucket: PETMANAGER_MEDIA_BUCKET,
    storage_path: storagePath,
    original_file_name: input.originalFileName ?? null,
    content_type: input.contentType,
    byte_size: input.byteSize,
    source_byte_size: input.sourceByteSize ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    checksum_sha256: null,
    media_kind: input.mediaKind,
    visibility: input.visibility ?? "customer_shared",
    status: "uploading",
    retention_policy: input.retentionPolicy ?? "standard",
    uploaded_by_user_id: context.userId,
    uploaded_from: input.uploadedFrom === "owner_mobile" ? "owner_mobile" : "owner_web",
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
    expires_at: null,
    deleted_at: null,
  };

  const insert = await supabase.from("media_assets").insert(mediaAsset).select(mediaAssetSelect()).single();
  if (insert.error) throw new OwnerApiError(insert.error.message, 500);

  const signed = await supabase.storage.from(PETMANAGER_MEDIA_BUCKET).createSignedUploadUrl(storagePath);
  if (signed.error) throw new OwnerApiError(signed.error.message, 500);

  return {
    mediaAsset: insert.data as unknown as MediaAsset,
    upload: {
      bucket: PETMANAGER_MEDIA_BUCKET,
      path: storagePath,
      token: signed.data.token,
      signedUrl: signed.data.signedUrl,
      method: "PUT",
      headers: {},
      maxBytes: PETMANAGER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES,
      provider: "supabase" as const,
    },
  };
}

export async function completeMediaUpload(
  context: MediaContext,
  input: { mediaAssetId: string; byteSize: number; width?: number | null; height?: number | null },
) {
  const supabase = assertSupabase();
  const result = await supabase
    .from("media_assets")
    .update({
      byte_size: input.byteSize,
      width: input.width ?? null,
      height: input.height ?? null,
      status: "ready",
      updated_at: nowIso(),
    })
    .eq("shop_id", context.shopId)
    .eq("id", input.mediaAssetId)
    .select(mediaAssetSelect())
    .single();

  if (result.error) throw new OwnerApiError(result.error.message, 500);
  return { mediaAsset: result.data as unknown as MediaAsset };
}

export async function createMediaVariantUploadIntent(
  context: MediaContext,
  input: {
    mediaAssetId: string;
    variantKey: MediaVariantKey;
    contentType: string;
    byteSize: number;
    width?: number | null;
    height?: number | null;
  },
) {
  const profile = PETMANAGER_MEDIA_VARIANT_PROFILES[input.variantKey];
  if (!profile) throw new OwnerApiError("지원하지 않는 이미지 변형입니다.", 400);
  if (input.byteSize > profile.maxBytes) throw new OwnerApiError("이미지 변형 파일 용량이 너무 큽니다.", 400);

  const supabase = assertSupabase();
  const asset = await supabase
    .from("media_assets")
    .select("id,shop_id,original_file_name")
    .eq("shop_id", context.shopId)
    .eq("id", input.mediaAssetId)
    .single();
  if (asset.error) throw new OwnerApiError(asset.error.message, 404);

  const path = buildMediaPath({
    shopId: context.shopId,
    mediaAssetId: input.mediaAssetId,
    contentType: input.contentType,
    originalFileName: asset.data.original_file_name,
    variantKey: input.variantKey,
  });

  const signed = await supabase.storage.from(PETMANAGER_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (signed.error) throw new OwnerApiError(signed.error.message, 500);

  return {
    upload: {
      bucket: PETMANAGER_MEDIA_BUCKET,
      path,
      token: signed.data.token,
      signedUrl: signed.data.signedUrl,
      method: "PUT",
      headers: {},
      maxBytes: profile.maxBytes,
      provider: "supabase" as const,
    },
  };
}

export async function completeMediaVariantUpload(
  context: MediaContext,
  input: {
    mediaAssetId: string;
    variantKey: MediaVariantKey;
    contentType: string;
    byteSize: number;
    width?: number | null;
    height?: number | null;
  },
) {
  const supabase = assertSupabase();
  const asset = await supabase
    .from("media_assets")
    .select("id,shop_id,original_file_name")
    .eq("shop_id", context.shopId)
    .eq("id", input.mediaAssetId)
    .single();
  if (asset.error) throw new OwnerApiError(asset.error.message, 404);

  const path = buildMediaPath({
    shopId: context.shopId,
    mediaAssetId: input.mediaAssetId,
    contentType: input.contentType,
    originalFileName: asset.data.original_file_name,
    variantKey: input.variantKey,
  });
  const now = nowIso();
  const row = {
    id: randomUUID(),
    media_asset_id: input.mediaAssetId,
    variant_key: input.variantKey,
    bucket: PETMANAGER_MEDIA_BUCKET,
    storage_path: path,
    content_type: input.contentType,
    byte_size: input.byteSize,
    width: input.width ?? null,
    height: input.height ?? null,
    created_at: now,
  };

  await supabase
    .from("media_variants")
    .delete()
    .eq("media_asset_id", input.mediaAssetId)
    .eq("variant_key", input.variantKey);

  const result = await supabase.from("media_variants").insert(row).select(mediaVariantSelect()).single();
  if (result.error) throw new OwnerApiError(result.error.message, 500);
  return { variant: result.data as unknown as MediaVariant };
}

export async function listMediaAssets(
  context: MediaContext,
  params: {
    appointmentId?: string | null;
    guardianId?: string | null;
    petId?: string | null;
    includeVariants?: boolean;
    limit?: number;
  },
) {
  const supabase = assertSupabase();
  let query = supabase
    .from("media_assets")
    .select(mediaAssetSelect())
    .eq("shop_id", context.shopId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(params.limit ?? 20, 50)));

  if (params.appointmentId) query = query.eq("appointment_id", params.appointmentId);
  if (params.guardianId) query = query.eq("guardian_id", params.guardianId);
  if (params.petId) query = query.eq("pet_id", params.petId);

  const result = await query;
  if (result.error) throw new OwnerApiError(result.error.message, 500);
  const assets = (result.data ?? []) as unknown as MediaAsset[];
  let variantsByAssetId = new Map<string, MediaVariant[]>();

  if (params.includeVariants && assets.length > 0) {
    const variantResult = await supabase
      .from("media_variants")
      .select(mediaVariantSelect())
      .in("media_asset_id", assets.map((asset) => asset.id));
    if (variantResult.error) throw new OwnerApiError(variantResult.error.message, 500);
    variantsByAssetId = ((variantResult.data ?? []) as unknown as MediaVariant[]).reduce((map, variant) => {
      map.set(variant.media_asset_id, [...(map.get(variant.media_asset_id) ?? []), variant]);
      return map;
    }, new Map<string, MediaVariant[]>());
  }

  return {
    items: assets.map((mediaAsset) => ({
      mediaAsset,
      variants: variantsByAssetId.get(mediaAsset.id) ?? [],
    })),
    page: {
      limit: Math.max(1, Math.min(params.limit ?? 20, 50)),
      hasMore: false,
      nextBeforeCreatedAt: null,
    },
  };
}

export async function getMediaSignedUrl(
  context: MediaContext,
  input: { mediaAssetId: string; variant?: MediaVariantKey | "original" | null },
) {
  const supabase = assertSupabase();
  const variantKey = input.variant && input.variant !== "original" ? input.variant : null;
  let bucket = PETMANAGER_MEDIA_BUCKET;
  let path = "";

  if (variantKey) {
    const variant = await supabase
      .from("media_variants")
      .select("*, media_assets!inner(shop_id)")
      .eq("media_asset_id", input.mediaAssetId)
      .eq("variant_key", variantKey)
      .eq("media_assets.shop_id", context.shopId)
      .single();
    if (variant.error) throw new OwnerApiError(variant.error.message, 404);
    bucket = variant.data.bucket;
    path = variant.data.storage_path;
  } else {
    const asset = await supabase
      .from("media_assets")
      .select("bucket,storage_path")
      .eq("shop_id", context.shopId)
      .eq("id", input.mediaAssetId)
      .single();
    if (asset.error) throw new OwnerApiError(asset.error.message, 404);
    bucket = asset.data.bucket;
    path = asset.data.storage_path;
  }

  const signed = await supabase.storage.from(bucket).createSignedUrl(path, PETMANAGER_MEDIA_SIGNED_READ_SECONDS);
  if (signed.error) throw new OwnerApiError(signed.error.message, 500);
  return {
    signedUrl: signed.data.signedUrl,
    expiresInSeconds: PETMANAGER_MEDIA_SIGNED_READ_SECONDS,
  };
}
