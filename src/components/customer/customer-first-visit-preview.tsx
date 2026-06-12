"use client";

import { ChevronDown } from "lucide-react";

import CustomerShopFrontPanel from "@/components/customer/customer-shop-front-panel";
import { getDotIndicatorClass } from "@/components/owner-web/status-indicators";
import type { BootstrapStaffMember, Service, Shop } from "@/types/domain";

const defaultHeroImages = ["/images/customer-booking-hero-original.jpg"];

function resolveHeroImages(primaryUrl: string, urls: string[]) {
  const images = [primaryUrl, ...urls].map((url) => url.trim()).filter(Boolean);
  return images.length > 0 ? images : defaultHeroImages;
}

export default function CustomerFirstVisitPreview({
  shop,
  services,
  staffMembers = [],
}: {
  shop: Shop;
  services: Service[];
  staffMembers?: BootstrapStaffMember[];
}) {
  void services;
  void staffMembers;

  const settings = shop.customer_page_settings;
  const heroImages = resolveHeroImages(settings.hero_image_url, settings.hero_image_urls ?? []);
  const heroImage = heroImages[0] ?? defaultHeroImages[0];

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-3 pb-6 pt-3">
      <section className="overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
        <div
          className="relative aspect-[16/9] overflow-hidden bg-[#efe7dd] text-white"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(42, 30, 20, 0.04), rgba(31, 24, 18, 0.36)), url(${heroImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <span className="sr-only">{shop.name}</span>
          <div aria-hidden="true" className="absolute bottom-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/85 shadow-[0_1px_6px_rgba(0,0,0,0.18)]" />
        </div>
      </section>

      <section className="mt-2 rounded-[12px] border border-[#e5e7eb] bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
        <div className="flex min-w-0 items-center justify-between gap-3 px-0.5 pb-2">
          <h2 className="truncate text-[21px] font-semibold tracking-[-0.04em] text-[#2b241f]">{shop.name}</h2>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-1.5 py-1 text-[16px] font-normal text-[#6f6258]"
          >
            <span className={getDotIndicatorClass("teal")} aria-hidden="true" />
            영업 중
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>

        <CustomerShopFrontPanel shop={shop} kakaoInquiryUrl={settings.kakao_inquiry_url.trim()} bookingHref="#" />
      </section>
    </div>
  );
}
