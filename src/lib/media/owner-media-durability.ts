import type { MediaAssetListItem } from "@/lib/media/owner-media-client";

export type OwnerMediaBinding = {
  shopId: string;
  appointmentId: string;
  petId: string;
  guardianId: string;
};

export type OwnerMediaPreview = {
  item: MediaAssetListItem;
  signedUrl: string | null;
};

export function isOwnerMediaItemBoundToAppointment(
  item: MediaAssetListItem,
  binding: OwnerMediaBinding,
) {
  const asset = item.mediaAsset;
  return (
    asset.shop_id === binding.shopId &&
    asset.appointment_id === binding.appointmentId &&
    asset.pet_id === binding.petId &&
    asset.guardian_id === binding.guardianId &&
    asset.deleted_at === null
  );
}

export function mergeBoundOwnerMediaItems(
  current: readonly MediaAssetListItem[],
  incoming: readonly MediaAssetListItem[],
  binding: OwnerMediaBinding,
) {
  const merged = new Map<string, MediaAssetListItem>();
  for (const item of [...current, ...incoming]) {
    if (!isOwnerMediaItemBoundToAppointment(item, binding)) continue;
    const previous = merged.get(item.mediaAsset.id);
    if (!previous) {
      merged.set(item.mediaAsset.id, item);
      continue;
    }
    const variants = new Map(previous.variants.map((variant) => [`${variant.variant_key}:${variant.id}`, variant]));
    for (const variant of item.variants) variants.set(`${variant.variant_key}:${variant.id}`, variant);
    merged.set(item.mediaAsset.id, { mediaAsset: item.mediaAsset, variants: [...variants.values()] });
  }
  return [...merged.values()].sort((left, right) => right.mediaAsset.created_at.localeCompare(left.mediaAsset.created_at));
}

export function mergeOwnerMediaPreviews(
  current: readonly OwnerMediaPreview[],
  incoming: readonly OwnerMediaPreview[],
  binding: OwnerMediaBinding,
) {
  const currentById = new Map(current.map((preview) => [preview.item.mediaAsset.id, preview]));
  return mergeBoundOwnerMediaItems(
    current.map((preview) => preview.item),
    incoming.map((preview) => preview.item),
    binding,
  ).map((item) => {
    const next = incoming.find((preview) => preview.item.mediaAsset.id === item.mediaAsset.id);
    const previous = currentById.get(item.mediaAsset.id);
    return {
      item,
      signedUrl: next?.signedUrl ?? previous?.signedUrl ?? null,
    };
  });
}
