"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
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

type ApiMessage = {
  message?: string;
  verificationRequestId?: string | null;
  providerIdentityVerificationId?: string | null;
  verificationState?: string | null;
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
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<OwnerFindEmailInput>({
    resolver: zodResolver(ownerFindEmailSchema),
    defaultValues: { name: "", birthDate: "", phoneNumber: "", identityVerificationToken: "" },
  });

  const attemptRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const verifiedIdentityRef = useRef<string | null>(null);
  const identitySnapshot = () => {
    const values = getValues();
    return JSON.stringify([values.name, values.birthDate, values.phoneNumber, ""]);
  };
  useEffect(() => {
    mountedRef.current = true;
    const subscription = watch((_values, { name }) => {
      if (!["name", "birthDate", "phoneNumber"].includes(name ?? "")) return;
      attemptRef.current++;
      busyRef.current = false;
      verifiedIdentityRef.current = null;
      setLoading(false);
      setVerificationToken(null);
      setValue("identityVerificationToken", "");
      setVerificationRequestId(null); setDevCode(null); setVerificationCode(""); setFoundEmail(null);
      setMessage(null);
    });
    return () => { subscription.unsubscribe(); mountedRef.current = false; busyRef.current = false; };
  }, [watch, setValue]);
  const beginAttempt = () => {
    if (busyRef.current) return null;
    busyRef.current = true;
    const id = ++attemptRef.current;
    const snapshot = identitySnapshot();
    setLoading(true);
    setMessage(null);
    return {
      current: () => mountedRef.current && attemptRef.current === id && identitySnapshot() === snapshot,
      finish: () => { if (mountedRef.current && attemptRef.current === id) { busyRef.current = false; setLoading(false); } },
    };
  };

  const syncVerificationToken = (token: string | null) => {
    verifiedIdentityRef.current = token ? identitySnapshot() : null;
    setVerificationToken(token);
    setValue("identityVerificationToken", token ?? "", { shouldValidate: true });
  };

  const requestCode = async () => {
    const attempt = beginAttempt();
    if (!attempt) return;
    const values = getValues();
    syncVerificationToken(null);
    setVerificationRequestId(null); setDevCode(null); setVerificationCode(""); setFoundEmail(null);
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
      if (!attempt.current()) return;
      if (!response.ok || !result.verificationRequestId) {
        setMessage(result.message ?? "인증번호를 보내지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setVerificationRequestId(result.verificationRequestId ?? null);
      setDevCode(result.devVerificationCode ?? null);
      setVerificationCode("");
      syncVerificationToken(null);
      setFoundEmail(null);
      setMessage(result.message ?? "인증번호를 보냈습니다. 문자 메시지를 확인해 주세요.");
    } catch {
      if (attempt.current()) setMessage("인증 요청 중 문제가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      attempt.finish();
    }
  };

  const verifyCode = async () => {
    const attempt = beginAttempt();
    if (!attempt) return;
    const values = getValues();
    if (!verificationRequestId) {
      setMessage("먼저 인증번호를 받아 주세요.");
      attempt.finish();
      return;
    }
    syncVerificationToken(null);
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
      if (!attempt.current()) return;
      if (!response.ok || !result.verificationToken) {
        setMessage(result.message ?? "인증번호를 다시 확인해 주세요.");
        return;
      }
      syncVerificationToken(result.verificationToken);
      setMessage(result.message ?? "본인 인증이 완료되었습니다.");
    } catch {
      if (attempt.current()) setMessage("인증 요청 중 문제가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      attempt.finish();
    }
  };

  const verifyPass = async () => {
    const attempt = beginAttempt();
    if (!attempt) return;
    syncVerificationToken(null);
    setVerificationRequestId(null); setDevCode(null); setVerificationCode(""); setFoundEmail(null);
    try {
      const valid = await trigger(["name", "birthDate", "phoneNumber"]);
      if (!attempt.current() || !valid) return;
      const values = getValues();
      const identity = ownerFindEmailSchema.omit({ identityVerificationToken: true }).safeParse(values);
      if (!identity.success) { setMessage(identity.error.issues[0]?.message ?? "본인 정보를 확인해 주세요."); return; }

      if (!portoneReady || !env.portoneStoreId || !env.portoneIdentityChannelKey) {
        setMessage("휴대폰 본인인증 환경이 아직 준비되지 않았습니다."); return;
      }

      const requestResponse = await fetch("/api/auth/request-verification-code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...identity.data,  purpose: "find-email", method: "portone" }),
      });
      const requestResult = (await requestResponse.json()) as ApiMessage;
      if (!attempt.current()) return;
      if (!requestResponse.ok || typeof requestResult.verificationRequestId !== "string" ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestResult.verificationRequestId) ||
          typeof requestResult.providerIdentityVerificationId !== "string" || !requestResult.providerIdentityVerificationId.trim() ||
          requestResult.providerIdentityVerificationId.length > 128 ||
          typeof requestResult.verificationState !== "string" || !/^[a-f0-9]{64}$/.test(requestResult.verificationState)) {
        setMessage("본인인증 요청을 준비하지 못했습니다. 다시 시도해 주세요."); return;
      }
      const { requestIdentityVerification } = await import("@portone/browser-sdk/v2");
      if (!attempt.current()) return;
      const identityVerificationId = requestResult.providerIdentityVerificationId;
      const result = await requestIdentityVerification({
        storeId: env.portoneStoreId, channelKey: env.portoneIdentityChannelKey,
        identityVerificationId,
        customData: JSON.stringify({ petmanagerIdentityState: requestResult.verificationState }),
        windowType: { pc: "POPUP", mobile: "POPUP" },
        customer: { fullName: identity.data.name, phoneNumber: identity.data.phoneNumber,
          birthYear: identity.data.birthDate.slice(0, 4), birthMonth: identity.data.birthDate.slice(4, 6), birthDay: identity.data.birthDate.slice(6, 8) },
      });
      if (!attempt.current()) return;
      if (!result || result.code || result.identityVerificationId !== identityVerificationId) {
        setMessage("휴대폰 본인인증을 완료하지 못했습니다. 다시 시도해 주세요."); return;
      }
      const response = await fetch("/api/auth/verify-pass", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "find-email", verificationRequestId: requestResult.verificationRequestId,
          identityVerificationId, verificationState: requestResult.verificationState }),
      });
      const verified = (await response.json()) as ApiMessage;
      if (!attempt.current()) return;
      if (!response.ok || typeof verified.verificationToken !== "string" || !verified.verificationToken.trim()) {
        setMessage("본인인증 결과를 확인하지 못했습니다. 다시 시도해 주세요."); return;
      }
      syncVerificationToken(verified.verificationToken);
      setMessage("본인 인증이 완료되었습니다.");
    } catch {
      if (attempt.current()) setMessage("본인인증 중 문제가 발생했습니다. 다시 시도해 주세요.");
    } finally {

      attempt.finish();
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!verificationToken || verifiedIdentityRef.current !== identitySnapshot()) {
      syncVerificationToken(null); setMessage("본인 확인을 먼저 완료해 주세요."); return;
    }
    const attempt = beginAttempt();
    if (!attempt) return;
    try {
    setMessage(null);
    setFoundEmail(null);
    const response = await fetch("/api/auth/find-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = (await response.json()) as ApiMessage;
    if (!attempt.current()) return;
    if (!response.ok || !result.email) {
      setMessage(result.message ?? "이메일을 찾지 못했습니다.");
      return;
    }
    setFoundEmail(result.email);
    setMessage(result.message ?? null);
    } catch {
      if (attempt.current()) setMessage("요청을 처리하지 못했습니다. 다시 시도해 주세요.");
    } finally { attempt.finish(); }
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
