"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

import CustomerBookingEntryPage from "@/components/customer/customer-booking-entry-page";
import { cn } from "@/lib/utils";
import type { BootstrapStaffMember, OwnerProfile, Service, Shop } from "@/types/domain";

const CUSTOMER_PREVIEW_PHONE_FRAME_SRC = "/images/iphone-14-pro-phone-template.svg";
const CUSTOMER_PREVIEW_CONTENT_WIDTH = 430;
const CUSTOMER_PREVIEW_CONTENT_HEIGHT = 804;
const CUSTOMER_PREVIEW_CONTENT_SCALE = 0.569;

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
  const [previewScreen, setPreviewScreen] = useState<"entry" | "bookingStart">("entry");

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
                {previewScreen === "bookingStart" ? (
                  <CustomerPreviewBookingStartScreen
                    shopName={shop.name}
                    services={services}
                    onBack={() => setPreviewScreen("entry")}
                  />
                ) : (
                  <CustomerBookingEntryPage
                    shop={shop}
                    services={services}
                    staffMembers={staffMembers}
                    ownerProfile={ownerProfile}
                    infoHref={`/entry/${encodeURIComponent(shop.id)}`}
                    previewMode={previewMode}
                    onPreviewBookingStart={() => setPreviewScreen("bookingStart")}
                  />
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

function CustomerPreviewBookingStartScreen({
  shopName,
  services,
  onBack,
}: {
  shopName: string;
  services: Service[];
  onBack: () => void;
}) {
  const visibleServices = services
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ko"))
    .slice(0, 4);
  const fallbackServices = visibleServices.length > 0
    ? visibleServices
    : ([{ id: "preview-service", name: "\uC704\uC0DD\uBBF8\uC6A9+\uBAA9\uC695", duration_minutes: 60, price: 30000 }] as Service[]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fdf7f5] text-[#302420]">
      <div className="flex h-[58px] shrink-0 items-center justify-between px-5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[24px] leading-none text-[#302420]"
          aria-label="\uBBF8\uB9AC\uBCF4\uAE30 \uCCAB \uD654\uBA74\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30"
        >
          {"\u2039"}
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[17px] font-semibold tracking-[-0.03em]">{"\uAC04\uD3B8\uC608\uC57D"}</p>
          <p className="truncate text-[11px] text-[#a2938d]">{shopName}</p>
        </div>
        <span className="h-10 w-10" />
      </div>
      <div className="flex-1 overflow-hidden px-5 pb-5">
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#f0dfd9]">
          <div className="h-full w-1/4 rounded-full bg-[#ec7f72]" />
        </div>
        <section className="rounded-[22px] border border-[#efe2dc] bg-white p-4 shadow-[0_12px_32px_rgba(60,40,30,0.08)]">
          <p className="mb-1 text-[13px] font-semibold text-[#ec7f72]">1/4</p>
          <h3 className="text-[21px] font-semibold tracking-[-0.04em]">{"\uC11C\uBE44\uC2A4\uB97C \uC120\uD0DD\uD574\uC694"}</h3>
          <div className="mt-4 grid gap-2.5">
            {fallbackServices.map((service) => (
              <button
                key={service.id}
                type="button"
                className="flex min-h-[58px] items-center justify-between rounded-[15px] border border-[#f1d7d1] bg-[#fffaf8] px-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold tracking-[-0.02em]">{service.name}</span>
                  <span className="mt-0.5 block text-[12px] text-[#a2938d]">{service.duration_minutes ?? 60}{"\uBD84 \uC608\uC0C1"}</span>
                </span>
                <span className="shrink-0 pl-3 text-[14px] font-semibold text-[#d35f50]">
                  {(service.price ?? 0) > 0 ? `${service.price.toLocaleString("ko-KR")}\uC6D0 ~` : "\uAC00\uACA9 \uC548\uB0B4"}
                </span>
              </button>
            ))}
          </div>
        </section>
        <p className="mt-4 rounded-[14px] bg-[#fff1ed] px-4 py-3 text-center text-[13px] leading-5 text-[#8a6259]">
          {"\uBBF8\uB9AC\uBCF4\uAE30 \uD654\uBA74\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uC608\uC57D \uC0DD\uC131\uC740 \uACE0\uAC1D \uC608\uC57D \uB9C1\uD06C\uC5D0\uC11C\uB9CC \uC9C4\uD589\uB429\uB2C8\uB2E4."}
        </p>
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
    <div className={cn("grid h-full min-h-0 gap-2", !hidePreview && "xl:grid-cols-[minmax(0,1fr)_320px]", className)}>
      <div className="min-h-0 min-w-0 overflow-y-auto">{children}</div>
      {!hidePreview ? (
        <aside className="hidden h-full min-h-0 rounded-[18px] border border-[#e1e4ea] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)] xl:flex">
          <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden px-6 py-5">
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
