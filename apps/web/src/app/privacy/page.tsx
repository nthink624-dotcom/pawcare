import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { PUBLIC_PRIVACY_POLICY } from "@/lib/legal/privacy-policy";
import { LEGAL_OPERATOR_NAME, LEGAL_SERVICE_NAME } from "@/lib/legal/legal-info";

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="개인정보처리방침"
      subtitle={`${LEGAL_SERVICE_NAME} 이용 과정에서 수집되는 정보와 보호 방식을 안내합니다. 운영 주체는 ${LEGAL_OPERATOR_NAME}입니다.`}
    >
      <LegalSection title="개인정보처리방침" body={PUBLIC_PRIVACY_POLICY} />
    </LegalPageLayout>
  );
}
