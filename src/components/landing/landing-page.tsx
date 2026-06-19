"use client";

import {
  Bell,
  CalendarDays,
  Check,
  ClipboardCheck,
  MessageCircle,
  PawPrint,
  Sparkles,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import LegalLinksFooter from "@/components/legal/legal-links-footer";
import { billableOwnerPlans } from "@/lib/billing/owner-plans";

const features = [
  {
    title: "예약 요청부터 승인까지",
    body: "고객은 링크로 예약하고, 오너는 매장 상황에 맞춰 승인, 거절, 시간 변경을 처리합니다.",
    icon: ClipboardCheck,
  },
  {
    title: "흩어진 예약을 한 화면에",
    body: "전화, 카톡, DM으로 들어온 예약도 직접 등록해서 같은 흐름에서 관리할 수 있습니다.",
    icon: MessageCircle,
  },
  {
    title: "필요할 때만 알림톡",
    body: "예약 확정, 미용 시작, 픽업 준비 같은 안내를 오너가 직접 눌러 발송합니다.",
    icon: Bell,
  },
  {
    title: "재방문 예약은 더 빠르게",
    body: "저장된 보호자와 반려동물 정보로 다음 예약부터는 아이 선택만 하면 됩니다.",
    icon: PawPrint,
  },
] as const;

const workflow = [
  ["01", "예약 링크 공유", "스마트플레이스, 인스타, 카카오에 예약 링크를 올립니다."],
  ["02", "고객이 직접 선택", "서비스, 디자이너, 날짜, 시간을 고객이 모바일에서 고릅니다."],
  ["03", "오너가 확인 후 승인", "예약은 바로 확정되지 않고 오너가 직접 확인합니다."],
  ["04", "기록이 다음 예약으로", "반려동물 정보와 방문 기록이 쌓여 재방문 관리가 쉬워집니다."],
] as const;

const faqs = [
  ["고객이 어려워하지 않을까요?", "앱 설치 없이 링크만 열면 됩니다. 모바일에서 서비스와 시간을 순서대로 고르는 흐름입니다."],
  ["예약이 자동 확정되나요?", "기본은 직접 승인입니다. 오너가 확인한 예약만 확정되도록 설계했습니다."],
  ["전화 예약도 관리할 수 있나요?", "가능합니다. 오너가 직접 등록한 예약도 같은 예약판과 캘린더에서 확인할 수 있습니다."],
  ["1인샵도 부담 없이 쓸 수 있나요?", "오늘 처리할 예약, 승인대기, 고객 기록처럼 자주 쓰는 기능부터 가볍게 시작할 수 있습니다."],
] as const;

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f7f5f1] text-[#171717]">
      <Header />
      <Hero />
      <ProblemSection />
      <ProductSection />
      <WorkflowSection />
      <FeatureSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <footer className="mx-auto w-full max-w-[1180px] px-5 pb-10 pt-2">
        <LegalLinksFooter />
      </footer>
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e6ded3]/80 bg-[#f7f5f1]/92 backdrop-blur">
      <div className="mx-auto flex h-[72px] w-full max-w-[1180px] items-center justify-between px-5">
        <a href="/landing" className="flex items-center gap-3">
          <Image src="/icons/logo/넘친 Day.svg" alt="넘친 day" width={156} height={42} priority />
        </a>
        <nav className="hidden items-center gap-7 text-[15px] text-[#5f574f] md:flex">
          <a href="#product" className="hover:text-[#171717]">제품</a>
          <a href="#flow" className="hover:text-[#171717]">흐름</a>
          <a href="#pricing" className="hover:text-[#171717]">요금</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login?next=%2Fowner" className="hidden rounded-[10px] px-4 py-2 text-[15px] text-[#3f3934] hover:bg-white md:inline-flex">
            로그인
          </Link>
          <Link href="/signup" className="rounded-[10px] bg-[#232323] px-4 py-2 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(35,35,35,0.18)]">
            시작하기
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-[1180px] items-center gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:pb-24 lg:pt-20">
      <div>
        <p className="inline-flex rounded-full border border-[#efc8c0] bg-white px-4 py-2 text-[15px] font-semibold text-[#e0574f]">
          반려동물 미용샵 예약관리 서비스
        </p>
        <h1 className="mt-6 max-w-[720px] text-[44px] font-semibold leading-[1.08] tracking-[-0.04em] md:text-[72px]">
          매출도 여유도
          <br />
          넘치는 하루
        </h1>
        <p className="mt-6 max-w-[610px] text-[18px] leading-8 text-[#5f574f] md:text-[20px]">
          넘친 day는 예약 요청, 승인, 알림톡, 고객 기록을 한 곳에 모아
          오너가 덜 쫓기고 더 정확하게 운영하도록 돕습니다.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className="inline-flex h-14 items-center justify-center rounded-[12px] bg-[#232323] px-7 text-[17px] font-semibold text-white">
            무료로 시작하기
          </Link>
          <Link href="/login?next=%2Fowner" className="inline-flex h-14 items-center justify-center rounded-[12px] border border-[#d8d0c4] bg-white px-7 text-[17px] font-semibold text-[#232323]">
            오너 화면 보기
          </Link>
        </div>
        <div className="mt-8 grid max-w-[560px] grid-cols-3 gap-3">
          <TrustItem label="예약 요청" value="자동 정리" />
          <TrustItem label="알림톡" value="직접 발송" />
          <TrustItem label="재방문" value="고객 기록" />
        </div>
      </div>
      <div className="relative">
        <div className="absolute -left-6 top-10 hidden h-28 w-28 rounded-full bg-[#f47c72]/16 blur-3xl md:block" />
        <div className="rounded-[32px] border border-[#e2d8cc] bg-white/72 p-4 shadow-[0_24px_80px_rgba(36,30,24,0.12)]">
          <OwnerDashboardMock />
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <Section eyebrow="왜 필요한가요" title="예약은 늘었는데, 운영 시간이 같이 줄어드는 순간">
      <div className="grid gap-4 md:grid-cols-3">
        <ProblemCard title="여기저기 들어오는 예약" body="전화, 카톡, DM, 네이버 요청이 섞이면 누락과 중복이 생기기 쉽습니다." />
        <ProblemCard title="확인 안내 반복" body="예약 확정, 방문 전 안내, 픽업 안내를 매번 직접 쓰면 하루가 금방 사라집니다." />
        <ProblemCard title="기록이 이어지지 않음" body="지난 방문, 요청사항, 반려동물 정보가 흩어지면 재방문 응대가 느려집니다." />
      </div>
    </Section>
  );
}

function ProductSection() {
  return (
    <Section id="product" eyebrow="제품 미리보기" title="고객 화면과 오너 화면이 같은 예약 흐름으로 이어집니다">
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <CustomerPhoneMock />
        <div className="grid gap-5">
          <SchedulePreview />
          <CalendarPreview />
        </div>
      </div>
    </Section>
  );
}

function WorkflowSection() {
  return (
    <Section id="flow" eyebrow="운영 흐름" title="예약을 받는 순간부터 다시 방문하는 날까지">
      <div className="grid gap-3 md:grid-cols-4">
        {workflow.map(([step, title, body]) => (
          <div key={step} className="rounded-[22px] border border-[#e2d8cc] bg-white p-5">
            <span className="text-[14px] font-semibold text-[#e0574f]">{step}</span>
            <h3 className="mt-4 text-[20px] font-semibold">{title}</h3>
            <p className="mt-3 text-[15px] leading-7 text-[#665d55]">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FeatureSection() {
  return (
    <Section eyebrow="핵심 기능" title="작은 샵 운영에 필요한 기능부터 단단하게">
      <div className="grid gap-4 md:grid-cols-2">
        {features.map(({ title, body, icon: Icon }) => (
          <div key={title} className="flex gap-4 rounded-[22px] border border-[#e2d8cc] bg-white p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#fff0eb] text-[#e0574f]">
              <Icon size={22} />
            </div>
            <div>
              <h3 className="text-[20px] font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-[#665d55]">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PricingSection() {
  const plans = billableOwnerPlans.slice(0, 3);

  return (
    <Section id="pricing" eyebrow="요금제" title="샵 규모에 맞게 시작하세요">
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan, index) => (
          <div key={plan.code} className={`rounded-[26px] border bg-white p-6 ${index === 1 ? "border-[#232323] shadow-[0_20px_50px_rgba(35,35,35,0.12)]" : "border-[#e2d8cc]"}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-[24px] font-semibold">{plan.name}</h3>
              {index === 1 ? <span className="rounded-full bg-[#232323] px-3 py-1 text-[13px] font-semibold text-white">추천</span> : null}
            </div>
            <p className="mt-4 text-[42px] font-semibold tracking-[-0.04em]">{formatWon(plan.monthlyPrice)}<span className="text-[16px] text-[#766b61]"> / 월</span></p>
            <ul className="mt-6 space-y-3 text-[15px] text-[#4d453e]">
              {plan.highlights.slice(0, 5).map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-[#e0574f]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup" className={`mt-7 inline-flex h-12 w-full items-center justify-center rounded-[12px] text-[16px] font-semibold ${index === 1 ? "bg-[#232323] text-white" : "border border-[#d8d0c4] bg-white text-[#232323]"}`}>
              선택하기
            </Link>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FaqSection() {
  return (
    <Section eyebrow="자주 묻는 질문" title="오너가 먼저 궁금해할 것들">
      <div className="grid gap-3 md:grid-cols-2">
        {faqs.map(([question, answer]) => (
          <div key={question} className="rounded-[20px] border border-[#e2d8cc] bg-white p-5">
            <h3 className="text-[18px] font-semibold">{question}</h3>
            <p className="mt-2 text-[15px] leading-7 text-[#665d55]">{answer}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 py-12">
      <div className="overflow-hidden rounded-[32px] bg-[#232323] p-8 text-white md:p-12">
        <p className="text-[16px] text-white/70">넘친 day</p>
        <h2 className="mt-3 max-w-[760px] text-[36px] font-semibold leading-tight tracking-[-0.04em] md:text-[56px]">
          예약이 넘쳐도, 하루가 무너지지 않게.
        </h2>
        <p className="mt-5 max-w-[620px] text-[18px] leading-8 text-white/72">
          매출도 여유도 넘치는 하루를 만들 수 있도록, 예약 흐름부터 정리해보세요.
        </p>
        <Link href="/signup" className="mt-8 inline-flex h-14 items-center justify-center rounded-[12px] bg-[#f47c72] px-7 text-[17px] font-semibold text-white">
          넘친 day 시작하기
        </Link>
      </div>
    </section>
  );
}

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto w-full max-w-[1180px] px-5 py-12 md:py-16">
      <p className="text-[15px] font-semibold text-[#e0574f]">{eyebrow}</p>
      <h2 className="mt-3 max-w-[820px] text-[34px] font-semibold leading-tight tracking-[-0.04em] md:text-[48px]">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function TrustItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#e2d8cc] bg-white p-4">
      <p className="text-[13px] text-[#766b61]">{label}</p>
      <p className="mt-1 text-[17px] font-semibold">{value}</p>
    </div>
  );
}

function ProblemCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-[#e2d8cc] bg-white p-6">
      <Sparkles className="h-6 w-6 text-[#e0574f]" />
      <h3 className="mt-5 text-[22px] font-semibold">{title}</h3>
      <p className="mt-3 text-[16px] leading-7 text-[#665d55]">{body}</p>
    </div>
  );
}

function OwnerDashboardMock() {
  return (
    <div className="rounded-[24px] border border-[#d8d0c4] bg-[#fbfaf7] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[14px] text-[#766b61]">오늘 예약 관리</p>
          <p className="text-[24px] font-semibold">승인대기 3건</p>
        </div>
        <button className="rounded-[10px] bg-[#232323] px-4 py-2 text-[14px] font-semibold text-white">예약 추가</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <MiniMetric label="예약 현황" value="8" dark />
        <MiniMetric label="완료 내역" value="5" />
      </div>
      <div className="mt-4 rounded-[18px] border border-[#e2d8cc] bg-white p-4">
        <p className="mb-3 flex items-center gap-2 text-[16px] font-semibold">
          <CalendarDays size={18} />
          다음 예약
        </p>
        {["14:00  우유 · 전체미용", "15:30  콩이 · 위생미용", "17:00  초코 · 스포팅"].map((item) => (
          <div key={item} className="flex items-center justify-between border-t border-[#f0e3df] py-3 first:border-t-0">
            <span className="text-[15px] text-[#4d453e]">{item}</span>
            <span className="rounded-full bg-[#fff0eb] px-3 py-1 text-[13px] text-[#d95149]">대기</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerPhoneMock() {
  return (
    <div className="rounded-[28px] border border-[#e2d8cc] bg-white p-5 shadow-[0_16px_34px_rgba(32,28,24,0.06)]">
      <div className="mx-auto max-w-[430px] rounded-[34px] border-[8px] border-[#202020] bg-[#fff8f6] p-4 shadow-2xl">
        <CustomerPagePreview />
      </div>
    </div>
  );
}

function CustomerPagePreview() {
  return (
    <div className="overflow-hidden rounded-[24px] bg-[#fff8f6]">
      <div className="relative h-[250px] rounded-[22px]">
        <Image src="/images/customer-booking-hero-retriever-bath.jpg" alt="반려견 미용 장면" fill className="rounded-[22px] object-cover" sizes="430px" />
        <div className="absolute inset-0 rounded-[22px] bg-gradient-to-t from-black/55 to-transparent" />
        <p className="absolute bottom-5 left-5 text-[28px] font-semibold text-white">우진만세</p>
        <span className="absolute right-4 top-4 rounded-full bg-black/45 px-3 py-1 text-[14px] font-semibold text-white">1 / 4</span>
      </div>
      <div className="mx-auto mt-3 h-2 w-8 rounded-full bg-[#f47c72]" />
      <div className="mt-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0eb] text-[#e0574f]">
          <UserRound size={26} />
        </div>
        <div>
          <p className="text-[20px] font-semibold">정우진</p>
          <p className="text-[14px] text-[#9a8f86]">소형견 중심의 1인 미용샵 운영을 돕는 예약 관리 앱</p>
        </div>
      </div>
      <button className="mt-5 rounded-[12px] border border-[#eadbd6] bg-white px-4 py-3 text-[16px] font-semibold">
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#35a87d]" />
        영업 중
      </button>
      <div className="mt-5 overflow-hidden rounded-[16px] border border-[#efdcd7] bg-white">
        <ServiceRow name="전체미용" time="90분" price="45,000원 ~" />
        <ServiceRow name="위생미용+목욕" time="60분" price="30,000원 ~" />
        <ServiceRow name="스포팅" time="120분" price="70,000원 ~" />
        <ServiceRow name="가위컷" time="150분" price="90,000원 ~" />
      </div>
      <button className="mt-5 h-14 w-full rounded-[14px] bg-[#f47c72] text-[17px] font-semibold text-white">
        간편예약 시작
      </button>
    </div>
  );
}

function SchedulePreview() {
  return (
    <PreviewCard title="오너 예약관리" body="승인대기, 진행 중, 픽업 준비를 한 화면에서 처리합니다.">
      <div className="grid gap-3 rounded-[20px] bg-[#fbfaf7] p-4 md:grid-cols-3">
        {["정우진", "박수현", "수현"].map((name, index) => (
          <div key={name} className="min-h-[220px] rounded-[16px] border border-[#e3dbcf] bg-white">
            <div className="rounded-t-[16px] bg-[#232323] px-4 py-3 text-white">
              <p className="text-[16px] font-semibold">{name}</p>
              <p className="mt-1 text-[12px] text-white/70">예약 {index + 1}건 · 대기 {index === 0 ? 1 : 0}건</p>
            </div>
            {index === 0 ? (
              <div className="m-3 rounded-[12px] border border-[#dbe2ea] border-l-[3px] border-l-[#b98121] p-3">
                <p className="text-[15px] font-semibold">우유 · 정우진</p>
                <p className="mt-1 text-[13px] text-[#6b6258]">14:30-16:00 · 전체미용</p>
              </div>
            ) : (
              <p className="mt-12 text-center text-[14px] text-[#9b9288]">예약 없음</p>
            )}
          </div>
        ))}
      </div>
    </PreviewCard>
  );
}

function CalendarPreview() {
  return (
    <PreviewCard title="캘린더와 재방문 관리" body="월간 흐름과 반려동물 정보를 함께 보고 다음 예약으로 이어갑니다.">
      <div className="rounded-[20px] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[20px] font-semibold">6월</p>
          <button className="rounded-[9px] border border-[#d8d0c4] px-3 py-2 text-[14px]">오늘</button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-[13px] text-[#7c7268]">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}
          {Array.from({ length: 21 }, (_, index) => (
            <div key={index} className="min-h-[54px] rounded-[10px] border border-[#ece5db] bg-[#fbfaf7] p-1 text-left">
              <span className="text-[13px] font-medium">{index + 1}</span>
              {index === 8 ? <p className="mt-1 rounded-full bg-[#fff0eb] px-1.5 py-0.5 text-center text-[11px] text-[#d95149]">대기 4</p> : null}
              {index === 14 ? <p className="mt-1 rounded-full bg-[#eef4ff] px-1.5 py-0.5 text-center text-[11px] text-[#607080]">완료 2</p> : null}
            </div>
          ))}
        </div>
      </div>
    </PreviewCard>
  );
}

function PreviewCard({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-[#e3dbcf] bg-white p-5 shadow-[0_16px_34px_rgba(32,28,24,0.06)]">
      <h3 className="text-[22px] font-semibold tracking-[-0.03em]">{title}</h3>
      <p className="mt-2 text-[15px] leading-7 text-[#696158]">{body}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function MiniMetric({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={`rounded-[14px] border p-4 ${dark ? "border-[#232323] bg-[#232323] text-white" : "border-[#e3dbcf] bg-white"}`}>
      <p className={`text-[14px] ${dark ? "text-white/70" : "text-[#6b6258]"}`}>{label}</p>
      <p className="mt-2 text-[28px] font-semibold">{value}</p>
    </div>
  );
}

function ServiceRow({ name, time, price }: { name: string; time: string; price: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#f0e3df] bg-white px-4 py-4 last:border-b-0">
      <div>
        <span className="text-[16px] font-semibold">{name}</span>
        <span className="ml-2 text-[14px] text-[#9a8f86]">{time}</span>
      </div>
      <span className="text-[17px] font-semibold text-[#e0574f]">{price}</span>
    </div>
  );
}
