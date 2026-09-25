import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { LEGAL_OPERATOR_NAME, LEGAL_SERVICE_NAME } from "@/lib/legal/legal-info";
import { MARKETING_TRIAL_BENEFIT_TERMS } from "@/lib/legal/marketing-trial-benefit-terms";

export default function MarketingBenefitTermsPage() {
  return (
    <LegalPageLayout
      title="마케팅 수신 동의 30일 추가 체험 안내"
      subtitle={`${LEGAL_SERVICE_NAME} 신규 가입 프로모션 안내입니다. 운영 주체는 ${LEGAL_OPERATOR_NAME}입니다.`}
    >
      <LegalSection title="30일 추가 체험 계약" body={MARKETING_TRIAL_BENEFIT_TERMS} />
    </LegalPageLayout>
  );
}
