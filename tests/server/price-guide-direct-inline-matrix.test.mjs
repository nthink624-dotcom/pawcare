import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const sourcePath = resolve(sourceRoot, specifier.slice(2));
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`, resolve(sourcePath, "index.ts"), resolve(sourcePath, "index.tsx")]
      .find((path) => existsSync(path));
    if (!candidate) return nextResolve(specifier, context);
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  },
});

const {
  addDirectPriceGuideGroup,
  addDirectPriceGuideService,
  addDirectPriceGuideWeightBand,
  createDirectPriceGuideSkeleton,
  directPriceGuideRowIndex,
  readDirectPriceGuideMatrix,
  readPreservedPriceGuideRows,
  removeDirectPriceGuideGroup,
  removeDirectPriceGuideService,
  removeDirectPriceGuideWeightBand,
  updateDirectPriceGuideCell,
  updateDirectPriceGuideGroup,
  updateDirectPriceGuideService,
  updateDirectPriceGuideWeightBand,
  writeDirectPriceGuideMatrix,
} = await import("../../src/lib/price-guide-direct-matrix.ts");

test("direct registration starts with editable default categories, services, and 2/4/6/8kg rows without invented prices", () => {
  const document = createDirectPriceGuideSkeleton();
  const groups = readDirectPriceGuideMatrix(document);

  assert.equal(document.source, "manual");
  assert.deepEqual(groups.map((group) => group.sourceLabel), ["소형견", "중형견", "대형견"]);
  for (const group of groups) {
    assert.equal(group.species, "dog");
    assert.equal(group.sizeClass, "all");
    assert.deepEqual(group.breedNames, []);
    assert.deepEqual(group.serviceNames, ["목욕", "부분미용", "전체미용", "스포팅"]);
    assert.deepEqual(group.weightBands.map((band) => [band.label, band.minKg, band.maxKg]), [
      ["2kg", null, 2],
      ["4kg", null, 4],
      ["6kg", null, 6],
      ["8kg", null, 8],
    ]);
  }
  assert.equal(document.rows.length, 48);
  assert.equal(document.rows.every((row) => (
    ["목욕", "부분미용", "전체미용", "스포팅"].includes(row.serviceName)
    && ["소형견", "중형견", "대형견"].includes(row.breedGroup)
    && row.species === "dog"
    && row.sizeClass === "all"
    && row.priceKind === "fixed"
    && row.priceMinKrw === null
    && row.priceMaxKrw === null
    && row.durationMinutes === null
    && row.note === null
  )), true);
  assert.equal(document.overallNote, null);
  assert.deepEqual(document.surcharges, []);
  assert.deepEqual(document.aiReview, []);
});

test("inline axis and cell changes rebuild one canonical row per visible matrix cell", () => {
  let document = createDirectPriceGuideSkeleton();
  document = updateDirectPriceGuideGroup(document, 0, {
    sourceLabel: "소형견 수정",
    species: "dog",
    sizeClass: "small",
    breedNames: ["말티즈", "푸들"],
  });
  document = updateDirectPriceGuideWeightBand(document, 0, 1, { minKg: 2, maxKg: 5 });
  document = updateDirectPriceGuideCell(document, 0, 1, 0, {
    priceKind: "range",
    priceMinKrw: 50_000,
    priceMaxKrw: 60_000,
    durationMinutes: 90,
    note: "모량에 따라 달라요",
  });
  document = updateDirectPriceGuideService(document, 0, 1, "전체+얼굴");

  assert.deepEqual(document.tableGroups[0].serviceNames, ["목욕", "전체+얼굴", "전체미용", "스포팅"]);
  assert.equal(document.tableGroups[0].weightBands[1].label, "2~5kg");
  assert.deepEqual(document.rows[4], {
    serviceName: "목욕",
    species: "dog",
    breedNames: ["말티즈", "푸들"],
    breedGroup: "소형견 수정",
    sizeClass: "small",
    minKg: 2,
    maxKg: 5,
    weightBandLabel: "2~5kg",
    priceKind: "range",
    priceMinKrw: 50_000,
    priceMaxKrw: 60_000,
    durationMinutes: 90,
    note: "모량에 따라 달라요",
  });

  document = addDirectPriceGuideWeightBand(document, 0);
  document = updateDirectPriceGuideWeightBand(document, 0, 4, { minKg: 8, maxKg: 10 });
  let groups = readDirectPriceGuideMatrix(document);
  assert.deepEqual(groups[0].serviceNames, ["목욕", "전체+얼굴", "전체미용", "스포팅"]);
  assert.equal(groups[0].weightBands.length, 5);
  assert.equal(document.rows.length, 52);
  assert.equal(directPriceGuideRowIndex(groups, 0, 4, 3), 19);
  assert.equal(document.rows[19].serviceName, "스포팅");
  assert.equal(document.rows[19].weightBandLabel, "8~10kg");
  assert.equal(document.rows[19].priceMinKrw, null);

  document = addDirectPriceGuideService(document, 0);
  groups = readDirectPriceGuideMatrix(document);
  assert.equal(groups[0].serviceNames.length, 5);
  assert.equal(groups[0].serviceNames[4], "");
  document = updateDirectPriceGuideService(document, 0, 4, "전체+하이바");
  assert.equal(readDirectPriceGuideMatrix(document)[0].serviceNames[4], "전체+하이바");
  document = removeDirectPriceGuideService(document, 0, 4);

  document = addDirectPriceGuideGroup(document);
  groups = readDirectPriceGuideMatrix(document);
  assert.equal(groups.length, 4);
  assert.equal(document.rows.length, 68);
  document = removeDirectPriceGuideWeightBand(document, 0, 4);
  document = removeDirectPriceGuideGroup(document, 3);
  groups = readDirectPriceGuideMatrix(document);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].serviceNames.length, 4);
  assert.equal(groups[0].weightBands.length, 4);
  assert.equal(document.rows.length, 48);
});

test("a breed can belong to only one price category and becomes available again after removal", () => {
  let document = createDirectPriceGuideSkeleton();
  document = updateDirectPriceGuideGroup(document, 0, { breedNames: ["말티즈", "푸들"] });
  document = updateDirectPriceGuideGroup(document, 1, { breedNames: ["말티즈", "비숑"] });
  assert.deepEqual(document.tableGroups[0].breedNames, ["말티즈", "푸들"]);
  assert.deepEqual(document.tableGroups[1].breedNames, ["비숑"]);
  document = updateDirectPriceGuideGroup(document, 0, { breedNames: ["푸들"] });
  document = updateDirectPriceGuideGroup(document, 1, { breedNames: ["비숑", "말티즈"] });
  assert.deepEqual(document.tableGroups[1].breedNames, ["비숑", "말티즈"]);
});

test("matrix projection preserves imported provenance until the native table marks a user correction", () => {
  const manual = createDirectPriceGuideSkeleton();
  const imported = {
    ...manual,
    source: "ai_imported",
    aiReview: [{
      targetId: "rows:0",
      field: "priceMinKrw",
      rawText: "금액 판독",
      confidence: "low",
      userConfirmed: false,
      userCorrected: false,
    }],
  };
  const next = updateDirectPriceGuideCell(imported, 0, 0, 0, { priceMinKrw: 50_000 });

  assert.equal(next.source, "ai_imported");
  assert.deepEqual(next.aiReview, imported.aiReview);
});

test("a saved V2 document without tableGroups opens with its canonical values in the same matrix", () => {
  const document = {
    schemaVersion: 2,
    source: "legacy",
    overallNote: "예약 전 확인",
    rows: [{
      serviceName: "전체 미용",
      species: "dog",
      breedNames: ["말티즈"],
      breedGroup: "소형견",
      sizeClass: "small",
      minKg: null,
      maxKg: 5,
      weightBandLabel: "5kg 이하",
      priceKind: "fixed",
      priceMinKrw: 50_000,
      priceMaxKrw: null,
      durationMinutes: 60,
      note: "발톱 포함",
    }],
    surcharges: [],
    aiReview: [],
  };
  const groups = readDirectPriceGuideMatrix(document);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].sourceLabel, "소형견");
  assert.deepEqual(groups[0].breedNames, ["말티즈"]);
  assert.deepEqual(groups[0].serviceNames, ["전체 미용"]);
  assert.equal(groups[0].cells[0][0].priceMinKrw, 50_000);
  assert.equal(groups[0].cells[0][0].durationMinutes, 60);
  assert.equal(groups[0].cells[0][0].note, "발톱 포함");
});

test("photo table keeps source-ordered service columns and binds cells by explicit coordinates", () => {
  const base = {
    serviceName: null,
    species: "dog",
    breedNames: ["말티즈"],
    breedGroup: "소형견",
    sizeClass: "small",
    minKg: null,
    maxKg: 2,
    weightBandLabel: "2kg 이하",
    priceKind: "fixed",
    priceMinKrw: 0,
    priceMaxKrw: null,
    durationMinutes: 30,
    note: null,
  };
  const document = {
    schemaVersion: 2,
    source: "ai_imported",
    overallNote: null,
    tableGroups: [{
      sourceLabel: "소형견",
      species: "dog",
      breedNames: ["말티즈"],
      sizeClass: "small",
      weightBands: [
        { label: "2kg 이하", minKg: null, maxKg: 2, note: null },
        { label: "2~5kg", minKg: 2, maxKg: 5, note: null },
      ],
      serviceNames: ["목욕", "전체", "전체+얼굴", "스포팅", "전체가위"],
      note: null,
    }],
    rows: [
      { ...base, serviceName: "전체", priceMinKrw: 50_000 },
      { ...base, serviceName: "목욕", minKg: 2, maxKg: 5, weightBandLabel: "2~5kg", priceMinKrw: 30_000 },
      { ...base, serviceName: "목욕", priceMinKrw: 20_000 },
      { ...base, serviceName: "전체+얼굴", priceMinKrw: 55_000 },
      { ...base, serviceName: "전체가위", minKg: 2, maxKg: 5, weightBandLabel: "2~5kg", priceMinKrw: 80_000 },
    ],
    surcharges: [],
    aiReview: [],
  };
  const [group] = readDirectPriceGuideMatrix(document);

  assert.deepEqual(group.serviceNames, ["목욕", "전체", "전체+얼굴", "스포팅", "전체가위"]);
  assert.equal(group.cells[0][0].priceMinKrw, 20_000);
  assert.equal(group.cells[0][1].priceMinKrw, 50_000);
  assert.equal(group.cells[0][2].priceMinKrw, 55_000);
  assert.equal(group.cells[0][3].priceMinKrw, null);
  assert.equal(group.cells[1][0].priceMinKrw, 30_000);
  assert.equal(group.cells[1][4].priceMinKrw, 80_000);
});

test("rows outside declared source axes remain preserved instead of becoming invented columns", () => {
  const document = createDirectPriceGuideSkeleton();
  const legacyRow = { ...document.rows[0], serviceName: "가위컷", priceMinKrw: 80_000, durationMinutes: 120 };
  const withLegacy = { ...document, rows: [...document.rows, legacyRow] };
  const next = updateDirectPriceGuideCell(withLegacy, 0, 0, 0, { priceMinKrw: 30_000, durationMinutes: 40 });
  assert.deepEqual(readDirectPriceGuideMatrix(next)[0].serviceNames, ["목욕", "부분미용", "전체미용", "스포팅"]);
  assert.equal(readPreservedPriceGuideRows(next).length, 1);
  assert.equal(readPreservedPriceGuideRows(next)[0].serviceName, "가위컷");
});

test("canonical service rows without a matching group or weight coordinate remain preserved", () => {
  const document = createDirectPriceGuideSkeleton();
  const orphanIndex = document.rows.length;
  const orphanRow = {
    ...document.rows[0],
    breedGroup: "기존 별도 요금",
    weightBandLabel: "99kg",
    minKg: null,
    maxKg: 99,
    priceMinKrw: 91_000,
    durationMinutes: 150,
  };
  const withOrphan = {
    ...document,
    rows: [...document.rows, orphanRow],
    aiReview: [{ targetId: `rows:${orphanIndex}`, field: "priceMinKrw", reason: "확인 필요", status: "unresolved" }],
  };
  const next = updateDirectPriceGuideCell(withOrphan, 0, 0, 0, { priceMinKrw: 30_000, durationMinutes: 40 });
  const preserved = readPreservedPriceGuideRows(next);
  assert.equal(preserved.length, 1);
  assert.equal(preserved[0].breedGroup, "기존 별도 요금");
  assert.equal(preserved[0].priceMinKrw, 91_000);
  assert.equal(next.aiReview[0].targetId, `rows:${next.rows.length - 1}`);
});

test("AI review keeps pointing at a fixed cell when its equivalent weight label is normalized", () => {
  const document = {
    schemaVersion: 2,
    source: "ai_imported",
    overallNote: null,
    tableGroups: [{ sourceLabel: "소형견", species: "dog", breedNames: [], sizeClass: "small", weightBands: [{ label: "2kg", minKg: null, maxKg: 2, note: null }], serviceNames: ["목욕"], note: null }],
    rows: [{ serviceName: "목욕", species: "dog", breedNames: [], breedGroup: "소형견", sizeClass: "small", minKg: null, maxKg: 2, weightBandLabel: "2kg 이하", priceKind: "fixed", priceMinKrw: 20_000, priceMaxKrw: null, durationMinutes: 40, note: null }],
    surcharges: [],
    aiReview: [{ targetId: "rows:0", field: "priceMinKrw", reason: "확인 필요", status: "unresolved" }],
  };
  const next = writeDirectPriceGuideMatrix(document, readDirectPriceGuideMatrix(document));
  assert.equal(next.rows[0].weightBandLabel, "2kg");
  assert.equal(next.aiReview[0].targetId, "rows:0");
});

test("direct, saved, and photo review share one service-column table with inline price and duration editing", async () => {
  const [manual, nativeTable, photo, structuredReview, detail, validator] = await Promise.all([
    readFile(new URL("../../src/components/owner-web/price-guide-manual-onboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/price-guide-native-inline-table.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/price-guide-photo-onboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/price-guide-structured-review-table.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/price-guide-v2-service-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/auth/signup-price-guide-editor.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(manual, /return createDirectPriceGuideSkeleton\(\)/);
  assert.match(manual, /manualMatrixMode \|\| photoEditing \? \([\s\S]*<PriceGuideNativeInlineTable[\s\S]*\) : \([\s\S]*<PriceGuideStructuredReviewTable/);
  assert.doesNotMatch(manual, /SignupPriceGuideEditor|mode="review"/);
  assert.doesNotMatch(manual, /PriceGuideRoughInputPanel|한 줄 메모로 초안 만들기|buildDefaultPriceGuideV2Draft|showExampleNotice/);
  for (const label of ["그룹 제목 입력", "품종 선택", "몸무게", "확인 필요", "체중 상한", "예상시간"]) {
    assert.match(nativeTable, new RegExp(label));
  }
  for (const label of ["대상 동물", "체급 분류", "가격 방식 선택", "메모 추가"]) {
    assert.doesNotMatch(nativeTable, new RegExp(label));
  }
  assert.match(nativeTable, /data-price-guide-breed-chips="true"/);
  assert.match(nativeTable, /PRICE_GUIDE_UI_HARD_CONTRACT: 16\/24 only; price left \+ duration right on one nowrap row/);
  assert.match(nativeTable, /data-price-guide-dynamic-service-ui="true"/);
  assert.match(nativeTable, /PriceGuideNativeInlineExtras/);
  assert.match(nativeTable, /data-price-left-time-right="true"/);
  assert.match(nativeTable, /data-price-side="left"/);
  assert.match(nativeTable, /data-duration-side="right"/);
  assert.match(nativeTable, /if \(row\.priceMinKrw === null\) return "미정"/);
  assert.match(nativeTable, /row\.durationMinutes === null \? "미정"/);
  assert.match(nativeTable, /data-price-guide-native-inline-table="true"/);
  assert.match(nativeTable, /const \[activeStructureField, setActiveStructureField\] = useState<string \| null>\(null\)/);
  assert.match(nativeTable, /renderedStructureField === titleId[\s\S]*<input id=\{titleId\}/);
  assert.match(nativeTable, /renderedStructureField === titleId \? \([\s\S]*<span[\s\S]*\) : \([\s\S]*<button id=\{titleId\}/);
  assert.match(nativeTable, /renderedStructureField === minPriceId[\s\S]*\? minPriceId/);
  assert.doesNotMatch(nativeTable, /firstIssueInputId \?\? activeField/);
  const combinedCellStart = nativeTable.indexOf("function PriceDurationInlineCell");
  const tableStart = nativeTable.indexOf("export default function PriceGuideNativeInlineTable");
  assert.ok(combinedCellStart >= 0 && tableStart > combinedCellStart);
  const combinedCell = nativeTable.slice(combinedCellStart, tableStart);
  assert.match(combinedCell, /const \[editing, setEditing\] = useState\(false\)/);
  assert.match(combinedCell, /data-price-guide-price-duration-cell=\{rowIndex\}/);
  assert.match(combinedCell, /data-price-guide-inline-edit="price-duration"/);
  assert.match(combinedCell, /grid-cols-\[minmax\(0,1fr\)_88px\]/);
  assert.match(combinedCell, /text-\[16px\] font-medium leading-6 tabular-nums/);
  assert.match(combinedCell, /truncate whitespace-nowrap text-\[16px\]/);
  assert.match(combinedCell, /min-w-0 whitespace-nowrap border-l/);
  assert.match(combinedCell, /className="sr-only">가격/);
  assert.match(combinedCell, /className="sr-only">예상시간/);
  assert.match(nativeTable, /data-price-guide-service-subheaders="true"/);
  assert.match(nativeTable, /items-center[^\n]*text-\[16px\] font-medium leading-6[^\n]*data-price-guide-service-subheaders="true"/);
  assert.doesNotMatch(nativeTable, /text-\[(?:12|14)px\]/);
  for (const field of ["priceKind", "priceMinKrw", "priceMaxKrw", "durationMinutes"]) {
    assert.match(combinedCell, new RegExp(field));
  }
  assert.match(combinedCell, /compactPriceDurationLabel\(row\)/);
  assert.doesNotMatch(nativeTable, /function PriceInlineCell|function DurationInlineCell|data-price-guide-price-cell|data-price-guide-duration-cell/);
  assert.match(nativeTable, /<PriceDurationInlineCell[\s\S]*onEditStart=\{startIndependentCellEdit\}/);
  assert.match(nativeTable, /addDirectPriceGuideService/);
  assert.match(nativeTable, /removeDirectPriceGuideService/);
  assert.match(nativeTable, /updateDirectPriceGuideService/);
  assert.match(nativeTable, /<Plus className="h-4 w-4" aria-hidden="true" \/>그룹/);
  assert.match(nativeTable, /addDirectPriceGuideWeightBand\(guide, groupIndex\)[\s\S]*<Plus className="h-4 w-4" aria-hidden="true" \/>몸무게/);
  assert.match(nativeTable, /removeDirectPriceGuideWeightBand\(guide, groupIndex, weightIndex\)/);
  assert.match(nativeTable, /max-h-\[min\(62dvh,680px\)\][^"\n]*overflow-auto/);
  assert.match(nativeTable, /<thead className="sticky top-0 z-30"/);
  assert.match(nativeTable, /className="sticky left-0 top-0 z-40[^\n]*">몸무게/);
  assert.match(nativeTable, /group\.serviceNames\.length \* 210/);
  assert.match(nativeTable, /서비스명 입력/);
  assert.match(nativeTable, /unavailableBreeds=/);
  assert.match(nativeTable, /data-price-guide-preserved-review="true"/);
  assert.match(nativeTable, /<label htmlFor=\{minWeightId\} className="sr-only">체중 하한<\/label>[\s\S]*<label htmlFor=\{maxWeightId\} className="sr-only">체중 상한<\/label>/);
  assert.match(nativeTable, /className="sticky left-0 z-20[^\n]*>[\s\S]*data-price-guide-weight-limit/);
  assert.match(nativeTable, /min-h-11|h-11/);
  assert.doesNotMatch(nativeTable, /한 줄 메모로 초안 만들기|요금 행|이 그룹 편집/);
  assert.doesNotMatch(photo, /capture="environment"|카메라로 촬영|captureRef/);
  assert.match(photo, /type="file"[\s\S]*accept="image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(photo, /\bmultiple\b|최대 5장/);
  assert.match(photo, /data-price-guide-photo-preview="selected"[\s\S]*object-contain[\s\S]*사진 바꾸기/);
  assert.match(photo, /setEditorMode\("photo-review"\)[\s\S]*setMode\("manual"\)/);
  assert.match(structuredReview, /data-price-guide-structured-review="true"/);
  assert.doesNotMatch(structuredReview, /사진에서 읽은 요금표/);
  assert.match(structuredReview, /data-price-guide-group-edit-action=\{groupIndex\}/);
  assert.match(structuredReview, /aria-label=\{`\$\{group\.label\} 요금표 수정`\}/);
  assert.match(structuredReview, /space-y-4/);
  assert.match(detail, /setEditingTarget\(\{ kind: "group", groupIndex \}\)/);
  assert.match(detail, /visibleGroupIndex=\{editingTarget\?\.kind === "group" \? editingTarget\.groupIndex : undefined\}/);
  assert.match(nativeTable, /visibleGroupIndex !== undefined && groupIndex !== visibleGroupIndex/);
  assert.match(detail, /<PriceGuideNativeInlineTable[\s\S]*document=\{draft\}[\s\S]*onChange=\{updateDraft\}/);
  assert.doesNotMatch(detail, /MatrixGroupCard|EditableMatrixGroup|이 그룹 편집|PencilLine/);
  assert.match(detail, /const saved = await onSave\(draft\)/);
  assert.match(validator, /document\.source === "manual"[\s\S]*tableGroups:\$\{groupIndex\}\.sourceLabel[\s\S]*price-guide-direct-group-\$\{groupIndex\}-species/);
  assert.match(validator, /if \(!row\.serviceName\?\.trim\(\)\)[\s\S]*if \(row\.priceKind === "unknown" && \(!options\.photoTable \|\| row\.priceMinKrw === null\)\)[\s\S]*if \(!isConfirmedPriceGuideDuration\(row\.durationMinutes\)\)/);
  const saveGuardStart = manual.indexOf("const saveDraft = useCallback");
  const saveGuardEnd = manual.indexOf("const saveDraftRef", saveGuardStart);
  const saveGuard = manual.slice(saveGuardStart, saveGuardEnd);
  assert.ok(saveGuardStart >= 0 && saveGuardEnd > saveGuardStart);
  assert.ok(saveGuard.indexOf("if (draftIssues.length > 0)") < saveGuard.indexOf("onSave(draft)"));
  assert.equal((saveGuard.match(/onSave\(draft\)/g) ?? []).length, 1);
});

test("the six-photo review artifact uses the same 16px inline price-time layout", async () => {
  const reviewArtifact = await readFile(new URL("../../evidence/PM_AI_PRICE_GUIDE_PHOTO_CAPTURE_AUTOMATION_20260904/r102/dynamic-matrix-review.html", import.meta.url), "utf8");
  const overrideStart = reviewArtifact.indexOf('<style id="price-time-inline-typography-fix">');
  const overrideEnd = reviewArtifact.indexOf("</style>", overrideStart);
  assert.ok(overrideStart >= 0 && overrideEnd > overrideStart);
  const override = reviewArtifact.slice(overrideStart, overrideEnd);
  assert.match(override, /grid-template-columns:minmax\(0,1fr\) 96px/);
  assert.match(override, /font-size:16px;line-height:24px/);
  assert.match(override, /white-space:nowrap/);
  assert.doesNotMatch(override, /flex-direction:column|font-size:(?:12|14|15)px/);
});

test("breed management keeps duplicate protection and exposes a clear custom breed path", async () => {
  const dialogs = await readFile(new URL("../../src/components/owner-web/service-price-guide-group-dialogs.tsx", import.meta.url), "utf8");
  const breedDialog = dialogs.slice(dialogs.indexOf("export function BreedManagementDialog"));
  assert.match(breedDialog, /data-price-guide-custom-breed="true"/);
  assert.match(breedDialog, /customBreedMode \? "기타 품종명" : "추가할 품종"/);
  assert.match(breedDialog, /customBreedMode \? "원하는 품종 입력" : "품종 검색 또는 입력"/);
  assert.match(breedDialog, /duplicateBreed \|\| assignedElsewhere/);
  assert.match(breedDialog, /normalizedBreedKey\(breed\) === normalizedBreedKey\(trimmedBreedName\)/);
  assert.match(breedDialog, /text-\[16px\][^"\n]*font-medium[^"\n]*leading-6/);
  assert.doesNotMatch(breedDialog, /다른 분류에 배정된 품종은 여기에서 선택할 수 없습니다/);
});
