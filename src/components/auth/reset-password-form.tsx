"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ownerPasswordResetSchema, type OwnerPasswordResetInput } from "@/lib/auth/owner-password-reset";

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-[20px] border border-[#dbd7d0] bg-white px-5 py-4">
      <span className="block text-[13px] font-medium text-[#757575]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export default function ResetPasswordForm({
  initialLoginId,
  ready,
}: {
  initialLoginId?: string;
  ready: boolean;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(ready ? null : "Supabase 환경 변수가 설정되지 않았습니다.");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OwnerPasswordResetInput>({
    resolver: zodResolver(ownerPasswordResetSchema),
    defaultValues: {
      loginId: initialLoginId ?? "",
      name: "",
      birthDate: "",
      password: "",
      passwordConfirm: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!ready) {
      setMessage("Supabase 환경 변수가 설정되지 않았습니다.");
      return;
    }

    setMessage(null);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(result.message ?? "비밀번호를 재설정하지 못했어요.");
      return;
    }

    setMessage(result.message ?? "비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
    window.setTimeout(() => {
      router.replace("/login?message=reset-success" as never);
      router.refresh();
    }, 900);
  });

  const firstError =
    errors.loginId?.message ||
    errors.name?.message ||
    errors.birthDate?.message ||
    errors.password?.message ||
    errors.passwordConfirm?.message;

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 pb-10 pt-6 text-[#111111]">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#fafafa] text-[#111111] shadow-[0_8px_20px_rgba(17,17,17,0.05)]"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.1} />
      </button>

      <div className="mt-10 flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-[#f4efe3] text-[#7b654d]">
        <KeyRound className="h-8 w-8" strokeWidth={1.8} />
      </div>

      <div className="mt-8">
        <h1 className="text-[28px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#111111]">비밀번호 재설정</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#6f6f6f]">
          가입할 때 입력한 아이디, 이름, 생년월일을 확인한 뒤 새 비밀번호로 바꿀 수 있어요.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-7 space-y-3.5">
        <FieldShell label="아이디">
          <input
            type="text"
            {...register("loginId")}
            placeholder="아이디를 입력해 주세요"
            className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </FieldShell>

        <FieldShell label="이름">
          <input
            type="text"
            {...register("name")}
            placeholder="이름을 입력해 주세요"
            className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </FieldShell>

        <FieldShell label="생년월일 8자리">
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            {...register("birthDate")}
            placeholder="예: 19990321"
            className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </FieldShell>

        <FieldShell label="새 비밀번호">
          <div className="flex items-center gap-3">
            <input
              type={showPassword ? "text" : "password"}
              {...register("password")}
              placeholder="새 비밀번호를 입력해 주세요"
              className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
            />
            <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="shrink-0 text-[#111111]" aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </FieldShell>

        <FieldShell label="새 비밀번호 확인">
          <div className="flex items-center gap-3">
            <input
              type={showPasswordConfirm ? "text" : "password"}
              {...register("passwordConfirm")}
              placeholder="비밀번호를 한 번 더 입력해 주세요"
              className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
            />
            <button type="button" onClick={() => setShowPasswordConfirm((prev) => !prev)} className="shrink-0 text-[#111111]" aria-label={showPasswordConfirm ? "비밀번호 숨기기" : "비밀번호 보기"}>
              {showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </FieldShell>

        {(firstError || message) ? (
          <p className={`px-1 text-[13px] ${firstError ? "text-[#c43d3d]" : "text-[#5f6f69]"}`}>{firstError || message}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !ready}
          className="mt-2 flex h-[52px] w-full items-center justify-center rounded-[18px] bg-[#1f6b5b] text-[18px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting ? "변경 중..." : "비밀번호 변경하기"}
        </button>
      </form>

      <div className="mt-7 text-center">
        <a href="/login/find-id" className="text-[14px] font-medium text-[#111111] underline underline-offset-4">
          아이디 찾기로 이동
        </a>
      </div>
    </div>
  );
}

