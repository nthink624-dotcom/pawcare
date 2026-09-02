import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { priceGuideV2PreviewScenarios } from "../../src/app/dev/price-guide-v2-preview/price-guide-v2-preview-fixtures.ts";
import { priceGuideV2Schema } from "../../src/types/price-guide-photo-import.ts";

const pagePath = new URL(
  "../../src/app/dev/price-guide-v2-preview/page.tsx",
  import.meta.url,
);
const onboardingPath = new URL("../../src/components/owner-web/price-guide-photo-onboarding.tsx", import.meta.url);
const detailPath = new URL("../../src/components/owner-web/price-guide-v2-service-detail.tsx", import.meta.url);

test("owner price guide preview exposes empty and saved DB-free states through the production workspace", async () => {
  const [page, onboarding] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(onboardingPath, "utf8"),
  ]);

  assert.match(page, /process\.env\.NODE_ENV !== "development"/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /searchParams\.get\("state"\) === "saved" \? "saved" : "empty"/);
  assert.match(page, /state === "saved" \? createPriceGuidePhotoImportFixture\(\)\.document : null/);
  assert.match(page, /<PriceGuidePhotoOnboarding/);
  assert.match(page, /fixtureMode/);
  assert.match(page, /data-preview-source="fixture"/);
  assert.match(page, /data-persisted="false"/);
  assert.match(page, /검수용 예시 · 저장 없음/);
  assert.doesNotMatch(page, /fetch\(|createClient|supabase|signIn|signUp/);
  assert.match(onboarding, /data-price-guide-source=\{initialDocument \? "saved" : "default-draft"\}/);
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
  const [page, onboarding, detail] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(onboardingPath, "utf8"),
    readFile(detailPath, "utf8"),
  ]);
  assert.match(page, /overflow-x-hidden/);
  assert.match(onboarding, /min-h-11/);
  assert.match(detail, /min-h-11/);
  assert.match(detail, /overflow-x-auto/);
  assert.match(detail, /data-price-guide-detail-matrix="true"/);
});
