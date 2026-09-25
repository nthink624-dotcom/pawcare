import { createClient } from "@supabase/supabase-js";

import { ServerEnvError, isUnsafeProdSupabaseServerEnv, serverEnv } from "@/lib/server-env";

function assertSafeSupabaseEnvironment() {
  if (isUnsafeProdSupabaseServerEnv()) {
    throw new ServerEnvError(
      "로컬/프리뷰 환경에서 운영 Supabase를 사용할 수 없습니다. 개발용 Supabase로 바꾸거나 ALLOW_PROD_SUPABASE_IN_DEV=true 로 명시적으로 허용해 주세요.",
      503,
    );
  }
}

export function getSupabaseAdmin() {
  assertSafeSupabaseEnvironment();
  if (!serverEnv.supabaseUrl || !serverEnv.supabaseServiceRoleKey) {
    return null;
  }

  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseAuthClient() {
  assertSafeSupabaseEnvironment();
  if (!serverEnv.supabaseUrl || !serverEnv.supabasePublishableKey) {
    return null;
  }

  return createClient(serverEnv.supabaseUrl, serverEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
