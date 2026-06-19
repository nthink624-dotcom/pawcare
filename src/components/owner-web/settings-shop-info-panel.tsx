"use client";

import { ImagePlus, Info } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from "react";

import CustomerBookingEntryPage from "@/components/customer/customer-booking-entry-page";
import { cn } from "@/lib/utils";
import type { OwnerProfile, Service, Shop } from "@/types/domain";

export type ShopInfoSettingRow = {
  id: string;
  label: string;
  value: string | boolean | number;
  options?: string[];
};

const DEFAULT_SHOP_PROFILE_IMAGE = "/images/customer-booking-hero-original.jpg";
// Locked preview frame. Do not replace this with a CSS-drawn or generated phone frame.
const CUSTOMER_PREVIEW_PHONE_FRAME_SRC = "/images/iphone-14-pro-phone-template.svg";

type ShopInfoSettingsPanelProps = {
  rows: ShopInfoSettingRow[];
  shopProfileImages: string[];
  children?: ReactNode;
  serviceMenuContent?: ReactNode;
  shop?: Shop;
  previewServices?: Service[];
  ownerProfile?: OwnerProfile | null;
  businessHoursSummary?: string;
  closedDaysSummary?: string;
  editable?: boolean;
  saving?: boolean;
  onSave?: () => void | Promise<void>;
  onProfileImagesAdd: (files: FileList | File[]) => void;
  onProfileImageRemove: (index: number) => void;
  onRowChange: (rowId: string, value: ShopInfoSettingRow["value"]) => void;
  onRowCommit: (rowId: string, value: ShopInfoSettingRow["value"]) => void;
  onOpenAddressSearch: () => void;
};

function rowValue(rows: ShopInfoSettingRow[], rowId: string) {
  return String(rows.find((row) => row.id === rowId)?.value ?? "");
}

function TextInput({
  value,
  placeholder,
  onChange,
  onCommit,
  maxLength,
  disabled = false,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit?.(event.target.value)}
      className="mt-0.5 h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#111827] outline-none transition placeholder:text-[#9ca3af] disabled:border-[#e2e8f0] disabled:bg-white disabled:text-[#111827] focus:border-[#2f7866] focus:ring-2 focus:ring-[#2f7866]/10"
    />
  );
}

function AlignedFieldLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("w-[92px] whitespace-nowrap text-[16px] font-normal text-[#111827]", className)}>
      <span>{children}</span>
    </span>
  );
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-[16px] font-normal text-[#111827]">
      {children}
      {required ? <span className="ml-1 text-[#2f7866]">*</span> : null}
    </span>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-[#e5e7eb] py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[#111827]">{title}</h3>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  required,
  children,
  alignTop = false,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-[148px_minmax(0,1fr)]", alignTop ? "sm:items-start" : "sm:items-center")}>
      <div className={cn(alignTop && "pt-2")}>
        <FieldLabel required={required}>{label}</FieldLabel>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function OptionCard({
  selected,
  disabled,
  title,
  description,
  helpText,
  helpIcon = "info",
  tone = "default",
  compact = false,
  neutralSelected = false,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  description?: string;
  helpText?: string;
  helpIcon?: "info" | "warning" | "warningDiamond";
  tone?: "default" | "success" | "warning" | "danger";
  compact?: boolean;
  neutralSelected?: boolean;
  onClick: () => void;
}) {
  const helpIconToneClass =
    !selected
      ? "text-[#94a3b8]"
      : tone === "danger"
      ? "text-[#a04455]"
      : tone === "warning"
        ? "text-[#b98121]"
        : tone === "success"
          ? "text-[#2f7866]"
          : "text-[#94a3b8]";
  const selectedToneClass =
    neutralSelected
      ? "border-[#dbe2ea] bg-white"
      : tone === "danger"
      ? "border-[#a04455] bg-[#fff5f7]"
      : tone === "warning"
        ? "border-[#b98121] bg-[#fffaf0]"
        : tone === "success"
          ? "border-[#2f7866] bg-[#f3fbf7]"
          : "border-[#2f7866] bg-white";
  const dotToneClass =
    neutralSelected
      ? "border-[#2f7866] bg-[#2f7866]"
      : tone === "danger"
      ? "border-[#a04455] bg-[#a04455]"
      : tone === "warning"
        ? "border-[#b98121] bg-[#b98121]"
        : "border-[#2f7866] bg-[#2f7866]";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center border text-left transition",
        compact ? "gap-2 rounded-[8px] px-2.5 py-2" : "gap-2.5 rounded-[10px] px-3 py-2.5",
        selected ? selectedToneClass : "border-[#dbe2ea] bg-white hover:border-[#bad8cd]",
        disabled && "cursor-wait",
      )}
    >
      <span
        className={cn(
          "h-3.5 w-3.5 shrink-0 rounded-full border",
          selected ? `${dotToneClass} shadow-[inset_0_0_0_3.5px_white]` : "border-[#cbd5e1]",
        )}
      />
      <span className="min-w-0">
        <span className={cn("inline-flex min-w-0 items-center gap-1.5 font-normal text-[#111827]", compact ? "text-[15px] leading-5" : "text-[16px] leading-6")}>
          <span className="truncate">{title}</span>
          {helpText ? (
            <span className="group relative inline-flex h-6 w-4 shrink-0 items-center justify-center">
              {helpIcon === "info" ? (
                <Info className={cn("block h-4 w-4 translate-y-[0.5px]", helpIconToneClass)} aria-hidden="true" />
              ) : (
                <span
                  className={cn("block h-4 w-4 translate-y-[0.5px]", helpIconToneClass)}
                  style={
                    {
                      WebkitMask: `url(${helpIcon === "warningDiamond" ? "/icons/phosphor/WarningDiamond.svg" : "/icons/phosphor/Warning.svg"}) center / contain no-repeat`,
                      mask: `url(${helpIcon === "warningDiamond" ? "/icons/phosphor/WarningDiamond.svg" : "/icons/phosphor/Warning.svg"}) center / contain no-repeat`,
                      backgroundColor: "currentColor",
                    } as CSSProperties
                  }
                  aria-hidden="true"
                />
              )}
              <span className="pointer-events-none absolute left-1/2 top-6 z-30 w-[240px] -translate-x-1/2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[12px] leading-5 text-[#475569] opacity-0 shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition group-hover:opacity-100 group-focus-within:opacity-100">
                {helpText}
              </span>
            </span>
          ) : null}
        </span>
        {description ? <span className="mt-0.5 block text-[11px] leading-4 text-[#64748b]">{description}</span> : null}
      </span>
    </button>
  );
}

function ShopCustomerPagePreview({
  shop,
  services,
  ownerProfile,
}: {
  shop: Shop | null;
  services: Service[];
  ownerProfile?: OwnerProfile | null;
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <p className="mb-3 text-[18px] font-semibold text-[#111827]">미리보기</p>
      <div className="relative aspect-[823/1677] w-[300px] max-w-full">
        <div className="absolute left-[4.62%] top-[1.91%] h-[96.48%] w-[90.64%] overflow-hidden rounded-[30px] bg-[#fdf7f5]">
          {shop ? (
            <div className="pm-preview-viewport absolute inset-0 overflow-hidden bg-[#fdf7f5]">
              <CustomerBookingEntryPage
                shop={shop}
                services={services}
                ownerProfile={ownerProfile}
                infoHref={`/book/${encodeURIComponent(shop.id)}/info`}
              />
              <style>{`
                .pm-preview-viewport .pm-entry-proto{
                  max-width:none!important;
                  min-height:100%!important;
                  height:100%!important;
                }
                .pm-preview-viewport .pm-entry-proto .scroll{
                  height:100%!important;
                  padding-bottom:96px!important;
                }
                .pm-preview-viewport .pm-entry-proto .dock{
                  position:absolute!important;
                  left:0!important;
                  right:0!important;
                  bottom:0!important;
                  transform:none!important;
                  width:100%!important;
                  max-width:none!important;
                }
                .pm-preview-viewport .pm-entry-proto .hours .list{
                  width:calc(100% - 32px)!important;
                  max-width:none!important;
                }
              `}</style>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center bg-[#fdf7f5] px-8 text-center text-[14px] leading-5 text-[#8a7a72]">
              매장 정보를 불러오면 실제 고객 예약 첫 화면이 표시됩니다.
            </div>
          )}
        </div>
        <Image
          src={CUSTOMER_PREVIEW_PHONE_FRAME_SRC}
          alt=""
          fill
          priority
          unoptimized
          className="pointer-events-none select-none object-contain"
        />
      </div>
    </div>
  );
}

export default function ShopInfoSettingsPanel({
  rows,
  shopProfileImages,
  children,
  serviceMenuContent,
  shop,
  previewServices = [],
  ownerProfile,
  businessHoursSummary = "",
  closedDaysSummary = "",
  editable = true,
  saving = false,
  onSave,
  onProfileImagesAdd,
  onProfileImageRemove,
  onRowChange,
  onRowCommit,
  onOpenAddressSearch,
}: ShopInfoSettingsPanelProps) {
  const shopName = rowValue(rows, "shopName");
  const description = rowValue(rows, "description");
  const instagramUrl = rowValue(rows, "instagramUrl");
  const kakaoChannelUrl = rowValue(rows, "kakaoChannelUrl");
  const tiktokUrl = rowValue(rows, "tiktokUrl");
  const threadsUrl = rowValue(rows, "threadsUrl");
  const phone = rowValue(rows, "phone");
  const address = rowValue(rows, "address");
  const addressDetail = rowValue(rows, "addressDetail");
  const approvalMode = rowValue(rows, "approvalMode");
  const autoApproval = approvalMode === "諛붾줈 ?뱀씤" || approvalMode === "auto";
  const manualApproval = !autoApproval;
  const profileImages = shopProfileImages.slice(0, 10);
  const storedProfileImages = (shop?.customer_page_settings.hero_image_urls ?? []).filter(Boolean).slice(0, 10);
  const mainProfileImage = profileImages[0] ?? "";
  const displayedProfileImage = mainProfileImage || storedProfileImages[0] || shop?.customer_page_settings.hero_image_url || DEFAULT_SHOP_PROFILE_IMAGE;
  const carouselProfileImages = useMemo(() => {
    const sourceImages = profileImages.length > 0 ? profileImages : storedProfileImages.length > 0 ? storedProfileImages : [displayedProfileImage];
    return sourceImages.filter(Boolean).slice(0, 10);
  }, [displayedProfileImage, profileImages, storedProfileImages]);
  const [activeProfileImageIndex, setActiveProfileImageIndex] = useState(0);
  const profileTouchStartXRef = useRef<number | null>(null);
  const profileDidSwipeRef = useRef(false);
  const visibleProfileImageIndex = Math.min(activeProfileImageIndex, Math.max(carouselProfileImages.length - 1, 0));
  const activeProfileImage = carouselProfileImages[visibleProfileImageIndex] || displayedProfileImage;
  const maxVisibleProfileThumbnails = 4;
  const hasHiddenProfileImages = carouselProfileImages.length > maxVisibleProfileThumbnails;
  const visibleProfileThumbnails = hasHiddenProfileImages
    ? carouselProfileImages.slice(0, maxVisibleProfileThumbnails - 1)
    : carouselProfileImages.slice(0, maxVisibleProfileThumbnails);
  const hiddenProfileImageCount = hasHiddenProfileImages
    ? carouselProfileImages.length - visibleProfileThumbnails.length
    : 0;
  const effectiveDescription =
    description || shop?.description?.trim() || shop?.customer_page_settings.tagline?.trim() || "";
  const customerPreviewShop = useMemo(() => {
    if (!shop) return null;

    return {
      ...shop,
      name: shopName || shop.name,
      phone: phone || shop.phone,
      address: address || shop.address,
      description: effectiveDescription,
      approval_mode: autoApproval ? ("auto" as const) : ("manual" as const),
      customer_page_settings: {
        ...shop.customer_page_settings,
        tagline: effectiveDescription || shop.customer_page_settings.tagline,
        social_links: {
          instagram_url: instagramUrl,
          kakao_channel_url: kakaoChannelUrl,
          tiktok_url: tiktokUrl,
          threads_url: threadsUrl,
        },
        address_detail: addressDetail || shop.customer_page_settings.address_detail,
        hero_image_url: activeProfileImage || shop.customer_page_settings.hero_image_url,
        hero_image_urls: carouselProfileImages,
      },
    };
  }, [
    activeProfileImage,
    address,
    addressDetail,
    autoApproval,
    carouselProfileImages,
    effectiveDescription,
    instagramUrl,
    kakaoChannelUrl,
    phone,
    shop,
    shopName,
    threadsUrl,
    tiktokUrl,
  ]);

  function handleProfileTouchStart(event: TouchEvent<HTMLButtonElement>) {
    profileTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleProfileTouchEnd(event: TouchEvent<HTMLButtonElement>) {
    if (carouselProfileImages.length <= 1 || profileTouchStartXRef.current === null) return;
    const deltaX = (event.changedTouches[0]?.clientX ?? profileTouchStartXRef.current) - profileTouchStartXRef.current;
    profileTouchStartXRef.current = null;
    if (Math.abs(deltaX) < 32) return;
    profileDidSwipeRef.current = true;
    setActiveProfileImageIndex((current) => {
      if (deltaX < 0) return (current + 1) % carouselProfileImages.length;
      return (current - 1 + carouselProfileImages.length) % carouselProfileImages.length;
    });
  }

  const profileAction = (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="h-7 rounded-[7px] bg-[#2f7866] px-3 text-[14px] font-medium text-white transition hover:bg-[#276756] disabled:bg-[#cbd5e1] disabled:text-white"
    >
      {saving ? "저장 중" : "저장"}
    </button>
  );

  const reservationPolicySection = (
    <div className="rounded-[10px] border border-[#e5e7eb] bg-white p-3">
      <p className="mb-2 text-[16px] font-medium text-[#334155]">예약 정책</p>
      <div className="grid items-start gap-1.5 xl:grid-cols-[78px_minmax(0,1fr)]">
        <span className="pt-2 text-[16px] font-normal text-[#111827]">승인 방식</span>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <OptionCard
            selected={autoApproval}
            disabled={saving}
            title="바로 승인"
            helpText="고객이 가능한 시간을 선택하면 예약이 즉시 확정됩니다."
            compact
            onClick={() => onRowCommit("approvalMode", "바로 승인")}
          />
          <div
            className={cn(
              "rounded-[8px] border bg-white transition",
              manualApproval ? "border-[#2f7866] bg-white" : "border-[#dbe2ea] hover:border-[#bad8cd]",
              saving && "opacity-80",
            )}
          >
            <div className="grid items-center gap-2 px-2.5 py-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => onRowCommit("approvalMode", "직접 승인")}
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <span className={cn("h-3.5 w-3.5 shrink-0 rounded-full border", manualApproval ? "border-[#2f7866] bg-[#2f7866] shadow-[inset_0_0_0_3.5px_white]" : "border-[#cbd5e1]")} />
                <span className="inline-flex min-w-0 items-center gap-1.5 text-[15px] font-normal leading-5 text-[#111827]">
                  <span className="truncate">직접 승인</span>
                  <span className="group relative inline-flex h-6 w-4 shrink-0 items-center justify-center">
                    <Info className="block h-4 w-4 translate-y-[0.5px] text-[#94a3b8]" aria-hidden="true" />
                    <span className="pointer-events-none absolute left-1/2 top-6 z-30 w-[240px] -translate-x-1/2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[12px] leading-5 text-[#475569] opacity-0 shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition group-hover:opacity-100 group-focus-within:opacity-100">
                      고객 예약은 승인 대기로 들어오고, 오너가 확인 후 확정하거나 거절합니다.
                    </span>
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full min-h-0 pr-1">
      <section className="h-full min-h-0 overflow-hidden rounded-[14px] border border-[#e5e7eb] bg-white p-2.5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">
        <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 min-w-0 overflow-y-auto pr-2 [scrollbar-width:thin]">
            <div className="space-y-3">
            <div className="flex flex-col rounded-[10px] border border-[#e5e7eb] bg-white p-2.5">
              <div className="-mx-0.5 -mt-0.5 mb-0.5 flex h-8 items-center justify-between gap-3 rounded-[8px] px-0.5">
                <h4 className="text-[16px] font-medium text-[#334155]">매장 정보 설정</h4>
                {profileAction}
              </div>
              <div className="order-2 mt-3 grid gap-x-7 gap-y-2 border-t border-[#e5e7eb] pt-3 xl:grid-cols-2">
                <label className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] items-center gap-3">
                  <AlignedFieldLabel>인스타</AlignedFieldLabel>
                  <TextInput value={instagramUrl} disabled={!editable} placeholder="https://instagram.com/..." onChange={(value) => onRowChange("instagramUrl", value)} onCommit={(value) => onRowCommit("instagramUrl", value)} />
                </label>
                <label className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] items-center gap-3">
                  <AlignedFieldLabel>카카오</AlignedFieldLabel>
                  <TextInput value={kakaoChannelUrl} disabled={!editable} placeholder="https://pf.kakao.com/..." onChange={(value) => onRowChange("kakaoChannelUrl", value)} onCommit={(value) => onRowCommit("kakaoChannelUrl", value)} />
                </label>
                <label className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] items-center gap-3">
                  <AlignedFieldLabel>틱톡</AlignedFieldLabel>
                  <TextInput value={tiktokUrl} disabled={!editable} placeholder="https://tiktok.com/..." onChange={(value) => onRowChange("tiktokUrl", value)} onCommit={(value) => onRowCommit("tiktokUrl", value)} />
                </label>
                <label className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] items-center gap-3">
                  <AlignedFieldLabel>쓰레드</AlignedFieldLabel>
                  <TextInput value={threadsUrl} disabled={!editable} placeholder="https://threads.net/..." onChange={(value) => onRowChange("threadsUrl", value)} onCommit={(value) => onRowCommit("threadsUrl", value)} />
                </label>
              </div>

              <div className="order-1">
              <div className="bg-white">
              <div className="grid items-center gap-4 p-2 lg:grid-cols-[230px_minmax(0,1fr)] xl:gap-6">
                <div className="min-w-0">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc]">
                    <button
                      type="button"
                      onClick={() => {
                        if (profileDidSwipeRef.current) {
                          profileDidSwipeRef.current = false;
                          return;
                        }
                        document.getElementById("shop-profile-images-input")?.click();
                      }}
                      onTouchStart={handleProfileTouchStart}
                      onTouchEnd={handleProfileTouchEnd}
                      disabled={!editable}
                      className="group h-full w-full text-[#2f7866] transition hover:opacity-95"
                    >
                      {activeProfileImage ? (
                        <>
                          <Image src={activeProfileImage} alt="매장 사진" width={360} height={270} unoptimized className="h-full w-full object-cover" />
                          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[12px] font-medium text-white">
                            {visibleProfileImageIndex === 0 ? "대표 이미지" : "미리보기"}
                          </span>
                        </>
                      ) : (
                        <span className="flex h-full flex-col items-center justify-center gap-1">
                          <ImagePlus className="h-7 w-7" />
                          <span className="text-[14px] font-medium">사진 추가</span>
                          <span className="text-[13px] font-normal text-[#64748b]">여러 장 등록 가능</span>
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById("shop-profile-images-input")?.click()}
                      disabled={!editable}
                      className="absolute right-2 top-2 z-10 inline-flex h-8 items-center gap-1 rounded-full bg-white/95 px-2.5 text-[12px] font-medium text-[#334155] shadow-[0_4px_14px_rgba(15,23,42,0.18)] transition hover:bg-white hover:text-[#d97706] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="매장 사진 여러 장 추가"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      사진 추가
                    </button>
                    {activeProfileImage ? (
                      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/32 to-transparent px-2 pb-2 pt-8">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {visibleProfileThumbnails.map((imageUrl, index) => (
                            <button
                              key={`${imageUrl}-${index}`}
                              type="button"
                              onClick={() => setActiveProfileImageIndex(index)}
                              className={cn(
                                "relative h-9 w-9 shrink-0 overflow-hidden rounded-[7px] border bg-white transition",
                                visibleProfileImageIndex === index ? "border-white ring-2 ring-[#f59e0b]" : "border-white/55 hover:border-white",
                              )}
                              aria-label={`${index + 1}번째 매장 사진 보기`}
                            >
                              <Image src={imageUrl} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
                            </button>
                          ))}
                          {hasHiddenProfileImages ? (
                            <button
                              type="button"
                              onClick={() => setActiveProfileImageIndex(visibleProfileThumbnails.length)}
                              className={cn(
                                "relative h-9 w-9 shrink-0 overflow-hidden rounded-[7px] border bg-white transition",
                                visibleProfileImageIndex >= visibleProfileThumbnails.length ? "border-white ring-2 ring-[#f59e0b]" : "border-white/55 hover:border-white",
                              )}
                              aria-label={`숨겨진 매장 사진 ${hiddenProfileImageCount}장 보기`}
                            >
                              <Image src={carouselProfileImages[visibleProfileThumbnails.length]} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[12px] font-medium text-white">
                                +{hiddenProfileImageCount}
                              </span>
                            </button>
                          ) : null}
                          <span className="ml-auto shrink-0 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-[#334155]">
                            {carouselProfileImages.length}/10
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <input
                    id="shop-profile-images-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={!editable}
                    onChange={(event) => {
                      if (event.target.files?.length) {
                        onProfileImagesAdd(event.target.files);
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                </div>

                <div className="grid min-w-0 content-center gap-2">
                  <div className="grid gap-1.5 xl:grid-cols-[minmax(260px,0.42fr)_minmax(360px,0.58fr)] xl:gap-6">
                    <label className="grid min-w-0 grid-cols-[98px_minmax(0,1fr)] items-center gap-3">
                      <AlignedFieldLabel>매장명</AlignedFieldLabel>
                      <TextInput value={shopName} disabled={!editable} onChange={(value) => onRowChange("shopName", value)} onCommit={(value) => onRowCommit("shopName", value)} />
                    </label>
                    <label className="grid min-w-0 grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
                      <span className="whitespace-nowrap text-[16px] font-normal text-[#111827]">매장 연락처</span>
                      <TextInput value={phone} disabled={!editable} onChange={(value) => onRowChange("phone", value)} onCommit={(value) => onRowCommit("phone", value)} />
                    </label>
                  </div>

                  <div className="grid min-w-0 grid-cols-[98px_minmax(0,1fr)] items-center gap-3">
                    <AlignedFieldLabel>매장 주소</AlignedFieldLabel>
                    <div className="grid min-w-0 gap-1.5 lg:grid-cols-[minmax(240px,0.6fr)_minmax(180px,0.4fr)_56px]">
                      <TextInput value={address} disabled={!editable} onChange={(value) => onRowChange("address", value)} onCommit={(value) => onRowCommit("address", value)} />
                      <TextInput value={addressDetail} disabled={!editable} onChange={(value) => onRowChange("addressDetail", value)} onCommit={(value) => onRowCommit("addressDetail", value)} />
                      <button
                        type="button"
                        onClick={onOpenAddressSearch}
                        disabled={!editable}
                        className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-[16px] font-medium text-[#2f7866] transition hover:border-[#bad8cd] hover:bg-[#f8fafc] disabled:text-[#94a3b8]"
                      >
                        검색
                      </button>
                    </div>
                  </div>

                  <label className="grid min-w-0 grid-cols-[98px_minmax(0,1fr)] items-start gap-3">
                    <AlignedFieldLabel className="pt-2">매장 소개</AlignedFieldLabel>
                    <div className="relative min-w-0">
                      <textarea
                        value={description}
                        maxLength={100}
                        disabled={!editable}
                        onChange={(event) => onRowChange("description", event.target.value)}
                        onBlur={(event) => onRowCommit("description", event.target.value)}
                        className="mt-0.5 min-h-[58px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 pb-6 text-[16px] font-medium leading-6 text-[#111827] outline-none transition placeholder:text-[#9ca3af] disabled:border-[#e2e8f0] disabled:bg-white disabled:text-[#111827] focus:border-[#2f7866] focus:ring-2 focus:ring-[#2f7866]/10"
                        placeholder="매장을 짧게 소개해 주세요"
                      />
                      <span className="pointer-events-none absolute bottom-2 right-3 text-[13px] text-[#64748b]">{description.length} / 100</span>
                    </div>
                  </label>

                </div>
              </div>

              </div>
              </div>
            </div>

            {children ? (
              <div className="rounded-[10px] border border-[#e5e7eb] bg-white p-3">
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-[16px] font-medium text-[#334155]">매장 영업 시간</p>
                </div>
                {children}
              </div>
            ) : null}

            {serviceMenuContent ? (
              <div className="rounded-[10px] border border-[#e5e7eb] bg-white p-3">
                {serviceMenuContent}
              </div>
            ) : null}
            {reservationPolicySection}
            </div>

            <p className="mt-4 text-[12px] font-medium text-[#64748b]">* 필수 입력 항목입니다.</p>
            </div>

          <aside className="min-h-0 min-w-0 border-t border-[#e5e7eb] pt-3 xl:flex xl:h-full xl:items-center xl:justify-center xl:overflow-hidden xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
            <div className="flex w-full flex-col items-center">
              <ShopCustomerPagePreview
                shop={customerPreviewShop}
                services={previewServices}
                ownerProfile={ownerProfile}
              />
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

