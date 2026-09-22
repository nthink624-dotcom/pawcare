import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

const bookingLink = read("src/components/owner-web/booking-link-management-screen.tsx");
const naverGuide = read("src/components/owner-web/booking-link-naver-guide.tsx");
const ownerPreview = read("src/components/owner-web/owner-web-preview.tsx");
const actionButtons = read("src/components/owner-web/owner-web-action-button-styles.ts");

test("booking link uses one bordered work surface with divider-only structural regions", () => {
  assert.equal((bookingLink.match(/data-booking-link-main-surface/g) ?? []).length, 1);
  assert.match(
    bookingLink,
    /data-booking-link-main-surface[\s\S]{0,160}className="min-w-0 overflow-hidden rounded-\[14px\] border border-\[#e8edf3\] bg-white"/,
  );
  assert.match(bookingLink, /<header className="min-w-0 px-3 py-3 sm:px-4 sm:py-4">/);
  assert.match(bookingLink, /<section className="min-w-0 border-t border-\[#e8edf3\] px-3 py-4 sm:px-4 sm:py-5">/);
  assert.match(
    bookingLink,
    /data-booking-link-channel="naver" className="mt-4 min-w-0 border-t border-\[#e8edf3\] pt-4"/,
  );
  assert.doesNotMatch(
    bookingLink,
    /min-w-0 max-w-full rounded-\[10px\] border border-\[#dbe2ea\] bg-\[#f8fafc\] p-3/,
  );
  assert.doesNotMatch(
    bookingLink,
    /<div className="rounded-\[8px\] border border-\[#dbe2ea\] bg-white p-3">/,
  );
  assert.match(
    naverGuide,
    /border-t border-\[#e8edf3\] pt-4 first:border-t-0 first:pt-0/,
  );
});

test("booking link preserves URL, copy actions, customer opening, and owner route wiring", () => {
  assert.match(bookingLink, /return `\$\{window\.location\.origin\}\/s\/\$\{shopId\}`/);
  assert.match(bookingLink, /navigator\.clipboard\.writeText\(value\)/);
  for (const target of ["url", "naverUrl", "naverDirections"]) {
    assert.match(bookingLink, new RegExp(`handleCopy\\([^\\n]+, "${target}"\\)`));
  }
  assert.match(bookingLink, /href=\{bookingUrl\}[\s\S]{0,180}target="_blank"[\s\S]{0,400}고객 화면 열기/);
  assert.match(bookingLink, /예약 링크 노출 가이드/);
  assert.match(bookingLink, /\{bookingUrl\}/);
  assert.match(ownerPreview, /"bookingLink"[\s\S]{0,320}\.includes\(screen\)/);
  assert.match(ownerPreview, /case "bookingLink":\s*return <BookingLinkManagementScreen initialData=\{initialData\} \/>/);
});

test("booking link reflows at narrow widths without a page-level horizontal scroller", () => {
  assert.match(bookingLink, /h-full min-h-0 min-w-0 overflow-y-auto/);
  assert.doesNotMatch(bookingLink, /overflow-x-auto|overflow-x-scroll/);
  assert.match(bookingLink, /w-full shrink-0 flex-col flex-wrap gap-2 sm:w-auto sm:flex-row/);
  assert.match(bookingLink, /grid min-w-0 gap-5 xl:grid-cols-\[300px_minmax\(0,1fr\)\]/);
  assert.match(bookingLink, /<BookingLinkNaverGuide/);
  assert.match(naverGuide, /flex flex-wrap gap-2/);
  assert.match(naverGuide, /aria-pressed=\{mode === value\}/);
  assert.match(naverGuide, /style=\{\{ width: step.width \}\}/);
  assert.match(naverGuide, /h-auto max-w-full/);
  assert.match(naverGuide, /원본 보기/);
  assert.doesNotMatch(naverGuide, /GuideHighlight|<canvas/);
  assert.match(actionButtons, /inline-flex h-11 items-center justify-center/);
});
