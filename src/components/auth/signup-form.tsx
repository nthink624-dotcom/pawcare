"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Smartphone } from "lucide-react";

import SocialLoginButtons from "@/components/auth/social-login-buttons";
import SignupRedesignView, {
  type SignupProfileStage,
} from "@/components/auth/signup-redesign-view";
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
import { requestPortoneIdentityVerification } from "@/lib/portone/identity-verification-client";
import {
  getOAuthRedirectOrigin,
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
  PAGE_FRAME,
  PAGE_TITLE,
  cn,
} from "@/lib/ui-system";
import { getSupabaseBrowserClient, getSupabaseOAuthBrowserClient } from "@/lib/supabase/client";

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
  identity?: {
    name?: string | null;
    birthDate?: string | null;
    phoneNumber?: string | null;
  } | null;
};
type LoginIdCheckState = {
  status: "idle" | "checking" | "available" | "unavailable" | "error";
  loginId: string;
  message: string | null;
};

const initialAgreements: AgreementState = {
  service: false,
  privacy: false,
  location: false,
  marketing: false,
};

const termLinkById: Record<OwnerSignupTermId, string> = {
  service: "/terms",
  privacy: "/privacy-consent",
  location: "/terms",
  marketing: "/privacy",
};

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function normalizeShopPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidShopPhone(value: string) {
  return /^(?:02\d{7,8}|0[3-6]\d{7,8}|070\d{7,8}|050\d{8}|01\d{8,9})$/.test(normalizeShopPhone(value));
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function formatShopPhone(value: string) {
  const digits = normalizeShopPhone(value);
  if (digits.startsWith("02")) {
    if (digits.length < 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
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
  { id: "phone", title: "휴대폰 본인인증", description: "가입자 본인 여부를 확인해요.", kind: "active" },
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
    return <Smartphone className="h-[26px] w-[26px] text-[#64748b]" />;
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

  if (
    normalized.includes("error getting user email from external provider") ||
    (normalized.includes("external provider") && normalized.includes("email"))
  ) {
    return "네이버에서 이메일 정보를 받지 못해 간편가입을 진행할 수 없어요. 네이버 개발자센터에서 제공 정보에 이메일 주소를 추가한 뒤 다시 시도해 주세요.";
  }

  if (normalized.includes("invalid login credentials")) return "아이디 또는 비밀번호를 다시 확인해 주세요.";
  if (normalized.includes("email not confirmed")) return "이메일 인증이 아직 완료되지 않았습니다.";
  if (normalized.includes("user already registered")) return "이미 가입된 계정입니다.";
  if (normalized.includes("password should be at least")) return ownerPasswordRuleMessage;
  if (normalized.includes("unable to validate email address")) return "이메일 형식을 다시 확인해 주세요.";
  if (normalized.includes("oauth")) return "소셜 로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.";

  return "처리 중 문제가 발생했습니다. 다시 시도해 주세요.";
}

function toKoreanIdentityVerificationError(message?: string) {
  const normalized = (message ?? "").toLowerCase();

  if (normalized.includes("already verified")) {
    return "이미 완료된 본인인증 요청이에요. 창을 닫고 다시 진행해 주세요.";
  }
  if (normalized.includes("cancel") || normalized.includes("close")) {
    return "본인인증이 완료되지 않았어요. 다시 인증해 주세요.";
  }
  if (normalized.includes("timeout") || normalized.includes("expired")) {
    return "본인인증 시간이 만료됐어요. 다시 인증해 주세요.";
  }

  return message || "본인인증 처리 중 문제가 발생했어요. 다시 시도해 주세요.";
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
    <label className="block space-y-1">
      <span className="block px-0.5 text-[13px] font-medium leading-[18px] text-[#475569]">
        {label}
      </span>
      <div className={cn(error && "[&_input]:border-[#d99a90]", tone === "success" && "[&_input]:border-[#9ec6bb]")}>
        {children}
      </div>
      {message ? (
        <p
          className={cn(
            "px-0.5 text-[12px] leading-[1.45]",
            error ? "text-[#c65c50]" : tone === "success" ? "text-[#1f6b5b]" : "text-[#64748b]",
          )}
        >
          {message}
        </p>
      ) : null}
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
          "h-[48px] w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3.5 text-[15px] font-medium text-[#111827] outline-none transition placeholder:text-[#a8b0bd] focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10 [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_white] [&:-webkit-autofill]:[-webkit-text-fill-color:#111827]",
          rightSlot ? "pr-12" : "",
          className,
        )}
      />
      {rightSlot ? <div className="absolute inset-y-0 right-4 flex items-center">{rightSlot}</div> : null}
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
  const oauthSupabase = useMemo(() => getSupabaseOAuthBrowserClient(), []);
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
  const [profileStage, setProfileStage] = useState<SignupProfileStage>("account");
  const [pendingProfileStage, setPendingProfileStage] = useState<SignupProfileStage | null>(null);
  const [shopPhoneSameAsOwner, setShopPhoneSameAsOwner] = useState(false);
  const [loginIdCheck, setLoginIdCheck] = useState<LoginIdCheckState>({
    status: "idle",
    loginId: "",
    message: null,
  });
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
  const passwordRuleError = fields.password.length > 0 && !isValidOwnerPassword(fields.password) ? ownerPasswordRuleMessage : undefined;
  const normalizedLoginId = normalizeOwnerLoginId(fields.loginId);
  const loginIdFieldError =
    fields.loginId.length > 0 && !isValidOwnerLoginId(normalizedLoginId)
      ? "아이디는 영문 소문자, 숫자, ., -, _ 조합으로 4자 이상 입력해 주세요."
      : loginIdCheck.status === "unavailable" && loginIdCheck.loginId === normalizedLoginId
        ? loginIdCheck.message ?? "이미 사용 중인 아이디입니다."
        : loginIdCheck.status === "error" && loginIdCheck.loginId === normalizedLoginId
          ? loginIdCheck.message ?? "아이디 중복 확인 중 문제가 발생했습니다."
          : undefined;
  const loginIdFieldHelper =
    !loginIdFieldError && loginIdCheck.loginId === normalizedLoginId
      ? loginIdCheck.status === "checking"
        ? "아이디 중복을 확인하고 있어요."
        : loginIdCheck.status === "available"
          ? loginIdCheck.message ?? "사용 가능한 아이디입니다."
          : undefined
      : undefined;
  const loginIdFieldTone = loginIdCheck.status === "available" && loginIdCheck.loginId === normalizedLoginId ? "success" : "default";
  const passwordFieldHelper = fields.password.length > 0 && !passwordRuleError ? "사용 가능합니다." : undefined;
  const passwordFieldTone = passwordFieldHelper ? "success" : "default";

  const verificationPurpose: VerificationPurpose = "signup";
  const canShowDevVerificationCode = useMemo(() => getSupabaseRuntimeStage() === "development", []);

  useEffect(() => {
    const loginId = normalizeOwnerLoginId(fields.loginId);
    if (!fields.loginId.trim()) {
      setLoginIdCheck({ status: "idle", loginId: "", message: null });
      return;
    }

    if (!isValidOwnerLoginId(loginId)) {
      setLoginIdCheck({ status: "idle", loginId, message: null });
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoginIdCheck({ status: "checking", loginId, message: null });

      try {
        const response = await fetch(`/api/auth/check-login-id?loginId=${encodeURIComponent(loginId)}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as { available?: boolean; message?: string };
        if (!active) return;

        setLoginIdCheck({
          status: response.ok && result.available ? "available" : "unavailable",
          loginId,
          message: result.message ?? null,
        });
      } catch {
        if (!active) return;
        setLoginIdCheck({
          status: "error",
          loginId,
          message: "아이디 중복 확인 중 문제가 발생했습니다.",
        });
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [fields.loginId]);

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
    setProfileStage("account");
  }, [initialStart]);

  useEffect(() => {
    if (!verificationToken || profileStage !== "verification") return;
    setVerificationSheetOpen(false);
    setVerificationDetailSheetOpen(false);
    setProfileStage("verified");
  }, [profileStage, verificationToken]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [profileStage]);

  const updateField = (key: keyof typeof fields, value: string) => {
    const normalizedValue =
      key === "birthDate"
        ? value.replace(/\D/g, "").slice(0, 8)
        : key === "phoneNumber"
          ? normalizePhone(value)
          : key === "shopPhone"
            ? normalizeShopPhone(value)
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
    if (!supabaseReady || !oauthSupabase) {
      setMessage("소셜 로그인 환경이 아직 준비되지 않았어요.");
      return;
    }

    setSocialLoading(provider);
    setMessage(null);

    try {
      document.cookie = `${PENDING_SOCIAL_PROVIDER_COOKIE}=${provider}; Path=/; Max-Age=600; SameSite=Lax`;
      window.localStorage.setItem(PENDING_SOCIAL_PROVIDER_STORAGE, provider);
      const redirectTo = `${getOAuthRedirectOrigin()}/auth/client-callback?next=${encodeURIComponent(nextPath)}&provider=${encodeURIComponent(provider)}`;

      const { error } = await oauthSupabase.auth.signInWithOAuth({
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
    setPendingProfileStage(null);
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
      if (pendingProfileStage) {
        setProfileStage(pendingProfileStage);
        setPendingProfileStage(null);
      }
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
    if (loginIdCheck.loginId !== loginId || loginIdCheck.status === "checking") {
      setMessage("아이디 중복 확인이 끝난 뒤 다시 진행해 주세요.");
      return;
    }
    if (loginIdCheck.status !== "available") {
      setMessage(loginIdCheck.message ?? "이미 사용 중인 아이디입니다.");
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
    setMessage(null);
    if (!requiredAgreed) {
      setPendingProfileStage("verification");
      setStartTarget({ kind: "email" });
      return;
    }
    setProfileStage("verification");
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

    if (bypass && !fields.name.trim()) {
      setMessage("이름을 입력해 주세요.");
      return;
    }

    if (bypass && !isValidBirthDate8(fields.birthDate)) {
      setMessage("생년월일 8자리를 입력해 주세요.");
      return;
    }

    if (bypass && !/^01\d{8,9}$/.test(fields.phoneNumber)) {
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

      const identityVerificationId = `pm${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
      const hasPrefilledIdentity =
        fields.name.trim() && isValidBirthDate8(fields.birthDate) && /^01\d{8,9}$/.test(fields.phoneNumber);

      const result = await requestPortoneIdentityVerification({
        storeId: env.portoneStoreId,
        channelKey,
        identityVerificationId,
        windowType: { pc: "POPUP", mobile: "POPUP" },
        ...(hasPrefilledIdentity
          ? {
              customer: {
                fullName: fields.name.trim(),
                phoneNumber: fields.phoneNumber,
                birthYear: fields.birthDate.slice(0, 4),
                birthMonth: fields.birthDate.slice(4, 6),
                birthDay: fields.birthDate.slice(6, 8),
              },
            }
          : {}),
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
        setMessage(toKoreanIdentityVerificationError(verifyResult.message ?? "본인 인증 확인에 실패했어요."));
        return;
      }

      setVerificationToken(verifyResult.verificationToken);
      if (verifyResult.identity) {
        setFields((prev) => ({
          ...prev,
          name: verifyResult.identity?.name ?? prev.name,
          birthDate: verifyResult.identity?.birthDate ?? prev.birthDate,
          phoneNumber: verifyResult.identity?.phoneNumber ?? prev.phoneNumber,
          verificationCode: "",
        }));
      }
      setMessage(successMessage);
    } catch (error) {
      setMessage(toKoreanIdentityVerificationError(error instanceof Error ? error.message : String(error ?? "")));
    } finally {
      setLoading(false);
    }
  };

  const verifyPass = async () => {
    await verifyPortoneIdentity({
      channelKey: env.portoneIdentityKcpChannelKey,
      successMessage: "휴대폰 본인인증이 완료되었어요.",
      missingEnvMessage: "KCP 휴대폰 본인인증 채널이 아직 연결되지 않았어요.",
    });
  };

  const startPhoneIdentity = async () => {
    const phoneIdentityChannelKey = env.portoneIdentityKcpChannelKey;

    await verifyPortoneIdentity({
      channelKey: phoneIdentityChannelKey,
      successMessage: "휴대폰 본인 인증이 완료되었어요.",
      missingEnvMessage: "휴대폰 본인 인증 채널이 아직 연결되지 않았어요.",
    });
  };

  const startUnifiedIdentity = async (..._args: unknown[]) => {
    setMessage("현재는 KCP 휴대폰 본인인증만 사용할 수 있습니다.");
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
    if (!isValidShopPhone(fields.shopPhone)) {
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
      const result = await response.json().catch(() => ({
        success: false,
        message: "회원가입 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
      }));

      if (!response.ok || !result.success) {
        setMessage(result.message ?? "회원가입 중 문제가 발생했어요.");
        return;
      }

      router.replace(`/login?next=${encodeURIComponent(nextPath)}&message=signup-success` as never);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setMessage(
        message.toLowerCase().includes("not sent")
          ? "회원가입 요청을 서버로 보내지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요."
          : "회원가입 요청 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {step === "entry" ? (
        <div className={cn(PAGE_FRAME, "bg-white text-[#111111]")}>
          <div className="relative flex min-h-9 items-center justify-center">
            <MobileBackLinkButton
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              replace
              aria-label="로그인으로 이동"
              className="absolute left-0 top-0 h-9 w-9 rounded-[8px] border-[#dbe2ea] bg-white text-[#334155] shadow-[0_4px_14px_rgba(15,23,42,0.04)] hover:bg-[#f8fafc]"
            />
            <h1 className={cn(PAGE_TITLE, "text-center text-[27px] leading-9")}>회원가입</h1>
          </div>
          <div className="mt-7">
            <EntryStep
              loading={loading}
              socialLoading={socialLoading}
            onStartEmail={() => openStart({ kind: "email" })}
            onStartSocial={(provider) => openStart({ kind: "social", provider })}
              nextPath={nextPath}
            />
          </div>
        </div>
      ) : null}

      {step === "profile" ? (
        <SignupRedesignView
          stage={profileStage}
          fields={fields}
          shopDetailAddress={shopDetailAddress}
          shopPhoneSameAsOwner={shopPhoneSameAsOwner}
          loading={loading}
          message={profileStage === "verified" ? null : message}
          loginIdStatus={{
            text: loginIdFieldError ?? loginIdFieldHelper,
            tone: loginIdFieldError ? "error" : loginIdFieldTone === "success" ? "success" : "default",
          }}
          passwordStatus={{
            text: passwordRuleError ?? passwordFieldHelper,
            tone: passwordRuleError ? "error" : passwordFieldTone === "success" ? "success" : "default",
          }}
          passwordConfirmStatus={{
            text:
              passwordConfirmState && "error" in passwordConfirmState
                ? passwordConfirmState.error
                : passwordConfirmState && "helper" in passwordConfirmState
                  ? passwordConfirmState.helper
                  : undefined,
            tone:
              passwordConfirmState && "error" in passwordConfirmState
                ? "error"
                : passwordConfirmState?.tone === "success"
                  ? "success"
                  : "default",
          }}
          onBack={() => {
            setMessage(null);
            if (profileStage === "shop") {
              setProfileStage("verified");
              return;
            }
            if (profileStage === "verification" || profileStage === "verified") {
              setProfileStage("account");
              return;
            }
            if (initialStart === "email") {
              router.replace(`/login?next=${encodeURIComponent(nextPath)}` as never);
              return;
            }
            setStep("entry");
          }}
          onChangeField={updateField}
          onChangeShopDetailAddress={setShopDetailAddress}
          onChangeShopPhoneSameAsOwner={(checked) => {
            setShopPhoneSameAsOwner(checked);
            if (checked) updateField("shopPhone", fields.phoneNumber);
          }}
          onNextAccount={moveToVerificationStep}
          onStartVerification={startPhoneIdentity}
          onContinueToShop={() => {
            setMessage(null);
            setProfileStage("shop");
          }}
          onOpenAddress={() => setAddressSheetOpen(true)}
          onSubmit={submitSignup}
        />
      ) : null}

      {startTarget ? (
        <div
          className="fixed inset-0 z-50 bg-black/35"
          onClick={(event) => {
            if (event.target === event.currentTarget) setStartTarget(null);
          }}
        >
          <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-end">
            <div className="w-full rounded-t-[14px] bg-[#fffefc] px-5 pb-5 pt-4 shadow-[0_-18px_44px_rgba(15,23,42,0.10)]">
              <div className="mx-auto h-1 w-10 rounded-full bg-[#d1d5db]" />

              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-[#64748b]">약관 동의</p>
                  <h2 className="mt-2 text-[24px] font-extrabold tracking-[-0.04em] text-[#111827]">
                    약관에 동의해 주세요
                  </h2>
                  <p className="mt-2 text-[13px] leading-5 text-[#64748b]">
                    필수 약관 동의 후 가입을 계속할 수 있어요.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-3">
                <label className="flex items-center gap-3">
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
                    className="h-[18px] w-[18px] rounded-[4px] border border-[#cbd5e1] accent-[#1f6b5b]"
                  />
                  <p className="text-[15px] font-semibold text-[#111827]">전체 동의</p>
                </label>
              </div>

              <div className="mt-3 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white">
                {ownerSignupTerms.map((term) => (
                  <div key={term.id} className="border-b border-[#eef2f6] px-3.5 py-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex min-w-0 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={agreements[term.id]}
                          onChange={(event) =>
                            setAgreements((prev) => ({
                              ...prev,
                              [term.id]: event.target.checked,
                            }))
                          }
                          className="h-[18px] w-[18px] rounded-[4px] border border-[#cbd5e1] accent-[#1f6b5b]"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-[#111827]">
                            <span className="text-[#64748b]">
                              {term.required ? "필수" : "선택"}
                            </span>{" "}
                            {term.title.replace(" 동의", "")}
                          </p>
                        </div>
                      </label>

                      <Link
                        href={termLinkById[term.id] as never}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-[13px] font-medium text-[#64748b] hover:text-[#111827]"
                      >
                        약관 보기
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStartTarget(null)}
                  className="h-[50px] rounded-[8px] border border-[#dbe2ea] bg-white text-[15px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={continueStart}
                  disabled={!requiredAgreed}
                  className="h-[50px] rounded-[8px] bg-[#1f6b5b] text-[15px] font-semibold text-white transition hover:bg-[#185848] disabled:bg-[#cbd5e1]"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setVerificationSheetOpen(false);
          }}
        >
          <div className="w-full max-w-[430px]">
            <div className="flex max-h-[86vh] w-full flex-col overflow-hidden rounded-[16px] border border-[#e5e7eb] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="shrink-0 px-5 pb-3 pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[23px] font-semibold text-[#111827]">본인 인증</h2>
                    <p className="mt-2 text-[13px] leading-5 text-[#64748b]">
                      안전한 매장 관리를 위해 가입자 본인 여부를 확인합니다.
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-[#94a3b8]">
                      확인된 정보는 아이디 찾기와 비밀번호 재설정에도 사용됩니다.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setVerificationSheetOpen(false)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-[#d1d5db] bg-white text-[22px] leading-none text-[#64748b]"
                    aria-label="본인 인증 닫기"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#edf2f7] px-5 pb-5 pt-4">
                <div>
                  <p className="text-[14px] font-semibold text-[#111827]">인증 방법</p>
                  <div className="mt-2.5 space-y-2">
                    {verificationMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={async () => {
                          setMessage(null);

                          if (method.id === "phone") {
                            await startPhoneIdentity();
                            return;
                          }

                          setSelectedVerificationMethod(method.id);
                          setVerificationSheetOpen(false);
                          setVerificationDetailSheetOpen(true);
                        }}
                        className={cn(
                          "flex min-h-[68px] w-full items-center gap-3 rounded-[10px] border bg-white px-3.5 py-2.5 text-left transition",
                          selectedVerificationMethod === method.id
                            ? "border-[#2f7866]"
                            : "border-[#d1d5db] hover:border-[#94a3b8]",
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white">
                          <VerificationMethodLogo method={method.id} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-[#111827]">{method.title}</p>
                          <p className="mt-0.5 text-[12px] leading-4 text-[#64748b]">{method.description}</p>
                        </div>
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                            selectedVerificationMethod === method.id
                              ? "border-[#1f6b5b] bg-[#1f6b5b] text-white"
                              : "border-[#d1d5db] bg-white text-transparent",
                          )}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedVerificationMeta ? (
                  <div className="mt-5 rounded-[10px] border border-[#d1d5db] bg-white px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white">
                        <VerificationMethodLogo method={selectedVerificationMeta.id} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-[#111827]">{selectedVerificationMeta.title}</p>
                        <p className="mt-0.5 text-[12px] leading-5 text-[#64748b]">{selectedVerificationMeta.description}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedVerificationMethod === "phone" ? (
                  <div className="mt-5 space-y-3 rounded-[10px] border border-[#d1d5db] bg-white p-4">
                    <p className="text-[13px] font-semibold text-[#475569]">휴대폰 본인인증 정보 입력</p>
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
                      <p className="text-[12px] font-medium text-[#64748b]">통신사 선택</p>
                      <div className="grid grid-cols-4 gap-2">
                        {phoneCarrierOptions.map((carrier) => (
                          <button
                            key={carrier.value}
                            type="button"
                            onClick={() => setPhoneCarrier(carrier.value)}
                            className={cn(
                              "h-[40px] rounded-[8px] border bg-white text-[13px] font-semibold transition",
                              phoneCarrier === carrier.value
                                ? "border-[#1f6b5b] text-[#1f6b5b]"
                                : "border-[#d1d5db] text-[#475569] hover:border-[#94a3b8]",
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
                      <div className="space-y-3 rounded-[10px] border border-[#d1d5db] bg-white p-3">
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
                  <div className="mt-5 space-y-3 rounded-[10px] border border-[#d1d5db] bg-white p-4">
                    <p className="text-[13px] font-semibold text-[#475569]">PASS 인증 정보 입력</p>
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
                  <div className="mt-5 rounded-[10px] border border-dashed border-[#d1d5db] bg-white px-4 py-5 text-center">
                    <p className="text-[14px] font-semibold text-[#111827]">준비 중인 인증 수단입니다</p>
                    <p className="mt-2 text-[12px] leading-5 text-[#64748b]">
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
                <div className="shrink-0 border-t border-[#e5e7eb] bg-white px-5 pb-5 pt-4">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setVerificationDetailSheetOpen(false);
          }}
        >
          <div className="w-full max-w-[430px]">
            <div className="flex max-h-[86vh] w-full flex-col overflow-hidden rounded-[16px] border border-[#e5e7eb] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="shrink-0 border-b border-[#e5e7eb] px-5 pb-4 pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationDetailSheetOpen(false);
                        setSelectedVerificationMethod(null);
                        setVerificationSheetOpen(true);
                        setMessage(null);
                      }}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#d1d5db] bg-white text-[#64748b]"
                      aria-label="인증 수단 다시 선택하기"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#64748b]">본인 인증</p>
                      <h2 className="mt-1 truncate text-[20px] font-semibold text-[#111827]">
                        {selectedVerificationMeta.title}
                      </h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setVerificationDetailSheetOpen(false)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#d1d5db] bg-white text-[24px] leading-none text-[#64748b]"
                    aria-label="본인 인증 닫기"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
                {selectedVerificationMethod === "phone" ? (
                  <div className="space-y-3 rounded-[10px] border border-[#d1d5db] bg-white p-4">
                    <p className="text-[13px] font-semibold text-[#475569]">휴대폰 본인인증 정보 입력</p>
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
                      <p className="text-[12px] font-medium text-[#64748b]">통신사 선택</p>
                      <div className="grid grid-cols-4 gap-2">
                        {phoneCarrierOptions.map((carrier) => (
                          <button
                            key={carrier.value}
                            type="button"
                            onClick={() => setPhoneCarrier(carrier.value)}
                            className={cn(
                              "h-[40px] rounded-[8px] border bg-white text-[13px] font-semibold transition",
                              phoneCarrier === carrier.value
                                ? "border-[#1f6b5b] text-[#1f6b5b]"
                                : "border-[#d1d5db] text-[#475569] hover:border-[#94a3b8]",
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
                      <div className="space-y-3 rounded-[10px] border border-[#d1d5db] bg-white p-3">
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
                <div className="shrink-0 border-t border-[#e5e7eb] bg-white px-5 pb-5 pt-4">
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
    </>
  );
}
