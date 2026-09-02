"use client";

import { useEffect, useRef, useState } from "react";

import { GalaxyPhoneMockup, LaptopMockup } from "@/components/landing/landing-ui";
import { getLandingDemoShopId } from "@/lib/development-demo";

const MOBILE_VIEWPORT_WIDTH = 430;
const DESKTOP_VIEWPORT_WIDTH = 1440;
const EMBED_TIMEOUT_MS = 12_000;

type EmbedStatus = "loading" | "ready" | "error";

function EmbedStatusLayer({
  status,
  onRetry,
}: {
  status: EmbedStatus;
  onRetry: () => void;
}) {
  if (status === "ready") return null;

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 px-4 text-center"
      aria-busy={status === "loading"}
      role="status"
    >
      {status === "loading" ? (
        <div className="w-full max-w-[180px] space-y-3" aria-label="운영 화면을 불러오는 중">
          <div className="h-3 animate-pulse rounded-full bg-slate-200" />
          <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
          <div className="h-16 animate-pulse rounded-[8px] bg-slate-100" />
        </div>
      ) : (
        <div>
          <p className="break-keep text-[13px] font-medium text-[#334155]">화면을 불러오지 못했어요</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[#cbd5e1] bg-white px-4 text-[13px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}

function useEmbedStatus(src: string) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<EmbedStatus>("loading");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    timeoutRef.current = window.setTimeout(() => setStatus("error"), EMBED_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [attempt, src]);

  const settle = (nextStatus: EmbedStatus) => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    setStatus(nextStatus);
  };

  return {
    attempt,
    status,
    markReady: () => settle("ready"),
    markError: () => settle("error"),
    retry: () => {
      setStatus("loading");
      setAttempt((current) => current + 1);
    },
  };
}

function resolveMobileOwnerDemoUrl() {
  const configuredOrigin = process.env.NEXT_PUBLIC_MOBILE_APP_URL?.trim().replace(/\/$/, "");
  if (configuredOrigin) return `${configuredOrigin}/demo/owner-mobile`;
  if (process.env.NODE_ENV === "development") return "http://127.0.0.1:3100/demo/owner-mobile";
  return "https://petmanager-app.vercel.app/demo/owner-mobile";
}

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

export function OwnerMobilePreview({ className = "max-w-[190px]" }: { className?: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const mobileOwnerSrc = resolveMobileOwnerDemoUrl();
  const embed = useEmbedStatus(mobileOwnerSrc);

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
    const expectedOrigin = new URL(mobileOwnerSrc).origin;
    const handleEmbedMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== expectedOrigin || event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || typeof event.data !== "object") return;

      const message = event.data as Record<string, unknown>;
      if (message.source !== "petmanager-owner-mobile-embed" || message.version !== 1) return;
      if (message.status === "ready") embed.markReady();
      if (message.status === "error") embed.markError();
    };

    window.addEventListener("message", handleEmbedMessage);
    return () => window.removeEventListener("message", handleEmbedMessage);
  }, [embed, mobileOwnerSrc]);

  const scale = viewportSize.width > 0 ? viewportSize.width / MOBILE_VIEWPORT_WIDTH : 1;
  const iframeHeight = scale > 0 ? viewportSize.height / scale : 0;

  return (
    <GalaxyPhoneMockup className={`w-full ${className}`}>
      <div ref={viewportRef} className="relative isolate h-full w-full overflow-hidden bg-white [contain:paint]">
        <EmbedStatusLayer status={embed.status} onRetry={embed.retry} />
        {viewportSize.width > 0 && viewportSize.height > 0 ? (
          <iframe
            key={embed.attempt}
            ref={iframeRef}
            src={mobileOwnerSrc}
            title="펫매니저 모바일 실제 운영 화면 읽기 전용 미리보기"
            sandbox="allow-scripts allow-same-origin"
            tabIndex={-1}
            scrolling="no"
            className="pointer-events-none absolute left-0 top-0 block border-0 bg-white"
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
    </GalaxyPhoneMockup>
  );
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
  const embed = useEmbedStatus(ownerWebSrc);

  return (
    <LaptopMockup className={large ? "max-w-[1080px]" : compact ? "max-w-[570px]" : "max-w-[680px] 2xl:max-w-[822px]"}>
      <div ref={viewportRef} className="relative h-full w-full overflow-hidden bg-white">
        <EmbedStatusLayer status={embed.status} onRetry={embed.retry} />
        {viewportSize.width > 0 && viewportSize.height > 0 ? (
          <iframe
            key={embed.attempt}
            src={ownerWebSrc}
            title="펫매니저 PC 실제 운영 화면 읽기 전용 미리보기"
            sandbox="allow-scripts allow-same-origin"
            tabIndex={-1}
            className="pointer-events-none absolute left-0 top-0 block border-0 bg-white"
            style={{
              width: `${DESKTOP_VIEWPORT_WIDTH}px`,
              height: `${iframeHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            loading="eager"
            onLoad={embed.markReady}
            onError={embed.markError}
          />
        ) : null}
      </div>
    </LaptopMockup>
  );
}
