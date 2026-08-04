import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

export const OWNER_NATIVE_AUTH_CALLBACK_URL = "kr.petmanager.owner://auth/callback";

export function isNativeOwnerApp() {
  return Capacitor.isNativePlatform();
}

export async function openNativeOwnerOAuth(url: string) {
  await Browser.open({
    url,
    toolbarColor: "#ffffff",
  });
}

export async function exchangeNativeOwnerOAuthUrl(
  supabase: SupabaseClient,
  callbackUrl: string,
): Promise<Session | null> {
  const url = new URL(callbackUrl);
  if (url.protocol !== "kr.petmanager.owner:" || url.hostname !== "auth" || url.pathname !== "/callback") {
    return null;
  }

  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    throw new Error("소셜 로그인 승인이 완료되지 않았습니다.");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    throw new Error("소셜 로그인 인증 정보를 받지 못했습니다.");
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;

  return data.session;
}

export async function addNativeOwnerOAuthListener(listener: (url: string) => void | Promise<void>) {
  const handle = await App.addListener("appUrlOpen", ({ url }) => {
    void listener(url);
  });
  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) {
    void listener(launchUrl.url);
  }

  return handle;
}
