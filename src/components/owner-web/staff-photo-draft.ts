import type { StaffDraft, StaffMember } from "@/components/owner-web/staff-management-model";
import type { StaffProfilePhotoUploadResult } from "@/components/owner-web/staff-profile-photo-field";

export function hasStaffProfileChoice(draft: StaffDraft, existing?: StaffMember) {
  return Boolean(draft.profileImageFile || draft.profileImageUrl.trim() || draft.profileImageFallbackKey
    || existing?.profileImageAssetIds?.length || existing?.profileImageUrls?.length);
}

export async function prepareStaffProfilePhoto({ draft, existing, upload, onUploaded }: {
  draft: StaffDraft;
  existing?: StaffMember;
  upload: (file: File) => Promise<StaffProfilePhotoUploadResult>;
  onUploaded: (photo: StaffProfilePhotoUploadResult) => void;
}) {
  const existingUrls = existing?.profileImageUrls?.length
    ? existing.profileImageUrls
    : existing?.profileImageUrl ? [existing.profileImageUrl] : [];
  const existingIds = existing?.profileImageAssetIds ?? [];
  let uploaded = draft.profileImagePendingUpload;
  if (draft.profileImageFile && !uploaded) {
    if (existingUrls.length >= 3 || existingIds.length >= 3) {
      throw new Error("기존 프로필 사진이 3장입니다. 매장 정보에서 사진을 정리한 뒤 다시 올려 주세요.");
    }
    uploaded = await upload(draft.profileImageFile);
    onUploaded(uploaded);
  }
  if (uploaded) {
    return {
      profileImageUrl: uploaded.signedUrl,
      profileImageUrls: [uploaded.signedUrl, ...existingUrls.filter((url) => url !== uploaded.signedUrl)],
      profileImageAssetIds: [uploaded.mediaAssetId, ...existingIds.filter((id) => id !== uploaded.mediaAssetId)],
      profileImageFallbackKey: draft.profileImageFallbackKey ?? null,
    };
  }
  const choseDefault = draft.profileImageChoice === "default" && Boolean(draft.profileImageFallbackKey);
  return {
    profileImageUrl: draft.profileImageUrl.trim(),
    profileImageUrls: choseDefault ? [] : existingUrls,
    profileImageAssetIds: choseDefault ? [] : existingIds,
    profileImageFallbackKey: draft.profileImageFallbackKey ?? null,
  };
}
