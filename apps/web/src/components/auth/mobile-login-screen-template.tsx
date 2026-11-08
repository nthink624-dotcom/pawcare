"use client";

import Link from "next/link";
import { SignInCard2 } from "@/components/ui/sign-in-card-2";
import { Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  email: string;
  password: string;
  rememberEmail: boolean;
  loading: boolean;
  loginDisabled?: boolean;
  socialLogin?: ReactNode;
  message: string | null;
  nextPath: string;
  heading?: string;
  descriptionLines?: string[];
  emailPlaceholder?: string;
  passwordPlaceholder?: string;
  rememberEmailLabel?: string;
  loginButtonLabel?: string;
  loginButtonLoadingLabel?: string;
  helperLinks?: Array<{ href: string; label: string }>;
  onFindEmail?: () => void;
  emailConfirmationAction?: {
    label: string;
    loadingLabel: string;
    loading: boolean;
    onClick: () => void;
  } | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberEmailChange: (checked: boolean) => void;
  onLogin: (credentials?: { email: string; password: string }) => void;
};

export default function MobileLoginScreenTemplate({
  email,
  password,
  rememberEmail,
  loading,
  loginDisabled = false,
  socialLogin,
  message,
  nextPath,
  heading = "로그인",
  descriptionLines = ["이메일과 비밀번호를 입력해 로그인하세요."],
  emailPlaceholder = "이메일",
  passwordPlaceholder = "비밀번호",
  rememberEmailLabel = "이메일 저장",
  loginButtonLabel = "로그인",
  loginButtonLoadingLabel = "로그인 중...",
  helperLinks,
  onFindEmail,
  emailConfirmationAction = null,
  onEmailChange,
  onPasswordChange,
  onRememberEmailChange,
  onLogin,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const resolvedHelperLinks = helperLinks ?? [
    { href: "/login/find-email", label: "이메일 찾기", onClick: onFindEmail },
    { href: "/login/reset", label: "비밀번호 찾기" },
    { href: `/signup?next=${encodeURIComponent(nextPath)}`, label: "회원가입" },
  ];

  const readCurrentCredentials = useCallback(() => ({
    email: emailInputRef.current?.value ?? email,
    password: passwordInputRef.current?.value ?? password,
  }), [email, password]);

  const syncBrowserFilledCredentials = useCallback(() => {
    const current = readCurrentCredentials();
    if (current.email !== email) {
      onEmailChange(current.email);
    }
    if (current.password !== password) {
      onPasswordChange(current.password);
    }
    return current;
  }, [email, onEmailChange, onPasswordChange, password, readCurrentCredentials]);

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
    <main className="flex min-h-[100svh] w-full items-center justify-center bg-[#f1f3f7] px-4 py-4 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#0f172a] antialiased sm:px-6 [@media(max-height:700px)]:py-2">
      <SignInCard2 className="w-full max-w-[448px] overflow-hidden rounded-[32px] bg-white px-6 py-5 shadow-[0_24px_64px_rgba(15,23,42,0.1)] [@media(max-height:700px)]:py-3">
        <h1 className="mb-2 text-center text-[24px] font-extrabold leading-tight tracking-[-0.04em] text-[#101a31]">{heading}</h1>
        <p className="mb-4 text-center text-[14px] leading-5 tracking-[-0.015em] text-[#9aadd0] [@media(max-height:700px)]:hidden">
          {descriptionLines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              {index < descriptionLines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>

        <div className="mb-2">
          <input
            data-testid="owner-login-email"
            ref={emailInputRef}
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            onBlur={syncBrowserFilledCredentials}
            placeholder={emailPlaceholder}
            autoComplete="email"
            className="h-12 w-full rounded-[12px] border border-[#dbe5f6] bg-[#eaf1ff] px-4 text-[17px] font-medium text-[#111827] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#a3b4d0] focus:border-[#15213b] focus:bg-[#eef4ff] focus:shadow-[0_0_0_3px_rgba(21,33,59,0.08)] [@media(max-height:700px)]:h-11"
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
            className="h-12 w-full rounded-[12px] border border-[#dbe5f6] bg-[#eaf1ff] px-4 pr-12 text-[17px] font-medium text-[#111827] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#a3b4d0] focus:border-[#15213b] focus:bg-[#eef4ff] focus:shadow-[0_0_0_3px_rgba(21,33,59,0.08)] [@media(max-height:700px)]:h-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-[#98aac7] transition hover:text-[#617492]"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          </button>
        </div>

        {message ? <p role="alert" className="mb-2 text-[13px] font-medium leading-5 text-[#d34b4b]">{message}</p> : null}
        {emailConfirmationAction ? (
          <button
            type="button"
            onClick={emailConfirmationAction.onClick}
            disabled={emailConfirmationAction.loading}
            className="mb-2 min-h-11 text-left text-[12px] font-semibold text-[#334155] underline underline-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {emailConfirmationAction.loading ? emailConfirmationAction.loadingLabel : emailConfirmationAction.label}
          </button>
        ) : null}

        <div className="mb-1 flex items-center justify-between leading-[normal]">
          <label className="flex min-h-11 items-center gap-2 text-[14px] text-[#7184a6]">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(event) => onRememberEmailChange(event.target.checked)}
              className="h-4 w-4 accent-[#111a30]"
            />
            <span>{rememberEmailLabel}</span>
          </label>
        </div>

        <button
          data-testid="owner-login-submit"
          type="button"
          onClick={() => onLogin(syncBrowserFilledCredentials())}
          disabled={loading || loginDisabled}
          className="h-[52px] w-full rounded-[14px] border-0 bg-[#111a30] text-[17px] font-bold tracking-[-0.02em] text-white transition-[background-color,transform] duration-150 hover:bg-[#17233d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 [@media(max-height:700px)]:h-11"
        >
          {loading ? loginButtonLoadingLabel : loginButtonLabel}
        </button>

        {socialLogin}

        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-[14px] leading-5 text-[#9aadd0] [@media(max-height:700px)]:mt-0">
          {resolvedHelperLinks.map((link, index) => (
            <span key={`${link.href}-${link.label}`} className="contents">
              {index > 0 ? <span className="text-[#d8e1ef]">|</span> : null}
              {link.onClick ? (
                <button type="button" onClick={link.onClick} className="inline-flex min-h-11 items-center whitespace-nowrap px-1 text-[#9aadd0] hover:text-[#617492]">
                  {link.label}
                </button>
              ) : (
                <Link href={link.href as never} replace className="inline-flex min-h-11 items-center whitespace-nowrap px-1 text-[#9aadd0] hover:text-[#617492]">
                  {link.label}
                </Link>
              )}
            </span>
          ))}
        </div>
      </SignInCard2>
    </main>
  );
}
