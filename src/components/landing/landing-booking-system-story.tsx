"use client";

import { ArrowRight, Check, ChevronLeft, ChevronRight, Database, Sparkles, TriangleAlert, UserRoundPen, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

import {
  BookingFlowCarousel,
  CustomerBookingPhonePreview,
  OwnerLaptopPreview,
  type BookingSystemFocus,
} from "@/components/landing/landing-booking-flow-carousel";

type StoryStep = {
  id: BookingSystemFocus;
  number: string;
  label: string;
  question: string;
  title: string;
  body: string;
  points: string[];
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const storySteps: StoryStep[] = [
  {
    id: "overview",
    number: "00",
    label: "고객 예약 시스템",
    question: "그래서 고객 예약은 어떻게 달라지나요?",
    title: "처음 예약부터 오너 확인까지, 한 번의 흐름으로 이어집니다.",
    body: "고객이 예약을 시작하면 필요한 정보와 시간이 함께 저장되고, 대표님 PC와 모바일 일정에 바로 들어옵니다.",
    points: ["첫 방문과 재방문에 맞춘 예약", "예약과 동시에 일정 반영", "PC와 모바일에서 같은 예약 확인"],
    icon: ArrowRight,
  },
  {
    id: "first",
    number: "01",
    label: "오너는 예약만 확인",
    question: "",
    title: "고객이 직접 예약하니, 오너는 들어온 예약만 확인하면 됩니다.",
    body: "전화와 메시지로 시간을 맞추지 않아도 예약이 바로 일정으로 들어옵니다.",
    points: [],
    icon: UserRoundPen,
  },
  {
    id: "ai",
    number: "02",
    label: "AI로 빈 시간 줄이기",
    question: "",
    title: "AI가 촘촘하게 예약을 잡아, 일정 사이의 빈 시간을 줄입니다.",
    body: "서비스 시간과 기존 예약을 보고 가능한 시간부터 추천합니다.",
    points: [],
    icon: Sparkles,
  },
  {
    id: "customer-data",
    number: "03",
    label: "고객정보 자동 저장",
    question: "",
    title: "고객정보가 자동 저장돼, 다시 옮겨 적을 필요가 없습니다.",
    body: "보호자와 반려동물 정보가 예약과 함께 고객관리 화면에 쌓입니다.",
    points: [],
    icon: Database,
  },
  {
    id: "revisit",
    number: "04",
    label: "재방문은 더 빠르게",
    question: "",
    title: "재방문 고객은 날짜와 시간만 골라 빠르게 예약합니다.",
    body: "저장된 아이를 선택하면 고객도 같은 정보를 다시 입력할 필요가 없습니다.",
    points: [],
    icon: Zap,
  },
];

function LegacyBookingDevicesStage({ focus }: { focus: BookingSystemFocus }) {
  const ownerScheduleFocused = focus === "overview" || focus === "ai";
  const customerDataFocused = focus === "customer-data";
  return (
    <div className="relative mx-auto w-full max-w-[920px]">
      <div className="sm:hidden">
        {customerDataFocused ? (
          <OwnerLaptopPreview compact view="customers" />
        ) : (
          <>
            <BookingFlowCarousel focus={focus} compact />
            {focus === "overview" ? (
              <div className="mx-auto mt-5 w-[94%]">
                <OwnerLaptopPreview compact />
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="hidden grid-cols-[0.72fr_1.28fr] items-end gap-4 pr-10 sm:grid">
        <div className={customerDataFocused ? "pointer-events-none opacity-25 transition duration-300" : "transition duration-300"}>
          <BookingFlowCarousel focus={focus} compact />
        </div>

        <div className={`relative transition duration-300 ${focus === "first" || focus === "revisit" ? "opacity-30" : "opacity-100"}`}>
          <OwnerLaptopPreview compact view={customerDataFocused ? "customers" : "schedule"} />
        </div>
      </div>

      {focus === "overview" ? (
        <div className="absolute left-[36%] top-[47%] hidden -translate-x-1/2 items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-[var(--landing-accent)] shadow-[0_8px_24px_rgba(15,23,42,0.12)] sm:flex">
          예약 완료
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          즉시 반영
        </div>
      ) : null}

      {focus === "ai" && ownerScheduleFocused ? (
        <div className="absolute bottom-[7%] right-[14%] hidden rounded-[8px] border border-[#b9ddce] bg-[#f1fbf6] px-3 py-2 text-[12px] font-semibold text-[#237a59] shadow-[0_8px_22px_rgba(15,23,42,0.1)] sm:block">
          추천 시간 선택 → 일정 사이에 바로 반영
        </div>
      ) : null}
    </div>
  );
}

function BookingDevicesStage({ focus }: { focus: BookingSystemFocus }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Record<string, HTMLElement | null>>({});
  const targetSlide = focus === "revisit" ? "revisit" : focus === "customer-data" ? "owner-pc" : focus === "overview" ? "first" : focus;

  useEffect(() => {
    slideRefs.current[targetSlide]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [targetSlide]);

  const move = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: direction * scrollerRef.current.clientWidth * 0.82, behavior: "smooth" });
  };

  return (
    <div className="relative mx-auto w-full max-w-[980px]">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-[12px] font-medium text-[#64748b]">좌우로 넘겨 실제 화면을 확인하세요</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => move(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d6dee7] bg-white text-[#172033]" aria-label="이전 화면">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => move(1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d6dee7] bg-white text-[#172033]" aria-label="다음 화면">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="flex snap-x snap-mandatory items-end gap-6 overflow-x-auto overscroll-x-contain scroll-smooth pb-5 [scrollbar-width:thin]">
        <figure ref={(el) => { slideRefs.current.first = el; }} className="flex min-w-[310px] snap-center flex-col items-center sm:min-w-[360px]">
          <figcaption className="mb-3 text-[14px] font-semibold text-[#172033]">첫 방문 고객</figcaption>
          <CustomerBookingPhonePreview experience="first" className="max-w-[275px]" />
        </figure>
        <figure ref={(el) => { slideRefs.current.ai = el; }} className="flex min-w-[310px] snap-center flex-col items-center sm:min-w-[360px]">
          <figcaption className="mb-3 text-[14px] font-semibold text-[#172033]">AI 추천 시간</figcaption>
          <CustomerBookingPhonePreview experience="ai" className="max-w-[275px]" />
        </figure>
        <figure ref={(el) => { slideRefs.current.revisit = el; }} className="flex min-w-[310px] snap-center flex-col items-center sm:min-w-[360px]">
          <figcaption className="mb-3 text-[14px] font-semibold text-[#172033]">재방문 고객</figcaption>
          <CustomerBookingPhonePreview experience="revisit" className="max-w-[275px]" />
        </figure>
        <figure ref={(el) => { slideRefs.current["owner-pc"] = el; }} className="min-w-[680px] snap-center sm:min-w-[780px]">
          <figcaption className="mb-3 text-center text-[14px] font-semibold text-[#172033]">실제 오너 PC 화면</figcaption>
          <OwnerLaptopPreview view={focus === "customer-data" ? "customers" : "schedule"} />
        </figure>
      </div>
    </div>
  );
}

function StoryCopy({ step, active }: { step: StoryStep; active: boolean }) {
  const Icon = step.icon;

  return (
    <article className={`transition duration-300 ${active ? "opacity-100" : "opacity-38"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-[8px] ${active ? "bg-[var(--landing-accent)] text-white" : "bg-[#e4e9ef] text-[#7a8998]"}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="text-[13px] font-semibold text-[#7a8998]">{step.number} · {step.label}</span>
      </div>
      <p className="mt-6 text-[15px] font-semibold leading-6 text-[var(--landing-accent)]">“{step.question}”</p>
      <h3 className="mt-3 break-keep text-[28px] font-semibold leading-[1.28] text-[#172033] md:text-[34px]">{step.title}</h3>
      <p className="mt-5 break-keep text-[16px] leading-7 text-[#526071]">{step.body}</p>
      <ul className="mt-6 grid gap-3">
        {step.points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-[14px] font-medium leading-6 text-[#526071]">
            <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--landing-accent)]" aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>
    </article>
  );
}

function LegacyBookingSystemStory() {
  const [activeStepId, setActiveStepId] = useState<BookingSystemFocus>("overview");
  const desktopStepRefs = useRef<Array<HTMLElement | null>>([]);
  const activeStep = storySteps.find((step) => step.id === activeStepId) ?? storySteps[0];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const stepId = visibleEntry?.target.getAttribute("data-story-step") as BookingSystemFocus | null;
        if (stepId) setActiveStepId(stepId);
      },
      { rootMargin: "-34% 0px -48% 0px", threshold: [0, 0.2, 0.6] },
    );

    desktopStepRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-[#eef1f5]">
      <div className="mx-auto hidden w-full max-w-[1560px] grid-cols-[minmax(330px,0.72fr)_minmax(0,1.28fr)] gap-8 px-8 lg:grid xl:gap-14 xl:px-12">
        <div className="py-[14vh]">
          {storySteps.map((step, index) => (
            <div
              key={step.id}
              ref={(element) => { desktopStepRefs.current[index] = element; }}
              data-story-step={step.id}
              className="flex min-h-[430px] items-center py-14"
            >
              <StoryCopy step={step} active={activeStepId === step.id} />
            </div>
          ))}
        </div>
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] min-h-[650px] items-center py-10">
          <BookingDevicesStage focus={activeStepId} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px] px-5 py-10 lg:hidden">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="tablist" aria-label="고객 예약 시스템 기능">
          {storySteps.map((step) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={activeStepId === step.id}
              onClick={() => setActiveStepId(step.id)}
              className={`min-h-12 rounded-[8px] border px-3 py-2 text-[12px] font-semibold transition ${
                activeStepId === step.id
                  ? "border-[var(--landing-accent)] bg-white text-[var(--landing-accent)]"
                  : "border-[#d7dfe7] bg-[#f7f9fb] text-[#64748b]"
              }`}
            >
              {step.label}
            </button>
          ))}
        </div>
        <div className="mt-8">
          <StoryCopy step={activeStep} active />
        </div>
        <div className="mt-8">
          <BookingDevicesStage focus={activeStepId} />
        </div>
      </div>
    </div>
  );
}

const COPY_CLASS = "[word-break:keep-all] [overflow-wrap:break-word]";
const SCHEDULE_CARD_FRAME_CLASS = "box-border h-[314px] w-full shrink-0";

function StepHeader({ number, label, headline, subcopy, note, wide = false }: { number: string; label: string; headline: ReactNode; subcopy?: string; note?: string; wide?: boolean }) {
  return (
    <header className={wide ? "max-w-[1080px]" : "max-w-[740px]"}>
      <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e0eb] bg-white px-1.5 py-1 text-[13px] font-semibold shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <span className="rounded-full bg-[#111b32] px-2 py-0.5 tracking-[0.04em] text-white">STEP {number}</span>
        <span className="pr-1 text-[#526071]">{label}</span>
      </div>
      <h3 className={`mt-4 text-[31px] font-semibold leading-[1.22] text-[#111827] md:text-[43px] ${wide ? "xl:whitespace-nowrap" : ""} ${COPY_CLASS}`}>{headline}</h3>
      {subcopy ? <p className={`mt-4 text-[17px] leading-7 text-[#526071] md:text-[19px] ${COPY_CLASS}`}>{subcopy}{note ? <><br /><span className="font-medium text-[#334155]">{note}</span></> : null}</p> : null}
    </header>
  );
}

function Conclusion({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-1 text-[17px] leading-7 text-[#334155] md:text-[18px] ${className} ${COPY_CLASS}`}>{children}</p>;
}

function TimelineSegment({ className, title, time, muted = false }: { className: string; title: string; time: string; muted?: boolean }) {
  return (
    <div className={`flex min-h-20 flex-col justify-center rounded-[8px] px-4 ${className} ${muted ? "border border-dashed border-[#cbd5e1] bg-white text-[#7b8795]" : "bg-[#e4ecf7] text-[#243e65]"}`}>
      <span className="text-[14px] font-semibold">{title}</span>
      <span className="mt-1 text-[13px]">{time}</span>
    </div>
  );
}

function TraditionalBookingTimeline() {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[#934c3e]"><TriangleAlert className="h-4 w-4 text-[#d44d38]" aria-hidden="true" />고객 원하는 시간 우선</p>
        <strong className="rounded-full bg-[#ffe0d8] px-3 py-1 text-[13px] font-semibold text-[#b4513c]">자투리 1시간</strong>
      </div>
      <div className="mt-7">
        <div className="grid grid-cols-[1fr_.48fr_2.15fr_.48fr_1fr] overflow-hidden rounded-[10px] border border-[#f4dfda] bg-white">
          <div className="flex h-16 items-center justify-center border-r border-[#f0e4e1] text-[14px] font-semibold text-[#334155]">60분</div>
          <div className="flex h-16 items-center justify-center border-r border-[#f0e4e1] bg-[#f49f8d] text-[13px] font-semibold text-[#702d20]">30분</div>
          <div className="flex h-16 items-center justify-center border-r border-[#f0e4e1] text-[14px] font-semibold text-[#334155]">전체미용 120분</div>
          <div className="flex h-16 items-center justify-center border-r border-[#f0e4e1] bg-[#f49f8d] text-[13px] font-semibold text-[#702d20]">30분</div>
          <div className="flex h-16 items-center justify-center text-[14px] font-semibold text-[#334155]">60분</div>
        </div>
        <div className="relative mt-2 h-4 text-[12px] font-medium text-[#a5aebe]" aria-label="09:00부터 14:00까지 예약 시간대">
          <span className="absolute left-0">09:00</span>
          <span className="absolute left-[19.57%] -translate-x-1/2">10:00</span>
          <span className="absolute left-[28.96%] -translate-x-1/2">10:30</span>
          <span className="absolute left-[71.04%] -translate-x-1/2">12:30</span>
          <span className="absolute left-[80.43%] -translate-x-1/2">13:00</span>
          <span className="absolute right-0">14:00</span>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-[#7c8799]"><span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] border border-[#d9d0cc] bg-white" />예약 확정 시간</span><span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] bg-[#f49f8d]" />자투리 (채우기 어려운 시간)</span></div>
      <p className="mt-5 text-[14px] font-medium leading-6 text-[#8d4d40]">짧은 예약 사이사이 자투리 시간이 생겨, 다음 예약이 애매해집니다.</p>
    </>
  );
}

function FlowStep({ text, active = false }: { text: string; active?: boolean }) {
  return <div className={`flex min-h-16 flex-1 items-center justify-center rounded-[8px] px-3 text-center text-[14px] font-semibold ${active ? "bg-[#111b32] text-white" : "border border-[#d7e0e9] bg-white text-[#526071]"}`}>{text}</div>;
}

function ScreenLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-center text-[13px] font-semibold text-[#526071]">{children}</p>;
}

const solutionTableOfContents = [
  { number: "01", label: "링크로 간편 예약", targetId: "solution-simple-booking" },
  { number: "02", label: "단골 빠른 재예약", targetId: "solution-revisit-booking" },
  { number: "03", label: "AI 예약 최적화", targetId: "solution-ai-scheduling" },
  { number: "04", label: "고객 정보 자동 관리", targetId: "solution-customer-management" },
  { number: "05", label: "오늘 예약 한눈에 보기", targetId: "screens" },
  { number: "06", label: "예약 후 안내까지", targetId: "automation" },
] as const;

export function BookingSystemStory() {
  const [scheduleSlide, setScheduleSlide] = useState<"before" | "after">("before");

  useEffect(() => {
    const timer = window.setTimeout(() => setScheduleSlide(scheduleSlide === "before" ? "after" : "before"), 8000);
    return () => window.clearTimeout(timer);
  }, [scheduleSlide]);

  return (
    <section className="flex flex-col bg-white" aria-labelledby="solution-story-title">
      <header className="order-0 mx-auto flex w-full max-w-[1180px] items-start justify-center px-5 pb-5 pt-[10px] text-center md:pb-6">
        <div className="w-full max-w-[980px]">
          <p className="text-[15px] font-semibold text-[var(--landing-accent)]">고객 예약부터 오너 운영까지</p>
          <h2 id="solution-story-title" className={`mx-auto mt-3 max-w-[760px] text-[36px] font-semibold leading-[1.2] text-[#111827] md:text-[48px] ${COPY_CLASS}`}>예약은 쉽게 받고,<br />운영은 더 편하게 만드는 여섯 가지 방법</h2>
          <nav className="mt-7 grid gap-2 text-left sm:grid-cols-2 lg:grid-cols-3" aria-label="예약과 운영을 편하게 만드는 여섯 가지 방법 목차">
            {solutionTableOfContents.map((item) => (
              <a key={item.number} href={`#${item.targetId}`} className="group flex min-h-12 items-center gap-3 rounded-[10px] border border-[#dbe3ed] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#334155] transition hover:border-[#93b7a5] hover:bg-[#f4faf6] hover:text-[#1f714a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f9d55] focus-visible:ring-offset-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eef3f8] text-[11px] font-bold text-[#526071] group-hover:bg-[#dff3e7] group-hover:text-[#1f714a]">{item.number}</span>
                <span>{item.label}</span>
                <ChevronRight className="ml-auto h-4 w-4 text-[#94a3b8] transition group-hover:translate-x-0.5 group-hover:text-[#1f714a]" aria-hidden="true" />
              </a>
            ))}
          </nav>
        </div>
      </header>

      <article id="solution-simple-booking" className="order-1 mx-auto w-full max-w-[1180px] scroll-mt-20 border-t border-[#e2e8f0] px-5 py-10 md:py-14">
        <StepHeader number="01" label="간편 예약" headline="고객은 링크 하나로, 예약을 끝냅니다" subcopy="전화하거나 메시지를 기다릴 필요 없이, 원하는 서비스와 날짜·시간을 직접 고릅니다." />
        <Conclusion>고객은 편하게 예약하고, 오너에게는 <strong className="font-semibold text-[#111827]">확정된 예약만 바로 들어옵니다</strong></Conclusion>
        <div className="mt-6 grid max-w-[1140px] overflow-hidden rounded-[24px] bg-[#edf7f1] md:grid-cols-[0.88fr_1.12fr]">
          <div className="p-7 sm:p-10">
            <span className="inline-flex rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-[#26704b] shadow-sm">고객 예약 페이지</span>
            <p className={`mt-7 text-[30px] font-semibold leading-[1.2] text-[#203b2c] ${COPY_CLASS}`}>고객이 직접 고르고,<br />바로 예약을 확정합니다.</p>
            <div className="mt-9 grid gap-3">
              {["서비스 선택", "날짜 선택", "예약 가능한 시간 선택"].map((label, index) => (
                <div key={label} className="flex items-center gap-4 rounded-[12px] bg-white px-4 py-4 shadow-sm"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f9d55] text-[12px] font-semibold text-white">{index + 1}</span><span className="text-[15px] font-semibold text-[#27513a]">{label}</span><Check className="ml-auto h-5 w-5 text-[#1f9d55]" aria-hidden="true" /></div>
              ))}
            </div>
          </div>
          <div className="grid overflow-hidden bg-[#10192b] px-7 pt-8 sm:grid-cols-[1fr_220px] sm:gap-7 sm:px-10 sm:pt-10">
            <div className="text-white">
              <p className="text-[13px] font-semibold tracking-[0.14em] text-[#9fb5d9]">NO APP. NO CALL.</p>
              <p className={`mt-4 text-[26px] font-semibold leading-[1.24] ${COPY_CLASS}`}>고객은 바로 예약하고,<br />매장은 확인만 하면 됩니다.</p>
              <p className="mt-5 text-[14px] leading-6 text-[#bdc9db]">별도의 앱 설치 없이 서비스와 날짜·시간을 직접 고릅니다. 예약이 끝나면 매장 일정에 바로 들어옵니다.</p>
            </div>
            <figure className="mt-7 flex -translate-y-5 justify-center sm:mt-0 sm:self-center">
              <CustomerBookingPhonePreview experience="first" className="max-w-[220px]" />
            </figure>
          </div>
        </div>
      </article>

      <div id="solution-ai-scheduling" className="order-3 scroll-mt-20 border-y border-[#e2e8f0] bg-[#f6f8fb]">
        <article className="mx-auto w-full max-w-[1180px] px-5 py-8 md:py-10">
          <StepHeader wide number="03" label="AI 예약 최적화" headline={<>다음 예약을 받기엔 짧고,<br />그냥 비워두기엔 아까운 시간들</>} subcopy="반복되는 자투리 시간은 한 달 매출의 큰 손실이 됩니다. 펫매니저는 빈 시간을 줄여 대표님의 매출을 지켜드립니다." />
          <div className="relative mt-7 max-w-[1100px] overflow-hidden rounded-[24px] bg-[#10192b] text-white shadow-[0_22px_55px_rgba(15,23,42,0.18)] lg:h-[314px]">
            <div className="grid transition-transform duration-300 lg:h-full lg:grid-cols-[minmax(0,0.52fr)_minmax(0,1.48fr)]">
              <div className="relative min-w-0 bg-[#10192b] px-7 py-8 lg:h-full lg:rounded-l-[24px] lg:px-8 lg:py-7">
                <div className="lg:flex lg:h-full lg:flex-col lg:justify-center lg:-translate-y-1">
                  {scheduleSlide === "before" ? <><p className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.1em] text-[#ffb4a3]"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff735c] opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff735c]" /></span>고객 원하는 시간 우선</p><p className={`mt-3 text-[24px] font-semibold leading-[1.22] sm:text-[28px] ${COPY_CLASS}`}>원하는 시간만 받으면,<br />애매한 자투리가<br />남습니다</p><p className={`mt-4 max-w-[280px] text-[14px] leading-6 text-[#bdc9db] ${COPY_CLASS}`}>다음 예약을 붙이기 어려운 자투리 시간이 쌓입니다.</p></> : <><p className="text-[12px] font-semibold tracking-[0.1em] text-[#8ee0b1]">AI 예약 최적화</p><p className={`mt-3 text-[23px] font-semibold leading-[1.22] text-white sm:text-[26px] ${COPY_CLASS}`}>예약 흐름을 고려해<br />좋은 시간을 먼저<br />추천합니다</p><p className={`mt-4 max-w-[280px] text-[14px] leading-6 text-[#bdc9db] ${COPY_CLASS}`}>고객은 모든 가능 시간 중에서 편하게 고르고, 매장은 빈 시간을 줄입니다.</p></>}
                </div>
              </div>
              <div className="relative h-[314px] min-w-0 w-full text-[#172033]">
                <div className={`${SCHEDULE_CARD_FRAME_CLASS} absolute inset-0 overflow-hidden rounded-none bg-[#fff2ef] p-6 lg:rounded-r-[24px] lg:px-10 lg:py-7 ${scheduleSlide === "before" ? "block" : "hidden"}`}>
                  <TraditionalBookingTimeline />
                </div>
                <div className={`${SCHEDULE_CARD_FRAME_CLASS} absolute inset-0 overflow-hidden rounded-none bg-[#eff9f2] p-6 lg:rounded-r-[24px] lg:px-10 lg:py-7 ${scheduleSlide === "after" ? "block" : "hidden"}`}>
                  <p className="text-[19px] font-semibold text-[#1f714a]">미용이 끝나는 시간에, 다음 예약을 붙입니다</p>
                  <div className="mt-3 grid grid-cols-1 items-center gap-2 rounded-[12px] border border-[#d5eadc] bg-white/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"><div><p className="text-[11px] font-semibold tracking-[0.1em] text-[#789486]">AI가 계산하는 정보</p><p className="mt-1 whitespace-nowrap text-[13px] font-semibold text-[#26704b]">예약 · 예상 시간 · 영업시간</p></div><ArrowRight className="h-4 w-4 text-[#4e9b6e]" aria-hidden="true" /><div className="sm:text-right"><p className="text-[11px] font-semibold tracking-[0.1em] text-[#789486]">AI가 열어주는 시간</p><p className="mt-1 whitespace-nowrap text-[13px] font-semibold text-[#1f714a]">다음 미용이 바로 가능한 시간</p></div></div>
                  <div className="mt-4 flex items-stretch"><div className="flex min-h-24 flex-[2] flex-col justify-center rounded-l-[8px] border-r border-white bg-[#dbe9f7] px-4 text-[#243e65]"><span className="text-[15px] font-semibold">전체미용 A</span><span className="mt-1.5 text-[13px]">09:00–11:00</span></div><div className="flex min-h-24 flex-[2] flex-col justify-center border-r border-white bg-[#dbe9f7] px-4 text-[#243e65]"><span className="text-[15px] font-semibold">전체미용 B</span><span className="mt-1.5 text-[13px]">11:00–13:00</span></div><div className="flex min-h-24 flex-[2] flex-col justify-center border-r border-white bg-[#dbe9f7] px-4 text-[#243e65]"><span className="text-[15px] font-semibold">전체미용 C</span><span className="mt-1.5 text-[13px]">13:00–15:00</span></div><div className="flex min-h-24 flex-1 flex-col justify-center rounded-r-[8px] border border-dashed border-[#86bb9e] bg-white px-3 text-[#237a59]"><span className="text-[14px] font-semibold">예약 가능</span><span className="mt-1.5 text-[12px]">15:00–16:00</span></div></div>
                </div>
                <button type="button" aria-label={scheduleSlide === "before" ? "AI 예약 최적화 화면 보기" : "기존 예약 화면 보기"} onClick={() => setScheduleSlide(scheduleSlide === "before" ? "after" : "before")} className={`absolute right-5 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border text-white transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${scheduleSlide === "before" ? "border-[#ffb1a1] bg-[#cf634d] shadow-[0_4px_12px_rgba(207,99,77,0.28)] hover:bg-[#df7059]" : "border-[#92d5ad] bg-[#26704b] shadow-[0_4px_12px_rgba(31,157,85,0.28)] hover:bg-[#31815a]"}`}>
                  <span className={`pointer-events-none absolute -inset-0.5 rounded-full border motion-safe:animate-pulse ${scheduleSlide === "before" ? "border-[#ffb1a1]/55" : "border-[#92d5ad]/55"}`} aria-hidden="true" />
                  <span className="relative z-10">{scheduleSlide === "before" ? <ChevronRight className="h-5 w-5" aria-hidden="true" /> : <ChevronLeft className="h-5 w-5" aria-hidden="true" />}</span>
                </button>
              </div>
            </div>
            <div className="sr-only" aria-label="예약 방식 비교 슬라이드">
              <button type="button" aria-label="기존 예약 보기" aria-current={scheduleSlide === "before" ? "true" : undefined} onClick={() => setScheduleSlide("before")} className={`rounded-full transition-all ${scheduleSlide === "before" ? "h-2 w-8 bg-[#ff9b88]" : "h-2 w-2 bg-white/35 hover:bg-white/60"}`} />
              <button type="button" aria-label="AI 예약 최적화 보기" aria-current={scheduleSlide === "after" ? "true" : undefined} onClick={() => setScheduleSlide("after")} className={`rounded-full transition-all ${scheduleSlide === "after" ? "h-2 w-8 bg-[#76e6a8]" : "h-2 w-2 bg-white/35 hover:bg-white/60"}`} />
            </div>
          </div>
        </article>
      </div>

      <article id="solution-revisit-booking" className="order-2 mx-auto w-full max-w-[1180px] scroll-mt-20 px-5 py-10 md:py-14">
        <StepHeader number="02" label="재방문 예약" headline="단골 이탈 막는 초스피드 재예약" subcopy="다른 곳은 다시 전화해 담당과 시간을 조율하지만, 펫매니저는 저장된 정보로 몇 번의 터치만 하면 예약이 끝납니다." wide />
        <Conclusion>전화 한 통 없이, <strong className="font-semibold text-[#111827]">단골이 원하는 시간으로 바로 다시 예약</strong></Conclusion>
        <div className="mt-6 grid max-w-[1140px] overflow-hidden rounded-[24px] bg-[#edf7f1] md:grid-cols-[0.88fr_1.12fr]">
          <div className="p-7 sm:p-10">
            <span className="inline-flex rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-[#26704b] shadow-sm">재방문 예약 페이지</span>
            <p className={`mt-7 text-[30px] font-semibold leading-[1.2] text-[#203b2c] ${COPY_CLASS}`}>저장된 아이로 시작해,<br />시간만 고르면 끝납니다.</p>
            <div className="mt-9 grid gap-3">
              {["저장된 아이 확인", "담당자 선택", "예약 가능한 시간 선택"].map((label, index) => (
                <div key={label} className="flex items-center gap-4 rounded-[12px] bg-white px-4 py-4 shadow-sm"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f9d55] text-[12px] font-semibold text-white">{index + 1}</span><span className="text-[15px] font-semibold text-[#27513a]">{label}</span><Check className="ml-auto h-5 w-5 text-[#1f9d55]" aria-hidden="true" /></div>
              ))}
            </div>
          </div>
          <div className="grid overflow-hidden bg-[#10192b] px-7 pt-8 sm:grid-cols-[1fr_220px] sm:gap-7 sm:px-10 sm:pt-10">
            <div className="text-white">
              <p className="text-[13px] font-semibold tracking-[0.14em] text-[#8ee0b1]">ONE TAP REBOOKING</p>
              <p className={`mt-4 text-[26px] font-semibold leading-[1.24] ${COPY_CLASS}`}>고객은 몇 번의 터치로,<br />오너는 확정 예약만 받습니다.</p>
              <p className={`mt-5 text-[14px] leading-6 text-[#bdc9db] ${COPY_CLASS}`}>보호자와 아이 정보를 다시 적거나, 전화로 시간을 맞출 필요가 없습니다.</p>
            </div>
            <figure className="mt-7 flex -translate-y-5 justify-center sm:mt-0 sm:self-center">
              <CustomerBookingPhonePreview experience="revisit" className="max-w-[220px]" />
            </figure>
          </div>
        </div>
      </article>

      <div id="solution-customer-management" className="order-4 scroll-mt-20 border-y border-[#e2e8f0] bg-[#f6f8fb]">
        <article className="mx-auto w-full max-w-[1180px] px-5 py-10 md:py-14">
          <StepHeader number="04" label="고객 정보 관리" headline="적어둔 메모장을 다시 뒤지는 일, 이제 그만" subcopy="수기로 적은 정보는 빠뜨리기 쉽고, 재방문 때 다시 물어보게 됩니다." />
          <Conclusion>한 번 기록되면, <strong className="font-semibold text-[#111827]">다시 찾을 일 없습니다</strong></Conclusion>
          <div className="mt-6 grid max-w-[1100px] gap-5 md:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[12px] border border-[#dfd7c9] bg-[#fffdf8] p-6 text-[#655e52] sm:p-8">
              <p className="text-[14px] font-semibold text-[#9a8f7b]">지금 · 메모장</p>
              <div className="mt-6 space-y-4 font-medium leading-7">
                <p className="rotate-[-1deg] line-through">두부 · 010-0000-...</p>
                <p className="rotate-[1deg]">견종: 몰... 티?</p>
                <p className="rotate-[-1deg]">피부 예민 (어디였지)</p>
                <p className="border-t border-dashed border-[#d7cdbb] pt-4 text-[14px]">※ 뒷장에 이어 적음</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-[12px] border border-[#d4deed] bg-white p-5 sm:p-7">
              <ScreenLabel>오너 고객관리 화면 · 예약 정보가 자동 저장</ScreenLabel>
              <OwnerLaptopPreview compact view="customers" />
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
