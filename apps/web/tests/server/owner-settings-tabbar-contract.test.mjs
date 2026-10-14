import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readProjectFile(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("owner settings tabs share the rounded-rectangle tab-bar contract", () => {
  const settingsTabFiles = [
    "src/components/owner-web/benefits-management-panel.tsx",
    "src/components/owner-web/booking-policy-panel.tsx",
    "src/components/owner-web/settings-alerts-panel.tsx",
    "src/components/owner-web/settings-shop-info-panel.tsx",
  ];
  const globals = readProjectFile("src/app/globals.css");

  for (const path of settingsTabFiles) {
    const source = readProjectFile(path);
    assert.match(source, /owner-settings-tabbar|OWNER_SETTINGS_TABBAR_CLASS/);
    assert.match(source, /role="tablist"/);
    assert.match(source, /role="tab"/);
    assert.match(source, /aria-selected=/);
  }

  const benefits = readProjectFile(settingsTabFiles[0]);
  const alerts = readProjectFile(settingsTabFiles[2]);
  assert.match(benefits, /OWNER_SETTINGS_TAB_HEADER_CLASS/);
  assert.match(benefits, /owner-settings-tabbar min-w-0 w-full/);
  assert.match(alerts, /OWNER_SETTINGS_TAB_HEADER_CLASS/);

  assert.match(globals, /\.pm-owner-web \.owner-settings-tabbar\s*\{[\s\S]*min-height: 54px;[\s\S]*overflow-x: auto;[\s\S]*border-radius: 14px;/);
  assert.match(globals, /\.pm-owner-web \.owner-settings-tabbar > \[role="tab"\]\s*\{[\s\S]*height: 44px !important;[\s\S]*border-radius: 10px !important;[\s\S]*font-size: 18px !important;[\s\S]*line-height: 26px !important;/);
  assert.match(globals, /\.pm-owner-web \.owner-settings-tabbar > \[role="tab"\]\[aria-selected="true"\]\s*\{[\s\S]*color: #2f6bd4 !important;[\s\S]*background: #fff !important;/);
});
