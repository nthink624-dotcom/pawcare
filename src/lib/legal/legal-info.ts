export const LEGAL_SERVICE_NAME = "펫매니저";
export const LEGAL_OPERATOR_NAME = "오도독상회";

export const LEGAL_BUSINESS_INFO = {
  serviceName: LEGAL_SERVICE_NAME,
  operatorName: LEGAL_OPERATOR_NAME,
  representativeName: "정우진",
  businessRegistrationNumber: "689-01-03675",
  address: "충청남도 천안시 동남구 미라9길 14 지하 1층",
  customerServicePhone: "010-8357-2070",
  customerServiceEmail: "nthink624@gmail.com",
  hostingProvider: "Vercel Inc.",
  privacyTrusteeName: "정우진",
  privacyTrusteeTask: "개인정보 처리 및 보호",
} as const;

export const LEGAL_LINKS = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund", label: "환불 안내" },
  { href: "/business", label: "사업자 정보" },
] as const;
