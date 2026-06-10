"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SupabaseClient, Session, User } from "@supabase/supabase-js";

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

async function waitForOAuthSession(supabase: SupabaseClient, timeoutMs = 8000) {
  const current = await supabase.auth.getSession();
  if (current.data.session?.access_token) {
    const user = current.data.session.user ?? (await supabase.auth.getUser()).data.user;
    return { session: current.data.session, user };
  }

  return new Promise<{ session: Session | null; user: User | null }>((resolve) => {
    let settled = false;
    let attempts = 0;
    let unsubscribe: (() => void) | null = null;
    let intervalId: number | null = null;
    let timeoutId: number | null = null;

    const finish = (session: Session | null, user: User | null) => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      if (intervalId != null) window.clearInterval(intervalId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
      resolve({ session, user });
    };

    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        finish(session, session.user ?? null);
      }
    });
    unsubscribe = () => subscription.data.subscription.unsubscribe();

    intervalId = window.setInterval(async () => {
      attempts += 1;
      const next = await supabase.auth.getSession();
      if (next.data.session?.access_token) {
        finish(next.data.session, next.data.session.user ?? null);
      } else if (attempts >= Math.ceil(timeoutMs / 250)) {
        finish(null, null);
      }
    }, 250);

    timeoutId = window.setTimeout(() => finish(null, null), timeoutMs);
  });
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

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        redirectToLogin("supabase", next);
        return;
      }

      let { session, user } = await waitForOAuthSession(supabase);

      if (!session?.access_token && code) {
        const exchanged = await supabase.auth.exchangeCodeForSession(code);
        if (exchanged.error) {
          redirectToLogin("social-callback", next, exchanged.error.message);
          return;
        }

        session = exchanged.data.session;
        user = exchanged.data.user ?? (await supabase.auth.getUser()).data.user;
      }

      if (!session?.access_token || !user) {
        redirectToLogin("social-session", next, code ? "세션 생성 대기 시간이 초과되었습니다." : "OAuth code가 없습니다.");
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
