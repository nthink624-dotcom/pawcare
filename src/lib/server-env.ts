import { NOTIFICATION_REGISTRY } from "@/lib/notification-registry";

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
  allowedDevSupabaseRefs: process.env.ALLOWED_DEV_SUPABASE_REFS || process.env.NEXT_PUBLIC_ALLOWED_DEV_SUPABASE_REFS || "",
  authFlowSecret: readOptionalSecret(
    process.env.AUTH_FLOW_SECRET ||
      process.env.ADMIN_SESSION_SECRET ||
      process.env.BILLING_KEY_ENCRYPTION_SECRET,
  ),
  bookingAccessSecret: readOptionalSecret(process.env.BOOKING_ACCESS_SECRET),
  portoneStoreId: readOptionalSecret(process.env.PORTONE_STORE_ID || process.env.NEXT_PUBLIC_PORTONE_STORE_ID),
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
  alimtalkRelayAdminUrl: process.env.ALIMTALK_RELAY_ADMIN_URL,
  alimtalkRelaySecret: process.env.ALIMTALK_RELAY_SECRET,
  alimtalkTemplateBookingReceived: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_BOOKING_RECEIVED),
  alimtalkTemplateBookingConfirmed: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_BOOKING_CONFIRMED),
  alimtalkTemplateBookingRejected: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_BOOKING_REJECTED),
  alimtalkTemplateBookingCancelled: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_BOOKING_CANCELLED),
  alimtalkTemplateBookingTimeProposed: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_BOOKING_TIME_PROPOSED),
  alimtalkTemplateBookingRescheduledConfirmed: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_BOOKING_RESCHEDULED_CONFIRMED),
  alimtalkTemplateAppointmentReminder10m: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_APPOINTMENT_REMINDER_10M),
  alimtalkTemplateVisitScheduleNotice: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_VISIT_SCHEDULE_NOTICE),
  alimtalkTemplateVisitReminderNotice: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_VISIT_REMINDER_NOTICE),
  alimtalkTemplateGroomingStarted: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_GROOMING_STARTED),
  alimtalkTemplateGroomingAlmostDone: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_GROOMING_ALMOST_DONE),
  alimtalkTemplateGroomingCompleted: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_GROOMING_COMPLETED),
  alimtalkTemplateRevisitNotice: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_REVISIT_NOTICE),
  alimtalkTemplateBirthdayGreeting: readOptionalSecret(process.env.ALIMTALK_TEMPLATE_BIRTHDAY_GREETING),
  deepseekApiKey: readOptionalSecret(process.env.DEEPSEEK_API_KEY),
  deepseekModel: readOptionalSecret(process.env.DEEPSEEK_MODEL) ?? "deepseek-v4-flash",
  aiSlotRecommendationProvider: readOptionalSecret(process.env.AI_SLOT_RECOMMENDATION_PROVIDER) ?? "deepseek",
  mediaCleanupCronSecret: process.env.MEDIA_CLEANUP_CRON_SECRET,
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
  return Boolean(ref && parseAllowedSupabaseRefs(serverEnv.allowedDevSupabaseRefs).has(ref));
}

export function isUnsafeProdSupabaseServerEnv() {
  const runtimeStage = getSupabaseServerRuntimeStage();
  if (runtimeStage === "production" || serverEnv.allowProdSupabaseInDev) return false;
  if (serverEnv.supabaseEnvName === "production") return true;
  return isRemoteSupabaseUrl(serverEnv.supabaseUrl) && !isAllowedDevSupabaseRef(serverEnv.supabaseUrl);
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

export function getConfiguredAlimtalkTemplateKey(alias: string | null | undefined) {
  if (!alias) return null;

  const templateConfigValues = {
    templateBookingReceived: serverEnv.alimtalkTemplateBookingReceived ?? null,
    templateBookingConfirmed: serverEnv.alimtalkTemplateBookingConfirmed ?? null,
    templateBookingRejected: serverEnv.alimtalkTemplateBookingRejected ?? null,
    templateBookingCancelled: serverEnv.alimtalkTemplateBookingCancelled ?? null,
    templateBookingTimeProposed: serverEnv.alimtalkTemplateBookingTimeProposed ?? null,
    templateBookingRescheduledConfirmed: serverEnv.alimtalkTemplateBookingRescheduledConfirmed ?? null,
    templateAppointmentReminder10m: serverEnv.alimtalkTemplateAppointmentReminder10m ?? null,
    templateVisitScheduleNotice: serverEnv.alimtalkTemplateVisitScheduleNotice ?? null,
    templateVisitReminderNotice: serverEnv.alimtalkTemplateVisitReminderNotice ?? null,
    templateGroomingStarted: serverEnv.alimtalkTemplateGroomingStarted ?? null,
    templateGroomingAlmostDone: serverEnv.alimtalkTemplateGroomingAlmostDone ?? null,
    templateGroomingCompleted: serverEnv.alimtalkTemplateGroomingCompleted ?? null,
    templateRevisitNotice: serverEnv.alimtalkTemplateRevisitNotice ?? null,
    templateBirthdayGreeting: serverEnv.alimtalkTemplateBirthdayGreeting ?? null,
  } as const;

  const spec = NOTIFICATION_REGISTRY.find((item) => item.templateAlias === alias);
  if (!spec?.templateConfigKey) {
    return null;
  }

  return templateConfigValues[spec.templateConfigKey] ?? null;
}

export function resolveAlimtalkTemplateKey(alias: string | null | undefined) {
  if (!alias) return null;
  return getConfiguredAlimtalkTemplateKey(alias) ?? alias;
}
