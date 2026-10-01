import { createBrowserClient } from "@supabase/ssr";

import { env, isUnsafeProdSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

function assertSafeBrowserSupabaseEnv() {
  if (isUnsafeProdSupabaseBrowserEnv()) {
    throw new Error(
      "Supabase 프로젝트가 실행 환경과 일치하지 않습니다. 개발·운영 프로젝트 URL과 환경 이름을 확인해 주세요.",
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
