import { randomUUID } from "node:crypto";

import {
  PETMANAGER_MEDIA_BUCKET,
  PETMANAGER_MEDIA_DEFAULT_MONTHLY_SOFT_LIMIT_BYTES,
  PETMANAGER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES,
  PETMANAGER_MEDIA_NOTICE_COPY,
  PETMANAGER_MEDIA_SIGNED_READ_SECONDS,
  PETMANAGER_MEDIA_TARGET_BEFORE_AFTER_SET_BYTES,
  PETMANAGER_MEDIA_TARGET_IMAGE_BYTES,
  PETMANAGER_MEDIA_TRANSIENT_RETENTION_DAYS,
  type PetmanagerMediaLimitPolicy,
  PETMANAGER_DEFAULT_MEDIA_LIMIT_POLICY,
  evaluatePetmanagerMediaUploadLimit,
  getPetmanagerMediaUsageStatus,
} from "@/lib/media/media-policy";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  createMediaSignedReadUrl,
  createMediaSignedUploadUrl,
  getMediaStorageInfo,
  removeMediaStorageObjects,
} from "@/server/media-storage";
import { buildMediaStorageDirectory } from "@/server/media-storage-paths";
import { OwnerApiError } from "@/server/owner-api-auth";
import type {
  ChannelType,
  MediaAsset,
  MediaKind,
  MediaRetentionPolicy,
  MediaSendAttempt,
  MediaUploadSource,
  MediaVariant,
  MediaVariantKey,
  MediaVisibility,
  Notification,
  NotificationMediaAttachment,
  NotificationMediaAttachmentRole,
} from "@/types/domain";

export const MEDIA_BUCKET = PETMANAGER_MEDIA_BUCKET;
export const OWNER_MEDIA_SIGNED_READ_SECONDS = PETMANAGER_MEDIA_SIGNED_READ_SECONDS;
export const OWNER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES = PETMANAGER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES;
export const OWNER_MEDIA_TARGET_IMAGE_BYTES = PETMANAGER_MEDIA_TARGET_IMAGE_BYTES;
export const OWNER_MEDIA_TARGET_BEFORE_AFTER_SET_BYTES = PETMANAGER_MEDIA_TARGET_BEFORE_AFTER_SET_BYTES;
export const OWNER_MEDIA_TRANSIENT_RETENTION_DAYS = PETMANAGER_MEDIA_TRANSIENT_RETENTION_DAYS;
export const OWNER_MEDIA_DEFAULT_MONTHLY_SOFT_LIMIT_BYTES = PETMANAGER_MEDIA_DEFAULT_MONTHLY_SOFT_LIMIT_BYTES;

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const mediaKinds = new Set<MediaKind>([
  "grooming_before",
  "grooming_after",
  "grooming_result",
  "message_image",
  "shop_profile",
  "staff_profile",
  "customer_shared",
  "memo_attachment",
]);

function shouldRetryMediaAssetQueryWithoutDeletedAt(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "PGRST204" || message.includes("deleted_at") || message.includes("schema cache");
}
const visibilityValues = new Set<MediaVisibility>(["private", "customer_shared", "public"]);
const retentionValues = new Set<MediaRetentionPolicy>(["transient", "standard", "archive"]);
const uploadSources = new Set<MediaUploadSource>(["owner_web", "owner_mobile", "customer_page", "system"]);
const variantKeys = new Set<MediaVariantKey>(["thumbnail", "preview", "optimized", "provider_ready"]);
const attachmentRoles = new Set<NotificationMediaAttachmentRole>([
  "message_image",
  "before_photo",
  "after_photo",
  "result_photo",
  "receipt",
  "other",
]);
const transientKinds = new Set<MediaKind>(["grooming_before", "grooming_after", "message_image", "customer_shared"]);

type OwnerContext = {
  shopId: string;
  userId: string | null;
};

type PrimitiveMetadataValue = string | boolean | number | null;

type CreateUploadIntentInput = {
  originalFileName?: string | null;
  contentType: string;
  byteSize: number;
  sourceByteSize?: number | null;
  width?: number | null;
  height?: number | null;
  checksumSha256?: string | null;
  mediaKind?: MediaKind | string | null;
  visibility?: MediaVisibility | string | null;
  retentionPolicy?: MediaRetentionPolicy | string | null;
  uploadedFrom?: MediaUploadSource | string | null;
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  groomingRecordId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type CompleteUploadInput = {
  mediaAssetId: string;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
  checksumSha256?: string | null;
};

type MediaUsageInput = {
  month?: string | null;
};

type ShopMediaLimitRow = {
  shop_id: string;
  monthly_soft_limit_bytes: number;
  monthly_hard_limit_bytes: number | null;
  transient_retention_days: number;
  allow_original_archive: boolean;
  enforcement_mode: "off" | "warn" | "block";
};

type CleanupExpiredMediaInput = {
  dryRun?: boolean;
  limit?: number | null;
  now?: string | null;
};

type CleanupExpiredMediaItem = {
  mediaAsset: MediaAsset;
  variants: MediaVariant[];
  storageObjects: Array<{
    bucket: string;
    path: string;
  }>;
};

type RecentSentMediaInput = {
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  limit?: number | null;
};

type PublicMediaSignedUrlsInput = {
  shopId: string;
  mediaAssetIds: string[];
  variantKey?: MediaVariantKey | "original" | null;
};

type PhotoSendRequestInput = {
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  limit?: number | null;
};

type AttachMediaToNotificationInput = {
  notificationId: string;
  channel?: ChannelType | string | null;
  media: Array<{
    mediaAssetId: string;
    attachmentRole?: NotificationMediaAttachmentRole | string | null;
    sortOrder?: number | null;
  }>;
};

type RecordMediaSendAttemptInput = {
  notificationId?: string | null;
  notificationMediaAttachmentId?: string | null;
  mediaAssetId: string;
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  channel: ChannelType | string;
  provider?: string | null;
  providerMessageId?: string | null;
  providerMediaId?: string | null;
  recipientPhone?: string | null;
  status: "queued" | "sent" | "failed" | "skipped";
  failReason?: string | null;
  sentAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

function getAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerApiError("Supabase media connection is unavailable.", 503);
  }
  return admin;
}

function normalizeContentType(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

function extensionForContentType(contentType: string) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  throw new OwnerApiError("Only compressed JPEG, PNG, or WebP images can be uploaded.", 400);
}

function optionalUuid(value: string | null | undefined, label: string) {
  if (!value) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new OwnerApiError(`${label} is invalid.`, 400);
  }
  return value;
}

function normalizeUuidList(values: string[], label: string, limit: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .slice(0, limit)
    .map((value) => requiredUuid(value, label));
}

function requiredUuid(value: string | null | undefined, label: string) {
  const normalized = optionalUuid(value, label);
  if (!normalized) {
    throw new OwnerApiError(`${label} is required.`, 400);
  }
  return normalized;
}

function normalizeAttachmentRole(value: string | null | undefined) {
  return attachmentRoles.has(value as NotificationMediaAttachmentRole)
    ? (value as NotificationMediaAttachmentRole)
    : "message_image";
}

function normalizeSortOrder(value: number | null | undefined, fallback: number) {
  if (value === null || value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new OwnerApiError("sortOrder must be a non-negative integer.", 400);
  }
  return value;
}

function optionalPositiveInt(value: number | null | undefined, label: string) {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw new OwnerApiError(`${label} must be a positive integer.`, 400);
  }
  return value;
}

function optionalByteSize(value: number | null | undefined, label: string) {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new OwnerApiError(`${label} must be a non-negative integer.`, 400);
  }
  return value;
}

function normalizeMetadata(value: Record<string, unknown> | null | undefined) {
  if (!value || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item === null || ["string", "boolean", "number"].includes(typeof item))
      .map(([key, item]) => [key, item as PrimitiveMetadataValue]),
  );
}

function defaultRetentionForKind(mediaKind: MediaKind): MediaRetentionPolicy {
  return transientKinds.has(mediaKind) ? "transient" : "standard";
}

function getExpiresAt(retentionPolicy: MediaRetentionPolicy, retentionDays = OWNER_MEDIA_TRANSIENT_RETENTION_DAYS) {
  if (retentionPolicy !== "transient") return null;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);
  return expiresAt.toISOString();
}

function getUsageMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function buildStoragePath(params: {
  shopId: string;
  mediaAssetId: string;
  mediaKind: MediaKind;
  contentType: string;
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  staffId?: string | null;
}) {
  const ext = extensionForContentType(params.contentType);
  const directory = buildMediaStorageDirectory(params);
  return `${directory}/original.${ext}`;
}

async function recordMonthlyMediaUsage(params: {
  shopId: string;
  uploadedAssetCount?: number;
  uploadedBytes?: number;
  sentAssetCount?: number;
  sentBytes?: number;
}) {
  const admin = getAdmin();
  const usageMonth = getUsageMonth();
  const uploadedAssetCount = params.uploadedAssetCount ?? 0;
  const uploadedBytes = params.uploadedBytes ?? 0;
  const sentAssetCount = params.sentAssetCount ?? 0;
  const sentBytes = params.sentBytes ?? 0;

  const result = await admin.rpc("increment_shop_media_usage", {
    p_shop_id: params.shopId,
    p_usage_month: usageMonth,
    p_uploaded_asset_count: uploadedAssetCount,
    p_uploaded_bytes: uploadedBytes,
    p_sent_asset_count: sentAssetCount,
    p_sent_bytes: sentBytes,
  });

  if (!result.error) return;

  await admin.from("shop_media_usage_months").upsert(
    {
      shop_id: params.shopId,
      usage_month: usageMonth,
      uploaded_asset_count: uploadedAssetCount,
      uploaded_bytes: uploadedBytes,
      sent_asset_count: sentAssetCount,
      sent_bytes: sentBytes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shop_id,usage_month", ignoreDuplicates: true },
  );
}

async function getNotificationForMediaAttachment(params: {
  shopId: string;
  notificationId: string;
}) {
  const admin = getAdmin();
  const result = await admin
    .from("notifications")
    .select("id, shop_id, guardian_id, pet_id, appointment_id, channel, provider, recipient_phone")
    .eq("id", params.notificationId)
    .eq("shop_id", params.shopId)
    .maybeSingle();

  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  if (!result.data) {
    throw new OwnerApiError("Notification was not found.", 404);
  }

  return result.data as {
    id: string;
    shop_id: string;
    guardian_id: string | null;
    pet_id: string | null;
    appointment_id: string | null;
    channel: ChannelType | string;
    provider: string | null;
    recipient_phone: string | null;
  };
}

async function getReadyMediaAssets(params: {
  shopId: string;
  mediaAssetIds: string[];
}) {
  if (!params.mediaAssetIds.length) return [];

  const admin = getAdmin();
  const result = await admin
    .from("media_assets")
    .select("*")
    .eq("shop_id", params.shopId)
    .in("id", params.mediaAssetIds)
    .is("deleted_at", null);

  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  const assets = (result.data ?? []) as MediaAsset[];
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const missingIds = params.mediaAssetIds.filter((id) => !assetsById.has(id));
  if (missingIds.length) {
    throw new OwnerApiError("One or more media assets were not found.", 404);
  }

  const notReady = assets.find((asset) => asset.status !== "ready");
  if (notReady) {
    throw new OwnerApiError("Only ready media assets can be attached to notifications.", 400);
  }

  return params.mediaAssetIds.map((id) => assetsById.get(id)).filter(Boolean) as MediaAsset[];
}

function getUsageMonthFromInput(month: string | null | undefined) {
  if (!month) return getUsageMonth();
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new OwnerApiError("month must be YYYY-MM.", 400);
  }

  return `${match[1]}-${match[2]}-01`;
}

async function getMonthlyUsageRow(shopId: string, usageMonth: string) {
  const admin = getAdmin();
  const result = await admin
    .from("shop_media_usage_months")
    .select("*")
    .eq("shop_id", shopId)
    .eq("usage_month", usageMonth)
    .maybeSingle();

  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  return result.data ?? {
    shop_id: shopId,
    usage_month: usageMonth,
    uploaded_asset_count: 0,
    uploaded_bytes: 0,
    sent_asset_count: 0,
    sent_bytes: 0,
    updated_at: null,
  };
}

async function getShopMediaLimitPolicy(shopId: string): Promise<PetmanagerMediaLimitPolicy> {
  const admin = getAdmin();
  const result = await admin
    .from("shop_media_limits")
    .select("shop_id, monthly_soft_limit_bytes, monthly_hard_limit_bytes, transient_retention_days, allow_original_archive, enforcement_mode")
    .eq("shop_id", shopId)
    .maybeSingle();

  if (result.error) {
    const message = `${result.error.message} ${result.error.details ?? ""} ${result.error.hint ?? ""}`;
    if (/shop_media_limits/i.test(message) && (/does not exist/i.test(message) || /schema cache/i.test(message))) {
      return PETMANAGER_DEFAULT_MEDIA_LIMIT_POLICY;
    }
    throw new OwnerApiError(result.error.message, 500);
  }

  if (!result.data) {
    return PETMANAGER_DEFAULT_MEDIA_LIMIT_POLICY;
  }

  const row = result.data as ShopMediaLimitRow;
  return {
    softLimitBytes: Number(row.monthly_soft_limit_bytes ?? PETMANAGER_DEFAULT_MEDIA_LIMIT_POLICY.softLimitBytes),
    hardLimitBytes:
      row.monthly_hard_limit_bytes === null || row.monthly_hard_limit_bytes === undefined
        ? null
        : Number(row.monthly_hard_limit_bytes),
    transientRetentionDays:
      Number(row.transient_retention_days ?? PETMANAGER_DEFAULT_MEDIA_LIMIT_POLICY.transientRetentionDays) ||
      PETMANAGER_DEFAULT_MEDIA_LIMIT_POLICY.transientRetentionDays,
    allowOriginalArchive: Boolean(row.allow_original_archive),
    enforcementMode: row.enforcement_mode ?? PETMANAGER_DEFAULT_MEDIA_LIMIT_POLICY.enforcementMode,
  };
}

function buildUsageSummary(usage: Record<string, unknown>, policy = PETMANAGER_DEFAULT_MEDIA_LIMIT_POLICY) {
  const uploadedBytes = Number(usage.uploaded_bytes ?? 0);
  const sentBytes = Number(usage.sent_bytes ?? 0);
  const softLimitBytes = policy.softLimitBytes;
  const softLimitRatio = softLimitBytes > 0 ? uploadedBytes / softLimitBytes : 0;
  const status = getPetmanagerMediaUsageStatus({ uploadedBytes, softLimitBytes });

  return {
    uploadedBytes,
    sentBytes,
    totalTrackedBytes: uploadedBytes + sentBytes,
    softLimitRatio,
    status,
    enforcementMode: policy.enforcementMode,
    hardLimitBytes: policy.hardLimitBytes,
    hardLimitExceeded: policy.hardLimitBytes !== null && uploadedBytes > policy.hardLimitBytes,
    notice:
      status === "exceeded"
        ? PETMANAGER_MEDIA_NOTICE_COPY.usageExceeded
        : status === "approaching"
          ? PETMANAGER_MEDIA_NOTICE_COPY.usageApproaching
          : null,
  };
}

function getCleanupNow(value: string | null | undefined) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new OwnerApiError("now must be a valid ISO datetime.", 400);
  }
  return date.toISOString();
}

export async function createOwnerMediaUploadIntent(owner: OwnerContext, input: CreateUploadIntentInput) {
  const admin = getAdmin();
  const mediaLimitPolicy = await getShopMediaLimitPolicy(owner.shopId);
  const contentType = normalizeContentType(input.contentType);

  if (!allowedContentTypes.has(contentType)) {
    throw new OwnerApiError("Upload images must be compressed to JPEG, PNG, or WebP before upload.", 400);
  }

  const byteSize = optionalByteSize(input.byteSize, "byteSize");
  if (!byteSize || byteSize > OWNER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES) {
    throw new OwnerApiError("Image is too large. Compress it before upload.", 413);
  }

  const mediaKind = mediaKinds.has(input.mediaKind as MediaKind) ? (input.mediaKind as MediaKind) : "message_image";
  const visibility = visibilityValues.has(input.visibility as MediaVisibility)
    ? (input.visibility as MediaVisibility)
    : "private";
  const retentionPolicy = retentionValues.has(input.retentionPolicy as MediaRetentionPolicy)
    ? (input.retentionPolicy as MediaRetentionPolicy)
    : defaultRetentionForKind(mediaKind);
  const uploadedFrom = uploadSources.has(input.uploadedFrom as MediaUploadSource)
    ? (input.uploadedFrom as MediaUploadSource)
    : "owner_web";
  const guardianId = optionalUuid(input.guardianId, "guardianId");
  const petId = optionalUuid(input.petId, "petId");
  const appointmentId = optionalUuid(input.appointmentId, "appointmentId");
  const groomingRecordId = optionalUuid(input.groomingRecordId, "groomingRecordId");
  const metadata = normalizeMetadata(input.metadata);
  const staffId = mediaKind === "staff_profile" && typeof metadata.staffId === "string" ? metadata.staffId : null;
  const mediaAssetId = randomUUID();
  const storagePath = buildStoragePath({
    shopId: owner.shopId,
    mediaAssetId,
    mediaKind,
    contentType,
    guardianId,
    petId,
    appointmentId,
    staffId,
  });

  const signedUpload = await createMediaSignedUploadUrl({
    bucket: MEDIA_BUCKET,
    path: storagePath,
    contentType,
  });

  const insertPayload = {
    id: mediaAssetId,
    shop_id: owner.shopId,
    guardian_id: guardianId,
    pet_id: petId,
    appointment_id: appointmentId,
    grooming_record_id: groomingRecordId,
    bucket: MEDIA_BUCKET,
    storage_path: storagePath,
    original_file_name: input.originalFileName?.slice(0, 180) ?? null,
    content_type: contentType,
    byte_size: byteSize,
    source_byte_size: optionalByteSize(input.sourceByteSize, "sourceByteSize"),
    width: optionalPositiveInt(input.width, "width"),
    height: optionalPositiveInt(input.height, "height"),
    checksum_sha256: input.checksumSha256?.trim() || null,
    media_kind: mediaKind,
    visibility,
    status: "uploading",
    retention_policy: retentionPolicy,
    uploaded_by_user_id: owner.userId,
    uploaded_from: uploadedFrom,
    metadata,
    expires_at: getExpiresAt(retentionPolicy, mediaLimitPolicy.transientRetentionDays),
  };

  const usage = await getMonthlyUsageRow(owner.shopId, getUsageMonth());
  const projectedUploadedBytes = Number(usage.uploaded_bytes ?? 0) + byteSize;
  const uploadLimit = evaluatePetmanagerMediaUploadLimit({
    projectedUploadedBytes,
    policy: mediaLimitPolicy,
  });
  if (uploadLimit.blocked) {
    throw new OwnerApiError(PETMANAGER_MEDIA_NOTICE_COPY.usageExceeded, 402);
  }

  const result = await admin.from("media_assets").insert(insertPayload).select("*").single();
  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  const usageSummary = buildUsageSummary({
    ...usage,
    uploaded_bytes: projectedUploadedBytes,
  }, mediaLimitPolicy);

  return {
    mediaAsset: result.data as MediaAsset,
    policy: {
      retentionDays: mediaLimitPolicy.transientRetentionDays,
      targetImageBytes: OWNER_MEDIA_TARGET_IMAGE_BYTES,
      targetBeforeAfterSetBytes: OWNER_MEDIA_TARGET_BEFORE_AFTER_SET_BYTES,
      uploadMaxBytes: OWNER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES,
      monthlySoftLimitBytes: mediaLimitPolicy.softLimitBytes,
      monthlyHardLimitBytes: mediaLimitPolicy.hardLimitBytes,
      enforcementMode: mediaLimitPolicy.enforcementMode,
      allowOriginalArchive: mediaLimitPolicy.allowOriginalArchive,
      notice: PETMANAGER_MEDIA_NOTICE_COPY.uploadNotice,
      compressionNotice: PETMANAGER_MEDIA_NOTICE_COPY.compression,
    },
    usage: {
      ...usage,
      projected_uploaded_bytes: usageSummary.uploadedBytes,
      status: usageSummary.status,
      enforcementMode: usageSummary.enforcementMode,
      hardLimitExceeded: usageSummary.hardLimitExceeded,
      notice: usageSummary.notice,
    },
    limit: uploadLimit,
    upload: {
      bucket: MEDIA_BUCKET,
      path: storagePath,
      provider: signedUpload.provider,
      signedUrl: signedUpload.signedUrl,
      token: signedUpload.token,
      method: signedUpload.method,
      headers: signedUpload.headers,
      maxBytes: OWNER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES,
      expiresInSeconds: signedUpload.expiresInSeconds,
    },
  };
}

export async function completeOwnerMediaUpload(owner: OwnerContext, input: CompleteUploadInput) {
  const admin = getAdmin();
  const mediaAssetId = requiredUuid(input.mediaAssetId, "mediaAssetId");

  const existing = await admin
    .from("media_assets")
    .select("id, shop_id, status, byte_size, deleted_at")
    .eq("id", mediaAssetId)
    .eq("shop_id", owner.shopId)
    .maybeSingle();

  if (existing.error) {
    throw new OwnerApiError(existing.error.message, 500);
  }

  if (!existing.data || existing.data.deleted_at) {
    throw new OwnerApiError("Media asset was not found.", 404);
  }

  const completedByteSize =
    optionalByteSize(input.byteSize, "byteSize") ?? ((existing.data.byte_size as number | null) ?? 0);
  const updatePayload: Record<string, string | number> = {
    status: "ready",
    byte_size: completedByteSize,
    updated_at: new Date().toISOString(),
  };
  const width = optionalPositiveInt(input.width, "width");
  const height = optionalPositiveInt(input.height, "height");
  const checksumSha256 = input.checksumSha256?.trim();

  if (width) updatePayload.width = width;
  if (height) updatePayload.height = height;
  if (checksumSha256) updatePayload.checksum_sha256 = checksumSha256;

  const result = await admin
    .from("media_assets")
    .update(updatePayload)
    .eq("id", mediaAssetId)
    .eq("shop_id", owner.shopId)
    .select("*")
    .single();

  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  if (existing.data.status !== "ready") {
    await recordMonthlyMediaUsage({
      shopId: owner.shopId,
      uploadedAssetCount: 1,
      uploadedBytes: completedByteSize,
    });
  }

  return result.data as MediaAsset;
}

export async function getOwnerMediaSignedUrl(owner: OwnerContext, input: {
  mediaAssetId: string;
  variantKey?: MediaVariantKey | "original" | null;
}) {
  const admin = getAdmin();
  const mediaAssetId = requiredUuid(input.mediaAssetId, "mediaAssetId");
  const variantKey = input.variantKey && variantKeys.has(input.variantKey as MediaVariantKey)
    ? (input.variantKey as MediaVariantKey)
    : null;

  const buildAssetQuery = (includeDeletedAtFilter: boolean) => {
    let query = admin
      .from("media_assets")
      .select("*")
      .eq("id", mediaAssetId)
      .eq("shop_id", owner.shopId);
    if (includeDeletedAtFilter) query = query.is("deleted_at", null);
    return query.maybeSingle();
  };

  let assetResult = await buildAssetQuery(true);
  if (assetResult.error && shouldRetryMediaAssetQueryWithoutDeletedAt(assetResult.error)) {
    assetResult = await buildAssetQuery(false);
  }

  if (assetResult.error) {
    throw new OwnerApiError(assetResult.error.message, 500);
  }

  if (!assetResult.data) {
    throw new OwnerApiError("Media asset was not found.", 404);
  }

  let bucket = assetResult.data.bucket as string;
  let path = assetResult.data.storage_path as string;
  let variant: MediaVariant | null = null;

  if (variantKey) {
    const variantResult = await admin
      .from("media_variants")
      .select("*")
      .eq("media_asset_id", mediaAssetId)
      .eq("variant_key", variantKey)
      .maybeSingle();

    if (variantResult.error) {
      throw new OwnerApiError(variantResult.error.message, 500);
    }

    if (variantResult.data) {
      variant = variantResult.data as MediaVariant;
      bucket = variant.bucket;
      path = variant.storage_path;
    }
  }

  const signedUrl = await createMediaSignedReadUrl({
    bucket,
    path,
    expiresInSeconds: OWNER_MEDIA_SIGNED_READ_SECONDS,
  });

  return {
    mediaAsset: assetResult.data as MediaAsset,
    variant,
    signedUrl,
    expiresInSeconds: OWNER_MEDIA_SIGNED_READ_SECONDS,
  };
}

export async function getPublicShopMediaSignedUrls(input: PublicMediaSignedUrlsInput) {
  const admin = getAdmin();
  const shopId = requiredUuid(input.shopId, "shopId");
  const mediaAssetIds = normalizeUuidList(input.mediaAssetIds, "mediaAssetId", 20);
  const variantKey = input.variantKey && variantKeys.has(input.variantKey as MediaVariantKey)
    ? (input.variantKey as MediaVariantKey)
    : null;

  if (!mediaAssetIds.length) {
    return {
      items: [] as Array<{ mediaAssetId: string; signedUrl: string }>,
    };
  }

  const assetsResult = await admin
    .from("media_assets")
    .select("*")
    .eq("shop_id", shopId)
    .in("id", mediaAssetIds)
    .eq("status", "ready")
    .is("deleted_at", null)
    .in("visibility", ["public", "customer_shared"]);

  if (assetsResult.error) {
    throw new OwnerApiError(assetsResult.error.message, 500);
  }

  const assets = (assetsResult.data ?? []) as MediaAsset[];
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const variantsByAssetId = new Map<string, MediaVariant>();

  if (variantKey && assets.length > 0) {
    const variantsResult = await admin
      .from("media_variants")
      .select("*")
      .in("media_asset_id", assets.map((asset) => asset.id))
      .eq("variant_key", variantKey);

    if (variantsResult.error) {
      throw new OwnerApiError(variantsResult.error.message, 500);
    }

    for (const variant of (variantsResult.data ?? []) as MediaVariant[]) {
      variantsByAssetId.set(variant.media_asset_id, variant);
    }
  }

  const items = await Promise.all(
    mediaAssetIds.map(async (mediaAssetId) => {
      const asset = assetsById.get(mediaAssetId);
      if (!asset) return null;
      const variant = variantsByAssetId.get(mediaAssetId);
      return {
        mediaAssetId,
        signedUrl: await createMediaSignedReadUrl({
          bucket: variant?.bucket ?? asset.bucket,
          path: variant?.storage_path ?? asset.storage_path,
          expiresInSeconds: OWNER_MEDIA_SIGNED_READ_SECONDS,
        }),
      };
    }),
  );

  return {
    items: items.filter((item): item is { mediaAssetId: string; signedUrl: string } => Boolean(item)),
  };
}

export async function listRecentSentMedia(owner: OwnerContext, input: RecentSentMediaInput) {
  const admin = getAdmin();
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 50);
  let query = admin
    .from("media_send_attempts")
    .select("*")
    .eq("shop_id", owner.shopId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  const guardianId = optionalUuid(input.guardianId, "guardianId");
  const petId = optionalUuid(input.petId, "petId");
  const appointmentId = optionalUuid(input.appointmentId, "appointmentId");

  if (guardianId) query = query.eq("guardian_id", guardianId);
  if (petId) query = query.eq("pet_id", petId);
  if (appointmentId) query = query.eq("appointment_id", appointmentId);

  const attemptsResult = await query;
  if (attemptsResult.error) {
    throw new OwnerApiError(attemptsResult.error.message, 500);
  }

  const attempts = attemptsResult.data ?? [];
  const mediaAssetIds = [...new Set(attempts.map((item) => item.media_asset_id).filter(Boolean))] as string[];
  if (!mediaAssetIds.length) {
    return [];
  }

  const [assetsResult, variantsResult] = await Promise.all([
    admin.from("media_assets").select("*").eq("shop_id", owner.shopId).in("id", mediaAssetIds).is("deleted_at", null),
    admin.from("media_variants").select("*").in("media_asset_id", mediaAssetIds),
  ]);

  if (assetsResult.error) {
    throw new OwnerApiError(assetsResult.error.message, 500);
  }

  if (variantsResult.error) {
    throw new OwnerApiError(variantsResult.error.message, 500);
  }

  const assetMap = new Map((assetsResult.data ?? []).map((item) => [item.id as string, item as MediaAsset]));
  const variantsByAssetId = new Map<string, MediaVariant[]>();
  for (const variant of (variantsResult.data ?? []) as MediaVariant[]) {
    const list = variantsByAssetId.get(variant.media_asset_id) ?? [];
    list.push(variant);
    variantsByAssetId.set(variant.media_asset_id, list);
  }

  return attempts
    .map((attempt) => {
      const mediaAsset = assetMap.get(attempt.media_asset_id as string);
      if (!mediaAsset) return null;

      return {
        sendAttempt: attempt,
        mediaAsset,
        variants: variantsByAssetId.get(mediaAsset.id) ?? [],
      };
    })
    .filter(Boolean);
}

export async function listPhotoSendRequests(owner: OwnerContext, input: PhotoSendRequestInput) {
  const admin = getAdmin();
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
  let query = admin
    .from("notifications")
    .select(
      "id, shop_id, appointment_id, pet_id, guardian_id, type, channel, status, provider, provider_message_id, recipient_phone, fail_reason, sent_at, created_at, metadata",
    )
    .eq("shop_id", owner.shopId)
    .eq("type", "grooming_completed")
    .eq("channel", "alimtalk")
    .order("created_at", { ascending: false })
    .limit(limit);

  const guardianId = optionalUuid(input.guardianId, "guardianId");
  const petId = optionalUuid(input.petId, "petId");
  const appointmentId = optionalUuid(input.appointmentId, "appointmentId");

  if (guardianId) query = query.eq("guardian_id", guardianId);
  if (petId) query = query.eq("pet_id", petId);
  if (appointmentId) query = query.eq("appointment_id", appointmentId);

  const notificationsResult = await query;
  if (notificationsResult.error) {
    throw new OwnerApiError(notificationsResult.error.message, 500);
  }

  const notifications = (notificationsResult.data ?? []) as Notification[];
  const notificationIds = notifications.map((item) => item.id);
  if (!notificationIds.length) {
    return [];
  }

  const attachmentsResult = await admin
    .from("notification_media_attachments")
    .select("id, notification_id, send_status")
    .eq("shop_id", owner.shopId)
    .in("notification_id", notificationIds);

  if (attachmentsResult.error) {
    throw new OwnerApiError(attachmentsResult.error.message, 500);
  }

  const countsByNotificationId = new Map<string, number>();
  for (const attachment of attachmentsResult.data ?? []) {
    const notificationId = attachment.notification_id as string;
    countsByNotificationId.set(notificationId, (countsByNotificationId.get(notificationId) ?? 0) + 1);
  }

  return notifications
    .map((notification) => ({
      notification,
      attachmentCount: countsByNotificationId.get(notification.id) ?? 0,
    }))
    .filter((item) => item.attachmentCount > 0);
}

export async function attachMediaToNotification(owner: OwnerContext, input: AttachMediaToNotificationInput) {
  const admin = getAdmin();
  const notificationId = requiredUuid(input.notificationId, "notificationId");
  const mediaAssetIds = input.media.map((item) => requiredUuid(item.mediaAssetId, "mediaAssetId"));
  const uniqueMediaAssetIds = [...new Set(mediaAssetIds)];

  if (!uniqueMediaAssetIds.length) {
    throw new OwnerApiError("At least one media asset is required.", 400);
  }

  if (uniqueMediaAssetIds.length > 10) {
    throw new OwnerApiError("A notification can attach up to 10 images.", 400);
  }

  const notification = await getNotificationForMediaAttachment({
    shopId: owner.shopId,
    notificationId,
  });
  const mediaAssets = await getReadyMediaAssets({
    shopId: owner.shopId,
    mediaAssetIds: uniqueMediaAssetIds,
  });
  const mediaAssetMap = new Map(mediaAssets.map((asset) => [asset.id, asset]));
  const channel = input.channel?.trim() || notification.channel || "alimtalk";

  const rows = input.media.map((item, index) => {
    const mediaAssetId = requiredUuid(item.mediaAssetId, "mediaAssetId");
    const mediaAsset = mediaAssetMap.get(mediaAssetId);

    return {
      shop_id: owner.shopId,
      notification_id: notificationId,
      media_asset_id: mediaAssetId,
      guardian_id: mediaAsset?.guardian_id ?? notification.guardian_id,
      pet_id: mediaAsset?.pet_id ?? notification.pet_id,
      appointment_id: mediaAsset?.appointment_id ?? notification.appointment_id,
      attachment_role: normalizeAttachmentRole(item.attachmentRole),
      sort_order: normalizeSortOrder(item.sortOrder, index),
      channel,
      provider: notification.provider,
      send_status: "queued",
      metadata: {
        attachedByUserId: owner.userId,
      },
    };
  });

  const result = await admin
    .from("notification_media_attachments")
    .upsert(rows, { onConflict: "notification_id,media_asset_id,attachment_role" })
    .select("*")
    .order("sort_order");

  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  return {
    notificationId,
    mediaAssets,
    attachments: (result.data ?? []) as NotificationMediaAttachment[],
  };
}

export async function recordMediaSendAttempt(owner: OwnerContext, input: RecordMediaSendAttemptInput) {
  const admin = getAdmin();
  const mediaAssetId = requiredUuid(input.mediaAssetId, "mediaAssetId");
  const mediaAssets = await getReadyMediaAssets({
    shopId: owner.shopId,
    mediaAssetIds: [mediaAssetId],
  });
  const mediaAsset = mediaAssets[0];
  const sentAt = input.sentAt ?? (input.status === "sent" ? new Date().toISOString() : null);
  const insertPayload = {
    shop_id: owner.shopId,
    notification_id: optionalUuid(input.notificationId, "notificationId"),
    notification_media_attachment_id: optionalUuid(
      input.notificationMediaAttachmentId,
      "notificationMediaAttachmentId",
    ),
    media_asset_id: mediaAssetId,
    guardian_id: optionalUuid(input.guardianId, "guardianId") ?? mediaAsset.guardian_id,
    pet_id: optionalUuid(input.petId, "petId") ?? mediaAsset.pet_id,
    appointment_id: optionalUuid(input.appointmentId, "appointmentId") ?? mediaAsset.appointment_id,
    channel: input.channel,
    provider: input.provider ?? null,
    provider_message_id: input.providerMessageId ?? null,
    provider_media_id: input.providerMediaId ?? null,
    recipient_phone: input.recipientPhone?.replace(/\D/g, "") || null,
    status: input.status,
    fail_reason: input.failReason ?? null,
    sent_at: sentAt,
    metadata: normalizeMetadata(input.metadata),
  };

  const result = await admin.from("media_send_attempts").insert(insertPayload).select("*").single();
  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  if (input.status === "sent") {
    await recordMonthlyMediaUsage({
      shopId: owner.shopId,
      sentAssetCount: 1,
      sentBytes: mediaAsset.byte_size,
    });
  }

  return result.data as MediaSendAttempt;
}

export async function getOwnerMediaUsage(owner: OwnerContext, input: MediaUsageInput = {}) {
  const usageMonth = getUsageMonthFromInput(input.month);
  const mediaLimitPolicy = await getShopMediaLimitPolicy(owner.shopId);
  const usage = await getMonthlyUsageRow(owner.shopId, usageMonth);
  const softLimitBytes = mediaLimitPolicy.softLimitBytes;
  const summary = buildUsageSummary(usage, mediaLimitPolicy);

  return {
    usage,
    limits: {
      softLimitBytes,
      hardLimitBytes: mediaLimitPolicy.hardLimitBytes,
      uploadMaxBytes: OWNER_MEDIA_MAX_COMPRESSED_UPLOAD_BYTES,
      targetImageBytes: OWNER_MEDIA_TARGET_IMAGE_BYTES,
      targetBeforeAfterSetBytes: OWNER_MEDIA_TARGET_BEFORE_AFTER_SET_BYTES,
      retentionDays: mediaLimitPolicy.transientRetentionDays,
      allowOriginalArchive: mediaLimitPolicy.allowOriginalArchive,
      enforcementMode: mediaLimitPolicy.enforcementMode,
    },
    summary,
    copy: {
      policySummary: PETMANAGER_MEDIA_NOTICE_COPY.policySummary,
      uploadNotice: PETMANAGER_MEDIA_NOTICE_COPY.uploadNotice,
      compressionNotice: PETMANAGER_MEDIA_NOTICE_COPY.compression,
    },
  };
}

export async function cleanupExpiredTransientMedia(input: CleanupExpiredMediaInput = {}) {
  const admin = getAdmin();
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const now = getCleanupNow(input.now);
  const dryRun = input.dryRun !== false;

  const assetsResult = await admin
    .from("media_assets")
    .select("*")
    .eq("retention_policy", "transient")
    .lt("expires_at", now)
    .is("deleted_at", null)
    .order("expires_at", { ascending: true })
    .limit(limit);

  if (assetsResult.error) {
    throw new OwnerApiError(assetsResult.error.message, 500);
  }

  const mediaAssets = (assetsResult.data ?? []) as MediaAsset[];
  if (!mediaAssets.length) {
    return {
      dryRun,
      checkedAt: now,
      matchedCount: 0,
      deletedCount: 0,
      failedCount: 0,
      items: [] as CleanupExpiredMediaItem[],
      errors: [] as Array<{ mediaAssetId: string; message: string }>,
    };
  }

  const mediaAssetIds = mediaAssets.map((item) => item.id);
  const variantsResult = await admin
    .from("media_variants")
    .select("*")
    .in("media_asset_id", mediaAssetIds);

  if (variantsResult.error) {
    throw new OwnerApiError(variantsResult.error.message, 500);
  }

  const variantsByAssetId = new Map<string, MediaVariant[]>();
  for (const variant of (variantsResult.data ?? []) as MediaVariant[]) {
    const list = variantsByAssetId.get(variant.media_asset_id) ?? [];
    list.push(variant);
    variantsByAssetId.set(variant.media_asset_id, list);
  }

  const items = mediaAssets.map<CleanupExpiredMediaItem>((mediaAsset) => {
    const variants = variantsByAssetId.get(mediaAsset.id) ?? [];
    const storageObjects = [
      { bucket: mediaAsset.bucket, path: mediaAsset.storage_path },
      ...variants.map((variant) => ({ bucket: variant.bucket, path: variant.storage_path })),
    ];

    return {
      mediaAsset,
      variants,
      storageObjects,
    };
  });

  if (dryRun) {
    return {
      dryRun,
      checkedAt: now,
      matchedCount: items.length,
      deletedCount: 0,
      failedCount: 0,
      items,
      errors: [] as Array<{ mediaAssetId: string; message: string }>,
    };
  }

  let deletedCount = 0;
  const errors: Array<{ mediaAssetId: string; message: string }> = [];
  const deletedAt = new Date().toISOString();

  for (const item of items) {
    try {
      const pathsByBucket = new Map<string, string[]>();
      for (const storageObject of item.storageObjects) {
        const paths = pathsByBucket.get(storageObject.bucket) ?? [];
        paths.push(storageObject.path);
        pathsByBucket.set(storageObject.bucket, paths);
      }

      for (const [bucket, paths] of pathsByBucket.entries()) {
        await removeMediaStorageObjects({ bucket, paths });
      }

      const updateResult = await admin
        .from("media_assets")
        .update({
          status: "deleted",
          deleted_at: deletedAt,
          updated_at: deletedAt,
        })
        .eq("id", item.mediaAsset.id)
        .is("deleted_at", null);

      if (updateResult.error) {
        throw new Error(updateResult.error.message);
      }

      deletedCount += 1;
    } catch (error) {
      errors.push({
        mediaAssetId: item.mediaAsset.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    dryRun,
    checkedAt: now,
    matchedCount: items.length,
    deletedCount,
    failedCount: errors.length,
    items: items.map((item) => ({
      ...item,
      mediaAsset: {
        ...item.mediaAsset,
        status: errors.some((error) => error.mediaAssetId === item.mediaAsset.id) ? item.mediaAsset.status : "deleted",
      },
    })),
    errors,
  };
}

export function getOwnerMediaStorageStatus() {
  return {
    bucket: MEDIA_BUCKET,
    ...getMediaStorageInfo(),
  };
}
