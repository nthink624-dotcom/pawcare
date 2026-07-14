export const OWNER_AUTH_HANDOFF_STORAGE_KEY = "petmanager.ownerAuthHandoff";
const OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY = "petmanager.ownerAuthTokenCache";
let currentOwnerAccessToken: { accessToken: string; expiresAt: number | null } | null = null;

export type OwnerAuthHandoffSession = {
  accessToken: string;
  refreshToken: string;
};

type OwnerAuthTokenCachePayload = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

function safeGetItem(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage can be unavailable or full; auth cleanup must not block login.
  }
}

export function writeOwnerAuthHandoff(session: OwnerAuthHandoffSession) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(session);
  safeSetItem(window.sessionStorage, OWNER_AUTH_HANDOFF_STORAGE_KEY, payload);
  safeSetItem(window.localStorage, OWNER_AUTH_HANDOFF_STORAGE_KEY, payload);
}

export function consumeOwnerAuthHandoff() {
  if (typeof window === "undefined") return null;

  const raw =
    safeGetItem(window.sessionStorage, OWNER_AUTH_HANDOFF_STORAGE_KEY) ??
    safeGetItem(window.localStorage, OWNER_AUTH_HANDOFF_STORAGE_KEY);
  safeRemoveItem(window.sessionStorage, OWNER_AUTH_HANDOFF_STORAGE_KEY);
  safeRemoveItem(window.localStorage, OWNER_AUTH_HANDOFF_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OwnerAuthHandoffSession>;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
    };
  } catch {
    return null;
  }
}

function getJwtExpiresAt(accessToken: string) {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(window.atob(normalizedPayload)) as { exp?: unknown };
    return typeof parsed.exp === "number" ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function writeOwnerAuthTokenCache(accessToken: string, refreshToken?: string) {
  const expiresAt = getJwtExpiresAt(accessToken);
  currentOwnerAccessToken = { accessToken, expiresAt };
  if (typeof window === "undefined") return;
  if (!expiresAt) return;

  const existingRefreshToken = readOwnerAuthRefreshTokenCache();
  const payload: OwnerAuthTokenCachePayload = {
    accessToken,
    expiresAt,
    ...(refreshToken || existingRefreshToken ? { refreshToken: refreshToken ?? existingRefreshToken ?? undefined } : {}),
  };

  const serialized = JSON.stringify(payload);
  safeSetItem(window.localStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY, serialized);
  safeSetItem(window.sessionStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY, serialized);
}

export function writeOwnerAuthSessionCache(session: OwnerAuthHandoffSession) {
  writeOwnerAuthTokenCache(session.accessToken, session.refreshToken);
}

export function setCurrentOwnerAccessToken(accessToken: string | null) {
  currentOwnerAccessToken = accessToken ? { accessToken, expiresAt: getJwtExpiresAt(accessToken) } : null;
}

export function readOwnerAuthTokenCache() {
  if (currentOwnerAccessToken) {
    if (!currentOwnerAccessToken.expiresAt || currentOwnerAccessToken.expiresAt > Date.now() + 60_000) {
      return currentOwnerAccessToken.accessToken;
    }

    currentOwnerAccessToken = null;
  }

  if (typeof window === "undefined") return null;

  const raw =
    safeGetItem(window.localStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY) ??
    safeGetItem(window.sessionStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { accessToken?: unknown; expiresAt?: unknown };
    if (typeof parsed.accessToken !== "string" || typeof parsed.expiresAt !== "number") {
      safeRemoveItem(window.localStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
      safeRemoveItem(window.sessionStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
      return null;
    }

    if (parsed.expiresAt <= Date.now() + 60_000) {
      safeRemoveItem(window.localStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
      safeRemoveItem(window.sessionStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
      return null;
    }

    return parsed.accessToken;
  } catch {
    safeRemoveItem(window.localStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
    safeRemoveItem(window.sessionStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
    return null;
  }
}

export function readOwnerAuthRefreshTokenCache() {
  if (typeof window === "undefined") return null;

  const raw =
    safeGetItem(window.localStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY) ??
    safeGetItem(window.sessionStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { refreshToken?: unknown };
    return typeof parsed.refreshToken === "string" && parsed.refreshToken ? parsed.refreshToken : null;
  } catch {
    return null;
  }
}

export function clearOwnerAuthTokenCache() {
  currentOwnerAccessToken = null;
  if (typeof window === "undefined") return;
  safeRemoveItem(window.localStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
  safeRemoveItem(window.sessionStorage, OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
}
