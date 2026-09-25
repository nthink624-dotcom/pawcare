"use client";

import { useState } from "react";

import SignupServicePricingStep from "@/components/auth/signup-service-pricing-step";
import type { SignupServicePrice } from "@/lib/auth/signup-service-pricing";

export default function SecureAiPriceGuidePreviewClient() {
  const [services, setServices] = useState<SignupServicePrice[]>([]);
  const [completed, setCompleted] = useState(false);

  if (completed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f1f3f7] p-6 text-[#172033]">
        <section className="w-full max-w-lg rounded-[28px] bg-white p-8 text-center shadow-[0_22px_60px_rgba(15,23,42,0.1)]">
          <p className="text-[12px] font-extrabold tracking-[0.12em] text-[#177856]">FIXTURE FLOW COMPLETE</p>
          <h1 className="mt-2 text-[25px] font-extrabold">확정된 구조화 요금 {services.length}개</h1>
          <p className="mt-3 text-[14px] leading-6 text-[#607080]">이미지나 AI 원시 응답이 아니라, 오너가 수정·확정한 행만 다음 가입 단계의 브라우저 상태로 전달됩니다.</p>
          <button type="button" onClick={() => setCompleted(false)} className="mt-6 h-12 w-full rounded-xl bg-[#17243c] text-[14px] font-bold text-white">요금표 화면으로 돌아가기</button>
        </section>
      </main>
    );
  }

  return (
    <div className="relative">
      <div className="fixed right-4 top-3 z-20 rounded-full bg-[#fff3d6] px-3 py-2 text-[11px] font-extrabold text-[#8a5b00] shadow-sm">Development fixture · 외부 Vision 호출 없음</div>
      <SignupServicePricingStep
        services={services}
        onChange={setServices}
        onBack={() => {}}
        onNext={() => setCompleted(true)}
        fixtureId="korean-price-guide-v1"
      />
    </div>
  );
}
