"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { fetchApiJson } from "@/lib/api";

type ResetFormState = {
  loginId: string;
  password: string;
  setupKey: string;
};

const INITIAL_STATE: ResetFormState = {
  loginId: "",
  password: "",
  setupKey: "",
};

export default function AdminResetPasswordForm() {
  const router = useRouter();
  const [form, setForm] = useState<ResetFormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateField<Key extends keyof ResetFormState>(key: Key, value: ResetFormState[Key]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setMessage(null);

    try {
      await fetchApiJson<{ success: true }>("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      router.replace("/admin" as never);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "비밀번호 재설정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Object.values(form).every((value) => value.trim().length > 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-[#171411]">
      <div className="rounded-[24px] border border-[#e8dfd3] bg-white px-5 py-6 shadow-[0_18px_40px_rgba(23,20,17,0.06)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef7f2] text-[#1f6b5b]">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <div className="mt-5 text-center">
          <p className="text-[13px] font-semibold tracking-[0.04em] text-[#1f6b5b]">관리자 전용</p>
          <h1 className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-[#171411]">비밀번호 재설정</h1>
          <p className="mt-3 text-[15px] leading-7 text-[#7b746b]">
            관리자 아이디와 운영자 등록 키를 확인한 뒤
            <br />
            새 비밀번호로 다시 설정할 수 있어요.
          </p>
        </div>

        <div className="mt-7 space-y-3">
          <input
            type="text"
            value={form.loginId}
            onChange={(event) => updateField("loginId", event.target.value)}
            placeholder="관리자 아이디"
            className="h-[50px] w-full rounded-[12px] border border-[#ddd4c8] bg-[#fcfbf8] px-4 text-[16px] font-medium text-[#171411] outline-none placeholder:text-[#a2978a]"
          />
          <input
            type="password"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            placeholder="새 비밀번호"
            className="h-[50px] w-full rounded-[12px] border border-[#ddd4c8] bg-[#fcfbf8] px-4 text-[16px] font-medium text-[#171411] outline-none placeholder:text-[#a2978a]"
          />
          <div className="space-y-2">
            <input
              type="password"
              value={form.setupKey}
              onChange={(event) => updateField("setupKey", event.target.value)}
              placeholder="운영자 등록 키"
              className="h-[50px] w-full rounded-[12px] border border-[#ddd4c8] bg-[#fcfbf8] px-4 text-[16px] font-medium text-[#171411] outline-none placeholder:text-[#a2978a]"
            />
            <p className="px-1 text-[12px] leading-5 text-[#8a8075]">
              `.env.local`의 <span className="font-semibold text-[#5f554a]">ADMIN_SETUP_KEY=</span> 뒤에 있는 값만 입력해 주세요.
            </p>
          </div>
        </div>

        {message ? <p className="mt-3 text-[14px] font-medium leading-6 text-[#d34b4b]">{message}</p> : null}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !canSubmit}
          className="mt-6 flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[#0e8c6d] px-5 text-[18px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "재설정 중..." : "비밀번호 재설정"}
        </button>

        <div className="mt-4 flex items-center justify-center gap-4 text-[13px] font-semibold text-[#6f675d]">
          <button
            type="button"
            onClick={() => router.push("/admin/login" as never)}
            className="underline underline-offset-4"
          >
            관리자 로그인으로 돌아가기
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/register" as never)}
            className="underline underline-offset-4"
          >
            관리자 등록
          </button>
        </div>
      </div>
    </main>
  );
}
