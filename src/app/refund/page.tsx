import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { ownerPaidServiceTerms } from "@/lib/auth/owner-paid-service-terms";

const refundSummary = `멍매니저는 카드 등록 없이 2주 무료체험을 시작하고, 계속 사용하려는 시점에 직접 결제를 진행하는 방식으로 운영됩니다.

- 무료체험 기간 중에는 요금이 청구되지 않습니다.
- 무료체험이 끝난 뒤에는 자동결제되지 않으며, 결제 전까지 서비스 사용이 제한될 수 있습니다.
- 로그인, 요금제 확인, 결제, 설정 등 결제 관련 기능은 계속 이용할 수 있습니다.
- 결제를 완료하면 즉시 다시 사용할 수 있습니다.
- 유료 플랜은 선결제 상품이며, 중도 해지 시 환불금은 사용 시점까지의 공개 플랜 기준으로 재산정됩니다.
- 재산정 후 남은 금액이 있는 경우에만 환불되며, 환불금이 0원 미만인 경우 추가 청구는 하지 않습니다.`;

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
