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
  applyConfiguredCustomerServiceOverrides,
  buildCustomerServiceSourceOptions,
  sanitizeCustomerServiceOverridesForSourceOptions,
} = await import("../../src/lib/customer-service-options.ts");
const { ensurePriceGuideV2SourceItemIds } = await import("../../src/types/price-guide-photo-import.ts");

const ownerPriceGuidePath = new URL("../../src/components/owner-web/service-price-guide.tsx", import.meta.url);
const ownerPriceGuideDetailPath = new URL("../../src/components/owner-web/price-guide-v2-service-detail.tsx", import.meta.url);
const nativePriceGuideTablePath = new URL("../../src/components/owner-web/price-guide-native-inline-table.tsx", import.meta.url);
const nativePriceGuideExtrasPath = new URL("../../src/components/owner-web/price-guide-native-inline-extras.tsx", import.meta.url);
const structuredPriceGuidePath = new URL("../../src/lib/price-guide-structured-table.ts", import.meta.url);
const serviceManagementPath = new URL("../../src/components/owner-web/service-management-screen.tsx", import.meta.url);
const priceGuideChoicePath = new URL("../../src/components/owner-web/price-guide-onboarding-choice.tsx", import.meta.url);
const priceGuideOnboardingPath = new URL("../../src/components/owner-web/price-guide-photo-onboarding.tsx", import.meta.url);
const customerExposurePath = new URL("../../src/components/owner-web/customer-service-exposure-panel.tsx", import.meta.url);
const customerPageManagementPath = new URL("../../src/components/owner-web/customer-booking-page-management-screen.tsx", import.meta.url);
const ownerShopsRoutePath = new URL("../../src/app/api/owner/shops/route.ts", import.meta.url);
const ownerMutationsPath = new URL("../../src/server/owner-mutations.ts", import.meta.url);
const customerEntryPath = new URL("../../src/components/customer/customer-booking-entry-page.tsx", import.meta.url);
const customerManagePath = new URL("../../src/components/customer/customer-booking-manage-panel.tsx", import.meta.url);
const customerBookingPagePath = new URL("../../src/components/customer/customer-booking-page.tsx", import.meta.url);
const customerBookingsServerPath = new URL("../../src/server/customer-bookings.ts", import.meta.url);
const customerDiscountQuotePath = new URL("../../src/server/customer-discount-quote.ts", import.meta.url);
const mockDataPath = new URL("../../src/lib/mock-data.ts", import.meta.url);

function priceGuideV2() {
  return {
    schemaVersion: 2,
    source: "owner_confirmed",
    overallNote: "모량에 따라 현장 상담 후 달라질 수 있습니다.",
    rows: [
      {
        serviceName: "소형 목욕",
        species: "dog",
        breedNames: ["말티즈", "토이푸들"],
        breedGroup: "소형견",
        sizeClass: "small",
        minKg: null,
        maxKg: 5,
        priceKind: "fixed",
        priceMinKrw: 30_000,
        priceMaxKrw: null,
        durationMinutes: 45,
        note: "기본 목욕",
      },
      {
        serviceName: "중형 미용",
        species: "dog",
        breedNames: ["코커스패니얼"],
        breedGroup: "중형견",
        sizeClass: "medium",
        minKg: 5,
        maxKg: 12,
        priceKind: "starting",
        priceMinKrw: 55_000,
        priceMaxKrw: null,
        durationMinutes: 90,
        note: null,
      },
      {
        serviceName: "대형 미용",
        species: "dog",
        breedNames: ["골든리트리버"],
        breedGroup: "대형견",
        sizeClass: "large",
        minKg: 12,
        maxKg: 25,
        priceKind: "range",
        priceMinKrw: 80_000,
        priceMaxKrw: 120_000,
        durationMinutes: 150,
        note: "모량에 따라 범위 적용",
      },
    ],
    surcharges: [
      { condition: "털 엉킴", amountKrw: 5_000, percent: null, note: "시작 금액" },
      { condition: "주말", amountKrw: null, percent: 10, note: null },
    ],
    aiReview: [
      {
        targetId: "rows:2",
        field: "priceMaxKrw",
        rawText: "80,000~120,000",
        confidence: "medium",
        userConfirmed: false,
        userCorrected: true,
      },
    ],
  };
}

function serviceFromRow(document, index) {
  const row = document.rows[index];
  return {
    id: `service-${index + 1}`,
    shop_id: "shop-1",
    name: row.serviceName,
    price: row.priceMinKrw,
    price_type: row.priceKind === "fixed" ? "fixed" : "starting",
    duration_minutes: row.durationMinutes,
    is_active: true,
    category: "미용",
    description: row.note ?? "",
    sort_order: index + 1,
    capacity_label: "동일 시간 1건",
    staff_selection_mode: "all",
    price_guide: document,
    created_at: "2026-08-30T00:00:00.000Z",
    updated_at: "2026-08-30T00:00:00.000Z",
  };
}

test("customer service projection reads each canonical V2 row once without N-squared duplicates", () => {
  const document = priceGuideV2();
  const services = document.rows.map((_, index) => serviceFromRow(document, index));
  const options = buildCustomerServiceSourceOptions(services);

  assert.equal(options.length, 3);
  assert.deepEqual(
    options.map((option) => ({
      name: option.displayName,
      price: option.price,
      priceType: option.priceType,
      duration: option.durationMinutes,
      weightBand: option.weightBand,
    })),
    [
      { name: "소형 목욕", price: 30_000, priceType: "fixed", duration: 45, weightBand: "5kg 이하" },
      { name: "중형 미용", price: 55_000, priceType: "starting", duration: 90, weightBand: "5~12kg" },
      { name: "대형 미용", price: 80_000, priceType: "starting", duration: 150, weightBand: "12~25kg" },
    ],
  );
  assert.match(options[0].description, /말티즈, 토이푸들/);
  assert.match(options[2].description, /모량에 따라 범위 적용/);
});

test("one stored canonical carrier projects every complete detailed row", () => {
  const document = priceGuideV2();
  const carrier = serviceFromRow(document, 0);
  const options = buildCustomerServiceSourceOptions([carrier]);

  assert.equal(options.length, 3);
  assert.deepEqual(options.map((option) => option.displayName), ["소형 목욕", "중형 미용", "대형 미용"]);
  assert.ok(options.every((option) => option.serviceId === carrier.id));
  assert.ok(options.every((option) => option.id.startsWith(`${carrier.id}:price-guide-v2:pgi_`)));
  assert.equal(new Set(options.map((option) => option.id)).size, 3);
});

test("canonical V2 weight selection uses exact kg bounds and never falls back to the service summary", () => {
  const document = priceGuideV2();
  const services = document.rows.map((_, index) => serviceFromRow(document, index));
  const options = buildCustomerServiceSourceOptions(services, { weightKg: 15 });

  assert.equal(options.length, 1);
  assert.equal(options[0].displayName, "대형 미용");
  assert.equal(options[0].price, 80_000);
  assert.equal(options[0].durationMinutes, 150);

  const incomplete = structuredClone(document);
  incomplete.rows[0].priceKind = "unknown";
  incomplete.rows[0].priceMinKrw = null;
  const incompleteService = { ...serviceFromRow(document, 0), price_guide: incomplete };
  assert.deepEqual(
    buildCustomerServiceSourceOptions([incompleteService]).map((option) => option.displayName),
    ["중형 미용", "대형 미용"],
  );

  const missingDuration = structuredClone(document);
  missingDuration.rows[2].durationMinutes = null;
  assert.deepEqual(
    buildCustomerServiceSourceOptions([{ ...serviceFromRow(document, 0), price_guide: missingDuration }], { weightKg: 15 }),
    [],
  );
});

test("legacy and standalone service values never become customer price rows", () => {
  const legacyService = {
    id: "legacy-service",
    shop_id: "shop-1",
    name: "기존 미용",
    price: 45_000,
    price_type: "fixed",
    duration_minutes: 60,
    is_active: true,
    category: "미용",
    description: "",
    sort_order: 1,
    capacity_label: "동일 시간 1건",
    staff_selection_mode: "all",
    price_guide: {
      enabled: true,
      sections: [{
        id: "legacy-small",
        species: "dog",
        title: "소형견",
        note: "말티즈",
        weightBands: ["5kg 이하"],
        items: [{
          id: "legacy-cut",
          label: "전체 미용",
          cells: { "5kg 이하": { price: "45000", durationMinutes: "60" } },
        }],
      }],
      extraNote: "",
      extraFees: [],
    },
    created_at: "2026-08-30T00:00:00.000Z",
    updated_at: "2026-08-30T00:00:00.000Z",
  };

  assert.deepEqual(buildCustomerServiceSourceOptions([legacyService]), []);
  assert.deepEqual(buildCustomerServiceSourceOptions([{ ...legacyService, price_guide: {} }]), []);
});

test("customer exposure stores only live source linkage and follows canonical edits", () => {
  const document = ensurePriceGuideV2SourceItemIds(priceGuideV2());
  const carrier = serviceFromRow(document, 0);
  const originalOptions = buildCustomerServiceSourceOptions([carrier]);
  const linkedOption = originalOptions[0];
  const requested = {
    "customer-row": {
      visible: true,
      order: 2,
      linkedOptionId: linkedOption.id,
      displayName: "복사된 이름",
      price: 1,
      durationMinutes: 1,
    },
    stale: { visible: true, linkedOptionId: "missing-source" },
    duplicate: { visible: true, linkedOptionId: linkedOption.id },
  };

  assert.deepEqual(sanitizeCustomerServiceOverridesForSourceOptions(requested, originalOptions), {
    [linkedOption.id]: { visible: true, order: 2, linkedOptionId: linkedOption.id },
  });

  const configuredOriginal = applyConfiguredCustomerServiceOverrides(originalOptions, requested);
  assert.equal(configuredOriginal.length, 1);
  assert.equal(configuredOriginal[0].price, 30_000);
  assert.equal(configuredOriginal[0].durationMinutes, 45);

  const editedDocument = structuredClone(document);
  editedDocument.rows[0].priceMinKrw = 91_000;
  editedDocument.rows[0].durationMinutes = 135;
  const editedOptions = buildCustomerServiceSourceOptions([{ ...carrier, price_guide: editedDocument }]);
  const configuredEdited = applyConfiguredCustomerServiceOverrides(editedOptions, requested);
  assert.equal(configuredEdited.length, 1);
  assert.equal(configuredEdited[0].id, linkedOption.id);
  assert.equal(configuredEdited[0].price, 91_000);
  assert.equal(configuredEdited[0].durationMinutes, 135);

  const renamedDocument = structuredClone(document);
  renamedDocument.rows[0].serviceName = "소형 스파 목욕";
  const renamedOptions = buildCustomerServiceSourceOptions([{ ...carrier, price_guide: renamedDocument }]);
  const configuredRenamed = applyConfiguredCustomerServiceOverrides(renamedOptions, requested);
  assert.equal(configuredRenamed.length, 1);
  assert.equal(configuredRenamed[0].id, linkedOption.id);
  assert.equal(configuredRenamed[0].displayName, "소형 스파 목욕");

  const deletedDocument = structuredClone(document);
  deletedDocument.rows.splice(0, 1);
  const deletedOptions = buildCustomerServiceSourceOptions([{ ...carrier, price_guide: deletedDocument }]);
  assert.deepEqual(applyConfiguredCustomerServiceOverrides(deletedOptions, requested), []);

  assert.deepEqual(applyConfiguredCustomerServiceOverrides([], requested), []);
});

test("owner V2 detail renders its native inline table and explicit save refetches canonical services", async () => {
  const [
    priceGuide,
    detail,
    nativeTable,
    nativeExtras,
    structuredPriceGuide,
    serviceManagement,
    mockData,
    choice,
    onboarding,
    exposure,
    customerPageManagement,
    ownerShopsRoute,
    ownerMutations,
    customerEntry,
    customerManage,
    customerBookingPage,
    customerBookingsServer,
    customerDiscountQuote,
  ] = await Promise.all([
    readFile(ownerPriceGuidePath, "utf8"),
    readFile(ownerPriceGuideDetailPath, "utf8"),
    readFile(nativePriceGuideTablePath, "utf8"),
    readFile(nativePriceGuideExtrasPath, "utf8"),
    readFile(structuredPriceGuidePath, "utf8"),
    readFile(serviceManagementPath, "utf8"),
    readFile(mockDataPath, "utf8"),
    readFile(priceGuideChoicePath, "utf8"),
    readFile(priceGuideOnboardingPath, "utf8"),
    readFile(customerExposurePath, "utf8"),
    readFile(customerPageManagementPath, "utf8"),
    readFile(ownerShopsRoutePath, "utf8"),
    readFile(ownerMutationsPath, "utf8"),
    readFile(customerEntryPath, "utf8"),
    readFile(customerManagePath, "utf8"),
    readFile(customerBookingPagePath, "utf8"),
    readFile(customerBookingsServerPath, "utf8"),
    readFile(customerDiscountQuotePath, "utf8"),
  ]);

  assert.match(priceGuide, /priceGuideV2Schema\.safeParse\(value\)/);
  assert.match(priceGuide, /buildPriceGuideV2Compatibility\(canonicalV2\)\.guide/);
  assert.match(priceGuide, /return normalized\.canonicalV2 \?\? normalized/);
  assert.match(priceGuide, /import PriceGuideV2ServiceDetail/);
  assert.match(priceGuide, /<PriceGuideV2ServiceDetail/);
  assert.match(priceGuide, /document=\{guide\.canonicalV2\}/);
  assert.match(priceGuide, /saveImmediately: true/);
  assert.doesNotMatch(priceGuide, /ServicePriceGuideV2View/);

  for (const field of [
    "document.rows",
    "row.breedNames",
    "row.breedGroup",
    "row.sizeClass",
    "row.minKg",
    "row.maxKg",
    "row.priceKind",
    "row.priceMinKrw",
    "row.priceMaxKrw",
    "row.durationMinutes",
    "document.overallNote",
    "document.surcharges",
  ]) {
    assert.match(`${detail}\n${nativeTable}\n${nativeExtras}\n${structuredPriceGuide}`, new RegExp(field.replaceAll(".", "\\.")));
  }
  assert.match(detail, /data-price-guide-detail-matrix="true"/);
  assert.match(detail, /validatePriceGuideDocument\(draft, \{ photoTable \}\)/);
  assert.match(detail, /await onSave\(draft\)/);
  assert.match(detail, /상세 요금표 저장/);
  assert.match(detail, /<PriceGuideNativeInlineTable/);
  assert.match(detail, /<PriceGuideStructuredReviewTable/);
  assert.match(detail, /photoTable && !editing/);
  assert.match(detail, /photoReviewMode=\{photoTable\}/);
  assert.doesNotMatch(nativeTable, /대상 동물|체급 분류|가격 방식 선택|메모 추가/);
  assert.match(nativeTable, /data-price-guide-breed-chips="true"/);
  assert.match(nativeTable, /data-price-guide-fixed-price-ui="true"/);
  assert.match(nativeTable, /rowInputId\(rowIndex, "priceKind"\)/);
  assert.match(nativeTable, /rowInputId\(rowIndex, "priceMaxKrw"\)/);
  assert.match(nativeTable, /function PriceDurationInlineCell[\s\S]*data-price-guide-price-duration-cell=\{rowIndex\}/);
  assert.doesNotMatch(nativeTable, /renderedStructureField === noteId|PriceGuideNativeInlineExtras/);
  assert.doesNotMatch(nativeTable, /firstIssueInputId \?\? activeField/);
  assert.match(mockData, /id: "svc-full"[\s\S]*price_guide: \{[\s\S]*schemaVersion: 2[\s\S]*priceMinKrw: 80000[\s\S]*durationMinutes: 120/);

  assert.match(serviceManagement, /price_guide: serializeServicePriceGuide\(service\.priceGuide\)/);
  assert.match(serviceManagement, /priceGuide: serializeServicePriceGuide\(form\.priceGuide\)/);
  assert.match(serviceManagement, /priceGuide: serializeServicePriceGuide\(nextService\.priceGuide\)/);
  const postIndex = serviceManagement.indexOf('fetchApiJsonWithAuth<Service>("/api/services"');
  const refetchIndex = serviceManagement.indexOf("fetchApiJsonWithAuth<BootstrapPayload>", postIndex);
  assert.ok(postIndex >= 0, "canonical service POST must exist");
  assert.ok(refetchIndex > postIndex, "canonical GET refetch must happen after POST success");
  assert.match(serviceManagement, /\/api\/bootstrap\?shopId=\$\{encodeURIComponent\(shopId\)\}&phase=essential/);
  assert.match(serviceManagement, /\{ cache: "no-store" \}/);
  assert.match(serviceManagement, /const canonicalServices = canonicalBootstrap\.services/);
  assert.match(serviceManagement, /refreshedServices\.find\(\(service\) => service\.id === savedService\.id\)/);
  assert.match(serviceManagement, /if \(!refreshedSelected\)/);
  assert.match(serviceManagement, /setServices\(refreshedServices\)/);
  assert.match(serviceManagement, /onServicesChange\?\.\(canonicalServices\)/);
  assert.match(serviceManagement, /refetchCanonicalAfterSave: true/);
  assert.match(serviceManagement, /if \(serviceForm\.priceGuide\.canonicalV2\) \{[\s\S]*setAutosaveStatus\("idle"\);[\s\S]*return;/);
  assert.match(serviceManagement, /const canonicalPriceGuideDocument = services\.find\(\(service\) => service\.priceGuide\.canonicalV2\)\?\.priceGuide\.canonicalV2 \?\? null/);
  assert.match(serviceManagement, /initialDocument=\{canonicalPriceGuideDocument\}/);
  assert.doesNotMatch(serviceManagement, /PriceGuideSavedServiceList/);
  assert.doesNotMatch(serviceManagement, /const previewServices|onServicesChange\?\.\(previewServices\)/);
  assert.doesNotMatch(serviceManagement, /setServices\(\(current\) =>[\s\S]{0,260}priceGuide: nextPriceGuide/);
  assert.match(serviceManagement, /const canonicalServices = useMemo/);
  assert.match(serviceManagement, /buildCustomerServiceSourceOptions\(canonicalServices\)/);
  assert.match(serviceManagement, /canonicalPriceGuideDocument && rawCustomerServiceConnectionOptions\.length > 0/);
  assert.match(serviceManagement, /canonicalPriceGuideDocument \? \([\s\S]*ServiceDurationRecommendationPanel/);
  assert.match(choice, /요금표 미등록/);
  assert.match(onboarding, /data-price-guide-registration-status="saved"[\s\S]*요금표 등록됨/);
  assert.match(exposure, /linkedOptionId: row\.option\.id/);
  assert.match(exposure, /가격과 시간은 원본 요금표를 수정하면 고객 화면에도 같은 값으로 반영됩니다/);
  assert.doesNotMatch(exposure, /onRenameOption|displayName:/);
  assert.doesNotMatch(customerPageManagement, /\/api\/services|서비스 추가|priceGuide: \{\}/);
  assert.match(customerPageManagement, /저장된 상세 요금표 항목의 순서와 노출 여부만 정할 수 있습니다/);
  assert.match(customerPageManagement, /sanitizeCustomerServiceOverridesForSourceOptions/);
  assert.match(ownerShopsRoute, /\.from\("services"\)[\s\S]*\.eq\("shop_id", owner\.shopId\)[\s\S]*\.eq\("is_active", true\)/);
  assert.match(ownerShopsRoute, /customer_service_overrides: sourceBoundCustomerServiceOverrides \?\? \{\}/);
  assert.match(ownerMutations, /customer_service_overrides: current\.customer_service_overrides/);
  assert.doesNotMatch(customerEntry, /getPriceGuideSections|fullServiceOptions|normalizeServicePriceGuide/);
  assert.match(customerEntry, /serviceOptions\.map\(\(service\) =>/);
  assert.doesNotMatch(customerManage, /customerServiceOptions\.length > 0 \? customerServiceOptions : services\.map/);
  assert.match(customerManage, /customerServiceOptionId: manageForm\.customerServiceOptionId/);
  assert.match(customerBookingPage, /firstVisitUsesCustomService \? firstVisit\.customServiceName\.trim\(\) : selectedFirstServiceOption/);
  assert.match(customerBookingsServer, /customerServiceOptionId: z\.string\(\)\.trim\(\)\.min\(1\)/);
  assert.match(customerBookingsServer, /!usesCustomService && !selectedCustomerServiceOption/);
  assert.match(customerBookingsServer, /durationMinutesOverride: selectedCustomerServiceOption\.durationMinutes/);
  assert.doesNotMatch(customerDiscountQuote, /: customerServiceOptions\.find\(\(option\) => option\.serviceId === payload\.serviceId\)/);
  assert.match(priceGuide, /ensurePriceGuideV2SourceItemIds/);
  assert.match(nativeTable, /data-native-price-guide-group=\{groupIndex\}/);
  assert.match(nativeTable, /group\.breedNames\.join\(", "\)/);
  assert.doesNotMatch(`${detail}\n${nativeTable}`, /이 그룹 편집|MatrixGroupCard|EditableMatrixGroup/);
});
