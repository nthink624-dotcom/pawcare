"use client";

import { Check, ChevronLeft, ChevronRight, Smartphone } from "lucide-react";

import { cn } from "@/lib/ui-system";

export type SignupProfileStage = "account" | "verification" | "verified" | "shop";

type SignupFields = {
  name: string;
  phoneNumber: string;
  loginId: string;
  password: string;
  passwordConfirm: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
};

type FieldStatus = {
  text?: string;
  tone?: "default" | "success" | "error";
};

type SignupRedesignViewProps = {
  stage: SignupProfileStage;
  fields: SignupFields;
  shopDetailAddress: string;
  shopPhoneSameAsOwner: boolean;
  loading: boolean;
  message: string | null;
  loginIdStatus?: FieldStatus;
  passwordStatus?: FieldStatus;
  passwordConfirmStatus?: FieldStatus;
  onBack: () => void;
  onChangeField: (key: keyof SignupFields, value: string) => void;
  onChangeShopDetailAddress: (value: string) => void;
  onChangeShopPhoneSameAsOwner: (checked: boolean) => void;
  onNextAccount: () => void;
  onStartVerification: () => void;
  onContinueToShop: () => void;
  onOpenAddress: () => void;
  onSubmit: () => void;
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function formatShopPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.startsWith("02")) {
    if (digits.length < 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return formatPhone(digits);
}

function SignupShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="owner-font mx-auto w-full max-w-[390px] overflow-hidden bg-white px-7 pb-10 pt-6 text-[#0f172a] sm:rounded-[28px] sm:shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
      <div className="mb-[22px] flex items-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="이전 단계로 이동"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#e5e9f0] bg-white text-[#0f172a] transition hover:bg-[#f8fafc]"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
        </button>
        <h1 className="flex-1 text-center text-[16px] font-bold text-[#0f172a]">{title}</h1>
        <span className="h-9 w-9 shrink-0" aria-hidden="true" />
      </div>
      {children}
    </main>
  );
}

function FieldMessage({ status }: { status?: FieldStatus }) {
  if (!status?.text) return null;

  return (
    <p
      className={cn(
        "mt-1.5 text-[11.5px] leading-[1.45]",
        status.tone === "success"
          ? "text-[#1f9d55]"
          : status.tone === "error"
            ? "text-[#a04455]"
            : "text-[#64748b]",
      )}
    >
      {status.text}
    </p>
  );
}

function Field({
  label,
  children,
  status,
}: {
  label?: string;
  children: React.ReactNode;
  status?: FieldStatus;
}) {
  return (
    <div className="mb-[14px]">
      {label ? <label className="mb-1.5 block text-[12.5px] font-semibold text-[#64748b]">{label}</label> : null}
      {children}
      <FieldMessage status={status} />
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  ariaLabel?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      aria-label={ariaLabel}
      className="h-12 w-full rounded-[11px] border border-[#e5e9f0] bg-[#f8fafc] px-[14px] text-[13.5px] text-[#0f172a] outline-none transition placeholder:text-[#b0b8c4] focus:border-[#0f172a] focus:bg-white"
    />
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-[26px] flex h-[52px] w-full items-center justify-center gap-1.5 rounded-[13px] border-0 bg-[#334155] text-[14.5px] font-semibold text-white transition hover:bg-[#293548] disabled:cursor-wait disabled:opacity-60"
    >
      {children}
      {!disabled ? <ChevronRight className="h-[15px] w-[15px]" strokeWidth={2.2} /> : null}
    </button>
  );
}

function VerificationCard({ complete = false }: { complete?: boolean }) {
  return (
    <div className={cn("rounded-[16px] border border-[#eef1f5] px-5 py-7 text-center", complete ? "mt-10" : "mt-2")}>
      <div
        className={cn(
          "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[16px]",
          complete ? "bg-[#e7f9ef] text-[#03963f]" : "bg-[#f1f5f9] text-[#334155]",
        )}
      >
        {complete ? (
          <Check className="h-7 w-7" strokeWidth={2.2} />
        ) : (
          <Smartphone className="h-[26px] w-[26px]" strokeWidth={1.8} />
        )}
      </div>
      <h2 className="mb-1.5 text-[15px] font-extrabold text-[#0f172a]">
        {complete ? "본인인증이 완료되었어요" : "휴대폰 본인인증"}
      </h2>
      <p className="text-[12.5px] leading-[1.5] text-[#94a3b8]">
        {complete ? (
          <>
            이름과 휴대폰번호를 확인했어요.
            <br />
            매장 정보만 입력하면 가입이 끝나요.
          </>
        ) : (
          "통신사 인증으로 10초 만에 완료돼요"
        )}
      </p>
    </div>
  );
}

function ChipField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2.5 flex h-[50px] items-center justify-between rounded-[12px] border border-[#eef1f5] bg-[#f8fafc] px-[14px]">
      <span className="mr-2.5 shrink-0 text-[12px] font-semibold text-[#94a3b8]">{label}</span>
      <span className="whitespace-nowrap text-[13.5px] font-semibold text-[#0f172a]">{value}</span>
    </div>
  );
}

export default function SignupRedesignView({
  stage,
  fields,
  shopDetailAddress,
  shopPhoneSameAsOwner,
  loading,
  message,
  loginIdStatus,
  passwordStatus,
  passwordConfirmStatus,
  onBack,
  onChangeField,
  onChangeShopDetailAddress,
  onChangeShopPhoneSameAsOwner,
  onNextAccount,
  onStartVerification,
  onContinueToShop,
  onOpenAddress,
  onSubmit,
}: SignupRedesignViewProps) {
  if (stage === "account") {
    return (
      <SignupShell title="회원가입" onBack={onBack}>
        <p className="mb-[26px] text-[13px] leading-[1.55] text-[#64748b]">
          로그인에 사용할 아이디와 비밀번호를 입력해 주세요.
        </p>
        <h2 className="mb-[14px] text-[15px] font-extrabold text-[#0f172a]">계정 정보</h2>

        <Field label="아이디" status={loginIdStatus}>
          <TextInput
            value={fields.loginId}
            onChange={(value) => onChangeField("loginId", value)}
            placeholder="아이디를 입력해 주세요"
          />
        </Field>
        <Field label="비밀번호" status={passwordStatus}>
          <TextInput
            type="password"
            value={fields.password}
            onChange={(value) => onChangeField("password", value)}
            placeholder="비밀번호를 입력해 주세요"
          />
        </Field>
        <Field label="비밀번호 확인" status={passwordConfirmStatus}>
          <TextInput
            type="password"
            value={fields.passwordConfirm}
            onChange={(value) => onChangeField("passwordConfirm", value)}
            placeholder="비밀번호를 한번 더 입력해 주세요"
          />
        </Field>

        {message ? <p className="text-[12px] font-medium leading-5 text-[#a04455]">{message}</p> : null}
        <PrimaryButton onClick={onNextAccount} disabled={loading}>
          다음
        </PrimaryButton>
      </SignupShell>
    );
  }

  if (stage === "verification") {
    return (
      <SignupShell title="본인인증" onBack={onBack}>
        <p className="mb-[26px] text-[13px] leading-[1.55] text-[#64748b]">
          휴대폰 본인인증으로 이름과 번호를
          <br />
          자동으로 입력할게요. 다시 입력할 필요 없어요.
        </p>
        <VerificationCard />
        {message ? <p className="mt-3 text-[12px] font-medium leading-5 text-[#a04455]">{message}</p> : null}
        <PrimaryButton onClick={onStartVerification} disabled={loading}>
          {loading ? "본인인증 연결 중..." : "본인인증 시작하기"}
        </PrimaryButton>
      </SignupShell>
    );
  }

  if (stage === "verified") {
    return (
      <SignupShell title="본인인증" onBack={onBack}>
        <VerificationCard complete />
        <div className="mt-6">
          <ChipField label="이름" value={fields.name} />
          <ChipField label="휴대폰번호" value={formatPhone(fields.phoneNumber)} />
        </div>
        {message ? <p className="mt-3 text-[12px] font-medium leading-5 text-[#1f9d55]">{message}</p> : null}
        <PrimaryButton onClick={onContinueToShop}>매장 정보 입력하기</PrimaryButton>
      </SignupShell>
    );
  }

  return (
    <SignupShell title="매장 정보" onBack={onBack}>
      <h2 className="mb-[14px] text-[15px] font-extrabold text-[#0f172a]">매장 정보</h2>

      <Field label="매장명">
        <TextInput
          value={fields.shopName}
          onChange={(value) => onChangeField("shopName", value)}
          placeholder="매장 이름을 입력해 주세요"
        />
      </Field>

      <Field>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[12.5px] font-semibold text-[#64748b]">매장 연락처</label>
          <label className="flex items-center gap-1.5 text-[12px] font-medium text-[#64748b]">
            <input
              type="checkbox"
              checked={shopPhoneSameAsOwner}
              onChange={(event) => onChangeShopPhoneSameAsOwner(event.target.checked)}
              className="h-3.5 w-3.5 accent-[#0f172a]"
            />
            휴대폰 번호와 같습니다.
          </label>
        </div>
        <TextInput
          value={formatShopPhone(fields.shopPhone)}
          onChange={(value) => onChangeField("shopPhone", value)}
          placeholder="02-0000-0000"
          inputMode="numeric"
        />
      </Field>

      <Field label="매장 주소">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenAddress}
            className="h-12 min-w-0 flex-1 truncate rounded-[11px] border border-[#e5e9f0] bg-[#f8fafc] px-[14px] text-left text-[13.5px] outline-none transition hover:bg-white focus:border-[#0f172a]"
          >
            <span className={fields.shopAddress ? "text-[#0f172a]" : "text-[#b0b8c4]"}>
              {fields.shopAddress || "매장 주소를 입력해 주세요"}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenAddress}
            className="h-12 shrink-0 rounded-[11px] border border-[#0f172a] bg-white px-4 text-[12.5px] font-bold text-[#0f172a] transition hover:bg-[#f8fafc]"
          >
            주소 검색
          </button>
        </div>
      </Field>

      <TextInput
        value={shopDetailAddress}
        onChange={onChangeShopDetailAddress}
        placeholder="상세 주소를 입력해 주세요"
        ariaLabel="상세 주소"
      />

      {message ? <p className="mt-3 text-[12px] font-medium leading-5 text-[#a04455]">{message}</p> : null}
      <PrimaryButton onClick={onSubmit} disabled={loading}>
        {loading ? "가입 처리 중..." : "무료체험 시작하기"}
      </PrimaryButton>
    </SignupShell>
  );
}
