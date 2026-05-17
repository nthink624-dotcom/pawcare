"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseRuntimeStage } from "@/lib/env";
import {
  getOAuthRedirectOrigin,
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

type OwnerLoginApiResponse = {
  success?: boolean;
  message?: string;
  session?: {
    accessToken: string;
    refreshToken: string;
  };
};

const SAVED_LOGIN_ID_KEY = "petmanager.savedLoginId";
const FAILED_LOGIN_STATE_PREFIX = "petmanager.failedLogin";
const FAILED_LOGIN_LIMIT = 5;
const FAILED_LOGIN_LOCK_MS = 10 * 60 * 1000;

type FailedLoginState = {
  count: number;
  lockedUntil: number | null;
};

function getFailedLoginStateKey(loginId: string) {
  return `${FAILED_LOGIN_STATE_PREFIX}:${loginId.trim().toLowerCase() || "unknown"}`;
}

function readFailedLoginState(loginId: string): FailedLoginState {
  if (typeof window === "undefined") {
    return { count: 0, lockedUntil: null };
  }

  try {
    const raw = window.localStorage.getItem(getFailedLoginStateKey(loginId));
    if (!raw) return { count: 0, lockedUntil: null };

    const parsed = JSON.parse(raw) as Partial<FailedLoginState>;
    const count = typeof parsed.count === "number" && Number.isFinite(parsed.count) ? parsed.count : 0;
    const lockedUntil =
      typeof parsed.lockedUntil === "number" && Number.isFinite(parsed.lockedUntil) ? parsed.lockedUntil : null;

    if (lockedUntil && lockedUntil <= Date.now()) {
      window.localStorage.removeItem(getFailedLoginStateKey(loginId));
      return { count: 0, lockedUntil: null };
    }

    return { count, lockedUntil };
  } catch {
    return { count: 0, lockedUntil: null };
  }
}

function writeFailedLoginState(loginId: string, state: FailedLoginState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getFailedLoginStateKey(loginId), JSON.stringify(state));
}

function clearFailedLoginState(loginId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getFailedLoginStateKey(loginId));
}

function getRemainingLockMinutes(lockedUntil: number) {
  return Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
}

function getLockedLoginMessage(lockedUntil: number) {
  return `비밀번호를 여러 번 잘못 입력했어요. ${getRemainingLockMinutes(
    lockedUntil,
  )}분 뒤 다시 시도하거나 아래의 비밀번호 찾기로 재설정해 주세요.`;
}

function isRateLimitMessage(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("rate limit") || normalized.includes("too many") || normalized.includes("429");
}

function isInvalidCredentialMessage(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("invalid login credentials") ||
    normalized.includes("아이디") ||
    normalized.includes("비밀번호")
  );
}

function getRateLimitMessage() {
  return "로그인 요청이 잠시 제한되었어요. 10분 뒤 다시 시도하거나 아래의 비밀번호 찾기로 재설정해 주세요.";
}

function recordFailedLoginAttempt(loginId: string) {
  const current = readFailedLoginState(loginId);
  const nextCount = current.count + 1;

  if (nextCount >= FAILED_LOGIN_LIMIT) {
    const lockedUntil = Date.now() + FAILED_LOGIN_LOCK_MS;
    const nextState = { count: nextCount, lockedUntil };
    writeFailedLoginState(loginId, nextState);
    return nextState;
  }

  const nextState = { count: nextCount, lockedUntil: null };
  writeFailedLoginState(loginId, nextState);
  return nextState;
}

function getSessionPersistenceErrorMessage(message?: string) {
  if (isRateLimitMessage(message)) {
    return getRateLimitMessage();
  }

  if (!message) {
    return "로그인 세션을 저장하지 못했습니다. 브라우저 쿠키 설정과 Supabase 환경변수를 확인해 주세요.";
  }

  const normalized = message.toLowerCase();
  if (normalized.includes("invalid") || normalized.includes("jwt")) {
    return "로그인 세션 정보가 현재 Supabase 설정과 맞지 않습니다. Vercel 환경변수를 확인해 주세요.";
  }

  return `로그인 세션 저장 중 문제가 발생했습니다. ${message}`;
}

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
  const [showDevOwnerHelper, setShowDevOwnerHelper] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingDevOwner, setCreatingDevOwner] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  const [rememberLoginId, setRememberLoginId] = useState(false);

  useEffect(() => {
    setShowDevOwnerHelper(getSupabaseRuntimeStage() !== "production");

    const savedLoginId = window.localStorage.getItem(SAVED_LOGIN_ID_KEY);
    if (savedLoginId) {
      setLoginId(savedLoginId);
      setRememberLoginId(true);
    }
  }, []);

  const handleLogin = async () => {
    if (!supabaseReady) {
      setMessage("로그인 환경을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    const currentFailedLoginState = readFailedLoginState(loginId);
    if (currentFailedLoginState.lockedUntil && currentFailedLoginState.lockedUntil > Date.now()) {
      setMessage(getLockedLoginMessage(currentFailedLoginState.lockedUntil));
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const result = (await response.json().catch(() => ({
        message: "로그인 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
      }))) as OwnerLoginApiResponse;

      if (!response.ok || !result.success) {
        const nextMessage = result.message ?? "아이디 또는 비밀번호를 다시 확인해 주세요.";

        if (isRateLimitMessage(nextMessage)) {
          const lockedUntil = Date.now() + FAILED_LOGIN_LOCK_MS;
          writeFailedLoginState(loginId, { count: FAILED_LOGIN_LIMIT, lockedUntil });
          setMessage(getRateLimitMessage());
          return;
        }

        if (isInvalidCredentialMessage(nextMessage)) {
          const failedState = recordFailedLoginAttempt(loginId);
          if (failedState.lockedUntil) {
            setMessage(getLockedLoginMessage(failedState.lockedUntil));
            return;
          }

          const remainingAttempts = Math.max(1, FAILED_LOGIN_LIMIT - failedState.count);
          setMessage(`아이디 또는 비밀번호를 다시 확인해 주세요. ${remainingAttempts}회 더 틀리면 10분간 제한됩니다.`);
          return;
        }

        setMessage(nextMessage);
        return;
      }

      if (!supabase || !result.session) {
        setMessage("로그인 세션을 만들지 못했습니다. Supabase 환경변수를 확인해 주세요.");
        return;
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: result.session.accessToken,
        refresh_token: result.session.refreshToken,
      });

      if (setSessionError) {
        if (isRateLimitMessage(setSessionError.message)) {
          const lockedUntil = Date.now() + FAILED_LOGIN_LOCK_MS;
          writeFailedLoginState(loginId, { count: FAILED_LOGIN_LIMIT, lockedUntil });
        }
        setMessage(getSessionPersistenceErrorMessage(setSessionError.message));
        return;
      }

      const verifiedSession = await supabase.auth.getSession();
      if (verifiedSession.error || !verifiedSession.data.session?.access_token) {
        if (isRateLimitMessage(verifiedSession.error?.message)) {
          const lockedUntil = Date.now() + FAILED_LOGIN_LOCK_MS;
          writeFailedLoginState(loginId, { count: FAILED_LOGIN_LIMIT, lockedUntil });
        }
        setMessage(getSessionPersistenceErrorMessage(verifiedSession.error?.message));
        return;
      }

      clearFailedLoginState(loginId);

      if (rememberLoginId && loginId.trim()) {
        window.localStorage.setItem(SAVED_LOGIN_ID_KEY, loginId.trim());
      } else {
        window.localStorage.removeItem(SAVED_LOGIN_ID_KEY);
      }

      router.replace(nextPath as never);
      router.refresh();
    } catch {
      setMessage("로그인 요청 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.");
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

      const redirectTo = `${getOAuthRedirectOrigin()}/auth/callback?next=${encodeURIComponent(nextPath)}&provider=${encodeURIComponent(provider)}`;
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
        <div className="mx-auto -mt-6 w-full max-w-[430px] px-6 pb-12">
          <div className="rounded-[22px] border border-[#dfe7e2] bg-[#f6fbf9] p-4">
            <p className="text-[13px] font-semibold text-[#1f6b5b]">개발용 테스트 계정</p>
            <p className="mt-2 text-[13px] leading-6 text-[#5f6c66]">
              새 개발용 DB에서는 운영 계정이 자동으로 복사되지 않아요. 버튼 한 번으로 테스트 오너 계정을 만들고 바로 로그인할 수 있어요.
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
