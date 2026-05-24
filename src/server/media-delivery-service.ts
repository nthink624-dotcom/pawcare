import { PETMANAGER_MEDIA_SIGNED_READ_SECONDS } from "@/lib/media/media-policy";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AlimtalkMediaAttachment } from "@/server/alimtalk-provider";
import { recordMediaSendAttempt } from "@/server/media-service";
import { createMediaSignedReadUrl } from "@/server/media-storage";
import { OwnerApiError } from "@/server/owner-api-auth";
import type {
  MediaAsset,
  MediaSendStatus,
  MediaVariant,
  MediaVariantKey,
  NotificationMediaAttachment,
} from "@/types/domain";

type OwnerContext = {
  shopId: string;
  userId: string | null;
};

type DeliveryVariantKey = MediaVariantKey | "original";

type NotificationMediaDeliveryInput = {
  notificationId: string;
  preferredVariantKeys?: DeliveryVariantKey[] | null;
};

type ProviderMediaResult = {
  notificationMediaAttachmentId: string;
  providerMediaId?: string | null;
  providerMediaUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

type MarkNotificationMediaDeliveryInput = {
  notificationId: string;
  status: MediaSendStatus;
  channel?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  recipientPhone?: string | null;
  failReason?: string | null;
  sentAt?: string | null;
  providerMedia?: ProviderMediaResult[] | null;
};

export type NotificationMediaDeliveryItem = {
  attachment: NotificationMediaAttachment;
  mediaAsset: MediaAsset;
  variant: MediaVariant | null;
  delivery: {
    bucket: string;
    path: string;
    signedUrl: string;
    expiresInSeconds: number;
    variantKey: DeliveryVariantKey;
    contentType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    attachmentRole: string;
    sortOrder: number;
  };
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deliveryVariantKeys = new Set<DeliveryVariantKey>([
  "provider_ready",
  "optimized",
  "preview",
  "thumbnail",
  "original",
]);
const defaultDeliveryVariantPreference: DeliveryVariantKey[] = [
  "provider_ready",
  "optimized",
  "preview",
  "original",
];

function getAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerApiError("Supabase media delivery connection is unavailable.", 503);
  }
  return admin;
}

function requiredUuid(value: string | null | undefined, label: string) {
  if (!value || !uuidPattern.test(value)) {
    throw new OwnerApiError(`${label} is invalid.`, 400);
  }

  return value;
}

function normalizeVariantPreference(input: DeliveryVariantKey[] | null | undefined) {
  const normalized = (input ?? []).filter((item): item is DeliveryVariantKey =>
    deliveryVariantKeys.has(item),
  );

  return normalized.length ? normalized : defaultDeliveryVariantPreference;
}

function normalizeStatus(value: MediaSendStatus) {
  if (!["queued", "sent", "failed", "skipped"].includes(value)) {
    throw new OwnerApiError("status is invalid.", 400);
  }

  return value;
}

async function getNotificationMediaAttachments(owner: OwnerContext, notificationId: string) {
  const admin = getAdmin();
  const result = await admin
    .from("notification_media_attachments")
    .select("*")
    .eq("shop_id", owner.shopId)
    .eq("notification_id", notificationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  return (result.data ?? []) as NotificationMediaAttachment[];
}

async function getMediaAssets(owner: OwnerContext, mediaAssetIds: string[]) {
  const admin = getAdmin();
  const result = await admin
    .from("media_assets")
    .select("*")
    .eq("shop_id", owner.shopId)
    .in("id", mediaAssetIds)
    .is("deleted_at", null);

  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  const assets = (result.data ?? []) as MediaAsset[];
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const missingIds = mediaAssetIds.filter((id) => !assetMap.has(id));
  if (missingIds.length) {
    throw new OwnerApiError("One or more media assets were not found.", 404);
  }

  const notReady = assets.find((asset) => asset.status !== "ready");
  if (notReady) {
    throw new OwnerApiError("Only ready media assets can be prepared for delivery.", 400);
  }

  return assetMap;
}

async function getMediaVariants(mediaAssetIds: string[]) {
  if (!mediaAssetIds.length) return new Map<string, MediaVariant[]>();

  const admin = getAdmin();
  const result = await admin
    .from("media_variants")
    .select("*")
    .in("media_asset_id", mediaAssetIds);

  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  const variantsByAssetId = new Map<string, MediaVariant[]>();
  for (const variant of (result.data ?? []) as MediaVariant[]) {
    const variants = variantsByAssetId.get(variant.media_asset_id) ?? [];
    variants.push(variant);
    variantsByAssetId.set(variant.media_asset_id, variants);
  }

  return variantsByAssetId;
}

function pickDeliveryObject(
  mediaAsset: MediaAsset,
  variants: MediaVariant[],
  preferredVariantKeys: DeliveryVariantKey[],
) {
  for (const variantKey of preferredVariantKeys) {
    if (variantKey === "original") break;
    const variant = variants.find((item) => item.variant_key === variantKey);
    if (variant) {
      return {
        variant,
        variantKey,
        bucket: variant.bucket,
        path: variant.storage_path,
        contentType: variant.content_type,
        byteSize: variant.byte_size,
        width: variant.width,
        height: variant.height,
      };
    }
  }

  return {
    variant: null,
    variantKey: "original" as const,
    bucket: mediaAsset.bucket,
    path: mediaAsset.storage_path,
    contentType: mediaAsset.content_type,
    byteSize: mediaAsset.byte_size,
    width: mediaAsset.width,
    height: mediaAsset.height,
  };
}

async function createSignedReadUrl(bucket: string, path: string) {
  return createMediaSignedReadUrl({
    bucket,
    path,
    expiresInSeconds: PETMANAGER_MEDIA_SIGNED_READ_SECONDS,
  });
}

export async function resolveNotificationMediaDelivery(
  owner: OwnerContext,
  input: NotificationMediaDeliveryInput,
) {
  const notificationId = requiredUuid(input.notificationId, "notificationId");
  const preferredVariantKeys = normalizeVariantPreference(input.preferredVariantKeys);
  const attachments = await getNotificationMediaAttachments(owner, notificationId);

  if (!attachments.length) {
    return {
      notificationId,
      expiresInSeconds: PETMANAGER_MEDIA_SIGNED_READ_SECONDS,
      items: [] as NotificationMediaDeliveryItem[],
    };
  }

  const mediaAssetIds = [...new Set(attachments.map((item) => item.media_asset_id))];
  const [assetMap, variantsByAssetId] = await Promise.all([
    getMediaAssets(owner, mediaAssetIds),
    getMediaVariants(mediaAssetIds),
  ]);

  const items = await Promise.all(
    attachments.map(async (attachment) => {
      const mediaAsset = assetMap.get(attachment.media_asset_id);
      if (!mediaAsset) {
        throw new OwnerApiError("One or more media assets were not found.", 404);
      }

      const deliveryObject = pickDeliveryObject(
        mediaAsset,
        variantsByAssetId.get(mediaAsset.id) ?? [],
        preferredVariantKeys,
      );
      const signedUrl = await createSignedReadUrl(deliveryObject.bucket, deliveryObject.path);

      return {
        attachment,
        mediaAsset,
        variant: deliveryObject.variant,
        delivery: {
          bucket: deliveryObject.bucket,
          path: deliveryObject.path,
          signedUrl,
          expiresInSeconds: PETMANAGER_MEDIA_SIGNED_READ_SECONDS,
          variantKey: deliveryObject.variantKey,
          contentType: deliveryObject.contentType,
          byteSize: deliveryObject.byteSize,
          width: deliveryObject.width,
          height: deliveryObject.height,
          attachmentRole: attachment.attachment_role,
          sortOrder: attachment.sort_order,
        },
      } satisfies NotificationMediaDeliveryItem;
    }),
  );

  return {
    notificationId,
    expiresInSeconds: PETMANAGER_MEDIA_SIGNED_READ_SECONDS,
    items,
  };
}

export function toAlimtalkMediaAttachments(
  items: NotificationMediaDeliveryItem[],
): AlimtalkMediaAttachment[] {
  return items.map((item) => ({
    attachmentId: item.attachment.id,
    mediaAssetId: item.mediaAsset.id,
    role: item.attachment.attachment_role,
    url: item.delivery.signedUrl,
    contentType: item.delivery.contentType,
    byteSize: item.delivery.byteSize,
    variantKey: item.delivery.variantKey,
    expiresInSeconds: item.delivery.expiresInSeconds,
    metadata: {
      sortOrder: item.attachment.sort_order,
      width: item.delivery.width,
      height: item.delivery.height,
    },
  }));
}

export async function markNotificationMediaDeliveryResult(
  owner: OwnerContext,
  input: MarkNotificationMediaDeliveryInput,
) {
  const admin = getAdmin();
  const notificationId = requiredUuid(input.notificationId, "notificationId");
  const status = normalizeStatus(input.status);
  const delivery = await resolveNotificationMediaDelivery(owner, { notificationId });
  const sentAt = input.sentAt ?? (status === "sent" ? new Date().toISOString() : null);
  const providerMediaMap = new Map(
    (input.providerMedia ?? []).map((item) => [requiredUuid(item.notificationMediaAttachmentId, "notificationMediaAttachmentId"), item]),
  );

  const updatedAttachments = [];
  const sendAttempts = [];

  for (const item of delivery.items) {
    const providerMedia = providerMediaMap.get(item.attachment.id);
    const updateResult = await admin
      .from("notification_media_attachments")
      .update({
        send_status: status,
        provider: input.provider ?? item.attachment.provider,
        provider_media_id: providerMedia?.providerMediaId ?? null,
        provider_media_url: providerMedia?.providerMediaUrl ?? null,
        sent_at: sentAt,
        fail_reason: input.failReason ?? null,
        metadata: {
          ...(item.attachment.metadata ?? {}),
          ...(providerMedia?.metadata ?? {}),
          deliveryVariantKey: item.delivery.variantKey,
          deliveryByteSize: item.delivery.byteSize,
        },
      })
      .eq("id", item.attachment.id)
      .eq("shop_id", owner.shopId)
      .select("*")
      .single();

    if (updateResult.error) {
      throw new OwnerApiError(updateResult.error.message, 500);
    }

    updatedAttachments.push(updateResult.data as NotificationMediaAttachment);
    sendAttempts.push(
      await recordMediaSendAttempt(owner, {
        notificationId,
        notificationMediaAttachmentId: item.attachment.id,
        mediaAssetId: item.mediaAsset.id,
        guardianId: item.attachment.guardian_id,
        petId: item.attachment.pet_id,
        appointmentId: item.attachment.appointment_id,
        channel: input.channel ?? item.attachment.channel ?? "alimtalk",
        provider: input.provider ?? item.attachment.provider,
        providerMessageId: input.providerMessageId ?? null,
        providerMediaId: providerMedia?.providerMediaId ?? null,
        recipientPhone: input.recipientPhone ?? null,
        status,
        failReason: input.failReason ?? null,
        sentAt,
        metadata: {
          deliveryVariantKey: item.delivery.variantKey,
          deliveryByteSize: item.delivery.byteSize,
          providerMediaUrlStored: Boolean(providerMedia?.providerMediaUrl),
        },
      }),
    );
  }

  return {
    notificationId,
    attachments: updatedAttachments,
    sendAttempts,
  };
}
