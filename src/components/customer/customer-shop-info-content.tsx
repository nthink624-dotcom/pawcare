import { formatServicePrice } from "@/lib/utils";
import type { Service, Shop } from "@/types/domain";

type Props = {
  shop: Shop;
  services: Service[];
  showBackLink?: boolean;
};

function formatBusinessHours(shop: Shop) {
  if (shop.customer_page_settings.operating_hours_note.trim()) {
    return shop.customer_page_settings.operating_hours_note.trim();
  }

  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  return labels
    .map((label, index) => {
      const hours = shop.business_hours[index];
      if (!hours?.enabled) return `${label} 휴무`;
      return `${label} ${hours.open} - ${hours.close}`;
    })
    .join(" · ");
}

export default function CustomerShopInfoContent({ shop, services, showBackLink = false }: Props) {
  const settings = shop.customer_page_settings;
  const displayName = settings.shop_name?.trim() || shop.name;
  const notices = settings.notices.filter(Boolean).slice(0, 3);
  const visibleServices = services.filter((service) => service.is_active);
  const visibleParkingNotice = settings.show_parking_notice ? settings.parking_notice.trim() : "";
  const visibleNotices = settings.show_notices ? notices : [];

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-soft)]">
        {showBackLink ? <a href={`/book/${shop.id}`} className="text-sm font-semibold text-[var(--accent)]">← 예약 화면으로</a> : null}
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-[var(--text)]">매장 정보</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{displayName}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text)]">{shop.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`tel:${shop.phone}`} className="flex h-[44px] items-center justify-center rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white">전화하기</a>
          {settings.show_kakao_inquiry && settings.kakao_inquiry_url ? (
            <a href={settings.kakao_inquiry_url} target="_blank" rel="noreferrer" className="flex h-[44px] items-center justify-center rounded-[14px] border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--text)]">
              카카오 문의
            </a>
          ) : null}
        </div>
      </section>

      <InfoCard title="연락처" value={shop.phone} />
      <InfoCard title="주소" value={shop.address} />
      <InfoCard title="운영시간" value={formatBusinessHours(shop)} />
      <InfoCard title="휴무 안내" value={settings.holiday_notice} />
      <InfoCard title="주차 안내" value={visibleParkingNotice} />

      {visibleNotices.length > 0 ? (
        <section className="rounded-[24px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)]">공지사항</h2>
          <div className="mt-3 space-y-2.5">
            {visibleNotices.map((notice) => (
              <div key={notice} className="rounded-[18px] border border-[var(--border)] bg-[#fcfaf7] px-4 py-3 text-sm leading-6 text-[var(--text)]">
                {notice}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)]">서비스 안내</h2>
        <div className="mt-3 space-y-2.5">
          {visibleServices.map((service) => (
            <div key={service.id} className="rounded-[18px] border border-[var(--border)] bg-[#fcfaf7] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text)]">{service.name}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">{formatServicePrice(service.price, service.price_type ?? "starting")}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  if (!value?.trim()) return null;

  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--text)]">{value}</p>
    </section>
  );
}
