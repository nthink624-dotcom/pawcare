import type { SupabaseClient } from "@supabase/supabase-js";

export const SOCIAL_LOGIN_PROVIDERS = [
  { id: "naver", provider: "custom:naver", label: "네이버" },
  { id: "kakao", provider: "kakao", label: "카카오" },
  { id: "google", provider: "google", label: "구글" },
] as const;

export type SocialLoginProvider = (typeof SOCIAL_LOGIN_PROVIDERS)[number]["id"];
export type SocialLoginAvailability = Record<SocialLoginProvider, boolean>;
export type SocialLoginError = "social-cancelled" | "social-failed" | "social-account";
export const SOCIAL_AUTH_READ_TIMEOUT_MS = 20_000;

async function withSocialReadTimeout<T>(read: (signal: AbortSignal) => Promise<T>) {
  // iOS 15 WebViews support AbortController but do not have AbortSignal.timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOCIAL_AUTH_READ_TIMEOUT_MS);
  try {
    return await read(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function readSocialLoginAvailability(fetcher: typeof fetch = fetch): Promise<SocialLoginAvailability> {
  const retry = Symbol("retry");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await withSocialReadTimeout(async (signal) => {
        const response = await fetcher("/api/auth/social/providers", { cache: "no-store", signal });
        if (response.status === 503 && attempt === 0) {
          if (response.body) await response.body.cancel().catch(() => undefined);
          return retry;
        }
        if (!response.ok) throw new Error("unavailable");
        return await response.json() as unknown;
      });
      if (data === retry) continue;
      if (!data || typeof data !== "object" || !SOCIAL_LOGIN_PROVIDERS.every(item => typeof (data as Record<string, unknown>)[item.id] === "boolean")) throw new Error("unavailable");
      return data as SocialLoginAvailability;
    } catch (error) {
      if (attempt === 0 && error instanceof Error && ["AbortError", "TimeoutError", "TypeError"].includes(error.name)) continue;
      throw error;
    }
  }
  throw new Error("unavailable");
}

export class SocialLoginFailure extends Error {
  constructor(public reason: SocialLoginError) { super(reason); }
}

// Shop access comes from the existing server boundary, never from provider
// email, client metadata, or a client-supplied owner/shop identifier.
export async function completeSocialLogin({ auth, code, fetchShops = fetch, expectedUserId }: {
  auth: Pick<SupabaseClient["auth"], "exchangeCodeForSession" | "signOut">;
  code: string;
  fetchShops?: typeof fetch;
  expectedUserId?: string;
}) {
  try {
    const { data, error } = await auth.exchangeCodeForSession(code);
    if (error || !data.session?.access_token || !data.session.refresh_token) throw new SocialLoginFailure("social-failed");
    if (expectedUserId && data.session.user?.id !== expectedUserId) throw new SocialLoginFailure("social-failed");
    const { status, ok, shops } = await withSocialReadTimeout(async (signal) => {
      const response = await fetchShops("/api/owner/shops", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
        signal,
      });
      return { status: response.status, ok: response.ok, shops: await response.json() as unknown };
    });
    if (!ok) {
      const noShop = status === 403 && typeof shops === "object" && shops !== null
        && "message" in shops && shops.message === "접근할 수 있는 매장이 없습니다.";
      throw new SocialLoginFailure(noShop ? "social-account" : "social-failed");
    }
    if (!Array.isArray(shops) || shops.some((shop) => !shop || typeof shop.id !== "string" || !shop.id || shop.id === "demo-shop")) throw new SocialLoginFailure("social-failed");
    if (!shops.length) throw new SocialLoginFailure("social-account");
    return { session: data.session, shopId: shops[0].id as string };
  } catch (error) {
    // An OAuth identity does not imply completed owner signup or shop access.
    await auth.signOut({ scope: "local" }).catch(() => undefined);
    throw error instanceof SocialLoginFailure ? error : new SocialLoginFailure("social-failed");
  }
}
