"use client";

import Link from "next/link";

import type { SocialSignupAgreementState } from "@/lib/auth/social-signup-consent";

type RequiredAgreementId = "service" | "privacy";

const requiredTerms: Array<{
  id: RequiredAgreementId;
  label: string;
  href: string;
}> = [
  {
    id: "service",
    label: "서비스 이용약관",
    href: "/terms",
  },
  {
    id: "privacy",
    label: "개인정보 수집 및 이용",
    href: "/privacy-consent",
  },
];

export default function SocialSignupRequiredTerms({
  value,
  onChange,
}: {
  value: SocialSignupAgreementState;
  onChange: (value: SocialSignupAgreementState) => void;
}) {
  const allRequiredAgreed = value.service && value.privacy;

  const updateRequired = (id: RequiredAgreementId, checked: boolean) => {
    onChange({
      ...value,
      [id]: checked,
    });
  };

  return (
    <section className="mt-5 border-t border-[#e5e9f0] pt-5" aria-labelledby="social-required-terms-title">
      <div className="flex items-center justify-between gap-4">
        <h2 id="social-required-terms-title" className="text-[15px] font-semibold text-[#0f172a]">
          필수 약관 동의
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[#475569]">
          <input
            type="checkbox"
            checked={allRequiredAgreed}
            onChange={(event) =>
              onChange({
                ...value,
                service: event.target.checked,
                privacy: event.target.checked,
              })
            }
            className="h-4 w-4 rounded border-[#cbd5e1] accent-[#334155]"
          />
          모두 동의
        </label>
      </div>

      <div className="mt-3 divide-y divide-[#eef1f5] border-y border-[#eef1f5]">
        {requiredTerms.map((term) => (
          <div key={term.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
            <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={value[term.id]}
                onChange={(event) => updateRequired(term.id, event.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-[#cbd5e1] accent-[#334155]"
              />
              <span className="truncate text-[13.5px] font-medium text-[#334155]">
                <span className="text-[#64748b]">필수</span> {term.label}
              </span>
            </label>
            <Link
              href={term.href as never}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[12.5px] text-[#64748b] underline decoration-[#cbd5e1] underline-offset-4"
            >
              보기
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
