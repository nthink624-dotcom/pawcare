export const ownerPasswordRuleMessage = "비밀번호는 영문 대문자, 영문 소문자, 숫자, 특수문자 중 3종류 이상을 포함해야 합니다.";

/**
 * Owner accounts use a real, normalized email address everywhere.
 * The database keeps `login_id` only as a legacy field name; its value is
 * always this email and must never be a username or an internal alias.
 */
export function normalizeOwnerEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidOwnerEmail(value: string) {
  const email = normalizeOwnerEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
