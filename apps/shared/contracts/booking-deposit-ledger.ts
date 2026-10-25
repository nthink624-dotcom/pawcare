/** One shop/guardian/day money source. Reservation status is deliberately separate. */
export type DepositException = "inherit" | "always" | "exempt";
export type DepositRefundRule = { hoursBefore: number; percent: number };
export type AvailableBookingDeposit = { id: string; date: string; available: number };
export type BookingDepositLedger = {
  id: string; version: number; state: "pending" | "reported" | "confirmed" | "waived" | "cancelled";
  reason: string; bookingDate: string; requestedAmount: number;
  receiptTotal: number;
  receivedTotal: number; refundedTotal: number; usedTotal: number; forfeitedTotal: number;
  refundDue: number; availableTotal: number; allocatedAmount: number; usedAmount: number;
  dueAt: string; retryDueAt: string | null; retryCount: number;
  payerName: string; reportedAt: string | null; reportValid: boolean; confirmedAt: string | null;
  reviewRemindedAt: string | null; requiresDeposit: boolean; unverified: boolean; bookingCount: number;
  /** Owner confirmation was revoked; preserve customer report and hold automatic transitions. */
  confirmationReviewRequired?: boolean;
  bankName: string; bankAccount: string; bankHolder: string;
  refundRules: DepositRefundRule[]; noShowRefundPercent: number;
  history: Array<{ id: number; action: string; at: string; details: Record<string, unknown> }>;
  historyLoaded?: boolean;
  /** Owner-only, loaded with expanded details, not needed for first paint. */
  relatedBookings?: Array<{ id: string; date: string; time: string; petName: string; usedAmount: number }>;
  movements?: Array<{ date: string; direction: "in" | "out"; amount: number; petName?: string }>;
};
