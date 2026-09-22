import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("new shops see only the two price-guide entry choices before selecting a mode", async () => {
  const [choice, photo, serviceScreen] = await Promise.all([
    source("src/components/owner-web/price-guide-onboarding-choice.tsx"),
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/components/owner-web/service-management-screen.tsx"),
  ]);

  assert.match(choice, /사진으로 등록/);
  assert.match(choice, /직접 등록/);
  assert.match(choice, /min-h-\[88px\]/);
  assert.match(choice, /sm:grid-cols-2/);
  assert.match(choice, /onClick=\{\(\) => onSelect\(mode\)\}/);
  assert.doesNotMatch(choice, /요금표 등록|빠른 등록/);
  assert.doesNotMatch(choice, /요금표 미등록|기존 요금표 사진을 올려요\.|서비스와 요금을 직접 입력해요\./);
  assert.doesNotMatch(choice, /AI|입력 방법|미용 요금표 만들기|초안을 만들어요|처음부터 직접 입력해요/);

  assert.match(photo, /const hasSavedPriceGuide = initialDocument !== null/);
  assert.match(photo, /mode === "choice" && !hasSavedPriceGuide \? <PriceGuideOnboardingChoice onSelect=\{selectMode\} \/>/);
  assert.match(photo, /mode === "photo" \? <section/);
  assert.match(photo, /mode === "manual" && editorMode === "direct" \? \([\s\S]*<PriceGuideManualOnboarding/);
  assert.match(photo, /mode === "manual" && editorMode === "photo-review" && manualDocument \? \([\s\S]*<AnalyzedPriceGuideEditor/);
  assert.match(photo, /mode === "choice" && initialDocument \? \([\s\S]*data-price-guide-source="saved"[\s\S]*document=\{initialDocument\}/);
  assert.doesNotMatch(photo, /default-draft|initialDocument \?\? createEmptyManualPriceGuideDocument\(\)|mode !== "manual"/);

  assert.match(serviceScreen, /const priceGuideWorkspace = \(/);
  assert.match(serviceScreen, /서비스 요금 설정/);
  assert.doesNotMatch(serviceScreen, /서비스·요금 설정/);
  assert.match(serviceScreen, /initialDocument=\{canonicalPriceGuideDocument\}/);
  assert.match(serviceScreen, /initialSetupPriceGuideSaveAction \? \([\s\S]*<OwnerInitialSetupSaveNextActions/);
  assert.doesNotMatch(serviceScreen, /PriceGuideSavedServiceList|priceGuideView === "list"/);
});

test("direct registration opens a structure-only inline matrix without seeded shop values", async () => {
  const [manual, inlineMatrix, matrixModel] = await Promise.all([
    source("src/components/owner-web/price-guide-manual-onboarding.tsx"),
    source("src/components/owner-web/price-guide-native-inline-table.tsx"),
    source("src/lib/price-guide-direct-matrix.ts"),
  ]);

  assert.match(manual, /return createDirectPriceGuideSkeleton\(\)/);
  assert.match(manual, /manualMatrixMode \|\| photoEditing \? \([\s\S]*<PriceGuideNativeInlineTable/);
  assert.match(manual, /priceFirstDurationControls=\{manualMatrixMode\}[\s\S]*hideHeader=\{manualMatrixMode\}/);
  assert.match(manual, /data-testid="price-guide-inline-quick-entry"/);
  assert.match(inlineMatrix, /headerSlot\?: ReactNode/);
  assert.doesNotMatch(manual, /buildDefaultPriceGuideV2Draft|PriceGuideRoughInputPanel|한 줄 메모로 초안 만들기/);
  assert.match(matrixModel, /DIRECT_MATRIX_INITIAL_CUTOFFS_KG = \[2, 4, 6, 8\]/);
  assert.match(matrixModel, /label: maxKg === null \? "" : `\$\{maxKg\}kg`/);
  assert.match(matrixModel, /DIRECT_MATRIX_STARTER_GROUPS = \["소형견", "중형견", "대형견"\]/);
  assert.match(matrixModel, /DEFAULT_PRICE_GUIDE_SERVICE_NAMES = \["목욕", "부분미용", "전체미용", "스포팅"\]/);
  assert.match(matrixModel, /breedNames: \[\]/);
  assert.match(matrixModel, /species: "dog"/);
  assert.match(matrixModel, /sizeClass: "all"/);
  assert.match(matrixModel, /priceKind: "fixed"/);
  assert.match(matrixModel, /priceMinKrw: null/);
  assert.match(matrixModel, /durationMinutes: null/);
  assert.match(inlineMatrix, /data-price-guide-native-inline-table="true"/);
  for (const label of ["그룹 제목 입력", "품종 선택", "몸무게", "확인 필요", "예상시간"]) {
    assert.match(inlineMatrix, new RegExp(label.replace(/[()]/g, "\\$&")));
  }
  assert.match(inlineMatrix, /data-price-guide-breed-chips="true"/);
  assert.match(inlineMatrix, /data-price-guide-dynamic-service-ui="true"/);
  assert.doesNotMatch(inlineMatrix, /대상 동물|체급 분류|가격 방식 선택|메모 추가/);
  assert.match(inlineMatrix, /<PriceGuideNativeInlineExtras[\s\S]*document=\{guide\}[\s\S]*onChange=\{onChange\}/);
  assert.doesNotMatch(inlineMatrix, /요금 행|이 그룹 편집|한 줄 메모로 초안 만들기/);
});

test("saved V2 remains the displayed source and drafts do not reach parent state before explicit save", async () => {
  const [photo, serviceScreen, detail, ownerPreview] = await Promise.all([
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/components/owner-web/service-management-screen.tsx"),
    source("src/components/owner-web/price-guide-v2-service-detail.tsx"),
    source("src/components/owner-web/owner-web-preview.tsx"),
  ]);

  assert.match(photo, /mode === "choice" && initialDocument \? \([\s\S]*document=\{initialDocument\}/);
  assert.doesNotMatch(photo, /default-draft|createEmptyManualPriceGuideDocument/);
  assert.doesNotMatch(photo, /\[\.\.\.initialDocument\.rows|concat\(|default.*initialDocument.*rows/i);
  assert.match(detail, /const \[draft, setDraft\] = useState<PriceGuideV2>\(value\)/);
  assert.match(detail, /const saved = await onSave\(draft\)/);
  assert.match(detail, /const saveDraftRef = useRef\(saveDraft\)[\s\S]*saveDraftRef\.current = saveDraft[\s\S]*const registeredSaveAction = useCallback\(async \(\) => saveDraftRef\.current\(\), \[\]\)/);
  assert.match(detail, /<PriceGuideStructuredReviewTable[\s\S]*onEditGroup=\{\(groupIndex\)[\s\S]*onEditExtras=\{\(\)/);
  assert.match(detail, /상세 요금표 저장/);

  const explicitSaveIndex = serviceScreen.indexOf("if (saveImmediately)");
  const draftStateIndex = serviceScreen.indexOf("setServiceForm(nextForm)", explicitSaveIndex);
  const saveCallIndex = serviceScreen.indexOf("saveService({", explicitSaveIndex);
  assert.ok(saveCallIndex > explicitSaveIndex);
  assert.ok(draftStateIndex > saveCallIndex, "local service state must only update in the non-explicit draft branch");
  assert.doesNotMatch(serviceScreen, /onServicesChange\?\.\(previewServices\)/);

  const nextHelper = /export function runInitialSetupServiceNext\(onInitialSetupNext\?: \(\) => void\) \{\s*([\s\S]*?)\s*\}/.exec(serviceScreen);
  assert.ok(nextHelper, "service setup Next must use a pure navigation-only helper");
  const runNext = new Function("onInitialSetupNext", nextHelper[1]);
  const confirmed = ["hours", "staff"];
  let navigationCalls = 0;
  runNext(() => { navigationCalls += 1; });
  assert.equal(navigationCalls, 1);
  assert.deepEqual(confirmed, ["hours", "staff"], "Next alone must not confirm pricing");

  const onboardingStart = serviceScreen.indexOf("if (priceGuideOnboarding) {");
  const onboardingEnd = serviceScreen.indexOf("\n  const content =", onboardingStart);
  const onboarding = serviceScreen.slice(onboardingStart, onboardingEnd);
  assert.match(onboarding, /initialSetupPriceGuideSaveAction \? \([\s\S]*<OwnerInitialSetupSaveNextActions[\s\S]*onSave=\{\(\) => initialSetupPriceGuideSaveAction\(\)\}[\s\S]*onNext=\{\(\) => runInitialSetupServiceNext\(onInitialSetupNext\)\}/);
  assert.match(serviceScreen, /onSaveActionReady=\{priceGuideOnboarding \? registerInitialSetupPriceGuideSaveAction : undefined\}/);
  assert.doesNotMatch(onboarding, /onPriceGuideSaveSuccess|saveService|confirmOwnerInitialSetupStep/);
  assert.match(ownerPreview, /onPriceGuideSaveSuccess=\{\(canonicalBootstrap\) => onInitialSetupStepSaved\("pricing", canonicalBootstrap\)\}[\s\S]*onInitialSetupNext=\{onInitialSetupPricingNext\}/);
  assert.match(serviceScreen, /fetchApiJsonWithAuth<BootstrapPayload>[\s\S]*\/api\/bootstrap\?shopId=\$\{encodeURIComponent\(shopId\)\}&phase=essential[\s\S]*\{ cache: "no-store" \}/);
});

test("inline direct entry and photo review reuse the strict explicit canonical save flow", async () => {
  const [manual, inlineMatrix, onboarding, detail, editor, roughPanel, roughParser, servicePriceGuide] = await Promise.all([
    source("src/components/owner-web/price-guide-manual-onboarding.tsx"),
    source("src/components/owner-web/price-guide-native-inline-table.tsx"),
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/components/owner-web/price-guide-v2-service-detail.tsx"),
    source("src/components/auth/signup-price-guide-editor.tsx"),
    source("src/components/owner-web/price-guide-rough-input-panel.tsx"),
    source("src/lib/price-guide-rough-input.ts"),
    source("src/components/owner-web/service-price-guide.tsx"),
  ]);

  assert.match(onboarding, /mode === "manual" && editorMode === "direct" \? \([\s\S]*<PriceGuideManualOnboarding/);
  assert.match(onboarding, /mode === "manual" && editorMode === "photo-review" && manualDocument \? \([\s\S]*<AnalyzedPriceGuideEditor/);
  assert.match(
    onboarding,
    /function openPhotoReview\(nextResult: PriceGuidePhotoImportResponse\)[\s\S]*setManualDocument\(nextResult\.document\)[\s\S]*setEditorMode\("photo-review"\)[\s\S]*setMode\("manual"\)/,
    "photo results must enter the shared canonical matrix editor",
  );
  assert.match(onboarding, /openPhotoReview\(createPriceGuidePhotoImportFixture\(\)\)/);
  assert.match(onboarding, /openPhotoReview\(nextResult\)/);
  assert.doesNotMatch(onboarding, /ExtractionPreview|result\.guide|검토하고 수정하기/);
  const selectModeStart = onboarding.indexOf("  function selectMode(nextMode: OnboardingMode) {");
  const selectModeAfterStart = onboarding.slice(selectModeStart);
  const nextFunctionOffset = selectModeAfterStart.search(/\r?\n\r?\n  (?:async )?function /);
  const selectModeEnd = selectModeStart + nextFunctionOffset;
  assert.ok(selectModeStart >= 0 && nextFunctionOffset > 0, "selectMode must end before the next function begins");
  const selectMode = onboarding.slice(selectModeStart, selectModeEnd);
  const selectsDirectMatrixMode = (functionSource) => (
    /nextMode === "manual"/.test(functionSource)
    && /setEditorMode\("direct"\)/.test(functionSource)
  );
  assert.equal(
    selectsDirectMatrixMode(selectMode),
    true,
    "the direct-entry action must explicitly select the fixed matrix mode inside selectMode",
  );
  assert.equal(
    selectsDirectMatrixMode(selectMode.replace('setEditorMode("direct")', 'setEditorMode("photo-review")')),
    false,
    "inverting direct entry to photo review must fail the selectMode contract",
  );
  assert.equal(
    selectsDirectMatrixMode(selectMode.replace('setEditorMode("direct")', "")),
    false,
    "removing direct entry mode selection must fail the selectMode contract",
  );
  assert.match(onboarding, /<PriceGuideManualOnboarding[\s\S]*?manualMatrixMode/);
  assert.match(onboarding, /function AnalyzedPriceGuideEditor[\s\S]*<PriceGuideNativeInlineTable[\s\S]*photoReviewMode/);
  assert.match(onboarding, /manualMatrixMode=\{isFixedManualPriceGuideDocument\(initialDocument\)\}/);
  assert.match(onboarding, /onBack=\{returnToChoice\}/);
  const cancelStart = onboarding.indexOf("  function cancelAnalysis() {");
  const returnStart = onboarding.indexOf("  function returnToChoice() {", cancelStart);
  const selectStart = onboarding.indexOf("  function selectMode(nextMode: OnboardingMode) {", returnStart);
  const cancelSource = onboarding.slice(cancelStart, returnStart);
  const returnSource = onboarding.slice(returnStart, selectStart);
  assert.match(cancelSource, /requestController\.abort\(\)[\s\S]*clearPhotoTemporaryState\(\)[\s\S]*setMode\("choice"\)/);
  assert.match(returnSource, /clearPhotoTemporaryState\(\)[\s\S]*onSaveActionReady\?\.\(null\)[\s\S]*setMode\("choice"\)/);
  assert.doesNotMatch(`${cancelSource}\n${returnSource}`, /onApply|applyReviewedDocument/);

  assert.match(manual, /manualMatrixMode \|\| photoEditing \? \([\s\S]*<PriceGuideNativeInlineTable[\s\S]*\) : \([\s\S]*<PriceGuideStructuredReviewTable/);
  assert.match(manual, /<PriceGuideStructuredReviewTable[\s\S]*document=\{draft\}[\s\S]*onEdit=/);
  assert.match(manual, /photoReviewMode=\{!manualMatrixMode\}/);
  assert.match(manual, /validationIssues=\{validationAttempted \? draftIssues : \[\]\}/);
  assert.match(manual, /validatePriceGuideDocument\(draft, \{ photoTable: !manualMatrixMode \}\)/);
  assert.match(manual, /const saved = await onSave\(draft\)/);
  assert.match(manual, /onSaveActionReady\?\.\(registeredSaveAction\)/);
  assert.match(manual, /상세 요금표 저장/);
  assert.equal((manual.match(/onSave\(draft\)/g) ?? []).length, 1, "draft reaches the parent only through the explicit save action");
  assert.doesNotMatch(manual, /PriceGuideRoughInputPanel|한 줄 메모로 초안 만들기|buildDefaultPriceGuideV2Draft|입력 예시입니다/);
  assert.match(inlineMatrix, /data-price-guide-native-inline-table="true"/);
  assert.match(inlineMatrix, /updateDirectPriceGuideGroup/);
  assert.match(inlineMatrix, /updateDirectPriceGuideCell/);
  assert.match(inlineMatrix, /updateDirectPriceGuideWeightBand/);
  assert.match(inlineMatrix, /addDirectPriceGuideWeightBand/);
  assert.match(inlineMatrix, /removeDirectPriceGuideWeightBand/);
  assert.match(inlineMatrix, /몸무게/);
  assert.match(inlineMatrix, /updateDirectPriceGuideService/);
  assert.match(inlineMatrix, /addDirectPriceGuideService/);
  assert.match(inlineMatrix, /removeDirectPriceGuideService/);
  assert.doesNotMatch(inlineMatrix, /요금 행|이 그룹 편집/);

  // The optional text parser remains source-only and is no longer connected to direct registration.
  assert.match(roughPanel, /parsePriceGuideRoughInput\(roughInput\)/);
  assert.match(roughPanel, /onCreateDraft\(result\)/);
  assert.match(roughPanel, /전체미용 5만원 1시간/);
  assert.match(roughPanel, /적힌 내용만 옮깁니다/);
  assert.match(roughPanel, /확인 필요/);
  assert.doesNotMatch(roughPanel, /fetch\(|fetchApiJsonWithAuth|onSave/);
  assert.match(roughParser, /source: "manual"/);
  assert.match(roughParser, /species: PriceGuideV2Row\["species"\] = "unknown"/);
  assert.match(roughParser, /sizeClass: PriceGuideV2Row\["sizeClass"\] = "unknown"/);
  assert.match(roughParser, /priceKind: PriceGuideV2Row\["priceKind"\] = "unknown"/);
  assert.match(roughParser, /durationMinutes: number \| null = null/);

  assert.match(editor, /species: "unknown"/);
  assert.match(editor, /id="price-guide-add-row"/);
  assert.match(editor, /요금 행 \$\{index \+ 1\} 삭제/);
  assert.match(editor, /label="최소 kg"/);
  assert.match(editor, /label="최대 kg"/);
  assert.match(editor, /label="행 메모"/);
  assert.match(editor, /추가요금 \$\{index \+ 1\} 삭제/);
  assert.match(editor, /추가요금 추가/);
  assert.match(editor, /추가 비율은 0~1,000%로 입력해 주세요/);
  assert.match(editor, /!options\.photoTable && classificationIssues/);
  assert.match(editor, /row\.priceKind === "unknown" && \(!options\.photoTable \|\| row\.priceMinKrw === null\)/);
  assert.match(editor, /options\.photoTable \? \[\] : document\.aiReview/);

  // Direct registration and photo edits reuse the same native table canvas; saved photo guides start from the clean table view.
  assert.match(servicePriceGuide, /manualMatrixMode=\{isFixedManualPriceGuideDocument\(guide\.canonicalV2\)\}/);
  assert.match(detail, /document\.source === "manual" && document\.rows\.every\(\(row\) => row\.priceKind === "fixed"\)/);
  assert.match(detail, /<PriceGuideNativeInlineTable[\s\S]*document=\{draft\}[\s\S]*onChange=\{updateDraft\}/);
  assert.match(detail, /<PriceGuideStructuredReviewTable/);
  assert.match(detail, /photoReviewMode=\{photoTable\}/);
  assert.match(detail, /const saved = await onSave\(draft\)/);
  assert.match(detail, /변경 취소/);
  assert.match(detail, /상세 요금표 저장/);
  assert.doesNotMatch(detail, /manualMatrixMode \? \(|MatrixGroupCard|EditableMatrixGroup|PencilLine|이 그룹 편집/);
  assert.match(inlineMatrix, /function PriceDurationInlineCell[\s\S]*data-price-guide-price-duration-cell=\{rowIndex\}/);
  assert.match(inlineMatrix, /data-price-guide-inline-edit="price-duration"/);
  assert.match(inlineMatrix, /grid-cols-\[minmax\(0,1fr\)_88px\][\s\S]*<PriceDurationInlineCell/);
  assert.match(inlineMatrix, /\{compactPriceDurationLabel\(row\)\}/);
  assert.doesNotMatch(inlineMatrix, /function PriceInlineCell|function DurationInlineCell/);
  assert.doesNotMatch(inlineMatrix, /renderedStructureField === noteId|메모 추가/);
  assert.doesNotMatch(inlineMatrix, /firstIssueInputId \?\? activeField/);
});
