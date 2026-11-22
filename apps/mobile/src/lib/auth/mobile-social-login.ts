import { Capacitor, registerPlugin } from "@capacitor/core";
import { completeSocialLogin, SocialLoginFailure, type SocialLoginError } from "@petmanager/shared/lib/owner-social-login";

import { clearOwnerAuthTokenCache, writeOwnerAuthHandoff, writeOwnerAuthSessionCache } from "@/lib/auth/owner-auth-handoff";
import { env } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const nativeBrowser = registerPlugin<{ open(options: { url: string }): Promise<void> }>("OwnerSocialLogin");

export const socialLoginMessages: Record<SocialLoginError, string> = {
  "social-cancelled": "간편 로그인이 취소됐습니다. 다시 시도해 주세요.",
  "social-failed": "간편 로그인을 완료하지 못했습니다. 다시 시도하거나 이메일로 로그인해 주세요.",
  "social-account": "이 소셜 계정에 연결된 매장이 없습니다. 이메일로 로그인한 뒤 소셜 계정을 연결해 주세요.",
};

export function getSocialAttemptStorage() {
  return Capacitor.isNativePlatform() ? window.localStorage : window.sessionStorage;
}

export function hasNativeSocialLogin() {
  return Capacitor.isPluginAvailable("OwnerSocialLogin") && Capacitor.isPluginAvailable("App");
}

export async function openMobileSocialLogin(value: string) {
  const destination = new URL(value);
  if (!env.supabaseUrl || destination.origin !== new URL(env.supabaseUrl).origin || destination.pathname !== "/auth/v1/authorize" || destination.username || destination.password || destination.hash) {
    throw new Error("Unexpected social login destination");
  }
  if (Capacitor.isNativePlatform()) await nativeBrowser.open({ url: destination.href });
  else window.location.assign(destination.href);
}

export async function finishMobileSocialLogin(code: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new SocialLoginFailure("social-failed");
  const { session } = await completeSocialLogin({ auth: supabase.auth, code });
  const handoff = { accessToken: session.access_token, refreshToken: session.refresh_token };
  clearOwnerAuthTokenCache();
  writeOwnerAuthHandoff(handoff);
  writeOwnerAuthSessionCache(handoff);
}
