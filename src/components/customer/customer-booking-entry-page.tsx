"use client";

import { ChevronDown, Copy, MapPinned, Navigation, Phone, Scissors, X } from "lucide-react";
import { useMemo, useState } from "react";

import LegalLinksFooter from "@/components/legal/legal-links-footer";
import { formatServicePrice } from "@/lib/utils";
import type { BusinessHours, Service, Shop } from "@/types/domain";

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=80";

const weekRows = [
  { key: 1, label: "월요일", shortLabel: "월" },
  { key: 2, label: "화요일", shortLabel: "화" },
  { key: 3, label: "수요일", shortLabel: "수" },
  { key: 4, label: "목요일", shortLabel: "목" },
  { key: 5, label: "금요일", shortLabel: "금" },
  { key: 6, label: "토요일", shortLabel: "토" },
  { key: 0, label: "일요일", shortLabel: "일" },
] as const;

function getTodayWeekdayInSeoul() {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date());

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return weekdayMap[weekday] ?? 0;
}

function formatHoursRow(day: number, businessHours: BusinessHours, regularClosedDays: number[]) {
  const hours = businessHours[day];
  if (regularClosedDays.includes(day) || !hours?.enabled) return "휴무";
  return `${hours.open} - ${hours.close}`;
}

function openExternalMap(appUrl: string, webUrl: string) {
  if (typeof window === "undefined") return;

  const fallback = window.setTimeout(() => {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    window.removeEventListener("blur", handleBlur);
  }, 700);

  function handleBlur() {
    window.clearTimeout(fallback);
    window.removeEventListener("blur", handleBlur);
  }

  window.addEventListener("blur", handleBlur, { once: true });
  window.location.href = appUrl;
}

function resolveHeroImage(value: string | undefined) {
  return value?.trim() || DEFAULT_HERO_IMAGE;
}

export default function CustomerBookingEntryPage({
  shop,
  services,
  bookingHref,
  infoHref,
}: {
  shop: Pick<Shop, "id" | "name" | "phone" | "address" | "customer_page_settings" | "business_hours" | "regular_closed_days">;
  services: Service[];
  bookingHref: string;
  infoHref: string;
}) {
  const settings = shop.customer_page_settings;
  const displayName = settings.shop_name?.trim() || shop.name;
  const tagline = settings.tagline?.trim() || "아이 성향에 맞춰 차분하게 미용 시간을 준비해요.";
  const primaryColor = settings.primary_color || "#1F6B5B";
  const todayWeekday = getTodayWeekdayInSeoul();
  const todayRow = weekRows.find((row) => row.key === todayWeekday) ?? weekRows[0];
  const todayHours = formatHoursRow(todayRow.key, shop.business_hours, shop.regular_closed_days);
  const activeServices = services.filter((service) => service.is_active).slice(0, 3);
  const visibleParkingNotice = settings.show_parking_notice ? settings.parking_notice.trim() : "";
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  const directionsQuery = useMemo(() => [displayName, shop.address].filter(Boolean).join(" "), [displayName, shop.address]);
  const naverWebUrl = `https://map.naver.com/p/search/${encodeURIComponent(directionsQuery)}`;
  const kakaoWebUrl = `https://map.kakao.com/link/search/${encodeURIComponent(directionsQuery)}`;
  const tmapWebUrl = `https://www.tmap.co.kr/tmap2/mobile/route.jsp?name=${encodeURIComponent(directionsQuery)}`;

  async function handleCopyAddress() {
    if (typeof window === "undefined") return;

    try {
      await navigator.clipboard.writeText(shop.address);
      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 1600);
    } catch {
      setAddressCopied(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fbfaf7] px-5 pb-10 pt-4">
      <section className="overflow-hidden rounded-[30px] border border-[#e0e6e2] bg-white shadow-[0_16px_36px_rgba(26,38,33,0.08)]">
        <div
          className="min-h-[385px] bg-cover bg-center px-6 pb-8 pt-8 text-white"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(12, 17, 15, 0.14), rgba(12, 17, 15, 0.72)), url(${resolveHeroImage(settings.hero_image_url)})`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex rounded-full border border-white/32 bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-white/95 backdrop-blur-sm">
              PETMANAGER RESERVATION
            </div>
            <a
              href={infoHref}
              className="inline-flex h-[38px] shrink-0 items-center justify-center rounded-full border border-white/24 bg-white/14 px-4 text-[12px] font-semibold text-white/92 backdrop-blur-sm"
            >
              매장 정보
            </a>
          </div>

          <h1 className="mt-11 max-w-[310px] text-[31px] font-semibold leading-[1.16] tracking-[-0.04em] text-white">
            {displayName}
          </h1>
          <p className="mt-4 max-w-[300px] text-[15px] font-semibold leading-7 tracking-[-0.02em] text-white/88">
            {tagline}
          </p>

          <a
            href={bookingHref}
            className="mt-8 flex h-[52px] items-center justify-center rounded-full text-[16px] font-semibold text-white shadow-[0_14px_28px_rgba(0,0,0,0.16)]"
            style={{ backgroundColor: primaryColor }}
          >
            {settings.booking_button_label || "예약하기"}
          </a>

          <button
            type="button"
            onClick={() => setDirectionsOpen(true)}
            className="mt-3 flex h-[52px] w-full items-center justify-center rounded-full border border-white/46 bg-white/12 text-[16px] font-semibold text-white backdrop-blur-sm"
          >
            길찾기
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-[24px] border border-[#e0e6e2] bg-white p-4 shadow-[0_12px_26px_rgba(26,38,33,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-[#7a8881]">오늘 운영</p>
            <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[#071923]">{todayHours}</p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[13px] font-medium"
            style={{
              backgroundColor: todayHours === "휴무" ? "#f3f5f4" : "#edf7f4",
              color: todayHours === "휴무" ? "#6d7772" : primaryColor,
            }}
          >
            {todayRow.shortLabel}
          </span>
        </div>

      </section>

      <section className="mt-4 rounded-[24px] border border-[#e0e6e2] bg-white p-4 shadow-[0_12px_26px_rgba(26,38,33,0.05)]">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf7f4]" style={{ color: primaryColor }}>
            <MapPinned className="h-4.5 w-4.5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#071923]">오시는 길</p>
            <p className="mt-1 text-[14px] leading-6 text-[#65726b]">{shop.address}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[24px] border border-[#e0e6e2] bg-white p-4 shadow-[0_12px_26px_rgba(26,38,33,0.05)]">
        <button
          type="button"
          onClick={() => setHoursOpen((value) => !value)}
          className="flex h-11 w-full items-center justify-between rounded-[14px] border border-[#e0e6e2] bg-[#fcfbf8] px-4 text-[14px] font-medium text-[#26352f]"
        >
          운영 시간 전체 보기
          <ChevronDown className={`h-4 w-4 transition ${hoursOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
        </button>

        {hoursOpen ? (
          <div className="mt-3 overflow-hidden rounded-[16px] border border-[#e5e9e6]">
            {weekRows.map((row, index) => {
              const hoursText = formatHoursRow(row.key, shop.business_hours, shop.regular_closed_days);
              const isToday = row.key === todayWeekday;
              return (
                <div
                  key={row.key}
                  className={`grid grid-cols-[1fr_120px] items-center px-4 py-3 text-[14px] ${
                    index !== weekRows.length - 1 ? "border-b border-[#edf0ee]" : ""
                  } ${isToday ? "bg-[#f4faf7]" : "bg-white"}`}
                >
                  <span className="font-medium text-[#26352f]">{row.label}</span>
                  <span className={`text-right ${hoursText === "휴무" ? "text-[#87918c]" : "text-[#26352f]"}`}>{hoursText}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {activeServices.length > 0 ? (
        <section className="mt-4 rounded-[24px] border border-[#e0e6e2] bg-white p-4 shadow-[0_12px_26px_rgba(26,38,33,0.05)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#071923]">서비스 안내</p>
            <Scissors className="h-4 w-4 text-[#94a09a]" strokeWidth={1.8} />
          </div>
          <div className="space-y-2">
            {activeServices.map((service) => (
              <div key={service.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-[#fcfbf8] px-4 py-3">
                <span className="min-w-0 truncate text-[14px] font-medium text-[#26352f]">{service.name}</span>
                <span className="shrink-0 text-[13px] font-medium" style={{ color: primaryColor }}>
                  {formatServicePrice(service.price, service.price_type ?? "starting")}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-[24px] border border-[#e0e6e2] bg-white p-4 shadow-[0_12px_26px_rgba(26,38,33,0.05)]">
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#071923]">매장 안내</p>
        <div className="mt-3 space-y-2.5">
          <a
            href={`tel:${shop.phone.replace(/[^0-9+]/g, "")}`}
            className="flex min-h-[46px] items-center justify-between gap-3 rounded-[16px] bg-[#fcfbf8] px-4 py-3 text-[14px] text-[#26352f]"
          >
            <span className="font-medium">전화 문의</span>
            <span className="text-right text-[#65726b]">{shop.phone}</span>
          </a>
          {visibleParkingNotice ? (
            <div className="rounded-[16px] bg-[#fcfbf8] px-4 py-3">
              <p className="text-[14px] font-medium text-[#26352f]">방문 안내</p>
              <p className="mt-1 text-[14px] leading-6 text-[#65726b]">{visibleParkingNotice}</p>
            </div>
          ) : null}
          <a
            href={infoHref}
            className="flex h-[46px] items-center justify-between rounded-[16px] bg-[#fcfbf8] px-4 text-[14px] font-medium text-[#26352f]"
          >
            매장 정보 더 보기
            <span className="text-[#65726b]">열기</span>
          </a>
        </div>
      </section>

      {directionsOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 px-4" onClick={() => setDirectionsOpen(false)}>
          <div className="w-full max-w-[430px] rounded-t-[28px] bg-[#fbfaf7] p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium" style={{ color: primaryColor }}>
                  길찾기
                </p>
                <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-[#071923]">{displayName}</h3>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dce5e0] bg-white text-[#65726b]"
                onClick={() => setDirectionsOpen(false)}
                aria-label="길찾기 닫기"
              >
                <X className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </div>

            <div className="rounded-[22px] border border-[#e0e6e2] bg-white px-4 py-4">
              <p className="text-[14px] leading-6 text-[#65726b]">{shop.address}</p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[14px] border border-[#dce5e0] bg-white px-4 text-[14px] font-medium text-[#26352f]"
                >
                  <Copy className="h-4 w-4" strokeWidth={1.9} />
                  {addressCopied ? "복사 완료" : "주소 복사"}
                </button>
                <a
                  href={`tel:${shop.phone.replace(/[^0-9+]/g, "")}`}
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[14px] border border-[#dce5e0] bg-white px-4 text-[14px] font-medium text-[#26352f]"
                >
                  <Phone className="h-4 w-4" strokeWidth={1.9} />
                  전화하기
                </a>
              </div>

              <div className="mt-4 space-y-2.5">
                <MapButton
                  label="네이버 지도로 보기"
                  onClick={() =>
                    openExternalMap(
                      `nmap://search?query=${encodeURIComponent(directionsQuery)}&appname=${encodeURIComponent("kr.petmanager.app")}`,
                      naverWebUrl,
                    )
                  }
                />
                <MapButton
                  label="카카오맵으로 보기"
                  onClick={() => openExternalMap(`kakaomap://search?q=${encodeURIComponent(directionsQuery)}`, kakaoWebUrl)}
                />
                <MapButton
                  label="티맵으로 보기"
                  onClick={() => openExternalMap(`tmap://search?name=${encodeURIComponent(directionsQuery)}`, tmapWebUrl)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <LegalLinksFooter />
    </div>
  );
}

function MapButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[50px] w-full items-center justify-between rounded-[16px] border border-[#dce5e0] bg-white px-4 text-left"
    >
      <span className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#edf7f4] text-[#1F6B5B]">
          <Navigation className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <span className="text-[15px] font-medium tracking-[-0.02em] text-[#26352f]">{label}</span>
      </span>
      <span className="text-[13px] font-medium text-[#7b8881]">열기</span>
    </button>
  );
}
