"use client";

import Image from "next/image";
import SignupConsentDialog from "@/components/auth/signup-consent-dialog";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff } from "lucide-react";

import MobileAiPriceGuideFixture, { type PriceGuideDraftRow } from "@/components/auth/mobile-ai-price-guide-fixture";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { MobileBackButton, MobileBackLinkButton } from "@/components/ui/mobile-back-button";
import {
  OWNER_SIGNUP_TERMS_VERSION,
  OWNER_MARKETING_CONSENT_DOCUMENT_VERSION,
  ownerSignupTerms,
  type OwnerSignupTermId,
} from "@/lib/auth/owner-signup-terms";
import {
  isValidBirthDate8,
  isValidOwnerEmail,
  isValidOwnerPassword,
  normalizeOwnerEmail,
  ownerPasswordRuleMessage,
} from "@/lib/auth/owner-credentials";
import {
  clearOwnerAuthTokenCache,
  writeOwnerAuthHandoff,
  writeOwnerAuthSessionCache,
} from "@/lib/auth/owner-auth-handoff";
import { getSafeNextPath } from "@/lib/auth/safe-next-path";
import { env } from "@/lib/env";
import {
  BUTTON_PRIMARY as UI_BUTTON_PRIMARY,
  BUTTON_SECONDARY as UI_BUTTON_SECONDARY,
  INLINE_ERROR,
  INLINE_HELP,
  INPUT_BASE,
  PAGE_TITLE as UI_PAGE_TITLE,
  cn,
} from "@/lib/ui-system";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Step = "entry" | "price-guide" | "identity" | "profile";
type StartTarget = "email" | null;
type AgreementState = Record<OwnerSignupTermId, boolean>;
type VerificationMethod = "phone";
type VerificationPurpose = "signup";
type SignupFields = {
  name: string;
  birthDate: string;
  phoneNumber: string;
  verificationCode: string;
  email: string;
  password: string;
  passwordConfirm: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
};
type VerificationApiResponse = {
  message?: string;
  verificationRequestId?: string | null;
  providerIdentityVerificationId?: string;
  verificationState?: string;
  devVerificationCode?: string | null;
  verificationToken?: string | null;
};

const initialAgreements: AgreementState = {
  service: false,
  privacy: false,
  location: false,
  marketing: false,
};

function createInitialSignupFields(): SignupFields {
  return {
    name: "",
    birthDate: "",
    phoneNumber: "",
    verificationCode: "",
    email: "",
    password: "",
    passwordConfirm: "",
    shopName: "",
    shopPhone: "",
    shopAddress: "",
  };
}

const SIGNUP_AGREEMENT_STORAGE_KEY = `petmanager:signup-agreements:${OWNER_SIGNUP_TERMS_VERSION}`;

function readSignupAgreementReceipt(): AgreementState | null {
  if (typeof window === "undefined") return null;

  try {
    const rawReceipt = window.sessionStorage.getItem(SIGNUP_AGREEMENT_STORAGE_KEY);
    if (!rawReceipt) return null;

    const receipt = JSON.parse(rawReceipt) as {
      version?: unknown;
      agreements?: Partial<Record<OwnerSignupTermId, unknown>>;
    };
    const storedAgreements = receipt.agreements;
    if (
      receipt.version !== OWNER_SIGNUP_TERMS_VERSION ||
      !storedAgreements ||
      storedAgreements.service !== true ||
      storedAgreements.privacy !== true ||
      typeof storedAgreements.location !== "boolean" ||
      typeof storedAgreements.marketing !== "boolean"
    ) {
      return null;
    }

    return {
      service: true,
      privacy: true,
      location: storedAgreements.location,
      marketing: storedAgreements.marketing,
    };
  } catch {
    return null;
  }
}

function writeSignupAgreementReceipt(agreements: AgreementState) {
  if (typeof window === "undefined") return false;

  try {
    const receipt = JSON.stringify({ version: OWNER_SIGNUP_TERMS_VERSION, agreements });
    window.sessionStorage.setItem(
      SIGNUP_AGREEMENT_STORAGE_KEY,
      receipt,
    );
    return window.sessionStorage.getItem(SIGNUP_AGREEMENT_STORAGE_KEY) === receipt;
  } catch {
    return false;
  }
}

function clearSignupAgreementReceipt() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(SIGNUP_AGREEMENT_STORAGE_KEY);
  } catch {
    // The completed signup should continue even when browser storage is unavailable.
  }
}

type AtomicSignupResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  nextAction?: "billing" | "initial_setup";
  session?: { accessToken?: string; refreshToken?: string } | null;
};

function resolveAtomicSignupNextPath(result: AtomicSignupResponse, fallbackPath: string) {
  if (result.nextAction === "billing") return "/owner/billing?compare=1";
  if (result.nextAction === "initial_setup") return "/owner/mobile?entry=initial_setup";
  return fallbackPath;
}

const PAGE_FRAME = "min-h-dvh w-full bg-white";
const PAGE_CONTENT =
  "mx-auto w-full max-w-[430px] px-5 pt-[calc(env(safe-area-inset-top)+8px)]";
const PAGE_TITLE = cn(UI_PAGE_TITLE, "auth-type-page-title tracking-[-0.02em] text-[#101a31]");
const BUTTON_PRIMARY = cn(UI_BUTTON_PRIMARY, "auth-type-control h-[48px] min-h-[48px] rounded-[10px] bg-[#111a30] px-[14px] text-white");
const BUTTON_SECONDARY = cn(UI_BUTTON_SECONDARY, "auth-type-control h-[48px] min-h-[48px] rounded-[10px] border-[#dbe2ea] px-[14px] text-[#111827]");
const ACTION_BUTTON_GRID = "grid grid-cols-2 gap-3";
const SHEET_ACTION_FOOTER =
  "shrink-0 border-t border-[#e8edf3] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3";

// Client expiry is only a retry hint. The signup API still verifies signature,
// expiry, purpose, identity binding, and consumption on every submission.
function isSignupTokenFresh(token: string | null, now = Date.now()): token is string {
  if (!token) return false;
  try {
    const encoded = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encoded));
    return payload.purpose === "signup" && typeof payload.expiresAt === "number" && payload.expiresAt > now;
  } catch { return false; }
}

function waitForIdentityOperation<T>(operation: Promise<T>, signal: AbortSignal, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(() => reject(new Error("IDENTITY_TIMEOUT"))), timeoutMs);
    const onAbort = () => finish(() => reject(new Error("IDENTITY_CANCELLED")));
    const finish = (callback: () => void) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
  });
}

type AtomicSignupServicePrice = {
  id: string;
  name: string;
  detailName: string;
  price: number;
  durationMinutes: number;
  species: "dog" | "cat" | "all";
  breedGroup: string;
  weightBand: string;
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

type RetainedSignupStep = Extract<Step, "identity" | "profile">;
type VolatileSignupDraft = {
  version: string;
  savedAt: number;
  signupRequestId: string;
  step: RetainedSignupStep;
  agreements: AgreementState;
  fields: Omit<SignupFields, "password" | "passwordConfirm" | "verificationCode">;
  shopDetailAddress: string;
  shopPostalCode: string;
  checkedEmail: string | null;
  selectedVerificationMethod: VerificationMethod | null;
  verificationSheetOpen: boolean;
  verificationDetailSheetOpen: boolean;
  message: string | null;
};

const VOLATILE_SIGNUP_DRAFT_TTL_MS = 20 * 60 * 1000;
let volatileSignupDraft: VolatileSignupDraft | null = null;
let draftExpiryTimer: ReturnType<typeof setTimeout> | null = null;
const draftBoundaryListeners = new Set<(event?: string, session?: unknown) => void>();
const observedAuthClients = new WeakSet<object>();

// Keep one observer for the browser client's lifetime, including signup unmounts.
function observeSignupAuthBoundary(client: ReturnType<typeof getSupabaseBrowserClient>) {
  if (!client || observedAuthClients.has(client)) return;
  observedAuthClients.add(client);
  client.auth.onAuthStateChange((event: string, session: unknown) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" ||
      (event === "INITIAL_SESSION" && session)) {
      clearVolatileSignupDraft();
      clearSignupAgreementReceipt();
      draftBoundaryListeners.forEach((reset) => reset(event, session));
    }
  });
}

function readVolatileSignupDraft(initialStart: "email" | null, now = Date.now()): VolatileSignupDraft | null {
  if (typeof window === "undefined" || initialStart !== "email" || !volatileSignupDraft) return null;
  if (
    volatileSignupDraft.version !== OWNER_SIGNUP_TERMS_VERSION ||
    now < volatileSignupDraft.savedAt ||
    now - volatileSignupDraft.savedAt >= VOLATILE_SIGNUP_DRAFT_TTL_MS
  ) {
    clearVolatileSignupDraft();
    return null;
  }

  return {
    ...volatileSignupDraft,
    agreements: { ...volatileSignupDraft.agreements },
    fields: { ...volatileSignupDraft.fields },
  };
}

function writeVolatileSignupDraft(
  draft: Omit<VolatileSignupDraft, "version" | "savedAt" | "fields"> & { fields: SignupFields; savedAt: number },
  now = Date.now(),
) {
  if (typeof window === "undefined") return;
  if (now < draft.savedAt || now - draft.savedAt >= VOLATILE_SIGNUP_DRAFT_TTL_MS) return;
  if (draftExpiryTimer) clearTimeout(draftExpiryTimer);
  draftExpiryTimer = setTimeout(clearVolatileSignupDraft, draft.savedAt + VOLATILE_SIGNUP_DRAFT_TTL_MS - now);
  volatileSignupDraft = {
    ...draft,
    version: OWNER_SIGNUP_TERMS_VERSION,
    savedAt: draft.savedAt,
    agreements: { ...draft.agreements },
    fields: {
      name: draft.fields.name, birthDate: draft.fields.birthDate,
      phoneNumber: draft.fields.phoneNumber, email: draft.fields.email,
      shopName: draft.fields.shopName, shopPhone: draft.fields.shopPhone,
      shopAddress: draft.fields.shopAddress,
    },
  };
}

function clearVolatileSignupDraft() {
  if (draftExpiryTimer) clearTimeout(draftExpiryTimer);
  draftExpiryTimer = null;
  volatileSignupDraft = null;
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
    <label className="block" data-signup-field-style="stacked">
      <span className="auth-type-label mb-2 block text-[#475569]">{label}</span>
      {children}
      {message ? (
        <p
          className={cn(
            "auth-type-helper mt-1.5 px-0.5",
            error ? "text-[#b42318]" : tone === "success" ? "text-[#1f6b5b]" : "text-[#64748b]",
          )}
        >
          {message}
        </p>
      ) : null}
    </label>
  );
}

function AuthSectionBlock({ children }: { children: React.ReactNode }) {
  return <section className="space-y-4">{children}</section>;
}

function AuthInput({
  value,
  onChange,
  placeholder,
  inputMode,
  type = "text",
  autoComplete,
  rightSlot,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
  autoComplete?: string;
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
        autoComplete={autoComplete}
        className={cn(
          "auth-type-control h-[48px] min-h-[48px] w-full scroll-mb-[calc(env(safe-area-inset-bottom)+96px)] rounded-[10px] border border-[#dbe2ea] bg-white px-[14px] !font-normal text-[#111827] outline-none transition-[border-color,box-shadow] placeholder:!font-normal placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_white] [&:-webkit-autofill]:[-webkit-text-fill-color:#111827]",
          rightSlot ? "pr-12" : "",
          className,
        )}
      />
      {rightSlot ? <div className="absolute inset-y-0 right-1 flex items-center">{rightSlot}</div> : null}
    </div>
  );
}

function EntryStep({
  onStartEmail,
  safeNextPath,
}: {
  onStartEmail: () => void;
  safeNextPath: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={onStartEmail} className={BUTTON_PRIMARY}>
          일반 회원가입 시작하기
        </button>
      </div>

      <div className="auth-type-helper text-center text-[#64748b]">
        이미 계정이 있나요?{" "}
        <Link href={`/login?next=${encodeURIComponent(safeNextPath)}` as never} replace className="font-semibold text-[#111111]">
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
  priceGuideFixtureEnabled = false,
}: {
  supabaseReady: boolean;
  portoneReady: boolean;
  nextPath?: string;
  initialStart?: "email" | null;
  priceGuideFixtureEnabled?: boolean;
}) {
  const router = useRouter();
  const safeNextPath = getSafeNextPath(nextPath, "/owner");
  const [sessionCheckAttempt, setSessionCheckAttempt] = useState(0);
  // The helper caches its browser client; reacquire on retry without trusting a failed initialization.
  let supabase: ReturnType<typeof getSupabaseBrowserClient> = null;
  try {
    if (supabaseReady) supabase = getSupabaseBrowserClient();
  } catch {
    // The session gate presents the same safe retry state for client setup failures.
  }
  const [signupNavigating, setSignupNavigating] = useState(false);
  const [authBoundaryStatus, setAuthBoundaryStatus] = useState<"checking" | "ready" | "error">("checking");
  const [restoredDraft, setRestoredDraft] = useState(() => readVolatileSignupDraft(initialStart));
  const restoredDraftRef = useRef(restoredDraft);
  const draftStartedAtRef = useRef(restoredDraft?.savedAt ?? Date.now());
  const [step, setStep] = useState<Step>(
    restoredDraft?.step ?? (initialStart === "email" ? (priceGuideFixtureEnabled ? "price-guide" : "identity") : "entry"),
  );
  const [priceGuideFixtureRows, setPriceGuideFixtureRows] = useState<PriceGuideDraftRow[] | null>(null);
  const [signupRequestId, setSignupRequestId] = useState(() => crypto.randomUUID());
  const [startTarget, setStartTarget] = useState<StartTarget>(null);
  const [agreements, setAgreements] = useState<AgreementState>(() => restoredDraft?.agreements ?? { ...initialAgreements });
  const [message, setMessage] = useState<string | null>(restoredDraft?.message ?? null);
  const [loading, setLoading] = useState(false);
  const [signupPhase, setSignupPhase] = useState<"idle" | "checking" | "verifying" | "submitting">("idle");
  const [identityAttempted, setIdentityAttempted] = useState(false);
  const signupFlowRef = useRef<AbortController | null>(null);
  const completingSessionTokenRef = useRef<string | null>(null);
  useEffect(() => () => { signupFlowRef.current?.abort(); }, []);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkedEmail, setCheckedEmail] = useState<string | null>(null);
  const [verificationRequestId, setVerificationRequestId] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationSheetOpen, setVerificationSheetOpen] = useState(restoredDraft?.verificationSheetOpen ?? false);
  const [verificationDetailSheetOpen, setVerificationDetailSheetOpen] = useState(restoredDraft?.verificationDetailSheetOpen ?? false);
  const [selectedVerificationMethod, setSelectedVerificationMethod] = useState<VerificationMethod | null>(restoredDraft?.selectedVerificationMethod ?? null);

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [shopDetailAddress, setShopDetailAddress] = useState(restoredDraft?.shopDetailAddress ?? "");
  const [shopPostalCode, setShopPostalCode] = useState(restoredDraft?.shopPostalCode ?? "");
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [fields, setFields] = useState<SignupFields>(() => ({ ...createInitialSignupFields(), ...restoredDraft?.fields }));
  const identityRevisionRef = useRef(0);
  const emailRevisionRef = useRef(0);
  const providerAttemptRef = useRef<AbortController | null>(null);
  useEffect(() => () => { providerAttemptRef.current?.abort(); }, []);
  const cancelProviderAttempt = () => {
    providerAttemptRef.current?.abort();
    providerAttemptRef.current = null;
    setLoading(false);
  };
  const verificationTokenRevisionRef = useRef<number | null>(null);

  const resetSignup = useCallback(() => {
    signupFlowRef.current?.abort();
    signupFlowRef.current = null;
    completingSessionTokenRef.current = null;
    setSignupNavigating(false);
    setSignupPhase("idle");
    setIdentityAttempted(false);
    clearVolatileSignupDraft();
    restoredDraftRef.current = null;
    setRestoredDraft(null);
    emailRevisionRef.current += 1;
    draftStartedAtRef.current = Date.now();
    providerAttemptRef.current?.abort();
    providerAttemptRef.current = null;
    identityRevisionRef.current += 1;
    verificationTokenRevisionRef.current = null;
    setFields(createInitialSignupFields());
    setSignupRequestId(crypto.randomUUID());
    setCheckedEmail(null);
    setCheckingEmail(false);
    setLoading(false);
    setVerificationRequestId(null);
    setVerificationToken(null);
    setShopDetailAddress("");
    setShopPostalCode("");
    setAddressSheetOpen(false);
    setVerificationSheetOpen(false);
    setVerificationDetailSheetOpen(false);
    setSelectedVerificationMethod(null);
    setShowPassword(false);
    setShowPasswordConfirm(false);
    setPriceGuideFixtureRows(null);
    setAgreements({ ...initialAgreements });
    setStartTarget(null);
    setMessage(null);
    setStep("entry");
  }, []);

  useEffect(() => {
    const onAuthBoundary = (event?: string, session?: unknown) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && completingSessionTokenRef.current &&
        typeof session === "object" && session !== null && "access_token" in session &&
        session.access_token === completingSessionTokenRef.current) return;
      resetSignup();
    };
    draftBoundaryListeners.add(onAuthBoundary);
    observeSignupAuthBoundary(supabase);
    return () => { draftBoundaryListeners.delete(onAuthBoundary); };
  }, [resetSignup, supabase]);

  useEffect(() => {
    const expiresAt = draftStartedAtRef.current + VOLATILE_SIGNUP_DRAFT_TTL_MS;
    const expire = () => { if (!completingSessionTokenRef.current && Date.now() >= expiresAt) resetSignup(); };
    const timer = setTimeout(expire, Math.max(0, expiresAt - Date.now()));
    window.addEventListener?.("focus", expire);
    return () => { clearTimeout(timer); window.removeEventListener?.("focus", expire); };
  }, [resetSignup, signupRequestId]);

  const requiredAgreed = agreements.service && agreements.privacy;
  const allAgreed = ownerSignupTerms.every((term) => agreements[term.id]);
  const passwordConfirmState =
    fields.passwordConfirm.length === 0
      ? null
      : fields.password === fields.passwordConfirm
        ? { tone: "success" as const, helper: "비밀번호가 일치합니다" }
        : { error: "비밀번호가 일치하지 않습니다" };

  const verificationPurpose: VerificationPurpose = "signup";

  useEffect(() => {
    if (signupNavigating || completingSessionTokenRef.current) { clearVolatileSignupDraft(); return; }
    if (initialStart !== "email") return;
    if (step === "entry") {
      clearVolatileSignupDraft();
      return;
    }
    if ((step !== "identity" && step !== "profile") || !requiredAgreed) return;

    writeVolatileSignupDraft({
      savedAt: draftStartedAtRef.current,
      signupRequestId,
      step,
      agreements,
      fields,
      shopDetailAddress,
      shopPostalCode,
      checkedEmail,
      selectedVerificationMethod,
      verificationSheetOpen,
      verificationDetailSheetOpen,
      message,
    });
  }, [
    signupNavigating,
    agreements,
    checkedEmail,
    fields,
    initialStart,
    message,
    requiredAgreed,
    selectedVerificationMethod,
    shopDetailAddress,
    shopPostalCode,
    signupRequestId,
    step,
    verificationDetailSheetOpen,
    verificationSheetOpen,
  ]);

  useEffect(() => {
    let active = true;

    async function run() {
      setAuthBoundaryStatus("checking");
      try {
        if (!supabaseReady || !supabase) throw new Error("SESSION_CLIENT_UNAVAILABLE");
        const result = await supabase.auth.getSession();
        if (!active) return;
        if (result.error || !result.data || !("session" in result.data)) {
          throw new Error("SESSION_CHECK_FAILED");
        }
        // Only an explicitly successful anonymous result can reveal retained inputs.
        if (result.data.session === null) {
          setAuthBoundaryStatus("ready");
          return;
        }
        if (!result.data.session?.access_token) throw new Error("SESSION_RESULT_INVALID");
        resetSignup();
        clearSignupAgreementReceipt();
        if (initialStart === "email") {
          const signOutResult = await supabase.auth.signOut();
          if (!active) return;
          if (signOutResult.error) throw new Error("SESSION_SIGNOUT_FAILED");
          setAuthBoundaryStatus("ready");
          return;
        }
        router.replace(safeNextPath as never);
        router.refresh();
      } catch {
        if (active) setAuthBoundaryStatus("error");
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [initialStart, router, safeNextPath, supabase, supabaseReady, resetSignup, sessionCheckAttempt]);

  useEffect(() => {
    if (initialStart !== "email") return;
    if (!restoredDraftRef.current) {
      setStep(priceGuideFixtureEnabled ? "price-guide" : "identity");
    }
    // The development-only price guide fixture starts before the consent/profile flow.
    // Opening the consent sheet here would cover its camera and recovery checks.
    if (priceGuideFixtureEnabled) {
      setStartTarget(null);
      return;
    }

    const storedAgreements = readSignupAgreementReceipt();
    if (storedAgreements) {
      setAgreements(storedAgreements);
      setStartTarget(null);
      return;
    }

    if (restoredDraftRef.current?.agreements.service && restoredDraftRef.current.agreements.privacy) {
      setAgreements(restoredDraftRef.current.agreements);
      setStartTarget(null);
      return;
    }

    setStartTarget("email");
  }, [initialStart, priceGuideFixtureEnabled]);

  const updateField = (key: keyof typeof fields, value: string) => {
    const normalizedValue =
      key === "birthDate"
        ? value.replace(/\D/g, "").slice(0, 8)
        : key === "phoneNumber" || key === "shopPhone"
          ? normalizePhone(value)
          : value;

    const changesRepresentativeIdentity = key === "name" || key === "birthDate" || key === "phoneNumber";
    if (changesRepresentativeIdentity) {
      identityRevisionRef.current += 1;
      verificationTokenRevisionRef.current = null;
    }

    setFields((prev) => ({
      ...prev,
      [key]: normalizedValue,
      ...(changesRepresentativeIdentity ? { verificationCode: "" } : {}),
    }));

    if (key === "email") {
      emailRevisionRef.current += 1;
      setCheckedEmail(null);
    }

    if (changesRepresentativeIdentity) {
      setVerificationRequestId(null);
      setVerificationToken(null);
      }
  };

  const openStart = () => {
    resetSignup();
    setMessage(null);
    const storedAgreements = readSignupAgreementReceipt();
    if (storedAgreements) {
      setAgreements(storedAgreements);
      setStartTarget(null);
      setStep(priceGuideFixtureEnabled ? "price-guide" : "identity");
      return;
    }

    setStartTarget("email");
  };

  const continueStart = async () => {
    if (!requiredAgreed || !startTarget) {
      setMessage("필수 약관에 동의해 주세요.");
      return;
    }

    const agreementReceiptStored = writeSignupAgreementReceipt(agreements);
    if (!agreementReceiptStored) {
      setMessage("브라우저에서 약관 동의 상태를 저장하지 못했습니다. 현재 탭의 저장소 사용을 허용한 뒤 다시 시도해 주세요.");
      return;
    }

    setMessage(null);
    setStartTarget(null);
    setStep(priceGuideFixtureEnabled ? "price-guide" : "identity");
  };

  const getRepresentativeIdentityError = () => {
    if (!fields.name.trim()) return "대표자 이름을 입력해 주세요.";
    if (!/^01\d{8,9}$/.test(fields.phoneNumber)) return "대표자 휴대폰번호를 올바르게 입력해 주세요.";
    if (!isValidBirthDate8(fields.birthDate)) return "대표자 생년월일 8자리를 입력해 주세요.";
    return null;
  };

  const getRepresentativeAccountError = () => {
    const identityError = getRepresentativeIdentityError();
    if (identityError) return identityError;
    if (!isValidOwnerEmail(normalizeOwnerEmail(fields.email))) return "이메일 형식을 확인해 주세요.";
    if (!isValidOwnerPassword(fields.password)) return ownerPasswordRuleMessage;
    if (fields.password !== fields.passwordConfirm) return "비밀번호 확인이 일치하지 않습니다.";
    return null;
  };

  const moveToProfileStep = async () => {
    if (signupFlowRef.current || loading || checkingEmail) return;
    const error = getRepresentativeAccountError();
    if (error) { setMessage(error); return; }
    const flow = new AbortController();
    signupFlowRef.current = flow;
    setSignupPhase("checking");
    setMessage(null);
    try {
      const available = await checkEmailAvailability(normalizeOwnerEmail(fields.email), flow.signal);
      if (available && !flow.signal.aborted && signupFlowRef.current === flow) {
        setStep("profile");
      }
    } finally {
      if (signupFlowRef.current === flow) {
        signupFlowRef.current = null;
        setCheckingEmail(false);
        setSignupPhase("idle");
      }
    }
  };

  const returnToRepresentativeStep = () => {
    if (signupFlowRef.current || loading || checkingEmail) return;
    setMessage(null);
    setStep("identity");
  };

  const copyRepresentativePhoneToShop = () => {
    if (!/^01\d{8,9}$/.test(fields.phoneNumber)) {
      setMessage("대표자 휴대폰번호를 먼저 올바르게 입력해 주세요.");
      return;
    }
    if (fields.shopPhone && fields.shopPhone !== fields.phoneNumber) {
      setMessage("이미 다른 매장 연락처가 입력되어 있어 바꾸지 않았어요.");
      return;
    }

    updateField("shopPhone", fields.phoneNumber);
    setMessage(null);
  };

  const checkEmailAvailability = async (email: string, signal: AbortSignal) => {
    const revision = emailRevisionRef.current;
    setCheckingEmail(true);
    try {
      const response = await waitForIdentityOperation(fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`, { signal }), signal, 15_000);
      const result = (await waitForIdentityOperation(response.json(), signal, 15_000)) as { available?: boolean; message?: string };
      if (signal.aborted || revision !== emailRevisionRef.current) return false;
      if (!response.ok || !result.available) {
        setMessage(result.message ?? "이메일을 사용할 수 없습니다.");
        return false;
      }

      setCheckedEmail(email);
      return true;
    } catch {
      if (!signal.aborted && revision === emailRevisionRef.current) setMessage("이메일 확인에 실패했어요. 다시 시도해 주세요.");
      return false;
    } finally {
      if (!signal.aborted && revision === emailRevisionRef.current) setCheckingEmail(false);
    }
  };

  const moveToVerificationStep = async () => {
    if (signupFlowRef.current || loading || checkingEmail) return;
    if (!requiredAgreed) { setMessage("필수 약관에 동의해 주세요."); return; }
    const accountError = getRepresentativeAccountError();
    if (accountError) {
      setMessage(accountError);
      setStep("identity");
      return;
    }
    const email = normalizeOwnerEmail(fields.email);
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

    const flow = new AbortController();
    signupFlowRef.current = flow;
    setSignupPhase("checking");
    setMessage(null);
    try {
      if (checkedEmail !== email && !(await checkEmailAvailability(email, flow.signal))) {
        if (!flow.signal.aborted) setStep("identity");
        return;
      }
      if (flow.signal.aborted) return;
      let token = verificationTokenRevisionRef.current === identityRevisionRef.current &&
        isSignupTokenFresh(verificationToken) ? verificationToken : null;
      if (!token) {
        setVerificationToken(null);
        verificationTokenRevisionRef.current = null;
        setIdentityAttempted(true);
        setSignupPhase("verifying");
        token = (await startPhoneIdentity()) ?? null;
      }
      if (!token || flow.signal.aborted) return;
      setSignupPhase("submitting");
      await submitSignup(token, flow.signal);
    } catch {
      if (!flow.signal.aborted) setMessage("처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      if (signupFlowRef.current === flow) {
        signupFlowRef.current = null;
        setSignupPhase("idle");
      }
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
    const retainVerificationFailure = (failureMessage: string) => {
      setMessage(failureMessage);
    };

    if (providerAttemptRef.current || loading) return;
    const identityRevision = identityRevisionRef.current;
    const identity = {
      name: fields.name.trim(),
      birthDate: fields.birthDate,
      phoneNumber: fields.phoneNumber,
    };

    if (!portoneReady || !env.portoneStoreId || !channelKey) {
      retainVerificationFailure(missingEnvMessage);
      return;
    }

    if (!identity.name) {
      retainVerificationFailure("이름을 입력해 주세요.");
      return;
    }

    if (!isValidBirthDate8(identity.birthDate)) {
      retainVerificationFailure("생년월일 8자리를 입력해 주세요.");
      return;
    }

    if (!/^01\d{8,9}$/.test(identity.phoneNumber)) {
      retainVerificationFailure("휴대폰번호를 올바르게 입력해 주세요.");
      return;
    }

    const attempt = new AbortController();
    providerAttemptRef.current = attempt;
    setVerificationToken(null);
    verificationTokenRevisionRef.current = null;
    setLoading(true);
    setMessage(null);

    let failureStage: "REQUEST_FETCH" | "REQUEST_JSON" | "SDK_IMPORT" | "SDK_CALL" | "VERIFY_FETCH" | "VERIFY_JSON" = "REQUEST_FETCH";
    const reportFailure = (code: string, guidance: string) => {
      // Keep provider details and internal diagnostics out of customer copy.
      retainVerificationFailure(code === "SDK_CANCELLED" ? "본인인증을 취소했어요." :
        code === "POPUP_BLOCKED" ? "팝업을 허용한 뒤 다시 시도해 주세요." :
        "본인인증을 완료하지 못했어요. 다시 시도해 주세요.");
    };
    try {
      const requestResponse = await waitForIdentityOperation(fetch("/api/auth/request-verification-code", {
        signal: attempt.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: verificationPurpose,
          method: "portone",
          name: identity.name,
          birthDate: identity.birthDate,
          phoneNumber: identity.phoneNumber,
        }),
      }), attempt.signal, 15_000);
      failureStage = "REQUEST_JSON";
      const requestResult = (await waitForIdentityOperation(requestResponse.json(), attempt.signal, 15_000)) as VerificationApiResponse;
      if (identityRevisionRef.current !== identityRevision || attempt.signal.aborted) return;

      if (!requestResponse.ok || !requestResult.verificationRequestId ||
        !requestResult.providerIdentityVerificationId || !requestResult.verificationState) {
        reportFailure("REQUEST_REJECTED", "본인 인증 채널 요청 실패로 진행하지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      failureStage = "SDK_IMPORT";
      const { requestIdentityVerification } = await waitForIdentityOperation(import("@portone/browser-sdk/v2"), attempt.signal, 15_000);
      if (attempt.signal.aborted) return;
      const identityVerificationId = requestResult.providerIdentityVerificationId;

      failureStage = "SDK_CALL";
      const result = await waitForIdentityOperation(requestIdentityVerification({
        storeId: env.portoneStoreId,
        channelKey,
        identityVerificationId,
        customData: JSON.stringify({ petmanagerIdentityState: requestResult.verificationState }),
        windowType: { pc: "POPUP", mobile: "POPUP" },
        customer: {
          fullName: identity.name,
          phoneNumber: identity.phoneNumber,
          birthYear: identity.birthDate.slice(0, 4),
          birthMonth: identity.birthDate.slice(4, 6),
          birthDay: identity.birthDate.slice(6, 8),
        },
        ...(bypass ? { bypass } : {}),
      }), attempt.signal, 120_000);
      if (identityRevisionRef.current !== identityRevision || attempt.signal.aborted) return;

      if (!result || result.code || result.identityVerificationId !== identityVerificationId) {
        const code = !result || (!result.code && !result.identityVerificationId)
          ? "SDK_CANCELLED" : result.code ? "SDK_REJECTED" : "SDK_CALLBACK_MISMATCH";
        reportFailure(code, "본인 인증을 완료하지 못했어요. 인증 창의 진행 상태를 확인해 주세요.");
        return;
      }

      failureStage = "VERIFY_FETCH";
      const response = await waitForIdentityOperation(fetch("/api/auth/verify-pass", {
        signal: attempt.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: verificationPurpose,
          verificationRequestId: requestResult.verificationRequestId,
          identityVerificationId,
          verificationState: requestResult.verificationState,
        }),
      }), attempt.signal, 15_000);
      failureStage = "VERIFY_JSON";
      const verifyResult = (await waitForIdentityOperation(response.json(), attempt.signal, 15_000)) as VerificationApiResponse;
      if (identityRevisionRef.current !== identityRevision || attempt.signal.aborted) return;

      if (!response.ok || !verifyResult.verificationToken) {
        // Only exact application-owned messages can select customer guidance.
        // Never echo arbitrary server/provider text or relax identity binding.
        const mismatchGuidance = new Map<string, string>([
          ["본인확인 결과의 이름 정보가 일치하지 않습니다.", "대표자 이름과 인증한 이름이 달라요. 이전을 눌러 확인해 주세요."],
          ["본인확인 결과의 휴대폰번호가 일치하지 않습니다.", "대표자 휴대폰번호와 인증한 번호가 달라요. 이전을 눌러 확인해 주세요."],
          ["본인확인 결과의 생년월일이 일치하지 않습니다.", "대표자 생년월일과 인증 정보가 달라요. 이전을 눌러 확인해 주세요."],
        ]);
        const guidance = mismatchGuidance.get(verifyResult.message ?? "");
        if (guidance) setMessage(guidance);
        else reportFailure("VERIFY_REJECTED", "본인 인증 확인 실패로 완료하지 못했어요. 다시 인증해 주세요.");
        return;
      }

      setVerificationToken(verifyResult.verificationToken);
      verificationTokenRevisionRef.current = identityRevision;
      setMessage(successMessage);
      return verifyResult.verificationToken;
    } catch (error: unknown) {
      if (identityRevisionRef.current === identityRevision && !attempt.signal.aborted) {
        const timeout = error instanceof Error && error.message === "IDENTITY_TIMEOUT";
        // v0.1.3 reports this exact fixed string from its CDN loader. Never render raw errors.
        const cdnFailure = failureStage === "SDK_CALL" && error instanceof Error &&
          error.message === "[PortOne] Failed to load window.PortOne";
        const popupBlocked = failureStage === "SDK_CALL" && typeof error === "object" &&
          error !== null && "code" in error && (error.code === "POPUP_BLOCKED" ||
            // The KCP popup driver throws this fixed message; the CDN wraps it as UnknownError.
            // Match the whole constant, never display or extract provider error text.
            (error.code === "UnknownError" && "message" in error &&
              error.message === "본인인증 창 호출에 실패하였습니다. 팝업 차단으로 인해 정상적 실행에 실패했습니다."));
        // The SDK rejects prepare failures with IdentityVerificationError.code.
        // Only map documented constants; never expose provider text or arbitrary codes.
        const sdkFailureCodes = new Map<string, string>([
          ["BadRequest", "SDK_BAD_REQUEST"],
          ["InvalidArgument", "SDK_INVALID_ARGUMENT"],
          ["RequestParseFailed", "SDK_REQUEST_PARSE"],
          ["ParseChannelFailed", "SDK_CHANNEL_PARSE"],
          ["ChannelNotFound", "SDK_CHANNEL_NOT_FOUND"],
          ["StoreNotFound", "SDK_STORE_NOT_FOUND"],
          ["PermissionDenied", "SDK_PERMISSION_DENIED"],
          ["Unauthenticated", "SDK_UNAUTHENTICATED"],
          ["FailedPrecondition", "SDK_PRECONDITION"],
          ["AllChannelsNotSatisfied", "SDK_CHANNEL_CONDITIONS"],
          ["PGProviderError", "SDK_PROVIDER_ERROR"],
          ["IdentityVerificationAlreadyVerified", "SDK_ALREADY_VERIFIED"],
          ["Unavailable", "SDK_UNAVAILABLE"],
          ["DeadlineExceeded", "SDK_DEADLINE"],
          ["ResourceExhausted", "SDK_RATE_LIMIT"],
        ]);
        const sdkFailure = failureStage === "SDK_CALL" && typeof error === "object" &&
          error !== null && "code" in error && typeof error.code === "string"
          ? sdkFailureCodes.get(error.code) : undefined;
        if (cdnFailure) {
          reportFailure("CDN_LOAD", "인증 프로그램을 불러오지 못했어요. 입력은 유지됩니다. 오류 코드를 알려 주세요.");
        } else if (popupBlocked) {
          reportFailure("POPUP_BLOCKED", "인증 창이 차단되었어요. 브라우저의 팝업 허용 후 다시 시도해 주세요.");
        } else if (timeout) {
          reportFailure(`${failureStage}_TIMEOUT`, "인증 응답이 늦어지고 있어요. 인증 창의 진행 상태를 확인한 뒤 다시 시도해 주세요.");
        } else if (sdkFailure) {
          reportFailure(sdkFailure, "본인 인증 요청을 진행하지 못했어요. 입력은 유지됩니다. 서비스 담당자의 확인이 필요해요.");
        } else {
          const guidance = failureStage === "SDK_IMPORT"
            ? "인증 기능을 준비하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요."
            : failureStage === "SDK_CALL"
              ? "본인 인증을 완료하지 못했어요. 인증 창을 닫고 다시 시도해 주세요."
              : failureStage.startsWith("VERIFY")
                ? "인증 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요."
                : "인증 요청을 준비하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
          reportFailure(failureStage, guidance);
        }
      }
    } finally {
      attempt.abort();
      if (providerAttemptRef.current === attempt) {
        providerAttemptRef.current = null;
        setLoading(false);
      }
    }
  };

  const startPhoneIdentity = async () => {
    return await verifyPortoneIdentity({
      channelKey: process.env.NEXT_PUBLIC_PORTONE_IDENTITY_KCP_CHANNEL_KEY,
      successMessage: "휴대폰 본인 인증이 완료되었어요.",
      missingEnvMessage: "KCP 본인인증 채널이 아직 연결되지 않았어요.",
    });
  };

  const submitSignup = async (token: string, signal: AbortSignal) => {
    if (signal.aborted) return;

    if (!isSignupTokenFresh(token) || verificationTokenRevisionRef.current !== identityRevisionRef.current) {
      setVerificationToken(null);
      verificationTokenRevisionRef.current = null;
      setMessage("본인 인증을 먼저 완료해 주세요.");
      return;
    }

    const email = normalizeOwnerEmail(fields.email);
    if (!isValidOwnerEmail(email)) {
      setMessage("이메일 형식을 확인해 주세요.");
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

    const servicePrices: AtomicSignupServicePrice[] = (priceGuideFixtureRows ?? []).map((row) => ({
      id: row.id,
      name: row.name.trim(),
      detailName: "",
      price: Number(row.price),
      durationMinutes: 60,
      species: "all",
      breedGroup: "",
      weightBand: "",
    }));
    if (priceGuideFixtureEnabled && servicePrices.length === 0) {
      setMessage("서비스와 가격을 한 개 이상 검토해 저장해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await waitForIdentityOperation(fetch("/api/auth/signup", {
        signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupRequestId,
          email,
          password: fields.password,
          passwordConfirm: fields.passwordConfirm,
          name: fields.name.trim(),
          birthDate: fields.birthDate,
          phoneNumber: fields.phoneNumber,
          identityVerificationToken: token,
          shopName: fields.shopName.trim(),
          shopPhone: fields.shopPhone,
          shopAddress: shopDetailAddress.trim()
            ? `${fields.shopAddress.trim()}, ${shopDetailAddress.trim()}`
            : fields.shopAddress.trim(),
          agreements,
          servicePrices,
          termsVersion: OWNER_SIGNUP_TERMS_VERSION,
          marketingConsentVersion: OWNER_MARKETING_CONSENT_DOCUMENT_VERSION,
        }),
      }), signal, 30_000);
      const result = (await waitForIdentityOperation(response.json(), signal, 15_000)) as AtomicSignupResponse;
      if (signal.aborted) return;

      if (!response.ok || !result.success) {
        if (result.code === "ATOMIC_SIGNUP_MIGRATION_REQUIRED") {
          setMessage("가입 서버에 연결할 수 없어 가입이 중단됐어요. 서비스 담당자의 확인이 필요해요.");
          return;
        }
        if (result.code === "SIGNUP_REQUEST_TOO_LARGE") {
          setMessage("가입 정보의 용량이 너무 커요. 입력 내용을 줄인 뒤 다시 시도해 주세요.");
          return;
        }
        if (result.code === "INVALID_SIGNUP_REQUEST") {
          setMessage("가입 요청 형식이 올바르지 않아요. 서비스 담당자에게 문의해 주세요.");
          return;
        }
        if (result.code === "PAYLOAD_MISMATCH" || result.code === "SIGNUP_PAYLOAD_MISMATCH") {
          setSignupRequestId(crypto.randomUUID());
          setMessage("입력 내용이 변경되어 새 가입 요청을 준비했습니다. 다시 시도해 주세요.");
          return;
        }
        if (result.code === "REQUEST_IN_PROGRESS") {
          setMessage("회원가입 요청을 처리하고 있습니다. 잠시 후 같은 화면에서 다시 시도해 주세요.");
          return;
        }
        if (result.code === "COMPENSATION_PENDING") {
          setMessage("이전 가입 실패를 안전하게 정리하고 있습니다. 입력 내용은 유지되며, 운영 확인 후 다시 시도해 주세요.");
          return;
        }
        if (!isSignupTokenFresh(token) || /^(IDENTITY_|VERIFICATION_)/.test(result.code ?? "")) {
          setVerificationToken(null);
          verificationTokenRevisionRef.current = null;
          setMessage("본인인증을 다시 진행해 주세요.");
          return;
        }
        setMessage(response.status >= 500
          ? "가입 서버에서 오류가 발생했어요. 서비스 담당자에게 문의해 주세요."
          : "가입 요청이 거절됐어요. 입력 내용을 확인하고, 계속되면 서비스 담당자에게 문의해 주세요.");
        return;
      }

      setSignupNavigating(true);
      clearVolatileSignupDraft();
      clearSignupAgreementReceipt();
      const resolvedNextPath = resolveAtomicSignupNextPath(result, safeNextPath);
      const accessToken = result.session?.accessToken;
      const refreshToken = result.session?.refreshToken;
      if (accessToken && refreshToken) {
        if (!supabase) {
          resetSignup();
      setSignupNavigating(true);
          setMessage("가입은 완료됐지만 로그인 정보를 저장하지 못했습니다. 로그인 화면에서 다시 로그인해 주세요.");
          router.replace(`/login?next=${encodeURIComponent(resolvedNextPath)}&message=signup-success` as never);
          return;
        }

        completingSessionTokenRef.current = accessToken;
        let sessionFailed = false;
        try {
          const sessionResult = await waitForIdentityOperation<{ error: unknown }>(supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }), signal, 15_000);
          sessionFailed = Boolean(sessionResult.error);
        } catch { sessionFailed = true; }

        if (signal.aborted) return;
        if (sessionFailed) {
          resetSignup();
          setSignupNavigating(true);
          setMessage("가입은 완료됐지만 로그인 정보를 저장하지 못했습니다. 로그인 화면에서 다시 로그인해 주세요.");
          router.replace(`/login?next=${encodeURIComponent(resolvedNextPath)}&message=signup-success` as never);
          return;
        }

        setFields(createInitialSignupFields());
        const handoff = { accessToken, refreshToken };
        clearOwnerAuthTokenCache();
        writeOwnerAuthHandoff(handoff);
        writeOwnerAuthSessionCache(handoff);
        router.replace(resolvedNextPath as never);
        router.refresh();
        return;
      }

      resetSignup();
          setSignupNavigating(true);
      router.replace(`/login?next=${encodeURIComponent(resolvedNextPath)}&message=signup-success` as never);
      router.refresh();
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  if (signupNavigating) return <main className="flex min-h-dvh items-center justify-center bg-white px-5 text-[#111a30]" aria-busy="true"><p role="status" className="text-[16px] leading-6">가입이 완료됐어요. 매장 화면으로 이동하고 있어요.</p></main>;

  if (authBoundaryStatus === "checking") return null;
  if (authBoundaryStatus === "error") {
    return (
      <main className={cn(PAGE_FRAME, "text-[#111827]")} data-signup-session-error>
        <div className={PAGE_CONTENT}>
          <p role="alert" className="auth-type-body">로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.</p>
          <button type="button" className={BUTTON_PRIMARY} onClick={() => {
            setAuthBoundaryStatus("checking");
            setSessionCheckAttempt((attempt) => attempt + 1);
          }}>다시 시도하기</button>
        </div>
      </main>
    );
  }

  return (
    <main className={cn(PAGE_FRAME, "text-[#111827]")} data-signup-shell="fullscreen">
      <div className={PAGE_CONTENT}>
        <header>
          <div className="flex min-h-11 items-center gap-2">
            {step === "entry" || step === "price-guide" ? (
              <MobileBackLinkButton
                href={step === "entry" ? `/login?next=${encodeURIComponent(safeNextPath)}` : "/signup"}
                replace
                aria-label={step === "entry" ? "로그인으로 이동" : "회원가입 첫 단계로 이동"}
                className="-ml-2 shrink-0 rounded-[10px] border-0 bg-transparent shadow-none hover:bg-[#f8fafc]"
              />
            ) : (
              <MobileBackButton
                onClick={() => {
                  setMessage(null);
                  if (signupFlowRef.current) return;
                  if (step === "profile") { returnToRepresentativeStep(); return; }
                  resetSignup();
                  setStep("entry");
                }}
                label={step === "profile" ? "대표자 정보로 돌아가기" : "회원가입 시작으로 돌아가기"}
                className="-ml-2 shrink-0 rounded-[10px] border-0 bg-transparent shadow-none hover:bg-[#f8fafc]"
              />
            )}
            <h1 className={cn(PAGE_TITLE, "m-0 flex h-11 items-center !leading-none")}>회원가입</h1>
          </div>
        </header>

        <div
          className={cn(
            step === "identity" ? "pt-8" : "pt-4",
            step === "identity" || step === "profile"
              ? "pb-[calc(env(safe-area-inset-bottom)+88px)]"
              : "pb-[calc(env(safe-area-inset-bottom)+24px)]",
          )}
        >
        {step === "entry" ? (
          <EntryStep
            onStartEmail={openStart}
            safeNextPath={safeNextPath}
          />
        ) : null}

        {step === "price-guide" ? (
          <MobileAiPriceGuideFixture
            initialRows={priceGuideFixtureRows}
            onComplete={(rows) => {
              setPriceGuideFixtureRows(rows);
              setStep("identity");
            }}
            onExit={(rows) => {
              setPriceGuideFixtureRows(rows);
              resetSignup();
              setStep("entry");
            }}
          />
        ) : null}

        <fieldset disabled={signupPhase !== "idle"} className="min-w-0 border-0 p-0" aria-busy={signupPhase !== "idle"}>
        {step === "identity" ? (
          <div className="w-full text-left" data-signup-identity-stage="top">
            <div data-signup-identity-fields>
              <AuthSectionBlock>
                <AuthField label="이름">
                  <AuthInput
                    value={fields.name}
                    onChange={(value) => updateField("name", value)}
                    placeholder="대표자 이름"
                    autoComplete="name"
                  />
                </AuthField>

                <AuthField label="대표자 휴대폰">
                  <AuthInput
                    value={formatPhone(fields.phoneNumber)}
                    onChange={(value) => updateField("phoneNumber", value)}
                    placeholder="010-0000-0000"
                    inputMode="numeric"
                    autoComplete="tel"
                  />
                </AuthField>

                <AuthField label="생년월일">
                  <AuthInput
                    value={formatBirthDate(fields.birthDate)}
                    onChange={(value) => updateField("birthDate", value)}
                    placeholder="예: 1999-03-21"
                    inputMode="numeric"
                    autoComplete="bday"
                  />
                </AuthField>
              </AuthSectionBlock>
            </div>
            <div className="mt-4">
            <AuthSectionBlock>
                <AuthField label="이메일">
                  <AuthInput
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={fields.email}
                    onChange={(value) => updateField("email", value)}
                    placeholder="example@petmanager.co.kr"
                  />
                </AuthField>

                <AuthField label="비밀번호">
                  <AuthInput
                    type={showPassword ? "text" : "password"}
                    value={fields.password}
                    onChange={(value) => updateField("password", value)}
                    placeholder="비밀번호 입력"
                    rightSlot={
                      <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="flex h-11 w-11 items-center justify-center rounded-[8px] text-[#64748b]" aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>
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
                    placeholder="비밀번호 다시 입력"
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm((prev) => !prev)}
                        className="flex h-11 w-11 items-center justify-center rounded-[8px] text-[#64748b]"
                        aria-label={showPasswordConfirm ? "비밀번호 확인 숨기기" : "비밀번호 확인 보기"}
                      >
                        {showPasswordConfirm ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    }
                  />
                </AuthField>
            </AuthSectionBlock>

            </div>
          </div>
        ) : null}

        {step === "profile" ? (
          <div className="grid items-start gap-4" data-signup-profile-fields>
            <AuthSectionBlock>
                <AuthField label="매장명">
                  <AuthInput
                    value={fields.shopName}
                    onChange={(value) => updateField("shopName", value)}
                    placeholder="예: 포근한 발바닥 미용실"
                  />
                </AuthField>

                <div className="relative">
                  <AuthField label="매장 연락처">
                    <AuthInput
                      value={formatPhone(fields.shopPhone)}
                      onChange={(value) => updateField("shopPhone", value)}
                      placeholder="010-0000-0000"
                      inputMode="numeric"
                      autoComplete="tel"
                    />
                  </AuthField>
                  <button
                    type="button"
                    onClick={copyRepresentativePhoneToShop}
                    className="absolute -top-3 right-0 inline-flex min-h-11 items-center rounded-[10px] px-1 text-[14px] font-medium text-[#2563eb]"
                  >
                    대표자 휴대폰과 동일
                  </button>
                </div>

                <AuthField label="매장 주소">
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setAddressSheetOpen(true)}
                      className="flex min-h-[48px] w-full scroll-mb-[calc(env(safe-area-inset-bottom)+96px)] items-center justify-between gap-3 rounded-[10px] border border-[#dbe2ea] bg-white px-[14px] py-2.5 text-left outline-none transition-[border-color,box-shadow] focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/10"
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "auth-type-control !font-normal text-left [overflow-wrap:anywhere]",
                            fields.shopAddress ? "text-[#111827]" : "text-[#64748b]",
                          )}
                        >
                          {fields.shopAddress || "주소를 검색해 주세요"}
                        </p>
                        {shopPostalCode ? (
                          <p className="mt-1 text-[12px] font-medium text-[#64748b]">우편번호 {shopPostalCode}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[14px] font-medium text-[#334155]">주소 검색</span>
                    </button>

                    <AuthInput
                      value={shopDetailAddress}
                      onChange={setShopDetailAddress}
                      placeholder="상세 주소 입력"
                    />
                  </div>

                  <AuthInput
                    className="hidden"
                    value={fields.shopAddress}
                    onChange={(value) => updateField("shopAddress", value)}
                    placeholder="매장 주소를 입력해 주세요"
                  />
                </AuthField>
            </AuthSectionBlock>
          </div>
        ) : null}

        </fieldset>
        {message && !startTarget ? <p role="alert" className={cn(INLINE_ERROR, "mt-3.5")}>{message}</p> : null}
        </div>
      </div>

      {step === "identity" || step === "profile" ? (
        <footer className={cn(SHEET_ACTION_FOOTER, "fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px]")}
          data-signup-action-bar="fixed" data-signup-stage-footer={step}>
          {step === "identity" ? (
            <button type="button" onClick={moveToProfileStep} disabled={signupPhase !== "idle" || loading || checkingEmail} className={BUTTON_PRIMARY}>{signupPhase === "checking" || checkingEmail ? "이메일 확인 중..." : "다음"}</button>
          ) : (
          <div className={ACTION_BUTTON_GRID}>
          <button type="button" onClick={returnToRepresentativeStep} disabled={signupPhase !== "idle" || loading || checkingEmail} className={BUTTON_SECONDARY}>이전</button>
          <button type="button" onClick={() => void moveToVerificationStep()}
            disabled={signupPhase !== "idle" || loading || checkingEmail} className={BUTTON_PRIMARY}>
            {signupPhase === "checking" ? "확인 중..." : signupPhase === "verifying" ? "본인인증 확인 중..." :
              signupPhase === "submitting" ? "가입 중..." :
              isSignupTokenFresh(verificationToken) ? "가입 다시 시도하기" :
              identityAttempted ? "본인인증 다시 하기" : "본인인증하고 가입하기"}
          </button>
          </div>
          )}
        </footer>
      ) : null}

      {startTarget ? (
        <SignupConsentDialog
          agreements={agreements}
          allAgreed={allAgreed}
          requiredAgreed={requiredAgreed}
          onAllChange={(checked) => setAgreements({ service: checked, privacy: checked, location: checked, marketing: checked })}
          onAgreementChange={(id, checked) => setAgreements((prev) => ({ ...prev, [id]: checked }))}
          onClose={() => setStartTarget(null)}
          onContinue={continueStart}
          message={message}
          primaryClassName={BUTTON_PRIMARY}
          secondaryClassName={BUTTON_SECONDARY}
        />
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
    </main>
  );
}
