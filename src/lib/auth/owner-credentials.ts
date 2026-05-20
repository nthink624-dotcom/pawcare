export const ownerPasswordRuleMessage =
  "비밀번호 규칙에 맞지 않습니다. 6자 이상, 영문 대문자·소문자·숫자·특수문자 중 3종류 이상을 포함해 주세요.";

export function normalizeOwnerLoginId(value: string) {
  return value.trim().toLowerCase();
}

export function isValidOwnerLoginId(value: string) {
  return /^[a-z0-9](?:[a-z0-9._-]{3,29})$/.test(normalizeOwnerLoginId(value));
}

export function buildOwnerAuthEmail(loginId: string) {
  return `${normalizeOwnerLoginId(loginId)}@owner.petmanager.local`;
}

export function buildLegacyOwnerAuthEmail(loginId: string) {
  return `${normalizeOwnerLoginId(loginId)}@owner.pawcare.local`;
}

export function buildOwnerAuthEmailCandidates(loginId: string, existingEmail?: string | null) {
  return Array.from(
    new Set(
      [existingEmail, buildOwnerAuthEmail(loginId), buildLegacyOwnerAuthEmail(loginId)].filter(
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
