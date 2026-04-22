import { createBrowserClient } from "@supabase/ssr";

import { env, isUnsafeProdSupabaseBrowserEnv } from "@/lib/env";

export function getSupabaseBrowserClient() {
  if (isUnsafeProdSupabaseBrowserEnv()) {
    throw new Error(
      "로컬/프리뷰 환경에서 운영 Supabase를 사용할 수 없습니다. 개발용 Supabase env로 바꾸거나 NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV=true 로 명시적으로 허용해 주세요.",
    );
  }

  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    return null;
  }

  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}
