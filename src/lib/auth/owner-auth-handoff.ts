export const OWNER_AUTH_HANDOFF_STORAGE_KEY = "petmanager.ownerAuthHandoff";
const OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY = "petmanager.ownerAuthTokenCache";

export type OwnerAuthHandoffSession = {
  accessToken: string;
  refreshToken: string;
};

export function writeOwnerAuthHandoff(session: OwnerAuthHandoffSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(OWNER_AUTH_HANDOFF_STORAGE_KEY, JSON.stringify(session));
}

export function consumeOwnerAuthHandoff() {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(OWNER_AUTH_HANDOFF_STORAGE_KEY);
  window.sessionStorage.removeItem(OWNER_AUTH_HANDOFF_STORAGE_KEY);
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

export function writeOwnerAuthTokenCache(accessToken: string) {
  if (typeof window === "undefined") return;
  const expiresAt = getJwtExpiresAt(accessToken);
  if (!expiresAt) return;

  window.sessionStorage.setItem(
    OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY,
    JSON.stringify({
      accessToken,
      expiresAt,
    }),
  );
}

export function readOwnerAuthTokenCache() {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { accessToken?: unknown; expiresAt?: unknown };
    if (typeof parsed.accessToken !== "string" || typeof parsed.expiresAt !== "number") {
      window.sessionStorage.removeItem(OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
      return null;
    }

    if (parsed.expiresAt <= Date.now() + 60_000) {
      window.sessionStorage.removeItem(OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
      return null;
    }

    return parsed.accessToken;
  } catch {
    window.sessionStorage.removeItem(OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
    return null;
  }
}

export function clearOwnerAuthTokenCache() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(OWNER_AUTH_TOKEN_CACHE_STORAGE_KEY);
}
