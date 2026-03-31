"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function OwnerAuthForm({ initialError, supabaseReady }: { initialError: string | null; supabaseReady: boolean }) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(initialError);

  const handleSubmit = async () => {
    if (!supabaseReady || !supabase) {
      setMessage("Supabase 환경 변수가 필요합니다. .env.local을 먼저 확인해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage(error.message);
          return;
        }

        router.replace("/owner");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }

      if (data.session) {
        router.replace("/owner");
        router.refresh();
        return;
      }

      setMessage("회원가입이 완료되었습니다. 이메일 확인 후 로그인해 주세요.");
      setMode("signin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold text-[var(--accent)]">PawCare Owner</p>
      <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-[var(--text)]">사장님 로그인</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">이메일과 비밀번호로 로그인한 뒤, 연결된 매장 정보만 조회하고 수정할 수 있습니다.</p>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-[14px] px-3 py-2 text-sm font-semibold ${mode === "signin" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-[14px] px-3 py-2 text-sm font-semibold ${mode === "signup" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
        >
          회원가입
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">이메일</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="owner@example.com" className="field" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">비밀번호</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="비밀번호 입력" className="field" />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || !email || !password}
        className="mt-5 w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "처리 중..." : mode === "signin" ? "로그인" : "회원가입"}
      </button>

      {message ? <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
