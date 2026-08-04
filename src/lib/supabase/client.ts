import { createBrowserClient } from "@supabase/ssr";

import { env, isUnsafeProdSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;
const authLockQueues = new Map<string, Promise<void>>();

async function localAuthLock<R>(name: string, _acquireTimeout: number, fn: () => Promise<R>) {
  const previous = authLockQueues.get(name) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);
  authLockQueues.set(name, queued);

  await previous.catch(() => undefined);

  try {
    return await fn();
  } finally {
    release();
    if (authLockQueues.get(name) === queued) {
      authLockQueues.delete(name);
    }
  }
}

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
      lock: localAuthLock,
    },
    cookieOptions: getSupabaseCookieOptions(),
  });

  return browserClient;
}
