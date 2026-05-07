"use client";

import { Copy, MapPinned, Navigation, Phone, X } from "lucide-react";
import { useMemo, useState } from "react";

import LegalLinksFooter from "@/components/legal/legal-links-footer";
import type { BusinessHours, CustomerPageSettings, Service, Shop } from "@/types/domain";

const typographyMap: Record<
  CustomerPageSettings["font_preset"],
  {
    title: string;
    body: string;
  }
> = {
  soft: {
    title: "font-semibold tracking-[-0.04em]",
    body: "font-medium tracking-[-0.01em]",
  },
  clean: {
    title: "font-semibold tracking-[-0.03em]",
    body: "font-normal tracking-[0em]",
  },
  classic: {
    title: "font-semibold tracking-[-0.02em]",
    body: "font-normal tracking-[0.01em]",
  },
};

const scaleMap: Record<
  CustomerPageSettings["font_scale"],
  {
    heroTitle: string;
    body: string;
    sectionTitle: string;
  }
> = {
  compact: {
    heroTitle: "text-[26px]",
    body: "text-[13px] leading-6",
    sectionTitle: "text-[17px]",
  },
  comfortable: {
    heroTitle: "text-[30px]",
    body: "text-[14px] leading-6",
    sectionTitle: "text-[18px]",
  },
};

const weekRows = [
  { key: 1, label: "월요일" },
  { key: 2, label: "화요일" },
  { key: 3, label: "수요일" },
  { key: 4, label: "목요일" },
  { key: 5, label: "금요일" },
  { key: 6, label: "토요일" },
  { key: 0, label: "일요일" },
] as const;

function getTodayWeekdayInSeoul() {
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date());

  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  return labels.indexOf(weekday);
}

function formatHoursRow(day: number, businessHours: BusinessHours, regularClosedDays: number[]) {
  const hours = businessHours[day];
  if (regularClosedDays.includes(day) || !hours?.enabled) return "정기 휴무";
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

export default function CustomerBookingEntryPage({
  shop,
  services: _services,
  bookingHref,
  infoHref,
}: {
  shop: Pick<Shop, "id" | "name" | "phone" | "address" | "customer_page_settings" | "business_hours" | "regular_closed_days">;
  services: Service[];
  bookingHref: string;
  infoHref: string;
}) {
  const settings = shop.customer_page_settings;
  const displayName = settings.shop_name || shop.name;
  const typography = typographyMap[settings.font_preset];
  const scale = scaleMap[settings.font_scale];
  const bookingStartHref = bookingHref;
  const todayWeekday = getTodayWeekdayInSeoul();
  const visibleParkingNotice = settings.show_parking_notice ? settings.parking_notice.trim() : "";
  const [directionsOpen, setDirectionsOpen] = useState(false);
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
      window.setTimeout(() => setAddressCopied(false), 1800);
    } catch {
      setAddressCopied(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[var(--background)] px-5 pb-10 pt-5">
      <section className="overflow-hidden rounded-[30px] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]">
        <div
          className="min-h-[360px] px-5 pb-7 pt-6 text-white"
          style={
            settings.hero_image_url
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(24, 26, 25, 0.14), rgba(24, 26, 25, 0.62)), url(${settings.hero_image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background: `linear-gradient(140deg, ${settings.primary_color} 0%, #33544c 52%, #f3c9b1 100%)`,
                }
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex rounded-full border border-white/28 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-white/92">
              PETMANAGER RESERVATION
            </div>
            <a
              href={infoHref}
              className="inline-flex h-[38px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/10 px-4 text-xs font-semibold text-white/90 backdrop-blur-sm"
            >
              매장 정보
            </a>
          </div>

          <h1 className={`mt-6 max-w-[280px] leading-[1.14] text-white ${typography.title} ${scale.heroTitle}`}>
            {displayName}
          </h1>
          <p className={`mt-4 max-w-[280px] text-white/84 ${typography.body} ${scale.body}`}>
            {settings.tagline || "예약 전에 필요한 내용을 먼저 확인해 보세요."}
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            <a
              href={bookingStartHref}
              className="flex h-[46px] items-center justify-center rounded-full px-5 text-sm font-semibold text-white"
              style={{ backgroundColor: settings.primary_color }}
            >
              예약하기
            </a>

            <button
              type="button"
              onClick={() => setDirectionsOpen(true)}
              className="flex h-[46px] items-center justify-center rounded-full border border-white/30 bg-white/14 px-5 text-sm font-semibold text-white backdrop-blur-sm"
            >
              길찾기
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[26px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="min-w-0 flex-1">
          <h2 className={`${typography.title} ${scale.sectionTitle} text-[var(--text)]`}>운영 시간 안내</h2>
          <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>방문 전에 운영 시간과 주차 정보를 확인해 주세요.</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
          {weekRows.map((row, index) => {
            const isToday = row.key === todayWeekday;
            const hoursText = formatHoursRow(row.key, shop.business_hours, shop.regular_closed_days);
            const isClosed = hoursText === "정기 휴무";

            return (
              <div
                key={row.key}
                className={`grid grid-cols-[1fr_128px] items-center gap-3 px-4 py-3 ${index !== weekRows.length - 1 ? "border-b border-[var(--border)]" : ""}`}
              >
                <span className={`text-sm ${typography.title} ${isToday ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
                  {row.label}
                </span>
                <span
                  className={`text-sm ${typography.body} w-[128px] text-center ${isClosed ? "text-[var(--muted)]" : "text-[var(--text)]"}`}
                >
                  {hoursText}
                </span>
              </div>
            );
          })}
        </div>

        {visibleParkingNotice ? (
          <div className="mt-5">
            <h3 className={`text-[var(--text)] ${typography.title} ${scale.sectionTitle}`}>주차 안내</h3>
            <div className="mt-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
              <p className={`text-[var(--muted)] ${typography.body} ${scale.body}`}>{visibleParkingNotice}</p>
            </div>
          </div>
        ) : null}
      </section>

      {directionsOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 px-4" onClick={() => setDirectionsOpen(false)}>
          <div
            className="w-full max-w-[430px] rounded-t-[32px] bg-[var(--background)] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium tracking-[0.04em] text-[var(--accent)]">DIRECTIONS</p>
                <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">길찾기</h3>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--muted)] transition hover:bg-[#fbfaf7]"
                onClick={() => setDirectionsOpen(false)}
                aria-label="길찾기 닫기"
              >
                <X className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </div>

            <div className="rounded-[22px] border border-[var(--border)] bg-white px-4 py-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf4f2] text-[var(--accent)]">
                  <MapPinned className="h-4.5 w-4.5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold tracking-[-0.03em] text-[var(--text)]">{displayName}</p>
                  <p className={`mt-2 text-[var(--muted)] ${typography.body} ${scale.body}`}>{shop.address}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-white px-4 text-[14px] font-medium text-[var(--text)] transition hover:bg-[#fcfaf7]"
                >
                  <Copy className="h-4 w-4" strokeWidth={1.9} />
                  {addressCopied ? "주소 복사 완료" : "주소 복사"}
                </button>

                <a
                  href={`tel:${shop.phone.replace(/[^0-9+]/g, "")}`}
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-white px-4 text-[14px] font-medium text-[var(--text)] transition hover:bg-[#fcfaf7]"
                >
                  <Phone className="h-4 w-4" strokeWidth={1.9} />
                  전화하기
                </a>
              </div>

              <div className="mt-4 space-y-2.5">
                <button
                  type="button"
                  onClick={() =>
                    openExternalMap(
                      `nmap://search?query=${encodeURIComponent(directionsQuery)}&appname=${encodeURIComponent("kr.petmanager.app")}`,
                      naverWebUrl,
                    )
                  }
                  className="flex h-[50px] w-full items-center justify-between rounded-[16px] border border-[var(--border)] bg-white px-4 text-left transition hover:bg-[#fcfaf7]"
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eef6f4] text-[var(--accent)]">
                      <Navigation className="h-4.5 w-4.5" strokeWidth={2} />
                    </span>
                    <span className="text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">네이버지도로 보기</span>
                  </span>
                  <span className="text-[13px] font-medium text-[var(--muted)]">열기</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openExternalMap(
                      `kakaomap://search?q=${encodeURIComponent(directionsQuery)}`,
                      kakaoWebUrl,
                    )
                  }
                  className="flex h-[50px] w-full items-center justify-between rounded-[16px] border border-[var(--border)] bg-white px-4 text-left transition hover:bg-[#fcfaf7]"
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fff4d9] text-[#6f5700]">
                      <Navigation className="h-4.5 w-4.5" strokeWidth={2} />
                    </span>
                    <span className="text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">카카오맵으로 보기</span>
                  </span>
                  <span className="text-[13px] font-medium text-[var(--muted)]">열기</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openExternalMap(
                      `tmap://search?name=${encodeURIComponent(directionsQuery)}`,
                      tmapWebUrl,
                    )
                  }
                  className="flex h-[50px] w-full items-center justify-between rounded-[16px] border border-[var(--border)] bg-white px-4 text-left transition hover:bg-[#fcfaf7]"
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f3ff] text-[#4b63c6]">
                      <Navigation className="h-4.5 w-4.5" strokeWidth={2} />
                    </span>
                    <span className="text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">티맵으로 보기</span>
                  </span>
                  <span className="text-[13px] font-medium text-[var(--muted)]">열기</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <LegalLinksFooter />
    </div>
  );
}
