import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { ownerSignupTerms } from "@/lib/auth/owner-signup-terms";
import { LEGAL_OPERATOR_NAME, LEGAL_SERVICE_NAME } from "@/lib/legal/legal-info";

export default function PrivacyConsentPage() {
  const privacyConsent = ownerSignupTerms.find((term) => term.id === "privacy");

  return (
    <LegalPageLayout
      title="개인정보 수집 및 이용 동의"
      subtitle={`${LEGAL_SERVICE_NAME} 가입과 운영에 필요한 개인정보 수집·이용 안내입니다. 운영 주체는 ${LEGAL_OPERATOR_NAME}입니다.`}
    >
      {privacyConsent ? <LegalSection title={privacyConsent.title} body={privacyConsent.content} /> : null}
    </LegalPageLayout>
  );
}
