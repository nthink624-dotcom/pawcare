import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

function componentRoot(sourceText, componentName) {
  const componentStart = sourceText.indexOf(`function ${componentName}`);
  assert.notEqual(componentStart, -1, `${componentName} must remain an explicit route core`);
  const componentSource = sourceText.slice(componentStart);
  const rootMatch = /return \(\s*<[A-Za-z]/.exec(componentSource);
  assert.ok(rootMatch, `${componentName} must retain its JSX route root`);
  return componentSource.slice(rootMatch.index, rootMatch.index + 16_000);
}

test("accepted route cores bypass only their redundant inner wrapper", async () => {
  const [calendar, profitability, bookingLink, shopInfo, alerts, alertSwitch] = await Promise.all([
    source("src/components/owner-web/calendar-records-screen.tsx"),
    source("src/components/owner-web/profitability-analytics-screen.tsx"),
    source("src/components/owner-web/booking-link-management-screen.tsx"),
    source("src/components/owner-web/settings-shop-info-panel.tsx"),
    source("src/components/owner-web/settings-alerts-panel.tsx"),
    source("src/components/owner-web/settings-alert-switch.tsx"),
  ]);

  const calendarRoot = componentRoot(calendar, "CalendarRecordsScreen");
  assert.doesNotMatch(calendar, /\bWebSurface\b/, "calendar records must not recreate a nested WebSurface");
  assert.match(calendarRoot, /<section className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden rounded-\[18px\] bg-white sm:overflow-hidden">/);
  assert.match(calendarRoot, /border-b border-\[#e5e7eb\] bg-white/, "calendar toolbar remains part of its core surface");
  assert.match(calendarRoot, /min-w-0 w-full flex-none[\s\S]*sm:min-w-\[280px\] sm:flex-1/, "calendar search must reflow instead of forcing a root-200 overflow");
  assert.match(calendarRoot, /flex-wrap items-center justify-between[\s\S]*h-11 w-11[\s\S]*order-first flex min-h-11 w-full[\s\S]*min-h-11 rounded/, "calendar month navigation must wrap with 44px controls at root-200");
  assert.match(calendarRoot, /min-h-11 min-w-0 w-full appearance-none/, "calendar filters must retain 44px controls");
  assert.match(calendarRoot, /min-w-\[720px\][^"\n]*grid-cols-7/, "calendar month grid keeps an intentional local horizontal scroll surface");
  assert.match(calendarRoot, /min-w-0 flex-1 flex-col overflow-x-auto/, "calendar month grid local scroll must remain reachable");

  const bookingRoot = componentRoot(bookingLink, "BookingLinkManagementScreen");
  assert.doesNotMatch(bookingLink, /\bWebSurface\b/, "booking link must not recreate a nested WebSurface");
  assert.match(bookingRoot, /<main className="grid min-w-0 w-full gap-3">\s*<section className="min-w-0">/);
  assert.match(bookingRoot, /rounded-\[8px\] border border-\[#dbe2ea\] bg-\[#f8fafc\]/, "booking details remain an inner card");
  assert.match(bookingRoot, /w-full shrink-0 flex-col flex-wrap gap-2 sm:w-auto sm:flex-row/, "booking link actions must stack at root-200 instead of clipping");

  const profitabilityRoot = componentRoot(profitability, "ProfitabilityAnalyticsScreen");
  assert.match(profitabilityRoot, /<div className="h-full min-h-0 min-w-0 overflow-auto">\s*<div className="flex min-w-0 flex-col gap-3">/);
  assert.doesNotMatch(profitabilityRoot, /bg-\[#f7f8fa\] p-4|mx-auto flex max-w-\[1440px\]/, "profitability must drop the beige inset and width wrapper");
  assert.match(profitabilityRoot, /rounded-\[10px\] border border-\[#e2e7ee\] bg-white px-3 py-3 sm:flex-row sm:items-center sm:px-4/, "profitability keeps its analytic content cards");
  assert.match(profitability, /grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5/, "profitability metrics must become one column at root-200");
  assert.match(profitability, /min-h-11 min-w-\[88px\] flex-1[\s\S]*h-11 w-11/, "profitability range and refresh controls must remain 44px targets");
  assert.match(profitability, /overflow-x-auto rounded-\[8px\] border border-\[#e7ebf0\]/, "wide staff data must use intentional local scrolling");
  assert.match(profitability, /flex flex-col items-stretch justify-between[\s\S]*sm:flex-row sm:items-center/, "price recommendations must reflow rather than clip");

  const shopInfoRoot = componentRoot(shopInfo, "ShopInfoSettingsPanel");
  assert.match(shopInfoRoot, /<div className="h-full min-h-0 min-w-0">[\s\S]*relative flex min-h-0 min-w-0 flex-col overflow-hidden/);
  assert.doesNotMatch(shopInfoRoot, /rounded-\[18px\]|shadow-\[0_10px_34px|after:border/, "shop info must not recreate a framed shell around its core");
  assert.match(shopInfoRoot, /ref=\{settingsScrollRef\} className="min-h-0 overflow-y-auto bg-white/, "shop info keeps its local scroll core");
  assert.match(shopInfo, /previewServices\?: Service\[\]/, "shop info must keep preview service data in its contract");
  assert.match(shopInfo, /ownerProfile\?: OwnerProfile \| null/, "shop info must keep owner preview identity in its contract");
  assert.doesNotMatch(shopInfoRoot, /CustomerPagePhonePreview|customerPreviewShop/, "shop info core must not recreate a nested phone preview plane");
  assert.match(shopInfo, /px-3 py-5 sm:pl-5 sm:pr-1/, "shop info core must reduce inset padding at root-200 without recreating an outer frame");
  assert.match(shopInfo, /min-h-11 w-full rounded-\[10px\]/, "shop info inputs must retain 44px height");
  assert.match(shopInfo, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,0\.45fr\)_minmax\(80px,max-content\)\]/, "shop address fields must release fixed root-200 widths");
  assert.doesNotMatch(shopInfo, /max-w-full overflow-x-auto>\{children\}/, "shop operating hours must not hide a root-200 grid behind a wrapper scroll");

  const alertsRoot = componentRoot(alerts, "SettingsAlertsPanel");
  assert.match(alertsRoot, /<section className="min-w-0">\s*<div className="grid min-w-0 gap-4 xl:grid-cols-\[minmax\(0,1fr\)_380px\]">/);
  assert.doesNotMatch(alertsRoot, /rounded-\[16px\] border border-\[#e5e7eb\] bg-white p-5 shadow/, "alerts must not recreate its outer card");
  assert.match(alertsRoot, /rounded-\[12px\] border border-\[#e5e7eb\] bg-white p-4/, "alert content cards remain inside the direct plane");
  assert.match(alerts, /flex min-w-0 flex-col cursor-pointer items-stretch[\s\S]*sm:flex-row sm:items-center/, "alert controls must stack instead of being hidden at root-200");
  assert.match(alerts, /flex min-w-0 w-full items-center gap-1\.5 sm:w-auto[\s\S]*min-w-0 break-words text-\[16px\]/, "long Korean alert labels must remain visible");
  assert.match(alerts, /<AlertSettingsSwitch/);
  assert.match(alertSwitch, /h-11 w-11[\s\S]*focus-visible:outline-\[#2563eb\][\s\S]*thumbClassName="relative z-10 h-5 w-5"/, "alert switches must expose 44px clear-blue keyboard targets");
});
