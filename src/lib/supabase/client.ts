import { createBrowserClient } from "@supabase/ssr";

import { env, isUnsafeProdSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

function assertSafeBrowserSupabaseEnv() {
  if (isUnsafeProdSupabaseBrowserEnv()) {
    throw new Error(
      "Local or preview environments cannot use production Supabase unless NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV=true is set.",
    );
  }
}

export function getSupabaseBrowserClient() {
  assertSafeBrowserSupabaseEnv();

  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    return null;
  }

  browserClient ??= createBrowserClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      detectSessionInUrl: false,
    },
    cookieOptions: getSupabaseCookieOptions(),
  });

  return browserClient;
}
