import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { ownerPaidServiceTerms } from "@/lib/auth/owner-paid-service-terms";

const refundSummary = `환불 및 구독 해지와 관련된 핵심 안내

- 무료체험 기간 내 해지하면 요금이 부과되지 않습니다.
- 결제 후 환불 여부는 전자상거래법, 회사 정책, 이용 내역에 따라 적용됩니다.
- 유료서비스 관련 법적 책임 주체는 오도독상회입니다.
- 자동결제 해지는 다음 결제일 24시간 전까지 진행해 주세요.`;

export default function RefundPage() {
  return (
    <LegalPageLayout
      title="환불정책"
      subtitle="구독, 무료체험, 환불 및 해지 절차를 한 화면에서 확인할 수 있어요."
    >
      <LegalSection title="핵심 안내" body={refundSummary} />
      <LegalSection title="유료서비스 이용약관" body={ownerPaidServiceTerms} />
    </LegalPageLayout>
  );
}
