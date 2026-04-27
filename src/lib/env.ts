export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "petmanager",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseEnvName:
    process.env.NEXT_PUBLIC_SUPABASE_ENV_NAME ||
    ((process.env.NEXT_PUBLIC_SITE_URL || "").includes("petmanager.co.kr") ? "production" : "development"),
  allowProdSupabaseInDev: process.env.NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV === "true",
  portoneStoreId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
  portoneIdentityUnifiedChannelKey:
    process.env.NEXT_PUBLIC_PORTONE_IDENTITY_UNIFIED_CHANNEL_KEY ||
    process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY ||
    process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
  portoneIdentityDanalChannelKey: process.env.NEXT_PUBLIC_PORTONE_IDENTITY_DANAL_CHANNEL_KEY,
  portoneIdentityChannelKey:
    process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY || process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
  portonePaymentChannelKey: process.env.NEXT_PUBLIC_PORTONE_PAYMENT_CHANNEL_KEY,
  portoneKakaoPayChannelKey: process.env.NEXT_PUBLIC_PORTONE_KAKAOPAY_CHANNEL_KEY,
  portoneNaverPayChannelKey: process.env.NEXT_PUBLIC_PORTONE_NAVERPAY_CHANNEL_KEY,
  portoneBillingChannelKey: process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY,
  naverOAuthProvider: process.env.NEXT_PUBLIC_NAVER_OAUTH_PROVIDER || "custom:naver",
};

export function hasSupabaseBrowserEnv() {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}

export function hasPortoneBrowserEnv() {
  return Boolean(env.portoneStoreId && (env.portoneIdentityUnifiedChannelKey || env.portoneIdentityDanalChannelKey));
}

export function hasPortonePaymentBrowserEnv() {
  return Boolean(
    env.portoneStoreId &&
      (env.portonePaymentChannelKey || env.portoneKakaoPayChannelKey || env.portoneNaverPayChannelKey),
  );
}

export function getSupabaseRuntimeStage() {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "development" as const;
    }
    if (hostname.endsWith(".vercel.app")) {
      return "preview" as const;
    }
    return "production" as const;
  }

  const normalizedSiteUrl = env.siteUrl.toLowerCase();
  if (normalizedSiteUrl.includes("localhost") || normalizedSiteUrl.includes("127.0.0.1")) {
    return "development" as const;
  }
  if (normalizedSiteUrl.includes(".vercel.app")) {
    return "preview" as const;
  }
  return "production" as const;
}

export function isUnsafeProdSupabaseBrowserEnv() {
  return getSupabaseRuntimeStage() !== "production" && env.supabaseEnvName === "production" && !env.allowProdSupabaseInDev;
}
