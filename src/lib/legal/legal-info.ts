export const LEGAL_SERVICE_NAME = "멍매니저";
export const LEGAL_OPERATOR_NAME = "오도독상회";

export const LEGAL_BUSINESS_INFO = {
  serviceName: LEGAL_SERVICE_NAME,
  operatorName: LEGAL_OPERATOR_NAME,
  representativeName: "정우진",
  businessRegistrationNumber: "689-01-03675",
  address: "충청남도 천안시 서북구 미라9길 14, 지하1층(쌍용동, 영화빌딩)",
  customerServicePhone: "010-8357-2070",
  customerServiceEmail: "nthink624@gmail.com",
  privacyTrusteeName: "코리아포트원",
  privacyTrusteeTask: "결제 연동 서비스 제공",
} as const;

export const LEGAL_LINKS = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund", label: "환불정책" },
  { href: "/business", label: "사업자 정보" },
] as const;
