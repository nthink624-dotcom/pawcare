import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

import {
  isOwnerPlayUpdateCacheFresh,
  normalizeOwnerPlayUpdateAvailability,
  OWNER_PLAY_UPDATE_CHECK_DELAY_MS,
  ownerPlayUpdateInstallNoticeStorageKey,
  ownerPlayUpdatePromptStorageKey,
  type OwnerPlayUpdateNativeState,
} from "@/lib/updates/owner-play-update-policy";

type OwnerPlayUpdatePlugin = {
  checkForUpdate(): Promise<OwnerPlayUpdateNativeState>;
  startFlexibleUpdate(): Promise<{ started: boolean; accepted: boolean }>;
  completeFlexibleUpdate(): Promise<{ requested: boolean }>;
  addListener(
    eventName: "updateStateChanged",
    listener: (state: OwnerPlayUpdateNativeState) => void,
  ): Promise<PluginListenerHandle>;
};

export type OwnerPlayUpdateSnapshot = {
  available: boolean;
  downloaded: boolean;
  targetVersionCode: number | null;
  promptTargetVersionCode: number | null;
  installNoticeTargetVersionCode: number | null;
  starting: boolean;
};

type CachedOwnerPlayUpdate = {
  checkedAt: number;
  available: boolean;
  downloaded: boolean;
  installedVersionCode: number;
  targetVersionCode: number | null;
};

const OwnerPlayUpdate = registerPlugin<OwnerPlayUpdatePlugin>("OwnerPlayUpdate");
const CACHE_STORAGE_KEY = "petmanager.ownerPlayUpdate.cache.v1";
const EMPTY_SNAPSHOT: OwnerPlayUpdateSnapshot = Object.freeze({
  available: false,
  downloaded: false,
  targetVersionCode: null,
  promptTargetVersionCode: null,
  installNoticeTargetVersionCode: null,
  starting: false,
});

let snapshot = EMPTY_SNAPSHOT;
let checkInFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function isGooglePlayAndroidRuntime() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function localStorageOrNull() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function publish(next: Partial<OwnerPlayUpdateSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function readCachedUpdate() {
  const storage = localStorageOrNull();
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(CACHE_STORAGE_KEY) ?? "null") as Partial<CachedOwnerPlayUpdate> | null;
    if (
      !parsed ||
      typeof parsed.checkedAt !== "number" ||
      typeof parsed.installedVersionCode !== "number" ||
      (parsed.targetVersionCode !== null && typeof parsed.targetVersionCode !== "number")
    ) {
      return null;
    }
    return parsed as CachedOwnerPlayUpdate;
  } catch {
    return null;
  }
}

function writeCachedUpdate(value: CachedOwnerPlayUpdate) {
  try {
    localStorageOrNull()?.setItem(CACHE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Version-only cache failure must never block the app.
  }
}

function removeCachedUpdate() {
  try {
    localStorageOrNull()?.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // A missing cache simply causes a later Play check.
  }
}

function readMarker(key: string) {
  try {
    return localStorageOrNull()?.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeMarker(key: string) {
  try {
    localStorageOrNull()?.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

function installNoticeTarget(targetVersionCode: number, downloaded: boolean) {
  if (!downloaded) return null;
  const key = ownerPlayUpdateInstallNoticeStorageKey(targetVersionCode);
  if (readMarker(key)) return null;
  writeMarker(key);
  return targetVersionCode;
}

function hydrateCachedAvailability() {
  if (!isGooglePlayAndroidRuntime()) return;
  const cached = readCachedUpdate();
  if (!cached?.available || cached.targetVersionCode === null) return;
  publish({
    available: true,
    downloaded: cached.downloaded,
    targetVersionCode: cached.targetVersionCode,
  });
}

export function subscribeOwnerPlayUpdate(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOwnerPlayUpdateSnapshot() {
  return snapshot;
}

export function getOwnerPlayUpdateServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

export async function checkOwnerPlayUpdate(options: { force?: boolean; allowPrompt?: boolean } = {}) {
  if (!isGooglePlayAndroidRuntime()) return;
  if (!options.force) {
    const cached = readCachedUpdate();
    if (cached && isOwnerPlayUpdateCacheFresh(cached.checkedAt)) return;
  }
  if (checkInFlight) return checkInFlight;

  checkInFlight = (async () => {
    try {
      const nativeState = await OwnerPlayUpdate.checkForUpdate();
      if (!nativeState.supported) {
        removeCachedUpdate();
        snapshot = EMPTY_SNAPSHOT;
        for (const listener of listeners) listener();
        return;
      }

      const availability = normalizeOwnerPlayUpdateAvailability(nativeState);
      if (!availability) return;
      const checkedAt = Date.now();
      writeCachedUpdate({ checkedAt, ...availability });

      if (!availability.available || availability.targetVersionCode === null) {
        publish({
          available: false,
          downloaded: false,
          targetVersionCode: null,
          promptTargetVersionCode: null,
          installNoticeTargetVersionCode: null,
          starting: false,
        });
        return;
      }

      const promptKey = ownerPlayUpdatePromptStorageKey(availability.targetVersionCode);
      let promptTargetVersionCode: number | null = null;
      if (options.allowPrompt !== false && !readMarker(promptKey)) {
        writeMarker(promptKey);
        promptTargetVersionCode = availability.targetVersionCode;
      }
      publish({
        available: true,
        downloaded: availability.downloaded,
        targetVersionCode: availability.targetVersionCode,
        promptTargetVersionCode,
        installNoticeTargetVersionCode: installNoticeTarget(
          availability.targetVersionCode,
          availability.downloaded,
        ),
      });
    } catch {
      // Unsupported shells, offline devices, and Play lookup failures stay silent.
    }
  })().finally(() => {
    checkInFlight = null;
  });

  return checkInFlight;
}

export function dismissOwnerPlayUpdatePrompt(targetVersionCode: number) {
  if (snapshot.promptTargetVersionCode !== targetVersionCode) return;
  publish({ promptTargetVersionCode: null });
}

export function dismissOwnerPlayUpdateInstallNotice(targetVersionCode: number) {
  if (snapshot.installNoticeTargetVersionCode !== targetVersionCode) return;
  publish({ installNoticeTargetVersionCode: null });
}

export async function startOwnerPlayFlexibleUpdate() {
  if (!snapshot.available || snapshot.starting || !isGooglePlayAndroidRuntime()) return;
  publish({ promptTargetVersionCode: null, starting: true });
  try {
    const result = await OwnerPlayUpdate.startFlexibleUpdate();
    if (result.started) {
      void checkOwnerPlayUpdate({ force: true, allowPrompt: false });
    }
  } catch {
    // The settings entry remains available for a later manual retry.
  } finally {
    publish({ starting: false });
  }
}

export async function completeOwnerPlayFlexibleUpdate() {
  if (!snapshot.downloaded || snapshot.starting || !isGooglePlayAndroidRuntime()) return;
  publish({ installNoticeTargetVersionCode: null, starting: true });
  try {
    const result = await OwnerPlayUpdate.completeFlexibleUpdate();
    if (!result.requested) publish({ starting: false });
  } catch {
    // Installation can still be retried from Settings.
    publish({ starting: false });
  }
}

export function startOwnerPlayUpdateCoordinator() {
  if (!isGooglePlayAndroidRuntime()) return () => undefined;
  hydrateCachedAvailability();

  let disposed = false;
  let nativeListener: PluginListenerHandle | null = null;
  const timer = window.setTimeout(() => {
    if (!disposed) void checkOwnerPlayUpdate();
  }, OWNER_PLAY_UPDATE_CHECK_DELAY_MS);

  void OwnerPlayUpdate.addListener("updateStateChanged", (nativeState) => {
    if (disposed) return;
    const availability = normalizeOwnerPlayUpdateAvailability(nativeState);
    if (!availability?.available || availability.targetVersionCode === null) return;
    writeCachedUpdate({ checkedAt: Date.now(), ...availability });
    publish({
      available: true,
      downloaded: availability.downloaded,
      targetVersionCode: availability.targetVersionCode,
      installNoticeTargetVersionCode: installNoticeTarget(
        availability.targetVersionCode,
        availability.downloaded,
      ),
    });
  }).then((listener) => {
    if (disposed) {
      void listener.remove();
      return;
    }
    nativeListener = listener;
  }).catch(() => undefined);

  const checkOnForeground = () => {
    if (document.visibilityState === "visible" && snapshot.available) {
      void checkOwnerPlayUpdate({ force: true, allowPrompt: false });
    }
  };
  document.addEventListener("visibilitychange", checkOnForeground);

  return () => {
    disposed = true;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", checkOnForeground);
    if (nativeListener) void nativeListener.remove();
  };
}
