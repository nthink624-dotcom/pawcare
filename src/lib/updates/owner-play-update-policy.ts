export const OWNER_PLAY_UPDATE_CHECK_DELAY_MS = 5_000;
export const OWNER_PLAY_UPDATE_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

export type OwnerPlayUpdateNativeState = {
  supported: boolean;
  checked: boolean;
  available: boolean;
  downloaded: boolean;
  installedVersionCode?: number;
  targetVersionCode?: number;
};

export type OwnerPlayUpdateAvailability = {
  available: boolean;
  downloaded: boolean;
  installedVersionCode: number;
  targetVersionCode: number | null;
};

function normalizeVersionCode(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function normalizeOwnerPlayUpdateAvailability(
  state: OwnerPlayUpdateNativeState,
): OwnerPlayUpdateAvailability | null {
  if (!state.supported || !state.checked) return null;

  const installedVersionCode = normalizeVersionCode(state.installedVersionCode);
  if (installedVersionCode === null) return null;

  const targetVersionCode = normalizeVersionCode(state.targetVersionCode);
  const available =
    state.available === true &&
    targetVersionCode !== null &&
    targetVersionCode > installedVersionCode;

  return {
    available,
    downloaded: available && state.downloaded === true,
    installedVersionCode,
    targetVersionCode: available ? targetVersionCode : null,
  };
}

export function ownerPlayUpdatePromptStorageKey(targetVersionCode: number) {
  return `petmanager.ownerPlayUpdate.prompted.v1:${targetVersionCode}`;
}

export function ownerPlayUpdateInstallNoticeStorageKey(targetVersionCode: number) {
  return `petmanager.ownerPlayUpdate.installNotice.v1:${targetVersionCode}`;
}

export function isOwnerPlayUpdateCacheFresh(checkedAt: number, now = Date.now()) {
  return Number.isFinite(checkedAt) && checkedAt > 0 && now - checkedAt < OWNER_PLAY_UPDATE_CACHE_TTL_MS;
}
