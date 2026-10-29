/** Encrypted, short-lived presentation cache. Never an authentication or write authority. */
export const OWNER_STARTUP_RETENTION_MS = 24 * 60 * 60 * 1000;
const DB_NAME = "petmanager-owner-startup-v1";
const STORE = "records";
const VERSION = 1;
export const OWNER_STARTUP_INVALIDATION_STORAGE_KEY = "petmanager.ownerStartupInvalidation";
const encoder = new TextEncoder();
type Scope = { principalId: string; shopId: string };
type Sealed = { kind: "snapshot"; version: 1; invalidationStamp: string; capturedAt: number; expiresAt: number; iv: Uint8Array; ciphertext: ArrayBuffer };
export type OwnerStartupSnapshot<T> = Scope & { source: "local_snapshot"; capturedAt: number; expiresAt: number; data: T };
let database: Promise<IDBDatabase> | null = null;
let epoch = 0;

function newInvalidationStamp() {
  return crypto.randomUUID();
}

/** Synchronous across tabs; capture before any crypto/IDB await. Never an auth grant. */
export function readOwnerStartupInvalidationStamp(): string | null {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(OWNER_STARTUP_INVALIDATION_STORAGE_KEY); }
  catch { return null; }
}

// Reserve a fixed-size marker before requests/writes start. If storage is unavailable,
// presentation persistence stays disabled; normal authenticated networking still works.
if (typeof window !== "undefined") {
  try {
    if (!window.localStorage.getItem(OWNER_STARTUP_INVALIDATION_STORAGE_KEY)) {
      window.localStorage.setItem(OWNER_STARTUP_INVALIDATION_STORAGE_KEY, newInvalidationStamp());
    }
  } catch { /* Optional cache only. */ }
}

function openDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = null; };
      resolve(request.result);
    };
    request.onerror = () => { database = null; reject(request.error); };
    request.onblocked = () => { database = null; reject(new Error("Startup store unavailable")); };
  });
  return database;
}

async function readValue<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function removeExpired(id: string, now: number) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.get("snapshot:" + id);
    request.onsuccess = () => {
      if (request.result?.expiresAt <= now) {
        store.delete("snapshot:" + id);
        store.delete("key:" + id);
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}

async function scopeKey(scope: Scope) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify([scope.principalId, scope.shopId])));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

function validScope(scope: Scope) {
  return Boolean(scope.principalId?.trim() && scope.principalId === scope.principalId.trim() && scope.shopId?.trim() && scope.shopId === scope.shopId.trim());
}

/** The unverified JWT subject is only a partition hint; it never grants access. */
export function ownerStartupPrincipalHint(token: string | null): string | null {
  if (!token) return null;
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const value: unknown = JSON.parse(atob(encoded));
    return value && typeof value === "object" && "sub" in value && typeof value.sub === "string" && value.sub.trim() === value.sub && value.sub ? value.sub : null;
  } catch { return null; }
}

/** Pass only an API-confirmed, purpose-limited payload, never optimistic component state. */
export async function writeOwnerStartupSnapshot<T>(scope: Scope, data: T, capturedAt = Date.now(), isCurrent = () => true) {
  const startedEpoch = epoch;
  const invalidationStamp = readOwnerStartupInvalidationStamp();
  if (!invalidationStamp || !isCurrent() || !validScope(scope) || !Number.isFinite(capturedAt) || capturedAt > Date.now() + 30_000) return;
  const current = () => epoch === startedEpoch && readOwnerStartupInvalidationStamp() === invalidationStamp && isCurrent();
  const id = await scopeKey(scope);
  if (!current()) return;
  const db = await openDatabase();
  // Capture a persistent invalidation generation, including logout in another tab.
  const generation = await readValue<number>("generation") ?? 0;
  if (!current()) return;
  const currentKey = await readValue<CryptoKey>("key:" + id);
  const key = currentKey ?? await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const expiresAt = capturedAt + OWNER_STARTUP_RETENTION_MS;
  const body: OwnerStartupSnapshot<T> = { ...scope, source: "local_snapshot", capturedAt, expiresAt, data };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(JSON.stringify([id, invalidationStamp])) }, key, encoder.encode(JSON.stringify(body)));
  if (!current()) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const check = store.get("generation");
    check.onsuccess = () => {
      if ((check.result ?? 0) !== generation || !current()) return;
      // Reject delayed older responses and avoid overwriting a concurrently created key.
      const latestKey = store.get("key:" + id);
      latestKey.onsuccess = () => {
        if (latestKey.result && !currentKey) return;
        const latest = store.get("snapshot:" + id);
        latest.onsuccess = () => {
          if (!current()) return;
          if (latest.result?.capturedAt > capturedAt) return;
          store.put(key, "key:" + id);
          store.put({ kind: "snapshot", version: VERSION, invalidationStamp, capturedAt, expiresAt, iv, ciphertext } satisfies Sealed, "snapshot:" + id);
          // There is one active account/shop partition on this device, never an all-account archive.
          store.put(id, "active");
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const item = cursor.result;
            if (!item) return;
            const name = String(item.key);
            if ((name.startsWith("key:") || name.startsWith("snapshot:")) && !name.endsWith(id)) item.delete();
            item.continue();
          };
        };
      };
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}

export async function readOwnerStartupSnapshot<T>(scope: Scope, now = Date.now()): Promise<OwnerStartupSnapshot<T> | null> {
  const startedEpoch = epoch;
  const invalidationStamp = readOwnerStartupInvalidationStamp();
  if (!invalidationStamp || !validScope(scope)) return null;
  const id = await scopeKey(scope);
  if (readOwnerStartupInvalidationStamp() !== invalidationStamp || epoch !== startedEpoch) return null;
  const [active, key, value, generation] = await Promise.all([
    readValue<string>("active"), readValue<CryptoKey>("key:" + id), readValue<Sealed>("snapshot:" + id), readValue<number>("generation"),
  ]);
  if (value && value.expiresAt <= now) { await removeExpired(id, now); return null; }
  if (active !== id || !key || !value || value.version !== VERSION || value.invalidationStamp !== invalidationStamp || value.kind !== "snapshot" ||
      value.capturedAt > now + 30_000 || value.expiresAt <= now || value.expiresAt - value.capturedAt !== OWNER_STARTUP_RETENTION_MS) return null;
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: value.iv as Uint8Array<ArrayBuffer>, additionalData: encoder.encode(JSON.stringify([id, invalidationStamp])) }, key, value.ciphertext);
    const snapshot = JSON.parse(new TextDecoder().decode(plaintext)) as OwnerStartupSnapshot<T>;
    if ((await readValue<number>("generation")) !== generation || (await readValue<string>("active")) !== id) return null;
    if (epoch !== startedEpoch || readOwnerStartupInvalidationStamp() !== invalidationStamp || snapshot.source !== "local_snapshot" || snapshot.principalId !== scope.principalId || snapshot.shopId !== scope.shopId ||
        snapshot.capturedAt !== value.capturedAt || snapshot.expiresAt !== value.expiresAt) return null;
    return snapshot;
  } catch { return null; }
}

/** Clear synchronously invalidates in-flight work; the transaction also fences other tabs. */
export async function clearOwnerStartupSnapshots() {
  epoch += 1;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(OWNER_STARTUP_INVALIDATION_STORAGE_KEY, newInvalidationStamp()); }
    catch {
      // Removal needs no extra quota and makes every pre-clear stamp invalid.
      try { window.localStorage.removeItem(OWNER_STARTUP_INVALIDATION_STORAGE_KEY); } catch { /* IDB clear below still runs. */ }
    }
  }
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const previous = store.get("generation");
    previous.onsuccess = () => { const generation = (previous.result ?? 0) + 1; store.clear(); store.put(generation, "generation"); };
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}
