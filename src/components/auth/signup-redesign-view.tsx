"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import PetManagerBrand from "@/components/brand/petmanager-brand";
import {
  ownerSignupTerms,
  type OwnerSignupTermId,
} from "@/lib/auth/owner-signup-terms";

export type SignupProfileStage = "terms" | "account" | "shop";

type SignupFields = {
  name: string;
  phoneNumber: string;
  email: string;
  password: string;
  passwordConfirm: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
};

type AgreementState = Record<OwnerSignupTermId, boolean>;

type FieldStatus = {
  text?: string;
  tone?: "default" | "success" | "error";
};

type SignupRedesignViewProps = {
  stage: SignupProfileStage;
  fields: SignupFields;
  agreements: AgreementState;
  shopDetailAddress: string;
  shopPhoneSameAsOwner: boolean;
  loading: boolean;
  message: string | null;
  emailStatus?: FieldStatus;
  passwordStatus?: FieldStatus;
  passwordConfirmStatus?: FieldStatus;
  onBack: () => void;
  onChangeField: (key: keyof SignupFields, value: string) => void;
  onChangeAgreement: (id: OwnerSignupTermId, checked: boolean) => void;
  onChangeShopDetailAddress: (value: string) => void;
  onChangeShopPhoneSameAsOwner: (checked: boolean) => void;
  onContinueTerms: () => void;
  onNextAccount: () => void;
  onOpenAddress: () => void;
  onSubmit: () => void;
};

const INPUT_CLASS =
  "h-[58px] w-full rounded-[12px] border border-[#dbe5f6] bg-[#eaf1ff] px-4 text-[16px] font-medium text-[#111827] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#a3b4d0] focus:border-[#15213b] focus:bg-[#eef4ff] focus:shadow-[0_0_0_3px_rgba(21,33,59,0.08)]";

const PRIMARY_BUTTON_CLASS =
  "mt-7 flex h-[62px] w-full items-center justify-center rounded-[14px] bg-[#111a30] px-4 text-[17px] font-bold tracking-[-0.02em] text-white transition-[background-color,transform] hover:bg-[#17233d] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const termLinkById: Record<OwnerSignupTermId, string> = {
  service: "/terms",
  privacy: "/privacy-consent",
  location: "/terms",
  marketing: "/privacy",
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function SignupShell({
  title,
  onBack,
  children,
}: {
  title?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#f1f3f7] px-5 py-8 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#111827] antialiased sm:px-6 sm:py-12">
      <section className="w-full max-w-[448px] rounded-[32px] bg-white px-8 pb-11 pt-7 shadow-[0_24px_64px_rgba(15,23,42,0.1)]">
        <div className="mb-4 flex justify-center">
          <PetManagerBrand
            className="gap-2.5"
            imageClassName="h-8"
            nameClassName="text-[20px] text-[#111827]"
            priority
          />
        </div>
        <div className={title ? "relative mb-8 flex min-h-9 items-center justify-center" : "relative -mt-2 mb-6 flex h-9 items-center"}>
          <button
            type="button"
            onClick={onBack}
            className={title ? "absolute left-0 inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[#7184a6] transition hover:bg-[#f1f5fb] hover:text-[#111a30]" : "-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[#7184a6] transition hover:bg-[#f1f5fb] hover:text-[#111a30]"}
            aria-label="이전 단계"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
          {title ? <h1 className="text-center text-[24px] font-extrabold tracking-[-0.04em] text-[#101a31]">{title}</h1> : null}
        </div>
        {children}
      </section>
    </main>
  );
}

function Field({
  label,
  status,
  children,
}: {
  label: string;
  status?: FieldStatus;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[14px] font-semibold text-[#7184a6]">{label}</p>
      {children}
      {status?.text ? (
        <span
          className={
            status.tone === "success"
              ? "mt-1.5 block text-[12px] font-medium text-[#1f9d55]"
              : status.tone === "error"
                ? "mt-1.5 block text-[12px] font-medium text-[#c2414f]"
                : "mt-1.5 block text-[12px] font-medium text-[#7184a6]"
          }
        >
          {status.text}
        </span>
      ) : null}
    </div>
  );
}

function Notice({ message }: { message: string | null }) {
  return message ? <p className="mt-4 text-[13px] font-medium leading-5 text-[#c2414f]">{message}</p> : null;
}

export default function SignupRedesignView({
  stage,
  fields,
  agreements,
  shopDetailAddress,
  shopPhoneSameAsOwner,
  loading,
  message,
  emailStatus,
  passwordStatus,
  passwordConfirmStatus,
  onBack,
  onChangeField,
  onChangeAgreement,
  onChangeShopDetailAddress,
  onChangeShopPhoneSameAsOwner,
  onContinueTerms,
  onNextAccount,
  onOpenAddress,
  onSubmit,
}: SignupRedesignViewProps) {
  if (stage === "terms") {
    const allTermsAgreed = ownerSignupTerms.every((term) => agreements[term.id]);

    return (
      <SignupShell title="약관 동의" onBack={onBack}>
        <div className="overflow-hidden rounded-[14px] border border-[#e2eaf6]">
          <div className="flex items-center gap-3 border-b border-[#e2eaf6] bg-[#f7faff] px-4 py-4">
            <input
              id="all-terms"
              type="checkbox"
              checked={allTermsAgreed}
              onChange={(event) => {
                ownerSignupTerms.forEach((term) => onChangeAgreement(term.id, event.target.checked));
              }}
              className="h-4 w-4 shrink-0 rounded border-[#c7d3e7] accent-[#111a30]"
            />
            <label htmlFor="all-terms" className="cursor-pointer text-[15px] font-bold text-[#111a30]">
              전체 동의
            </label>
          </div>
          {ownerSignupTerms.map((term) => (
            <div key={term.id} className="flex items-center gap-3 border-b border-[#edf2fa] px-4 py-4 last:border-b-0">
              <input
                id={term.id}
                type="checkbox"
                checked={agreements[term.id]}
                onChange={(event) => onChangeAgreement(term.id, event.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-[#c7d3e7] accent-[#111a30]"
              />
              <label htmlFor={term.id} className="min-w-0 flex-1 cursor-pointer text-[14px] font-medium text-[#334155]">
                {term.required ? "[필수] " : "[선택] "}
                {term.title}
              </label>
              <Link href={termLinkById[term.id] as never} className="shrink-0 text-[12px] font-medium text-[#9aadd0] underline underline-offset-2">
                보기
              </Link>
            </div>
          ))}
        </div>
        <Notice message={message} />
        <button type="button" onClick={onContinueTerms} disabled={loading} className={PRIMARY_BUTTON_CLASS}>
          계속하기
        </button>
      </SignupShell>
    );
  }

  if (stage === "account") {
    return (
      <SignupShell onBack={onBack}>
        <Field label="이메일" status={emailStatus}>
          <input
            type="email"
            value={fields.email}
            onChange={(event) => onChangeField("email", event.target.value)}
            placeholder="이메일을 입력해 주세요"
            autoComplete="email"
            aria-label="이메일"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="비밀번호" status={passwordStatus}>
          <input
            type="password"
            value={fields.password}
            onChange={(event) => onChangeField("password", event.target.value)}
            placeholder="비밀번호를 입력해 주세요"
            autoComplete="new-password"
            aria-label="비밀번호"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="비밀번호 확인" status={passwordConfirmStatus}>
          <input
            type="password"
            value={fields.passwordConfirm}
            onChange={(event) => onChangeField("passwordConfirm", event.target.value)}
            placeholder="비밀번호를 한 번 더 입력해 주세요"
            autoComplete="new-password"
            aria-label="비밀번호 확인"
            className={INPUT_CLASS}
          />
        </Field>
        <Notice message={message} />
        <button type="button" onClick={onNextAccount} disabled={loading} className={PRIMARY_BUTTON_CLASS}>
          {loading ? "본인인증을 준비 중입니다." : "다음"}
        </button>
      </SignupShell>
    );
  }

  return (
    <SignupShell title="매장 정보" onBack={onBack}>
      <Field label="매장명">
        <input
          value={fields.shopName}
          onChange={(event) => onChangeField("shopName", event.target.value)}
          placeholder="매장명을 입력해 주세요"
          autoComplete="organization"
          aria-label="매장명"
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="매장 연락처">
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-[13px] text-[#7184a6]">
          <input
            type="checkbox"
            checked={shopPhoneSameAsOwner}
            onChange={(event) => onChangeShopPhoneSameAsOwner(event.target.checked)}
            className="h-4 w-4 rounded border-[#c7d3e7] accent-[#111a30]"
          />
          인증한 휴대폰번호와 같아요
        </label>
        <input
          value={formatPhone(fields.shopPhone)}
          onChange={(event) => onChangeField("shopPhone", event.target.value)}
          placeholder="02-0000-0000 또는 010-0000-0000"
          inputMode="tel"
          autoComplete="tel"
          aria-label="매장 연락처"
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="매장 주소">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenAddress}
            aria-label="매장 주소 검색"
            className="h-[58px] min-w-0 flex-1 truncate rounded-[12px] border border-[#dbe5f6] bg-[#eaf1ff] px-4 text-left text-[15px] font-medium text-[#111827] transition hover:bg-[#eef4ff]"
          >
            <span className={fields.shopAddress ? "" : "text-[#a3b4d0]"}>
              {fields.shopAddress || "주소를 검색해 주세요"}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenAddress}
            className="h-[58px] shrink-0 rounded-[12px] border border-[#111a30] bg-white px-4 text-[14px] font-bold text-[#111a30] transition hover:bg-[#f1f5fb]"
          >
            주소 검색
          </button>
        </div>
      </Field>
      <input
        value={shopDetailAddress}
        onChange={(event) => onChangeShopDetailAddress(event.target.value)}
        placeholder="상세 주소를 입력해 주세요"
        autoComplete="street-address"
        aria-label="매장 상세 주소"
        className={INPUT_CLASS}
      />
      <Notice message={message} />
      <button type="button" onClick={onSubmit} disabled={loading} className={PRIMARY_BUTTON_CLASS}>
        {loading ? "가입 처리 중..." : "가입 완료"}
      </button>
    </SignupShell>
  );
}
