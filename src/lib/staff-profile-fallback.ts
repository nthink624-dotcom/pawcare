export const staffProfileFallbackKeys = [
  "korean-groomer-profile-01",
  "korean-groomer-profile-02",
] as const;

export type StaffProfileFallbackKey = (typeof staffProfileFallbackKeys)[number];

const staffProfileFallbackImageUrls: Record<StaffProfileFallbackKey, string> = {
  "korean-groomer-profile-01": "/images/profiles/korean-groomer-profile-01.jpg",
  "korean-groomer-profile-02": "/images/profiles/korean-groomer-profile-02.jpg",
};

// Keep the first preset as a display-only fail-safe for legacy payloads.
export const staffProfileFallbackKey = staffProfileFallbackKeys[0];
export const staffProfileFallbackImageUrl = staffProfileFallbackImageUrls[staffProfileFallbackKey];

export function isStaffProfileFallbackKey(value: unknown): value is StaffProfileFallbackKey {
  return typeof value === "string" && staffProfileFallbackKeys.includes(value as StaffProfileFallbackKey);
}

export function resolveStaffProfileFallbackImageUrl(key?: string | null) {
  return isStaffProfileFallbackKey(key) ? staffProfileFallbackImageUrls[key] : "";
}

export function getStaffProfileImageCandidates(
  uploadedProfileUrl?: string | null,
  fallbackKey?: string | null,
) {
  const uploaded = uploadedProfileUrl?.trim();
  const fallback = resolveStaffProfileFallbackImageUrl(fallbackKey) || staffProfileFallbackImageUrl;
  return uploaded ? [uploaded, fallback] : [fallback];
}
