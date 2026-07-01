import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError } from "@/server/owner-api-auth";
import type { MediaAsset, MediaKind, MediaVariant } from "@/types/domain";

type OwnerContext = {
  shopId: string;
  userId: string | null;
};

type ListOwnerMediaAssetsInput = {
  guardianId?: string | null;
  petId?: string | null;
  appointmentId?: string | null;
  groomingRecordId?: string | null;
  mediaKind?: MediaKind | string | null;
  beforeCreatedAt?: string | null;
  limit?: number | null;
  includeVariants?: boolean | null;
};

export type OwnerMediaAssetListItem = {
  mediaAsset: MediaAsset;
  variants: MediaVariant[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mediaKinds = new Set<MediaKind>([
  "grooming_before",
  "grooming_after",
  "grooming_result",
  "message_image",
  "shop_profile",
  "customer_shared",
  "memo_attachment",
]);

function getAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerApiError("Supabase media query connection is unavailable.", 503);
  }
  return admin;
}

function optionalUuid(value: string | null | undefined, label: string) {
  if (!value) return null;
  if (!uuidPattern.test(value)) {
    throw new OwnerApiError(`${label} is invalid.`, 400);
  }

  return value;
}

function normalizeMediaKind(value: string | null | undefined) {
  if (!value) return null;
  if (!mediaKinds.has(value as MediaKind)) {
    throw new OwnerApiError("mediaKind is invalid.", 400);
  }

  return value as MediaKind;
}

function normalizeLimit(value: number | null | undefined) {
  if (value === null || value === undefined) return 30;
  if (!Number.isInteger(value) || value <= 0) {
    throw new OwnerApiError("limit must be a positive integer.", 400);
  }

  return Math.min(value, 100);
}

function normalizeBeforeCreatedAt(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new OwnerApiError("beforeCreatedAt must be a valid date string.", 400);
  }

  return parsed.toISOString();
}

function shouldRetryMediaAssetQueryWithoutDeletedAt(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "PGRST204" || message.includes("deleted_at") || message.includes("schema cache");
}

async function getVariants(mediaAssetIds: string[]) {
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

export async function listOwnerMediaAssets(
  owner: OwnerContext,
  input: ListOwnerMediaAssetsInput = {},
) {
  const admin = getAdmin();
  const limit = normalizeLimit(input.limit);
  const beforeCreatedAt = normalizeBeforeCreatedAt(input.beforeCreatedAt);
  const mediaKind = normalizeMediaKind(input.mediaKind ?? null);
  const guardianId = optionalUuid(input.guardianId, "guardianId");
  const petId = optionalUuid(input.petId, "petId");
  const appointmentId = optionalUuid(input.appointmentId, "appointmentId");
  const groomingRecordId = optionalUuid(input.groomingRecordId, "groomingRecordId");

  const buildQuery = (includeDeletedAtFilter: boolean) => {
    let query = admin
      .from("media_assets")
      .select("*")
      .eq("shop_id", owner.shopId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (includeDeletedAtFilter) query = query.is("deleted_at", null);
    if (beforeCreatedAt) query = query.lt("created_at", beforeCreatedAt);
    if (mediaKind) query = query.eq("media_kind", mediaKind);
    if (guardianId) query = query.eq("guardian_id", guardianId);
    if (petId) query = query.eq("pet_id", petId);
    if (appointmentId && groomingRecordId) {
      query = query.or(`appointment_id.eq.${appointmentId},grooming_record_id.eq.${groomingRecordId}`);
    } else {
      if (appointmentId) query = query.eq("appointment_id", appointmentId);
      if (groomingRecordId) query = query.eq("grooming_record_id", groomingRecordId);
    }

    return query;
  };

  let result = await buildQuery(true);
  if (result.error && shouldRetryMediaAssetQueryWithoutDeletedAt(result.error)) {
    result = await buildQuery(false);
  }
  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }

  const rows = ((result.data ?? []) as MediaAsset[]).slice(0, limit + 1);
  const hasMore = rows.length > limit;
  const mediaAssets = rows.slice(0, limit);
  const variantsByAssetId =
    input.includeVariants === false
      ? new Map<string, MediaVariant[]>()
      : await getVariants(mediaAssets.map((item) => item.id));

  return {
    items: mediaAssets.map<OwnerMediaAssetListItem>((mediaAsset) => ({
      mediaAsset,
      variants: variantsByAssetId.get(mediaAsset.id) ?? [],
    })),
    page: {
      limit,
      hasMore,
      nextBeforeCreatedAt: hasMore ? mediaAssets[mediaAssets.length - 1]?.created_at ?? null : null,
    },
  };
}
