"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { SocialProvider } from "@/lib/auth/social-auth";

function GoogleSymbol() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 3-4.32 3-7.3z"
      />
      <path
        fill="#34A853"
        d="M10 20c2.7 0 4.97-.89 6.63-2.42l-3.24-2.5c-.9.6-2.06.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H1.06v2.59A10 10 0 0 0 10 20z"
      />
      <path
        fill="#FBBC05"
        d="M4.41 11.92a6 6 0 0 1 0-3.84V5.49H1.06a10 10 0 0 0 0 9.02l3.35-2.6z"
      />
      <path
        fill="#EA4335"
        d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.96 9.96 0 0 0 10 0a10 10 0 0 0-8.94 5.49l3.35 2.6C5.2 5.72 7.4 3.96 10 3.96z"
      />
    </svg>
  );
}

function KakaoSymbol() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#191600"
        d="M10 1.5C4.75 1.5.5 4.9.5 9.1c0 2.68 1.76 5.03 4.4 6.38-.19.71-.71 2.63-.81 3.04-.13.51.19.5.4.36.16-.11 2.56-1.74 3.6-2.45.62.09 1.26.14 1.91.14 5.25 0 9.5-3.4 9.5-7.6S15.25 1.5 10 1.5z"
      />
    </svg>
  );
}

function NaverSymbol() {
  return (
    <Image
      src="/images/auth/naver-symbol.png"
      alt=""
      width={20}
      height={20}
      className="h-5 w-5 object-contain"
    />
  );
}

type Props = {
  loginId: string;
  password: string;
  rememberLoginId: boolean;
  loading: boolean;
  socialLoading: SocialProvider | null;
  socialDisabled?: boolean;
  message: string | null;
  nextPath: string;
  heading?: string;
  descriptionLines?: string[];
  loginIdPlaceholder?: string;
  passwordPlaceholder?: string;
  rememberLoginIdLabel?: string;
  loginButtonLabel?: string;
  loginButtonLoadingLabel?: string;
  socialProviders?: SocialProvider[];
  socialLabels?: Partial<
    Record<
      SocialProvider,
      {
        idle: string;
        loading: string;
      }
    >
  >;
  helperLinks?: Array<{ href: string; label: string }>;
  onLoginIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberLoginIdChange: (checked: boolean) => void;
  onLogin: (credentials?: { loginId: string; password: string }) => void;
  onSocialLogin: (provider: SocialProvider) => void;
};

export default function MobileLoginScreenTemplate({
  loginId,
  password,
  rememberLoginId,
  loading,
  socialLoading,
  socialDisabled = false,
  message,
  nextPath,
  heading = "로그인",
  descriptionLines = ["아이디와 비밀번호 입력이 귀찮으신가요?", "1초 회원가입으로 입력 없이 간편하게 로그인 하세요."],
  loginIdPlaceholder = "아이디",
  passwordPlaceholder = "비밀번호",
  rememberLoginIdLabel = "아이디 저장",
  loginButtonLabel = "로그인",
  loginButtonLoadingLabel = "로그인 중...",
  socialProviders = ["kakao", "naver", "google"],
  socialLabels,
  helperLinks,
  onLoginIdChange,
  onPasswordChange,
  onRememberLoginIdChange,
  onLogin,
  onSocialLogin,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const loginIdInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const resolvedSocialLabels = {
    kakao: {
      idle: "카카오 1초 로그인/회원가입",
      loading: "카카오 로그인 중...",
    },
    naver: {
      idle: "네이버 계정으로 계속하기",
      loading: "네이버 로그인 중...",
    },
    google: {
      idle: "Google 계정으로 계속하기",
      loading: "구글 로그인 중...",
    },
    ...socialLabels,
  };

  const resolvedHelperLinks = helperLinks ?? [
    { href: "/login/find-id", label: "아이디 찾기" },
    { href: "/login/reset", label: "비밀번호 찾기" },
    { href: `/signup?next=${encodeURIComponent(nextPath)}`, label: "회원가입" },
  ];

  const readCurrentCredentials = useCallback(() => ({
    loginId: loginIdInputRef.current?.value ?? loginId,
    password: passwordInputRef.current?.value ?? password,
  }), [loginId, password]);

  const syncBrowserFilledCredentials = useCallback(() => {
    const current = readCurrentCredentials();
    if (current.loginId !== loginId) {
      onLoginIdChange(current.loginId);
    }
    if (current.password !== password) {
      onPasswordChange(current.password);
    }
    return current;
  }, [loginId, onLoginIdChange, onPasswordChange, password, readCurrentCredentials]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncBrowserFilledCredentials);
    const timers = [
      window.setTimeout(syncBrowserFilledCredentials, 150),
      window.setTimeout(syncBrowserFilledCredentials, 600),
    ];

    window.addEventListener("focus", syncBrowserFilledCredentials);
    window.addEventListener("pageshow", syncBrowserFilledCredentials);

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("focus", syncBrowserFilledCredentials);
      window.removeEventListener("pageshow", syncBrowserFilledCredentials);
    };
  }, [syncBrowserFilledCredentials]);

  return (
    <main className="flex min-h-screen w-screen items-center justify-center bg-[#eef0f3] py-6 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#0f172a] antialiased">
      <section className="w-full max-w-[390px] overflow-hidden rounded-[28px] bg-white px-7 pb-8 pt-11 shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
        <h1 className="mb-2 text-center text-xl font-extrabold leading-[normal] tracking-[-0.3px] text-[#0f172a]">{heading}</h1>
        <p className="mb-6 text-center text-[13px] leading-[1.55] text-[#94a3b8]">
          {descriptionLines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              {index < descriptionLines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>

        {socialProviders.includes("kakao") ? (
          <SocialButton
            provider="kakao"
            onClick={() => onSocialLogin("kakao")}
            disabled={loading || socialLoading !== null || socialDisabled}
            label={socialLoading === "kakao" ? resolvedSocialLabels.kakao.loading : resolvedSocialLabels.kakao.idle}
            icon={<KakaoSymbol />}
          />
        ) : null}

        <Divider>또는 아이디로 로그인</Divider>

        <div className="mb-2">
          <input
            data-testid="owner-login-id"
            ref={loginIdInputRef}
            type="text"
            value={loginId}
            onChange={(event) => onLoginIdChange(event.target.value)}
            onBlur={syncBrowserFilledCredentials}
            placeholder={loginIdPlaceholder}
            autoComplete="username"
            className="h-12 w-full rounded-[11px] border border-[#e5e9f0] bg-[#f8fafc] px-4 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#0f172a] focus:bg-white"
          />
        </div>

        <div className="relative mb-2">
          <input
            data-testid="owner-login-password"
            ref={passwordInputRef}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            onBlur={syncBrowserFilledCredentials}
            placeholder={passwordPlaceholder}
            autoComplete="current-password"
            className="h-12 w-full rounded-[11px] border border-[#e5e9f0] bg-[#f8fafc] px-4 pr-12 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#0f172a] focus:bg-white"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center text-[#94a3b8]"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          </button>
        </div>

        {message ? <p className="mb-2 text-[12px] font-medium leading-5 text-[#d34b4b]">{message}</p> : null}

        <div className="mb-4 mt-3 flex items-center justify-between leading-[normal]">
          <label className="flex items-center gap-[7px] text-[13px] text-[#64748b]">
            <input
              type="checkbox"
              checked={rememberLoginId}
              onChange={(event) => onRememberLoginIdChange(event.target.checked)}
              className="h-4 w-4 accent-[#0f172a]"
            />
            <span>{rememberLoginIdLabel}</span>
          </label>
        </div>

        <button
          data-testid="owner-login-submit"
          type="button"
          onClick={() => onLogin(syncBrowserFilledCredentials())}
          disabled={loading}
          className="h-[50px] w-full rounded-[13px] border-0 bg-[#0f172a] text-[15px] font-bold text-white transition-[filter] duration-150 hover:brightness-[1.12] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? loginButtonLoadingLabel : loginButtonLabel}
        </button>

        <div className="mb-1 mt-4 flex items-center justify-center gap-2.5 text-[12.5px] leading-[normal] text-[#94a3b8]">
          {resolvedHelperLinks.map((link, index) => (
            <span key={`${link.href}-${link.label}`} className="contents">
              {index > 0 ? <span className="text-[#e2e8f0]">|</span> : null}
              <Link href={link.href as never} replace className="text-[#94a3b8] hover:text-[#64748b]">
                {link.label}
              </Link>
            </span>
          ))}
        </div>

        <Divider>또는</Divider>

        <div className="flex flex-col gap-2">
          {socialProviders.includes("naver") ? (
            <SocialButton
              provider="naver"
              onClick={() => onSocialLogin("naver")}
              disabled={loading || socialLoading !== null || socialDisabled}
              label={socialLoading === "naver" ? resolvedSocialLabels.naver.loading : resolvedSocialLabels.naver.idle}
              icon={<NaverSymbol />}
            />
          ) : null}

          {socialProviders.includes("google") ? (
            <SocialButton
              provider="google"
              onClick={() => onSocialLogin("google")}
              disabled={loading || socialLoading !== null || socialDisabled}
              label={socialLoading === "google" ? resolvedSocialLabels.google.loading : resolvedSocialLabels.google.idle}
              icon={<GoogleSymbol />}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs leading-[normal] text-[#94a3b8] before:h-px before:flex-1 before:bg-[#e5e9f0] after:h-px after:flex-1 after:bg-[#e5e9f0]">
      {children}
    </div>
  );
}

function SocialButton({
  provider,
  label,
  icon,
  disabled,
  onClick,
}: {
  provider: "kakao" | "naver" | "google";
  label: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  const tone =
    provider === "kakao"
      ? "border-transparent bg-[#FEE500] text-[#191600]"
      : provider === "naver"
        ? "border-transparent bg-[#03C75A] text-white"
        : "border-[#e2e8f0] bg-white text-[#1f2937]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex h-[50px] w-full items-center rounded-[13px] border px-[18px] text-[15px] font-semibold transition-[filter,transform] duration-150 hover:-translate-y-px hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="mr-5 min-w-0 flex-1 truncate text-center">{label}</span>
    </button>
  );
}
