import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { ownerSignupTerms } from "@/lib/auth/owner-signup-terms";
import { LEGAL_OPERATOR_NAME, LEGAL_SERVICE_NAME } from "@/lib/legal/legal-info";

export default function TermsPage() {
  const serviceTerms = ownerSignupTerms.find((term) => term.id === "service");
  const locationTerms = ownerSignupTerms.find((term) => term.id === "location");

  return (
    <LegalPageLayout
      title="이용약관"
      subtitle={`${LEGAL_SERVICE_NAME} 이용과 관련된 기본 규정입니다. 운영 주체는 ${LEGAL_OPERATOR_NAME}입니다.`}
    >
      {serviceTerms ? <LegalSection title={serviceTerms.title} body={serviceTerms.content} /> : null}
      {locationTerms ? <LegalSection title={locationTerms.title} body={locationTerms.content} /> : null}
    </LegalPageLayout>
  );
}
