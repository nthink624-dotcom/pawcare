"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import SignupRedesignView, {
  type SignupProfileStage,
} from "@/components/auth/signup-redesign-view";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import {
  ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER,
  ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
} from "@/lib/auth/atomic-signup-contract";
import {
  OWNER_SIGNUP_TERMS_VERSION,
  OWNER_MARKETING_CONSENT_DOCUMENT_VERSION,
  type OwnerSignupTermId,
} from "@/lib/auth/owner-signup-terms";
import {
  isValidOwnerEmail,
  isValidOwnerPassword,
  normalizeOwnerEmail,
  ownerPasswordRuleMessage,
} from "@/lib/auth/owner-credentials";
import { shouldBypassSignupPhoneVerification } from "@/lib/auth/signup-local-phone-bypass";
import { env } from "@/lib/env";
import {
  fetchIdentityApi,
  PORTONE_IDENTITY_UI_TIMEOUT_MS,
  requestPortoneIdentityVerification,
} from "@/lib/portone/identity-verification-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearOwnerAuthTokenCache, writeOwnerAuthHandoff, writeOwnerAuthSessionCache } from "@/lib/auth/owner-auth-handoff";

type AgreementState = Record<OwnerSignupTermId, boolean>;

type SignupFields = {
  name: string;
  birthDate: string;
  phoneNumber: string;
  email: string;
  password: string;
  passwordConfirm: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
};

type EmailCheckState = {
  status: "idle" | "checking" | "available" | "unavailable" | "error";
  email: string;
  message: string | null;
};

type VerificationApiResponse = {
  message?: string;
  verificationRequestId?: string | null;
  providerIdentityVerificationId?: string | null;
  verificationState?: string | null;
  verificationToken?: string | null;
  identity?: {
    name?: string | null;
    birthDate?: string | null;
    phoneNumber?: string | null;
  } | null;
};

type SignupStage = SignupProfileStage | "complete";

const LOCAL_SIGNUP_SETUP_PREVIEW_PATH = "/demo/owner-web?initialSetup=1";

const initialAgreements: AgreementState = {
  service: false,
  privacy: false,
  location: false,
  marketing: false,
};

const initialFields: SignupFields = {
  name: "",
  birthDate: "",
  phoneNumber: "",
  email: "",
  password: "",
  passwordConfirm: "",
  shopName: "",
  shopPhone: "",
  shopAddress: "",
};

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidShopPhone(value: string) {
  return /^(?:02\d{7,8}|0[3-6]\d{7,8}|070\d{7,8}|050\d{8}|01\d{8,9})$/.test(normalizePhone(value));
}

export default function SignupForm({
  supabaseReady,
  portoneReady,
  nextPath = "/owner",
}: {
  supabaseReady: boolean;
  portoneReady: boolean;
  nextPath?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [stage, setStage] = useState<SignupStage>("terms");
  const [signupRequestId] = useState(() => crypto.randomUUID());
  const [agreements, setAgreements] = useState<AgreementState>(initialAgreements);
  const [fields, setFields] = useState<SignupFields>(initialFields);
  const [shopDetailAddress, setShopDetailAddress] = useState("");
  const [shopPhoneSameAsOwner, setShopPhoneSameAsOwner] = useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [localPhoneVerificationBypassed, setLocalPhoneVerificationBypassed] = useState(false);
  const [completionDestinationPath, setCompletionDestinationPath] = useState<string | null>(null);
  const [emailCheck, setEmailCheck] = useState<EmailCheckState>({
    status: "idle",
    email: "",
    message: null,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const identityAbortControllerRef = useRef<AbortController | null>(null);

  const requiredTermsAgreed = agreements.service && agreements.privacy;
  const normalizedEmail = normalizeOwnerEmail(fields.email);
  const initialSetupPath = `${nextPath}${nextPath.includes("?") ? "&" : "?"}initialSetup=1`;
  const emailFieldError =
    fields.email.length > 0 && !isValidOwnerEmail(normalizedEmail)
      ? "올바른 이메일 주소를 입력해 주세요."
      : emailCheck.status === "unavailable" && emailCheck.email === normalizedEmail
        ? emailCheck.message ?? "이미 사용 중인 이메일입니다."
        : emailCheck.status === "error" && emailCheck.email === normalizedEmail
          ? emailCheck.message ?? "이메일 중복 확인 중 문제가 발생했습니다."
          : undefined;
  const emailFieldHelper =
    !emailFieldError && emailCheck.email === normalizedEmail
      ? emailCheck.status === "checking"
        ? "이메일 중복을 확인하고 있어요."
        : emailCheck.status === "available"
          ? emailCheck.message ?? "사용 가능한 이메일입니다."
          : undefined
      : undefined;
  const passwordFieldError =
    fields.password.length > 0 && !isValidOwnerPassword(fields.password) ? ownerPasswordRuleMessage : undefined;
  const passwordFieldHelper = fields.password.length > 0 && !passwordFieldError ? "사용 가능한 비밀번호입니다." : undefined;
  const passwordConfirmError =
    fields.passwordConfirm.length > 0 && fields.password !== fields.passwordConfirm
      ? "비밀번호 확인이 일치하지 않습니다."
      : undefined;
  const passwordConfirmHelper =
    fields.passwordConfirm.length > 0 && !passwordConfirmError ? "비밀번호가 일치합니다." : undefined;

  useEffect(() => {
    const email = normalizeOwnerEmail(fields.email);
    if (!fields.email.trim() || !isValidOwnerEmail(email)) {
      setEmailCheck({ status: "idle", email, message: null });
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setEmailCheck({ status: "checking", email, message: null });
      try {
        const response = await fetchIdentityApi(`/api/auth/check-email?email=${encodeURIComponent(email)}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as { available?: boolean; message?: string };
        if (!active) return;
        setEmailCheck({
          status: response.ok && result.available ? "available" : "unavailable",
          email,
          message: result.message ?? null,
        });
      } catch {
        if (active) {
          setEmailCheck({ status: "error", email, message: "이메일 중복 확인 중 문제가 발생했습니다." });
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [fields.email]);

  useEffect(() => () => identityAbortControllerRef.current?.abort(), []);

  useEffect(() => {
    if (!supabaseReady || !supabase) return;

    let active = true;
    void supabase.auth.getSession().then((result: { data: { session: { access_token: string } | null } }) => {
      const { data } = result;
      if (active && data.session?.access_token) {
        router.replace(nextPath as never);
        router.refresh();
      }
    });

    return () => {
      active = false;
    };
  }, [nextPath, router, supabase, supabaseReady]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [stage]);

  const updateField = (key: keyof SignupFields, value: string) => {
    const normalizedValue = key === "phoneNumber" || key === "shopPhone" ? normalizePhone(value) : value;
    setFields((previous) => ({ ...previous, [key]: normalizedValue }));
  };

  const continueTerms = () => {
    if (!requiredTermsAgreed) {
      setMessage("필수 약관에 동의해 주세요.");
      return;
    }
    setMessage(null);
    setStage("account");
  };

  const continueAccount = () => {
    const email = normalizeOwnerEmail(fields.email);
    if (!isValidOwnerEmail(email)) {
      setMessage("올바른 이메일 주소를 입력해 주세요.");
      return;
    }
    if (emailCheck.email !== email || emailCheck.status === "checking") {
      setMessage("이메일 중복 확인이 끝난 뒤 다시 진행해 주세요.");
      return;
    }
    if (emailCheck.status !== "available") {
      setMessage(emailCheck.message ?? "이미 사용 중인 이메일입니다.");
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
    if (
      shouldBypassSignupPhoneVerification({
        nodeEnv: process.env.NODE_ENV,
        hostname: window.location.hostname,
      })
    ) {
      setLocalPhoneVerificationBypassed(true);
      setStage("shop");
      return;
    }
    setLocalPhoneVerificationBypassed(false);
    void startKcpVerification();
  };

  const startKcpVerification = async () => {
    if (identityAbortControllerRef.current) return;
    if (!portoneReady || !env.portoneStoreId || !env.portoneIdentityKcpChannelKey) {
      setMessage("KCP 본인인증 채널이 아직 연결되지 않았습니다.");
      return;
    }

    const requestController = new AbortController();
    identityAbortControllerRef.current = requestController;
    setLoading(true);
    setMessage(null);
    try {
      const requestResponse = await fetchIdentityApi("/api/auth/request-verification-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER]: ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
        },
        signal: requestController.signal,
        body: JSON.stringify({ purpose: "signup", method: "portone" }),
      });
      const requestResult = (await requestResponse.json()) as VerificationApiResponse;
      if (
        !requestResponse.ok ||
        !requestResult.verificationRequestId ||
        !requestResult.providerIdentityVerificationId ||
        !requestResult.verificationState
      ) {
        setMessage(requestResult.message ?? "본인인증 요청을 준비하지 못했습니다.");
        return;
      }

      const identityResult = await requestPortoneIdentityVerification(
        {
          storeId: env.portoneStoreId,
          channelKey: env.portoneIdentityKcpChannelKey,
          identityVerificationId: requestResult.providerIdentityVerificationId,
          customData: JSON.stringify({ petmanagerIdentityState: requestResult.verificationState }),
          windowType: { pc: "POPUP", mobile: "POPUP" },
        },
        { signal: requestController.signal, timeoutMs: PORTONE_IDENTITY_UI_TIMEOUT_MS },
      );
      if (
        !identityResult?.identityVerificationId ||
        identityResult.identityVerificationId !== requestResult.providerIdentityVerificationId ||
        identityResult.code
      ) {
        setMessage("본인인증이 완료되지 않았습니다.");
        return;
      }

      const verifyResponse = await fetchIdentityApi("/api/auth/verify-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: requestController.signal,
        body: JSON.stringify({
          purpose: "signup",
          verificationRequestId: requestResult.verificationRequestId,
          identityVerificationId: identityResult.identityVerificationId,
          verificationState: requestResult.verificationState,
        }),
      });
      const verifyResult = (await verifyResponse.json()) as VerificationApiResponse;
      if (!verifyResponse.ok || !verifyResult.verificationToken || !verifyResult.identity?.name || !verifyResult.identity.phoneNumber) {
        setMessage(verifyResult.message ?? "본인인증 결과를 확인하지 못했습니다. 다시 인증해 주세요.");
        return;
      }

      setVerificationToken(verifyResult.verificationToken);
      setFields((previous) => ({
        ...previous,
        name: verifyResult.identity?.name ?? previous.name,
        birthDate: verifyResult.identity?.birthDate ?? previous.birthDate,
        phoneNumber: verifyResult.identity?.phoneNumber ?? previous.phoneNumber,
        shopPhone:
          shopPhoneSameAsOwner && verifyResult.identity?.phoneNumber
            ? verifyResult.identity.phoneNumber
            : previous.shopPhone,
      }));
      setStage("shop");
    } catch (error) {
      const timedOutOrAborted =
        error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
      setMessage(
        timedOutOrAborted
          ? "본인인증 확인 시간이 길어 요청을 중단했어요. 창을 닫고 다시 시도해 주세요."
          : "본인인증을 진행하지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      if (identityAbortControllerRef.current === requestController) {
        identityAbortControllerRef.current = null;
      }
      setLoading(false);
    }
  };

  const submitSignup = async () => {
    const email = normalizeOwnerEmail(fields.email);
    if (!requiredTermsAgreed || !isValidOwnerEmail(email) || !isValidOwnerPassword(fields.password)) {
      setMessage("가입 정보를 다시 확인해 주세요.");
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
    if (!isValidShopPhone(fields.shopPhone)) {
      setMessage("매장 연락처를 올바르게 입력해 주세요.");
      return;
    }
    if (!fields.shopAddress.trim()) {
      setMessage("매장 주소를 입력해 주세요.");
      return;
    }
    if (localPhoneVerificationBypassed) {
      setMessage(null);
      setCompletionDestinationPath(LOCAL_SIGNUP_SETUP_PREVIEW_PATH);
      setStage("complete");
      return;
    }
    if (!verificationToken || !fields.name || !fields.birthDate || !fields.phoneNumber) {
      setMessage("본인인증을 먼저 완료해 주세요.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER]: ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
        },
        body: JSON.stringify({
          email,
          password: fields.password,
          passwordConfirm: fields.passwordConfirm,
          name: fields.name,
          birthDate: fields.birthDate,
          phoneNumber: fields.phoneNumber,
          identityVerificationToken: verificationToken,
          shopName: fields.shopName.trim(),
          shopPhone: fields.shopPhone,
          shopAddress: [fields.shopAddress.trim(), shopDetailAddress.trim()].filter(Boolean).join(" "),
          agreements,
          termsVersion: OWNER_SIGNUP_TERMS_VERSION,
          marketingConsentVersion: OWNER_MARKETING_CONSENT_DOCUMENT_VERSION,
          signupRequestId,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        session?: {
          accessToken?: string;
          refreshToken?: string;
        } | null;
        billingRequired?: boolean;
        nextAction?: "billing" | "initial_setup";
      };
      if (!response.ok || !result.success) {
        setMessage(result.message ?? "회원가입 처리 중 문제가 발생했습니다.");
        return;
      }

      const accessToken = result.session?.accessToken;
      const refreshToken = result.session?.refreshToken;
      const destinationPath = result.billingRequired ? "/owner/billing?notice=trial-used" : initialSetupPath;
      let completionPath = destinationPath;
      if (accessToken && refreshToken) {
        const session = { accessToken, refreshToken };
        clearOwnerAuthTokenCache();
        writeOwnerAuthHandoff(session);
        writeOwnerAuthSessionCache(session);
        await supabase?.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      } else {
        const loginMessage = result.billingRequired ? "trial-used" : "signup-success";
        completionPath = `/login?next=${encodeURIComponent(destinationPath)}&message=${loginMessage}`;
      }
      setCompletionDestinationPath(completionPath);
      setStage("complete");
    } catch {
      setMessage("회원가입 요청 중 문제가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SignupRedesignView
        stage={stage}
        fields={fields}
        agreements={agreements}
        shopDetailAddress={shopDetailAddress}
        shopPhoneSameAsOwner={shopPhoneSameAsOwner}
        localPreview={localPhoneVerificationBypassed}
        loading={loading}
        message={message}
        emailStatus={{
          text: emailFieldError ?? emailFieldHelper,
          tone: emailFieldError ? "error" : emailCheck.status === "available" ? "success" : "default",
        }}
        passwordStatus={{
          text: passwordFieldError ?? passwordFieldHelper,
          tone: passwordFieldError ? "error" : passwordFieldHelper ? "success" : "default",
        }}
        passwordConfirmStatus={{
          text: passwordConfirmError ?? passwordConfirmHelper,
          tone: passwordConfirmError ? "error" : passwordConfirmHelper ? "success" : "default",
        }}
        onBack={() => {
          setMessage(null);
          if (stage === "terms") {
            router.replace(`/login?next=${encodeURIComponent(nextPath)}` as never);
          } else if (stage === "account") {
            setStage("terms");
          } else {
            setStage("account");
          }
        }}
        onChangeField={updateField}
        onChangeAgreement={(id, checked) => setAgreements((previous) => ({ ...previous, [id]: checked }))}
        onChangeShopDetailAddress={setShopDetailAddress}
        onChangeShopPhoneSameAsOwner={(checked) => {
          setShopPhoneSameAsOwner(checked);
          if (checked) updateField("shopPhone", fields.phoneNumber);
        }}
        onContinueTerms={continueTerms}
        onNextAccount={continueAccount}
        onOpenAddress={() => setAddressSheetOpen(true)}
        onSubmit={() => void submitSignup()}
        onStart={() => {
          if (!completionDestinationPath) return;
          router.replace(completionDestinationPath as never);
          router.refresh();
        }}
      />
      {addressSheetOpen ? (
        <KakaoPostcodeSheet
          title="매장 주소 검색"
          description="도로명, 건물명 또는 지번으로 검색한 뒤 매장 주소를 선택해 주세요."
          initialQuery={fields.shopAddress}
          onClose={() => setAddressSheetOpen(false)}
          onSelect={(selection) => {
            updateField("shopAddress", selection.address);
            setAddressSheetOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
