import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pickerPath = new URL("../../src/components/customer/customer-entry-service-picker.tsx", import.meta.url);
const entryPath = new URL("../../src/components/customer/customer-booking-entry-page.tsx", import.meta.url);

test("customer price-guide CTA is a card footer outside the service radiogroup", async () => {
  const picker = await readFile(pickerPath, "utf8");

  assert.match(picker, /<div className="pcard" data-customer-service-picker="card-pinned-action">/);
  assert.match(picker, /className="service-options-scroll"[\s\S]*role="radiogroup"[\s\S]*data-customer-service-list-scroll="true"/);
  assert.match(picker, /data-customer-service-list-scroll="true"[\s\S]*services\.map\(\(service\) =>[\s\S]*role="radio"/);
  assert.match(picker, /onWheel=\{\(event\) => \{[\s\S]*list\.scrollTop \+= event\.deltaY;[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);/);
  assert.match(picker, /\}\)\}[\s\S]*<\/div>\s*<button[\s\S]*data-customer-price-guide-card-footer="true"/);
  assert.doesNotMatch(picker, /role="radiogroup"[^>]*>\s*<button className="full"/);
  assert.equal((picker.match(/요금표 전체 보기/g) ?? []).length, 1);
  assert.match(picker, /onClick=\{\(\) => onSelect\(service\.id\)\}/);
  assert.match(picker, /formatCustomerServiceDuration\(service\)/);
  assert.match(picker, /formatServicePrice\(service\.price, service\.priceType\)/);
});

test("the 48px coral CTA stays in the card while only service rows scroll", async () => {
  const entry = await readFile(entryPath, "utf8");

  assert.match(entry, /\.pm-entry-proto \.pcard\{display:flex;height:var\(--customer-price-guide-card-height,auto\);min-height:48px;flex-direction:column/);
  assert.match(entry, /\.service-options-scroll\{min-height:0;flex:1 1 auto;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;touch-action:pan-y\}/);
  assert.match(entry, /\.service-options-scroll::-webkit-scrollbar\{display:none\}/);
  assert.match(entry, /\.scroll\{[^}]*padding-bottom:102px/);
  assert.match(entry, /\.pm-entry-proto\.has-benefits \.scroll\{padding-bottom:132px\}/);
  assert.match(entry, /\.pcard \.full\{[^}]*position:static[^}]*height:48px[^}]*min-height:48px[^}]*width:100%[^}]*flex:0 0 48px[^}]*background:var\(--primary\)[^}]*font-size:16px[^}]*line-height:24px[^}]*font-weight:500[^}]*color:var\(--text\)/);
  assert.doesNotMatch(entry, /\.pcard \.full\{[^}]*position:fixed/);
  assert.doesNotMatch(entry, /--customer-dock-height/);
  assert.match(entry, /\.dock\{[^}]*padding:10px 16px max\(16px,env\(safe-area-inset-bottom\)\)/);
  assert.match(entry, /\.pm-entry-proto :is\(button,a,input,textarea,select,\[role="button"\]\):focus-visible\{[^}]*outline:2px solid/);
  assert.doesNotMatch(entry, /\.pcard \.full\{[^}]*background:#111a30/);
  assert.match(entry, /entryRootRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(entry, /entryDockRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(entry, /function readElementTopInEntryViewport\(element: HTMLElement, viewport: HTMLElement\)/);
  assert.match(entry, /viewport\.clientHeight \/ renderedHeight/);
  assert.match(entry, /const cardTop = readElementTopInEntryViewport\(card, viewport\)/);
  assert.match(entry, /const dockTop = readElementTopInEntryViewport\(dock, viewport\)/);
  assert.match(entry, /Math\.floor\(dockTop - cardTop - 8\)/);
  assert.match(entry, /viewport\.addEventListener\("scroll", measure, \{ passive: true \}\)/);
  assert.match(entry, /new ResizeObserver\(measure\)/);
  assert.match(entry, /window\.visualViewport\?\.addEventListener\("resize", measure\)/);
  assert.match(entry, /window\.visualViewport\?\.addEventListener\("scroll", measure\)/);
  assert.doesNotMatch(entry, /height:min\(407px|max\(104px|100dvh - 481px|100dvh - 527px/);
  assert.doesNotMatch(entry, /\.is-preview[^}]*\.pcard|previewMode[^\n]*(?:price|card|height)|(?:price|card|height)[^\n]*previewMode/i);
  assert.doesNotMatch(entry, /dock\.getBoundingClientRect\(\)\.top\s*-\s*card\.getBoundingClientRect\(\)\.top/);
});
