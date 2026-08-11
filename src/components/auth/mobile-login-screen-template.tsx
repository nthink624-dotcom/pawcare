"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  email: string;
  password: string;
  rememberEmail: boolean;
  loading: boolean;
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
  message,
  nextPath,
  heading = "로그인",
  descriptionLines = ["이메일과 비밀번호를 입력해 로그인하세요.", "로그인 상태는 안전하게 유지됩니다."],
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
    <main className="flex min-h-screen w-screen items-center justify-center bg-[#f1f3f7] px-5 py-8 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#0f172a] antialiased sm:px-6 sm:py-12">
      <section className="w-full max-w-[448px] overflow-hidden rounded-[32px] bg-white px-8 pb-11 pt-12 shadow-[0_24px_64px_rgba(15,23,42,0.1)]">
        <h1 className="mb-3 text-center text-[24px] font-extrabold leading-tight tracking-[-0.04em] text-[#101a31]">{heading}</h1>
        <p className="mb-8 text-center text-[14px] leading-6 tracking-[-0.015em] text-[#9aadd0]">
          {descriptionLines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              {index < descriptionLines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>

        <div className="mb-[10px]">
          <input
            data-testid="owner-login-email"
            ref={emailInputRef}
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            onBlur={syncBrowserFilledCredentials}
            placeholder={emailPlaceholder}
            autoComplete="email"
            className="h-[58px] w-full rounded-[12px] border border-[#dbe5f6] bg-[#eaf1ff] px-4 text-[17px] font-medium text-[#111827] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#a3b4d0] focus:border-[#15213b] focus:bg-[#eef4ff] focus:shadow-[0_0_0_3px_rgba(21,33,59,0.08)]"
          />
        </div>

        <div className="relative mb-[10px]">
          <input
            data-testid="owner-login-password"
            ref={passwordInputRef}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            onBlur={syncBrowserFilledCredentials}
            placeholder={passwordPlaceholder}
            autoComplete="current-password"
            className="h-[58px] w-full rounded-[12px] border border-[#dbe5f6] bg-[#eaf1ff] px-4 pr-12 text-[17px] font-medium text-[#111827] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#a3b4d0] focus:border-[#15213b] focus:bg-[#eef4ff] focus:shadow-[0_0_0_3px_rgba(21,33,59,0.08)]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center p-2 text-[#98aac7] transition hover:text-[#617492]"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          </button>
        </div>

        {message ? <p className="mb-2 text-[12px] font-medium leading-5 text-[#d34b4b]">{message}</p> : null}
        {emailConfirmationAction ? (
          <button
            type="button"
            onClick={emailConfirmationAction.onClick}
            disabled={emailConfirmationAction.loading}
            className="mb-2 text-left text-[12px] font-semibold text-[#334155] underline underline-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {emailConfirmationAction.loading ? emailConfirmationAction.loadingLabel : emailConfirmationAction.label}
          </button>
        ) : null}

        <div className="mb-6 mt-5 flex items-center justify-between leading-[normal]">
          <label className="flex items-center gap-2 text-[14px] text-[#7184a6]">
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
          disabled={loading}
          className="h-[62px] w-full rounded-[14px] border-0 bg-[#111a30] text-[17px] font-bold tracking-[-0.02em] text-white transition-[background-color,transform] duration-150 hover:bg-[#17233d] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? loginButtonLoadingLabel : loginButtonLabel}
        </button>

        <div className="mb-1 mt-6 flex items-center justify-center gap-3 text-[14px] leading-[normal] text-[#9aadd0]">
          {resolvedHelperLinks.map((link, index) => (
            <span key={`${link.href}-${link.label}`} className="contents">
              {index > 0 ? <span className="text-[#d8e1ef]">|</span> : null}
              {link.onClick ? (
                <button type="button" onClick={link.onClick} className="text-[#9aadd0] hover:text-[#617492]">
                  {link.label}
                </button>
              ) : (
                <Link href={link.href as never} replace className="text-[#9aadd0] hover:text-[#617492]">
                  {link.label}
                </Link>
              )}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
