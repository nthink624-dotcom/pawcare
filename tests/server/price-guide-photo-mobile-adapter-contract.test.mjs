import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createPriceGuideSourceCleanupProof,
  decidePriceGuideSourceCleanupRecovery,
  verifyPriceGuideSourceCleanupProof,
} from "../../src/server/price-guide-photo-cleanup-decision.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("mobile price-guide adapter keeps the authenticated write boundary and no-store requery contract", async () => {
  const [photoImport, services, bootstrap, cors, mediaClient, mediaService, mediaSchema, serviceScreen] = await Promise.all([
    source("src/app/api/owner/price-guide-photo-import/route.ts"),
    source("src/app/api/services/route.ts"),
    source("src/app/api/bootstrap/route.ts"),
    source("src/server/owner-mobile-cors.ts"),
    source("src/lib/media/owner-media-client.ts"),
    source("src/server/media-service.ts"),
    source("supabase/migrations/202605180003_media_assets_and_notification_attachments.sql"),
    source("src/components/owner-web/service-management-screen.tsx"),
  ]);

  assert.match(photoImport, /const WRITE_CORS = \{ methods: "POST, DELETE, OPTIONS" \}/);
  assert.match(photoImport, /ownerMobileCorsJson\(request, body,[\s\S]*WRITE_CORS\)/);
  assert.match(photoImport, /ownerMobileCorsPreflight\(request, WRITE_CORS\)/);
  assert.match(photoImport, /requireOwnerShop\(request, input\.shopId\)/);
  assert.match(photoImport, /assertOwnerOrManager\(owner\)/);
  assert.match(photoImport, /privacyConfirmed: z\.literal\(true\)/);
  assert.match(photoImport, /removeOwnerPriceGuideSourceMedia\(owner, \{[\s\S]*mediaAssetIds: input\.mediaAssetIds,[\s\S]*cleanupProofs: input\.cleanupProofs/);
  assert.match(photoImport, /cleanupProofs: z\.array\(cleanupProofSchema\)/);
  assert.match(photoImport, /removeOwnerPriceGuideSourceMedia\(owner, \{ mediaAssetIds, cleanupProofs \}\)/);
  assert.match(photoImport, /Cache-Control": "private, no-store, max-age=0"/);

  assert.match(photoImport, /async function findPriceGuideSourceCleanupRecovery\([\s\S]*shopId: string,[\s\S]*mediaAssetIds: string\[\],[\s\S]*cleanupProofs: PriceGuideSourceCleanupProof\[\]/);
  assert.match(photoImport, /\.eq\("shop_id", shopId\)[\s\S]*\.in\("id", mediaAssetIds\)/);
  assert.match(photoImport, /decidePriceGuideSourceCleanupRecovery\([\s\S]*\{ shopId, secret: serverEnv\.authFlowSecret, cleanupProofs \}/);
  assert.match(photoImport, /error instanceof OwnerApiError && error\.status === 400 && owner[\s\S]*findPriceGuideSourceCleanupRecovery\(owner\.shopId, mediaAssetIds, cleanupProofs\)[\s\S]*cleanupRecovery\.kind === "already_deleted"[\s\S]*return noStoreJson\(request, \{ deleted: true, hardPurged: true \}\)[\s\S]*cleanupRecovery\.kind === "unavailable"[\s\S]*status: cleanupRecovery\.status/);
  assert.doesNotMatch(photoImport, /error instanceof OwnerApiError && error\.status < 500[\s\S]*return noStoreJson\(request, \{ deleted: true \}\)/);

  assert.match(services, /const WRITE_CORS = \{ methods: "POST, DELETE, OPTIONS" \}/);
  assert.match(services, /ownerMobileCorsJson\(request, result, undefined, WRITE_CORS\)/);
  assert.match(services, /ownerMobileCorsPreflight\(request, WRITE_CORS\)/);
  assert.match(services, /requireOwnerShop\(request, body\?\.shopId\)/);
  assert.match(services, /assertOwnerOrManager\(owner\)/);
  assert.match(services, /priceGuide: redactPriceGuideRawTextForStorage\(body\?\.priceGuide\)/);
  assert.match(bootstrap, /ownerMobileCorsJson\(request, scopeBootstrapForStaff\(data, owner\)\)/);
  assert.match(bootstrap, /ownerMobileCorsPreflight\(request\)/);

  assert.match(cors, /"capacitor:\/\/localhost"/);
  assert.match(cors, /Authorization, Content-Type, Accept/);
  assert.match(mediaClient, /mediaKind === "price_guide_source"\s*\|\|\s*mediaKind === "feedback_screenshot"\s*\?\s*"private"/);
  assert.match(mediaClient, /retentionPolicy: mediaKind === "price_guide_source"\s*\?\s*"archive"\s*:\s*mediaKind === "feedback_screenshot"\s*\?\s*"transient"\s*:\s*"standard"/);
  assert.match(mediaService, /await removeMediaStorageObjects\(\{ bucket, paths: \[\.\.\.paths\] \}\)[\s\S]*verifyMediaStorageObjectsAbsent\(\{ bucket, paths: \[\.\.\.paths\] \}\)[\s\S]*\.from\("media_assets"\)[\s\S]*\.delete\(\)[\s\S]*\.eq\("shop_id", owner\.shopId\)[\s\S]*\.eq\("media_kind", "price_guide_source"\)[\s\S]*\.select\("id"\)/);
  assert.doesNotMatch(
    mediaService.slice(mediaService.indexOf("export async function removeOwnerPriceGuideSourceMedia"), mediaService.indexOf("export async function getPublicShopMediaSignedUrls")),
    /\.update\(\{[\s\S]*status:\s*"deleted"/,
  );
  assert.match(mediaSchema, /media_asset_id uuid not null references public\.media_assets\(id\) on delete cascade/);
  assert.match(serviceScreen, /fetchApiJsonWithAuth<Service>\("\/api\/services"/);
  assert.match(serviceScreen, /`\/api\/bootstrap\?shopId=\$\{encodeURIComponent\(shopId\)\}&phase=essential`[\s\S]*\{ cache: "no-store" \}/);
});

test("hard-purged cleanup remains idempotent only with an exact tenant-bound proof", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";
  const shopId = "shop-a";
  const secret = "cleanup-proof-test-secret";
  const proof = createPriceGuideSourceCleanupProof({ secret, shopId, mediaAssetId: id });
  const verification = { shopId, secret, cleanupProofs: [{ mediaAssetId: id, proof }] };
  const activeSource = [{ id, media_kind: "price_guide_source", deleted_at: null }];
  const deletedSource = [{ id, media_kind: "price_guide_source", deleted_at: "2026-09-02T00:00:00.000Z" }];

  assert.equal(verifyPriceGuideSourceCleanupProof({ secret, shopId, mediaAssetId: id, proof }), true);
  assert.equal(verifyPriceGuideSourceCleanupProof({ secret, shopId: "shop-b", mediaAssetId: id, proof }), false);
  assert.equal(verifyPriceGuideSourceCleanupProof({ secret, shopId, mediaAssetId: otherId, proof }), false);
  assert.equal(verifyPriceGuideSourceCleanupProof({ secret, shopId, mediaAssetId: id, proof: "0".repeat(64) }), false);
  assert.deepEqual(decidePriceGuideSourceCleanupRecovery([id], { status: "ok", assets: activeSource }), { kind: "invalid" }, "first DELETE reaches the secure remover");
  assert.deepEqual(decidePriceGuideSourceCleanupRecovery([id], { status: "ok", assets: deletedSource }), { kind: "already_deleted" }, "duplicate DELETE is a no-op");
  assert.deepEqual(decidePriceGuideSourceCleanupRecovery([id], { status: "ok", assets: [] }, verification), { kind: "already_deleted" }, "hard-purged metadata is an idempotent success with the issued proof");
  assert.deepEqual(decidePriceGuideSourceCleanupRecovery([id], { status: "ok", assets: [] }), { kind: "invalid" }, "a cross-shop id remains invalid after shop-scoped lookup");
  assert.deepEqual(decidePriceGuideSourceCleanupRecovery([otherId], { status: "ok", assets: [] }, verification), { kind: "invalid" }, "an unknown id remains invalid");
  assert.deepEqual(
    decidePriceGuideSourceCleanupRecovery([id], { status: "ok", assets: [{ id, media_kind: "staff_profile", deleted_at: "2026-09-02T00:00:00.000Z" }] }, verification),
    { kind: "invalid" },
    "wrong-kind assets never receive a cleanup no-op",
  );
  assert.deepEqual(decidePriceGuideSourceCleanupRecovery([id, id], { status: "ok", assets: deletedSource }), { kind: "invalid" }, "a duplicate requested id cannot bypass exact-id validation");
  assert.deepEqual(
    decidePriceGuideSourceCleanupRecovery([id], { status: "unavailable" }),
    { kind: "unavailable", status: 503, code: "MEDIA_CLEANUP_FAILED" },
    "lookup failure is a sanitized retryable 503",
  );
});
