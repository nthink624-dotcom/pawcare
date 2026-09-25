export type OwnerWebScreenKey = "reservations" | "customers" | "calendar" | "stats" | "settings";

export const ownerWebScreenLabels: Array<{ key: OwnerWebScreenKey; label: string; description: string }> = [
  { key: "reservations", label: "예약 관리", description: "오늘과 이번 주 예약을 빠르게 조정하는 화면" },
  { key: "customers", label: "고객 관리", description: "고객 정보와 재방문 흐름을 정리하는 화면" },
  { key: "calendar", label: "캘린더", description: "시간표 위에서 예약 블록을 관리하는 화면" },
  { key: "stats", label: "통계", description: "예약, 매출, 재방문율을 한 번에 보는 화면" },
  { key: "settings", label: "설정", description: "매장 운영 정책과 알림, 결제를 관리하는 화면" },
];

export type ReservationStatus = "승인 대기" | "확정" | "진행 중" | "픽업 준비" | "완료" | "취소";

export const reservationRows = [
  {
    id: "R-2401",
    time: "10:30",
    customer: "정유진",
    pet: "우유",
    service: "전체 미용",
    staff: "원장",
    status: "승인 대기" as ReservationStatus,
    phone: "010-8498-2077",
    channel: "네이버 예약",
    note: "첫 방문 / 피부 민감",
  },
  {
    id: "R-2402",
    time: "11:30",
    customer: "김민지",
    pet: "몽이",
    service: "목욕 + 부분정리",
    staff: "서브",
    status: "확정" as ReservationStatus,
    phone: "010-1234-5678",
    channel: "고객 예약 링크",
    note: "픽업 13:00 요청",
  },
  {
    id: "R-2403",
    time: "13:00",
    customer: "박서준",
    pet: "코코",
    service: "목욕",
    staff: "원장",
    status: "진행 중" as ReservationStatus,
    phone: "010-9876-5432",
    channel: "카카오 채널",
    note: "미용 기록 사진 요청",
  },
  {
    id: "R-2404",
    time: "15:00",
    customer: "이수현",
    pet: "보리",
    service: "위생 미용",
    staff: "서브",
    status: "픽업 준비" as ReservationStatus,
    phone: "010-5555-1234",
    channel: "전화 접수",
    note: "완료 후 알림톡 발송",
  },
  {
    id: "R-2405",
    time: "17:30",
    customer: "한예지",
    pet: "하루",
    service: "전체 미용",
    staff: "원장",
    status: "완료" as ReservationStatus,
    phone: "010-2840-4421",
    channel: "재방문 예약",
    note: "3주 뒤 재예약 안내 필요",
  },
];

export const customerRows = [
  {
    id: "G-1001",
    name: "정유진",
    phone: "010-8498-2077",
    tags: ["신규", "상담 필요"],
    pets: ["우유"],
    recentVisit: "방문 전",
    nextBooking: "오늘 10:30",
    memo: "피부가 예민해서 향이 강한 샴푸는 피해주세요.",
    alerts: "알림톡 수신 중",
  },
  {
    id: "G-1002",
    name: "김민지",
    phone: "010-1234-5678",
    tags: ["정기 고객"],
    pets: ["몽이", "차이"],
    recentVisit: "4/28",
    nextBooking: "5/10 11:00",
    memo: "둘째는 드라이 소리에 예민해요.",
    alerts: "재방문 안내 켜짐",
  },
  {
    id: "G-1003",
    name: "박서준",
    phone: "010-9876-5432",
    tags: ["미납 없음"],
    pets: ["코코"],
    recentVisit: "4/24",
    nextBooking: "예약 없음",
    memo: "픽업 시간을 꼭 문자로 알려달라고 요청",
    alerts: "알림톡 수신 중",
  },
  {
    id: "G-1004",
    name: "이수현",
    phone: "010-5555-1234",
    tags: ["재방문 임박"],
    pets: ["보리"],
    recentVisit: "4/19",
    nextBooking: "오늘 15:00",
    memo: "미용 후 발톱 길이 사진 공유 요청",
    alerts: "재방문 안내 꺼짐",
  },
];

export const calendarBookings = [
  { id: "C-01", day: "월", start: 10, duration: 1.5, lane: 0, customer: "정유진", pet: "우유", service: "전체 미용", staff: "원장" },
  { id: "C-02", day: "월", start: 13, duration: 1, lane: 1, customer: "김민지", pet: "몽이", service: "목욕", staff: "서브" },
  { id: "C-03", day: "화", start: 11, duration: 2, lane: 0, customer: "박서준", pet: "코코", service: "목욕 + 부분정리", staff: "원장" },
  { id: "C-04", day: "수", start: 14, duration: 1.5, lane: 0, customer: "이수현", pet: "보리", service: "위생 미용", staff: "서브" },
  { id: "C-05", day: "목", start: 16, duration: 1.5, lane: 1, customer: "한예지", pet: "하루", service: "전체 미용", staff: "원장" },
];

export const revenueTrend = [
  { label: "4/22", value: 62 },
  { label: "4/23", value: 88 },
  { label: "4/24", value: 71 },
  { label: "4/25", value: 112 },
  { label: "4/26", value: 96 },
  { label: "4/27", value: 132 },
  { label: "4/28", value: 118 },
];

export const serviceShare = [
  { label: "전체 미용", value: 42, color: "#2f7866" },
  { label: "목욕 + 부분정리", value: 28, color: "#8bb6a8" },
  { label: "목욕", value: 18, color: "#d7e8e0" },
  { label: "위생 미용", value: 12, color: "#eed8cb" },
];

export const weekdayReservations = [
  { label: "월", value: 12 },
  { label: "화", value: 15 },
  { label: "수", value: 18 },
  { label: "목", value: 14 },
  { label: "금", value: 19 },
  { label: "토", value: 23 },
  { label: "일", value: 6 },
];

export const settingsTabs = [
  { key: "shop", label: "매장 정보" },
  { key: "hours", label: "운영 시간" },
  { key: "policy", label: "예약 정책" },
  { key: "alerts", label: "알림 설정" },
  { key: "billing", label: "결제 설정" },
  { key: "users", label: "사용자 관리" },
] as const;

export type SettingsTabKey = (typeof settingsTabs)[number]["key"];
