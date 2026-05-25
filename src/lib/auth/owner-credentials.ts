export const ownerPasswordRuleMessage =
  "비밀번호 규칙에 맞지 않습니다. 6자 이상, 영문 대문자·소문자·숫자·특수문자 중 3종류 이상을 포함해 주세요.";

export function normalizeOwnerLoginId(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeOwnerPhoneNumber(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (digits.startsWith("82") && digits.length >= 11) {
    return `0${digits.slice(2)}`.slice(0, 11);
  }

  return digits.slice(0, 11);
}

export function isValidOwnerLoginId(value: string) {
  return /^[a-z0-9](?:[a-z0-9._-]{3,29})$/.test(normalizeOwnerLoginId(value));
}

const OWNER_AUTH_EMAIL_DOMAIN = "owner.petmanager.co.kr";
const PREVIOUS_OWNER_AUTH_EMAIL_DOMAIN = "owner.petmanager.local";
const LEGACY_OWNER_AUTH_EMAIL_DOMAIN = "owner.pawcare.local";

export function buildOwnerAuthEmail(loginId: string) {
  return `${normalizeOwnerLoginId(loginId)}@${OWNER_AUTH_EMAIL_DOMAIN}`;
}

export function buildPreviousOwnerAuthEmail(loginId: string) {
  return `${normalizeOwnerLoginId(loginId)}@${PREVIOUS_OWNER_AUTH_EMAIL_DOMAIN}`;
}

export function buildLegacyOwnerAuthEmail(loginId: string) {
  return `${normalizeOwnerLoginId(loginId)}@${LEGACY_OWNER_AUTH_EMAIL_DOMAIN}`;
}

export function isLegacyOwnerAuthEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return (
    normalized.endsWith(`@${PREVIOUS_OWNER_AUTH_EMAIL_DOMAIN}`) ||
    normalized.endsWith(`@${LEGACY_OWNER_AUTH_EMAIL_DOMAIN}`)
  );
}

export function buildOwnerAuthEmailCandidates(loginId: string, existingEmail?: string | null) {
  return Array.from(
    new Set(
      [
        existingEmail,
        buildOwnerAuthEmail(loginId),
        buildPreviousOwnerAuthEmail(loginId),
        buildLegacyOwnerAuthEmail(loginId),
      ].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
}

export function isValidBirthDate8(value: string) {
  return /^\d{8}$/.test(value);
}

export function isValidOwnerPassword(value: string) {
  const categories = [
    /[A-Z]/.test(value),
    /[a-z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;

  return value.length >= 6 && categories >= 3;
}
