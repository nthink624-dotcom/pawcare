import path from "node:path";

import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

function splitOrigins(value: string | undefined) {
  return (value || "http://localhost:3000")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  appName: process.env.APP_NAME || "PawCare Backend",
  siteUrl: process.env.SITE_URL || "http://localhost:3000",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  port: Number(process.env.PORT || 4000),
  corsOrigins: splitOrigins(process.env.CORS_ORIGINS),
  supabaseUrl: process.env.SUPABASE_URL,
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  demoShopId: process.env.DEMO_SHOP_ID || "demo-shop",
  solapiApiKey: process.env.SOLAPI_API_KEY,
  solapiApiSecret: process.env.SOLAPI_API_SECRET,
  solapiSenderKey: process.env.SOLAPI_SENDER_KEY,
  solapiSenderPhone: process.env.SOLAPI_SENDER_PHONE,
};

export function hasSupabaseBrowserEnv() {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}

export function hasSupabaseAdminEnv() {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey && env.supabasePublishableKey);
}

export function hasSupabaseEnv() {
  return hasSupabaseAdminEnv();
}
