import type { BootstrapPayload } from "@/types/domain";

const DEMO_PROFILE_IMAGES = [
  "/images/profiles/korean-groomer-profile-01.jpg",
  "/images/profiles/korean-groomer-profile-02.jpg",
] as const;

export function withLandingDemoProfiles(data: BootstrapPayload): BootstrapPayload {
  return {
    ...data,
    mode: "mock",
    staffMembers: data.staffMembers.map((staff, index) => {
      const profileImageUrl = DEMO_PROFILE_IMAGES[index % DEMO_PROFILE_IMAGES.length];
      return { ...staff, profileImageUrl, profileImageUrls: [profileImageUrl] };
    }),
  };
}
