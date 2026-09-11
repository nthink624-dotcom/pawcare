export const testerFeedbackCategories = ["inquiry", "improvement", "bug"] as const;
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
export type TesterFeedbackScreenKey = (typeof testerFeedbackScreenKeys)[number];

export const TESTER_FEEDBACK_BODY_MIN_LENGTH = 2;
export const TESTER_FEEDBACK_BODY_MAX_LENGTH = 2000;
export const TESTER_FEEDBACK_APP_VERSION_MAX_LENGTH = 32;

export const testerFeedbackCategoryLabels: Record<TesterFeedbackCategory, string> = {
  inquiry: "문의",
  bug: "문제 발견",
  improvement: "개선 제안",
};

export type TesterFeedbackEligibility = {
  schemaReady: boolean;
  isPilotMember: boolean;
  status: "planned" | "active" | "paused" | "completed" | "excluded" | null;
};

export function canUseTesterFeedback(value: TesterFeedbackEligibility | null | undefined) {
  return Boolean(value?.schemaReady && value.isPilotMember && value.status !== "excluded");
}

export function normalizeTesterFeedbackBody(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function resolveTesterFeedbackAppVersion() {
  const candidate = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "mobile-web";
  return /^[0-9A-Za-z._+-]+$/.test(candidate)
    ? candidate.slice(0, TESTER_FEEDBACK_APP_VERSION_MAX_LENGTH)
    : "mobile-web";
}

export function createTesterFeedbackRequestId() {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("이 기기에서는 피드백 요청을 준비할 수 없습니다. 다시 시도해 주세요.");
  }
  return crypto.randomUUID();
}
