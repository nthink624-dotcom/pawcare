"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleUserRound, Eye, EyeOff, X } from "lucide-react";

import SocialLoginButtons from "@/components/auth/social-login-buttons";
import { OWNER_SIGNUP_TERMS_VERSION, ownerSignupTerms, type OwnerSignupTermId } from "@/lib/auth/owner-signup-terms";
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

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function toKoreanAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) return "아이디 또는 비밀번호가 맞지 않습니다.";
  if (normalized.includes("email not confirmed")) return "이메일 인증이 완료되지 않았습니다.";
  if (normalized.includes("user already registered")) return "이미 가입된 계정입니다.";
  if (normalized.includes("password should be at least")) return "비밀번호는 6자 이상 입력해 주세요.";
  if (normalized.includes("unable to validate email address")) return "아이디 형식을 다시 확인해 주세요.";
  if (normalized.includes("oauth")) return "소셜 로그인 처리 중 문제가 발생했습니다.";
  return "로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-[20px] border border-[#dbd7d0] bg-white px-[14px] py-[9px]">
      <span className="block text-[13px] font-medium text-[#757575]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function EntrySection({
  loginId,
  password,
  showPassword,
  loading,
  socialLoading,
  onLoginIdChange,
  onPasswordChange,
  onTogglePassword,
  onLogin,
  onStartEmail,
  onStartSocial,
}: {
  loginId: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  socialLoading: SocialProvider | null;
  onLoginIdChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onLogin: () => void;
  onStartEmail: () => void;
  onStartSocial: (provider: SocialProvider) => void;
}) {
  return (
    <div className="mt-8 space-y-6">
      <div className="space-y-3.5">
        <Field label="아이디">
          <input
            type="text"
            value={loginId}
            onChange={(event) => onLoginIdChange(event.target.value)}
            placeholder="아이디 입력"
            className="h-5 w-full border-0 bg-transparent p-0 text-[14px] font-medium leading-5 text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </Field>

        <Field label="비밀번호">
          <div className="flex items-center gap-3">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="비밀번호 입력"
              className="h-5 w-full border-0 bg-transparent p-0 text-[14px] font-medium leading-5 text-[#111111] outline-none placeholder:text-[#b0aaa1]"
            />
            <button type="button" onClick={onTogglePassword} className="text-[#111111]" aria-label="비밀번호 표시 전환">
              {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={2.1} /> : <Eye className="h-5 w-5" strokeWidth={2.1} />}
            </button>
          </div>
        </Field>

        <button
          type="button"
          onClick={onLogin}
          disabled={loading || !loginId || !password}
          className="flex h-[54px] w-full items-center justify-center rounded-[18px] bg-[#2f786b] px-5 text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-[#e4e0d8]" />
          <span className="text-[15px] font-medium text-[#353535]">일반 회원가입</span>
          <div className="h-px flex-1 bg-[#e4e0d8]" />
        </div>
        <button
          type="button"
          onClick={onStartEmail}
          className="flex h-[56px] w-full items-center justify-center rounded-[20px] border border-[#d9d2c7] bg-white px-5 text-[16px] font-semibold text-[#111111]"
        >
          회원가입으로 시작하기
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-[#e4e0d8]" />
          <span className="text-[15px] font-medium text-[#353535]">빠른 로그인 / 회원가입</span>
          <div className="h-px flex-1 bg-[#e4e0d8]" />
        </div>
        <SocialLoginButtons onLogin={onStartSocial} loadingProvider={socialLoading} disabled={loading} />
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
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [entryLoginId, setEntryLoginId] = useState("");
  const [entryPassword, setEntryPassword] = useState("");
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

  const handleEntryLogin = async () => {
    if (!supabaseReady || !supabase) {
      setMessage("Supabase 환경 변수가 설정되지 않았습니다. 먼저 환경 설정을 확인해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: buildOwnerAuthEmail(entryLoginId),
        password: entryPassword,
      });

      if (error) {
        setMessage(toKoreanAuthError(error.message));
        return;
      }

      router.replace(nextPath as never);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (!supabaseReady || !supabase) {
      setMessage("소셜 로그인을 위한 환경 설정이 아직 준비되지 않았어요.");
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
        setMessage("소셜 로그인 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.");
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
    if (!/^01\d{8,9}$/.test(fields.phoneNumber)) return setMessage("휴대폰 번호를 다시 확인해 주세요.");

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
      setMessage("인증번호를 전송했어요.");
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
      setMessage("본인인증이 완료되었어요.");
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
      setMessage("PASS 본인인증이 완료되었어요.");
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async () => {
    if (!verificationToken) return setMessage("본인인증을 먼저 완료해 주세요.");

    const loginId = normalizeOwnerLoginId(fields.loginId);
    if (!isValidOwnerLoginId(loginId)) return setMessage("아이디는 영문 소문자, 숫자, ., -, _ 조합으로 4자 이상 입력해 주세요.");
    if (!isValidOwnerPassword(fields.password)) return setMessage(ownerPasswordRuleMessage);
    if (fields.password !== fields.passwordConfirm) return setMessage("비밀번호 확인이 일치하지 않아요.");
    if (!fields.shopName.trim()) return setMessage("매장 이름을 입력해 주세요.");
    if (!fields.shopAddress.trim()) return setMessage("매장 주소를 입력해 주세요.");

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
        setMessage(result.message ?? "회원가입 처리 중 문제가 발생했어요.");
        return;
      }

      router.replace(
        `/login?next=${encodeURIComponent(nextPath)}&message=${encodeURIComponent("회원가입이 완료되었어요. 로그인 후 2주 무료체험을 시작해 보세요.")}` as never,
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fafaf5] px-6 pb-10 pt-6 text-[#111111]">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-[#6f6f6f]">펫매니저 OWNER</div>
        <Link
          href="/"
          className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-white text-[#111111] shadow-[0_8px_20px_rgba(17,17,17,0.05)]"
        >
          <X className="h-6 w-6" strokeWidth={2.2} />
        </Link>
      </div>

      <div className="mt-10 flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-[#dcfae8] text-[#2d645c]">
        <CircleUserRound className="h-8 w-8" strokeWidth={1.8} />
      </div>

      <div className="mt-8">
        <h1 className="text-[28px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#111111]">
          {step === "entry" ? "무료체험 시작" : step === "verify" ? "본인인증" : "회원 정보 입력"}
        </h1>
        <p className="mt-3 text-[14px] leading-6 text-[#6f6f6f]">
          {step === "entry"
            ? "로그인하거나 회원가입한 뒤 2주 무료체험을 바로 시작할 수 있어요."
            : step === "verify"
              ? "회원가입 전에 본인인증을 먼저 완료해 주세요."
              : "운영에 필요한 계정 정보와 매장 정보를 입력하면 바로 시작할 수 있어요."}
        </p>
      </div>

      {step === "entry" ? (
        <EntrySection
          loginId={entryLoginId}
          password={entryPassword}
          showPassword={showLoginPassword}
          loading={loading}
          socialLoading={socialLoading}
          onLoginIdChange={setEntryLoginId}
          onPasswordChange={setEntryPassword}
          onTogglePassword={() => setShowLoginPassword((prev) => !prev)}
          onLogin={handleEntryLogin}
          onStartEmail={() => openStart({ kind: "email" })}
          onStartSocial={(provider) => openStart({ kind: "social", provider })}
        />
      ) : null}

      {step === "verify" ? (
        <div className="mt-7 space-y-3.5">
          <Field label="이름">
            <input
              type="text"
              value={fields.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="이름 입력"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium outline-none placeholder:text-[#b0aaa1]"
            />
          </Field>
          <Field label="생년월일 8자리">
            <input
              type="text"
              inputMode="numeric"
              value={fields.birthDate}
              onChange={(event) => updateField("birthDate", event.target.value)}
              placeholder="예: 19990321"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium outline-none placeholder:text-[#b0aaa1]"
            />
          </Field>
          <Field label="휴대폰 번호">
            <input
              type="text"
              inputMode="numeric"
              value={fields.phoneNumber}
              onChange={(event) => updateField("phoneNumber", event.target.value)}
              placeholder="숫자만 입력"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium outline-none placeholder:text-[#b0aaa1]"
            />
          </Field>

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
              PASS 인증
            </button>
          </div>

          {challengeToken ? (
            <>
              <Field label="인증번호">
                <input
                  type="text"
                  inputMode="numeric"
                  value={fields.verificationCode}
                  onChange={(event) => updateField("verificationCode", event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6자리 입력"
                  className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium outline-none placeholder:text-[#b0aaa1]"
                />
              </Field>
              {devCode ? <p className="px-1 text-[12px] leading-5 text-[#6f6f6f]">로컬 테스트용 인증번호: {devCode}</p> : null}
              <button
                type="button"
                onClick={verifyCode}
                disabled={loading}
                className="flex h-[52px] w-full items-center justify-center rounded-[18px] bg-[#2f786b] px-5 text-[16px] font-semibold text-white disabled:opacity-60"
              >
                인증 확인
              </button>
            </>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep("entry")}
              className="flex h-[52px] flex-1 items-center justify-center rounded-[18px] border border-[#d9d2c7] bg-white px-5 text-[16px] font-semibold text-[#111111]"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => (verificationToken ? setStep("profile") : setMessage("본인인증을 먼저 완료해 주세요."))}
              className="flex h-[52px] flex-1 items-center justify-center rounded-[18px] bg-[#2f786b] px-5 text-[16px] font-semibold text-white"
            >
              다음
            </button>
          </div>
        </div>
      ) : null}

      {step === "profile" ? (
        <div className="mt-7 space-y-3.5">
          <Field label="아이디">
            <input
              type="text"
              value={fields.loginId}
              onChange={(event) => updateField("loginId", event.target.value)}
              placeholder="영문 소문자와 숫자 조합"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium outline-none placeholder:text-[#b0aaa1]"
            />
          </Field>
          <Field label="비밀번호">
            <div className="flex items-center gap-3">
              <input
                type={showPassword ? "text" : "password"}
                value={fields.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="비밀번호 입력"
                className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium outline-none placeholder:text-[#b0aaa1]"
              />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          <p className="px-1 text-[12px] leading-5 text-[#6f6f6f]">{ownerPasswordRuleMessage}</p>
          <Field label="비밀번호 확인">
            <div className="flex items-center gap-3">
              <input
                type={showPasswordConfirm ? "text" : "password"}
                value={fields.passwordConfirm}
                onChange={(event) => updateField("passwordConfirm", event.target.value)}
                placeholder="비밀번호 다시 입력"
                className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium outline-none placeholder:text-[#b0aaa1]"
              />
              <button type="button" onClick={() => setShowPasswordConfirm((prev) => !prev)}>
                {showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          <Field label="매장 이름">
            <input
              type="text"
              value={fields.shopName}
              onChange={(event) => updateField("shopName", event.target.value)}
              placeholder="예: 포근한 발바닥 미용실"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium outline-none placeholder:text-[#b0aaa1]"
            />
          </Field>
          <Field label="매장 주소">
            <input
              type="text"
              value={fields.shopAddress}
              onChange={(event) => updateField("shopAddress", event.target.value)}
              placeholder="매장 주소 입력"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium outline-none placeholder:text-[#b0aaa1]"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep("verify")}
              className="flex h-[52px] flex-1 items-center justify-center rounded-[18px] border border-[#d9d2c7] bg-white px-5 text-[16px] font-semibold text-[#111111]"
            >
              이전
            </button>
            <button
              type="button"
              onClick={submitSignup}
              disabled={loading}
              className="flex h-[52px] flex-1 items-center justify-center rounded-[18px] bg-[#2f786b] px-5 text-[16px] font-semibold text-white disabled:opacity-60"
            >
              {loading ? "가입 중..." : "무료체험 시작하기"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-5 text-[14px] leading-6 text-[#6f6f6f]">{message}</p> : null}

      {startTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/30 sm:items-center sm:justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setStartTarget(null);
          }}
        >
          <div className="w-full rounded-t-[28px] bg-[#fafaf5] px-6 pb-6 pt-5 shadow-[0_-18px_40px_rgba(17,17,17,0.12)] sm:max-w-[430px] sm:rounded-[28px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[22px] font-semibold tracking-[-0.03em] text-[#111111]">약관 동의</p>
                <p className="mt-2 text-[13px] leading-5 text-[#6f6f6f]">필수 약관에 동의하면 다음 단계로 넘어갈 수 있어요.</p>
              </div>
              <button type="button" onClick={() => setStartTarget(null)} className="text-[15px] font-medium text-[#6f6f6f]">
                닫기
              </button>
            </div>

            <div className="mt-5 rounded-[18px] border border-[#dcefe7] bg-[#eef8f4] p-4">
              <button
                type="button"
                onClick={() =>
                  setAgreements({
                    service: true,
                    privacy: true,
                    location: true,
                    marketing: true,
                  })
                }
                className="w-full text-left text-[15px] font-semibold text-[#111111]"
              >
                전체 동의하기
              </button>
              <p className="mt-1 text-[12px] leading-5 text-[#6b756f]">필수 및 선택 약관에 모두 동의합니다.</p>
            </div>

            <div className="mt-4 space-y-3">
              {ownerSignupTerms.map((term) => (
                <div key={term.id} className="rounded-[18px] border border-[#e4ddd2] bg-white px-4 py-4">
                  <button
                    type="button"
                    onClick={() =>
                      setAgreements((prev) => ({
                        ...prev,
                        [term.id]: !prev[term.id],
                      }))
                    }
                    className="w-full text-left"
                  >
                    <p className="text-[15px] font-medium text-[#111111]">
                      [{term.required ? "필수" : "선택"}] {term.title}
                    </p>
                    <p className="mt-1 text-[12px] text-[#8a857d]">{term.required ? "필수 약관이에요." : "선택 동의 항목이에요."}</p>
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStartTarget(null)}
                className="flex h-[52px] items-center justify-center rounded-[18px] border border-[#d9d2c7] bg-white px-5 text-[16px] font-semibold text-[#111111]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={continueStart}
                className="flex h-[52px] items-center justify-center rounded-[18px] bg-[#2f786b] px-5 text-[16px] font-semibold text-white"
              >
                계속하기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
