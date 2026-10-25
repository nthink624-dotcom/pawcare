import type { BootstrapPayload, BootstrapStaffMember } from "@/types/domain";

function normalizedProfileIdentity(staffMember: BootstrapStaffMember) {
  const assetId = staffMember.profileImageAssetIds?.[0]?.trim();
  if (assetId) return `asset:${assetId}`;

  const profileImageUrl = staffMember.profileImageUrl?.trim();
  if (!profileImageUrl) return null;

  try {
    const parsed = new URL(profileImageUrl);
    return `url:${parsed.origin}${parsed.pathname}`;
  } catch {
    return `url:${profileImageUrl.split(/[?#]/, 1)[0]}`;
  }
}

/**
 * Background bootstrap refreshes may renew only a signed-query portion of a
 * staff profile URL. Keep the still-valid rendered URL when its durable media
 * identity is unchanged so the reservation header does not remount or flash.
 */
export function keepStableStaffProfileUrls(
  previous: BootstrapPayload,
  next: BootstrapPayload,
): BootstrapPayload {
  const previousByStaffId = new Map(previous.staffMembers.map((staffMember) => [staffMember.id, staffMember]));

  return {
    ...next,
    staffMembers: next.staffMembers.map((staffMember) => {
      const previousStaffMember = previousByStaffId.get(staffMember.id);
      if (!previousStaffMember || !previousStaffMember.profileImageUrl?.trim()) return staffMember;
      if (normalizedProfileIdentity(previousStaffMember) !== normalizedProfileIdentity(staffMember)) return staffMember;

      return {
        ...staffMember,
        profileImageUrl: previousStaffMember.profileImageUrl,
      };
    }),
  };
}
