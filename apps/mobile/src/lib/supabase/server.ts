import { createClient } from "@supabase/supabase-js";

import { ServerEnvError, isUnsafeProdSupabaseServerEnv, serverEnv } from "@/lib/server-env";

function assertSafeSupabaseEnvironment() {
  if (isUnsafeProdSupabaseServerEnv()) {
    throw new ServerEnvError(
      "Supabase 프로젝트가 실행 환경과 일치하지 않습니다. 개발·운영 프로젝트 URL과 환경 이름을 확인해 주세요.",
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

export function getSupabaseAuthClient(signal?: AbortSignal) {
  assertSafeSupabaseEnvironment();
  if (!serverEnv.supabaseUrl || !serverEnv.supabasePublishableKey) {
    return null;
  }

  return createClient(serverEnv.supabaseUrl, serverEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: signal ? { fetch: (input, init) => fetch(input, { ...init, signal }) } : undefined,
  });
}
