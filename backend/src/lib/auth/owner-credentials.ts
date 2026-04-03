export const ownerPasswordRuleMessage = "비밀번호는 영문 대문자, 영문 소문자, 숫자, 특수문자 중 3종류 이상을 포함해야 합니다.";

export function normalizeOwnerLoginId(value: string) {
  return value.trim().toLowerCase();
}

export function isValidOwnerLoginId(value: string) {
  return /^[a-z0-9](?:[a-z0-9._-]{3,29})$/.test(normalizeOwnerLoginId(value));
}

export function buildOwnerAuthEmail(loginId: string) {
  return `${normalizeOwnerLoginId(loginId)}@owner.pawcare.local`;
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

  return categories >= 3;
}
