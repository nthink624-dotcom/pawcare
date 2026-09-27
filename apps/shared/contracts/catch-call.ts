/**
 * 캐치콜의 PC·모바일 공통 계약입니다.
 *
 * 전화번호 원문이나 통화 녹음/전사 내용은 이 계약에 포함하지 않습니다.
 * 공급사/OS 어댑터는 call event id만 전달하고, 예약 상세는 오너가 확인해 저장합니다.
 */
export const CATCH_CALL_CONTRACT_VERSION = "2026-09-26" as const;

export const CATCH_CALL_RESERVATION_STATUS = [
  "not_started",
  "in_progress",
  "confirmed",
  "failed",
] as const;
export type CatchCallReservationStatus = (typeof CATCH_CALL_RESERVATION_STATUS)[number];

export const CATCH_CALL_NOTIFICATION_STATUS = [
  "not_requested",
  "queued",
  "sent",
  "failed",
  "skipped",
] as const;
export type CatchCallNotificationStatus = (typeof CATCH_CALL_NOTIFICATION_STATUS)[number];

export type CatchCallReservationRequest = {
  shopId: string;
  callEventId: string;
  petId: string;
  serviceId: string;
  staffId?: string | null;
  appointmentDate: string;
  appointmentTime: string;
  memo?: string;
};

export type CatchCallReservationResponse = {
  ok: true;
  replayed: boolean;
  callEventId: string;
  appointmentId: string;
  notificationStatus: CatchCallNotificationStatus;
};
