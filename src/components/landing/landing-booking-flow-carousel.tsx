"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { GalaxyPhoneMockup, LaptopMockup } from "@/components/landing/landing-ui";
import { getLandingDemoShopId } from "@/lib/development-demo";

const MOBILE_VIEWPORT_WIDTH = 430;
const DESKTOP_VIEWPORT_WIDTH = 1440;

const landingDemoShopId = getLandingDemoShopId();
const BOOKING_PREVIEW_ROUTES = {
  first: `/book/${landingDemoShopId}?experience=first&step=1`,
  ai: `/book/${landingDemoShopId}?experience=ai&step=3&serviceId=petmanager-demo-service-full`,
  revisit: `/book/${landingDemoShopId}?experience=revisit&serviceId=petmanager-demo-service-full`,
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
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const automaticRetryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    };
  }, []);

  const retry = useCallback((automatic = false) => {
    if (!automatic) automaticRetryCountRef.current = 0;
    setLoadState("loading");
    setReloadKey((current) => current + 1);
  }, []);

  const handleFrameFailure = useCallback(() => {
    if (automaticRetryCountRef.current === 0) {
      automaticRetryCountRef.current = 1;
      setLoadState("loading");
      retryTimerRef.current = window.setTimeout(() => retry(true), 350);
      return;
    }

    setLoadState("error");
  }, [retry]);

  const handleFrameLoad = useCallback((frame: HTMLIFrameElement) => {
    let failed = false;
    try {
      const frameDocument = frame.contentDocument;
      const frameText = frameDocument?.body?.innerText ?? "";
      const frameUrl = frameDocument?.location?.href ?? "";
      failed = !frameDocument ||
        !frameUrl ||
        frameUrl === "about:blank" ||
        !frameDocument.body ||
        frameText.trim().length === 0 ||
        frameDocument.documentElement.id === "__next_error__" ||
        frameText.includes("화면을 불러오지 못했습니다");
    } catch {
      failed = true;
    }

    if (!failed) {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setLoadState("ready");
      return;
    }

    handleFrameFailure();
  }, [handleFrameFailure]);

  const scale = viewportSize.width > 0 ? viewportSize.width / MOBILE_VIEWPORT_WIDTH : 1;
  const iframeHeight = scale > 0 ? viewportSize.height / scale : 0;

  const screen = (
      <div ref={viewportRef} className="relative isolate h-full w-full overflow-hidden bg-white [contain:paint]">
        {viewportSize.width > 0 && viewportSize.height > 0 ? (
          <iframe
            key={`${src}-${reloadKey}`}
            src={src}
            title={title}
            scrolling="no"
            className={`absolute left-0 top-0 block border-0 bg-white transition-opacity duration-150 ${loadState === "ready" ? "opacity-100" : "opacity-0"}`}
            style={{
              width: `${MOBILE_VIEWPORT_WIDTH}px`,
              height: `${iframeHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            loading="eager"
            onLoad={(event) => handleFrameLoad(event.currentTarget)}
            onError={handleFrameFailure}
          />
        ) : null}
        {loadState !== "ready" ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-white px-6 text-center"
            aria-live="polite"
          >
            {loadState === "error" ? (
              <div>
                <p className="text-[14px] font-medium leading-5 text-[#172033]">예약 데모를 준비하지 못했습니다.</p>
                <button
                  type="button"
                  onClick={() => retry(false)}
                  className="mt-3 min-h-11 rounded-lg border border-[#d5d9e0] bg-white px-4 text-[13px] font-medium text-[#172033]"
                >
                  다시 불러오기
                </button>
              </div>
            ) : (
              <p className="text-[13px] leading-5 text-[#64748b]">예약 화면을 준비하고 있습니다.</p>
            )}
          </div>
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
      key={src}
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
            key={experience.src}
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
