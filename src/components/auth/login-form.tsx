"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleUserRound, Eye, EyeOff, X } from "lucide-react";

import SocialLoginButtons from "@/components/auth/social-login-buttons";
import { buildOwnerAuthEmail } from "@/lib/auth/owner-credentials";
import { getSocialOAuthProvider, type SocialProvider } from "@/lib/auth/social-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function toKoreanAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) return "아이디 또는 비밀번호가 맞지 않습니다.";
  if (normalized.includes("email not confirmed")) return "이메일 인증이 완료되지 않았습니다.";
  if (normalized.includes("user already registered")) return "이미 가입된 계정입니다.";
  if (normalized.includes("password should be at least")) return "비밀번호는 6자 이상 입력해 주세요.";
  if (normalized.includes("unable to validate email address")) return "아이디 형식을 다시 확인해 주세요.";
  if (normalized.includes("oauth")) return "소셜 로그인 처리 중 문제가 발생했습니다.";
  return "로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-[20px] border border-[#dbd7d0] bg-white px-[14px] py-[8px]">
      <span className="block text-[13px] font-medium text-[#757575]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function LoginForm({ supabaseReady, initialMessage, nextPath = "/owner" }: { supabaseReady: boolean; initialMessage?: string | null; nextPath?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);

  const handleLogin = async () => {
    if (!supabaseReady || !supabase) {
      setMessage("Supabase 환경 변수가 설정되지 않았습니다. .env.local을 먼저 확인해 주세요.");
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

      router.replace(nextPath as never);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = () => {
    const query = loginId.trim() ? "?loginId=" + encodeURIComponent(loginId.trim()) : "";
    router.push(("/login/reset" + query) as never);
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (!supabaseReady || !supabase) {
      setMessage("Supabase 환경 변수가 설정되지 않았습니다. .env.local을 먼저 확인해 주세요.");
      return;
    }

    setSocialLoading(provider);
    setMessage(null);

    try {
      const redirectTo = window.location.origin + "/auth/callback?next=" + encodeURIComponent(nextPath);
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
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 pb-10 pt-6 text-[#111111]">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-[#6f6f6f]">펫매니저 OWNER</div>
        <Link href="/" className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#fafafa] text-[#111111] shadow-[0_8px_20px_rgba(17,17,17,0.05)]">
          <X className="h-6 w-6" strokeWidth={2.2} />
        </Link>
      </div>

      <div className="mt-12 flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-[#dcfae8] text-[#2d645c]">
        <CircleUserRound className="h-8 w-8" strokeWidth={1.8} />
      </div>

      <div className="mt-10">
        <h1 className="text-[28px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#111111]">펫매니저 사장님 로그인</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#6f6f6f]">아이디와 비밀번호로 로그인하고 매장 운영 화면으로 바로 들어가세요.</p>
      </div>

      <div className="mt-7 space-y-3.5">
        <FieldShell label="아이디">
          <input
            type="text"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            placeholder="아이디 입력"
            className="h-5 w-full border-0 bg-transparent p-0 text-[14px] font-medium leading-5 text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </FieldShell>

        <FieldShell label="비밀번호">
          <div className="flex items-center gap-3">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호 입력"
              className="h-5 w-full border-0 bg-transparent p-0 text-[14px] font-medium leading-5 text-[#111111] outline-none placeholder:text-[#b0aaa1]"
            />
            <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="text-[#111111]" aria-label="비밀번호 표시 전환">
              {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={2.1} /> : <Eye className="h-5 w-5" strokeWidth={2.1} />}
            </button>
          </div>
        </FieldShell>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className="text-[15px] font-medium text-[#111111] underline underline-offset-4">
          회원가입하기
        </Link>
        <button type="button" onClick={handlePasswordReset} className="text-[15px] font-medium text-[#111111] underline underline-offset-4">
          비밀번호 재설정
        </button>
      </div>

      <button
        type="button"
        onClick={handleLogin}
        disabled={loading || !loginId || !password}
        className="mt-8 flex h-[52px] w-full items-center justify-center rounded-[18px] bg-[#2f786b] px-5 text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>

      {message ? <p className="mt-4 text-[14px] leading-6 text-[#6f6f6f]">{message}</p> : null}

      <div className="my-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-[#e4e0d8]" />
        <span className="text-[15px] font-medium text-[#353535]">또는</span>
        <div className="h-px flex-1 bg-[#e4e0d8]" />
      </div>

      <SocialLoginButtons onLogin={handleSocialLogin} loadingProvider={socialLoading} disabled={loading} />
    </div>
  );
}

