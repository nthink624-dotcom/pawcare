export const OWNER_AUTH_HANDOFF_STORAGE_KEY = "petmanager.ownerAuthHandoff";

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
