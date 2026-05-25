"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Smartphone, Sparkles } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { MobileBackButton } from "@/components/ui/mobile-back-button";
import { ownerFindLoginIdSchema, type OwnerFindLoginIdInput } from "@/lib/auth/owner-find-login-id";
import { env, getSupabaseRuntimeStage, hasPortoneBrowserEnv } from "@/lib/env";
import { requestPortoneIdentityVerification } from "@/lib/portone/identity-verification-client";

type ApiMessage = {
  message?: string;
  verificationRequestId?: string | null;
  devVerificationCode?: string | null;
  verificationToken?: string | null;
  loginId?: string | null;
};

type FindIdStep = "info" | "method" | "code" | "result";

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
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-[#4d6077]">{label}</span>
      {hint ? <span className="-mt-1 mb-2 block text-[12px] font-medium text-[#8090a4]">{hint}</span> : null}
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-[54px] w-full rounded-[8px] border border-[#d7e0e9] bg-white px-4 text-[16px] font-medium text-[#111827] outline-none transition placeholder:text-[#aab5c4] focus:border-[#247761] focus:ring-2 focus:ring-[#247761]/10 ${props.className ?? ""}`}
    />
  );
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export default function FindLoginIdForm() {
  const router = useRouter();
  const isDevelopmentFlow = useMemo(() => getSupabaseRuntimeStage() !== "production", []);
  const canShowDevVerificationCode = useMemo(() => getSupabaseRuntimeStage() === "development", []);
  const portoneReady = useMemo(() => hasPortoneBrowserEnv(), []);
  const useLocalVerificationFlow = isDevelopmentFlow && !portoneReady;

  const [step, setStep] = useState<FindIdStep>("info");
  const [message, setMessage] = useState<string | null>(null);
  const [foundLoginId, setFoundLoginId] = useState<string | null>(null);
  const [verificationRequestId, setVerificationRequestId] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    getValues,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<OwnerFindLoginIdInput>({
    resolver: zodResolver(ownerFindLoginIdSchema),
    defaultValues: {
      name: "",
      birthDate: "",
      phoneNumber: "",
      identityVerificationToken: "",
    },
  });

  const pageTitle =
    step === "method" ? "본인 확인" : step === "code" ? "인증번호 입력" : step === "result" ? "아이디 확인" : "아이디 찾기";

  const firstError = errors.name?.message || errors.birthDate?.message || errors.phoneNumber?.message;
  const notice = firstError ?? message;

  const goBack = () => {
    setMessage(null);
    if (step === "info") {
      router.replace("/login");
      return;
    }
    if (step === "result") {
      setStep(useLocalVerificationFlow ? "code" : "method");
      return;
    }
    if (step === "code") {
      setStep("method");
      return;
    }
    setStep("info");
  };

  const goToMethodStep = async () => {
    const isValid = await trigger(["name", "birthDate", "phoneNumber"]);
    if (!isValid) return;
    setMessage(null);
    setStep("method");
  };

  const lookupLoginId = async (verificationToken: string) => {
    const values = getValues();
    setValue("identityVerificationToken", verificationToken, { shouldValidate: true });

    const response = await fetch("/api/auth/find-login-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        identityVerificationToken: verificationToken,
      }),
    });

    const result = (await response.json()) as ApiMessage;
    if (!response.ok || !result.loginId) {
      setMessage(result.message ?? "입력한 정보와 일치하는 아이디를 찾지 못했어요.");
      return;
    }

    setFoundLoginId(result.loginId);
    setMessage(null);
    setStep("result");
  };

  const requestCode = async () => {
    const isValid = await trigger(["name", "birthDate", "phoneNumber"]);
    if (!isValid) return;

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
          purpose: "find-login-id",
          method: "local",
        }),
      });
      const result = (await response.json()) as ApiMessage;

      if (!response.ok || !result.verificationRequestId) {
        setMessage(result.message ?? "인증번호를 보내지 못했어요. 다시 시도해 주세요.");
        return;
      }

      setVerificationRequestId(result.verificationRequestId);
      setDevCode(result.devVerificationCode ?? null);
      setVerificationCode("");
      setFoundLoginId(null);
      setStep("code");
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
          purpose: "find-login-id",
          verificationRequestId,
        }),
      });
      const result = (await response.json()) as ApiMessage;

      if (!response.ok || !result.verificationToken) {
        setMessage(result.message ?? "인증번호를 다시 확인해 주세요.");
        return;
      }

      await lookupLoginId(result.verificationToken);
    } finally {
      setLoading(false);
    }
  };

  const verifyPass = async () => {
    const isValid = await trigger(["name", "birthDate", "phoneNumber"]);
    if (!isValid) return;

    const values = getValues();
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
          name: values.name,
          birthDate: values.birthDate,
          phoneNumber: values.phoneNumber,
          purpose: "find-login-id",
          method: "portone",
        }),
      });
      const requestResult = (await requestResponse.json()) as ApiMessage;

      if (!requestResponse.ok || !requestResult.verificationRequestId) {
        setMessage(requestResult.message ?? "본인 확인 요청을 준비하지 못했어요.");
        return;
      }

      const identityVerificationId = `findid${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

      const result = await requestPortoneIdentityVerification({
        storeId: env.portoneStoreId,
        channelKey: env.portoneIdentityKcpChannelKey,
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
        setMessage("휴대폰 본인인증이 완료되지 않았어요.");
        return;
      }

      const response = await fetch("/api/auth/verify-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "find-login-id",
          verificationRequestId: requestResult.verificationRequestId,
          identityVerificationId: result.identityVerificationId,
        }),
      });
      const verifyResult = (await response.json()) as ApiMessage;

      if (!response.ok || !verifyResult.verificationToken) {
        setMessage(verifyResult.message ?? "휴대폰 본인인증 확인에 실패했어요.");
        return;
      }

      await lookupLoginId(verifyResult.verificationToken);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white px-5 pb-8 pt-5 text-[#111827]">
      <div className="relative flex h-10 items-center justify-center">
        <MobileBackButton
          onClick={goBack}
          label={step === "info" ? "로그인으로 이동" : "이전 단계"}
          className="absolute left-0 h-10 w-10 border-0 bg-transparent text-[#111827] shadow-none hover:bg-[#f8fafc]"
        />
        <h1 className="text-[18px] font-semibold leading-6 tracking-[-0.02em] text-[#111827]">{pageTitle}</h1>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex-1 pt-8">
          {step === "info" ? (
            <section>
              <p className="mt-4 block w-full min-w-0 whitespace-nowrap text-[17px] font-semibold leading-7 text-[#111827]">
                가입할 때 사용한 정보를 입력해 주세요.
              </p>

              <div className="mt-7 space-y-4">
                <FieldShell label="이름">
                  <TextInput type="text" {...register("name")} placeholder="이름 입력" autoComplete="name" />
                </FieldShell>

                <FieldShell label="생년월일" hint="8자리 숫자">
                  <TextInput
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    {...register("birthDate")}
                    placeholder="예: 19960624"
                    autoComplete="bday"
                  />
                </FieldShell>

                <FieldShell label="휴대폰번호">
                  <TextInput
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    {...register("phoneNumber")}
                    placeholder="숫자만 입력"
                    autoComplete="tel"
                  />
                </FieldShell>
              </div>
            </section>
          ) : null}

          {step === "method" ? (
            <section>
              <h1 className="mt-4 whitespace-nowrap text-[26px] font-semibold leading-[1.2] tracking-[-0.03em] text-[#111827]">
                인증 방법을 선택해주세요
              </h1>
              <p className="mt-4 w-full max-w-none break-keep text-[14px] leading-6 text-[#667589]">
                가입 정보와 인증 결과가 일치하면 아이디를 확인할 수 있어요.
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

          {step === "result" ? (
            <section>
              <h1 className="mt-4 whitespace-nowrap text-[26px] font-semibold leading-[1.2] tracking-[-0.03em] text-[#111827]">
                아이디를 확인했어요
              </h1>
              <p className="mt-4 text-[14px] leading-6 text-[#667589]">가입된 아이디는 아래와 같습니다.</p>

              <div className="mt-7 rounded-[12px] border border-[#d7e0e9] bg-white px-4 py-4">
                <p className="text-[13px] font-semibold text-[#4d6077]">아이디</p>
                <p className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">{foundLoginId}</p>
              </div>

              {foundLoginId ? (
                <Link
                  href={`/login/reset?loginId=${encodeURIComponent(foundLoginId)}`}
                  replace
                  className="mt-4 flex h-[48px] w-full items-center justify-center rounded-[10px] border border-[#d7e0e9] bg-white text-[15px] font-semibold text-[#111827]"
                >
                  비밀번호 찾기로 이동
                </Link>
              ) : null}
            </section>
          ) : null}
        </div>

        {notice && step !== "result" ? <p className="mb-3 text-[12px] leading-5 text-[#9f5b52]">{notice}</p> : null}

        {step === "info" ? (
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

        {step === "result" ? (
          <Link
            href="/login"
            replace
            className="flex h-[56px] w-full items-center justify-center rounded-[10px] bg-[#247761] text-[17px] font-semibold text-white transition active:scale-[0.99]"
          >
            로그인으로 이동
          </Link>
        ) : null}
      </div>

      <div className="mt-7 text-center text-[14px] text-[#64748b]">
        비밀번호를 찾으려면{" "}
        <Link href="/login/reset" replace className="font-semibold text-[#111827] underline underline-offset-4">
          여기로 이동해 주세요
        </Link>
      </div>
    </div>
  );
}
