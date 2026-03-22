import { formatServicePrice } from "@/lib/utils";
import type { Service, Shop } from "@/types/domain";

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

export default function CustomerBookingEntryPage({
  shop,
  services,
  bookingHref,
  manageHref,
}: {
  shop: Pick<Shop, "id" | "name" | "customer_page_settings">;
  services: Service[];
  bookingHref: string;
  manageHref: string;
}) {
  const settings = shop.customer_page_settings;
  const visibleServices = services.slice(0, 4);

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

          <h1 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-white">
            {settings.shop_name || shop.name}
          </h1>

          <p className="mt-3 max-w-[280px] text-[14px] font-normal leading-6 text-white/82">
            {settings.tagline || "예약 전에 필요한 내용을 먼저 확인해 보세요."}
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <a
              href={bookingHref}
              className="flex h-[46px] items-center justify-center rounded-full px-5 text-sm font-semibold text-white"
              style={{ backgroundColor: settings.primary_color }}
            >
              예약하기
            </a>

            <a
              href={manageHref}
              className="flex h-[46px] items-center justify-center rounded-full border border-white/30 bg-white/14 px-5 text-sm font-semibold text-white backdrop-blur-sm"
            >
              예약조회 / 취소 · 변경
            </a>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[26px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">인기 서비스</h2>
            <p className="mt-1 text-[14px] font-normal leading-6 text-[var(--muted)]">
              예약 전에 많이 찾는 기본 서비스를 먼저 확인해 보세요.
            </p>
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
                  <p className="text-[15px] font-semibold text-[var(--text)]">{service.name}</p>
                  <p className="mt-1 text-[14px] font-normal leading-6 text-[var(--muted)]">예상 소요시간 {service.duration_minutes}분</p>
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
    </div>
  );
}
