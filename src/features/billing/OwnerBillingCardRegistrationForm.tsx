"use client";

import { ArrowLeft, CreditCard } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { AppButton } from "@/components/ui/app-button";

export type OwnerBillingCardCredentials = {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  birthOrBusinessRegistrationNumber: string;
  passwordTwoDigits: string;
};

type InputRefs = {
  cardNumber: HTMLInputElement | null;
  expiryMonth: HTMLInputElement | null;
  expiryYear: HTMLInputElement | null;
  birthOrBusinessRegistrationNumber: HTMLInputElement | null;
  passwordTwoDigits: HTMLInputElement | null;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function OwnerBillingCardRegistrationForm({
  planLabel,
  amountLabel,
  loading = false,
  message,
  onBack,
  onSubmit,
}: {
  planLabel: string;
  amountLabel: string;
  loading?: boolean;
  message?: string | null;
  onBack: () => void;
  onSubmit: (credentials: OwnerBillingCardCredentials) => Promise<void>;
}) {
  const refs = useRef<InputRefs>({
    cardNumber: null,
    expiryMonth: null,
    expiryYear: null,
    birthOrBusinessRegistrationNumber: null,
    passwordTwoDigits: null,
  });
  const [agreed, setAgreed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const input of Object.values(refs.current)) {
        if (input) input.value = "";
      }
    };
  }, []);

  function readValue(name: keyof InputRefs) {
    return onlyDigits(refs.current[name]?.value ?? "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const credentials = {
      cardNumber: readValue("cardNumber"),
      expiryMonth: readValue("expiryMonth"),
      expiryYear: readValue("expiryYear"),
      birthOrBusinessRegistrationNumber: readValue("birthOrBusinessRegistrationNumber"),
      passwordTwoDigits: readValue("passwordTwoDigits"),
    };

    if (!/^\d{14,19}$/.test(credentials.cardNumber)) {
      setFormError("카드번호를 다시 확인해 주세요.");
      return;
    }
    if (!/^(0[1-9]|1[0-2])$/.test(credentials.expiryMonth) || !/^\d{2}$/.test(credentials.expiryYear)) {
      setFormError("카드 유효기간을 다시 확인해 주세요.");
      return;
    }
    if (!/^(\d{6}|\d{10})$/.test(credentials.birthOrBusinessRegistrationNumber)) {
      setFormError("생년월일 또는 사업자번호를 다시 확인해 주세요.");
      return;
    }
    if (!/^\d{2}$/.test(credentials.passwordTwoDigits)) {
      setFormError("카드 비밀번호 앞 두 자리를 입력해 주세요.");
      return;
    }
    if (!agreed) {
      setFormError("자동결제 카드 등록 동의가 필요합니다.");
      return;
    }

    setFormError(null);
    try {
      await onSubmit(credentials);
    } finally {
      for (const input of Object.values(refs.current)) {
        if (input) input.value = "";
      }
    }
  }

  return (
    <main className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#f8f6f2] px-5 pb-10 pt-6 text-[#111111]">
      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="inline-flex h-10 items-center gap-1.5 rounded-[8px] px-1 text-[14px] font-medium text-[#4e5f59] transition hover:bg-[#eef3f0] disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        이전 단계
      </button>

      <section className="mt-3 border border-[#dfd8cc] bg-[#fffdf8] px-5 py-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#edf6f2] text-[#1f6b5b]">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#396457]">정기결제</p>
            <h1 className="mt-1 text-[23px] font-semibold text-[#173b33]">카드 등록</h1>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 border-y border-[#e8e1d7] py-3.5">
          <span className="text-[13px] text-[#766f66]">선택 플랜</span>
          <span className="text-right text-[14px] font-semibold text-[#1d2925]">{planLabel} · {amountLabel}</span>
        </div>

        <p className="mt-4 border-l-[3px] border-[#1f6b5b] bg-[#f4f8f6] px-3 py-2.5 text-[12px] leading-5 text-[#51615b]">
          넘친Day 펫매니저는 넘친 Day가 운영합니다. 카드 명세서와 결제대행 과정에는 넘친 Day로 표시될 수 있습니다.
        </p>

        <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="grid gap-2">
            <span className="text-[13px] font-medium text-[#2d3935]">카드번호</span>
            <input
              ref={(element) => { refs.current.cardNumber = element; }}
              inputMode="numeric"
              autoComplete="cc-number"
              maxLength={23}
              placeholder="0000 0000 0000 0000"
              onInput={(event) => { event.currentTarget.value = onlyDigits(event.currentTarget.value).replace(/(\d{4})(?=\d)/g, "$1 "); }}
              className="h-12 rounded-[8px] border border-[#cfd8d3] bg-white px-3 text-[16px] text-[#17211e] outline-none transition focus:border-[#1f6b5b] focus:ring-2 focus:ring-[#dcedE6]"
              disabled={loading}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className="text-[13px] font-medium text-[#2d3935]">유효기간 월</span>
              <input
                ref={(element) => { refs.current.expiryMonth = element; }}
                inputMode="numeric"
                autoComplete="cc-exp-month"
                maxLength={2}
                placeholder="MM"
                onInput={(event) => { event.currentTarget.value = onlyDigits(event.currentTarget.value).slice(0, 2); }}
                className="h-12 rounded-[8px] border border-[#cfd8d3] bg-white px-3 text-[16px] text-[#17211e] outline-none transition focus:border-[#1f6b5b] focus:ring-2 focus:ring-[#dcedE6]"
                disabled={loading}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[13px] font-medium text-[#2d3935]">유효기간 년</span>
              <input
                ref={(element) => { refs.current.expiryYear = element; }}
                inputMode="numeric"
                autoComplete="cc-exp-year"
                maxLength={2}
                placeholder="YY"
                onInput={(event) => { event.currentTarget.value = onlyDigits(event.currentTarget.value).slice(0, 2); }}
                className="h-12 rounded-[8px] border border-[#cfd8d3] bg-white px-3 text-[16px] text-[#17211e] outline-none transition focus:border-[#1f6b5b] focus:ring-2 focus:ring-[#dcedE6]"
                disabled={loading}
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-[13px] font-medium text-[#2d3935]">생년월일 6자리 또는 사업자번호 10자리</span>
            <input
              ref={(element) => { refs.current.birthOrBusinessRegistrationNumber = element; }}
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              onInput={(event) => { event.currentTarget.value = onlyDigits(event.currentTarget.value).slice(0, 10); }}
              className="h-12 rounded-[8px] border border-[#cfd8d3] bg-white px-3 text-[16px] text-[#17211e] outline-none transition focus:border-[#1f6b5b] focus:ring-2 focus:ring-[#dcedE6]"
              disabled={loading}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-[13px] font-medium text-[#2d3935]">카드 비밀번호 앞 2자리</span>
            <input
              ref={(element) => { refs.current.passwordTwoDigits = element; }}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              onInput={(event) => { event.currentTarget.value = onlyDigits(event.currentTarget.value).slice(0, 2); }}
              className="h-12 rounded-[8px] border border-[#cfd8d3] bg-white px-3 text-[16px] text-[#17211e] outline-none transition focus:border-[#1f6b5b] focus:ring-2 focus:ring-[#dcedE6]"
              disabled={loading}
            />
          </label>

          <label className="flex cursor-pointer items-start gap-3 border border-[#dfe7e2] bg-[#f8fbf9] px-3 py-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              disabled={loading}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#9fb2aa] text-[#1f6b5b] focus:ring-[#b9d8cd]"
            />
            <span className="text-[12px] leading-5 text-[#51615b]">넘친Day 펫매니저의 자동결제 카드 등록 및 개인정보 처리에 동의합니다.</span>
          </label>

          {formError || message ? (
            <p className="border border-[#f0c5c1] bg-[#fff7f6] px-3 py-2.5 text-[13px] leading-5 text-[#ae3f37]">
              {formError ?? message}
            </p>
          ) : null}

          <AppButton fullWidth type="submit" disabled={loading} className="h-[54px] rounded-[8px] bg-[#1f6b5b] text-[15px] font-semibold text-white">
            {loading ? "카드 등록 중..." : "카드 등록 후 결제하기"}
          </AppButton>
        </form>
      </section>
    </main>
  );
}
