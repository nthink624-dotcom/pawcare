import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPriceGuideRegistrationPreviewFixture,
  buildPriceGuideSourceTruthPreviewFixture,
  inspectPriceGuideRegistrationPreview,
  priceGuideV2PreviewScenarios,
} from "../../src/app/dev/price-guide-v2-preview/price-guide-v2-preview-fixtures.ts";
import { priceGuideV2Schema } from "../../src/types/price-guide-photo-import.ts";

const pagePath = new URL(
  "../../src/app/dev/price-guide-v2-preview/page.tsx",
  import.meta.url,
);
const onboardingPath = new URL("../../src/components/owner-web/price-guide-photo-onboarding.tsx", import.meta.url);
const detailPath = new URL("../../src/components/owner-web/price-guide-v2-service-detail.tsx", import.meta.url);
const nativeTablePath = new URL("../../src/components/owner-web/price-guide-native-inline-table.tsx", import.meta.url);
const ownerPreviewPath = new URL("../../src/components/owner-web/owner-web-preview.tsx", import.meta.url);

test("owner price guide preview exposes empty and saved DB-free states through the production workspace", async () => {
  const [page, onboarding] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(onboardingPath, "utf8"),
  ]);

  assert.match(page, /process\.env\.NODE_ENV !== "development"/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /value === "photo-e2e"/);
  assert.match(page, /value === "direct-e2e"/);
  assert.match(page, /state === "saved" \? createPriceGuidePhotoImportFixture\(\)\.document : null/);
  assert.match(page, /<PriceGuidePhotoOnboarding/);
  assert.match(page, /<ServiceManagementScreen/);
  assert.match(page, /fixtureMode/);
  assert.match(page, /data-preview-source="fixture"/);
  assert.match(page, /data-persisted="false"/);
  assert.match(page, /data-customer-exposure-count=\{fixture\.customerOptionIds\.length\}/);
  assert.match(page, /검수용 예시 · 저장 없음/);
  assert.doesNotMatch(page, /fetch\(|createClient|supabase|signIn|signUp/);
  assert.match(onboarding, /mode === "choice" && !hasSavedPriceGuide \? <PriceGuideOnboardingChoice/);
  assert.match(onboarding, /mode === "choice" && initialDocument \? \([\s\S]*data-price-guide-source="saved"/);
  assert.doesNotMatch(onboarding, /default-draft/);
});

test("photo and direct DB-free previews start empty and use the real source-bound services workspace", async () => {
  const [page, serviceScreen] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(new URL("../../src/components/owner-web/service-management-screen.tsx", import.meta.url), "utf8"),
  ]);

  for (const path of ["photo-e2e", "direct-e2e"]) {
    const fixture = buildPriceGuideRegistrationPreviewFixture(path);
    assert.equal(fixture.data.services.length, 0);
    assert.deepEqual(fixture.data.shop.customer_page_settings.customer_service_overrides, {});
    assert.deepEqual(fixture.sourceOptionIds, []);
    assert.deepEqual(fixture.customerOptionIds, []);
    assert.deepEqual(fixture.customerLinkedSourceOptionIds, []);
    assert.deepEqual(inspectPriceGuideRegistrationPreview(fixture.data), {
      sourceOptionIds: [],
      customerOptionIds: [],
      customerLinkedSourceOptionIds: [],
    });

    const sourceTruthFixture = buildPriceGuideSourceTruthPreviewFixture("stale-link");
    const canonicalCarrier = sourceTruthFixture.data.services.find((service) =>
      priceGuideV2Schema.safeParse(service.price_guide).success,
    );
    assert.ok(canonicalCarrier);
    const saved = inspectPriceGuideRegistrationPreview({
      ...fixture.data,
      services: [{ ...canonicalCarrier, shop_id: fixture.data.shop.id }],
    });
    assert.ok(saved.sourceOptionIds.length > 0);
    assert.ok(saved.customerOptionIds.length > 0);
    assert.equal(
      saved.customerLinkedSourceOptionIds.every((id) => saved.sourceOptionIds.includes(id)),
      true,
    );
  }

  assert.match(page, /<PriceGuideRegistrationE2EPreview key=\{state\} path=\{state\}/);
  assert.match(page, /<ServiceManagementScreen[\s\S]*persistDemoState=\{false\}[\s\S]*onServicesChange=/);
  assert.match(page, /onShopChange=\{\(shop\) => setData/);
  assert.match(page, /data-source-option-count=\{state\.sourceOptionIds\.length\}/);
  assert.match(page, /data-customer-exposure-count=\{state\.customerOptionIds\.length\}/);
  assert.match(page, /data-customer-source-links-valid=\{state\.customerLinkedSourceOptionIds\.every/);
  assert.match(serviceScreen, /demoMode = false,[\s\S]*persistDemoState = true/);
  assert.match(serviceScreen, /if \(!demoMode \|\| !persistDemoState\)/);
  assert.match(serviceScreen, /if \(!storageReady \|\| !demoMode \|\| !persistDemoState\) return/);
});

test("authoritative price-guide save keeps the normal services screen while setup completion may exit", async () => {
  const ownerPreview = await readFile(ownerPreviewPath, "utf8");
  const boundary = ownerPreview.slice(
    ownerPreview.indexOf("function applyOwnerData"),
    ownerPreview.indexOf("function handleOwnerDataChange"),
  );

  assert.match(boundary, /setActiveScreen\(\(currentScreen\) => initialSetupOpen \? "schedule" : currentScreen\)/);
  assert.doesNotMatch(boundary, /setActiveScreen\("schedule"\)/);
  assert.doesNotMatch(boundary, /history\.(?:pushState|replaceState)/);
  assert.match(ownerPreview, /onPriceGuideSaveSuccess=\{\(canonicalBootstrap\) => onInitialSetupStepSaved\("pricing", canonicalBootstrap\)\}/);
});

test("DB-free source-truth fixtures hide stale and deleted source links without fallback rows", () => {
  for (const state of ["stale-link", "deleted-source"]) {
    const fixture = buildPriceGuideSourceTruthPreviewFixture(state);
    assert.equal(fixture.sourceOptionIds.length, 1);
    assert.deepEqual(fixture.customerOptionIds, []);
    assert.equal(fixture.sourceOptionIds.includes(fixture.linkedOptionId), false);
    assert.deepEqual(
      fixture.data.shop.customer_page_settings.customer_service_overrides[fixture.linkedOptionId],
      { visible: true, order: 1, linkedOptionId: fixture.linkedOptionId },
    );

    const carrier = fixture.data.services.find((service) =>
      priceGuideV2Schema.safeParse(service.price_guide).success,
    );
    assert.ok(carrier);
    const document = priceGuideV2Schema.parse(carrier.price_guide);
    assert.equal(document.rows.length, 1);
    assert.notEqual(document.rows[0].sourceItemId, state === "deleted-source" ? "preview-deleted-source" : "preview-missing-source");
  }
});

test("preview fixtures cover all saved states and complete detailed price fields", () => {
  assert.deepEqual(
    priceGuideV2PreviewScenarios.map((scenario) => scenario.document.source),
    ["ai_imported", "owner_confirmed", "owner_corrected"],
  );

  for (const scenario of priceGuideV2PreviewScenarios) {
    assert.equal(priceGuideV2Schema.safeParse(scenario.document).success, true);
    assert.deepEqual(
      scenario.document.rows.map((row) => row.sizeClass),
      ["small", "medium", "large", "extra-large"],
    );
    assert.deepEqual(
      scenario.document.rows.slice(0, 3).map((row) => row.priceKind),
      ["fixed", "starting", "range"],
    );
    assert.ok(scenario.document.rows.every((row) => row.durationMinutes !== null));
    assert.ok(scenario.document.rows.every((row) => row.note));
    assert.ok(scenario.document.rows.every((row) => row.breedNames.length > 0));
    assert.ok(scenario.document.rows.every((row) => row.minKg !== null));
    assert.ok(scenario.document.overallNote);
    assert.equal(scenario.document.surcharges.some((fee) => fee.amountKrw !== null), true);
    assert.equal(scenario.document.surcharges.some((fee) => fee.percent !== null), true);
    assert.deepEqual(
      new Set(scenario.document.aiReview.map((review) => review.confidence)),
      new Set(["low", "medium"]),
    );
  }
});

test("preview state controls retain 44px targets and mobile-safe layout", async () => {
  const [page, onboarding, detail, nativeTable] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(onboardingPath, "utf8"),
    readFile(detailPath, "utf8"),
    readFile(nativeTablePath, "utf8"),
  ]);
  assert.match(page, /overflow-x-hidden/);
  assert.match(onboarding, /min-h-11/);
  assert.match(detail, /min-h-11/);
  assert.match(nativeTable, /overflow-x-auto/);
  assert.match(detail, /data-price-guide-detail-matrix="true"/);
});

test("the owner menu, screen, embedded settings tab, and empty customer guidance share the price-guide name", async () => {
  const [ownerData, serviceScreen, settingsPanel, customerPage] = await Promise.all([
    readFile(new URL("../../src/components/owner-web/owner-web-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/service-management-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/settings-shop-info-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/customer-booking-page-management-screen.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(ownerData, /\{ key: "services", label: "요금표 관리" \}/);
  assert.match(serviceScreen, />요금표 관리<\/h2>/);
  assert.match(settingsPanel, /\{ id: "menu", label: "요금표 관리"/);
  assert.match(customerPage, /요금표 관리에서 요금표를 먼저 등록하고 저장해 주세요\./);
});
