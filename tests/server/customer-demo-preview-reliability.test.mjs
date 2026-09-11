import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LANDING_DEMO_SHOP_ID,
  getLandingDemoShopId,
  isLandingDemoShopId,
  resolveLandingDemoServiceId,
} from "../../src/lib/development-demo.ts";

function readProjectFile(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

test("landing customer previews use the deterministic local demo bootstrap", () => {
  assert.equal(getLandingDemoShopId(), "demo-shop");
  assert.equal(isLandingDemoShopId("demo-shop"), true);
  assert.equal(isLandingDemoShopId(LANDING_DEMO_SHOP_ID), true);

  const careReportPreview = readProjectFile("src/app/demo/customer-care-report-preview/page.tsx");
  assert.match(careReportPreview, /CustomerGroomingResultCard/);
  assert.match(careReportPreview, /previewPhotoUrls/);
  assert.doesNotMatch(careReportPreview, /getBootstrap|throw new Error/);
});

test("landing AI booking resolves its copied service id to the current source row", () => {
  const currentServices = [
    { id: "current-full-grooming-source", name: "전체 미용", is_active: true, price: 93000, duration_minutes: 135 },
    { id: "current-bath-source", name: "목욕", is_active: true, price: 41000, duration_minutes: 70 },
  ];

  assert.equal(
    resolveLandingDemoServiceId("petmanager-demo-service-full", currentServices),
    "current-full-grooming-source",
  );
  assert.equal(resolveLandingDemoServiceId("current-bath-source", currentServices), "current-bath-source");

  const bookingPage = readProjectFile("src/app/book/[shopId]/page.tsx");
  assert.match(bookingPage, /resolveLandingDemoServiceId\(resolvedSearchParams\?\.serviceId, data\.services\)/);
  assert.doesNotMatch(bookingPage, /price:\s*\d+|duration_minutes:\s*\d+/);

  const bookingFlow = readProjectFile("src/components/customer/customer-first-visit-claude-flow.tsx");
  assert.match(bookingFlow, /const selectedServiceProjection = selectedServiceOption/);
  assert.match(bookingFlow, /name: selectedServiceOption\.displayName/);
  assert.match(bookingFlow, /durationLabel: formatCustomerServiceDuration\(selectedServiceOption\)/);
  assert.match(bookingFlow, /priceLabel: formatServicePrice\(selectedServiceOption\.price, selectedServiceOption\.priceType\)/);
  assert.match(bookingFlow, /\$\{selectedServiceProjection\.name\} · \$\{selectedServiceProjection\.durationLabel\}/);
});

test("active landing story exposes the live AI booking preview and expansion interaction", () => {
  const storyFile = readProjectFile("src/components/landing/landing-booking-system-story.tsx");
  const activeStory = storyFile.slice(storyFile.indexOf("export function BookingSystemStory"));
  const previewFile = readProjectFile("src/components/landing/landing-booking-flow-carousel.tsx");

  assert.match(previewFile, /ai: `\/book\/\$\{landingDemoShopId\}\?experience=ai&step=3&serviceId=petmanager-demo-service-full`/);
  assert.match(activeStory, /useState<ExpandedBookingPreview \| null>/);
  assert.match(activeStory, /setExpandedBookingPreview\("ai"\)/);
  assert.match(activeStory, /CustomerBookingPhonePreview experience="ai"/);
  assert.match(activeStory, /expandedBookingPreviewCopy\[expandedBookingPreview\]/);
});
