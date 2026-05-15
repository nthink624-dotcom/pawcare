"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PENDING_SOCIAL_PROVIDER_COOKIE } from "@/lib/auth/social-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") ? value : "/owner";
}

function redirectToLogin(error: string, next: string, detail?: string | null) {
  const params = new URLSearchParams({ error, next });
  if (detail) {
    params.set("detail", detail.slice(0, 180));
  }
  window.location.replace(`/login?${params.toString()}`);
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

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        redirectToLogin("social-callback", next, error.message);
        return;
      }

      document.cookie = `${PENDING_SOCIAL_PROVIDER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
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
