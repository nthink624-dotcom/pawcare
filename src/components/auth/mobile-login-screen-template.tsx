"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  loginId: string;
  password: string;
  rememberLoginId: boolean;
  loading: boolean;
  message: string | null;
  nextPath: string;
  heading?: string;
  descriptionLines?: string[];
  loginIdPlaceholder?: string;
  passwordPlaceholder?: string;
  rememberLoginIdLabel?: string;
  loginButtonLabel?: string;
  loginButtonLoadingLabel?: string;
  helperLinks?: Array<{ href: string; label: string }>;
  onLoginIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberLoginIdChange: (checked: boolean) => void;
  onLogin: (credentials?: { loginId: string; password: string }) => void;
};

export default function MobileLoginScreenTemplate({
  loginId,
  password,
  rememberLoginId,
  loading,
  message,
  nextPath,
  heading = "로그인",
  descriptionLines = ["아이디와 비밀번호를 입력해 로그인하세요.", "로그인 상태는 안전하게 유지됩니다."],
  loginIdPlaceholder = "아이디",
  passwordPlaceholder = "비밀번호",
  rememberLoginIdLabel = "아이디 저장",
  loginButtonLabel = "로그인",
  loginButtonLoadingLabel = "로그인 중...",
  helperLinks,
  onLoginIdChange,
  onPasswordChange,
  onRememberLoginIdChange,
  onLogin,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const loginIdInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
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
    <main className="flex min-h-screen w-screen items-center justify-center bg-[#eef0f3] px-4 py-4 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#0f172a] antialiased sm:py-6">
      <section className="w-full max-w-[390px] overflow-hidden rounded-[28px] bg-white px-7 pb-8 pt-10 shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
        <h1 className="mb-[10px] text-center text-xl font-extrabold leading-[normal] tracking-[-0.3px] text-[#0f172a]">{heading}</h1>
        <p className="mb-7 text-center text-[13px] leading-[1.55] text-[#94a3b8]">
          {descriptionLines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              {index < descriptionLines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>

        <div className="mb-[10px]">
          <input
            data-testid="owner-login-id"
            ref={loginIdInputRef}
            type="text"
            value={loginId}
            onChange={(event) => onLoginIdChange(event.target.value)}
            onBlur={syncBrowserFilledCredentials}
            placeholder={loginIdPlaceholder}
            autoComplete="username"
            className="h-[50px] w-full rounded-[11px] border border-[#e5e9f0] bg-[#f8fafc] px-4 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#0f172a] focus:bg-white"
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
            className="h-[50px] w-full rounded-[11px] border border-[#e5e9f0] bg-[#f8fafc] px-4 pr-12 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#0f172a] focus:bg-white"
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

        <div className="mb-5 mt-[14px] flex items-center justify-between leading-[normal]">
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
          className="h-[54px] w-full rounded-[13px] border-0 bg-[#0f172a] text-[15px] font-bold text-white transition-[filter] duration-150 hover:brightness-[1.12] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? loginButtonLoadingLabel : loginButtonLabel}
        </button>

        <div className="mb-2 mt-5 flex items-center justify-center gap-2.5 text-[12.5px] leading-[normal] text-[#94a3b8]">
          {resolvedHelperLinks.map((link, index) => (
            <span key={`${link.href}-${link.label}`} className="contents">
              {index > 0 ? <span className="text-[#e2e8f0]">|</span> : null}
              <Link href={link.href as never} replace className="text-[#94a3b8] hover:text-[#64748b]">
                {link.label}
              </Link>
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
