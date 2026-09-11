import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { matchesCanonicalCareReportSave } from "../../src/lib/care-report-draft.ts";
import { careReportObservationsSchema } from "../../src/types/care-report.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("care report completion choice and composer remain mutually exclusive", () => {
  const calendar = readProjectFile("src/components/owner-web/calendar-management-screen.tsx");
  const choice = readProjectFile("src/components/owner-web/calendar-care-report-choice-dialog.tsx");

  assert.match(calendar, /const careReportFlowOverlayOpen = Boolean\(careReportChoiceBooking \|\| photoStatusAction\)/);
  assert.match(calendar, /setPhotoStatusAction\(null\);\s+setBasicCareReportError\(""\);\s+setCareReportChoiceBooking\(targetBooking\);/);
  assert.match(calendar, /setCareReportChoiceBooking\(null\);\s+const canonicalAppointment = bootstrapData\.appointments\.find/);
  assert.doesNotMatch(calendar, /currentWeightKg:\s*selectedPet\?\.weight/);
  assert.match(calendar, /careReportChoiceTransitionRef\.current = true/);
  assert.match(calendar, /photoStatusAction && !careReportChoiceBooking/);
  assert.match(calendar, /inert=\{careReportFlowOverlayOpen \? true : undefined\}/);
  assert.match(calendar, /role="dialog"\s+aria-modal="true"\s+aria-labelledby="completion-care-report-title"/);
  assert.match(calendar, /function handleDialogKeyDown/);
  assert.match(calendar, /function getVisibleDialogFocusableElements\(dialog: HTMLElement \| null\)/);
  assert.match(calendar, /element\.type === "file" && element\.classList\.contains\("hidden"\)/);
  assert.match(calendar, /!element\.closest\("\[inert\], \[aria-hidden=\\"true\\"\], \[hidden\]"\)/);
  assert.match(calendar, /focusTrapSuspended=\{careReportFlowOverlayOpen\}/);
  assert.match(calendar, /if \(!selectedBooking\?\.id \|\| focusTrapSuspended\) return;/);
  assert.match(calendar, /const focusable = getVisibleDialogFocusableElements\(dialogRef\.current\)/);
  assert.match(choice, /role="dialog"\s+aria-modal="true"\s+aria-labelledby="care-report-choice-title"/);
  assert.match(choice, /function handleKeyDown/);
  assert.match(choice, /onClose: \(\) => void/);
  assert.match(choice, /focus-visible:outline-\[#2563eb\]/);
});

test("basic record success becomes terminal only after persistence succeeds", () => {
  const calendar = readProjectFile("src/components/owner-web/calendar-management-screen.tsx");
  const publishBasicStart = calendar.indexOf("async function publishBasicCareRecord");
  const publishBasicEnd = calendar.indexOf("function closeCareReportChoice", publishBasicStart);
  const publishBasic = calendar.slice(publishBasicStart, publishBasicEnd);

  assert.ok(publishBasicStart >= 0 && publishBasicEnd > publishBasicStart);
  assert.match(calendar, /const basicCareReportTerminalBookingIdsRef = useRef\(new Set<string>\(\)\)/);
  assert.equal((calendar.match(/basicCareReportTerminalBookingIdsRef\.current\.has\(booking\.id\)/g) ?? []).length, 2);
  assert.match(
    calendar,
    /function markBasicCareReportTerminal\(bookingId: string\)[\s\S]{0,600}setCareReportChoiceBooking\([\s\S]{0,180}setPhotoStatusAction\(/,
  );
  assert.match(calendar, /const basicCareReportTerminal = basicCareReportTerminalBookingIds\.has\(selectedBooking\.id\)/);
  assert.match(calendar, /const showCareReportAction = workflowCompleted && !basicCareReportTerminal/);
  assert.match(calendar, /!careReportChoiceOpen && \(showCareReportAction \? \(/);

  assert.equal((publishBasic.match(/markBasicCareReportTerminal\(booking\.id\)/g) ?? []).length, 2);
  assert.match(
    publishBasic,
    /const succeeded = await applyBookingStatusChange\(booking\.id, "완료"\);\s+if \(succeeded !== true\) throw[\s\S]{0,120}markBasicCareReportTerminal\(booking\.id\)/,
  );
  assert.match(
    publishBasic,
    /await fetchApiJsonWithAuth\("\/api\/owner\/care-reports",[\s\S]{0,500}markBasicCareReportTerminal\(booking\.id\)/,
  );
  assert.match(publishBasic, /catch \{\s+setBasicCareReportError\(/);
  assert.doesNotMatch(publishBasic, /clearDraft|draft\./);
});

test("completion close and autosave share one in-flight draft write", () => {
  const calendar = readProjectFile("src/components/owner-web/calendar-management-screen.tsx");
  const draftHook = readProjectFile("src/components/owner-web/use-grooming-record-draft.ts");

  assert.match(calendar, /const saveAndCloseInFlightRef = useRef\(false\)/);
  assert.match(
    calendar,
    /if \(saveAndCloseInFlightRef\.current \|\| busy \|\| \(!allowCareReportBusy && careReportBusy\)\) return;\s+\s*saveAndCloseInFlightRef\.current = true;\s+\s*setCompleting\(true\)/,
  );
  assert.match(calendar, /finally \{\s+setCompleting\(false\);\s+saveAndCloseInFlightRef\.current = false;/);

  assert.match(draftHook, /const persistInFlightRef = useRef<Promise<boolean> \| null>\(null\)/);
  assert.match(draftHook, /if \(persistInFlightRef\.current\) return persistInFlightRef\.current;/);
  assert.match(draftHook, /persistInFlightRef\.current = persistPromise;/);
  assert.match(draftHook, /const flushDraft = useCallback\(\(\) => \{\s+if \(saveTimerRef\.current\)/);
  assert.match(draftHook, /flushDraft,/);
});

test("care report authoring keeps every small control reachable at 44px", () => {
  const calendar = readProjectFile("src/components/owner-web/calendar-management-screen.tsx");
  const completionFields = readProjectFile("src/components/owner-web/calendar-grooming-completion-fields.tsx");
  const noteInput = readProjectFile("src/components/owner-web/calendar-care-note-input.tsx");
  const completionPanel = readProjectFile("src/components/owner-web/calendar-care-report-completion-panel.tsx");
  const photoCard = readProjectFile("src/components/owner-web/calendar-care-report-photo-card.tsx");
  const completionPreview = readProjectFile(
    "src/app/dev/owner-care-report-completion-preview/owner-care-report-completion-preview-client.tsx",
  );

  assert.match(calendar, /inline-flex min-h-11 min-w-11 items-center/);
  assert.match(calendar, /type="checkbox"[\s\S]{0,500}className="h-4 w-4/);
  assert.match(calendar, /inline-flex min-h-11[\s\S]{0,80}cursor-pointer items-center[\s\S]{0,240}focus-within:outline-\[#2563eb\]/);
  assert.match(completionPreview, /inline-flex min-h-11 min-w-11 items-center/);
  assert.match(completionPreview, /inline-flex min-h-11 items-center.*focus-within:outline-\[#2563eb\]/);
  assert.match(completionPreview, /aria-label="닫기" className="grid h-11 w-11/);
  assert.match(completionFields, /data-care-report-metadata-strip/);
  assert.match(completionFields, /aria-label="예약 완료 정보 수정"/);
  assert.match(completionFields, /aria-expanded=\{editingMetadata\}/);
  assert.match(completionFields, /data-care-report-metadata-summary/);
  assert.match(completionFields, /data-care-report-metadata-row="service-weight"[^>]+flex-wrap[^>]+gap-x-3[^>]+gap-y-1/);
  assert.doesNotMatch(completionFields, /data-care-report-metadata-row="service-weight"[^>]+flex-nowrap/);
  assert.match(completionFields, /오늘 몸무게[\s\S]{0,220}max-sm:basis-full|className="inline-flex max-w-full items-baseline gap-1 whitespace-nowrap max-sm:basis-full"[\s\S]{0,220}오늘 몸무게/);
  assert.match(completionFields, /data-care-report-metadata-row="service-weight"[\s\S]{0,500}예약 서비스[\s\S]{0,300}오늘 몸무게/);
  assert.match(completionFields, /data-care-report-metadata-row="reminder"[\s\S]{0,300}재예약 알림/);
  assert.ok(completionFields.indexOf('data-care-report-metadata-row="service-weight"') < completionFields.indexOf('data-care-report-metadata-row="reminder"'));
  assert.ok((completionFields.match(/inline-flex max-w-full items-baseline gap-1 whitespace-nowrap/g) ?? []).length >= 2);
  assert.match(completionFields, /data-care-report-metadata-row="reminder"[^>]+flex-wrap[^>]+gap-x-1[^>]+gap-y-1/);
  assert.match(completionFields, /whitespace-nowrap font-medium">재예약 알림/);
  assert.match(completionFields, /whitespace-nowrap font-normal">\{reminderSummary\}/);
  assert.match(completionFields, /text-\[14px\] \[line-height:1\.45\]/);
  assert.match(completionFields, /font-medium">예약 서비스/);
  assert.match(completionFields, /font-normal">\{bookedService\}/);
  assert.doesNotMatch(completionFields, /text-\[12px\]|font-bold|font-extrabold/);
  assert.match(completionFields, /editingMetadata \? \(/);
  assert.match(completionFields, /space-y-2 border-t border-\[#e8edf3\]/);
  assert.match(completionFields, /OWNER_TYPOGRAPHY\.label\} whitespace-nowrap[^>]+>예약 서비스/);
  assert.match(completionFields, /OWNER_TYPOGRAPHY\.label\} flex min-h-11 items-center whitespace-nowrap[\s\S]{0,120}오늘 몸무게/);
  assert.match(completionFields, /OWNER_TYPOGRAPHY\.label\} flex min-h-11 items-center whitespace-nowrap[\s\S]{0,120}재예약 알림/);
  assert.doesNotMatch(completionFields, /\bScale\b|\bCalendarDays\b/);
  assert.doesNotMatch(completionFields, /min-h-\[72px\]/);
  assert.doesNotMatch(completionFields, /shadow-\[/);
  assert.match(completionFields, /aria-label="예약 서비스 수정"[\s\S]{0,500}h-11/);
  assert.match(completionFields, /aria-label="오늘 몸무게"[\s\S]{0,600}height: "44px"/);
  assert.match(completionFields, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(completionFields, /aria-label="오늘 몸무게"[\s\S]{0,700}w-full min-w-0/);
  assert.doesNotMatch(completionFields, /오늘 몸무게[\s\S]{0,900}flex-none/);
  assert.match(completionFields, /type="date"[\s\S]{0,500}h-11/);
  assert.match(completionFields, /aria-pressed=\{reminderEnabled\}[\s\S]{0,500}min-h-11/);
  assert.ok((completionFields.match(/fontSize: "16px", fontWeight: 500, lineHeight: "24px"/g) ?? []).length >= 4);
  assert.match(completionFields, /sm:grid-cols-\[5\.5rem_minmax\(0,1fr\)\]/);
  assert.match(completionFields, /type="date"[\s\S]{0,500}h-11 w-full min-w-0/);
  assert.match(completionFields, /inline-flex min-h-11 shrink-0 items-center gap-1\.5 rounded-\[9px\] border px-3/);
  assert.match(calendar, /flex flex-wrap items-center gap-3/);
  assert.match(calendar, /role="tablist" aria-label="미용 사진 선택"/);
  assert.doesNotMatch(calendar, /<p[^>]*>사진<\/p>[\s\S]{0,240}role="tablist" aria-label="미용 사진 선택"/);
  assert.doesNotMatch(completionPreview, /\bCamera\b|<p[^>]*>[\s\S]{0,80}사진[\s\S]{0,80}<\/p>[\s\S]{0,240}role="tablist"/);
  assert.equal((noteInput.match(/grid h-11 w-11/g) ?? []).length, 2);
  assert.match(noteInput, /data-care-note-composer/);
  assert.match(noteInput, /data-care-note-input/);
  assert.match(noteInput, /pr-\[96px\]/);
  assert.match(noteInput, /data-care-note-actions-visual[^>]+w-\[92px\]/);
  assert.match(noteInput, /data-care-note-actions-visual[^>]+right-1/);
  assert.equal((noteInput.match(/grid h-8 w-8 place-items-center rounded-full/g) ?? []).length, 2);
  assert.doesNotMatch(noteInput, /Sparkles|AI 케어리포트/);
  assert.match(noteInput, /const speechSupported = useSyncExternalStore\(/);
  assert.match(noteInput, /function getSpeechRecognitionSupportSnapshot\(\) \{\s+return Boolean\(getSpeechRecognitionConstructor\(\)\)/);
  assert.match(noteInput, /function getServerSpeechRecognitionSupportSnapshot\(\) \{\s+return false/);
  assert.doesNotMatch(noteInput, /useState\(\(\) => Boolean\(getSpeechRecognitionConstructor\(\)\)\)/);
  assert.doesNotMatch(completionPanel, /\bSparkles\b/);
  assert.match(completionPanel, />AI가 정리한 내용<\/p>/);
  assert.match(completionPanel, />AI가 정리한 문장<\/p>/);
  assert.equal((completionPanel.match(/inline-flex h-11 items-center/g) ?? []).length, 2);
  assert.match(completionPanel, /sticky bottom-0 z-\[95\] -mx-2[\s\S]{0,180}px-3 py-2/);
  assert.doesNotMatch(completionPanel, /sticky bottom-0 z-\[95\] -mx-3/);
  assert.match(calendar, /h-4 w-4 accent-\[#2f6fd6\] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-\[#2563eb\] focus-visible:ring-2 focus-visible:ring-\[#2563eb\] focus-visible:ring-offset-2/);
  assert.match(photoCard, /focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-\[#2563eb\]/);
  assert.match(photoCard, /flex min-h-\[172px\][^\"]+items-center justify-center/);
  assert.doesNotMatch(photoCard, /mx-auto h-\[172px\]/);
  assert.doesNotMatch(photoCard, /absolute bottom-2 right-2/);
  for (const textareaScope of [noteInput, completionPanel]) {
    assert.match(textareaScope, /data-textarea-input-modality=\{textareaInputModality\}/);
    assert.match(textareaScope, /onPointerDownCapture=\{\(\) => setTextareaInputModality\("pointer"\)\}/);
    assert.match(textareaScope, /onMouseDownCapture=\{\(\) => setTextareaInputModality\("pointer"\)\}/);
    assert.match(textareaScope, /onKeyDownCapture=\{markKeyboardTextareaFocus\}/);
    assert.match(textareaScope, /event\.key === "Tab"\) setTextareaInputModality\("keyboard"\)/);
    assert.match(textareaScope, /textareaFocused && textareaInputModality === "keyboard"/);
    assert.match(textareaScope, /outline: "2px solid #2563eb", outlineOffset: 2/);
    assert.match(textareaScope, /onFocus=\{\(\) => setTextareaFocused\(true\)\}/);
    assert.match(textareaScope, /onBlur=\{\(\) => setTextareaFocused\(false\)\}/);
    assert.match(textareaScope, /outline-none focus:outline-none focus:ring-0/);
  }
  assert.match(completionFields, /onRetrySave \? <button[\s\S]{0,360}inline-flex min-h-11 shrink-0 items-center justify-center/);
  assert.match(completionPanel, /data-care-report-result-area className="min-h-\[180px\][^"]+sm:min-h-\[220px\]"/);
  assert.match(completionPanel, /data-care-report-editor[\s\S]{0,400}min-h-\[180px\][\s\S]{0,300}\[field-sizing:content\][\s\S]{0,300}sm:min-h-\[220px\]/);
  assert.match(completionPanel, /data-care-report-editor-empty[\s\S]{0,300}min-h-\[180px\][\s\S]{0,300}sm:min-h-\[220px\]/);
  assert.doesNotMatch(completionPanel, /max-h-\[148px\]|h-\[108px\]|max-h-\[108px\]/);
});

test("care report generation stays transient and explicit save carries the only persisted provenance", () => {
  const noteInput = readProjectFile("src/components/owner-web/calendar-care-note-input.tsx");
  const panel = readProjectFile("src/components/owner-web/calendar-care-report-completion-panel.tsx");
  const route = readProjectFile("src/app/api/owner/care-reports/route.ts");
  const ai = readProjectFile("src/server/care-report-ai.ts");

  assert.match(noteInput, /maxLength=\{1000\}/);
  assert.doesNotMatch(noteInput, /컨디션|피부·귀|행동|특이사항|관찰 범위 선택|aria-pressed=\{selected\}/);
  assert.match(panel, /new AbortController\(\)/);
  assert.match(panel, /activeGenerationIdRef\.current !== generationId/);
  assert.match(panel, /generationAbortRef\.current\?\.abort\(\)/);
  assert.match(panel, /createCareReportSourceFacts\(sourceText\)/);
  assert.doesNotMatch(panel, /selectedFactCategories|setSelectedFactCategories/);
  assert.match(panel, /saveInFlightRef/);
  assert.match(panel, /saveIdentityRef/);
  assert.match(panel, /committedSaveRef/);
  assert.match(panel, /matchesCanonicalSave/);
  assert.match(panel, /careReportSourceText: sourceText/);
  assert.match(panel, /cache: "no-store"/);
  assert.doesNotMatch(panel, /setComposerValue\(""\);\s+void generateReport/);
  assert.match(route, /status: "preview"/);
  assert.match(route, /CareReportSafetyValidationError/);
  assert.match(route, /toSafeCareReportSafetyHttpResponse/);
  assert.match(route, /ownerMobileCorsJson\(request, diagnostic\.body, \{ status: diagnostic\.status \}, CARE_REPORTS_CORS\)/);
  assert.doesNotMatch(route, /persistCurrentWeightMeasurement\(/);
  assert.doesNotMatch(route, /ai_care_report_generations[\s\S]{0,500}\.insert/);
  assert.match(route, /sanitizeCareReportObservations\(input\.observations\)/);
  assert.match(route, /prepareCareReportSourceText\(input\.voiceTranscript\)/);
  assert.match(route, /decideCareReportSaveReplay/);
  assert.match(route, /savePayloadFingerprint/);
  assert.match(route, /care_report_observations: persistedObservations/);
  assert.match(route, /care_report_voice_transcript: sourceText/);
  assert.match(ai, /petLabel: "반려동물"/);
  assert.doesNotMatch(ai, /pet: \{ name: context\.petName/);
  assert.match(ai, /assertSourceFactProvenance/);
  assert.match(ai, /sourceFactCitations/);
  assert.match(ai, /safetyRuleCode/);
  assert.match(ai, /parseAndValidateCareReportProviderOutput/);
  assert.match(ai, /providerOutput = await response\.json\(\)/);
});

test("care report source and generated output keep separate identity and reject echo before display", () => {
  const panel = readProjectFile("src/components/owner-web/calendar-care-report-completion-panel.tsx");
  const draft = readProjectFile("src/lib/care-report-draft.ts");
  const route = readProjectFile("src/app/api/owner/care-reports/route.ts");

  assert.match(panel, /type CareReportResultState = \{\s+appointmentId: string;\s+sourceText: string;\s+value: CareReportDraft;/);
  assert.match(panel, /type CareReportComposerState = \{\s+appointmentId: string;\s+value: string;/);
  assert.match(panel, /reportState\?\.appointmentId === appointmentId/);
  assert.match(panel, /composerState\.appointmentId === appointmentId/);
  assert.match(panel, /hasCareReportExactSourceEcho\(sourceText, nextReport\)/);
  assert.match(panel, /currentReport && isCareReportDraftUnchanged\(currentReport, nextReport\)/);
  assert.match(panel, /setReportState\(\{ appointmentId, sourceText: hydratedSourceText, value: parsed\.data \}\)/);
  assert.match(panel, /currentDraft: report \?\? undefined/);
  assert.match(panel, /이전 초안 · 다시 생성 필요/);
  assert.match(panel, /!reportMatchesComposer/);
  assert.doesNotMatch(panel, /setReport\(sourceText\)|setReportState\([^\n]*value:\s*sourceText/);

  assert.match(draft, /CARE_REPORT_GENERATION_RETRY_MESSAGE/);
  assert.match(draft, /hasCareReportExactSourceEcho/);
  assert.match(draft, /목욕을 잘 마쳤으며, 전반적인 상태도 양호했습니다\./);
  assert.doesNotMatch(draft, /\[context\.currentDraft\?\.oneLineSummary, ownerSourceText\]/);
  assert.match(route, /CareReportGenerationError/);
  assert.match(route, /toSafeCareReportGenerationHttpResponse/);
});

test("canonical care report acknowledgement rejects custom observation and photo-consent mismatches", () => {
  const observations = careReportObservationsSchema.parse({
    coat: [], skin: [], ears: [], pawsAndNails: [], groomingResponse: [],
    customNote: "다음 권장 방문일: 2026-09-20",
    sourceFacts: [], sourceFactCitations: [], sourceVersion: "care-report-v2",
    saveRequestId: "save-canonical", savePayloadFingerprint: "a".repeat(64),
  });
  const expected = {
    careReport: { oneLineSummary: "오늘 미용을 마쳤어요.", treatmentSummary: "전체미용을 진행했어요.", conditionSummary: "", groomingResponse: "", homeCareTips: [], nextVisitGuide: "" },
    observations,
    sourceText: "귀가 조금 예민했어요.",
    photoConsent: true,
  };
  assert.equal(matchesCanonicalCareReportSave({ expected, actual: expected }), true);
  assert.equal(matchesCanonicalCareReportSave({ expected, actual: { ...expected, observations: { ...observations, customNote: "다른 메모" } } }), false);
  assert.equal(matchesCanonicalCareReportSave({ expected, actual: { ...expected, photoConsent: false } }), false);
});
