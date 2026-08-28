"use client";

import { CheckCircle2, ShieldCheck } from "lucide-react";

import type { SignupServicePrice } from "@/lib/auth/signup-service-pricing";

export default function SignupReviewStep({
  services,
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
  services: SignupServicePrice[];
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
    <main className="min-h-screen bg-[#f1f3f7] px-4 py-7 text-[#172033] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-[820px]">
        <div className="mb-5 grid grid-cols-3 gap-2 text-center text-[12px] font-bold">
          <span className="rounded-xl bg-[#e8f5ee] px-2 py-3 text-[#177856]">✓ 서비스 요금</span>
          <span className="rounded-xl bg-[#e8f5ee] px-2 py-3 text-[#177856]">✓ 가입 정보</span>
          <span className="rounded-xl bg-[#17243c] px-2 py-3 text-white">03 최종 확인</span>
        </div>
        <section className="rounded-[28px] bg-white p-5 shadow-[0_22px_60px_rgba(15,23,42,0.1)] sm:p-8">
          <p className="text-[12px] font-extrabold tracking-[0.12em] text-[#1d3557]">FINAL REVIEW</p>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.045em]">마지막으로 한 번만 확인해 주세요</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#607080]">확인 버튼을 누를 때 계정·매장·서비스 요금을 서버에서 다시 검증하고 한 번에 저장합니다.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#dce4ed] p-5">
              <strong className="text-[14px]">서비스·상세 요금 {services.length}개</strong>
              <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                {services.map((service) => (
                  <div key={service.id} className="rounded-xl bg-[#f5f7fa] px-3 py-2.5 text-[12px]">
                    <div className="flex items-center justify-between gap-2"><b>{service.name}{service.detailName ? ` · ${service.detailName}` : ""}</b><span>{service.price.toLocaleString()}원 · {service.durationMinutes}분</span></div>
                    <p className="mt-1 text-[#718096]">{service.species === "dog" ? "강아지" : service.species === "cat" ? "고양이" : "공통"} · {service.breedGroup || "품종 기준 없음"} · {service.weightBand || "체중 기준 없음"}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-[#dce4ed] p-5">
              <strong className="text-[14px]">개인정보·계정</strong>
              <dl className="mt-3 grid grid-cols-[76px_1fr] gap-y-2 text-[13px]"><dt className="text-[#7a8798]">대표자</dt><dd className="font-semibold">{ownerName}</dd><dt className="text-[#7a8798]">이메일</dt><dd className="break-all font-semibold">{email}</dd><dt className="text-[#7a8798]">매장</dt><dd className="font-semibold">{shopName}</dd><dt className="text-[#7a8798]">연락처</dt><dd className="font-semibold">{shopPhone}</dd><dt className="text-[#7a8798]">주소</dt><dd className="font-semibold">{shopAddress}</dd></dl>
            </div>
          </div>
          <p className="mt-5 rounded-2xl bg-[#edf7f2] px-4 py-3 text-[13px] font-semibold text-[#177856]"><ShieldCheck className="mr-1 inline h-4 w-4" />최종 확인 전: 요금표 원본 저장 0건 · 서비스/계정 영구 저장 0건</p>
          {message ? <p className="mt-3 rounded-xl bg-[#fff1ef] px-4 py-3 text-[13px] font-semibold text-[#a84435]">{message}</p> : null}
          <div className="mt-6 grid grid-cols-[0.42fr_1fr] gap-3"><button type="button" onClick={onBack} disabled={loading} className="h-12 rounded-xl border border-[#ccd6e2] text-[13px] font-bold text-[#526174]">이전</button><button type="button" onClick={onSubmit} disabled={loading} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#17243c] text-[14px] font-bold text-white disabled:opacity-60">{loading ? "안전하게 저장 중" : "확인하고 가입 완료"}<CheckCircle2 className="h-4 w-4" /></button></div>
        </section>
      </div>
    </main>
  );
}
