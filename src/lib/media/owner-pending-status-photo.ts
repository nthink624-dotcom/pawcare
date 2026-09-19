import type { Appointment, AppointmentStatus, MediaAsset, MediaKind } from "@/types/domain";

const DATABASE_NAME = "petmanager-owner-media-v1";
const STORE_NAME = "pending-status-photos";
const DATABASE_VERSION = 1;
const UPLOAD_CLAIM_LEASE_MS = 2 * 60 * 1000;
export const PENDING_OWNER_STATUS_PHOTO_RETENTION_DAYS = 30;
export const PENDING_OWNER_STATUS_PHOTO_RETENTION_MS =
  PENDING_OWNER_STATUS_PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const EXPIRY_NOTICE_PREFIX = "pending-photo-expiry-notice";

export type PendingOwnerStatusPhotoBinding = {
  accountId: string;
  shopId: string;
  appointmentId: string;
  guardianId: string;
  petId: string;
  mediaKind: Extract<MediaKind, "grooming_before" | "grooming_after">;
  nextStatus: Extract<AppointmentStatus, "in_progress" | "completed">;
  allowSkip: boolean;
};

export type PendingOwnerStatusPhoto = PendingOwnerStatusPhotoBinding & {
  recordType: "pending_photo";
  key: string;
  blob: Blob;
  fileName: string;
  contentType: string;
  lastModified: number;
  byteSize: number;
  savedAt: number;
  expiresAt: number;
  uploadAttemptId: string;
  uploadStarted: boolean;
  uploadClaimId: string | null;
  uploadClaimedAt: number | null;
  durableMediaAssetId: string | null;
};

type PendingOwnerStatusPhotoExpiryNotice = {
  recordType: "expiry_notice";
  key: string;
  accountId: string;
  expiredCount: number;
  latestExpiredAt: number;
  recordedAt: number;
};

export type PendingOwnerStatusPhotoRestoreResult = {
  photos: PendingOwnerStatusPhoto[];
  expiredCount: number;
};

export type PendingOwnerStatusPhotoSingleRestoreResult = {
  photo: PendingOwnerStatusPhoto | null;
  expiredCount: number;
};

function createOpaqueId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createPendingOwnerStatusPhotoUploadClaimId() {
  return createOpaqueId();
}

export function pendingOwnerStatusPhotoKey(binding: PendingOwnerStatusPhotoBinding) {
  return [binding.accountId, binding.shopId, binding.appointmentId, binding.mediaKind, binding.nextStatus]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

export function createPendingOwnerStatusPhoto(
  binding: PendingOwnerStatusPhotoBinding,
  file: File,
  now = Date.now(),
): PendingOwnerStatusPhoto {
  return {
    ...binding,
    recordType: "pending_photo",
    key: pendingOwnerStatusPhotoKey(binding),
    blob: file,
    fileName: file.name || "grooming-photo.jpg",
    contentType: file.type || "image/jpeg",
    lastModified: file.lastModified || now,
    byteSize: file.size,
    savedAt: now,
    expiresAt: now + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS,
    uploadAttemptId: createOpaqueId(),
    uploadStarted: false,
    uploadClaimId: null,
    uploadClaimedAt: null,
    durableMediaAssetId: null,
  };
}

function pendingOwnerStatusPhotoExpiresAt(value: { savedAt?: unknown; expiresAt?: unknown }) {
  if (typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)) return value.expiresAt;
  if (typeof value.savedAt === "number" && Number.isFinite(value.savedAt)) {
    return value.savedAt + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS;
  }
  return 0;
}

export function isPendingOwnerStatusPhotoExpired(
  pending: Pick<PendingOwnerStatusPhoto, "savedAt" | "expiresAt">,
  now = Date.now(),
) {
  return pendingOwnerStatusPhotoExpiresAt(pending) <= now;
}

export function createPendingOwnerStatusPhotoRetry(
  pending: PendingOwnerStatusPhoto,
  now = Date.now(),
): PendingOwnerStatusPhoto {
  const retry = createPendingOwnerStatusPhoto(
    pending,
    pendingOwnerStatusPhotoToFile(pending),
    now,
  );
  return {
    ...retry,
    savedAt: pending.savedAt,
    expiresAt: pendingOwnerStatusPhotoExpiresAt(pending),
  };
}

function normalizePendingOwnerStatusPhoto(value: unknown): PendingOwnerStatusPhoto | null {
  if (typeof value !== "object" || value === null || !("blob" in value) || !(value.blob instanceof Blob)) {
    return null;
  }
  const pending = value as PendingOwnerStatusPhoto;
  return {
    ...pending,
    recordType: "pending_photo",
    expiresAt: pendingOwnerStatusPhotoExpiresAt(pending),
  };
}

function isPendingOwnerStatusPhotoExpiryNotice(value: unknown): value is PendingOwnerStatusPhotoExpiryNotice {
  if (typeof value !== "object" || value === null) return false;
  const notice = value as Partial<PendingOwnerStatusPhotoExpiryNotice>;
  return (
    notice.recordType === "expiry_notice" &&
    typeof notice.key === "string" &&
    typeof notice.accountId === "string" &&
    typeof notice.expiredCount === "number" &&
    Number.isFinite(notice.expiredCount) &&
    notice.expiredCount > 0 &&
    typeof notice.latestExpiredAt === "number" &&
    Number.isFinite(notice.latestExpiredAt)
  );
}

function pendingOwnerStatusPhotoExpiryNoticeKey(accountId: string) {
  return `${EXPIRY_NOTICE_PREFIX}:${encodeURIComponent(accountId)}`;
}

function createPendingOwnerStatusPhotoExpiryNotice(
  accountId: string,
  expiredCount: number,
  latestExpiredAt: number,
  now: number,
): PendingOwnerStatusPhotoExpiryNotice {
  return {
    recordType: "expiry_notice",
    key: pendingOwnerStatusPhotoExpiryNoticeKey(accountId),
    accountId,
    expiredCount,
    latestExpiredAt,
    recordedAt: now,
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
    pending.blob instanceof Blob &&
    pendingOwnerStatusPhotoExpiresAt(pending) > 0 &&
    pending.key === pendingOwnerStatusPhotoKey(binding) &&
    pending.accountId === binding.accountId &&
    pending.shopId === binding.shopId &&
    pending.appointmentId === binding.appointmentId &&
    pending.guardianId === binding.guardianId &&
    pending.petId === binding.petId &&
    pending.mediaKind === binding.mediaKind &&
    pending.nextStatus === binding.nextStatus &&
    pending.allowSkip === binding.allowSkip &&
    typeof pending.uploadAttemptId === "string" &&
    pending.uploadAttemptId.length > 0 &&
    typeof pending.uploadStarted === "boolean" &&
    (pending.uploadClaimId === null || typeof pending.uploadClaimId === "string") &&
    (pending.uploadClaimedAt === null || Number.isFinite(pending.uploadClaimedAt)) &&
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

export type PendingOwnerStatusPhotoCommitReadback = {
  appointment: Appointment | null;
  mediaAsset: MediaAsset | null;
};

type PendingOwnerStatusPhotoCommitEvaluation =
  | { outcome: "committed"; appointment: Appointment; mediaAsset: MediaAsset }
  | { outcome: "advanced"; appointment: Appointment; mediaAsset: MediaAsset | null }
  | { outcome: "not_committed"; appointment: Appointment; mediaAsset: MediaAsset }
  | { outcome: "unconfirmed" };

export type PendingOwnerStatusPhotoCommitResult =
  | { outcome: "committed"; confirmedBy: "commit" | "readback"; appointment: Appointment; mediaAsset: MediaAsset }
  | { outcome: "advanced"; appointment: Appointment; mediaAsset: MediaAsset | null }
  | { outcome: "retry"; reason: "not_committed" | "binding_mismatch" | "readback_failed" };

function isPendingOwnerStatusPhotoAppointmentBinding(
  pending: PendingOwnerStatusPhoto,
  appointment: Appointment,
) {
  return (
    appointment.id === pending.appointmentId &&
    appointment.shop_id === pending.shopId &&
    appointment.guardian_id === pending.guardianId &&
    appointment.pet_id === pending.petId
  );
}

function isAllowedPhotoStatusPredecessor(
  status: AppointmentStatus,
  nextStatus: PendingOwnerStatusPhoto["nextStatus"],
) {
  return nextStatus === "in_progress"
    ? status === "confirmed"
    : status === "in_progress" || status === "almost_done";
}

function hasAdvancedPastPhotoStatus(
  status: AppointmentStatus,
  nextStatus: PendingOwnerStatusPhoto["nextStatus"],
) {
  return nextStatus === "in_progress" && (status === "almost_done" || status === "completed");
}

export function evaluatePendingOwnerStatusPhotoCommit(
  pending: PendingOwnerStatusPhoto,
  readback: PendingOwnerStatusPhotoCommitReadback,
): PendingOwnerStatusPhotoCommitEvaluation {
  const appointment = readback.appointment;
  if (!appointment || !isPendingOwnerStatusPhotoAppointmentBinding(pending, appointment)) {
    return { outcome: "unconfirmed" };
  }

  const mediaAsset = readback.mediaAsset;
  const exactMediaBinding = Boolean(mediaAsset && isPendingDurableAssetReusable(pending, mediaAsset));
  if (appointment.status === pending.nextStatus) {
    return exactMediaBinding
      ? { outcome: "committed", appointment, mediaAsset: mediaAsset as MediaAsset }
      : { outcome: "unconfirmed" };
  }
  if (hasAdvancedPastPhotoStatus(appointment.status, pending.nextStatus)) {
    return { outcome: "advanced", appointment, mediaAsset };
  }
  if (exactMediaBinding && isAllowedPhotoStatusPredecessor(appointment.status, pending.nextStatus)) {
    return { outcome: "not_committed", appointment, mediaAsset: mediaAsset as MediaAsset };
  }
  return { outcome: "unconfirmed" };
}

export async function settlePendingOwnerStatusPhotoCommit({
  pending,
  durableMediaAsset,
  verifyBeforeCommit,
  commit,
  readback,
}: {
  pending: PendingOwnerStatusPhoto;
  durableMediaAsset: MediaAsset;
  verifyBeforeCommit: boolean;
  commit: () => Promise<Appointment>;
  readback: () => Promise<PendingOwnerStatusPhotoCommitReadback>;
}): Promise<PendingOwnerStatusPhotoCommitResult> {
  const resolveReadback = async () => {
    try {
      return evaluatePendingOwnerStatusPhotoCommit(pending, await readback());
    } catch {
      return null;
    }
  };

  if (verifyBeforeCommit) {
    const beforeCommit = await resolveReadback();
    if (!beforeCommit) return { outcome: "retry", reason: "readback_failed" };
    if (beforeCommit.outcome === "committed") return { ...beforeCommit, confirmedBy: "readback" };
    if (beforeCommit.outcome === "advanced") return beforeCommit;
    if (beforeCommit.outcome === "unconfirmed") return { outcome: "retry", reason: "binding_mismatch" };
  }

  try {
    const appointment = await commit();
    const committed = evaluatePendingOwnerStatusPhotoCommit(pending, {
      appointment,
      mediaAsset: durableMediaAsset,
    });
    if (committed.outcome === "committed") return { ...committed, confirmedBy: "commit" };
  } catch {
    // A lost response can mean the canonical write committed. Resolve it below without sending another PATCH.
  }

  const afterCommit = await resolveReadback();
  if (!afterCommit) return { outcome: "retry", reason: "readback_failed" };
  if (afterCommit.outcome === "committed") return { ...afterCommit, confirmedBy: "readback" };
  if (afterCommit.outcome === "advanced") return afterCommit;
  if (afterCommit.outcome === "not_committed") return { outcome: "retry", reason: "not_committed" };
  return { outcome: "retry", reason: "binding_mismatch" };
}

function storageError(error?: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  const code = name === "QuotaExceededError" ? "PENDING_PHOTO_STORAGE_QUOTA" : "PENDING_PHOTO_STORAGE_UNAVAILABLE";
  const result = new Error(code);
  result.name = code;
  return result;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(storageError());
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError(request.error));
    request.onblocked = () => reject(storageError());
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
      request.onerror = () => reject(storageError(request.error));
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(storageError(transaction.error));
      transaction.onerror = () => reject(storageError(transaction.error));
    });
  } finally {
    database.close();
  }
}

export async function writePendingOwnerStatusPhoto(pending: PendingOwnerStatusPhoto) {
  await runStoreRequest("readwrite", (store) => store.put(pending));
  return pending;
}

export async function stagePendingOwnerStatusPhoto(pending: PendingOwnerStatusPhoto, now = Date.now()) {
  const database = await openDatabase();
  try {
    return await new Promise<PendingOwnerStatusPhoto>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(pending.key) as IDBRequest<PendingOwnerStatusPhoto | undefined>;
      let operationError: Error | null = null;
      request.onsuccess = () => {
        const stored = request.result;
        const activeClaim = stored?.uploadClaimId && stored.uploadClaimedAt !== null && now - stored.uploadClaimedAt < UPLOAD_CLAIM_LEASE_MS;
        if (activeClaim) {
          operationError = new Error("다른 화면에서 같은 사진을 저장 중입니다. 잠시 후 다시 확인해 주세요.");
          operationError.name = "PENDING_PHOTO_UPLOAD_IN_PROGRESS";
          transaction.abort();
          return;
        }
        store.put(pending);
      };
      request.onerror = () => reject(storageError(request.error));
      transaction.oncomplete = () => resolve(pending);
      transaction.onabort = () => reject(operationError ?? storageError(transaction.error));
      transaction.onerror = () => reject(operationError ?? storageError(transaction.error));
    });
  } finally {
    database.close();
  }
}

export async function readPendingOwnerStatusPhoto(binding: PendingOwnerStatusPhotoBinding, now = Date.now()) {
  const stored = await runStoreRequest<unknown>(
    "readonly",
    (store) => store.get(pendingOwnerStatusPhotoKey(binding)),
  );
  const pending = normalizePendingOwnerStatusPhoto(stored);
  return pending && isPendingOwnerStatusPhotoExactBinding(pending, binding) && !isPendingOwnerStatusPhotoExpired(pending, now)
    ? pending
    : null;
}

export async function readPendingOwnerStatusPhotos(accountId: string, shopId: string, now = Date.now()) {
  const stored = await runStoreRequest<unknown[]>("readonly", (store) => store.getAll());
  return stored
    .map(normalizePendingOwnerStatusPhoto)
    .filter((item): item is PendingOwnerStatusPhoto => item !== null)
    .filter((item) => !isPendingOwnerStatusPhotoExpired(item, now))
    .filter((item) => item.accountId === accountId && item.shopId === shopId)
    .sort((left, right) => right.savedAt - left.savedAt);
}

export async function pruneExpiredPendingOwnerStatusPhotos(now = Date.now()) {
  const database = await openDatabase();
  try {
    return await new Promise<{ removedPhotoCount: number }>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll() as IDBRequest<unknown[]>;
      let removedPhotoCount = 0;
      request.onsuccess = () => {
        const expiredByAccount = new Map<string, { count: number; latestExpiredAt: number }>();
        for (const stored of request.result) {
          const pending = normalizePendingOwnerStatusPhoto(stored);
          if (pending && isPendingOwnerStatusPhotoExpired(pending, now)) {
            const expiredAt = pendingOwnerStatusPhotoExpiresAt(pending);
            store.delete(pending.key);
            const current = expiredByAccount.get(pending.accountId);
            expiredByAccount.set(pending.accountId, {
              count: (current?.count ?? 0) + 1,
              latestExpiredAt: Math.max(current?.latestExpiredAt ?? 0, expiredAt),
            });
            removedPhotoCount += 1;
          }
        }
        for (const [accountId, expired] of expiredByAccount) {
          const existingRecord = request.result.find(
            (stored) => isPendingOwnerStatusPhotoExpiryNotice(stored) && stored.accountId === accountId,
          );
          const existing = isPendingOwnerStatusPhotoExpiryNotice(existingRecord) ? existingRecord : null;
          store.put(createPendingOwnerStatusPhotoExpiryNotice(
            accountId,
            (existing?.expiredCount ?? 0) + expired.count,
            Math.max(existing?.latestExpiredAt ?? 0, expired.latestExpiredAt),
            now,
          ));
        }
      };
      request.onerror = () => reject(storageError(request.error));
      transaction.oncomplete = () => resolve({ removedPhotoCount });
      transaction.onabort = () => reject(storageError(transaction.error));
      transaction.onerror = () => reject(storageError(transaction.error));
    });
  } finally {
    database.close();
  }
}

export async function consumePendingOwnerStatusPhotoExpiryNotices(accountId: string) {
  const database = await openDatabase();
  try {
    return await new Promise<number>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll() as IDBRequest<unknown[]>;
      let expiredCount = 0;
      request.onsuccess = () => {
        for (const stored of request.result) {
          if (!isPendingOwnerStatusPhotoExpiryNotice(stored) || stored.accountId !== accountId) continue;
          store.delete(stored.key);
          expiredCount += stored.expiredCount;
        }
      };
      request.onerror = () => reject(storageError(request.error));
      transaction.oncomplete = () => resolve(expiredCount);
      transaction.onabort = () => reject(storageError(transaction.error));
      transaction.onerror = () => reject(storageError(transaction.error));
    });
  } finally {
    database.close();
  }
}

export async function restorePendingOwnerStatusPhotos(
  accountId: string,
  shopId: string,
  now = Date.now(),
): Promise<PendingOwnerStatusPhotoRestoreResult> {
  await pruneExpiredPendingOwnerStatusPhotos(now);
  const photos = await readPendingOwnerStatusPhotos(accountId, shopId, now);
  const expiredCount = await consumePendingOwnerStatusPhotoExpiryNotices(accountId);
  return { photos, expiredCount };
}

export async function restorePendingOwnerStatusPhoto(
  binding: PendingOwnerStatusPhotoBinding,
  now = Date.now(),
): Promise<PendingOwnerStatusPhotoSingleRestoreResult> {
  await pruneExpiredPendingOwnerStatusPhotos(now);
  const photo = await readPendingOwnerStatusPhoto(binding, now);
  const expiredCount = await consumePendingOwnerStatusPhotoExpiryNotices(binding.accountId);
  return { photo, expiredCount };
}

export async function claimPendingOwnerStatusPhotoUpload(
  pending: PendingOwnerStatusPhoto,
  claimId: string,
  now = Date.now(),
) {
  const database = await openDatabase();
  try {
    return await new Promise<PendingOwnerStatusPhoto | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(pending.key) as IDBRequest<PendingOwnerStatusPhoto | undefined>;
      let claimed: PendingOwnerStatusPhoto | null = null;
      request.onsuccess = () => {
        const stored = request.result;
        if (!stored || !isPendingOwnerStatusPhotoExactBinding(stored, pending)) return;
        const activeClaim = stored.uploadClaimId && stored.uploadClaimedAt !== null && now - stored.uploadClaimedAt < UPLOAD_CLAIM_LEASE_MS;
        if (activeClaim && stored.uploadClaimId !== claimId) return;
        claimed = {
          ...stored,
          uploadStarted: true,
          uploadClaimId: claimId,
          uploadClaimedAt: now,
        };
        store.put(claimed);
      };
      request.onerror = () => reject(storageError(request.error));
      transaction.oncomplete = () => resolve(claimed);
      transaction.onabort = () => reject(storageError(transaction.error));
      transaction.onerror = () => reject(storageError(transaction.error));
    });
  } finally {
    database.close();
  }
}

export async function releasePendingOwnerStatusPhotoUpload(pending: PendingOwnerStatusPhoto, claimId: string) {
  const database = await openDatabase();
  try {
    return await new Promise<PendingOwnerStatusPhoto | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(pending.key) as IDBRequest<PendingOwnerStatusPhoto | undefined>;
      let released: PendingOwnerStatusPhoto | null = null;
      request.onsuccess = () => {
        const stored = request.result;
        if (!stored || stored.uploadClaimId !== claimId || !isPendingOwnerStatusPhotoExactBinding(stored, pending)) return;
        released = { ...stored, uploadClaimId: null, uploadClaimedAt: null };
        store.put(released);
      };
      request.onerror = () => reject(storageError(request.error));
      transaction.oncomplete = () => resolve(released);
      transaction.onabort = () => reject(storageError(transaction.error));
      transaction.onerror = () => reject(storageError(transaction.error));
    });
  } finally {
    database.close();
  }
}

export async function markPendingOwnerStatusPhotoDurable(
  pending: PendingOwnerStatusPhoto,
  durableMediaAssetId: string,
) {
  const next = { ...pending, durableMediaAssetId };
  await writePendingOwnerStatusPhoto(next);
  return next;
}

export async function clearPendingOwnerStatusPhoto(binding: PendingOwnerStatusPhotoBinding) {
  await runStoreRequest("readwrite", (store) => store.delete(pendingOwnerStatusPhotoKey(binding)));
}

export async function clearPendingOwnerStatusPhotos(accountId: string) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll() as IDBRequest<Array<{ key?: unknown; accountId?: unknown }>>;
      request.onsuccess = () => {
        for (const stored of request.result) {
          if (stored.accountId === accountId && typeof stored.key === "string") store.delete(stored.key);
        }
      };
      request.onerror = () => reject(storageError(request.error));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(storageError(transaction.error));
      transaction.onerror = () => reject(storageError(transaction.error));
    });
  } finally {
    database.close();
  }
}
