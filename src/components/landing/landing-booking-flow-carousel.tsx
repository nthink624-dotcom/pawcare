"use client";

import { BatteryFull, ChevronLeft, Signal, Wifi } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { GalaxyPhoneMockup, LaptopMockup } from "@/components/landing/landing-ui";
import { getLandingDemoShopId } from "@/lib/development-demo";

const MOBILE_VIEWPORT_WIDTH = 430;
const DESKTOP_VIEWPORT_WIDTH = 1440;

const landingDemoShopId = getLandingDemoShopId();
const ownerMobileDemoSrc = process.env.NEXT_PUBLIC_OWNER_MOBILE_DEMO_URL ?? "http://127.0.0.1:3100/owner/mobile/mongshop";

export type BookingSystemFocus = "overview" | "first" | "ai" | "customer-data" | "revisit";

function LivePhone({
  src,
  title,
  className,
  locked = false,
  bare = false,
}: {
  src: string;
  title: string;
  className: string;
  locked?: boolean;
  bare?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      const { width, height } = viewport.getBoundingClientRect();
      setViewportSize({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const scale = viewportSize.width > 0 ? viewportSize.width / MOBILE_VIEWPORT_WIDTH : 1;
  const iframeHeight = scale > 0 ? viewportSize.height / scale : 0;

  const screen = (
      <div ref={viewportRef} className="relative h-full w-full overflow-hidden bg-white">
        {viewportSize.width > 0 && viewportSize.height > 0 ? (
          <iframe
            src={src}
            title={title}
            className="absolute left-0 top-0 block border-0 bg-white"
            style={{
              width: `${MOBILE_VIEWPORT_WIDTH}px`,
              height: `${iframeHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            loading="eager"
          />
        ) : null}
        {locked ? <div className="absolute inset-0 z-20" aria-label={`${title} 읽기 전용 화면`} /> : null}
      </div>
  );

  if (bare) {
    return (
      <div
        className={`relative isolate aspect-[490/1080] overflow-hidden rounded-[10.5%/4.75%] bg-white [contain:paint] ${className}`}
        style={{
          clipPath: "inset(0 round 10.5% / 4.75%)",
          WebkitMaskImage: "-webkit-radial-gradient(white, black)",
        }}
      >
        <div className="absolute inset-x-0 bottom-[5.9%] top-[5%] z-10 overflow-hidden bg-white [contain:paint]">
          {screen}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-[5.15%] items-center justify-between overflow-hidden rounded-t-[10.5%/100%] bg-white px-[5.2%] text-[#111827] shadow-[0_1px_0_rgba(15,23,42,0.04)]"
          aria-hidden="true"
        >
          <time className="text-[8px] font-semibold leading-none">9:41</time>
          <div className="flex items-center gap-1">
            <Signal className="h-2.5 w-2.5" strokeWidth={2.4} />
            <Wifi className="h-2.5 w-2.5" strokeWidth={2.4} />
            <BatteryFull className="h-3 w-3.5" strokeWidth={2.2} />
          </div>
        </div>
        <span className="pointer-events-none absolute left-1/2 top-[1.35%] z-40 aspect-square w-[2.5%] -translate-x-1/2 rounded-full bg-[#08090a] ring-1 ring-[#34383b]" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex h-[6.05%] items-center justify-around overflow-hidden rounded-b-[10.5%/100%] border-t border-[#f0f1f3] bg-white text-[#111827]"
          aria-hidden="true"
        >
          <span className="flex h-3 w-3 items-center justify-center gap-[1.5px]">
            <i className="h-2.5 w-[1.5px] rounded-full bg-[#111827]" />
            <i className="h-2.5 w-[1.5px] rounded-full bg-[#111827]" />
            <i className="h-2.5 w-[1.5px] rounded-full bg-[#111827]" />
          </span>
          <span className="h-3 w-4 rounded-[3px] border-[1.5px] border-[#111827]" />
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
        </div>
      </div>
    );
  }

  return <GalaxyPhoneMockup className={className}>{screen}</GalaxyPhoneMockup>;
}

export function CustomerBookingPhonePreview({
  experience,
  className = "max-w-[280px]",
  bare = false,
}: {
  experience: "first" | "ai" | "revisit";
  className?: string;
  bare?: boolean;
}) {
  const isAi = experience === "ai";
  const src =
    experience === "revisit"
      ? `/book/${landingDemoShopId}?experience=revisit`
      : isAi
        ? `/book/${landingDemoShopId}?experience=first&step=3&serviceId=mongshop-service-bath-care`
        : `/entry/${landingDemoShopId}?experience=first`;
  const title = experience === "revisit" ? "재방문 고객 예약" : isAi ? "AI 추천 시간 예약" : "첫 방문 고객 예약";

  return (
    <LivePhone
      src={src}
      title={`${title} 실제 고객 예약 페이지`}
      className={`mx-auto w-full ${className}`}
      bare={bare}
    />
  );
}

export function BookingFlowCarousel({
  focus = "overview",
  compact = false,
}: {
  focus?: BookingSystemFocus;
  compact?: boolean;
}) {
  const bookingExperiences = [
    {
      id: "first",
      src:
        focus === "ai"
          ? `/book/${landingDemoShopId}?experience=first&step=3&serviceId=mongshop-service-bath-care`
          : `/entry/${landingDemoShopId}?experience=first`,
      title: focus === "ai" ? "AI 추천 시간" : "첫 방문 고객",
      description: focus === "ai" ? ["가능한 시간 중", "가장 자연스러운 시간 먼저"] : ["필요한 정보만 입력하고", "간편하게 예약 시작"],
    },
    {
      id: "revisit",
      src: `/book/${landingDemoShopId}?experience=revisit`,
      title: "재방문 고객",
      description: ["저장된 반려동물 정보로", "더 빠르게 예약"],
    },
  ] as const;

  return (
    <div className={`mx-auto grid w-full items-start ${compact ? "max-w-[360px] grid-cols-2 gap-3" : "max-w-[500px] grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-5"}`}>
      {bookingExperiences.map((experience) => (
        <figure
          key={experience.id}
          className={`min-w-0 transition duration-300 ${
            focus === "overview" || focus === experience.id || (focus === "ai" && experience.id === "first")
              ? "scale-100 opacity-100"
              : "scale-[0.96] opacity-30"
          }`}
        >
          <figcaption className={compact ? "mb-2 text-center" : "mb-4 text-center"}>
            <span className={`${compact ? "text-[12px]" : "text-[14px]"} font-semibold text-[#172033]`}>{experience.title}</span>
          </figcaption>
          <LivePhone
            src={experience.src}
            title={`${experience.title} 실제 고객 예약 페이지`}
            className={`mx-auto w-full ${compact ? "max-w-[150px]" : "max-w-[225px]"} drop-shadow-[0_20px_36px_rgba(15,23,42,0.2)]`}
          />
          <div className={`${compact ? "mt-2 text-[10px] leading-4" : "mt-4 text-[12px] leading-5"} text-center`}>
            <span className="block text-[#64748b]">{experience.description[0]}</span>
            <span className="block font-semibold text-[var(--landing-accent)]">{experience.description[1]}</span>
          </div>
        </figure>
      ))}
    </div>
  );
}

export function OwnerMobilePhonePreview({ compact = false }: { compact?: boolean }) {
  return (
    <LivePhone
      src={ownerMobileDemoSrc}
      title="멍샵몽샵 오너 모바일 예약 현황"
      className={`mx-auto w-full ${compact ? "max-w-[148px]" : "max-w-[203px]"} drop-shadow-[0_18px_30px_rgba(15,23,42,0.24)]`}
    />
  );
}

export function OwnerLaptopPreview({
  compact = false,
  view = "schedule",
}: {
  compact?: boolean;
  view?: "schedule" | "customers";
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      const { width, height } = viewport.getBoundingClientRect();
      setViewportSize({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const scale = viewportSize.width > 0 ? viewportSize.width / DESKTOP_VIEWPORT_WIDTH : 1;
  const iframeHeight = scale > 0 ? viewportSize.height / scale : 0;
  const ownerWebSrc = view === "customers" ? "/demo/owner-web?screen=customers" : "/demo/owner-web";

  return (
    <LaptopMockup className={compact ? "max-w-[570px]" : "max-w-[680px] 2xl:max-w-[822px]"}>
      <div ref={viewportRef} className="relative h-full w-full overflow-hidden bg-white">
        {false ? (
          <Image
            src="/images/landing/actual-customers.png"
            alt="오너 고객관리 화면"
            fill
            className="object-cover object-top"
            sizes={compact ? "570px" : "820px"}
          />
        ) : viewportSize.width > 0 && viewportSize.height > 0 ? (
          <iframe
            src={ownerWebSrc}
            title="오너 홈 체험"
            className="absolute left-0 top-0 block border-0 bg-white"
            style={{
              width: `${DESKTOP_VIEWPORT_WIDTH}px`,
              height: `${iframeHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            loading="eager"
          />
        ) : null}
      </div>
    </LaptopMockup>
  );
}
