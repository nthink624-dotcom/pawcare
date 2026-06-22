"use client";

import { Camera, Info, Save, Scissors, Settings2, Store } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from "react";

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
const CUSTOMER_PREVIEW_CONTENT_WIDTH = 430;
const CUSTOMER_PREVIEW_CONTENT_HEIGHT = 804;
const CUSTOMER_PREVIEW_CONTENT_SCALE = 0.569;
const MAX_SHOP_PROFILE_IMAGES = 500;

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
      className="h-10 w-full rounded-[10px] border border-[#d8dce3] bg-[#f6f8fb] px-3 text-[16px] font-normal text-[#181b21] outline-none transition placeholder:text-[#969ba4] disabled:border-[#e2e8f0] disabled:bg-white disabled:text-[#181b21] focus:border-[#2f6bd4] focus:bg-white focus:ring-4 focus:ring-[#2f6bd4]/10"
    />
  );
}

function AlignedFieldLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("w-[92px] whitespace-nowrap text-[16px] font-normal text-[#181b21]", className)}>
      <span>{children}</span>
    </span>
  );
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-[16px] font-normal text-[#181b21]">
      {children}
      {required ? <span className="ml-1 text-[#ef6a52]">*</span> : null}
    </span>
  );
}

function PanelCard({
  id,
  icon,
  title,
  description,
  action,
  hideHeader = false,
  children,
}: {
  id?: string;
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  hideHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-5 overflow-hidden rounded-[16px] border border-[#e1e4ea] bg-white shadow-[0_1px_2px_rgba(30,35,45,0.03)]">
      {!hideHeader ? (
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] bg-[#2f6bd4]/10 text-[#2f6bd4]">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold leading-6 tracking-[-0.02em] text-[#181b21]">{title}</h3>
            {description ? <p className="mt-0.5 text-[13.5px] font-normal leading-5 text-[#969ba4]">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("px-5 pb-5", hideHeader ? "pt-5" : "pt-4")}>{children}</div>
    </section>
  );
}

function SocialIcon({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-semibold", className)}>
      {label}
    </span>
  );
}

function CardSectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-4 text-[18px] font-semibold tracking-[-0.02em] text-[#181b21]">{children}</h3>;
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
    <div className="flex h-full w-full flex-col items-center justify-center">
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
                  ownerProfile={ownerProfile}
                  infoHref={`/book/${encodeURIComponent(shop.id)}/info`}
                />
              </div>
              <style>{`
                .pm-preview-viewport .pm-entry-proto{
                  max-width:none!important;
                  width:${CUSTOMER_PREVIEW_CONTENT_WIDTH}px!important;
                  min-height:100%!important;
                  height:100%!important;
                  padding-top:0!important;
                }
                .pm-preview-viewport .pm-entry-proto .scroll{
                  height:100%!important;
                  padding-bottom:128px!important;
                }
                .pm-preview-viewport .pm-entry-proto .dock{
                  position:absolute!important;
                  left:0!important;
                  right:0!important;
                  bottom:-12px!important;
                  transform:none!important;
                  width:100%!important;
                  max-width:none!important;
                }
                .pm-preview-viewport .pm-entry-proto .hours .list{
                  width:calc(100% - 32px)!important;
                  max-width:none!important;
                }
              `}</style>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex h-[34px] items-end justify-center bg-[#fdf7f5] pb-[8px]">
                <span className="h-[4px] w-[92px] rounded-full bg-[#241916]/18" />
              </div>
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
          className="pointer-events-none z-20 select-none object-contain"
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
  const profileImages = shopProfileImages.slice(0, MAX_SHOP_PROFILE_IMAGES);
  const storedProfileImages = (shop?.customer_page_settings.hero_image_urls ?? []).filter(Boolean).slice(0, MAX_SHOP_PROFILE_IMAGES);
  const mainProfileImage = profileImages[0] ?? "";
  const displayedProfileImage = mainProfileImage || storedProfileImages[0] || shop?.customer_page_settings.hero_image_url || DEFAULT_SHOP_PROFILE_IMAGE;
  const carouselProfileImages = useMemo(() => {
    const sourceImages = profileImages.length > 0 ? profileImages : storedProfileImages.length > 0 ? storedProfileImages : [displayedProfileImage];
    return sourceImages.filter(Boolean).slice(0, MAX_SHOP_PROFILE_IMAGES);
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
  const sectionTabs = useMemo(
    () => [
      { id: "basic", label: "기본 정보" },
      { id: "hours", label: "영업 시간", hidden: !children },
      { id: "menu", label: "서비스 메뉴", hidden: !serviceMenuContent },
      { id: "policy", label: "예약 정책" },
    ].filter((tab) => !tab.hidden),
    [children, serviceMenuContent],
  );
  const [activeSectionId, setActiveSectionId] = useState(sectionTabs[0]?.id ?? "basic");
  const settingsScrollRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const scrollContainer = settingsScrollRef.current;
    if (!scrollContainer) return;
    const container = scrollContainer;

    function updateActiveSection() {
      const bottomGap = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (bottomGap <= 8) {
        setActiveSectionId(sectionTabs[sectionTabs.length - 1]?.id ?? "basic");
        return;
      }

      const containerTop = container.getBoundingClientRect().top;
      let nextSectionId = sectionTabs[0]?.id ?? "basic";

      for (const tab of sectionTabs) {
        const section = container.querySelector<HTMLElement>(`#shop-info-${tab.id}`);
        if (!section) continue;
        const sectionTop = section.getBoundingClientRect().top - containerTop;
        if (sectionTop <= 44) {
          nextSectionId = tab.id;
        }
      }

      setActiveSectionId(nextSectionId);
    }

    updateActiveSection();
    container.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => container.removeEventListener("scroll", updateActiveSection);
  }, [sectionTabs]);

  function scrollToSection(sectionId: string) {
    const scrollContainer = settingsScrollRef.current;
    const section = scrollContainer?.querySelector<HTMLElement>(`#shop-info-${sectionId}`);
    if (!scrollContainer || !section) return;

    const containerTop = scrollContainer.getBoundingClientRect().top;
    const sectionTop = section.getBoundingClientRect().top;
    scrollContainer.scrollTo({
      top: scrollContainer.scrollTop + sectionTop - containerTop - 20,
      behavior: "smooth",
    });
    setActiveSectionId(sectionId);
  }

  const saveAction = (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-[#2f6bd4] px-4 text-[16px] font-semibold text-white transition hover:bg-[#285bb3] disabled:bg-[#bdc2cb] disabled:text-white"
    >
      <Save className="h-4 w-4" />
      {saving ? "저장 중" : "저장"}
    </button>
  );
  const reservationPolicySection = (
    <div className="rounded-[10px] border border-[#e5e7eb] bg-white p-3">
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
    <div className="h-full min-h-0 overflow-hidden rounded-[18px] border border-[#e1e4ea] bg-[#f1f3f6] shadow-[0_10px_34px_rgba(15,23,42,0.06)]">
      <div className="grid h-full min-h-0 xl:grid-cols-[minmax(0,1fr)_392px]">
        <div className="flex min-h-0 min-w-0 flex-col border-r border-[#e1e4ea] bg-[#f1f3f6]">
          <div className="shrink-0 border-b border-[#e1e4ea] bg-white/90 px-5 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-[42px] min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full bg-[#eef1f5] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {sectionTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => scrollToSection(tab.id)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center rounded-full px-4 text-[15px] font-medium transition",
                      activeSectionId === tab.id ? "bg-white text-[#2f6bd4] shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-[#646a74] hover:bg-white/70 hover:text-[#181b21]",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {saveAction}
            </div>
          </div>

          <div ref={settingsScrollRef} className="min-h-0 overflow-y-auto px-5 py-5 [scrollbar-width:thin]">
            <div className="mx-auto max-w-[980px] space-y-[18px] pb-24">
              <PanelCard
                id="shop-info-basic"
                icon={<Store className="h-[17px] w-[17px]" />}
                title="기본 정보"
                hideHeader
              >
                <CardSectionTitle>기본 정보</CardSectionTitle>
                <div className="space-y-4">
                  <div className="grid min-w-0 items-stretch gap-3 lg:grid-cols-[minmax(340px,380px)_minmax(0,1fr)]">
                    <div className="min-w-0">
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
                        className={cn(
                          "group relative aspect-[16/10] w-full overflow-hidden rounded-[13px] border bg-[#f6f8fb] text-[#2f6bd4] transition disabled:cursor-not-allowed disabled:opacity-70",
                          activeProfileImage ? "border-[#2f6bd4] shadow-[0_0_0_2px_rgba(47,107,212,0.12)]" : "border-dashed border-[#cfd7e3] hover:border-[#2f6bd4]",
                        )}
                        aria-label="대표 매장 사진"
                      >
                        {activeProfileImage ? (
                          <>
                            <Image src={activeProfileImage} alt="매장 사진" width={360} height={360} unoptimized className="h-full w-full object-cover" />
                            <span className="absolute left-2 top-2 z-10 inline-flex h-7 items-center gap-1 rounded-[7px] bg-[#2f6bd4] px-2.5 text-[12px] font-semibold text-white shadow-[0_4px_10px_rgba(47,107,212,0.22)]">
                              대표
                            </span>
                          </>
                        ) : (
                          <span className="flex h-full flex-col items-center justify-center gap-2">
                            <Camera className="h-8 w-8" />
                            <span className="text-[15px] font-semibold text-[#64748b]">사진 추가</span>
                          </span>
                        )}
                      </button>
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

                    <div className="grid min-w-0 grid-cols-4 content-start gap-2 overflow-hidden">
                      {carouselProfileImages.slice(1, 8).map((imageUrl, offsetIndex) => {
                        const imageIndex = offsetIndex + 1;
                        return (
                          <button
                            key={`${imageUrl}-${imageIndex}`}
                            type="button"
                            onClick={() => setActiveProfileImageIndex(imageIndex)}
                            className={cn(
                              "relative aspect-square w-full overflow-hidden rounded-[10px] border bg-white transition",
                              visibleProfileImageIndex === imageIndex ? "border-[#2f6bd4] shadow-[0_0_0_2px_rgba(47,107,212,0.12)]" : "border-[#e1e5ec] hover:border-[#9bb8f4]",
                            )}
                            aria-label={`${imageIndex + 1}번째 매장 사진 보기`}
                          >
                            <Image src={imageUrl} alt="" width={112} height={112} unoptimized className="h-full w-full object-cover" />
                          </button>
                        );
                      })}
                      {carouselProfileImages.length > 8 ? (
                        <button
                          type="button"
                          onClick={() => setActiveProfileImageIndex(8)}
                          className="relative aspect-square w-full overflow-hidden rounded-[10px] border border-[#e1e5ec] bg-white transition hover:border-[#9bb8f4]"
                          aria-label={`숨겨진 매장 사진 ${carouselProfileImages.length - 8}장 보기`}
                        >
                          <Image src={carouselProfileImages[8]} alt="" width={96} height={96} unoptimized className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[14px] font-semibold text-white">
                            +{carouselProfileImages.length - 8}
                          </span>
                        </button>
                      ) : null}
                      {carouselProfileImages.length <= 8 && carouselProfileImages.length < MAX_SHOP_PROFILE_IMAGES ? (
                        <button
                          type="button"
                          onClick={() => document.getElementById("shop-profile-images-input")?.click()}
                          disabled={!editable}
                          className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-[#d8dce3] bg-[#f6f8fb] text-[#969ba4] transition hover:border-[#2f6bd4] hover:text-[#2f6bd4] disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="매장 사진 추가"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[12px] font-semibold">사진 추가</span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <label className="grid gap-1.5">
                      <FieldLabel required>매장명</FieldLabel>
                      <TextInput value={shopName} disabled={!editable} onChange={(value) => onRowChange("shopName", value)} onCommit={(value) => onRowCommit("shopName", value)} />
                    </label>
                    <label className="grid gap-1.5">
                      <FieldLabel required>매장 연락처</FieldLabel>
                      <TextInput value={phone} disabled={!editable} onChange={(value) => onRowChange("phone", value)} onCommit={(value) => onRowCommit("phone", value)} />
                    </label>
                  </div>

                  <label className="grid gap-1.5">
                    <FieldLabel required>매장 주소</FieldLabel>
                    <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(260px,1fr)_minmax(180px,0.45fr)_80px]">
                      <TextInput value={address} disabled={!editable} onChange={(value) => onRowChange("address", value)} onCommit={(value) => onRowCommit("address", value)} />
                      <TextInput value={addressDetail} disabled={!editable} onChange={(value) => onRowChange("addressDetail", value)} onCommit={(value) => onRowCommit("addressDetail", value)} />
                      <button
                        type="button"
                        onClick={onOpenAddressSearch}
                        disabled={!editable}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#d8dce3] bg-white px-3 text-[16px] font-semibold text-[#3a3f48] transition hover:border-[#2f6bd4] hover:text-[#2f6bd4] disabled:text-[#969ba4]"
                      >
                        검색
                      </button>
                    </div>
                  </label>

                  <label className="grid gap-1.5">
                    <FieldLabel>매장 소개</FieldLabel>
                    <div className="relative min-w-0">
                      <textarea
                        value={description}
                        maxLength={100}
                        disabled={!editable}
                        onChange={(event) => onRowChange("description", event.target.value)}
                        onBlur={(event) => onRowCommit("description", event.target.value)}
                        className="min-h-[94px] w-full resize-none rounded-[10px] border border-[#d8dce3] bg-[#f6f8fb] px-3 py-2.5 pb-7 text-[16px] font-normal leading-6 text-[#181b21] outline-none transition placeholder:text-[#969ba4] disabled:border-[#e2e8f0] disabled:bg-white disabled:text-[#181b21] focus:border-[#2f6bd4] focus:bg-white focus:ring-4 focus:ring-[#2f6bd4]/10"
                        placeholder="매장을 짧게 소개해 주세요"
                      />
                      <span className="pointer-events-none absolute bottom-2 right-3 text-[13px] text-[#646a74]">{description.length} / 100</span>
                    </div>
                  </label>
                </div>

                <div className="mt-5 border-t border-[#e8eaef] pt-4">
                  <p className="mb-3 text-[16px] font-medium text-[#3a3f48]">SNS · 채널 연결</p>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <label className="flex min-w-0 items-center gap-2">
                      <SocialIcon label="in" className="bg-[linear-gradient(135deg,#feda75,#d62976,#962fbf)] text-white" />
                      <TextInput value={instagramUrl} disabled={!editable} placeholder="https://instagram.com/..." onChange={(value) => onRowChange("instagramUrl", value)} onCommit={(value) => onRowCommit("instagramUrl", value)} />
                    </label>
                    <label className="flex min-w-0 items-center gap-2">
                      <SocialIcon label="k" className="bg-[#FEE500] text-[#3b1e1e]" />
                      <TextInput value={kakaoChannelUrl} disabled={!editable} placeholder="https://pf.kakao.com/..." onChange={(value) => onRowChange("kakaoChannelUrl", value)} onCommit={(value) => onRowCommit("kakaoChannelUrl", value)} />
                    </label>
                    <label className="flex min-w-0 items-center gap-2">
                      <SocialIcon label="T" className="bg-[#181b21] text-white" />
                      <TextInput value={tiktokUrl} disabled={!editable} placeholder="https://tiktok.com/..." onChange={(value) => onRowChange("tiktokUrl", value)} onCommit={(value) => onRowCommit("tiktokUrl", value)} />
                    </label>
                    <label className="flex min-w-0 items-center gap-2">
                      <SocialIcon label="@" className="bg-[#181b21] text-white" />
                      <TextInput value={threadsUrl} disabled={!editable} placeholder="https://threads.net/..." onChange={(value) => onRowChange("threadsUrl", value)} onCommit={(value) => onRowCommit("threadsUrl", value)} />
                    </label>
                  </div>
                </div>
              </PanelCard>

              {children ? (
                <PanelCard
                  id="shop-info-hours"
                  icon={<Settings2 className="h-[17px] w-[17px]" />}
                  title="영업 시간"
                  hideHeader
                >
                  <CardSectionTitle>영업 시간</CardSectionTitle>
                  <div>{children}</div>
                </PanelCard>
              ) : null}

              {serviceMenuContent ? (
                <PanelCard
                  id="shop-info-menu"
                  icon={<Scissors className="h-[17px] w-[17px]" />}
                  title="서비스 메뉴"
                  hideHeader
                >
                  <div>{serviceMenuContent}</div>
                </PanelCard>
              ) : null}

              <PanelCard
                id="shop-info-policy"
                icon={<Settings2 className="h-[17px] w-[17px]" />}
                title="예약 정책"
                hideHeader
              >
                <CardSectionTitle>예약 정책</CardSectionTitle>
                <div>{reservationPolicySection}</div>
              </PanelCard>

              <p className="text-[13px] font-normal text-[#969ba4]">* 표시는 필수 입력 항목입니다.</p>
            </div>
          </div>
        </div>

        <aside className="hidden min-h-0 min-w-0 bg-white xl:flex xl:flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6 py-5">
            <ShopCustomerPagePreview
              shop={customerPreviewShop}
              services={previewServices}
              ownerProfile={ownerProfile}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

