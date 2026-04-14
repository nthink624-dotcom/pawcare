import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { ownerPaidServiceTerms } from "@/lib/auth/owner-paid-service-terms";

const refundSummary = `펫매니저는 카드 등록 없이 2주 무료체험을 시작하고, 계속 사용하려는 시점에 직접 결제를 진행하는 방식으로 운영됩니다.

- 무료체험 기간 중에는 요금이 청구되지 않습니다.
- 무료체험이 끝난 뒤에는 자동결제되지 않으며, 결제 전까지 서비스 사용이 제한될 수 있습니다.
- 로그인, 요금제 확인, 결제, 설정 등 결제 관련 기능은 계속 이용할 수 있습니다.
- 결제를 완료하면 즉시 다시 사용할 수 있습니다.
- 1개월 플랜은 일반결제로 1회 결제 후 1개월 동안 이용하는 상품입니다.
- 3개월, 6개월, 12개월 플랜은 약정기간 동안 매달 자동 청구되는 정기결제 상품입니다.
- 이미 결제된 월 이용분의 환불 여부와 해지 시점은 결제 화면과 유료서비스 이용약관에 따라 안내됩니다.`;

export default function RefundPage() {
  return (
    <LegalPageLayout
      title="환불 및 이용 안내"
      subtitle="무료체험, 결제, 해지와 환불 기준을 한 화면에서 확인할 수 있어요."
    >
      <LegalSection title="기본 정책" body={refundSummary} />
      <LegalSection title="유료서비스 이용약관" body={ownerPaidServiceTerms} />
    </LegalPageLayout>
  );
}
