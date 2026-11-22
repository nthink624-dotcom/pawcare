"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SocialLoginFailure, type SocialLoginError } from "@petmanager/shared/lib/owner-social-login";

import { consumeMobileSocialReturn } from "@/lib/auth/mobile-social-login-attempt";
import { finishMobileSocialLogin, socialLoginMessages } from "@/lib/auth/mobile-social-login";

export default function MobileSocialCallback() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function finish() {
      let nextPath = "/owner/mobile";
      const returnToLogin = (reason: SocialLoginError) => router.replace(`/login?${new URLSearchParams({ error: reason, next: nextPath })}` as never);
      try {
        const url = window.location.href;
        window.history.replaceState(window.history.state, "", window.location.pathname);
        const result = consumeMobileSocialReturn(url, window.sessionStorage, window.location.origin);
        if (!result) return returnToLogin("social-failed");
        nextPath = result.nextPath;
        if (result.error) return returnToLogin(result.error);
        await finishMobileSocialLogin(result.code);
        router.replace(nextPath as never);
      } catch (error) {
        returnToLogin(error instanceof SocialLoginFailure ? error.reason : "social-failed");
      }
    }
    void finish();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] items-center justify-center px-7 text-[#475569]">
      <p role="status">로그인 정보를 확인하는 중입니다.</p>
      <noscript><a href="/login">{socialLoginMessages["social-failed"]}</a></noscript>
    </main>
  );
}
