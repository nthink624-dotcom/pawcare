import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/server-env";

export function getSupabaseAdmin() {
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseServiceRoleKey) {
    return null;
  }

  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseAuthClient() {
  if (!serverEnv.supabaseUrl || !serverEnv.supabasePublishableKey) {
    return null;
  }

  return createClient(serverEnv.supabaseUrl, serverEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
