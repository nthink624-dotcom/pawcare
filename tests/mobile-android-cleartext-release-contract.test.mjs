import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("release manifest blocks cleartext while debug limits the exception to loopback hosts", async () => {
  const [mainManifest, debugManifest, debugNetworkSecurity, capacitorConfig, generatedConfig] = await Promise.all([
    source("android/app/src/main/AndroidManifest.xml"),
    source("android/app/src/debug/AndroidManifest.xml"),
    source("android/app/src/debug/res/xml/debug_network_security_config.xml"),
    source("capacitor.config.ts"),
    source("android/app/src/main/assets/capacitor.config.json"),
  ]);

  assert.match(mainManifest, /<application[\s\S]*android:usesCleartextTraffic="false"/);
  assert.doesNotMatch(mainManifest, /networkSecurityConfig/);
  assert.match(debugManifest, /android:networkSecurityConfig="@xml\/debug_network_security_config"/);
  assert.match(debugNetworkSecurity, /<base-config cleartextTrafficPermitted="false"\s*\/>/);
  assert.match(debugNetworkSecurity, /<domain-config cleartextTrafficPermitted="true">[\s\S]*>127\.0\.0\.1<\/[\s\S]*>localhost<\//);
  assert.doesNotMatch(debugNetworkSecurity, /includeSubdomains="true"|<certificates|<trust-anchors/);

  assert.match(capacitorConfig, /serverUrl\.startsWith\("http:\/\/"\)/);
  const effectiveProductionConfig = JSON.parse(generatedConfig);
  assert.equal(effectiveProductionConfig.appId, "kr.petmanager.owner");
  assert.equal(effectiveProductionConfig.android?.loggingBehavior, "none");
  assert.equal("server" in effectiveProductionConfig, false);
});
