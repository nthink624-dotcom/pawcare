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

const [durability, pending, ownerAppSource, signedUrlsSource, mediaServiceSource] = await Promise.all([
  importTypeScriptModule("../src/lib/media/owner-media-durability.ts"),
  importTypeScriptModule("../src/lib/media/owner-pending-status-photo.ts"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/api/owner/media/signed-urls/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/server/owner-media-service.ts", import.meta.url), "utf8"),
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

test("ID union preserves an existing before photo across empty and partial hydration", () => {
  const { mergeBoundOwnerMediaItems } = durability.module;
  assert.deepEqual(mergeBoundOwnerMediaItems([mediaItem("old")], [], binding).map((item) => item.mediaAsset.id), ["old"]);
  assert.deepEqual(
    mergeBoundOwnerMediaItems([mediaItem("old")], [mediaItem("new")], binding).map((item) => item.mediaAsset.id),
    ["new", "old"],
  );
});

test("signed URL partial failure retains asset identity and the last known URL", () => {
  const { mergeOwnerMediaPreviews } = durability.module;
  const retained = mergeOwnerMediaPreviews(
    [{ item: mediaItem("old"), signedUrl: "https://signed.example/old" }],
    [{ item: mediaItem("old"), signedUrl: null }, { item: mediaItem("new"), signedUrl: null }],
    binding,
  );
  assert.equal(retained.length, 2);
  assert.equal(retained.find((item) => item.item.mediaAsset.id === "old").signedUrl, "https://signed.example/old");
  assert.equal(retained.find((item) => item.item.mediaAsset.id === "new").signedUrl, null);
});

test("appointment, pet, guardian, and shop mismatch fail closed", () => {
  const { mergeBoundOwnerMediaItems } = durability.module;
  const mismatches = [
    mediaItem("shop", { shop_id: "other" }),
    mediaItem("appointment", { appointment_id: "other" }),
    mediaItem("guardian", { guardian_id: "other" }),
    mediaItem("pet", { pet_id: "other" }),
  ];
  assert.deepEqual(mergeBoundOwnerMediaItems([], mismatches, binding), []);
});

test("pending capture survives as a Blob and reuses only an exact ready durable asset", () => {
  const {
    createPendingOwnerStatusPhoto,
    isPendingDurableAssetReusable,
    isPendingOwnerStatusPhotoExactBinding,
  } = pending.module;
  const pendingBinding = { ...binding, mediaKind: "grooming_before", nextStatus: "in_progress", allowSkip: false };
  const record = createPendingOwnerStatusPhoto(pendingBinding, new File(["photo"], "before.jpg", { type: "image/jpeg" }));
  assert.equal(isPendingOwnerStatusPhotoExactBinding(record, pendingBinding), true);
  const ready = mediaItem("durable", { metadata: { owner_pending_upload_id: record.uploadAttemptId } }).mediaAsset;
  assert.equal(isPendingDurableAssetReusable(record, ready), true);
  assert.equal(isPendingDurableAssetReusable(record, { ...ready, pet_id: "other" }), false);
  assert.equal(isPendingDurableAssetReusable({ ...record, durableMediaAssetId: "durable" }, ready), true);
  assert.equal(isPendingDurableAssetReusable({ ...record, durableMediaAssetId: "different" }, ready), false);
  assert.match(pending.source, /indexedDB\.open/);
  assert.doesNotMatch(pending.source, /localStorage|readAsDataURL|base64/i);
});

test("upload retry is staged before upload, records durable ID before status, and clears only after commit", () => {
  const stageIndex = ownerAppSource.indexOf("writePendingOwnerStatusPhoto(pending)");
  const uploadIndex = ownerAppSource.indexOf("createOwnerMediaAssetFromFile(", stageIndex);
  const durableIndex = ownerAppSource.indexOf("markPendingOwnerStatusPhotoDurable", uploadIndex);
  const commitIndex = ownerAppSource.indexOf('traceOwnerMediaStep("appointment-status-commit"', durableIndex);
  const committedGuardIndex = ownerAppSource.indexOf("if (!committed) return", commitIndex);
  const clearIndex = ownerAppSource.indexOf("clearPendingOwnerStatusPhoto(binding)", committedGuardIndex);
  assert.ok(stageIndex > 0 && stageIndex < uploadIndex);
  assert.ok(uploadIndex < durableIndex && durableIndex < commitIndex);
  assert.ok(commitIndex < committedGuardIndex && committedGuardIndex < clearIndex);
  assert.match(ownerAppSource.slice(commitIndex, clearIndex), /mediaAssetIds: \[durableMediaAssetId!\]/);
  assert.match(ownerAppSource, /if \(mobilePhotoUploadInFlightRef\.current\) return/);
});

test("batch URL resolution isolates failures and falls back from derivative to original", () => {
  assert.match(signedUrlsSource, /requestedVariant === "original"/);
  assert.match(signedUrlsSource, /variant: "original"/);
  assert.match(signedUrlsSource, /signedUrls\.filter\(\(item\) => item !== null\)/);
  assert.doesNotMatch(signedUrlsSource, /error instanceof Error \? error\.message/);
  const historyStart = ownerAppSource.indexOf("function AppointmentDetailMediaHistory");
  const historyEnd = ownerAppSource.indexOf("function AppointmentDetail(", historyStart);
  const history = ownerAppSource.slice(historyStart, historyEnd);
  assert.match(history, /guardianId: appointment\.guardian_id/);
  assert.match(history, /petId: appointment\.pet_id/);
  assert.match(history, /mergeOwnerMediaPreviews/);
  assert.doesNotMatch(history, /setItems\(\[\]\)/);
});

test("upload intent validates canonical appointment binding before creating an asset", () => {
  const validationIndex = mediaServiceSource.indexOf('.from("appointments")');
  const insertIndex = mediaServiceSource.indexOf('.from("media_assets").insert');
  assert.ok(validationIndex > 0 && validationIndex < insertIndex);
  assert.match(mediaServiceSource, /appointment\.data\.guardian_id !== input\.guardianId/);
  assert.match(mediaServiceSource, /appointment\.data\.pet_id !== input\.petId/);
});
