import { DEPOSIT_HOLD_MINUTES } from "@petmanager/shared/contracts/booking-preparation";
export { expireUnreportedDeposits } from "@petmanager/shared/lib/booking-deposit-hold";

export function depositHoldDeadline(startAt: string, requestedAt = Date.now(), minutes = DEPOSIT_HOLD_MINUTES) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error("입금 신고 기한은 1~1440분으로 설정해 주세요.");
  const deadline = Math.min(requestedAt + minutes * 60_000, Date.parse(startAt));
  if (!Number.isFinite(deadline) || deadline <= requestedAt) throw new Error("납부 기한을 확보할 수 없습니다.");
  return new Date(deadline).toISOString();
}
