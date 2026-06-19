"use client";

import { Clock, Copy, ExternalLink, Link2, MapPin, Navigation, Phone, Star, Store } from "lucide-react";
import { useMemo, useState } from "react";

import { AssetIcon, WebSurface } from "@/components/owner-web/owner-web-ui";
import type { BootstrapPayload } from "@/types/domain";

type CopyTarget = "url" | "naverUrl" | "naverDirections";

function buildPublicBookingUrl(shopId: string) {
  if (typeof window === "undefined") {
    return `/s/${shopId}`;
  }

  return `${window.location.origin}/s/${shopId}`;
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
    <div className="h-full min-h-0 overflow-y-auto text-[#0f172a]">
      <main className="grid w-full gap-3">
        <WebSurface className="p-3">
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

          <div className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2.5">
            <p className="break-all font-mono text-[15px] font-normal leading-6 text-[#111827]">{bookingUrl}</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
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

          <div className="mt-4 border-t border-[#edf2f7] pt-4">
            <div className="flex items-center gap-2">
              <AssetIcon src="/icons/phosphor/MagnifyingGlass.svg" className="h-5 w-5 shrink-0 text-[#1f6b5b]" />
              <p className="text-[16px] font-semibold text-[#111827]">예약 링크 노출 가이드</p>
            </div>

            <div className="mt-3 grid gap-4">
              <section className="rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[17px] font-semibold text-[#111827]">네이버</p>
                  <button
                    type="button"
                    onClick={() => void handleCopy(bookingUrl, "naverUrl")}
                    className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedTarget === "naverUrl" ? "복사됨" : "예약 URL 복사"}
                  </button>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <NaverPlacePreview
                    shopName={shop.name}
                    phone={shop.phone}
                    address={shop.address}
                    bookingUrl={bookingUrl}
                  />

                  <div className="grid items-start gap-3 xl:grid-cols-2">
                    <div className="rounded-[8px] border border-[#dbe2ea] bg-white p-3">
                      <SmartPlaceScreenshotGuidePlaceholder bookingUrl={bookingUrl} />
                    </div>

                    <div className="rounded-[8px] border border-[#dbe2ea] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[#1f6b5b]" />
                          <p className="text-[16px] font-semibold text-[#111827]">찾아오는길에 문구 넣는법</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopy(naverDirectionsText, "naverDirections")}
                          className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                        >
                          <Copy className="h-4 w-4" />
                          {copiedTarget === "naverDirections" ? "복사됨" : "문구 복사"}
                        </button>
                      </div>
                      <NaverDirectionsGuide text={naverDirectionsText} />
                    </div>
                  </div>
                </div>
              </section>

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

type SmartPlaceGuideVisualV2 = "search" | "result" | "business" | "infoTabs" | "urlButton" | "urlModal";

function SmartPlaceLinkGuideV2({ bookingUrl }: { bookingUrl: string }) {
  const steps: Array<{ title: string; description: string; visual: SmartPlaceGuideVisualV2 }> = [
    {
      title: "네이버 검색창에 스마트플레이스를 검색합니다.",
      description: "네이버 검색창에 스마트플레이스를 입력해 검색합니다.",
      visual: "search",
    },
    {
      title: "네이버 스마트플레이스를 클릭합니다.",
      description: "검색 결과에서 네이버 스마트플레이스 항목을 클릭합니다.",
      visual: "result",
    },
    {
      title: "내 업체를 클릭합니다.",
      description: "스마트플레이스에 들어가면 내 업체 목록이 보입니다. 업체명을 클릭해 관리 화면으로 들어갑니다.",
      visual: "business",
    },
    {
      title: "업체정보를 누른 뒤 부가정보를 클릭합니다.",
      description: "좌측 사이드바의 업체정보가 1번, 상단 탭의 부가정보가 2번입니다.",
      visual: "infoTabs",
    },
    {
      title: "맨 아래에서 URL 추가를 누릅니다.",
      description: "부가정보 화면을 아래로 내려 URL 추가 버튼을 클릭합니다.",
      visual: "urlButton",
    },
    {
      title: "예약을 선택하고 우리 링크를 추가합니다.",
      description: `분류에서 예약을 선택한 뒤 ${bookingUrl} 을 붙여넣고 추가하기를 누릅니다.`,
      visual: "urlModal",
    },
  ];

  return (
    <section className="mt-3 rounded-[10px] border border-[#dbe2ea] bg-white">
      <div className="border-b border-[#edf2f7] px-3 py-3">
        <p className="text-[14px] font-semibold text-[#111827]">스마트플레이스 예약 링크 등록 가이드</p>
        <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
          캡처처럼 보이는 화면을 보고 같은 위치를 따라 누르면 됩니다. 빨간 표시가 눌러야 하는 곳입니다.
        </p>
      </div>

      <div className="space-y-4 p-3">
        {steps.map((step, index) => (
          <SmartPlaceGuideStepV2 key={`${index}-${step.title}`} step={index + 1} bookingUrl={bookingUrl} {...step} />
        ))}
      </div>
    </section>
  );
}

type SmartPlaceImageGuideStep = {
  title: string;
  description: string;
  src: string;
  alt: string;
  markers: string[];
};

function SmartPlaceScreenshotGuidePlaceholder({ bookingUrl }: { bookingUrl: string }) {
  const steps: SmartPlaceImageGuideStep[] = [
    {
      title: "스마트플레이스를 검색합니다.",
      description: "네이버 검색창에서 스마트플레이스를 검색합니다.",
      src: "/images/naver-smartplace-guide-search.png",
      alt: "네이버 검색창에 스마트플레이스를 검색하는 화면",
      markers: ["left-[7%] top-[11%] h-[67%] w-[23%]", "left-[93%] top-[14%] h-[64%] w-[5%]"],
    },
    {
      title: "검색 결과를 클릭합니다.",
      description: "검색 결과에서 네이버 스마트플레이스를 클릭합니다.",
      src: "/images/naver-smartplace-guide-result.png",
      alt: "네이버 스마트플레이스 검색 결과 화면",
      markers: ["left-[3%] top-[39%] h-[21%] w-[31%]"],
    },
    {
      title: "내 업체를 선택합니다.",
      description: "예약 링크를 넣을 매장을 선택합니다.",
      src: "/images/naver-smartplace-guide-business.png",
      alt: "스마트플레이스 내 업체 목록 화면",
      markers: ["left-[3%] top-[34%] h-[53%] w-[94%]"],
    },
    {
      title: "업체정보 > 부가정보로 이동합니다.",
      description: "좌측 업체정보를 누르고 상단 부가정보 탭을 선택합니다.",
      src: "/images/naver-smartplace-guide-info-additional-marked.png",
      alt: "스마트플레이스 업체정보와 부가정보 탭 화면",
      markers: [],
    },
    {
      title: "+ URL 추가를 클릭합니다.",
      description: "부가정보 맨 아래의 + URL 추가 버튼을 클릭합니다.",
      src: "/images/naver-smartplace-guide-url-button.png",
      alt: "스마트플레이스 URL 추가 버튼 화면",
      markers: ["left-[4%] top-[46%] h-[30%] w-[78%]"],
    },
    {
      title: "예약 링크를 입력하고 추가합니다.",
      description: "분류는 예약을 선택하고 URL 입력칸에 예약 링크를 붙여넣습니다.",
      src: "/images/naver-smartplace-guide-url-modal.png",
      alt: "스마트플레이스 URL 추가 모달 화면",
      markers: [],
    },
    {
      title: "저장하기를 눌러 완료합니다.",
      description: "URL 추가 후 저장하기를 눌러야 네이버에 반영됩니다.",
      src: "/images/naver-smartplace-guide-save-button.png",
      alt: "스마트플레이스 저장하기 버튼 화면",
      markers: [],
    },
  ];

  return (
    <section className="mt-3">
      <p className="text-[16px] font-semibold text-[#111827]">간편 예약 링크 넣기</p>
      <p className="mt-1 text-[16px] leading-6 text-[#64748b]">
        스마트플레이스 &gt; 업체정보 &gt; 부가정보 &gt; 맨 아래 URL 등록
      </p>

      <div className="mt-4 space-y-4">
        {steps.map((step, index) => (
          <SmartPlaceImageGuideCard key={step.title} index={index + 1} step={step} />
        ))}
      </div>

      <div className="mt-4 rounded-[8px] border border-dashed border-[#dbe2ea] bg-[#f8fafc] px-3 py-3">
        <p className="text-[13px] font-semibold text-[#334155]">붙여넣을 예약 링크</p>
        <p className="mt-2 break-all font-mono text-[13px] leading-5 text-[#111827]">{bookingUrl}</p>
      </div>
    </section>
  );
}

function NaverDirectionsGuide({ text }: { text: string }) {
  const sharedSteps: SmartPlaceImageGuideStep[] = [
    {
      title: "스마트플레이스를 검색합니다.",
      description: "네이버 검색창에서 스마트플레이스를 검색합니다.",
      src: "/images/naver-smartplace-guide-search.png",
      alt: "네이버 검색창에 스마트플레이스를 검색하는 화면",
      markers: ["left-[7%] top-[11%] h-[67%] w-[23%]", "left-[93%] top-[14%] h-[64%] w-[5%]"],
    },
    {
      title: "검색 결과를 클릭합니다.",
      description: "검색 결과에서 네이버 스마트플레이스를 클릭합니다.",
      src: "/images/naver-smartplace-guide-result.png",
      alt: "네이버 스마트플레이스 검색 결과 화면",
      markers: ["left-[3%] top-[39%] h-[21%] w-[31%]"],
    },
    {
      title: "내 업체를 선택합니다.",
      description: "찾아오는길 문구를 넣을 매장을 선택합니다.",
      src: "/images/naver-smartplace-guide-business.png",
      alt: "스마트플레이스 내 업체 목록 화면",
      markers: ["left-[3%] top-[34%] h-[53%] w-[94%]"],
    },
  ];

  return (
    <div className="mt-3 space-y-4">
      {sharedSteps.map((step, index) => (
        <SmartPlaceImageGuideCard key={step.title} index={index + 1} step={step} />
      ))}

      <SmartPlaceImageGuideCard
        index={4}
        step={{
          title: "업체정보 > 기본정보로 이동합니다.",
          description: "좌측 업체정보를 누르고 상단 기본정보 탭을 선택합니다.",
          src: "/images/naver-smartplace-guide-basic-info-marked.png",
          alt: "스마트플레이스 업체정보와 기본정보 탭 화면",
          markers: [],
        }}
      />

      <SmartPlaceImageGuideCard
        index={5}
        step={{
          title: "찾아오는 길 설명 입력칸으로 이동합니다.",
          description: "찾아오는 길 설명 영역에 안내 문구를 작성합니다.",
          src: "/images/naver-smartplace-guide-directions-field.png",
          alt: "스마트플레이스 찾아오는 길 설명 입력칸 화면",
          markers: [],
        }}
      />

      <article className="overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white">
        <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-b border-[#111827] bg-[#111827] px-3 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/10 text-[16px] font-semibold text-white">
            6
          </span>
          <p className="text-[16px] font-semibold leading-7 text-white">아래 문구를 붙여넣습니다.</p>
        </div>
        <div className="bg-[#f8fafc] px-3 py-3">
          <p className="text-[16px] font-semibold leading-6 text-[#111827]">{text}</p>
        </div>
      </article>

      <SmartPlaceImageGuideCard
        index={7}
        step={{
          title: "저장하기를 눌러 완료합니다.",
          description: "문구 입력 후 저장하기를 눌러야 네이버에 반영됩니다.",
          src: "/images/naver-smartplace-guide-save-button.png",
          alt: "스마트플레이스 저장하기 버튼 화면",
          markers: [],
        }}
      />
    </div>
  );
}

function SmartPlaceImageGuideCard({ index, step }: { index: number; step: SmartPlaceImageGuideStep }) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white">
      <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-b border-[#111827] bg-[#111827] px-3 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/10 text-[16px] font-semibold text-white">
          {index}
        </span>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold leading-7 text-white">{step.title}</p>
        </div>
      </div>
      <div className="relative bg-white">
        <img
          src={step.src}
          alt={step.alt}
          className="block max-h-[360px] w-full bg-white object-contain"
        />
        {step.markers.map((marker) => (
          <span
            key={marker}
            className={`pointer-events-none absolute rounded-[6px] border-[4px] border-[#ef4444] shadow-[0_0_0_3px_rgba(239,68,68,0.16)] ${marker}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </article>
  );
}

function SmartPlaceGuideStepV2({
  step,
  title,
  description,
  visual,
  bookingUrl,
}: {
  step: number;
  title: string;
  description: string;
  visual: SmartPlaceGuideVisualV2;
  bookingUrl: string;
}) {
  return (
    <article className="rounded-[10px] border border-[#edf2f7] bg-[#fbfcfd]">
      <div className="overflow-hidden rounded-t-[10px] border-b border-[#edf2f7] bg-white">
        <SmartPlaceGuideVisualFrameV2 visual={visual} bookingUrl={bookingUrl} />
      </div>
      <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 px-3 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-[#334155] ring-1 ring-inset ring-[#dbe2ea]">
          {step}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#111827]">{title}</p>
          <p className="mt-1 text-[13px] leading-5 text-[#64748b]">{description}</p>
        </div>
      </div>
    </article>
  );
}

function RedGuideMarkV2({ className, label }: { className: string; label?: string }) {
  return (
    <span
      className={`pointer-events-none absolute rounded-[8px] border-[3px] border-[#ef4444] shadow-[0_0_0_3px_rgba(239,68,68,0.14)] ${className}`}
      aria-hidden="true"
    >
      {label ? (
        <span className="absolute -left-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#ef4444] text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(239,68,68,0.24)]">
          {label}
        </span>
      ) : null}
    </span>
  );
}

function SmartPlaceGuideVisualFrameV2({ visual, bookingUrl }: { visual: SmartPlaceGuideVisualV2; bookingUrl: string }) {
  if (visual === "search") return <SmartPlaceSearchCaptureV2 />;
  if (visual === "result") return <SmartPlaceResultCaptureV2 />;
  if (visual === "business") return <SmartPlaceBusinessCaptureV2 />;
  if (visual === "infoTabs") return <SmartPlaceInfoTabsCaptureV2 />;
  if (visual === "urlButton") return <SmartPlaceUrlButtonCaptureV2 />;
  return <SmartPlaceUrlModalCaptureV2 bookingUrl={bookingUrl} />;
}

function SmartPlaceSearchCaptureV2() {
  return (
    <div className="relative bg-white px-3 py-3">
      <div className="relative flex h-[58px] items-center rounded-[14px] border border-[#e5e7eb] bg-white px-4">
        <span className="mr-3 text-[30px] font-black leading-none text-[#03c75a]">N</span>
        <span className="border-b-2 border-[#111827] pb-1 text-[20px] font-semibold text-[#111827]">스마트플레이스</span>
        <span className="ml-auto text-[22px] text-[#03c75a]">⌕</span>
        <RedGuideMarkV2 className="left-[64px] top-[12px] h-[36px] w-[190px]" />
      </div>
    </div>
  );
}

function SmartPlaceResultCaptureV2() {
  return (
    <div className="relative bg-white px-3 py-3">
      <div className="relative rounded-[14px] border border-[#e5e7eb] bg-white p-4">
        <div className="flex items-center gap-2 text-[14px] text-[#475569]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e9fbf1] text-[13px] font-bold text-[#03a84e]">N</span>
          <span>네이버 스마트플레이스</span>
          <span className="text-[#64748b]">· new.smartplace.naver.com</span>
          <span className="ml-auto text-[#94a3b8]">⋮</span>
        </div>
        <p className="mt-3 text-[20px] font-semibold text-[#1d4ed8]">네이버 스마트플레이스</p>
        <p className="mt-2 text-[14px] leading-5 text-[#1d4ed8]">예약 주문 관리 · 내 업체 조회 · 업체 신규 등록 · 브랜드 관리 · 도움말</p>
        <p className="mt-2 text-[14px] text-[#334155]">우리 업체 사업의 시작, <span className="font-semibold">스마트플레이스</span></p>
        <RedGuideMarkV2 className="left-[16px] top-[48px] h-[34px] w-[210px]" />
      </div>
    </div>
  );
}

function SmartPlaceBusinessCaptureV2() {
  return (
    <div className="relative bg-white px-3 py-3">
      <p className="text-[22px] font-semibold text-[#111827]">내 업체<span className="text-[#03a84e]">1</span><span className="text-[#cbd5e1]">›</span></p>
      <div className="relative mt-4 flex items-center gap-5 rounded-[12px] border border-[#edf2f7] bg-white px-8 py-5">
        <span className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-[#12c973] text-white">
          <Store className="h-8 w-8" />
        </span>
        <span className="select-none text-[19px] font-semibold text-[#111827] blur-[4px]">사계에담다</span>
        <span className="text-[24px] text-[#cbd5e1]">›</span>
        <RedGuideMarkV2 className="left-[22px] top-[18px] h-[80px] w-[280px]" />
      </div>
    </div>
  );
}

function SmartPlaceInfoTabsCaptureV2() {
  return (
    <div className="relative grid min-h-[270px] grid-cols-[150px_minmax(0,1fr)] bg-white">
      <aside className="bg-[#252525] px-3 py-4 text-white">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#12c973]">
            <Store className="h-4 w-4" />
          </span>
          <span className="select-none truncate text-[13px] font-semibold blur-[3px]">사계에담다</span>
        </div>
        {["업체정보", "예약", "스마트콜", "마케팅", "리뷰", "고객"].map((item) => (
          <div key={item} className={`rounded-[7px] px-2 py-2.5 text-[13px] ${item === "업체정보" ? "bg-black/40 font-semibold" : "text-white/62"}`}>
            {item}
          </div>
        ))}
      </aside>
      <div className="min-w-0 bg-[#f7f8fb]">
        <div className="flex items-center gap-10 border-b border-[#dbe2ea] bg-white px-8 py-4 text-[17px]">
          <span className="pb-3 text-[#64748b]">기본정보</span>
          <span className="border-b-2 border-[#111827] pb-3 font-semibold text-[#111827]">부가정보</span>
          <span className="pb-3 text-[#64748b]">가격정보</span>
          <span className="pb-3 text-[#64748b]">휴무일·영업시간</span>
        </div>
        <div className="mx-auto mt-8 max-w-[520px] rounded-[14px] border border-[#e5e7eb] bg-white p-8">
          <p className="text-[20px] font-semibold leading-7 text-[#111827]">고객들이 우리 가게를<br />잘 이해할 수 있도록 부가 정보를<br />상세하게 알려주세요.</p>
        </div>
      </div>
      <RedGuideMarkV2 className="left-[12px] top-[78px] h-[38px] w-[124px]" label="1" />
      <RedGuideMarkV2 className="left-[278px] top-[15px] h-[48px] w-[92px]" label="2" />
    </div>
  );
}

function SmartPlaceUrlButtonCaptureV2() {
  return (
    <div className="relative bg-white px-5 py-6">
      <p className="text-[20px] font-semibold text-[#111827]">운영중인 홈페이지, SNS, 커뮤니티 등이 있나요?</p>
      <div className="relative mt-5 grid grid-cols-[minmax(0,1fr)_90px] gap-2">
        <button type="button" className="h-12 rounded-[8px] bg-[#eef7f2] text-[16px] font-semibold text-[#0f9f5a]">+ URL 추가</button>
        <button type="button" className="h-12 rounded-[8px] bg-[#eef7f2] text-[14px] text-[#0f9f5a]">순서/삭제</button>
        <RedGuideMarkV2 className="left-0 top-0 h-12 w-[calc(100%-98px)]" />
      </div>
    </div>
  );
}

function SmartPlaceUrlModalCaptureV2({ bookingUrl }: { bookingUrl: string }) {
  return (
    <div className="relative bg-white px-5 py-5">
      <p className="text-[22px] font-semibold text-[#111827]">URL 추가</p>
      <p className="mt-6 text-[16px] font-semibold text-[#334155]">분류 선택</p>
      <div className="relative mt-3 flex flex-wrap gap-2">
        {["블로그", "카페", "일반", "예약", "밴드", "페이스북", "인스타그램", "유튜브", "스마트스토어"].map((item) => (
          <span key={item} className={`rounded-[7px] border px-4 py-2.5 text-[14px] ${item === "예약" ? "border-[#12b76a] font-semibold text-[#111827]" : "border-[#dbe2ea] text-[#334155]"}`}>
            {item}
          </span>
        ))}
        <RedGuideMarkV2 className="left-[218px] top-0 h-[44px] w-[66px]" />
      </div>
      <p className="mt-6 text-[16px] font-semibold text-[#334155]">URL 입력</p>
      <div className="relative mt-3 rounded-[8px] border border-[#dbe2ea] px-4 py-4 font-mono text-[14px] text-[#111827]">
        {bookingUrl}
        <RedGuideMarkV2 className="-left-[3px] -top-[3px] h-[calc(100%+6px)] w-[calc(100%+6px)]" />
      </div>
      <div className="relative mt-5 grid grid-cols-2 gap-2">
        <button type="button" className="h-12 rounded-[8px] border border-[#dbe2ea] text-[16px] text-[#334155]">취소</button>
        <button type="button" className="h-12 rounded-[8px] bg-[#12b76a] text-[16px] font-semibold text-white">추가하기</button>
        <RedGuideMarkV2 className="right-0 top-0 h-12 w-[calc(50%-4px)]" />
      </div>
    </div>
  );
}

function SmartPlaceLinkGuide({ bookingUrl }: { bookingUrl: string }) {
  const steps = [
    {
      title: "네이버 검색창에 스마트플레이스를 검색합니다.",
      description: "네이버 검색창에 스마트플레이스를 입력해 검색합니다.",
      src: "",
      alt: "네이버 검색창에서 스마트플레이스를 검색하는 화면",
    },
    {
      title: "네이버 스마트플레이스를 클릭합니다.",
      description: "검색 결과에서 네이버 스마트플레이스 항목을 클릭합니다.",
      src: "",
      alt: "네이버 스마트플레이스 검색 결과 화면",
    },
    {
      title: "내 업체를 클릭합니다.",
      description: "스마트플레이스에 들어가면 내 업체 목록이 보입니다. 업체명을 클릭해 관리 화면으로 들어갑니다.",
      src: "",
      alt: "스마트플레이스 내 업체 목록 화면",
    },
    {
      title: "좌측 사이드바에서 업체정보를 클릭합니다.",
      description: "관리 화면 왼쪽 사이드바에서 업체정보를 클릭합니다.",
      src: "/images/naver-smartplace-pc-basic-info.png",
      alt: "스마트플레이스 업체정보 기본정보 화면",
    },
    {
      title: "상단에서 부가정보를 클릭합니다.",
      description: "업체정보 화면 상단 탭에서 부가정보를 선택합니다.",
      src: "/images/naver-smartplace-pc-additional-info.png",
      alt: "스마트플레이스 부가정보 화면",
    },
    {
      title: "맨 아래에서 URL 추가를 누릅니다.",
      description: "부가정보 화면을 아래로 내려 URL 추가 버튼을 클릭합니다.",
      src: "",
      alt: "스마트플레이스 URL 추가 버튼 화면",
    },
    {
      title: "분류 선택에서 예약을 선택합니다.",
      description: "URL 추가 창에서 분류 선택 항목 중 예약을 선택합니다.",
      src: "",
      alt: "스마트플레이스 URL 추가 분류 선택 화면",
    },
    {
      title: "우리 예약 링크를 넣고 추가하기를 누릅니다.",
      description: `URL 입력칸에 ${bookingUrl} 을 붙여넣고 추가하기를 누릅니다.`,
      src: "",
      alt: "스마트플레이스 URL 입력 후 추가하기 화면",
    },
  ];

  return (
    <section className="mt-3 rounded-[10px] border border-[#dbe2ea] bg-white">
      <div className="border-b border-[#edf2f7] px-3 py-3">
        <p className="text-[14px] font-semibold text-[#111827]">스마트플레이스 예약 링크 등록 가이드</p>
        <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
          캡처 이미지를 보고 같은 위치를 따라 누르면 됩니다.
        </p>
      </div>

      <div className="space-y-4 p-3">
        {steps.map((step, index) => (
          <SmartPlaceGuideStep key={`${index}-${step.title}`} step={index + 1} {...step} />
        ))}
      </div>
    </section>
  );
}

function SmartPlaceGuideStep({
  step,
  title,
  description,
  src,
  alt,
}: {
  step: number;
  title: string;
  description: string;
  src: string;
  alt: string;
}) {
  return (
    <article className="rounded-[10px] border border-[#edf2f7] bg-[#fbfcfd]">
      <div className="overflow-hidden rounded-t-[10px] border-b border-[#edf2f7] bg-white">
        {src ? (
          <img src={src} alt={alt} className="block w-full object-contain" />
        ) : (
          <div className="flex min-h-[132px] items-center justify-center bg-white px-4 text-center text-[13px] leading-5 text-[#94a3b8]">
            이 단계의 캡처 이미지를 연결하면 여기에 그대로 표시됩니다.
          </div>
        )}
      </div>
      <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 px-3 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-[#334155] ring-1 ring-inset ring-[#dbe2ea]">
          {step}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#111827]">{title}</p>
          <p className="mt-1 text-[13px] leading-5 text-[#64748b]">{description}</p>
        </div>
      </div>
    </article>
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
