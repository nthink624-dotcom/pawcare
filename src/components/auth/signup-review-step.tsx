"use client";

import { CheckCircle2, ShieldCheck } from "lucide-react";

export default function SignupReviewStep({
  ownerName,
  email,
  shopName,
  shopPhone,
  shopAddress,
  loading,
  message,
  onBack,
  onSubmit,
}: {
  ownerName: string;
  email: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  loading: boolean;
  message: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f1f3f7] px-3 py-7 font-['Pretendard',-apple-system,BlinkMacSystemFont,sans-serif] text-[#172033] antialiased sm:px-6 sm:py-10">
      <div className="mx-auto max-w-[760px]">
        <div className="mb-5 grid grid-cols-4 gap-2 text-center text-[12px] font-medium leading-[18px]">
          {[
            "약관 동의",
            "계정 정보",
            "본인인증",
            "매장 정보",
          ].map((label) => (
            <span key={label} className="rounded-[10px] bg-[#e8f5ee] px-2 py-3 text-[#177856]">✓ {label}</span>
          ))}
        </div>

        <section className="rounded-[18px] border border-[#dce4ed] bg-white p-4 sm:p-7">
          <p className="text-[12px] font-medium leading-[18px] tracking-[0.02em] text-[#1d3557]">FINAL REVIEW</p>
          <h1 className="mt-2 text-[24px] font-semibold leading-8 tracking-[-0.02em] sm:text-[28px] sm:leading-9">가입 정보를 마지막으로 확인해 주세요</h1>
          <p className="mt-2 text-[16px] font-normal leading-6 text-[#607080]">
            가입이 끝나면 영업시간·직원 근무표·미용 요금표를 차례로 설정합니다.
          </p>

          <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
            <section className="min-w-0 rounded-[14px] border border-[#dce4ed] p-4" aria-labelledby="signup-review-account-title">
              <h2 id="signup-review-account-title" className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em]">개인정보·계정</h2>
              <dl className="mt-3 grid min-w-0 grid-cols-[68px_minmax(0,1fr)] gap-y-2 text-[14px] leading-5">
                <dt className="font-normal text-[#7a8798]">대표자</dt>
                <dd className="min-w-0 break-words font-medium">{ownerName}</dd>
                <dt className="font-normal text-[#7a8798]">이메일</dt>
                <dd className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{email}</dd>
              </dl>
            </section>

            <section className="min-w-0 rounded-[14px] border border-[#dce4ed] p-4" aria-labelledby="signup-review-shop-title">
              <h2 id="signup-review-shop-title" className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em]">매장 기본정보</h2>
              <dl className="mt-3 grid min-w-0 grid-cols-[68px_minmax(0,1fr)] gap-y-2 text-[14px] leading-5">
                <dt className="font-normal text-[#7a8798]">매장</dt>
                <dd className="min-w-0 break-words font-medium">{shopName}</dd>
                <dt className="font-normal text-[#7a8798]">연락처</dt>
                <dd className="min-w-0 break-words font-medium">{shopPhone}</dd>
                <dt className="font-normal text-[#7a8798]">주소</dt>
                <dd className="min-w-0 break-words font-medium">{shopAddress}</dd>
              </dl>
            </section>
          </div>

          <p className="mt-5 rounded-[10px] bg-[#edf7f2] px-4 py-3 text-[13px] font-normal leading-5 text-[#177856]">
            <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />
            확인 전에는 계정과 매장 정보가 영구 저장되지 않습니다.
          </p>
          {message ? <p role="alert" className="mt-3 rounded-[10px] bg-[#fff1ef] px-4 py-3 text-[13px] font-medium leading-5 text-[#a84435]">{message}</p> : null}
          <div className="mt-6 grid gap-3 sm:grid-cols-[0.42fr_1fr]">
            <button type="button" onClick={onBack} disabled={loading} className="min-h-12 rounded-[10px] border border-[#ccd6e2] text-[16px] font-medium leading-6 tracking-[-0.005em] text-[#526174] disabled:opacity-60">이전</button>
            <button type="button" onClick={onSubmit} disabled={loading} className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-[#17243c] text-[16px] font-medium leading-6 tracking-[-0.005em] text-white disabled:opacity-60">
              {loading ? "안전하게 저장 중" : "확인하고 가입 완료"}
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
