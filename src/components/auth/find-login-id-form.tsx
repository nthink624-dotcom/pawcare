"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { env, hasPortoneBrowserEnv } from "@/lib/env";
import { ownerFindLoginIdSchema, type OwnerFindLoginIdInput } from "@/lib/auth/owner-find-login-id";

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-[20px] border border-[#dbd7d0] bg-white px-5 py-4">
      <span className="block text-[13px] font-medium text-[#757575]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export default function FindLoginIdForm() {
  const router = useRouter();
  const portoneReady = useMemo(() => hasPortoneBrowserEnv(), []);

  const [message, setMessage] = useState<string | null>(null);
  const [foundLoginId, setFoundLoginId] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
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
  } = useForm<OwnerFindLoginIdInput>({
    resolver: zodResolver(ownerFindLoginIdSchema),
    defaultValues: {
      name: "",
      birthDate: "",
      phoneNumber: "",
      identityVerificationToken: "",
    },
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
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message ?? "인증번호를 보내지 못했어요.");
        return;
      }

      setChallengeToken(result.challengeToken ?? null);
      setDevCode(result.devVerificationCode ?? null);
      syncVerificationToken(null);
      setFoundLoginId(null);
      setMessage(result.message ?? "인증번호를 보냈어요.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    const values = getValues();
    if (!challengeToken) {
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
          challengeToken,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.verificationToken) {
        setMessage(result.message ?? "인증번호를 다시 확인해 주세요.");
        return;
      }

      syncVerificationToken(result.verificationToken);
      setMessage(result.message ?? "본인인증이 완료되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  const verifyPass = async () => {
    const values = getValues();
    if (!portoneReady || !env.portoneStoreId || !env.portoneIdentityChannelKey) {
      setMessage("PASS 본인인증 환경이 아직 준비되지 않았어요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { requestIdentityVerification } = await import("@portone/browser-sdk/v2");
      const identityVerificationId = `find_id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const result = await requestIdentityVerification({
        storeId: env.portoneStoreId,
        channelKey: env.portoneIdentityChannelKey,
        identityVerificationId,
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
        setMessage("PASS 본인인증을 완료하지 못했어요.");
        return;
      }

      const response = await fetch("/api/auth/verify-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityVerificationId: result.identityVerificationId,
          name: values.name,
          birthDate: values.birthDate,
          phoneNumber: values.phoneNumber,
        }),
      });
      const verifyResult = await response.json();

      if (!response.ok || !verifyResult.verificationToken) {
        setMessage(verifyResult.message ?? "PASS 본인인증 확인에 실패했어요.");
        return;
      }

      syncVerificationToken(verifyResult.verificationToken);
      setMessage(verifyResult.message ?? "PASS 본인인증이 완료되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    setFoundLoginId(null);

    const response = await fetch("/api/auth/find-login-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const result = (await response.json()) as { message?: string; loginId?: string };
    if (!response.ok) {
      setMessage(result.message ?? "아이디를 찾지 못했어요.");
      return;
    }

    setFoundLoginId(result.loginId ?? null);
    setMessage(result.message ?? null);
  });

  const firstError =
    errors.name?.message ||
    errors.birthDate?.message ||
    errors.phoneNumber?.message ||
    errors.identityVerificationToken?.message;

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 pb-10 pt-6 text-[#111111]">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#fafafa] text-[#111111] shadow-[0_8px_20px_rgba(17,17,17,0.05)]"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.1} />
      </button>

      <div className="mt-10 flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-[#f4efe3] text-[#1f6b5b]">
        <Search className="h-8 w-8" strokeWidth={1.8} />
      </div>

      <div className="mt-8">
        <h1 className="text-[28px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#111111]">아이디 찾기</h1>
        <p className="mt-3 text-[14px] leading-6 text-[#6f6f6f]">
          본인인증을 완료한 뒤에만 가입된 아이디를 확인할 수 있어요.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-7 space-y-3.5">
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

        <FieldShell label="휴대폰 번호">
          <input
            type="text"
            inputMode="numeric"
            maxLength={11}
            {...register("phoneNumber")}
            placeholder="숫자만 입력해 주세요"
            className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </FieldShell>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={requestCode}
            disabled={loading}
            className="flex h-[50px] items-center justify-center rounded-[18px] border border-[#d9d2c7] bg-white px-4 text-[15px] font-semibold text-[#111111] disabled:opacity-60"
          >
            {challengeToken ? "인증번호 다시 받기" : "인증번호 받기"}
          </button>
          <button
            type="button"
            onClick={verifyPass}
            disabled={loading}
            className="flex h-[50px] items-center justify-center rounded-[18px] border border-[#2f786b] bg-[#eff8f6] px-4 text-[15px] font-semibold text-[#2f786b] disabled:opacity-60"
          >
            PASS 본인인증
          </button>
        </div>

        {challengeToken ? (
          <>
            <FieldShell label="인증번호">
              <input
                type="text"
                inputMode="numeric"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6자리 인증번호"
                className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
              />
            </FieldShell>
            {devCode ? <p className="px-1 text-[12px] leading-5 text-[#6f6f6f]">로컬 테스트용 인증번호: {devCode}</p> : null}
            <button
              type="button"
              onClick={verifyCode}
              disabled={loading}
              className="flex h-[52px] w-full items-center justify-center rounded-[18px] bg-[#2f786b] text-[16px] font-semibold text-white disabled:opacity-60"
            >
              인증 확인
            </button>
          </>
        ) : null}

        {verificationToken ? (
          <div className="rounded-[20px] border border-[#dfe9e4] bg-[#f6fbf8] px-5 py-4 text-[14px] font-medium text-[#1f6b5b]">
            본인인증이 완료되었습니다. 이제 아이디를 확인할 수 있어요.
          </div>
        ) : null}

        {(firstError || message) ? (
          <p className={`px-1 text-[13px] ${firstError ? "text-[#c43d3d]" : "text-[#5f6f69]"}`}>{firstError || message}</p>
        ) : null}

        {foundLoginId ? (
          <div className="rounded-[20px] border border-[#dfe9e4] bg-[#f6fbf8] px-5 py-4">
            <p className="text-[13px] font-medium text-[#6f6f6f]">가입된 아이디</p>
            <p className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#111111]">{foundLoginId}</p>
            <Link
              href={`/login/reset?loginId=${foundLoginId}`}
              className="mt-4 inline-flex items-center justify-center rounded-[14px] border border-[#1f6b5b] px-4 py-2.5 text-sm font-semibold text-[#1f6b5b]"
            >
              본인인증 후 비밀번호 재설정
            </Link>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !verificationToken}
          className="mt-2 flex h-[52px] w-full items-center justify-center rounded-[18px] bg-[#1f6b5b] text-[18px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting ? "확인 중..." : "아이디 확인하기"}
        </button>
      </form>

      <div className="mt-7 text-center">
        <Link href="/login/reset" className="text-[14px] font-medium text-[#111111] underline underline-offset-4">
          본인인증 후 비밀번호 재설정으로 이동
        </Link>
      </div>
    </div>
  );
}
