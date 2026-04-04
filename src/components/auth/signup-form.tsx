"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, CircleUserRound, Eye, EyeOff, X } from "lucide-react";

import { env } from "@/lib/env";
import {
  OWNER_SIGNUP_TERMS_VERSION,
  ownerSignupTerms,
  type OwnerSignupTermId,
} from "@/lib/auth/owner-signup-terms";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  isValidBirthDate8,
  isValidOwnerLoginId,
  isValidOwnerPassword,
  normalizeOwnerLoginId,
  ownerPasswordRuleMessage,
} from "@/lib/auth/owner-credentials";

type SignupStep = "terms" | "verification" | "profile";
type AgreementState = Record<OwnerSignupTermId, boolean>;

type FieldState = {
  loginId: string;
  password: string;
  passwordConfirm: string;
  name: string;
  birthDate: string;
  phoneNumber: string;
  verificationCode: string;
  shopName: string;
  shopAddress: string;
};

type VerificationState = {
  requested: boolean;
  verified: boolean;
  verificationToken: string | null;
  challengeToken: string | null;
  requesting: boolean;
  verifying: boolean;
  passLoading: boolean;
};

const initialAgreements: AgreementState = {
  service: false,
  privacy: false,
  location: false,
  marketing: false,
};

const initialVerificationState: VerificationState = {
  requested: false,
  verified: false,
  verificationToken: null,
  challengeToken: null,
  requesting: false,
  verifying: false,
  passLoading: false,
};

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidPhoneNumber(value: string) {
  return /^01\d{8,9}$/.test(normalizePhoneNumber(value));
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block rounded-[20px] border border-[#dbd7d0] bg-white px-[14px] py-[9px]">
      <span className="block text-[13px] font-medium text-[#757575]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function AgreementRow({
  checked,
  title,
  required,
  description,
  onToggle,
  onOpen,
}: {
  checked: boolean;
  title: string;
  required: boolean;
  description: string;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-[#e4ddd2] bg-white px-4 py-4">
      <button
        type="button"
        aria-label={`${required ? "필수" : "선택"} ${title} 동의`}
        onClick={onToggle}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${checked ? "border-[#6b9e8a] bg-[#6b9e8a] text-white" : "border-[#cfc7b8] bg-white text-transparent"}`}
      >
        <Check className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
        <p className="text-[15px] font-medium text-[#111111]">[{required ? "필수" : "선택"}] {title}</p>
        <p className="mt-1 text-[12px] text-[#8a857d]">{description}</p>
      </button>
      <button type="button" onClick={onOpen} className="text-[14px] font-medium text-[#6f6f6f] underline underline-offset-4">
        보기
      </button>
    </div>
  );
}

export default function SignupForm({
  supabaseReady,
  portoneReady,
}: {
  supabaseReady: boolean;
  portoneReady: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [step, setStep] = useState<SignupStep>("terms");
  const [agreements, setAgreements] = useState<AgreementState>(initialAgreements);
  const [activeTermId, setActiveTermId] = useState<OwnerSignupTermId | null>(null);
  const [fields, setFields] = useState<FieldState>({
    loginId: "",
    password: "",
    passwordConfirm: "",
    name: "",
    birthDate: "",
    phoneNumber: "",
    verificationCode: "",
    shopName: "",
    shopAddress: "",
  });
  const [verification, setVerification] = useState<VerificationState>(initialVerificationState);
  const [devVerificationCode, setDevVerificationCode] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [checkingLoginId, setCheckingLoginId] = useState(false);
  const [loginIdMessage, setLoginIdMessage] = useState<string | null>(null);
  const [loginIdAvailable, setLoginIdAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeTerm = activeTermId ? ownerSignupTerms.find((term) => term.id === activeTermId) ?? null : null;
  const requiredAgreed = ownerSignupTerms.filter((term) => term.required).every((term) => agreements[term.id]);
  const allAgreed = ownerSignupTerms.every((term) => agreements[term.id]);

  const resetVerification = () => {
    setVerification(initialVerificationState);
    setDevVerificationCode(null);
    setFields((prev) => ({ ...prev, verificationCode: "" }));
  };

  const updateField = (key: keyof FieldState, value: string) => {
    setFields((prev) => ({
      ...prev,
      [key]:
        key === "birthDate"
          ? value.replace(/\D/g, "").slice(0, 8)
          : key === "phoneNumber"
            ? normalizePhoneNumber(value)
            : value,
    }));

    if (key === "loginId") {
      setLoginIdAvailable(null);
      setLoginIdMessage(null);
    }

    if (key === "name" || key === "birthDate" || key === "phoneNumber") {
      resetVerification();
    }
  };

  const updateAgreement = (id: OwnerSignupTermId, checked: boolean) => {
    setAgreements((prev) => ({ ...prev, [id]: checked }));
  };

  const toggleAgreement = (id: OwnerSignupTermId) => {
    setAgreements((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllAgreements = () => {
    const nextValue = !allAgreed;
    setAgreements({
      service: nextValue,
      privacy: nextValue,
      location: nextValue,
      marketing: nextValue,
    });
  };

  const openTermModal = (id: OwnerSignupTermId) => {
    setActiveTermId(id);
  };

  const closeTermModal = () => {
    setActiveTermId(null);
  };

  const checkLoginId = async () => {
    const normalized = normalizeOwnerLoginId(fields.loginId);

    if (!normalized) {
      setLoginIdAvailable(null);
      setLoginIdMessage("아이디를 입력해 주세요.");
      return false;
    }

    if (!isValidOwnerLoginId(normalized)) {
      setLoginIdAvailable(false);
      setLoginIdMessage("아이디는 영문 소문자, 숫자, ., -, _ 조합으로 4자 이상 입력해 주세요.");
      return false;
    }

    setCheckingLoginId(true);
    setLoginIdMessage(null);

    try {
      const response = await fetch(`/api/auth/check-login-id?loginId=${encodeURIComponent(normalized)}`);
      const result = (await response.json()) as { available?: boolean; message?: string };
      setLoginIdAvailable(Boolean(result.available));
      setLoginIdMessage(result.message ?? null);
      return Boolean(result.available);
    } catch {
      setLoginIdAvailable(false);
      setLoginIdMessage("아이디 중복 확인 중 문제가 발생했습니다.");
      return false;
    } finally {
      setCheckingLoginId(false);
    }
  };

  const validateIdentityFields = () => {
    if (!fields.name.trim()) {
      setMessage("이름을 먼저 입력해 주세요.");
      return false;
    }

    if (!isValidBirthDate8(fields.birthDate)) {
      setMessage("생년월일은 8자리 숫자로 입력해 주세요.");
      return false;
    }

    if (!isValidPhoneNumber(fields.phoneNumber)) {
      setMessage("휴대폰 번호를 올바르게 입력해 주세요.");
      return false;
    }

    return true;
  };

  const requestVerificationCode = async () => {
    if (verification.requesting) return;
    if (!validateIdentityFields()) return;

    setVerification((prev) => ({ ...prev, requesting: true }));
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

      const result = (await response.json()) as {
        message?: string;
        devVerificationCode?: string;
        challengeToken?: string;
      };

      if (!response.ok) {
        setMessage(result.message ?? "인증번호 요청에 실패했습니다.");
        return;
      }

      setVerification((prev) => ({ ...prev, requested: true, challengeToken: result.challengeToken ?? null }));
      setDevVerificationCode(result.devVerificationCode ?? null);
      setMessage("로컬 테스트용 인증번호를 준비했어요.");
    } catch {
      setMessage("인증번호 요청 중 문제가 발생했습니다.");
    } finally {
      setVerification((prev) => ({ ...prev, requesting: false }));
    }
  };

  const verifyIdentity = async () => {
    if (verification.verifying) return;

    if (!verification.requested || !verification.challengeToken) {
      setMessage("먼저 인증번호를 요청해 주세요.");
      return;
    }

    if (fields.verificationCode.trim().length !== 6) {
      setMessage("인증번호 6자리를 입력해 주세요.");
      return;
    }

    setVerification((prev) => ({ ...prev, verifying: true }));
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
          challengeToken: verification.challengeToken,
        }),
      });

      const result = (await response.json()) as { verificationToken?: string; message?: string };
      if (!response.ok || !result.verificationToken) {
        setMessage(result.message ?? "인증번호를 다시 확인해 주세요.");
        return;
      }

      setVerification((prev) => ({
        ...prev,
        requested: true,
        verified: true,
        verificationToken: result.verificationToken ?? null,
        verifying: false,
      }));
      setMessage("본인인증이 완료되었습니다.");
    } catch {
      setMessage("본인인증 처리 중 문제가 발생했습니다.");
      setVerification((prev) => ({ ...prev, verifying: false }));
    }
  };

  const startPassVerification = async () => {
    if (verification.passLoading) return;
    if (!portoneReady || !env.portoneStoreId || !env.portoneIdentityChannelKey) {
      setMessage("포트원 본인인증 환경 변수가 아직 설정되지 않았습니다.");
      return;
    }
    if (!validateIdentityFields()) return;

    setVerification((prev) => ({ ...prev, passLoading: true }));
    setMessage(null);

    try {
      const { requestIdentityVerification } = await import("@portone/browser-sdk/v2");
      const identityVerificationId = `mungmanager_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
        setMessage(result?.message ?? "PASS 본인인증을 시작하지 못했습니다.");
        return;
      }

      const verifyResponse = await fetch("/api/auth/verify-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityVerificationId: result.identityVerificationId,
          name: fields.name,
          birthDate: fields.birthDate,
          phoneNumber: fields.phoneNumber,
        }),
      });

      const verifyResult = (await verifyResponse.json()) as { verificationToken?: string; message?: string };
      if (!verifyResponse.ok || !verifyResult.verificationToken) {
        setMessage(verifyResult.message ?? "PASS 본인인증 확인 중 문제가 발생했습니다.");
        return;
      }

      setVerification((prev) => ({
        ...prev,
        requested: true,
        verified: true,
        verificationToken: verifyResult.verificationToken ?? null,
      }));
      setMessage("PASS 본인인증이 완료되었습니다.");
    } catch {
      setMessage("PASS 본인인증을 진행하지 못했습니다.");
    } finally {
      setVerification((prev) => ({ ...prev, passLoading: false }));
    }
  };

  const handleTermsNext = () => {
    if (!requiredAgreed) {
      setMessage("필수 약관에 동의해주세요.");
      return;
    }

    setMessage(null);
    setStep("verification");
  };

  const handleVerificationNext = () => {
    if (!verification.verified || !verification.verificationToken) {
      setMessage("본인인증을 완료해 주세요.");
      return;
    }

    setMessage(null);
    setStep("profile");
  };

  const handleSignup = async () => {
    if (loading) return;

    if (!supabaseReady || !supabase) {
      setMessage("Supabase 환경 변수가 설정되지 않았습니다. .env.local을 먼저 확인해 주세요.");
      return;
    }

    if (!requiredAgreed) {
      setMessage("필수 약관에 동의해주세요.");
      setStep("terms");
      return;
    }

    if (!verification.verified || !verification.verificationToken) {
      setMessage("본인인증을 완료해 주세요.");
      setStep("verification");
      return;
    }

    if (!(await checkLoginId())) {
      return;
    }

    if (!isValidOwnerPassword(fields.password)) {
      setMessage(ownerPasswordRuleMessage);
      return;
    }

    if (fields.password !== fields.passwordConfirm) {
      setMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (!fields.shopName || !fields.shopAddress) {
      setMessage("입력하지 않은 항목이 없는지 확인해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: fields.loginId,
          password: fields.password,
          passwordConfirm: fields.passwordConfirm,
          name: fields.name,
          birthDate: fields.birthDate,
          phoneNumber: fields.phoneNumber,
          identityVerificationToken: verification.verificationToken,
          shopName: fields.shopName,
          shopAddress: fields.shopAddress,
          agreements,
          termsVersion: OWNER_SIGNUP_TERMS_VERSION,
        }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(result.message ?? "회원가입에 실패했습니다.");
        return;
      }

      setMessage(result.message ?? "회원가입이 완료되었습니다. 로그인 화면으로 이동합니다.");
      setTimeout(() => {
        router.replace("/login?message=signup-success");
        router.refresh();
      }, 900);
    } catch {
      setMessage("회원가입 처리 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fafaf5] px-6 pb-10 pt-6 text-[#111111]">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-[#6f6f6f]">멍매니저 OWNER</div>
        <a
          href="/login"
          className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-white text-[#111111] shadow-[0_8px_20px_rgba(17,17,17,0.05)]"
        >
          <X className="h-6 w-6" strokeWidth={2.2} />
        </a>
      </div>

      <div className="mt-10 flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-[#dcfae8] text-[#2d645c]">
        <CircleUserRound className="h-8 w-8" strokeWidth={1.8} />
      </div>

      <div className="mt-8">
        <h1 className="text-[28px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#111111]">
          {step === "terms" ? "약관 동의" : step === "verification" ? "본인인증" : "회원 정보 입력"}
        </h1>
        {step === "terms" ? (
          <p className="mt-3 text-[14px] leading-6 text-[#6f6f6f]">필수 약관에 동의하면 다음 단계로 넘어갈 수 있어요.</p>
        ) : null}
        {step === "verification" ? (
          <p className="mt-3 text-[14px] leading-6 text-[#6f6f6f]">
            {portoneReady
              ? "PASS 본인인증을 먼저 완료한 뒤 회원 정보를 입력할 수 있어요."
              : "현재는 로컬 테스트용 본인인증 단계예요. 실제 문자 대신 화면에 표시되는 인증번호로 확인할 수 있어요."}
          </p>
        ) : null}
      </div>

      {step === "terms" ? (
        <div className="mt-7 space-y-3.5">
          <div className="rounded-[18px] border border-[#d8e7df] bg-[#eef8f3] px-4 py-4">
            <button type="button" onClick={toggleAllAgreements} className="flex w-full items-center gap-3 text-left">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${allAgreed ? "border-[#6b9e8a] bg-[#6b9e8a] text-white" : "border-[#cfc7b8] bg-white text-transparent"}`}
                aria-hidden="true"
              >
                <Check className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-[#111111]">전체 동의하기</span>
                <span className="mt-1 block text-[12px] leading-5 text-[#6b756f]">필수 및 선택 약관에 모두 동의합니다.</span>
              </span>
            </button>
          </div>

          {ownerSignupTerms.map((term) => (
            <AgreementRow
              key={term.id}
              checked={agreements[term.id]}
              title={term.title}
              required={term.required}
              description={term.required ? "필수 약관이에요." : "선택 동의 항목이에요."}
              onToggle={() => toggleAgreement(term.id)}
              onOpen={() => openTermModal(term.id)}
            />
          ))}

          <p className="px-1 text-[13px] leading-5 text-[#7f786f]">
            체크박스로 바로 동의하거나, 보기에서 내용을 확인한 뒤 동의할 수 있어요.
          </p>

          <button
            type="button"
            onClick={handleTermsNext}
            aria-disabled={!requiredAgreed}
            className={`mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] px-5 text-[16px] font-semibold text-white transition ${requiredAgreed ? "bg-[#6b9e8a]" : "bg-[#6b9e8a]/45"}`}
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {step === "verification" ? (
        <div className="mt-7 space-y-3.5">
          <FieldShell label="이름">
            <input
              type="text"
              value={fields.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="이름 입력"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
            />
          </FieldShell>

          <FieldShell label="생년월일 8자리">
            <input
              type="text"
              inputMode="numeric"
              value={fields.birthDate}
              onChange={(event) => updateField("birthDate", event.target.value)}
              placeholder="예: 19990321"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
            />
          </FieldShell>
          <p className="px-1 text-[13px] leading-5 text-[#7f786f]">
            실제 운영 단계에서는 외부 본인인증 연동으로 대체하고, 주민등록번호 전체는 직접 저장하지 않는 방향으로 진행할 예정이에요.
          </p>

          <FieldShell label="휴대폰 번호">
            <input
              type="text"
              inputMode="numeric"
              value={fields.phoneNumber}
              onChange={(event) => updateField("phoneNumber", event.target.value)}
              placeholder="숫자만 입력"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
            />
          </FieldShell>

          {portoneReady ? (
            <div className="space-y-3">
              <div className="rounded-[18px] border border-[#d8e7df] bg-[#eef8f3] px-4 py-3 text-[13px] leading-5 text-[#5f6f69]">
                PASS 또는 통합인증 창에서 본인인증을 완료해 주세요. 인증이 끝나면 자동으로 다음 단계로 연결됩니다.
              </div>
              <button
                type="button"
                onClick={startPassVerification}
                disabled={verification.passLoading}
                className="flex h-[52px] w-full items-center justify-center rounded-[18px] bg-[#6b9e8a] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verification.passLoading ? "PASS 인증 준비 중..." : "PASS 본인인증 시작"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <div className="flex-1">
                  <FieldShell label="인증번호">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fields.verificationCode}
                      onChange={(event) => updateField("verificationCode", event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6자리 입력"
                      className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
                    />
                  </FieldShell>
                </div>
                <button
                  type="button"
                  onClick={requestVerificationCode}
                  disabled={verification.requesting}
                  className="mt-auto h-[48px] shrink-0 rounded-[16px] border border-[#d9d2c7] bg-white px-4 text-[14px] font-semibold text-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {verification.requesting ? "요청 중..." : verification.requested ? "재요청" : "인증번호 요청"}
                </button>
              </div>

              <div className="rounded-[18px] border border-[#e4ddd2] bg-white px-4 py-3 text-[13px] leading-5 text-[#6f6f6f]">
                로컬 테스트 단계에서는 실제 문자가 발송되지 않아요. 아래에 표시되는 인증번호를 입력해 본인인증을 완료해 주세요.
              </div>

              {devVerificationCode ? (
                <div className="rounded-[18px] border border-[#cfe4db] bg-[#eef8f3] px-4 py-3">
                  <p className="text-[12px] font-medium text-[#5b6f67]">로컬 테스트용 인증번호</p>
                  <p className="mt-1 text-[24px] font-semibold tracking-[0.18em] text-[#1f5d53]">{devVerificationCode}</p>
                  <p className="mt-1 text-[12px] leading-5 text-[#6b7f77]">실제 SMS 연동 전까지는 이 번호로만 인증이 진행됩니다.</p>
                </div>
              ) : null}
            </>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep("terms")}
              className="flex h-[52px] items-center justify-center rounded-[18px] border border-[#d9d2c7] bg-white text-[15px] font-semibold text-[#111111]"
            >
              이전
            </button>
            <button
              type="button"
              onClick={verification.verified ? handleVerificationNext : verifyIdentity}
              disabled={portoneReady ? !verification.verified : verification.verifying}
              className="flex h-[52px] items-center justify-center rounded-[18px] bg-[#6b9e8a] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {portoneReady
                ? verification.verified
                  ? "다음"
                  : "PASS 인증 완료 후 활성화"
                : verification.verifying
                  ? "확인 중..."
                  : verification.verified
                    ? "다음"
                    : "인증 확인"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "profile" ? (
        <div className="mt-7 space-y-3.5">
          <div className="rounded-[18px] border border-[#e4ddd2] bg-white px-4 py-3">
            <p className="text-[13px] font-medium text-[#757575]">본인인증 완료</p>
            <p className="mt-1 text-[15px] font-semibold text-[#111111]">
              {fields.name} · {fields.birthDate} · {fields.phoneNumber}
            </p>
          </div>

          <FieldShell label="아이디">
            <input
              type="text"
              value={fields.loginId}
              onChange={(event) => updateField("loginId", event.target.value)}
              onBlur={checkLoginId}
              placeholder="아이디 입력"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
            />
          </FieldShell>
          {loginIdMessage ? (
            <p className={`px-1 text-[13px] ${loginIdAvailable ? "text-[#2f786b]" : "text-[#b14b4b]"}`}>
              {checkingLoginId ? "아이디 확인 중..." : loginIdMessage}
            </p>
          ) : null}

          <FieldShell label="비밀번호">
            <div className="flex items-center gap-3">
              <input
                type={showPassword ? "text" : "password"}
                value={fields.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="비밀번호 입력"
                className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
              />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="text-[#111111]" aria-label="비밀번호 표시 전환">
                {showPassword ? <EyeOff className="h-5 w-5" strokeWidth={2.1} /> : <Eye className="h-5 w-5" strokeWidth={2.1} />}
              </button>
            </div>
          </FieldShell>
          <p className="px-1 text-[13px] text-[#6f6f6f]">영문 대문자, 영문 소문자, 숫자, 특수문자 중 3종류 이상을 포함해 주세요.</p>

          <FieldShell label="비밀번호 확인">
            <div className="flex items-center gap-3">
              <input
                type={showPasswordConfirm ? "text" : "password"}
                value={fields.passwordConfirm}
                onChange={(event) => updateField("passwordConfirm", event.target.value)}
                placeholder="비밀번호 확인 입력"
                className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
              />
              <button type="button" onClick={() => setShowPasswordConfirm((prev) => !prev)} className="text-[#111111]" aria-label="비밀번호 확인 표시 전환">
                {showPasswordConfirm ? <EyeOff className="h-5 w-5" strokeWidth={2.1} /> : <Eye className="h-5 w-5" strokeWidth={2.1} />}
              </button>
            </div>
          </FieldShell>

          <FieldShell label="매장명">
            <input
              type="text"
              value={fields.shopName}
              onChange={(event) => updateField("shopName", event.target.value)}
              placeholder="매장명 입력"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
            />
          </FieldShell>

          <FieldShell label="매장 주소">
            <input
              type="text"
              value={fields.shopAddress}
              onChange={(event) => updateField("shopAddress", event.target.value)}
              placeholder="매장 주소 입력"
              className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
            />
          </FieldShell>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep("verification")}
              className="flex h-[52px] items-center justify-center rounded-[18px] border border-[#d9d2c7] bg-white text-[15px] font-semibold text-[#111111]"
            >
              이전
            </button>
            <button
              type="button"
              onClick={handleSignup}
              disabled={loading}
              className="flex h-[52px] items-center justify-center rounded-[18px] bg-[#6b9e8a] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "가입 중..." : "회원가입"}
            </button>
          </div>
        </div>
      ) : null}

      {activeTerm ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/30 sm:items-center sm:justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeTermModal();
          }}
        >
          <div className="w-full max-w-[430px] rounded-t-[28px] bg-[#fafaf5] px-5 pb-5 pt-4 sm:rounded-[28px]">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#ddd6cb] sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[19px] font-semibold text-[#111111]">[{activeTerm.required ? "필수" : "선택"}] {activeTerm.title}</p>
                <p className="mt-1 text-[13px] text-[#6f6f6f]">시행일 {OWNER_SIGNUP_TERMS_VERSION}</p>
              </div>
              <button type="button" onClick={closeTermModal} className="text-[15px] font-medium text-[#6f6f6f]">
                닫기
              </button>
            </div>
            <p className="mt-3 text-[13px] leading-5 text-[#6f6f6f]">약관 내용을 확인한 뒤 바로 동의하거나 닫을 수 있어요.</p>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={activeTerm.title}
              className="mt-4 max-h-[400px] overflow-y-auto rounded-[20px] border border-[#ddd6cb] bg-white px-4 py-4 text-[14px] leading-6 text-[#424242]"
            >
              <div className="whitespace-pre-wrap">{activeTerm.content}</div>
            </div>
            <div className="mt-3 text-[12px] text-[#8a857d]">스크롤은 확인용이에요. 체크박스나 동의 버튼으로 바로 진행할 수 있어요.</div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={closeTermModal}
                className="flex h-[48px] flex-1 items-center justify-center rounded-[16px] border border-[#ddd6cb] bg-white text-[15px] font-medium text-[#111111]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  updateAgreement(activeTerm.id, true);
                  closeTermModal();
                }}
                className="flex h-[48px] flex-1 items-center justify-center rounded-[16px] bg-[#6b9e8a] text-[15px] font-semibold text-white"
              >
                동의
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 rounded-[16px] bg-[#111111] px-4 py-3 text-[14px] font-medium text-white shadow-[0_10px_24px_rgba(17,17,17,0.18)]">
          {message}
        </div>
      ) : null}
    </div>
  );
}

