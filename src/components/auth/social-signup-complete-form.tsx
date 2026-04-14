"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, CircleUserRound, X } from "lucide-react";

import { OWNER_SIGNUP_TERMS_VERSION, ownerSignupTerms, type OwnerSignupTermId } from "@/lib/auth/owner-signup-terms";
import { isValidBirthDate8 } from "@/lib/auth/owner-credentials";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AgreementState = Record<OwnerSignupTermId, boolean>;

const initialAgreements: AgreementState = {
  service: true,
  privacy: true,
  location: true,
  marketing: false,
};

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidPhoneNumber(value: string) {
  return /^01\d{8,9}$/.test(normalizePhoneNumber(value));
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-[20px] border border-[#dbd7d0] bg-white px-[14px] py-[9px]">
      <span className="block text-[13px] font-medium text-[#757575]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export default function SocialSignupCompleteForm({
  nextPath = "/owner",
  providerLabel,
}: {
  nextPath?: string;
  providerLabel: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [agreements, setAgreements] = useState<AgreementState>(initialAgreements);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const requiredAgreed = ownerSignupTerms.filter((term) => term.required).every((term) => agreements[term.id]);

  const handleSubmit = async () => {
    if (loading) return;

    if (!name.trim()) {
      setMessage("이름을 입력해 주세요.");
      return;
    }

    if (!isValidBirthDate8(birthDate)) {
      setMessage("생년월일은 8자리 숫자로 입력해 주세요.");
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      setMessage("휴대폰 번호를 올바르게 입력해 주세요.");
      return;
    }

    if (!shopName.trim() || !shopAddress.trim()) {
      setMessage("매장 정보를 입력해 주세요.");
      return;
    }

    if (!requiredAgreed) {
      setMessage("필수 약관에 동의해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/social-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          birthDate,
          phoneNumber,
          shopName: shopName.trim(),
          shopAddress: shopAddress.trim(),
          agreements,
          termsVersion: OWNER_SIGNUP_TERMS_VERSION,
        }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(result.message ?? "가입 마무리 중 문제가 발생했습니다.");
        return;
      }

      await supabase?.auth.refreshSession();
      router.replace(nextPath as never);
      router.refresh();
    } catch {
      setMessage("가입 마무리 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fafaf5] px-6 pb-10 pt-6 text-[#111111]">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-[#6f6f6f]">펫매니저 OWNER</div>
        <Link
          href="/login"
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
          {providerLabel} 로그인 마무리
        </h1>
        <p className="mt-3 text-[14px] leading-6 text-[#6f6f6f]">
          매장 정보만 입력하면 바로 2주 무료체험을 시작할 수 있어요.
        </p>
      </div>

      <div className="mt-7 space-y-3.5">
        <FieldShell label="이름">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름 입력"
            className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </FieldShell>

        <FieldShell label="생년월일 8자리">
          <input
            type="text"
            inputMode="numeric"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="예: 19990321"
            className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </FieldShell>

        <FieldShell label="휴대폰 번호">
          <input
            type="text"
            inputMode="numeric"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(normalizePhoneNumber(event.target.value))}
            placeholder="숫자만 입력"
            className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </FieldShell>

        <FieldShell label="매장명">
          <input
            type="text"
            value={shopName}
            onChange={(event) => setShopName(event.target.value)}
            placeholder="예: 포근한 발바닥 미용실"
            className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </FieldShell>

        <FieldShell label="매장 주소">
          <input
            type="text"
            value={shopAddress}
            onChange={(event) => setShopAddress(event.target.value)}
            placeholder="주소 입력"
            className="h-[18px] w-full border-0 bg-transparent p-0 text-[14px] font-medium text-[#111111] outline-none placeholder:text-[#b0aaa1]"
          />
        </FieldShell>

        <div className="rounded-[18px] border border-[#d8e7df] bg-[#eef8f3] px-4 py-4">
          <p className="text-[14px] font-semibold text-[#111111]">약관 동의</p>
          <div className="mt-3 space-y-2.5">
            {ownerSignupTerms.map((term) => (
              <button
                key={term.id}
                type="button"
                onClick={() => setAgreements((prev) => ({ ...prev, [term.id]: !prev[term.id] }))}
                className="flex w-full items-center gap-3 text-left"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${agreements[term.id] ? "border-[#6b9e8a] bg-[#6b9e8a] text-white" : "border-[#cfc7b8] bg-white text-transparent"}`}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                </span>
                <span className="text-[14px] text-[#3d3d3d]">
                  [{term.required ? "필수" : "선택"}] {term.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#2f786b] px-5 text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "가입 마무리 중..." : "무료체험 시작하기"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {message ? <p className="mt-4 text-[14px] leading-6 text-[#6f6f6f]">{message}</p> : null}
    </div>
  );
}
