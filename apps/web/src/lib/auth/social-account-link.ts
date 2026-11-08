import { readSocialLoginAvailability, SOCIAL_AUTH_READ_TIMEOUT_MS, SOCIAL_LOGIN_PROVIDERS, type SocialLoginAvailability, type SocialLoginProvider } from "@/lib/auth/social-login";

export const SOCIAL_ACCOUNT_PATH = "/owner/social-accounts";
export const SOCIAL_LINK_STORAGE_KEY = "petmanager.pendingSocialAccountLink";
export const SOCIAL_LINK_MAX_AGE_MS = 10 * 60 * 1000;

export type PendingSocialAccountLink = { userId: string; provider: SocialLoginProvider; startedAt: number };

export async function readSocialAccountResources(accessToken: string, fetcher: typeof fetch = fetch): Promise<SocialLoginAvailability> {
  if (!accessToken) throw new Error("unavailable");
  // Consume each body as soon as its response arrives. Waiting for the other
  // request first can leave a healthy body unread until its signal expires.
  const [shops, providers] = await Promise.all([
    fetcher("/api/owner/shops", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(SOCIAL_AUTH_READ_TIMEOUT_MS) })
      .then(async response => ({ ok: response.ok, data: await response.json() as unknown })),
    readSocialLoginAvailability(fetcher),
  ]);
  if (!shops.ok || !Array.isArray(shops.data) || !shops.data.length
    || shops.data.some(shop => !shop || typeof shop.id !== "string" || !shop.id || shop.id === "demo-shop")
    ) throw new Error("unavailable");
  return providers;
}
export type SocialLinkError = "cancelled" | "already-linked" | "expired" | "failed";

export function writePendingSocialAccountLink(storage: Pick<Storage, "setItem">, userId: string, provider: SocialLoginProvider, now = Date.now()) {
  storage.setItem(SOCIAL_LINK_STORAGE_KEY, JSON.stringify({ userId, provider, startedAt: now }));
}

export function readPendingSocialAccountLink(storage: Pick<Storage, "getItem">, provider?: SocialLoginProvider, now = Date.now()): PendingSocialAccountLink | null {
  try {
    const value = JSON.parse(storage.getItem(SOCIAL_LINK_STORAGE_KEY) || "null") as Partial<PendingSocialAccountLink> | null;
    if (!value || !provider || value.provider !== provider || !value.userId || typeof value.userId !== "string"
      || typeof value.startedAt !== "number" || !Number.isFinite(value.startedAt)
      || now < value.startedAt || now - value.startedAt > SOCIAL_LINK_MAX_AGE_MS) return null;
    return value as PendingSocialAccountLink;
  } catch { return null; }
}

export function clearPendingSocialAccountLink(storage: Pick<Storage, "removeItem">) {
  try { storage.removeItem(SOCIAL_LINK_STORAGE_KEY); } catch { /* Optional flow state only. */ }
}

export function getSocialLinkCallbackUrl(origin: string, provider: SocialLoginProvider) {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", SOCIAL_ACCOUNT_PATH);
  url.searchParams.set("intent", "link");
  url.searchParams.set("provider", provider);
  return url.toString();
}

export function getSocialLinkErrorPath(error: SocialLinkError) {
  return `${SOCIAL_ACCOUNT_PATH}?${new URLSearchParams({ error })}`;
}

export function getSocialProvider(value: unknown) {
  return SOCIAL_LOGIN_PROVIDERS.find(provider => provider.id === value)?.id;
}

export function getSocialLinkProviderError(error?: string, errorCode?: string): SocialLinkError {
  if (errorCode === "identity_already_exists" || error === "identity_already_exists") return "already-linked";
  if (error === "access_denied" || errorCode === "access_denied") return "cancelled";
  return "failed";
}

export function isSafeSocialLinkRedirect(value: string, provider: SocialLoginProvider, supabaseUrl: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.origin === new URL(supabaseUrl).origin && url.pathname === "/auth/v1/authorize") return true;
    const allowed = {
      google: ["https://accounts.google.com/o/oauth2/v2/auth", "https://accounts.google.com/o/oauth2/auth"],
      kakao: ["https://kauth.kakao.com/oauth/authorize"],
      naver: ["https://nid.naver.com/oauth2/authorize", "https://nid.naver.com/oauth2.0/authorize"],
    };
    return allowed[provider].includes(`${url.origin}${url.pathname}`);
  } catch { return false; }
}
