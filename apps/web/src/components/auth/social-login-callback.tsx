"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { clearOwnerAuthHandoff, clearOwnerAuthTokenCache, writeOwnerAuthHandoff, writeOwnerAuthSessionCache } from "@/lib/auth/owner-auth-handoff";
import { clearPendingSocialAccountLink, getSocialLinkErrorPath, getSocialLinkProviderError, readPendingSocialAccountLink, SOCIAL_ACCOUNT_PATH, type PendingSocialAccountLink, type SocialLinkError } from "@/lib/auth/social-account-link";
import { completeSocialLogin, getSocialLoginFailurePath, getSocialLoginReturnPath, SOCIAL_LOGIN_PROVIDERS, SocialLoginFailure, type SocialLoginError, type SocialLoginProvider } from "@/lib/auth/social-login";
import { writeCurrentOwnerShopId } from "@/lib/owner-current-shop";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SocialLoginCallback({ code, providerError, providerErrorCode, nextPath, intent, provider }: { code?: string; providerError?: string; providerErrorCode?: string; nextPath: string; intent?: "link"; provider?: SocialLoginProvider }) {
  const attempt = useRef<Promise<Awaited<ReturnType<typeof completeSocialLogin>>> | null>(null);
  const callbackInput = useRef<{ pending: PendingSocialAccountLink | null; error?: string; errorCode?: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const isLink = intent === "link";

  useEffect(() => {
    let active = true;
    if (!callbackInput.current) {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      let pending: PendingSocialAccountLink | null = null;
      try { if (isLink) pending = readPendingSocialAccountLink(window.sessionStorage, provider); } catch { /* Unavailable flow storage fails closed. */ }
      callbackInput.current = { pending, error: providerError ?? hash.get("error") ?? undefined, errorCode: providerErrorCode ?? hash.get("error_code") ?? undefined };
    }
    const input = callbackInput.current;
    // Remove one-time authorization material before any onward navigation.
    window.history.replaceState(window.history.state, "", "/auth/callback");
    function fail(reason: SocialLoginError, clearSession = false, linkReason: SocialLinkError = "failed") {
      if (!active) return;
      if (clearSession) { clearOwnerAuthHandoff(); clearOwnerAuthTokenCache(); }
      if (isLink) { try { clearPendingSocialAccountLink(window.sessionStorage); } catch { /* Unavailable storage. */ } }
      setFailed(true);
      window.location.replace(isLink ? getSocialLinkErrorPath(linkReason) : getSocialLoginFailurePath(reason, nextPath));
    }
    if (input.error || input.errorCode || !code) {
      fail(input.error === "access_denied" ? "social-cancelled" : "social-failed", false, getSocialLinkProviderError(input.error, input.errorCode));
      return () => { active = false; };
    }
    if (isLink && !input.pending) {
      fail("social-failed", false, "expired");
      return () => { active = false; };
    }
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { fail("social-failed"); return; }
      // Strict Mode reuses the same exchange; authorization codes are one-use.
      attempt.current ??= completeSocialLogin({ auth: supabase.auth, code, expectedUserId: isLink ? input.pending?.userId : undefined });
      void attempt.current.then(({ session, shopId }) => {
        if (!active) return;
        const requested = SOCIAL_LOGIN_PROVIDERS.find(item => item.id === provider);
        if (isLink && (!requested || !session.user.identities?.some(identity => identity.provider === requested.provider))) {
          fail("social-failed");
          return;
        }
        clearOwnerAuthHandoff();
        clearOwnerAuthTokenCache();
        const handoff = { accessToken: session.access_token, refreshToken: session.refresh_token };
        writeOwnerAuthHandoff(handoff);
        writeOwnerAuthSessionCache(handoff);
        writeCurrentOwnerShopId(shopId);
        if (isLink) {
          clearPendingSocialAccountLink(window.sessionStorage);
          window.location.replace(`${SOCIAL_ACCOUNT_PATH}?${new URLSearchParams({ message: "connected", provider: provider! })}`);
        } else window.location.replace(getSocialLoginReturnPath(nextPath));
      }).catch((error: unknown) => fail(error instanceof SocialLoginFailure ? error.reason : "social-failed", true));
    } catch {
      fail("social-failed");
    }
    return () => { active = false; };
  }, [code, isLink, nextPath, provider, providerError, providerErrorCode]);

  return <main className="flex min-h-dvh items-center justify-center bg-[#f1f3f7] px-5 text-[#101a31]"><div className="w-full max-w-md rounded-[18px] bg-white p-8 text-center"><h1 className="text-[24px] font-semibold leading-9">{failed ? (isLink ? "계정을 연결하지 못했습니다" : "로그인을 완료하지 못했습니다") : (isLink ? "계정 연결 확인 중" : "로그인 확인 중")}</h1><p role="status" className="mt-3 text-[16px] leading-6 text-[#64748b]">{failed ? "이전 화면으로 이동합니다." : "계정과 매장 정보를 확인하고 있습니다."}</p><Link href={{ pathname: isLink ? SOCIAL_ACCOUNT_PATH : "/login" }} className="mt-6 inline-flex min-h-11 items-center text-[14px] font-medium underline underline-offset-4">{isLink ? "계정 연결 화면으로 돌아가기" : "로그인 화면으로 돌아가기"}</Link></div></main>;
}
