"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  clearOwnerAuthTokenCache,
  writeOwnerAuthHandoff,
  writeOwnerAuthSessionCache,
} from "@/lib/auth/owner-auth-handoff";
import { isValidOwnerEmail, normalizeOwnerEmail } from "@/lib/auth/owner-credentials";
import {
  OWNER_LOGIN_CLIENT_TIMEOUT_MS,
  OwnerLoginTimeoutError,
  withOwnerLoginTimeout,
} from "@/lib/auth/owner-login-timeout";
import { getSafeNextPath } from "@/lib/auth/safe-next-path";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import MobileLoginScreenTemplate from "./mobile-login-screen-template";

const SAVED_EMAIL_KEY = "petmanager.savedOwnerEmail";

type LoginResponse = {
  message?: string;
  session?: { accessToken?: string; refreshToken?: string };
};

function clearRejectedSupabaseSessionCookies() {
  if (typeof document === "undefined") return;

  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=", 1)[0]?.trim();
    if (!name || !/^sb-.*-auth-token(?:\.\d+)?$/.test(name)) continue;
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}

export default function LoginForm({
  supabaseReady,
  initialMessage,
  nextPath = "/owner/mobile",
}: {
  supabaseReady: boolean;
  initialMessage?: string | null;
  nextPath?: string;
}) {
  const router = useRouter();
  const safeNextPath = getSafeNextPath(nextPath, "/owner/mobile");
  const supabase = useMemo(() => {
    // This form is rendered only after the server rejected the current session.
    // Remove only stale Supabase auth cookies before its browser client starts
    // automatic token recovery; saved email and unrelated app data stay intact.
    clearRejectedSupabaseSessionCookies();
    return getSupabaseBrowserClient();
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(SAVED_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  const handleLogin = async () => {
    const normalizedEmail = normalizeOwnerEmail(email);
    if (!isValidOwnerEmail(normalizedEmail) || !password) {
      setMessage("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    if (!supabaseReady || !supabase) {
      setMessage("로그인 환경을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setCanResendConfirmation(false);
    const requestController = new AbortController();
    const requestTimer = window.setTimeout(() => requestController.abort(), OWNER_LOGIN_CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
        signal: requestController.signal,
      });
      const result = (await response.json()) as LoginResponse;
      const accessToken = result.session?.accessToken;
      const refreshToken = result.session?.refreshToken;
      if (!response.ok || !accessToken || !refreshToken) {
        const nextMessage = result.message ?? "이메일 또는 비밀번호를 다시 확인해 주세요.";
        setMessage(nextMessage);
        setCanResendConfirmation(nextMessage.includes("이메일 인증"));
        return;
      }

      const sessionResult = await withOwnerLoginTimeout(
        () => supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
        OWNER_LOGIN_CLIENT_TIMEOUT_MS,
      );
      const { error } = sessionResult as { error: { message?: string } | null };
      if (error) {
        setMessage("로그인 정보를 저장하지 못했습니다. 다시 시도해 주세요.");
        return;
      }

      const handoff = { accessToken, refreshToken };
      clearOwnerAuthTokenCache();
      writeOwnerAuthHandoff(handoff);
      writeOwnerAuthSessionCache(handoff);

      if (rememberEmail) {
        window.localStorage.setItem(SAVED_EMAIL_KEY, normalizedEmail);
      } else {
        window.localStorage.removeItem(SAVED_EMAIL_KEY);
      }

      // Keep the native WebView on a validated same-origin owner surface.
      // Refreshing immediately after replace can reload the login document
      // before client navigation commits on slower WebView render processes.
      if (safeNextPath === "/owner/mobile") {
        router.replace("/owner/mobile" as never);
      } else {
        router.replace(safeNextPath as never);
      }
    } catch (error) {
      const timedOut = error instanceof OwnerLoginTimeoutError || (error instanceof DOMException && error.name === "AbortError");
      setMessage(
        timedOut
          ? "로그인 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
          : "로그인 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      window.clearTimeout(requestTimer);
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    const normalizedEmail = normalizeOwnerEmail(email);
    if (!isValidOwnerEmail(normalizedEmail)) {
      setMessage("인증 메일을 다시 받으려면 이메일을 입력해 주세요.");
      return;
    }

    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-email-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const result = (await response.json()) as LoginResponse;
      setMessage(result.message ?? "가입된 이메일이라면 인증 메일을 다시 보냈습니다.");
    } finally {
      setResending(false);
    }
  };

  return (
    <MobileLoginScreenTemplate
      email={email}
      password={password}
      rememberEmail={rememberEmail}
      loading={loading}
      message={message}
      nextPath={safeNextPath}
      canResendConfirmation={canResendConfirmation}
      resendingConfirmation={resending}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onRememberEmailChange={setRememberEmail}
      onLogin={() => void handleLogin()}
      onResendConfirmation={() => void resendConfirmation()}
    />
  );
}
