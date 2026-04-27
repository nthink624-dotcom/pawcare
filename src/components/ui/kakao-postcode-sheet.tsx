"use client";

import { useEffect, useRef, useState } from "react";

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

export default function KakaoPostcodeSheet({
  title = "주소 검색",
  description = "도로명이나 건물명으로 검색한 뒤 주소를 선택해 주세요.",
  initialQuery = "",
  onClose,
  onSelect,
}: KakaoPostcodeSheetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const initialQueryRef = useRef(initialQuery);
  const [frameHeight, setFrameHeight] = useState(460);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    initialQueryRef.current = initialQuery;
  }, [initialQuery]);

  useEffect(() => {
    let active = true;

    async function mountPostcode() {
      setLoading(true);
      setError(null);
      setFrameHeight(460);

      try {
        await loadKakaoPostcodeScript();

        if (!active || !containerRef.current || !window.daum?.Postcode) {
          return;
        }

        containerRef.current.innerHTML = "";

        const postcode = new window.daum.Postcode({
          oncomplete: (data: KakaoPostcodeData) => {
            if (!active) return;
            onSelectRef.current(buildKakaoPostcodeAddress(data));
          },
          onresize: (size) => {
            if (!active) return;
            setFrameHeight(Math.max(420, size.height));
          },
          width: "100%",
          height: "100%",
          animation: true,
          shorthand: false,
          maxSuggestItems: 8,
          pleaseReadGuide: 5,
        });

        postcode.embed(containerRef.current, {
          q: initialQueryRef.current.trim() || undefined,
          autoClose: true,
        });

        setLoading(false);
      } catch (mountError) {
        if (!active) return;
        setError(
          mountError instanceof Error
            ? mountError.message
            : "카카오 우편번호 서비스를 불러오지 못했습니다.",
        );
        setLoading(false);
      }
    }

    void mountPostcode();

    return () => {
      active = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-[430px] rounded-t-[28px] bg-white p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p>
          </div>
          <button type="button" className="text-sm font-semibold text-[var(--muted)]" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[#faf8f4]">
          <div ref={containerRef} className="w-full" style={{ height: `${frameHeight}px` }} />
          {loading ? (
            <div className="flex h-[460px] items-center justify-center px-6 text-sm font-medium text-[var(--muted)]">
              주소 검색 화면을 불러오는 중입니다.
            </div>
          ) : null}
          {error ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
              <p className="text-sm font-semibold text-[var(--text)]">주소 검색을 열지 못했어요.</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{error}</p>
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-[12px] leading-5 text-[var(--muted)]">
          주소를 선택하면 시트가 닫히고, 상세 주소는 아래 입력칸에 이어서 적을 수 있어요.
        </p>
      </div>
    </div>
  );
}
