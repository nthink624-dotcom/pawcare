import LegalPageLayout, { LegalSection } from "@/components/legal/legal-page-layout";
import { ownerPaidServiceTerms } from "@/lib/auth/owner-paid-service-terms";
import { OWNER_SINGLE_MONTHLY_PRICE_KRW } from "@/lib/billing/owner-plans";
import { LEGAL_OPERATOR_NAME, LEGAL_SERVICE_NAME } from "@/lib/legal/legal-info";

const refundSummary = `${LEGAL_SERVICE_NAME}는 ${LEGAL_OPERATOR_NAME}가 운영합니다. 카드 명세서와 결제대행 과정에는 운영사명인 ${LEGAL_OPERATOR_NAME}로 표시될 수 있습니다.

${LEGAL_SERVICE_NAME}는 카드 등록 없이 14일 무료체험을 시작하고, 계속 사용하려는 시점에 직접 결제를 진행하는 방식으로 운영됩니다.

- 무료체험 기간 중에는 요금이 청구되지 않습니다.
- 무료체험이 끝난 뒤에는 자동결제되지 않으며, 결제 전까지 서비스 사용이 제한될 수 있습니다.
- 로그인, 요금제 확인, 결제, 설정 등 결제 관련 기능은 계속 이용할 수 있습니다.
- 결제를 완료하면 즉시 다시 사용할 수 있습니다.
- 유료서비스는 월 ${OWNER_SINGLE_MONTHLY_PRICE_KRW.toLocaleString("ko-KR")}원(VAT 포함) 월 단위 정기결제 상품입니다. 구독 1개는 매장 1곳 기준이며 직원 수 제한은 없습니다. 여러 매장은 매장별로 별도 구독이 필요합니다.
- 이용자가 결제에 동의하고 카드를 등록한 뒤에만 결제가 시작됩니다.
- 다음 결제부터 해지하면 현재 이용 기간까지 사용할 수 있고, 다음 결제일에는 자동 결제가 진행되지 않습니다.
- 환불 또는 청약철회 요청은 고객센터를 통해 접수할 수 있으며, 관련 법령과 실제 서비스 제공 여부를 기준으로 안내됩니다.`;

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
