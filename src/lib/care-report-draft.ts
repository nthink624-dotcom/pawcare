import {
  careReportDraftSchema,
  legacyStructuredCareReportSchema,
  type CareReportDraft,
} from "@/types/care-report";

const conservativeFillerPattern = /(^|[\s,])(?:음|어|아|그|저기|그러니까)(?=[\s,.!?]|$)/gu;
const repeatedWordPattern = /(^|\s)([가-힣A-Za-z0-9]{1,20})(?:\s+\2){1,3}(?=\s|[,.!?]|$)/gu;

export function sanitizeCareReportText(value: string) {
  return value.replace(/[ㄱ-ㅎㅏ-ㅣ]{2,}/g, " ").replace(/\s+/g, " ").trim();
}

const careReportPiiPatterns = [
  /(?:\+\s*82|0082)[\s().-]*(?:0?1[016789])[\s().-]*\d{3,4}[\s().-]*\d{4}/gi,
  /0?1[016789][\s().-]*\d{3,4}[\s().-]*\d{4}/g,
  /(?:\+\s*82|0082)[\s().-]*(?:0?(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4]|70))[\s().-]*\d{3,4}[\s().-]*\d{4}/gi,
  /0(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4]|70)[\s().-]*\d{3,4}[\s().-]*\d{4}/g,
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  /(?:(?:서울(?:특별시|시)?|부산(?:광역시)?|대구(?:광역시)?|인천(?:광역시)?|광주(?:광역시)?|대전(?:광역시)?|울산(?:광역시)?|세종(?:특별자치시)?|경기(?:도)?|강원(?:도)?|충(?:청)?[북남]도?|전(?:라)?[북남]도?|경(?:상)?[북남]도?|제주(?:특별자치도)?)[\s,]*)?(?:[가-힣]+(?:구|군|시)[\s,]+)?[가-힣0-9·ㆍ-]+(?:로|길)[\s,]*\d+[a-zA-Z가-힣]?(?:\s*[-–]\s*\d+[a-zA-Z가-힣]?)?(?:\s*(?:\d+동|\d+층|\d+호))?/g,
];

const careReportPiiResidualPatterns = [
  /(?:\+\s*82|0082)?[\s().-]*0?1[016789][\s().-]*\d{3,4}[\s().-]*\d{4}/i,
  /(?:\+\s*82|0082)?[\s().-]*0?(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4]|70)[\s().-]*\d{3,4}[\s().-]*\d{4}/i,
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/i,
  /(?:[가-힣]+(?:구|군|시)[\s,]+)?[가-힣0-9·ㆍ-]+(?:로|길)[\s,]*\d+[a-zA-Z가-힣]?(?:\s*[-–]\s*\d+[a-zA-Z가-힣]?)?/,
];

export class CareReportPiiResidualError extends Error {
  constructor() {
    super("연락처나 주소로 보이는 내용은 제외한 뒤 다시 작성해 주세요.");
  }
}

export function hasCareReportPiiResidual(value: string) {
  return careReportPiiResidualPatterns.some((pattern) => pattern.test(value));
}

export function assertCareReportTextPiiFree(value: string) {
  if (hasCareReportPiiResidual(value)) throw new CareReportPiiResidualError();
}

/** Used only at the AI boundary. The owner-visible input remains unchanged. */
export function prepareCareReportSourceText(value: string) {
  const scrubbed = careReportPiiPatterns.reduce(
    (text, pattern) => text.replace(pattern, "[개인정보 제외]"),
    value.normalize("NFC"),
  );
  const normalized = scrubbed
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]*\n+[ \t]*/g, ". ")
    .replace(/\s*[,，]\s*/g, ", ")
    .replace(/([.!?])\1+/g, "$1")
    .replace(/[ㄱ-ㅎㅏ-ㅣ]{2,}/g, " ")
    .replace(conservativeFillerPattern, "$1")
    .replace(repeatedWordPattern, "$1$2")
    .replace(/(?:\.\s*){2,}/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim()
    .slice(0, 4000);
  if (hasCareReportPiiResidual(normalized)) throw new CareReportPiiResidualError();
  return normalized;
}

export const CARE_REPORT_GENERATION_RETRY_MESSAGE =
  "AI가 문장을 충분히 다듬지 못했습니다. 입력은 그대로 두었으니 다시 시도해 주세요.";

export function normalizeCareReportComparisonText(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");
}

export function hasCareReportExactSourceEcho(sourceText: string, reportText: string) {
  const source = normalizeCareReportComparisonText(sourceText);
  return Boolean(source) && source === normalizeCareReportComparisonText(reportText);
}

export function isCareReportTextUnchanged(currentReportText: string, nextReportText: string) {
  return normalizeCareReportComparisonText(currentReportText) === normalizeCareReportComparisonText(nextReportText);
}

/** Converts old structured rows to one uninterrupted body without writing them back. */
export function normalizeStoredCareReport(value: unknown): CareReportDraft | null {
  if (typeof value === "string") {
    const parsed = careReportDraftSchema.safeParse({ reportText: value });
    return parsed.success ? parsed.data : null;
  }
  const current = careReportDraftSchema.safeParse(value);
  if (current.success) return current.data;
  const legacy = legacyStructuredCareReportSchema.safeParse(value);
  if (!legacy.success) return null;
  const textParts = [
    legacy.data.oneLineSummary,
    legacy.data.treatmentSummary,
    legacy.data.conditionSummary,
    legacy.data.groomingResponse,
    ...legacy.data.homeCareTips,
    legacy.data.nextVisitGuide,
  ].map(sanitizeCareReportText).filter(Boolean);
  const reportText = textParts.filter((part, index) => textParts.indexOf(part) === index).join(" ");
  const parsed = careReportDraftSchema.safeParse({ reportText });
  return parsed.success ? parsed.data : null;
}

export function serializeCareReportSavePayload({
  reportText,
  photoConsent,
}: {
  reportText: string;
  photoConsent: boolean;
}) {
  return JSON.stringify({ reportText, photoConsent });
}

export function matchesCanonicalCareReportSave({
  expected,
  actual,
}: {
  expected: { reportText: string; photoConsent: boolean };
  actual: { reportText: string; photoConsent: boolean };
}) {
  return actual.reportText === expected.reportText && actual.photoConsent === expected.photoConsent;
}

export function buildBasicCareReportText(petName: string, serviceName: string) {
  const pet = sanitizeCareReportText(petName) || "반려동물";
  const service = sanitizeCareReportText(serviceName) || "예약한 미용";
  return `${pet}의 ${service}을 마무리했어요.`;
}
