import { env } from "@/lib/env";

export type SocialProvider = "google" | "kakao" | "naver";
export const PENDING_SOCIAL_PROVIDER_COOKIE = "petmanager.socialProvider";
export const PENDING_SOCIAL_PROVIDER_STORAGE = "petmanager.socialProvider";

export function isLocalAuthOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getConfiguredSiteOrigin() {
  try {
    return new URL(env.siteUrl).origin;
  } catch {
    return null;
  }
}

export function getOAuthRedirectOrigin() {
  if (typeof window === "undefined") {
    return getConfiguredSiteOrigin() ?? env.siteUrl;
  }

  const currentOrigin = window.location.origin;
  const configuredOrigin = getConfiguredSiteOrigin();

  if (
    configuredOrigin &&
    env.supabaseEnvName === "production" &&
    isLocalAuthOrigin(currentOrigin) &&
    !isLocalAuthOrigin(configuredOrigin)
  ) {
    return configuredOrigin;
  }

  return currentOrigin;
}

export function getSocialOAuthProvider(provider: SocialProvider) {
  if (provider === "naver") {
    return env.naverOAuthProvider;
  }

  return provider;
}

function normalizeProviderName(value: string | null | undefined): SocialProvider | null {
  if (!value) return null;

  const normalized = value.toLowerCase();
  if (normalized === "google" || normalized === "kakao" || normalized === "naver") return normalized;
  if (normalized === "custom:naver" || normalized.endsWith(":naver")) return "naver";

  return null;
}

export function resolveSocialProviderFromAuthUser(user: {
  app_metadata?: Record<string, unknown> | null;
  identities?: Array<{ provider?: string | null } | null> | null;
}) {
  const directProvider =
    typeof user.app_metadata?.provider === "string" ? normalizeProviderName(user.app_metadata.provider) : null;
  if (directProvider) return directProvider;

  const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata?.providers : [];
  for (const provider of providers) {
    if (typeof provider === "string") {
      const normalized = normalizeProviderName(provider);
      if (normalized) return normalized;
    }
  }

  const identities = Array.isArray(user.identities) ? user.identities : [];
  for (const identity of identities) {
    const normalized = normalizeProviderName(identity?.provider);
    if (normalized) return normalized;
  }

  return "google";
}
