/** PC·모바일·공유 서버의 예약 준비 계약. */
import type { BookingDepositLedger, DepositRefundRule, AvailableBookingDeposit } from "./booking-deposit-ledger";
export type NextBookingRule = "normal" | "approval" | "deposit" | "blocked";
export const DEPOSIT_HOLD_MINUTES = 20;
export type ConsentTemplate = {
  id: string; version: number; title: string; body: string;
  required: boolean; scope: "pet" | "appointment"; enabled: boolean;
  audience?: "all" | "new" | "unsigned" | "manual";
  /** A prior signed version remains valid when false, for pet-level forms. */
  reconsentExisting?: boolean;
  /** Only this explicitly replaced document may supply earlier consent. */
  previousTemplateId?: string;
  archivedAt?: string;
};
export type BookingPolicy = {
  depositMode: "off" | "optional" | "required";
  depositAudience: "all" | "new" | "noshow";
  depositAmount: number; depositDueHours: number; // Legacy storage field, retained for compatibility.
  depositHoldMinutes?: number; // Missing legacy values default to 20; integer 1..1440.
  depositBase?: "all" | "first_visit" | "none";
  depositNoShowEnabled?: boolean; depositNoShowDays?: number; depositNoShowCount?: number;
  depositReviewMinutes?: number; depositRefundRules?: DepositRefundRule[]; depositNoShowRefundPercent?: number;
  bankName: string; bankAccount: string; bankHolder: string;
  cancellationCutoffHours: number; cancellationNotice: string;
  firstNoshowRule: NextBookingRule; repeatNoshowRule: NextBookingRule;
  consentBeforeStart: boolean; templates: ConsentTemplate[];
};
export const DEFAULT_BOOKING_CONSENT_ID = "00000000-0000-4000-8000-000000000001";
export const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  // Only used when a shop has no saved policy. Never merge over existing settings.
  depositMode: "off", depositAudience: "new", depositBase: "first_visit", depositAmount: 20000, depositDueHours: 24, depositHoldMinutes: DEPOSIT_HOLD_MINUTES,
  bankName: "", bankAccount: "", bankHolder: "", cancellationCutoffHours: 2,
  cancellationNotice: "취소 가능 시간이 지난 경우 매장에 문의해 주세요.",
  firstNoshowRule: "approval", repeatNoshowRule: "approval", consentBeforeStart: false, templates: [],
};
export type SignaturePoint = { x: number; y: number };
export type ConsentRecord = ConsentTemplate & {
  status: "pending" | "signed" | "recognized" | "waived" | "superseded";
  signerName?: string; signedAt?: string; signature?: SignaturePoint[][];
  /** New records use checkbox acceptance; keep signature for legacy and explicitly signed records. */
  acceptanceMethod?: "checkbox" | "signature";
  recognizedAt?: string;
  recognizedBy?: string;
  recognitionId?: string;
  recognitionSource?: "owner" | "prior_signature";
  recognizedTemplateId?: string;
  recognizedTemplateVersion?: number;
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
    releaseIfUnreported?: boolean;
  };
  consents: ConsentRecord[];
  cancellation: { kind: "customer" | "late_customer" | "owner" | "noshow" | "unclassified" | "deposit_expired"; reason: string; at: string } | null;
  cancelRequest?: { reason: string; at: string } | null;
  history: Array<{ action: string; at: string; actor: string; note: string }>;
  requests: Array<{ id: string; at: string; purposes: string[]; status: "sending" | "queued" | "blocked" | "sent" | "failed"; reason: string; consentVersions?: Record<string, number> }>;
};
export type PublicBookingPolicy = Pick<BookingPolicy, "depositMode" | "depositAudience" | "depositAmount" | "depositHoldMinutes" | "cancellationCutoffHours" | "cancellationNotice" | "firstNoshowRule" | "repeatNoshowRule">;
export type CustomerBookingDepositOptions = {
  eligible: boolean;
  required: boolean;
  selectable: boolean;
  amount: number;
  holdMinutes: number;
  reason?: string; refundRules?: DepositRefundRule[]; noShowRefundPercent?: number;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
};
export type PreparationResponse = {
  availableDeposits?: AvailableBookingDeposit[];
  previousDepositRefunds?: Array<{ date: string; amount: number; at: string }>;
  appointmentId: string; shopId: string; guardianId: string; petId: string;
  appointmentStatus: string; startAt: string; version: number; data: BookingPreparation;
  manageUrl?: string;
  consentStatus?: { enabled: boolean; pendingCount: number; recognizedCount: number; signedCount: number };
  ledger?: BookingDepositLedger | null;
  /** Result of this owner's explicit retry only; never implies payment or signature. */
  depositDelivery?: { status: "pending" | "processing" | "sent" | "mocked" | "blocked" | "failed"; message: string };
  schedule?: { date: string; time: string; durationMinutes: number; serviceId: string; staffId: string | null; memo: string };
  nextBookingRule?: NextBookingRule;
  /** Latest shop feature settings for owner-side visibility; appointment data remains a historical snapshot. */
  currentPolicyFeatures?: {
    depositMode: BookingPolicy["depositMode"];
    consentEnabled: boolean;
    consentTemplates: Array<Pick<ConsentTemplate, "id" | "version" | "enabled" | "archivedAt" | "scope" | "audience">>;
  };
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
