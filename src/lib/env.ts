export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "PawCare",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  portoneStoreId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
  portoneChannelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
};

export function hasSupabaseBrowserEnv() {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}

export function hasPortoneBrowserEnv() {
  return Boolean(env.portoneStoreId && env.portoneChannelKey);
}
