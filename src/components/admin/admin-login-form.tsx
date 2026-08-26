"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { fetchApiJson } from "@/lib/api";

export default function AdminLoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setMessage(null);

    try {
      await fetchApiJson<{ success: true }>("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ loginId, password }),
        headers: { "Content-Type": "application/json" },
      });

      router.replace(nextPath as never);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "관리자 로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-white px-6 py-8 text-[#171717]">
      <div className="mx-auto max-w-[382px] rounded-md border border-[#d4d4d4] bg-white px-5 py-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-[#d4d4d4] bg-white text-[#171717]">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <div className="mt-5 text-center">
          <p className="text-[14px] font-medium tracking-[0.04em] text-[#525252]">관리자 전용</p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-[#171411]">관리자 로그인</h1>
          <p className="mt-3 text-[16px] leading-7 text-[#525252]">
            관리자 아이디와 비밀번호로 로그인하면
            <br />
            오너 계정 관리와 운영자 기능을 바로 사용할 수 있어요.
          </p>
        </div>

        <div className="mt-7 space-y-3">
          <input
            type="text"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            placeholder="관리자 아이디"
            className="h-[48px] w-full rounded-md border border-[#a3a3a3] bg-white px-4 text-[16px] text-[#171717] outline-none placeholder:text-[#737373] focus:border-black"
          />
          <div className="relative">
            <input
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="관리자 비밀번호"
              className="h-[48px] w-full rounded-md border border-[#a3a3a3] bg-white px-4 pr-12 text-[16px] text-[#171717] outline-none placeholder:text-[#737373] focus:border-black"
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#525252]"
              aria-label={passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {passwordVisible ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {message ? <p className="mt-3 text-[16px] leading-6 text-[#171717]">{message}</p> : null}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !loginId || !password}
          className="mt-6 flex h-[48px] w-full items-center justify-center rounded-md bg-[#171717] px-5 text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:bg-[#a3a3a3]"
        >
          {submitting ? "로그인 중..." : "관리자 로그인"}
        </button>

        <div className="mt-4 flex items-center justify-center gap-4 text-[14px] font-medium text-[#525252]">
          <button
            type="button"
            onClick={() => router.push("/admin/register" as never)}
            className="underline underline-offset-4"
          >
            관리자 등록
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/reset" as never)}
            className="underline underline-offset-4"
          >
            비밀번호 재설정
          </button>
        </div>
      </div>
    </main>
  );
}
