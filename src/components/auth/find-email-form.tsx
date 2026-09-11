"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { MobileBackButton } from "@/components/ui/mobile-back-button";
import { ownerFindEmailSchema, type OwnerFindEmailInput } from "@/lib/auth/owner-find-email";
import { env, getSupabaseRuntimeStage, hasPortoneBrowserEnv } from "@/lib/env";

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="auth-type-label mb-2 block text-[#475569]">{label}</span>
      <div>{children}</div>
    </label>
  );
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

type ApiMessage = {
  message?: string;
  verificationRequestId?: string | null;
  devVerificationCode?: string | null;
  verificationToken?: string | null;
  email?: string | null;
};

export default function FindEmailForm() {
  const router = useRouter();
  const isDevelopmentFlow = useMemo(() => getSupabaseRuntimeStage() !== "production", []);
  const canShowDevVerificationCode = useMemo(() => getSupabaseRuntimeStage() === "development", []);
  const portoneReady = useMemo(() => hasPortoneBrowserEnv(), []);
  const [message, setMessage] = useState<string | null>(null);
  const [foundEmail, setFoundEmail] = useState<string | null>(null);
  const [verificationRequestId, setVerificationRequestId] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OwnerFindEmailInput>({
    resolver: zodResolver(ownerFindEmailSchema),
    defaultValues: { name: "", birthDate: "", phoneNumber: "", identityVerificationToken: "" },
  });

  const syncVerificationToken = (token: string | null) => {
    setVerificationToken(token);
    setValue("identityVerificationToken", token ?? "", { shouldValidate: true });
  };

  const requestCode = async () => {
    const values = getValues();
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/request-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          birthDate: values.birthDate,
          phoneNumber: values.phoneNumber,
          purpose: "find-email",
          method: "local",
        }),
      });
      const result = (await response.json()) as ApiMessage;
      if (!response.ok) {
        setMessage(result.message ?? "인증번호를 보내지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setVerificationRequestId(result.verificationRequestId ?? null);
      setDevCode(result.devVerificationCode ?? null);
      setVerificationCode("");
      syncVerificationToken(null);
      setFoundEmail(null);
      setMessage(result.message ?? "인증번호를 보냈습니다. 문자 메시지를 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    const values = getValues();
    if (!verificationRequestId) {
      setMessage("먼저 인증번호를 받아 주세요.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/verify-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          birthDate: values.birthDate,
          phoneNumber: values.phoneNumber,
          code: verificationCode,
          purpose: "find-email",
          verificationRequestId,
        }),
      });
      const result = (await response.json()) as ApiMessage;
      if (!response.ok || !result.verificationToken) {
        setMessage(result.message ?? "인증번호를 다시 확인해 주세요.");
        return;
      }
      syncVerificationToken(result.verificationToken);
      setMessage(result.message ?? "본인 인증이 완료되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  const verifyPass = async () => {
    const values = getValues();
    if (!portoneReady || !env.portoneStoreId || !env.portoneIdentityChannelKey) {
      setMessage("PASS 본인인증 환경이 아직 준비되지 않았습니다.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const requestResponse = await fetch("/api/auth/request-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          birthDate: values.birthDate,
          phoneNumber: values.phoneNumber,
          purpose: "find-email",
          method: "portone",
        }),
      });
      const requestResult = (await requestResponse.json()) as ApiMessage;
      if (!requestResponse.ok || !requestResult.verificationRequestId) {
        setMessage(requestResult.message ?? "본인인증 요청을 준비하지 못했습니다.");
        return;
      }

      const { requestIdentityVerification } = await import("@portone/browser-sdk/v2");
      const result = await requestIdentityVerification({
        storeId: env.portoneStoreId,
        channelKey: env.portoneIdentityChannelKey,
        identityVerificationId: `find_email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        windowType: { pc: "POPUP", mobile: "POPUP" },
        customer: {
          fullName: values.name.trim(),
          phoneNumber: normalizePhoneNumber(values.phoneNumber),
          birthYear: values.birthDate.slice(0, 4),
          birthMonth: values.birthDate.slice(4, 6),
          birthDay: values.birthDate.slice(6, 8),
        },
      });
      if (!result?.identityVerificationId) {
        setMessage("PASS 본인 인증을 완료하지 못했습니다.");
        return;
      }

      const response = await fetch("/api/auth/verify-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "find-email",
          verificationRequestId: requestResult.verificationRequestId,
          identityVerificationId: result.identityVerificationId,
        }),
      });
      const verifyResult = (await response.json()) as ApiMessage;
      if (!response.ok || !verifyResult.verificationToken) {
        setMessage(verifyResult.message ?? "PASS 본인 인증을 확인하지 못했습니다.");
        return;
      }
      syncVerificationToken(verifyResult.verificationToken);
      setMessage(verifyResult.message ?? "PASS 본인 인증이 완료되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    setFoundEmail(null);
    const response = await fetch("/api/auth/find-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = (await response.json()) as ApiMessage;
    if (!response.ok || !result.email) {
      setMessage(result.message ?? "이메일을 찾지 못했습니다.");
      return;
    }
    setFoundEmail(result.email);
    setMessage(result.message ?? null);
  });

  const firstError = errors.name?.message || errors.birthDate?.message || errors.phoneNumber?.message || errors.identityVerificationToken?.message;

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#f1f3f7] px-5 py-8 text-[#111827] sm:px-6 sm:py-12">
      <div className="w-full max-w-[430px] rounded-[18px] border border-[#e8edf3] bg-white px-6 pb-9 pt-7 sm:px-8">
      <div className="relative flex min-h-11 items-center justify-center">
        <MobileBackButton onClick={() => router.replace("/login")} label="로그인으로 이동" className="absolute left-0 h-11 w-11 border-0 bg-transparent shadow-none" />
        <h1 className="auth-type-page-title text-[#101a31]">이메일 찾기</h1>
      </div>
      <form onSubmit={onSubmit} className="mt-7 space-y-5">
        <FieldShell label="이름"><input type="text" autoComplete="name" {...register("name")} placeholder="이름을 입력해 주세요" className="auth-type-control min-h-[52px] w-full rounded-[12px] border border-[#e8edf3] bg-white px-4 text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15" /></FieldShell>
        <FieldShell label="생년월일"><input type="text" inputMode="numeric" maxLength={8} {...register("birthDate")} placeholder="예: 19990321" className="auth-type-control min-h-[52px] w-full rounded-[12px] border border-[#e8edf3] bg-white px-4 text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15" /></FieldShell>
        <FieldShell label="휴대폰 번호"><input type="tel" inputMode="numeric" autoComplete="tel" maxLength={11} {...register("phoneNumber")} placeholder="숫자만 입력해 주세요" className="auth-type-control min-h-[52px] w-full rounded-[12px] border border-[#e8edf3] bg-white px-4 text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15" /></FieldShell>

        {isDevelopmentFlow ? (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => void requestCode()} disabled={loading} className="auth-type-control flex min-h-[52px] items-center justify-center rounded-[12px] border border-[#e8edf3] bg-white text-[#334155] disabled:opacity-60">{verificationRequestId ? "인증번호 다시 받기" : "인증번호 받기"}</button>
            <button type="button" onClick={() => void verifyPass()} disabled={loading} className="auth-type-control flex min-h-[52px] items-center justify-center rounded-[12px] bg-[#111a30] text-white disabled:opacity-60">휴대폰 본인인증</button>
          </div>
        ) : <button type="button" onClick={() => void verifyPass()} disabled={loading} className="auth-type-control flex min-h-[56px] w-full items-center justify-center rounded-[12px] bg-[#111a30] text-white disabled:opacity-60">휴대폰으로 본인 인증하기</button>}

        {isDevelopmentFlow && verificationRequestId ? <>
          <FieldShell label="인증번호"><input type="text" inputMode="numeric" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6자리 인증번호" className="auth-type-control min-h-[52px] w-full rounded-[12px] border border-[#e8edf3] bg-white px-4 text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15" /></FieldShell>
          {canShowDevVerificationCode && devCode ? <p className="auth-type-helper px-1 text-[#64748b]">로컬 테스트용 인증번호: {devCode}</p> : null}
          <button type="button" onClick={() => void verifyCode()} disabled={loading} className="auth-type-control flex min-h-[52px] w-full items-center justify-center rounded-[12px] bg-[#111a30] text-white disabled:opacity-60">인증 확인</button>
        </> : null}

        {verificationToken ? <div className="auth-type-helper rounded-[12px] border border-[#cfe1da] bg-[#f6faf8] px-4 py-3 text-[#1f6b5b]">본인 인증이 완료되었습니다. 아래 버튼으로 가입한 이메일을 확인해 주세요.</div> : null}
        {(firstError || message) && !foundEmail ? <p className={`auth-type-helper px-1 ${firstError ? "text-[#c43d3d]" : "text-[#64748b]"}`}>{firstError || message}</p> : null}
        {foundEmail ? <div className="rounded-[14px] border border-[#e8edf3] bg-[#f8fafc] px-5 py-4"><p className="auth-type-label text-[#64748b]">가입한 이메일</p><p className="auth-type-section-title mt-2 [overflow-wrap:anywhere] text-[#111827]">{foundEmail}</p>{message ? <p className="auth-type-helper mt-2 text-[#64748b]">{message}</p> : null}<Link href={`/login/reset?email=${encodeURIComponent(foundEmail)}`} replace className="auth-type-label mt-4 inline-flex min-h-11 items-center justify-center rounded-[12px] border border-[#cbd5e1] bg-white px-4 text-[#111827]">비밀번호 재설정으로 이동</Link></div> : null}
        <button type="submit" disabled={isSubmitting || !verificationToken} className="auth-type-control flex min-h-[56px] w-full items-center justify-center rounded-[12px] bg-[#111a30] text-white disabled:cursor-not-allowed disabled:opacity-45">{isSubmitting ? "확인 중..." : "이메일 확인하기"}</button>
      </form>
      <div className="auth-type-helper mt-7 text-center text-[#64748b]"><Link href="/login/reset" replace className="inline-flex min-h-11 items-center font-medium text-[#111827] underline underline-offset-4">비밀번호 재설정으로 이동</Link></div>
      </div>
    </main>
  );
}
