export const serverEnv = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey:
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  authFlowSecret: process.env.AUTH_FLOW_SECRET || "mungmanager-local-auth-flow-secret",
  bookingAccessSecret: process.env.BOOKING_ACCESS_SECRET || process.env.AUTH_FLOW_SECRET || "petmanager-local-booking-access-secret",
  portoneApiSecret: process.env.PORTONE_API_SECRET,
  alimtalkProvider: process.env.ALIMTALK_PROVIDER || "generic",
  alimtalkApiUrl: process.env.ALIMTALK_API_URL,
  alimtalkApiKey: process.env.ALIMTALK_API_KEY,
  alimtalkTokenKey: process.env.ALIMTALK_TOKEN_KEY,
  alimtalkProfileKey: process.env.ALIMTALK_PROFILE_KEY,
  alimtalkSenderKey: process.env.ALIMTALK_SENDER_KEY,
  alimtalkRelayUrl: process.env.ALIMTALK_RELAY_URL,
  alimtalkRelaySecret: process.env.ALIMTALK_RELAY_SECRET,
  notificationCronSecret: process.env.NOTIFICATION_CRON_SECRET,
  adminOwnerEmails: (process.env.ADMIN_OWNER_EMAILS || "nthink624@gmail.com")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
};

export function hasSupabaseServerEnv() {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabasePublishableKey && serverEnv.supabaseServiceRoleKey);
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
