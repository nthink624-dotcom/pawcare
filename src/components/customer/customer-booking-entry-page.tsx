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
  { key: 1, label: "\uC6D4\uC694\uC77C" },
  { key: 2, label: "\uD654\uC694\uC77C" },
  { key: 3, label: "\uC218\uC694\uC77C" },
  { key: 4, label: "\uBAA9\uC694\uC77C" },
  { key: 5, label: "\uAE08\uC694\uC77C" },
  { key: 6, label: "\uD1A0\uC694\uC77C" },
  { key: 0, label: "\uC77C\uC694\uC77C" },
] as const;

function getTodayWeekdayInSeoul() {
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date());

  const labels = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"];
  return labels.indexOf(weekday);
}

function formatHoursRow(day: number, businessHours: BusinessHours, regularClosedDays: number[]) {
  const hours = businessHours[day];
  if (regularClosedDays.includes(day) || !hours?.enabled) return "\uC815\uAE30 \uD734\uBB34";
  return `${hours.open} - ${hours.close}`;
}

export default function CustomerBookingEntryPage({
  shop,
  services: _services,
  bookingHref,
  infoHref,
}: {
  shop: Pick<Shop, "id" | "name" | "customer_page_settings" | "business_hours" | "regular_closed_days">;
  services: Service[];
  bookingHref: string;
  infoHref: string;
}) {
  const settings = shop.customer_page_settings;
  const displayName = settings.shop_name || shop.name;
  const typography = typographyMap[settings.font_preset];
  const scale = scaleMap[settings.font_scale];
  const firstVisitHref = `${bookingHref}?mode=first`;
  const returningVisitHref = `${bookingHref}?mode=returning`;
  const manageBookingHref = `${bookingHref}?mode=manage`;
  const todayWeekday = getTodayWeekdayInSeoul();
  const visibleParkingNotice = settings.show_parking_notice ? settings.parking_notice.trim() : "";

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
              PAWCARE RESERVATION
            </div>
            <a
              href={infoHref}
              className="inline-flex h-[38px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/10 px-4 text-xs font-semibold text-white/90 backdrop-blur-sm"
            >
              {"\uB9E4\uC7A5 \uC815\uBCF4"}
            </a>
          </div>

          <h1 className={`mt-6 max-w-[280px] leading-[1.14] text-white ${typography.title} ${scale.heroTitle}`}>
            {displayName}
          </h1>
          <p className={`mt-4 max-w-[280px] text-white/84 ${typography.body} ${scale.body}`}>
            {settings.tagline || "\uC608\uC57D \uC804\uC5D0 \uD544\uC694\uD55C \uB0B4\uC6A9\uC744 \uBA3C\uC800 \uD655\uC778\uD574 \uBCF4\uC138\uC694."}
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            <a
              href={firstVisitHref}
              className="flex h-[46px] items-center justify-center rounded-full px-5 text-sm font-semibold text-white"
              style={{ backgroundColor: settings.primary_color }}
            >
              {"\uCCAB\uBC29\uBB38 \uC608\uC57D\uD558\uAE30"}
            </a>

            <a
              href={returningVisitHref}
              className="flex h-[46px] items-center justify-center rounded-full border border-white/30 bg-white/14 px-5 text-sm font-semibold text-white backdrop-blur-sm"
            >
              {"\uC7AC\uBC29\uBB38 \uC608\uC57D\uD558\uAE30"}
            </a>

            <a
              href={manageBookingHref}
              className="flex h-[46px] items-center justify-center rounded-full border border-white/30 bg-white/14 px-5 text-sm font-semibold text-white backdrop-blur-sm"
            >
              {"\uC608\uC57D\uC870\uD68C / \uCDE8\uC18C \u00B7 \uBCC0\uACBD"}
            </a>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[26px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="min-w-0 flex-1">
          <h2 className={`${typography.title} ${scale.sectionTitle} text-[var(--text)]`}>{"\uC6B4\uC601 \uC2DC\uAC04 \uC548\uB0B4"}</h2>
          <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>{"\uBC29\uBB38 \uC804\uC5D0 \uC6B4\uC601 \uC2DC\uAC04\uACFC \uC8FC\uCC28 \uC815\uBCF4\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694."}</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
          {weekRows.map((row, index) => {
            const isToday = row.key === todayWeekday;
            const hoursText = formatHoursRow(row.key, shop.business_hours, shop.regular_closed_days);
            const isClosed = hoursText === "\uC815\uAE30 \uD734\uBB34";

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
            <h3 className={`text-[var(--text)] ${typography.title} ${scale.sectionTitle}`}>{"\uC8FC\uCC28 \uC548\uB0B4"}</h3>
            <div className="mt-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
              <p className={`text-[var(--muted)] ${typography.body} ${scale.body}`}>{visibleParkingNotice}</p>
            </div>
          </div>
        ) : null}
      </section>

      <LegalLinksFooter />
    </div>
  );
}
