import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PriceGuidePhotoLifecycleError,
  readPriceGuidePhotoSupportCode,
  reportPriceGuidePhotoLifecycle,
} from "../../src/lib/media/price-guide-photo-lifecycle.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const REQUEST_FINGERPRINT = "a".repeat(64);
const RECEIPT_FINGERPRINT = "b".repeat(64);

test("lifecycle telemetry keeps only one-way correlation, bounded counts, safe class, timing, and hard-purge residue", () => {
  const calls = [];
  const rawSecrets = {
    mediaAssetId: "11111111-1111-4111-8111-111111111111",
    objectPath: "shops/private/photo.webp",
    cleanupProof: "secret-cleanup-proof",
    providerPayload: "owner@example.com 010-1234-5678",
  };
  const accepted = reportPriceGuidePhotoLifecycle({
    requestCorrelationFingerprint: REQUEST_FINGERPRINT,
    stage: "cleanup",
    status: "succeeded",
    elapsedMs: 123.7,
    counts: { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 1, cleanupCount: 1 },
    receipt: {
      hardPurged: true,
      receiptFingerprint: RECEIPT_FINGERPRINT,
      objectResidueCount: 0,
      metadataResidueCount: 0,
    },
  }, (serialized) => calls.push(serialized));

  assert.equal(accepted, true);
  assert.equal(calls.length, 1);
  const logged = JSON.parse(calls[0]);
  assert.deepEqual(Object.keys(logged).sort(), [
    "counts",
    "elapsedMs",
    "event",
    "hardPurge",
    "requestCorrelationFingerprint",
    "stage",
    "status",
    "supportCode",
  ]);
  assert.equal(logged.elapsedMs, 124);
  assert.deepEqual(logged.counts, { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 1, cleanupCount: 1 });
  assert.deepEqual(logged.hardPurge, {
    hardPurged: true,
    receiptFingerprint: RECEIPT_FINGERPRINT,
    objectResidueCount: 0,
    metadataResidueCount: 0,
  });
  assert.match(logged.supportCode, /^PG-[A-F0-9]{12}$/);
  for (const raw of Object.values(rawSecrets)) assert.doesNotMatch(calls[0], new RegExp(raw.replaceAll("/", "\\/")));
});

test("unsafe fingerprints, residue, and failure classes are rejected without logging", () => {
  const calls = [];
  const base = {
    requestCorrelationFingerprint: REQUEST_FINGERPRINT,
    stage: "provider",
    status: "failed",
    elapsedMs: 20,
    counts: { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 1, cleanupCount: 1 },
    failureClass: "provider_rejected",
  };
  assert.equal(reportPriceGuidePhotoLifecycle({ ...base, requestCorrelationFingerprint: "raw-id" }, (value) => calls.push(value)), false);
  assert.equal(reportPriceGuidePhotoLifecycle({ ...base, failureClass: "raw-provider-error" }, (value) => calls.push(value)), false);
  assert.equal(reportPriceGuidePhotoLifecycle({
    ...base,
    receipt: { hardPurged: true, receiptFingerprint: RECEIPT_FINGERPRINT, objectResidueCount: 1, metadataResidueCount: 0 },
  }, (value) => calls.push(value)), false);
  assert.deepEqual(calls, []);
});

test("support UI reads only the secret-free request code", () => {
  const error = new PriceGuidePhotoLifecycleError(REQUEST_FINGERPRINT, "upload");
  assert.equal(readPriceGuidePhotoSupportCode(error), error.supportCode);
  assert.equal(readPriceGuidePhotoSupportCode(new Error(`safe 문의 코드: ${error.supportCode}`)), error.supportCode);
  assert.equal(readPriceGuidePhotoSupportCode(new Error("raw cleanupProof owner@example.com")), null);
  assert.doesNotMatch(JSON.stringify(error), /mediaAssetId|objectPath|cleanupProof|providerPayload|token/);
});

test("source binds the pre-intent fingerprint to upload, provider, cleanup, and one cleanup memo", async () => {
  const [client, component, uploadRoute, completeRoute, importRoute, mediaService] = await Promise.all([
    source("src/lib/media/owner-media-client.ts"),
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/app/api/owner/media/upload-intents/route.ts"),
    source("src/app/api/owner/media/complete/route.ts"),
    source("src/app/api/owner/price-guide-photo-import/route.ts"),
    source("src/server/media-service.ts"),
  ]);
  const flow = client.slice(client.indexOf("export async function createOwnerMediaAssetFromFile"));
  assert.ok(flow.indexOf("createPriceGuideRequestCorrelationFingerprint") < flow.indexOf("createUploadIntent"));
  assert.match(client, /stage: "upload_intent"[\s\S]*stage: "upload"/);
  assert.match(component, /stage: "provider"/);
  assert.match(client, /getOrCreatePriceGuideCleanupRequest\([\s\S]*binding\.correlationFingerprint/);
  assert.match(uploadRoute, /createPriceGuideRequestCorrelationFingerprintForServer[\s\S]*expected !== suppliedRequestFingerprint/);
  assert.match(completeRoute, /priceGuideRequestCorrelationFingerprint[\s\S]*stage: "upload"/);
  assert.match(importRoute, /priceGuideRequestCorrelationFingerprint[\s\S]*stage: "cleanup"[\s\S]*stage: "provider"/);
  assert.match(mediaService, /priceGuideRequestCorrelationFingerprint/);
  assert.doesNotMatch(
    [client, component, uploadRoute, completeRoute, importRoute].join("\n"),
    /console\.(?:log|info|warn|error)\([^)]*(?:mediaAssetId|storage_path|cleanupProof|providerPayload|signedUrl|token)/,
  );
});
