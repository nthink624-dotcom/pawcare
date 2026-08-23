import {
  careReportDraftSchema,
  type CareReportDraft,
  type CareReportObservations,
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
    oneLineSummary: summary.slice(0, 280),
    treatmentSummary: buildVerifiedTreatmentSummary(context.serviceName, context.actualDurationMinutes),
    conditionSummary,
    groomingResponse,
    homeCareTips,
    nextVisitGuide: buildVerifiedNextVisitGuide(context.nextRecommendedVisitDate),
  });
}

export function buildPreviewCareReportDraft(context: CareReportDraftContext): CareReportDraft {
  const ownerSourceText = sanitizeCareReportText(context.ownerSourceText);
  const revisionOnly = Boolean(
    context.currentDraft &&
      /말투|부드럽|간결|짧게|다듬|정리/.test(ownerSourceText) &&
      !/눈|귀|털|피부|발|샴푸|미용|반응|긴장|편안|홈케어/.test(ownerSourceText),
  );
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
      oneLineSummary: revisionOnly
        ? context.currentDraft?.oneLineSummary ?? ""
        : [context.currentDraft?.oneLineSummary, ownerSourceText].filter(Boolean).join(" ") || `${context.petName}가 오늘 ${context.serviceName || "예약한 미용"}을 마쳤어요.`,
      treatmentSummary: buildVerifiedTreatmentSummary(context.serviceName, context.actualDurationMinutes),
      conditionSummary: conditionLines.join(". "),
      groomingResponse: responseLines.join(". "),
      homeCareTips: homeCareLines,
      nextVisitGuide: buildVerifiedNextVisitGuide(context.nextRecommendedVisitDate),
    },
    context,
  );
}
