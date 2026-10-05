"use client";

import { Copy, ExternalLink, Link2, Phone, Navigation, ChevronLeft, ChevronDown, Star, Share2, Bell } from "lucide-react";
import { useMemo, useState } from "react";

import { BookingLinkNaverGuide, NAVER_PRICE_NOTICE_EXAMPLES } from "./booking-link-naver-guide";

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

const naverDirectionsText = "간편예약은 아래 파란색 URL을 눌러주세요.";
const smartPlaceUrl = "https://smartplace.naver.com/";

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
          className="min-w-0 rounded-[14px] border border-[#e8edf3] bg-white"
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
                  {copiedTarget === "url" ? "복사됨" : "예약 링크 복사"}
                </button>
                <a
                  href={smartPlaceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS} w-full sm:w-auto`}
                >
                  <ExternalLink className="h-4 w-4" />
                  스마트플레이스 열기
                </a>
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

              <div className="mt-4 grid min-w-0 items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                <aside data-naver-phone-preview className="mx-auto w-full max-w-[300px] lg:sticky lg:top-4 lg:self-start">
                  <NaverPlacePreview shop={shop} bookingUrl={bookingUrl} />
                </aside>

                <BookingLinkNaverGuide
                  bookingUrl={bookingUrl}
                  directionsText={naverDirectionsText}
                  smartPlaceUrl={smartPlaceUrl}
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

function NaverPlacePreview({ shop, bookingUrl }: { shop: BootstrapPayload["shop"]; bookingUrl: string }) {
  const settings = shop.customer_page_settings;
  const shopPhotos = (settings.hero_image_urls?.length ? settings.hero_image_urls : [settings.hero_image_url]).filter(Boolean).slice(0, 2);
  const usingExamplePhoto = shopPhotos.length === 0;
  const photos = usingExamplePhoto ? ["/images/booking-link-grooming-preview-ai.png"] : shopPhotos;
  const iconClass = "mt-[3px] h-[18px] w-[18px] shrink-0 text-[#bfc3cb]";
  return (
    <figure className="m-0 text-center">
      <div className="relative mx-auto aspect-[823/1677]" style={{ width: "min(300px, calc((100dvh - 170px) * 823 / 1677))" }}>
        <div className="absolute inset-x-[4.65%] bottom-[1.65%] top-[1.95%] overflow-hidden rounded-[12%/6%] bg-white">
          <svg viewBox="0 0 390 844" preserveAspectRatio="none" className="h-full w-full" aria-label="내 매장의 네이버 화면 구성 예시">
            <foreignObject width="390" height="844">
              <div data-naver-preview-canvas className="relative flex h-[844px] w-[390px] flex-col bg-white text-left text-[16px] font-normal leading-6 tracking-[-0.3px]" style={{ fontFamily: 'Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' }}>
          <div aria-hidden="true" className="flex h-11 shrink-0 items-center justify-between px-5 pt-2 text-[14px] font-medium"><span>9:41</span><span>••• ▰</span></div>
          <div className="flex h-12 shrink-0 items-center justify-between px-4"><ChevronLeft aria-hidden="true" className="h-7 w-7" /><span className="min-w-0 truncate text-[18px] font-semibold">{shop.name}</span><Star aria-hidden="true" className="h-7 w-7" /></div>
          <div data-naver-preview-content className="min-h-0 flex-1 overflow-y-auto pb-8 text-[#333333]">
            <div className="px-4 pb-5 pt-3"><h3 className="text-[24px] font-semibold leading-8">{shop.name}</h3><p className="mt-2 text-[#8f8f8f]">반려동물미용</p></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="relative mx-4 flex h-[206px] gap-1 overflow-hidden rounded-[14px]">{photos.map((photo, index) => <img key={`${photo}-${index}`} src={photo} alt={usingExamplePhoto ? "강아지를 빗질하는 반려동물 미용 예시 사진" : `${shop.name} 매장 사진 ${index + 1}`} className="h-full min-w-0 flex-1 object-cover" />)}{usingExamplePhoto && <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[12px] leading-5 text-white">예시 사진</span>}</div>
            <div aria-hidden="true" className="flex gap-2 overflow-hidden px-4 py-4 text-[#1677ff]">{[[Navigation, "길찾기"], [Share2, "공유"], [Phone, "전화"], [Bell, "알림"]].map(([Icon, label]) => { const RowIcon = Icon as typeof Navigation; return <span key={String(label)} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#e9f1ff] px-3"><RowIcon className="h-5 w-5" />{String(label)}</span>; })}</div>
            <div aria-hidden="true" className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-[#eeeeee] bg-white px-4 text-[#8f8f8f]"><span className="flex h-full items-center border-b-2 border-[#222222] font-semibold text-[#222222]">홈</span><span>소식</span><span>리뷰</span><span>사진</span><span>지도</span><span>정보</span></div>
            <div className="space-y-4 px-4 py-4">
              <div className="flex items-start gap-2"><NaverInfoIcon kind="pin" className={iconClass} /><p className="min-w-0">{shop.address || "매장 주소 미등록"} <ChevronDown aria-hidden="true" className="inline h-3 w-3 text-[#8f8f8f]" /><span className="text-[#0068c3]"> 지도 · 내비게이션 · 거리뷰</span></p></div>
              <div className="flex items-start gap-2"><NaverInfoIcon kind="directions" className={iconClass} /><p>{naverDirectionsText}</p></div>
              <div className="flex items-start gap-2"><NaverInfoIcon kind="clock" className={iconClass} /><p>{settings.operating_hours_note || "영업시간 정보 미등록"} <ChevronDown aria-hidden="true" className="inline h-3 w-3 text-[#8f8f8f]" /></p></div>
              <div className="flex items-start gap-2"><NaverInfoIcon kind="phone" className={iconClass} /><p>{shop.phone || "전화번호 미등록"} <span className="text-[#0068c3]">복사</span></p></div>
              <div className="flex items-start gap-2"><NaverInfoIcon kind="price" className={iconClass} /><div className="min-w-0 flex-1 space-y-1">{NAVER_PRICE_NOTICE_EXAMPLES.map(notice => <div key={notice} className="flex items-baseline gap-1"><span>{notice}</span><span className="min-w-2 flex-1 border-b border-dotted border-[#e5e5e5]" /><span className="shrink-0">무료</span></div>)}<p className="pt-1 text-[#0068c3]">가격표 이미지로 보기</p></div></div>
              <div className="flex items-start gap-2"><NaverInfoIcon kind="globe" className={iconClass} /><a href={bookingUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-[#0068c3] focus-visible:outline-2 focus-visible:outline-blue-600"><span className="block truncate">{bookingUrl}</span><span className="block">예약</span></a></div>
              {settings.parking_notice && <div className="flex items-start gap-2"><NaverInfoIcon kind="price" className={iconClass} /><p>{settings.parking_notice}</p></div>}
              <div aria-hidden="true" className="flex items-center gap-2 pt-1"><span className="h-px flex-1 bg-[#eeeeee]" /><span className="rounded-full bg-[#f6f6f6] px-4 py-2">정보 더보기 ›</span><span className="h-px flex-1 bg-[#eeeeee]" /></div>
            </div>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/2 h-1 w-1/3 -translate-x-1/2 rounded-full bg-[#111827]" />
              </div>
            </foreignObject>
          </svg>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/iphone-14-pro-phone-template.svg" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      <figcaption className="mt-3 text-[16px] leading-6 text-[#64748b]"><p className="font-medium text-[#111827]">내 매장 등록 미리보기</p><p>휴대폰 안에서도 아래로 내려볼 수 있어요.</p></figcaption>
    </figure>
  );
}

function NaverInfoIcon({ kind, className }: { kind: string; className: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
    {kind === "pin" ? <><path fill="currentColor" d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8Z" /><circle cx="12" cy="10" r="2.5" fill="white" /></> : kind === "clock" ? <><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="M12 5v7l4 2" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" /></> : kind === "globe" ? <><circle cx="12" cy="12" r="11" fill="currentColor" /><ellipse cx="12" cy="12" rx="4" ry="11" fill="none" stroke="white" strokeWidth="1.4" /><path d="M1 12h22" stroke="white" strokeWidth="1.4" /></> : kind === "price" ? <><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="m5 7 3 10 4-10 4 10 3-10M4 11h16" fill="none" stroke="white" strokeWidth="1.5" /></> : kind === "phone" ? <path fill="currentColor" d="M4 2 2 5c0 8 9 17 17 17l3-2-5-6-3 2c-3-1-5-3-6-6l2-3-6-5Z" /> : <path d="M5 21V9h12M12 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>;
}
