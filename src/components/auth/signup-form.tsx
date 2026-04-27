"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Eye, EyeOff, Smartphone } from "lucide-react";

import SocialLoginButtons from "@/components/auth/social-login-buttons";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { MobileBackLinkButton } from "@/components/ui/mobile-back-button";
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
import { env, getSupabaseRuntimeStage } from "@/lib/env";
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

type Step = "entry" | "profile";
type StartTarget = { kind: "email" } | { kind: "social"; provider: SocialProvider } | null;
type AgreementState = Record<OwnerSignupTermId, boolean>;
type VerificationMethod = "phone" | "kakao-certificate" | "naver-certificate" | "toss" | "pass";
type VerificationPurpose = "signup";
type VerificationApiResponse = {
  message?: string;
  verificationRequestId?: string | null;
  devVerificationCode?: string | null;
  verificationToken?: string | null;
};

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

function formatBirthDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length < 5) return digits;
  if (digits.length < 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function maskName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length === 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}*${trimmed.slice(-1)}`;
}

function maskPhoneNumber(value: string) {
  const digits = normalizePhone(value);
  if (digits.length < 10) return value;
  if (digits.length === 10) return `${digits.slice(0, 3)}-***-${digits.slice(6, 10)}`;
  return `${digits.slice(0, 3)}-****-${digits.slice(7, 11)}`;
}

const verificationMethods: Array<{
  id: VerificationMethod;
  title: string;
  description: string;
  kind: "active" | "placeholder";
}> = [
  { id: "phone", title: "휴대폰 본인인증", description: "가장 익숙한 방식으로 인증해요.", kind: "active" },
  { id: "kakao-certificate", title: "카카오 간편 인증", description: "카카오 인증서로 간편하게 인증해요.", kind: "placeholder" },
  { id: "naver-certificate", title: "네이버 간편 인증", description: "네이버 인증서로 간편하게 인증해요.", kind: "placeholder" },
  { id: "toss", title: "토스 간편 인증", description: "토스 앱으로 빠르게 인증해요.", kind: "placeholder" },
  { id: "pass", title: "PASS 간편 인증", description: "PASS 앱으로 빠르게 인증해요.", kind: "active" },
];

const phoneCarrierOptions = [
  { value: "SKT", label: "SKT" },
  { value: "KTF", label: "KT" },
  { value: "LGT", label: "LG U+" },
  { value: "MVNO", label: "알뜰폰" },
] as const;

function VerificationMethodLogo({ method }: { method: VerificationMethod }) {
  if (method === "kakao-certificate") {
    return (
      <Image
        src="/images/auth/kakaotalk_sharing_btn_medium.png"
        alt="카카오 인증서"
        width={43}
        height={43}
        sizes="43px"
        className="h-[43px] w-[43px] object-contain"
      />
    );
  }

  if (method === "naver-certificate") {
    return (
      <Image
        src="/images/auth/naver-login-light-kr-green-wide-h48.png"
        alt="네이버 인증서"
        width={43}
        height={43}
        sizes="43px"
        className="h-[43px] w-[43px] object-contain"
      />
    );
  }

  if (method === "phone") {
    return <Smartphone className="h-[28px] w-[28px] text-[#5d6660]" />;
  }

  if (method === "pass") {
    return (
      <Image
        src="/images/auth/pass-logo-4.png"
        alt="PASS"
        width={43}
        height={43}
        sizes="43px"
        className="h-[43px] w-[43px] object-contain"
      />
    );
  }

  return (
    <Image
      src="/images/auth/Toss_Symbol_Primary.png"
      alt="토스 인증"
      width={35}
      height={35}
      sizes="35px"
      className="h-[35px] w-[35px] object-contain"
    />
  );
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
  helper,
  error,
  tone = "default",
  children,
}: {
  label: string;
  hint?: string;
  helper?: string;
  error?: string;
  tone?: "default" | "success";
  children: React.ReactNode;
}) {
  const message = error || helper || hint;

  return (
    <label className="block">
      <div
        className={cn(
          "group relative rounded-[12px] border bg-white px-4 pb-3 pt-3.5 transition focus-within:border-[#1f6b5b] focus-within:shadow-[0_0_0_3px_rgba(31,107,91,0.08)]",
          error
            ? "border-[#d99a90] bg-[#fffdfc]"
            : tone === "success"
              ? "border-[#9ec6bb] bg-[#fdfefe]"
              : "border-[#d9d3ca]",
        )}
      >
        <span className="absolute -top-2 left-3 bg-white px-1.5 text-[12px] font-medium leading-4 text-[#7b746b]">
          {label}
        </span>
        {children}
      </div>
      {message ? (
        <p
          className={cn(
            "mt-1 px-0.5 text-[12px] leading-[1.4]",
            error ? "text-[#c65c50]" : tone === "success" ? "text-[#3a7c6d]" : "text-[#9a9188]",
          )}
        >
          {message}
        </p>
      ) : null}
    </label>
  );
}

function AuthSectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="space-y-1 px-1">
        <h2 className="text-[15px] font-semibold tracking-[-0.03em] text-[#2f2a25]">{title}</h2>
        {description ? <p className="text-[12px] leading-[1.5] text-[#847c73]">{description}</p> : null}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function AuthInput({
  value,
  onChange,
  placeholder,
  inputMode,
  type = "text",
  rightSlot,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
  rightSlot?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={cn(
          "h-[24px] w-full border-0 bg-white px-0 py-0 text-[16px] text-[#171411] outline-none placeholder:text-[#b8b1a7] focus:bg-white [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_white] [&:-webkit-autofill]:[-webkit-text-fill-color:#171411]",
          rightSlot ? "pr-8" : "",
          className,
        )}
      />
      {rightSlot ? <div className="absolute inset-y-0 right-0 flex items-center">{rightSlot}</div> : null}
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
  const [step, setStep] = useState<Step>(initialStart === "email" ? "profile" : "entry");
  const [startTarget, setStartTarget] = useState<StartTarget>(null);
  const [agreements, setAgreements] = useState<AgreementState>(initialAgreements);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verificationRequestId, setVerificationRequestId] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationSheetOpen, setVerificationSheetOpen] = useState(false);
  const [verificationDetailSheetOpen, setVerificationDetailSheetOpen] = useState(false);
  const [selectedVerificationMethod, setSelectedVerificationMethod] = useState<VerificationMethod | null>(null);
  const [phoneCarrier, setPhoneCarrier] = useState<(typeof phoneCarrierOptions)[number]["value"]>("SKT");
  const selectedVerificationMeta = useMemo(
    () => verificationMethods.find((method) => method.id === selectedVerificationMethod) ?? null,
    [selectedVerificationMethod],
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [shopDetailAddress, setShopDetailAddress] = useState("");
  const [shopPostalCode, setShopPostalCode] = useState("");
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [fields, setFields] = useState({
    name: "",
    birthDate: "",
    phoneNumber: "",
    verificationCode: "",
    loginId: "",
    password: "",
    passwordConfirm: "",
    shopName: "",
    shopPhone: "",
    shopAddress: "",
  });

  const requiredAgreed = agreements.service && agreements.privacy;
  const allAgreed = ownerSignupTerms.every((term) => agreements[term.id]);
  const passwordConfirmState =
    fields.passwordConfirm.length === 0
      ? null
      : fields.password === fields.passwordConfirm
        ? { tone: "success" as const, helper: "비밀번호가 일치합니다" }
        : { error: "비밀번호가 일치하지 않습니다" };

  const verificationPurpose: VerificationPurpose = "signup";
  const canShowDevVerificationCode = useMemo(() => getSupabaseRuntimeStage() === "development", []);

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
    setStep("profile");
    setStartTarget({ kind: "email" });
  }, [initialStart]);

  const updateField = (key: keyof typeof fields, value: string) => {
    const normalizedValue =
      key === "birthDate"
        ? value.replace(/\D/g, "").slice(0, 8)
        : key === "phoneNumber" || key === "shopPhone"
          ? normalizePhone(value)
          : value;

    setFields((prev) => ({
      ...prev,
      [key]: normalizedValue,
      ...(key === "name" || key === "birthDate" || key === "phoneNumber" ? { verificationCode: "" } : {}),
    }));

    if (key === "name" || key === "birthDate" || key === "phoneNumber") {
      setVerificationRequestId(null);
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
      setStep("profile");
      return;
    }

    await handleSocialLogin(target.provider);
  };

  const moveToVerificationStep = () => {
    const loginId = normalizeOwnerLoginId(fields.loginId);

    if (!isValidOwnerLoginId(loginId)) {
      setMessage("아이디는 영문 소문자, 숫자, 마침표(.), 하이픈(-), 밑줄(_) 조합으로 4자 이상 입력해 주세요.");
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
    if (!fields.shopName.trim()) {
      setMessage("매장명을 입력해 주세요.");
      return;
    }
    if (!/^01\d{8,9}$/.test(fields.shopPhone)) {
      setMessage("매장 연락처를 올바르게 입력해 주세요.");
      return;
    }
    if (!fields.shopAddress.trim()) {
      setMessage("매장 주소를 입력해 주세요.");
      return;
    }

    setMessage(null);
    setSelectedVerificationMethod(null);
    setVerificationDetailSheetOpen(false);
    setVerificationSheetOpen(true);
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
          purpose: verificationPurpose,
          method: "local",
        }),
      });

      const result = (await response.json()) as VerificationApiResponse;

      if (!response.ok) {
        setMessage(result.message ?? "인증번호 요청에 실패했어요.");
        return;
      }

      setVerificationRequestId(result.verificationRequestId ?? null);
      setDevCode(result.devVerificationCode ?? null);
      setMessage("인증번호를 보냈어요.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
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
          name: fields.name,
          birthDate: fields.birthDate,
          phoneNumber: fields.phoneNumber,
          code: fields.verificationCode,
          purpose: verificationPurpose,
          verificationRequestId,
        }),
      });
      const result = (await response.json()) as VerificationApiResponse;

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

  const verifyPortoneIdentity = async ({
    channelKey,
    successMessage,
    missingEnvMessage,
    bypass,
  }: {
    channelKey?: string;
    successMessage: string;
    missingEnvMessage: string;
    bypass?: Record<string, unknown>;
  }) => {
    if (!portoneReady || !env.portoneStoreId || !channelKey) {
      setMessage(missingEnvMessage);
      return;
    }

    if (!fields.name.trim()) {
      setMessage("이름을 입력해 주세요.");
      return;
    }

    if (!isValidBirthDate8(fields.birthDate)) {
      setMessage("생년월일 8자리를 입력해 주세요.");
      return;
    }

    if (!/^01\d{8,9}$/.test(fields.phoneNumber)) {
      setMessage("휴대폰번호를 올바르게 입력해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const requestResponse = await fetch("/api/auth/request-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: verificationPurpose,
          method: "portone",
          name: fields.name,
          birthDate: fields.birthDate,
          phoneNumber: fields.phoneNumber,
        }),
      });
      const requestResult = (await requestResponse.json()) as VerificationApiResponse;

      if (!requestResponse.ok || !requestResult.verificationRequestId) {
        setMessage(requestResult.message ?? "ë³¸ì¸ ?¸ì¦ ?”ì²­???€?¥í•˜ì§€ ëª»í–ˆ?´ìš”.");
        return;
      }

      const { requestIdentityVerification } = await import("@portone/browser-sdk/v2");
      const identityVerificationId = `petmanager_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const result = await requestIdentityVerification({
        storeId: env.portoneStoreId,
        channelKey,
        identityVerificationId,
        windowType: { pc: "POPUP", mobile: "POPUP" },
        customer: {
          fullName: fields.name.trim(),
          phoneNumber: fields.phoneNumber,
          birthYear: fields.birthDate.slice(0, 4),
          birthMonth: fields.birthDate.slice(4, 6),
          birthDay: fields.birthDate.slice(6, 8),
        },
        ...(bypass ? { bypass } : {}),
      });

      if (!result?.identityVerificationId) {
        setMessage("본인 인증을 완료하지 못했어요.");
        return;
      }

      const response = await fetch("/api/auth/verify-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: verificationPurpose,
          verificationRequestId: requestResult.verificationRequestId,
          identityVerificationId: result!.identityVerificationId,
        }),
      });
      const verifyResult = (await response.json()) as VerificationApiResponse;

      if (!response.ok || !verifyResult.verificationToken) {
        setMessage(verifyResult.message ?? "본인 인증 확인에 실패했어요.");
        return;
      }

      setVerificationToken(verifyResult.verificationToken);
      setMessage(successMessage);
    } finally {
      setLoading(false);
    }
  };

  const verifyPass = async () => {
    await verifyPortoneIdentity({
      channelKey: env.portoneIdentityChannelKey,
      successMessage: "PASS 본인 인증이 완료되었어요.",
      missingEnvMessage: "PASS 본인인증 환경이 아직 준비되지 않았어요.",
    });
    return;
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
        storeId: env.portoneStoreId!,
        channelKey: env.portoneIdentityChannelKey!,
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
          identityVerificationId: result!.identityVerificationId,
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

  const startPhoneIdentity = async () => {
    await verifyPortoneIdentity({
      channelKey: env.portoneIdentityDanalChannelKey,
      successMessage: "휴대폰 본인 인증이 완료되었어요.",
      missingEnvMessage: "다날 휴대폰 본인 인증 채널이 아직 연결되지 않았어요.",
      bypass: {
        danal: {
          IsCarrier: phoneCarrier,
          CPTITLE: "petmanager.co.kr",
        },
      },
    });
  };

  const startUnifiedIdentity = async (agency: "KAKAO" | "NAVER" | "TOSS" | "PASS", successMessage: string) => {
    await verifyPortoneIdentity({
      channelKey: env.portoneIdentityUnifiedChannelKey,
      successMessage,
      missingEnvMessage: "KG이니시스 통합인증 채널이 아직 연결되지 않았어요.",
      bypass: {
        inicisUnified: {
          flgFixedUser: "Y",
          directAgency: agency,
        },
      },
    });
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
    if (!/^01\d{8,9}$/.test(fields.shopPhone)) {
      setMessage("매장 연락처를 올바르게 입력해 주세요.");
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
          shopPhone: fields.shopPhone,
          shopAddress: [fields.shopAddress.trim(), shopDetailAddress.trim()].filter(Boolean).join(" "),
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
      <div className="space-y-6">
        <MobileBackLinkButton
          href={step === "entry" ? `/login?next=${encodeURIComponent(nextPath)}` : "/signup"}
          replace
          aria-label={step === "entry" ? "로그인으로 이동" : "회원가입 첫 단계로 이동"}
        />

        <div className="space-y-3">
          <p className={PAGE_EYEBROW}>회원가입</p>
          <div>
            <h1 className={PAGE_TITLE}>
              {step === "entry" ? "무료체험을 시작해볼까요?" : "계정과 매장 정보를 입력해 주세요"}
            </h1>
            <p className={cn(PAGE_DESCRIPTION, "mt-3")}>
              {step === "entry"
                ? "기본 약관에 동의하고 가입을 시작하면 2주 무료체험을 바로 이용할 수 있어요."
                : "아이디, 비밀번호, 매장 정보를 먼저 입력하고 마지막에 본인 인증을 진행할게요."}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-7">
        {step === "entry" ? (
          <EntryStep
            loading={loading}
            socialLoading={socialLoading}
            onStartEmail={() => openStart({ kind: "email" })}
            onStartSocial={(provider) => openStart({ kind: "social", provider })}
            nextPath={nextPath}
          />
        ) : null}

        {step === "profile" ? (
          <div className="space-y-4">
            <AuthSectionBlock
              title="계정 정보"
              description="로그인에 사용할 정보를 설정해 주세요."
            >
              <AuthField
                label="아이디"
              >
                <AuthInput
                  value={fields.loginId}
                  onChange={(value) => updateField("loginId", value)}
                  placeholder="영문 소문자·숫자 포함 4자 이상"
                />
              </AuthField>

              <AuthField
                label="비밀번호"
              >
                <AuthInput
                  type={showPassword ? "text" : "password"}
                  value={fields.password}
                  onChange={(value) => updateField("password", value)}
                  placeholder="대/소문자·숫자·특수문자 중 3종 이상"
                  rightSlot={
                    <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="text-[#615d57]">
                      {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  }
                />
              </AuthField>

              <AuthField
                label="비밀번호 확인"
                tone={passwordConfirmState?.tone}
                helper={passwordConfirmState && "helper" in passwordConfirmState ? passwordConfirmState.helper : undefined}
                error={passwordConfirmState && "error" in passwordConfirmState ? passwordConfirmState.error : undefined}
              >
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
            </AuthSectionBlock>

            <AuthSectionBlock
              title="매장 정보"
              description="기본 매장 정보를 입력해 주세요."
            >
              <AuthField label="매장명">
                <AuthInput
                  value={fields.shopName}
                  onChange={(value) => updateField("shopName", value)}
                  placeholder="예: 포근한 발바닥 미용실"
                />
              </AuthField>

              <AuthField label="매장 연락처">
                <AuthInput
                  value={formatPhone(fields.shopPhone)}
                  onChange={(value) => updateField("shopPhone", value)}
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                />
              </AuthField>

              <AuthField label="매장 주소">
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setAddressSheetOpen(true)}
                      className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[18px] border border-[#e1d7ca] bg-[#fffdf9] px-4 py-3 text-left"
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-[15px] font-medium tracking-[-0.02em]",
                            fields.shopAddress ? "text-[#171411]" : "text-[#b8b1a7]",
                          )}
                        >
                          {fields.shopAddress || "주소 검색으로 매장 주소를 선택해 주세요"}
                        </p>
                        {shopPostalCode ? (
                          <p className="mt-1 text-[12px] font-medium text-[#8a8176]">우편번호 {shopPostalCode}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold text-[#2f786b]">주소 검색</span>
                    </button>

                    <AuthInput
                      value={shopDetailAddress}
                      onChange={setShopDetailAddress}
                      placeholder="상세 주소를 입력해 주세요"
                    />
                    <p className={INLINE_HELP}>건물명, 층수, 호수는 상세 주소에 적어 주세요.</p>
                  </div>

                  <AuthInput
                    className="hidden"
                  value={fields.shopAddress}
                  onChange={(value) => updateField("shopAddress", value)}
                  placeholder="매장 주소를 입력해 주세요"
                />
              </AuthField>
            </AuthSectionBlock>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  initialStart === "email" ? router.replace(`/login?next=${encodeURIComponent(nextPath)}` as never) : setStep("entry")
                }
                className={cn(BUTTON_SECONDARY, "h-[48px]")}
              >
                이전
              </button>
              <button type="button" onClick={moveToVerificationStep} disabled={loading} className={cn(BUTTON_PRIMARY, "h-[48px]")}>
                다음
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className={cn(INLINE_ERROR, "mt-3.5")}>{message}</p> : null}
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

      {verificationSheetOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/35"
          onClick={(event) => {
            if (event.target === event.currentTarget) setVerificationSheetOpen(false);
          }}
        >
          <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-end">
            <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[26px] bg-white shadow-[0_-18px_50px_rgba(15,23,42,0.12)]">
              <div className="shrink-0 border-b border-[#f0e9df] px-5 pb-4 pt-4">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-[#d7dbd4]" />
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div className="space-y-2.5">
                    <div>
                      <h2 className="text-[24px] font-extrabold tracking-[-0.04em] text-[#111827]">본인 확인</h2>
                      <p className="mt-2 text-[13px] leading-[1.55] text-[#6f6b64]">
                        입력은 거의 끝났어요.
                        <br />
                        운영자 확인만 마치면 바로 시작할 수 있어요.
                      </p>
                    </div>

                    <div className="rounded-[16px] border border-[#ebe5dc] bg-[#faf9f6] px-4 py-2.5">
                      <p className="text-[12px] font-semibold text-[#5f665f]">왜 필요한가요?</p>
                      <p className="mt-1 text-[12px] leading-[1.5] text-[#8b847b]">
                        예약·고객 정보 보호와 계정 확인을 위해 필요해요.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setVerificationSheetOpen(false)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e4ddd2] bg-[#fffdfa] text-[#615d57]"
                    aria-label="본인 확인 닫기"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
                <div>
                  <p className="text-[14px] font-semibold text-[#2f2a25]">편한 방법으로 확인해 주세요</p>
                  <div className="mt-3 space-y-2">
                    {verificationMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setSelectedVerificationMethod(method.id);
                          setVerificationSheetOpen(false);
                          setVerificationDetailSheetOpen(true);
                          setMessage(null);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[16px] border px-4 py-3.5 text-left transition",
                          selectedVerificationMethod === method.id
                            ? "border-[#cfe2dc] bg-[#f3faf6]"
                            : "border-[#e8e1d6] bg-white",
                        )}
                      >
                        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center">
                          <VerificationMethodLogo method={method.id} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-[#171411]">{method.title}</p>
                          <p className="mt-0.5 text-[12px] leading-5 text-[#8b847b]">{method.description}</p>
                        </div>
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                            selectedVerificationMethod === method.id
                              ? "border-[#1f6b5b] bg-[#1f6b5b] text-white"
                              : "border-[#d8d1c6] bg-white text-transparent",
                          )}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedVerificationMeta ? (
                  <div className="mt-5 rounded-[16px] border border-[#ece4da] bg-[#fcfaf7] px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center">
                        <VerificationMethodLogo method={selectedVerificationMeta.id} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-[#171411]">{selectedVerificationMeta.title}</p>
                        <p className="mt-0.5 text-[12px] leading-5 text-[#8b847b]">{selectedVerificationMeta.description}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedVerificationMethod === "phone" ? (
                  <div className="mt-5 space-y-3 rounded-[18px] border border-[#ece4da] bg-[#fcfaf7] p-4">
                    <p className="text-[13px] font-semibold text-[#2f2a25]">휴대폰 본인인증 정보 입력</p>
                    <div className="space-y-3">
                      <AuthField label="이름">
                        <AuthInput value={fields.name} onChange={(value) => updateField("name", value)} placeholder="대표자 이름" />
                      </AuthField>
                      <AuthField label="생년월일">
                        <AuthInput
                          value={formatBirthDate(fields.birthDate)}
                          onChange={(value) => updateField("birthDate", value)}
                          placeholder="예: 1999-03-21"
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

                    <div className="space-y-2">
                      <p className="text-[12px] font-medium text-[#7b746b]">통신사 선택</p>
                      <div className="grid grid-cols-4 gap-2">
                        {phoneCarrierOptions.map((carrier) => (
                          <button
                            key={carrier.value}
                            type="button"
                            onClick={() => setPhoneCarrier(carrier.value)}
                            className={cn(
                              "h-[42px] rounded-[12px] border text-[13px] font-semibold transition",
                              phoneCarrier === carrier.value
                                ? "border-[#1f6b5b] bg-[#eff8f6] text-[#1f6b5b]"
                                : "border-[#e4ddd2] bg-white text-[#5f5a54]",
                            )}
                          >
                            {carrier.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button type="button" onClick={startPhoneIdentity} disabled={loading} className={cn(BUTTON_SECONDARY, "h-[48px]")}>
                      {verificationRequestId ? "인증번호 다시 받기" : "휴대폰 본인인증"}
                    </button>

                    {verificationRequestId ? (
                      <div className="space-y-3 rounded-[14px] border border-[#ebe2d6] bg-white p-3">
                        <AuthField label="인증번호">
                          <AuthInput
                            value={fields.verificationCode}
                            onChange={(value) => updateField("verificationCode", value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="문자로 받은 6자리 숫자"
                            inputMode="numeric"
                          />
                        </AuthField>

                        {canShowDevVerificationCode && devCode ? (
                          <p className={INLINE_HELP}>로컬 테스트용 인증번호: {devCode}</p>
                        ) : null}

                        <button type="button" onClick={verifyCode} disabled={loading} className={cn(BUTTON_PRIMARY, "h-[48px]")}>
                          인증 확인
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selectedVerificationMethod === "pass" ? (
                  <div className="mt-5 space-y-3 rounded-[18px] border border-[#ece4da] bg-[#fcfaf7] p-4">
                    <p className="text-[13px] font-semibold text-[#2f2a25]">PASS 인증 정보 입력</p>
                    <div className="space-y-3">
                      <AuthField label="이름">
                        <AuthInput value={fields.name} onChange={(value) => updateField("name", value)} placeholder="대표자 이름" />
                      </AuthField>
                      <AuthField label="생년월일">
                        <AuthInput
                          value={formatBirthDate(fields.birthDate)}
                          onChange={(value) => updateField("birthDate", value)}
                          placeholder="예: 1999-03-21"
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

                    <button
                      type="button"
                      onClick={() => startUnifiedIdentity("PASS", "PASS 본인 인증이 완료되었어요.")}
                      disabled={loading}
                      className={cn(BUTTON_SECONDARY, "h-[48px] border-[#cfe2dc] bg-[#eff8f6] text-[#1f6b5b] hover:bg-[#e9f4f0]")}
                    >
                      PASS로 인증하기
                    </button>
                  </div>
                ) : null}

                {selectedVerificationMethod && selectedVerificationMethod !== "phone" && selectedVerificationMethod !== "pass" ? (
                  <div className="mt-5 rounded-[16px] border border-dashed border-[#d9d3ca] bg-[#fcfaf7] px-4 py-5 text-center">
                    <p className="text-[14px] font-semibold text-[#2f2a25]">준비 중인 인증 수단입니다</p>
                    <p className="mt-2 text-[12px] leading-5 text-[#8b847b]">
                      실제 인증 연동 전까지는 사용할 수 없어요.
                      <br />
                      서버에서 인증사 결과를 조회해 확인하도록 연결이 필요합니다.
                    </p>
                  </div>
                ) : null}

                {verificationToken ? (
                  <div className="mt-5 rounded-[14px] border border-[#cfe2dc] bg-[#eff8f6] px-4 py-3">
                    <p className="text-[14px] font-semibold text-[#1f6b5b]">인증이 완료되었습니다</p>
                    <p className="mt-1 text-[13px] text-[#43685f]">
                      {maskName(fields.name)} · {maskPhoneNumber(fields.phoneNumber)}
                    </p>
                  </div>
                ) : null}

                {message ? <p className={cn(INLINE_ERROR, "mt-4")}>{message}</p> : null}
              </div>

              {verificationToken ? (
                <div className="shrink-0 border-t border-[#f0e9df] bg-white px-5 pb-5 pt-4">
                  <button
                    type="button"
                    onClick={submitSignup}
                    disabled={loading || !verificationToken}
                    className={cn(BUTTON_PRIMARY, "h-[48px]")}
                  >
                    {loading ? "가입 처리 중..." : "가입 완료"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {verificationDetailSheetOpen && selectedVerificationMeta ? (
        <div
          className="fixed inset-0 z-50 bg-black/35"
          onClick={(event) => {
            if (event.target === event.currentTarget) setVerificationDetailSheetOpen(false);
          }}
        >
          <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-end">
            <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[26px] bg-white shadow-[0_-18px_50px_rgba(15,23,42,0.12)]">
              <div className="shrink-0 border-b border-[#f0e9df] px-5 pb-4 pt-4">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-[#d7dbd4]" />
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationDetailSheetOpen(false);
                        setSelectedVerificationMethod(null);
                        setVerificationSheetOpen(true);
                        setMessage(null);
                      }}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e4ddd2] bg-[#fffdfa] text-[#615d57]"
                      aria-label="인증 수단 다시 선택하기"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#7b746b]">본인 확인</p>
                      <h2 className="mt-1 truncate text-[20px] font-extrabold tracking-[-0.04em] text-[#111827]">
                        {selectedVerificationMeta.title}
                      </h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setVerificationDetailSheetOpen(false)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e4ddd2] bg-[#fffdfa] text-[#615d57]"
                    aria-label="본인 확인 닫기"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
                {selectedVerificationMethod === "phone" ? (
                  <div className="space-y-3 rounded-[18px] border border-[#ece4da] bg-[#fcfaf7] p-4">
                    <p className="text-[13px] font-semibold text-[#2f2a25]">휴대폰 본인인증 정보 입력</p>
                    <div className="space-y-3">
                      <AuthField label="이름">
                        <AuthInput value={fields.name} onChange={(value) => updateField("name", value)} placeholder="대표자 이름" />
                      </AuthField>
                      <AuthField label="생년월일">
                        <AuthInput
                          value={formatBirthDate(fields.birthDate)}
                          onChange={(value) => updateField("birthDate", value)}
                          placeholder="예: 1999-03-21"
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

                    <div className="space-y-2">
                      <p className="text-[12px] font-medium text-[#7b746b]">통신사 선택</p>
                      <div className="grid grid-cols-4 gap-2">
                        {phoneCarrierOptions.map((carrier) => (
                          <button
                            key={carrier.value}
                            type="button"
                            onClick={() => setPhoneCarrier(carrier.value)}
                            className={cn(
                              "h-[42px] rounded-[12px] border text-[13px] font-semibold transition",
                              phoneCarrier === carrier.value
                                ? "border-[#1f6b5b] bg-[#eff8f6] text-[#1f6b5b]"
                                : "border-[#e4ddd2] bg-white text-[#5f5a54]",
                            )}
                          >
                            {carrier.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button type="button" onClick={startPhoneIdentity} disabled={loading} className={cn(BUTTON_SECONDARY, "h-[48px]")}>
                      {verificationRequestId ? "인증번호 다시 받기" : "휴대폰 본인인증"}
                    </button>

                    {verificationRequestId ? (
                      <div className="space-y-3 rounded-[14px] border border-[#ebe2d6] bg-white p-3">
                        <AuthField label="인증번호">
                          <AuthInput
                            value={fields.verificationCode}
                            onChange={(value) => updateField("verificationCode", value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="문자로 받은 6자리 숫자"
                            inputMode="numeric"
                          />
                        </AuthField>

                        {canShowDevVerificationCode && devCode ? (
                          <p className={INLINE_HELP}>로컬 테스트용 인증번호: {devCode}</p>
                        ) : null}

                        <button type="button" onClick={verifyCode} disabled={loading} className={cn(BUTTON_PRIMARY, "h-[48px]")}>
                          인증 확인
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selectedVerificationMethod === "pass" ? (
                  <div className="space-y-3 rounded-[18px] border border-[#ece4da] bg-[#fcfaf7] p-4">
                    <p className="text-[13px] font-semibold text-[#2f2a25]">PASS 인증 정보 입력</p>
                    <div className="space-y-3">
                      <AuthField label="이름">
                        <AuthInput value={fields.name} onChange={(value) => updateField("name", value)} placeholder="대표자 이름" />
                      </AuthField>
                      <AuthField label="생년월일">
                        <AuthInput
                          value={formatBirthDate(fields.birthDate)}
                          onChange={(value) => updateField("birthDate", value)}
                          placeholder="예: 1999-03-21"
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

                    <button
                      type="button"
                      onClick={() => startUnifiedIdentity("PASS", "PASS 본인 인증이 완료되었어요.")}
                      disabled={loading}
                      className={cn(BUTTON_SECONDARY, "h-[48px] border-[#cfe2dc] bg-[#eff8f6] text-[#1f6b5b] hover:bg-[#e9f4f0]")}
                    >
                      PASS로 인증하기
                    </button>
                  </div>
                ) : null}

                {selectedVerificationMethod !== "phone" && selectedVerificationMethod !== "pass" ? (
                  <div className="space-y-3 rounded-[18px] border border-[#ece4da] bg-[#fcfaf7] p-4">
                    <p className="text-[13px] font-semibold text-[#2f2a25]">간편 인증을 시작할게요.</p>
                    <p className="text-[12px] leading-5 text-[#8b847b]">
                      선택한 인증 수단으로 이동해 본인 확인을 진행해 주세요.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        startUnifiedIdentity(
                          selectedVerificationMethod === "kakao-certificate"
                            ? "KAKAO"
                            : selectedVerificationMethod === "naver-certificate"
                              ? "NAVER"
                              : "TOSS",
                          `${
                            selectedVerificationMethod === "kakao-certificate"
                              ? "카카오"
                              : selectedVerificationMethod === "naver-certificate"
                                ? "네이버"
                                : "토스"
                          } 간편 인증이 완료되었어요.`,
                        )
                      }
                      disabled={loading}
                      className={cn(BUTTON_SECONDARY, "h-[48px] border-[#cfe2dc] bg-[#eff8f6] text-[#1f6b5b] hover:bg-[#e9f4f0]")}
                    >
                      {selectedVerificationMethod === "kakao-certificate"
                        ? "카카오 간편 인증 시작"
                        : selectedVerificationMethod === "naver-certificate"
                          ? "네이버 간편 인증 시작"
                          : "토스 간편 인증 시작"}
                    </button>
                  </div>
                ) : null}

                {verificationToken ? (
                  <div className="mt-5 rounded-[14px] border border-[#cfe2dc] bg-[#eff8f6] px-4 py-3">
                    <p className="text-[14px] font-semibold text-[#1f6b5b]">인증이 완료되었습니다</p>
                    <p className="mt-1 text-[13px] text-[#43685f]">
                      {maskName(fields.name)} · {maskPhoneNumber(fields.phoneNumber)}
                    </p>
                  </div>
                ) : null}

                {message ? <p className={cn(INLINE_ERROR, "mt-4")}>{message}</p> : null}
              </div>

              {verificationToken ? (
                <div className="shrink-0 border-t border-[#f0e9df] bg-white px-5 pb-5 pt-4">
                  <button
                    type="button"
                    onClick={submitSignup}
                    disabled={loading || !verificationToken}
                    className={cn(BUTTON_PRIMARY, "h-[48px]")}
                  >
                    {loading ? "가입 처리 중..." : "가입 완료"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {addressSheetOpen ? (
        <KakaoPostcodeSheet
          title="매장 주소 검색"
          description="도로명, 건물명, 지번으로 검색한 뒤 매장 주소를 선택해 주세요."
          initialQuery={fields.shopAddress}
          onClose={() => setAddressSheetOpen(false)}
          onSelect={(selection) => {
            updateField("shopAddress", selection.address);
            setShopPostalCode(selection.zonecode);
            setAddressSheetOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
