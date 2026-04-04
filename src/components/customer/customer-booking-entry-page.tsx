import LegalLinksFooter from "@/components/legal/legal-links-footer";
import { formatServicePrice } from "@/lib/utils";
import type { CustomerPageSettings, Service, Shop } from "@/types/domain";

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

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

export default function CustomerBookingEntryPage({
  shop,
  services,
  bookingHref,
  manageHref,
  infoHref,
}: {
  shop: Pick<Shop, "id" | "name" | "customer_page_settings">;
  services: Service[];
  bookingHref: string;
  manageHref: string;
  infoHref: string;
}) {
  const settings = shop.customer_page_settings;
  const displayName = settings.shop_name || shop.name;
  const visibleServices = settings.show_services ? services.filter((service) => service.is_active).slice(0, 4) : [];
  const visibleNotices = settings.show_notices ? settings.notices.filter(Boolean).slice(0, 3) : [];
  const typography = typographyMap[settings.font_preset];
  const scale = scaleMap[settings.font_scale];

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[var(--background)] px-5 pb-10 pt-5">
      <section className="overflow-hidden rounded-[30px] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]">
        <div
          className="min-h-[280px] px-5 pb-6 pt-6 text-white"
          style={
            settings.hero_image_url
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(26, 28, 27, 0.16), rgba(26, 28, 27, 0.56)), url(${settings.hero_image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background: `linear-gradient(140deg, ${settings.primary_color} 0%, #33544c 52%, #f3c9b1 100%)`,
                }
          }
        >
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-white/90">
            PAWCARE RESERVATION
          </div>

          <h1 className={`mt-4 leading-tight text-white ${typography.title} ${scale.heroTitle}`}>{displayName}</h1>
          <p className={`mt-3 max-w-[280px] text-white/82 ${typography.body} ${scale.body}`}>{settings.tagline || "예약 전에 필요한 내용을 먼저 확인해 보세요."}</p>

          <div className="mt-6 flex flex-col gap-2.5">
            <a
              href={bookingHref}
              className="flex h-[46px] items-center justify-center rounded-full px-5 text-sm font-semibold text-white"
              style={{ backgroundColor: settings.primary_color }}
            >
              {settings.booking_button_label}
            </a>

            <a
              href={manageHref}
              className="flex h-[46px] items-center justify-center rounded-full border border-white/30 bg-white/14 px-5 text-sm font-semibold text-white backdrop-blur-sm"
            >
              예약조회 / 취소 · 변경
            </a>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={infoHref}
              className="inline-flex h-[38px] items-center justify-center rounded-full border border-white/20 bg-black/10 px-4 text-xs font-semibold text-white/90 backdrop-blur-sm"
            >
              매장 정보 보기
            </a>
            {settings.show_kakao_inquiry && settings.kakao_inquiry_url ? (
              <a
                href={settings.kakao_inquiry_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-[38px] items-center justify-center rounded-full border border-white/20 bg-black/10 px-4 text-xs font-semibold text-white/90 backdrop-blur-sm"
              >
                카카오 문의
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {visibleNotices.length > 0 ? (
        <section className="mt-5 rounded-[26px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className={`${typography.title} ${scale.sectionTitle} text-[var(--text)]`}>예약 전 확인</h2>
              <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>첫 방문 전 꼭 알아두면 좋은 안내를 모아 두었어요.</p>
            </div>
            <span className="shrink-0 text-xs font-semibold" style={{ color: settings.primary_color }}>
              공지 {visibleNotices.length}개
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {visibleNotices.map((notice) => (
              <div key={notice} className={`rounded-[18px] border border-[var(--border)] bg-[#fcfaf7] px-4 py-3 text-[var(--text)] ${typography.body} ${scale.body}`}>
                {notice}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-5 rounded-[26px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className={`${typography.title} ${scale.sectionTitle} text-[var(--text)]`}>예약 안내</h2>
            <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>방문 전에 운영 정보와 문의 경로를 먼저 확인해 보세요.</p>
          </div>
          <a href={infoHref} className="shrink-0 text-xs font-semibold" style={{ color: settings.primary_color }}>
            전체 보기
          </a>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
            <p className={`text-sm text-[var(--text)] ${typography.title}`}>운영 시간</p>
            <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>{settings.operating_hours_note}</p>
          </div>
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
            <p className={`text-sm text-[var(--text)] ${typography.title}`}>예약 관리</p>
            <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>기존 예약은 연락처로 바로 조회하고 취소나 변경 요청까지 진행할 수 있어요.</p>
            <a
              href={manageHref}
              className="mt-3 inline-flex h-[40px] items-center justify-center rounded-full px-4 text-xs font-semibold text-white"
              style={{ backgroundColor: settings.primary_color }}
            >
              예약 조회 바로가기
            </a>
          </div>
        </div>
      </section>

      {visibleServices.length > 0 ? (
        <section className="mt-5 rounded-[26px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className={`${typography.title} ${scale.sectionTitle} text-[var(--text)]`}>인기 서비스</h2>
              <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>예약 전에 많이 찾는 기본 서비스를 먼저 확인해 보세요.</p>
            </div>
            <a href={bookingHref} className="shrink-0 text-xs font-semibold" style={{ color: settings.primary_color }}>
              전체 예약
            </a>
          </div>

          <div className="mt-4 space-y-3">
            {visibleServices.map((service) => (
              <div key={service.id} className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] text-[var(--text)] ${typography.title}`}>{service.name}</p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: withAlpha(settings.primary_color, "14"),
                      color: settings.primary_color,
                    }}
                  >
                    {formatServicePrice(service.price, service.price_type ?? "starting")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <LegalLinksFooter />
    </div>
  );
}
