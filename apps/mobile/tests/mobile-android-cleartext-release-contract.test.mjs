import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const optionalSource = (path) => source(path).catch((error) => {
  if (error?.code === "ENOENT") return null;
  throw error;
});

test("release manifest blocks cleartext while debug limits the exception to loopback hosts", async () => {
  const [mainManifest, debugManifest, debugNetworkSecurity, capacitorConfig] = await Promise.all([
    source("android/app/src/main/AndroidManifest.xml"),
    source("android/app/src/debug/AndroidManifest.xml"),
    source("android/app/src/debug/res/xml/debug_network_security_config.xml"),
    source("capacitor.config.ts"),
  ]);

  assert.match(mainManifest, /<application[\s\S]*android:usesCleartextTraffic="false"/);
  assert.doesNotMatch(mainManifest, /networkSecurityConfig/);
  assert.match(debugManifest, /android:networkSecurityConfig="@xml\/debug_network_security_config"/);
  assert.match(debugNetworkSecurity, /<base-config cleartextTrafficPermitted="false"\s*\/>/);
  assert.match(debugNetworkSecurity, /<domain-config cleartextTrafficPermitted="true">[\s\S]*>127\.0\.0\.1<\/[\s\S]*>localhost<\//);
  assert.doesNotMatch(debugNetworkSecurity, /includeSubdomains="true"|<certificates|<trust-anchors/);

  // The app loads the hosted owner screen; release syncs must use HTTPS and never enable cleartext.
  assert.match(capacitorConfig, /serverUrl\.startsWith\("http:\/\/"\)/);
  assert.match(capacitorConfig, /cleartext: capacitorBuildMode !== "release" && serverUrl\.startsWith\("http:\/\/"\)/);
  assert.match(capacitorConfig, /Mobile release server URL must use a production HTTPS endpoint\./);
});

test("synced Capacitor config only allows cleartext for a loopback development origin", async (t) => {
  const generatedConfig = await optionalSource("android/app/src/main/assets/capacitor.config.json");
  if (generatedConfig === null) {
    t.skip("capacitor.config.json is not synced (run cap sync android)");
    return;
  }
  const effectiveConfig = JSON.parse(generatedConfig);
  assert.equal(effectiveConfig.appId, "kr.petmanager.owner");
  assert.equal(effectiveConfig.android?.loggingBehavior, "none");
  const serverUrl = new URL(effectiveConfig.server?.url);
  if (effectiveConfig.server?.cleartext === true) {
    assert.ok(["127.0.0.1", "localhost"].includes(serverUrl.hostname), "cleartext is only for loopback development syncs");
  } else {
    assert.equal(serverUrl.protocol, "https:");
  }
});
