import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

const shopInfo = read("src/components/owner-web/settings-shop-info-panel.tsx");
const settings = read("src/components/owner-web/settings-management-screen.tsx");
const preview = read("src/components/owner-web/owner-web-preview.tsx");
const shell = read("src/components/owner-web/owner-web-app-shell.tsx");
const globals = read("src/app/globals.css");

test("shop info uses the shared outer border and clips its white content to the inner radius", () => {
  assert.match(
    shell,
    /className="pm-owner-main-surface h-full min-h-0 min-w-0 shadow-none"[\s\S]*data-owner-main-screen=\{activeScreen\}/,
  );
  assert.match(shell, /"shopInfo"/);
  assert.match(globals, /--pm-owner-main-surface-border: var\(--pm-ui-border\);/);
  assert.match(globals, /--pm-owner-main-surface-radius: 14px;/);
  assert.match(
    shopInfo,
    /className="h-full min-h-0 min-w-0 overflow-hidden rounded-\[13px\] bg-white"[\s\S]*data-shop-info-main-surface/,
  );
  assert.match(shopInfo, /data-shop-info-scroll-region[\s\S]*className="min-h-0 flex-1 overflow-y-auto bg-white/);
});

test("shop info panels do not introduce a second outer card", () => {
  assert.match(
    shopInfo,
    /<section id=\{id\} data-shop-info-panel-surface className="scroll-mt-5 min-w-0 bg-white">/,
  );
  assert.doesNotMatch(
    shopInfo,
    /data-shop-info-panel-surface[^>]*(?:rounded-\[16px\]|border border-\[#e1e4ea\]|shadow-\[)/,
  );
  assert.match(settings, /data-settings-management-active-tab=\{activeTab\}/);
});

test("shop info remains wired to the owner route and preserves its controls", () => {
  assert.match(preview, /case "shopInfo":[\s\S]*<SettingsManagementScreen[\s\S]*activeTab=\{settingsTabForScreen\(screen\) \?\? "shop"\}/);
  assert.match(settings, /activeTab === "shop"[\s\S]*<ShopInfoSettingsPanel/);
  assert.match(settings, /onRowChange=\{\(rowId, value\) => updateRow\(rowId, value\)\}/);
  assert.match(settings, /onRowCommit=\{\(rowId, value\) => commitShopRow\(rowId, value\)\}/);
  assert.match(settings, /onOpenAddressSearch=\{\(\) => setAddressSheetOpen\(true\)\}/);
  assert.match(settings, /shopInfoAutoSaveTimerRef\.current = setTimeout\(runAutoSave, 500\)/);
  assert.match(shopInfo, /className="min-h-11 w-full rounded-\[10px\] border/);
});
