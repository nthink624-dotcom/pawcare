"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Eye, EyeOff, Smartphone, Sparkles } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { MobileBackButton } from "@/components/ui/mobile-back-button";
import { env, getSupabaseRuntimeStage, hasPortoneBrowserEnv } from "@/lib/env";
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
    <label className="flex min-h-[60px] items-center gap-4 border-b border-[#edf1f5] py-3.5 last:border-b-0">
      <div className="w-[96px] shrink-0">
        <span className="block text-[14px] font-semibold leading-5 text-[#4d6077]">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12px] font-medium leading-4 text-[#8090a4]">{hint}</span> : null}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border-0 bg-transparent p-0 text-[16px] font-medium leading-6 text-[#111827] outline-none placeholder:font-medium placeholder:text-[#aab5c4] disabled:cursor-not-allowed disabled:text-[#94a3b8] ${props.className ?? ""}`}
    />
  );
}

type ApiMessage = {
  message?: string;
  verificationRequestId?: string | null;
  devVerificationCode?: string | null;
  verificationToken?: string | null;
};

type ResetStep = "account" | "method" | "code" | "password";
const successMessagePatterns = ["완료", "변경", "보냈어요", "준비했어요", "확인했어요"];

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
  const useLocalVerificationFlow = isDevelopmentFlow && !portoneReady;

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
  const [step, setStep] = useState<ResetStep>("account");

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    trigger,
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
    if (token) {
      setStep("password");
    }
  };

  const goBack = () => {
    setMessage(null);
    if (step === "account") {
      router.replace("/login");
      return;
    }

    if (step === "password") {
      setStep(useLocalVerificationFlow ? "code" : "method");
      return;
    }

    if (step === "code") {
      setStep("method");
      return;
    }

    setStep("account");
  };

  const goToMethodStep = async () => {
    const isValid = await trigger("loginId");
    if (!isValid) return;
    setMessage(null);
    setStep("method");
  };

  const requestCode = async () => {
    const values = getValues();
    if (!values.loginId?.trim()) {
      setMessage("아이디를 먼저 입력해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/request-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: values.loginId,
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
      setStep("code");
      setMessage(result.message ?? "인증번호를 보냈어요. 화면에 표시된 번호를 입력해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    const values = getValues();
    if (!values.loginId?.trim()) {
      setMessage("아이디를 먼저 입력해 주세요.");
      return;
    }

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
          loginId: values.loginId,
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
    if (!values.loginId?.trim()) {
      setMessage("아이디를 먼저 입력해 주세요.");
      return;
    }

    if (!portoneReady || !env.portoneStoreId || !env.portoneIdentityKcpChannelKey) {
      setMessage("KCP 휴대폰 본인인증 채널이 아직 연결되지 않았어요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const requestResponse = await fetch("/api/auth/request-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: values.loginId,
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
      const identityVerificationId = `resetpw${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

      const result = await requestIdentityVerification({
        storeId: env.portoneStoreId,
        channelKey: env.portoneIdentityKcpChannelKey,
        identityVerificationId,
        windowType: { pc: "POPUP", mobile: "POPUP" },
      });

      if (!result?.identityVerificationId) {
        setMessage("휴대폰 본인인증이 완료되지 않았어요.");
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
        setMessage(verifyResult.message ?? "휴대폰 본인인증 확인에 실패했어요.");
        return;
      }

      syncVerificationToken(verifyResult.verificationToken);
      setMessage(verifyResult.message ?? "휴대폰 본인인증이 완료됐어요. 새 비밀번호를 입력해 주세요.");
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
    errors.password?.message ||
    errors.passwordConfirm?.message;

  const isSuccessMessage = Boolean(message && successMessagePatterns.some((pattern) => message.includes(pattern)));
  const passwordNotice = step === "password" ? errors.password?.message ?? errors.passwordConfirm?.message : null;
  const notice = step === "password" ? (isSuccessMessage ? null : message) : firstError ?? (isSuccessMessage ? null : message);
  const pageTitle =
    step === "method"
      ? "본인 확인"
      : step === "code"
        ? "인증번호 입력"
        : step === "password"
          ? "새 비밀번호 설정"
          : "비밀번호 찾기";
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white px-5 pb-8 pt-5 text-[#111827]">
      <div className="relative flex h-10 items-center justify-center">
        <MobileBackButton
          onClick={goBack}
          label={step === "account" ? "로그인으로 이동" : "이전 단계"}
          className="absolute left-0 h-10 w-10 border-0 bg-transparent text-[#111827] shadow-none hover:bg-[#f8fafc]"
        />
        <h1 className="text-[18px] font-semibold leading-6 tracking-[-0.02em] text-[#111827]">{pageTitle}</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <div className="flex-1 pt-8">
          {step === "account" ? (
            <section>
              <p className="mt-4 block w-full min-w-0 whitespace-nowrap text-[17px] font-semibold leading-7 text-[#111827]">
                가입할 때 사용한 아이디를 입력해 주세요.
              </p>

              <label className="mt-7 block">
                <span className="mb-2 block text-[13px] font-semibold text-[#4d6077]">아이디</span>
                <input
                  type="text"
                  {...register("loginId")}
                  autoComplete="username"
                  placeholder="가입한 아이디"
                  className="h-[54px] w-full rounded-[8px] border border-[#d7e0e9] bg-white px-4 text-[16px] font-medium text-[#111827] outline-none transition placeholder:text-[#aab5c4] focus:border-[#247761] focus:ring-2 focus:ring-[#247761]/10"
                />
              </label>
            </section>
          ) : null}

          {step === "method" ? (
            <section>
              <h1 className="mt-4 whitespace-nowrap text-[26px] font-semibold leading-[1.2] tracking-[-0.03em] text-[#111827]">
                인증 방법을 선택해주세요
              </h1>
              <p className="mt-4 w-full max-w-none break-keep text-[14px] leading-6 text-[#667589]">
                가입 정보와 인증 결과가 일치하면 비밀번호를 바꿀 수 있어요.
              </p>

              <div className="mt-7 space-y-3">
                <button
                  type="button"
                  onClick={useLocalVerificationFlow ? requestCode : verifyPass}
                  disabled={loading}
                  className="flex h-[58px] w-full items-center gap-3 rounded-[10px] border border-[#d7e0e9] bg-white px-4 text-left transition hover:border-[#247761] hover:bg-[#f7fbf9] active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#eef7f4] text-[#247761]">
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-[#111827]">
                      {useLocalVerificationFlow ? "개발용 인증번호" : "휴대폰 본인인증"}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-medium text-[#8090a4]">
                      {useLocalVerificationFlow ? "가입 정보로 테스트 인증번호를 확인해요" : "KCP/PASS로 본인 여부를 확인해요"}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-[#94a3b8]" />
                </button>

                <button
                  type="button"
                  disabled
                  className="flex h-[58px] w-full items-center gap-3 rounded-[10px] border border-[#e3e9f0] bg-[#fbfcfd] px-4 text-left opacity-70"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#94a3b8]">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-[#64748b]">간편인증</span>
                    <span className="mt-0.5 block text-[12px] font-medium text-[#94a3b8]">카카오, 네이버, 토스 인증은 추후 제공 예정</span>
                  </span>
                  <span className="rounded-full bg-[#eef2f6] px-2 py-1 text-[11px] font-semibold text-[#7a8797]">준비중</span>
                </button>
              </div>
            </section>
          ) : null}

          {step === "code" ? (
            <section>
              <h1 className="mt-4 whitespace-nowrap text-[26px] font-semibold leading-[1.2] tracking-[-0.03em] text-[#111827]">
                인증번호를 입력해주세요
              </h1>
              <p className="mt-4 text-[14px] leading-6 text-[#667589]">
                인증번호는 5분간 유지됩니다.
                <br />
                인증번호 6자리 숫자를 입력해주세요.
              </p>

              <label className="mt-7 block">
                <span className="mb-2 block text-[13px] font-semibold text-[#4d6077]">인증번호</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6자리 숫자"
                  className="h-[54px] w-full rounded-[8px] border border-[#d7e0e9] bg-white px-4 text-[18px] font-semibold tracking-[0.08em] text-[#111827] outline-none transition placeholder:text-[16px] placeholder:font-medium placeholder:tracking-normal placeholder:text-[#aab5c4] focus:border-[#247761] focus:ring-2 focus:ring-[#247761]/10"
                />
              </label>

              {canShowDevVerificationCode && devCode ? (
                <div className="mt-4 rounded-[10px] border border-[#d7e0e9] bg-[#fbfcfd] px-4 py-3 text-[13px] leading-5 text-[#64748b]">
                  개발용 인증번호: <span className="font-bold text-[#17130f]">{devCode}</span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={requestCode}
                disabled={loading}
                className="mt-4 text-[13px] font-semibold text-[#247761] disabled:opacity-60"
              >
                인증번호 다시 받기
              </button>
            </section>
          ) : null}

          {step === "password" ? (
            <section>
              <h1 className="mt-4 whitespace-nowrap text-[26px] font-semibold leading-[1.2] tracking-[-0.03em] text-[#111827]">
                새 비밀번호를 설정해 주세요
              </h1>
              <p className="mt-4 max-w-[340px] text-[14px] leading-6 text-[#667589]">
                본인 확인이 완료 됐어요.
              </p>

              <div className="mt-6 rounded-[12px] border border-[#d7e0e9] bg-white px-4 py-1">
                <FieldShell label="새 비밀번호">
                  <div className="flex items-center gap-3">
                    <TextInput
                      type={showPassword ? "text" : "password"}
                      {...register("password")}
                      placeholder="새 비밀번호 입력"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="shrink-0 rounded-[8px] p-1 text-[#64748b] transition hover:bg-[#f8fafc]"
                      aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </FieldShell>

                <FieldShell label="비밀번호 확인">
                  <div className="flex items-center gap-3">
                    <TextInput
                      type={showPasswordConfirm ? "text" : "password"}
                      {...register("passwordConfirm")}
                      placeholder="한 번 더 입력"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm((prev) => !prev)}
                      className="shrink-0 rounded-[8px] p-1 text-[#64748b] transition hover:bg-[#f8fafc]"
                      aria-label={showPasswordConfirm ? "비밀번호 확인 숨기기" : "비밀번호 확인 보기"}
                    >
                      {showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </FieldShell>
              </div>
              {passwordNotice ? <p className="mt-3 text-[12px] leading-5 text-[#9f5b52]">{passwordNotice}</p> : null}
            </section>
          ) : null}
        </div>

        {notice ? (
          <p className="mb-3 rounded-[10px] border border-[#fecaca] bg-white px-4 py-3 text-[13px] leading-5 text-[#c7493f]">{notice}</p>
        ) : null}

        {step === "account" ? (
          <button
            type="button"
            onClick={goToMethodStep}
            disabled={loading}
            className="flex h-[56px] w-full items-center justify-center rounded-[10px] bg-[#247761] text-[17px] font-semibold text-white transition active:scale-[0.99] disabled:bg-[#cbd5e1]"
          >
            다음
          </button>
        ) : null}

        {step === "code" ? (
          <button
            type="button"
            onClick={verifyCode}
            disabled={loading || verificationCode.length !== 6}
            className="flex h-[56px] w-full items-center justify-center rounded-[10px] bg-[#247761] text-[17px] font-semibold text-white transition active:scale-[0.99] disabled:bg-[#cbd5e1]"
          >
            인증 확인
          </button>
        ) : null}

        {step === "password" ? (
          <button
            type="submit"
            disabled={loading || isSubmitting || !verificationToken}
            className="flex h-[56px] w-full items-center justify-center rounded-[10px] bg-[#247761] text-[17px] font-semibold text-white transition active:scale-[0.99] disabled:bg-[#cbd5e1]"
          >
            비밀번호 변경
          </button>
        ) : null}
      </form>

      <div className="mt-7 text-center text-[14px] text-[#64748b]">
        로그인 화면으로 돌아가려면{" "}
        <Link href="/login" replace className="font-bold text-[#17130f] underline underline-offset-4">
          여기로 이동해 주세요
        </Link>
      </div>
    </div>
  );
}
