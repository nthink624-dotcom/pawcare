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
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`].find((path) => existsSync(path));
    if (!candidate) return nextResolve(specifier, context);
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  },
});

const entryPath = new URL("../../src/components/customer/customer-booking-entry-page.tsx", import.meta.url);
const fullGuidePath = new URL("../../src/components/customer/customer-full-price-guide.tsx", import.meta.url);
const { readDirectPriceGuideMatrix } = await import("../../src/lib/price-guide-direct-matrix.ts");

function canonicalDocument() {
  return {
    schemaVersion: 2,
    source: "owner_confirmed",
    overallNote: "모량과 피부 상태에 따라 최종 요금이 달라질 수 있습니다.",
    tableGroups: [{
      sourceLabel: "특수견",
      species: "dog",
      breedNames: ["비숑", "베들링턴테리어"],
      sizeClass: "medium",
      weightBands: [{ label: "8kg 이하", minKg: null, maxKg: 8, note: null }],
      serviceNames: ["목욕", "스포팅"],
      note: "특수견 요금",
    }],
    rows: [
      {
        sourceItemId: "pgi-bath",
        serviceName: "목욕",
        species: "dog",
        breedNames: ["비숑", "베들링턴테리어"],
        breedGroup: "특수견",
        sizeClass: "medium",
        minKg: null,
        maxKg: 8,
        weightBandLabel: "8kg 이하",
        priceKind: "fixed",
        priceMinKrw: 35_000,
        priceMaxKrw: null,
        durationMinutes: 60,
        note: null,
      },
      {
        sourceItemId: "pgi-spotting",
        serviceName: "스포팅",
        species: "dog",
        breedNames: ["비숑", "베들링턴테리어"],
        breedGroup: "특수견",
        sizeClass: "medium",
        minKg: null,
        maxKg: 8,
        weightBandLabel: "8kg 이하",
        priceKind: "starting",
        priceMinKrw: 70_000,
        priceMaxKrw: null,
        durationMinutes: null,
        note: "모량에 따라 상담",
      },
    ],
    surcharges: [{ condition: "털 엉킴", amountKrw: 10_000, percent: null, note: "상태에 따라 적용" }],
    aiReview: [{
      targetId: "rows:1",
      field: "durationMinutes",
      rawText: "내부 OCR 기록",
      confidence: "medium",
      userConfirmed: true,
      userCorrected: false,
    }],
  };
}

test("customer full price sheet uses canonical V2 while the summary service picker stays unchanged", async () => {
  const [entry, fullGuide] = await Promise.all([
    readFile(entryPath, "utf8"),
    readFile(fullGuidePath, "utf8"),
  ]);

  assert.match(entry, /const canonicalPriceGuide = useMemo/);
  assert.match(entry, /readCanonicalPriceGuide\(service\.price_guide\)/);
  assert.match(entry, /canonicalPriceGuide \? \([\s\S]*<CustomerFullPriceGuide document=\{canonicalPriceGuide\}/);
  assert.match(entry, /\) : serviceOptions\.length > 0 \? \([\s\S]*serviceOptions\.map\(\(service\) =>/);
  assert.match(entry, /<CustomerEntryServicePicker[\s\S]*services=\{serviceOptions\}[\s\S]*onSelect=\{setSelectedServiceOptionId\}/);
  assert.doesNotMatch(fullGuide, /serviceOptions|CustomerEntryServicePicker/);

  for (const field of [
    "group.sourceLabel",
    "group.breedNames",
    "group.serviceNames",
    "group.weightBands",
    "group.cells",
    "row.priceMinKrw",
    "row.priceMaxKrw",
    "row.durationMinutes",
    "document.surcharges",
    "document.overallNote",
  ]) {
    assert.match(fullGuide, new RegExp(field.replaceAll(".", "\\.")));
  }
  assert.doesNotMatch(fullGuide, /aiReview|rawText|source:|편집|수정|검토 상태/);
});

test("canonical projection preserves group, breeds, dynamic services, weight, price, duration and extras without inventing values", () => {
  const document = canonicalDocument();
  const groups = readDirectPriceGuideMatrix(document);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].sourceLabel, "특수견");
  assert.deepEqual(groups[0].breedNames, ["비숑", "베들링턴테리어"]);
  assert.deepEqual(groups[0].serviceNames, ["목욕", "스포팅"]);
  assert.equal(groups[0].weightBands[0].label, "8kg 이하");
  assert.equal(groups[0].cells[0][0].priceMinKrw, 35_000);
  assert.equal(groups[0].cells[0][0].durationMinutes, 60);
  assert.equal(groups[0].cells[0][1].priceMinKrw, 70_000);
  assert.equal(groups[0].cells[0][1].durationMinutes, null);
  assert.deepEqual(document.surcharges, [{ condition: "털 엉킴", amountKrw: 10_000, percent: null, note: "상태에 따라 적용" }]);
  assert.equal(document.overallNote, "모량과 피부 상태에 따라 최종 요금이 달라질 수 있습니다.");
});

test("customer price sheet combines price and time while locking compact contained-scroll typography", async () => {
  const fullGuide = await readFile(fullGuidePath, "utf8");

  assert.match(fullGuide, /PRICE_GUIDE_UI_HARD_CONTRACT/);
  assert.match(fullGuide, /data-customer-price-guide-table-scroll="true"/);
  assert.match(fullGuide, /overflow-x-auto overflow-y-hidden/);
  assert.match(fullGuide, /function formatPriceTime\(row: PriceGuideV2Row \| undefined\)/);
  assert.match(fullGuide, /`\$\{row \? formatPrice\(row\) : "미정"\} \/ \$\{row \? formatDuration\(row\) : "미정"\}`/);
  assert.match(fullGuide, /data-customer-price-time-inline="true"/);
  assert.match(fullGuide, /group\.serviceNames\.length \* 160/);
  assert.match(fullGuide, /min-w-\[160px\] max-w-\[200px\] whitespace-normal break-words/);
  assert.match(fullGuide, /whitespace-nowrap text-\[16px\] font-normal leading-6/);
  assert.match(fullGuide, /text-\[20px\] font-semibold leading-7/);
  assert.match(fullGuide, /text-\[18px\] font-normal leading-\[26px\]/);
  assert.doesNotMatch(fullGuide, />\s*(?:가격|예상시간)\s*</);
  assert.doesNotMatch(fullGuide, /data-price-side|data-duration-side|grid-cols-\[minmax\(132px,1fr\)_88px\]|border-l border-\[#e2e8f0\]/);
  assert.doesNotMatch(fullGuide, /text-\[(?:12|14)px\]|font-(?:bold|extrabold|black)/);
});

test("customer price sheet uses a roughly 88dvh mobile shell with a fixed header and body-only scrolling", async () => {
  const entry = await readFile(entryPath, "utf8");

  assert.match(entry, /\.pm-entry-proto \.customer-price-sheet\{display:flex;height:88%;max-height:calc\(100% - 12px\);flex-direction:column\}/);
  assert.match(entry, /@media \(min-width:640px\)\{\.pm-entry-proto \.customer-price-sheet\{height:auto;max-height:82vh\}/);
  assert.match(entry, /\.customer-price-sheet-header\{flex:0 0 auto\}/);
  assert.match(entry, /\.customer-price-sheet-body\{min-height:0;flex:1 1 auto;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;padding-bottom:max\(20px,env\(safe-area-inset-bottom\)\)\}/);
  assert.match(entry, /data-customer-price-sheet-header="fixed"[\s\S]*aria-label="요금표 닫기"[\s\S]*<div className="customer-price-sheet-body px-5" data-customer-price-sheet-body="scroll-only">/);
  assert.match(entry, /aria-label="요금표 닫기"[\s\S]{0,180}className="h-4\.5 w-4\.5"/);
  assert.match(entry, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="customer-price-sheet-title"/);
  assert.match(entry, /if \(!priceSheetOpen\) return;[\s\S]*priceSheetCloseButtonRef\.current\?\.focus\(\)[\s\S]*event\.key !== "Escape"[\s\S]*setPriceSheetOpen\(false\)/);
  assert.match(entry, /document\.body\.style\.overflow = "hidden"[\s\S]*document\.documentElement\.style\.overflow = "hidden"[\s\S]*pageScroller\.style\.overflow = "hidden"/);
  assert.match(entry, /document\.body\.style\.overflow = previousBodyOverflow[\s\S]*document\.documentElement\.style\.overflow = previousDocumentOverflow[\s\S]*previouslyFocused\?\.focus\(\)/);
  assert.doesNotMatch(entry, /className="max-h-\[82vh\] w-full max-w-\[430px\]/);
});
