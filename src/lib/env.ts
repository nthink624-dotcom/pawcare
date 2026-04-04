export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "PawCare",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  portoneStoreId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
  portoneIdentityChannelKey:
    process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY || process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
  portonePaymentChannelKey: process.env.NEXT_PUBLIC_PORTONE_PAYMENT_CHANNEL_KEY,
  portoneKakaoPayChannelKey: process.env.NEXT_PUBLIC_PORTONE_KAKAOPAY_CHANNEL_KEY,
  portoneNaverPayChannelKey: process.env.NEXT_PUBLIC_PORTONE_NAVERPAY_CHANNEL_KEY,
  portoneBillingChannelKey: process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY,
};

export function hasSupabaseBrowserEnv() {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}

export function hasPortoneBrowserEnv() {
  return Boolean(env.portoneStoreId && env.portoneIdentityChannelKey);
}
