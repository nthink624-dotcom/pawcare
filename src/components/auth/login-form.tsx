"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { MobileBackButton } from "@/components/ui/mobile-back-button";
import { findEmailWithKcpIdentityVerification } from "@/lib/auth/find-email-identity";
import { getSupabaseRuntimeStage } from "@/lib/env";
import {
  clearOwnerAuthHandoff,
  clearOwnerAuthTokenCache,
  writeOwnerAuthHandoff,
  writeOwnerAuthSessionCache,
} from "@/lib/auth/owner-auth-handoff";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import MobileLoginScreenTemplate from "./mobile-login-screen-template";

type OwnerLoginApiResponse = {
  success?: boolean;
  reason?: "email_not_registered" | "invalid_password";
  message?: string;
  session?: {
    accessToken: string;
    refreshToken: string;
  };
};

const SAVED_EMAIL_KEY = "petmanager.savedEmail";
const FAILED_LOGIN_STATE_PREFIX = "petmanager.failedLogin";
const FAILED_LOGIN_LIMIT = 5;
const BROWSER_SESSION_PERSIST_TIMEOUT_MS = 3000;
const STORAGE_HEALTH_CHECK_KEY = "petmanager.storageHealthCheck";
const OVERSIZED_PREVIEW_STORAGE_KEYS = ["petmanager.ownerWeb.shopProfileImages", "petmanager.ownerWeb.shopProfileImage"];
const STORAGE_WARNING_USAGE_RATIO = 0.8;

type FailedLoginState = {
  count: number;
};

type FindEmailFlow =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "result"; email: string };

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
  const [findEmailFlow, setFindEmailFlow] = useState<FindEmailFlow>({ status: "idle" });

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

    const clearPreviousLogin = async () => {
      clearOwnerAuthHandoff();
      clearOwnerAuthTokenCache();
      if (supabase) {
        await supabase.auth.signOut({ scope: "local" });
      }
    };

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
        await clearPreviousLogin();

        if (isRateLimitMessage(nextMessage)) {
          setMessage(getRateLimitMessage());
          return;
        }

        if (result.reason === "email_not_registered") {
          setMessage("등록되지 않은 이메일입니다. 이메일을 확인하거나 회원가입해 주세요.");
          return;
        }

        if (result.reason === "invalid_password" || isInvalidCredentialMessage(nextMessage)) {
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
      if (!authenticatedSession?.accessToken || !authenticatedSession.refreshToken) {
        await clearPreviousLogin();
        setMessage("로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
        return;
      }

      clearOwnerAuthTokenCache();
      writeOwnerAuthHandoff(authenticatedSession);
      writeOwnerAuthSessionCache(authenticatedSession);
      await makeRoomForAuthStorage(currentEmail);

      if (supabase) {
        const sessionResult = await Promise.race([
          supabase.auth.setSession({
            access_token: authenticatedSession.accessToken,
            refresh_token: authenticatedSession.refreshToken,
          }),
          new Promise<null>((resolve) => {
            window.setTimeout(() => resolve(null), BROWSER_SESSION_PERSIST_TIMEOUT_MS);
          }),
        ]);
        if (sessionResult?.error) {
          await clearPreviousLogin();
          setMessage("로그인 상태를 저장하지 못했습니다. 다시 시도해 주세요.");
          return;
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
      await clearPreviousLogin().catch(() => undefined);
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

  const startFindEmail = async () => {
    setFindEmailFlow({ status: "preparing" });
    setMessage(null);

    try {
      const foundEmail = await findEmailWithKcpIdentityVerification();
      setFindEmailFlow({ status: "result", email: foundEmail });
    } catch (error) {
      setFindEmailFlow({ status: "idle" });
      setMessage(error instanceof Error ? error.message : "본인인증을 진행하는 중 문제가 발생했어요. 다시 시도해 주세요.");
    }
  };

  if (findEmailFlow.status === "preparing") {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-[#f1f3f7] px-5 py-8 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#111827] antialiased sm:px-6 sm:py-12">
        <section className="w-full max-w-[448px] rounded-[32px] bg-white px-8 py-16 text-center shadow-[0_24px_64px_rgba(15,23,42,0.1)]">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-[3px] border-[#dbe5f6] border-t-[#111a30]" aria-hidden="true" />
          <h1 className="mt-7 text-[22px] font-extrabold tracking-[-0.04em] text-[#101a31]">본인인증을 준비 중입니다.</h1>
          <p className="mt-3 break-keep text-[15px] leading-6 text-[#7184a6]">잠시만 기다리시면 KCP 본인인증 창이 열립니다.</p>
        </section>
      </main>
    );
  }

  if (findEmailFlow.status === "result") {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-[#f1f3f7] px-5 py-8 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#111827] antialiased sm:px-6 sm:py-12">
        <section className="w-full max-w-[448px] rounded-[32px] bg-white px-8 pb-11 pt-9 shadow-[0_24px_64px_rgba(15,23,42,0.1)]">
          <div className="relative flex h-10 items-center justify-center">
            <MobileBackButton
              onClick={() => setFindEmailFlow({ status: "idle" })}
              label="로그인으로 돌아가기"
              className="absolute left-0 h-10 w-10 border-0 bg-transparent text-[#111827] shadow-none hover:bg-[#f8fafc]"
            />
            <h1 className="text-[24px] font-extrabold leading-6 tracking-[-0.04em] text-[#101a31]">이메일 확인</h1>
          </div>

          <section className="pt-12">
            <h2 className="text-[21px] font-bold leading-8 tracking-[-0.03em] text-[#111827]">이메일을 확인했어요.</h2>
            <p className="mt-3 text-[15px] leading-6 text-[#7184a6]">본인인증 정보와 연결된 로그인 이메일입니다.</p>
            <div className="mt-8 rounded-[16px] border border-[#dbe5f6] bg-[#f7faff] px-5 py-5">
              <p className="text-[13px] font-semibold text-[#7184a6]">로그인 이메일</p>
              <p className="mt-2 break-all text-[21px] font-bold tracking-[-0.03em] text-[#111827]">{findEmailFlow.email}</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/login/reset?email=${encodeURIComponent(findEmailFlow.email)}`)}
              className="mt-4 flex h-[58px] w-full items-center justify-center rounded-[12px] border border-[#dbe5f6] bg-white text-[15px] font-bold text-[#111a30] transition hover:bg-[#f1f5fb]"
            >
              비밀번호 찾기로 이동
            </button>
            <button
              type="button"
              onClick={() => setFindEmailFlow({ status: "idle" })}
              className="mt-4 flex h-[62px] w-full items-center justify-center rounded-[14px] bg-[#111a30] text-[17px] font-bold text-white transition-[background-color,transform] hover:bg-[#17233d] active:translate-y-px"
            >
              로그인으로 이동
            </button>
          </section>
        </section>
      </main>
    );
  }

  return (
    <div>
      <MobileLoginScreenTemplate
        email={email}
        password={password}
        rememberEmail={rememberEmail}
        loading={loading}
        message={message}
        nextPath={nextPath}
        onEmailChange={(value) => {
          setEmail(value);
        }}
        onPasswordChange={setPassword}
        onRememberEmailChange={setRememberEmail}
        onLogin={handleLogin}
        onFindEmail={() => void startFindEmail()}
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
