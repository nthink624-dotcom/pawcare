"use client";

import { Clock, Copy, ExternalLink, Link2, MapPin, MessageCircle, Monitor, Navigation, Phone, Smartphone, Star, Store } from "lucide-react";
import { useMemo, useState } from "react";

import { AssetIcon, WebSurface } from "@/components/owner-web/owner-web-ui";
import type { BootstrapPayload } from "@/types/domain";

type CopyTarget = "url" | "message" | "naverUrl" | "naverPost" | "naverDirections";

function buildPublicBookingUrl(shopId: string) {
  if (typeof window === "undefined") {
    return `/s/${shopId}`;
  }

  return `${window.location.origin}/s/${shopId}`;
}

function buildShareMessage(shopName: string, phone: string | null | undefined, bookingUrl: string) {
  return [
    `안녕하세요. ${shopName}입니다.`,
    "",
    "예약은 아래 링크에서 신청해 주세요.",
    bookingUrl,
    phone ? "" : null,
    phone ? `문의: ${phone}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function buildNaverPlacePost(shopName: string, phone: string | null | undefined, bookingUrl: string) {
  return [
    `${shopName} 예약 안내`,
    "",
    "네이버 플레이스에서 확인하신 고객님도 아래 링크에서 바로 예약을 신청하실 수 있어요.",
    bookingUrl,
    "",
    "방문 전 예약 가능 시간과 매장 안내를 확인해 주세요.",
    phone ? `문의: ${phone}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

const naverDirectionsText = "간편 예약은 홈페이지 링크를 눌러주세요.";

const naverGuideScreenshots = [
  {
    step: "1",
    title: "기본정보에서 찾아오는길 확인",
    description: "정보 수정 화면에서 기본정보 탭을 열고, 업체 사진/상세 설명/찾아오는길 항목을 수정합니다.",
    src: "/images/naver-smartplace-pc-basic-info.png",
    alt: "네이버 스마트플레이스 기본정보 실제 화면",
  },
  {
    step: "2",
    title: "부가정보에서 홈페이지/SNS 확인",
    description: "부가정보 탭에서 홈페이지/SNS 항목을 찾아 펫매니저 예약 링크를 등록합니다.",
    src: "/images/naver-smartplace-pc-additional-info.png",
    alt: "네이버 스마트플레이스 부가정보 실제 화면",
  },
] as const;

export default function BookingLinkManagementScreen({
  initialData,
}: {
  initialData: BootstrapPayload;
}) {
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const shop = initialData.shop;
  const bookingUrl = useMemo(() => buildPublicBookingUrl(shop.id), [shop.id]);
  const shareMessage = useMemo(() => buildShareMessage(shop.name, shop.phone, bookingUrl), [bookingUrl, shop.name, shop.phone]);
  const naverPlacePost = useMemo(() => buildNaverPlacePost(shop.name, shop.phone, bookingUrl), [bookingUrl, shop.name, shop.phone]);

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
    <div className="min-h-screen bg-white text-[#0f172a]">
      <main className="grid w-full gap-5 px-8 py-7 xl:grid-cols-[minmax(0,1fr)_350px]">
        <WebSurface className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#1f6b5b]">
                <Link2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[18px] font-semibold text-[#111827]">{shop.name}</p>
                <p className="mt-1 text-[15px] font-normal text-[#64748b]">고객 예약 링크</p>
              </div>
            </div>
            <span className="inline-flex h-8 items-center rounded-full bg-[#edf7f3] px-3 text-[15px] font-normal text-[#2f7866]">
              공개 중
            </span>
          </div>

          <div className="mt-5 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-3">
            <p className="break-all font-mono text-[15px] font-normal leading-6 text-[#111827]">{bookingUrl}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopy(bookingUrl, "url")}
              className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#1f6b5b] px-4 text-[15px] font-semibold text-white transition hover:bg-[#1b604f]"
            >
              <Copy className="h-4 w-4" />
              {copiedTarget === "url" ? "복사됨" : "링크 복사"}
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[15px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
            >
              <ExternalLink className="h-4 w-4" />
              고객 화면 열기
            </a>
          </div>

          <div className="mt-6 border-t border-[#edf2f7] pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <AssetIcon src="/icons/phosphor/MagnifyingGlass.svg" className="h-5 w-5 shrink-0 text-[#1f6b5b]" />
                  <p className="text-[15px] font-semibold text-[#111827]">네이버 플레이스에 노출하기</p>
                </div>
                <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
                  홈페이지/SNS에는 예약 링크를, 찾아오는길에는 간편 예약 안내 문구를 넣어 주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy(bookingUrl, "naverUrl")}
                className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
              >
                <Copy className="h-4 w-4" />
                {copiedTarget === "naverUrl" ? "복사됨" : "예약 URL 복사"}
              </button>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
              <NaverPlacePreview
                shopName={shop.name}
                phone={shop.phone}
                address={shop.address}
                bookingUrl={bookingUrl}
              />

              <div className="grid gap-3">
                <div className="rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-4">
                  <p className="text-[13px] font-semibold text-[#334155]">1. 홈페이지/SNS 입력칸</p>
                  <p className="mt-2 break-all font-mono text-[14px] leading-6 text-[#111827]">{bookingUrl}</p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-[8px] border border-[#dbe2ea] bg-white p-4">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-[#1f6b5b]" />
                      <p className="text-[13px] font-semibold text-[#334155]">PC에서 예약 링크 등록</p>
                    </div>
                    <ol className="mt-3 space-y-1.5 text-[13px] leading-5 text-[#475569]">
                      <li>1. 네이버 스마트플레이스 접속</li>
                      <li>2. 내 업체 선택</li>
                      <li>3. 정보 수정 클릭</li>
                      <li>4. 부가정보 열기</li>
                      <li>5. 홈페이지/SNS에 예약 링크 붙여넣기</li>
                    </ol>
                  </div>

                  <div className="rounded-[8px] border border-[#dbe2ea] bg-white p-4">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-[#1f6b5b]" />
                      <p className="text-[13px] font-semibold text-[#334155]">모바일에서 예약 링크 등록</p>
                    </div>
                    <ol className="mt-3 space-y-1.5 text-[13px] leading-5 text-[#475569]">
                      <li>1. 스마트플레이스센터 앱 실행</li>
                      <li>2. 내 업체 선택</li>
                      <li>3. 정보 수정 선택</li>
                      <li>4. 부가정보 열기</li>
                      <li>5. 홈페이지/SNS에 예약 링크 붙여넣기</li>
                    </ol>
                  </div>
                </div>

                <div className="rounded-[8px] border border-[#dbe2ea] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#1f6b5b]" />
                      <p className="text-[13px] font-semibold text-[#334155]">찾아오는길에 넣을 문구</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopy(naverDirectionsText, "naverDirections")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedTarget === "naverDirections" ? "복사됨" : "문구 복사"}
                    </button>
                  </div>
                  <div className="mt-3 rounded-[8px] bg-[#f8fafc] px-3 py-2.5">
                    <p className="text-[14px] leading-6 text-[#111827]">{naverDirectionsText}</p>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-[8px] border border-[#edf2f7] px-3 py-3">
                      <p className="text-[12px] font-semibold text-[#334155]">PC 경로</p>
                      <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
                        정보 수정 &gt; 기본정보 &gt; 업체 사진, 상세 설명, 찾아오는길
                      </p>
                    </div>
                    <div className="rounded-[8px] border border-[#edf2f7] px-3 py-3">
                      <p className="text-[12px] font-semibold text-[#334155]">모바일 경로</p>
                      <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
                        스마트플레이스센터 앱 &gt; 정보 수정 &gt; 기본정보 &gt; 찾아오는길
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[8px] border border-[#dbe2ea] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#334155]">이미지로 따라하기</p>
                      <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
                        네이버 화면에서 눌러야 할 위치를 예시 이미지로 표시했습니다.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#edf7f3] px-2.5 py-1 text-[12px] font-medium text-[#1f6b5b]">
                      오너 안내용
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {naverGuideScreenshots.map((screenshot) => (
                      <NaverGuideCard key={screenshot.step} {...screenshot} />
                    ))}
                  </div>

                  <p className="mt-3 text-[12px] leading-5 text-[#94a3b8]">
                    위 이미지는 네이버 공식 고객센터에 공개된 실제 PC 화면입니다. 실제 네이버 화면은 계정, 업종, 업데이트에 따라 조금 다를 수 있습니다.
                  </p>
                </div>

                <div className="rounded-[8px] border border-[#dbe2ea] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-[#334155]">2. 소식/업체 설명용 문구</p>
                    <button
                      type="button"
                      onClick={() => void handleCopy(naverPlacePost, "naverPost")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedTarget === "naverPost" ? "복사됨" : "문구 복사"}
                    </button>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-[14px] leading-6 text-[#334155]">{naverPlacePost}</p>
                </div>

                <div className="rounded-[8px] border border-[#e8eef5] bg-white px-4 py-3">
                  <p className="text-[13px] leading-6 text-[#64748b]">
                    핵심은 홈페이지/SNS에 예약 링크를 등록하고, 찾아오는길에 &quot;간편 예약은 홈페이지 링크를 눌러주세요.&quot;를 함께 넣는 것입니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-[#edf2f7] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <MessageCircle className="h-4 w-4 shrink-0 text-[#1f6b5b]" />
                <p className="text-[15px] font-semibold text-[#111827]">고객에게 보낼 안내문</p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy(shareMessage, "message")}
                className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
              >
                <Copy className="h-4 w-4" />
                {copiedTarget === "message" ? "복사됨" : "안내문 복사"}
              </button>
            </div>
            <div className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] p-4">
              <p className="whitespace-pre-line text-[15px] font-normal leading-7 text-[#334155]">{shareMessage}</p>
            </div>
          </div>
        </WebSurface>

        <WebSurface className="p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-[#111827]">고객 화면 미리보기</p>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-[12px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              열기
            </a>
          </div>

          <div className="mt-3 overflow-hidden rounded-[16px] border border-[#dbe2ea] bg-[#f8fafc] p-1.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
            <div className="mx-auto h-[568px] w-full max-w-[320px] overflow-hidden rounded-[13px] border border-[#e2e8f0] bg-white">
              <iframe
                title="고객 예약 페이지 미리보기"
                src={bookingUrl}
                className="border-0 bg-white"
                style={{
                  width: 430,
                  height: 764,
                  transform: "scale(0.744)",
                  transformOrigin: "top left",
                }}
              />
            </div>
          </div>
        </WebSurface>
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

function NaverGuideCard({ step, title, description, src, alt }: { step: string; title: string; description: string; src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[#edf2f7] bg-[#fbfcfd]">
      <div className="flex items-center justify-between border-b border-[#edf2f7] bg-white px-3 py-2">
        <span className="text-[12px] font-semibold text-[#1f6b5b]">실제 화면</span>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#edf7f3] px-1.5 text-[11px] font-semibold text-[#1f6b5b]">
          {step}
        </span>
      </div>

      <div className="p-3">
        <div className="overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white">
          <img src={src} alt={alt} className="block h-auto w-full" />
        </div>
        <p className="mt-3 text-[14px] font-semibold text-[#111827]">{title}</p>
        <p className="mt-1 text-[12px] leading-5 text-[#64748b]">{description}</p>
      </div>
    </div>
  );
}
