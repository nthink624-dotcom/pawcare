"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { buildOwnerAuthEmail } from "@/lib/auth/owner-credentials";
import { getSocialOAuthProvider, type SocialProvider } from "@/lib/auth/social-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function toKoreanAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "아이디 또는 비밀번호가 올바르지 않아요.";
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
    return "아이디 형식을 다시 확인해 주세요.";
  }
  if (normalized.includes("oauth")) {
    return "소셜 로그인 중 문제가 생겼어요. 다시 시도해 주세요.";
  }

  return "로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
}

const SAVED_LOGIN_ID_KEY = "pawcare.savedLoginId";

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
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  const [rememberLoginId, setRememberLoginId] = useState(false);

  useEffect(() => {
    const savedLoginId = window.localStorage.getItem(SAVED_LOGIN_ID_KEY);
    if (savedLoginId) {
      setLoginId(savedLoginId);
      setRememberLoginId(true);
    }
  }, []);

  const handleLogin = async () => {
    if (!supabaseReady || !supabase) {
      setMessage("로그인 준비 중이에요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: buildOwnerAuthEmail(loginId),
        password,
      });

      if (error) {
        setMessage(toKoreanAuthError(error.message));
        return;
      }

      if (rememberLoginId && loginId.trim()) {
        window.localStorage.setItem(SAVED_LOGIN_ID_KEY, loginId.trim());
      } else {
        window.localStorage.removeItem(SAVED_LOGIN_ID_KEY);
      }

      router.replace(nextPath as never);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (!supabaseReady || !supabase) {
      setMessage("소셜 로그인 준비 중이에요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setSocialLoading(provider);
    setMessage(null);

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: getSocialOAuthProvider(provider) as "google" | "kakao" | "custom:naver",
        options: { redirectTo },
      });

      if (error) {
        setMessage(toKoreanAuthError(error.message));
      }
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 pb-12 pt-10 text-[#111111]">
      <div className="text-center">
        <h1 className="text-[30px] font-extrabold tracking-[-0.05em] text-[#111111]">로그인</h1>
        <p className="mt-4 text-[15px] leading-7 text-[#7b746b]">
          아이디와 비밀번호 입력이 귀찮으신가요?
          <br />
          1초 회원가입으로 입력 없이 간편하게 로그인 하세요.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleSocialLogin("kakao")}
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
            {socialLoading === "kakao" ? "카카오 로그인 중..." : "카카오 1초 로그인/회원가입"}
          </span>
        </span>
      </button>

      <div className="mt-6 space-y-3">
        <input
          type="text"
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
          placeholder="아이디"
          className="h-[50px] w-full border-0 bg-[#eef3ff] px-4 text-[18px] font-semibold tracking-[-0.03em] text-[#111111] outline-none placeholder:text-[#8f98ac]"
        />

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호"
          className="h-[50px] w-full border-0 bg-[#eef3ff] px-4 text-[18px] font-semibold tracking-[-0.03em] text-[#111111] outline-none placeholder:text-[#8f98ac]"
        />
      </div>

      <div className="mt-4 flex items-center gap-6 text-[15px] text-[#111111]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rememberLoginId}
            onChange={(event) => setRememberLoginId(event.target.checked)}
            className="h-[18px] w-[18px] rounded-none border border-[#111111] accent-[#0e8c6d]"
          />
          <span>아이디 저장</span>
        </label>
      </div>

      <button
        type="button"
        onClick={handleLogin}
        disabled={loading || !loginId || !password}
        className="mt-6 flex h-[52px] w-full items-center justify-center rounded-[6px] bg-[#0e8c6d] px-5 text-[20px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>

      {message ? <p className="mt-4 text-[14px] leading-6 text-[#6f6f6f]">{message}</p> : null}

      <div className="mt-7 flex items-center justify-center gap-3 text-[15px] text-[#8b847b]">
        <Link href="/login/find-id" className="hover:text-[#111111]">
          아이디 찾기
        </Link>
        <span>|</span>
        <Link href="/login/reset" className="hover:text-[#111111]">
          비밀번호 찾기
        </Link>
        <span>|</span>
        <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className="hover:text-[#111111]">
          회원가입
        </Link>
      </div>

      <div className="mt-7 space-y-2.5">
        <button
          type="button"
          onClick={() => void handleSocialLogin("naver")}
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
              {socialLoading === "naver" ? "네이버 로그인 중..." : "네이버 계정으로 계속하기"}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => void handleSocialLogin("google")}
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
              {socialLoading === "google" ? "구글 로그인 중..." : "Google 계정으로 계속하기"}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
