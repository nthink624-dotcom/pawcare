"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
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
    <label className="block rounded-[18px] border border-[#e6ddd3] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(67,55,43,0.04)] transition focus-within:border-[#247761] focus-within:shadow-[0_0_0_3px_rgba(36,119,97,0.09)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-[#7f6f61]">{label}</span>
        {hint ? <span className="text-[11px] font-medium text-[#a89b8e]">{hint}</span> : null}
      </div>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border-0 bg-transparent p-0 text-[17px] font-semibold text-[#151311] outline-none placeholder:text-[#c2b7ac] disabled:cursor-not-allowed disabled:text-[#aaa198] ${props.className ?? ""}`}
    />
  );
}

function VerificationCompleteIcon() {
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e5f4ef] text-[#1f735f]">
      <div className="absolute inset-1 rounded-full border border-[#b7dfd2]" />
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#247761] text-white shadow-[0_8px_18px_rgba(36,119,97,0.24)]">
        <Check className="h-4 w-4" strokeWidth={3} />
      </div>
    </div>
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
  const [message, setMessage] = useState<string | null>(
    ready ? null : "로그인 환경을 확인하는 중이에요. 잠시 후 다시 시도해 주세요.",
  );
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
      setMessage(result.message ?? "인증번호를 보냈어요. 화면에 표시된 번호를 입력해 주세요.");
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
      setMessage(result.message ?? "본인 확인이 완료됐어요. 새 비밀번호를 입력해 주세요.");
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
        setMessage("PASS 본인인증이 완료되지 않았어요.");
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
      setMessage(verifyResult.message ?? "PASS 본인인증이 완료됐어요. 새 비밀번호를 입력해 주세요.");
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

    setMessage(result.message ?? "비밀번호가 변경됐어요. 새 비밀번호로 다시 로그인해 주세요.");
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
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fbf8f2] px-5 pb-10 pt-5 text-[#151311]">
      <MobileBackButton onClick={() => router.replace("/login")} label="로그인으로 이동" />

      <div className="mt-7 rounded-[28px] bg-[#fffdf9] px-5 pb-6 pt-5 shadow-[0_20px_60px_rgba(66,50,33,0.08)] ring-1 ring-[#eee4d8]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold text-[#247761]">비밀번호 찾기</p>
            <h1 className="mt-3 text-[28px] font-bold leading-[1.18] text-[#17130f]">
              본인 확인 후
              <br />새 비밀번호를
              <br />설정해요
            </h1>
          </div>
          <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[20px] bg-[#ecf6f1] text-[#247761]">
            <KeyRound className="h-7 w-7" strokeWidth={2} />
          </div>
        </div>
        <p className="mt-4 text-[14px] leading-6 text-[#75695e]">
          가입한 계정 정보를 확인한 뒤 본인 인증이 완료되면 새 비밀번호 입력란이 열립니다.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <section className="space-y-3 rounded-[24px] border border-[#eadfd3] bg-[#fffdf9] p-4 shadow-[0_14px_36px_rgba(66,50,33,0.06)]">
          <div className="flex items-center gap-2 text-[13px] font-bold text-[#7a5c43]">
            <ShieldCheck className="h-4 w-4" />
            계정 확인 정보
          </div>

          <FieldShell label="아이디">
            <TextInput type="text" {...register("loginId")} placeholder="가입한 아이디" />
          </FieldShell>

          <FieldShell label="이름">
            <TextInput type="text" {...register("name")} placeholder="실명 입력" />
          </FieldShell>

          <FieldShell label="생년월일" hint="8자리">
            <TextInput type="text" inputMode="numeric" maxLength={8} {...register("birthDate")} placeholder="예: 19960624" />
          </FieldShell>

          <FieldShell label="휴대폰번호">
            <TextInput type="text" inputMode="numeric" maxLength={11} {...register("phoneNumber")} placeholder="숫자만 입력" />
          </FieldShell>
        </section>

        <section className="space-y-4 rounded-[24px] border border-[#eadfd3] bg-white p-4 shadow-[0_14px_36px_rgba(66,50,33,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-bold text-[#7a5c43]">본인 확인</p>
              <p className="mt-1 text-[13px] leading-5 text-[#7c7065]">
                {isDevelopmentFlow
                  ? "개발 환경에서는 인증번호로 확인할 수 있어요."
                  : "PASS 본인인증을 완료해 주세요."}
              </p>
            </div>
            {verificationToken ? (
              <div className="flex items-center gap-2 rounded-full bg-[#ecf6f1] py-1 pl-1 pr-3 text-[12px] font-bold text-[#1f735f]">
                <VerificationCompleteIcon />
                인증 완료
              </div>
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f7f1ea] text-[#9b8069]">
                <Smartphone className="h-5 w-5" />
              </div>
            )}
          </div>

          {isDevelopmentFlow ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={requestCode}
                disabled={loading}
                className="flex h-[54px] w-full items-center justify-center rounded-[18px] border border-[#d8cbbb] bg-[#fffaf4] text-[16px] font-bold text-[#17130f] transition active:scale-[0.99] disabled:opacity-60"
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
                      placeholder="6자리 숫자"
                    />
                  </FieldShell>

                  {canShowDevVerificationCode && devCode ? (
                    <div className="rounded-[18px] bg-[#f7f1ea] px-4 py-3 text-[13px] leading-5 text-[#6f6257]">
                      개발용 인증번호: <span className="font-bold text-[#17130f]">{devCode}</span>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={loading || verificationCode.length !== 6}
                    className="flex h-[54px] w-full items-center justify-center rounded-[18px] bg-[#247761] text-[16px] font-bold text-white shadow-[0_12px_26px_rgba(36,119,97,0.22)] transition active:scale-[0.99] disabled:opacity-60"
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
              className="flex h-[54px] w-full items-center justify-center rounded-[18px] border border-[#cae1d8] bg-[#eff9f5] text-[16px] font-bold text-[#1f735f] transition active:scale-[0.99] disabled:opacity-60"
            >
              PASS 본인인증
            </button>
          )}
        </section>

        {verificationToken ? (
          <section className="space-y-3 rounded-[24px] border border-[#cae1d8] bg-[#f8fffb] p-4 shadow-[0_16px_40px_rgba(36,119,97,0.1)]">
            <div className="flex items-start gap-3">
              <VerificationCompleteIcon />
              <div>
                <p className="text-[13px] font-bold text-[#1f735f]">인증 완료</p>
                <p className="mt-1 text-[13px] leading-5 text-[#65766e]">이제 새 비밀번호를 입력할 수 있어요.</p>
              </div>
            </div>

            <FieldShell label="새 비밀번호">
              <div className="flex items-center gap-3">
                <TextInput
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="새 비밀번호 입력"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="shrink-0 rounded-full p-1 text-[#70675f] transition hover:bg-[#f2eee8]"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </FieldShell>

            <FieldShell label="새 비밀번호 확인">
              <div className="flex items-center gap-3">
                <TextInput
                  type={showPasswordConfirm ? "text" : "password"}
                  {...register("passwordConfirm")}
                  placeholder="한 번 더 입력"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm((prev) => !prev)}
                  className="shrink-0 rounded-full p-1 text-[#70675f] transition hover:bg-[#f2eee8]"
                  aria-label={showPasswordConfirm ? "비밀번호 확인 숨기기" : "비밀번호 확인 보기"}
                >
                  {showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </FieldShell>
          </section>
        ) : (
          <section className="flex items-center gap-3 rounded-[22px] border border-dashed border-[#decfbe] bg-[#f7f1ea] px-4 py-4 text-[#8a7868]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#9b8069]">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#7a5c43]">새 비밀번호 입력 잠김</p>
              <p className="mt-1 text-[12px] leading-5">본인 확인이 완료되면 입력 영역이 열립니다.</p>
            </div>
          </section>
        )}

        {notice ? (
          <p className="rounded-[16px] bg-[#fff2f0] px-4 py-3 text-[13px] leading-5 text-[#c7493f]">{notice}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading || isSubmitting || !verificationToken}
          className="flex h-[56px] w-full items-center justify-center rounded-[20px] bg-[#247761] text-[17px] font-bold text-white shadow-[0_14px_30px_rgba(36,119,97,0.24)] transition active:scale-[0.99] disabled:bg-[#c7beb4] disabled:shadow-none"
        >
          비밀번호 재설정
        </button>
      </form>

      <div className="mt-7 text-center text-[14px] text-[#8b7f73]">
        로그인 화면으로 돌아가려면{" "}
        <Link href="/login" replace className="font-bold text-[#17130f] underline underline-offset-4">
          여기로 이동해 주세요
        </Link>
      </div>
    </div>
  );
}
