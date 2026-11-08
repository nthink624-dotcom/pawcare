import { NextResponse } from "next/server";

import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";

const PROVIDER_READ_TIMEOUT_MS = 12_000;

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // These accessors also enforce the existing development/production guard.
    const auth = getSupabaseAuthClient();
    const admin = getSupabaseAdmin();
    if (!auth || !admin || !serverEnv.supabaseUrl || !serverEnv.supabasePublishableKey) throw new Error("unavailable");
    const [settings, naver] = await Promise.all([
      fetch(`${serverEnv.supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: serverEnv.supabasePublishableKey },
        cache: "no-store",
        signal: AbortSignal.timeout(PROVIDER_READ_TIMEOUT_MS),
      }).then(async (response) => response.ok ? await response.json() as { external?: Record<string, boolean> } : null),
      // Missing/unsupported custom providers are disabled. Credentials stay here.
      Promise.race([
        Promise.resolve().then(() => admin.auth.admin.customProviders.getProvider("custom:naver"))
          .then(({ data, error }) => !error && data?.enabled === true).catch(() => false),
        new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), PROVIDER_READ_TIMEOUT_MS); }),
      ]),
    ]);
    if (!settings?.external) throw new Error("unavailable");
    return NextResponse.json({ naver, kakao: settings.external.kakao === true, google: settings.external.google === true }, { headers });
  } catch {
    return NextResponse.json({ message: "소셜 로그인 설정을 확인하지 못했습니다." }, { status: 503, headers });
  } finally {
    clearTimeout(timer);
  }
}
