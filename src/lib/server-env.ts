export class ServerEnvError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}

function readOptionalSecret(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function requireServerSecret(value: string | undefined, name: string) {
  const normalized = readOptionalSecret(value);
  if (!normalized) {
    throw new ServerEnvError(`${name} 서버 설정을 확인해 주세요.`, 503);
  }
  return normalized;
}

export const serverEnv = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey:
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseEnvName:
    process.env.SUPABASE_ENV_NAME ||
    (process.env.VERCEL_ENV === "production" ? "production" : "development"),
  allowProdSupabaseInDev: process.env.ALLOW_PROD_SUPABASE_IN_DEV === "true",
  authFlowSecret: readOptionalSecret(process.env.AUTH_FLOW_SECRET),
  bookingAccessSecret: readOptionalSecret(process.env.BOOKING_ACCESS_SECRET),
  portoneApiSecret: readOptionalSecret(process.env.PORTONE_API_SECRET),
  portoneWebhookSecret: readOptionalSecret(process.env.PORTONE_WEBHOOK_SECRET),
  billingKeyEncryptionSecret: readOptionalSecret(process.env.BILLING_KEY_ENCRYPTION_SECRET),
  alimtalkProvider: process.env.ALIMTALK_PROVIDER || "generic",
  alimtalkApiUrl: process.env.ALIMTALK_API_URL,
  alimtalkApiKey: process.env.ALIMTALK_API_KEY,
  alimtalkTokenKey: process.env.ALIMTALK_TOKEN_KEY,
  alimtalkProfileKey: process.env.ALIMTALK_PROFILE_KEY,
  alimtalkSenderKey: process.env.ALIMTALK_SENDER_KEY,
  alimtalkRelayUrl: process.env.ALIMTALK_RELAY_URL,
  alimtalkRelaySecret: process.env.ALIMTALK_RELAY_SECRET,
  notificationCronSecret: process.env.NOTIFICATION_CRON_SECRET,
  adminSetupKey: readOptionalSecret(process.env.ADMIN_SETUP_KEY),
  adminSessionSecret: readOptionalSecret(process.env.ADMIN_SESSION_SECRET),
};

export function hasSupabaseServerEnv() {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabasePublishableKey && serverEnv.supabaseServiceRoleKey);
}

export function getSupabaseServerRuntimeStage() {
  if (process.env.VERCEL_ENV === "preview") return "preview" as const;
  if (process.env.VERCEL_ENV === "production") return "production" as const;
  return "development" as const;
}

export function isUnsafeProdSupabaseServerEnv() {
  return (
    getSupabaseServerRuntimeStage() !== "production" &&
    serverEnv.supabaseEnvName === "production" &&
    !serverEnv.allowProdSupabaseInDev
  );
}

export function hasPortoneServerEnv() {
  return Boolean(serverEnv.portoneApiSecret);
}

export function hasAlimtalkServerEnv() {
  if (serverEnv.alimtalkRelayUrl && serverEnv.alimtalkRelaySecret) {
    return true;
  }

  if (!serverEnv.alimtalkApiUrl || !serverEnv.alimtalkApiKey || !(serverEnv.alimtalkProfileKey || serverEnv.alimtalkSenderKey)) {
    return false;
  }

  if (serverEnv.alimtalkProvider === "ssodaa") {
    return Boolean(serverEnv.alimtalkTokenKey);
  }

  return true;
}
