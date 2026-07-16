"use client";

import {
  ArrowRight,
  Bell,
  BellOff,
  CalendarCheck,
  CheckCircle2,
  Database,
  Link2,
  Monitor,
  Phone,
  PhoneMissed,
  Repeat2,
  SearchX,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import LegalLinksFooter from "@/components/legal/legal-links-footer";
import { billableOwnerPlans } from "@/lib/billing/owner-plans";

const MINIMUM_WAGE_2026 = 10320;
const MONTHLY_SAVED_HOURS = 15;
const MONTHLY_SAVED_WON = MINIMUM_WAGE_2026 * MONTHLY_SAVED_HOURS;

const BRAND_TAGLINE = "예약이 넘쳐도, 놓치는 손님은 없게";

const painPoints = [
  {
    icon: PhoneMissed,
    title: "예약 전화 받다가, 손질이 늦어져요",
    body: "전화 받고 문자 남기고 다시 손님 앞으로. 정작 미용에 쓸 시간이 줄어듭니다.",
  },
  {
    icon: Repeat2,
    title: "연락처를 올 때마다 다시 여쭤봅니다",
    body: "분명 지난번에도 남겼는데, 어디 적어뒀는지 찾다가 시간이 갑니다.",
  },
  {
    icon: BellOff,
    title: "안내 문자를 깜빡해서 노쇼가 생겨요",
    body: "바쁜 날일수록 알림 보내는 걸 놓치고, 그만큼 빈 시간이 생깁니다.",
  },
  {
    icon: SearchX,
    title: "지난 방문 기록을 찾느라 기다리게 해요",
    body: "메모장, 문자함, 기억 속 여기저기 흩어진 기록을 뒤적이게 됩니다.",
  },
] as const;

const productScreens = [
  {
    title: "오너 PC 예약관리",
    body: "담당자별 오늘 예약이 한눈에 보여서, 지금 누구 손이 비어 있는지 바로 압니다.",
    src: "/images/landing/actual-schedule.png",
    icon: Monitor,
  },
  {
    title: "월간 캘린더",
    body: "이번 달 예약이 며칠에 몰렸는지, 확정·취소·완료 기록을 한 화면에서 확인합니다.",
    src: "/images/landing/actual-calendar.png",
    icon: CalendarCheck,
  },
  {
    title: "고객 관리",
    body: "보호자 연락처를 다시 묻지 않아도, 예약할 때 남긴 정보가 그대로 쌓입니다.",
    src: "/images/landing/actual-customers.png",
    icon: Database,
  },
  {
    title: "예약 링크 관리",
    body: "네이버, 인스타 어디로 들어오든 예약 링크 하나로 외부 채널을 관리합니다.",
    src: "/images/landing/actual-booking-link.png",
    icon: Link2,
  },
] as const;

const customerScreens = [
  {
    title: "고객 첫 화면",
    body: "고객은 앱 설치 없이 매장 예약 페이지에서 바로 간편예약을 시작합니다.",
    src: "/images/landing/actual-customer-entry.png",
  },
  {
    title: "예약자 정보 입력",
    body: "고객이 입력한 보호자와 반려동물 정보가 오너 고객정보로 그대로 이어집니다.",
    src: "/images/landing/actual-customer-booking.png",
  },
] as const;

const sellingPoints = [
  "보호자명, 연락처, 반려동물 정보가 예약과 동시에 자연스럽게 남습니다.",
  "상담 후 다시 옮겨 적지 않아도, 고객관리 화면에서 바로 확인합니다.",
  "알림톡 발송 현황도 함께 보여서, 보낸 줄 알았던 안내를 놓치지 않습니다.",
] as const;

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LandingPage() {
  return (
    <main className="owner-font min-h-screen bg-white text-[#111827]">
      <Header />
      <Hero />
      <PainPointsSection />
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
        <Link href="/" className="flex items-center gap-3">
          <Image src="/icons/logo/nemchin-day-logo.svg" alt="넘친 Day" width={132} height={36} priority />
        </Link>
        <nav className="hidden items-center gap-7 text-[14px] font-semibold text-[#64748b] md:flex">
          <button type="button" onClick={() => scrollToSection("pain-points")} className="hover:text-[#111827]">
            이런 하루
          </button>
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
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center rounded-[8px] px-4 text-[14px] font-bold text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]"
            style={{ backgroundImage: "var(--pm-brand-blue-button-gradient)" }}
          >
            무료로 시작
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundImage: "var(--pm-brand-blue-page-gradient)" }}
    >
      <div className="mx-auto grid w-full max-w-[1180px] items-center gap-9 px-5 pb-14 pt-14 lg:grid-cols-[0.84fr_1.16fr] lg:pb-20 lg:pt-20">
        <div>
          <p className="inline-flex rounded-full border border-[#bfdbfe] bg-white/80 px-4 py-2 text-[14px] font-black text-[#1d4ed8] backdrop-blur">
            {BRAND_TAGLINE}
          </p>
          <h1 className="mt-6 text-[40px] font-black leading-[1.1] tracking-normal md:text-[58px]">
            전화를 못 받아도,
            <br />
            예약은 놓치지 않습니다
          </h1>
          <p className="mt-5 max-w-[600px] text-[18px] leading-8 text-[#43506b]">
            미용하는 동안 걸려온 전화, 다시 여쭤보는 연락처, 깜빡한 안내 문자 — 놓치는 순간은 그대로 놓치는 매출이 됩니다. 예약, 보호자·반려동물 정보, 알림톡, 캘린더를 오너 화면 하나로 정리해서 손이 비어있지 않을 때도 예약이 끊기지 않게 합니다.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-[8px] px-7 text-[17px] font-black text-white shadow-[0_18px_42px_rgba(37,99,235,0.28)]"
              style={{ backgroundImage: "var(--pm-brand-blue-button-gradient)" }}
            >
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
        <ActualImageFrame title="오너 예약관리 실제 화면" src="/images/landing/actual-schedule.png" priority />
      </div>
    </section>
  );
}

function PainPointsSection() {
  return (
    <section id="pain-points" className="border-y border-[#e7edf5] bg-[#f5f7fb] py-16">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionTitle
          eyebrow="미용샵 사장님이라면 익숙한 하루"
          title="미용은 내가 제일 잘하는데, 그 사이 놓치는 손님이 생깁니다"
          body="예약을 많이 받는 날일수록 이런 순간이 늘어납니다. 넘친 Day는 이 네 가지부터 막아드립니다."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {painPoints.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-[8px] border border-[#dce5f2] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#eff6ff] text-[#2563eb]">
                <Icon size={18} />
              </div>
              <h3 className="mt-4 text-[17px] font-black leading-snug">{title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-[#64748b]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ActualScreensSection() {
  return (
    <section id="screens" className="mx-auto w-full max-w-[1180px] px-5 py-14">
      <SectionTitle
        eyebrow="실제 제품 화면 캡처"
        title="광고용 목업이 아니라, 지금 사장님들이 쓰는 화면 그대로"
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
          <p className="text-[15px] font-black text-[#2563eb]">숫자로 보는 손실 방지 효과</p>
          <h2 className="mt-3 text-[36px] font-black leading-tight tracking-normal md:text-[52px]">
            하루 30분이면
            <br />월 {formatWon(MONTHLY_SAVED_WON)}, 놓치지 않는 셈입니다
          </h2>
          <p className="mt-5 text-[17px] leading-8 text-[#526071]">
            2026년 최저시급 {MINIMUM_WAGE_2026.toLocaleString("ko-KR")}원 기준, 하루 30분이면 한 달에 15시간입니다. 놓친 전화, 노쇼, 반복 확인에 쓰던 시간을 매출로 환산하면 이렇습니다.
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
    <section id="customer-flow" className="border-y border-[#e7edf5] bg-[#f5f7fb] py-16">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionTitle
          eyebrow="고객이 예약할 때 이미 시작됩니다"
          title="고객이 남긴 정보가, 오너의 고객관리로 자동 연결됩니다"
          body="고객 예약 화면도 실제 라우트에서 캡처했습니다. 개인정보를 다시 묻지 않고 자동으로 모으는 흐름을 그대로 보여드립니다."
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
          <DarkPoint icon={<CalendarCheck size={20} />} title="예약관리" body="담당자별 예약과 진행 상태를 일정판에서 한눈에 확인합니다." />
          <DarkPoint icon={<Database size={20} />} title="고객DB" body="예약자가 남긴 보호자·반려동물 정보가 고객관리 화면에 자동으로 정리됩니다." />
          <DarkPoint icon={<Bell size={20} />} title="알림톡" body="발송 현황과 사용량을 함께 보면서, 안내 누락을 줄입니다." />
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
    <section id="pricing" className="border-t border-[#e7edf5] bg-[#f5f7fb] py-16">
      <div className="mx-auto w-full max-w-[1180px] px-5">
        <SectionTitle
          eyebrow="요금제"
          title="혼자든 여럿이든, 매장 규모에 맞춰 선택하세요"
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
            <Link
              href="/signup"
              className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-[8px] text-[16px] font-black ${plan.featured ? "text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]" : "border border-[#d7e0ec] bg-white text-[#111827]"}`}
              style={plan.featured ? { backgroundImage: "var(--pm-brand-blue-button-gradient)" } : undefined}
            >
              시작하기
            </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 pb-16">
      <div className="rounded-[8px] bg-[#111827] p-7 text-white md:p-10">
        <p className="text-[15px] font-black text-[#93c5fd]">이제, 놓치던 예약을 잡을 시간</p>
        <h2 className="mt-3 max-w-[760px] text-[34px] font-black leading-tight tracking-normal md:text-[52px]">
          예약 받는 일이 곧 고객관리가 되도록
        </h2>
        <p className="mt-5 max-w-[620px] text-[17px] leading-8 text-white/72">
          보여드린 화면이 실제로 지금 쓰는 화면입니다. {BRAND_TAGLINE} — 넘친 Day로 지금 확인해보세요.
        </p>
        <Link
          href="/signup"
          className="mt-7 inline-flex h-14 items-center justify-center gap-2 rounded-[8px] px-7 text-[17px] font-black text-white shadow-[0_18px_42px_rgba(37,99,235,0.3)]"
          style={{ backgroundImage: "var(--pm-brand-blue-button-gradient)" }}
        >
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
    <div className={`overflow-hidden rounded-[10px] border ${dark ? "border-white/12 bg-white/7" : "border-[#dce5f2] bg-[#f8fbff]"} shadow-[0_20px_44px_rgba(15,23,42,0.08)]`}>
      <div className={`flex items-center justify-between border-b px-4 py-2.5 ${dark ? "border-white/12 text-white/78" : "border-[#e2e8f0] text-[#64748b]"}`}>
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
          </span>
          <span className="text-[13px] font-black">{title}</span>
        </div>
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
      <div className="mx-auto h-[440px] max-w-[290px] overflow-hidden rounded-[28px] border-[7px] border-[#111827] bg-white md:h-[500px]">
        <Image
          src={src}
          alt={`${title} 실제 화면 캡처`}
          width={430}
          height={1200}
          className="h-full w-full object-cover object-top"
          sizes="290px"
        />
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
    <div className="rounded-[8px] border border-[#dce5f2] bg-white/90 p-4 backdrop-blur">
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
