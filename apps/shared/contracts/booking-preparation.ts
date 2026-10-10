/** PC·모바일·공유 서버의 예약 준비 계약. */
export type NextBookingRule = "normal" | "approval" | "deposit" | "blocked";
export type ConsentTemplate = {
  id: string; version: number; title: string; body: string;
  required: boolean; scope: "pet" | "appointment"; enabled: boolean;
  audience?: "all" | "new" | "unsigned" | "manual";
  archivedAt?: string;
};
export type BookingPolicy = {
  depositMode: "off" | "optional" | "required";
  depositAudience: "all" | "new" | "noshow";
  depositAmount: number; depositDueHours: number;
  bankName: string; bankAccount: string; bankHolder: string;
  cancellationCutoffHours: number; cancellationNotice: string;
  firstNoshowRule: NextBookingRule; repeatNoshowRule: NextBookingRule;
  consentBeforeStart: boolean; templates: ConsentTemplate[];
};
export const DEFAULT_BOOKING_CONSENT_ID = "00000000-0000-4000-8000-000000000001";
export const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  depositMode: "off", depositAudience: "all", depositAmount: 20000, depositDueHours: 24,
  bankName: "", bankAccount: "", bankHolder: "", cancellationCutoffHours: 2,
  cancellationNotice: "취소 가능 시간이 지난 경우 매장에 문의해 주세요.",
  firstNoshowRule: "approval", repeatNoshowRule: "approval", consentBeforeStart: false, templates: [],
};
export type SignaturePoint = { x: number; y: number };
export type ConsentRecord = ConsentTemplate & {
  status: "pending" | "signed" | "waived" | "superseded";
  signerName?: string; signedAt?: string; signature?: SignaturePoint[][];
  waivedReason?: string;
};
export type BookingPreparation = {
  policyVersion?: number;
  guardianName?: string;
  petName?: string;
  approvalRequired?: boolean;
  policy: BookingPolicy;
  deposit: {
    status: "not_requested" | "pending" | "reported" | "confirmed" | "waived" | "cancelled" | "refunded";
    required: boolean; amount: number; receivedAmount: number; refundedAmount: number;
    dueAt: string | null; payerName: string; reportedAt: string | null;
    confirmedAt: string | null; confirmedBy: string | null;
  };
  consents: ConsentRecord[];
  cancellation: { kind: "customer" | "late_customer" | "owner" | "noshow" | "unclassified"; reason: string; at: string } | null;
  cancelRequest?: { reason: string; at: string } | null;
  history: Array<{ action: string; at: string; actor: string; note: string }>;
  requests: Array<{ id: string; at: string; purposes: string[]; status: "sending" | "queued" | "blocked" | "sent" | "failed"; reason: string; consentVersions?: Record<string, number> }>;
};
export type PublicBookingPolicy = Pick<BookingPolicy, "depositMode" | "depositAudience" | "depositAmount" | "cancellationCutoffHours" | "cancellationNotice" | "firstNoshowRule" | "repeatNoshowRule">;
export type PreparationResponse = {
  appointmentId: string; shopId: string; guardianId: string; petId: string;
  appointmentStatus: string; startAt: string; version: number; data: BookingPreparation;
  manageUrl?: string;
  nextBookingRule?: NextBookingRule;
  serviceAmount?: number | null;
  remainingAmount?: number | null;
  excessDeposit?: number;
  notificationPreferences?: { enabled: boolean; consent: boolean; deposit: boolean };
  /** Current template versions already signed by this pet. Owner view only. */
  signedPetConsentIds?: string[];
};
export const NEXT_BOOKING_RULE_LABELS: Record<NextBookingRule, string> = {
  normal: "기록만 남기기", approval: "오너 승인 필요", deposit: "예약금 필수", blocked: "온라인 예약 제한",
};
export const DEPOSIT_STATUS_LABELS: Record<BookingPreparation["deposit"]["status"], string> = {
  not_requested: "미요청", pending: "납부 대기", reported: "입금 확인 대기", confirmed: "입금 확인 완료",
  waived: "면제", cancelled: "요청 종료", refunded: "환불 완료",
};
