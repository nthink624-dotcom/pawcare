import { PETMANAGER_LEGAL_OPERATOR_NAME } from "@/lib/brand";

export const PUBLIC_LEGAL_URLS = {
  terms: "https://www.petmanager.co.kr/terms",
  privacy: "https://www.petmanager.co.kr/privacy",
  refund: "https://www.petmanager.co.kr/refund",
  business: "https://www.petmanager.co.kr/business",
} as const;

export const PUBLIC_LEGAL_LINKS = [
  { key: "terms", label: "이용약관", href: PUBLIC_LEGAL_URLS.terms },
  { key: "privacy", label: "개인정보처리방침", href: PUBLIC_LEGAL_URLS.privacy },
  { key: "refund", label: "환불 및 이용 안내", href: PUBLIC_LEGAL_URLS.refund },
  { key: "business", label: "사업자 정보", href: PUBLIC_LEGAL_URLS.business },
] as const;

export const PUBLIC_LEGAL_CONTACT = {
  companyName: PETMANAGER_LEGAL_OPERATOR_NAME,
  representativeName: "정우진",
  businessRegistrationNumber: "462-16-02885",
  phone: "041-557-5529",
  email: "nthink624@gmail.com",
} as const;

export function getPublicLegalTelHref(phone = PUBLIC_LEGAL_CONTACT.phone) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function getPublicLegalMailtoHref(email = PUBLIC_LEGAL_CONTACT.email) {
  return `mailto:${email}`;
}
