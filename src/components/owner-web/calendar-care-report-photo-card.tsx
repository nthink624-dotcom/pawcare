"use client";

import { ChevronLeft, ChevronRight, ImagePlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { CARE_REPORT_TYPOGRAPHY } from "@/components/owner-web/owner-typography";

export function CalendarCareReportPhotoCard({
  label,
  registered = false,
  imageUrls = [],
  loading = false,
  disabled = false,
  onClick,
}: {
  label: string;
  registered?: boolean;
  imageUrls?: Array<string | null | undefined>;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const availableImageUrls = useMemo(() => imageUrls.filter((url): url is string => Boolean(url)), [imageUrls]);
  const imageKey = availableImageUrls.join("|");
  const [activeIndex, setActiveIndex] = useState(0);
  const [motionDirection, setMotionDirection] = useState<"previous" | "next" | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointerStartX = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const motionTimer = useRef<number | null>(null);
  const swapTimer = useRef<number | null>(null);
  const imageUrl = availableImageUrls[activeIndex] ?? null;
  const previousImageUrl = availableImageUrls.length > 0
    ? availableImageUrls[(activeIndex - 1 + availableImageUrls.length) % availableImageUrls.length]
    : null;
  const nextImageUrl = availableImageUrls.length > 0
    ? availableImageUrls[(activeIndex + 1) % availableImageUrls.length]
    : null;
  const actionLabel = loading ? "확인 중" : registered || imageUrl ? "교체" : "사진 선택";

  useEffect(() => {
    setActiveIndex(0);
  }, [imageKey, label]);

  useEffect(() => () => {
    if (motionTimer.current !== null) window.clearTimeout(motionTimer.current);
    if (swapTimer.current !== null) window.clearTimeout(swapTimer.current);
  }, []);

  function move(direction: "previous" | "next") {
    if (disabled || availableImageUrls.length === 0 || motionDirection) return;
    setMotionDirection(direction);
    setDragOffset(0);
    if (swapTimer.current !== null) window.clearTimeout(swapTimer.current);
    swapTimer.current = window.setTimeout(() => {
      setActiveIndex((current) => (
        direction === "next"
          ? (current + 1) % availableImageUrls.length
          : (current - 1 + availableImageUrls.length) % availableImageUrls.length
      ));
    }, 110);
    if (motionTimer.current !== null) window.clearTimeout(motionTimer.current);
    motionTimer.current = window.setTimeout(() => setMotionDirection(null), 240);
  }

  function showPrevious() {
    move("previous");
  }

  function showNext() {
    move("next");
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerStartX.current === null) return;
    const deltaX = event.clientX - pointerStartX.current;
    pointerStartX.current = null;
    setDragging(false);
    setDragOffset(0);
    if (availableImageUrls.length === 0 || Math.abs(deltaX) < 34) return;
    suppressClick.current = true;
    if (deltaX < 0) showNext();
    else showPrevious();
  }

  function handleSideClick(direction: "previous" | "next") {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    move(direction);
  }

  function SideFrame({ imageUrl: sideImageUrl, direction }: { imageUrl?: string | null; direction: "previous" | "next" }) {
    const isPrevious = direction === "previous";
    return (
      <button
        type="button"
        onClick={() => handleSideClick(direction)}
        disabled={disabled || availableImageUrls.length === 0}
        aria-label={isPrevious ? "이전 사진 보기" : "다음 사진 보기"}
        className="absolute left-1/2 top-1/2 z-0 aspect-[4/3] w-[270px] overflow-hidden rounded-[16px] border border-[#d7dde4] bg-[#f3f5f7] opacity-80 transition duration-300 ease-out hover:opacity-100 disabled:cursor-default disabled:opacity-55"
        style={{ transform: isPrevious ? "translate(-78%, -50%) rotateY(15deg) scale(.86)" : "translate(-22%, -50%) rotateY(-15deg) scale(.86)" }}
      >
        {sideImageUrl ? <img src={sideImageUrl} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-cover" /> : <span className="grid h-full w-full place-items-center text-[#a8b1bc]"><ImagePlus className="h-5 w-5" /></span>}
        <span className="absolute inset-y-0 grid w-9 place-items-center bg-white/60 text-[#526171] backdrop-blur-[1px]" style={{ [isPrevious ? "left" : "right"]: 0 }}>
          {isPrevious ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
    );
  }

  return (
    <div
      className="relative mx-auto h-[244px] w-full max-w-[460px] cursor-grab select-none overflow-hidden [perspective:1000px] touch-pan-y active:cursor-grabbing"
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (disabled || availableImageUrls.length === 0) return;
        pointerStartX.current = event.clientX;
        setDragging(true);
        suppressClick.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (pointerStartX.current === null || motionDirection) return;
        const nextOffset = Math.max(-72, Math.min(72, event.clientX - pointerStartX.current));
        setDragOffset(nextOffset);
      }}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerStartX.current = null;
        setDragging(false);
        suppressClick.current = false;
        setDragOffset(0);
      }}
    >
      <SideFrame imageUrl={previousImageUrl} direction="previous" />
      <SideFrame imageUrl={nextImageUrl} direction="next" />

      <button
        type="button"
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onClick?.();
        }}
        disabled={disabled}
        aria-label={`${label} 사진 ${actionLabel}`}
        className={`group absolute left-1/2 top-1/2 z-10 flex aspect-[4/3] w-full max-w-[300px] items-center justify-center overflow-hidden rounded-[16px] border border-[#cfd6de] bg-[#fafbfc] px-5 py-4 text-center hover:border-[#aeb9c5] hover:bg-white disabled:opacity-60 ${motionDirection === "next" ? "care-photo-carousel-next" : motionDirection === "previous" ? "care-photo-carousel-previous" : ""}`}
        style={!motionDirection ? {
          transform: `translate(calc(-50% + ${dragOffset}px), -50%) rotateY(${dragOffset * -0.08}deg) scale(${1 - Math.min(Math.abs(dragOffset) / 900, 0.06)})`,
          transition: dragging ? "none" : "transform 180ms ease-out",
        } : undefined}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={`등록된 ${label} 사진`} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" />
        ) : null}

        {!imageUrl ? (
          <span key={label} className="relative flex flex-col items-center text-[#263547]">
            <span className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef1f4] text-[#274563]">
              <ImagePlus className="h-4 w-4" />
            </span>
            <strong className={CARE_REPORT_TYPOGRAPHY.bodyStrong}>{label} 사진 추가</strong>
            <span className={`${CARE_REPORT_TYPOGRAPHY.helper} mt-0.5 text-[#7b8794]`}>등록된 {label} 사진이 없습니다</span>
          </span>
        ) : null}

        {!imageUrl ? (
          <span className={`${CARE_REPORT_TYPOGRAPHY.badge} absolute bottom-3 right-3 rounded-full border border-[#d9dfe6] bg-white/95 px-3 py-1 text-[#526171] transition group-hover:border-[#b7c0ca]`}>
            {actionLabel}
          </span>
        ) : null}
      </button>
      <style jsx>{`
        @keyframes care-photo-next {
          0% { transform: translate(-50%, -50%) rotateY(0deg) scale(1); opacity: 1; }
          48% { transform: translate(-88%, -50%) rotateY(18deg) scale(.84); opacity: .58; }
          52% { transform: translate(-12%, -50%) rotateY(-18deg) scale(.84); opacity: .58; }
          100% { transform: translate(-50%, -50%) rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes care-photo-previous {
          0% { transform: translate(-50%, -50%) rotateY(0deg) scale(1); opacity: 1; }
          48% { transform: translate(-12%, -50%) rotateY(-18deg) scale(.84); opacity: .58; }
          52% { transform: translate(-88%, -50%) rotateY(18deg) scale(.84); opacity: .58; }
          100% { transform: translate(-50%, -50%) rotateY(0deg) scale(1); opacity: 1; }
        }
        .care-photo-carousel-next { animation: care-photo-next 240ms ease-in-out; }
        .care-photo-carousel-previous { animation: care-photo-previous 240ms ease-in-out; }
      `}</style>
    </div>
  );
}
