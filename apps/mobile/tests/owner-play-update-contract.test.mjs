import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import ts from "typescript";

const [policySource, controllerSource, componentSource, nativeSource, mainActivitySource, gradleSource, settingsSource] =
  await Promise.all([
    readFile(new URL("../src/lib/updates/owner-play-update-policy.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/updates/owner-play-update.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/owner/owner-app-update.tsx", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/OwnerPlayUpdatePlugin.java", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/MainActivity.java", import.meta.url), "utf8"),
    readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
    readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8"),
  ]);

const policyOutput = ts.transpileModule(policySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const policyModule = { exports: {} };
Function("module", "exports", policyOutput)(policyModule, policyModule.exports);

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    entries() {
      return [...values.entries()];
    },
  };
}

function createControllerRuntime({ storage, installedVersionCode, nativeState }) {
  const timers = [];
  const calls = { check: 0, installed: 0 };
  const plugin = {
    async getInstalledState() {
      calls.installed += 1;
      return { supported: true, installedVersionCode };
    },
    async checkForUpdate() {
      calls.check += 1;
      return nativeState;
    },
    async startFlexibleUpdate() {
      return { started: true, accepted: true };
    },
    async completeFlexibleUpdate() {
      return { requested: true };
    },
    async addListener() {
      return { remove: async () => undefined };
    },
  };
  const window = {
    localStorage: storage,
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeout() {},
  };
  const document = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  const controllerOutput = ts.transpileModule(controllerSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const controllerModule = { exports: {} };
  const context = vm.createContext({ console, document, window });
  const load = new vm.Script(`(function(module, exports, require) { ${controllerOutput}\n})`);
  load.runInContext(context)(controllerModule, controllerModule.exports, (request) => {
    if (request === "@capacitor/core") {
      return {
        Capacitor: {
          isNativePlatform: () => true,
          getPlatform: () => "android",
        },
        registerPlugin: () => plugin,
      };
    }
    if (request === "@/lib/updates/owner-play-update-policy") return policyModule.exports;
    throw new Error(`Unexpected module: ${request}`);
  });
  return { calls, exports: controllerModule.exports, timers };
}

async function flushControllerWork() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("update prompt and install markers are permanent target-version keys", () => {
  const firstPrompt = policyModule.exports.ownerPlayUpdatePromptStorageKey(9);
  const secondPrompt = policyModule.exports.ownerPlayUpdatePromptStorageKey(10);

  assert.notEqual(firstPrompt, secondPrompt);
  assert.match(firstPrompt, /prompted\.v1:9$/);
  assert.match(policyModule.exports.ownerPlayUpdateInstallNoticeStorageKey(9), /installNotice\.v1:9$/);
});

test("later is persisted once per target across an app restart while Settings remains available", async () => {
  const storage = createStorage();
  const nativeState = {
    supported: true,
    checked: true,
    available: true,
    downloaded: false,
    installedVersionCode: 8,
    targetVersionCode: 9,
  };
  const firstRun = createControllerRuntime({ storage, installedVersionCode: 8, nativeState });
  const disposeFirstRun = firstRun.exports.startOwnerPlayUpdateCoordinator();
  assert.equal(firstRun.timers[0].delay, 5_000);
  firstRun.timers[0].callback();
  await flushControllerWork();
  assert.equal(firstRun.exports.getOwnerPlayUpdateSnapshot().promptTargetVersionCode, 9);
  assert.equal(firstRun.exports.getOwnerPlayUpdateSnapshot().available, true);

  firstRun.exports.dismissOwnerPlayUpdatePrompt(9);
  disposeFirstRun();

  const secondRun = createControllerRuntime({ storage, installedVersionCode: 8, nativeState });
  secondRun.exports.startOwnerPlayUpdateCoordinator();
  secondRun.timers[0].callback();
  await flushControllerWork();

  assert.equal(secondRun.exports.getOwnerPlayUpdateSnapshot().promptTargetVersionCode, null);
  assert.equal(secondRun.exports.getOwnerPlayUpdateSnapshot().available, true);
  assert.equal(secondRun.calls.installed, 1);
  assert.equal(secondRun.calls.check, 0);
  assert.deepEqual(
    storage.entries().map(([key]) => key).sort(),
    ["petmanager.ownerPlayUpdate.cache.v1", "petmanager.ownerPlayUpdate.prompted.v1:9"],
  );
});

test("a completed update invalidates the prior target cache before querying Play again", async () => {
  const storage = createStorage();
  storage.setItem("petmanager.ownerPlayUpdate.cache.v1", JSON.stringify({
    checkedAt: Date.now(),
    available: true,
    downloaded: false,
    installedVersionCode: 8,
    targetVersionCode: 9,
  }));
  const updatedRun = createControllerRuntime({
    storage,
    installedVersionCode: 9,
    nativeState: {
      supported: true,
      checked: true,
      available: false,
      downloaded: false,
      installedVersionCode: 9,
    },
  });

  updatedRun.exports.startOwnerPlayUpdateCoordinator();
  updatedRun.timers[0].callback();
  await flushControllerWork();

  assert.deepEqual(JSON.parse(JSON.stringify(updatedRun.exports.getOwnerPlayUpdateSnapshot())), {
    available: false,
    downloaded: false,
    targetVersionCode: null,
    promptTargetVersionCode: null,
    installNoticeTargetVersionCode: null,
    starting: false,
  });
  assert.equal(updatedRun.calls.installed, 1);
  assert.equal(updatedRun.calls.check, 1);
});

test("availability requires a checked Play-supported higher target", () => {
  const available = policyModule.exports.normalizeOwnerPlayUpdateAvailability({
    supported: true,
    checked: true,
    available: true,
    downloaded: false,
    installedVersionCode: 8,
    targetVersionCode: 9,
  });

  assert.deepEqual(available, {
    available: true,
    downloaded: false,
    installedVersionCode: 8,
    targetVersionCode: 9,
  });
  assert.equal(
    policyModule.exports.normalizeOwnerPlayUpdateAvailability({
      supported: false,
      checked: true,
      available: true,
      downloaded: false,
      installedVersionCode: 8,
      targetVersionCode: 9,
    }),
    null,
  );
  assert.deepEqual(
    policyModule.exports.normalizeOwnerPlayUpdateAvailability({
      supported: true,
      checked: true,
      available: true,
      downloaded: false,
      installedVersionCode: 9,
      targetVersionCode: 9,
    }),
    { available: false, downloaded: false, installedVersionCode: 9, targetVersionCode: null },
  );
});

test("automatic checks are delayed, cached, and never wired into booking", () => {
  assert.equal(policyModule.exports.OWNER_PLAY_UPDATE_CHECK_DELAY_MS, 5_000);
  assert.equal(policyModule.exports.isOwnerPlayUpdateCacheFresh(1_000, 2_000), true);
  assert.match(controllerSource, /window\.setTimeout/);
  assert.match(controllerSource, /isOwnerPlayUpdateCacheFresh/);
  assert.match(controllerSource, /Capacitor\.isNativePlatform\(\).*Capacitor\.getPlatform\(\) === "android"/s);
  assert.doesNotMatch(controllerSource, /\/api\/appointments|\/api\/auth/);
});

test("native bridge is Play-only, flexible, resumable, and registered", () => {
  assert.match(gradleSource, /com\.google\.android\.play:app-update:2\.1\.0/);
  assert.match(nativeSource, /"com\.android\.vending"\.equals\(installer\)/);
  assert.match(nativeSource, /public void getInstalledState\(PluginCall call\)/);
  assert.match(nativeSource, /AppUpdateType\.FLEXIBLE/);
  assert.doesNotMatch(nativeSource, /AppUpdateType\.IMMEDIATE/);
  assert.match(nativeSource, /registerListener\(installStateListener\)/);
  assert.match(nativeSource, /InstallStatus\.DOWNLOADED/);
  assert.match(nativeSource, /completeUpdate\(\)/);
  assert.match(mainActivitySource, /registerPlugin\(OwnerPlayUpdatePlugin\.class\)/);
  assert.match(gradleSource, /PETMANAGER_ANDROID_VERSION_CODE'\) \?: '1'/);
  assert.match(gradleSource, /PETMANAGER_ANDROID_VERSION_NAME'\) \?: '1\.0'/);
});

test("calm UI offers only update or later and keeps a Settings badge", () => {
  const promptStart = componentSource.indexOf("state.promptTargetVersionCode !== null");
  const promptEnd = componentSource.indexOf("state.installNoticeTargetVersionCode !== null", promptStart);
  const promptSource = componentSource.slice(promptStart, promptEnd);

  assert.match(promptSource, />\s*나중에\s*</);
  assert.match(promptSource, />\s*업데이트\s*</);
  assert.match(promptSource, /text-\[16px\]/);
  assert.match(promptSource, /min-h-11/);
  assert.doesNotMatch(promptSource, /IMMEDIATE|강제|필수/);
  assert.match(settingsSource, /업데이트 가능/);
  assert.match(settingsSource, /설치 준비됨/);
});
