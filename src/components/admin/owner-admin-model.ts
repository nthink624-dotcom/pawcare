
export type OwnerSubscriptionStatus = "trialing" | "trial_will_end" | "active" | "past_due" | "canceled" | "expired";
export type OwnerPlanCode = "free" | "monthly" | "quarterly" | "halfyearly" | "yearly";
export type OwnerLastPaymentStatus = "none" | "scheduled" | "paid" | "failed" | "cancelled";
export type AdminOwnerEventType =
  | "trial_extended"
  | "service_extended"
  | "plan_changed"
  | "status_changed"
  | "payment_status_changed"
  | "suspended"
  | "restored"
  | "temporary_password_issued";
export type AdminLoginMethod = "id" | "google" | "kakao" | "naver";

export type AdminOwnerHistoryItem = {
  id: string;
  type: AdminOwnerEventType;
  adminEmail: string;
  note: string | null;
  previousPayload: Record<string, unknown>;
  nextPayload: Record<string, unknown>;
  createdAt: string;
};

export type AdminOwnerPaymentStatus = "PAID" | "FAILED" | "CANCELLED" | "REQUESTED" | "SCHEDULED" | null;

export type AdminOwnerPaymentItem = {
  id: string;
  paymentId: string;
  amount: number | null;
  status: AdminOwnerPaymentStatus;
  planCode: OwnerPlanCode | null;
  createdAt: string;
  refundable: boolean;
};

export type AdminOwnerUsageWarning = {
  level: "info" | "warning" | "danger";
  code: "multiple_shops" | "identity_changes" | "branch_terms" | "shared_contact";
  message: string;
  evidence: string[];
};

export type TemporaryPasswordResult = {
  loginId: string;
  temporaryPassword: string;
  issuedAt: string;
};

export type AdminAlimtalkCreditBalance = {
  shopId: string;
  shopName: string;
  includedTotal: number;
  includedUsed: number;
  includedRemaining: number;
  includedPeriodStartedAt: string | null;
  includedPeriodEndsAt: string | null;
  purchasedTotal: number;
  purchasedUsed: number;
  purchasedRemaining: number;
  remainingTotal: number;
};

export type AdminOwnerItem = {
  userId: string;
  ownerName: string;
  loginId: string | null;
  ownerPhoneNumber: string | null;
  ownerEmail: string | null;
  loginMethods: AdminLoginMethod[];
  shopId: string;
  shopName: string;
  shopAddress: string;
  joinedAt: string;
  serviceStartedAt: string;
  status: OwnerSubscriptionStatus;
  currentPlanCode: OwnerPlanCode;
  currentPlanName: string;
  trialEndsAt: string;
  currentPeriodEndsAt: string | null;
  lastPaymentStatus: OwnerLastPaymentStatus;
  paymentMethodExists: boolean;
  paymentMethodLabel: string | null;
  suspended: boolean;
  suspensionReason: string | null;
  usageWarnings: AdminOwnerUsageWarning[];
  recentEvents: AdminOwnerHistoryItem[];
  recentPayments: AdminOwnerPaymentItem[];
};

export type OwnerDraft = {
  currentPlanCode: OwnerPlanCode;
  serviceStartedAt: string;
  currentPeriodEndsAt: string;
  trialEndsAt: string;
  lastPaymentStatus: OwnerLastPaymentStatus;
  suspended: boolean;
  suspensionReason: string;
};

export const planOptions = [
  { value: "free", label: "체험 플랜" },
  { value: "monthly", label: "1인 운영" },
  { value: "quarterly", label: "2~4인 운영" },
  { value: "halfyearly", label: "2~4인 운영(기존)" },
  { value: "yearly", label: "5인 이상 운영" },
] as const satisfies Array<{ value: OwnerPlanCode; label: string }>;

export const statusOptions = [
  { value: "trialing", label: "체험 플랜 이용 중" },
  { value: "trial_will_end", label: "체험 플랜 종료 임박" },
  { value: "active", label: "이용 중" },
  { value: "past_due", label: "결제 확인 필요" },
  { value: "canceled", label: "해지" },
  { value: "expired", label: "만료" },
] as const satisfies Array<{ value: OwnerSubscriptionStatus; label: string }>;

export const paymentStatusOptions = [
  { value: "none", label: "결제 이력 없음" },
  { value: "scheduled", label: "결제 예정" },
  { value: "paid", label: "결제 완료" },
  { value: "failed", label: "결제 실패" },
  { value: "cancelled", label: "결제 취소" },
] as const satisfies Array<{ value: OwnerLastPaymentStatus; label: string }>;

export const recentPaymentStatusMeta: Record<
  NonNullable<AdminOwnerPaymentStatus>,
  { label: string; tone: string }
> = {
  PAID: {
    label: "결제 완료",
    tone: "border-[#cfe4d7] bg-[#f2fbf5] text-[#1f6b5b]",
  },
  CANCELLED: {
    label: "취소 완료",
    tone: "border-[#e7d8cf] bg-[#fcf7f2] text-[#8a5a41]",
  },
  REQUESTED: {
    label: "취소 요청",
    tone: "border-[#ecdcb9] bg-[#fff9ea] text-[#8f6a18]",
  },
  FAILED: {
    label: "결제 실패",
    tone: "border-[#efcfcf] bg-[#fff4f4] text-[#bb4f4f]",
  },
  SCHEDULED: {
    label: "예약 결제",
    tone: "border-[#d8e1ed] bg-[#f6f8fc] text-[#54657e]",
  },
};

export const loginMethodLabels: Record<AdminLoginMethod, string> = {
  id: "아이디",
  google: "구글",
  kakao: "카카오",
  naver: "네이버",
};

export const loginMethodToneMap: Record<AdminLoginMethod, string> = {
  id: "border-[#ddd4c8] bg-[#fcfbf8] text-[#5e564f]",
  google: "border-[#d7e3f5] bg-[#f6f9ff] text-[#3f63a2]",
  kakao: "border-[#f3e08e] bg-[#fff9db] text-[#7f6200]",
  naver: "border-[#cde9d8] bg-[#f2fbf5] text-[#1f6b5b]",
};

export const statusToneMap: Record<OwnerSubscriptionStatus, string> = {
  trialing: "bg-[#eef7f2] text-[#1f6b5b]",
  trial_will_end: "bg-[#f9f1df] text-[#7f622f]",
  active: "bg-[#edf5ff] text-[#2d5f9a]",
  past_due: "bg-[#fdf0f0] text-[#b54b4b]",
  canceled: "bg-[#f3f1ef] text-[#746d67]",
  expired: "bg-[#f3f1ef] text-[#746d67]",
};

export const usageWarningToneMap: Record<AdminOwnerUsageWarning["level"], string> = {
  info: "border-[#d8e6f7] bg-[#f7fbff] text-[#315f91]",
  warning: "border-[#f1dfb7] bg-[#fffaf0] text-[#8a6211]",
  danger: "border-[#efcaca] bg-[#fff6f6] text-[#a23f3f]",
};

export const eventLabelMap: Record<AdminOwnerEventType, string> = {
  trial_extended: "체험 플랜 연장",
  service_extended: "서비스 기간 연장",
  plan_changed: "플랜 변경",
  status_changed: "이용 상태 변경",
  payment_status_changed: "결제 상태 변경",
  suspended: "계정 정지",
  restored: "계정 복구",
  temporary_password_issued: "임시비밀번호 발급",
};

export function getEventLabel(event: AdminOwnerHistoryItem) {
  if (event.nextPayload.systemAlertType === "browser_storage_pressure") {
    return "브라우저 저장소 경고";
  }
  return eventLabelMap[event.type];
}

export function getPlanLabel(value: OwnerPlanCode | string | null | undefined) {
  if (!value) return "-";
  return planOptions.find((option) => option.value === value)?.label ?? value;
}

export function getStatusLabel(value: OwnerSubscriptionStatus | string | null | undefined) {
  if (!value) return "-";
  return statusOptions.find((option) => option.value === value)?.label ?? value;
}

export function getPaymentStatusLabel(value: OwnerLastPaymentStatus | string | null | undefined) {
  if (!value) return "-";
  return paymentStatusOptions.find((option) => option.value === value)?.label ?? value;
}

export function getRecentPaymentStatusMeta(value: AdminOwnerPaymentStatus) {
  if (!value) {
    return {
      label: "상태 확인 필요",
      tone: "border-[#e8dfd3] bg-[#fcfbf8] text-[#6f665f]",
    };
  }

  return recentPaymentStatusMeta[value];
}

export function formatDateLabel(value: string | null) {
  if (!value) return "-";
  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? `${datePart.slice(2, 4)}.${datePart.slice(5, 7)}.${datePart.slice(8, 10)}` : datePart.replace(/-/g, ".");
}

export function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getFullYear()).slice(-2)}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function toKstIsoEndOfDay(dateText: string) {
  return dateText ? `${dateText}T23:59:59+09:00` : null;
}

export function todayKstDateText() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function plusDays(dateText: string, days: number) {
  const base = dateText || new Date().toISOString().slice(0, 10);
  const date = new Date(`${base}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDraft(item: AdminOwnerItem): OwnerDraft {
  return {
    currentPlanCode: item.currentPlanCode,
    serviceStartedAt: toDateInputValue(item.serviceStartedAt),
    currentPeriodEndsAt: toDateInputValue(item.currentPlanCode === "free" ? item.trialEndsAt : item.currentPeriodEndsAt),
    trialEndsAt: toDateInputValue(item.trialEndsAt),
    lastPaymentStatus: item.lastPaymentStatus,
    suspended: item.suspended,
    suspensionReason: item.suspensionReason ?? "",
  };
}

export function summarizeEvent(event: AdminOwnerHistoryItem) {
  if (event.nextPayload.systemAlertType === "browser_storage_pressure") {
    const usagePercent = typeof event.nextPayload.usagePercent === "number" ? `${event.nextPayload.usagePercent}%` : "확인 필요";
    const reason =
      event.nextPayload.reason === "storage_usage_over_80_percent"
        ? "저장소 사용량 80% 이상"
        : "브라우저 저장소 쓰기 실패";
    return `${reason} 감지. 사용량: ${usagePercent}`;
  }

  switch (event.type) {
    case "plan_changed":
      return `${getPlanLabel(
        typeof event.previousPayload.currentPlanName === "string"
          ? event.previousPayload.currentPlanName
          : typeof event.previousPayload.currentPlanCode === "string"
            ? event.previousPayload.currentPlanCode
            : null,
      )} → ${getPlanLabel(
        typeof event.nextPayload.currentPlanName === "string"
          ? event.nextPayload.currentPlanName
          : typeof event.nextPayload.currentPlanCode === "string"
            ? event.nextPayload.currentPlanCode
            : null,
      )}`;
    case "status_changed":
      return `${getStatusLabel(typeof event.previousPayload.status === "string" ? event.previousPayload.status : null)} → ${getStatusLabel(
        typeof event.nextPayload.status === "string" ? event.nextPayload.status : null,
      )}`;
    case "payment_status_changed":
      return `${getPaymentStatusLabel(
        typeof event.previousPayload.lastPaymentStatus === "string" ? event.previousPayload.lastPaymentStatus : null,
      )} → ${getPaymentStatusLabel(typeof event.nextPayload.lastPaymentStatus === "string" ? event.nextPayload.lastPaymentStatus : null)}`;
    case "trial_extended":
      return `${formatDateLabel(typeof event.previousPayload.trialEndsAt === "string" ? event.previousPayload.trialEndsAt : null)} → ${formatDateLabel(typeof event.nextPayload.trialEndsAt === "string" ? event.nextPayload.trialEndsAt : null)}`;
    case "service_extended":
      return `${formatDateLabel(typeof event.previousPayload.currentPeriodEndsAt === "string" ? event.previousPayload.currentPeriodEndsAt : null)} → ${formatDateLabel(typeof event.nextPayload.currentPeriodEndsAt === "string" ? event.nextPayload.currentPeriodEndsAt : null)}`;
    case "suspended":
      return typeof event.nextPayload.suspensionReason === "string" && event.nextPayload.suspensionReason
        ? event.nextPayload.suspensionReason
        : "운영자에 의해 계정이 일시 정지되었습니다.";
    case "restored":
      return "정지 상태가 해제되어 다시 접속할 수 있습니다.";
    case "temporary_password_issued":
      return typeof event.nextPayload.loginId === "string"
        ? `${event.nextPayload.loginId} 계정에 임시비밀번호를 발급했습니다.`
        : "오너 계정에 임시비밀번호를 발급했습니다.";
    default:
      return event.note ?? "-";
  }
}
