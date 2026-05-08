export type ReservationStatus = "승인 대기" | "확정" | "진행 중" | "픽업 준비" | "완료" | "취소";

export type OwnerReservation = {
  id: string;
  time: string;
  customer: string;
  pet: string;
  service: string;
  staff: string;
  status: ReservationStatus;
  phone: string;
  channel: string;
  note: string;
};

export type OwnerCustomer = {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  pets: string[];
  recentVisit: string;
  nextBooking: string;
  memo: string;
  alerts: string;
};

export const shopSummary = {
  name: "포근살롱",
  address: "서울 마포구 월드컵로 12",
  ownerEmail: "owner@example.com",
};

export const reservationRows: OwnerReservation[] = [
  {
    id: "R-2401",
    time: "10:30",
    customer: "정유진",
    pet: "우유",
    service: "전체 미용",
    staff: "원장",
    status: "승인 대기",
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
    status: "확정",
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
    status: "진행 중",
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
    status: "픽업 준비",
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
    status: "완료",
    phone: "010-2840-4421",
    channel: "재방문 예약",
    note: "3주 뒤 재예약 안내 필요",
  },
];

export const customerRows: OwnerCustomer[] = [
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

export const settingsRows = [
  { key: "shop", label: "매장 기본 정보", description: "대표 이미지, 매장명, 연락처, 소개 문구" },
  { key: "hours", label: "운영 시간", description: "요일별 영업시간, 휴무일, 임시 휴무" },
  { key: "policy", label: "예약 정책", description: "동시 예약 가능 수, 예약 시간 패턴" },
  { key: "alerts", label: "알림톡 설정", description: "예약 확정, 취소, 변경, 완료 안내" },
  { key: "services", label: "서비스 관리", description: "미용 메뉴, 소요 시간, 가격" },
  { key: "billing", label: "결제 설정", description: "구독 플랜과 결제 수단" },
] as const;
