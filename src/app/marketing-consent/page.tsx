import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { ownerSignupTerms } from "@/lib/auth/owner-signup-terms";
import { LEGAL_OPERATOR_NAME, LEGAL_SERVICE_NAME } from "@/lib/legal/legal-info";

export default function MarketingConsentPage() {
  const marketingConsent = ownerSignupTerms.find((term) => term.id === "marketing");

  return (
    <LegalPageLayout
      title="이벤트·혜택 정보 수신 동의"
      subtitle={`${LEGAL_SERVICE_NAME}의 선택 마케팅 수신 동의 내용입니다. 운영 주체는 ${LEGAL_OPERATOR_NAME}입니다.`}
    >
      {marketingConsent ? <LegalSection title={marketingConsent.title} body={marketingConsent.content} /> : null}
    </LegalPageLayout>
  );
}
