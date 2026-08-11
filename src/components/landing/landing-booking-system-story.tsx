"use client";

import { ArrowRight, Check, ChevronLeft, ChevronRight, Database, Sparkles, UserRoundPen, Zap } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react";

import {
  BookingFlowCarousel,
  CustomerBookingPhonePreview,
  OwnerLaptopPreview,
  OwnerMobilePhonePreview,
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
    label: "첫 방문 예약",
    question: "처음 오는 고객의 정보는 어떻게 받죠?",
    title: "고객이 간편정보를 직접 남기고, 전화 없이 예약합니다.",
    body: "보호자 연락처와 반려동물 이름, 품종, 몸무게처럼 예약에 필요한 정보만 한 번 입력합니다. 그다음부터는 고객이 가능한 날짜와 시간을 직접 선택합니다.",
    points: ["전화와 DM으로 정보를 다시 묻지 않음", "고객이 가능한 시간을 직접 확인", "대표님은 들어온 예약만 확인"],
    icon: UserRoundPen,
  },
  {
    id: "ai",
    number: "02",
    label: "AI 추천 시간",
    question: "고객이 아무 시간이나 고르면 빈 시간이 생기지 않나요?",
    title: "일정 사이에 가장 자연스럽게 들어갈 시간을 먼저 추천합니다.",
    body: "AI가 서비스 소요 시간과 기존 예약, 근무 가능 시간을 함께 보고 촘촘한 시간대를 먼저 보여줍니다. 고객은 다른 가능한 시간도 선택할 수 있습니다.",
    points: ["추천 시간을 고객에게 먼저 노출", "다른 가능한 시간도 선택 가능", "매장 운영시간을 더 촘촘하게 활용"],
    icon: Sparkles,
  },
  {
    id: "customer-data",
    number: "03",
    label: "고객정보 자동 저장",
    question: "고객이 적은 정보는 다시 옮겨 적어야 하나요?",
    title: "예약할 때 입력한 정보가 고객관리 화면에 바로 저장됩니다.",
    body: "보호자와 반려동물 정보를 메모하거나 다른 프로그램에 다시 입력하지 않아도 됩니다. 예약과 고객관리가 같은 데이터로 이어집니다.",
    points: ["예약정보를 고객 DB에 자동 연결", "보호자와 반려동물 기록을 함께 관리", "다음 방문에도 저장된 정보 재사용"],
    icon: Database,
  },
  {
    id: "revisit",
    number: "04",
    label: "재방문 초고속 예약",
    question: "다시 오는 고객도 매번 정보를 적어야 하나요?",
    title: "저장된 아이를 고르고 날짜와 시간만 선택하면 끝납니다.",
    body: "보호자와 반려동물 정보가 이미 저장되어 있어 같은 내용을 다시 입력하지 않습니다. 아이 선택, 날짜 선택, 시간 선택의 세 번 터치로 예약할 수 있습니다.",
    points: ["저장된 반려동물 바로 선택", "반복 입력 없이 세 번 터치", "재방문 고객의 예약 이탈 감소"],
    icon: Zap,
  },
];

function LegacyBookingDevicesStage({ focus }: { focus: BookingSystemFocus }) {
  const ownerScheduleFocused = focus === "overview" || focus === "ai";
  const customerDataFocused = focus === "customer-data";
  const ownerMobileFocused = focus === "overview";

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
          <div className={`absolute -bottom-1 -right-9 w-[148px] transition duration-300 ${ownerMobileFocused ? "opacity-100" : "opacity-35"}`}>
            <OwnerMobilePhonePreview compact />
          </div>
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

const solutionSteps = storySteps.filter((step) => step.id !== "overview");

function SolutionVisual({ step }: { step: StoryStep }) {
  if (step.id === "customer-data") {
    return (
      <div className="mx-auto w-full max-w-[740px]">
        <OwnerLaptopPreview view="customers" />
      </div>
    );
  }

  const experience = step.id === "revisit" ? "revisit" : step.id === "ai" ? "ai" : "first";

  return (
    <div className="relative mx-auto aspect-[1048/1501] w-full max-w-[390px] lg:-translate-y-2">
      <div
        className="absolute left-[35.687%] top-[5.996%] z-10 isolate aspect-[486/1078] w-[46.374%] overflow-hidden bg-white [contain:paint]"
        style={{
          borderRadius: "11.934% / 5.380%",
          clipPath: "inset(2px round 11.934% / 5.380%)",
          WebkitMaskImage: "-webkit-radial-gradient(white, black)",
        }}
      >
        <CustomerBookingPhonePreview experience={experience} className="h-full w-full max-w-none" bare />
      </div>
      <Image
          src="/images/landing/handheld-galaxy-cutout-trimmed-v7.png"
        alt="손에 든 Galaxy 휴대폰으로 고객 예약 화면을 확인하는 모습"
        fill
        className="pointer-events-none z-20 object-contain"
        sizes="390px"
      />
    </div>
  );
}

function SolutionStoryCopy({ step, index }: { step: StoryStep; index: number }) {
  const Icon = step.icon;

  return (
    <div className="max-w-[500px]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[var(--landing-accent)] text-white">
          <Icon className="h-[19px] w-[19px]" aria-hidden />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-[var(--landing-accent)]">시간을 지키는 방법 {index + 1} / {solutionSteps.length}</p>
          <p className="mt-0.5 text-[15px] font-semibold text-[#64748b]">{step.label}</p>
        </div>
      </div>
      <p className="mt-6 text-[16px] font-semibold leading-7 text-[#334155]">“{step.question}”</p>
      <h3 className="mt-3 break-keep text-[31px] font-semibold leading-[1.25] text-[#172033] md:text-[38px]">{step.title}</h3>
      <p className="mt-5 break-keep text-[16px] leading-7 text-[#526071] md:text-[17px] md:leading-8">{step.body}</p>
      <ul className="mt-6 grid gap-2.5">
        {step.points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-[15px] font-medium leading-6 text-[#526071]">
            <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--landing-accent)]" aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BookingSystemStory() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const dragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const index = Number(activeEntry?.target.getAttribute("data-solution-index"));
        if (Number.isInteger(index)) setActiveIndex(index);
      },
      { root, threshold: [0.45, 0.65, 0.85] },
    );

    slideRefs.current.forEach((slide) => {
      if (slide) observer.observe(slide);
    });
    return () => observer.disconnect();
  }, []);

  const goTo = (index: number) => {
    const nextIndex = (index + solutionSteps.length) % solutionSteps.length;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ left: scroller.clientWidth * nextIndex, behavior: "smooth" });
  };

  useEffect(() => {
    if (interactionPaused) return;
    const timer = window.setTimeout(() => goTo(activeIndex + 1), 2800);
    return () => window.clearTimeout(timer);
  }, [activeIndex, interactionPaused]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !scrollerRef.current) return;
    const currentScrollLeft = scrollerRef.current.scrollLeft;
    scrollerRef.current.style.scrollBehavior = "auto";
    scrollerRef.current.scrollTo({ left: currentScrollLeft, behavior: "auto" });
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: currentScrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    setIsDragging(true);
    setInteractionPaused(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || !scrollerRef.current) return;
    event.preventDefault();
    scrollerRef.current.scrollLeft = dragRef.current.startScrollLeft - (event.clientX - dragRef.current.startX);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);
    if (scrollerRef.current) {
      const dragDistance = event.clientX - dragRef.current.startX;
      const startIndex = Math.round(dragRef.current.startScrollLeft / scrollerRef.current.clientWidth);
      const nextIndex = Math.abs(dragDistance) >= 24
        ? startIndex + (dragDistance < 0 ? 1 : -1)
        : startIndex;
      scrollerRef.current.style.removeProperty("scroll-behavior");
      goTo(nextIndex);
    }
    setInteractionPaused(false);
  };

  return (
    <section className="bg-white" aria-labelledby="solution-story-title">
      <header className="mx-auto w-full max-w-[1180px] px-5 pb-0 pt-14 text-center md:pt-20">
        <p className="text-[15px] font-semibold text-[var(--landing-accent)]">그래서, 어떻게 시간을 지켜주는데?</p>
        <h2 id="solution-story-title" className="mt-3 break-keep text-[31px] font-semibold leading-[1.25] text-[#111827] md:text-[42px]">
          펫매니저가 시간을 지키는 4가지 방법
        </h2>
        <div className="mx-auto mt-7 grid max-w-[980px] grid-cols-2 border-b border-[#dbe2e9] md:grid-cols-4" role="tablist" aria-label="시간을 지키는 네 가지 방법">
          {solutionSteps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={activeIndex === index}
              onClick={() => goTo(index)}
              className={`relative min-h-12 px-3 py-2 text-[14px] font-semibold transition ${
                activeIndex === index
                  ? "text-[var(--landing-accent)] after:absolute after:inset-x-3 after:-bottom-px after:h-[3px] after:bg-[var(--landing-accent)]"
                  : "text-[#7b8795] hover:text-[#334155]"
              }`}
            >
              <span className="mr-1.5 opacity-70">0{index + 1}</span>{step.label}
            </button>
          ))}
        </div>
      </header>

      <div className="bg-[#f3f5f7] px-5 pb-2 pt-5 md:pb-3 md:pt-7">
      <div className="mx-auto w-full max-w-[1180px] overflow-hidden">
        <div className="relative">
          <div
            className="absolute inset-0 z-30 hidden cursor-grab select-none touch-none lg:block active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label="마우스로 좌우 드래그하여 해결 방식 넘기기"
          />
          <div
            ref={scrollerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`landing-solution-scroller flex overflow-x-auto overscroll-x-contain select-none touch-pan-y ${isDragging ? "snap-none scroll-auto" : "snap-x snap-mandatory scroll-smooth"}`}
            style={{ scrollbarWidth: "none" }}
          >
            {solutionSteps.map((step, index) => (
              <article
                key={step.id}
                ref={(element) => { slideRefs.current[index] = element; }}
                data-solution-index={index}
                className="grid min-w-full snap-start items-start gap-9 overflow-hidden lg:min-h-[620px] lg:grid-cols-[minmax(430px,0.88fr)_minmax(0,1.12fr)] lg:gap-20"
              >
                <div className="mx-auto w-full max-w-[540px] lg:mx-0 lg:pt-4">
                  <SolutionStoryCopy step={step} index={index} />
                </div>
                <div className="flex min-h-[560px] items-start justify-center overflow-hidden px-2 lg:min-h-[620px]">
                  <SolutionVisual step={step} />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-1 flex h-5 items-center justify-center gap-3" role="tablist" aria-label="해결 방식 페이지">
          {solutionSteps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={activeIndex === index}
              aria-label={`해결 방식 ${index + 1}: ${step.label}`}
              onClick={() => goTo(index)}
              className={`rounded-full bg-[var(--landing-accent)] transition-all duration-200 ${activeIndex === index ? "h-3 w-8" : "h-2 w-2 opacity-35"}`}
            />
          ))}
        </div>
      </div>
      </div>
    </section>
  );
}
