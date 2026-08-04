"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { getSupabaseRuntimeStage } from "@/lib/env";
import { clearOwnerAuthTokenCache, writeOwnerAuthHandoff, writeOwnerAuthSessionCache } from "@/lib/auth/owner-auth-handoff";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import MobileLoginScreenTemplate from "./mobile-login-screen-template";

type OwnerLoginApiResponse = {
  success?: boolean;
  message?: string;
  session?: {
    accessToken: string;
    refreshToken: string;
  };
};

const SAVED_EMAIL_KEY = "petmanager.savedEmail";
const FAILED_LOGIN_STATE_PREFIX = "petmanager.failedLogin";
const FAILED_LOGIN_LIMIT = 5;
const STORAGE_HEALTH_CHECK_KEY = "petmanager.storageHealthCheck";
const OVERSIZED_PREVIEW_STORAGE_KEYS = ["petmanager.ownerWeb.shopProfileImages", "petmanager.ownerWeb.shopProfileImage"];
const STORAGE_WARNING_USAGE_RATIO = 0.8;

type FailedLoginState = {
  count: number;
};

function getFailedLoginStateKey(email: string) {
  return `${FAILED_LOGIN_STATE_PREFIX}:${email.trim().toLowerCase() || "unknown"}`;
}

async function reportStoragePressure(email: string, payload: { reason: string; usage?: number | null; quota?: number | null; usageRatio?: number | null }) {
  try {
    await fetch("/api/auth/storage-health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        email,
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

async function makeRoomForAuthStorage(email: string) {
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
        await reportStoragePressure(email, {
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
      await reportStoragePressure(email, {
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

function readFailedLoginState(email: string): FailedLoginState {
  if (typeof window === "undefined") {
    return { count: 0 };
  }

  try {
    const raw = window.localStorage.getItem(getFailedLoginStateKey(email));
    if (!raw) return { count: 0 };

    const parsed = JSON.parse(raw) as Partial<FailedLoginState> & { lockedUntil?: unknown };
    if (parsed.lockedUntil) {
      window.localStorage.removeItem(getFailedLoginStateKey(email));
      return { count: 0 };
    }

    const count = typeof parsed.count === "number" && Number.isFinite(parsed.count) ? parsed.count : 0;
    return { count };
  } catch {
    return { count: 0 };
  }
}

function writeFailedLoginState(email: string, state: FailedLoginState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getFailedLoginStateKey(email), JSON.stringify(state));
}

function clearFailedLoginState(email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getFailedLoginStateKey(email));
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

function isInvalidCredentialMessage(message?: string) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("invalid login credentials") ||
    normalized.includes("이메일") ||
    normalized.includes("비밀번호")
  );
}

function getRateLimitMessage() {
  return "로그인 요청이 잠시 제한되었어요. 10분 뒤 다시 시도하거나 아래의 비밀번호 찾기로 재설정해 주세요.";
}

function recordFailedLoginAttempt(email: string) {
  const current = readFailedLoginState(email);
  const nextState = { count: Math.min(current.count + 1, FAILED_LOGIN_LIMIT) };
  writeFailedLoginState(email, nextState);
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
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [showDevOwnerHelper, setShowDevOwnerHelper] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingDevOwner, setCreatingDevOwner] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    if (nextPath.startsWith("/")) {
      router.prefetch(nextPath as Route);
    }
  }, [nextPath, router]);

  useEffect(() => {
    setShowDevOwnerHelper(getSupabaseRuntimeStage() !== "production");

    const savedEmail = window.localStorage.getItem(SAVED_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  const handleLogin = async (credentials?: { email: string; password: string }) => {
    const currentEmail = (credentials?.email ?? email).trim().toLowerCase();
    const currentPassword = credentials?.password ?? password;

    if (currentEmail !== email) {
      setEmail(currentEmail);
    }
    if (currentPassword !== password) {
      setPassword(currentPassword);
    }

    if (!currentEmail || !currentPassword) {
      setMessage("이메일과 비밀번호를 입력해 주세요.");
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
        body: JSON.stringify({ email: currentEmail, password: currentPassword }),
      });
      const result = (await response.json().catch(() => ({
        message: "로그인 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
      }))) as OwnerLoginApiResponse;

      if (!response.ok || !result.success) {
        const nextMessage = result.message ?? "이메일 또는 비밀번호를 다시 확인해 주세요.";

        if (isRateLimitMessage(nextMessage)) {
          setMessage(getRateLimitMessage());
          return;
        }

        if (isInvalidCredentialMessage(nextMessage)) {
          const failedState = recordFailedLoginAttempt(currentEmail);
          const remainingAttempts = Math.max(1, FAILED_LOGIN_LIMIT - failedState.count);
          setMessage(
            failedState.count >= FAILED_LOGIN_LIMIT
              ? "이메일 또는 비밀번호를 다시 확인해 주세요. 계속 안 되면 비밀번호 찾기로 재설정해 주세요."
              : `이메일 또는 비밀번호를 다시 확인해 주세요. ${remainingAttempts}회 더 틀리면 비밀번호 찾기를 권장해 드릴게요.`,
          );
          return;
        }

        setMessage(nextMessage);
        return;
      }

      clearFailedLoginState(currentEmail);

      const authenticatedSession = result.session;
      if (authenticatedSession?.accessToken && authenticatedSession.refreshToken) {
        clearOwnerAuthTokenCache();
        writeOwnerAuthHandoff(authenticatedSession);
        writeOwnerAuthSessionCache(authenticatedSession);
        void makeRoomForAuthStorage(currentEmail);

        if (supabase) {
          void (async () => {
            try {
              const { error } = await supabase.auth.setSession({
                access_token: authenticatedSession.accessToken,
                refresh_token: authenticatedSession.refreshToken,
              });
              if (error) {
                console.warn("[auth/login] browser Supabase session persistence failed", error.message);
              }
            } catch (error) {
              console.warn("[auth/login] browser Supabase session persistence failed", error);
            }
          })();
        }
      }

      try {
        if (rememberEmail && currentEmail) {
          window.localStorage.setItem(SAVED_EMAIL_KEY, currentEmail);
        } else {
          window.localStorage.removeItem(SAVED_EMAIL_KEY);
        }
      } catch {
        // Remembering the login id is optional and must not block login.
      }

      if (nextPath.startsWith("/")) {
        router.replace(nextPath as Route);
      } else {
        window.location.assign(nextPath);
      }
    } catch {
      setMessage("로그인 요청 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
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
      const result = (await response.json()) as { email?: string; password?: string | null; message?: string };

      if (!response.ok || !result.email) {
        setMessage(result.message ?? "개발용 테스트 계정을 만들지 못했어요.");
        return;
      }

      setEmail(result.email);
      if (result.password) {
        setPassword(result.password);
      }
      setRememberEmail(true);
      window.localStorage.setItem(SAVED_EMAIL_KEY, result.email);
      setMessage(result.message ?? "개발용 테스트 계정을 준비했어요. 바로 로그인해 보세요.");
    } finally {
      setCreatingDevOwner(false);
    }
  };

  return (
    <div>
      <MobileLoginScreenTemplate
        email={email}
        password={password}
        rememberEmail={rememberEmail}
        loading={loading}
        message={message}
        nextPath={nextPath}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onRememberEmailChange={setRememberEmail}
        onLogin={handleLogin}
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
              disabled={creatingDevOwner || loading}
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
