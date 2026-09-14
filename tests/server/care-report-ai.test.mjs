import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});

const {
  buildSafeNaturalCareReportFallback,
  buildCareReportPrompt,
  buildCareReportProviderRequestBody,
  generateCareReportDraft,
  normalizeGeneratedCareReportText,
  parseAndValidateCareReportProviderOutput,
} = await import("../../src/server/care-report-ai.ts");
const { assertGeneratedCareReportFidelity, assertSingleTextCareReportSafety } = await import("../../src/server/care-report-fact-safety.ts");
const {
  normalizeStoredCareReport,
  prepareCareReportSourceText,
} = await import("../../src/lib/care-report-draft.ts");
const { careReportDraftSchema, careReportGenerationInputSchema } = await import("../../src/types/care-report.ts");

function envelope(value, usage = { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }) {
  return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }], usage };
}

test("the writable result schema accepts only one reportText string", () => {
  assert.deepEqual(careReportDraftSchema.parse({ reportText: "오늘 미용을 잘 마무리했어요." }), { reportText: "오늘 미용을 잘 마무리했어요." });
  assert.equal(careReportDraftSchema.safeParse({ reportText: "본문", conditionSummary: "별도 섹션" }).success, false);
  assert.equal(careReportGenerationInputSchema.safeParse({ shopId: "shop", appointmentId: "appointment", sourceText: "오늘 전체적으로 괜찮았어" }).success, true);
  assert.equal(careReportGenerationInputSchema.safeParse({ shopId: "shop", appointmentId: "appointment", sourceText: "" }).success, false);
});

test("legacy structured reports are read as one uninterrupted body", () => {
  const normalized = normalizeStoredCareReport({
    oneLineSummary: "오늘 미용을 마쳤어요.",
    treatmentSummary: "전체 미용을 진행했어요.",
    conditionSummary: "왼쪽 귀를 살펴봤어요.",
    groomingResponse: "차분하게 진행했어요.",
    homeCareTips: ["집에서 귀를 살펴봐 주세요."],
    nextVisitGuide: "다음 달에 다시 만나요.",
  });
  assert.equal(normalized?.reportText, "오늘 미용을 마쳤어요. 전체 미용을 진행했어요. 왼쪽 귀를 살펴봤어요. 차분하게 진행했어요. 집에서 귀를 살펴봐 주세요. 다음 달에 다시 만나요.");
  assert.equal(Object.keys(normalized ?? {}).join(","), "reportText");
});

test("prompt and provider request prohibit headings, sections, and multi-field output", () => {
  const prompt = buildCareReportPrompt({ sourceText: "오늘 작업 전체적으로 괜찮았어" });
  assert.match(prompt.system, /reportText 문자열 하나만/);
  assert.match(prompt.system, /제목, 소제목, 항목명, 불릿, 번호, 표, 섹션 구분을 만들지 마세요/);
  assert.match(prompt.system, /반말, 메모체, 끊긴 음성 인식 문장, 반복어/);
  assert.match(prompt.system, /하나도 빠뜨리지 마세요/);
  assert.match(prompt.system, /짧은 입력은 1~2문장.*2~5문장/);
  assert.match(prompt.system, /입력에 없는 홈케어 조언, 권장사항, 보호자 호칭, 상투적인 칭찬이나 과장/);
  assert.match(prompt.system, /원문의 각 사실이 반영됐고 새로운 사실이 없는지 확인/);
  assert.doesNotMatch(prompt.user, /oneLineSummary|sourceFacts|category/);
  const body = buildCareReportProviderRequestBody("model", prompt);
  assert.equal(body.response_format.type, "json_object");
  assert.equal(body.stream, false);
});

test("rough voice and memo input is normalized without losing clause boundaries", () => {
  assert.equal(
    prepareCareReportSourceText("어 귀 뒤 엉킴\n빗질 빗질 싫어 싫어\n음 쉬엄쉬엄 함"),
    "귀 뒤 엉킴. 빗질 싫어. 쉬엄쉬엄 함",
  );
  assert.equal(normalizeGeneratedCareReportText("귀 뒤쪽을 정리했습니다.\n\n빗질은 쉬어가며 진행했습니다."), "귀 뒤쪽을 정리했습니다. 빗질은 쉬어가며 진행했습니다.");
});

test("safe general impression has a deterministic natural fallback instead of being blocked as an echo", () => {
  const sourceText = "오늘 작업 전체적으로 괜찮았어";
  assert.equal(buildSafeNaturalCareReportFallback(sourceText), "오늘 미용은 전반적으로 편안하게 진행되었습니다.");
  const parsed = parseAndValidateCareReportProviderOutput(envelope({ reportText: sourceText }), { sourceText });
  assert.equal(parsed.reportText, "오늘 미용은 전반적으로 편안하게 진행되었습니다.");
});

test("realistic Korean golden cases preserve every supplied fact without adding advice", () => {
  const cases = [
    ["목욕 진행함\n발톱 정리함", "목욕을 진행했고 발톱을 정리했습니다."],
    ["오늘 작업 전체적으로 괜찮았어", "오늘 미용은 전반적으로 편안하게 진행되었습니다."],
    ["빗질 빗질 싫어 싫어 쉬엄쉬엄 함", "빗질 중 불편해해 중간중간 쉬어가며 진행했습니다."],
    ["귀 뒤 엉킴 있었고\n어 빗질 싫어해서\n음 쉬엄쉬엄 함", "귀 뒤쪽에 엉킴이 있어 정리했습니다. 빗질 중 불편해해 중간중간 쉬어가며 진행했습니다."],
    ["귀뒤 엉킴 좀 있었고 빗질 싫어해서 쉬엄쉬엄 함", "귀 뒤쪽에 엉킴이 있어 정리했습니다. 빗질 중 불편해해 중간중간 쉬어가며 진행했습니다."],
    ["피부 좀 이상해 보임", "피부가 조금 이상해 보였습니다."],
    ["피부가 빨개서 피부염 같은데", "피부가 붉어 보였습니다."],
    ["왼쪽 귀에 2cm 상처 없음", "왼쪽 귀에는 2cm 크기의 상처가 보이지 않았습니다."],
  ];
  for (const [sourceText, reportText] of cases) {
    const parsed = parseAndValidateCareReportProviderOutput(envelope({ reportText }), { sourceText: prepareCareReportSourceText(sourceText) });
    assert.equal(parsed.reportText, reportText);
    assert.doesNotMatch(parsed.reportText, /보호자님|홈케어|권장/);
  }
});

test("generation fidelity fails closed on omitted or invented facts and filler writing", () => {
  assert.throws(
    () => assertGeneratedCareReportFidelity("귀 뒤쪽 엉킴을 정리했고 빗질 중 불편해했습니다.", "귀 뒤 엉킴, 빗질 싫어함, 쉬엄쉬엄 진행함"),
    (error) => error.ruleCode === "fact_omission_validation_rejected",
  );
  assert.throws(
    () => assertGeneratedCareReportFidelity("귀 뒤쪽 엉킴을 정리하고 목욕도 진행했습니다.", "귀 뒤 엉킴 정리함"),
    (error) => error.ruleCode === "fact_addition_validation_rejected",
  );
  assert.throws(
    () => assertGeneratedCareReportFidelity("귀 뒤쪽 엉킴을 정리했습니다. 집에서 매일 빗질해 주세요.", "귀 뒤 엉킴 정리함"),
    (error) => error.ruleCode === "fact_addition_validation_rejected",
  );
  assert.throws(
    () => assertGeneratedCareReportFidelity("왼쪽 귀에는 상처가 보이지 않았습니다.", "왼쪽 귀에 2cm 상처 없음"),
    (error) => error.ruleCode === "fact_omission_validation_rejected",
  );
  assert.throws(
    () => assertGeneratedCareReportFidelity("케어리포트: 오늘 미용 괜찮았어.", "오늘 미용 괜찮았어"),
    (error) => error.ruleCode === "writing_style_validation_rejected",
  );
});

test("a general work impression generates one smooth customer report in one provider call", async () => {
  let calls = 0;
  const result = await generateCareReportDraft({ sourceText: "오늘 작업 전체적으로 괜찮았어" }, {
    fetchImpl: async () => {
      calls += 1;
      return Response.json(envelope({ reportText: "오늘 미용은 전체적으로 괜찮게 마무리했어요." }));
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(result).sort(), ["estimatedCostUsd", "inputHash", "model", "reportText", "usage"]);
  assert.equal(result.reportText, "오늘 미용은 전체적으로 괜찮게 마무리했어요.");
});

test("revision receives the current report and replaces it with one new reportText", () => {
  const context = { currentReportText: "오늘 미용을 잘 마무리했어요.", revisionRequest: "조금 더 부드럽게", sourceText: "" };
  const prompt = buildCareReportPrompt(context);
  assert.match(prompt.user, /currentReportText/);
  assert.match(prompt.user, /revisionRequest/);
  assert.doesNotMatch(prompt.user, /sourceFacts|sourceFactCitations/);
  const result = parseAndValidateCareReportProviderOutput(envelope({ reportText: "오늘 미용을 편안한 분위기에서 잘 마무리했어요." }), context);
  assert.equal(result.reportText, "오늘 미용을 편안한 분위기에서 잘 마무리했어요.");
});

test("medical assertions, PII, invented numbers, changed sides, and negation reversal fail closed", () => {
  assert.throws(() => assertSingleTextCareReportSafety("피부염으로 진단됐어요.", "피부가 붉어 보였어요."), (error) => error.ruleCode === "unsupported_claim_validation_rejected");
  assert.throws(() => assertSingleTextCareReportSafety("연락처는 010-1234-5678입니다.", "오늘 미용을 마쳤어요."), (error) => error.ruleCode === "pii_validation_rejected");
  assert.throws(() => assertSingleTextCareReportSafety("왼쪽 귀에 3cm 붉은 부분이 보여요.", "왼쪽 귀에 2cm 붉은 부분이 보여요."), (error) => error.ruleCode === "number_unit_validation_rejected");
  assert.throws(() => assertSingleTextCareReportSafety("오른쪽 귀에 2cm 붉은 부분이 보여요.", "왼쪽 귀에 2cm 붉은 부분이 보여요."), (error) => error.ruleCode === "side_validation_rejected");
  assert.throws(() => assertSingleTextCareReportSafety("왼쪽 귀에 상처가 있었어요.", "왼쪽 귀에 상처는 없었어요."), (error) => error.ruleCode === "negation_validation_rejected");
  assert.match(prepareCareReportSourceText("연락처 010-1234-5678, 오늘은 괜찮았어"), /\[개인정보 제외\]/);
});

test("provider output rejects old structured fields even when reportText exists", () => {
  assert.throws(
    () => parseAndValidateCareReportProviderOutput(envelope({ reportText: "본문", homeCareTips: [] }), { sourceText: "원문" }),
    (error) => error.ruleCode === "unexpected_field_validation_rejected",
  );
});
