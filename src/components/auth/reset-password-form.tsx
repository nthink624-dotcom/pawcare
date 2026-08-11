"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { MobileBackButton } from "@/components/ui/mobile-back-button";
import { env, hasPortoneBrowserEnv } from "@/lib/env";
import { ownerPasswordResetSchema, type OwnerPasswordResetInput } from "@/lib/auth/owner-password-reset";
import { requestPortoneIdentityVerification } from "@/lib/portone/identity-verification-client";

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
    <label className="mb-4 block">
      <span className="mb-2 block text-[14px] font-semibold leading-5 text-[#7184a6]">{label}</span>
      {hint ? <span className="-mt-1 mb-2 block text-[12px] font-medium leading-4 text-[#9aadd0]">{hint}</span> : null}
      <div className="min-w-0">{children}</div>
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-[58px] w-full rounded-[12px] border border-[#dbe5f6] bg-[#eaf1ff] px-4 text-[16px] font-medium leading-6 text-[#111827] outline-none transition-[border-color,box-shadow,background-color] placeholder:font-medium placeholder:text-[#a3b4d0] focus:border-[#15213b] focus:bg-[#eef4ff] focus:shadow-[0_0_0_3px_rgba(21,33,59,0.08)] disabled:cursor-not-allowed disabled:text-[#94a3b8] ${props.className ?? ""}`}
    />
  );
}

type ApiMessage = {
  available?: boolean;
  message?: string;
  verificationRequestId?: string | null;
  verificationToken?: string | null;
};

type ResetStep = "account" | "preparing" | "password";
const successMessagePatterns = ["완료", "변경", "보냈어요", "준비했어요", "확인했어요"];

export default function ResetPasswordForm({
  initialEmail,
  ready,
}: {
  initialEmail?: string;
  ready: boolean;
}) {
  const router = useRouter();
  const portoneReady = hasPortoneBrowserEnv();

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(
    ready ? null : "로그인 환경을 확인하는 중이에요. 잠시 후 다시 시도해 주세요.",
  );
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
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
      email: initialEmail ?? "",
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
      syncVerificationToken(null);
      setStep("account");
      return;
    }

    setStep("account");
  };

  const startIdentityVerification = async () => {
    const isValid = await trigger("email");
    if (!isValid) return;
    const values = getValues();

    setLoading(true);
    setMessage(null);

    try {
      const emailCheckResponse = await fetch(`/api/auth/check-email?email=${encodeURIComponent(values.email)}`);
      const emailCheck = (await emailCheckResponse.json().catch(() => ({}))) as ApiMessage;

      if (!emailCheckResponse.ok) {
        setMessage("이메일을 확인하는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      if (emailCheck.available) {
        setMessage("입력한 이메일을 확인해 주세요.");
        return;
      }

      if (!portoneReady || !env.portoneStoreId || !env.portoneIdentityKcpChannelKey) {
        setMessage("KCP 휴대폰 본인인증 채널이 아직 연결되지 않았어요.");
        return;
      }

      setStep("preparing");
      const requestResponse = await fetch("/api/auth/request-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          purpose: "reset-password",
          method: "portone",
        }),
      });
      const requestResult = (await requestResponse.json()) as ApiMessage;

      if (!requestResponse.ok || !requestResult.verificationRequestId) {
        setMessage(requestResult.message ?? "본인확인 요청을 준비하지 못했어요.");
        setStep("account");
        return;
      }

      const identityVerificationId = `resetpw${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

      const result = await requestPortoneIdentityVerification({
        storeId: env.portoneStoreId,
        channelKey: env.portoneIdentityKcpChannelKey,
        identityVerificationId,
        windowType: { pc: "POPUP", mobile: "POPUP" },
      });

      if (!result?.identityVerificationId) {
        setMessage("휴대폰 본인인증이 완료되지 않았어요.");
        setStep("account");
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
        setStep("account");
        return;
      }

      syncVerificationToken(verifyResult.verificationToken);
      setMessage(verifyResult.message ?? "휴대폰 본인인증이 완료됐어요. 새 비밀번호를 입력해 주세요.");
    } catch {
      setMessage("본인인증을 진행하는 중 문제가 발생했어요. 다시 시도해 주세요.");
      setStep("account");
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
    errors.email?.message ||
    errors.password?.message ||
    errors.passwordConfirm?.message;

  const isSuccessMessage = Boolean(message && successMessagePatterns.some((pattern) => message.includes(pattern)));
  const passwordNotice = step === "password" ? errors.password?.message ?? errors.passwordConfirm?.message : null;
  const notice = step === "password" ? (isSuccessMessage ? null : message) : firstError ?? (isSuccessMessage ? null : message);
  const pageTitle =
    step === "preparing"
      ? "본인인증"
      : step === "password"
          ? "새 비밀번호 설정"
          : "비밀번호 찾기";
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#f1f3f7] px-5 py-8 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#111827] antialiased sm:px-6 sm:py-12">
      <div className="w-full max-w-[448px] rounded-[32px] bg-white px-8 pb-11 pt-9 shadow-[0_24px_64px_rgba(15,23,42,0.1)]">
      <div className="relative flex h-10 items-center justify-center">
        <MobileBackButton
          onClick={goBack}
          disabled={step === "preparing"}
          label={step === "account" ? "로그인으로 이동" : "이전 단계"}
          className="absolute left-0 h-10 w-10 border-0 bg-transparent text-[#111827] shadow-none hover:bg-[#f8fafc] disabled:pointer-events-none disabled:opacity-0"
        />
        <h1 className="text-[24px] font-extrabold leading-6 tracking-[-0.04em] text-[#101a31]">{pageTitle}</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <div className="flex-1 pt-8">
          {step === "account" ? (
            <section>
              <label className="mt-7 block">
                <span className="mb-2 block text-[13px] font-semibold text-[#4d6077]">이메일</span>
                <input
                  type="email"
                  {...register("email")}
                  autoComplete="email"
                  placeholder="가입한 이메일"
                  className="h-[58px] w-full rounded-[12px] border border-[#dbe5f6] bg-[#eaf1ff] px-4 text-[16px] font-medium text-[#111827] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#a3b4d0] focus:border-[#15213b] focus:bg-[#eef4ff] focus:shadow-[0_0_0_3px_rgba(21,33,59,0.08)]"
                />
              </label>
            </section>
          ) : null}

          {step === "preparing" ? (
            <section className="flex min-h-[292px] flex-col items-center justify-center text-center" aria-live="polite">
              <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#dbe5f6] border-t-[#111a30]" aria-hidden="true" />
              <h2 className="mt-7 text-[22px] font-extrabold tracking-[-0.04em] text-[#101a31]">본인인증을 준비 중입니다.</h2>
              <p className="mt-3 break-keep text-[15px] leading-6 text-[#7184a6]">잠시만 기다리시면 KCP 본인인증 창이 열립니다.</p>
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

        {notice && step !== "preparing" ? (
          <p className="mt-4 mb-3 rounded-[10px] border border-[#fecaca] bg-white px-4 py-3 text-[13px] leading-5 text-[#c7493f]">{notice}</p>
        ) : null}

        {step === "account" ? (
          <button
            type="button"
            onClick={() => void startIdentityVerification()}
            disabled={loading}
            className="mt-6 flex h-[62px] w-full items-center justify-center rounded-[14px] bg-[#111a30] text-[17px] font-bold text-white transition-[background-color,transform] hover:bg-[#17233d] active:translate-y-px disabled:opacity-60"
          >
            다음
          </button>
        ) : null}

        {step === "password" ? (
          <button
            type="submit"
            disabled={loading || isSubmitting || !verificationToken}
            className="flex h-[62px] w-full items-center justify-center rounded-[14px] bg-[#111a30] text-[17px] font-bold text-white transition-[background-color,transform] hover:bg-[#17233d] active:translate-y-px disabled:opacity-60"
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
    </main>
  );
}
