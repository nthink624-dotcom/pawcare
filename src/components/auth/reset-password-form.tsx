"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { MobileBackButton } from "@/components/ui/mobile-back-button";
import { getSupabaseRuntimeStage, hasPortoneBrowserEnv } from "@/lib/env";
import { ownerPasswordResetSchema, type OwnerPasswordResetInput } from "@/lib/auth/owner-password-reset";

function FieldShell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block rounded-[18px] border border-[#ddd6cc] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium text-[#7f766c]">{label}</span>
        {hint ? <span className="text-[11px] text-[#9a9085]">{hint}</span> : null}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border-0 bg-transparent p-0 text-[17px] font-medium text-[#111111] outline-none placeholder:text-[#b1a99f] ${props.className ?? ""}`}
    />
  );
}

type ApiMessage = {
  message?: string;
  verificationRequestId?: string | null;
  devVerificationCode?: string | null;
  verificationToken?: string | null;
};

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export default function ResetPasswordForm({
  initialLoginId,
  ready,
}: {
  initialLoginId?: string;
  ready: boolean;
}) {
  const router = useRouter();
  const isDevelopmentFlow = useMemo(() => getSupabaseRuntimeStage() !== "production", []);
  const canShowDevVerificationCode = useMemo(() => getSupabaseRuntimeStage() === "development", []);
  const portoneReady = useMemo(() => hasPortoneBrowserEnv(), []);

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(ready ? null : "로그인 환경을 확인하는 중이에요. 잠시 후 다시 시도해 주세요.");
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
          purpose: "reset-password",
          method: "local",
        }),
      });
      const result = (await response.json()) as ApiMessage;

      if (!response.ok) {
        setMessage(result.message ?? "인증번호를 보내지 못했어요. 다시 시도해 주세요.");
        return;
      }

      setVerificationRequestId(result.verificationRequestId ?? null);
      setDevCode(result.devVerificationCode ?? null);
      setVerificationCode("");
      syncVerificationToken(null);
      setMessage(result.message ?? "인증번호를 보냈어요. 화면에 표시된 번호를 확인해 주세요.");
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
          purpose: "reset-password",
          verificationRequestId,
        }),
      });
      const result = (await response.json()) as ApiMessage;

      if (!response.ok || !result.verificationToken) {
        setMessage(result.message ?? "인증번호를 다시 확인해 주세요.");
        return;
      }

      syncVerificationToken(result.verificationToken);
      setMessage(result.message ?? "본인 확인이 완료되었어요.");
    } finally {
      setLoading(false);
    }
  };

  const verifyPass = async () => {
    const values = getValues();
    if (!portoneReady) {
      setMessage("PASS 본인인증 환경이 아직 준비되지 않았어요.");
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
          purpose: "reset-password",
          method: "portone",
        }),
      });
      const requestResult = (await requestResponse.json()) as ApiMessage;

      if (!requestResponse.ok || !requestResult.verificationRequestId) {
        setMessage(requestResult.message ?? "본인확인 요청을 준비하지 못했어요.");
        return;
      }

      const { requestIdentityVerification } = await import("@portone/browser-sdk/v2");
      const identityVerificationId = `reset_pw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const result = await requestIdentityVerification({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY || process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
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
          purpose: "reset-password",
          verificationRequestId: requestResult.verificationRequestId,
          identityVerificationId: result.identityVerificationId,
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

    if (!verificationToken) {
      setMessage("본인 확인을 먼저 완료해 주세요.");
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

    setMessage(result.message ?? "비밀번호가 변경되었어요. 새 비밀번호로 다시 로그인해 주세요.");
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

  const notice = message ?? firstError;

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 pb-10 pt-6 text-[#111111]">
      <MobileBackButton onClick={() => router.replace("/login")} label="로그인으로 이동" />

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
        <p className="mt-4 text-[15px] leading-6 text-[#6e665d]">
          {isDevelopmentFlow
            ? "개발 환경에서는 화면에 표시되는 인증번호로 본인 확인을 진행해요."
            : "PASS 본인인증을 완료하면 바로 새 비밀번호를 설정할 수 있어요."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-3 rounded-[24px] border border-[#e5ddd3] bg-[#fcfaf7] p-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#7b654d]">
            <ShieldCheck className="h-4 w-4" />
            계정 확인 정보
          </div>

          <FieldShell label="아이디">
            <TextInput
              type="text"
              {...register("loginId")}
              placeholder="아이디를 입력해 주세요"
            />
          </FieldShell>

          <FieldShell label="이름">
            <TextInput
              type="text"
              {...register("name")}
              placeholder="실제 이름을 입력해 주세요"
            />
          </FieldShell>

          <FieldShell label="생년월일" hint="숫자 8자리">
            <TextInput
              type="text"
              inputMode="numeric"
              maxLength={8}
              {...register("birthDate")}
              placeholder="예: 19990321"
            />
          </FieldShell>

          <FieldShell label="휴대폰 번호">
            <TextInput
              type="text"
              inputMode="numeric"
              maxLength={11}
              {...register("phoneNumber")}
              placeholder="숫자만 입력해 주세요"
            />
          </FieldShell>
        </div>

        <div className="space-y-3 rounded-[24px] border border-[#e5ddd3] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[#7b654d]">본인 확인</p>
              <p className="mt-1 text-[13px] leading-5 text-[#7f766c]">
                {isDevelopmentFlow
                  ? "개발 환경에서는 인증번호를 받아 바로 확인할 수 있어요."
                  : "PASS로 본인 확인을 완료해 주세요."}
              </p>
            </div>
            {verificationToken ? (
              <span className="rounded-full bg-[#edf7f3] px-3 py-1 text-[12px] font-semibold text-[#1f6b5b]">인증 완료</span>
            ) : null}
          </div>

          {isDevelopmentFlow ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={requestCode}
                disabled={loading}
                className="flex h-[50px] w-full items-center justify-center rounded-[16px] border border-[#d8d0c5] bg-[#fcfaf7] text-[15px] font-semibold text-[#111111] disabled:opacity-60"
              >
                {verificationRequestId ? "인증번호 다시 받기" : "인증번호 받기"}
              </button>

              {verificationRequestId ? (
                <>
                  <FieldShell label="인증번호">
                    <TextInput
                      type="text"
                      inputMode="numeric"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6자리 숫자를 입력해 주세요"
                    />
                  </FieldShell>

                  {canShowDevVerificationCode && devCode ? (
                    <div className="rounded-[16px] bg-[#f7f2eb] px-4 py-3 text-[13px] leading-5 text-[#6f665d]">
                      개발용 인증번호: <span className="font-semibold text-[#111111]">{devCode}</span>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={loading || verificationCode.length !== 6}
                    className="flex h-[50px] w-full items-center justify-center rounded-[16px] bg-[#1f6b5b] text-[15px] font-semibold text-white disabled:opacity-60"
                  >
                    인증 확인
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={verifyPass}
              disabled={loading}
              className="flex h-[52px] w-full items-center justify-center rounded-[16px] border border-[#d3e6df] bg-[#f1faf7] text-[15px] font-semibold text-[#1f6b5b] disabled:opacity-60"
            >
              PASS로 본인 확인하기
            </button>
          )}
        </div>

        <div className={`space-y-3 rounded-[24px] border border-[#e5ddd3] bg-white p-4 ${verificationToken ? "" : "opacity-60"}`}>
          <div>
            <p className="text-[13px] font-semibold text-[#7b654d]">새 비밀번호</p>
            <p className="mt-1 text-[13px] leading-5 text-[#7f766c]">본인 확인이 끝나면 새 비밀번호로 바로 바꿀 수 있어요.</p>
          </div>

          <FieldShell label="비밀번호">
            <div className="flex items-center gap-3">
              <TextInput
                type={showPassword ? "text" : "password"}
                {...register("password")}
                placeholder="새 비밀번호를 입력해 주세요"
                disabled={!verificationToken}
              />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="shrink-0 text-[#615d57]">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </FieldShell>

          <FieldShell label="비밀번호 확인">
            <div className="flex items-center gap-3">
              <TextInput
                type={showPasswordConfirm ? "text" : "password"}
                {...register("passwordConfirm")}
                placeholder="비밀번호를 한 번 더 입력해 주세요"
                disabled={!verificationToken}
              />
              <button type="button" onClick={() => setShowPasswordConfirm((prev) => !prev)} className="shrink-0 text-[#615d57]">
                {showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </FieldShell>
        </div>

        {notice ? <p className="px-1 text-[13px] leading-6 text-[#d34b4b]">{notice}</p> : null}

        <button
          type="submit"
          disabled={loading || isSubmitting || !verificationToken}
          className="flex h-[54px] w-full items-center justify-center rounded-[18px] bg-[#1f6b5b] text-[17px] font-semibold text-white disabled:opacity-60"
        >
          비밀번호 재설정하기
        </button>
      </form>

      <div className="mt-8 text-center text-[14px] text-[#8b847b]">
        로그인 화면으로 돌아가시려면{" "}
        <Link href="/login" replace className="font-semibold text-[#111111] underline underline-offset-4">
          여기로 이동해 주세요
        </Link>
      </div>
    </div>
  );
}
