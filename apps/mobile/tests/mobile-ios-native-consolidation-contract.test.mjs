import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../../../", import.meta.url);
const file = (path) => new URL(path, repoRoot);

const [mobilePackage, rootPackage, legacyPackage, capacitorConfig, xcodeProject, bridge, rootWorkflow, webWorkflow] =
  await Promise.all([
    readFile(file("apps/mobile/package.json"), "utf8"),
    readFile(file("package.json"), "utf8"),
    readFile(file("apps/owner-mobile/package.json"), "utf8"),
    readFile(file("apps/mobile/capacitor.config.ts"), "utf8"),
    readFile(file("apps/mobile/ios/App/App.xcodeproj/project.pbxproj"), "utf8"),
    readFile(file("apps/mobile/ios/App/App/OwnerBridgeViewController.swift"), "utf8"),
    readFile(file("codemagic.yaml"), "utf8"),
    readFile(file("apps/web/codemagic.yaml"), "utf8"),
  ]);

test("iOS native project and safe-area bridge are owned by apps/mobile", async () => {
  const mobile = JSON.parse(mobilePackage);
  const root = JSON.parse(rootPackage);
  const legacy = JSON.parse(legacyPackage);

  assert.equal(mobile.dependencies["@capacitor/ios"], "^8.4.2");
  assert.equal(mobile.scripts["cap:sync:ios"], "cap sync ios");
  assert.equal(mobile.scripts["cap:open:ios"], "cap open ios");
  assert.equal(root.scripts["ios:sync"], "npm run cap:sync:ios --workspace=@petmanager/mobile");
  assert.equal(root.scripts["ios:open"], "npm run cap:open:ios --workspace=@petmanager/mobile");
  assert.equal(mobile.scripts["test:ios-native-contract"], "node --test tests/mobile-ios-native-consolidation-contract.test.mjs");
  assert.match(capacitorConfig, /appId: "kr\.petmanager\.owner"/);
  assert.match(xcodeProject, /PRODUCT_BUNDLE_IDENTIFIER = kr\.petmanager\.owner;/);
  assert.match(bridge, /pm-ios-safe-area-style/);
  assert.match(bridge, /view\.safeAreaInsets/);
  assert.equal(legacy.dependencies["@capacitor/ios"], undefined);
  assert.equal(legacy.scripts["sync:ios"], undefined);

  await access(file("apps/mobile/ios/App/App.xcodeproj/project.pbxproj"));
  await assert.rejects(access(file("apps/owner-mobile/ios/App/App.xcodeproj/project.pbxproj")));
});

test("both App Store workflows use the canonical iOS project and owner route", () => {
  for (const workflow of [rootWorkflow, webWorkflow]) {
    assert.match(workflow, /MOBILE_APP_DIR: "apps\/mobile"/);
    assert.match(workflow, /CAPACITOR_SERVER_URL: "https:\/\/app\.petmanager\.co\.kr\/owner\/mobile"/);
    assert.match(workflow, /XCODE_PROJECT: "apps\/mobile\/ios\/App\/App\.xcodeproj"/);
    assert.match(workflow, /npm run ios:sync/);
    assert.match(workflow, /\$MOBILE_APP_DIR\/ios\/App\/App\/OwnerBridgeViewController\.swift/);
    assert.match(workflow, /apps\/mobile\/ios\/App\/build\/ios\/ipa/);
    assert.doesNotMatch(workflow, /apps\/owner-mobile\/ios/);
  }
});
