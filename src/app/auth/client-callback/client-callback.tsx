"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  PENDING_SOCIAL_PROVIDER_COOKIE,
  PENDING_SOCIAL_PROVIDER_STORAGE,
  resolveSocialProviderFromAuthUser,
  type SocialProvider,
} from "@/lib/auth/social-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") ? value : "/owner";
}

function resolveProvider(value: string | null): SocialProvider | null {
  return value === "google" || value === "kakao" || value === "naver" ? value : null;
}

function redirectToLogin(error: string, next: string, detail?: string | null) {
  const params = new URLSearchParams({ error, next });
  if (detail) {
    params.set("detail", detail.slice(0, 180));
  }
  window.location.replace(`/login?${params.toString()}`);
}

function clearPendingProvider() {
  document.cookie = `${PENDING_SOCIAL_PROVIDER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  window.localStorage.removeItem(PENDING_SOCIAL_PROVIDER_STORAGE);
}

export default function AuthClientCallback() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("소셜 로그인 연결을 마무리하고 있습니다.");
  const paramsKey = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      const params = new URLSearchParams(paramsKey);
      const next = safeNextPath(params.get("next"));
      const callbackError = params.get("error");
      const callbackErrorDescription = params.get("error_description");
      const code = params.get("code");

      if (callbackError) {
        redirectToLogin(
          callbackError === "access_denied" ? "social-access-denied" : "social-oauth",
          next,
          callbackErrorDescription || callbackError,
        );
        return;
      }

      if (!code) {
        redirectToLogin("social-callback", next);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        redirectToLogin("supabase", next);
        return;
      }

      const exchanged = await supabase.auth.exchangeCodeForSession(code);
      if (exchanged.error) {
        redirectToLogin("social-callback", next, exchanged.error.message);
        return;
      }

      const session = exchanged.data.session;
      const user = exchanged.data.user ?? (await supabase.auth.getUser()).data.user;
      if (!session?.access_token || !user) {
        redirectToLogin("social-session", next);
        return;
      }

      const requestedProvider = resolveProvider(params.get("provider"));
      const storedProvider = resolveProvider(window.localStorage.getItem(PENDING_SOCIAL_PROVIDER_STORAGE));
      const provider = requestedProvider ?? storedProvider ?? resolveSocialProviderFromAuthUser(user);

      try {
        const response = await fetch("/api/owner/shops", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const shops = response.ok ? await response.json() : [];
        if (Array.isArray(shops) && shops.length === 0) {
          clearPendingProvider();
          window.location.replace(`/signup/social?next=${encodeURIComponent(next)}&provider=${encodeURIComponent(provider)}`);
          return;
        }
      } catch {
        // If shop lookup fails, keep the signed-in session and continue to the requested page.
      }

      clearPendingProvider();
      window.location.replace(next);
    }

    completeAuth().catch((error) => {
      if (!active) return;
      const detail = error instanceof Error ? error.message : String(error);
      setMessage("소셜 로그인 연결을 완료하지 못했습니다.");
      redirectToLogin("social-callback", safeNextPath(new URLSearchParams(paramsKey).get("next")), detail);
    });

    return () => {
      active = false;
    };
  }, [paramsKey]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-[#111827]">
      <p className="text-[15px]">{message}</p>
    </main>
  );
}
