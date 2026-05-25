"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Copy, Navigation, Phone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getDotIndicatorClass } from "@/components/owner-web/status-indicators";
import type { BusinessHours, Shop } from "@/types/domain";

const DEFAULT_HERO_IMAGES = [
  "/images/customer-booking-hero-original.jpg",
];
const visibleDateOptionCount = 4;

const weekRows = [
  { key: 1, label: "월요일" },
  { key: 2, label: "화요일" },
  { key: 3, label: "수요일" },
  { key: 4, label: "목요일" },
  { key: 5, label: "금요일" },
  { key: 6, label: "토요일" },
  { key: 0, label: "일요일" },
] as const;

type EntryDateOption = {
  value: string;
  label: string;
  weekday: string;
};

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

function getSeoulDateKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildEntryDateOptions(
  shop: Pick<Shop, "business_hours" | "regular_closed_days" | "temporary_closed_dates">,
): EntryDateOption[] {
  const options: EntryDateOption[] = [];
  const todayKey = getSeoulDateKey();
  const startDate = new Date(`${todayKey}T00:00:00`);
  let offset = 0;

  while (options.length < 30 && offset < 90) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    const value = formatDateKey(date);
    const weekdayNumber = date.getDay();
    const hours = shop.business_hours[weekdayNumber];
    const isClosed =
      shop.regular_closed_days.includes(weekdayNumber) ||
      shop.temporary_closed_dates.includes(value) ||
      !hours?.enabled;

    if (!isClosed) {
      options.push({
        value,
        label: value === todayKey ? "오늘" : `${date.getMonth() + 1}/${date.getDate()}`,
        weekday: new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date),
      });
    }

    offset += 1;
  }

  return options;
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

function resolveHeroImages(value: string | undefined) {
  const uploadedImage = value?.trim();
  return uploadedImage ? [uploadedImage, ...DEFAULT_HERO_IMAGES.slice(1)] : DEFAULT_HERO_IMAGES;
}

export default function CustomerBookingEntryPage({
  shop,
  bookingHref,
}: {
  shop: Pick<Shop, "id" | "name" | "phone" | "address" | "approval_mode" | "customer_page_settings" | "business_hours" | "regular_closed_days" | "temporary_closed_dates">;
  services: unknown[];
  bookingHref: string;
  infoHref: string;
}) {
  const settings = shop.customer_page_settings;
  const displayName = settings.shop_name?.trim() || shop.name;
  const savedTagline = settings.tagline?.trim() || "";
  const tagline =
    savedTagline.includes("운영을 돕는") || savedTagline.includes("예약 관리 앱")
      ? "우리 아이에게 맞는 미용 시간을 편하게 예약해 주세요."
      : savedTagline || "우리 아이에게 맞는 미용 시간을 편하게 예약해 주세요.";
  const bookingAccentColor = "#7A5A45";
  const displayAddress = [shop.address, settings.address_detail].filter(Boolean).join(", ");
  const todayWeekday = getTodayWeekdayInSeoul();
  const todayRow = weekRows.find((row) => row.key === todayWeekday) ?? weekRows[0];
  const todayHours = formatHoursRow(todayRow.key, shop.business_hours, shop.regular_closed_days);
  const isTodayClosed = todayHours === "휴무";
  const operatingStatusLabel = isTodayClosed ? "오늘 휴무" : "영업 중";
  const dateOptions = useMemo(() => buildEntryDateOptions(shop), [shop]);
  const heroImages = useMemo(() => resolveHeroImages(settings.hero_image_url), [settings.hero_image_url]);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [datePageStartIndex, setDatePageStartIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => dateOptions[0]?.value ?? "");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const directionsQuery = useMemo(() => [displayName, displayAddress].filter(Boolean).join(" "), [displayName, displayAddress]);
  const naverWebUrl = `https://map.naver.com/p/search/${encodeURIComponent(directionsQuery)}`;
  const kakaoWebUrl = `https://map.kakao.com/link/search/${encodeURIComponent(directionsQuery)}`;
  const tmapWebUrl = `https://www.tmap.co.kr/tmap2/mobile/route.jsp?name=${encodeURIComponent(directionsQuery)}`;
  const kakaoInquiryUrl = settings.kakao_inquiry_url.trim();
  const inquiryHref = kakaoInquiryUrl || `tel:${shop.phone.replace(/[^0-9+]/g, "")}`;
  const maxDatePageStartIndex = Math.max(0, dateOptions.length - visibleDateOptionCount);
  const effectiveDatePageStartIndex = Math.min(datePageStartIndex, maxDatePageStartIndex);
  const visibleDateOptions = useMemo(
    () => dateOptions.slice(effectiveDatePageStartIndex, effectiveDatePageStartIndex + visibleDateOptionCount),
    [dateOptions, effectiveDatePageStartIndex],
  );
  const canMoveDatePrev = effectiveDatePageStartIndex > 0;
  const canMoveDateNext = effectiveDatePageStartIndex < maxDatePageStartIndex;

  useEffect(() => {
    if (heroImages.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % heroImages.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [heroImages.length]);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    let active = true;
    const loadingTimer = window.setTimeout(() => {
      if (!active) return;
      setLoadingSlots(true);
      setSelectedTime("");
    }, 0);

    const query = new URLSearchParams({
      shopId: shop.id,
      date: selectedDate,
      previewDurationMinutes: "30",
    });

    fetch(`/api/availability?${query.toString()}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("availability failed"))))
      .then((payload: { slots?: string[] }) => {
        if (!active) return;
        setAvailableSlots(Array.isArray(payload.slots) ? payload.slots : []);
      })
      .catch(() => {
        if (active) setAvailableSlots([]);
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
    };
  }, [selectedDate, shop.id]);

  function startBookingWithSlot(timeSlot: string) {
    setSelectedTime(timeSlot);

    if (typeof window === "undefined") return;
    const nextUrl = new URL(bookingHref, window.location.origin);
    nextUrl.searchParams.set("date", selectedDate);
    nextUrl.searchParams.set("time", timeSlot);
    window.location.assign(`${nextUrl.pathname}${nextUrl.search}`);
  }

  function moveDatePage(direction: "prev" | "next") {
    setDatePageStartIndex((current) => {
      const nextIndex = direction === "next" ? current + visibleDateOptionCount : current - visibleDateOptionCount;
      return Math.max(0, Math.min(maxDatePageStartIndex, nextIndex));
    });
  }

  async function handleCopyAddress() {
    if (typeof window === "undefined") return;

    try {
      await navigator.clipboard.writeText(displayAddress);
      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 1600);
    } catch {
      setAddressCopied(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-10 pt-4">
      <section className="overflow-hidden rounded-[18px] border border-[#e5e7eb] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div
          className="relative aspect-[16/9] overflow-hidden bg-[#efe7dd] text-white"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(42, 30, 20, 0.04), rgba(31, 24, 18, 0.36)), url(${heroImages[activeHeroIndex]})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <span className="sr-only">{displayName}</span>
          {heroImages.length > 1 ? (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {heroImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  aria-label={`${index + 1}번째 대표 사진 보기`}
                  onClick={() => setActiveHeroIndex(index)}
                  className={`h-1.5 rounded-full transition ${activeHeroIndex === index ? "w-5 bg-white" : "w-1.5 bg-white/55"}`}
                />
              ))}
            </div>
          ) : (
            <div aria-hidden="true" className="absolute bottom-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/85 shadow-[0_1px_6px_rgba(0,0,0,0.18)]" />
          )}
        </div>
      </section>

      <section className="mt-3 rounded-[18px] border border-[#e5e7eb] bg-white p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
        <div className="px-1 pb-3">
          <div className="min-w-0">
            <h2 className="truncate text-[24px] font-semibold tracking-[-0.04em] text-[#2b241f]">{displayName}</h2>
            <p className="mt-1.5 truncate text-[14px] font-medium tracking-[-0.02em] text-[#7a6a5d]">{tagline}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setHoursOpen((value) => !value)}
          aria-expanded={hoursOpen}
          className={`grid h-[58px] w-full items-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-4 text-left text-[#071923] ${isTodayClosed ? "grid-cols-[auto_1fr]" : "grid-cols-[auto_auto_1fr]"}`}
        >
          <span className="inline-flex min-w-0 justify-start">
            <span className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-[15px] font-medium text-[#6f6258]">
              <span className={getDotIndicatorClass(isTodayClosed ? "neutral" : "teal")} />
              <span>{operatingStatusLabel}</span>
            </span>
          </span>
          {isTodayClosed ? null : <span className="whitespace-nowrap text-center text-[18px] font-medium tracking-[-0.03em] text-[#6f6258]">{todayHours}</span>}
          <span className="inline-flex min-w-0 justify-end">
            <span className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-transparent px-3 text-[15px] font-normal text-[#6f6258]">
              전체 보기
              <ChevronDown className={`h-3.5 w-3.5 transition ${hoursOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
            </span>
          </span>
        </button>

        {hoursOpen ? (
          <div className="mt-3 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white text-[#26352f]">
            {weekRows.map((row, index) => {
              const hoursText = formatHoursRow(row.key, shop.business_hours, shop.regular_closed_days);
              const isToday = row.key === todayWeekday;
              return (
                <div
                  key={row.key}
                  className={`grid grid-cols-[1fr_120px] items-center px-4 py-2.5 text-[13px] ${
                    index !== weekRows.length - 1 ? "border-b border-[#edf0ee]" : ""
                  } ${isToday ? "bg-[#faf7f2]" : "bg-white"}`}
                >
                  <span className="font-medium">{row.label}</span>
                  <span className={`text-right ${hoursText === "휴무" ? "text-[#87918c]" : "text-[#26352f]"}`}>{hoursText}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="mt-3 rounded-[10px] border border-[#e5e7eb] bg-white p-3.5 text-[#071923]">
          <p className="text-[14px] font-semibold tracking-[-0.02em] text-[#26352f]">예약 날짜</p>
          <div className="mt-2 grid grid-cols-[24px_repeat(4,minmax(0,1fr))_24px] items-stretch gap-1.5">
            <button
              type="button"
              onClick={() => moveDatePage("prev")}
              disabled={!canMoveDatePrev}
              className="inline-flex h-[64px] items-center justify-center rounded-[10px] bg-transparent text-[#7a6a5d] transition hover:bg-[#faf7f2] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="이전 날짜 보기"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.9} />
            </button>
            {visibleDateOptions.map((option) => {
              const active = selectedDate === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedDate(option.value)}
                  className={`h-[64px] rounded-[8px] border px-2 py-2 text-center transition ${
                    active ? "text-white" : "border-[#e5e7eb] bg-white text-[#3f352d] hover:bg-[#faf7f2]"
                  }`}
                  style={active ? { borderColor: bookingAccentColor, backgroundColor: bookingAccentColor } : undefined}
                >
                  <span className={`block text-[11px] ${active ? "text-white/80" : "text-[#7a6a5d]"}`}>{option.weekday}</span>
                  <span className="mt-0.5 block text-[14px] font-semibold tracking-[-0.03em]">{option.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => moveDatePage("next")}
              disabled={!canMoveDateNext}
              className="inline-flex h-[64px] items-center justify-center rounded-[10px] bg-transparent text-[#7a6a5d] transition hover:bg-[#faf7f2] disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="다음 날짜 보기"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.9} />
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[14px] font-semibold tracking-[-0.02em] text-[#26352f]">시간 선택</p>
            {loadingSlots ? (
              <p className="mt-2 rounded-[8px] border border-[#e5e7eb] bg-white px-3 py-3 text-[13px] text-[#7a6a5d]">
                가능한 시간을 확인하고 있어요.
              </p>
            ) : availableSlots.length > 0 ? (
              <div className="mt-2 grid max-h-[118px] grid-cols-3 gap-1.5 overflow-y-auto pr-0.5">
                {availableSlots.map((slot) => {
                  const active = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => startBookingWithSlot(slot)}
                      className={`rounded-[8px] border px-2 py-2 text-[14px] font-medium tracking-[-0.02em] transition ${
                        active ? "text-white" : "border-[#e5e7eb] bg-white text-[#3f352d] hover:bg-[#faf7f2]"
                      }`}
                      style={active ? { borderColor: bookingAccentColor, backgroundColor: bookingAccentColor } : undefined}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 rounded-[8px] border border-[#e5e7eb] bg-white px-3 py-3 text-[13px] text-[#7a6a5d]">
                선택한 날짜에 가능한 시간이 없어요.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirectionsOpen(true)}
            className="flex h-[52px] w-full items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white text-[15px] font-bold text-[#3f352d] hover:bg-[#faf7f2]"
          >
            길찾기
          </button>
          <a
            href={inquiryHref}
            target={kakaoInquiryUrl ? "_blank" : undefined}
            rel={kakaoInquiryUrl ? "noreferrer" : undefined}
            className="flex h-[52px] w-full items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white text-[15px] font-bold text-[#3f352d] hover:bg-[#faf7f2]"
          >
            문의하기
          </a>
        </div>
      </section>

      {directionsOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 px-4" onClick={() => setDirectionsOpen(false)}>
          <div className="w-full max-w-[430px] rounded-t-[18px] bg-white p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#e5e7eb]" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold" style={{ color: bookingAccentColor }}>
                  길찾기
                </p>
                <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-[#071923]">{displayName}</h3>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white text-[#7a5a45]"
                onClick={() => setDirectionsOpen(false)}
                aria-label="길찾기 닫기"
              >
                <X className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </div>

            <div className="rounded-[10px] border border-[#e5e7eb] bg-white px-4 py-4">
              <p className="text-[14px] leading-6 text-[#6f6258]">{displayAddress}</p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-4 text-[14px] font-medium text-[#26352f] hover:bg-[#faf7f2]"
                >
                  <Copy className="h-4 w-4" strokeWidth={1.9} />
                  {addressCopied ? "복사 완료" : "주소 복사"}
                </button>
                <a
                  href={`tel:${shop.phone.replace(/[^0-9+]/g, "")}`}
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-4 text-[14px] font-medium text-[#26352f] hover:bg-[#faf7f2]"
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

    </div>
  );
}

function MapButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[50px] w-full items-center justify-between rounded-[8px] border border-[#e5e7eb] bg-white px-4 text-left hover:bg-[#faf7f2]"
    >
      <span className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#f3ebe2] text-[#7a5a45]">
          <Navigation className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <span className="text-[15px] font-medium tracking-[-0.02em] text-[#26352f]">{label}</span>
      </span>
      <span className="text-[13px] font-medium text-[#7a6a5d]">열기</span>
    </button>
  );
}

