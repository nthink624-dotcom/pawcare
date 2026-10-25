import type { BootstrapStaffMember } from "@/types/domain";

// Bootstrap omits unresolved asset URLs. Never infer their identity by index.
export function canEditSetupStaffPhoto(member: BootstrapStaffMember) {
  const ids = member.profileImageAssetIds ?? [];
  const urls = member.profileImageUrls ?? [];
  // Do not migrate a legacy gallery to an asset-only gallery implicitly:
  // canonical hydration would hide the remaining legacy images.
  return ids.length === 0 ? urls.length <= 1 : ids.length === urls.length && urls.every(Boolean);
}

export function replaceSetupStaffPhoto(member: BootstrapStaffMember, assetId: string, url: string): Partial<BootstrapStaffMember> {
  if (!canEditSetupStaffPhoto(member)) throw new Error("사진 정보를 다시 불러와 주세요.");
  return {
    profileImageAssetIds: [assetId, ...(member.profileImageAssetIds ?? []).slice(1)],
    profileImageUrl: url,
    profileImageUrls: [url, ...(member.profileImageUrls ?? []).slice(1)],
    profileImageFallbackKey: null,
  };
}

export function removeSetupStaffPhoto(member: BootstrapStaffMember): Partial<BootstrapStaffMember> {
  if (!canEditSetupStaffPhoto(member)) throw new Error("사진 정보를 다시 불러와 주세요.");
  return {
    profileImageAssetIds: (member.profileImageAssetIds ?? []).slice(1),
    profileImageUrls: (member.profileImageUrls ?? []).slice(1),
    profileImageUrl: member.profileImageUrls?.[1] ?? "",
  };
}
