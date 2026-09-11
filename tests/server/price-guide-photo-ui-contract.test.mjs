import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cleanupLatePhotoAnalysisResult } from "../../src/lib/price-guide-photo-analysis-client.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("owner photo import provides file selection, preview, retry, and direct editable-draft handoff", async () => {
  const [photo, manual, choice, fixture] = await Promise.all([
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/components/owner-web/price-guide-manual-onboarding.tsx"),
    source("src/components/owner-web/price-guide-onboarding-choice.tsx"),
    source("src/lib/price-guide-photo-import-fixture.ts"),
  ]);

  assert.match(photo, /type="file"[\s\S]*accept="image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(photo, /\bmultiple\b/);
  assert.equal((photo.match(/type="file"/g) ?? []).length, 1, "PC photo registration exposes only the file picker");
  assert.doesNotMatch(photo, /capture="environment"|카메라로 촬영|captureRef/);
  assert.match(photo, /nextFiles\.length !== REQUIRED_PHOTO_COUNT/);
  assert.match(photo, /요금표 사진은 한 장만 선택할 수 있습니다/);
  assert.match(photo, /URL\.createObjectURL\(nextFile\)/);
  assert.match(photo, /data-price-guide-photo-picker="single"/);
  assert.match(photo, /data-price-guide-photo-preview="selected"/);
  assert.match(photo, /\{selectedFile && previewUrl \? \([\s\S]*data-price-guide-photo-preview="selected"[\s\S]*\) : \([\s\S]*data-price-guide-photo-picker-state="empty"[\s\S]*\)\}/);
  assert.match(photo, /className="object-contain p-2"/);
  assert.match(photo, /사진 바꾸기/);
  assert.match(photo, /min-h-\[128px\]/);
  assert.match(photo, /h-\[144px\][^"\n]*sm:h-\[160px\]/);
  assert.doesNotMatch(photo, /previewUrls|object-cover|lg:grid-cols-\[360px_1fr\]|최대 5장/);
  const photoModeStart = photo.indexOf('{mode === "photo"');
  const savedModeStart = photo.indexOf('{mode === "choice" && initialDocument', photoModeStart);
  assert.ok(photoModeStart >= 0 && savedModeStart > photoModeStart);
  assert.doesNotMatch(photo.slice(photoModeStart, savedModeStart), /분석 완료|등록 완료|저장 완료|등록됨|저장됨/);
  assert.match(photo, /analyzing \?[\s\S]*요금표 불러오는 중[\s\S]*: "요금표 불러오기"/);
  assert.match(photo, /setAnalysisStage\("uploading"\)[\s\S]*createOwnerMediaAssetFromFile[\s\S]*setAnalysisStage\("reading"\)[\s\S]*price-guide-photo-import/);
  assert.match(photo, /사진을 안전하게 준비하고 있어요\.[\s\S]*사진 속 표의 행과 열을 읽고 있어요\./);
  assert.match(photo, /role="status" aria-live="polite"/);
  assert.match(photo, /function photoAnalysisErrorMessage\(\)[\s\S]*요금표 사진을 읽지 못했습니다\. 다시 시도하거나 뒤로 가서 직접 등록해 주세요\./);
  assert.match(photo, /문의 코드: \{supportCode\}/);
  assert.match(photo, /readPriceGuidePhotoSupportCode/);
  assert.match(photo, /openPhotoReview\(createPriceGuidePhotoImportFixture\(\)\)/);
  assert.match(photo, /function openPhotoReview\(nextResult: PriceGuidePhotoImportResponse\)[\s\S]*setManualDocument\(nextResult\.document\)[\s\S]*setEditorMode\("photo-review"\)[\s\S]*clearPhotoTemporaryState\(\)[\s\S]*setMode\("manual"\)/);
  assert.match(photo, /openPhotoReview\(nextResult\)/);
  assert.match(photo, /mode === "manual" && editorMode === "direct"[\s\S]*<PriceGuideManualOnboarding[\s\S]*manualMatrixMode/);
  assert.match(photo, /mode === "manual" && editorMode === "photo-review" && manualDocument[\s\S]*<AnalyzedPriceGuideEditor/);
  assert.match(photo, /data-price-guide-layout="service-columns"/);
  assert.match(photo, /<PriceGuideNativeInlineTable[\s\S]*document=\{document\}[\s\S]*photoReviewMode/);
  assert.match(manual, /manualMatrixMode = true/);
  assert.match(manual, /manualMatrixMode \|\| photoEditing \? \([\s\S]*<PriceGuideNativeInlineTable/);
  assert.match(manual, /<PriceGuideStructuredReviewTable/);
  assert.match(manual, /photoReviewMode=\{!manualMatrixMode\}/);
  assert.doesNotMatch(manual, /SignupPriceGuideEditor|mode="review"/);
  assert.doesNotMatch(photo, /ExtractionPreview|result\.guide|검토하고 수정하기/);
  assert.doesNotMatch(photo, /onApply\(nextResult\.document\)/);
  assert.match(photo, /aria-label="등록 방식 선택으로 돌아가기"[\s\S]*사진으로 요금표 만들기/);
  assert.match(photo, /function returnToChoice\(\)[\s\S]*clearPhotoTemporaryState\(\)[\s\S]*setMode\("choice"\)/);
  assert.doesNotMatch(photo, /다른 방법 선택|사진 없이 직접 입력|사진 내용 자동으로 옮기기/);
  assert.match(photo, /JPG, PNG, WebP · 1장 · 최대 20MB/);
  assert.match(photo, /사진을 읽기 전에 이름·전화번호·주소를 가려 주세요/);
  assert.doesNotMatch(photo, /OpenAI 분석 전/);
  assert.doesNotMatch(photo, /사진을 선택한 뒤에만 업로드와 분석을 시작합니다/);
  assert.doesNotMatch(photo, /표 전체가 정면으로 보이게 찍으면 더 정확합니다/);
  assert.doesNotMatch(photo, /여러 장이면 겹치는 부분이 있어도 자동으로 정리합니다/);
  assert.match(photo, /PriceGuideOnboardingChoice/);
  assert.match(choice, /요금표 등록/);
  assert.match(choice, /min-h-24/);
  assert.match(choice, /border-\[#cfd9e5\] bg-white/);
  assert.match(choice, /focus-visible:ring-2 focus-visible:ring-\[#2563eb\]/);
  assert.match(choice, /사진으로 등록/);
  assert.match(choice, /기존 요금표 사진을 올려요\./);
  assert.match(choice, /직접 등록/);
  assert.match(choice, /서비스와 요금을 직접 입력해요\./);
  assert.doesNotMatch(choice, /AI/);
  assert.match(fixture, /schemaVersion:\s*2/);
  assert.match(fixture, /const weightCutoffs = \[2, 4, 6, 8\] as const/);
  assert.match(fixture, /weightBandLabel: `\$\{maxKg\}kg 미만`/);
  assert.match(fixture, /rows: weightCutoffs\.flatMap\([\s\S]*services\.map/);
  assert.match(fixture, /aiReview:/);
});

test("analyzed price guide reuses the PC service-column editor with table-local horizontal scroll and sticky headers", async () => {
  const [photo, nativeTable] = await Promise.all([
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/components/owner-web/price-guide-native-inline-table.tsx"),
  ]);

  assert.match(photo, /import PriceGuideNativeInlineTable from "@\/components\/owner-web\/price-guide-native-inline-table"/);
  assert.match(photo, /data-price-guide-horizontal-scroll="native-table"/);
  assert.match(nativeTable, /data-price-guide-matrix-scroll="true"/);
  assert.match(nativeTable, /max-h-\[min\(62dvh,680px\)\][^"\n]*overflow-auto/);
  assert.match(nativeTable, /<thead className="sticky top-0 z-30"/);
  assert.match(nativeTable, /sticky left-0 top-0 z-40[^\n]*>체급\(kg\)/);
  assert.match(nativeTable, /sticky left-0 z-20/);
  assert.match(nativeTable, /group\.serviceNames\.map\(\(serviceName, serviceIndex\) => \{[\s\S]*<th[\s\S]*updateDirectPriceGuideService/);
  assert.match(nativeTable, /group\.serviceNames\.map\(\(_, serviceIndex\) => \{[\s\S]*<PriceDurationInlineCell/);
  assert.match(nativeTable, /data-price-guide-inline-edit="price-duration"/);
  assert.match(nativeTable, /grid-cols-\[minmax\(0,1fr\)_88px\]/);
  assert.match(nativeTable, /\{priceLabel\(row\)\} \/ \{row\.durationMinutes === null \? "시간 입력" : `\$\{row\.durationMinutes\}분`\}/);
  assert.doesNotMatch(nativeTable, />가격<\/th>|>예상시간<\/th>|function PriceInlineCell|function DurationInlineCell/);
  assert.match(photo, /validatePriceGuideDocument\(document, \{ photoTable: true \}\)/);
  assert.match(photo, /await onSave\(document\)/);
  assert.doesNotMatch(photo, /data-price-guide-layout="service-rows"|가격 기준/);
});

test("photo analysis cancellation aborts only the current client request and clears temporary selection", async () => {
  const photo = await source("src/components/owner-web/price-guide-photo-onboarding.tsx");

  assert.match(photo, /const requestController = new AbortController\(\)/);
  assert.match(photo, /signal: requestController\.signal/);
  assert.match(photo, /const isCurrentAnalysis = \(\) => analysisRunIdRef\.current === analysisRunId && !requestController\.signal\.aborted/);
  assert.match(photo, /function cancelAnalysis\(\)[\s\S]*requestController\.abort\(\)[\s\S]*clearPhotoTemporaryState\(\)/);
  assert.match(photo, /불러오기 취소/);
  assert.match(photo, /if \(!isCurrentAnalysis\(\)\) \{[\s\S]*cleanupUploadedAssets\(cleanupBindings\)/);
  assert.match(photo, /inputRef\.current && \(inputRef\.current\.value = ""\)/);
  assert.doesNotMatch(photo, /captureRef/);
});

test("late photo-analysis success cleans transient uploads once without committing stale UI", async () => {
  const photo = await source("src/components/owner-web/price-guide-photo-onboarding.tsx");
  const mediaAssetIds = ["transient-source-1"];
  const requestController = new AbortController();
  const abortIgnoringFetch = Promise.resolve({ document: { schemaVersion: 2 } });
  let deleteIntentCount = 0;
  let lateUiCommitCount = 0;

  requestController.abort();
  await abortIgnoringFetch;
  const isCurrentAnalysis = () => !requestController.signal.aborted;
  if (!isCurrentAnalysis()) await cleanupLatePhotoAnalysisResult(mediaAssetIds, async (ids) => {
    assert.deepEqual(ids, mediaAssetIds);
    deleteIntentCount += 1;
  });

  assert.equal(deleteIntentCount, 1);
  assert.equal(lateUiCommitCount, 0);
  assert.match(
    photo,
    /const nextResult = await fetchApiJsonWithAuth<PriceGuidePhotoImportResponse>[\s\S]*rememberOwnerPriceGuideHardPurgeReceipt[\s\S]*if \(!isCurrentAnalysis\(\)\) \{\s*await cleanupLatePhotoAnalysisResult\(cleanupBindings, cleanupUploadedAssets\);\s*return;\s*\}[\s\S]*openPhotoReview\(nextResult\)/,
  );
  assert.match(photo, /if \(!isCurrentAnalysis\(\)\) \{[\s\S]*cleanupUploadedAssets\(cleanupBindings\)[\s\S]*return;/);
  assert.match(photo, /function cancelAnalysis\(\)[\s\S]*requestController\.abort\(\)[\s\S]*clearPhotoTemporaryState\(\)/);
});

test("photo analysis keeps one source-file boundary, secrets server-only, and strict Responses parsing", async () => {
  const [client, route, privacy, server, serverEnv, envExample] = await Promise.all([
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/app/api/owner/price-guide-photo-import/route.ts"),
    source("src/server/price-guide-image-privacy.ts"),
    source("src/server/price-guide-photo-import.ts"),
    source("src/lib/server-env.ts"),
    source(".env.example"),
  ]);

  assert.doesNotMatch(client, /OPENAI_API_KEY|process\.env|Authorization:\s*`Bearer/);
  assert.match(serverEnv, /openaiPriceGuideEnabled: process\.env\.OPENAI_PRICE_GUIDE_ENABLED === "true"/);
  assert.match(serverEnv, /openaiApiKey: readOptionalSecret\(process\.env\.OPENAI_API_KEY\)/);
  assert.match(envExample, /OPENAI_PRICE_GUIDE_ENABLED=false/);
  assert.match(envExample, /OPENAI_API_KEY=/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_OPENAI/);

  assert.match(route, /extractPriceGuideFromImages/);
  assert.match(route, /mediaAssetIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.length\(1\)/);
  assert.match(route, /cleanupProofs: z\.array\(cleanupProofSchema\)\.max\(1\)\.default\(\[\]\)/);
  assert.match(route, /Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /removeOwnerPriceGuideSourceMedia/);
  assert.match(privacy, /const REQUIRED_SOURCE_IMAGE_COUNT = 1/);
  assert.match(privacy, /sourceBuffers\.length !== REQUIRED_SOURCE_IMAGE_COUNT/);
  assert.match(privacy, /요금표 사진은 한 장만 선택해 주세요/);
  assert.match(privacy, /kind: "privacy_normalized_full"/);
  assert.match(privacy, /Buffer\.from\(normalized\)/);
  assert.match(privacy, /MAX_READABILITY_SCALE = 2/);
  assert.match(privacy, /webp\(\{ lossless: true/);
  assert.doesNotMatch(privacy, /content_crop|HEADER_REDACTION_RATIO|FOOTER_REDACTION_RATIO|cropOffsets|\.extract\(/);
  assert.match(server, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(server, /PRICE_GUIDE_VISION_MODEL = "gpt-5\.6-luna"/);
  assert.match(server, /parsePriceGuideResponsesPayload/);
  assert.match(server, /function expandProviderPriceGuideRows/);
  assert.match(server, /const groupIndex = readProviderCoordinate\(row\.g/);
  assert.match(server, /function resolveProviderCellCoordinate[\s\S]*const directWeightIndex = readProviderCoordinate\(row\.w/);
  assert.match(server, /function resolveProviderCellCoordinate[\s\S]*const directServiceIndex = readProviderCoordinate\(row\.s/);
  assert.match(server, /canonicalizeProviderAxisDuplicates/);
  assert.match(server, /priceGuideV2Schema\.safeParse\(\{[\s\S]*rows: canonicalRows/);
  assert.match(server, /rejectUnverifiedPriceCellDigits/);
  assert.match(server, /!serverEnv\.openaiPriceGuideEnabled \|\| !serverEnv\.openaiApiKey/);
  assert.match(server, /imageUrls\.length !== 1/);
  assert.match(server, /reconcilePriceGuideStructuredDraft/);
  assert.match(server, /VISION_TIMEOUT/);
  assert.doesNotMatch(server, /1개부터 15개|같은 원본의 전체 보기와 확대 크롭|같은 요금표가 여러 사진/);
});

test("explicit canonical save posts, then re-queries GET before parent state is refreshed", async () => {
  const [serviceScreen, onboarding] = await Promise.all([
    source("src/components/owner-web/service-management-screen.tsx"),
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
  ]);
  const postIndex = serviceScreen.indexOf('fetchApiJsonWithAuth<Service>("/api/services"');
  const getIndex = serviceScreen.indexOf("fetchApiJsonWithAuth<BootstrapPayload>", postIndex);
  const parentRefreshIndex = serviceScreen.indexOf("onServicesChange?.(canonicalServices)", getIndex);
  assert.ok(postIndex >= 0 && getIndex > postIndex && parentRefreshIndex > getIndex);
  assert.match(serviceScreen, /\{ cache: "no-store" \}/);
  assert.match(serviceScreen, /if \(!refreshedSelected\)/);
  assert.doesNotMatch(serviceScreen, /onServicesChange\?\.\(previewServices\)/);
  assert.doesNotMatch(serviceScreen, /setServices\(\(current\) => current\.map\(\(service\) => \(service\.id === savedManaged\.id \? savedManaged : service\)\)\)[\s\S]*최신 목록을 다시 불러오지 못했습니다/);

  const applyStart = onboarding.indexOf("async function applyReviewedDocument");
  const renderStart = onboarding.indexOf("return (", applyStart);
  const applyBoundary = onboarding.slice(applyStart, renderStart);
  assert.match(applyBoundary, /pendingCanonicalSaveRef\.current = true[\s\S]*await onApply\(document\)/);
  assert.match(applyBoundary, /if \(!saved\) pendingCanonicalSaveRef\.current = false/);
  assert.doesNotMatch(applyBoundary, /setManualDocument\(document\)|setMode\("choice"\)/);
  assert.match(onboarding, /if \(!pendingCanonicalSaveRef\.current \|\| !initialDocument\) return;[\s\S]*setManualDocument\(initialDocument\)[\s\S]*setMode\("choice"\)/);
});
