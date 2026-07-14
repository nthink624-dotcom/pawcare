"use client";

import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Database,
  Link2,
  Monitor,
  Phone,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import LegalLinksFooter from "@/components/legal/legal-links-footer";
import { billableOwnerPlans } from "@/lib/billing/owner-plans";

const MINIMUM_WAGE_2026 = 10320;
const MONTHLY_SAVED_HOURS = 15;
const MONTHLY_SAVED_WON = MINIMUM_WAGE_2026 * MONTHLY_SAVED_HOURS;

const productScreens = [
  {
    title: "오너 PC 예약관리",
    body: "담당자별 오늘 예약, 상태, 상세 패널을 실제 업무 화면에서 바로 확인합니다.",
    src: "/images/landing/actual-schedule.png",
    icon: Monitor,
  },
  {
    title: "월간 캘린더",
    body: "확정, 취소, 완료 기록과 선택 날짜의 상세 예약을 한 화면에서 봅니다.",
    src: "/images/landing/actual-calendar.png",
    icon: CalendarCheck,
  },
  {
    title: "고객 관리",
    body: "보호자명, 연락처, 반려동물, 다음 예약 정보가 고객 목록에 정리됩니다.",
    src: "/images/landing/actual-customers.png",
    icon: Database,
  },
  {
    title: "예약 링크 관리",
    body: "고객이 들어오는 예약 링크와 외부 채널 연결을 오너가 관리합니다.",
    src: "/images/landing/actual-booking-link.png",
    icon: Link2,
  },
] as const;

const customerScreens = [
  {
    title: "고객 첫 화면",
    body: "고객은 앱 설치 없이 매장 예약 페이지에서 간편예약을 시작합니다.",
    src: "/images/landing/actual-customer-entry.png",
  },
  {
    title: "예약자 정보 입력",
    body: "고객이 입력한 보호자와 반려동물 정보가 오너 고객정보로 이어집니다.",
    src: "/images/landing/actual-customer-booking.png",
  },
] as const;

const sellingPoints = [
  "보호자명, 연락처, 반려동물 정보가 예약 흐름에서 자연스럽게 수집됩니다.",
  "오너가 다시 옮겨 적는 시간을 줄이고 고객관리 화면에서 바로 활용합니다.",
  "알림톡 사용량과 예약 상태를 함께 보면서 운영 누락을 줄입니다.",
] as const;

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LandingPage() {
  return (
    <main className="owner-font min-h-screen bg-[#f6f8fb] text-[#111827]">
      <Header />
      <Hero />
      <ActualScreensSection />
      <SavingsSection />
      <CustomerFlowSection />
      <OwnerValueSection />
      <PricingSection />
      <FinalCta />
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-10 pt-2">
        <LegalLinksFooter />
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e2e8f0] bg-white/92 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-5">
        <Link href="/landing" className="flex items-center gap-3">
          <Image src="/icons/logo/넘친 Day.svg" alt="넘친 day" width={132} height={36} priority />
        </Link>
        <nav className="hidden items-center gap-7 text-[14px] font-semibold text-[#64748b] md:flex">
          <button type="button" onClick={() => scrollToSection("screens")} className="hover:text-[#111827]">
            실제 화면
          </button>
          <button type="button" onClick={() => scrollToSection("savings")} className="hover:text-[#111827]">
            절약 효과
          </button>
          <button type="button" onClick={() => scrollToSection("pricing")} className="hover:text-[#111827]">
            요금제
          </button>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login?next=%2Fowner" className="hidden h-10 items-center px-3 text-[14px] font-semibold text-[#64748b] hover:text-[#111827] md:inline-flex">
            로그인
          </Link>
          <Link href="/signup" className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[#2563eb] px-4 text-[14px] font-bold text-white">
            무료로 시작
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-[1180px] items-center gap-9 px-5 pb-14 pt-12 lg:grid-cols-[0.84fr_1.16fr] lg:pb-18 lg:pt-16">
      <div>
        <p className="inline-flex rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-4 py-2 text-[14px] font-black text-[#1d4ed8]">
          실제 제품 화면으로 설명하는 예약관리
        </p>
        <h1 className="mt-6 text-[40px] font-black leading-[1.08] tracking-normal md:text-[62px]">
          반려동물 미용샵 운영,
          <br />
          하루 30분씩 줄이세요
        </h1>
        <p className="mt-5 max-w-[620px] text-[18px] leading-8 text-[#526071]">
          고객 예약, 보호자 정보, 반려동물 정보, 알림톡, 캘린더를 실제 오너 화면에서 한 흐름으로 관리합니다.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className="inline-flex h-14 items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] px-7 text-[17px] font-black text-white shadow-[0_18px_42px_rgba(37,99,235,0.22)]">
            무료로 시작하기
            <ArrowRight size={18} />
          </Link>
          <button type="button" onClick={() => scrollToSection("screens")} className="inline-flex h-14 items-center justify-center rounded-[8px] border border-[#d7e0ec] bg-white px-7 text-[17px] font-bold text-[#111827]">
            실제 화면 보기
          </button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Metric label="하루 절약" value="30분" />
          <Metric label="월 절약 시간" value="15시간" />
          <Metric label="월 환산 금액" value={formatWon(MONTHLY_SAVED_WON)} />
        </div>
      </div>
      <ActualImageFrame
        title="오너 예약관리 실제 화면"
        src="/images/landing/actual-schedule.png"
        priority
      />
    </section>
  );
}

function ActualScreensSection() {
  return (
    <section id="screens" className="mx-auto w-full max-w-[1180px] px-5 py-14">
      <SectionTitle
        eyebrow="실제 제품 화면 캡처"
        title="랜딩에서 보여주는 화면과 제품 화면이 같습니다"
        body="아래 이미지는 `/demo/owner-web`에서 직접 캡처한 실제 PC 오너 화면입니다. 즉석으로 그린 예시 화면이 아니라 지금 만들어진 제품 화면을 그대로 사용했습니다."
      />
      <div className="mt-8 grid gap-5">
        {productScreens.map(({ title, body, src, icon: Icon }) => (
          <ScreenCard key={title} title={title} body={body} src={src} icon={<Icon size={18} />} />
        ))}
      </div>
    </section>
  );
}

function SavingsSection() {
  return (
    <section id="savings" className="bg-white py-16">
      <div className="mx-auto grid w-full max-w-[1180px] gap-8 px-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-[15px] font-black text-[#2563eb]">광고 핵심 메시지</p>
          <h2 className="mt-3 text-[36px] font-black leading-tight tracking-normal md:text-[52px]">
            하루 30분만 줄여도
            <br />
            월 {formatWon(MONTHLY_SAVED_WON)} 상당
          </h2>
          <p className="mt-5 text-[17px] leading-8 text-[#526071]">
            2026년 최저시급 {MINIMUM_WAGE_2026.toLocaleString("ko-KR")}원 기준으로 하루 30분, 30일이면 월 15시간입니다. 반복 입력과 반복 안내를 줄이는 효과를 숫자로 설명합니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SavingsTile label="하루 절약" value="30분" tone="blue" />
          <SavingsTile label="월 절약 시간" value="15시간" tone="green" />
          <SavingsTile label="월 환산 금액" value={formatWon(MONTHLY_SAVED_WON)} tone="amber" />
        </div>
      </div>
    </section>
  );
}

function CustomerFlowSection() {
  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 py-14">
      <SectionTitle
        eyebrow="고객이 보는 실제 화면"
        title="고객이 입력한 정보가 오너 고객정보로 이어집니다"
        body="고객 예약 화면도 실제 라우트에서 캡처했습니다. 광고에서는 이 흐름을 보여주면서 개인정보 자동 수집의 가치를 설명하면 됩니다."
      />
      <div className="mt-8 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          {customerScreens.map((screen) => (
            <PhoneScreenCard key={screen.title} {...screen} />
          ))}
        </div>
        <div className="rounded-[8px] border border-[#dce5f2] bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
          <h3 className="text-[28px] font-black tracking-normal">예약 접수와 고객관리 사이의 반복 입력을 줄입니다</h3>
          <p className="mt-3 text-[16px] leading-8 text-[#526071]">
            고객이 예약할 때 보호자명, 연락처, 반려동물 정보를 직접 남기기 때문에 오너가 상담 후 다시 고객정보로 옮겨 적는 흐름을 줄일 수 있습니다.
          </p>
          <div className="mt-6 grid gap-3">
            {sellingPoints.map((point) => (
              <div key={point} className="flex gap-3 rounded-[8px] border border-[#e2e8f0] bg-[#fbfdff] p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" />
                <p className="text-[15px] font-bold leading-7 text-[#334155]">{point}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <ActualImageFrame title="고객관리 실제 화면" src="/images/landing/actual-customers.png" />
          </div>
        </div>
      </div>
    </section>
  );
}

function OwnerValueSection() {
  return (
    <section className="bg-[#0f172a] py-16 text-white">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionTitle
          eyebrow="오너 화면에서 확인되는 가치"
          title="예약, 고객, 알림톡을 실제 화면 기준으로 설명합니다"
          body="광고 문구와 화면이 따로 놀지 않도록 실제 캡처를 중심으로 기능 설명을 붙였습니다."
          dark
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <DarkPoint icon={<CalendarCheck size={20} />} title="예약관리" body="담당자별 예약과 상태를 일정판에서 확인합니다." />
          <DarkPoint icon={<Database size={20} />} title="고객DB" body="예약자가 남긴 보호자와 반려동물 정보가 고객관리 화면에 정리됩니다." />
          <DarkPoint icon={<Bell size={20} />} title="알림톡" body="사용량과 발송 상태를 확인하며 추가 충전 안내로 이어집니다." />
        </div>
        <div className="mt-6">
          <ActualImageFrame title="알림 설정 실제 화면" src="/images/landing/actual-notifications.png" dark priority />
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="mx-auto w-full max-w-[1180px] px-5 py-16">
      <SectionTitle
        eyebrow="요금제"
        title="매장 운영 인원에 맞춰 선택하세요"
        body="광고에서 실제 화면을 확인한 뒤, 오너가 자신의 매장 규모에 맞는 플랜으로 바로 이어질 수 있게 구성했습니다."
      />
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {billableOwnerPlans.map((plan) => (
          <article
            key={plan.code}
            itemScope
            itemType="https://schema.org/Product"
            className={`rounded-[8px] border bg-white p-6 ${plan.featured ? "border-[#2563eb] shadow-[0_18px_46px_rgba(37,99,235,0.14)]" : "border-[#dce5f2]"}`}
          >
            <meta itemProp="category" content="반려동물 미용샵 운영 SaaS" />
            <div className="flex items-center justify-between gap-3">
              <h3 itemProp="name" className="text-[25px] font-black">{plan.title}</h3>
              {plan.badge ? <span className="rounded-full bg-[#2563eb] px-3 py-1 text-[13px] font-black text-white">{plan.badge}</span> : null}
            </div>
            <p itemProp="description" className="mt-2 text-[14px] font-semibold text-[#64748b]">{plan.targetLabel}</p>
            <div itemProp="offers" itemScope itemType="https://schema.org/Offer">
              <meta itemProp="priceCurrency" content="KRW" />
              <meta itemProp="price" content={String(plan.monthlyPrice)} />
              <meta itemProp="availability" content="https://schema.org/InStock" />
              <p className="mt-6 text-[42px] font-black tracking-normal">
                {formatWon(plan.monthlyPrice)}
                <span className="text-[15px] font-bold text-[#64748b]"> / 월 정기결제</span>
              </p>
            </div>
            <PlanLine label="포함 알림톡" value={plan.alimtalkIncludedLabel} />
            <PlanLine label="운영 기준" value={plan.staffLimitLabel} />
            <Link href="/signup" className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-[8px] text-[16px] font-black ${plan.featured ? "bg-[#2563eb] text-white" : "border border-[#d7e0ec] bg-white text-[#111827]"}`}>
              시작하기
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 pb-16">
      <div className="rounded-[8px] bg-[#111827] p-7 text-white md:p-10">
        <p className="text-[15px] font-black text-[#93c5fd]">실제 화면을 보고 시작하세요</p>
        <h2 className="mt-3 max-w-[760px] text-[34px] font-black leading-tight tracking-normal md:text-[52px]">
          예약을 받는 일이 곧 고객관리가 되도록
        </h2>
        <p className="mt-5 max-w-[620px] text-[17px] leading-8 text-white/72">
          보여주는 화면과 실제 제품 화면이 같아야 광고 이후의 신뢰가 이어집니다.
        </p>
        <Link href="/signup" className="mt-7 inline-flex h-14 items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] px-7 text-[17px] font-black text-white">
          무료로 시작하기
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, body, dark = false }: { eyebrow: string; title: string; body: string; dark?: boolean }) {
  return (
    <div>
      <p className={`text-[15px] font-black ${dark ? "text-[#7dd3fc]" : "text-[#2563eb]"}`}>{eyebrow}</p>
      <h2 className={`mt-3 max-w-[820px] text-[34px] font-black leading-tight tracking-normal md:text-[50px] ${dark ? "text-white" : "text-[#111827]"}`}>{title}</h2>
      <p className={`mt-4 max-w-[760px] text-[17px] leading-8 ${dark ? "text-white/66" : "text-[#526071]"}`}>{body}</p>
    </div>
  );
}

function ScreenCard({ title, body, src, icon }: { title: string; body: string; src: string; icon: ReactNode }) {
  return (
    <article className="grid gap-5 rounded-[8px] border border-[#dce5f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] lg:grid-cols-[0.34fr_0.66fr]">
      <div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#eef5ff] text-[#2563eb]">{icon}</div>
        <h3 className="mt-4 text-[25px] font-black tracking-normal">{title}</h3>
        <p className="mt-3 text-[15px] leading-7 text-[#526071]">{body}</p>
        <p className="mt-4 inline-flex rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1 text-[12px] font-black text-[#1d4ed8]">
          실제 화면 캡처
        </p>
      </div>
      <ActualImageFrame title={title} src={src} />
    </article>
  );
}

function ActualImageFrame({ title, src, priority = false, dark = false }: { title: string; src: string; priority?: boolean; dark?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[8px] border ${dark ? "border-white/12 bg-white/7" : "border-[#dce5f2] bg-[#f8fbff]"}`}>
      <div className={`flex items-center justify-between border-b px-4 py-3 ${dark ? "border-white/12 text-white/78" : "border-[#e2e8f0] text-[#64748b]"}`}>
        <span className="text-[13px] font-black">{title}</span>
        <span className="text-[12px] font-bold">실제 캡처</span>
      </div>
      <Image
        src={src}
        alt={`${title} 실제 화면 캡처`}
        width={1440}
        height={1100}
        priority={priority}
        className="h-auto w-full"
        sizes="(min-width: 1024px) 680px, 100vw"
      />
    </div>
  );
}

function PhoneScreenCard({ title, body, src }: { title: string; body: string; src: string }) {
  return (
    <article className="rounded-[8px] border border-[#dce5f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#eef5ff] text-[#2563eb]">
          <Phone size={18} />
        </span>
        <div>
          <h3 className="text-[19px] font-black">{title}</h3>
          <p className="text-[12px] font-bold text-[#2563eb]">실제 모바일 화면 캡처</p>
        </div>
      </div>
      <p className="mb-4 text-[15px] leading-7 text-[#526071]">{body}</p>
      <div className="mx-auto max-h-[620px] max-w-[290px] overflow-hidden rounded-[28px] border-[7px] border-[#111827] bg-white">
        <Image src={src} alt={`${title} 실제 화면 캡처`} width={430} height={1200} className="h-auto w-full" sizes="290px" />
      </div>
    </article>
  );
}

function DarkPoint({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-white/12 bg-white/7 p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/10 text-[#7dd3fc]">{icon}</div>
      <h3 className="mt-4 text-[20px] font-black">{title}</h3>
      <p className="mt-2 text-[15px] leading-7 text-white/66">{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#dce5f2] bg-white p-4">
      <p className="text-[13px] font-bold text-[#64748b]">{label}</p>
      <p className="mt-1 text-[25px] font-black text-[#111827]">{value}</p>
    </div>
  );
}

function SavingsTile({ label, value, tone }: { label: string; value: string; tone: "blue" | "green" | "amber" }) {
  const toneClass = {
    blue: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
    green: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
    amber: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
  }[tone];

  return (
    <div className={`rounded-[8px] border p-5 ${toneClass}`}>
      <p className="text-[14px] font-black opacity-75">{label}</p>
      <p className="mt-3 text-[34px] font-black tracking-normal">{value}</p>
    </div>
  );
}

function PlanLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-[8px] border border-[#e2e8f0] bg-[#fbfdff] px-3 py-3 text-[14px]">
      <span className="text-[#64748b]">{label}</span>
      <span className="font-black">{value}</span>
    </div>
  );
}
