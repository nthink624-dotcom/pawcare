"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, CircleUserRound, Eye, EyeOff, X } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  isValidBirthDate8,
  isValidOwnerLoginId,
  isValidOwnerPassword,
  normalizeOwnerLoginId,
  ownerPasswordRuleMessage,
} from "@/lib/auth/owner-credentials";

type SignupStep = "terms" | "profile";
type AgreementState = {
  service: boolean;
  privacy: boolean;
  location: boolean;
  marketing: boolean;
};

type FieldState = {
  loginId: string;
  password: string;
  passwordConfirm: string;
  name: string;
  birthDate: string;
  shopName: string;
  shopAddress: string;
};

const termDescriptions: Record<keyof AgreementState, string> = {
  service: "PawCare 서비스 이용을 위한 기본 약관입니다.",
  privacy: "회원가입과 매장 운영을 위해 필요한 개인정보 처리 기준입니다.",
  location: "위치 기반 매장 안내 기능이 확장될 경우를 위한 선택 약관입니다.",
  marketing: "이벤트, 혜택, 업데이트 안내 수신에 대한 선택 동의입니다.",
};

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
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
  onToggle,
  onView,
}: {
  checked: boolean;
  title: string;
  required: boolean;
  onToggle: () => void;
  onView: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-[#e4ddd2] bg-white px-4 py-4">
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-6 w-6 items-center justify-center rounded-full border ${checked ? "border-[#2f786b] bg-[#2f786b] text-white" : "border-[#cfc7b8] bg-white text-transparent"}`}
      >
        <Check className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-[#111111]">[{required ? "필수" : "선택"}] {title}</p>
      </div>
      <button type="button" onClick={onView} className="text-[14px] font-medium text-[#6f6f6f] underline underline-offset-4">
        보기
      </button>
    </div>
  );
}

export default function SignupForm({ supabaseReady }: { supabaseReady: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [step, setStep] = useState<SignupStep>("terms");
  const [agreements, setAgreements] = useState<AgreementState>({
    service: false,
    privacy: false,
    location: false,
    marketing: false,
  });
  const [openTerm, setOpenTerm] = useState<keyof AgreementState | null>(null);
  const [fields, setFields] = useState<FieldState>({
    loginId: "",
    password: "",
    passwordConfirm: "",
    name: "",
    birthDate: "",
    shopName: "",
    shopAddress: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [checkingLoginId, setCheckingLoginId] = useState(false);
  const [loginIdMessage, setLoginIdMessage] = useState<string | null>(null);
  const [loginIdAvailable, setLoginIdAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const allChecked = Object.values(agreements).every(Boolean);
  const requiredAgreed = agreements.service && agreements.privacy;

  const updateField = (key: keyof FieldState, value: string) => {
    setFields((prev) => ({
      ...prev,
      [key]: key === "birthDate" ? value.replace(/\D/g, "").slice(0, 8) : value,
    }));
    if (key === "loginId") {
      setLoginIdAvailable(null);
      setLoginIdMessage(null);
    }
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

  const handleSignup = async () => {
    if (!supabaseReady || !supabase) {
      setMessage("Supabase 환경 변수가 설정되지 않았습니다. .env.local을 먼저 확인해 주세요.");
      return;
    }

    if (!requiredAgreed) {
      setMessage("필수 약관에 모두 동의해 주세요.");
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

    if (!isValidBirthDate8(fields.birthDate)) {
      setMessage("생년월일은 8자리 숫자로 입력해 주세요.");
      return;
    }

    if (!fields.name || !fields.shopName || !fields.shopAddress) {
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
          shopName: fields.shopName,
          shopAddress: fields.shopAddress,
          agreements,
        }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(result.message ?? "회원가입에 실패했습니다.");
        return;
      }

      setMessage("회원가입이 완료되었습니다. 로그인 화면으로 이동합니다.");
      setTimeout(() => {
        router.replace("/login?message=signup-success" as never);
        router.refresh();
      }, 900);
    } catch {
      setMessage("회원가입 처리 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 pb-10 pt-6 text-[#111111]">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-[#6f6f6f]">PAWCARE OWNER</div>
        <a href="/login" className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#fafafa] text-[#111111] shadow-[0_8px_20px_rgba(17,17,17,0.05)]">
          <X className="h-6 w-6" strokeWidth={2.2} />
        </a>
      </div>

      <div className="mt-12 flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-[#dcfae8] text-[#2d645c]">
        <CircleUserRound className="h-8 w-8" strokeWidth={1.8} />
      </div>

      <div className="mt-10">
        <h1 className="text-[28px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#111111]">{step === "terms" ? "약관 동의" : "회원가입"}</h1>
        {step === "terms" ? (
          <p className="mt-3 text-[14px] leading-6 text-[#6f6f6f]">전체 동의 시 필수 약관 및 선택 약관에 모두 동의한 것으로 처리됩니다.</p>
        ) : null}
      </div>

      {step === "terms" ? (
        <div className="mt-7 space-y-3.5">
          <button
            type="button"
            onClick={() => setAgreements({ service: !allChecked, privacy: !allChecked, location: !allChecked, marketing: !allChecked })}
            className="flex w-full items-center gap-3 rounded-[20px] border border-[#d9d2c7] bg-[#faf7f2] px-4 py-4 text-left"
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${allChecked ? "border-[#2f786b] bg-[#2f786b] text-white" : "border-[#cfc7b8] bg-white text-transparent"}`}>
              <Check className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <div>
              <p className="text-[16px] font-semibold text-[#111111]">전체 동의하기</p>
            </div>
          </button>

          <AgreementRow checked={agreements.service} title="서비스 이용약관 동의" required onToggle={() => setAgreements((prev) => ({ ...prev, service: !prev.service }))} onView={() => setOpenTerm(openTerm === "service" ? null : "service")} />
          {openTerm === "service" ? <div className="rounded-[18px] bg-[#faf7f2] px-4 py-4 text-[14px] leading-6 text-[#6f6f6f]">{termDescriptions.service}</div> : null}

          <AgreementRow checked={agreements.privacy} title="개인정보 수집 및 이용 동의" required onToggle={() => setAgreements((prev) => ({ ...prev, privacy: !prev.privacy }))} onView={() => setOpenTerm(openTerm === "privacy" ? null : "privacy")} />
          {openTerm === "privacy" ? <div className="rounded-[18px] bg-[#faf7f2] px-4 py-4 text-[14px] leading-6 text-[#6f6f6f]">{termDescriptions.privacy}</div> : null}

          <AgreementRow checked={agreements.location} title="위치기반서비스 이용약관 동의" required={false} onToggle={() => setAgreements((prev) => ({ ...prev, location: !prev.location }))} onView={() => setOpenTerm(openTerm === "location" ? null : "location")} />
          {openTerm === "location" ? <div className="rounded-[18px] bg-[#faf7f2] px-4 py-4 text-[14px] leading-6 text-[#6f6f6f]">{termDescriptions.location}</div> : null}

          <AgreementRow checked={agreements.marketing} title="이벤트/혜택 정보 수신 동의" required={false} onToggle={() => setAgreements((prev) => ({ ...prev, marketing: !prev.marketing }))} onView={() => setOpenTerm(openTerm === "marketing" ? null : "marketing")} />
          {openTerm === "marketing" ? <div className="rounded-[18px] bg-[#faf7f2] px-4 py-4 text-[14px] leading-6 text-[#6f6f6f]">{termDescriptions.marketing}</div> : null}

          <button
            type="button"
            onClick={() => setStep("profile")}
            disabled={!requiredAgreed}
            className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#2f786b] px-5 text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-7 space-y-3.5">
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
          {loginIdMessage ? <p className={`px-1 text-[13px] ${loginIdAvailable ? "text-[#2f786b]" : "text-[#b14b4b]"}`}>{checkingLoginId ? "아이디 확인 중..." : loginIdMessage}</p> : null}

          <FieldShell label="비밀번호">
            <div className="flex items-center gap-3">
              <input type={showPassword ? "text" : "password"} value={fields.password} onChange={(event) => updateField("password", event.target.value)} placeholder="비밀번호 입력" className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]" />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="text-[#111111]">{showPassword ? <EyeOff className="h-5 w-5" strokeWidth={2.1} /> : <Eye className="h-5 w-5" strokeWidth={2.1} />}</button>
            </div>
          </FieldShell>
          <p className="pl-[15px] pr-1 text-[13px] text-[#6f6f6f]">※ 영문 대,소문자 숫자, 특수문자를 각각 1개 이상 포함해 주세요</p>

          <FieldShell label="비밀번호 확인">
            <div className="flex items-center gap-3">
              <input type={showPasswordConfirm ? "text" : "password"} value={fields.passwordConfirm} onChange={(event) => updateField("passwordConfirm", event.target.value)} placeholder="비밀번호 확인 입력" className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]" />
              <button type="button" onClick={() => setShowPasswordConfirm((prev) => !prev)} className="text-[#111111]">{showPasswordConfirm ? <EyeOff className="h-5 w-5" strokeWidth={2.1} /> : <Eye className="h-5 w-5" strokeWidth={2.1} />}</button>
            </div>
          </FieldShell>

          <FieldShell label="이름">
            <input type="text" value={fields.name} onChange={(event) => updateField("name", event.target.value)} placeholder="이름 입력" className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]" />
          </FieldShell>

          <FieldShell label="생년월일 8자리">
            <input type="text" inputMode="numeric" value={fields.birthDate} onChange={(event) => updateField("birthDate", event.target.value)} placeholder="예: 19990321" className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]" />
          </FieldShell>

          <FieldShell label="매장명">
            <input type="text" value={fields.shopName} onChange={(event) => updateField("shopName", event.target.value)} placeholder="매장명 입력" className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]" />
          </FieldShell>

          <FieldShell label="매장 주소">
            <input type="text" value={fields.shopAddress} onChange={(event) => updateField("shopAddress", event.target.value)} placeholder="매장 주소 입력" className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]" />
          </FieldShell>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button type="button" onClick={() => setStep("terms")} className="flex h-[52px] items-center justify-center rounded-[18px] border border-[#d9d2c7] bg-white text-[15px] font-semibold text-[#111111]">이전</button>
            <button type="button" onClick={handleSignup} disabled={loading} className="flex h-[52px] items-center justify-center rounded-[18px] bg-[#2f786b] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{loading ? "가입 중..." : "회원가입"}</button>
          </div>
        </div>
      )}

      {message ? <p className="mt-4 text-[14px] leading-6 text-[#6f6f6f]">{message}</p> : null}

      <div className="mt-6 text-center">
        <a href="/login" className="text-[15px] font-medium text-[#111111] underline underline-offset-4">로그인으로 돌아가기</a>
      </div>
    </div>
  );
}
