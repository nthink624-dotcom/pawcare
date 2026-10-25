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

const [pending, ownerAppSource, ownerMobilePageSource] = await Promise.all([
  importTypeScriptModule("../src/lib/media/owner-pending-status-photo.ts"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/owner/mobile/page.tsx", import.meta.url), "utf8"),
]);

async function importOwnerMobileEntryPruneHarness() {
  const start = ownerMobilePageSource.indexOf("let ownerMobileEntryPendingPhotoPruneInFlight");
  const end = ownerMobilePageSource.indexOf("\nfunction shouldUseLocalMobilePreview", start);
  assert.ok(start >= 0 && end > start, "owner mobile entry prune helper must remain extractable");
  const source = ownerMobilePageSource.slice(start, end);
  const javascript = stripTypeScriptTypes(source, { mode: "transform" });
  return import(
    `data:text/javascript;base64,${Buffer.from(`${javascript}\nexport { runOwnerMobileEntryPendingPhotoPrune };`).toString("base64")}`
  );
}

function createFakeIndexedDb() {
  const records = new Map();
  let initialized = false;
  let failDeletes = false;

  return {
    records,
    setFailDeletes(value) {
      failDeletes = value;
    },
    indexedDB: {
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
              let failed = false;
              const transaction = {
                error: null,
                objectStore() {
                  const finishRequest = () => {
                    pendingRequests -= 1;
                    if (failed || pendingRequests !== 0 || completionQueued) return;
                    completionQueued = true;
                    queueMicrotask(() => {
                      if (!failed && pendingRequests === 0) transaction.oncomplete?.();
                    });
                  };
                  const run = (work) => {
                    const operation = {};
                    pendingRequests += 1;
                    queueMicrotask(() => {
                      if (failed) {
                        finishRequest();
                        return;
                      }
                      try {
                        operation.result = work();
                        operation.onsuccess?.();
                      } catch (error) {
                        failed = true;
                        operation.error = error;
                        transaction.error = error;
                        operation.onerror?.();
                        transaction.onerror?.();
                      } finally {
                        finishRequest();
                      }
                    });
                    return operation;
                  };
                  return {
                    get: (key) => run(() => records.get(key)),
                    getAll: () => run(() => [...records.values()]),
                    put: (value) => run(() => {
                      records.set(value.key, value);
                      return value.key;
                    }),
                    delete: (key) => run(() => {
                      if (failDeletes) throw new DOMException("delete failed", "UnknownError");
                      return records.delete(key);
                    }),
                  };
                },
                abort() {
                  if (failed) return;
                  failed = true;
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
    },
  };
}

function binding(accountId, appointmentId = "appt-1") {
  return {
    accountId,
    shopId: "shop-1",
    appointmentId,
    guardianId: `guardian-${appointmentId}`,
    petId: `pet-${appointmentId}`,
    mediaKind: "grooming_before",
    nextStatus: "in_progress",
    allowSkip: false,
  };
}

function photo(name) {
  return new File([name], `${name}.jpg`, { type: "image/jpeg", lastModified: 1 });
}

async function withFakeIndexedDb(run) {
  const originalIndexedDb = globalThis.indexedDB;
  const fake = createFakeIndexedDb();
  globalThis.indexedDB = fake.indexedDB;
  try {
    await run(fake);
  } finally {
    globalThis.indexedDB = originalIndexedDb;
  }
}

test("pending Blob recovery window matches the representative-approved 30-day local recovery policy", () => {
  const {
    createPendingOwnerStatusPhoto,
    PENDING_OWNER_STATUS_PHOTO_RETENTION_DAYS,
    PENDING_OWNER_STATUS_PHOTO_RETENTION_MS,
  } = pending.module;
  assert.equal(PENDING_OWNER_STATUS_PHOTO_RETENTION_DAYS, 30);

  const now = 1_000;
  const staged = createPendingOwnerStatusPhoto(binding("owner:user-a"), photo("before"), now);
  assert.equal(staged.savedAt, now);
  assert.equal(staged.expiresAt, now + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS);
  assert.equal(staged.recordType, "pending_photo");
});

test("retry preserves the first retention window while a newly selected photo gets a new window", async () => {
  await withFakeIndexedDb(async (fake) => {
    const {
      createPendingOwnerStatusPhoto,
      createPendingOwnerStatusPhotoRetry,
      PENDING_OWNER_STATUS_PHOTO_RETENTION_MS,
      pruneExpiredPendingOwnerStatusPhotos,
      stagePendingOwnerStatusPhoto,
      writePendingOwnerStatusPhoto,
    } = pending.module;
    const firstSavedAt = 5_000;
    const retryAt = firstSavedAt + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS - 1;
    const currentBinding = binding("owner:user-a");
    const first = createPendingOwnerStatusPhoto(currentBinding, photo("same"), firstSavedAt);
    await stagePendingOwnerStatusPhoto(first, firstSavedAt);

    const retry = createPendingOwnerStatusPhotoRetry(first, retryAt);
    await writePendingOwnerStatusPhoto(retry);
    assert.equal(retry.savedAt, first.savedAt);
    assert.equal(retry.expiresAt, first.expiresAt);
    assert.notEqual(retry.uploadAttemptId, first.uploadAttemptId);
    assert.equal(retry.fileName, first.fileName);
    assert.equal(retry.byteSize, first.byteSize);
    assert.equal(retry.durableMediaAssetId, null);
    assert.equal(retry.uploadStarted, false);

    const replacement = createPendingOwnerStatusPhoto(currentBinding, photo("new"), retryAt);
    assert.equal(replacement.savedAt, retryAt);
    assert.equal(replacement.expiresAt, retryAt + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS);

    await pruneExpiredPendingOwnerStatusPhotos(first.expiresAt);
    assert.equal(fake.records.has(first.key), false);
  });
});

test("unauthenticated entry prune removes only expired local Blobs and preserves account notices", async () => {
  await withFakeIndexedDb(async (fake) => {
    const {
      createPendingOwnerStatusPhoto,
      PENDING_OWNER_STATUS_PHOTO_RETENTION_MS,
      pruneExpiredPendingOwnerStatusPhotos,
      stagePendingOwnerStatusPhoto,
    } = pending.module;
    const firstSavedAt = 40_000;
    const entryAt = firstSavedAt + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS;
    const expiredBinding = binding("owner:user-a", "appt-expired");
    const currentBinding = binding("owner:user-b", "appt-current");
    const expired = createPendingOwnerStatusPhoto(expiredBinding, photo("expired"), firstSavedAt);
    const current = {
      ...createPendingOwnerStatusPhoto(currentBinding, photo("current"), entryAt),
      durableMediaAssetId: "asset-current",
    };
    await stagePendingOwnerStatusPhoto(expired, firstSavedAt);
    await stagePendingOwnerStatusPhoto(current, entryAt);

    await pruneExpiredPendingOwnerStatusPhotos(entryAt);

    assert.equal(fake.records.has(expired.key), false);
    assert.equal(fake.records.get(current.key)?.blob instanceof Blob, true);
    assert.equal(fake.records.get(current.key)?.durableMediaAssetId, "asset-current");
    const notices = [...fake.records.values()].filter((record) => record?.recordType === "expiry_notice");
    assert.equal(notices.length, 1);
    assert.equal(notices[0].accountId, expiredBinding.accountId);
    assert.equal(notices[0].expiredCount, 1);
    assert.equal("blob" in notices[0], false);
    assert.equal("appointmentId" in notices[0], false);
    assert.equal("durableMediaAssetId" in notices[0], false);
  });
});

test("entry prune coalesces StrictMode duplicates and retries after a local failure", async () => {
  const { runOwnerMobileEntryPendingPhotoPrune } = await importOwnerMobileEntryPruneHarness();
  let calls = 0;
  let finishFirst;
  const firstResult = new Promise((resolve) => { finishFirst = resolve; });
  const first = runOwnerMobileEntryPendingPhotoPrune(() => {
    calls += 1;
    return firstResult;
  });
  const strictModeDuplicate = runOwnerMobileEntryPendingPhotoPrune(() => {
    calls += 1;
    return Promise.resolve({ removedPhotoCount: 99 });
  });
  assert.equal(first, strictModeDuplicate);
  assert.equal(calls, 1);
  finishFirst({ removedPhotoCount: 1 });
  await first;

  await assert.rejects(
    runOwnerMobileEntryPendingPhotoPrune(() => {
      calls += 1;
      return Promise.reject(new Error("local IndexedDB delete failed"));
    }),
    /local IndexedDB delete failed/,
  );
  const retried = await runOwnerMobileEntryPendingPhotoPrune(() => {
    calls += 1;
    return Promise.resolve({ removedPhotoCount: 1 });
  });
  assert.equal(retried.removedPhotoCount, 1);
  assert.equal(calls, 3);
});

test("time progression restores before expiry and removes the local Blob at expiry with an explicit notice", async () => {
  await withFakeIndexedDb(async (fake) => {
    const {
      createPendingOwnerStatusPhoto,
      PENDING_OWNER_STATUS_PHOTO_RETENTION_MS,
      restorePendingOwnerStatusPhotos,
      stagePendingOwnerStatusPhoto,
    } = pending.module;
    const now = 10_000;
    const currentBinding = binding("owner:user-a");
    const staged = createPendingOwnerStatusPhoto(currentBinding, photo("before"), now);
    await stagePendingOwnerStatusPhoto(staged, now);

    const beforeExpiry = await restorePendingOwnerStatusPhotos(
      currentBinding.accountId,
      currentBinding.shopId,
      now + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS - 1,
    );
    assert.equal(beforeExpiry.photos.length, 1);
    assert.equal(beforeExpiry.expiredCount, 0);

    const atExpiry = await restorePendingOwnerStatusPhotos(
      currentBinding.accountId,
      currentBinding.shopId,
      now + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS,
    );
    assert.equal(atExpiry.photos.length, 0);
    assert.equal(atExpiry.expiredCount, 1);
    assert.equal([...fake.records.values()].some((record) => record?.blob instanceof Blob), false);
  });
});

test("login under another account prunes stale Blobs without exposing the notice until the owning account returns", async () => {
  await withFakeIndexedDb(async (fake) => {
    const {
      createPendingOwnerStatusPhoto,
      PENDING_OWNER_STATUS_PHOTO_RETENTION_MS,
      restorePendingOwnerStatusPhotos,
      stagePendingOwnerStatusPhoto,
    } = pending.module;
    const start = 20_000;
    const later = start + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS;
    const firstBinding = binding("owner:user-a", "appt-a");
    const secondBinding = binding("owner:user-b", "appt-b");
    await stagePendingOwnerStatusPhoto(createPendingOwnerStatusPhoto(firstBinding, photo("first"), start), start);
    await stagePendingOwnerStatusPhoto(createPendingOwnerStatusPhoto(secondBinding, photo("second"), later), later);

    const secondAccount = await restorePendingOwnerStatusPhotos(secondBinding.accountId, secondBinding.shopId, later);
    assert.equal(secondAccount.photos.length, 1);
    assert.equal(secondAccount.photos[0].accountId, secondBinding.accountId);
    assert.equal(secondAccount.expiredCount, 0);
    const firstAccountRecords = [...fake.records.values()].filter((record) => record?.accountId === firstBinding.accountId);
    assert.equal(firstAccountRecords.length, 1);
    assert.equal(firstAccountRecords[0].recordType, "expiry_notice");
    assert.equal("blob" in firstAccountRecords[0], false);
    assert.equal("appointmentId" in firstAccountRecords[0], false);

    const firstAccount = await restorePendingOwnerStatusPhotos(firstBinding.accountId, firstBinding.shopId, later);
    assert.equal(firstAccount.photos.length, 0);
    assert.equal(firstAccount.expiredCount, 1);
    assert.equal([...fake.records.values()].some((record) => record?.accountId === firstBinding.accountId), false);
    assert.equal([...fake.records.values()].some((record) => record?.accountId === secondBinding.accountId && record?.blob instanceof Blob), true);
  });
});

test("legacy records use savedAt for expiry instead of remaining indefinitely", async () => {
  await withFakeIndexedDb(async () => {
    const {
      createPendingOwnerStatusPhoto,
      PENDING_OWNER_STATUS_PHOTO_RETENTION_MS,
      restorePendingOwnerStatusPhotos,
      writePendingOwnerStatusPhoto,
    } = pending.module;
    const legacyBinding = binding("owner:legacy");
    const legacy = createPendingOwnerStatusPhoto(legacyBinding, photo("legacy"), 1);
    delete legacy.expiresAt;
    legacy.savedAt = 0;
    await writePendingOwnerStatusPhoto(legacy);

    const restored = await restorePendingOwnerStatusPhotos(
      legacyBinding.accountId,
      legacyBinding.shopId,
      PENDING_OWNER_STATUS_PHOTO_RETENTION_MS + 1,
    );
    assert.equal(restored.photos.length, 0);
    assert.equal(restored.expiredCount, 1);
  });
});

test("expiry and logout deletion failures reject visibly and keep the original local record", async () => {
  await withFakeIndexedDb(async (fake) => {
    const {
      clearPendingOwnerStatusPhotos,
      createPendingOwnerStatusPhoto,
      PENDING_OWNER_STATUS_PHOTO_RETENTION_MS,
      pruneExpiredPendingOwnerStatusPhotos,
      stagePendingOwnerStatusPhoto,
    } = pending.module;
    const now = 30_000;
    const currentBinding = binding("owner:user-a");
    const staged = createPendingOwnerStatusPhoto(currentBinding, photo("delete-error"), now);
    await stagePendingOwnerStatusPhoto(staged, now);
    fake.setFailDeletes(true);

    await assert.rejects(
      pruneExpiredPendingOwnerStatusPhotos(now + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS),
      { name: "PENDING_PHOTO_STORAGE_UNAVAILABLE" },
    );
    assert.equal(fake.records.get(staged.key)?.blob instanceof Blob, true);
    await assert.rejects(clearPendingOwnerStatusPhotos(currentBinding.accountId), {
      name: "PENDING_PHOTO_STORAGE_UNAVAILABLE",
    });
    assert.equal(fake.records.get(staged.key)?.blob instanceof Blob, true);
    fake.setFailDeletes(false);
    await pruneExpiredPendingOwnerStatusPhotos(now + PENDING_OWNER_STATUS_PHOTO_RETENTION_MS);
    assert.equal(fake.records.has(staged.key), false);
  });
});

test("owner mobile entry starts local prune before auth without blocking navigation or making a server request", () => {
  assert.match(
    ownerMobilePageSource,
    /import \{ pruneExpiredPendingOwnerStatusPhotos \} from "@\/lib\/media\/owner-pending-status-photo"/,
  );
  const entryStart = ownerMobilePageSource.indexOf("const ownerMobileEntryPruneStartedRef");
  const entryEnd = ownerMobilePageSource.indexOf("\n  function loadOwnerMobileDemoFallback", entryStart);
  const authStart = ownerMobilePageSource.indexOf("\n  async function getOwnerAccessContext");
  const authLoadStart = ownerMobilePageSource.indexOf("\n    async function load()", authStart);
  assert.ok(entryStart >= 0 && entryEnd > entryStart);
  assert.ok(entryStart < authStart && entryEnd < authLoadStart);
  const entry = ownerMobilePageSource.slice(entryStart, entryEnd);
  assert.match(entry, /if \(ownerMobileEntryPruneStartedRef\.current\) return;/);
  assert.match(entry, /void runOwnerMobileEntryPendingPhotoPrune\(\)\.catch/);
  assert.match(entry, /ownerMobileEntryPruneStartedRef\.current = false/);
  assert.doesNotMatch(entry, /await |fetchApiJsonWithAuth|getOwnerAccessContext|router\.replace|supabase|console\./);

  const helperStart = ownerMobilePageSource.indexOf("let ownerMobileEntryPendingPhotoPruneInFlight");
  const helperEnd = ownerMobilePageSource.indexOf("\nfunction shouldUseLocalMobilePreview", helperStart);
  const helper = ownerMobilePageSource.slice(helperStart, helperEnd);
  assert.doesNotMatch(helper, /fetch\(|fetchApiJsonWithAuth|supabase|router|console\.|accountId|appointmentId|durableMediaAssetId/);
});

test("Owner UI checks expiry on login, photo open, and app resume without deleting server media", () => {
  assert.match(ownerAppSource, /pruneExpiredPendingOwnerStatusPhotos\(\)/);
  assert.match(ownerAppSource, /readPendingOwnerStatusPhotos\(pendingPhotoAccountId, data\.shop\.id\)/);
  assert.match(ownerAppSource, /consumePendingOwnerStatusPhotoExpiryNotices\(pendingPhotoAccountId\)/);
  assert.match(ownerAppSource, /window\.addEventListener\("pageshow", pruneExpiredPendingPhotosOnAppResume\)/);
  assert.match(ownerAppSource, /window\.addEventListener\("focus", pruneExpiredPendingPhotosOnAppResume\)/);
  assert.match(ownerAppSource, /document\.addEventListener\("visibilitychange", pruneExpiredPendingPhotosOnAppResume\)/);
  assert.match(ownerAppSource, /createPendingOwnerStatusPhotoRetry\(pending\)/);
  assert.match(ownerAppSource, /기기 임시 복구.*일/);
  assert.match(ownerAppSource, /서버에 저장된 사진은 삭제하지 않았습니다/);

  const logoutStart = ownerAppSource.indexOf("async function handleOwnerLogout()");
  const logoutEnd = ownerAppSource.indexOf("\n  async function handleRequestError", logoutStart);
  const logout = ownerAppSource.slice(logoutStart, logoutEnd);
  assert.match(logout, /clearPendingOwnerStatusPhotos\(pendingPhotoAccountId\)/);
  assert.match(logout, /catch[\s\S]*setError\([\s\S]*로그아웃을 중단했습니다[\s\S]*return;/);
  assert.ok(logout.indexOf("return;") < logout.indexOf("if (onLogout) await onLogout()"));
  assert.doesNotMatch(pending.source, /fetch\(|supabase|deleteOwnerMedia|removeOwnerMedia/i);
});
