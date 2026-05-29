"use client";

import { ImagePlus, Info } from "lucide-react";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import CustomerBookingEntryPage, { DEFAULT_HERO_IMAGES } from "@/components/customer/customer-booking-entry-page";
import { cn } from "@/lib/utils";
import type { Service, Shop } from "@/types/domain";

export type ShopInfoSettingRow = {
  id: string;
  label: string;
  value: string | boolean | number;
  options?: string[];
};

type ShopInfoSettingsPanelProps = {
  rows: ShopInfoSettingRow[];
  shopProfileImages: string[];
  children?: ReactNode;
  serviceMenuContent?: ReactNode;
  shop?: Shop;
  previewServices?: Service[];
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

function rowOptions(rows: ShopInfoSettingRow[], rowId: string) {
  return rows.find((row) => row.id === rowId)?.options ?? [];
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

function SelectInput({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full appearance-none rounded-[8px] border border-[#dbe2ea] bg-white bg-[linear-gradient(45deg,transparent_50%,#64748b_50%),linear-gradient(135deg,#64748b_50%,transparent_50%)] bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-22px)_14px,calc(100%-17px)_14px] bg-no-repeat px-3 pr-10 text-[16px] font-medium text-[#111827] outline-none transition disabled:border-[#e2e8f0] disabled:bg-white disabled:text-[#111827] focus:border-[#2f7866] focus:ring-2 focus:ring-[#2f7866]/10"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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

export default function ShopInfoSettingsPanel({
  rows,
  shopProfileImages,
  children,
  serviceMenuContent,
  shop,
  previewServices = [],
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
  const phone = rowValue(rows, "phone");
  const address = rowValue(rows, "address");
  const addressDetail = rowValue(rows, "addressDetail");
  const approvalMode = rowValue(rows, "approvalMode");
  const pendingHoldLimit = rowValue(rows, "pendingHoldLimit") || "2건까지 받아두기";
  const autoApproval = approvalMode === "바로 승인" || approvalMode === "auto";
  const manualApproval = !autoApproval;
  const profileImages = shopProfileImages.slice(0, 10);
  const mainProfileImage = profileImages[0] ?? "";
  const displayedProfileImage = mainProfileImage || shop?.customer_page_settings.hero_image_url || DEFAULT_HERO_IMAGES[0];
  const customerPreviewShop = shop
    ? {
        ...shop,
        name: shopName || shop.name,
        phone: phone || shop.phone,
        address: address || shop.address,
        approval_mode: autoApproval ? ("auto" as const) : ("manual" as const),
        customer_page_settings: {
          ...shop.customer_page_settings,
          tagline: description || shop.customer_page_settings.tagline,
          address_detail: addressDetail || shop.customer_page_settings.address_detail,
          hero_image_url: mainProfileImage || shop.customer_page_settings.hero_image_url,
        },
      }
    : null;

  const profileAction = (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="h-9 rounded-[8px] bg-[#2f7866] px-4 text-[16px] font-medium text-white transition hover:bg-[#276756] disabled:bg-[#cbd5e1] disabled:text-white"
    >
      {saving ? "저장 중" : "저장"}
    </button>
  );

  return (
    <div>
      <section className="rounded-[14px] border border-[#e5e7eb] bg-white p-2.5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <h4 className="text-[16px] font-semibold tracking-[-0.01em] text-[#111827]">매장 정보 설정</h4>
              {profileAction}
            </div>
            <div className="rounded-[12px] border border-[#e5e7eb] bg-white">
              <div className="grid gap-2 p-2 lg:grid-cols-[190px_minmax(0,1fr)]">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <FieldLabel>대표 사진</FieldLabel>
                    <span className="text-[13px] text-[#64748b]">{profileImages.length}/10장</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => document.getElementById("shop-profile-images-input")?.click()}
                    disabled={!editable}
                    className="group relative aspect-[4/3] w-full overflow-hidden rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] text-[#2f7866] transition hover:border-[#2f7866]"
                  >
                    {displayedProfileImage ? (
                      <>
                        <Image src={displayedProfileImage} alt="대표 매장 사진" width={300} height={225} unoptimized className="h-full w-full object-cover" />
                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-medium text-[#64748b] shadow-sm">기본 이미지</span>
                      </>
                    ) : (
                      <span className="flex h-full flex-col items-center justify-center gap-1">
                        <ImagePlus className="h-7 w-7" />
                        <span className="text-[14px] font-medium">사진 추가</span>
                      </span>
                    )}
                  </button>
                  {profileImages.length > 0 ? (
                    <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                      {profileImages.slice(0, 4).map((imageUrl, index) => (
                        <button
                          key={`${imageUrl}-${index}`}
                          type="button"
                          onClick={() => document.getElementById("shop-profile-images-input")?.click()}
                          className="relative aspect-square overflow-hidden rounded-[7px] border border-[#dbe2ea] bg-white"
                          aria-label={`매장 사진 ${index + 1}`}
                        >
                          <Image src={imageUrl} alt={`매장 사진 ${index + 1}`} width={48} height={48} unoptimized className="h-full w-full object-cover" />
                          {index === 0 ? <span className="absolute inset-x-1 bottom-1 rounded-full bg-white/90 text-[10px] font-medium text-[#2f7866]">대표</span> : null}
                        </button>
                      ))}
                      {profileImages.length > 4 ? (
                        <button
                          type="button"
                          onClick={() => document.getElementById("shop-profile-images-input")?.click()}
                          className="aspect-square rounded-[7px] border border-[#dbe2ea] bg-[#f8fafc] text-[12px] font-medium text-[#64748b]"
                        >
                          +{profileImages.length - 4}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => document.getElementById("shop-profile-images-input")?.click()}
                          disabled={!editable}
                          className="flex aspect-square items-center justify-center rounded-[7px] border border-dashed border-[#bad8cd] bg-white text-[#2f7866] disabled:text-[#94a3b8]"
                          aria-label="사진 추가"
                        >
                          <ImagePlus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : null}
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

                <div className="grid min-w-0 content-start gap-2">
                  <p className="text-[15px] font-semibold text-[#2f7866]">기본 정보</p>
                  <div className="grid gap-1.5 xl:grid-cols-[minmax(260px,0.42fr)_minmax(360px,0.58fr)]">
                    <label className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-center gap-1">
                      <span className="whitespace-nowrap text-[16px] font-normal text-[#111827]">매장명 :</span>
                      <TextInput value={shopName} disabled={!editable} onChange={(value) => onRowChange("shopName", value)} onCommit={(value) => onRowCommit("shopName", value)} />
                    </label>
                    <label className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-center gap-1">
                      <span className="whitespace-nowrap text-[16px] font-normal text-[#111827]">매장 연락처 :</span>
                      <TextInput value={phone} disabled={!editable} onChange={(value) => onRowChange("phone", value)} onCommit={(value) => onRowCommit("phone", value)} />
                    </label>
                  </div>

                  <div className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-center gap-1">
                    <span className="whitespace-nowrap text-[16px] font-normal text-[#111827]">주소 / 상세주소 :</span>
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

                  <label className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-start gap-1">
                    <span className="pt-2 text-[16px] font-normal text-[#111827]">매장 소개 :</span>
                    <div className="relative min-w-0">
                      <textarea
                        value={description}
                        maxLength={100}
                        disabled={!editable}
                        onChange={(event) => onRowChange("description", event.target.value)}
                        onBlur={(event) => onRowCommit("description", event.target.value)}
                        className="mt-0.5 min-h-[58px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 pb-6 text-[16px] font-medium leading-6 text-[#111827] outline-none transition placeholder:text-[#9ca3af] disabled:border-[#e2e8f0] disabled:bg-white disabled:text-[#111827] focus:border-[#2f7866] focus:ring-2 focus:ring-[#2f7866]/10"
                        placeholder="매장을 짧게 소개해 주세요."
                      />
                      <span className="pointer-events-none absolute bottom-2 right-3 text-[13px] text-[#64748b]">{description.length} / 100</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t border-[#e5e7eb] px-2 py-2.5">
                <div className="grid gap-2 lg:grid-cols-[86px_minmax(0,1fr)]">
                  <p className="text-[15px] font-semibold text-[#2f7866]">예약 정책</p>
                  <div className="grid gap-1.5">
                    <div className="grid items-center gap-1 xl:grid-cols-[max-content_minmax(0,1fr)]">
                      <span className="text-[16px] font-normal text-[#111827]">승인 방식 :</span>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        <OptionCard
                          selected={autoApproval}
                          disabled={saving}
                          title="바로 승인"
                          helpText="고객이 가능한 시간을 선택하면 예약이 즉시 확정됩니다."
                          compact
                          onClick={() => onRowCommit("approvalMode", "바로 승인")}
                        />
                        <OptionCard
                          selected={manualApproval}
                          disabled={saving}
                          title="직접 승인"
                          helpText="고객 예약은 승인 대기로 들어오고, 오너가 확인 후 확정하거나 거절합니다."
                          compact
                          onClick={() => onRowCommit("approvalMode", "직접 승인")}
                        />
                      </div>
                    </div>

                    {manualApproval ? (
                      <div className="grid items-center gap-1 xl:grid-cols-[max-content_minmax(220px,320px)]">
                        <span className="text-[16px] font-normal text-[#111827]">겹치는 예약 설정 :</span>
                        <div className="min-w-0">
                          <SelectInput
                            value={pendingHoldLimit}
                            options={rowOptions(rows, "pendingHoldLimit").length > 0 ? rowOptions(rows, "pendingHoldLimit") : ["1건만 받기", "2건까지 받아두기", "3건 이상 받아두기"]}
                            disabled={saving}
                            onChange={(value) => onRowCommit("pendingHoldLimit", value)}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {children ? (
                <div className="border-t border-[#e5e7eb] p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[15px] font-semibold text-[#2f7866]">매장 운영시간</p>
                    <span className="text-[13px] font-medium text-[#64748b]">고객 예약 가능 시간과 함께 관리됩니다.</span>
                  </div>
                  {children}
                </div>
              ) : null}

              {serviceMenuContent ? (
                <div className="border-t border-[#e5e7eb] p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[15px] font-semibold text-[#2f7866]">서비스 메뉴</p>
                    <span className="text-[13px] font-medium text-[#64748b]">고객 예약페이지 노출 기준입니다.</span>
                  </div>
                  {serviceMenuContent}
                </div>
              ) : null}
            </div>
          </div>

          <aside className="min-w-0 border-t border-[#e5e7eb] pt-3 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
            <div className="xl:sticky xl:top-5">
              <h4 className="mb-2 text-[16px] font-semibold tracking-[-0.01em] text-[#111827]">고객 예페 미리보기</h4>
              <div className="mx-auto w-[280px] max-w-full rounded-[34px] border-[4px] border-[#111827] bg-white p-[8px] shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[#d7c6b4]" />
              <div className="h-[600px] overflow-hidden rounded-[24px] bg-white">
                <div className="pointer-events-none w-[430px] origin-top-left scale-[0.6]">
                  {customerPreviewShop ? (
                    <CustomerBookingEntryPage
                      shop={customerPreviewShop}
                      services={previewServices}
                      bookingHref={`/entry/${customerPreviewShop.id}`}
                      infoHref={`/book/${customerPreviewShop.id}/info`}
                    />
                  ) : null}
                </div>
              </div>
              </div>
            </div>
          </aside>
        </div>

        <p className="mt-4 text-[12px] font-medium text-[#64748b]">* 필수 입력 항목입니다.</p>
      </section>
    </div>
  );
}
