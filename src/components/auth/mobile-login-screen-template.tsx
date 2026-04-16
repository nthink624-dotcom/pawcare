"use client";

import Image from "next/image";
import Link from "next/link";

import type { SocialProvider } from "@/lib/auth/social-auth";

function GoogleSymbol() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="h-[22px] w-[22px]">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H1v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H1A9 9 0 0 0 0 9c0 1.45.35 2.82 1 4.05l2.97-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.33l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 1 4.95l2.97 2.33c.71-2.12 2.69-3.7 5.03-3.7Z"
      />
    </svg>
  );
}

type Props = {
  loginId: string;
  password: string;
  rememberLoginId: boolean;
  loading: boolean;
  socialLoading: SocialProvider | null;
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
  onLogin: () => void;
  onSocialLogin: (provider: SocialProvider) => void;
};

export default function MobileLoginScreenTemplate({
  loginId,
  password,
  rememberLoginId,
  loading,
  socialLoading,
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

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 pb-12 pt-10 text-[#111111]">
      <div className="text-center">
        <h1 className="text-[30px] font-extrabold tracking-[-0.05em] text-[#111111]">{heading}</h1>
        <p className="mt-4 text-[15px] leading-7 text-[#7b746b]">
          {descriptionLines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              {index < descriptionLines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      </div>

      {socialProviders.includes("kakao") ? (
        <button
          type="button"
          onClick={() => onSocialLogin("kakao")}
          disabled={loading || socialLoading !== null}
          className="mt-8 h-[48px] w-full rounded-[8px] bg-[#fee500] text-[#191600] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-full w-full items-center">
            <span className="relative h-full w-[56px] shrink-0">
              <Image
                src="/images/auth/kakao-symbol.png"
                alt=""
                width={22}
                height={22}
                className="absolute left-[17px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 object-contain"
              />
            </span>
            <span className="min-w-0 flex-1 -translate-x-[18px] text-center font-[Roboto,Arial,sans-serif] text-[14px] font-medium tracking-[0.25px]">
              {socialLoading === "kakao" ? resolvedSocialLabels.kakao.loading : resolvedSocialLabels.kakao.idle}
            </span>
          </span>
        </button>
      ) : null}

      <div className="mt-6 space-y-3">
        <input
          type="text"
          value={loginId}
          onChange={(event) => onLoginIdChange(event.target.value)}
          placeholder={loginIdPlaceholder}
          className="h-[50px] w-full border-0 bg-[#eef3ff] px-4 text-[18px] font-semibold tracking-[-0.03em] text-[#111111] outline-none placeholder:text-[#8f98ac]"
        />

        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder={passwordPlaceholder}
          className="h-[50px] w-full border-0 bg-[#eef3ff] px-4 text-[18px] font-semibold tracking-[-0.03em] text-[#111111] outline-none placeholder:text-[#8f98ac]"
        />
      </div>

      <div className="mt-4 flex items-center gap-6 text-[15px] text-[#111111]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rememberLoginId}
            onChange={(event) => onRememberLoginIdChange(event.target.checked)}
            className="h-[18px] w-[18px] rounded-none border border-[#111111] accent-[#0e8c6d]"
          />
          <span>{rememberLoginIdLabel}</span>
        </label>
      </div>

      <button
        type="button"
        onClick={onLogin}
        disabled={loading || !loginId || !password}
        className="mt-6 flex h-[52px] w-full items-center justify-center rounded-[6px] bg-[#0e8c6d] px-5 text-[20px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? loginButtonLoadingLabel : loginButtonLabel}
      </button>

      {message ? <p className="mt-4 text-[14px] leading-6 text-[#6f6f6f]">{message}</p> : null}

      <div className="mt-7 flex items-center justify-center gap-3 text-[15px] text-[#8b847b]">
        {resolvedHelperLinks.map((link, index) => (
          <span key={`${link.href}-${link.label}`} className="contents">
            {index > 0 ? <span>|</span> : null}
            <Link href={link.href as never} className="hover:text-[#111111]">
              {link.label}
            </Link>
          </span>
        ))}
      </div>

      <div className="mt-7 space-y-2.5">
        {socialProviders.includes("naver") ? (
          <button
            type="button"
            onClick={() => onSocialLogin("naver")}
            disabled={loading || socialLoading !== null}
            className="h-[48px] w-full rounded-[8px] bg-[#05AC4F] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-full w-full items-center">
              <span className="relative h-full w-[56px] shrink-0">
                <Image
                  src="/images/auth/naver-symbol.png"
                  alt=""
                  width={24}
                  height={24}
                  className="absolute left-[16px] top-1/2 h-[24px] w-[24px] -translate-y-1/2 object-contain"
                  style={{ mixBlendMode: "screen" }}
                />
              </span>
              <span className="min-w-0 flex-1 -translate-x-[18px] truncate text-center font-[Roboto,Arial,sans-serif] text-[14px] font-medium tracking-[0.25px]">
                {socialLoading === "naver" ? resolvedSocialLabels.naver.loading : resolvedSocialLabels.naver.idle}
              </span>
            </span>
          </button>
        ) : null}

        {socialProviders.includes("google") ? (
          <button
            type="button"
            onClick={() => onSocialLogin("google")}
            disabled={loading || socialLoading !== null}
            className="h-[48px] w-full rounded-[8px] border border-[#747775] bg-white text-[#1f1f1f] shadow-none transition-colors duration-200 hover:bg-[#f8f9fa] disabled:cursor-default disabled:border-[#1f1f1f1f] disabled:bg-[#ffffff61] disabled:text-[#1f1f1f61]"
          >
            <span className="flex h-full w-full items-center">
              <span className="relative h-full w-[56px] shrink-0">
                <span className="absolute left-[17px] top-1/2 -translate-y-1/2">
                  <GoogleSymbol />
                </span>
              </span>
              <span className="min-w-0 flex-1 -translate-x-[18px] truncate text-center font-[Roboto,Arial,sans-serif] text-[14px] font-medium tracking-[0.25px]">
                {socialLoading === "google" ? resolvedSocialLabels.google.loading : resolvedSocialLabels.google.idle}
              </span>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
