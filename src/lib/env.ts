export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "PawCare",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  demoShopId: process.env.DEMO_SHOP_ID || "demo-shop",
  solapiApiKey: process.env.SOLAPI_API_KEY,
  solapiApiSecret: process.env.SOLAPI_API_SECRET,
  solapiSenderKey: process.env.SOLAPI_SENDER_KEY,
  solapiSenderPhone: process.env.SOLAPI_SENDER_PHONE,
};

export function hasSupabaseEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceRoleKey);
}
