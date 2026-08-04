export const ownerPasswordRuleMessage =
  "비밀번호 규칙에 맞지 않습니다. 6자 이상, 영문 대문자·소문자·숫자·특수문자 중 3종류 이상을 포함해 주세요.";

/**
 * Owner accounts now use a real email address as their sign-in identifier.
 * `login_id` remains the legacy database column name until the wider data
 * model is migrated, but it stores this normalized email for every new owner.
 */
export function normalizeOwnerEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidOwnerEmail(value: string) {
  const email = normalizeOwnerEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeOwnerPhoneNumber(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (digits.startsWith("82") && digits.length >= 11) {
    return `0${digits.slice(2)}`.slice(0, 11);
  }

  return digits.slice(0, 11);
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
