/** Owner-only first-paint projection; not a receipt, mutation version or customer API. */
export type BookingDepositPreview = {
  id: string; state: string; requestedAmount: number; receivedTotal: number;
  refundedTotal: number; refundDue: number; allocatedAmount: number;
  payerName: string; reportValid: boolean; unverified: boolean;
};

export const DEPOSIT_PREVIEW_SELECT = "*,booking_deposit_links(allocated_amount,auto_confirmed_unverified,booking_deposit_accounts(id,shop_id,state,requested_amount,received_total,refunded_total,refund_due,payer_name,report_valid))";

/** Strip embedded storage rows at the server boundary, including unexpected tenant links. */
export function projectDepositPreview<T extends { shop_id: string }>(row: T & { booking_deposit_links?: unknown }): Omit<T, "booking_deposit_links"> & { deposit_summary?: BookingDepositPreview | null } {
  const { booking_deposit_links: embedded, ...appointment } = row;
  if (embedded === undefined) return appointment;
  const link = (Array.isArray(embedded) ? embedded[0] : embedded) as Record<string, unknown> | null;
  const raw = link?.booking_deposit_accounts;
  const account = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
  if (!link || !account || account.shop_id !== row.shop_id) return { ...appointment, deposit_summary: null };
  return { ...appointment, deposit_summary: {
    id: String(account.id), state: String(account.state), requestedAmount: Number(account.requested_amount),
    receivedTotal: Number(account.received_total), refundedTotal: Number(account.refunded_total),
    refundDue: Number(account.refund_due), allocatedAmount: Number(link.allocated_amount),
    payerName: String(account.payer_name ?? ""), reportValid: account.report_valid === true,
    unverified: link.auto_confirmed_unverified === true,
  } };
}
