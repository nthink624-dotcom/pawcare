"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  buildKakaoPostcodeAddress,
  loadKakaoPostcodeScript,
  type KakaoPostcodeData,
  type KakaoPostcodeSelection,
} from "@/lib/address/kakao-postcode";

type KakaoPostcodeSheetProps = {
  title?: string;
  description?: string;
  initialQuery?: string;
  onClose: () => void;
  onSelect: (selection: KakaoPostcodeSelection) => void;
};

type PostcodeViewportBaseline = {
  width: number;
  height: number;
};

function resolvePostcodeViewportFrame({
  viewportHeight,
  viewportWidth,
  offsetTop,
  layoutHeight,
  screenHeight,
  previousBaseline,
}: {
  viewportHeight: number;
  viewportWidth: number;
  offsetTop: number;
  layoutHeight: number;
  screenHeight: number;
  previousBaseline: PostcodeViewportBaseline;
}) {
  const height = Math.max(1, Math.round(viewportHeight));
  const width = Math.max(1, Math.round(viewportWidth));
  const compactScreenBaseline = height < 560 && screenHeight - height > 80 ? screenHeight : 0;
  const currentFullHeight = Math.max(height, Math.round(layoutHeight), Math.round(compactScreenBaseline));
  const orientationChanged = previousBaseline.width > 0 && Math.abs(previousBaseline.width - width) > 80;
  const baseline = {
    width,
    height: orientationChanged ? currentFullHeight : Math.max(previousBaseline.height, currentFullHeight),
  };

  return {
    height,
    offsetTop: Math.max(0, Math.round(offsetTop)),
    keyboardVisible: baseline.height - height > 80,
    baseline,
  };
}

export default function KakaoPostcodeSheet({
  title = "주소 검색",
  description = "도로명이나 건물명으로 검색한 뒤 기본 주소를 선택해 주세요.",
  initialQuery = "",
  onClose,
  onSelect,
}: KakaoPostcodeSheetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const initialQueryRef = useRef(initialQuery);
  const viewportBaselineRef = useRef<PostcodeViewportBaseline>({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [viewportFrame, setViewportFrame] = useState<{ height: number | null; offsetTop: number }>({
    height: null,
    offsetTop: 0,
  });

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    initialQueryRef.current = initialQuery;
  }, [initialQuery]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const nextFrame = resolvePostcodeViewportFrame({
        viewportHeight: viewport?.height ?? window.innerHeight,
        viewportWidth: viewport?.width ?? window.innerWidth,
        offsetTop: viewport?.offsetTop ?? 0,
        layoutHeight: window.innerHeight,
        screenHeight: window.screen?.availHeight ?? 0,
        previousBaseline: viewportBaselineRef.current,
      });
      viewportBaselineRef.current = nextFrame.baseline;
      setKeyboardVisible(nextFrame.keyboardVisible);
      setViewportFrame({ height: nextFrame.height, offsetTop: nextFrame.offsetTop });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    return () => {
      window.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const container = containerRef.current;

    async function mountPostcode() {
      setLoading(true);
      setError(null);

      try {
        await loadKakaoPostcodeScript();

        if (!active || !container || !window.daum?.Postcode) {
          return;
        }

        container.innerHTML = "";

        const postcode = new window.daum.Postcode({
          oncomplete: (data: KakaoPostcodeData) => {
            if (!active) return;
            onSelectRef.current(buildKakaoPostcodeAddress(data));
          },
          width: "100%",
          height: "100%",
          animation: true,
          shorthand: false,
          maxSuggestItems: 8,
          pleaseReadGuide: 5,
        });

        postcode.embed(container, {
          q: initialQueryRef.current.trim() || undefined,
          autoClose: true,
        });

        setLoading(false);
      } catch (mountError) {
        if (!active) return;
        setError(mountError instanceof Error ? mountError.message : "주소 검색 화면을 불러오지 못했어요.");
        setLoading(false);
      }
    }

    void mountPostcode();

    return () => {
      active = false;
      if (container) {
        container.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, []);

  return (
    <div
      className="fixed inset-x-0 z-50 flex items-end justify-center bg-black/30"
      style={viewportStyle}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="kakao-postcode-viewport"
      data-keyboard-visible={keyboardVisible ? "true" : "false"}
    >
      <div
        className="flex max-h-[calc(100vh-12px)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200" />

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[var(--text)]">{title}</h3>
              <p className="mt-1 text-[13px] font-normal leading-5 text-[var(--muted)]">{description}</p>
            </div>
            <button type="button" className="text-[14px] font-medium leading-5 tracking-[-0.005em] text-[var(--muted)]" onClick={onClose}>
              닫기
            </button>
          </div>

          <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[#faf8f4]">
            <div ref={containerRef} className="w-full" style={{ height: `${frameHeight}px` }} />
            {loading ? (
              <div className="flex h-[460px] items-center justify-center px-6 text-[14px] font-medium leading-5 text-[var(--muted)]">
                주소 검색 화면을 불러오는 중이에요.
              </div>
            ) : null}
            {error ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
                <p className="text-[16px] font-semibold leading-6 tracking-[-0.01em] text-[var(--text)]">주소 검색을 열지 못했어요.</p>
                <p className="mt-2 text-[13px] font-normal leading-5 text-[var(--muted)]">{error}</p>
              </div>
            ) : null}
          </div>

          <p className="mt-3 text-[13px] font-normal leading-5 text-[var(--muted)]">
            주소를 선택하면 이 창이 닫히고, 매장 기본 정보에서 상세주소를 이어서 입력할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}
