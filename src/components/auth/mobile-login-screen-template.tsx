"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { ServiceBrand } from "@/components/brand/service-brand";
import { PUBLIC_LEGAL_URLS } from "@/lib/legal/public-legal-links";

type Props = {
  email: string;
  password: string;
  rememberEmail: boolean;
  loading: boolean;
  message: string | null;
  nextPath: string;
  canResendConfirmation: boolean;
  resendingConfirmation: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberEmailChange: (checked: boolean) => void;
  onLogin: () => void;
  onResendConfirmation: () => void;
};

export default function MobileLoginScreenTemplate({
  email,
  password,
  rememberEmail,
  loading,
  message,
  nextPath,
  canResendConfirmation,
  resendingConfirmation,
  onEmailChange,
  onPasswordChange,
  onRememberEmailChange,
  onLogin,
  onResendConfirmation,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const helperLinks = [
    { href: "/login/find-email", label: "이메일 찾기" },
    { href: "/login/reset", label: "비밀번호 재설정" },
    { href: `/signup?next=${encodeURIComponent(nextPath)}`, label: "회원가입" },
  ];

  return (
    <main className="min-h-[100dvh] w-full bg-white text-[#0f172a]">
      <form
        className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col justify-center bg-white px-7 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-[calc(env(safe-area-inset-top)+32px)] max-[359px]:px-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading) onLogin();
        }}
      >
        <ServiceBrand size="large" className="mb-8 justify-center" />

        <label className="mb-4 block">
          <span className="auth-type-label mb-2 block text-[#475569]">이메일</span>
          <input
            data-testid="owner-login-email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="이메일"
            autoComplete="email"
            inputMode="email"
            className="auth-type-control min-h-[52px] w-full rounded-[12px] border border-[#e8edf3] bg-white px-4 text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
          />
        </label>

        <label className="mb-2 block">
          <span className="auth-type-label mb-2 block text-[#475569]">비밀번호</span>
          <span className="relative block">
          <input
            data-testid="owner-login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
            className="auth-type-control min-h-[52px] w-full rounded-[12px] border border-[#e8edf3] bg-white px-4 pr-12 text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[#94a3b8]"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          </button>
          </span>
        </label>

        {message ? <p className="auth-type-helper mb-2 text-[#d34b4b]">{message}</p> : null}
        {canResendConfirmation ? (
          <button
            type="button"
            onClick={onResendConfirmation}
            disabled={resendingConfirmation || loading}
            className="auth-type-label mb-2 inline-flex min-h-11 items-center self-start text-[#2563eb] underline underline-offset-4 disabled:opacity-60"
          >
            {resendingConfirmation ? "인증 메일 재발송 중..." : "인증 메일 다시 받기"}
          </button>
        ) : null}

        <div className="mb-4 mt-3 flex items-center justify-between leading-normal">
          <label className="auth-type-helper flex min-h-11 items-center gap-2 text-[#64748b]">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(event) => onRememberEmailChange(event.target.checked)}
              className="h-4 w-4 accent-[#0f172a]"
            />
            <span>이메일 저장</span>
          </label>
        </div>

        <button
          data-testid="owner-login-submit"
          type="submit"
          disabled={loading}
          className="auth-type-control min-h-[56px] w-full rounded-[12px] border-0 bg-[#111a30] text-white transition-[filter] duration-150 hover:brightness-[1.08] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <div className="auth-type-helper mt-3 flex flex-wrap items-center justify-center gap-x-1 text-center text-[#64748b]">
          {helperLinks.map((link, index) => (
            <span key={`${link.href}-${link.label}`} className="contents">
              {index > 0 ? <span className="text-[#d5dce5]">|</span> : null}
              <Link href={link.href as never} replace className="inline-flex min-h-11 items-center px-1.5 text-[#64748b] hover:text-[#0f172a]">
                {link.label}
              </Link>
            </span>
          ))}
        </div>

        <div className="auth-type-helper mt-1 text-center text-[#64748b]">
          <a href={PUBLIC_LEGAL_URLS.privacy} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-[#64748b]">
            개인정보처리방침
          </a>
        </div>
      </form>
    </main>
  );
}
