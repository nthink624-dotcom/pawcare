"use client";

import { Check, ChevronRight, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

const COMPLETE_THRESHOLD = 92;
const THUMB_SIZE = 48;

type SlideToPayProps = {
  amountLabel: string;
  disabled?: boolean;
  loading?: boolean;
  onComplete: () => Promise<void>;
};

export default function SlideToPay({ amountLabel, disabled = false, loading = false, onComplete }: SlideToPayProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartXRef = useRef(0);
  const progressRef = useRef(0);
  const lockedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const blocked = disabled || loading || lockedRef.current;

  function updateProgress(nextProgress: number) {
    const normalized = Math.max(0, Math.min(100, nextProgress));
    progressRef.current = normalized;
    setProgress(normalized);
  }

  function reset() {
    pointerIdRef.current = null;
    setDragging(false);
    updateProgress(0);
  }

  async function completePayment() {
    if (blocked || lockedRef.current) return;
    lockedRef.current = true;
    setDragging(false);
    updateProgress(100);

    try {
      await onComplete();
    } finally {
      lockedRef.current = false;
      reset();
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (blocked) return;
    pointerIdRef.current = event.pointerId;
    pointerStartXRef.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (blocked || pointerIdRef.current !== event.pointerId || !trackRef.current) return;
    const availableWidth = Math.max(1, trackRef.current.clientWidth - THUMB_SIZE - 8);
    updateProgress(((event.clientX - pointerStartXRef.current) / availableWidth) * 100);
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (progressRef.current >= COMPLETE_THRESHOLD) {
      void completePayment();
      return;
    }
    reset();
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    reset();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (blocked || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    void completePayment();
  }

  const thumbTravelCompensation = progress * ((THUMB_SIZE + 8) / 100);
  const fillRemainder = THUMB_SIZE - thumbTravelCompensation;

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={blocked ? -1 : 0}
      aria-disabled={blocked}
      aria-label={`${amountLabel} 등록 카드로 즉시 결제`}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      className={cn(
        "relative h-14 w-full select-none overflow-hidden rounded-[12px] bg-[#e8edf4] outline-none ring-offset-2 touch-none focus-visible:ring-2 focus-visible:ring-[#0f172a]",
        blocked ? "cursor-not-allowed opacity-65" : "cursor-grab active:cursor-grabbing",
      )}
    >
      <div
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 bg-[#0f172a]", !dragging && "transition-[width] duration-300")}
        style={{ width: `calc(${progress}% + ${fillRemainder}px)` }}
      />
      <div
        aria-hidden="true"
        className={cn(
          "absolute left-1 top-1 flex h-12 w-12 items-center justify-center rounded-[10px] bg-white text-[#0f172a] shadow-[0_4px_14px_rgba(15,23,42,0.18)]",
          !dragging && "transition-[left] duration-300",
        )}
        style={{ left: `calc(4px + ${progress}% - ${thumbTravelCompensation}px)` }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : progress >= COMPLETE_THRESHOLD ? (
          <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        )}
      </div>
      <p
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center pl-11 pr-3 text-[14px] font-bold transition-colors",
          progress > 48 ? "text-white" : "text-[#334155]",
        )}
      >
        {loading ? "등록 카드 결제 승인 중..." : `밀어서 ${amountLabel} 즉시결제`}
      </p>
    </div>
  );
}
