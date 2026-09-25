import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const policyPath = new URL("../src/lib/owner-mobile-back-navigation.ts", import.meta.url);
const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const activityPath = new URL("../android/app/src/main/java/kr/petmanager/owner/MainActivity.java", import.meta.url);
const pluginPath = new URL("../android/app/src/main/java/kr/petmanager/owner/OwnerBackNavigationPlugin.java", import.meta.url);
const [policySource, ownerApp, activity, plugin] = await Promise.all([
  readFile(policyPath, "utf8"),
  readFile(ownerAppPath, "utf8"),
  readFile(activityPath, "utf8"),
  readFile(pluginPath, "utf8"),
]);

function loadPolicy(platform = "web") {
  let registeredListener = null;
  let removeCalls = 0;
  const output = ts.transpileModule(policySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: () => ({
      Capacitor: { getPlatform: () => platform },
      registerPlugin: () => ({
        addListener: async (_eventName, listener) => {
          registeredListener = listener;
          return { remove: async () => { removeCalls += 1; } };
        },
      }),
    }),
  });
  return {
    policy: compiledModule.exports,
    state: {
      get registeredListener() { return registeredListener; },
      get removeCalls() { return removeCalls; },
    },
  };
}

test("the bridge listener is Android-only and removes the exact registered listener", async () => {
  const web = loadPolicy("web");
  assert.equal(await web.policy.addOwnerAndroidBackButtonListener(() => {}), null);
  assert.equal(web.state.registeredListener, null);

  const android = loadPolicy("android");
  let handled = 0;
  const remove = await android.policy.addOwnerAndroidBackButtonListener(() => { handled += 1; });
  assert.equal(typeof remove, "function");
  android.state.registeredListener();
  assert.equal(handled, 1);
  await remove();
  assert.equal(android.state.removeCalls, 1);
});

test("Android dismisses the IME before dispatching back and never exits the Activity", () => {
  assert.match(activity, /getOnBackPressedDispatcher\(\)\.addCallback/);
  assert.match(activity, /if \(dismissKeyboardIfVisible\(\)\) return;[\s\S]*dispatchOwnerBack\(\);/);
  assert.match(activity, /insets\.isVisible\(WindowInsetsCompat\.Type\.ime\(\)\)/);
  assert.match(activity, /controller\.hide\(WindowInsetsCompat\.Type\.ime\(\)\)/);
  assert.match(activity, /dispatchHardwareBack\(\);/);
  assert.match(plugin, /hasListeners\("backButton"\)/);
  assert.match(plugin, /notifyListeners\("backButton", new JSObject\(\)\)/);
  assert.doesNotMatch(activity, /super\.onBackPressed\(|finish\(|finishAndRemoveTask\(/);
  assert.doesNotMatch(plugin, /exitApp|finish\(|finishAndRemoveTask\(/);
  assert.doesNotMatch(policySource, /exitApp|shouldExitOwnerApp|OWNER_ROOT_BACK_CONFIRMATION_MS/);
});

test("owner back closes the topmost layer, then detail, then tab while preserving the root", () => {
  const handlerStart = ownerApp.indexOf("hardwareBackHandlerRef.current = () => {");
  const handlerEnd = ownerApp.indexOf("\n  useEffect(() => {", handlerStart);
  const handler = ownerApp.slice(handlerStart, handlerEnd);
  const orderedChecks = [
    "if (isTesterFeedbackHubOpen)",
    "if (isOwnerContextMenuOpen)",
    "if (mobilePhotoStatusAction)",
    "if (mobileGroomingStartAction)",
    "if (careReportEntryError)",
    "if (careReportAppointmentId)",
    "if (modal)",
    "if (isHomeDatePickerOpen)",
    "if (isBookingDatePickerOpen)",
    "if (isVisitCalendarOpen)",
    "if (isShopPickerOpen)",
    "if (settingsEntryScreen)",
    "if (selectedCustomerPetId || selectedGuardianId)",
    "activeTabBackStackRef.current.pop()",
    "if (activeTab !== \"home\")",
    "window.location.pathname !== \"/owner/mobile\"",
  ];
  let previousIndex = -1;
  for (const token of orderedChecks) {
    const currentIndex = handler.indexOf(token);
    assert.ok(currentIndex > previousIndex, `${token} should follow the previous back layer`);
    previousIndex = currentIndex;
  }
  assert.match(handler, /setSelectedCustomerPetId\(null\);\s+setSelectedGuardianId\(null\);/);
  assert.match(handler, /window\.location\.replace\("\/owner\/mobile"\)/);
  assert.doesNotMatch(handler, /exitOwnerAndroidApp|shouldExitOwnerApp|history\.back\(|router\.back\(/);
});

test("settings subviews may consume one back request without reintroducing root-exit UI", () => {
  assert.match(ownerApp, /new CustomEvent\("owner-mobile-back-request", \{ cancelable: true \}\)/);
  assert.match(ownerApp, /if \(backRequest\.defaultPrevented\) return;/);
  assert.match(ownerApp, /setSettingsEntryScreen\(null\)/);
  assert.doesNotMatch(ownerApp, /owner-root-back-exit-notice|한 번 더 누르면 앱이 종료됩니다/);
});
