import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const [timingSource, mediaClientSource, ownerAppSource, cameraSource, nativeCameraSource] = await Promise.all([
  readFile(new URL("../src/lib/media/owner-media-timing.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/media/owner-media-client.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/media/external-camera.ts", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/java/kr/petmanager/owner/ExternalCameraPlugin.java", import.meta.url), "utf8"),
]);
const timingJavaScript = stripTypeScriptTypes(timingSource, { mode: "transform" });
const timingModuleUrl = `data:text/javascript;base64,${Buffer.from(timingJavaScript).toString("base64")}`;
const { traceOwnerMediaStep } = await import(timingModuleUrl);

test("photo timing emits only stage, outcome, duration, and safe error class", async () => {
  const events = [];
  assert.equal(await traceOwnerMediaStep("upload-original", async () => "ok", (event) => events.push(event)), "ok");
  await assert.rejects(
    traceOwnerMediaStep("complete-upload-readback", async () => { throw new TypeError("private detail"); }, (event) => events.push(event)),
    /private detail/,
  );
  assert.deepEqual(events.map(({ step, outcome, errorName }) => ({ step, outcome, errorName })), [
    { step: "upload-original", outcome: "success", errorName: undefined },
    { step: "complete-upload-readback", outcome: "failure", errorName: "TypeError" },
  ]);
  for (const event of events) {
    assert.equal(typeof event.durationMs, "number");
    assert.deepEqual(Object.keys(event).sort(), event.outcome === "success"
      ? ["durationMs", "outcome", "step"]
      : ["durationMs", "errorName", "outcome", "step"]);
  }
});

test("status success waits for original upload readback and commit, not the AI-ready derivative", () => {
  const compressionIndex = mediaClientSource.indexOf('traceOwnerMediaStep("compress-original"');
  const intentIndex = mediaClientSource.indexOf('traceOwnerMediaStep("create-upload-intent"');
  const uploadIndex = mediaClientSource.indexOf('traceOwnerMediaStep("upload-original"');
  const readbackIndex = mediaClientSource.indexOf('traceOwnerMediaStep("complete-upload-readback"');
  const deferredVariantIndex = mediaClientSource.indexOf("void createVariant().catch");
  assert.ok(compressionIndex < intentIndex && intentIndex < uploadIndex && uploadIndex < readbackIndex);
  assert.ok(readbackIndex < deferredVariantIndex);
  assert.match(ownerAppSource, /waitForProviderReadyVariant: false/);
  assert.match(ownerAppSource, /traceOwnerMediaStep\("appointment-status-commit"/);
  assert.match(ownerAppSource, /if \(!committed\) return/);
});

test("new Android shells hand off a cache file without Base64 while old shells remain compatible", () => {
  assert.match(nativeCameraSource, /response\.put\("path", pendingOutputFile\.getAbsolutePath\(\)\)/);
  assert.match(nativeCameraSource, /public void release\(PluginCall call\)/);
  assert.doesNotMatch(nativeCameraSource, /Base64\.encode|ByteArrayOutputStream|response\.put\("base64"/);
  assert.match(cameraSource, /const localFilePath = result\.path[\s\S]*Capacitor\.convertFileSrc\(localFilePath\)/);
  assert.match(cameraSource, /ExternalCamera\.release\(\{ cacheFileName: result\.cacheFileName \}\)/);
  assert.match(cameraSource, /legacy-base64-decode/);
});
