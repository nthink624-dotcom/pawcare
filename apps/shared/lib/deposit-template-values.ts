import type { BookingPolicy, BookingPreparation } from "../contracts/booking-preparation";

/** The dispatch and preview use the same deposit substitutions. */
export function buildDepositTemplateValues(
  policy: BookingPolicy,
  deposit?: BookingPreparation["deposit"],
) {
  return {
    예약금액: (deposit?.amount ?? policy.depositAmount).toLocaleString("ko-KR"),
    은행명: policy.bankName || "[은행 미설정]",
    입금계좌: policy.bankAccount || "[계좌번호 미설정]",
    예금주: policy.bankHolder || "[예금주 미설정]",
    납부기한: deposit?.dueAt
      ? new Date(deposit.dueAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
      : "예약금 요청 후 20분 이내 (예시)",
    기한안내: !deposit || deposit.releaseIfUnreported
      ? "20분 안에 입금 신고가 없으면 예약이 취소되고 다른 고객이 해당 시간을 예약할 수 있습니다. 입금 신고 후에는 매장 확인을 기다려 주세요."
      : "납부 기한과 예약 상태를 예약 확인 페이지에서 확인해 주세요.",
  };
}
