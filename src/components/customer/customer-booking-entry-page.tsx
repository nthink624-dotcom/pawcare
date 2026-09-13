"use client";

import { ChevronDown, Copy, Navigation, Phone, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type TouchEvent } from "react";

import CustomerEntryServicePicker from "@/components/customer/customer-entry-service-picker";
import CustomerFullPriceGuide from "@/components/customer/customer-full-price-guide";
import {
  buildCustomerServiceMenuOptions,
  buildCustomerServiceSourceOptions,
  formatCustomerServiceDuration,
} from "@/lib/customer-service-options";
import {
  formatDiscountCouponValue,
  getDiscountCouponDisplayName,
  isDiscountCouponActive,
} from "@/lib/discount-coupons";
import { fetchApiJson } from "@/lib/api";
import { MAX_CUSTOMER_PAGE_HERO_IMAGES } from "@/lib/customer-page-settings";
import { isShopClosedOnDate } from "@/lib/availability";
import { readCanonicalPriceGuide } from "@/lib/price-guide-core";
import { defaultStaffProfileMessage } from "@/lib/staff-display";
import { formatServicePrice } from "@/lib/utils";
import type { BootstrapStaffMember, BusinessHours, OwnerProfile, Service, Shop } from "@/types/domain";

const visibleDateOptionCount = 4;
const heroSidePaddingPx = 14;
const HERO_SIGNED_URL_REFRESH_MS = 4 * 60 * 1000;

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

type StaffProfileCard = {
  id: string;
  name: string;
  caption: string;
  imageUrl: string;
  imageUrls: string[];
};

type PublicMediaSignedUrlsResponse = {
  items: Array<{
    mediaAssetId: string;
    signedUrl: string;
  }>;
};

function normalizeStaffProfileImages(images: unknown, fallback = "") {
  const normalized = (Array.isArray(images) ? images : [])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const fallbackUrl = fallback.trim();
  return normalized.length > 0 ? normalized : fallbackUrl ? [fallbackUrl] : [];
}

function getLockedHeroCardTargetLeft({
  activeIndex,
  imageCount,
  galleryWidth,
  cardWidth,
}: {
  activeIndex: number;
  imageCount: number;
  galleryWidth: number;
  cardWidth: number;
}) {
  if (activeIndex >= imageCount - 1) return galleryWidth - heroSidePaddingPx - cardWidth;
  if (activeIndex > 0) return (galleryWidth - cardWidth) / 2;
  return heroSidePaddingPx;
}

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
  shop: Pick<
    Shop,
    | "business_hours"
    | "regular_closed_days"
    | "regular_closed_cycle"
    | "regular_closed_anchor_date"
    | "temporary_closed_dates"
    | "reservation_policy_settings"
  >,
): EntryDateOption[] {
  const options: EntryDateOption[] = [];
  const todayKey = getSeoulDateKey();
  const startDate = new Date(`${todayKey}T00:00:00`);
  let offset = 0;

  while (options.length < 30 && offset < 90) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + offset);
      const value = formatDateKey(date);
      const isClosed = isShopClosedOnDate(shop, value);

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

function normalizeExternalHref(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function buildSelectedServiceBookingHref(
  baseHref: string,
  service: { id: string; serviceId: string },
) {
  const separator = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${separator}serviceId=${encodeURIComponent(service.serviceId)}&serviceOptionId=${encodeURIComponent(service.id)}`;
}

export type CustomerBookingPreviewSelection = {
  serviceId: string;
  serviceOptionId: string;
};

export function resolveHeroImages(value: string | undefined, values?: string[]) {
  const uploadedImages = Array.isArray(values)
    ? values.filter((imageUrl): imageUrl is string => typeof imageUrl === "string" && imageUrl.trim().length > 0).slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES)
    : [];
  const uploadedImage = value?.trim();
  if (uploadedImages.length > 0) return uploadedImages;
  return uploadedImage ? [uploadedImage] : [];
}

function uniqueNonEmptyStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function cssBackgroundUrl(imageUrl: string) {
  const escapedUrl = imageUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${escapedUrl}")`;
}

function getTodayOperatingStatus(
  shop: Pick<
    Shop,
    | "business_hours"
    | "regular_closed_days"
    | "regular_closed_cycle"
    | "regular_closed_anchor_date"
    | "temporary_closed_dates"
    | "reservation_policy_settings"
  >,
  currentMinutes: number,
) {
  const todayKey = getSeoulDateKey();
  const todayWeekday = getTodayWeekdayInSeoul();
  const hours = shop.business_hours[todayWeekday];
  const isClosed = isShopClosedOnDate(shop, todayKey);

  if (isClosed || !hours) return { label: "휴무", open: false };

  const openMinutes = timeTextToMinutes(hours.open);
  const closeMinutes = timeTextToMinutes(hours.close);
  if (openMinutes === null || closeMinutes === null) return { label: "영업시간 확인", open: false };
  if (currentMinutes < openMinutes) return { label: "영업 전", open: false };
  if (currentMinutes >= closeMinutes) return { label: "영업 종료", open: false };
  return { label: "영업 중", open: true };
}

function readElementTopInEntryViewport(element: HTMLElement, viewport: HTMLElement) {
  const viewportRect = viewport.getBoundingClientRect();
  const renderedHeight = viewportRect.height;
  const coordinateScale = renderedHeight > 0 ? viewport.clientHeight / renderedHeight : 1;
  return (element.getBoundingClientRect().top - viewportRect.top) * coordinateScale;
}

export default function CustomerBookingEntryPage({
  shop,
  services,
  staffMembers = [],
  ownerProfile,
  infoHref,
  bookingHref,
  previewMode = false,
  previewSelectedServiceOptionId = "",
  onPreviewBookingStart,
}: {
  shop: Pick<Shop, "id" | "name" | "phone" | "address" | "description" | "approval_mode" | "customer_page_settings" | "business_hours" | "regular_closed_days" | "temporary_closed_dates">;
  services: Service[];
  staffMembers?: BootstrapStaffMember[];
  ownerProfile?: OwnerProfile | null;
  infoHref: string;
  bookingHref?: string;
  previewMode?: boolean | "entry" | "staffSelection";
  previewSelectedServiceOptionId?: string;
  onPreviewBookingStart?: (selection: CustomerBookingPreviewSelection) => void;
}) {
  const settings = shop.customer_page_settings;
  const displayName = shop.name;
  const bookingAccentColor = "#a9473f";
  const displayAddress = [shop.address, settings.address_detail].filter(Boolean).join(", ");
  const todayWeekday = getTodayWeekdayInSeoul();
  const [currentSeoulMinutes, setCurrentSeoulMinutes] = useState(() => getSeoulTimeMinutes());
  const operatingStatus = getTodayOperatingStatus(shop, currentSeoulMinutes);
  const sourceServiceOptions = useMemo(
    () =>
      buildCustomerServiceSourceOptions(
        services
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ko")),
        {},
      ),
    [services],
  );
  const serviceOptions = useMemo(
    () => buildCustomerServiceMenuOptions(sourceServiceOptions),
    [sourceServiceOptions],
  );
  const canonicalPriceGuide = useMemo(
    () => services.map((service) => readCanonicalPriceGuide(service.price_guide)).find((document) => document !== null) ?? null,
    [services],
  );
  const heroMediaAssetIds = useMemo(
    () => uniqueNonEmptyStrings(settings.hero_media_asset_ids ?? (settings.hero_media_asset_id ? [settings.hero_media_asset_id] : [])).slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES),
    [settings.hero_media_asset_id, settings.hero_media_asset_ids],
  );
  const heroMediaAssetKey = heroMediaAssetIds.join("|");
  const [resolvedHeroAssets, setResolvedHeroAssets] = useState<{ key: string; urls: string[] }>({ key: "", urls: [] });
  const resolvedHeroAssetUrls = resolvedHeroAssets.key === heroMediaAssetKey ? resolvedHeroAssets.urls : [];
  const heroImages = useMemo(
    () =>
      resolveHeroImages(
        settings.hero_image_url,
        [...resolvedHeroAssetUrls, ...(settings.hero_image_urls ?? [])],
      ),
    [resolvedHeroAssetUrls, settings.hero_image_url, settings.hero_image_urls],
  );
  const staffProfileCards = useMemo<StaffProfileCard[]>(() => {
    const cards = staffMembers
      .map((staff) => {
        const name = staff.displayName?.trim() || staff.name.trim();
        if (!name) return null;
        const imageUrls = normalizeStaffProfileImages(staff.profileImageUrls, staff.profileImageUrl);
        return {
          id: staff.id,
          name,
          caption: staff.profileMessage?.trim() || defaultStaffProfileMessage,
          imageUrl: imageUrls[0] ?? "",
          imageUrls,
        };
      })
      .filter((card): card is StaffProfileCard => Boolean(card));

    if (cards.length > 0) return cards;

    const ownerProfileImage = typeof ownerProfile?.agreements?.profile_image_url === "string"
      ? ownerProfile.agreements.profile_image_url.trim()
      : "";

    return [{
      id: "owner-profile",
      name: ownerProfile?.name?.trim() || "오너",
      caption: defaultStaffProfileMessage,
      imageUrl: ownerProfileImage,
      imageUrls: normalizeStaffProfileImages([], ownerProfileImage),
    }];
  }, [ownerProfile, staffMembers]);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);
  const [selectedServiceOptionId, setSelectedServiceOptionId] = useState("");
  const [hoursOpen, setHoursOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [heroGalleryOpen, setHeroGalleryOpen] = useState(false);
  const [activeStaffProfileIndex, setActiveStaffProfileIndex] = useState(0);
  const [profileViewer, setProfileViewer] = useState<StaffProfileCard | null>(null);
  const [profileViewerImageIndex, setProfileViewerImageIndex] = useState(0);
  const [heroTrackTranslatePx, setHeroTrackTranslatePx] = useState(0);
  const [heroMediaRefreshNonce, setHeroMediaRefreshNonce] = useState(0);
  const entryRootRef = useRef<HTMLDivElement | null>(null);
  const entryScrollRef = useRef<HTMLDivElement | null>(null);
  const entryDockRef = useRef<HTMLDivElement | null>(null);
  const heroGalleryRef = useRef<HTMLDivElement | null>(null);
  const priceSheetCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const heroMediaAssetRequestKeyRef = useRef("");
  const heroTouchStartXRef = useRef<number | null>(null);
  const staffProfileTouchStartXRef = useRef<number | null>(null);
  const staffProfilePointerStartXRef = useRef<number | null>(null);
  const selectedServiceOption = serviceOptions.find((service) => service.id === selectedServiceOptionId) ?? null;
  const baseBookingHref = bookingHref ?? `/book/${encodeURIComponent(shop.id)}`;
  const selectedServiceBookingHref = selectedServiceOption
    ? buildSelectedServiceBookingHref(baseBookingHref, selectedServiceOption)
    : "";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!previewMode || !previewSelectedServiceOptionId) return;
      if (!serviceOptions.some((service) => service.id === previewSelectedServiceOptionId)) return;
      setSelectedServiceOptionId(previewSelectedServiceOptionId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [previewMode, previewSelectedServiceOptionId, serviceOptions]);

  useEffect(() => {
    const root = entryRootRef.current;
    const viewport = entryScrollRef.current;
    const dock = entryDockRef.current;
    const card = root?.querySelector<HTMLElement>("[data-customer-service-picker='card-pinned-action']");
    if (!root || !viewport || !dock || !card) return;

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const cardTop = readElementTopInEntryViewport(card, viewport);
        const dockTop = readElementTopInEntryViewport(dock, viewport);
        const availableHeight = Math.max(48, Math.floor(dockTop - cardTop - 8));
        const nextHeight = `${availableHeight}px`;
        if (root.style.getPropertyValue("--customer-price-guide-card-height") !== nextHeight) {
          root.style.setProperty("--customer-price-guide-card-height", nextHeight);
        }
      });
    };
    const resizeObserver = new ResizeObserver(measure);
    [viewport, dock, card, ...root.querySelectorAll<HTMLElement>(".gwrap,.pbar,.srow")].forEach((element) => resizeObserver.observe(element));

    viewport.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    measure();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      root.style.removeProperty("--customer-price-guide-card-height");
    };
  }, [serviceOptions.length]);

  useEffect(() => {
    if (!priceSheetOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const pageScroller = entryScrollRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousPageOverflow = pageScroller?.style.overflow ?? "";
    const focusFrame = window.requestAnimationFrame(() => priceSheetCloseButtonRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPriceSheetOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    if (pageScroller) pageScroller.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      if (pageScroller) pageScroller.style.overflow = previousPageOverflow;
      previouslyFocused?.focus();
    };
  }, [priceSheetOpen]);

  const directionsQuery = useMemo(() => [displayName, displayAddress].filter(Boolean).join(" "), [displayName, displayAddress]);
  const naverWebUrl = `https://map.naver.com/p/search/${encodeURIComponent(directionsQuery)}`;
  const preferredMap = {
    label: "네이버 지도에서 열기",
    appUrl: `nmap://search?query=${encodeURIComponent(directionsQuery)}&appname=${encodeURIComponent("kr.petmanager.app")}`,
    webUrl: naverWebUrl,
  };
  const socialLinks = useMemo(
    () => [
      {
        key: "instagram",
        label: "인스타그램",
        href: normalizeExternalHref(settings.social_links?.instagram_url),
        iconSrc: "/icons/social/instagram-social.png",
      },
      {
        key: "kakao",
        label: "카카오톡",
        href: normalizeExternalHref(settings.social_links?.kakao_channel_url),
        iconSrc: "/icons/social/kakao-social.png",
      },
      {
        key: "naver-blog",
        label: "네이버 블로그",
        href: normalizeExternalHref(settings.social_links?.naver_blog_url),
        iconSrc: "/icons/social/naver-blog-social.png",
      },
      {
        key: "threads",
        label: "쓰레드",
        href: normalizeExternalHref(settings.social_links?.threads_url),
        iconSrc: "/icons/social/threads-social.png",
      },
    ].filter((link) => link.href.length > 0),
    [
      settings.social_links?.instagram_url,
      settings.social_links?.kakao_channel_url,
      settings.social_links?.naver_blog_url,
      settings.social_links?.threads_url,
    ],
  );
  const publicBenefitCards = useMemo(() => {
    const todayKey = getSeoulDateKey();
    return (settings.discount_coupons ?? [])
      .filter((coupon) => isDiscountCouponActive(coupon, todayKey))
      .map((coupon) => ({
        id: coupon.id,
        name: getDiscountCouponDisplayName(coupon),
        value: formatDiscountCouponValue(coupon),
      }))
      .slice(0, 3);
  }, [settings.discount_coupons]);
  const visibleHeroIndex = Math.min(activeHeroIndex, Math.max(heroImages.length - 1, 0));
  const heroDotCount = Math.min(heroImages.length, 4);
  const visibleStaffProfileIndex = Math.min(activeStaffProfileIndex, Math.max(staffProfileCards.length - 1, 0));

  useEffect(() => {
    const mediaAssetIds = heroMediaAssetKey ? heroMediaAssetKey.split("|").filter(Boolean) : [];
    if (!mediaAssetIds.length) {
      heroMediaAssetRequestKeyRef.current = "";
      return;
    }

    const requestKey = `${shop.id}:${heroMediaAssetKey}:${heroMediaRefreshNonce}`;
    if (heroMediaAssetRequestKeyRef.current === requestKey) {
      return;
    }
    heroMediaAssetRequestKeyRef.current = requestKey;

    let cancelled = false;
    void fetchApiJson<PublicMediaSignedUrlsResponse>("/api/media/public-signed-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId: shop.id,
        mediaAssetIds,
        // 매장 소개 사진은 별도 알림톡 변환본이 없어도 원본을 바로 보여 줍니다.
        // 이 요청은 서버에서 일괄 서명하므로 갤러리 수만큼 별도 요청하지 않습니다.
        variant: "original",
      }),
    })
      .then((result) => {
        if (cancelled) return;
        const urlsByAssetId = new Map(result.items.map((item) => [item.mediaAssetId, item.signedUrl]));
        const nextUrls = mediaAssetIds.map((mediaAssetId) => urlsByAssetId.get(mediaAssetId) ?? "").filter(Boolean);
        setResolvedHeroAssets((current) => {
          if (current.key === heroMediaAssetKey && areStringArraysEqual(current.urls, nextUrls)) return current;
          return {
            key: heroMediaAssetKey,
            urls: nextUrls,
          };
        });
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedHeroAssets((current) => {
            if (current.key === heroMediaAssetKey && current.urls.length === 0) return current;
            return { key: heroMediaAssetKey, urls: [] };
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [heroMediaAssetKey, heroMediaRefreshNonce, shop.id]);

  useEffect(() => {
    if (!heroMediaAssetKey) return;

    const refreshSignedUrls = () => setHeroMediaRefreshNonce((current) => current + 1);
    const timer = window.setInterval(refreshSignedUrls, HERO_SIGNED_URL_REFRESH_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshSignedUrls();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [heroMediaAssetKey]);

  useEffect(() => {
    const gallery = heroGalleryRef.current;
    if (!gallery) return;

    let animationFrame = 0;
    const updateHeroTrackPosition = () => {
      const cards = Array.from(gallery.querySelectorAll<HTMLElement>(".gcard"));
      const activeCard = cards[visibleHeroIndex];
      if (!activeCard || heroImages.length <= 1) {
        setHeroTrackTranslatePx(0);
        return;
      }

      // Locked hero carousel contract:
      // first image = left aligned with next sliver, last image = right aligned with previous sliver,
      // middle images = centered with both side slivers. Keep this measured in pixels; do not replace
      // it with percentage-based translate because card width changes with the rendered viewport.
      const activeLeft = activeCard.offsetLeft;
      const targetLeft = getLockedHeroCardTargetLeft({
        activeIndex: visibleHeroIndex,
        imageCount: heroImages.length,
        galleryWidth: gallery.clientWidth,
        cardWidth: activeCard.offsetWidth,
      });
      const nextTranslatePx = Math.round(targetLeft - activeLeft);
      setHeroTrackTranslatePx((current) => (current === nextTranslatePx ? current : nextTranslatePx));
    };
    const scheduleHeroTrackPositionUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateHeroTrackPosition);
    };

    scheduleHeroTrackPositionUpdate();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleHeroTrackPositionUpdate) : null;
    resizeObserver?.observe(gallery);
    window.addEventListener("resize", scheduleHeroTrackPositionUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleHeroTrackPositionUpdate);
    };
  }, [heroImages.length, visibleHeroIndex]);

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

  function handleStaffProfileTouchStart(event: TouchEvent<HTMLDivElement>) {
    staffProfileTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleStaffProfileTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (staffProfileCards.length <= 1 || staffProfileTouchStartXRef.current === null) return;
    const deltaX = (event.changedTouches[0]?.clientX ?? staffProfileTouchStartXRef.current) - staffProfileTouchStartXRef.current;
    staffProfileTouchStartXRef.current = null;
    if (Math.abs(deltaX) < 28) return;
    moveStaffProfile(deltaX);
  }

  function moveStaffProfile(deltaX: number) {
    setActiveStaffProfileIndex((current) => {
      if (deltaX < 0) return (current + 1) % staffProfileCards.length;
      return (current - 1 + staffProfileCards.length) % staffProfileCards.length;
    });
  }

  function handleStaffProfilePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (staffProfileCards.length <= 1 || event.pointerType === "touch") return;
    staffProfilePointerStartXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleStaffProfilePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (staffProfileCards.length <= 1 || staffProfilePointerStartXRef.current === null) return;
    const deltaX = event.clientX - staffProfilePointerStartXRef.current;
    staffProfilePointerStartXRef.current = null;
    if (Math.abs(deltaX) < 24) return;
    moveStaffProfile(deltaX);
  }

  function handleStaffProfilePointerCancel() {
    staffProfilePointerStartXRef.current = null;
  }

  return (
    <div ref={entryRootRef} data-customer-entry-root="true" className={`pm-entry-proto${publicBenefitCards.length > 0 ? " has-benefits" : ""} mx-auto w-full max-w-[430px] bg-[#fdf7f5] text-[#3a2e2a]`}>
      <style>{`
        .pm-entry-proto{--text:#3a2e2a;--textMid:#8a7a72;--textMuted:#b6a89f;--open:#1f9d55;--closed:#a04455;--primary:#ec7f72;--primaryDk:#a9473f;--primarySoft:#fce9e4;--surface:#fdf7f5;--track:#f6e2db;--border:#efe2dc;--borderSoft:#f5ebe6;--card:#fff;--r:14px;--rbtn:12px;position:relative;height:var(--customer-entry-viewport-height,100dvh);min-height:0;overflow:hidden}
        .pm-entry-proto :is(button,a,input,textarea,select,[role="button"]):focus-visible{outline:2px solid #2563eb;outline-offset:2px;box-shadow:0 0 0 3px rgba(37,99,235,.18)}
        .pm-entry-proto :is(input,textarea)::placeholder{color:#94a3b8;opacity:1;font-size:16px;line-height:24px}
        .pm-entry-proto .scroll{height:100%;overflow:auto;scrollbar-width:none;padding-bottom:102px}
        .pm-entry-proto.has-benefits .scroll{padding-bottom:132px}
        .pm-entry-proto .scroll::-webkit-scrollbar{display:none}
        .pm-entry-proto .gwrap{padding-top:14px;overflow:hidden}
        .pm-entry-proto .gallery{display:flex;gap:8px;overflow:visible;padding:0 14px;scrollbar-width:none;transition:transform .45s ease}
        .pm-entry-proto .gallery::-webkit-scrollbar{display:none}
        .pm-entry-proto .gcard{flex:0 0 88%;scroll-snap-align:center;height:238px;border-radius:16px;position:relative;overflow:hidden;background-size:cover;background-position:center;background-repeat:no-repeat}
        .pm-entry-proto .gcard.clickable{cursor:pointer}
        .pm-entry-proto .gslot{flex:0 0 54px;height:238px;border-radius:16px;background:repeating-linear-gradient(135deg,#fff3ef 0,#fff3ef 9px,#f6ddd6 9px,#f6ddd6 18px);opacity:.78}
        .pm-entry-proto .gcard .ovl{position:absolute;inset:0;background:linear-gradient(to top,rgba(15,23,42,.5) 0%,transparent 42%)}
        .pm-entry-proto .gcard .id{position:absolute;left:16px;bottom:15px;color:#fff}
        .pm-entry-proto .gcard .id .nm{font-size:22px;font-weight:600;letter-spacing:-.03em;text-shadow:0 1px 6px rgba(0,0,0,.35)}
        .pm-entry-proto .gcard .cnt{position:absolute;right:12px;top:12px;border:0;font-family:inherit;font-size:11px;font-weight:600;color:#fff;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);border-radius:20px;padding:5px 11px;cursor:pointer}
        .pm-entry-proto .gcard.empty{border:1px solid var(--border);background:linear-gradient(135deg,#fff 0%,#fff8f5 58%,#fce9e4 100%)}
        .pm-entry-proto .gcard.empty .id{color:var(--text)}
        .pm-entry-proto .gcard.empty .id .nm{text-shadow:none}
        .pm-entry-proto .gdots{display:flex;justify-content:center;align-items:center;gap:5px;padding:11px 0 1px}
        .pm-entry-proto .gdots i{width:6px;height:6px;border-radius:999px;background:#efd8d1;display:block;transition:width .2s,background-color .2s;opacity:.9}
        .pm-entry-proto .gdots i.clickable{cursor:pointer}
        .pm-entry-proto .gdots i.on{width:18px;background:var(--primary);opacity:1}
        .pm-entry-proto .body{padding:12px 16px 6px;display:flex;flex-direction:column;gap:16px}
        .pm-entry-proto .pbar{position:relative;overflow:hidden}
        .pm-entry-proto .pbar .ptrack{display:flex;transition:transform .28s ease;touch-action:pan-y;cursor:grab}
        .pm-entry-proto .pbar:active .ptrack{cursor:grabbing}
        .pm-entry-proto .pbar .pcard-profile{display:flex;min-width:100%;align-items:center;gap:12px;border:0;background:transparent;padding:0;text-align:left;color:inherit;font-family:inherit;cursor:pointer}
        .pm-entry-proto .pbar .av{width:50px;height:50px;border-radius:50%;flex-shrink:0;background-size:cover;background-position:center;background-repeat:no-repeat;background-color:var(--primarySoft);color:var(--primaryDk);display:flex;align-items:center;justify-content:center}
        .pm-entry-proto .pbar .who{min-width:0;flex:1}
        .pm-entry-proto .pbar .nm{font-size:17px;font-weight:600;letter-spacing:-.02em}
        .pm-entry-proto .pbar .sub{font-size:13px;color:var(--textMuted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pm-entry-proto .pdots{display:flex;align-items:center;gap:4px;margin-left:62px;margin-top:7px}
        .pm-entry-proto .pdots i{display:block;width:5px;height:5px;border-radius:999px;background:#efd8d1;transition:width .18s,background-color .18s;cursor:pointer}
        .pm-entry-proto .pdots i.on{width:14px;background:var(--primary)}
        .pm-entry-proto .srow{display:flex;align-items:flex-start;gap:10px}
        .pm-entry-proto .socials{display:flex;gap:9px;margin-left:auto}
        .pm-entry-proto .socials .chip{width:44px;height:44px;min-width:44px;min-height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;box-shadow:none;cursor:pointer;border:1px solid var(--border);background:var(--card);overflow:hidden}
        .pm-entry-proto .socials .chip img{width:30px;height:30px;object-fit:contain;display:block}
        .pm-entry-proto .hours{position:relative}
        .pm-entry-proto .hours .top{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;border:1px solid var(--border);border-radius:13px;background:var(--card);cursor:pointer;user-select:none;font-size:16px;font-weight:500;color:var(--text);white-space:nowrap}
        .pm-entry-proto .hours .top .od{width:8px;height:8px;border-radius:50%;background:var(--open);display:block}
        .pm-entry-proto .hours .top.closed .od{background:var(--closed)}
        .pm-entry-proto .hours .top .chev{width:14px;height:14px;color:var(--textMuted);transition:transform .25s;flex-shrink:0}
        .pm-entry-proto .hours.open .top .chev{transform:rotate(180deg)}
        .pm-entry-proto .hours .list{position:absolute;left:0;top:50px;z-index:10;width:calc(min(100vw,430px) - 32px);max-width:398px;animation:hdrop .18s ease}
        .pm-entry-proto .hours .inner{background:var(--card);border:1px solid var(--border);border-radius:15px;padding:5px 15px;box-shadow:0 16px 34px rgba(60,40,30,.18)}
        .pm-entry-proto .hours .hrow{display:flex;align-items:center;justify-content:space-between;gap:14px;font-size:16px;padding:11px 0}
        .pm-entry-proto .hours .hrow + .hrow{border-top:1px solid var(--borderSoft)}
        .pm-entry-proto .hours .hrow .d{flex:0 0 62px;color:var(--textMid)}
        .pm-entry-proto .hours .hrow .t{color:var(--text);font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
        .pm-entry-proto .hours .hrow.today .d,.pm-entry-proto .hours .hrow.today .t{color:var(--primaryDk);font-weight:600}
        .pm-entry-proto .benefits{width:100%;overflow:hidden}
        .pm-entry-proto .benefits-track{display:flex;width:max-content;gap:8px;will-change:transform}
        .pm-entry-proto .benefits.is-animated .benefits-track{animation:benefitSlide 7s ease-in-out infinite alternate}
        .pm-entry-proto .benefits:hover .benefits-track,.pm-entry-proto .benefits:focus-within .benefits-track{animation-play-state:paused}
        .pm-entry-proto .benefit{display:flex;min-height:38px;width:calc(min(100vw,430px) - 32px);flex:0 0 auto;align-items:center;justify-content:space-between;gap:10px;border:1px solid #f2d8d2;background:rgba(255,255,255,.72);border-radius:11px;padding:8px 11px}
        .pm-entry-proto .benefit .txt{min-width:0}
        .pm-entry-proto .benefit .name{font-size:13.5px;font-weight:600;letter-spacing:-.02em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pm-entry-proto .benefit .val{flex-shrink:0;font-size:13.5px;font-weight:500;color:var(--primaryDk);white-space:nowrap}
        .pm-entry-proto .pcard{display:flex;height:var(--customer-price-guide-card-height,auto);min-height:48px;flex-direction:column;background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
        .pm-entry-proto .pcard .service-options-scroll{min-height:0;flex:1 1 auto;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;touch-action:pan-y}
        .pm-entry-proto .pcard .service-options-scroll::-webkit-scrollbar{display:none}
        .pm-entry-proto .pcard .pr{display:flex;width:100%;align-items:center;padding:13px 15px;border:0;background:var(--card);font-family:inherit;color:inherit;text-align:left;cursor:pointer;transition:background .15s,box-shadow .15s}
        .pm-entry-proto .pcard .pr + .pr{border-top:1px solid var(--borderSoft)}
        .pm-entry-proto .pcard .pr.sel{background:var(--primarySoft)}
        .pm-entry-proto .pcard .pr .radio-check{width:21px;height:21px;margin-right:10px;border:1.5px solid #d7c9c4;border-radius:50%;background:#fff;color:var(--text);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:border-color .15s,background-color .15s,box-shadow .15s}
        .pm-entry-proto .pcard .pr.sel .radio-check{border-color:var(--primary);background:var(--primary);box-shadow:0 0 0 3px rgba(236,127,114,.18)}
        .pm-entry-proto .pcard .pr .n{font-size:15px;font-weight:500;letter-spacing:-.02em;white-space:nowrap}
        .pm-entry-proto .pcard .pr .d{font-size:12.5px;color:var(--textMuted);margin-left:8px;white-space:nowrap;overflow:hidden}
        .pm-entry-proto .pcard .pr .p{margin-left:auto;font-size:16px;font-weight:600;color:var(--primaryDk);font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:8px}
        .pm-entry-proto .pcard .full{position:static;z-index:auto;display:flex;height:48px;min-height:48px;width:100%;flex:0 0 48px;transform:none;align-items:center;justify-content:center;gap:5px;padding:0 14px;border:0;border-top:1px solid var(--primaryDk);border-radius:0;background:var(--primary);font-family:inherit;font-size:16px;line-height:24px;font-weight:500;color:var(--text);cursor:pointer}
        .pm-entry-proto .customer-price-sheet{display:flex;height:88%;max-height:calc(100% - 12px);flex-direction:column}
        .pm-entry-proto .customer-price-sheet-header{flex:0 0 auto}
        .pm-entry-proto .customer-price-sheet-body{min-height:0;flex:1 1 auto;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;padding-bottom:max(20px,env(safe-area-inset-bottom))}
        @media (min-width:640px){.pm-entry-proto .customer-price-sheet{height:auto;max-height:82vh}.pm-entry-proto .customer-price-sheet-body{flex:0 1 auto;max-height:calc(82vh - 92px)}}
        .pm-entry-proto .dock{position:absolute;bottom:0;left:0;right:0;z-index:7;width:100%;padding:10px 16px max(16px,env(safe-area-inset-bottom));background:rgba(253,247,245,.96);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px}
        .pm-entry-proto .dock .actions{display:flex;width:100%;align-items:center;gap:9px}
        .pm-entry-proto .dock .quick{width:48px;height:52px;border-radius:var(--rbtn);border:1px solid var(--border);background:var(--card);color:var(--primaryDk);display:flex;align-items:center;justify-content:center;box-shadow:none;flex-shrink:0}
        .pm-entry-proto .cta{flex:1;min-width:0;min-height:52px;padding:14px 0;border:none;border-radius:var(--rbtn);background:var(--primary);color:var(--text);font-family:inherit;font-size:16px;line-height:24px;font-weight:500;letter-spacing:-.02em;cursor:pointer;box-shadow:none;display:flex;align-items:center;justify-content:center}
        .pm-entry-proto .cta:disabled{background:#e8d9d2;color:#b9a89f;box-shadow:none;cursor:not-allowed}
        .pm-entry-proto .staff-modal{position:absolute;inset:0;z-index:50;display:flex;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.3);padding:18px 16px}
        .pm-entry-proto .staff-sheet{width:100%;max-width:398px;border:1px solid #f1d7d1;border-radius:22px;background:#fff8f6;box-shadow:0 -18px 55px rgba(80,45,36,.16);padding:16px}
        .pm-entry-proto .staff-sheet .head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
        .pm-entry-proto .staff-sheet .head h3{margin:0;font-size:18px;font-weight:600;letter-spacing:-.03em;color:var(--text)}
        .pm-entry-proto .staff-sheet .close{width:44px;height:44px;min-width:44px;min-height:44px;border-radius:12px;border:1px solid #f1d7d1;background:#fff;color:var(--textMid);display:flex;align-items:center;justify-content:center}
        .pm-entry-proto .staff-sheet .photo{height:252px;border-radius:18px;background:var(--primarySoft);background-size:cover;background-position:center;background-repeat:no-repeat;display:flex;align-items:center;justify-content:center;color:var(--primaryDk);overflow:hidden}
        .pm-entry-proto .staff-sheet .photo-dots{display:flex;justify-content:center;gap:5px;margin:10px 0 12px}
        .pm-entry-proto .staff-sheet .photo-dots button{width:44px;height:44px;border-radius:999px;border:0;background:transparent;padding:0;position:relative}
        .pm-entry-proto .staff-sheet .photo-dots button::after{content:"";position:absolute;inset:50% auto auto 50%;width:7px;height:7px;border-radius:999px;background:#efd8d1;transform:translate(-50%,-50%)}
        .pm-entry-proto .staff-sheet .photo-dots button.on{width:44px;background:transparent}
        .pm-entry-proto .staff-sheet .photo-dots button.on::after{width:18px;background:var(--primary)}
        .pm-entry-proto .staff-sheet .msg{border:1px solid #f1d7d1;border-radius:15px;background:#fff;padding:13px 14px;color:var(--text);font-size:14.5px;line-height:1.6;white-space:pre-wrap}
        .pm-entry-proto .gallery-modal{position:absolute;inset:0;z-index:50;display:flex;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.34);padding:18px 16px}
        .pm-entry-proto .gallery-sheet{width:100%;max-width:398px;max-height:84vh;border:1px solid #f1d7d1;border-radius:22px;background:#fff8f6;box-shadow:0 -18px 55px rgba(80,45,36,.16);overflow:hidden;display:flex;flex-direction:column}
        .pm-entry-proto .gallery-sheet .head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 12px;border-bottom:1px solid #f1d7d1}
        .pm-entry-proto .gallery-sheet .head h3{margin:0;font-size:18px;font-weight:600;letter-spacing:-.03em;color:var(--text)}
        .pm-entry-proto .gallery-sheet .head p{margin:3px 0 0;font-size:13px;color:var(--textMid)}
        .pm-entry-proto .gallery-sheet .close{width:44px;height:44px;min-width:44px;min-height:44px;border-radius:12px;border:1px solid #f1d7d1;background:#fff;color:var(--textMid);display:flex;align-items:center;justify-content:center}
        .pm-entry-proto .gallery-grid{overflow:auto;padding:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .pm-entry-proto .gallery-grid img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;border:1px solid #e8edf3;background:#fff}
        @keyframes benefitSlide{0%,18%{transform:translateX(0)}82%,100%{transform:translateX(calc(-100% + min(100vw,430px) - 32px))}}
        @media (prefers-reduced-motion: reduce){.pm-entry-proto .benefits.is-animated .benefits-track{animation:none}}
      `}</style>
      <div ref={entryScrollRef} data-customer-entry-viewport="true" className="scroll">
        <div className="gwrap">
          <div
            ref={heroGalleryRef}
            className="gallery"
            data-carousel-contract="measured-edge-align"
            style={{ transform: `translate3d(${heroTrackTranslatePx}px, 0, 0)` }}
            onTouchStart={handleHeroTouchStart}
            onTouchEnd={handleHeroTouchEnd}
          >
            {heroImages.length === 0 ? (
              <div className="gcard empty" aria-label="등록된 매장 사진 없음">
                <div className="id"><div className="nm">{displayName}</div></div>
              </div>
            ) : (
              heroImages.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="gcard clickable"
                  style={{ backgroundImage: `linear-gradient(180deg, rgba(42,30,20,0.04), rgba(31,24,18,0.12)), ${cssBackgroundUrl(image)}` }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${displayName} 매장 사진 전체보기`}
                  onClick={() => {
                    setActiveHeroIndex(index);
                    setHeroGalleryOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setActiveHeroIndex(index);
                    setHeroGalleryOpen(true);
                  }}
                >
                  {index === visibleHeroIndex ? (
                    <>
                      <div className="ovl" />
                      <span className="cnt" aria-hidden="true">
                        {visibleHeroIndex + 1} / {heroImages.length}
                      </span>
                      <div className="id"><div className="nm">{displayName}</div></div>
                    </>
                  ) : null}
                </div>
              ))
            )}
            {heroImages.length <= 1 ? <div className="gslot" aria-hidden="true" /> : null}
          </div>
          {heroDotCount > 0 ? (
            <div className="gdots">
              {Array.from({ length: heroDotCount }).map((_, index) => {
                const targetIndex = heroImages.length > heroDotCount && index === heroDotCount - 1 ? heroImages.length - 1 : index;
                const isActive = index === heroDotCount - 1
                  ? visibleHeroIndex >= index
                  : visibleHeroIndex === index;
                return (
                  <i
                    key={`hero-dot-${index}`}
                    className={`${isActive ? "on" : ""} clickable`}
                    onClick={() => setActiveHeroIndex(targetIndex)}
                  />
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="body">
          <div
            className="pbar"
            onTouchStart={handleStaffProfileTouchStart}
            onTouchEnd={handleStaffProfileTouchEnd}
            onPointerDown={handleStaffProfilePointerDown}
            onPointerUp={handleStaffProfilePointerUp}
            onPointerCancel={handleStaffProfilePointerCancel}
            aria-label="직원 프로필"
          >
            <div className="ptrack" style={{ transform: `translate3d(-${visibleStaffProfileIndex * 100}%, 0, 0)` }}>
              {staffProfileCards.map((profile, index) => (
                <button
                  type="button"
                  className="pcard-profile"
                  key={profile.id}
                  onClick={() => {
                    setActiveStaffProfileIndex(index);
                    setProfileViewer(profile);
                    setProfileViewerImageIndex(0);
                  }}
                >
                  <div className="av" style={profile.imageUrl ? { backgroundImage: cssBackgroundUrl(profile.imageUrl) } : undefined}>
                    {profile.imageUrl ? null : <UserRound className="h-6 w-6" strokeWidth={1.8} />}
                  </div>
                  <div className="who">
                    <div className="nm">{profile.name}</div>
                    <div className="sub">{profile.caption}</div>
                  </div>
                </button>
              ))}
            </div>
            {staffProfileCards.length > 1 ? (
              <div className="pdots" aria-label="직원 프로필 선택">
                {staffProfileCards.map((profile, index) => (
                  <i
                    key={`${profile.id}-dot`}
                    className={index === visibleStaffProfileIndex ? "on" : ""}
                    role="button"
                    tabIndex={0}
                    aria-label={`${profile.name} 프로필 보기`}
                    onClick={() => setActiveStaffProfileIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveStaffProfileIndex(index);
                      }
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="srow">
            <div className={`hours${hoursOpen ? " open" : ""}`}>
              <div className={`top${operatingStatus.label === "휴무" ? " closed" : ""}`} onClick={() => setHoursOpen((value) => !value)}>
                <span className="od" />{operatingStatus.label}<ChevronDown className="chev" strokeWidth={2} />
              </div>
              {hoursOpen ? (
                <div className="list"><div className="inner">
                  {weekRows.map((row) => {
                    const hoursText = formatHoursRow(row.key, shop.business_hours, shop.regular_closed_days);
                    const isToday = row.key === todayWeekday;
                    return (
                      <div key={row.key} className={`hrow${isToday ? " today" : ""}${hoursText === "휴무" ? " off" : ""}`}>
                        <span className="d">{row.label.replace("요일", "")}</span>
                        <span className="t">{hoursText}</span>
                      </div>
                    );
                  })}
                </div></div>
              ) : null}
            </div>
            {socialLinks.length > 0 ? (
              <div className="socials">
                {socialLinks.map((link) => (
                  <a
                    key={link.key}
                    className={`chip social-${link.key}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={link.label}
                    title={link.label}
                    onClick={previewMode ? (event) => event.preventDefault() : undefined}
                  >
                    <img src={link.iconSrc} alt="" aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <CustomerEntryServicePicker
            services={serviceOptions}
            selectedServiceOptionId={selectedServiceOptionId}
            onSelect={setSelectedServiceOptionId}
            onOpenPriceSheet={() => setPriceSheetOpen(true)}
          />
        </div>
      </div>

      <div ref={entryDockRef} data-customer-booking-dock="true" className="dock">
        {publicBenefitCards.length > 0 ? (
          <div className={`benefits${publicBenefitCards.length > 1 ? " is-animated" : ""}`}>
            <div className="benefits-track">
              {publicBenefitCards.map((coupon) => (
                <div className="benefit" key={coupon.id}>
                  <div className="txt">
                    <div className="name">{coupon.name}</div>
                  </div>
                  <div className="val">{coupon.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="actions">
          <a
            className="quick"
            href={`tel:${shop.phone.replace(/[^0-9+]/g, "")}`}
            aria-label="전화하기"
            onClick={previewMode ? (event) => event.preventDefault() : undefined}
          >
            <Phone className="h-5 w-5" strokeWidth={1.9} />
          </a>
          <button className="quick" type="button" onClick={() => setDirectionsOpen(true)} aria-label="길찾기">
            <Navigation className="h-5 w-5" strokeWidth={1.9} />
          </button>
          {previewMode && onPreviewBookingStart && selectedServiceOption ? (
            <button
              className="cta"
              type="button"
              onClick={() => onPreviewBookingStart({
                serviceId: selectedServiceOption.serviceId,
                serviceOptionId: selectedServiceOption.id,
              })}
            >
              간편예약 시작
            </button>
          ) : selectedServiceBookingHref ? (
            <a className="cta" href={selectedServiceBookingHref}>간편예약 시작하기</a>
          ) : (
            <button className="cta" type="button" disabled>서비스를 선택해 주세요</button>
          )}
        </div>
      </div>

      {heroGalleryOpen && heroImages.length > 0 ? (
        <div className="gallery-modal" onClick={() => setHeroGalleryOpen(false)}>
          <div className="gallery-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="head">
              <div>
                <h3>매장 사진</h3>
                <p>총 {heroImages.length}장</p>
              </div>
              <button type="button" className="close" onClick={() => setHeroGalleryOpen(false)} aria-label="매장 사진 닫기">
                <X className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </div>
            <div className="gallery-grid">
              {heroImages.map((image, index) => (
                <img
                  key={`shop-gallery-${image}-${index}`}
                  src={image}
                  alt={`${displayName} 매장 사진 ${index + 1}`}
                  loading={index < 6 ? "eager" : "lazy"}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {profileViewer ? (
        <div className="staff-modal" onClick={() => setProfileViewer(null)}>
          <div className="staff-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="head">
              <h3>{profileViewer.name}</h3>
              <button type="button" className="close" onClick={() => setProfileViewer(null)} aria-label="직원 프로필 닫기">
                <X className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </div>
            <div
              className="photo"
              style={
                profileViewer.imageUrls[profileViewerImageIndex]
                  ? { backgroundImage: cssBackgroundUrl(profileViewer.imageUrls[profileViewerImageIndex]) }
                  : undefined
              }
            >
              {profileViewer.imageUrls[profileViewerImageIndex] ? null : <UserRound className="h-12 w-12" strokeWidth={1.7} />}
            </div>
            {profileViewer.imageUrls.length > 1 ? (
              <div className="photo-dots" aria-label="직원 프로필 사진 선택">
                {profileViewer.imageUrls.map((imageUrl, index) => (
                  <button
                    key={`${imageUrl}-${index}`}
                    type="button"
                    className={index === profileViewerImageIndex ? "on" : ""}
                    onClick={() => setProfileViewerImageIndex(index)}
                    aria-label={`${profileViewer.name} 프로필 사진 ${index + 1}`}
                  />
                ))}
              </div>
            ) : null}
            <div className="msg">{profileViewer.caption}</div>
          </div>
        </div>
      ) : null}

      {priceSheetOpen ? (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 px-4" onClick={() => setPriceSheetOpen(false)}>
          <div
            className="customer-price-sheet w-full max-w-[430px] overflow-hidden rounded-t-[22px] border border-[#e8edf3] bg-white shadow-[0_-18px_55px_rgba(15,23,42,0.14)]"
            data-customer-price-sheet="88dvh-mobile"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-price-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="customer-price-sheet-header" data-customer-price-sheet-header="fixed">
              <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[#cbd5e1]" />
              <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
                <div>
                  <h3 id="customer-price-sheet-title" className="text-[20px] font-semibold tracking-[-0.03em] text-[#15213b]">요금표</h3>
                </div>
                <button
                  ref={priceSheetCloseButtonRef}
                  type="button"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[#e8edf3] bg-white text-[#64748b] shadow-sm"
                  onClick={() => setPriceSheetOpen(false)}
                  aria-label="요금표 닫기"
                >
                  <X className="h-4.5 w-4.5" strokeWidth={1.8} />
                </button>
              </div>
            </div>

            <div className="customer-price-sheet-body px-5" data-customer-price-sheet-body="scroll-only">
              {canonicalPriceGuide ? (
                <CustomerFullPriceGuide document={canonicalPriceGuide} />
              ) : serviceOptions.length > 0 ? (
                <div className="space-y-2">
                  {serviceOptions.map((service) => (
                    <div key={`sheet-${service.id}`} className="rounded-[14px] border border-[#e8edf3] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[16px] font-normal text-[#15213b]">{service.name}</p>
                          <p className="mt-1 text-[13px] font-normal text-[#64748b]">예상 {formatCustomerServiceDuration(service)}</p>
                        </div>
                        <p className="shrink-0 text-[17px] font-medium text-[#15213b]">{formatServicePrice(service.price, service.priceType)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[16px] border border-[#e8edf3] bg-white">
                  <a
                    href={infoHref}
                    className="flex h-14 items-center justify-center text-[16px] font-normal text-[#334155]"
                    onClick={previewMode ? (event) => event.preventDefault() : undefined}
                  >
                    등록된 서비스 안내가 없습니다.
                  </a>
                </div>
              )}
              {!canonicalPriceGuide && serviceOptions.length > 0 ? (
                <p className="mt-3 rounded-[14px] bg-white px-3 py-3 text-[15px] leading-6 text-[#64748b]">실제 요금은 아이 상태와 털엉킴, 기장, 피부 상태에 따라 매장에서 최종 안내드릴 수 있어요.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {directionsOpen ? (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/35 px-4" onClick={() => setDirectionsOpen(false)}>
          <div className="w-full max-w-[430px] rounded-t-[26px] border border-[#e8edf3] bg-white p-4 shadow-[0_-18px_50px_rgba(15,23,42,0.14)]" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#cbd5e1]" />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[16px] font-normal" style={{ color: bookingAccentColor }}>
                길찾기
              </p>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#e8edf3] bg-white text-[#64748b] shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                onClick={() => setDirectionsOpen(false)}
                aria-label="길찾기 닫기"
              >
                <X className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </div>

            <div className="rounded-[18px] border border-[#e8edf3] bg-white px-4 py-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
              <p className="text-[16px] leading-6 text-[#64748b]">{displayAddress}</p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#e8edf3] bg-white px-4 text-[16px] font-normal text-[#15213b] hover:bg-[#f8fafc]"
                >
                  <Copy className="h-4 w-4" strokeWidth={1.9} />
                  {addressCopied ? "복사 완료" : "주소 복사"}
                </button>
              </div>

              <div className="mt-4 space-y-2.5">
                <MapButton
                  label={preferredMap.label}
                  onClick={() => {
                    if (previewMode) return;
                    openExternalMap(preferredMap.appUrl, preferredMap.webUrl);
                  }}
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
      className="flex h-[54px] w-full items-center justify-between rounded-[14px] border border-[#e8edf3] bg-white px-4 text-left hover:bg-[#f8fafc]"
    >
      <span className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#edf2f8] text-[#15213b]">
          <Navigation className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <span className="text-[16px] font-normal tracking-[-0.02em] text-[#15213b]">{label}</span>
      </span>
      <span className="text-[16px] font-normal text-[#334155]">열기</span>
    </button>
  );
}

