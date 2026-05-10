export const OWNER_AUTH_EMAIL_DOMAIN = "owner.petmanager.local";
export const LEGACY_OWNER_AUTH_EMAIL_DOMAIN = "owner.pawcare.local";

export function normalizeOwnerLoginId(value: string) {
  return value.trim().toLowerCase();
}

export function buildOwnerAuthEmail(loginId: string) {
  return `${normalizeOwnerLoginId(loginId)}@${OWNER_AUTH_EMAIL_DOMAIN}`;
}

export function buildLegacyOwnerAuthEmail(loginId: string) {
  return `${normalizeOwnerLoginId(loginId)}@${LEGACY_OWNER_AUTH_EMAIL_DOMAIN}`;
}

export function buildOwnerAuthEmailCandidates(loginId: string) {
  return Array.from(new Set([buildOwnerAuthEmail(loginId), buildLegacyOwnerAuthEmail(loginId)]));
}
