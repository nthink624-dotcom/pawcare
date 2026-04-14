import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { PUBLIC_PRIVACY_POLICY } from "@/lib/legal/privacy-policy";

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="개인정보처리방침"
      subtitle="펫매니저 이용 과정에서 수집되는 정보와 보호 방식을 안내합니다."
    >
      <LegalSection title="개인정보처리방침" body={PUBLIC_PRIVACY_POLICY} />
    </LegalPageLayout>
  );
}
