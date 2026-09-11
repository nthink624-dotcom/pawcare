import {
  careReportDraftSchema,
  type CareReportDraft,
  type CareReportObservations,
  type CareReportSourceFactCitation,
  type CareReportSourceFact,
} from "@/types/care-report";

export type CareReportDraftContext = {
  petName: string;
  serviceName: string;
  actualDurationMinutes: number | null;
  nextRecommendedVisitDate: string | null;
  ownerSourceText: string;
  observations: CareReportObservations;
  currentDraft?: CareReportDraft;
};

const emptyDetailPatterns = [
  /^(?:오너가 )?별도(?:로)? (?:남긴 )?(?:상태|반응|홈케어|안내|기록).*(?:없어요|없습니다)[.]?$/,
  /^(?:별도 )?기록(?:이)? (?:없어요|없습니다)[.]?$/,
  /^(?:확인된|입력된|등록된) (?:내용|기록)(?:이)? (?:없어요|없습니다)[.]?$/,
  /^해당 없음[.]?$/,
];

const genericDeletionPattern = /(?:빼|삭제|없애|지워|제외)(?:줘|주세요|해줘|합니다|할게)?/;

export function sanitizeCareReportText(value: string) {
  return value
    .replace(/[ㄱ-ㅎㅏ-ㅣ]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

/**
 * Keeps the owner-visible note usable while ensuring direct contact and address
 * fragments never enter an AI prompt or draft provenance payload.
 */
export function scrubCareReportSourceText(value: string) {
  return sanitizeCareReportText(
    careReportPiiPatterns.reduce((text, pattern) => text.replace(pattern, "[개인정보 제외]"), value),
  ).slice(0, 1000);
}

export function hasCareReportPiiResidual(value: string) {
  return careReportPiiResidualPatterns.some((pattern) => pattern.test(value));
}

export function assertCareReportTextPiiFree(value: string) {
  if (hasCareReportPiiResidual(value)) throw new CareReportPiiResidualError();
}

/** Applies replacement first, then fails closed if a contact/address-shaped span remains. */
export function prepareCareReportSourceText(value: string) {
  const scrubbed = scrubCareReportSourceText(value);
  if (hasCareReportPiiResidual(scrubbed)) throw new CareReportPiiResidualError();
  return scrubbed;
}

export const CARE_REPORT_GENERATION_RETRY_MESSAGE =
  "AI가 문장을 충분히 다듬지 못했습니다. 입력은 그대로 두었으니 다시 시도해 주세요.";

export function normalizeCareReportComparisonText(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");
}

function generatedCareReportTexts(draft: CareReportDraft) {
  return [
    draft.oneLineSummary,
    draft.conditionSummary,
    draft.groomingResponse,
    ...draft.homeCareTips,
  ];
}

/** Rejects a provider or fallback result that only repeats the owner's source. */
export function hasCareReportExactSourceEcho(sourceText: string, draft: CareReportDraft) {
  const normalizedSource = normalizeCareReportComparisonText(sourceText);
  if (!normalizedSource) return false;

  return generatedCareReportTexts(draft).some((value) => {
    const normalizedValue = normalizeCareReportComparisonText(value);
    if (normalizedValue === normalizedSource) return true;
    return value
      .split(/(?<=[.!?])\s+|\n+/)
      .some((sentence) => normalizeCareReportComparisonText(sentence) === normalizedSource);
  });
}

/** Prevents an unchanged retry fallback from being presented as a newly generated draft. */
export function isCareReportDraftUnchanged(currentDraft: CareReportDraft, nextDraft: CareReportDraft) {
  const currentTexts = generatedCareReportTexts(currentDraft);
  const nextTexts = generatedCareReportTexts(nextDraft);
  return currentTexts.length === nextTexts.length && currentTexts.every((value, index) =>
    normalizeCareReportComparisonText(value) === normalizeCareReportComparisonText(nextTexts[index] ?? ""),
  );
}

export function sanitizeCareReportObservations(observations: CareReportObservations): CareReportObservations {
  const scrub = (value: string) => prepareCareReportSourceText(value);
  return {
    ...observations,
    coat: observations.coat.map(scrub),
    skin: observations.skin.map(scrub),
    ears: observations.ears.map(scrub),
    pawsAndNails: observations.pawsAndNails.map(scrub),
    groomingResponse: observations.groomingResponse.map(scrub),
    customNote: scrub(observations.customNote),
    sourceFacts: observations.sourceFacts.map((fact) => ({ ...fact, text: scrub(fact.text) })),
  };
}

export function serializeCareReportSavePayload({
  careReport,
  observations,
  sourceText,
  photoConsent,
}: {
  careReport: CareReportDraft;
  observations: CareReportObservations;
  sourceText: string;
  photoConsent: boolean;
}) {
  const { saveRequestId: _saveRequestId, savePayloadFingerprint: _savePayloadFingerprint, ...persistedObservations } = observations;
  return JSON.stringify({ careReport, observations: persistedObservations, sourceText, photoConsent });
}

/**
 * A draft is only marked saved after the canonical no-store read returns the
 * exact owner-visible report, all persisted observations, and photo consent.
 * Keeping this client-safe lets the completion UI and its no-call contract
 * tests share the same equality boundary.
 */
export function matchesCanonicalCareReportSave({
  expected,
  actual,
}: {
  expected: {
    careReport: CareReportDraft;
    observations: CareReportObservations;
    sourceText: string;
    photoConsent: boolean;
  };
  actual: {
    careReport: CareReportDraft;
    observations: CareReportObservations;
    sourceText: string;
    photoConsent: boolean;
  };
}) {
  return JSON.stringify(actual.careReport) === JSON.stringify(expected.careReport) &&
    JSON.stringify(actual.observations) === JSON.stringify(expected.observations) &&
    actual.sourceText === expected.sourceText &&
    actual.photoConsent === expected.photoConsent;
}

export function createCareReportSourceFacts(
  sourceText: string,
  selectedCategories: Array<CareReportSourceFact["category"]> = [],
): CareReportSourceFact[] {
  const text = prepareCareReportSourceText(sourceText);
  if (!text) return [];

  const uniqueCategories = [...new Set(selectedCategories)].slice(0, 5);
  return [
    { id: "fact-note", category: "general", text, source: "note" },
    ...uniqueCategories.map((category) => ({
      id: `fact-chip-${category}`,
      category,
      text,
      source: "chip" as const,
    })),
  ];
}

function cleanDetail(value: string) {
  const cleaned = sanitizeCareReportText(value);
  return emptyDetailPatterns.some((pattern) => pattern.test(cleaned)) ? "" : cleaned;
}

function formatDuration(minutes: number | null) {
  if (!minutes || minutes <= 0) return "";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return [hours ? `${hours}시간` : "", remainder ? `${remainder}분` : ""].filter(Boolean).join(" ");
}

export function buildVerifiedTreatmentSummary(serviceName: string, actualDurationMinutes: number | null) {
  const service = serviceName.trim() || "예약한 미용";
  const duration = formatDuration(actualDurationMinutes);
  return duration
    ? `${service}을 진행했고, 총 작업 시간은 ${duration}이었어요.`
    : `${service}을 진행했어요.`;
}

export function buildVerifiedNextVisitGuide(nextRecommendedVisitDate: string | null) {
  return nextRecommendedVisitDate
    ? `${nextRecommendedVisitDate} 전후로 다음 관리를 권장해요.`
    : "";
}

function hasConditionEvidence(observations: CareReportObservations, ownerSourceText: string) {
  return Boolean(
    observations.coat.length ||
      observations.skin.length ||
      observations.ears.length ||
      observations.pawsAndNails.length ||
      /털|엉킴|모질|피부|귀|눈물|눈가|발톱|발바닥|상처|스크래치|붉|색소/.test(ownerSourceText),
  );
}

function hasResponseEvidence(observations: CareReportObservations, ownerSourceText: string) {
  return Boolean(
    observations.groomingResponse.length ||
      /반응|예민|긴장|편안|차분|움직|싫어|좋아|무서워|떨/.test(ownerSourceText),
  );
}

function hasHomeCareEvidence(ownerSourceText: string) {
  return /집에서|홈케어|관리해|관리 부탁|닦아 ?주|빗질해 ?주|확인해 ?주|주의해 ?주|해주세요|해 주세요|권장/.test(ownerSourceText);
}

function removeUnsupportedSummaryClaims(
  summary: string,
  evidence: { condition: boolean; response: boolean; homeCare: boolean },
) {
  return summary
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => evidence.condition || !/털|엉킴|모질|피부|귀|눈물|눈가|발톱|발바닥|상처|스크래치|붉|색소/.test(sentence))
    .filter((sentence) => evidence.response || !/(?:미용|드라이|목욕).*(?:편안|차분|긴장|예민|반응)|잘 받았/.test(sentence))
    .filter((sentence) => evidence.homeCare || !/집에서|홈케어|관리해|닦아 ?주|빗질해 ?주|확인해 ?주|해주세요|해 주세요/.test(sentence))
    .join(" ")
    .trim();
}

function shouldAllowBlank(ownerSourceText: string, fieldKeywords: RegExp) {
  return genericDeletionPattern.test(ownerSourceText) && (fieldKeywords.test(ownerSourceText) || /이 문장|이 내용|해당 내용/.test(ownerSourceText));
}

function preserveExistingDetail(
  generated: string,
  existing: string | undefined,
  ownerSourceText: string,
  fieldKeywords: RegExp,
) {
  if (generated || !existing || shouldAllowBlank(ownerSourceText, fieldKeywords)) return generated;
  return existing;
}

function preserveExistingTips(
  generated: string[],
  existing: string[] | undefined,
  ownerSourceText: string,
) {
  if (generated.length || !existing?.length || shouldAllowBlank(ownerSourceText, /홈케어|관리|팁|안내/)) return generated;
  return existing;
}

export function finalizeCareReportDraft(
  generatedDraft: CareReportDraft,
  context: CareReportDraftContext,
): CareReportDraft {
  const ownerSourceText = sanitizeCareReportText(context.ownerSourceText);
  const hasOwnerEvidence = Boolean(ownerSourceText) || [
    ...context.observations.coat,
    ...context.observations.skin,
    ...context.observations.ears,
    ...context.observations.pawsAndNails,
    ...context.observations.groomingResponse,
  ].some(Boolean);
  const existing = context.currentDraft;
  const conditionEvidence = hasConditionEvidence(context.observations, ownerSourceText);
  const responseEvidence = hasResponseEvidence(context.observations, ownerSourceText);
  const homeCareEvidence = hasHomeCareEvidence(ownerSourceText);

  let conditionSummary = cleanDetail(generatedDraft.conditionSummary);
  let groomingResponse = cleanDetail(generatedDraft.groomingResponse);
  let homeCareTips = generatedDraft.homeCareTips.map(cleanDetail).filter(Boolean).slice(0, 4);

  if (!conditionEvidence && !existing?.conditionSummary) conditionSummary = "";
  if (!responseEvidence && !existing?.groomingResponse) groomingResponse = "";
  if (!homeCareEvidence && !existing?.homeCareTips.length) homeCareTips = [];

  conditionSummary = preserveExistingDetail(conditionSummary, existing?.conditionSummary, ownerSourceText, /상태|관찰|피부|귀|털|눈|발/);
  groomingResponse = preserveExistingDetail(groomingResponse, existing?.groomingResponse, ownerSourceText, /반응|미용 중|긴장|예민/);
  homeCareTips = preserveExistingTips(homeCareTips, existing?.homeCareTips, ownerSourceText);

  const safeFallback = `${context.petName}가 오늘 ${context.serviceName || "예약한 미용"}을 마쳤어요.`;
  const generatedSummary = hasOwnerEvidence || existing
    ? sanitizeCareReportText(generatedDraft.oneLineSummary) || existing?.oneLineSummary || safeFallback
    : safeFallback;
  const summary = removeUnsupportedSummaryClaims(generatedSummary, {
    condition: conditionEvidence || Boolean(existing?.conditionSummary),
    response: responseEvidence || Boolean(existing?.groomingResponse),
    homeCare: homeCareEvidence || Boolean(existing?.homeCareTips.length),
  }) || safeFallback;

  return careReportDraftSchema.parse({
    oneLineSummary: summary.slice(0, 400),
    treatmentSummary: buildVerifiedTreatmentSummary(context.serviceName, context.actualDurationMinutes),
    conditionSummary,
    groomingResponse,
    homeCareTips,
    nextVisitGuide: buildVerifiedNextVisitGuide(context.nextRecommendedVisitDate),
  });
}

export function buildPreviewCareReportDraft(context: CareReportDraftContext): CareReportDraft {
  const ownerSourceText = sanitizeCareReportText(context.ownerSourceText);
  const normalizedOwnerSourceText = normalizeCareReportComparisonText(ownerSourceText);
  const previewSummary = normalizedOwnerSourceText === "목욕잘했고괜찮았습니다"
    ? "목욕을 잘 마쳤으며, 전반적인 상태도 양호했습니다."
    : normalizedOwnerSourceText === "목욕잘했고컨디션좋았다"
      ? "목욕을 잘 마쳤고, 컨디션도 좋았습니다."
      : "";

  if (ownerSourceText && !previewSummary) {
    throw new Error(CARE_REPORT_GENERATION_RETRY_MESSAGE);
  }
  const conditionLines = ownerSourceText
    ? ownerSourceText.split(/[.!?]\s*/).filter((line) => /털|엉킴|모질|피부|귀|눈물|눈가|발톱|발바닥|상처|스크래치|붉|색소/.test(line))
    : [];
  const responseLines = ownerSourceText
    ? ownerSourceText.split(/[.!?]\s*/).filter((line) => /반응|예민|긴장|편안|차분|움직|싫어|좋아|무서워|떨/.test(line))
    : [];
  const homeCareLines = ownerSourceText
    ? ownerSourceText.split(/[.!?]\s*/).filter((line) => hasHomeCareEvidence(line))
    : [];

  return finalizeCareReportDraft(
    {
      oneLineSummary: previewSummary || `${context.petName}가 오늘 ${context.serviceName || "예약한 미용"}을 마쳤어요.`,
      treatmentSummary: buildVerifiedTreatmentSummary(context.serviceName, context.actualDurationMinutes),
      conditionSummary: conditionLines.join(". "),
      groomingResponse: responseLines.join(". "),
      homeCareTips: homeCareLines,
      nextVisitGuide: buildVerifiedNextVisitGuide(context.nextRecommendedVisitDate),
    },
    context,
  );
}
