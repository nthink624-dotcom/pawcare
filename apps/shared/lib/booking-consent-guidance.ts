import type { BookingPreparation } from "../contracts/booking-preparation";

/** Definite pre-send failures only. Never retry an ambiguous provider outcome. */
export function canRetryConsentRequest(request: BookingPreparation["requests"][number]) {
  return request.status === "blocked" || request.status === "failed" && (request.retrySafe === true
    || /연락처가 없습니다|Recipient phone number not found|템플릿.*(연결되지|승인·연결되지)|잔여 건수가 없습니다|insufficient alimtalk credits/.test(request.reason));
}
