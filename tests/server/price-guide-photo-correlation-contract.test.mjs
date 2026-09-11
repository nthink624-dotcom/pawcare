import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  bindPriceGuideUploadCleanup,
  buildPriceGuideHardPurgeRequest,
  createAnonymousPriceGuideUploadCorrelation,
  createPriceGuidePhotoSupportCode,
  createPriceGuideRequestCorrelationFingerprint,
  getOrCreatePriceGuideCleanupRequest,
  validatePriceGuideHardPurgeReceipt,
} from "../../src/lib/media/price-guide-upload-correlation.ts";
import {
  createPriceGuideSourceCorrelationBinding,
  createPriceGuideRequestCorrelationFingerprintForServer,
  createPriceGuideSourceHardPurgeReceipt,
  derivePriceGuideSourceMediaAssetId,
  verifyPriceGuideSourceCleanupProof,
} from "../../src/server/price-guide-photo-cleanup-decision.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const CORRELATION_ID = "11111111-1111-4111-8111-111111111111";
const SHOP_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "deterministic-correlation-contract-secret";

function createBinding() {
  const requestCorrelationFingerprint = createPriceGuideRequestCorrelationFingerprintForServer(CORRELATION_ID);
  const mediaAssetId = derivePriceGuideSourceMediaAssetId({
    secret: SECRET,
    shopId: SHOP_ID,
    clientCorrelationId: CORRELATION_ID,
  });
  return createPriceGuideSourceCorrelationBinding({
    secret: SECRET,
    shopId: SHOP_ID,
    mediaAssetId,
    clientCorrelationId: CORRELATION_ID,
    requestCorrelationFingerprint,
    bucket: "owner-media",
    storagePath: `shops/${SHOP_ID}/price-guide-source/${mediaAssetId}.webp`,
  });
}

test("pre-upload correlation is anonymous, one-way, and maps to one deterministic asset lifecycle", async () => {
  let randomCalls = 0;
  const correlationId = createAnonymousPriceGuideUploadCorrelation(() => {
    randomCalls += 1;
    return CORRELATION_ID;
  });
  assert.equal(correlationId, CORRELATION_ID);
  assert.equal(randomCalls, 1);
  const requestFingerprint = await createPriceGuideRequestCorrelationFingerprint(correlationId);
  assert.equal(requestFingerprint, createPriceGuideRequestCorrelationFingerprintForServer(correlationId));
  assert.match(requestFingerprint, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(requestFingerprint, new RegExp(correlationId));
  assert.match(createPriceGuidePhotoSupportCode(requestFingerprint), /^PG-[A-F0-9]{12}$/);

  const first = createBinding();
  const second = createBinding();
  assert.deepEqual(first, second, "an exact correlation is bound to the same asset and object lifecycle");
  assert.notEqual(
    derivePriceGuideSourceMediaAssetId({ secret: SECRET, shopId: "foreign-shop", clientCorrelationId: CORRELATION_ID }),
    first.mediaAssetId,
    "tenant changes cannot reuse the asset identity",
  );
  assert.notEqual(
    derivePriceGuideSourceMediaAssetId({
      secret: SECRET,
      shopId: SHOP_ID,
      clientCorrelationId: "33333333-3333-4333-8333-333333333333",
    }),
    first.mediaAssetId,
    "a new correlation receives a distinct asset identity",
  );
});

test("foreign and replay-mismatched cleanup bindings fail closed", () => {
  const binding = createBinding();
  assert.equal(verifyPriceGuideSourceCleanupProof({ secret: SECRET, shopId: SHOP_ID, ...binding }), true);
  assert.equal(verifyPriceGuideSourceCleanupProof({ secret: SECRET, shopId: "foreign-shop", ...binding }), false);
  assert.equal(verifyPriceGuideSourceCleanupProof({
    secret: SECRET,
    shopId: SHOP_ID,
    ...binding,
    objectLifecycleFingerprint: "0".repeat(64),
  }), false);

  const clientBinding = bindPriceGuideUploadCleanup({
    clientCorrelationId: binding.clientCorrelationId,
    requestCorrelationFingerprint: binding.requestCorrelationFingerprint,
    mediaAssetId: binding.mediaAssetId,
    cleanupProof: binding.proof,
    cleanupBinding: binding,
  });
  const request = buildPriceGuideHardPurgeRequest(clientBinding);
  assert.equal(request.mediaAssetIds.length, 1);
  assert.deepEqual(request.cleanupProofs[0], {
    mediaAssetId: clientBinding.mediaAssetId,
    proof: clientBinding.cleanupProof,
    clientCorrelationId: clientBinding.clientCorrelationId,
    requestCorrelationFingerprint: clientBinding.requestCorrelationFingerprint,
    correlationFingerprint: clientBinding.correlationFingerprint,
    assetFingerprint: clientBinding.assetFingerprint,
    objectLifecycleFingerprint: clientBinding.objectLifecycleFingerprint,
  });
});

test("success, failure, and abort converge on one cleanup request and a sanitized zero-residue receipt", async () => {
  const binding = createBinding();
  const clientBinding = bindPriceGuideUploadCleanup({
    clientCorrelationId: binding.clientCorrelationId,
    requestCorrelationFingerprint: binding.requestCorrelationFingerprint,
    mediaAssetId: binding.mediaAssetId,
    cleanupProof: binding.proof,
    cleanupBinding: binding,
  });
  const receipt = createPriceGuideSourceHardPurgeReceipt({
    secret: SECRET,
    binding,
    alreadyPurged: false,
  });
  const requests = new Map();
  let mutations = 0;
  const cleanup = () => getOrCreatePriceGuideCleanupRequest(
    requests,
    binding.correlationFingerprint,
    async () => {
      mutations += 1;
      return validatePriceGuideHardPurgeReceipt(clientBinding, receipt);
    },
  );
  await Promise.all([cleanup(), cleanup(), cleanup()]);
  assert.equal(mutations, 1);
  assert.deepEqual(await cleanup(), receipt);
  assert.equal(receipt.hardPurged, true);
  assert.equal(receipt.objectResidueCount, 0);
  assert.equal(receipt.metadataResidueCount, 0);
  assert.deepEqual(Object.keys(receipt).sort(), [
    "alreadyPurged",
    "assetFingerprint",
    "correlationFingerprint",
    "hardPurged",
    "metadataResidueCount",
    "objectLifecycleFingerprint",
    "objectResidueCount",
    "receiptFingerprint",
    "requestCorrelationFingerprint",
  ]);
  assert.doesNotMatch(JSON.stringify(receipt), new RegExp(binding.mediaAssetId));
  assert.doesNotMatch(JSON.stringify(receipt), /shops\//);
  assert.doesNotMatch(JSON.stringify(receipt), new RegExp(binding.proof));
  assert.throws(
    () => validatePriceGuideHardPurgeReceipt(clientBinding, { ...receipt, assetFingerprint: "0".repeat(64) }),
    /안전한 정리 결과/,
  );
});

test("PC and server source enforce correlation-before-intent, credentials omit, and post-delete absence checks", async () => {
  const [client, component, uploadIntentRoute, importRoute, mediaService, mediaStorage] = await Promise.all([
    source("src/lib/media/owner-media-client.ts"),
    source("src/components/owner-web/price-guide-photo-onboarding.tsx"),
    source("src/app/api/owner/media/upload-intents/route.ts"),
    source("src/app/api/owner/price-guide-photo-import/route.ts"),
    source("src/server/media-service.ts"),
    source("src/server/media-storage.ts"),
  ]);
  const uploadFlow = client.slice(client.indexOf("export async function createOwnerMediaAssetFromFile"));
  assert.ok(uploadFlow.indexOf("createAnonymousPriceGuideUploadCorrelation") < uploadFlow.indexOf("createUploadIntent"));
  assert.ok(uploadFlow.indexOf("createPriceGuideRequestCorrelationFingerprint") < uploadFlow.indexOf("createUploadIntent"));
  assert.match(uploadIntentRoute, /const clientCorrelationId = typeof body\.clientCorrelationId === "string"/);
  assert.match(uploadIntentRoute, /requestCorrelationFingerprint/);
  assert.match(client, /createUploadIntent[\s\S]*credentials: "omit"[\s\S]*clientCorrelationId/);
  assert.match(client, /method: "PUT",\s*credentials: "omit"/);
  assert.match(component, /buildPriceGuideHardPurgeRequest\(upload\.priceGuideCleanup\)/);
  assert.match(component, /rememberOwnerPriceGuideHardPurgeReceipt/);
  assert.match(importRoute, /cleanupProofs: input\.cleanupProofs/);
  assert.match(importRoute, /cleanupReceipt/);
  assert.match(mediaService, /verifyMediaStorageObjectsAbsent/);
  assert.match(mediaService, /remainingAssetsResult[\s\S]*remainingVariantsResult/);
  assert.match(mediaStorage, /method: "HEAD"[\s\S]*response\.status === 404/);
  assert.doesNotMatch([client, component, uploadIntentRoute, importRoute].join("\n"), /console\.(?:log|info|warn|error)\([^)]*(?:clientCorrelationId|cleanupProof|mediaAssetId)/);
});
