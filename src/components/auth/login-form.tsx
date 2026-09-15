"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  clearOwnerAuthTokenCache,
  writeOwnerAuthHandoff,
  writeOwnerAuthSessionCache,
} from "@/lib/auth/owner-auth-handoff";
import { isValidOwnerEmail, normalizeOwnerEmail } from "@/lib/auth/owner-credentials";
import {
  OWNER_LOGIN_CLIENT_TIMEOUT_MS,
} from "@/lib/auth/owner-login-timeout";
import { traceOwnerMobileStartupStep } from "@/lib/owner-mobile-startup";

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
  useEffect(() => {
    // This form is rendered only after the server rejected the current session.
    // Remove only stale Supabase auth cookies; login itself has one server-owned
    // auth request and the destination page persists the returned session.
    clearRejectedSupabaseSessionCookies();
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
    if (!supabaseReady) {
      setMessage("로그인 환경을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setCanResendConfirmation(false);
    const requestController = new AbortController();
    const requestTimer = window.setTimeout(() => requestController.abort(), OWNER_LOGIN_CLIENT_TIMEOUT_MS);

    try {
      const response = await traceOwnerMobileStartupStep("login-api", () =>
        fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password }),
          signal: requestController.signal,
        }),
      );
      const result = (await response.json()) as LoginResponse;
      const accessToken = result.session?.accessToken;
      const refreshToken = result.session?.refreshToken;
      if (!response.ok || !accessToken || !refreshToken) {
        const nextMessage = result.message ?? "이메일 또는 비밀번호를 다시 확인해 주세요.";
        setMessage(nextMessage);
        setCanResendConfirmation(nextMessage.includes("이메일 인증"));
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

      // Keep the native WebView on the canonical same-origin owner surface.
      // Refreshing immediately after replace can reload the login document
      // before client navigation commits on slower WebView render processes.
      router.replace("/owner/mobile" as never);
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "AbortError";
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
      nextPath={nextPath}
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
