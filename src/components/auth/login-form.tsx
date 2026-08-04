"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  clearOwnerAuthTokenCache,
  writeOwnerAuthHandoff,
  writeOwnerAuthSessionCache,
} from "@/lib/auth/owner-auth-handoff";
import { buildOwnerAuthEmailCandidates } from "@/lib/auth/owner-credentials";
import {
  addNativeOwnerOAuthListener,
  exchangeNativeOwnerOAuthUrl,
  isNativeOwnerApp,
  openNativeOwnerOAuth,
  OWNER_NATIVE_AUTH_CALLBACK_URL,
} from "@/lib/auth/native-social-auth";
import {
  getSocialOAuthProvider,
  PENDING_SOCIAL_PROVIDER_COOKIE,
  PENDING_SOCIAL_PROVIDER_STORAGE,
  type SocialProvider,
} from "@/lib/auth/social-auth";
import { getSupabaseRuntimeStage } from "@/lib/env";
import { getSupabaseBrowserClient, getSupabaseOAuthBrowserClient } from "@/lib/supabase/client";

import MobileLoginScreenTemplate from "./mobile-login-screen-template";

function toKoreanAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "아이디 또는 비밀번호를 다시 확인해 주세요.";
  }
  if (normalized.includes("email not confirmed")) {
    return "이메일 인증이 아직 완료되지 않았어요.";
  }
  if (normalized.includes("user already registered")) {
    return "이미 가입된 계정이에요.";
  }
  if (normalized.includes("password should be at least")) {
    return "비밀번호를 6자 이상 입력해 주세요.";
  }
  if (normalized.includes("unable to validate email address")) {
    return "이메일 형식을 다시 확인해 주세요.";
  }
  if (/[가-힣]/.test(message)) {
    return message;
  }
  if (normalized.includes("oauth")) {
    return "소셜 로그인 처리 중 문제가 발생했어요. 다시 시도해 주세요.";
  }

  return "로그인 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
}

const SAVED_LOGIN_ID_KEY = "petmanager.savedLoginId";

export default function LoginForm({
  supabaseReady,
  initialMessage,
  nextPath = "/owner",
}: {
  supabaseReady: boolean;
  initialMessage?: string | null;
  nextPath?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const oauthSupabase = useMemo(() => getSupabaseOAuthBrowserClient(), []);
  const showDevOwnerHelper = useMemo(
    () => getSupabaseRuntimeStage() !== "production" && nextPath !== "/owner/mobile",
    [nextPath],
  );
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingDevOwner, setCreatingDevOwner] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  const [rememberLoginId, setRememberLoginId] = useState(false);

  useEffect(() => {
    const savedLoginId = window.localStorage.getItem(SAVED_LOGIN_ID_KEY);
    if (savedLoginId) {
      setLoginId(savedLoginId);
      setRememberLoginId(true);
    }
  }, []);

  useEffect(() => {
    if (!isNativeOwnerApp() || !oauthSupabase) return;

    const nativeOAuthSupabase = oauthSupabase;
    let active = true;
    let removeListener: (() => Promise<void>) | null = null;

    async function completeNativeOAuth(callbackUrl: string) {
      try {
        const session = await exchangeNativeOwnerOAuthUrl(nativeOAuthSupabase, callbackUrl);
        if (!active || !session?.access_token || !session.refresh_token) return;

        const handoff = {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        };
        clearOwnerAuthTokenCache();
        writeOwnerAuthHandoff(handoff);
        writeOwnerAuthSessionCache(handoff);
        setMessage(null);
        router.replace(nextPath as never);
        router.refresh();
      } catch (error) {
        if (!active) return;
        const nextMessage = error instanceof Error ? error.message : "소셜 로그인 처리 중 문제가 발생했어요.";
        setMessage(toKoreanAuthError(nextMessage));
      } finally {
        if (active) setSocialLoading(null);
      }
    }

    void addNativeOwnerOAuthListener(completeNativeOAuth).then((handle) => {
      if (!active) {
        void handle.remove();
        return;
      }
      removeListener = () => handle.remove();
    });

    return () => {
      active = false;
      if (removeListener) void removeListener();
    };
  }, [nextPath, oauthSupabase, router]);

  const handleLogin = async () => {
    const currentLoginId = loginId.trim();
    if (!currentLoginId || !password) {
      setMessage("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    if (!supabaseReady || !supabase) {
      setMessage("로그인 환경을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      let lastError: Error | null = null;
      let signedIn = false;

      for (const email of buildOwnerAuthEmailCandidates(currentLoginId)) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.session?.access_token && data.session.refresh_token) {
          const handoff = {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          };
          clearOwnerAuthTokenCache();
          writeOwnerAuthHandoff(handoff);
          writeOwnerAuthSessionCache(handoff);
          signedIn = true;
          break;
        }

        lastError = error;
        if (error && !error.message.toLowerCase().includes("invalid login credentials")) break;
      }

      if (!signedIn) {
        setMessage(toKoreanAuthError(lastError?.message ?? "invalid login credentials"));
        return;
      }

      if (rememberLoginId) {
        window.localStorage.setItem(SAVED_LOGIN_ID_KEY, currentLoginId);
      } else {
        window.localStorage.removeItem(SAVED_LOGIN_ID_KEY);
      }

      router.replace(nextPath as never);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (!supabaseReady || !oauthSupabase) {
      setMessage("소셜 로그인 환경을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setSocialLoading(provider);
    setMessage(null);

    try {
      document.cookie = `${PENDING_SOCIAL_PROVIDER_COOKIE}=${provider}; Path=/; Max-Age=600; SameSite=Lax`;
      window.localStorage.setItem(PENDING_SOCIAL_PROVIDER_STORAGE, provider);

      const nativeApp = isNativeOwnerApp();
      const redirectTo = nativeApp
        ? OWNER_NATIVE_AUTH_CALLBACK_URL
        : `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}&provider=${encodeURIComponent(provider)}`;
      const { data, error } = await oauthSupabase.auth.signInWithOAuth({
        provider: getSocialOAuthProvider(provider) as "google" | "kakao" | "custom:naver",
        options: {
          redirectTo,
          skipBrowserRedirect: nativeApp,
          queryParams:
            provider === "google"
              ? { prompt: "select_account" }
              : provider === "naver"
                ? { auth_type: "reauthenticate" }
                : undefined,
        },
      });

      if (error) {
        setMessage(toKoreanAuthError(error.message));
        return;
      }

      if (nativeApp) {
        if (!data.url) {
          setMessage("소셜 로그인 페이지를 열지 못했어요. 다시 시도해 주세요.");
          return;
        }
        await openNativeOwnerOAuth(data.url);
      }
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "소셜 로그인 처리 중 문제가 발생했어요.";
      setMessage(toKoreanAuthError(nextMessage));
    } finally {
      setSocialLoading(null);
    }
  };

  const createDevOwner = async () => {
    setCreatingDevOwner(true);
    setMessage(null);

    try {
      const response = await fetch("/api/dev/create-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = (await response.json()) as { loginId?: string; password?: string; message?: string };

      if (!response.ok || !result.loginId || !result.password) {
        setMessage(result.message ?? "개발용 테스트 계정을 만들지 못했어요.");
        return;
      }

      setLoginId(result.loginId);
      setPassword(result.password);
      setRememberLoginId(true);
      window.localStorage.setItem(SAVED_LOGIN_ID_KEY, result.loginId);
      setMessage(result.message ?? "개발용 테스트 계정을 준비했어요. 바로 로그인해 보세요.");
    } finally {
      setCreatingDevOwner(false);
    }
  };

  return (
    <div>
      <MobileLoginScreenTemplate
        loginId={loginId}
        password={password}
        rememberLoginId={rememberLoginId}
        loading={loading}
        socialLoading={socialLoading}
        message={message}
        nextPath={nextPath}
        onLoginIdChange={setLoginId}
        onPasswordChange={setPassword}
        onRememberLoginIdChange={setRememberLoginId}
        onLogin={handleLogin}
        onSocialLogin={(provider) => void handleSocialLogin(provider)}
      />

      {showDevOwnerHelper ? (
        <div className="mx-auto -mt-6 hidden w-full max-w-[430px] px-6 pb-12 sm:block">
          <div className="rounded-[22px] border border-[#dfe7e2] bg-[#f6fbf9] p-4">
            <p className="text-[13px] font-semibold text-[#1f6b5b]">개발용 테스트 계정</p>
            <p className="mt-2 text-[13px] leading-6 text-[#5f6c66]">
              개발 DB에서는 운영 계정을 자동으로 복사하지 않아요. 버튼 한 번으로 테스트 오너 계정을 만들고 바로 로그인할 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => void createDevOwner()}
              disabled={creatingDevOwner || loading || socialLoading !== null}
              className="mt-4 flex h-[48px] w-full items-center justify-center rounded-[16px] border border-[#cfe3dc] bg-white text-[15px] font-semibold text-[#1f6b5b] disabled:opacity-60"
            >
              {creatingDevOwner ? "테스트 계정 준비 중..." : "개발용 테스트 오너 만들기"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
