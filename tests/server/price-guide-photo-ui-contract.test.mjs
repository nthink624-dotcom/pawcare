import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cleanupLatePhotoAnalysisResult } from "../../src/lib/price-guide-photo-analysis-client.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("owner photo import provides file and camera inputs, preview, retry, and review-only handoff", async () => {
  const [photo, manual, choice, fixture] = await Promise.all([
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/components/owner-web/price-guide-manual-onboarding.tsx"),
    source("src/components/owner-web/price-guide-onboarding-choice.tsx"),
    source("src/lib/price-guide-photo-import-fixture.ts"),
  ]);

  assert.match(photo, /type="file" accept="image\/jpeg,image\/png,image\/webp" multiple/);
  assert.match(photo, /type="file" accept="image\/jpeg,image\/png,image\/webp" capture="environment"/);
  assert.match(photo, /카메라로 촬영/);
  assert.match(photo, /URL\.createObjectURL\(file\)/);
  assert.match(photo, /previewUrls\.map/);
  assert.match(photo, /analyzing \?[^:]+사진 읽는 중/s);
  assert.match(photo, /error \? "다시 분석하기"/);
  assert.match(photo, /setResult\(createPriceGuidePhotoImportFixture\(\)\)/);
  assert.match(photo, /setManualDocument\(result\.document\)[\s\S]*setMode\("manual"\)/);
  assert.match(photo, /setEditorMode\("photo-review"\)/);
  assert.match(photo, /manualMatrixMode=\{editorMode === "direct"\}/);
  assert.match(manual, /manualMatrixMode = true/);
  assert.match(manual, /manualMatrixMode=\{manualMatrixMode\}/);
  assert.match(photo, /검토하고 수정하기/);
  assert.doesNotMatch(photo, /onApply\(result\.document\)/);
  assert.match(photo, /사진으로 요금표 만들기/);
  assert.match(photo, /OpenAI 분석 전 사진에서 이름·전화번호·주소를 가려 주세요/);
  assert.doesNotMatch(photo, /사진을 선택한 뒤에만 업로드와 분석을 시작합니다/);
  assert.doesNotMatch(photo, /표 전체가 정면으로 보이게 찍으면 더 정확합니다/);
  assert.doesNotMatch(photo, /여러 장이면 겹치는 부분이 있어도 자동으로 정리합니다/);
  assert.match(photo, /PriceGuideOnboardingChoice/);
  assert.match(choice, /mode === "photo"/);
  assert.match(choice, /bg-\[#eff5ff\]/);
  assert.match(choice, /border-\[#b8cce6\]/);
  assert.match(choice, /active:bg-\[#deebfb\]/);
  assert.match(choice, /focus-visible:ring-2 focus-visible:ring-\[#2563eb\]/);
  assert.match(choice, /사진으로 요금표 만들기/);
  assert.match(choice, /직접 요금표 만들기/);
  assert.match(fixture, /schemaVersion:\s*2/);
  assert.match(fixture, /aiReview:/);
});

test("photo analysis cancellation aborts only the current client request and clears temporary selection", async () => {
  const photo = await source("src/components/owner-web/price-guide-photo-onboarding.tsx");

  assert.match(photo, /const requestController = new AbortController\(\)/);
  assert.match(photo, /signal: requestController\.signal/);
  assert.match(photo, /const isCurrentAnalysis = \(\) => analysisRunIdRef\.current === analysisRunId && !requestController\.signal\.aborted/);
  assert.match(photo, /function cancelAnalysis\(\)[\s\S]*requestController\.abort\(\)[\s\S]*clearPhotoTemporaryState\(\)/);
  assert.match(photo, /분석 취소/);
  assert.match(photo, /if \(!isCurrentAnalysis\(\)\) \{[\s\S]*cleanupUploadedAssets\(mediaAssetIds\)/);
  assert.match(photo, /inputRef\.current && \(inputRef\.current\.value = ""\)/);
  assert.match(photo, /captureRef\.current && \(captureRef\.current\.value = ""\)/);
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
    /const nextResult = await fetchApiJsonWithAuth<PriceGuidePhotoImportResponse>[\s\S]*if \(!isCurrentAnalysis\(\)\) \{\s*await cleanupLatePhotoAnalysisResult\(mediaAssetIds, cleanupUploadedAssets\);\s*return;\s*\}[\s\S]*setResult\(nextResult\)/,
  );
  assert.match(photo, /if \(!isCurrentAnalysis\(\)\) \{[\s\S]*cleanupUploadedAssets\(mediaAssetIds\)[\s\S]*return;/);
  assert.match(photo, /function cancelAnalysis\(\)[\s\S]*requestController\.abort\(\)[\s\S]*clearPhotoTemporaryState\(\)/);
});

test("photo analysis keeps secrets server-only and parses strict Responses output", async () => {
  const [client, route, server, serverEnv, envExample] = await Promise.all([
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/app/api/owner/price-guide-photo-import/route.ts"),
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
  assert.match(route, /Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /removeOwnerPriceGuideSourceMedia/);
  assert.match(server, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(server, /PRICE_GUIDE_VISION_MODEL = "gpt-5\.6-luna"/);
  assert.match(server, /parsePriceGuideResponsesPayload/);
  assert.match(server, /priceGuideV2Schema\.safeParse\(decoded\)/);
  assert.match(server, /!serverEnv\.openaiPriceGuideEnabled \|\| !serverEnv\.openaiApiKey/);
});

test("explicit canonical save posts, then re-queries GET before parent state is refreshed", async () => {
  const serviceScreen = await source("src/components/owner-web/service-management-screen.tsx");
  const postIndex = serviceScreen.indexOf('fetchApiJsonWithAuth<Service>("/api/services"');
  const getIndex = serviceScreen.indexOf("fetchApiJsonWithAuth<BootstrapPayload>", postIndex);
  const parentRefreshIndex = serviceScreen.indexOf("onServicesChange?.(canonicalServices)", getIndex);
  assert.ok(postIndex >= 0 && getIndex > postIndex && parentRefreshIndex > getIndex);
  assert.match(serviceScreen, /\{ cache: "no-store" \}/);
  assert.match(serviceScreen, /if \(!refreshedSelected\)/);
  assert.doesNotMatch(serviceScreen, /onServicesChange\?\.\(previewServices\)/);
  assert.doesNotMatch(serviceScreen, /setServices\(\(current\) => current\.map\(\(service\) => \(service\.id === savedManaged\.id \? savedManaged : service\)\)\)[\s\S]*최신 목록을 다시 불러오지 못했습니다/);
});
