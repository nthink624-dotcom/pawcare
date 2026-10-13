import { DEPOSIT_HOLD_MINUTES } from "@petmanager/shared/contracts/booking-preparation";
export { expireUnreportedDeposits } from "@petmanager/shared/lib/booking-deposit-hold";

export function depositHoldDeadline(startAt: string, requestedAt = Date.now()) {
  const deadline = Math.min(requestedAt + DEPOSIT_HOLD_MINUTES * 60_000, Date.parse(startAt));
  if (!Number.isFinite(deadline) || deadline <= requestedAt) throw new Error("납부 기한을 확보할 수 없습니다.");
  return new Date(deadline).toISOString();
}
