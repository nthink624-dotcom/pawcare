"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { GalaxyPhoneMockup, LaptopMockup } from "@/components/landing/landing-ui";

const MOBILE_VIEWPORT_WIDTH = 430;
const DESKTOP_VIEWPORT_WIDTH = 1440;

const BOOKING_PREVIEW_ROUTES = {
  first: "/book/demo-shop?experience=first&step=1",
  ai: "/book/demo-shop?experience=ai&step=3&serviceId=svc-full",
  revisit: "/book/demo-shop?experience=revisit&serviceId=svc-full",
} as const;

export type BookingSystemFocus = "overview" | "first" | "ai" | "customer-data" | "revisit";

function LivePhone({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className: string;
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
      <div ref={viewportRef} className="relative isolate h-full w-full overflow-hidden bg-white [contain:paint]">
        {viewportSize.width > 0 && viewportSize.height > 0 ? (
          <iframe
            src={src}
            title={title}
            scrolling="no"
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
      </div>
  );

  return <GalaxyPhoneMockup className={className}>{screen}</GalaxyPhoneMockup>;
}

export function CustomerBookingPhonePreview({
  experience,
  className = "max-w-[280px]",
}: {
  experience: "first" | "ai" | "revisit";
  className?: string;
}) {
  const isAi = experience === "ai";
  const src = BOOKING_PREVIEW_ROUTES[experience];
  const title = experience === "revisit" ? "재방문 고객 예약" : isAi ? "AI 추천 시간 예약" : "첫 방문 고객 예약";

  return (
    <LivePhone
      src={src}
      title={`${title} 실제 고객 예약 페이지`}
      className={`mx-auto w-full ${className}`}
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
      src: focus === "ai" ? BOOKING_PREVIEW_ROUTES.ai : BOOKING_PREVIEW_ROUTES.first,
      title: focus === "ai" ? "AI 추천 시간" : "첫 방문 고객",
      description: focus === "ai" ? ["가능한 시간 중", "가장 자연스러운 시간 먼저"] : ["필요한 정보만 입력하고", "간편하게 예약 시작"],
    },
    {
      id: "revisit",
      src: BOOKING_PREVIEW_ROUTES.revisit,
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

export function OwnerLaptopPreview({
  compact = false,
  view = "schedule",
  large = false,
}: {
  compact?: boolean;
  view?: "schedule" | "customers";
  large?: boolean;
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
    <LaptopMockup className={large ? "max-w-[1080px]" : compact ? "max-w-[570px]" : "max-w-[680px] 2xl:max-w-[822px]"}>
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
