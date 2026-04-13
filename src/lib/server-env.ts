export const serverEnv = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey:
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  authFlowSecret: process.env.AUTH_FLOW_SECRET || "mungmanager-local-auth-flow-secret",
  portoneApiSecret: process.env.PORTONE_API_SECRET,
  alimtalkProvider: process.env.ALIMTALK_PROVIDER || "generic",
  alimtalkApiUrl: process.env.ALIMTALK_API_URL,
  alimtalkApiKey: process.env.ALIMTALK_API_KEY,
  alimtalkProfileKey: process.env.ALIMTALK_PROFILE_KEY,
  alimtalkSenderKey: process.env.ALIMTALK_SENDER_KEY,
};

export function hasSupabaseServerEnv() {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabasePublishableKey && serverEnv.supabaseServiceRoleKey);
}

export function hasPortoneServerEnv() {
  return Boolean(serverEnv.portoneApiSecret);
}

export function hasAlimtalkServerEnv() {
  return Boolean(serverEnv.alimtalkApiUrl && serverEnv.alimtalkApiKey && (serverEnv.alimtalkProfileKey || serverEnv.alimtalkSenderKey));
}
