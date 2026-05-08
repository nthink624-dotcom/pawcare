export type AuthRuntimeStage = "development" | "preview" | "staging" | "production";

export type AuthEnvConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseEnvName: AuthRuntimeStage;
  appStage: AuthRuntimeStage;
  allowProdSupabaseInDev: boolean;
};

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const PUBLIC_ENV_PREFIX = "EXPO_PUBLIC_";
const FORBIDDEN_PUBLIC_TOKEN_ENV_PATTERN = /(^|_)(ACCESS_TOKEN|REFRESH_TOKEN|SESSION_TOKEN|ID_TOKEN|TOKEN)($|_)/i;
const FORBIDDEN_PUBLIC_SECRET_ENV_PATTERN = /(SERVICE_ROLE|SERVICE_ROLE_KEY|SECRET|PASSWORD|PRIVATE_KEY)/i;
const FORBIDDEN_PUBLIC_SECRET_VALUE_PATTERN = /(service[_-]?role|sb_secret_|secret)/i;

function readEnv(name: string) {
  return typeof process !== "undefined" ? process.env?.[name]?.trim() : undefined;
}

function normalizeStage(value: string | undefined): AuthRuntimeStage {
  if (value === "preview" || value === "staging" || value === "production") return value;
  return "development";
}

function normalizeUrl(value: string | undefined) {
  return (value || "").replace(/\/+$/, "");
}

function normalizePublicKey(value: string | undefined) {
  return value?.trim() || "";
}

export function getAuthEnvConfig(): AuthEnvConfig {
  return {
    supabaseUrl: normalizeUrl(readEnv("EXPO_PUBLIC_SUPABASE_URL")),
    supabasePublishableKey: normalizePublicKey(
      readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    ),
    supabaseEnvName: normalizeStage(readEnv("EXPO_PUBLIC_SUPABASE_ENV_NAME")),
    appStage: normalizeStage(readEnv("EXPO_PUBLIC_OWNER_API_STAGE")),
    allowProdSupabaseInDev: readEnv("EXPO_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV") === "true",
  };
}

export function getRequiredAuthEnvConfig(config: AuthEnvConfig = getAuthEnvConfig()) {
  assertAuthEnvConfigIsReady(config);
  return config;
}

export function assertAuthEnvConfigIsReady(config: AuthEnvConfig = getAuthEnvConfig()) {
  if (!config.supabaseUrl) {
    throw new Error("Supabase URL is required before enabling owner app auth.");
  }

  if (!/^https?:\/\//i.test(config.supabaseUrl)) {
    throw new Error("Supabase URL must start with http:// or https://.");
  }

  if (!config.supabasePublishableKey) {
    throw new Error("Supabase anon or publishable key is required before enabling owner app auth.");
  }

  assertNoForbiddenPublicAuthEnv();
  assertSupabasePublicKeyIsSafe(config.supabasePublishableKey);
  assertAuthEnvConfigIsSafe(config);
}

export function assertAuthEnvConfigIsSafe(config: AuthEnvConfig = getAuthEnvConfig()) {
  const isNonProductionApp = config.appStage !== "production";

  if (config.supabaseEnvName === "production" && isNonProductionApp && !config.allowProdSupabaseInDev) {
    throw new Error("Production Supabase is blocked outside production unless explicitly allowed.");
  }
}

export function assertNoForbiddenPublicAuthEnv() {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) return;

  const forbiddenKey = Object.keys(env).find((key) => {
    const value = env[key]?.trim();
    if (!value || !key.startsWith(PUBLIC_ENV_PREFIX)) return false;

    return FORBIDDEN_PUBLIC_TOKEN_ENV_PATTERN.test(key) || FORBIDDEN_PUBLIC_SECRET_ENV_PATTERN.test(key);
  });

  if (forbiddenKey) {
    throw new Error(`Forbidden secret-like public Expo environment variable detected: ${forbiddenKey}.`);
  }
}

export function assertSupabasePublicKeyIsSafe(value: string) {
  if (FORBIDDEN_PUBLIC_SECRET_VALUE_PATTERN.test(value)) {
    throw new Error("Supabase auth key looks like a service role or secret key and must not be bundled in the app.");
  }
}
