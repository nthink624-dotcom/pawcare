import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getRequiredAuthEnvConfig, type AuthEnvConfig } from "@/services/authEnvConfig";

export type OwnerSupabaseAuthClient = SupabaseClient;

let cachedClient: OwnerSupabaseAuthClient | null = null;
let cachedClientKey: string | null = null;

function getClientCacheKey(config: AuthEnvConfig) {
  return [
    config.supabaseUrl,
    config.supabasePublishableKey,
    config.supabaseEnvName,
    config.appStage,
    String(config.allowProdSupabaseInDev),
  ].join("|");
}

export function createOwnerSupabaseAuthClient(config: AuthEnvConfig = getRequiredAuthEnvConfig()) {
  const safeConfig = getRequiredAuthEnvConfig(config);

  return createClient(safeConfig.supabaseUrl, safeConfig.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function getOwnerSupabaseAuthClient(config: AuthEnvConfig = getRequiredAuthEnvConfig()) {
  const safeConfig = getRequiredAuthEnvConfig(config);
  const cacheKey = getClientCacheKey(safeConfig);

  if (!cachedClient || cachedClientKey !== cacheKey) {
    cachedClient = createOwnerSupabaseAuthClient(safeConfig);
    cachedClientKey = cacheKey;
  }

  return cachedClient;
}

export function resetOwnerSupabaseAuthClientForTests() {
  cachedClient = null;
  cachedClientKey = null;
}
