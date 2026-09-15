import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settings = await readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8");
const fixture = await readFile(new URL("../src/components/auth/mobile-ai-price-guide-fixture.tsx", import.meta.url), "utf8");
const matrix = await readFile(new URL("../src/components/auth/mobile-price-guide-matrix.tsx", import.meta.url), "utf8");
const matrixReducer = await readFile(new URL("../src/lib/price-photo/mobile-price-guide-matrix.ts", import.meta.url), "utf8");
const httpAdapter = await readFile(new URL("../src/lib/price-photo/mobile-price-photo-http-adapter.ts", import.meta.url), "utf8");
const photoSheet = await readFile(new URL("../src/components/owner/owner-external-photo-sheet.tsx", import.meta.url), "utf8");
const externalCamera = await readFile(new URL("../src/lib/media/external-camera.ts", import.meta.url), "utf8");
const nativeCamera = await readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/ExternalCameraPlugin.java", import.meta.url), "utf8");
const capacitorConfig = await readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8");
const generatedCapacitorConfig = JSON.parse(await readFile(new URL("../android/app/src/main/assets/capacitor.config.json", import.meta.url), "utf8"));
const registrationPreview = await readFile(new URL("../src/components/auth/mobile-price-photo-registration-preview.tsx", import.meta.url), "utf8");
const registrationPreviewPage = await readFile(new URL("../src/app/dev/price-photo-registration/page.tsx", import.meta.url), "utf8");

test("owner settings exposes one local service price management entry", () => {
  assert.match(settings, /title: "서비스·요금 설정"/);
  assert.match(settings, /setIsPriceGuideOpen\(true\)/);
  assert.match(settings, /<MobileAiPriceGuideFixture/);
  assert.doesNotMatch(settings, /fetch\([^)]*(?:price|photo|media)/i);
});

test("camera click explains the privacy gate before dispatching rear camera capture", () => {
  const chooseSurface = fixture.slice(fixture.indexOf('{mode === "choose"'), fixture.indexOf('{mode === "consent"'));
  assert.match(fixture, /<ArrowLeft[^>]*aria-hidden="true"/);
  assert.match(chooseSurface, /aria-label="서비스 요금 설정으로 돌아가기"/);
  assert.match(chooseSurface, /className="[^"]*min-h-11[^"]*whitespace-nowrap[^"]*"/);
  assert.match(chooseSurface, /<ArrowLeft[^>]*aria-hidden="true"[^>]*\/>서비스 요금 설정<\/button>/);
  assert.match(chooseSurface, /onClick=\{requestExit\}/);
  assert.match(chooseSurface, /<header[^>]*className="[^"]*fixed[^"]*top-0[^"]*bg-white[^"]*"[^>]*data-price-photo-app-bar>/);
  assert.match(chooseSurface, /pt-\[env\(safe-area-inset-top\)\]/);
  assert.match(chooseSurface, /<section[^>]*className="[^"]*bg-white[^"]*p-4[^"]*"[^>]*data-price-photo-registration-content>/);
  assert.ok(chooseSurface.indexOf("data-price-photo-app-bar") < chooseSurface.indexOf("data-price-photo-registration-content"));
  const registrationContent = chooseSurface.slice(chooseSurface.indexOf("data-price-photo-registration-content"));
  assert.doesNotMatch(registrationContent, /서비스 요금 설정으로 돌아가기|>서비스 요금 설정<\/button>/);
  assert.match(chooseSurface, />사진으로 요금표 등록<\/h2>/);
  assert.doesNotMatch(chooseSurface, /뒤로가기|서비스 요금표|사진으로 요금표를 불러오세요/);
  assert.match(fixture, /capture="environment"/);
  assert.match(fixture, /canUseExternalCameraApps\(\)/);
  assert.match(fixture, /captureWithAndroidCameraApp\("default"\)/);
  assert.match(fixture, /onClick=\{\(\) => void openCamera\(\)\}/);
  assert.match(chooseSurface, /사진에 개인정보가 없어요/);
  assert.doesNotMatch(chooseSurface, /고객 이름|전화번호/);
  assert.match(fixture, /if \(!privacyConfirmed\) \{/);
  assert.match(fixture, /privacyInputRef\.current\?\.focus\(\)/);
  assert.match(fixture, /먼저 사진에 개인정보가 없는지 확인해 주세요/);
  assert.match(fixture, /disabled=\{openingCamera\}/);
  assert.doesNotMatch(fixture, /disabled=\{!privacyConfirmed \|\| openingCamera\}/);
  assert.doesNotMatch(chooseSurface, /사진 없이 직접 입력|startManual/);
});

test("development registration preview mounts the real no-call surface and is unreachable in production", () => {
  assert.match(registrationPreview, /<MobileAiPriceGuideFixture/);
  assert.match(registrationPreview, /initialRows=\{null\}/);
  assert.match(registrationPreview, /ownerBottomNavigation/);
  assert.doesNotMatch(registrationPreview, /shopId=/);
  assert.match(registrationPreviewPage, /process\.env\.NODE_ENV === "production"/);
  assert.match(registrationPreviewPage, /process\.env\.VERCEL_ENV === "production"/);
  assert.match(registrationPreviewPage, /notFound\(\)/);
});

test("gallery remains a separate no-capture input path", () => {
  assert.match(fixture, /ref=\{cameraInputRef\}[\s\S]*?capture="environment"[\s\S]*?tabIndex=\{-1\}[\s\S]*?aria-hidden="true"[\s\S]*?className="sr-only"/);
  assert.match(fixture, /ref=\{fileInputRef\}[\s\S]*?tabIndex=\{-1\}[\s\S]*?aria-hidden="true"[\s\S]*?className="sr-only"/);
  assert.match(fixture, /onClick=\{\(\) => fileInputRef\.current\?\.click\(\)\}/);
  assert.match(fixture, /카메라로 촬영/);
  assert.match(fixture, /앨범에서 선택/);
});

test("hidden file inputs never become keyboard stops or anonymous AT controls", () => {
  const hiddenInputs = fixture.match(/<input ref=\{(?:cameraInputRef|fileInputRef)\}[^>]+>/g) ?? [];
  assert.equal(hiddenInputs.length, 2);
  for (const input of hiddenInputs) {
    assert.match(input, /tabIndex=\{-1\}/);
    assert.match(input, /aria-hidden="true"/);
  }
});

test("signup fallback remains local while owner mode uses the concrete adapter", () => {
  assert.match(fixture, /fixtureRows/);
  assert.match(fixture, /임시 저장/);
  assert.match(fixture, /createMobilePricePhotoHttpAdapter/);
  assert.match(settings, /shopId=\{data\.shop\.id\}/);
  assert.match(fixture, /max-w-\[430px\]/);
  assert.match(fixture, /min-h-(?:11|12|16)/);
  assert.doesNotMatch(fixture, /from ["'](?:openai|@openai)|responses\.create|gpt-5/i);
});

test("review save footer clears owner navigation, Android safe area, and the visual keyboard", () => {
  assert.match(fixture, /const OWNER_BOTTOM_NAV_CLEARANCE_PX = 64/);
  assert.match(fixture, /ownerBottomNavigation = Boolean\(shopId\)/);
  assert.match(fixture, /const ownerBottomNavClearance = ownerBottomNavigation \? OWNER_BOTTOM_NAV_CLEARANCE_PX : 0/);
  assert.match(fixture, /const footerBottomInset = keyboardInset > 0 \? keyboardInset : ownerBottomNavClearance/);
  assert.match(fixture, /bottom: `calc\(env\(safe-area-inset-bottom\) \+ \$\{footerBottomInset\}px\)`/);
  assert.match(fixture, /paddingBottom: `calc\(env\(safe-area-inset-bottom\) \+ \$\{footerBottomInset \+ PRICE_GUIDE_FOOTER_HEIGHT_PX \+ PRICE_GUIDE_CONTENT_GAP_PX\}px\)`/);
  assert.match(fixture, /data-price-guide-review-content=\{reviewModeActive \? "active" : undefined\}/);
  assert.match(fixture, /<footer className="fixed inset-x-0 z-30[^\"]*bg-white[^\"]*py-3" style=\{footerStyle\} data-price-guide-review-footer>/);
  assert.doesNotMatch(fixture, /<footer className="[^"]*bottom-0/);
  assert.match(fixture, />임시 저장<\/button>/);
  assert.match(fixture, /saving \? "저장 중\.\.\." : "저장하기"/);
  assert.doesNotMatch(fixture, /서비스에 저장하기|나중에 하기|검토 내용 임시 유지/);
});

test("service price surfaces remove duplicate helper copy without weakening consent or recovery", () => {
  for (const copy of [
    "사진에서 서비스명과 가격을 읽어와 저장 전에 확인할 수 있어요.",
    "휴대폰 카메라 앱에서 촬영합니다",
    "JPEG, PNG, WEBP 파일을 선택할 수 있어요",
    "표의 칸을 바로 고친 뒤 저장하세요.",
  ]) assert.doesNotMatch(fixture, new RegExp(copy));
  assert.doesNotMatch(matrix, /평균 시간이 비어 있으면 직접 입력해 주세요/);
  assert.doesNotMatch(fixture, /min-h-16/);
  assert.match(fixture, /사진에 개인정보가 없어요/);
  assert.match(fixture, /비식별 파생 이미지를 OpenAI로 전송/);
  assert.match(fixture, /원본 사진에 고객 이름, 전화번호 등 개인정보가 보이지 않는지 다시 확인/);
  assert.match(fixture, /role="alert"/);
  assert.match(fixture, />임시 저장<\/button>/);
  assert.match(fixture, /saving \? "저장 중\.\.\." : "저장하기"/);
});

test("direct price guide keeps explicit local drafts and a quiet confirmed discard path", () => {
  assert.match(fixture, /const saveDraftAndExit = \(\) => \{/);
  assert.match(fixture, /onExit\(draftRows\(document\), sessionFor\(document\)\)/);
  assert.match(fixture, />계속 작성<\/button>/);
  assert.match(fixture, />임시 저장 후 나가기<\/button>/);
  assert.match(fixture, />작성 내용 삭제<\/button>/);
  assert.match(fixture, /작성 내용을 삭제할까요\?/);
  assert.doesNotMatch(fixture, /임시 내용을 지울까요\?|저장하지 않은 서비스와 가격은 삭제됩니다|저장하지 않고 나가기/);
  assert.match(fixture, /coordinator\.saveAndRequery\(document, persistedServiceId\)/);
});

test("canonical requery state keeps the full document and persisted identity across reentry", () => {
  assert.match(fixture, /const persisted = await coordinator\.saveAndRequery\(document, persistedServiceId\)/);
  assert.match(fixture, /document: persisted\.document/);
  assert.match(fixture, /serviceId: persisted\.serviceId/);
  assert.match(fixture, /onComplete\(persistedRows, persistedState\)/);
  assert.doesNotMatch(fixture, /window\.location\.reload/);
  assert.match(settings, /readBootstrapPriceGuideState\(data\.services\)/);
  assert.match(settings, /useState<PriceGuideSessionState \| null>/);
  assert.match(settings, /initialDocument=\{priceGuideState\?\.document \?\? null\}/);
  assert.match(settings, /initialServiceId=\{priceGuideState\?\.serviceId \?\? null\}/);
  assert.match(fixture, /<MobilePriceGuideMatrix document=\{document\}/);
  assert.match(fixture, /onExit\(initial \? draftRows\(initial\) : null, initial \? \{/);
});

test("price and duration are independent matrix cells with canonical bounds", () => {
  assert.match(matrix, /data-mobile-price-cell/);
  assert.match(matrix, /data-mobile-price-duration-cell/);
  assert.match(matrix, /inputMode="numeric"/);
  assert.match(matrix, /MAX_SERVICE_PRICE_KRW/);
  assert.match(matrix, /min=\{1\}[\s\S]*?max=\{1440\}/);
  assert.match(matrix, /min-h-11/);
  assert.doesNotMatch(fixture, /\?\? 60|\|\| 60/);
  assert.doesNotMatch(fixture, /가격 방식|priceKind.*select/);
});

test("one canonical matrix owns group, breed, weight, service, price and duration edits", () => {
  assert.match(matrixReducer, /updateMobilePriceGuideGroup/);
  assert.match(matrixReducer, /updateMobilePriceGuideService/);
  assert.match(matrixReducer, /updateMobilePriceGuideWeightBand/);
  assert.match(matrixReducer, /updateMobilePriceGuideCell/);
  assert.match(matrixReducer, /addMobilePriceGuideService/);
  assert.match(matrixReducer, /removeMobilePriceGuideService/);
  assert.match(matrixReducer, /addMobilePriceGuideWeightBand/);
  assert.match(matrixReducer, /removeMobilePriceGuideWeightBand/);
  assert.match(matrixReducer, /addMobilePriceGuideGroup/);
  assert.match(matrixReducer, /removeMobilePriceGuideGroup/);
  assert.match(matrix, /overflow-x-auto/);
  assert.match(fixture, /mx-auto w-full min-w-0 max-w-\[430px\][^>]*style=\{reviewContentStyle\}/);
});

test("the document stays shrinkable while the matrix contains its accessible labels and horizontal overflow", () => {
  assert.match(matrix, /className="min-w-0 max-w-full space-y-5" data-mobile-price-guide-matrix/);
  assert.match(matrix, /className="min-w-0 max-w-full overflow-hidden rounded-\[14px\]/);
  assert.match(matrix, /className="relative w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain" data-mobile-price-guide-matrix-scroll/);
  assert.match(matrix, /<span className="sr-only">서비스 이름<\/span>/);
  assert.match(matrix, /<span className="sr-only">체급<\/span>/);
  assert.match(matrix, /<span className="sr-only">가격<\/span>/);
  assert.match(matrix, /<span className="sr-only">평균 시간\(분\)<\/span>/);
  assert.match(fixture, /mx-auto w-full min-w-0 max-w-\[430px\][^>]*style=\{reviewContentStyle\}/);
  assert.match(fixture, /min-w-0 max-w-full space-y-4 px-4 pt-2/);
  assert.doesNotMatch(matrix, /data-mobile-price-guide-matrix[^>]*(?:overflow-x-hidden|overflow-x-clip)/);
  assert.doesNotMatch(fixture, /max-w-\[430px\][^\"]*(?:overflow-x-hidden|overflow-x-clip)/);
});

test("authentication preflight shows one login recovery and purges the preview", () => {
  assert.match(fixture, /MobilePricePhotoAuthenticationError/);
  assert.match(fixture, /const isAuthenticationFailure = error instanceof MobilePricePhotoAuthenticationError/);
  assert.match(fixture, /catch \(error\) \{[\s\S]*?purgePhoto\(\);[\s\S]*?setPendingAnalysisFile\(null\);/);
  const authRecoveryStart = fixture.indexOf("{authRecoveryRequired ?");
  const authRecoveryBranch = fixture.slice(authRecoveryStart, fixture.indexOf("</> : <>", authRecoveryStart));
  assert.match(authRecoveryBranch, /로그인 정보를 확인하지 못했습니다\./);
  assert.match(authRecoveryBranch, /로그인으로 이동/);
  assert.match(authRecoveryBranch, /window\.location\.assign\("\/login\?next=\/owner\/mobile"\)/);
  assert.doesNotMatch(authRecoveryBranch, /사진을 읽지 못했어요|\{actionError\}/);
  assert.match(authRecoveryBranch, /purgePhoto\(\); setPendingAnalysisFile\(null\);/);
  assert.doesNotMatch(fixture, /error instanceof Error \? error\.message : "사진을 읽지 못했습니다/);
});

test("photo recovery names the failed lifecycle boundary without backend detail leakage", () => {
  assert.match(fixture, /getMobilePricePhotoRecoveryMessage/);
  assert.match(httpAdapter, /VISION_PROVIDER_INVALID_RESPONSE/);
  for (const subtype of ["SCHEMA_INVALID", "AXIS_INVALID", "NO_ROWS", "SHAPE_INVALID"]) {
    assert.match(httpAdapter, new RegExp(`case "${subtype}"`));
  }
  assert.match(httpAdapter, /사진에서 요금표 항목을 찾지 못했어요/);
  assert.match(httpAdapter, /체급과 서비스 구분을 확인하지 못했어요/);
  assert.match(httpAdapter, /요금표 행과 열을 맞추지 못했어요/);
  assert.match(httpAdapter, /사진 속 요금표 구조를 확인하지 못했어요/);
  assert.doesNotMatch(httpAdapter, /raw provider detail/);
  assert.doesNotMatch(fixture, /사진을 읽지 못했어요/);
});

test("camera and preview boundaries do not log sensitive image payloads", () => {
  assert.doesNotMatch(fixture, /String\(error\)|console\.(?:log|debug|warn|error)/);
  assert.doesNotMatch(externalCamera, /console\.(?:log|debug|error)/);
  assert.match(externalCamera, /console\.info\("\[owner-camera\]", \{ step, outcome: "success", durationMs:/);
  assert.match(externalCamera, /console\.warn\("\[owner-camera\]", \{[\s\S]*errorName:/);
  assert.doesNotMatch(externalCamera, /console\.(?:info|warn)\([^\n]*(?:base64|path|fileName|mimeType)/);
  assert.doesNotMatch(nativeCamera, /\bLog\.(?:d|i|v|w|e)\s*\(/);
  assert.match(externalCamera, /bytes\.fill\(0\)/);
  assert.match(externalCamera, /result\.base64 = ""/);
});

test("the effective Android Capacitor config disables bridge logging", () => {
  assert.match(capacitorConfig, /android:\s*\{[\s\S]*?loggingBehavior:\s*"none"/);
  assert.equal(generatedCapacitorConfig.android?.loggingBehavior, "none");
});

test("grooming photo sources keep only their actions and native chooser grants stay temporary", () => {
  assert.match(photoSheet, /기본 카메라 선택/);
  assert.match(photoSheet, /다른 촬영 앱 선택/);
  assert.match(photoSheet, /기본 카메라로 촬영/);
  assert.match(photoSheet, /getExternalCameraCapabilities/);
  assert.match(photoSheet, /onCapture\(cameraMode\)/);
  assert.match(photoSheet, /앨범에서 선택/);
  assert.doesNotMatch(photoSheet, /원본 사진을 선택한 뒤|등록을 누르기 전까지|설치된 카메라 앱 중에서 골라 촬영해요|촬영한 사진을 미리보기로 확인해요|바로 촬영하기|촬영한 사진 불러오기/);
  assert.match(nativeCamera, /Intent\.createChooser\(cameraIntent, "카메라 앱 선택"\)/);
  assert.match(nativeCamera, /ACTION_PICK_ACTIVITY/);
  assert.match(nativeCamera, /ACTION_MAIN/);
  assert.match(nativeCamera, /CATEGORY_LAUNCHER/);
  assert.doesNotMatch(nativeCamera, /setPackage\(/);
  assert.match(nativeCamera, /queryIntentActivities\(cameraIntent, PackageManager\.MATCH_DEFAULT_ONLY\)/);
  assert.match(nativeCamera, /OUTPUT_URI_PERMISSION_FLAGS =[\s\S]*FLAG_GRANT_WRITE_URI_PERMISSION \| Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(nativeCamera, /grantUriPermission\([^;]*OUTPUT_URI_PERMISSION_FLAGS\)/);
  assert.match(nativeCamera, /revokeUriPermission\([\s\S]*OUTPUT_URI_PERMISSION_FLAGS/);
  assert.match(nativeCamera, /clearPendingOutput\(\);/);
});
