type DepositExpiryClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }>;
};

export async function expireUnreportedDeposits(admin: DepositExpiryClient, shopId: string, appointmentId?: string) {
  const result = await admin.rpc("expire_unreported_booking_deposits", {
    p_shop: shopId, p_appointment: appointmentId ?? null, p_staff: null,
  });
  // Preserve staged installations until the matching migration has been applied.
  if (result.error?.code === "PGRST202") return;
  if (result.error) throw new Error("예약금 기한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
}
