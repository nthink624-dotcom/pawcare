import { DEPOSIT_HOLD_MINUTES } from "@petmanager/shared/contracts/booking-preparation";
import type { SupabaseClient } from "@supabase/supabase-js";

export function depositHoldDeadline(startAt: string, requestedAt = Date.now()) {
  const deadline = Math.min(requestedAt + DEPOSIT_HOLD_MINUTES * 60_000, Date.parse(startAt));
  if (!Number.isFinite(deadline) || deadline <= requestedAt) throw new Error("납부 기한을 확보할 수 없습니다.");
  return new Date(deadline).toISOString();
}

export async function expireUnreportedDeposits(admin: SupabaseClient, shopId: string, appointmentId?: string) {
  const result = await admin.rpc("expire_unreported_booking_deposits", {
    p_shop: shopId, p_appointment: appointmentId ?? null, p_staff: null,
  });
  // A staged source deployment must not break existing installations before the migration is applied.
  if (result.error?.code === "PGRST202") return;
  if (result.error) throw new Error("예약금 기한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
}
