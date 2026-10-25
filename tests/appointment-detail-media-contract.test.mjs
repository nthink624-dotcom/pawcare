import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [source, mediaClientSource] = await Promise.all([
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/media/owner-media-client.ts", import.meta.url), "utf8"),
]);

test("appointment detail resolves and refreshes media URLs through the shared batch helper", () => {
  const detailStart = source.indexOf("function AppointmentDetailMediaHistory");
  const detailEnd = source.indexOf("function AppointmentDetail(", detailStart);
  const detailSource = source.slice(detailStart, detailEnd);

  assert.match(detailSource, /getOwnerMediaSignedUrlsWithOriginalFallback\(/);
  assert.match(detailSource, /createOwnerMediaSignedUrlRecovery\(/);
  assert.match(detailSource, /onError=\{\(\) => signedUrlRecoveryRef\.current\?\.enqueue\(item\.mediaAsset\.id, signedUrl\)\}/);
  assert.match(detailSource, /abortController\.abort\(\)/);
  assert.doesNotMatch(detailSource, /\/api\/owner\/media\/signed-urls/);
  assert.doesNotMatch(detailSource, /\/api\/owner\/media\/signed-url\?/);
  assert.match(detailSource, /signedUrlByAssetId/);

  const helperStart = mediaClientSource.indexOf("export async function getOwnerMediaSignedUrlsWithOriginalFallback");
  const helperEnd = mediaClientSource.indexOf("export function createOwnerMediaSignedUrlRecovery", helperStart);
  const helperSource = mediaClientSource.slice(helperStart, helperEnd);
  assert.match(helperSource, /requestOwnerMediaSignedUrls\(shopId, uniqueIds, variant, options\)/);
  assert.match(helperSource, /requestOwnerMediaSignedUrls\(shopId, missingIds, "original", options\)/);
  assert.doesNotMatch(helperSource, /for \([^)]*missingIds[^)]*\)[\s\S]*requestOwnerMediaSignedUrls/);
});

test("appointment detail includes canonical start and completion media kinds", () => {
  const detailStart = source.indexOf("function AppointmentDetailMediaHistory");
  const detailEnd = source.indexOf("function AppointmentDetail(", detailStart);
  const detailSource = source.slice(detailStart, detailEnd);

  assert.match(detailSource, /"grooming_before"/);
  assert.match(detailSource, /"grooming_after"/);
  assert.match(detailSource, /"grooming_result"/);
});
