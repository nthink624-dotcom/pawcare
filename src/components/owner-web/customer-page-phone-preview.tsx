"use client";

import Image from "next/image";
import type { ReactNode } from "react";

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
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center", className)}>
      <p className="mb-4 text-[16px] font-semibold tracking-[-0.02em] text-[#111827]">미리보기</p>
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
                <CustomerBookingEntryPage
                  shop={shop}
                  services={services}
                  staffMembers={staffMembers}
                  ownerProfile={ownerProfile}
                  infoHref={`/entry/${encodeURIComponent(shop.id)}`}
                  previewMode
                />
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
    <div className={cn("grid h-full min-h-0 gap-4", !hidePreview && "xl:grid-cols-[minmax(0,1fr)_352px]", className)}>
      <div className="min-h-0 min-w-0 overflow-y-auto pr-1">{children}</div>
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
