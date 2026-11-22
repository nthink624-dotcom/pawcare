/** Fixed Kakao button labels and destinations shared by the app and template review flow. */
export type AlimtalkButtonAlias =
  | "booking_consent_request"
  | "booking_deposit_request"
  | "booking_deposit_cancelled"
  | "booking_deposit_expired"
  | "booking_deposit_refunded"
  | "booking_confirmed"
  | "booking_cancelled"
  | "appointment_reminder_10m"
  | "visit_schedule_notice"
  | "visit_reminder_notice"
  | "grooming_started"
  | "grooming_almost_done"
  | "grooming_completed"
  | "grooming_completed_without_report"
  | "revisit_notice";

export type AlimtalkButtonContract = {
  buttonName: string;
  linkMobile: string;
  linkPc: string;
};

const manage = "https://www.petmanager.co.kr/m?t=#{예약관리토큰}";
const depositManage = "https://www.petmanager.co.kr/book/manage?t=#{예약관리토큰}";
const directions = "https://map.kakao.com/link/search/#{매장명}%20#{매장주소}";

export const ALIMTALK_BUTTON_CONTRACTS: Record<AlimtalkButtonAlias, readonly AlimtalkButtonContract[]> = {
  booking_consent_request: [{ buttonName: "동의서 작성", linkMobile: manage, linkPc: manage }],
  booking_deposit_request: [{ buttonName: "예약금 입금 신고", linkMobile: depositManage, linkPc: depositManage }],
  booking_deposit_cancelled: [{ buttonName: "예약 확인", linkMobile: depositManage, linkPc: depositManage }],
  booking_deposit_expired: [{ buttonName: "예약 확인", linkMobile: depositManage, linkPc: depositManage }],
  booking_deposit_refunded: [{ buttonName: "예약 확인", linkMobile: depositManage, linkPc: depositManage }],
  booking_confirmed: [
    { buttonName: "예약 확인", linkMobile: manage, linkPc: manage },
    { buttonName: "길찾기", linkMobile: "#{길찾기링크}", linkPc: "#{길찾기링크}" },
  ],
  booking_cancelled: [{ buttonName: "예약 가능한 시간 보기", linkMobile: "https://www.petmanager.co.kr/m?t=#{예약시간변경토큰}", linkPc: "https://www.petmanager.co.kr/m?t=#{예약시간변경토큰}" }],
  appointment_reminder_10m: [
    { buttonName: "예약 확인", linkMobile: manage, linkPc: manage },
    { buttonName: "길찾기", linkMobile: "#{길찾기링크}", linkPc: "#{길찾기링크}" },
  ],
  visit_schedule_notice: [
    { buttonName: "예약 확인", linkMobile: manage, linkPc: manage },
    { buttonName: "길찾기", linkMobile: "#{길찾기링크}", linkPc: "#{길찾기링크}" },
  ],
  visit_reminder_notice: [
    { buttonName: "예약 확인", linkMobile: manage, linkPc: manage },
    { buttonName: "길찾기", linkMobile: "#{길찾기링크}", linkPc: "#{길찾기링크}" },
  ],
  grooming_started: [],
  grooming_almost_done: [{ buttonName: "예약 확인", linkMobile: manage, linkPc: manage }],
  grooming_completed: [{ buttonName: "케어리포트 확인하기", linkMobile: manage, linkPc: manage }],
  grooming_completed_without_report: [],
  revisit_notice: [{
    buttonName: "바로 재예약",
    linkMobile: "https://www.petmanager.co.kr/book/#{매장ID}?experience=revisit&t=#{bookingRescheduleToken}",
    linkPc: "https://www.petmanager.co.kr/book/#{매장ID}?experience=revisit&t=#{bookingRescheduleToken}",
  }],
};
