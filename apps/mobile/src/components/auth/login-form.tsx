"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { readSocialLoginAvailability, SOCIAL_LOGIN_PROVIDERS, SocialLoginFailure, type SocialLoginProvider } from "@petmanager/shared/lib/owner-social-login";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
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
import { beginMobileSocialAttempt, cancelMobileSocialAttempt, consumeMobileSocialReturn } from "@/lib/auth/mobile-social-login-attempt";
import { finishMobileSocialLogin, getSocialAttemptStorage, hasNativeSocialLogin, openMobileSocialLogin, socialLoginMessages } from "@/lib/auth/mobile-social-login";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import MobileLoginScreenTemplate from "./mobile-login-screen-template";
import SocialProviderLogo from "./social-provider-logo";

const SAVED_EMAIL_KEY = "petmanager.savedOwnerEmail";
const SOCIAL_BUTTON_STYLE: Record<SocialLoginProvider, string> = {
  naver: "border-[#03c75a] bg-[#03c75a] text-white hover:bg-[#02b350]",
  kakao: "border-[#fee500] bg-[#fee500] text-[#191919] hover:bg-[#f5dc00]",
  google: "border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8fafd]",
};

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
  const [socialPending, setSocialPending] = useState<SocialLoginProvider | null>(null);
  const [returning, setReturning] = useState(false);
  const [browserOpened, setBrowserOpened] = useState(false);
  const socialStarting = useRef(false);
  const loginInFlight = useRef(false);

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(SAVED_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  const completeNativeReturn = useEffectEvent(async (url: string) => {
    if (loginInFlight.current) return;
    let result: ReturnType<typeof consumeMobileSocialReturn>;
    try { result = consumeMobileSocialReturn(url, getSocialAttemptStorage()); }
    catch { return; }
    if (!result) return;
    setBrowserOpened(false);
    if (result.error) {
      setMessage(socialLoginMessages[result.error]);
      return;
    }
    loginInFlight.current = true;
    setReturning(true);
    setMessage(null);
    try {
      await finishMobileSocialLogin(result.code);
      router.replace(result.nextPath as never);
    } catch (error) {
      setMessage(socialLoginMessages[error instanceof SocialLoginFailure ? error.reason : "social-failed"]);
    } finally {
      loginInFlight.current = false;
      setReturning(false);
    }
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !hasNativeSocialLogin()) return;
    let active = true;
    const listener = App.addListener("appUrlOpen", ({ url }) => {
      if (active) void completeNativeReturn(url);
    });
    void listener.then(() => App.getLaunchUrl()).then((launch) => {
      if (active && launch?.url) void completeNativeReturn(launch.url);
    }).catch(() => undefined);
    return () => {
      active = false;
      void listener.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, []);

  const startSocialLogin = async (id: SocialLoginProvider) => {
    if (loginInFlight.current || socialStarting.current || resending) return;
    const native = Capacitor.isNativePlatform();
    if (native && !hasNativeSocialLogin()) {
      setMessage("간편 로그인을 사용하려면 최신 앱이 필요합니다. 이메일로 로그인해 주세요.");
      return;
    }
    if (!supabaseReady || !supabase) {
      setMessage(socialLoginMessages["social-failed"]);
      return;
    }

    const provider = SOCIAL_LOGIN_PROVIDERS.find((item) => item.id === id)!;
    socialStarting.current = true;
    setSocialPending(id);
    setBrowserOpened(false);
    setMessage(null);
    setCanResendConfirmation(false);
    let storage: Storage | undefined;
    try {
      storage = getSocialAttemptStorage();
      cancelMobileSocialAttempt(storage);
      const availability = await readSocialLoginAvailability();
      if (!availability[id]) {
        setMessage(`${provider.label} 로그인은 현재 준비 중입니다. 이메일로 로그인해 주세요.`);
        return;
      }
      const redirectTo = beginMobileSocialAttempt(storage, safeNextPath, native ? undefined : window.location.origin);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider.provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw new Error("Social login could not start");
      setBrowserOpened(native);
      await openMobileSocialLogin(data.url);
    } catch {
      if (storage) cancelMobileSocialAttempt(storage);
      setBrowserOpened(false);
      setMessage(socialLoginMessages["social-failed"]);
    } finally {
      socialStarting.current = false;
      setSocialPending(null);
    }
  };

  const handleLogin = async () => {
    if (loginInFlight.current || socialStarting.current || resending) return;
    const normalizedEmail = normalizeOwnerEmail(email);
    if (!isValidOwnerEmail(normalizedEmail) || !password) {
      setMessage("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    if (!supabaseReady || !supabase) {
      setMessage("로그인 환경을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    loginInFlight.current = true;
    try { cancelMobileSocialAttempt(getSocialAttemptStorage()); } catch { /* Email login can proceed without social storage. */ }
    setBrowserOpened(false);
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
      loginInFlight.current = false;
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    if (loginInFlight.current || socialStarting.current) return;
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
      loginDisabled={socialPending !== null || returning}
      message={message}
      nextPath={safeNextPath}
      canResendConfirmation={canResendConfirmation}
      resendingConfirmation={resending}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onRememberEmailChange={setRememberEmail}
      onLogin={() => void handleLogin()}
      onResendConfirmation={() => void resendConfirmation()}
      socialLogin={
        <div className="mt-2 [@media(max-height:700px)]:mt-1">
          <div className="mb-1 flex items-center gap-3 text-[12px] font-normal leading-[18px] text-[#64748b]">
            <span className="h-px flex-1 bg-[#e8edf3]" aria-hidden="true" />
            간편 로그인
            <span className="h-px flex-1 bg-[#e8edf3]" aria-hidden="true" />
          </div>
          <div className="grid gap-1.5 [@media(max-height:700px)]:gap-1" aria-label="소셜 로그인" role="group">
            {SOCIAL_LOGIN_PROVIDERS.map(({ id, label }) => (
              <button key={id} type="button" data-testid={`social-login-${id}`} disabled={loading || resending || socialPending !== null || returning}
                onClick={() => void startSocialLogin(id)} aria-busy={socialPending === id}
                aria-label={socialPending === id ? `${label} 로그인 연결 중` : `${label}로 로그인`}
                className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] border px-3 py-1 text-[16px] font-medium leading-6 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-60 ${SOCIAL_BUTTON_STYLE[id]}`}>
                <SocialProviderLogo provider={id} />
                <span className="text-center">{socialPending === id ? `${label} 연결 중…` : `${label}로 로그인`}</span>
              </button>
            ))}
          </div>
          {browserOpened || returning ? <p role="status" className="mt-2 text-center text-[13px] text-[#64748b]">{returning ? "로그인 정보를 확인하는 중입니다." : "브라우저에서 로그인을 마쳐 주세요."}</p> : null}
        </div>
      }
    />
  );
}
