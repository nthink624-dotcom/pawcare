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
});
