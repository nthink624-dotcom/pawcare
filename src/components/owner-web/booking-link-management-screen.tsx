"use client";

import { Clock, Copy, ExternalLink, Link2, MapPin, Navigation, Phone, Star, Store } from "lucide-react";
import { useMemo, useState } from "react";

import { BookingLinkNaverGuide } from "./booking-link-naver-guide";

import { AssetIcon } from "@/components/owner-web/owner-web-ui";
import {
  OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS,
  OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS,
} from "@/components/owner-web/owner-web-action-button-styles";
import type { BootstrapPayload } from "@/types/domain";

type CopyTarget = "url" | "naverUrl" | "naverDirections";

function buildPublicBookingUrl(shopId: string) {
  if (typeof window === "undefined") {
    return `/s/${shopId}`;
  }

  return `${window.location.origin}/s/${shopId}`;
}

const naverDirectionsText = "간편 예약은 홈페이지 링크를 눌러주세요.";

export default function BookingLinkManagementScreen({
  initialData,
}: {
  initialData: BootstrapPayload;
}) {
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const shop = initialData.shop;
  const bookingUrl = useMemo(() => buildPublicBookingUrl(shop.id), [shop.id]);
  async function handleCopy(value: string, target: CopyTarget) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget(null), 1600);
    } catch {
      setCopiedTarget(null);
    }
  }

  return (
    <div className="h-full min-h-0 min-w-0 overflow-y-auto text-[#0f172a]">
      <main className="min-w-0 w-full">
        <section
          data-booking-link-main-surface
          className="min-w-0 overflow-hidden rounded-[14px] border border-[#e8edf3] bg-white"
        >
          <header className="min-w-0 px-3 py-3 sm:px-4 sm:py-4">
            <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
              <div className="flex min-w-0 w-full items-center gap-3 sm:w-auto">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#1f6b5b]">
                  <Link2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#111827]">{shop.name}</p>
                  <p className="mt-1 text-[14px] font-normal leading-5 text-[#64748b]">고객 예약 링크</p>
                </div>
              </div>
              <div className="flex w-full shrink-0 flex-col flex-wrap gap-2 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleCopy(bookingUrl, "url")}
                  className={`${OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS} w-full sm:w-auto`}
                >
                  <Copy className="h-4 w-4" />
                  {copiedTarget === "url" ? "복사됨" : "링크 복사"}
                </button>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS} w-full sm:w-auto`}
                >
                  <ExternalLink className="h-4 w-4" />
                  고객 화면 열기
                </a>
              </div>
            </div>

            <div className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2.5">
              <p className="break-all font-mono text-[14px] font-normal leading-5 text-[#111827]">{bookingUrl}</p>
            </div>
          </header>

          <section className="min-w-0 border-t border-[#e8edf3] px-3 py-4 sm:px-4 sm:py-5">
            <div className="flex items-center gap-2">
              <AssetIcon src="/icons/phosphor/MagnifyingGlass.svg" className="h-5 w-5 shrink-0 text-[#1f6b5b]" />
              <p className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#111827]">예약 링크 노출 가이드</p>
            </div>

            <section data-booking-link-channel="naver" className="mt-4 min-w-0 border-t border-[#e8edf3] pt-4">
              <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
                <p className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#111827]">네이버</p>
                <button
                  type="button"
                  onClick={() => void handleCopy(bookingUrl, "naverUrl")}
                  className={OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS}
                >
                  <Copy className="h-4 w-4" />
                  {copiedTarget === "naverUrl" ? "복사됨" : "예약 URL 복사"}
                </button>
              </div>

              <div className="mt-4 grid min-w-0 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
                <NaverPlacePreview
                  shopName={shop.name}
                  phone={shop.phone}
                  address={shop.address}
                  bookingUrl={bookingUrl}
                />

                <BookingLinkNaverGuide
                  bookingUrl={bookingUrl}
                  directionsText={naverDirectionsText}
                  copied={copiedTarget === "naverDirections"}
                  onCopy={() => void handleCopy(naverDirectionsText, "naverDirections")}
                />
              </div>
            </section>
          </section>
        </section>
      </main>
    </div>
  );
}

function NaverPlacePreview({
  shopName,
  phone,
  address,
  bookingUrl,
}: {
  shopName: string;
  phone: string | null | undefined;
  address: string;
  bookingUrl: string;
}) {
  return (
    <div className="w-full max-w-[300px] overflow-hidden rounded-[16px] border border-[#dbe2ea] bg-white text-[#111827] shadow-[0_10px_20px_rgba(15,23,42,0.08)]">
      <div className="grid h-[118px] grid-cols-[1.45fr_0.85fr] gap-px bg-[#e5e7eb]">
        <div
          className="bg-cover bg-center"
          style={{ backgroundImage: "url('/images/customer-booking-hero-storefront.png')" }}
        />
        <div className="grid grid-rows-2 gap-px">
          <div
            className="bg-cover bg-center"
            style={{ backgroundImage: "url('/images/customer-booking-hero-retriever-bath.jpg')" }}
          />
          <div
            className="relative bg-cover bg-center"
            style={{ backgroundImage: "url('/images/customer-booking-hero-original.jpg')" }}
          >
            <div className="absolute inset-0 bg-black/24" />
            <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold text-white">
              더보기
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="space-y-3.5 text-[14px] leading-[1.45]">
          <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
            <MapPin className="mt-0.5 h-[18px] w-[18px] text-[#c8c8c8]" fill="currentColor" strokeWidth={0} />
            <div>
              <p className="text-[#222222]">
                {address || "경기 수원시 권선구 하탑로34번길 18 1층"} <span className="text-[#777]">⌄</span> <span className="text-[#0b73d9]">지도 · 내비게이션 · 거리뷰</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
            <Navigation className="mt-0.5 h-[18px] w-[18px] text-[#9aa4b2]" strokeWidth={1.8} />
            <p className="font-semibold text-[#222222]">{naverDirectionsText}</p>
          </div>

          <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
            <Clock className="mt-0.5 h-[18px] w-[18px] text-[#c8c8c8]" fill="currentColor" strokeWidth={0} />
            <p className="text-[#222222]">
              영업 종료 · <span>10:00에 영업 시작</span> <span className="text-[#777]">⌄</span>
            </p>
          </div>

          <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
            <Phone className="mt-0.5 h-[18px] w-[18px] text-[#c8c8c8]" fill="currentColor" strokeWidth={0} />
            <p className="text-[#222222]">
              {phone || "0507-0000-0000"} <span className="text-[#94a3b8]">ⓘ</span> <span className="text-[#0b73d9]">복사</span>
            </p>
          </div>

          <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
            <Store className="mt-0.5 h-[18px] w-[18px] text-[#c8c8c8]" fill="currentColor" strokeWidth={0} />
            <div className="space-y-1 text-[#222222]">
              <div className="flex justify-between gap-3 border-b border-dotted border-[#e5e7eb] pb-1">
                <span>소형견 전체미용</span>
                <span className="font-semibold">35,000원</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-dotted border-[#e5e7eb] pb-1">
                <span>소형견 4kg 이상부터 변동</span>
                <span className="font-semibold">변동</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-dotted border-[#e5e7eb] pb-1">
                <span>중형견 전체미용</span>
                <span className="font-semibold">40,000원</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-dotted border-[#e5e7eb] pb-1">
                <span>중형견 4kg이상부터 변동</span>
                <span className="font-semibold">변동</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-dotted border-[#e5e7eb] pb-1">
                <span>길이추가</span>
                <span className="font-semibold">변동</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-dotted border-[#e5e7eb] pb-1">
                <span>얼굴컷(추가)</span>
                <span className="font-semibold">변동</span>
              </div>
              <p className="pt-0.5 text-[#0b73d9]">가격표 이미지로 보기</p>
            </div>
          </div>

          <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
            <GlobeIcon />
            <div>
              <p className="break-all text-[14px] text-[#006bd6]">{bookingUrl}</p>
            </div>
          </div>

          <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
            <Store className="mt-0.5 h-[18px] w-[18px] text-[#c8c8c8]" fill="currentColor" strokeWidth={0} />
            <p className="text-[#222222]">반려동물 동반, 무선 인터넷, 주차</p>
          </div>
        </div>

        <div className="mt-4 border-t border-[#eef2f7] pt-3 text-center">
          <span className="inline-flex rounded-full bg-[#f5f5f5] px-5 py-2 text-[13px] font-medium text-[#333333]">
            정보 더보기
          </span>
        </div>
      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] text-[#c8c8c8]">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 12h18M12 3c2.4 2.6 3.6 5.6 3.6 9S14.4 18.4 12 21M12 3C9.6 5.6 8.4 8.6 8.4 12S9.6 18.4 12 21" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}
