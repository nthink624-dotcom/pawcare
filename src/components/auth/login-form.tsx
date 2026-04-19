"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { buildOwnerAuthEmail } from "@/lib/auth/owner-credentials";
import {
  getSocialOAuthProvider,
  PENDING_SOCIAL_PROVIDER_COOKIE,
  PENDING_SOCIAL_PROVIDER_STORAGE,
  type SocialProvider,
} from "@/lib/auth/social-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
    return "비밀번호는 6자 이상 입력해 주세요.";
  }
  if (normalized.includes("unable to validate email address")) {
    return "이메일 형식을 다시 확인해 주세요.";
  }
  if (normalized.includes("oauth")) {
    return "소셜 로그인 처리 중 문제가 발생했어요. 다시 시도해 주세요.";
  }

  return "로그인 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
}

const SAVED_LOGIN_ID_KEY = "pawcare.savedLoginId";

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
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  const handleLogin = async () => {
    if (!supabaseReady || !supabase) {
      setMessage("로그인 환경을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: buildOwnerAuthEmail(loginId),
        password,
      });

      if (error) {
        setMessage(toKoreanAuthError(error.message));
        return;
      }

      if (rememberLoginId && loginId.trim()) {
        window.localStorage.setItem(SAVED_LOGIN_ID_KEY, loginId.trim());
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
    if (!supabaseReady || !supabase) {
      setMessage("소셜 로그인 환경을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setSocialLoading(provider);
    setMessage(null);

    try {
      document.cookie = `${PENDING_SOCIAL_PROVIDER_COOKIE}=${provider}; Path=/; Max-Age=600; SameSite=Lax`;
      window.localStorage.setItem(PENDING_SOCIAL_PROVIDER_STORAGE, provider);

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}&provider=${encodeURIComponent(provider)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: getSocialOAuthProvider(provider) as "google" | "kakao" | "custom:naver",
        options: {
          redirectTo,
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
      }
    } finally {
      setSocialLoading(null);
    }
  };

  return (
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
  );
}
