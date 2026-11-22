import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const policyPath = new URL("../src/lib/owner-mobile-back-navigation.ts", import.meta.url);
const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const activityPath = new URL("../android/app/src/main/java/kr/petmanager/owner/MainActivity.java", import.meta.url);
const pluginPath = new URL("../android/app/src/main/java/kr/petmanager/owner/OwnerBackNavigationPlugin.java", import.meta.url);
const appNotificationSettingsPath = new URL("../src/components/owner/owner-app-notification-settings.tsx", import.meta.url);
const [policySource, ownerApp, activity, plugin] = await Promise.all([
  readFile(policyPath, "utf8"),
  readFile(ownerAppPath, "utf8"),
  readFile(activityPath, "utf8"),
  readFile(pluginPath, "utf8"),
]);

function loadPolicy() {
  const output = ts.transpileModule(policySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: () => ({
      Capacitor: { getPlatform: () => "web" },
      registerPlugin: () => ({ addListener: async () => ({ remove: async () => {} }), exitApp: async () => {} }),
    }),
  });
  return compiledModule.exports;
}

// The two-press exit was removed on 2026-09-19 (0d29fb37); mobile-back-d-parity keeps the app open at root.
test("root back press keeps the app open without a two-press exit timer", () => {
  const policy = loadPolicy();
  assert.equal(typeof policy.addOwnerAndroidBackButtonListener, "function");
  assert.equal("shouldExitOwnerApp" in policy, false);
  assert.equal("OWNER_ROOT_BACK_CONFIRMATION_MS" in policy, false);
});

test("Android forwards back only while the single JS listener is mounted", () => {
  assert.match(activity, /registerPlugin\(OwnerBackNavigationPlugin\.class\)/);
  assert.match(activity, /getOnBackPressedDispatcher\(\)\.addCallback\(this, new OnBackPressedCallback\(true\)/);
  assert.match(activity, /if \(dismissKeyboardIfVisible\(\)\) return;\s*dispatchOwnerBack\(\);/);
  assert.match(plugin, /hasListeners\("backButton"\)/);
  assert.match(plugin, /notifyListeners\("backButton", new JSObject\(\)\)/);
  assert.doesNotMatch(plugin, /finishAndRemoveTask\(\)/);
  assert.match(policySource, /Capacitor\.getPlatform\(\) !== "android"/);
  assert.match(policySource, /handle\.remove\(\)/);
});

test("owner back priority closes local layers before tabs and never uses browser history", async () => {
  assert.match(ownerApp, /if \(mobilePhotoStatusAction\)/);
  assert.match(ownerApp, /if \(mobileGroomingStartAction\)/);
  assert.match(ownerApp, /if \(careReportAppointmentId\)/);
  assert.match(ownerApp, /if \(modal\)/);
  assert.match(ownerApp, /if \(settingsEntryScreen\)/);
  assert.match(ownerApp, /new CustomEvent\("owner-mobile-back-request", \{ cancelable: true \}\)/);
  assert.match(ownerApp, /if \(backRequest\.defaultPrevented\)/);
  assert.match(await readFile(new URL("../src/components/auth/mobile-ai-price-guide-fixture.tsx", import.meta.url), "utf8"), /owner-mobile-back-request/);
  assert.match(ownerApp, /activeTabBackStackRef\.current\.pop\(\)/);
  assert.match(ownerApp, /window\.location\.replace\("\/owner\/mobile"\)/);
  assert.doesNotMatch(ownerApp, /history\.back\(|router\.back\(/);
});

test("app notification hardware back is consumed once and returns to settings", async () => {
  const appNotificationSettings = await readFile(appNotificationSettingsPath, "utf8");
  assert.match(appNotificationSettings, /window\.addEventListener\("owner-mobile-back-request", handleOwnerMobileBackRequest\)/);
  assert.match(appNotificationSettings, /event\.preventDefault\(\);[\s\S]*onBack\(\);/);
  assert.match(appNotificationSettings, /window\.removeEventListener\("owner-mobile-back-request", handleOwnerMobileBackRequest\)/);
  assert.match(await readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8"), /onBack=\{\(\) => updateActiveScreen\(null\)\}/);
});
