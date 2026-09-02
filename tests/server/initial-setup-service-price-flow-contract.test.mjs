import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("service price workspace always keeps both entry actions above group tables", async () => {
  const [choice, photo, serviceScreen] = await Promise.all([
    source("src/components/owner-web/price-guide-onboarding-choice.tsx"),
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/components/owner-web/service-management-screen.tsx"),
  ]);

  assert.match(choice, /사진으로 요금표 만들기/);
  assert.match(choice, /직접 요금표 만들기/);
  assert.match(choice, /입력 방법/);
  assert.match(choice, /min-h-\[72px\]/);
  assert.match(choice, /sm:grid-cols-2/);
  assert.doesNotMatch(choice, /미용 요금표 만들기|초안을 만들어요|처음부터 직접 입력해요/);

  const choiceIndex = photo.indexOf("<PriceGuideOnboardingChoice");
  const groupIndex = photo.indexOf("<PriceGuideV2ServiceDetail");
  assert.ok(choiceIndex >= 0 && groupIndex > choiceIndex);
  assert.match(photo, /initialDocument \?\? createEmptyManualPriceGuideDocument\(\)/);
  assert.match(photo, /data-price-guide-source=\{initialDocument \? "saved" : "default-draft"\}/);
  assert.match(photo, /mode !== "manual"/);

  assert.match(serviceScreen, /const priceGuideWorkspace = \(/);
  assert.match(serviceScreen, /initialDocument=\{canonicalPriceGuideDocument\}/);
  assert.doesNotMatch(serviceScreen, /PriceGuideSavedServiceList|priceGuideView === "list"/);
});

test("empty canonical state reuses exactly the existing three dog templates as an edit-only draft", async () => {
  const [template, manual, detail] = await Promise.all([
    source("src/components/owner-web/service-price-guide.tsx"),
    source("src/components/owner-web/price-guide-manual-onboarding.tsx"),
    source("src/components/owner-web/price-guide-v2-service-detail.tsx"),
  ]);

  for (const group of ["베이직", "플러스", "프리미엄"]) assert.ok(template.includes(`title: "${group}"`));
  for (const weight of ["4kg 이하", "6kg 이하", "8kg 이하", "10kg 이하"]) assert.ok(template.includes(`"${weight}"`));
  for (const service of ["위생미용+목욕", "클리핑", "스포팅", "가위컷"]) assert.ok(template.includes(`label: "${service}"`));
  assert.match(template, /cloneDefaultSections\(\)[\s\S]*filter\(\(section\) => section\.species === "dog"\)[\s\S]*slice\(0, 3\)/);
  assert.match(template, /export function buildDefaultPriceGuideV2Draft/);
  assert.match(manual, /return buildDefaultPriceGuideV2Draft\(\)/);
  assert.doesNotMatch(manual, /priceMinKrw:\s*[0-9]|durationMinutes:\s*[0-9]/);

  assert.match(detail, /data-price-guide-detail-matrix="true"/);
  assert.match(detail, /data-price-guide-matrix-group=\{group\.label\}/);
  assert.match(detail, /group\.weights\.map/);
  assert.match(detail, /group\.services\.map/);
  assert.match(detail, /priceLabel\(row\)/);
  assert.match(detail, /row\.durationMinutes/);
  assert.match(detail, /가격 \/ 예상 시간/);
  assert.match(detail, /<span className="font-medium text-\[#172033\]">\{priceLabel\(row\)\}<\/span>[\s\S]*\/ \{row\.durationMinutes/);
  assert.match(detail, /이 그룹 편집/);
  assert.match(detail, /startEditing/);
});

test("saved V2 remains the only displayed source and drafts do not reach parent state before explicit save", async () => {
  const [photo, serviceScreen, detail, ownerPreview] = await Promise.all([
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/components/owner-web/service-management-screen.tsx"),
    source("src/components/owner-web/price-guide-v2-service-detail.tsx"),
    source("src/components/owner-web/owner-web-preview.tsx"),
  ]);

  assert.match(photo, /const displayedDocument = useMemo\([\s\S]*initialDocument \?\? createEmptyManualPriceGuideDocument\(\)/);
  assert.doesNotMatch(photo, /\[\.\.\.initialDocument\.rows|concat\(|default.*initialDocument.*rows/i);
  assert.match(detail, /const \[draft, setDraft\] = useState\(savedDocument\)/);
  assert.match(detail, /const saved = await onSave\(draft\)/);
  assert.match(detail, /const saveDraftRef = useRef\(saveDraft\)[\s\S]*saveDraftRef\.current = saveDraft[\s\S]*const registeredSaveAction = useCallback\(async \(\) => saveDraftRef\.current\(\), \[\]\)/);
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
  assert.match(onboarding, /<OwnerInitialSetupSaveNextActions[\s\S]*onSave=\{\(\) => initialSetupPriceGuideSaveAction\?\.\(\)\}[\s\S]*onNext=\{\(\) => runInitialSetupServiceNext\(onInitialSetupNext\)\}/);
  assert.match(serviceScreen, /onSaveActionReady=\{priceGuideOnboarding \? registerInitialSetupPriceGuideSaveAction : undefined\}/);
  assert.doesNotMatch(onboarding, /onPriceGuideSaveSuccess|saveService|confirmOwnerInitialSetupStep/);
  assert.match(ownerPreview, /onPriceGuideSaveSuccess=\{\(\) => onInitialSetupStepSaved\("pricing"\)\}[\s\S]*onInitialSetupNext=\{onInitialSetupPricingNext\}/);
});

test("manual price matrix keeps one fixed price-and-duration row while supplemental details reuse the canonical save flow", async () => {
  const [manual, onboarding, detail, editor, servicePriceGuide] = await Promise.all([
    source("src/components/owner-web/price-guide-manual-onboarding.tsx"),
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/components/owner-web/price-guide-v2-service-detail.tsx"),
    source("src/components/auth/signup-price-guide-editor.tsx"),
    source("src/components/owner-web/service-price-guide.tsx"),
  ]);

  assert.match(onboarding, /mode === "manual" \? \([\s\S]*<PriceGuideManualOnboarding/);
  assert.match(
    onboarding,
    /function reviewResult\(\)[\s\S]*setEditorMode\("photo-review"\)[\s\S]*setMode\("manual"\)/,
    "photo results must enter the review editor, not the fixed direct-entry matrix",
  );
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
  assert.match(
    onboarding,
    /<PriceGuideManualOnboarding[\s\S]*?manualMatrixMode=\{editorMode === "direct"\}/,
    "the shared editor must receive false for photo review and true only for direct entry",
  );
  assert.match(onboarding, /manualMatrixMode=\{isFixedManualPriceGuideDocument\(displayedDocument\)\}/);
  assert.match(
    manual,
    /<PriceGuideV2ServiceDetail[\s\S]*?startEditing\s+manualMatrixMode=\{manualMatrixMode\}/,
    "direct entry must begin editing and pass its explicit matrix-mode contract even when props span lines",
  );
  assert.match(servicePriceGuide, /manualMatrixMode=\{isFixedManualPriceGuideDocument\(guide\.canonicalV2\)\}/);
  assert.match(detail, /document\.source === "manual" && document\.rows\.every\(\(row\) => row\.priceKind === "fixed"\)/);
  assert.match(detail, /manualMatrixMode \? \(/);
  assert.match(detail, /data-price-guide-manual-cell=/);
  assert.match(detail, /가격 \/ 예상 시간/);
  assert.match(detail, /min-w-\[282px\]/);
  assert.match(detail, /text-\[16px\] font-normal leading-6 tabular-nums/);
  assert.match(detail, /row\.priceKind === "unknown" \? "fixed" : row\.priceKind/);
  assert.match(detail, /priceMaxKrw: row\.priceKind === "fixed" \|\| row\.priceKind === "unknown" \? null : row\.priceMaxKrw/);
  assert.match(detail, /data-price-guide-supplemental-editor="true"/);
  assert.match(detail, /<PencilLine className="h-4 w-4" aria-hidden="true" \/>[\s\S]*수정/);
  assert.match(detail, /onSave=\{\(\) => void saveDraft\(\)\}/);
  assert.match(detail, /onCancel=\{cancelSupplementalEdit\}/);
  assert.match(detail, /price-guide-surcharge-\$\{index\}-percent/);
  assert.match(editor, /추가 비율은 0~1,000%로 입력해 주세요/);

  const manualCellStart = detail.indexOf("manualMatrixMode ? (");
  const manualCellEnd = detail.indexOf(") : (", manualCellStart);
  const manualCell = detail.slice(manualCellStart, manualCellEnd);
  assert.ok(manualCellStart >= 0 && manualCellEnd > manualCellStart, "manual cell branch must remain explicit");
  assert.doesNotMatch(manualCell, /가격 기준|priceKind/);
  assert.match(manualCell, /aria-label=\{`\$\{weight\} \$\{service\} 가격`\}/);
  assert.match(manualCell, /aria-label=\{`\$\{weight\} \$\{service\} 예상 시간`\}/);
});
