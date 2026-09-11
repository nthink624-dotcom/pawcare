import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("demo customer bootstrap does not signal initial-setup completion or replace the selected route", () => {
  const preview = source("src/components/owner-web/owner-web-preview.tsx");
  const customers = source("src/components/owner-web/customer-management-screen.tsx");

  assert.match(preview, /function handleOwnerDataChange\(nextData: BootstrapPayload\) \{\s*[\s\S]*applyOwnerData\(nextData\);/);
  assert.match(preview, /function handleOwnerDataChange\(nextData: BootstrapPayload\) \{\s*if \(nextData === ownerDataRef\.current\) return;/);
  assert.match(preview, /const preparedData = authoritative && isDemoOwnerWebData\(nextData\)/);
  assert.doesNotMatch(preview, /const preparedData = isDemoOwnerWebData\(nextData\)\s*\?/);
  assert.doesNotMatch(preview, /function handleOwnerDataChange[\s\S]*applyOwnerData\(nextData, isDemoOwnerWebData\(nextData\)\)/);
  assert.match(preview, /function handleShopProfileChange\(shop: BootstrapPayload\["shop"\]\) \{[\s\S]*mergeOwnerWebShop\(current\.shop, shop\),[\s\S]*\}\);/);
  const shopChangeHandler = preview.match(
    /function handleShopProfileChange\(shop: BootstrapPayload\["shop"\]\) \{([\s\S]*?)\n  \}/,
  )?.[1];
  assert.ok(shopChangeHandler, "shop profile change handler should remain present");
  assert.doesNotMatch(shopChangeHandler, /demoMode/);
  assert.match(preview, /applyOwnerData\(refreshed, true\)/);
  assert.match(preview, /applyOwnerData\(canonicalBootstrap, true\)/);
  assert.match(preview, /onOperatingHoursSaveSuccess=\{initialSetupMode \? \(\) => onInitialSetupStepSaved\("hours"\) : undefined\}/);
  assert.match(preview, /onOperatingHoursNext=\{initialSetupMode \? onInitialSetupHoursNext : undefined\}/);
  assert.match(preview, /function closeInitialSetup\(\) \{[\s\S]*setActiveScreen\("schedule"\)/);

  assert.match(customers, /const skippedInitialBootstrapSyncRef = useRef\(false\)/);
  assert.match(customers, /if \(!skippedInitialBootstrapSyncRef\.current\) \{\s*skippedInitialBootstrapSyncRef\.current = true;\s*return;\s*\}\s*onDataChange\?\.\(bootstrapData\)/);
  assert.match(customers, /setBootstrapData\(initialData\)/);
});
