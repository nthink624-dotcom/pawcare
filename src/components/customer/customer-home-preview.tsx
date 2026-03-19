import { formatServicePrice } from "@/lib/utils";
import type { Service, Shop } from "@/types/domain";

export type EditableSection = "hero" | "notices" | "services" | "booking" | "inquiry" | "theme";

type PreviewProps = {
  shop: Pick<Shop, "id" | "address" | "phone">;
  settings: Shop["customer_page_settings"];
  services: Service[];
  editable?: boolean;
  selectedSection?: EditableSection;
  onSelectSection?: (section: EditableSection) => void;
  ctaHref?: string;
};

const typographyMap = {
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
} as const;

const scaleMap = {
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
} as const;

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function PreviewWrap({ children, section, editable, selectedSection, onSelectSection }: { children: React.ReactNode; section: EditableSection; editable?: boolean; selectedSection?: EditableSection; onSelectSection?: (section: EditableSection) => void }) {
  if (!editable) return <>{children}</>;

  const active = selectedSection === section;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectSection?.(section)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectSection?.(section);
        }
      }}
      className={`w-full rounded-[24px] text-left transition ${active ? "ring-2 ring-[var(--accent)] ring-offset-4 ring-offset-[var(--background)]" : "hover:ring-1 hover:ring-[var(--border)] hover:ring-offset-4 hover:ring-offset-[var(--background)]"}`}
    >
      {children}
    </div>
  );
}

function CtaChip({ children, href, editable, filled = false, color }: { children: React.ReactNode; href?: string; editable?: boolean; filled?: boolean; color?: string }) {
  const className = filled
    ? "flex h-[52px] items-center justify-center rounded-full px-5 text-sm font-semibold text-white"
    : "flex h-[52px] items-center justify-center rounded-full border px-5 text-sm font-semibold";

  if (editable || !href) {
    return (
      <div
        className={className + (filled ? "" : " border-white/30 bg-white/14 text-white backdrop-blur-sm")}
        style={filled ? { backgroundColor: color } : undefined}
      >
        {children}
      </div>
    );
  }

  return (
    <a href={href} className={className + (filled ? "" : " border-white/30 bg-white/14 text-white backdrop-blur-sm")} style={filled ? { backgroundColor: color } : undefined}>
      {children}
    </a>
  );
}

export default function CustomerHomePreview({ shop, settings, services, editable = false, selectedSection, onSelectSection, ctaHref }: PreviewProps) {
  const notices = settings.notices.filter(Boolean).slice(0, 3);
  const visibleServices = services.filter((service) => service.is_active).slice(0, 4);
  const typography = typographyMap[settings.font_preset];
  const scale = scaleMap[settings.font_scale];

  return (
    <div className="mx-auto w-full max-w-[430px] bg-[var(--background)]">
      <div className="space-y-5 pb-1">
        <PreviewWrap section="hero" editable={editable} selectedSection={selectedSection} onSelectSection={onSelectSection}>
          <section className="overflow-hidden rounded-[30px] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)]">
            <div
              className="min-h-[258px] px-5 pb-6 pt-6 text-white"
              style={settings.hero_image_url ? { backgroundImage: `linear-gradient(180deg, rgba(26, 28, 27, 0.16), rgba(26, 28, 27, 0.54)), url(${settings.hero_image_url})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: `linear-gradient(140deg, ${settings.primary_color} 0%, #33544c 52%, #f3c9b1 100%)` }}
            >
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-white/90">PAWCARE RESERVATION</div>
              <h1 className={`mt-4 leading-tight text-white ${typography.title} ${scale.heroTitle}`}>{settings.shop_name}</h1>
              <p className={`mt-3 max-w-[280px] text-white/82 ${typography.body} ${scale.body}`}>{settings.tagline}</p>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <CtaChip href={ctaHref} editable={editable} filled color={settings.primary_color}>{settings.booking_button_label}</CtaChip>
                {settings.show_kakao_inquiry ? <CtaChip href={settings.kakao_inquiry_url || undefined} editable={editable}>카카오 문의</CtaChip> : null}
              </div>
            </div>
          </section>
        </PreviewWrap>

        {settings.show_notices && notices.length > 0 ? (
          <PreviewWrap section="notices" editable={editable} selectedSection={selectedSection} onSelectSection={onSelectSection}>
            <section className="rounded-[26px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <h2 className={`${typography.title} ${scale.sectionTitle} text-[var(--text)]`}>공지사항</h2>
                <span className="text-xs font-medium text-[var(--muted)]">최대 3개</span>
              </div>
              <div className="mt-4 space-y-2.5">
                {notices.map((notice) => (
                  <div key={notice} className={`rounded-[18px] border border-[var(--border)] bg-[#fcfaf7] px-4 py-3 text-[var(--text)] ${typography.body} ${scale.body}`}>{notice}</div>
                ))}
              </div>
            </section>
          </PreviewWrap>
        ) : null}

        {settings.show_services ? (
          <PreviewWrap section="services" editable={editable} selectedSection={selectedSection} onSelectSection={onSelectSection}>
            <section className="rounded-[26px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className={`${typography.title} ${scale.sectionTitle} text-[var(--text)]`}>인기 서비스</h2>
                  <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>예약 전에 많이 찾는 기본 서비스를 먼저 확인해 보세요.</p>
                </div>
                {editable || !ctaHref ? <span className="shrink-0 text-xs font-semibold" style={{ color: settings.primary_color }}>전체 예약</span> : <a href={ctaHref} className="shrink-0 text-xs font-semibold" style={{ color: settings.primary_color }}>전체 예약</a>}
              </div>
              <div className="mt-4 space-y-3">
                {visibleServices.map((service) => (
                  <div key={service.id} className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-[15px] text-[var(--text)] ${typography.title}`}>{service.name}</p>
                        <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>{service.duration_minutes}분 소요</p>
                      </div>
                      <span className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: withAlpha(settings.primary_color, "14"), color: settings.primary_color }}>{service.price.toLocaleString("ko-KR")}원</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </PreviewWrap>
        ) : null}

        <PreviewWrap section="theme" editable={editable} selectedSection={selectedSection} onSelectSection={onSelectSection}>
          <section className="rounded-[26px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className={`${typography.title} ${scale.sectionTitle} text-[var(--text)]`}>예약 안내</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[18px] border border-[var(--border)] bg-[#fcfaf7] px-4 py-3.5">
                <p className={`text-sm text-[var(--text)] ${typography.title}`}>첫 방문 예약</p>
                <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>아이 상태를 간단히 남기고 원하는 날짜를 바로 선택할 수 있어요.</p>
              </div>
              <div className="rounded-[18px] border border-[var(--border)] bg-[#fcfaf7] px-4 py-3.5">
                <p className={`text-sm text-[var(--text)] ${typography.title}`}>운영 안내</p>
                <p className={`mt-1 text-[var(--muted)] ${typography.body} ${scale.body}`}>{shop.address} · {shop.phone}</p>
              </div>
            </div>
          </section>
        </PreviewWrap>
      </div>
    </div>
  );
}
