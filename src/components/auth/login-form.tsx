"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseRuntimeStage } from "@/lib/env";
import {
  getOAuthRedirectOrigin,
  getSocialOAuthProvider,
  PENDING_SOCIAL_PROVIDER_COOKIE,
  PENDING_SOCIAL_PROVIDER_STORAGE,
  type SocialProvider,
} from "@/lib/auth/social-auth";
import { clearOwnerAuthTokenCache, writeOwnerAuthHandoff, writeOwnerAuthSessionCache } from "@/lib/auth/owner-auth-handoff";
import { getSupabaseBrowserClient, getSupabaseOAuthBrowserClient } from "@/lib/supabase/client";

import MobileLoginScreenTemplate from "./mobile-login-screen-template";

function toKoreanAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (isRateLimitMessage(normalized)) {
    return "소셜 로그인 요청이 잠시 제한됐어요. 5~10분 뒤 다시 시도해 주세요.";
  }

  if (isOAuthExpiredMessage(normalized)) {
    return "소셜 로그인 시간이 만료됐어요. 아래 소셜 로그인 버튼을 다시 눌러 주세요.";
  }

  if (
    normalized.includes("error getting user email from external provider") ||
    (normalized.includes("external provider") && normalized.includes("email"))
  ) {
    return "네이버에서 이메일 정보를 받지 못해 로그인 연결이 막혔어요. 네이버 개발자센터에서 제공 정보에 이메일 주소를 추가한 뒤 다시 시도해 주세요.";
  }

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
const STORAGE_HEALTH_CHECK_KEY = "petmanager.storageHealthCheck";
const OVERSIZED_PREVIEW_STORAGE_KEYS = ["petmanager.ownerWeb.shopProfileImages", "petmanager.ownerWeb.shopProfileImage"];
const STORAGE_WARNING_USAGE_RATIO = 0.8;
const SOCIAL_OAUTH_RATE_LIMIT_COOLDOWN_KEY = "petmanager.socialOAuthRateLimitCooldownUntil";
const SOCIAL_OAUTH_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;

type FailedLoginState = {
  count: number;
};

function getFailedLoginStateKey(loginId: string) {
  return `${FAILED_LOGIN_STATE_PREFIX}:${loginId.trim().toLowerCase() || "unknown"}`;
}

async function reportStoragePressure(loginId: string, payload: { reason: string; usage?: number | null; quota?: number | null; usageRatio?: number | null }) {
  try {
    await fetch("/api/auth/storage-health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        loginId,
        reason: payload.reason,
        usage: payload.usage ?? null,
        quota: payload.quota ?? null,
        usageRatio: payload.usageRatio ?? null,
      }),
    });
  } catch {
    // Storage health reporting is operational telemetry; it must never block login.
  }
}

async function makeRoomForAuthStorage(loginId: string) {
  if (typeof window === "undefined") return;

  let reported = false;

  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      const usage = typeof estimate.usage === "number" ? estimate.usage : null;
      const quota = typeof estimate.quota === "number" && estimate.quota > 0 ? estimate.quota : null;
      const usageRatio = usage != null && quota != null ? usage / quota : null;

      if (usageRatio != null && usageRatio >= STORAGE_WARNING_USAGE_RATIO) {
        reported = true;
        await reportStoragePressure(loginId, {
          reason: "storage_usage_over_80_percent",
          usage,
          quota,
          usageRatio,
        });
      }
    }
  } catch {
    // Browser storage estimate may be unavailable in some environments.
  }

  try {
    window.localStorage.setItem(STORAGE_HEALTH_CHECK_KEY, "1");
    window.localStorage.removeItem(STORAGE_HEALTH_CHECK_KEY);
    return;
  } catch {
    if (!reported) {
      await reportStoragePressure(loginId, {
        reason: "local_storage_write_failed",
        usage: null,
        quota: null,
        usageRatio: null,
      });
    }
  }

  for (const key of OVERSIZED_PREVIEW_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore unavailable storage and continue with the login flow.
    }
  }
}

function readFailedLoginState(loginId: string): FailedLoginState {
  if (typeof window === "undefined") {
    return { count: 0 };
  }

  try {
    const raw = window.localStorage.getItem(getFailedLoginStateKey(loginId));
    if (!raw) return { count: 0 };

    const parsed = JSON.parse(raw) as Partial<FailedLoginState> & { lockedUntil?: unknown };
    if (parsed.lockedUntil) {
      window.localStorage.removeItem(getFailedLoginStateKey(loginId));
      return { count: 0 };
    }

    const count = typeof parsed.count === "number" && Number.isFinite(parsed.count) ? parsed.count : 0;
    return { count };
  } catch {
    return { count: 0 };
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

function isRateLimitMessage(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("rate limit") ||
    normalized.includes("too many") ||
    normalized.includes("429") ||
    (normalized.includes("request") && normalized.includes("limit")) ||
    normalized.includes("요청이 잠시 제한") ||
    normalized.includes("잠시 제한")
  );
}

function isOAuthExpiredMessage(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("oauth state has expired") ||
    normalized.includes("state has expired") ||
    normalized.includes("expired")
  );
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

function getSocialRateLimitMessage() {
  return "소셜 로그인 요청이 잠시 제한됐어요. 5~10분 뒤 다시 시도해 주세요.";
}

function recordFailedLoginAttempt(loginId: string) {
  const current = readFailedLoginState(loginId);
  const nextState = { count: Math.min(current.count + 1, FAILED_LOGIN_LIMIT) };
  writeFailedLoginState(loginId, nextState);
  return nextState;
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
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const oauthSupabase = useMemo(() => getSupabaseOAuthBrowserClient(), []);
  const [showDevOwnerHelper, setShowDevOwnerHelper] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingDevOwner, setCreatingDevOwner] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  const [socialCooldownUntil, setSocialCooldownUntil] = useState<number | null>(null);
  const [rememberLoginId, setRememberLoginId] = useState(false);

  const startSocialCooldown = () => {
    const nextCooldownUntil = Date.now() + SOCIAL_OAUTH_RATE_LIMIT_COOLDOWN_MS;
    setSocialCooldownUntil(nextCooldownUntil);
    try {
      window.localStorage.setItem(SOCIAL_OAUTH_RATE_LIMIT_COOLDOWN_KEY, String(nextCooldownUntil));
    } catch {
      // Cooldown persistence is only a guard against repeated clicks.
    }
  };

  const clearExpiredSocialCooldown = () => {
    try {
      const raw = window.localStorage.getItem(SOCIAL_OAUTH_RATE_LIMIT_COOLDOWN_KEY);
      const storedUntil = raw ? Number(raw) : null;
      if (storedUntil && Number.isFinite(storedUntil) && storedUntil > Date.now()) {
        setSocialCooldownUntil(storedUntil);
        return storedUntil;
      }
      window.localStorage.removeItem(SOCIAL_OAUTH_RATE_LIMIT_COOLDOWN_KEY);
    } catch {
      // Ignore unavailable browser storage.
    }
    setSocialCooldownUntil(null);
    return null;
  };

  useEffect(() => {
    setShowDevOwnerHelper(getSupabaseRuntimeStage() !== "production");
    const activeCooldownUntil = clearExpiredSocialCooldown();
    if (activeCooldownUntil && activeCooldownUntil > Date.now()) {
      setMessage(getSocialRateLimitMessage());
    }

    const savedLoginId = window.localStorage.getItem(SAVED_LOGIN_ID_KEY);
    if (savedLoginId) {
      setLoginId(savedLoginId);
      setRememberLoginId(true);
    }
  }, []);

  useEffect(() => {
    if (!initialMessage) return;

    const url = new URL(window.location.href);
    if (!url.searchParams.has("error") && !url.searchParams.has("detail")) return;

    if (isRateLimitMessage(initialMessage)) {
      startSocialCooldown();
      setMessage(getSocialRateLimitMessage());
    }

    url.searchParams.delete("error");
    url.searchParams.delete("detail");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [initialMessage]);

  useEffect(() => {
    if (!socialCooldownUntil) return;

    const delay = Math.max(0, socialCooldownUntil - Date.now());
    if (delay === 0) {
      clearExpiredSocialCooldown();
      return;
    }

    const timer = window.setTimeout(clearExpiredSocialCooldown, delay);
    return () => window.clearTimeout(timer);
  }, [socialCooldownUntil]);

  const handleLogin = async (credentials?: { loginId: string; password: string }) => {
    const currentLoginId = (credentials?.loginId ?? loginId).trim();
    const currentPassword = credentials?.password ?? password;

    if (currentLoginId !== loginId) {
      setLoginId(currentLoginId);
    }
    if (currentPassword !== password) {
      setPassword(currentPassword);
    }

    if (!currentLoginId || !currentPassword) {
      setMessage("아이디와 비밀번호를 입력해 주세요.");
      return;
    }
    if (!supabaseReady) {
      setMessage("로그인 환경을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: currentLoginId, password: currentPassword }),
      });
      const result = (await response.json().catch(() => ({
        message: "로그인 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
      }))) as OwnerLoginApiResponse;

      if (!response.ok || !result.success) {
        const nextMessage = result.message ?? "아이디 또는 비밀번호를 다시 확인해 주세요.";

        if (isRateLimitMessage(nextMessage)) {
          setMessage(getRateLimitMessage());
          return;
        }

        if (isInvalidCredentialMessage(nextMessage)) {
          const failedState = recordFailedLoginAttempt(currentLoginId);
          const remainingAttempts = Math.max(1, FAILED_LOGIN_LIMIT - failedState.count);
          setMessage(
            failedState.count >= FAILED_LOGIN_LIMIT
              ? "아이디 또는 비밀번호를 다시 확인해 주세요. 계속 안 되면 비밀번호 찾기로 재설정해 주세요."
              : `아이디 또는 비밀번호를 다시 확인해 주세요. ${remainingAttempts}회 더 틀리면 비밀번호 찾기를 권장해 드릴게요.`,
          );
          return;
        }

        setMessage(nextMessage);
        return;
      }

      clearFailedLoginState(currentLoginId);

      if (result.session?.accessToken && result.session.refreshToken) {
        await makeRoomForAuthStorage(currentLoginId);
        clearOwnerAuthTokenCache();
        writeOwnerAuthHandoff(result.session);
        writeOwnerAuthSessionCache(result.session);

        if (supabase) {
          const { error } = await supabase.auth.setSession({
            access_token: result.session.accessToken,
            refresh_token: result.session.refreshToken,
          });

          if (error) {
            console.warn("[auth/login] browser Supabase session persistence failed", error.message);
          }
        }
      }

      try {
        if (rememberLoginId && currentLoginId) {
          window.localStorage.setItem(SAVED_LOGIN_ID_KEY, currentLoginId);
        } else {
          window.localStorage.removeItem(SAVED_LOGIN_ID_KEY);
        }
      } catch {
        // Remembering the login id is optional and must not block login.
      }

      window.location.assign(nextPath);
    } catch {
      setMessage("로그인 요청 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    const activeCooldownUntil = clearExpiredSocialCooldown();
    if (activeCooldownUntil && activeCooldownUntil > Date.now()) {
      setMessage(getSocialRateLimitMessage());
      return;
    }

    if (!supabaseReady || !oauthSupabase) {
      setMessage("소셜 로그인 환경을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setSocialLoading(provider);
    setMessage(null);

    try {
      document.cookie = `${PENDING_SOCIAL_PROVIDER_COOKIE}=${provider}; Path=/; Max-Age=600; SameSite=Lax`;
      window.localStorage.setItem(PENDING_SOCIAL_PROVIDER_STORAGE, provider);

      const redirectTo = `${getOAuthRedirectOrigin()}/auth/client-callback?next=${encodeURIComponent(nextPath)}&provider=${encodeURIComponent(provider)}`;
      const { error } = await oauthSupabase.auth.signInWithOAuth({
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
        if (isRateLimitMessage(error.message)) {
          startSocialCooldown();
          setMessage(getSocialRateLimitMessage());
          return;
        }

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
      const result = (await response.json()) as { loginId?: string; password?: string | null; message?: string };

      if (!response.ok || !result.loginId) {
        setMessage(result.message ?? "개발용 테스트 계정을 만들지 못했어요.");
        return;
      }

      setLoginId(result.loginId);
      if (result.password) {
        setPassword(result.password);
      }
      setRememberLoginId(true);
      window.localStorage.setItem(SAVED_LOGIN_ID_KEY, result.loginId);
      setMessage(result.message ?? "개발용 테스트 계정을 준비했어요. 바로 로그인해 보세요.");
    } finally {
      setCreatingDevOwner(false);
    }
  };

  const isSocialCooldownActive = Boolean(socialCooldownUntil && socialCooldownUntil > Date.now());

  return (
    <div>
      <MobileLoginScreenTemplate
        loginId={loginId}
        password={password}
        rememberLoginId={rememberLoginId}
        loading={loading}
        socialLoading={socialLoading}
        socialDisabled={isSocialCooldownActive}
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
