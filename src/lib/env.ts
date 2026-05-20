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
  allowedDevSupabaseRefs: process.env.NEXT_PUBLIC_ALLOWED_DEV_SUPABASE_REFS || "",
  portoneStoreId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
  portoneIdentityKcpChannelKey: process.env.NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY,
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
  return Boolean(env.portoneStoreId && env.portoneIdentityKcpChannelKey);
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

function refFromSupabaseUrl(value: string | undefined) {
  const match = value?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? "";
}

function isRemoteSupabaseUrl(value: string | undefined) {
  return /^https:\/\/[a-z0-9]+\.supabase\.co/i.test(value ?? "");
}

function parseAllowedSupabaseRefs(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function isAllowedDevSupabaseRef(value: string | undefined) {
  const ref = refFromSupabaseUrl(value);
  return Boolean(ref && parseAllowedSupabaseRefs(env.allowedDevSupabaseRefs).has(ref));
}

export function isUnsafeProdSupabaseBrowserEnv() {
  const runtimeStage = getSupabaseRuntimeStage();
  if (runtimeStage === "production" || env.allowProdSupabaseInDev) return false;
  if (env.supabaseEnvName === "production") return true;
  return isRemoteSupabaseUrl(env.supabaseUrl) && !isAllowedDevSupabaseRef(env.supabaseUrl);
}
