/**
 * PetManager PC·모바일 공통 알림톡 계약의 정본입니다.
 *
 * 이 파일은 DB·Supabase·Ssodaa에 쓰지 않습니다.
 * 승인된 템플릿의 코드·본문·버튼·변수 계약만 소스에서 공유합니다.
 */
export const ALIMTALK_CONTRACT_VERSION = "2026-09-25" as const;

export type AlimtalkContract = {
  code: string;
  body: string;
  button: string | null;
  variables: readonly string[];
};

export const APPROVED_ALIMTALK_CONTRACTS = {
  booking_confirmed: {
    code: "booking_confirmed",
    body: `[#{매장명}]\n\n#{보호자명}님, #{반려동물명} 예약이 확정되었어요.\n방문해 주셔서 감사합니다. 예약하신 날 편안하게 뵐 수 있도록 준비하고 있을게요.\n\n방문 일정: #{예약일시}\n예약 서비스: #{서비스명}\n\n당일 필요한 내용은 방문하실 때 편하게 말씀해 주세요.\n아래 예약 확인 버튼에서 일정을 다시 확인하실 수 있어요.`,
    button: "예약 확인",
    variables: ["매장명", "보호자명", "반려동물명", "예약일시", "서비스명"],
  },
  booking_cancelled: {
    code: "booking_cancelled",
    body: `[#{매장명}]\n\n#{보호자명}님, 부득이하게 매장 측 사정으로\n아래 예약을 진행하기 어려워 취소 처리되었습니다.\n\n기다리셨을 텐데 일정에 불편을 드려 진심으로 죄송합니다.\n\n예약 일시: #{예약일시}\n예약 서비스: #{서비스명}\n\n불편을 드린 만큼, 다음에는 일정 확인부터 더 세심하게 챙기겠습니다.`,
    button: "예약 가능한 시간 보기",
    variables: ["매장명", "보호자명", "예약일시", "서비스명"],
  },
  visit_schedule_notice: {
    code: "visit_schedule_notice",
    body: `[#{매장명}]\n\n#{보호자명}님, 내일 #{반려동물명}을 뵐 일정 안내드려요.\n\n방문 일시: #{예약일시}\n예약 서비스: #{서비스명}\n\n내일 편안하게 방문하실 수 있도록 잘 준비하고 있겠습니다.`,
    button: "예약 확인",
    variables: ["매장명", "보호자명", "반려동물명", "예약일시", "서비스명"],
  },
  visit_reminder_notice: {
    code: "visit_reminder_notice",
    body: `[#{매장명}]\n\n#{보호자명}님, 오늘 #{반려동물명}을 뵐 일정 안내드려요.\n\n방문 일시: #{예약일시}\n예약 서비스: #{서비스명}\n\n예약 시간에 맞춰 편하게 방문해 주세요.\n오시는 길 조심히 오세요. 오늘 뵙겠습니다.`,
    button: "예약 확인",
    variables: ["매장명", "보호자명", "반려동물명", "예약일시", "서비스명"],
  },
  appointment_reminder_10m: {
    code: "appointment_reminder_10m",
    body: `[#{매장명}]\n\n#{보호자명}님, #{반려동물명}의 미용 시간이 가까워졌어요.\n\n방문 일시: #{예약일시}\n예약 서비스: #{서비스명}\n\n예약 시간에 맞춰 방문해 주세요.\n오시는 길 조심히 오세요. 곧 뵙겠습니다.`,
    button: "예약 확인",
    variables: ["매장명", "보호자명", "반려동물명", "예약일시", "서비스명"],
  },
  grooming_started: {
    code: "grooming_started",
    body: `[#{매장명}]\n\n#{보호자명}님, #{반려동물명} 미용을 시작했어요.\n\n이제 잠시 편하게 기다려 주세요.\n마무리되면 바로 안내드릴게요.`,
    button: null,
    variables: ["매장명", "보호자명", "반려동물명"],
  },
} as const satisfies Record<string, AlimtalkContract>;

export type ApprovedAlimtalkCode = keyof typeof APPROVED_ALIMTALK_CONTRACTS;

