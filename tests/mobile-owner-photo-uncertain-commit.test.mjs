import assert from "node:assert/strict";
import { Blob, File } from "node:buffer";
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

const [pendingModule, ownerAppSource] = await Promise.all([
  importTypeScriptModule("../src/lib/media/owner-pending-status-photo.ts"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
]);

const binding = {
  accountId: "owner:user-1",
  shopId: "shop-1",
  appointmentId: "appointment-1",
  guardianId: "guardian-1",
  petId: "pet-1",
  mediaKind: "grooming_before",
  nextStatus: "in_progress",
  allowSkip: false,
};

function pendingPhoto(overrides = {}) {
  return {
    ...binding,
    key: "pending-key",
    blob: new Blob(["photo"], { type: "image/jpeg" }),
    fileName: "before.jpg",
    contentType: "image/jpeg",
    lastModified: 1,
    byteSize: 5,
    savedAt: 1,
    uploadAttemptId: "attempt-1",
    uploadStarted: true,
    uploadClaimId: "claim-1",
    uploadClaimedAt: 1,
    durableMediaAssetId: "asset-1",
    ...overrides,
  };
}

function appointment(status = "in_progress", overrides = {}) {
  return {
    id: binding.appointmentId,
    shop_id: binding.shopId,
    guardian_id: binding.guardianId,
    pet_id: binding.petId,
    service_id: "service-1",
    appointment_date: "2026-09-17",
    appointment_time: "10:00",
    status,
    memo: "",
    rejection_reason: null,
    start_at: "2026-09-17T10:00:00.000Z",
    end_at: "2026-09-17T11:00:00.000Z",
    source: "owner",
    created_at: "2026-09-17T00:00:00.000Z",
    updated_at: "2026-09-17T01:00:00.000Z",
    ...overrides,
  };
}

function mediaAsset(overrides = {}) {
  return {
    id: "asset-1",
    shop_id: binding.shopId,
    appointment_id: binding.appointmentId,
    guardian_id: binding.guardianId,
    pet_id: binding.petId,
    grooming_record_id: null,
    bucket: "private",
    storage_path: "path/asset-1.jpg",
    original_file_name: "before.jpg",
    content_type: "image/jpeg",
    byte_size: 5,
    width: 10,
    height: 10,
    checksum_sha256: null,
    media_kind: binding.mediaKind,
    visibility: "customer_shared",
    status: "ready",
    retention_policy: "standard",
    uploaded_by_user_id: null,
    uploaded_from: "owner_web",
    metadata: { owner_pending_upload_id: "attempt-1" },
    created_at: "2026-09-17T00:30:00.000Z",
    updated_at: "2026-09-17T00:30:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

test("a committed PATCH with a lost response converges only after exact canonical readback", async () => {
  const { settlePendingOwnerStatusPhotoCommit } = pendingModule.module;
  let canonicalStatus = "confirmed";
  let commitCalls = 0;
  let readbackCalls = 0;
  const result = await settlePendingOwnerStatusPhotoCommit({
    pending: pendingPhoto({ uploadStarted: false }),
    durableMediaAsset: mediaAsset(),
    verifyBeforeCommit: false,
    commit: async () => {
      commitCalls += 1;
      canonicalStatus = "in_progress";
      throw new TypeError("simulated response loss");
    },
    readback: async () => {
      readbackCalls += 1;
      return { appointment: appointment(canonicalStatus), mediaAsset: mediaAsset() };
    },
  });

  assert.equal(commitCalls, 1);
  assert.equal(readbackCalls, 1);
  assert.equal(result.outcome, "committed");
  assert.equal(result.confirmedBy, "readback");

  const repeatedClick = await settlePendingOwnerStatusPhotoCommit({
    pending: pendingPhoto(),
    durableMediaAsset: mediaAsset(),
    verifyBeforeCommit: true,
    commit: async () => {
      commitCalls += 1;
      return appointment();
    },
    readback: async () => {
      readbackCalls += 1;
      return { appointment: appointment(canonicalStatus), mediaAsset: mediaAsset() };
    },
  });
  assert.equal(commitCalls, 1);
  assert.equal(repeatedClick.outcome, "committed");
  assert.equal(repeatedClick.confirmedBy, "readback");
});

test("reload confirms an exact prior commit without sending a same-status PATCH", async () => {
  const { settlePendingOwnerStatusPhotoCommit } = pendingModule.module;
  let commitCalls = 0;
  const result = await settlePendingOwnerStatusPhotoCommit({
    pending: pendingPhoto(),
    durableMediaAsset: mediaAsset(),
    verifyBeforeCommit: true,
    commit: async () => {
      commitCalls += 1;
      return appointment();
    },
    readback: async () => ({ appointment: appointment(), mediaAsset: mediaAsset() }),
  });

  assert.equal(commitCalls, 0);
  assert.equal(result.outcome, "committed");
  assert.equal(result.confirmedBy, "readback");
});

test("same target status alone never proves success for another appointment or media ID", async () => {
  const { settlePendingOwnerStatusPhotoCommit } = pendingModule.module;
  let commitCalls = 0;
  const wrongAppointment = await settlePendingOwnerStatusPhotoCommit({
    pending: pendingPhoto(),
    durableMediaAsset: mediaAsset(),
    verifyBeforeCommit: true,
    commit: async () => { commitCalls += 1; return appointment(); },
    readback: async () => ({ appointment: appointment("in_progress", { id: "appointment-2" }), mediaAsset: mediaAsset() }),
  });
  const wrongMedia = await settlePendingOwnerStatusPhotoCommit({
    pending: pendingPhoto(),
    durableMediaAsset: mediaAsset(),
    verifyBeforeCommit: true,
    commit: async () => { commitCalls += 1; return appointment(); },
    readback: async () => ({ appointment: appointment(), mediaAsset: mediaAsset({ id: "asset-2" }) }),
  });

  assert.equal(commitCalls, 0);
  assert.deepEqual(wrongAppointment, { outcome: "retry", reason: "binding_mismatch" });
  assert.deepEqual(wrongMedia, { outcome: "retry", reason: "binding_mismatch" });
});

test("a later authoritative status blocks reverse PATCH and preserves the pending decision", async () => {
  const { settlePendingOwnerStatusPhotoCommit } = pendingModule.module;
  let commitCalls = 0;
  const result = await settlePendingOwnerStatusPhotoCommit({
    pending: pendingPhoto(),
    durableMediaAsset: mediaAsset(),
    verifyBeforeCommit: true,
    commit: async () => { commitCalls += 1; return appointment(); },
    readback: async () => ({ appointment: appointment("almost_done"), mediaAsset: mediaAsset() }),
  });

  assert.equal(commitCalls, 0);
  assert.equal(result.outcome, "advanced");
  assert.equal(result.appointment.status, "almost_done");
});

test("definite failure and canonical readback failure stay retryable without an automatic second PATCH", async () => {
  const { settlePendingOwnerStatusPhotoCommit } = pendingModule.module;
  let commitCalls = 0;
  const definiteFailure = await settlePendingOwnerStatusPhotoCommit({
    pending: pendingPhoto({ uploadStarted: false }),
    durableMediaAsset: mediaAsset(),
    verifyBeforeCommit: false,
    commit: async () => { commitCalls += 1; throw new Error("simulated rejection"); },
    readback: async () => ({ appointment: appointment("confirmed"), mediaAsset: mediaAsset() }),
  });
  const unavailableReadback = await settlePendingOwnerStatusPhotoCommit({
    pending: pendingPhoto(),
    durableMediaAsset: mediaAsset(),
    verifyBeforeCommit: true,
    commit: async () => { commitCalls += 1; return appointment(); },
    readback: async () => { throw new TypeError("simulated offline"); },
  });

  assert.equal(commitCalls, 1);
  assert.deepEqual(definiteFailure, { outcome: "retry", reason: "not_committed" });
  assert.deepEqual(unavailableReadback, { outcome: "retry", reason: "readback_failed" });
});

test("integration keeps one in-flight/claim path and clears pending only after a committed outcome", () => {
  assert.match(ownerAppSource, /if \(isOwnerDemo \|\| mobilePhotoUploadInFlightRef\.current\) return/);
  assert.match(ownerAppSource, /claimPendingOwnerStatusPhotoUpload\(pending, uploadClaimId\)/);
  assert.match(ownerAppSource, /verifyBeforeCommit: shouldReadbackDurableAsset/);
  assert.match(ownerAppSource, /readback: async \(\) => await readPendingOwnerStatusPhotoCommitReadback\(pending\)/);
  assert.match(ownerAppSource, /commitResult\.outcome === "advanced"[\s\S]*상태를 되돌리지 않았습니다/);
  const committedStart = ownerAppSource.indexOf('const updatedAppointment = commitResult.appointment');
  const clearIndex = ownerAppSource.indexOf("clearPendingOwnerStatusPhoto(binding)", committedStart);
  assert.ok(committedStart >= 0 && clearIndex > committedStart);
  assert.doesNotMatch(ownerAppSource.slice(committedStart, clearIndex), /updateAppointment\(/);
});

test("pending module remains Blob-only and does not introduce a client-side Supabase write", () => {
  assert.doesNotMatch(pendingModule.source, /localStorage|readAsDataURL|base64/i);
  assert.doesNotMatch(pendingModule.source, /getSupabase|supabase\.from|\.update\(|\.insert\(/);
  assert.equal(typeof File, "function");
});
