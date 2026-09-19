export const staffProfileFallbackKeys = [
  "korean-groomer-profile-01",
  "korean-groomer-profile-02",
] as const;

export type StaffProfileFallbackKey = (typeof staffProfileFallbackKeys)[number];

const staffProfileFallbackImageUrls: Record<StaffProfileFallbackKey, string> = {
  "korean-groomer-profile-01": "/images/profiles/korean-groomer-profile-01.jpg",
  "korean-groomer-profile-02": "/images/profiles/korean-groomer-profile-02.jpg",
};

export const defaultStaffProfileFallbackKey: StaffProfileFallbackKey = "korean-groomer-profile-01";

export function isStaffProfileFallbackKey(value: unknown): value is StaffProfileFallbackKey {
  return typeof value === "string" && staffProfileFallbackKeys.includes(value as StaffProfileFallbackKey);
}

export function resolveStaffProfileFallbackImageUrl(key?: string | null) {
  return isStaffProfileFallbackKey(key) ? staffProfileFallbackImageUrls[key] : "";
}

export function resolveStaffProfileFallbackOrDefaultImageUrl(key?: string | null) {
  return resolveStaffProfileFallbackImageUrl(key) || staffProfileFallbackImageUrls[defaultStaffProfileFallbackKey];
}
