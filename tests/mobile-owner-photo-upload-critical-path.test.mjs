import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const [timingSource, mediaClientSource, compressionSource, ownerAppSource] = await Promise.all([
  readFile(new URL("../src/lib/media/owner-media-timing.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/media/owner-media-client.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/media/client-image-compression.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
]);
const timingJavaScript = stripTypeScriptTypes(timingSource, { mode: "transform" });
const timingModuleUrl = `data:text/javascript;base64,${Buffer.from(timingJavaScript).toString("base64")}`;
const { markOwnerMediaStep, traceOwnerMediaStep } = await import(timingModuleUrl);

test("photo timing emits only a PII-free stage result, duration, and safe error class", async () => {
  const events = [];
  assert.equal(await traceOwnerMediaStep("upload-original", async () => "ok", (event) => events.push(event)), "ok");
  markOwnerMediaStep("appointment-row-apply", (event) => events.push(event));
  await assert.rejects(
    traceOwnerMediaStep("complete-upload-readback", async () => { throw new TypeError("private detail"); }, (event) => events.push(event)),
    /private detail/,
  );
  assert.deepEqual(events.map(({ step, outcome, errorName }) => ({ step, outcome, errorName })), [
    { step: "upload-original", outcome: "success", errorName: undefined },
    { step: "appointment-row-apply", outcome: "success", errorName: undefined },
    { step: "complete-upload-readback", outcome: "failure", errorName: "TypeError" },
  ]);
  for (const event of events) {
    assert.deepEqual(Object.keys(event).sort(), event.outcome === "success"
      ? ["durationMs", "outcome", "step"]
      : ["durationMs", "errorName", "outcome", "step"]);
    assert.equal(typeof event.durationMs, "number");
  }
  assert.doesNotMatch(timingSource, /shopId|appointmentId|guardianId|petId|fileName|message:/);
});

test("provider compression overlaps original I/O but derivative requests wait for durable original readback", () => {
  const compressionIndex = mediaClientSource.indexOf('traceOwnerMediaStep("compress-original"');
  const derivativeCompressionIndex = mediaClientSource.indexOf('traceOwnerMediaStep("compress-provider-ready"');
  const intentIndex = mediaClientSource.indexOf('traceOwnerMediaStep("create-upload-intent"');
  const uploadIndex = mediaClientSource.indexOf('traceOwnerMediaStep("upload-original"');
  const readbackIndex = mediaClientSource.indexOf('traceOwnerMediaStep(\n    "complete-upload-readback"');
  const derivativeIndex = mediaClientSource.indexOf("const task = createProviderReadyVariant", readbackIndex);
  assert.ok(compressionIndex >= 0 && compressionIndex < intentIndex);
  assert.ok(compressionIndex < derivativeCompressionIndex && derivativeCompressionIndex < intentIndex);
  assert.ok(intentIndex < uploadIndex && uploadIndex < readbackIndex);
  assert.ok(readbackIndex < derivativeIndex);
  assert.match(mediaClientSource, /createProviderReadyVariant\(context, intent\.mediaAsset\.id, providerReadyCompression\)\.catch\(\(\) => null\)/);
  assert.match(mediaClientSource, /waitForProviderReadyVariant === false\) providerReady = task/);
  assert.match(compressionSource, /createPetmanagerImageCompressionSession/);
  assert.match(compressionSource, /compressImageForPetmanagerFromSession\(session, \{/);
  const fromSessionStart = compressionSource.indexOf("export async function compressImageVariantsForPetmanagerFromSession");
  const fromSessionEnd = compressionSource.indexOf("export async function compressImageVariantsForPetmanager(", fromSessionStart);
  assert.doesNotMatch(compressionSource.slice(fromSessionStart, fromSessionEnd), /loadImage\(/);
});

test("status PATCH is ordered after durable identity validation and IndexedDB preservation", () => {
  const start = ownerAppSource.indexOf("async function updateAppointmentStatusWithMobilePhoto(");
  const end = ownerAppSource.indexOf("\n  async function handleMobilePhotoStatusFile", start);
  const source = ownerAppSource.slice(start, end);
  const persistIndex = source.indexOf("stagePendingOwnerStatusPhoto(pending)");
  const claimIndex = source.indexOf("claimPendingOwnerStatusPhotoUpload", persistIndex);
  const uploadIndex = source.indexOf("await createOwnerMediaAssetFromFile", claimIndex);
  const validateIndex = source.indexOf("isPendingDurableAssetReusable(pending, uploaded.mediaAsset)", uploadIndex);
  const durableIndex = source.indexOf("markPendingOwnerStatusPhotoDurable", validateIndex);
  const commitIndex = source.indexOf('traceOwnerMediaStep(\n        "appointment-status-commit"', durableIndex);
  const clearIndex = source.indexOf("clearPendingOwnerStatusPhoto(binding)", commitIndex);
  assert.ok(persistIndex >= 0 && persistIndex < claimIndex);
  assert.ok(claimIndex < uploadIndex && uploadIndex < validateIndex);
  assert.ok(validateIndex < durableIndex && durableIndex < commitIndex && commitIndex < clearIndex);
  assert.match(source.slice(commitIndex, clearIndex), /mediaAssetIds: \[uploaded\.mediaAsset\.id\]/);
  assert.match(source, /waitForProviderReadyVariant: false/);
  assert.match(source, /mobilePhotoUploadInFlightRef\.current = true/);
  assert.match(source, /traceOwnerMediaStep\(\s*"claim-pending-upload"/);
  assert.match(source, /traceOwnerMediaStep\(\s*"persist-durable-local"/);
  assert.match(source, /traceOwnerMediaStep\("clear-pending-local"/);
});

test("provider-ready URL lookup falls back to the completed original in one extra batch", () => {
  const helperStart = mediaClientSource.indexOf("export async function getOwnerMediaSignedUrlsWithOriginalFallback");
  const helperEnd = mediaClientSource.indexOf("export async function createOwnerShopProfileImageFromFile", helperStart);
  const helper = mediaClientSource.slice(helperStart, helperEnd);
  assert.match(helper, /requestOwnerMediaSignedUrls\(shopId, uniqueIds, variant\)/);
  assert.match(helper, /requestOwnerMediaSignedUrls\(shopId, missingIds, "original"\)/);
  assert.doesNotMatch(helper, /for \([^)]*missingIds[^)]*\)[\s\S]*requestOwnerMediaSignedUrls/);
  assert.match(mediaClientSource, /if \(variant === "original"\) throw error;[\s\S]*requestSignedUrl\("original"\)/);
});
