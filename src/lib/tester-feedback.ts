export const testerFeedbackCategories = ["inquiry", "improvement", "bug"] as const;
export const testerFeedbackStatuses = ["new", "reviewing", "resolved"] as const;
export const testerAccessDecisionActions = ["extend_3_days", "end", "convert"] as const;
export const testerAccessDecisionStates = ["pending", "ended", "converted"] as const;
export const testerFeedbackScreenKeys = [
  "home",
  "schedule",
  "calendar",
  "customers",
  "staff",
  "services",
  "shop_settings",
  "booking_page",
  "notifications",
  "billing",
  "other",
] as const;

export type TesterFeedbackCategory = (typeof testerFeedbackCategories)[number];
export type TesterFeedbackStatus = (typeof testerFeedbackStatuses)[number];
export type TesterFeedbackScreenKey = (typeof testerFeedbackScreenKeys)[number];

export const TESTER_FEEDBACK_BODY_MIN_LENGTH = 2;
export const TESTER_FEEDBACK_BODY_MAX_LENGTH = 2000;
export const TESTER_FEEDBACK_APP_VERSION_MAX_LENGTH = 32;
export const TESTER_FEEDBACK_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const testerFeedbackScreenshotContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const testerFeedbackCategoryLabels: Record<TesterFeedbackCategory, string> = {
  inquiry: "문의",
  bug: "문제 발견",
  improvement: "개선 제안",
};

export const testerFeedbackStatusLabels: Record<TesterFeedbackStatus, string> = {
  new: "새 피드백",
  reviewing: "확인 중",
  resolved: "처리 완료",
};

export const testerFeedbackScreenLabels: Record<TesterFeedbackScreenKey, string> = {
  home: "홈",
  schedule: "예약 일정",
  calendar: "캘린더",
  customers: "고객 관리",
  staff: "직원 관리",
  services: "서비스·가격",
  shop_settings: "매장 설정",
  booking_page: "예약 페이지",
  notifications: "알림",
  billing: "결제",
  other: "기타",
};

export type TesterFeedbackItem = {
  id: string;
  shopId: string;
  shopName: string | null;
  category: TesterFeedbackCategory;
  body: string;
  screenKey: TesterFeedbackScreenKey;
  appVersion: string;
  status: TesterFeedbackStatus;
  tester: TesterAccessProjection;
  screenshot: {
    attached: boolean;
    contentType: (typeof testerFeedbackScreenshotContentTypes)[number] | null;
    byteSize: number | null;
    consentedAt: string | null;
    receiptFingerprint: string | null;
    deletedAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type TesterAccessDecisionAction = (typeof testerAccessDecisionActions)[number];
export type TesterAccessDecisionState = (typeof testerAccessDecisionStates)[number];
export type TesterAccessDisplayState = "active" | "awaiting_owner_decision" | "ended" | "converted";

export type TesterAccessProjection = {
  schemaReady: boolean;
  isTester: boolean;
  cohortStatus: "planned" | "active" | "paused" | "completed" | "excluded" | null;
  displayState: TesterAccessDisplayState | null;
  reviewDueAt: string | null;
  noticeKey: string | null;
  noticeLabel: string | null;
};

export function resolveTesterAccessDisplayState(input: {
  isTester: boolean;
  decisionState: TesterAccessDecisionState | null;
  reviewDueAt: string | null;
  now?: string;
}): TesterAccessDisplayState | null {
  if (!input.isTester) return null;
  if (input.decisionState === "ended") return "ended";
  if (input.decisionState === "converted") return "converted";
  const dueAt = input.reviewDueAt ? Date.parse(input.reviewDueAt) : Number.NaN;
  const now = Date.parse(input.now ?? new Date().toISOString());
  return Number.isFinite(dueAt) && Number.isFinite(now) && now >= dueAt
    ? "awaiting_owner_decision"
    : "active";
}

export function resolveTesterAccessNotice(input: {
  isTester: boolean;
  decisionState: TesterAccessDecisionState | null;
  reviewDueAt: string | null;
  cohortPosition: number | null;
  now?: string;
}) {
  if (!input.isTester || input.decisionState === "ended" || input.decisionState === "converted" || !input.reviewDueAt) {
    return { noticeKey: null, noticeLabel: null };
  }
  const dueAt = Date.parse(input.reviewDueAt);
  const now = Date.parse(input.now ?? new Date().toISOString());
  if (!Number.isFinite(dueAt) || !Number.isFinite(now)) return { noticeKey: null, noticeLabel: null };
  const dayMs = 86_400_000;
  const daysUntil = Math.ceil((dueAt - now) / dayMs);
  const position = input.cohortPosition ?? 0;
  const dueDate = new Date(dueAt).toISOString().slice(0, 10);
  if (daysUntil === 3) {
    return { noticeKey: `tester-review:${position}:${dueDate}:d-3`, noticeLabel: "테스트 기간 결정을 3일 뒤 확인해 주세요." };
  }
  if (daysUntil <= 0) {
    const cycle = Math.floor(Math.abs(daysUntil) / 3);
    return {
      noticeKey: `tester-review:${position}:${dueDate}:d+${cycle * 3}`,
      noticeLabel: cycle === 0
        ? "테스트 기간이 끝났습니다. 종료·연장·전환을 결정해 주세요."
        : "테스트 기간 결정을 확인해 주세요.",
    };
  }
  return { noticeKey: null, noticeLabel: null };
}

export function normalizeTesterFeedbackBody(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeTesterFeedbackAppVersion(value: string) {
  return value.trim();
}

export function containsObviousSensitiveTesterFeedback(value: string) {
  return (
    /https?:\/\/|www\./i.test(value) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) ||
    /(?:^|\D)01[016789][ -]?\d{3,4}[ -]?\d{4}(?:\D|$)/.test(value) ||
    /\b(?:bearer|token|api[_ -]?key)\s*[:=]/i.test(value)
  );
}
