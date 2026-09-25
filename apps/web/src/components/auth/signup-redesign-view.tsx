"use client";

import Link from "next/link";
import type { Route } from "next";
import { Check, ChevronLeft } from "lucide-react";

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
  stage: SignupProfileStage | "complete";
  fields: SignupFields;
  agreements: AgreementState;
  shopDetailAddress: string;
  shopPhoneSameAsOwner: boolean;
  localPreview: boolean;
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
  onStart: () => void;
};

const NEUTRAL_INPUT_CLASS =
  "h-[58px] w-full rounded-[12px] border bg-white px-4 text-[16px] font-medium leading-6 tracking-[-0.005em] text-[#111827] outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-[#64748b] focus:bg-white focus:shadow-[0_0_0_3px_rgba(21,33,59,0.08)] disabled:cursor-not-allowed disabled:border-[#dbe2ea] disabled:bg-[#f8fafc] disabled:text-[#94a3b8] disabled:placeholder:text-[#94a3b8]";

function getNeutralInputClass(status?: FieldStatus) {
  return `${NEUTRAL_INPUT_CLASS} ${
    status?.tone === "error"
      ? "border-[#c2414f] focus:border-[#c2414f]"
      : "border-[#dbe2ea] focus:border-[#15213b]"
  }`;
}

const PRIMARY_BUTTON_CLASS =
  "mt-7 flex h-[62px] w-full items-center justify-center rounded-[14px] bg-[#111a30] px-4 text-[16px] font-medium leading-6 tracking-[-0.005em] text-white transition-[background-color,transform] hover:bg-[#17233d] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const CONFIRMATION_ROW_CLASS =
  "grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-start gap-4 py-3.5";
const CONFIRMATION_LABEL_CLASS =
  "text-[14px] font-medium leading-5 tracking-[-0.005em] text-[#64748b]";
const CONFIRMATION_VALUE_CLASS =
  "min-w-0 break-words text-right text-[16px] font-medium leading-6 text-[#15213b] tabular-nums [overflow-wrap:anywhere]";

const termLinkById: Record<OwnerSignupTermId, string> = {
  service: "/terms",
  privacy: "/privacy-consent",
  location: "/terms",
  marketing: "/marketing-consent",
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function maskEmail(value: string) {
  const [localPart, domain] = value.trim().split("@");
  if (!localPart || !domain) return "확인된 계정";

  const visibleLength = localPart.length > 1 ? Math.min(2, localPart.length - 1) : 0;
  const visibleLocalPart = localPart.slice(0, visibleLength);
  const maskedLocalPart = "*".repeat(Math.max(3, localPart.length - visibleLength));
  return `${visibleLocalPart}${maskedLocalPart}@${domain}`;
}

function SignupShell({
  title,
  onBack,
  children,
}: {
  title?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#f1f3f7] px-5 py-8 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#111827] antialiased sm:px-6 sm:py-12">
      <section className="w-full max-w-[448px] rounded-[32px] bg-white px-8 pb-11 pt-7 shadow-[0_24px_64px_rgba(15,23,42,0.1)]">
        {onBack ? (
          <div className="relative mb-8 flex min-h-11 items-center justify-center">
            <button
              type="button"
              onClick={onBack}
              className="absolute left-0 inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-[#7184a6] transition hover:bg-[#f1f5fb] hover:text-[#111a30]"
              aria-label="이전 단계"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
            </button>
            {title ? <h1 className="text-center text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[#101a31]">{title}</h1> : null}
          </div>
        ) : null}
        {children}
      </section>
    </main>
  );
}

function Field({
  label,
  labelTone = "default",
  status,
  children,
}: {
  label: string;
  labelTone?: "default" | "neutral";
  status?: FieldStatus;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p
        className={`mb-2 text-[14px] font-medium leading-5 tracking-[-0.005em] ${
          labelTone === "neutral" ? "text-[#334155]" : "text-[#7184a6]"
        }`}
      >
        {label}
      </p>
      {children}
      {status?.text ? (
        <span
          className={
            status.tone === "success"
              ? "mt-1.5 block text-[13px] font-medium leading-5 text-[#1f9d55]"
              : status.tone === "error"
                ? "mt-1.5 block text-[13px] font-medium leading-5 text-[#c2414f]"
                : "mt-1.5 block text-[13px] font-normal leading-5 text-[#7184a6]"
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
  localPreview,
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
  onStart,
}: SignupRedesignViewProps) {
  if (stage === "complete") {
    return (
      <main className="flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[#f1f3f7] px-5 py-8 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#111827] antialiased sm:px-6 sm:py-12">
        <section className="w-full max-w-[448px]">
          <header className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#edf7f2] text-[#1f9d55]" aria-hidden="true">
              <Check className="h-7 w-7" strokeWidth={2.2} />
            </div>
            <h1 className="mt-6 break-keep text-[28px] font-semibold leading-9 tracking-[-0.02em] text-[#15213b] [overflow-wrap:anywhere]">
              가입이 완료되었습니다
            </h1>
            <p className="mt-3 break-keep text-[16px] font-normal leading-6 text-[#64748b] [overflow-wrap:anywhere]">
              이제 펫매니저를 시작할 준비가 되었어요.
            </p>
          </header>

          <section className="mt-8 overflow-hidden rounded-[18px] border border-[#dbe2ea] bg-white" aria-labelledby="signup-confirmation-title">
            <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <h2 id="signup-confirmation-title" className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#15213b]">
                가입 확인서
              </h2>
              <span className="shrink-0 rounded-[10px] bg-[#edf7f2] px-3 py-1 text-[12px] font-medium leading-[18px] text-[#1f9d55]">
                완료
              </span>
            </div>
            <div className="h-px bg-[#dbe2ea]" />
            <dl className="divide-y divide-[#dbe2ea] px-5 sm:px-6">
              <div className={CONFIRMATION_ROW_CLASS}>
                <dt className={CONFIRMATION_LABEL_CLASS}>매장</dt>
                <dd className={CONFIRMATION_VALUE_CLASS}>
                  {fields.shopName}
                </dd>
              </div>
              <div className={CONFIRMATION_ROW_CLASS}>
                <dt className={CONFIRMATION_LABEL_CLASS}>계정</dt>
                <dd className={CONFIRMATION_VALUE_CLASS}>
                  {maskEmail(fields.email)}
                </dd>
              </div>
              <div className={CONFIRMATION_ROW_CLASS}>
                <dt className={CONFIRMATION_LABEL_CLASS}>가입 상태</dt>
                <dd className={CONFIRMATION_VALUE_CLASS}>
                  가입 완료
                </dd>
              </div>
              <div className={CONFIRMATION_ROW_CLASS}>
                <dt className={CONFIRMATION_LABEL_CLASS}>다음 단계</dt>
                <dd className={CONFIRMATION_VALUE_CLASS}>
                  영업시간 설정
                </dd>
              </div>
            </dl>
            <p className="border-t border-[#dbe2ea] px-5 py-4 text-[13px] font-normal leading-5 text-[#64748b] sm:px-6">
              영업시간부터 차례로 설정하면 바로 예약 관리를 시작할 수 있어요.
            </p>
          </section>

          {localPreview ? (
            <p className="mt-3 text-center text-[12px] font-normal leading-[18px] text-[#64748b]">
              PC 로컬 화면 테스트에서는 실제 계정이 생성되지 않습니다.
            </p>
          ) : null}

          <button type="button" onClick={onStart} disabled={loading} className={PRIMARY_BUTTON_CLASS}>
            펫매니저 시작하기
          </button>
        </section>
      </main>
    );
  }

  if (stage === "terms") {
    const requiredTerms = ownerSignupTerms.filter((term) => term.required);
    const optionalTerms = ownerSignupTerms.filter((term) => !term.required);
    const allRequiredTermsAgreed = requiredTerms.every((term) => agreements[term.id]);

    return (
      <SignupShell title="약관 동의" onBack={onBack}>
        <div className="overflow-hidden rounded-[14px] border border-[#e2eaf6]">
          <div className="border-b border-[#e2eaf6] bg-[#f7faff] px-4 py-1">
            <label htmlFor="all-terms" className="flex min-h-11 cursor-pointer items-center gap-3 text-[16px] font-medium leading-6 tracking-[-0.005em] text-[#111a30]">
              <input
                id="all-terms"
                type="checkbox"
                checked={allRequiredTermsAgreed}
                onChange={(event) => {
                  requiredTerms.forEach((term) => onChangeAgreement(term.id, event.target.checked));
                }}
                className="h-4 w-4 shrink-0 rounded border-[#c7d3e7] accent-[#111a30]"
              />
              <span>필수 약관 전체 동의</span>
            </label>
          </div>
          {requiredTerms.map((term) => (
            <div key={term.id} className="flex min-h-11 items-stretch gap-1 border-b border-[#edf2fa] px-4 last:border-b-0">
              <label htmlFor={term.id} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 py-1 break-keep text-[14px] font-normal leading-5 text-[#334155] [overflow-wrap:anywhere]">
                <input
                  id={term.id}
                  type="checkbox"
                  checked={agreements[term.id]}
                  onChange={(event) => onChangeAgreement(term.id, event.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-[#c7d3e7] accent-[#111a30]"
                />
                <span className="min-w-0">
                  [필수] {term.title}
                </span>
              </label>
              <Link
                href={termLinkById[term.id] as never}
                aria-label={`${term.title} 보기`}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center self-center rounded-[8px] text-[13px] font-medium leading-5 text-[#64748b] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                보기
              </Link>
            </div>
          ))}
        </div>
        <div className="rounded-[14px] border border-[#e2eaf6] bg-white px-4 py-3">
          {optionalTerms.map((term) => (
            <div key={term.id}>
              <div className="flex min-h-11 items-stretch gap-1">
                <label htmlFor={term.id} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 break-keep text-[14px] font-normal leading-5 text-[#334155]">
                  <input
                    id={term.id}
                    type="checkbox"
                    checked={agreements[term.id]}
                    onChange={(event) => onChangeAgreement(term.id, event.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-[#c7d3e7] accent-[#111a30]"
                  />
                  <span>[선택] {term.title}</span>
                </label>
                <Link
                  href={termLinkById[term.id] as never}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${term.title} 보기 (새 창)`}
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[8px] text-[13px] font-medium leading-5 text-[#64748b] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                >
                  보기
                </Link>
              </div>
              {term.id === "marketing" ? (
                <div className="border-t border-[#edf2fa] pt-3 text-[13px] font-normal leading-5 text-[#475569]">
                  <p>마케팅 수신 동의 시 30일 추가 · 미동의해도 가입과 기본 14일 체험은 동일합니다.</p>
                  <Link
                    href={"/marketing-benefit-terms" as Route}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex min-h-11 items-center font-medium text-[#335a50] underline underline-offset-2"
                  >
                    30일 추가 체험 조건 보기
                  </Link>
                </div>
              ) : null}
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
      <SignupShell title="계정 정보" onBack={onBack}>
        <Field label="이메일" labelTone="neutral" status={emailStatus}>
          <input
            type="email"
            value={fields.email}
            onChange={(event) => onChangeField("email", event.target.value)}
            placeholder="이메일을 입력해 주세요"
            autoComplete="email"
            aria-label="이메일"
            className={getNeutralInputClass(emailStatus)}
          />
        </Field>
        <Field label="비밀번호" labelTone="neutral" status={passwordStatus}>
          <input
            type="password"
            value={fields.password}
            onChange={(event) => onChangeField("password", event.target.value)}
            placeholder="비밀번호를 입력해 주세요"
            autoComplete="new-password"
            aria-label="비밀번호"
            className={getNeutralInputClass(passwordStatus)}
          />
        </Field>
        <Field label="비밀번호 확인" labelTone="neutral" status={passwordConfirmStatus}>
          <input
            type="password"
            value={fields.passwordConfirm}
            onChange={(event) => onChangeField("passwordConfirm", event.target.value)}
            placeholder="비밀번호를 다시 입력해 주세요"
            autoComplete="new-password"
            aria-label="비밀번호 확인"
            className={getNeutralInputClass(passwordConfirmStatus)}
          />
        </Field>
        <Notice message={message} />
        <button type="button" onClick={onNextAccount} disabled={loading} className={PRIMARY_BUTTON_CLASS}>
          휴대폰으로 본인 인증하기
        </button>
      </SignupShell>
    );
  }

  return (
    <SignupShell title="매장 정보" onBack={onBack}>
      <Field label="매장명" labelTone="neutral">
        <input
          value={fields.shopName}
          onChange={(event) => onChangeField("shopName", event.target.value)}
          placeholder="매장명을 입력해 주세요"
          autoComplete="organization"
          aria-label="매장명"
          className={getNeutralInputClass()}
        />
      </Field>
      <Field label="매장 연락처" labelTone="neutral">
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-[13px] font-normal leading-5 text-[#64748b]">
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
          className={getNeutralInputClass()}
        />
      </Field>
      <Field label="매장 주소" labelTone="neutral">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenAddress}
            aria-label="매장 주소 검색"
            className="h-[58px] min-w-0 flex-1 truncate rounded-[12px] border border-[#dbe2ea] bg-white px-4 text-left text-[16px] font-medium leading-6 tracking-[-0.005em] text-[#111827] outline-none transition-[border-color,box-shadow,background-color] hover:bg-[#f8fafc] focus:border-[#15213b] focus:bg-white focus:shadow-[0_0_0_3px_rgba(21,33,59,0.08)]"
          >
            <span className={fields.shopAddress ? "" : "text-[#64748b]"}>
              {fields.shopAddress || "주소를 검색해 주세요"}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenAddress}
            className="h-[58px] shrink-0 rounded-[12px] border border-[#111a30] bg-white px-4 text-[14px] font-medium leading-5 tracking-[-0.005em] text-[#111a30] transition hover:bg-[#f1f5fb]"
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
        className={getNeutralInputClass()}
      />
      <Notice message={message} />
      <button type="button" onClick={onSubmit} disabled={loading} className={PRIMARY_BUTTON_CLASS}>
        가입 완료하기
      </button>
    </SignupShell>
  );
}
