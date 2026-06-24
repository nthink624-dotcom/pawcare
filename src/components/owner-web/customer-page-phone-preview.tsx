"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { cn, formatServicePrice } from "@/lib/utils";
import type { BootstrapStaffMember, OwnerProfile, Service, Shop } from "@/types/domain";

const CUSTOMER_PREVIEW_PHONE_FRAME_SRC = "/images/iphone-14-pro-phone-template.svg";
const CUSTOMER_PREVIEW_CONTENT_WIDTH = 430;
const CUSTOMER_PREVIEW_CONTENT_HEIGHT = 804;
const CUSTOMER_PREVIEW_CONTENT_SCALE = 0.569;

function StorefrontOnlyPreview({ shop, services }: { shop: Shop; services: Service[] }) {
  const settings = shop.customer_page_settings;
  const shopName = settings.shop_name || shop.name;
  const tagline = settings.tagline || shop.description || "반려동물 미용 예약";
  const heroImage = settings.hero_image_urls?.find((imageUrl) => imageUrl.trim().length > 0) || settings.hero_image_url || "/images/customer-booking-hero-original.jpg";
  const visibleServices = services
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ko"))
    .slice(0, 5);

  return (
    <div className="relative h-full overflow-hidden bg-[#fdf7f5] text-[#2f2521]">
      <div className="h-full overflow-hidden px-5 pb-[108px] pt-4">
        <div className="relative h-[184px] overflow-hidden rounded-[18px] bg-[#eadfd8] shadow-[0_10px_26px_rgba(47,37,33,0.12)]">
          <img src={heroImage} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/50" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[22px] font-semibold tracking-[-0.04em] text-white">{shopName}</p>
            <p className="mt-1 line-clamp-1 text-[13px] text-white/85">{tagline}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[18px] border border-[#f0e2dc] bg-white shadow-[0_10px_24px_rgba(48,31,24,0.06)]">
          {visibleServices.length > 0 ? (
            visibleServices.map((service) => (
              <div key={service.id} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-[#f3e9e4] px-4 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#2f2521]">{service.name}</p>
                  <p className="mt-0.5 text-[11px] text-[#9a8b84]">{service.duration_minutes}분</p>
                </div>
                <p className="shrink-0 text-[13px] font-semibold text-[#ec7f72]">{formatServicePrice(service.price, service.price_type)}~</p>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-[14px] text-[#9a8b84]">노출할 서비스 메뉴가 없습니다.</div>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[34px] z-20 border-t border-[#efe2dc] bg-[#fdf7f5]/95 px-5 py-3">
        <div className="grid grid-cols-[44px_44px_minmax(0,1fr)] gap-2">
          <button type="button" className="h-[50px] rounded-[12px] border border-[#f0e2dc] bg-white text-[18px] text-[#ec7f72]">☎</button>
          <button type="button" className="h-[50px] rounded-[12px] border border-[#f0e2dc] bg-white text-[18px] text-[#ec7f72]">↗</button>
          <button type="button" className="h-[50px] rounded-[12px] bg-[#ec7f72] text-[15px] font-semibold text-white shadow-[0_10px_18px_rgba(236,127,114,0.24)]">
            간편예약 시작
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffSelectionOnlyPreview({ shop, staffMembers }: { shop: Shop; staffMembers: BootstrapStaffMember[] }) {
  const visibleStaff = staffMembers.length > 0 ? staffMembers : [];

  return (
    <div className="h-full overflow-hidden bg-[#fdf7f5] px-5 pb-24 pt-5 text-[#2f2521]">
      <div className="mb-5">
        <p className="text-[13px] font-medium text-[#9a8b84]">{shop.customer_page_settings.shop_name || shop.name}</p>
        <p className="mt-1 text-[24px] font-semibold tracking-[-0.03em]">직원 선택</p>
        <p className="mt-1 text-[14px] leading-5 text-[#7b6d66]">예약을 담당할 직원을 선택하는 고객 화면입니다.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {visibleStaff.slice(0, 8).map((staff) => (
          <div key={staff.id} className="flex min-h-[132px] flex-col items-center justify-center rounded-[16px] border border-[#efe2dc] bg-white px-3 text-center shadow-[0_8px_22px_rgba(48,31,24,0.07)]">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#f7eee9] text-[22px] font-semibold text-[#7b6d66]">
              {staff.profileImageUrl ? <img src={staff.profileImageUrl} alt="" className="h-full w-full object-cover" /> : staff.name.slice(0, 1)}
            </div>
            <p className="mt-2 max-w-full truncate text-[16px] font-semibold">{staff.displayName || staff.name}</p>
            <p className="mt-0.5 max-w-full truncate text-[13px] text-[#9a8b84]">{staff.position || staff.role || "디자이너"}</p>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-[34px] z-20 border-t border-[#efe2dc] bg-[#fdf7f5]/95 px-5 py-3">
        <button type="button" className="h-[52px] w-full rounded-[14px] bg-[#2f7866] text-[16px] font-semibold text-white">다음</button>
      </div>
    </div>
  );
}

export function CustomerPagePhonePreview({
  shop,
  services,
  ownerProfile,
  staffMembers = [],
  previewMode = "entry",
  className,
}: {
  shop: Shop | null;
  services: Service[];
  ownerProfile?: OwnerProfile | null;
  staffMembers?: BootstrapStaffMember[];
  previewMode?: "entry" | "staffSelection";
  className?: string;
}) {
  void ownerProfile;

  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center", className)}>
      <p className="mb-4 text-[16px] font-semibold tracking-[-0.02em] text-[#111827]">{"\uBBF8\uB9AC\uBCF4\uAE30"}</p>
      <div className="relative aspect-[823/1677] w-[270px] max-w-full">
        <div className="pointer-events-none absolute left-[3.4%] top-[1.25%] h-[97.4%] w-[93.2%] rounded-[40px] bg-[#070707]" />
        <div className="absolute left-[4.62%] top-[1.91%] z-10 h-[96.48%] w-[90.64%] overflow-hidden rounded-[31px] bg-[#fdf7f5]">
          {shop ? (
            <div className="pm-preview-viewport absolute inset-0 overflow-hidden bg-[#fdf7f5]">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[40px] items-center justify-between bg-[#fdf7f5] px-[24px] pt-[8px] text-[10.5px] font-semibold text-[#241916]">
                <span>9:41</span>
                <span className="flex items-center gap-[4px]">
                  <span className="flex h-[9px] items-end gap-[1.5px]">
                    <span className="block h-[3px] w-[2px] rounded-sm bg-[#241916]/85" />
                    <span className="block h-[5px] w-[2px] rounded-sm bg-[#241916]/85" />
                    <span className="block h-[7px] w-[2px] rounded-sm bg-[#241916]/85" />
                    <span className="block h-[9px] w-[2px] rounded-sm bg-[#241916]/85" />
                  </span>
                  <span className="relative h-[9px] w-[12px] overflow-hidden">
                    <span className="absolute left-1/2 top-[1px] h-[12px] w-[12px] -translate-x-1/2 rounded-full border-[1.5px] border-[#241916]/85" />
                    <span className="absolute bottom-0 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[#241916]/85" />
                  </span>
                  <span className="relative h-[9px] w-[19px] rounded-[3px] border border-[#241916]/85">
                    <span className="absolute -right-[3px] top-1/2 h-[4px] w-[2px] -translate-y-1/2 rounded-r bg-[#241916]/70" />
                    <span className="absolute left-[2px] top-[2px] h-[3px] w-[12px] rounded-[2px] bg-[#241916]" />
                  </span>
                </span>
              </div>
              <div
                className="absolute left-0 top-[40px] origin-top-left overflow-hidden"
                style={{
                  width: CUSTOMER_PREVIEW_CONTENT_WIDTH,
                  height: CUSTOMER_PREVIEW_CONTENT_HEIGHT,
                  transform: `scale(${CUSTOMER_PREVIEW_CONTENT_SCALE})`,
                }}
              >
                {/* Owner preview must never mount the legacy 1/4 customer booking form flow. */}
                {previewMode === "staffSelection" ? (
                  <StaffSelectionOnlyPreview shop={shop} staffMembers={staffMembers} />
                ) : (
                  <StorefrontOnlyPreview shop={shop} services={services} />
                )}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex h-[34px] items-end justify-center bg-[#fdf7f5] pb-[8px]">
                <span className="h-[4px] w-[92px] rounded-full bg-[#241916]/18" />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center bg-[#fdf7f5] px-8 text-center text-[14px] leading-5 text-[#8a7a72]">
              {"\uB9E4\uC7A5 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uBA74 \uC2E4\uC81C \uACE0\uAC1D \uC608\uC57D \uCCAB \uD654\uBA74\uC774 \uD45C\uC2DC\uB429\uB2C8\uB2E4."}
            </div>
          )}
        </div>
        <Image
          src={CUSTOMER_PREVIEW_PHONE_FRAME_SRC}
          alt=""
          fill
          priority
          unoptimized
          className="pointer-events-none z-20 select-none object-contain"
        />
      </div>
    </div>
  );
}

export function CustomerPagePreviewLayout({
  children,
  shop,
  services,
  ownerProfile,
  staffMembers = [],
  previewMode = "entry",
  className,
  hidePreview = false,
}: {
  children: ReactNode;
  shop: Shop | null;
  services: Service[];
  ownerProfile?: OwnerProfile | null;
  staffMembers?: BootstrapStaffMember[];
  previewMode?: "entry" | "staffSelection";
  className?: string;
  hidePreview?: boolean;
}) {
  return (
    <div className={cn("grid h-full min-h-0 gap-4", !hidePreview && "xl:grid-cols-[minmax(0,1fr)_308px]", className)}>
      <div className="min-h-0 min-w-0 overflow-y-auto pr-1">{children}</div>
      {!hidePreview ? (
      <aside className="hidden min-h-0 rounded-[18px] border border-[#e1e4ea] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)] xl:flex">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-4">
          <CustomerPagePhonePreview
            shop={shop}
            services={services}
            ownerProfile={ownerProfile}
            staffMembers={staffMembers}
            previewMode={previewMode}
          />
        </div>
      </aside>
      ) : null}
    </div>
  );
}
