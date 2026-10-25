/** Submission-ready contracts, NOT provider approval or active mappings. */
import type { AlimtalkContract } from "./alimtalk";
export const DEPOSIT_ALIMTALK_REVIEW_CONTRACTS = {
  booking_deposit_request: {
    code: "booking_deposit_request_v2",
    body: `[#{매장명}]\n\n#{보호자명}님, #{반려동물명} 예약금 납부 안내입니다.\n\n방문 일정: #{예약일시}\n예금주: #{예금주}\n입금 은행: #{은행명}\n입금 계좌: #{입금계좌}\n예약금: #{예약금액}원\n납부 기한: #{납부기한}\n\n기한 안에 이체한 뒤 아래 버튼에서 입금자명을 남겨 주세요.\n#{기한안내}`,
    button: "예약금 입금 신고", variables: ["매장명","보호자명","반려동물명","예약일시","예금주","은행명","입금계좌","예약금액","납부기한","기한안내","예약관리토큰"],
  },
  booking_deposit_cancelled: {
    code: "booking_deposit_cancelled_v1",
    body: `[#{매장명}]\n\n#{보호자명}님, #{반려동물명}의 예약 취소가 접수되었습니다.\n\n방문 일정: #{예약일시}\n\n예약금과 환불 처리 상태는 아래 예약 확인에서 확인해 주세요.`,
    button: "예약 확인", variables: ["매장명","보호자명","반려동물명","예약일시","예약관리토큰"],
  },
  booking_deposit_expired: {
    code: "booking_deposit_expired_v1",
    body: `[#{매장명}]\n\n#{보호자명}님, #{반려동물명}의 예약금 입금 신고 기한이 지나 예약이 취소되었습니다.\n\n방문 일정: #{예약일시}\n\n이미 송금하셨다면 매장에 문의해 주세요. 취소된 예약은 자동으로 복구되지 않습니다.\n자세한 상태는 아래 예약 확인에서 확인해 주세요.`,
    button: "예약 확인", variables: ["매장명","보호자명","반려동물명","예약일시","예약관리토큰"],
  },
  booking_deposit_refunded: {
    code: "booking_deposit_refunded_v1",
    body: `[#{매장명}]\n\n#{보호자명}님, #{반려동물명} 예약의 예약금 환불 완료가 기록되었습니다.\n\n방문 일정: #{예약일시}\n\n입금 내역을 확인해 주세요. 환불 금액과 처리 상태는 아래 예약 확인에서 확인하실 수 있습니다.`,
    button: "예약 확인", variables: ["매장명","보호자명","반려동물명","예약일시","예약관리토큰"],
  },
} as const satisfies Record<string,AlimtalkContract>;
