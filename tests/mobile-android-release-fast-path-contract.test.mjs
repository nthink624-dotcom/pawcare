import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const releaseScript = await readFile(
  new URL("../scripts/build-android-release.ps1", import.meta.url),
  "utf8",
);

test("Android release fast path performs one sync and one signed bundle build", () => {
  assert.match(releaseScript, /requiredServerUrl = "https:\/\/app\.petmanager\.co\.kr"/);
  assert.equal(
    releaseScript.match(/Arguments @\("cap", "sync", "android"\)/g)?.length,
    1,
  );
  assert.equal(releaseScript.match(/"bundleRelease"/g)?.length, 1);
  assert.doesNotMatch(releaseScript, /compileRelease|npm\.cmd" -Arguments @\("ci"\)|"clean"/);
  assert.match(releaseScript, /PETMANAGER_WEB_BUILD_EVIDENCE_SHA/);
  assert.match(releaseScript, /skipped_matching_sha_evidence/);
});

test("Android release fast path verifies the exact AAB instead of trusting build output", () => {
  assert.match(releaseScript, /bundleToolSha256/);
  assert.match(releaseScript, /dump manifest --bundle/);
  assert.match(releaseScript, /'\/manifest\/@package'/);
  assert.match(releaseScript, /'\/manifest\/@android:versionCode'/);
  assert.match(releaseScript, /'\/manifest\/@android:versionName'/);
  assert.match(releaseScript, /jarsignerExitCode = \$LASTEXITCODE/);
  assert.match(releaseScript, /keytool -printcert -jarfile/);
  assert.doesNotMatch(releaseScript, /jar verified/i);
  assert.match(releaseScript, /base\/assets\/capacitor\.config\.json/);
  assert.match(releaseScript, /StartsWith\("base\/assets\/"\)/);
  assert.match(releaseScript, /Get-ForbiddenEndpointHits/);
  assert.match(releaseScript, /Get-FileHash[\s\S]*SHA256/);
  assert.match(releaseScript, /ExpectedCertificateSha256/);
  assert.match(releaseScript, /forbiddenEndpointCount/);
});

test("Android release fast path reports timings and supports non-building verification", () => {
  assert.match(releaseScript, /\[switch\]\$VerifyOnly/);
  assert.match(releaseScript, /"web_build"/);
  assert.match(releaseScript, /"capacitor_sync"/);
  assert.match(releaseScript, /"bundle_release"/);
  assert.match(releaseScript, /"artifact_verify"/);
  assert.match(releaseScript, /stageSeconds/);
  assert.match(releaseScript, /mode = "verify_only"/);
});
