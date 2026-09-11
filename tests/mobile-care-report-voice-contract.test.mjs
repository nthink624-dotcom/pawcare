import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [startSheet, careReport, ownerApp, speechBridge, manifest, nativePlugin, mainActivity, localDraftStore, ownerShell] = await Promise.all([
  readFile(new URL("../src/components/owner/owner-mobile-grooming-start-sheet.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-ai-care-report-sheet.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/care-report/owner-speech-input.ts", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/OwnerSpeechRecognitionPlugin.java", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/MainActivity.java", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/care-report/owner-care-report-local-draft.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-shell.tsx", import.meta.url), "utf8"),
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

test("care-report editor uses one compact white content plane without changing report controls", () => {
  const editorSurface = careReport.slice(careReport.indexOf("<main"), careReport.indexOf("</main>"));
  assert.match(careReport, /max-w-\[430px\] flex-col bg-white/);
  assert.match(careReport, /overflow-y-auto px-4 py-3/);
  assert.match(careReport, /border-b border-\[#dce7f2\] py-3/);
  assert.match(careReport, /min-h-24 w-full resize-y/);
  assert.match(careReport, /min-h-16 w-full resize-y/);
  assert.match(careReport, /className="ml-3 flex h-11 w-11/);
  assert.doesNotMatch(editorSurface, /사진 등록|기본 정보/);
  assert.match(editorSurface, /예약 서비스/);
  assert.match(editorSurface, /오늘 몸무게/);
  assert.doesNotMatch(editorSurface, /inputMode="decimal" value=\{weight\}/);
  assert.match(ownerApp, /onReturnToDetail=\{\(\) => \{ setCareReportAppointmentId\(null\); setModal\(\{ type: "appointment", appointment \}\); void refresh\(\); \}\}/);
  assert.match(careReport, /const photoConsent = true;/);
  assert.doesNotMatch(careReport, /setPhotoConsent/);
  assert.match(careReport, /aria-label="미용 사진 촬영"/);
  assert.match(careReport, /aria-label="미용 사진 선택"/);
  assert.match(careReport, /미용 사진 포함.*사진 없음/s);
  assert.match(careReport, /aria-label="예약 정보".*오늘 몸무게.*예약 정보 수정/s);
  assert.match(careReport, /<summary[^>]*>재예약 알림 설정<\/summary>/);
  assert.match(careReport, /aria-label=\{recording \? "음성 입력 중지" : "음성 입력 시작"\}/);
  assert.match(careReport, /aria-pressed=\{recording\}/);
  assert.match(careReport, /aria-label="케어리포트 만들기"/);
  assert.match(careReport, /h-11 w-11.*bg-\[#111A30\]/);
  assert.match(careReport, /<ArrowUp className="h-5 w-5" aria-hidden="true"/);
  assert.match(careReport, /disabled=\{isPublished \|\| action !== null \|\| !hasComposerInput\}/);
  assert.match(careReport, /if \(generationInFlightRef\.current\) return;/);
  assert.match(careReport, /focus-visible:outline-offset-2 focus-visible:outline-\[#2563eb\]/);
  assert.match(careReport, /리포트 보내기/);
  assert.match(careReport, /임시저장/);
  assert.ok(careReport.indexOf("AI가 정리한 결과") < careReport.indexOf("aria-label={report ? \"수정 요청 입력\""));
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
  assert.match(careReport, /const recoveredDraft = isPublished \? null : readOwnerCareReportLocalDraft\(shopId, appointment\.id\)/);
  assert.match(careReport, /writeOwnerCareReportLocalDraft\(shopId, appointment\.id/);
  assert.doesNotMatch(careReport, /if \(loadFailed\)/);
  assert.match(careReport, /clearOwnerCareReportLocalDraft\(shopId, appointment\.id\);\s*onPublished\(\);/);
  assert.match(careReport, /function discardAndClose\(\) \{\s*clearOwnerCareReportLocalDraft\(shopId, appointment\.id\);\s*onClose\(\);/);
  assert.match(ownerShell, /clearOwnerCareReportLocalDrafts\(\);\s*router\.replace\("\/login"/);
  assert.doesNotMatch(localDraftStore, /fetch\(|fetchApiJsonWithAuth|console\./);
});

test("published care reports derive their status without synchronously setting state in an effect", () => {
  assert.match(ownerApp, /const hasPublishedCareReport = Boolean\(/);
  assert.match(ownerApp, /const resolvedCareReportStatus = hasPublishedCareReport \? "published" : \(hasLocalCareReportDraft \|\| careReportStatus === "draft" \? "draft" : "before"\)/);
  const appointmentDetail = ownerApp.slice(ownerApp.indexOf("function AppointmentDetail"), ownerApp.indexOf("function isBookableOwnerService"));
  assert.doesNotMatch(appointmentDetail, /hasPublishedCareReport\) \{\s*setCareReportStatus\("published"\)/);
});
