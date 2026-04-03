import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

export function getSupabaseBrowserClient() {
  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    return null;
  }
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}
