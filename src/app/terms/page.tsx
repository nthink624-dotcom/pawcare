import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { ownerSignupTerms } from "@/lib/auth/owner-signup-terms";

export default function TermsPage() {
  const serviceTerms = ownerSignupTerms.find((term) => term.id === "service");
  const locationTerms = ownerSignupTerms.find((term) => term.id === "location");

  return (
    <LegalPageLayout
      title="이용약관"
      subtitle="펫매니저 서비스 이용과 관련된 기본 규정과 위치기반서비스 안내를 확인할 수 있어요."
    >
      {serviceTerms ? <LegalSection title={serviceTerms.title} body={serviceTerms.content} /> : null}
      {locationTerms ? <LegalSection title={locationTerms.title} body={locationTerms.content} /> : null}
    </LegalPageLayout>
  );
}
