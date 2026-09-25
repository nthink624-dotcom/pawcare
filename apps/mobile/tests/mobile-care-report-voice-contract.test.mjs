import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [startSheet, careReport, ownerApp, speechBridge, manifest, nativePlugin, mainActivity, localDraftStore, ownerShell, notificationSettings, careReportPreview] = await Promise.all([
  readFile(new URL("../src/components/owner/owner-mobile-grooming-start-sheet.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-ai-care-report-sheet.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/care-report/owner-speech-input.ts", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/OwnerSpeechRecognitionPlugin.java", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/MainActivity.java", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/care-report/owner-care-report-local-draft.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-shell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/notification-settings.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-care-report-dev-preview.tsx", import.meta.url), "utf8"),
]);

test("grooming start copy keeps choices but removes the redundant mutation sentence", () => {
  assert.doesNotMatch(startSheet, /시작하면 예약 상태가 진행 중으로 변경됩니다/);
  assert.match(startSheet, /사진 촬영 후 시작/);
  assert.match(startSheet, /사진 없이 바로 시작/);
  assert.match(startSheet, /onPhotoStart/);
  assert.match(startSheet, /onStartWithoutPhoto/);
});

test("Android speech bridge requests microphone permission and exposes no audio payload", () => {
  assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
  assert.match(mainActivity, /registerPlugin\(OwnerSpeechRecognitionPlugin\.class\)/);
  assert.match(nativePlugin, /@Permission\(alias = "microphone", strings = \{ Manifest\.permission\.RECORD_AUDIO \}\)/);
  assert.match(nativePlugin, /SpeechRecognizer\.createSpeechRecognizer/);
  assert.match(nativePlugin, /EXTRA_LANGUAGE, "ko-KR"/);
  assert.match(nativePlugin, /notifyListeners\("result", data\)/);
  assert.match(nativePlugin, /PERMISSION_DENIED|UNAVAILABLE|EMPTY|CANCELLED/);
  assert.doesNotMatch(nativePlugin, /AudioRecord|MediaRecorder|base64|Log\./);
});

test("care-report voice input handles permission, empty, duplicate, close, and resume safely", () => {
  assert.match(speechBridge, /Capacitor\.getPlatform\(\) === "android"/);
  assert.match(speechBridge, /OwnerSpeechRecognition\.addListener\("result"/);
  assert.match(speechBridge, /OwnerSpeechRecognition\.addListener\("error"/);
  assert.match(speechBridge, /OwnerSpeechRecognition\.addListener\("end"/);
  assert.match(speechBridge, /normalizeTranscript/);
  assert.match(careReport, /voiceSessionRef\.current \+= 1/);
  assert.match(careReport, /transcript === lastVoiceTranscriptRef\.current/);
  assert.match(careReport, /마이크 권한이 필요합니다/);
  assert.match(careReport, /이 기기에서는 음성 입력을 사용할 수 없습니다/);
  assert.match(careReport, /음성을 인식하지 못했습니다/);
  assert.match(careReport, /void voiceControllerRef\.current\?\.stop\(\)/);
  assert.doesNotMatch(careReport, /window\.SpeechRecognition \?\? window\.webkitSpeechRecognition/);
});

test("Android speech keeps the care-report WebView alive across transient permission and recognizer UI", () => {
  assert.doesNotMatch(nativePlugin, /handleOnPause\s*\(/);
  assert.match(nativePlugin, /SpeechRecognizer\.createSpeechRecognizer\(getActivity\(\)\)/);
  assert.match(nativePlugin, /getActivity\(\)\.runOnUiThread\(\(\) -> startListening\(call\)\)/);
  assert.match(nativePlugin, /getActivity\(\)\.runOnUiThread\(\(\) -> \{\s*stopListening\(\);[\s\S]*destroyRecognizer\(\);/);
  assert.match(nativePlugin, /getActivity\(\) == null \|\| !SpeechRecognizer\.isRecognitionAvailable\(getActivity\(\)\)/);
  assert.match(nativePlugin, /protected void handleOnDestroy\(\) \{\s*finish\(\);\s*destroyRecognizer\(\);/);
  assert.match(nativePlugin, /notifyListeners\("result", data\);\s*finish\(\);\s*destroyRecognizer\(\);/);
  assert.match(nativePlugin, /emitError\(errorCode\(error\)\);\s*finish\(\);\s*destroyRecognizer\(\);/);
  assert.doesNotMatch(nativePlugin, /finish\(\);\s*getActivity\(\)\.finish\(/);
});

test("voice transcript stays in the visible draft until the owner explicitly acts", () => {
  assert.match(careReport, /setSourceText\(\(current\) => `\$\{current\}\$\{current \? "\\n" : ""\}\$\{transcript\}`\.slice\(0, 4000\)\)/);
  assert.doesNotMatch(speechBridge, /fetch\(|fetchApiJsonWithAuth|console\./);
  assert.doesNotMatch(nativePlugin, /storage|upload|network/i);
});

test("care-report editor preserves the compact composer and uses one editable reportText plane", () => {
  const scrollRegionStart = careReport.indexOf('<div data-testid="care-report-scroll-region"');
  const footerStart = careReport.indexOf('<footer data-testid="care-report-footer-unified"');
  const composerStart = careReport.indexOf('<section data-testid="care-report-composer"');
  const editorSurface = careReport.slice(scrollRegionStart, footerStart);
  const footerSurface = careReport.slice(footerStart, careReport.indexOf("</footer>", footerStart));
  const composerSurface = careReport.slice(composerStart, careReport.indexOf("</section>", composerStart));
  const generationFlow = careReport.slice(careReport.indexOf("async function generate"), careReport.indexOf("function requestClose"));
  assert.ok(scrollRegionStart >= 0 && scrollRegionStart < footerStart);
  assert.ok(footerStart >= 0 && footerStart < composerStart);
  assert.match(careReport, /max-w-\[430px\] flex-col overflow-hidden bg-white/);
  assert.match(editorSurface, /data-testid="care-report-summary"/);
  assert.match(editorSurface, /data-testid="care-report-ai-result-divider"/);
  assert.match(editorSurface, /data-testid="care-report-user-memo"/);
  assert.match(editorSurface, /data-testid="care-report-generation-loading"/);
  assert.match(editorSurface, /data-testid="care-report-draft"/);
  assert.match(editorSurface, /<textarea ref=\{reportTextareaRef\} aria-label="케어리포트 초안"/);
  assert.equal([...editorSurface.matchAll(/aria-label="케어리포트 초안"/g)].length, 1);
  assert.match(editorSurface, /value=\{report\.reportText\}/);
  assert.match(editorSurface, /직접 수정/);
  assert.match(editorSurface, /다시 정리/);
  assert.doesNotMatch(editorSurface, /이대로 보내기/);
  assert.match(footerSurface, /이대로 보내기/);
  assert.match(footerSurface, /임시저장/);
  assert.match(composerSurface, /<textarea ref=\{composerTextareaRef\}/);
  assert.match(composerSurface, /placeholder=\{report \? "수정할 부분을 적어 주세요" : "오늘 미용 내용을 적어 주세요"\}/);
  assert.match(careReport, /aria-label=\{recording \? "음성 입력 중지" : "음성 입력 시작"\}/);
  assert.match(careReport, /aria-label="케어리포트 만들기"/);
  assert.match(careReport, /disabled=\{isPublished \|\| action !== null \|\| !hasComposerInput\}/);
  assert.match(careReport, /if \(generationInFlightRef\.current\) return;/);
  assert.match(generationFlow, /currentReportText: report\.reportText, revisionRequest: revisionText/);
  assert.match(generationFlow, /sourceText: input, photoConsent/);
  assert.match(generationFlow, /setReport\(\{ reportText: result\.reportText \}\)/);
  assert.doesNotMatch(generationFlow, /sourceFacts|sourceFactCitations|careReportObservations|oneLineSummary|treatmentSummary|conditionSummary|groomingResponse|homeCareTips|nextVisitGuide/);
  assert.match(careReport, /JSON\.stringify\(\{ shopId, appointmentId: appointment\.id, reportText: report\.reportText, photoConsent, action: "save_draft" \}\)/);
  assert.match(careReport, /JSON\.stringify\(\{ shopId, appointmentId: appointment\.id, reportText: report\.reportText, photoConsent, action: "publish" \}\)/);
  assert.match(careReport, /data-testid="care-report-keyboard-aware-actions"/);
  assert.match(ownerApp, /onReturnToDetail=\{\(\) => \{ closeCareReport\(\); setModal\(\{ type: "appointment", appointment \}\); void refresh\(\); \}\}/);
});

test("care-report entry preloads once and never exposes a half-ready editor", () => {
  const prepareFlow = careReport.slice(careReport.indexOf("export async function prepareOwnerCareReportInitialData"), careReport.indexOf("export default function OwnerAiCareReportSheet"));
  const openFlow = ownerApp.slice(ownerApp.indexOf("async function openCareReport"), ownerApp.indexOf("function closeCareReport"));
  const loadingGate = careReport.slice(careReport.indexOf("if (loading)"), careReport.indexOf("if (initialLoadError)"));
  assert.match(prepareFlow, /Promise\.all\(\[/);
  assert.match(prepareFlow, /\/api\/owner\/media\/assets/);
  assert.match(prepareFlow, /\/api\/owner\/grooming-record-drafts/);
  assert.match(prepareFlow, /fetchOwnerAppointmentVisitWeight/);
  assert.match(prepareFlow, /getOwnerMediaSignedUrl/);
  assert.match(openFlow, /if \(isOwnerDemo \|\| careReportOpenInFlightRef\.current\) return/);
  assert.match(openFlow, /setCareReportLoadingAppointmentId\(appointmentId\)/);
  assert.ok(openFlow.indexOf("await prepareOwnerCareReportInitialData") < openFlow.indexOf("setCareReportAppointmentId(appointmentId)"));
  assert.match(ownerApp, /careReportAppointmentId && careReportInitialData/);
  assert.match(ownerApp, /aria-busy=\{careReportLoading\}/);
  assert.match(ownerApp, /disabled=\{careReportLoading\}/);
  assert.match(loadingGate, /data-testid="care-report-loading-plane" aria-busy="true"/);
  assert.doesNotMatch(loadingGate, /care-report-summary|care-report-draft|care-report-composer|<footer|사진 없음|리포트 보내기|임시저장/);
  assert.doesNotMatch(careReport, /기존 초안과 사진을 불러오는 중이에요/);
  assert.match(ownerApp, /role="alertdialog"[^>]*aria-label="케어리포트 불러오기 실패"/);
  assert.match(ownerApp, />닫기<\/button>.*>다시 시도<\/button>/s);
  assert.match(ownerApp, /const appointmentId = careReportEntryError\.appointmentId; setCareReportEntryError\(null\); void openCareReport\(appointmentId\)/);
});

test("revisit reminder offers relative periods and persists one resolved date", () => {
  const reminderStart = careReport.indexOf("{showReminderSheet ?");
  const reminderSurface = careReport.slice(reminderStart, careReport.indexOf("{showPublishConfirm ?", reminderStart));
  assert.match(notificationSettings, /DEFAULT_REVISIT_REMINDER_DAYS = 45/);
  assert.match(notificationSettings, /revisit_reminder_default_days: DEFAULT_REVISIT_REMINDER_DAYS/);
  assert.match(ownerApp, /revisitReminderDefaultDays=\{data\.shop\.notification_settings\.revisit_reminder_default_days \?\? DEFAULT_REVISIT_REMINDER_DAYS\}/);
  assert.match(careReportPreview, /revisitReminderDefaultDays=\{73\}/);
  assert.match(careReport, /function clampReminderDays\(value: number\)[\s\S]*Math\.min\([\s\S]*365\)/);
  assert.equal((reminderSurface.match(/>매장 기본값 · \{defaultReminderDays\}일 후<\/span>/g) ?? []).length, 1);
  assert.match(reminderSurface, /reminderOptions\.filter\(\(days\) => days !== defaultReminderDays\)/);
  assert.match(careReport, /\[defaultReminderDays, 30, 45, 60, 90\]/);
  assert.match(reminderSurface, /\{days\}일 후/);
  assert.doesNotMatch(reminderSurface, /날짜 선택|알림 안 함|type="date"|type="number"|<input|<select|calendar|달력|연월일/);
  assert.doesNotMatch(careReport, /formatReminderDate|calendarCells|shiftMonth|reminderCalendar/);
  assert.match(careReport, /function reminderDaysBetween\(today: string, target: string\)/);
  assert.match(careReport, /setNextDate\(pendingReminderMode === "custom" \? addDate\(today, pendingReminderDays\) : null\)/);
  assert.match(careReport, /nextRecommendedVisitDate: resolvedReminderDate/);
  assert.match(reminderSurface, /pendingReminderMode === "custom" && pendingReminderDays === days/);
  assert.match(careReport, /event\.key !== "Escape"[\s\S]*petManagerReminderSheet/);
  assert.match(careReport, /if \(recoveredDraft\) writeOwnerCareReportLocalDraft\(shopId, appointment\.id, recoveredDraft\)/);
  assert.match(careReport, /if \(!\(await persistDraft\(\)\)\) return;[\s\S]*action: "publish"/);
});

test("care-report exit confirmation keeps safe dismissal and save-before-close semantics", () => {
  const exitFlow = careReport.slice(careReport.indexOf('function finishExitConfirm'), careReport.indexOf('function getVoiceMessage'));
  const exitDialog = careReport.slice(careReport.indexOf('{showExitConfirm ?'), careReport.indexOf('\n    </div>', careReport.indexOf('{showExitConfirm ?')));
  assert.match(exitDialog, /role="dialog" aria-modal="true" aria-labelledby=\{exitDialogTitleId\}/);
  assert.match(exitDialog, /max-w-\[360px\] rounded-\[18px\][^>]*p-6/);
  assert.match(exitDialog, /text-\[20px\] font-semibold leading-7[^>]*>나가기 전에 저장할까요\?<\/h2>/);
  assert.doesNotMatch(exitDialog, /저장하지 않으면 이번에 입력한 내용은 사라집니다|<p/);
  const primaryIndex = exitDialog.indexOf('>임시저장 후 나가기</button>');
  const continueIndex = exitDialog.indexOf('>계속 작성</button>');
  const discardIndex = exitDialog.indexOf('>저장하지 않고 나가기</button>');
  assert.ok(primaryIndex > 0 && primaryIndex < continueIndex && continueIndex < discardIndex);
  assert.match(exitDialog, /ref=\{exitPrimaryActionRef\}[^>]*onClick=\{\(\) => void saveAndExit\(\)\}[^>]*min-h-12 rounded-\[10px\] bg-\[#2f6fd6\][^>]*text-\[16px\] font-medium leading-6/);
  assert.match(exitDialog, /onClick=\{dismissExitConfirm\}[^>]*min-h-12 rounded-\[10px\] border border-\[#d4e3f2\] bg-white[^>]*text-\[16px\] font-medium leading-6/);
  assert.match(exitDialog, /onClick=\{discardAndClose\}[^>]*min-h-11 rounded-\[10px\] bg-transparent[^>]*text-\[16px\] font-medium leading-6 text-\[#8a5d63\]/);
  assert.match(exitDialog, /onMouseDown=\{\(event\) => \{ if \(event\.target === event\.currentTarget\) dismissExitConfirm\(\); \}\}/);
  assert.match(exitFlow, /function dismissExitConfirm\(\) \{\s*finishExitConfirm\("dismiss"\)/);
  assert.match(exitFlow, /function discardAndClose\(\) \{\s*const recoveredDraft = initialRecoveredDraftRef\.current;[\s\S]*writeOwnerCareReportLocalDraft[\s\S]*clearOwnerCareReportLocalDraft[\s\S]*finishExitConfirm\("close"\)/);
  assert.match(exitFlow, /async function saveAndExit\(\)[\s\S]*if \(await persistDraft\(\)\) \{\s*setHasEdited\(false\);\s*finishExitConfirm\("close"\)/);
  assert.match(careReport, /catch \(saveError\)[\s\S]*setError\([\s\S]*return false/);
  assert.match(careReport, /event\.key === "Escape"[\s\S]*dismissExitConfirm\(\)/);
  assert.match(careReport, /event\.key !== "Tab"[\s\S]*last\.focus\(\)[\s\S]*first\.focus\(\)/);
  assert.match(careReport, /window\.history\.pushState\([\s\S]*window\.addEventListener\("popstate", handlePopState\)/);
  assert.match(careReport, /exitReturnFocusRef\.current\?\.focus\(\)/);
});

test("completed appointments keep care-report entry until a report is actually published", () => {
  assert.match(ownerApp, /appointment\.status === "completed"/);
  assert.match(ownerApp, /const hasPublishedCareReport = Boolean\(/);
  assert.match(ownerApp, /care_report_data \|\| completedGroomingRecord\?\.care_report_owner_confirmed_at/);
  assert.match(ownerApp, /const hasLocalCareReportDraft = !hasPublishedCareReport && Boolean\(readOwnerCareReportLocalDraft\(data\.shop\.id, appointment\.id\)\)/);
  assert.match(ownerApp, /resolvedCareReportStatus === "published" \? "케어리포트 보기" : resolvedCareReportStatus === "draft" \? "이어서 작성" : "AI 케어리포트 작성"/);
});

test("care-report drafts recover locally after lifecycle recreation and clear only on publish, discard, or logout", () => {
  assert.match(localDraftStore, /STORAGE_PREFIX = "petmanager\.owner\.care-report-draft\.v1:"/);
  assert.match(localDraftStore, /encodeURIComponent\(shopId\).*encodeURIComponent\(appointmentId\)/s);
  assert.match(careReport, /const recoveredDraft = publishedCareReport \? null : readOwnerCareReportLocalDraft\(shopId, appointmentId\)/);
  assert.match(careReport, /writeOwnerCareReportLocalDraft\(shopId, appointment\.id/);
  assert.match(localDraftStore, /reportText: \(\(draft\.reportText \?\? legacyText\) \|\| null\)/);
  assert.match(localDraftStore, /legacyReport\.oneLineSummary/);
  assert.match(localDraftStore, /legacyParts[\s\S]*\.join\(" "\)/);
  assert.doesNotMatch(careReport.slice(careReport.indexOf("writeOwnerCareReportLocalDraft")), /report:\s*\{/);
  assert.doesNotMatch(careReport, /if \(loadFailed\)/);
  assert.match(careReport, /clearOwnerCareReportLocalDraft\(shopId, appointment\.id\);\s*onPublished\(\);/);
  assert.match(careReport, /function discardAndClose\(\)[\s\S]*initialRecoveredDraftRef\.current[\s\S]*else clearOwnerCareReportLocalDraft\(shopId, appointment\.id\)/);
  assert.match(ownerShell, /clearOwnerCareReportLocalDrafts\(\);\s*router\.replace\("\/login"/);
  assert.doesNotMatch(localDraftStore, /fetch\(|fetchApiJsonWithAuth|console\./);
});

test("published care reports derive their status without synchronously setting state in an effect", () => {
  assert.match(ownerApp, /const hasPublishedCareReport = Boolean\(/);
  assert.match(ownerApp, /const resolvedCareReportStatus = hasPublishedCareReport \? "published" : \(hasLocalCareReportDraft \|\| careReportStatus === "draft" \? "draft" : "before"\)/);
  const appointmentDetail = ownerApp.slice(ownerApp.indexOf("function AppointmentDetail"), ownerApp.indexOf("function isBookableOwnerService"));
  assert.doesNotMatch(appointmentDetail, /hasPublishedCareReport\) \{\s*setCareReportStatus\("published"\)/);
});
