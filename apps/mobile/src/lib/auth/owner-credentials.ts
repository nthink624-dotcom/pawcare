export const ownerPasswordRuleMessage = "비밀번호는 영문 대문자, 영문 소문자, 숫자, 특수문자 중 3종류 이상을 포함해야 합니다.";

export function normalizeOwnerEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidOwnerEmail(value: string) {
  const email = normalizeOwnerEmail(value);
  const domain = email.split("@")[1];
  const retiredAliasDomains = new Set([
    "owner.petmanager.co.kr",
    "owner.petmanager.local",
    "owner.pawcare.local",
  ]);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !retiredAliasDomains.has(domain);
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

  return categories >= 3;
}
