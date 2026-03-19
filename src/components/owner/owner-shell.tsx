"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import OwnerApp from "@/components/owner/owner-app";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BootstrapPayload } from "@/types/domain";

export default function OwnerShell({ initialData }: { initialData: BootstrapPayload }) {
  const [supabase] = useState<SupabaseClient | null>(() => getSupabaseBrowserClient());
  const [sessionReady, setSessionReady] = useState(!supabase);
  const [loggedIn, setLoggedIn] = useState(!supabase);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(Boolean(data.session));
      setSessionReady(true);
    });
  }, [supabase]);

  if (!sessionReady) {
    return <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-center justify-center text-sm text-[var(--muted)]">인증 상태를 확인하고 있어요.</div>;
  }

  if (!supabase || loggedIn) {
    return <OwnerApp initialData={initialData} />;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center gap-4 bg-[var(--background)] px-5">
      <div className="rounded-[28px] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold text-[var(--accent)]">사장님 전용 로그인</p>
        <h1 className="mt-2 text-2xl font-extrabold">전화번호 OTP 인증</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Supabase 환경이 연결되면 전화번호로 로그인할 수 있습니다.</p>
        <div className="mt-4 space-y-3">
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01012345678" className="field" />
          <button className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-bold text-white" onClick={async () => { const { error } = await supabase.auth.signInWithOtp({ phone }); setMessage(error ? error.message : "인증번호를 보냈어요."); setOtpSent(!error); }}>
            인증번호 받기
          </button>
          {otpSent && <><input value={token} onChange={(event) => setToken(event.target.value)} placeholder="인증번호" className="field" /><button className="w-full rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold text-[var(--accent)]" onClick={async () => { const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" }); setMessage(error ? error.message : "로그인되었습니다."); if (!error) setLoggedIn(true); }}>
            로그인
          </button></>}
          {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
        </div>
      </div>
      <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">현재 Supabase 키가 없으면 자동으로 데모 모드가 열립니다.</div>
    </div>
  );
}

