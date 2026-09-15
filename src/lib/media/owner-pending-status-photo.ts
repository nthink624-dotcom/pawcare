import type { AppointmentStatus, MediaAsset, MediaKind } from "@/types/domain";

const DATABASE_NAME = "petmanager-owner-media-v1";
const STORE_NAME = "pending-status-photos";
const DATABASE_VERSION = 1;

export type PendingOwnerStatusPhotoBinding = {
  shopId: string;
  appointmentId: string;
  guardianId: string;
  petId: string;
  mediaKind: Extract<MediaKind, "grooming_before" | "grooming_after">;
  nextStatus: Extract<AppointmentStatus, "in_progress" | "completed">;
  allowSkip: boolean;
};

export type PendingOwnerStatusPhoto = PendingOwnerStatusPhotoBinding & {
  key: string;
  blob: Blob;
  fileName: string;
  contentType: string;
  lastModified: number;
  byteSize: number;
  savedAt: number;
  uploadAttemptId: string;
  uploadStarted: boolean;
  durableMediaAssetId: string | null;
};

function createUploadAttemptId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function pendingOwnerStatusPhotoKey(binding: PendingOwnerStatusPhotoBinding) {
  return [binding.shopId, binding.appointmentId, binding.mediaKind, binding.nextStatus]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

export function createPendingOwnerStatusPhoto(
  binding: PendingOwnerStatusPhotoBinding,
  file: File,
): PendingOwnerStatusPhoto {
  return {
    ...binding,
    key: pendingOwnerStatusPhotoKey(binding),
    blob: file,
    fileName: file.name || "grooming-photo.jpg",
    contentType: file.type || "image/jpeg",
    lastModified: file.lastModified || Date.now(),
    byteSize: file.size,
    savedAt: Date.now(),
    uploadAttemptId: createUploadAttemptId(),
    uploadStarted: false,
    durableMediaAssetId: null,
  };
}

export function pendingOwnerStatusPhotoToFile(pending: PendingOwnerStatusPhoto) {
  return new File([pending.blob], pending.fileName, {
    type: pending.contentType,
    lastModified: pending.lastModified,
  });
}

export function isPendingOwnerStatusPhotoExactBinding(
  pending: PendingOwnerStatusPhoto,
  binding: PendingOwnerStatusPhotoBinding,
) {
  return (
    typeof pending === "object" &&
    pending !== null &&
    typeof pending.blob === "object" &&
    pending.blob !== null &&
    typeof pending.blob.size === "number" &&
    pending.key === pendingOwnerStatusPhotoKey(binding) &&
    pending.shopId === binding.shopId &&
    pending.appointmentId === binding.appointmentId &&
    pending.guardianId === binding.guardianId &&
    pending.petId === binding.petId &&
    pending.mediaKind === binding.mediaKind &&
    pending.nextStatus === binding.nextStatus &&
    typeof pending.allowSkip === "boolean" &&
    typeof pending.uploadAttemptId === "string" &&
    pending.uploadAttemptId.length > 0 &&
    typeof pending.uploadStarted === "boolean" &&
    pending.byteSize === pending.blob.size
  );
}

export function isPendingDurableAssetReusable(
  pending: PendingOwnerStatusPhoto,
  asset: MediaAsset,
) {
  const identityMatches = pending.durableMediaAssetId
    ? asset.id === pending.durableMediaAssetId
    : asset.metadata?.owner_pending_upload_id === pending.uploadAttemptId;
  return Boolean(
    identityMatches &&
    asset.shop_id === pending.shopId &&
    asset.appointment_id === pending.appointmentId &&
    asset.guardian_id === pending.guardianId &&
    asset.pet_id === pending.petId &&
    asset.media_kind === pending.mediaKind &&
    asset.status === "ready" &&
    asset.deleted_at === null,
  );
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("PENDING_PHOTO_STORAGE_UNAVAILABLE"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("PENDING_PHOTO_STORAGE_UNAVAILABLE"));
  });
}

async function runStoreRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(new Error("PENDING_PHOTO_STORAGE_UNAVAILABLE"));
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(new Error("PENDING_PHOTO_STORAGE_UNAVAILABLE"));
      transaction.onerror = () => reject(new Error("PENDING_PHOTO_STORAGE_UNAVAILABLE"));
    });
  } finally {
    database.close();
  }
}

export async function writePendingOwnerStatusPhoto(pending: PendingOwnerStatusPhoto) {
  await runStoreRequest("readwrite", (store) => store.put(pending));
  return pending;
}

export async function readPendingOwnerStatusPhoto(binding: PendingOwnerStatusPhotoBinding) {
  const pending = await runStoreRequest<PendingOwnerStatusPhoto | undefined>(
    "readonly",
    (store) => store.get(pendingOwnerStatusPhotoKey(binding)),
  );
  return pending && isPendingOwnerStatusPhotoExactBinding(pending, binding) ? pending : null;
}

export async function readPendingOwnerStatusPhotos(shopId: string) {
  const pending = await runStoreRequest<PendingOwnerStatusPhoto[]>("readonly", (store) => store.getAll());
  return pending.filter((item) => item.shopId === shopId).sort((left, right) => right.savedAt - left.savedAt);
}

export async function markPendingOwnerStatusPhotoDurable(
  pending: PendingOwnerStatusPhoto,
  durableMediaAssetId: string,
) {
  const next = { ...pending, durableMediaAssetId };
  await writePendingOwnerStatusPhoto(next);
  return next;
}

export async function markPendingOwnerStatusPhotoUploadStarted(pending: PendingOwnerStatusPhoto) {
  const next = { ...pending, uploadStarted: true };
  await writePendingOwnerStatusPhoto(next);
  return next;
}

export async function clearPendingOwnerStatusPhoto(binding: PendingOwnerStatusPhotoBinding) {
  await runStoreRequest("readwrite", (store) => store.delete(pendingOwnerStatusPhotoKey(binding)));
}

export async function clearPendingOwnerStatusPhotos() {
  await runStoreRequest("readwrite", (store) => store.clear());
}
