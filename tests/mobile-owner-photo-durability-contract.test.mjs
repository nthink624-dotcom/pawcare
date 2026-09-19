import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

async function importTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const javascript = stripTypeScriptTypes(source, { mode: "transform" });
  return {
    source,
    module: await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`),
  };
}

const [durability, pending, ownerAppSource] = await Promise.all([
  importTypeScriptModule("../src/lib/media/owner-media-durability.ts"),
  importTypeScriptModule("../src/lib/media/owner-pending-status-photo.ts"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
]);

const binding = { shopId: "shop-1", appointmentId: "appt-1", guardianId: "guardian-1", petId: "pet-1" };

function mediaItem(id, overrides = {}) {
  return {
    mediaAsset: {
      id,
      shop_id: binding.shopId,
      appointment_id: binding.appointmentId,
      guardian_id: binding.guardianId,
      pet_id: binding.petId,
      grooming_record_id: null,
      bucket: "bucket",
      storage_path: `path/${id}`,
      original_file_name: `${id}.jpg`,
      content_type: "image/jpeg",
      byte_size: 10,
      width: 10,
      height: 10,
      checksum_sha256: null,
      media_kind: "grooming_before",
      visibility: "customer_shared",
      status: "ready",
      retention_policy: "standard",
      uploaded_by_user_id: null,
      uploaded_from: "owner_web",
      metadata: {},
      created_at: id === "old" ? "2026-09-15T01:00:00.000Z" : "2026-09-15T02:00:00.000Z",
      updated_at: "2026-09-15T02:00:00.000Z",
      deleted_at: null,
      ...overrides,
    },
    variants: [],
  };
}

function createFakeIndexedDb() {
  const records = new Map();
  let initialized = false;
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        const database = {
          objectStoreNames: { contains: () => initialized },
          createObjectStore: () => { initialized = true; },
          close: () => {},
          transaction() {
            let pendingRequests = 0;
            let completionQueued = false;
            let aborted = false;
            const transaction = {
              error: null,
              objectStore() {
                const run = (work) => {
                  const operation = {};
                  pendingRequests += 1;
                  queueMicrotask(() => {
                    if (aborted) return;
                    try {
                      operation.result = work();
                      operation.onsuccess?.();
                    } catch (error) {
                      operation.error = error;
                      transaction.error = error;
                      operation.onerror?.();
                      transaction.onerror?.();
                    } finally {
                      pendingRequests -= 1;
                      if (!aborted && pendingRequests === 0 && !completionQueued) {
                        completionQueued = true;
                        queueMicrotask(() => transaction.oncomplete?.());
                      }
                    }
                  });
                  return operation;
                };
                return {
                  get: (key) => run(() => records.get(key)),
                  getAll: () => run(() => [...records.values()]),
                  put: (value) => run(() => { records.set(value.key, value); return value.key; }),
                  delete: (key) => run(() => records.delete(key)),
                };
              },
              abort() {
                if (aborted) return;
                aborted = true;
                queueMicrotask(() => transaction.onabort?.());
              },
            };
            return transaction;
          },
        };
        request.result = database;
        if (!initialized) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

test("partial hydration and signed-URL failure retain durable photo identity and last good URL", () => {
  const { mergeBoundOwnerMediaItems, mergeOwnerMediaPreviews } = durability.module;
  assert.deepEqual(mergeBoundOwnerMediaItems([mediaItem("old")], [], binding).map((item) => item.mediaAsset.id), ["old"]);
  assert.deepEqual(
    mergeBoundOwnerMediaItems([mediaItem("old")], [mediaItem("new")], binding).map((item) => item.mediaAsset.id),
    ["new", "old"],
  );
  const retained = mergeOwnerMediaPreviews(
    [{ item: mediaItem("old"), signedUrl: "https://signed.example/old" }],
    [{ item: mediaItem("old"), signedUrl: null }, { item: mediaItem("new"), signedUrl: null }],
    binding,
  );
  assert.equal(retained.find((item) => item.item.mediaAsset.id === "old").signedUrl, "https://signed.example/old");
  assert.equal(retained.find((item) => item.item.mediaAsset.id === "new").signedUrl, null);
});

test("shop, appointment, guardian, and pet mismatches all fail closed", () => {
  const { mergeBoundOwnerMediaItems } = durability.module;
  const mismatches = [
    mediaItem("shop", { shop_id: "other" }),
    mediaItem("appointment", { appointment_id: "other" }),
    mediaItem("guardian", { guardian_id: "other" }),
    mediaItem("pet", { pet_id: "other" }),
  ];
  assert.deepEqual(mergeBoundOwnerMediaItems([], mismatches, binding), []);
});

test("pending capture is account-isolated and only an exact ready original is reusable", () => {
  const { createPendingOwnerStatusPhoto, isPendingDurableAssetReusable, isPendingOwnerStatusPhotoExactBinding } = pending.module;
  const pendingBinding = {
    accountId: "owner:user-1",
    ...binding,
    mediaKind: "grooming_before",
    nextStatus: "in_progress",
    allowSkip: false,
  };
  const record = createPendingOwnerStatusPhoto(pendingBinding, new File(["photo"], "before.jpg", { type: "image/jpeg" }));
  assert.equal(isPendingOwnerStatusPhotoExactBinding(record, pendingBinding), true);
  assert.equal(isPendingOwnerStatusPhotoExactBinding(record, { ...pendingBinding, accountId: "owner:user-2" }), false);
  const ready = mediaItem("durable", { metadata: { owner_pending_upload_id: record.uploadAttemptId } }).mediaAsset;
  assert.equal(isPendingDurableAssetReusable(record, ready), true);
  assert.equal(isPendingDurableAssetReusable(record, { ...ready, status: "processing" }), false);
  assert.equal(isPendingDurableAssetReusable(record, { ...ready, guardian_id: "other" }), false);
  assert.equal(isPendingDurableAssetReusable({ ...record, durableMediaAssetId: "durable" }, ready), true);
  assert.equal(isPendingDurableAssetReusable({ ...record, durableMediaAssetId: "different" }, ready), false);
  assert.match(record.key, /^owner%3Auser-1:/);
});

test("IndexedDB persistence uses atomic upload leases and no Base64 or localStorage", () => {
  assert.match(pending.source, /indexedDB\.open/);
  assert.doesNotMatch(pending.source, /localStorage|readAsDataURL|base64/i);
  const claimStart = pending.source.indexOf("export async function claimPendingOwnerStatusPhotoUpload");
  const claimEnd = pending.source.indexOf("export async function releasePendingOwnerStatusPhotoUpload", claimStart);
  const claim = pending.source.slice(claimStart, claimEnd);
  assert.match(claim, /database\.transaction\(STORE_NAME, "readwrite"\)/);
  assert.match(claim, /activeClaim[\s\S]*stored\.uploadClaimId !== claimId/);
  assert.match(claim, /store\.put\(claimed\)/);
  const stageStart = pending.source.indexOf("export async function stagePendingOwnerStatusPhoto");
  const stageEnd = pending.source.indexOf("export async function readPendingOwnerStatusPhoto", stageStart);
  const stage = pending.source.slice(stageStart, stageEnd);
  assert.match(stage, /database\.transaction\(STORE_NAME, "readwrite"\)/);
  assert.match(stage, /PENDING_PHOTO_UPLOAD_IN_PROGRESS/);
  const release = pending.source.slice(claimEnd, pending.source.indexOf("export async function markPendingOwnerStatusPhotoDurable", claimEnd));
  assert.match(release, /database\.transaction\(STORE_NAME, "readwrite"\)/);
  assert.match(release, /stored\.uploadClaimId !== claimId/);
  const markStart = pending.source.indexOf("export async function markPendingOwnerStatusPhotoDurable");
  const markEnd = pending.source.indexOf("export async function clearPendingOwnerStatusPhoto", markStart);
  assert.doesNotMatch(pending.source.slice(markStart, markEnd), /uploadClaimId: null|uploadClaimedAt: null/);
  assert.match(pending.source, /PENDING_PHOTO_STORAGE_QUOTA/);
  assert.match(pending.source, /PENDING_PHOTO_STORAGE_UNAVAILABLE/);
});

test("IndexedDB round-trip isolates accounts, rejects an active duplicate tab, and clears only the committed binding", async () => {
  const originalIndexedDb = globalThis.indexedDB;
  globalThis.indexedDB = createFakeIndexedDb();
  try {
    const {
      claimPendingOwnerStatusPhotoUpload,
      clearPendingOwnerStatusPhoto,
      clearPendingOwnerStatusPhotos,
      createPendingOwnerStatusPhoto,
      markPendingOwnerStatusPhotoDurable,
      readPendingOwnerStatusPhoto,
      readPendingOwnerStatusPhotos,
      releasePendingOwnerStatusPhotoUpload,
      stagePendingOwnerStatusPhoto,
    } = pending.module;
    const firstBinding = {
      accountId: "owner:user-1",
      ...binding,
      mediaKind: "grooming_before",
      nextStatus: "in_progress",
      allowSkip: false,
    };
    const otherBinding = { ...firstBinding, accountId: "owner:user-2" };
    const first = createPendingOwnerStatusPhoto(firstBinding, new File(["first"], "first.jpg", { type: "image/jpeg" }));
    const other = createPendingOwnerStatusPhoto(otherBinding, new File(["other"], "other.jpg", { type: "image/jpeg" }));
    await stagePendingOwnerStatusPhoto(first, 1_000);
    await stagePendingOwnerStatusPhoto(other, 1_000);
    assert.equal((await readPendingOwnerStatusPhoto(firstBinding)).uploadAttemptId, first.uploadAttemptId);
    assert.equal((await readPendingOwnerStatusPhotos("owner:user-1", binding.shopId)).length, 1);

    const claimed = await claimPendingOwnerStatusPhotoUpload(first, "tab-one", 2_000);
    assert.equal(claimed.uploadClaimId, "tab-one");
    assert.equal(await claimPendingOwnerStatusPhotoUpload(first, "tab-two", 2_100), null);
    const replacement = createPendingOwnerStatusPhoto(firstBinding, new File(["replacement"], "new.jpg", { type: "image/jpeg" }));
    await assert.rejects(stagePendingOwnerStatusPhoto(replacement, 2_100), { name: "PENDING_PHOTO_UPLOAD_IN_PROGRESS" });
    assert.equal(await releasePendingOwnerStatusPhotoUpload(claimed, "wrong-tab"), null);
    const released = await releasePendingOwnerStatusPhotoUpload(claimed, "tab-one");
    assert.equal(released.uploadClaimId, null);

    const reclaimed = await claimPendingOwnerStatusPhotoUpload(released, "tab-two", 2_200);
    const durable = await markPendingOwnerStatusPhotoDurable(reclaimed, "asset-1");
    assert.equal((await readPendingOwnerStatusPhoto(firstBinding)).durableMediaAssetId, "asset-1");
    assert.equal((await readPendingOwnerStatusPhoto(firstBinding)).uploadClaimId, "tab-two");
    await assert.rejects(stagePendingOwnerStatusPhoto(replacement, 2_300), { name: "PENDING_PHOTO_UPLOAD_IN_PROGRESS" });
    await clearPendingOwnerStatusPhoto(durable);
    assert.equal(await readPendingOwnerStatusPhoto(firstBinding), null);
    assert.equal((await readPendingOwnerStatusPhotos("owner:user-2", binding.shopId)).length, 1);
    await clearPendingOwnerStatusPhotos("owner:user-2");
    assert.equal((await readPendingOwnerStatusPhotos("owner:user-2", binding.shopId)).length, 0);
  } finally {
    globalThis.indexedDB = originalIndexedDb;
  }
});

test("reload, logout, storage failure, offline retry, cancel, and duplicate-tab boundaries are explicit", () => {
  assert.match(ownerAppSource, /readPendingOwnerStatusPhotos\(pendingPhotoAccountId, data\.shop\.id\)/);
  assert.match(ownerAppSource, /setMobilePhotoPreviewFile\(pendingOwnerStatusPhotoToFile\(pending\)\)/);
  assert.match(ownerAppSource, /clearPendingOwnerStatusPhotos\(pendingPhotoAccountId\)/);
  assert.match(ownerAppSource, /const identity = appRole === "staff" \? currentStaffId : data\.ownerProfile\?\.user_id/);
  assert.match(ownerAppSource, /claimPendingOwnerStatusPhotoUpload\(pending, uploadClaimId\)/);
  assert.match(ownerAppSource, /releasePendingOwnerStatusPhotoUpload\(claimedPending, uploadClaimId\)/);
  assert.match(ownerAppSource, /if \(captureError instanceof Error && captureError\.message === "CAMERA_CANCELLED"\) return/);
  assert.match(ownerAppSource, /stagePendingOwnerStatusPhoto\(pending\)[\s\S]*createOwnerMediaAssetFromFile/);
  const uploadStart = ownerAppSource.indexOf("async function updateAppointmentStatusWithMobilePhoto(");
  const uploadEnd = ownerAppSource.indexOf("\n  async function handleMobilePhotoStatusFile", uploadStart);
  const upload = ownerAppSource.slice(uploadStart, uploadEnd);
  const catchStart = upload.lastIndexOf("} catch (uploadError)");
  assert.doesNotMatch(upload.slice(catchStart), /clearPendingOwnerStatusPhoto\(/);
});

test("appointment history requests exact binding and never wipes good photos on a partial response", () => {
  const historyStart = ownerAppSource.indexOf("function AppointmentDetailMediaHistory");
  const historyEnd = ownerAppSource.indexOf("export function AppointmentDetail(", historyStart);
  const history = ownerAppSource.slice(historyStart, historyEnd);
  assert.match(history, /guardianId: appointment\.guardian_id/);
  assert.match(history, /petId: appointment\.pet_id/);
  assert.match(history, /getOwnerMediaSignedUrlsWithOriginalFallback/);
  assert.match(history, /mergeOwnerMediaPreviews/);
  assert.doesNotMatch(history, /setItems\(\[\]\)/);
});
