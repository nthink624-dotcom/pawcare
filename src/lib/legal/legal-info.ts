export const LEGAL_SERVICE_NAME = "넘친Day 펫매니저";
export const LEGAL_OPERATOR_NAME = "넘친 Day";
export const LEGAL_SERVICE_OPERATOR_NOTICE = `${LEGAL_SERVICE_NAME}는 ${LEGAL_OPERATOR_NAME}가 운영하는 반려동물 미용샵 운영 지원 서비스입니다.`;

export const LEGAL_BUSINESS_INFO = {
  serviceName: LEGAL_SERVICE_NAME,
  operatorName: LEGAL_OPERATOR_NAME,
  representativeName: "정우진",
  businessRegistrationNumber: "462-16-02885",
  address: "충청남도 천안시 동남구 미라9길 14 지하 1층",
  customerServicePhone: "041-557-5529",
  customerServiceEmail: "nthink624@gmail.com",
  hostingProvider: "Vercel Inc.",
  telecomSalesRegistration: "2026-충남천안-1640",
  paymentProvider: "NHN KCP",
  privacyTrusteeName: "코리아포트원 주식회사",
  privacyTrusteeTask: "전자결제 및 휴대폰 본인인증 연동",
  paymentStatementName: LEGAL_OPERATOR_NAME,
} as const;

export const LEGAL_LINKS = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund", label: "환불 안내" },
  { href: "/business", label: "사업자 정보" },
] as const;
