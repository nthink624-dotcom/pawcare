"use client";

import { ChevronDown, Copy, Navigation, Phone, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";

import { getDotIndicatorClass } from "@/components/owner-web/status-indicators";
import { normalizeServicePriceGuide, type ServicePriceGuideExtraFee, type ServicePriceGuideSection } from "@/components/owner-web/service-price-guide";
import {
  applyCustomerServiceOverrides,
  buildCustomerServiceSourceOptions,
} from "@/lib/customer-service-options";
import { formatServicePrice } from "@/lib/utils";
import type { BusinessHours, Service, Shop } from "@/types/domain";

export const DEFAULT_HERO_IMAGES = [
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

function timeTextToMinutes(value: string | undefined) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function getSeoulDateKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getSeoulTimeMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
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

function resolveHeroImages(value: string | undefined, values?: string[]) {
  const uploadedImages = Array.isArray(values)
    ? values.filter((imageUrl): imageUrl is string => typeof imageUrl === "string" && imageUrl.trim().length > 0).slice(0, 10)
    : [];
  const uploadedImage = value?.trim();
  if (uploadedImages.length > 0) return uploadedImages;
  return uploadedImage ? [uploadedImage, ...DEFAULT_HERO_IMAGES.slice(1)] : DEFAULT_HERO_IMAGES;
}

function getPriceGuideSections(service: Service): ServicePriceGuideSection[] {
  const guide = service.price_guide;
  if (!guide || typeof guide !== "object" || Array.isArray(guide)) return [];
  const source = guide as { enabled?: unknown; sections?: unknown };
  if (source.enabled === false || !Array.isArray(source.sections) || source.sections.length === 0) return [];
  return normalizeServicePriceGuide(guide).sections ?? [];
}

type PriceGuideExtraFeeGroup = {
  serviceId: string;
  serviceName: string;
  extraNote: string;
  extraFees: ServicePriceGuideExtraFee[];
};

function getPriceGuideExtraFeeGroup(service: Service): PriceGuideExtraFeeGroup | null {
  const guide = service.price_guide;
  if (!guide || typeof guide !== "object" || Array.isArray(guide)) return null;
  const source = guide as { enabled?: unknown };
  if (source.enabled === false) return null;

  const normalized = normalizeServicePriceGuide(guide);
  const extraNote = normalized.extraNote.trim();
  const extraFees = normalized.extraFees.filter((fee) => fee.label.trim() || fee.price.trim());
  if (!extraNote && extraFees.length === 0) return null;

  return {
    serviceId: service.id,
    serviceName: service.name,
    extraNote,
    extraFees,
  };
}

function dedupePriceGuideExtraFeeGroups(groups: PriceGuideExtraFeeGroup[]) {
  const seen = new Set<string>();
  return groups.filter((group) => {
    const key = JSON.stringify({
      extraNote: group.extraNote,
      extraFees: group.extraFees.map((fee) => ({ label: fee.label.trim(), price: fee.price.trim() })),
    });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatPriceGuideCell(cell: { price?: string; durationMinutes?: string } | undefined) {
  const price = Number(String(cell?.price ?? "").replace(/[^0-9]/g, ""));
  const duration = Number(String(cell?.durationMinutes ?? "").replace(/[^0-9]/g, ""));
  const priceText = Number.isFinite(price) && price > 0 ? `${price.toLocaleString("ko-KR")}원` : "-";
  const durationText = Number.isFinite(duration) && duration > 0 ? `${duration}분 예상` : "";
  return { priceText, durationText };
}

function parseBreedGuideNote(note: string) {
  const breeds = note
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (breeds.length === 0) return null;

  const preview = breeds.slice(0, 3).join(", ");
  return {
    breeds,
    summary: breeds.length > 3 ? `${preview} 외` : preview,
  };
}

function formatBreedGroupTitle(title: string, serviceName: string) {
  const label = (title || serviceName).trim();
  if (!label) return "모종 기준";
  return label.includes("모종") ? label : `${label} 모종`;
}

function getTodayOperatingStatus(
  shop: Pick<Shop, "business_hours" | "regular_closed_days" | "temporary_closed_dates">,
  currentMinutes: number,
) {
  const todayKey = getSeoulDateKey();
  const todayWeekday = getTodayWeekdayInSeoul();
  const hours = shop.business_hours[todayWeekday];
  const isClosed =
    shop.regular_closed_days.includes(todayWeekday) ||
    shop.temporary_closed_dates.includes(todayKey) ||
    !hours?.enabled;

  if (isClosed) return { label: "휴무", open: false };

  const openMinutes = timeTextToMinutes(hours.open);
  const closeMinutes = timeTextToMinutes(hours.close);
  if (openMinutes === null || closeMinutes === null) return { label: "영업시간 확인", open: false };
  if (currentMinutes < openMinutes) return { label: "영업 전", open: false };
  if (currentMinutes >= closeMinutes) return { label: "영업 종료", open: false };
  return { label: "영업 중", open: true };
}

export default function CustomerBookingEntryPage({
  shop,
  services,
  infoHref,
}: {
  shop: Pick<Shop, "id" | "name" | "phone" | "address" | "approval_mode" | "customer_page_settings" | "business_hours" | "regular_closed_days" | "temporary_closed_dates">;
  services: Service[];
  infoHref: string;
}) {
  const settings = shop.customer_page_settings;
  const displayName = shop.name;
  const bookingAccentColor = "#7A5A45";
  const displayAddress = [shop.address, settings.address_detail].filter(Boolean).join(", ");
  const todayWeekday = getTodayWeekdayInSeoul();
  const todayRow = weekRows.find((row) => row.key === todayWeekday) ?? weekRows[0];
  const [currentSeoulMinutes, setCurrentSeoulMinutes] = useState(() => getSeoulTimeMinutes());
  const operatingStatus = getTodayOperatingStatus(shop, currentSeoulMinutes);
  const serviceOptions = useMemo(
    () => applyCustomerServiceOverrides(
      buildCustomerServiceSourceOptions(
        services
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ko")),
        { priceGuideOnly: true },
      ),
      settings.customer_service_overrides,
    ),
    [services, settings.customer_service_overrides],
  );
  const priceGuideSections = useMemo(
    () => services.flatMap((service) => getPriceGuideSections(service).map((section) => ({ serviceId: service.id, serviceName: service.name, section }))),
    [services],
  );
  const priceGuideExtraFeeGroups = useMemo(
    () => dedupePriceGuideExtraFeeGroups(services.map(getPriceGuideExtraFeeGroup).filter((group): group is PriceGuideExtraFeeGroup => Boolean(group))),
    [services],
  );
  const heroImages = useMemo(() => resolveHeroImages(settings.hero_image_url, settings.hero_image_urls), [settings.hero_image_url, settings.hero_image_urls]);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [expandedBreedGuideKeys, setExpandedBreedGuideKeys] = useState<string[]>([]);
  const heroTouchStartXRef = useRef<number | null>(null);

  const directionsQuery = useMemo(() => [displayName, displayAddress].filter(Boolean).join(" "), [displayName, displayAddress]);
  const naverWebUrl = `https://map.naver.com/p/search/${encodeURIComponent(directionsQuery)}`;
  const kakaoWebUrl = `https://map.kakao.com/link/search/${encodeURIComponent(directionsQuery)}`;
  const tmapWebUrl = `https://www.tmap.co.kr/tmap2/mobile/route.jsp?name=${encodeURIComponent(directionsQuery)}`;
  const kakaoInquiryUrl = settings.kakao_inquiry_url.trim();
  const inquiryHref = kakaoInquiryUrl || `tel:${shop.phone.replace(/[^0-9+]/g, "")}`;
  const bookingHref = (serviceId?: string, serviceOptionId?: string) => {
    const href = new URL(`/book/${encodeURIComponent(shop.id)}`, "http://localhost");
    if (serviceId) href.searchParams.set("serviceId", serviceId);
    if (serviceOptionId) href.searchParams.set("serviceOptionId", serviceOptionId);
    return `${href.pathname}${href.search}`;
  };

  useEffect(() => {
    setActiveHeroIndex((current) => Math.min(current, Math.max(heroImages.length - 1, 0)));
  }, [heroImages.length]);

  useEffect(() => {
    if (heroImages.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % heroImages.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [heroImages.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentSeoulMinutes(getSeoulTimeMinutes());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function toggleBreedGuide(key: string) {
    setExpandedBreedGuideKeys((keys) => (keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]));
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

  function handleHeroTouchStart(event: TouchEvent<HTMLDivElement>) {
    heroTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleHeroTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (heroImages.length <= 1 || heroTouchStartXRef.current === null) return;
    const deltaX = (event.changedTouches[0]?.clientX ?? heroTouchStartXRef.current) - heroTouchStartXRef.current;
    heroTouchStartXRef.current = null;
    if (Math.abs(deltaX) < 32) return;
    setActiveHeroIndex((current) => {
      if (deltaX < 0) return (current + 1) % heroImages.length;
      return (current - 1 + heroImages.length) % heroImages.length;
    });
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-3 pb-6 pt-3">
      <section className="overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
        <div
          className="relative aspect-[16/9] overflow-hidden bg-[#efe7dd] text-white"
          onTouchStart={handleHeroTouchStart}
          onTouchEnd={handleHeroTouchEnd}
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

      <section className="mt-2 rounded-[12px] border border-[#e5e7eb] bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
        <div className="px-0.5 pb-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <h2 className="truncate text-[21px] font-semibold tracking-[-0.04em] text-[#2b241f]">{displayName}</h2>
              <button
                type="button"
                onClick={() => setHoursOpen((value) => !value)}
                aria-expanded={hoursOpen}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-1.5 py-1 text-[16px] font-normal text-[#6f6258] transition hover:bg-[#faf7f2]"
              >
                <span className={getDotIndicatorClass(operatingStatus.open ? "teal" : "neutral")} aria-hidden="true" />
                {operatingStatus.label}
                <ChevronDown className={`h-3.5 w-3.5 transition ${hoursOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>

        {hoursOpen ? (
          <div className="mt-1 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white text-[#26352f]">
            {weekRows.map((row, index) => {
              const hoursText = formatHoursRow(row.key, shop.business_hours, shop.regular_closed_days);
              const isToday = row.key === todayWeekday;
              return (
                <div
                  key={row.key}
                  className={`grid grid-cols-[1fr_120px] items-center px-4 py-2.5 text-[16px] ${
                    index !== weekRows.length - 1 ? "border-b border-[#edf0ee]" : ""
                  } ${isToday ? "bg-[#faf7f2]" : "bg-white"}`}
                >
                  <span className="font-normal">{row.label}</span>
                  <span className={`text-right ${hoursText === "휴무" ? "text-[#87918c]" : "text-[#26352f]"}`}>{hoursText}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="mt-2 text-[#071923]">
          <div className="grid gap-1.5">
            {serviceOptions.map((service) => (
                <a
                  key={service.id}
                  href={bookingHref(service.serviceId, service.id)}
                  className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-3 py-2 text-left transition hover:border-[#d8c8b8] hover:bg-[#fffdf9]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[16px] font-normal tracking-[-0.03em] text-[#2b241f]">{service.name}</span>
                    <span className="h-3 w-px shrink-0 bg-[#e5e7eb]" aria-hidden="true" />
                    <span className="shrink-0 text-[16px] font-normal text-[#7a6a5d]">{service.durationMinutes}분 예상</span>
                  </span>
                  <span className="shrink-0 text-right text-[16px] font-normal text-[#7A5A45]">
                    {formatServicePrice(service.price, service.priceType)}
                  </span>
                </a>
              ))}
          </div>
          {priceGuideExtraFeeGroups.length > 0 ? (
            <div className="mt-2 rounded-[8px] border border-[#eadfd6] bg-[#fffdf9] px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[16px] font-normal tracking-[-0.02em] text-[#3f352d]">추가 요금 안내</p>
                <button
                  type="button"
                  onClick={() => setPriceSheetOpen(true)}
                  className="shrink-0 whitespace-nowrap text-[16px] font-normal text-[#7A5A45]"
                >
                  자세히
                </button>
              </div>
              <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto">
                {priceGuideExtraFeeGroups[0].extraFees.slice(0, 5).map((fee) => (
                  <span
                    key={fee.id}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[#eadfd6] bg-white px-2.5 text-[16px] font-normal text-[#4a3a30]"
                  >
                    <span>{fee.label}</span>
                    {fee.price ? <span className="text-[#7A5A45]">{fee.price}</span> : null}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setPriceSheetOpen(true)}
            className="mt-2 flex h-[42px] w-full items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white text-[16px] font-normal leading-none text-[#3f352d] hover:bg-[#faf7f2]"
            style={{ fontSize: 16, fontWeight: 400 }}
          >
            요금표 전체보기
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirectionsOpen(true)}
            className="flex h-[42px] w-full items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white text-[16px] font-normal leading-none text-[#3f352d] hover:bg-[#faf7f2]"
            style={{ fontSize: 16, fontWeight: 400 }}
          >
            길찾기
          </button>
          <a
            href={inquiryHref}
            target={kakaoInquiryUrl ? "_blank" : undefined}
            rel={kakaoInquiryUrl ? "noreferrer" : undefined}
            className="flex h-[42px] w-full items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white text-[16px] font-normal leading-none text-[#3f352d] hover:bg-[#faf7f2]"
            style={{ fontSize: 16, fontWeight: 400 }}
          >
            문의하기
          </a>
        </div>
      </section>

      {priceSheetOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 px-4" onClick={() => setPriceSheetOpen(false)}>
          <div className="max-h-[82vh] w-full max-w-[430px] overflow-hidden rounded-t-[18px] bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[#e5e7eb]" />
            <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-4">
              <div>
                <p className="text-[16px] font-normal text-[#7A5A45]">미용 요금</p>
                <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-[#071923]">요금표 전체보기</h3>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white text-[#7a5a45]"
                onClick={() => setPriceSheetOpen(false)}
                aria-label="요금표 닫기"
              >
                <X className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </div>

            <div className="max-h-[calc(82vh-88px)] overflow-y-auto px-4 pb-5">
              {priceGuideSections.length > 0 ? (
                <div className="space-y-3">
                  {priceGuideSections.map(({ serviceId, serviceName, section }) => {
                    const breedGuide = parseBreedGuideNote(section.note);
                    const breedGuideKey = `${serviceId}-${section.id}`;
                    const breedGuideOpen = expandedBreedGuideKeys.includes(breedGuideKey);

                    return (
                    <section key={breedGuideKey} className="overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white">
                      <div className="border-b border-[#edf0ee] bg-[#fffdf9] p-2">
                        {breedGuide ? (
                          <button
                            type="button"
                            onClick={() => toggleBreedGuide(breedGuideKey)}
                            className="flex w-full items-start justify-between gap-3 rounded-[8px] px-2 py-1.5 text-left transition hover:bg-[#faf7f2]"
                            aria-expanded={breedGuideOpen}
                          >
                            <span className="min-w-0">
                              <span className="block text-[16px] font-normal text-[#2b241f]">{formatBreedGroupTitle(section.title, serviceName)}</span>
                              <span className="mt-1 block truncate text-[16px] font-normal leading-6 text-[#7a6a5d]">대표 품종: {breedGuide.summary}</span>
                            </span>
                            <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#eadfd6] bg-white text-[#7A5A45]">
                              <ChevronDown className={`h-4 w-4 transition ${breedGuideOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
                            </span>
                          </button>
                        ) : (
                          <div className="px-2 py-1.5">
                            <p className="text-[16px] font-normal text-[#2b241f]">{formatBreedGroupTitle(section.title, serviceName)}</p>
                          </div>
                        )}
                        {breedGuide && breedGuideOpen ? (
                          <div className="mt-1 flex flex-wrap gap-1.5 px-2 pb-1">
                            {breedGuide.breeds.map((breed) => (
                              <span key={`${breedGuideKey}-${breed}`} className="inline-flex h-8 items-center rounded-full border border-[#eadfd6] bg-white px-2.5 text-[16px] font-normal text-[#4a3a30]">
                                {breed}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-[560px] w-full border-collapse text-center">
                          <thead>
                            <tr className="bg-[#fbfaf8] text-[16px] font-normal text-[#7a6a5d]">
                              <th className="w-[96px] border-b border-r border-[#edf0ee] px-3 py-2 text-center font-normal">무게</th>
                              {section.items.map((item) => (
                                <th key={item.id} className="border-b border-r border-[#edf0ee] px-3 py-2 text-center font-normal last:border-r-0">
                                  {item.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.weightBands.map((band) => (
                              <tr key={band} className="text-[16px] text-[#2b241f]">
                                <td className="border-b border-r border-[#edf0ee] px-3 py-2 text-center text-[#6f6258]">{band}</td>
                                {section.items.map((item) => {
                                  const { priceText, durationText } = formatPriceGuideCell(item.cells[band]);
                                  return (
                                    <td key={`${item.id}-${band}`} className="border-b border-r border-[#edf0ee] px-3 py-2 text-center last:border-r-0">
                                      <span className="block whitespace-nowrap text-[16px] font-normal text-[#2b241f]">{priceText}</span>
                                      {durationText ? <span className="mt-0.5 block whitespace-nowrap text-[16px] font-normal text-[#7a6a5d]">{durationText}</span> : null}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[10px] border border-[#e5e7eb] bg-white">
                  <a href={infoHref} className="flex h-14 items-center justify-center text-[16px] font-normal text-[#3f352d]">
                    등록된 전체 요금표가 없습니다.
                  </a>
                </div>
              )}
              {priceGuideExtraFeeGroups.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {priceGuideExtraFeeGroups.map((group) => (
                    <section key={`${group.serviceId}-extra-fees`} className="rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[16px] font-normal text-[#2b241f]">추가 요금 안내</p>
                          {priceGuideExtraFeeGroups.length > 1 ? (
                            <p className="mt-0.5 text-[16px] font-normal text-[#7a6a5d]">{group.serviceName}</p>
                          ) : null}
                        </div>
                      </div>
                      {group.extraNote ? (
                        <p className="mt-2 whitespace-pre-line text-[16px] font-normal leading-6 text-[#6f6258]">{group.extraNote}</p>
                      ) : null}
                      {group.extraFees.length > 0 ? (
                        <div className="mt-3 overflow-hidden rounded-[8px] border border-[#edf0ee]">
                          {group.extraFees.map((fee, index) => (
                            <div
                              key={fee.id}
                              className={`grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2 px-3 py-2 text-[16px] ${
                                index !== group.extraFees.length - 1 ? "border-b border-[#edf0ee]" : ""
                              }`}
                            >
                              <span className="truncate font-normal text-[#3f352d]">{fee.label}</span>
                              <span className="text-right font-normal text-[#7A5A45]">{fee.price}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ))}
                </div>
              ) : null}
              {priceGuideExtraFeeGroups.length === 0 ? (
                <p className="mt-3 text-[16px] leading-6 text-[#7a6a5d]">실제 요금은 아이 상태와 털엉킴, 기장, 피부 상태에 따라 매장에서 최종 안내드릴 수 있어요.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {directionsOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 px-4" onClick={() => setDirectionsOpen(false)}>
          <div className="w-full max-w-[430px] rounded-t-[18px] bg-white p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#e5e7eb]" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[16px] font-normal" style={{ color: bookingAccentColor }}>
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
              <p className="text-[16px] leading-6 text-[#6f6258]">{displayAddress}</p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-4 text-[16px] font-normal text-[#26352f] hover:bg-[#faf7f2]"
                >
                  <Copy className="h-4 w-4" strokeWidth={1.9} />
                  {addressCopied ? "복사 완료" : "주소 복사"}
                </button>
                <a
                  href={`tel:${shop.phone.replace(/[^0-9+]/g, "")}`}
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-4 text-[16px] font-normal text-[#26352f] hover:bg-[#faf7f2]"
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
        <span className="text-[16px] font-normal tracking-[-0.02em] text-[#26352f]">{label}</span>
      </span>
      <span className="text-[16px] font-normal text-[#7a6a5d]">열기</span>
    </button>
  );
}

