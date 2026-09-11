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
  removeDirectPriceGuideGroup,
  removeDirectPriceGuideService,
  removeDirectPriceGuideWeightBand,
  updateDirectPriceGuideCell,
  updateDirectPriceGuideGroup,
  updateDirectPriceGuideService,
  updateDirectPriceGuideWeightBand,
} = await import("../../src/lib/price-guide-direct-matrix.ts");

test("direct registration starts with the shared 2, 4, 6, and 8kg upper-limit grid and no invented price or time", () => {
  const document = createDirectPriceGuideSkeleton();
  const groups = readDirectPriceGuideMatrix(document);

  assert.equal(document.source, "manual");
  assert.deepEqual(groups.map((group) => group.sourceLabel), ["베이직", "플러스", "프리미엄"]);
  for (const group of groups) {
    assert.equal(group.species, "dog");
    assert.equal(group.sizeClass, "all");
    assert.deepEqual(group.breedNames, []);
    assert.deepEqual(group.serviceNames, ["목욕", "전체 미용", "부분 미용", "스포팅"]);
    assert.deepEqual(group.weightBands.map((band) => [band.label, band.minKg, band.maxKg]), [
      ["2kg 미만", null, 2],
      ["4kg 미만", null, 4],
      ["6kg 미만", null, 6],
      ["8kg 미만", null, 8],
    ]);
  }
  assert.equal(document.rows.length, 48);
  assert.equal(document.rows.every((row) => (
    ["목욕", "전체 미용", "부분 미용", "스포팅"].includes(row.serviceName)
    && ["베이직", "플러스", "프리미엄"].includes(row.breedGroup)
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
    sourceLabel: "베이직 수정",
    species: "dog",
    sizeClass: "small",
    breedNames: ["말티즈", "푸들"],
  });
  document = updateDirectPriceGuideService(document, 0, 0, "클리핑");
  document = updateDirectPriceGuideWeightBand(document, 0, 1, { minKg: 2, maxKg: 5 });
  document = updateDirectPriceGuideCell(document, 0, 1, 0, {
    priceKind: "range",
    priceMinKrw: 50_000,
    priceMaxKrw: 60_000,
    durationMinutes: 90,
    note: "모량에 따라 달라요",
  });

  assert.deepEqual(document.tableGroups[0].serviceNames, ["클리핑", "전체 미용", "부분 미용", "스포팅"]);
  assert.equal(document.tableGroups[0].weightBands[1].label, "2~5kg");
  assert.deepEqual(document.rows[4], {
    serviceName: "클리핑",
    species: "dog",
    breedNames: ["말티즈", "푸들"],
    breedGroup: "베이직 수정",
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

  document = addDirectPriceGuideService(document, 0);
  document = updateDirectPriceGuideService(document, 0, 4, "가위컷");
  document = addDirectPriceGuideWeightBand(document, 0);
  document = updateDirectPriceGuideWeightBand(document, 0, 4, { minKg: 8, maxKg: 10 });
  let groups = readDirectPriceGuideMatrix(document);
  assert.equal(groups[0].serviceNames.length, 5);
  assert.equal(groups[0].weightBands.length, 5);
  assert.equal(document.rows.length, 57);
  assert.equal(directPriceGuideRowIndex(groups, 0, 4, 4), 24);
  assert.equal(document.rows[24].serviceName, "가위컷");
  assert.equal(document.rows[24].weightBandLabel, "8~10kg");
  assert.equal(document.rows[24].priceMinKrw, null);

  document = addDirectPriceGuideGroup(document);
  groups = readDirectPriceGuideMatrix(document);
  assert.equal(groups.length, 4);
  assert.equal(document.rows.length, 61);
  document = removeDirectPriceGuideService(document, 0, 4);
  document = removeDirectPriceGuideWeightBand(document, 0, 4);
  document = removeDirectPriceGuideGroup(document, 3);
  groups = readDirectPriceGuideMatrix(document);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].serviceNames.length, 4);
  assert.equal(groups[0].weightBands.length, 4);
  assert.equal(document.rows.length, 48);
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

test("photo table cells bind by explicit group, weight, and service coordinates instead of row position", () => {
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
      serviceNames: ["목욕", "전체 미용"],
      note: null,
    }],
    rows: [
      { ...base, serviceName: "전체 미용", priceMinKrw: 50_000 },
      { ...base, serviceName: "목욕", minKg: 2, maxKg: 5, weightBandLabel: "2~5kg", priceMinKrw: 30_000 },
      { ...base, serviceName: "목욕", priceMinKrw: 20_000 },
    ],
    surcharges: [],
    aiReview: [],
  };
  const [group] = readDirectPriceGuideMatrix(document);

  assert.equal(group.cells[0][0].priceMinKrw, 20_000);
  assert.equal(group.cells[0][1].priceMinKrw, 50_000);
  assert.equal(group.cells[1][0].priceMinKrw, 30_000);
  assert.equal(group.cells[1][1].priceMinKrw, null);
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
  for (const label of ["그룹 제목 입력", "품종 입력", "항목명 입력", "가격 입력", "시간 입력", "체중 상한", "예상시간"]) {
    assert.match(nativeTable, new RegExp(label));
  }
  for (const label of ["대상 동물", "체급 분류", "가격 방식 선택", "메모 추가"]) {
    assert.doesNotMatch(nativeTable, new RegExp(label));
  }
  assert.match(nativeTable, /data-price-guide-breed-chips="true"/);
  assert.match(nativeTable, /data-price-guide-fixed-price-ui="true"/);
  assert.doesNotMatch(nativeTable, /PriceGuideNativeInlineExtras/);
  assert.match(nativeTable, /data-price-guide-native-inline-table="true"/);
  assert.match(nativeTable, /const \[activeStructureField, setActiveStructureField\] = useState<string \| null>\(null\)/);
  assert.match(nativeTable, /renderedStructureField === titleId[\s\S]*<input id=\{titleId\}[\s\S]*<button id=\{titleId\}/);
  assert.doesNotMatch(nativeTable, /firstIssueInputId \?\? activeField/);
  const combinedCellStart = nativeTable.indexOf("function PriceDurationInlineCell");
  const tableStart = nativeTable.indexOf("export default function PriceGuideNativeInlineTable");
  assert.ok(combinedCellStart >= 0 && tableStart > combinedCellStart);
  const combinedCell = nativeTable.slice(combinedCellStart, tableStart);
  assert.match(combinedCell, /const \[editing, setEditing\] = useState\(false\)/);
  assert.match(combinedCell, /data-price-guide-price-duration-cell=\{rowIndex\}/);
  assert.match(combinedCell, /data-price-guide-inline-edit="price-duration"/);
  assert.match(combinedCell, /grid-cols-\[minmax\(0,1fr\)_88px\]/);
  for (const field of ["priceKind", "priceMinKrw", "priceMaxKrw", "durationMinutes"]) {
    assert.match(combinedCell, new RegExp(field));
  }
  assert.match(combinedCell, /\{priceLabel\(row\)\} \/ \{row\.durationMinutes === null \? "시간 입력" : `\$\{row\.durationMinutes\}분`\}/);
  assert.doesNotMatch(nativeTable, /function PriceInlineCell|function DurationInlineCell|data-price-guide-price-cell|data-price-guide-duration-cell/);
  assert.match(nativeTable, /<PriceDurationInlineCell[\s\S]*onEditStart=\{startIndependentCellEdit\}/);
  assert.match(nativeTable, /<Plus className="h-4 w-4" aria-hidden="true" \/>항목/);
  assert.match(nativeTable, /<Plus className="h-4 w-4" aria-hidden="true" \/>그룹/);
  assert.doesNotMatch(nativeTable, /<Plus className="h-4 w-4" aria-hidden="true" \/>체급|체급 삭제/);
  assert.match(nativeTable, /max-h-\[min\(62dvh,680px\)\][^"\n]*overflow-auto/);
  assert.match(nativeTable, /<thead className="sticky top-0 z-30"/);
  assert.match(nativeTable, /className="sticky left-0 top-0 z-40[^\n]*">체중 상한/);
  assert.match(nativeTable, /className="sticky left-0 z-20[^\n]*>[\s\S]*data-price-guide-weight-limit/);
  assert.match(nativeTable, /min-h-11|h-11/);
  assert.doesNotMatch(nativeTable, /한 줄 메모로 초안 만들기|요금 행|이 그룹 편집/);
  assert.doesNotMatch(photo, /capture="environment"|카메라로 촬영|captureRef/);
  assert.match(photo, /type="file"[\s\S]*accept="image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(photo, /\bmultiple\b|최대 5장/);
  assert.match(photo, /data-price-guide-photo-preview="selected"[\s\S]*object-contain[\s\S]*사진 바꾸기/);
  assert.match(photo, /setEditorMode\("photo-review"\)[\s\S]*setMode\("manual"\)/);
  assert.match(structuredReview, /data-price-guide-structured-review="true"/);
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
