"use client";

import { Check, ChevronRight, ShieldCheck } from "lucide-react";
import { useState } from "react";

import PetManagerBrand from "@/components/brand/petmanager-brand";
import { DEFAULT_CAMPAIGN_CONSENT, PLATFORM_DELIVERY_ELIGIBILITY } from "@/lib/campaign-preview-contract";

const inputClass = "min-h-12 w-full rounded-xl border border-[#ccd8d2] bg-[#f8fbf9] px-4 text-[16px] text-[#334155] outline-none";

export default function SoloGroomingTrialPreview() {
  const [consent, setConsent] = useState(DEFAULT_CAMPAIGN_CONSENT);
  const toggle = (key: "accountAdvertisingUseOptIn" | "instagramAdDmReceiveOptIn" | "caseStudyUseOptIn") => setConsent((current) => ({ ...current, [key]: !current[key] }));

  return <main className="min-h-screen bg-[#f4f8f5] px-4 py-6 text-[#17221d] sm:px-8 lg:py-10">
    <div className="mx-auto max-w-[1180px]">
      <header className="flex items-center justify-between gap-4"><PetManagerBrand imageClassName="h-7" nameClassName="text-[18px] text-[#1f6b5b]" /><span className="rounded-full bg-[#fff3d9] px-3 py-2 text-[14px] font-bold text-[#9a6818]">정책 검토 중인 미리보기</span></header>
      <section className="grid gap-8 py-10 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:py-16">
        <div className="pt-3">
          <p className="text-[16px] font-bold text-[#1f6b5b]">1인 반려동물 미용샵 10곳</p>
          <h1 className="mt-4 text-[clamp(32px,5vw,58px)] font-black leading-[1.14] tracking-[-0.04em]">전화·문자·DM 예약,<br />오늘도 한곳에 다시 옮겨 적고 있나요?</h1>
          <p className="mt-6 max-w-2xl text-[clamp(18px,2vw,22px)] leading-[1.65] text-[#526159]">고객이 직접 입력한 예약과 보호자·반려동물 정보를 한곳에서 확인하세요.</p>
          <div className="mt-8 grid gap-3 text-[16px] leading-7">
            {["카드 등록 없는 14일 무료 체험", "기본 설정 지원", "사례 활용 선택 동의 시 추가 30일"].map((item) => <p key={item} className="flex gap-3"><Check className="mt-1 h-5 w-5 shrink-0 text-[#1f9d55]" />{item}</p>)}
          </div>
        </div>

        <section aria-labelledby="trial-form-title" className="rounded-3xl border border-[#d9e3dd] bg-white p-5 shadow-[0_18px_55px_rgba(31,107,91,.08)] sm:p-8">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[14px] font-bold text-[#1f6b5b]">신청 화면 Preview</p><h2 id="trial-form-title" className="mt-1 text-[clamp(24px,3vw,30px)] font-extrabold">14일 무료 체험</h2></div><ShieldCheck className="h-7 w-7 text-[#1f6b5b]" /></div>
          <div className="mt-6 grid gap-5">
            <PreviewField label="매장명" purpose="체험 대상 매장 확인" value="테스트 미용샵" />
            <PreviewField label="담당자" purpose="신청 의사 확인" value="테스트 담당자" />
            <PreviewField label="연락처" purpose="기본 설정 일정 안내" value="010-0000-0000" />
            <PreviewField label="Instagram 계정" purpose="선택한 Instagram 동의 범위 확인" value="@preview_only" />
          </div>
          <div className="mt-7 space-y-3 border-t border-[#e5ebe7] pt-6">
            <Consent checked={consent.accountAdvertisingUseOptIn} onChange={() => toggle("accountAdvertisingUseOptIn")} title="계정 광고 활용 동의" purpose="선택한 계정 정보를 광고 소재에 활용" />
            <Consent checked={consent.instagramAdDmReceiveOptIn} onChange={() => toggle("instagramAdDmReceiveOptIn")} title="Instagram 광고 DM 수신 동의" purpose="광고성 DM 수신 의사 기록 · 실제 발송 미연결" />
            <Consent checked={consent.caseStudyUseOptIn} onChange={() => toggle("caseStudyUseOptIn")} title="사례·후기 활용 동의" purpose="선택 범위만 편집·재승인 후 활용 · 언제든 철회 가능" detail="30일 무료 이용을 추가 제공받음" />
          </div>
          <div className="mt-5 rounded-xl bg-[#fff8e8] p-4 text-[14px] leading-6 text-[#805a18]">개인정보처리자·보유기간·수탁자·저장국가 검토 중 · 제출 및 외부 전송 불가</div>
          <button type="button" disabled className="mt-5 flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#9eaaa4] px-5 text-[16px] font-bold text-white" aria-describedby="preview-status">14일 무료 체험 신청하기<ChevronRight className="h-5 w-5" /></button>
          <p id="preview-status" className="mt-3 text-center text-[14px] font-semibold text-[#64748b]">정책 검토 중인 미리보기 · 실제 신청 저장 안 함</p>
          <output className="sr-only">동의 상태와 Instagram 발송 가능 상태는 분리됨: {PLATFORM_DELIVERY_ELIGIBILITY}</output>
        </section>
      </section>
    </div>
  </main>;
}

function PreviewField({ label, purpose, value }: { label: string; purpose: string; value: string }) {
  return <label className="block"><span className="flex flex-wrap items-baseline justify-between gap-2 text-[16px] font-bold">{label}<small className="text-[14px] font-medium text-[#718078]">목적: {purpose}</small></span><input className={`${inputClass} mt-2`} value={value} readOnly aria-label={`${label} 테스트 데이터`} /></label>;
}

function Consent({ checked, onChange, title, purpose, detail }: { checked: boolean; onChange: () => void; title: string; purpose: string; detail?: string }) {
  return <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-[#dce5e0] p-3"><input type="checkbox" checked={checked} onChange={onChange} className="mt-1 h-5 w-5 accent-[#1f6b5b]" /><span><strong className="block text-[16px]">{title}</strong><span className="mt-1 block text-[14px] leading-6 text-[#65736c]">목적: {purpose}</span>{detail ? <span className="mt-1 block text-[14px] font-bold text-[#1f6b5b]">{detail}</span> : null}</span></label>;
}

