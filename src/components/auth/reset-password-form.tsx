"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { env, hasPortoneBrowserEnv } from "@/lib/env";
import { ownerPasswordResetSchema, type OwnerPasswordResetInput } from "@/lib/auth/owner-password-reset";

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block rounded-[18px] border border-[#ddd6cc] bg-white px-4 py-3">
      <span className="block text-[12px] font-medium text-[#7f766c]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

type ApiMessage = {
  message?: string;
  challengeToken?: string | null;
  devVerificationCode?: string | null;
  verificationToken?: string | null;
};

export default function ResetPasswordForm({
  initialLoginId,
  ready,
}: {
  initialLoginId?: string;
  ready: boolean;
}) {
  const router = useRouter();
  const portoneReady = useMemo(() => hasPortoneBrowserEnv(), []);

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(ready ? null : "로그인 환경 확인 중이에요. 잠시 후 다시 시도해 주세요.");
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
  } = useForm<OwnerPasswordResetInput>({
    resolver: zodResolver(ownerPasswordResetSchema),
    defaultValues: {
      loginId: initialLoginId ?? "",
      name: "",
      birthDate: "",
      phoneNumber: "",
      identityVerificationToken: "",
      password: "",
      passwordConfirm: "",
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
      const result = (await response.json()) as ApiMessage;

      if (!response.ok) {
        setMessage(result.message ?? "인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      setChallengeToken(result.challengeToken ?? null);
      setDevCode(result.devVerificationCode ?? null);
      syncVerificationToken(null);
      setMessage(result.message ?? "인증번호를 보냈어요. 문자 메시지를 확인해 주세요.");
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
      const result = (await response.json()) as ApiMessage;

      if (!response.ok || !result.verificationToken) {
        setMessage(result.message ?? "인증번호를 다시 확인해 주세요.");
        return;
      }

      syncVerificationToken(result.verificationToken);
      setMessage(result.message ?? "본인 인증이 완료되었어요.");
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
      const identityVerificationId = `reset_pw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
      const verifyResult = (await response.json()) as ApiMessage;

      if (!response.ok || !verifyResult.verificationToken) {
        setMessage(verifyResult.message ?? "PASS 본인인증 확인에 실패했어요.");
        return;
      }

      syncVerificationToken(verifyResult.verificationToken);
      setMessage(verifyResult.message ?? "PASS 본인인증이 완료되었어요.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!ready) {
      setMessage("로그인 환경을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setMessage(null);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const result = (await response.json()) as ApiMessage;
    if (!response.ok) {
      setMessage(result.message ?? "비밀번호를 재설정하지 못했어요.");
      return;
    }

    setMessage(result.message ?? "비밀번호가 변경되었어요. 다시 로그인해 주세요.");
    window.setTimeout(() => {
      router.replace("/login?message=reset-success");
      router.refresh();
    }, 900);
  });

  const firstError =
    errors.loginId?.message ||
    errors.name?.message ||
    errors.birthDate?.message ||
    errors.phoneNumber?.message ||
    errors.identityVerificationToken?.message ||
    errors.password?.message ||
    errors.passwordConfirm?.message;

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 pb-10 pt-6 text-[#111111]">
      <button
        type="button"
        onClick={() => router.replace("/login")}
        className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#faf8f4] text-[#111111]"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.1} />
      </button>

      <div className="mt-8 flex h-[56px] w-[56px] items-center justify-center rounded-[18px] bg-[#f4efe3] text-[#7b654d]">
        <KeyRound className="h-7 w-7" strokeWidth={1.9} />
      </div>

      <div className="mt-7">
        <p className="text-[14px] font-semibold text-[#7b654d]">비밀번호 재설정</p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.05em] text-[#111111]">
          본인 확인 후
          <br />
          새 비밀번호를 설정해 주세요
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-[#6e665d]">
          가입 정보와 본인 인증이 완료되면
          <br />
          새로운 비밀번호로 바로 변경할 수 있어요.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-3.5">
        <FieldShell label="아이디">
          <input
            type="text"
            {...register("loginId")}
            placeholder="아이디를 입력해 주세요"
            className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b1a99f]"
          />
        </FieldShell>

        <FieldShell label="이름">
          <input
            type="text"
            {...register("name")}
            placeholder="이름을 입력해 주세요"
            className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b1a99f]"
          />
        </FieldShell>

        <FieldShell label="생년월일 8자리">
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            {...register("birthDate")}
            placeholder="예: 19990321"
            className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b1a99f]"
          />
        </FieldShell>

        <FieldShell label="휴대폰번호">
          <input
            type="text"
            inputMode="numeric"
            maxLength={11}
            {...register("phoneNumber")}
            placeholder="숫자만 입력해 주세요"
            className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b1a99f]"
          />
        </FieldShell>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={requestCode}
            disabled={loading}
            className="flex h-[48px] items-center justify-center rounded-[16px] border border-[#ddd6cc] bg-white text-[15px] font-semibold text-[#111111] disabled:opacity-60"
          >
            {challengeToken ? "인증번호 다시 받기" : "인증번호 받기"}
          </button>
          <button
            type="button"
            onClick={verifyPass}
            disabled={loading}
            className="flex h-[48px] items-center justify-center rounded-[16px] border border-[#cfe3dc] bg-[#f4fbf8] text-[15px] font-semibold text-[#1f6b5b] disabled:opacity-60"
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
                className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b1a99f]"
              />
            </FieldShell>

            {devCode ? <p className="px-1 text-[12px] leading-5 text-[#7f766c]">로컬 테스트용 인증번호: {devCode}</p> : null}

            <button
              type="button"
              onClick={verifyCode}
              disabled={loading}
              className="flex h-[50px] w-full items-center justify-center rounded-[16px] bg-[#1f6b5b] text-[16px] font-semibold text-white disabled:opacity-60"
            >
              인증 확인
            </button>
          </>
        ) : null}

        {verificationToken ? (
          <div className="rounded-[18px] border border-[#d8e9e2] bg-[#f5fbf8] px-4 py-3 text-[14px] font-medium text-[#1f6b5b]">
            본인 인증이 완료되었어요. 새 비밀번호를 입력해 주세요.
          </div>
        ) : null}

        <FieldShell label="새 비밀번호">
          <div className="flex items-center gap-3">
            <input
              type={showPassword ? "text" : "password"}
              {...register("password")}
              placeholder="새 비밀번호를 입력해 주세요"
              className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b1a99f]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="shrink-0 text-[#7f766c]"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
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
              className="w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b1a99f]"
            />
            <button
              type="button"
              onClick={() => setShowPasswordConfirm((prev) => !prev)}
              className="shrink-0 text-[#7f766c]"
              aria-label={showPasswordConfirm ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </FieldShell>

        {(firstError || message) ? (
          <p className={`px-1 text-[13px] ${firstError ? "text-[#c43d3d]" : "text-[#6e665d]"}`}>{firstError || message}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !ready || !verificationToken}
          className="flex h-[52px] w-full items-center justify-center rounded-[16px] bg-[#1f6b5b] text-[17px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting ? "변경 중..." : "비밀번호 변경하기"}
        </button>
      </form>

      <div className="mt-7 text-center">
        <Link href="/login/find-id" replace className="text-[14px] font-medium text-[#111111] underline underline-offset-4">
          아이디 찾기로 이동
        </Link>
      </div>
    </div>
  );
}
