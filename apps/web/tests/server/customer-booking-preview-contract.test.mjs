import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

test("owner preview reuses the real booking flow without creating a reservation", async () => {
  const [preview, bookingPage, firstVisitFlow, entryPage] = await Promise.all([
    source("src/components/owner-web/customer-page-phone-preview.tsx"),
    source("src/components/customer/customer-booking-page.tsx"),
    source("src/components/customer/customer-first-visit-claude-flow.tsx"),
    source("src/components/customer/customer-booking-entry-page.tsx"),
  ]);

  assert.match(preview, /<CustomerBookingPage/);
  assert.match(preview, /<CustomerBookingEntryPage/);
  assert.equal((preview.match(/<CustomerBookingEntryPage/g) ?? []).length, 1);
  assert.match(preview, /data-customer-phone-preview-viewport="430x804"/);
  assert.match(preview, /"--customer-entry-viewport-height": `\$\{CUSTOMER_PREVIEW_CONTENT_HEIGHT\}px`/);
  assert.match(preview, /width: CUSTOMER_PREVIEW_CONTENT_WIDTH,[\s\S]*height: CUSTOMER_PREVIEW_CONTENT_HEIGHT,[\s\S]*transform: `scale\(\$\{CUSTOMER_PREVIEW_CONTENT_SCALE\}\)`/);
  assert.match(preview, /lg:grid-cols-\[minmax\(0,1fr\)_320px\]/);
  assert.match(preview, /className="hidden[^\"]*lg:flex"/);
  assert.doesNotMatch(preview, /xl:grid-cols-\[minmax\(0,1fr\)_320px\]|className="hidden[^\"]*xl:flex"/);
  assert.match(preview, /initialServiceId=\{selection\.serviceId\}/);
  assert.match(preview, /initialServiceOptionId=\{selection\.serviceOptionId\}/);
  assert.doesNotMatch(preview, /previewSelectedServiceOptionId=\{selection\?\.serviceOptionId/);
  assert.match(preview, /disableStoredProfile/);
  assert.match(preview, /previewOnly/);
  assert.doesNotMatch(preview, /CustomerPreviewBookingFlowScreen|CustomerPreviewBookingCompleteScreen|value="몽이"|value="말티즈"/);

  assert.match(bookingPage, /firstVisitStep === 1 && serviceSelectedBeforeFlow/);
  assert.match(bookingPage, /setFirstVisitStep\(3\)/);
  assert.match(bookingPage, /if \(previewOnly\) \{[\s\S]*onPreviewBookingComplete\?\.\(\);[\s\S]*setFirstVisitStep\(5\);[\s\S]*return;/);
  assert.match(bookingPage, /fetchJson<BookingCreateResponse>\("\/api\/customer-bookings"/);
  assert.match(firstVisitFlow, /previewOnly \? "예약 흐름을 확인했습니다"/);
  assert.match(firstVisitFlow, /미리보기에서는 예약이나 고객 정보가 저장되지 않습니다/);
  assert.match(entryPage, /serviceId/);
  assert.match(entryPage, /serviceOptionId/);
  assert.doesNotMatch(entryPage, /is-preview/);
  assert.doesNotMatch(entryPage, /previewMode[^\n]*(?:price|card|height)|(?:price|card|height)[^\n]*previewMode/i);
  assert.match(entryPage, /height:var\(--customer-entry-viewport-height,100dvh\)/);
  assert.match(entryPage, /data-customer-entry-viewport="true"/);
  assert.match(entryPage, /data-customer-booking-dock="true"/);
});
