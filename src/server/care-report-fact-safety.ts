import { assertCareReportTextPiiFree } from "@/lib/care-report-draft";

export const CARE_REPORT_SAFETY_RULE_CODES = [
  "structure_validation_rejected",
  "unexpected_field_validation_rejected",
  "fact_omission_validation_rejected",
  "fact_addition_validation_rejected",
  "writing_style_validation_rejected",
  "number_unit_validation_rejected",
  "side_validation_rejected",
  "negation_validation_rejected",
  "unsupported_claim_validation_rejected",
  "echo_validation_rejected",
  "pii_validation_rejected",
  "safety_validation_rejected",
] as const;

export type CareReportSafetyRuleCode = (typeof CARE_REPORT_SAFETY_RULE_CODES)[number];

const safetyMessages: Record<CareReportSafetyRuleCode, string> = {
  structure_validation_rejected: "AI 응답 형식을 확인하지 못했습니다. 입력은 유지되었으니 다시 작성해 주세요.",
  unexpected_field_validation_rejected: "AI 응답에 허용되지 않은 항목이 포함되어 다시 작성이 필요합니다.",
  fact_omission_validation_rejected: "입력한 내용 일부가 초안에서 빠져 다시 작성이 필요합니다.",
  fact_addition_validation_rejected: "입력에 없는 내용이 초안에 포함되어 다시 작성이 필요합니다.",
  writing_style_validation_rejected: "고객에게 보낼 자연스러운 문장으로 다시 작성이 필요합니다.",
  number_unit_validation_rejected: "원문에 없는 수치나 단위가 포함되어 다시 작성이 필요합니다.",
  side_validation_rejected: "좌우 위치가 원문과 다르게 표현되어 다시 작성이 필요합니다.",
  negation_validation_rejected: "원문의 부정 의미가 달라져 다시 작성이 필요합니다.",
  unsupported_claim_validation_rejected: "진단이나 치료로 오해될 문장이 포함되어 다시 작성이 필요합니다.",
  echo_validation_rejected: "AI가 문장을 충분히 다듬지 못했습니다. 입력은 그대로 두었으니 다시 작성해 주세요.",
  pii_validation_rejected: "연락처나 주소로 보이는 내용은 제외한 뒤 다시 작성해 주세요.",
  safety_validation_rejected: "초안의 사실을 안전하게 확인하지 못했습니다. 원문은 유지되었으니 다시 작성해 주세요.",
};

export class CareReportSafetyValidationError extends Error {
  readonly ruleCode: CareReportSafetyRuleCode;

  constructor(ruleCode: CareReportSafetyRuleCode) {
    super(safetyMessages[ruleCode]);
    this.name = "CareReportSafetyValidationError";
    this.ruleCode = ruleCode;
  }
}

export function rejectCareReportSafety(ruleCode: CareReportSafetyRuleCode): never {
  throw new CareReportSafetyValidationError(ruleCode);
}

export function normalizeCareReportSafetyError(error: unknown) {
  return error instanceof CareReportSafetyValidationError ? error : new CareReportSafetyValidationError("safety_validation_rejected");
}

export function toSafeCareReportSafetyDiagnostic(error: unknown) {
  const normalized = normalizeCareReportSafetyError(error);
  return { message: normalized.message, safetyRuleCode: normalized.ruleCode };
}

export function toSafeCareReportSafetyHttpResponse(error: unknown) {
  return { status: 422, body: toSafeCareReportSafetyDiagnostic(error) } as const;
}

const numberUnitPattern = /(-?\d+(?:[.,]\d+)?)\s*(kg|g|분|시간|cm|mm|회|번|일|주|개월|살|도|%|원)/giu;
const diagnosisOrTreatmentPattern = /(?:진단(?:됐|되었|입니다|이에요)|(?:피부염|외이염|결막염|알레르기|감염|종양|골절)(?:입니다|이에요|예요|으로\s*보|가\s*원인)|원인은|때문에\s*(?:생겼|발생)|치료가\s*필요|처방|투약|약을\s*(?:먹이|바르)|걱정하지\s*마|반드시\s*괜찮)/u;
const negationPattern = /(?:없(?:었|는|음|습니다|어요)?|않(?:았|는|음|습니다)?|못\s*했|하지\s*않|안\s*했|미실시|거부)/u;
const sidePatterns = { left: /(?:왼쪽|좌측|왼편)/u, right: /(?:오른쪽|우측|오른편)/u, bilateral: /(?:양쪽|양측)/u } as const;
const bodyParts = ["귀", "피부", "눈", "눈가", "눈물", "발", "발톱", "발바닥", "다리", "꼬리", "배", "등", "목", "얼굴", "입", "치아", "잇몸", "항문", "털", "모질", "관절", "코"] as const;
const generatedHeadingPattern = /^(?:케어리포트|오늘의\s*케어|미용\s*리포트)\s*[:：-]|(?:^|\s)[•●▪■]\s*/u;
const informalEndingPattern = /(?:했어|였어|했음|였음|함|임)(?:[.!?]|$)/u;
const unsolicitedAdvicePattern = /(?:집에서|홈케어|관리해\s*주|관리\s*부탁|닦아\s*주|빗질해\s*주|확인해\s*주|주의해\s*주|해\s*주세요|해주세요|권장(?:해요|합니다)?)/u;
const decorativePraisePattern = /(?:너무\s*)?(?:예쁘|귀엽|사랑스럽|최고)/u;

const semanticFidelityRules = [
  /(?:목욕|샴푸)/u,
  /(?:빗질|브러싱)/u,
  /(?:엉킴|엉켜|엉킨)/u,
  /(?:쉬엄쉬엄|쉬어|휴식)/u,
  /(?:싫어|불편|거부|예민)/u,
  /(?:괜찮|편안|차분|무리\s*없이|안정적)/u,
  /(?:붉|빨갛|빨개|빨간)/u,
  /(?:상처|찰과상)/u,
  /눈물/u,
  /발톱/u,
  /(?:드라이|말리)/u,
] as const;

function numberKeys(value: string) {
  return [...value.matchAll(numberUnitPattern)].map((match) => `${(match[1] ?? "").replaceAll(",", "")}\u0000${(match[2] ?? "").toLocaleLowerCase("ko-KR")}`);
}

function isSubset(values: string[], sourceValues: string[]) {
  const remaining = [...sourceValues];
  return values.every((value) => {
    const index = remaining.indexOf(value);
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
}

function sideKeys(value: string) {
  return Object.entries(sidePatterns).flatMap(([side, pattern]) => [...value.matchAll(new RegExp(pattern.source, "gu"))].map(() => side));
}

function sameMultiset(left: string[], right: string[]) {
  return left.length === right.length && isSubset(left, right);
}

function sentences(value: string) {
  return value.split(/(?<=[.!?])\s+|\n+/u).map((item) => item.trim()).filter(Boolean);
}

export function assertSingleTextCareReportSafety(reportText: string, groundingText: string) {
  try {
    assertCareReportTextPiiFree(reportText);
  } catch {
    rejectCareReportSafety("pii_validation_rejected");
  }
  if (diagnosisOrTreatmentPattern.test(reportText)) rejectCareReportSafety("unsupported_claim_validation_rejected");
  if (!isSubset(numberKeys(reportText), numberKeys(groundingText))) rejectCareReportSafety("number_unit_validation_rejected");

  for (const sentence of sentences(reportText)) {
    const parts = bodyParts.filter((part) => sentence.includes(part));
    if (parts.some((part) => !groundingText.includes(part))) rejectCareReportSafety("safety_validation_rejected");
    for (const part of parts) {
      const matchingSource = sentences(groundingText).filter((sourceSentence) => sourceSentence.includes(part));
      const reportNegated = negationPattern.test(sentence);
      if (matchingSource.length > 0 && matchingSource.every((sourceSentence) => negationPattern.test(sourceSentence) !== reportNegated)) {
        rejectCareReportSafety("negation_validation_rejected");
      }
      const sourceSides = Object.entries(sidePatterns).filter(([, pattern]) => matchingSource.some((sourceSentence) => pattern.test(sourceSentence))).map(([side]) => side);
      const reportSides = Object.entries(sidePatterns).filter(([, pattern]) => pattern.test(sentence)).map(([side]) => side);
      if (sourceSides.length > 0 && (reportSides.length === 0 || reportSides.some((side) => !sourceSides.includes(side)))) {
        rejectCareReportSafety("side_validation_rejected");
      }
      if (sourceSides.length === 0 && reportSides.length > 0) rejectCareReportSafety("side_validation_rejected");
    }
  }
}

/** Generation-only validation. It does not create or persist a structured fact payload. */
export function assertGeneratedCareReportFidelity(reportText: string, sourceText: string) {
  const source = sourceText.replaceAll("[개인정보 제외]", " ").trim();
  if (!source) rejectCareReportSafety("safety_validation_rejected");
  const reportSentences = sentences(reportText);
  if (
    reportSentences.length === 0 ||
    reportSentences.length > 5 ||
    generatedHeadingPattern.test(reportText) ||
    informalEndingPattern.test(reportText) ||
    /보호자님/u.test(reportText) ||
    /\[개인정보 제외\]/u.test(reportText)
  ) {
    rejectCareReportSafety("writing_style_validation_rejected");
  }

  const sourceNumbers = numberKeys(source);
  const reportNumbers = numberKeys(reportText);
  if (!sameMultiset(sourceNumbers, reportNumbers)) {
    rejectCareReportSafety(reportNumbers.length > sourceNumbers.length
      ? "number_unit_validation_rejected"
      : "fact_omission_validation_rejected");
  }

  const sourceSides = sideKeys(source);
  const reportSides = sideKeys(reportText);
  if (!sameMultiset(sourceSides, reportSides)) {
    rejectCareReportSafety(reportSides.length > sourceSides.length
      ? "side_validation_rejected"
      : "fact_omission_validation_rejected");
  }

  for (const part of bodyParts) {
    if (source.includes(part) && !reportText.includes(part)) rejectCareReportSafety("fact_omission_validation_rejected");
  }

  for (const pattern of semanticFidelityRules) {
    const sourceHasMeaning = pattern.test(source);
    const reportHasMeaning = pattern.test(reportText);
    if (sourceHasMeaning && !reportHasMeaning) rejectCareReportSafety("fact_omission_validation_rejected");
    if (!sourceHasMeaning && reportHasMeaning) rejectCareReportSafety("fact_addition_validation_rejected");
  }

  if (unsolicitedAdvicePattern.test(reportText) && !unsolicitedAdvicePattern.test(source)) {
    rejectCareReportSafety("fact_addition_validation_rejected");
  }
  if (decorativePraisePattern.test(reportText) && !decorativePraisePattern.test(source)) {
    rejectCareReportSafety("fact_addition_validation_rejected");
  }
}
