"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

import SocialLoginButtons from "@/components/auth/social-login-buttons";
import {
  OWNER_SIGNUP_TERMS_VERSION,
  ownerSignupTerms,
  type OwnerSignupTermId,
} from "@/lib/auth/owner-signup-terms";
import {
  buildOwnerAuthEmail,
  isValidBirthDate8,
  isValidOwnerLoginId,
  isValidOwnerPassword,
  normalizeOwnerLoginId,
  ownerPasswordRuleMessage,
} from "@/lib/auth/owner-credentials";
import { env } from "@/lib/env";
import {
  getSocialOAuthProvider,
  PENDING_SOCIAL_PROVIDER_COOKIE,
  PENDING_SOCIAL_PROVIDER_STORAGE,
  type SocialProvider,
} from "@/lib/auth/social-auth";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  INLINE_ERROR,
  INLINE_HELP,
  INPUT_BASE,
  PAGE_DESCRIPTION,
  PAGE_EYEBROW,
  PAGE_FRAME,
  PAGE_TITLE,
  cn,
} from "@/lib/ui-system";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Step = "entry" | "verify" | "profile";
type StartTarget = { kind: "email" } | { kind: "social"; provider: SocialProvider } | null;
type AgreementState = Record<OwnerSignupTermId, boolean>;

const initialAgreements: AgreementState = {
  service: false,
  privacy: false,
  location: false,
  marketing: false,
};

const termLinkById: Record<OwnerSignupTermId, string> = {
  service: "/terms",
  privacy: "/privacy",
  location: "/terms",
  marketing: "/privacy",
};

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function toKoreanAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) return "아이디 또는 비밀번호를 다시 확인해 주세요.";
  if (normalized.includes("email not confirmed")) return "이메일 인증이 아직 완료되지 않았습니다.";
  if (normalized.includes("user already registered")) return "이미 가입된 계정입니다.";
  if (normalized.includes("password should be at least")) return "비밀번호는 6자 이상 입력해 주세요.";
  if (normalized.includes("unable to validate email address")) return "이메일 형식을 다시 확인해 주세요.";
  if (normalized.includes("oauth")) return "소셜 로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.";

  return "처리 중 문제가 발생했습니다. 다시 시도해 주세요.";
}

function AuthField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#6d675f]">{label}</span>
        {hint ? <span className="text-[12px] text-[#8b847b]">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function AuthInput({
  value,
  onChange,
  placeholder,
  inputMode,
  type = "text",
  rightSlot,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={cn(INPUT_BASE, rightSlot ? "pr-11" : "")}
      />
      {rightSlot ? <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightSlot}</div> : null}
    </div>
  );
}

function EntryStep({
  loading,
  socialLoading,
  onStartEmail,
  onStartSocial,
  nextPath,
}: {
  loading: boolean;
  socialLoading: SocialProvider | null;
  onStartEmail: () => void;
  onStartSocial: (provider: SocialProvider) => void;
  nextPath: string;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <button type="button" onClick={onStartEmail} className={BUTTON_PRIMARY}>
          일반 회원가입 시작하기
        </button>
        <p className="text-center text-[13px] leading-6 text-[#7f786f]">
          기본 정보 입력과 본인 인증을 마치면 2주 무료체험을 바로 시작할 수 있어요.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#e7e1d8]" />
          <span className="text-[14px] font-medium text-[#8b847b]">빠른 로그인 / 회원가입</span>
          <div className="h-px flex-1 bg-[#e7e1d8]" />
        </div>
        <SocialLoginButtons onLogin={onStartSocial} loadingProvider={socialLoading} disabled={loading} />
      </div>

      <div className="text-center text-[14px] text-[#8b847b]">
        이미 계정이 있나요?{" "}
        <Link href={`/login?next=${encodeURIComponent(nextPath)}` as never} replace className="font-semibold text-[#111111]">
          로그인
        </Link>
      </div>
    </div>
  );
}

export default function SignupForm({
  supabaseReady,
  portoneReady,
  nextPath = "/owner",
  initialStart = null,
}: {
  supabaseReady: boolean;
  portoneReady: boolean;
  nextPath?: string;
  initialStart?: "email" | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [step, setStep] = useState<Step>("entry");
  const [startTarget, setStartTarget] = useState<StartTarget>(null);
  const [agreements, setAgreements] = useState<AgreementState>(initialAgreements);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [fields, setFields] = useState({
    name: "",
    birthDate: "",
    phoneNumber: "",
    verificationCode: "",
    loginId: "",
    password: "",
    passwordConfirm: "",
    shopName: "",
    shopAddress: "",
  });

  const requiredAgreed = agreements.service && agreements.privacy;
  const allAgreed = ownerSignupTerms.every((term) => agreements[term.id]);

  useEffect(() => {
    let active = true;

    async function run() {
      if (!supabaseReady || !supabase) return;
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session?.access_token) return;

      if (initialStart === "email") {
        await supabase.auth.signOut();
        return;
      }

      router.replace(nextPath as never);
      router.refresh();
    }

    void run();

    return () => {
      active = false;
    };
  }, [initialStart, nextPath, router, supabase, supabaseReady]);

  useEffect(() => {
    if (initialStart !== "email") return;
    setStep("entry");
    setStartTarget({ kind: "email" });
  }, [initialStart]);

  const updateField = (key: keyof typeof fields, value: string) => {
    const normalizedValue =
      key === "birthDate"
        ? value.replace(/\D/g, "").slice(0, 8)
        : key === "phoneNumber"
          ? normalizePhone(value)
          : value;

    setFields((prev) => ({
      ...prev,
      [key]: normalizedValue,
      ...(key === "name" || key === "birthDate" || key === "phoneNumber" ? { verificationCode: "" } : {}),
    }));

    if (key === "name" || key === "birthDate" || key === "phoneNumber") {
      setChallengeToken(null);
      setVerificationToken(null);
      setDevCode(null);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (!supabaseReady || !supabase) {
      setMessage("소셜 로그인 환경이 아직 준비되지 않았어요.");
      return;
    }

    setSocialLoading(provider);
    setMessage(null);

    try {
      document.cookie = `${PENDING_SOCIAL_PROVIDER_COOKIE}=${provider}; Path=/; Max-Age=600; SameSite=Lax`;
      window.localStorage.setItem(PENDING_SOCIAL_PROVIDER_STORAGE, provider);
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}&provider=${encodeURIComponent(provider)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: getSocialOAuthProvider(provider) as "google" | "kakao" | "custom:naver",
        options: {
          redirectTo,
          queryParams:
            provider === "google"
              ? { prompt: "select_account" }
              : provider === "naver"
                ? { auth_type: "reauthenticate" }
                : undefined,
        },
      });

      if (error) {
        setMessage(toKoreanAuthError(error.message));
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const openStart = (target: StartTarget) => {
    setMessage(null);
    setStartTarget(target);
  };

  const continueStart = async () => {
    if (!requiredAgreed || !startTarget) {
      setMessage("필수 약관에 동의해 주세요.");
      return;
    }

    const target = startTarget;
    setStartTarget(null);

    if (target.kind === "email") {
      setStep("verify");
      return;
    }

    await handleSocialLogin(target.provider);
  };

  const requestCode = async () => {
    if (!fields.name.trim()) return setMessage("이름을 입력해 주세요.");
    if (!isValidBirthDate8(fields.birthDate)) return setMessage("생년월일 8자리를 입력해 주세요.");
    if (!/^01\d{8,9}$/.test(fields.phoneNumber)) return setMessage("휴대폰번호를 다시 확인해 주세요.");

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/request-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name,
          birthDate: fields.birthDate,
          phoneNumber: fields.phoneNumber,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message ?? "인증번호 요청에 실패했어요.");
        return;
      }

      setChallengeToken(result.challengeToken ?? null);
      setDevCode(result.devVerificationCode ?? null);
      setMessage("인증번호를 보냈어요.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
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
          name: fields.name,
          birthDate: fields.birthDate,
          phoneNumber: fields.phoneNumber,
          code: fields.verificationCode,
          challengeToken,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.verificationToken) {
        setMessage(result.message ?? "인증번호를 다시 확인해 주세요.");
        return;
      }

      setVerificationToken(result.verificationToken);
      setMessage("본인 인증이 완료됐어요.");
    } finally {
      setLoading(false);
    }
  };

  const verifyPass = async () => {
    if (!portoneReady || !env.portoneStoreId || !env.portoneIdentityChannelKey) {
      setMessage("PASS 본인인증 환경이 아직 준비되지 않았어요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { requestIdentityVerification } = await import("@portone/browser-sdk/v2");
      const identityVerificationId = `petmanager_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const result = await requestIdentityVerification({
        storeId: env.portoneStoreId,
        channelKey: env.portoneIdentityChannelKey,
        identityVerificationId,
        windowType: { pc: "POPUP", mobile: "POPUP" },
        customer: {
          fullName: fields.name.trim(),
          phoneNumber: fields.phoneNumber,
          birthYear: fields.birthDate.slice(0, 4),
          birthMonth: fields.birthDate.slice(4, 6),
          birthDay: fields.birthDate.slice(6, 8),
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
          name: fields.name,
          birthDate: fields.birthDate,
          phoneNumber: fields.phoneNumber,
        }),
      });
      const verifyResult = await response.json();

      if (!response.ok || !verifyResult.verificationToken) {
        setMessage(verifyResult.message ?? "PASS 본인인증 확인에 실패했어요.");
        return;
      }

      setVerificationToken(verifyResult.verificationToken);
      setMessage("PASS 본인인증이 완료됐어요.");
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async () => {
    if (!verificationToken) {
      setMessage("본인 인증을 먼저 완료해 주세요.");
      return;
    }

    const loginId = normalizeOwnerLoginId(fields.loginId);
    if (!isValidOwnerLoginId(loginId)) {
      setMessage("아이디는 영문 소문자, 숫자, ., -, _ 조합으로 4자 이상 입력해 주세요.");
      return;
    }
    if (!isValidOwnerPassword(fields.password)) {
      setMessage(ownerPasswordRuleMessage);
      return;
    }
    if (fields.password !== fields.passwordConfirm) {
      setMessage("비밀번호 확인이 일치하지 않아요.");
      return;
    }
    if (!fields.shopName.trim()) {
      setMessage("매장명을 입력해 주세요.");
      return;
    }
    if (!fields.shopAddress.trim()) {
      setMessage("매장 주소를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId,
          password: fields.password,
          passwordConfirm: fields.passwordConfirm,
          name: fields.name.trim(),
          birthDate: fields.birthDate,
          phoneNumber: fields.phoneNumber,
          identityVerificationToken: verificationToken,
          shopName: fields.shopName.trim(),
          shopAddress: fields.shopAddress.trim(),
          agreements,
          termsVersion: OWNER_SIGNUP_TERMS_VERSION,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(result.message ?? "회원가입 중 문제가 발생했어요.");
        return;
      }

      router.replace(`/login?next=${encodeURIComponent(nextPath)}&message=signup-success` as never);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(PAGE_FRAME, "bg-white text-[#111111]")}>
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <p className={PAGE_EYEBROW}>회원가입</p>
          <div>
            <h1 className={PAGE_TITLE}>
              {step === "entry" ? "무료체험을 시작해볼까요?" : step === "verify" ? "본인 인증을 진행해 주세요" : "매장 정보를 입력해 주세요"}
            </h1>
            <p className={cn(PAGE_DESCRIPTION, "mt-3")}>
              {step === "entry"
                ? "기본 약관에 동의하고 가입을 시작하면 2주 무료체험을 바로 이용할 수 있어요."
                : step === "verify"
                  ? "가입 완료 전에 이름, 생년월일, 휴대폰번호로 본인 인증을 먼저 확인할게요."
                  : "아이디와 매장 정보를 입력하면 가입이 마무리되고 바로 오너 화면으로 들어갈 수 있어요."}
            </p>
          </div>
        </div>

        <Link
          href={step === "entry" ? `/login?next=${encodeURIComponent(nextPath)}` : "/signup"}
          replace
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e3ded3] text-[#3b3834] transition hover:bg-[#faf7f2]"
          aria-label={step === "entry" ? "로그인으로 이동" : "회원가입 첫 단계로 이동"}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <div className="mt-10">
        {step === "entry" ? (
          <EntryStep
            loading={loading}
            socialLoading={socialLoading}
            onStartEmail={() => openStart({ kind: "email" })}
            onStartSocial={(provider) => openStart({ kind: "social", provider })}
            nextPath={nextPath}
          />
        ) : null}

        {step === "verify" ? (
          <div className="space-y-7">
            <div className="space-y-4">
              <AuthField label="이름">
                <AuthInput value={fields.name} onChange={(value) => updateField("name", value)} placeholder="대표자 이름" />
              </AuthField>

              <AuthField label="생년월일" hint="숫자 8자리">
                <AuthInput
                  value={fields.birthDate}
                  onChange={(value) => updateField("birthDate", value)}
                  placeholder="예: 19990321"
                  inputMode="numeric"
                />
              </AuthField>

              <AuthField label="휴대폰번호">
                <AuthInput
                  value={formatPhone(fields.phoneNumber)}
                  onChange={(value) => updateField("phoneNumber", value)}
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                />
              </AuthField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={requestCode} disabled={loading} className={BUTTON_SECONDARY}>
                {challengeToken ? "인증번호 다시 받기" : "인증번호 받기"}
              </button>
              <button
                type="button"
                onClick={verifyPass}
                disabled={loading}
                className={cn(BUTTON_SECONDARY, "border-[#cfe2dc] bg-[#eff8f6] text-[#1f6b5b] hover:bg-[#e9f4f0]")}
              >
                PASS 인증
              </button>
            </div>

            {challengeToken ? (
              <div className="space-y-4">
                <AuthField label="인증번호">
                  <AuthInput
                    value={fields.verificationCode}
                    onChange={(value) => updateField("verificationCode", value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="문자로 받은 6자리 숫자"
                    inputMode="numeric"
                  />
                </AuthField>

                {devCode ? <p className={INLINE_HELP}>로컬 테스트용 인증번호: {devCode}</p> : null}

                <button type="button" onClick={verifyCode} disabled={loading} className={BUTTON_PRIMARY}>
                  인증 확인
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setStep("entry")} className={BUTTON_SECONDARY}>
                이전
              </button>
              <button
                type="button"
                onClick={() => (verificationToken ? setStep("profile") : setMessage("본인 인증을 먼저 완료해 주세요."))}
                className={BUTTON_PRIMARY}
              >
                다음
              </button>
            </div>
          </div>
        ) : null}

        {step === "profile" ? (
          <div className="space-y-7">
            <div className="space-y-4">
              <AuthField label="아이디" hint="영문 소문자, 숫자, ., -, _">
                <AuthInput
                  value={fields.loginId}
                  onChange={(value) => updateField("loginId", value)}
                  placeholder="로그인에 사용할 아이디"
                />
              </AuthField>

              <AuthField label="비밀번호">
                <AuthInput
                  type={showPassword ? "text" : "password"}
                  value={fields.password}
                  onChange={(value) => updateField("password", value)}
                  placeholder="비밀번호 입력"
                  rightSlot={
                    <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="text-[#615d57]">
                      {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  }
                />
              </AuthField>
              <p className={INLINE_HELP}>{ownerPasswordRuleMessage}</p>

              <AuthField label="비밀번호 확인">
                <AuthInput
                  type={showPasswordConfirm ? "text" : "password"}
                  value={fields.passwordConfirm}
                  onChange={(value) => updateField("passwordConfirm", value)}
                  placeholder="비밀번호를 한 번 더 입력해 주세요"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm((prev) => !prev)}
                      className="text-[#615d57]"
                    >
                      {showPasswordConfirm ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  }
                />
              </AuthField>

              <AuthField label="매장명">
                <AuthInput
                  value={fields.shopName}
                  onChange={(value) => updateField("shopName", value)}
                  placeholder="예: 포근한 발바닥 미용실"
                />
              </AuthField>

              <AuthField label="매장 주소">
                <AuthInput
                  value={fields.shopAddress}
                  onChange={(value) => updateField("shopAddress", value)}
                  placeholder="매장 주소를 입력해 주세요"
                />
              </AuthField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setStep("verify")} className={BUTTON_SECONDARY}>
                이전
              </button>
              <button type="button" onClick={submitSignup} disabled={loading} className={BUTTON_PRIMARY}>
                {loading ? "가입 처리 중.." : "무료체험 시작하기"}
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className={cn(INLINE_ERROR, "mt-5")}>{message}</p> : null}
      </div>

      {startTarget ? (
        <div
          className="fixed inset-0 z-50 bg-black/35"
          onClick={(event) => {
            if (event.target === event.currentTarget) setStartTarget(null);
          }}
        >
          <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-end">
            <div className="w-full rounded-t-[26px] bg-white px-5 pb-5 pt-4 shadow-[0_-18px_50px_rgba(15,23,42,0.12)]">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#d7dbd4]" />

              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[14px] font-semibold text-[#5f665f]">약관 동의</p>
                  <h2 className="mt-2 text-[24px] font-extrabold tracking-[-0.05em] text-[#111827]">
                    가입을 시작하기 전에 확인해 주세요
                  </h2>
                  <p className="mt-3 text-[13px] leading-6 text-[#7b746b]">
                    필수 약관에 동의하면 일반 회원가입 또는 소셜 회원가입을 이어서 진행할 수 있어요.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[16px] border border-[#dce9e0] bg-[#f3faf6] p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={allAgreed}
                    onChange={(event) =>
                      setAgreements({
                        service: event.target.checked,
                        privacy: event.target.checked,
                        location: event.target.checked,
                        marketing: event.target.checked,
                      })
                    }
                    className="mt-1 h-[18px] w-[18px] rounded border border-[#c6d8cf] accent-[#1f6b5b]"
                  />
                  <div>
                    <p className="text-[15px] font-semibold text-[#111827]">전체 동의하기</p>
                    <p className="mt-1 text-[12px] leading-5 text-[#6f7b73]">필수와 선택 약관을 한 번에 설정할 수 있어요.</p>
                  </div>
                </label>
              </div>

              <div className="mt-4 space-y-3">
                {ownerSignupTerms.map((term) => (
                  <div key={term.id} className="rounded-[16px] border border-[#ebe5dc] bg-[#faf9f6] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex min-w-0 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={agreements[term.id]}
                          onChange={(event) =>
                            setAgreements((prev) => ({
                              ...prev,
                              [term.id]: event.target.checked,
                            }))
                          }
                          className="mt-1 h-[18px] w-[18px] rounded border border-[#d2cbc0] accent-[#1f6b5b]"
                        />
                        <div>
                          <p className="text-[14px] font-semibold text-[#111827]">
                            [{term.required ? "필수" : "선택"}] {term.title}
                          </p>
                          <p className="mt-1 text-[12px] leading-5 text-[#8b847b]">
                            {term.required ? "회원가입을 위해 꼭 필요한 항목이에요." : "필요한 경우에만 선택해도 괜찮아요."}
                          </p>
                        </div>
                      </label>

                      <Link
                        href={termLinkById[term.id] as never}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-[13px] font-medium text-[#6f6b64]"
                      >
                        보기
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setStartTarget(null)} className={BUTTON_SECONDARY}>
                  닫기
                </button>
                <button
                  type="button"
                  onClick={continueStart}
                  disabled={!requiredAgreed}
                  className={BUTTON_PRIMARY}
                >
                  계속하기
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
