export type AdminDashboardAccount = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  loginId: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OwnerSupportRequestStatus =
  | "open"
  | "reviewing"
  | "answered"
  | "resolved"
  | "closed";

export type OwnerSupportCategory =
  | "how_to_use"
  | "bug"
  | "payment"
  | "feature_request"
  | "account"
  | "notification"
  | "other";

export type OwnerSupportMessageItem = {
  id: string;
  senderType: "owner" | "admin" | "system";
  senderName: string | null;
  message: string;
  isAnswer: boolean;
  createdAt: string;
};

export type OwnerSupportAttachmentItem = {
  id: string;
  fileUrl: string;
  signedUrl: string;
  fileName: string;
  fileType: string;
};

export type OwnerSupportRequestItem = {
  id: string;
  shopId: string;
  shopName: string | null;
  category: OwnerSupportCategory;
  status: OwnerSupportRequestStatus;
  priority: "low" | "normal" | "urgent";
  title: string;
  contact: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  message: string;
  context: Record<string, unknown>;
  adminNote: string;
  source: string;
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: OwnerSupportMessageItem[];
  attachments: OwnerSupportAttachmentItem[];
};

export type AdminRevenuePlanBreakdown = {
  planCode: string;
  planName: string;
  revenue: number;
  paidCount: number;
  activeCount: number;
};

export type AdminRevenueRecentPayment = {
  paymentId: string;
  shopId: string;
  planCode: string | null;
  planName: string;
  amount: number;
  paidAt: string;
};

export type AdminRevenueSummary = {
  todayRevenue: number;
  monthRevenue: number;
  last30DaysRevenue: number;
  monthPaidCount: number;
  activePaidSubscriptions: number;
  expectedMonthlyRecurringRevenue: number;
  planBreakdown: AdminRevenuePlanBreakdown[];
  recentPayments: AdminRevenueRecentPayment[];
  updatedAt: string;
};

export const supportRequestCategoryLabels: Record<
  OwnerSupportCategory,
  string
> = {
  how_to_use: "사용법",
  bug: "오류",
  payment: "결제",
  feature_request: "기능 개선",
  account: "계정·매장",
  notification: "알림톡",
  other: "기타",
};

export const supportRequestStatusLabels: Record<
  OwnerSupportRequestStatus,
  string
> = {
  open: "접수",
  reviewing: "확인 중",
  answered: "답변 완료",
  resolved: "답변 완료",
  closed: "종료",
};

export function isPendingSupportRequest(request: OwnerSupportRequestItem) {
  return request.status === "open" || request.status === "reviewing";
}

export function formatAdminDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatWon(value: number) {
  return `${Math.max(value, 0).toLocaleString("ko-KR")}원`;
}
