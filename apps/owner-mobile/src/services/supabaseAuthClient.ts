import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getRequiredAuthEnvConfig, type AuthEnvConfig } from "@/services/authEnvConfig";
import type { AuthSessionStorage } from "@/services/authSessionStorage";

export type OwnerSupabaseAuthClient = SupabaseClient;

let cachedClient: OwnerSupabaseAuthClient | null = null;
let cachedClientKey: string | null = null;

export type CreateOwnerSupabaseAuthClientOptions = {
  authStorage?: AuthSessionStorage;
};

function getClientCacheKey(config: AuthEnvConfig) {
  return [
    config.supabaseUrl,
    config.supabasePublishableKey,
    config.supabaseEnvName,
    config.appStage,
    String(config.allowProdSupabaseInDev),
  ].join("|");
}

export function createOwnerSupabaseAuthClient(
  config: AuthEnvConfig = getRequiredAuthEnvConfig(),
  options: CreateOwnerSupabaseAuthClientOptions = {},
) {
  const safeConfig = getRequiredAuthEnvConfig(config);

  return createClient(safeConfig.supabaseUrl, safeConfig.supabasePublishableKey, {
    auth: {
      persistSession: Boolean(options.authStorage),
      autoRefreshToken: Boolean(options.authStorage),
      detectSessionInUrl: false,
      storage: options.authStorage,
    },
  });
}

export function getOwnerSupabaseAuthClient(
  config: AuthEnvConfig = getRequiredAuthEnvConfig(),
  options: CreateOwnerSupabaseAuthClientOptions = {},
) {
  const safeConfig = getRequiredAuthEnvConfig(config);
  const cacheKey = `${getClientCacheKey(safeConfig)}|storage:${String(Boolean(options.authStorage))}`;

  if (!cachedClient || cachedClientKey !== cacheKey) {
    cachedClient = createOwnerSupabaseAuthClient(safeConfig, options);
    cachedClientKey = cacheKey;
  }

  return cachedClient;
}

export function resetOwnerSupabaseAuthClientForTests() {
  cachedClient = null;
  cachedClientKey = null;
}
