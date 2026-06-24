"use client";

import { ArrowDown, ArrowUp, Clock, ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CustomerPagePhonePreview } from "@/components/owner-web/customer-page-phone-preview";
import { WebSurface } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  buildCustomerServiceSourceOptions,
  normalizeCustomerServiceOverrides,
  type CustomerServiceDisplayOverrides,
  type CustomerServiceSourceOption,
} from "@/lib/customer-service-options";
import { createOwnerShopProfileImageFromFile } from "@/lib/media/owner-media-client";
import { formatServicePrice } from "@/lib/utils";
import type { BootstrapPayload, CustomerPageSettings, Service, Shop } from "@/types/domain";

type EditableService = {
  id: string | null;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  category: string;
  sortOrder: number;
};

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function parsePrice(value: string) {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function toEditableService(service: Service, index: number): EditableService {
  return {
    id: service.id,
    name: service.name,
    description: service.description || "",
    durationMinutes: service.duration_minutes || 60,
    price: service.price || 0,
    isActive: service.is_active,
    category: service.category || "미용",
    sortOrder: service.sort_order || index + 1,
  };
}

function toServicePayload(shopId: string, service: EditableService) {
  return {
    shopId,
    serviceId: service.id ?? undefined,
    name: service.name.trim(),
    description: service.description.trim(),
    price: service.price,
    priceType: "starting",
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    category: service.category || "미용",
    sortOrder: service.sortOrder,
    capacityLabel: "동일 시간 1건",
    staffSelectionMode: "all",
    priceGuide: {},
  };
}

function mergeSavedService(services: Service[], savedService: Service) {
  return services.some((service) => service.id === savedService.id)
    ? services.map((service) => (service.id === savedService.id ? savedService : service))
    : [...services, savedService];
}

function sortCustomerPageServices(services: Service[]) {
  return services
    .filter((service) => !service.id.startsWith("customer-booking-"))
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ko"));
}

function formatBusinessHours(shop: Shop) {
  return weekdayLabels.map((label, day) => {
    const hours = shop.business_hours[day];
    const closed = shop.regular_closed_days.includes(day) || !hours?.enabled;
    return {
      label,
      text: closed ? "휴무" : `${hours.open} - ${hours.close}`,
      closed,
    };
  });
}

function buildShopPatch(shop: Shop, name: string, tagline: string) {
  return {
    shopId: shop.id,
    name: name.trim(),
    description: shop.description || "",
    tagline: tagline.trim(),
  };
}

function getCustomerServiceRows(options: CustomerServiceSourceOption[], overrides: CustomerServiceDisplayOverrides) {
  const hasConfiguredOverrides = Object.keys(overrides).length > 0;
  return options
    .flatMap((option) => {
      const override = overrides[option.id];
      const hasOverride = Object.prototype.hasOwnProperty.call(overrides, option.id);
      if (hasConfiguredOverrides && (!hasOverride || override?.visible === false)) return [];
      return {
        option,
        visible: override?.visible ?? true,
        order: override?.order ?? option.order,
        displayName: override?.displayName ?? option.sourceName,
        description: override?.description ?? option.description,
      };
    })
    .sort((left, right) => left.order - right.order || left.option.sourceName.localeCompare(right.option.sourceName, "ko"));
}

function cleanCustomerServiceOverride(option: CustomerServiceSourceOption, override: CustomerServiceDisplayOverrides[string]) {
  const next = { ...override };
  if (next.visible === true) delete next.visible;
  if (next.order === option.order) delete next.order;
  if (next.displayName?.trim() === option.sourceName) delete next.displayName;
  if (!next.displayName?.trim()) delete next.displayName;
  if (next.description?.trim() === option.description) delete next.description;
  if (!next.description?.trim()) delete next.description;
  return next;
}

export default function CustomerBookingPageManagementScreen({
  initialData,
  onDataChange,
}: {
  initialData: BootstrapPayload;
  onDataChange: (data: BootstrapPayload) => void;
}) {
  const [shop, setShop] = useState(initialData.shop);
  const [services, setServices] = useState<Service[]>(initialData.services);
  const [shopName, setShopName] = useState(initialData.shop.name);
  const [tagline, setTagline] = useState(initialData.shop.customer_page_settings.tagline || initialData.shop.description || "");
  const [savingShop, setSavingShop] = useState(false);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setShop(initialData.shop);
    setServices(initialData.services);
    setShopName(initialData.shop.name);
    setTagline(initialData.shop.customer_page_settings.tagline || initialData.shop.description || "");
    setOrderDirty(false);
  }, [initialData]);

  const businessHours = useMemo(() => formatBusinessHours(shop), [shop]);
  const heroImageUrl = shop.customer_page_settings.hero_image_url.trim();
  const heroImages = shop.customer_page_settings.hero_image_urls?.filter((imageUrl) => imageUrl.trim().length > 0) ?? [];
  const heroMediaAssetIds = shop.customer_page_settings.hero_media_asset_ids?.filter(Boolean) ?? [];
  const heroDisplayImageUrl = heroImages[0] || heroImageUrl || "/images/customer-booking-hero-original.jpg";
  const hasCustomHeroImage = Boolean(heroImages[0] || heroImageUrl || heroMediaAssetIds[0]);
  const isUsingDefaultHeroImage = !hasCustomHeroImage;
  const previewShop = useMemo(
    () => ({
      ...shop,
      name: shopName.trim() || shop.name,
      customer_page_settings: {
        ...shop.customer_page_settings,
        shop_name: shopName.trim() || shop.customer_page_settings.shop_name,
        tagline: tagline.trim() || shop.customer_page_settings.tagline,
      },
    }),
    [shop, shopName, tagline],
  );
  const editableServices = useMemo(
    () => sortCustomerPageServices(services).map(toEditableService),
    [services],
  );
  const customerServiceOptions = useMemo(
    () => buildCustomerServiceSourceOptions(sortCustomerPageServices(services), { priceGuideOnly: true }),
    [services],
  );
  const customerServiceOverrides = useMemo(
    () => normalizeCustomerServiceOverrides(shop.customer_page_settings.customer_service_overrides),
    [shop.customer_page_settings.customer_service_overrides],
  );
  const customerServiceRows = useMemo(
    () => getCustomerServiceRows(customerServiceOptions, customerServiceOverrides),
    [customerServiceOptions, customerServiceOverrides],
  );
  const previewServices = useMemo(() => sortCustomerPageServices(services).filter((service) => service.is_active), [services]);

  function updateCustomerPageSettings(nextSettings: CustomerPageSettings) {
    const nextShop: Shop = {
      ...shop,
      customer_page_settings: nextSettings,
    };
    setShop(nextShop);
    onDataChange({ ...initialData, shop: nextShop, services });
  }

  function updateCustomerServiceOverridesLocal(nextOverrides: CustomerServiceDisplayOverrides) {
    updateCustomerPageSettings({
      ...shop.customer_page_settings,
      customer_service_overrides: nextOverrides,
    });
  }

  function updateCustomerServiceOption(option: CustomerServiceSourceOption, patch: CustomerServiceDisplayOverrides[string]) {
    const nextOverride = cleanCustomerServiceOverride(option, {
      ...(customerServiceOverrides[option.id] ?? {}),
      ...patch,
    });
    const nextOverrides = { ...customerServiceOverrides };
    if (Object.keys(nextOverride).length > 0) {
      nextOverrides[option.id] = nextOverride;
    } else {
      delete nextOverrides[option.id];
    }
    updateCustomerServiceOverridesLocal(nextOverrides);
    setOrderDirty(true);
  }

  function moveCustomerServiceOption(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= customerServiceRows.length) return;

    const reordered = customerServiceRows.slice();
    const [target] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, target);

    const nextOverrides = { ...customerServiceOverrides };
    reordered.forEach((row, rowIndex) => {
      const nextOverride = cleanCustomerServiceOverride(row.option, {
        ...(nextOverrides[row.option.id] ?? {}),
        order: rowIndex + 1,
      });
      if (Object.keys(nextOverride).length > 0) {
        nextOverrides[row.option.id] = nextOverride;
      } else {
        delete nextOverrides[row.option.id];
      }
    });
    updateCustomerServiceOverridesLocal(nextOverrides);
    setOrderDirty(true);
  }

  async function saveCustomerServiceOverrides(nextOverrides: CustomerServiceDisplayOverrides) {
    const savedShop = await fetchApiJsonWithAuth<{ shop: Shop }>("/api/owner/shops", {
      method: "PATCH",
      body: JSON.stringify({
        shopId: shop.id,
        customerServiceOverrides: nextOverrides,
      }),
    });
    const nextShop: Shop = {
      ...shop,
      customer_page_settings: {
        ...shop.customer_page_settings,
        ...savedShop.shop.customer_page_settings,
        customer_service_overrides: normalizeCustomerServiceOverrides(savedShop.shop.customer_page_settings.customer_service_overrides),
      },
    };
    setShop(nextShop);
    onDataChange({ ...initialData, shop: nextShop, services });
  }

  async function saveCustomerServiceOptionChanges(serviceKey = "customer-services") {
    setSavingServiceId(serviceKey);
    setMessage("");
    try {
      await saveCustomerServiceOverrides(customerServiceOverrides);
      setOrderDirty(false);
      setMessage("고객 예약페이지 서비스 메뉴가 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "고객 예약페이지 서비스 메뉴 저장에 실패했습니다.");
    } finally {
      setSavingServiceId(null);
    }
  }

  function updateService(serviceId: string | null, index: number, patch: Partial<EditableService>) {
    setServices((current) =>
      current.map((service, serviceIndex) => {
        const matches = serviceId ? service.id === serviceId : serviceIndex === index;
        if (!matches) return service;
        return {
          ...service,
          name: patch.name ?? service.name,
          description: patch.description ?? service.description,
          duration_minutes: patch.durationMinutes ?? service.duration_minutes,
          price: patch.price ?? service.price,
          is_active: patch.isActive ?? service.is_active,
          category: patch.category ?? service.category,
          sort_order: patch.sortOrder ?? service.sort_order,
        };
      }),
    );
  }

  function moveService(serviceId: string | null, direction: -1 | 1) {
    if (!serviceId) return;

    const orderedServices = sortCustomerPageServices(services);
    const currentIndex = orderedServices.findIndex((service) => service.id === serviceId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedServices.length) return;

    const nextOrderedServices = orderedServices.slice();
    const [targetService] = nextOrderedServices.splice(currentIndex, 1);
    nextOrderedServices.splice(nextIndex, 0, targetService);
    const nextSortOrders = new Map(nextOrderedServices.map((service, index) => [service.id, index + 1]));

    setServices((current) =>
      current.map((service) =>
        nextSortOrders.has(service.id)
          ? {
              ...service,
              sort_order: nextSortOrders.get(service.id) ?? service.sort_order,
            }
          : service,
      ),
    );
    setOrderDirty(true);
    setMessage("서비스 노출 순서가 변경되었습니다. 순서 저장을 눌러 반영해 주세요.");
  }

  function addService() {
    const now = new Date().toISOString();
    const nextService: Service = {
      id: `draft-${Date.now()}`,
      shop_id: shop.id,
      name: "새 서비스",
      description: "",
      price: 0,
      price_type: "starting",
      duration_minutes: 60,
      is_active: true,
      category: "미용",
      sort_order: sortCustomerPageServices(services).length + 1,
      capacity_label: "동일 시간 1건",
      staff_selection_mode: "all",
      price_guide: {},
      created_at: now,
      updated_at: now,
    };
    setServices((current) => [...current, nextService]);
  }

  async function saveHeroImage(heroImageUrl: string, heroMediaAssetId = "") {
    const nextSettings = {
      ...shop.customer_page_settings,
      shop_name: shopName.trim() || shop.customer_page_settings.shop_name || shop.name,
      tagline: tagline.trim() || shop.customer_page_settings.tagline,
      hero_image_url: heroImageUrl,
      hero_image_urls: heroImageUrl ? [heroImageUrl] : [],
      hero_media_asset_id: heroMediaAssetId,
      hero_media_asset_ids: heroMediaAssetId ? [heroMediaAssetId] : [],
    };
    const savedSettings = await fetchApiJsonWithAuth<CustomerPageSettings>("/api/customer-page-settings", {
      method: "PATCH",
      body: JSON.stringify({
        shopId: shop.id,
        customerPageSettings: nextSettings,
      }),
    });
    updateCustomerPageSettings(savedSettings);
  }

  async function handleHeroImageFile(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

      setUploadingHeroImage(true);
      setMessage("대표 사진을 업로드하고 있습니다.");
      try {
      const uploaded = await createOwnerShopProfileImageFromFile({ shopId: shop.id }, file);
      await saveHeroImage("", uploaded.mediaAsset.id);
      updateCustomerPageSettings({
        ...shop.customer_page_settings,
        hero_image_url: uploaded.signedUrl,
        hero_image_urls: [uploaded.signedUrl],
        hero_media_asset_id: uploaded.mediaAsset.id,
        hero_media_asset_ids: [uploaded.mediaAsset.id],
      });
      setMessage("대표 사진이 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "대표 사진 저장에 실패했습니다.");
    } finally {
      setUploadingHeroImage(false);
    }
  }

  async function removeHeroImage() {
    setUploadingHeroImage(true);
    setMessage("");
    try {
      await saveHeroImage("");
      setMessage("대표 사진을 삭제했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "대표 사진 삭제에 실패했습니다.");
    } finally {
      setUploadingHeroImage(false);
    }
  }

  async function saveShop() {
    if (!shopName.trim() || !tagline.trim()) {
      setMessage("매장명과 매장글을 입력해 주세요.");
      return;
    }

    setSavingShop(true);
    setMessage("");
    try {
      const result = await fetchApiJsonWithAuth<{ shop: Shop }>("/api/owner/shops", {
        method: "PATCH",
        body: JSON.stringify(buildShopPatch(shop, shopName, tagline)),
      });
      const nextShop: Shop = {
        ...shop,
        ...result.shop,
        business_hours: shop.business_hours,
        regular_closed_days: shop.regular_closed_days,
        regular_closed_cycle: shop.regular_closed_cycle,
        regular_closed_anchor_date: shop.regular_closed_anchor_date,
        temporary_closed_dates: shop.temporary_closed_dates,
        booking_slot_interval_minutes: shop.booking_slot_interval_minutes,
        booking_slot_offset_minutes: shop.booking_slot_offset_minutes,
        booking_available_start_time: shop.booking_available_start_time,
        booking_available_end_time: shop.booking_available_end_time,
        notification_settings: shop.notification_settings,
        customer_page_settings: {
          ...shop.customer_page_settings,
          ...result.shop.customer_page_settings,
          tagline: tagline.trim(),
        },
      };
      setShop(nextShop);
      onDataChange({ ...initialData, shop: nextShop, services });
      setMessage("예약페이지 정보가 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSavingShop(false);
    }
  }

  async function saveService(service: EditableService) {
    if (!service.name.trim()) {
      setMessage("서비스명을 입력해 주세요.");
      return;
    }

    const serviceKey = service.id ?? "new";
    setSavingServiceId(serviceKey);
    setMessage("");
    try {
      const isDraft = service.id?.startsWith("draft-");
      const savedService = await fetchApiJsonWithAuth<Service>("/api/services", {
        method: "POST",
        body: JSON.stringify(toServicePayload(shop.id, { ...service, id: isDraft ? null : service.id })),
      });
      const nextServices = mergeSavedService(
        services.filter((item) => item.id !== service.id),
        savedService,
      );
      setServices(nextServices);
      onDataChange({ ...initialData, shop, services: nextServices });
      setMessage("서비스 메뉴가 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "서비스 저장에 실패했습니다.");
    } finally {
      setSavingServiceId(null);
    }
  }

  async function saveServiceOrder() {
    const orderedServices = sortCustomerPageServices(services);

    if (orderedServices.some((service) => service.id.startsWith("draft-"))) {
      setMessage("새 서비스는 먼저 저장한 뒤 순서를 저장해 주세요.");
      return;
    }

    setSavingServiceId("order");
    setMessage("");
    try {
      const savedServices = await Promise.all(
        orderedServices.map((service, index) =>
          fetchApiJsonWithAuth<Service>("/api/services", {
            method: "POST",
            body: JSON.stringify(toServicePayload(shop.id, toEditableService({ ...service, sort_order: index + 1 }, index))),
          }),
        ),
      );
      const savedServiceMap = new Map(savedServices.map((service) => [service.id, service]));
      const nextServices = services.map((service) => savedServiceMap.get(service.id) ?? service);
      setServices(nextServices);
      onDataChange({ ...initialData, shop, services: nextServices });
      setOrderDirty(false);
      setMessage("서비스 노출 순서가 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "서비스 순서 저장에 실패했습니다.");
    } finally {
      setSavingServiceId(null);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <WebSurface className="p-5">
          <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] pb-4">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">예약 페이지 관리</h1>
              <p className="mt-1 text-[16px] text-[#64748b]">고객에게 보이는 예약페이지 정보를 관리합니다.</p>
            </div>
            <button
              type="button"
              onClick={() => void saveShop()}
              disabled={savingShop}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[8px] bg-[#2f7866] px-4 text-[15px] font-medium text-white disabled:bg-[#94a3b8]"
            >
              <Save className="h-4 w-4" />
              {savingShop ? "저장 중" : "저장"}
            </button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[16px] font-medium text-[#334155]">대표 사진</span>
                <span className="text-[13px] text-[#64748b]">고객 예약페이지와 동일</span>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-[#f8fafc]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroDisplayImageUrl} alt="고객 예약페이지 대표 사진" className="h-full w-full object-cover" />
                {isUsingDefaultHeroImage ? (
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[12px] font-medium text-[#64748b] shadow-sm">
                    기본 이미지
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => document.getElementById("customer-booking-hero-image-input")?.click()}
                  disabled={uploadingHeroImage}
                  className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#2f7866] px-3 text-[15px] font-medium text-white disabled:bg-[#94a3b8]"
                >
                  <ImagePlus className="h-4 w-4" />
                  {uploadingHeroImage ? "업로드 중" : hasCustomHeroImage ? "사진 변경" : "사진 업로드"}
                </button>
                {hasCustomHeroImage ? (
                  <button
                    type="button"
                    onClick={() => void removeHeroImage()}
                    disabled={uploadingHeroImage}
                    className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-medium text-[#64748b] disabled:opacity-45"
                  >
                    <Trash2 className="h-4 w-4" />
                    삭제
                  </button>
                ) : null}
              </div>
              <input
                id="customer-booking-hero-image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleHeroImageFile(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </div>

            <div className="grid min-w-0 content-start gap-4">
              <label className="block">
                <span className="text-[16px] font-medium text-[#334155]">매장명</span>
                <input
                  value={shopName}
                  onChange={(event) => setShopName(event.target.value)}
                  className="mt-2 h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] outline-none focus:border-[#2f7866]"
                />
              </label>
              <label className="block">
                <span className="text-[16px] font-medium text-[#334155]">매장글</span>
                <textarea
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value.slice(0, 120))}
                  className="mt-2 min-h-[106px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2.5 text-[16px] leading-6 outline-none focus:border-[#2f7866]"
                />
                <p className="mt-1 text-right text-[13px] text-[#64748b]">{tagline.length} / 120</p>
              </label>
            </div>
          </div>
        </WebSurface>

        <WebSurface className="p-5">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#2f7866]" />
            <h2 className="text-[18px] font-semibold text-[#111827]">영업시간</h2>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {businessHours.map((item) => (
              <div key={item.label} className="rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2">
                <p className="text-[14px] text-[#64748b]">{item.label}</p>
                <p className="mt-1 text-[16px] font-medium text-[#111827]">{item.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[14px] text-[#64748b]">영업시간 수정은 기존 운영 시간 데이터와 동일하게 반영됩니다.</p>
        </WebSurface>

        <WebSurface className="p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[18px] font-semibold text-[#111827]">서비스 메뉴 등록 및 수정</h2>
                <span className="rounded-full bg-[#edf7f3] px-2.5 py-1 text-[13px] font-medium text-[#2f7866]">
                  미리보기와 동일 순서
                </span>
              </div>
              <p className="mt-1 text-[15px] text-[#64748b]">
                고객 예약페이지에 보일 서비스명, 설명, 예상 시간, 시작 가격, 노출 여부를 관리합니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveCustomerServiceOptionChanges("order")}
                disabled={!orderDirty || savingServiceId === "order"}
                className="inline-flex h-10 items-center rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-medium text-[#334155] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {savingServiceId === "order" ? "저장 중" : "순서 저장"}
              </button>
              <button
                type="button"
                onClick={addService}
                className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#2f7866] px-3 text-[15px] font-medium text-white"
              >
                <Plus className="h-4 w-4" />
                서비스 추가
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[980px] overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-white">
              <div className="grid grid-cols-[92px_minmax(180px,1.2fr)_minmax(180px,1fr)_110px_130px_92px_88px] items-center gap-3 border-b border-[#e5e7eb] bg-[#f8fafc] px-3 py-2 text-[13px] font-medium text-[#64748b]">
                <span>순서</span>
                <span>서비스명</span>
                <span>고객 노출 설명</span>
                <span className="text-right">예상 시간</span>
                <span className="text-right">시작 가격</span>
                <span className="text-center">노출</span>
                <span className="text-center">저장</span>
              </div>
              <div className="divide-y divide-[#edf1f5]">
                {customerServiceRows.map((row, index) => (
                  <div
                    key={row.option.id}
                    className={`grid grid-cols-[92px_minmax(180px,1.2fr)_minmax(180px,1fr)_110px_130px_92px_88px] items-center gap-3 px-3 py-2.5 ${
                      row.visible ? "bg-white" : "bg-[#f8fafc]"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="w-7 text-center text-[14px] font-medium text-[#64748b]">{String(index + 1).padStart(2, "0")}</span>
                      <button
                        type="button"
                        onClick={() => moveCustomerServiceOption(index, -1)}
                        disabled={index === 0}
                        aria-label={`${row.displayName} 위로 이동`}
                        className="inline-flex h-8 w-7 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCustomerServiceOption(index, 1)}
                        disabled={index === customerServiceRows.length - 1}
                        aria-label={`${row.displayName} 아래로 이동`}
                        className="inline-flex h-8 w-7 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      value={row.displayName}
                      onChange={(event) => updateCustomerServiceOption(row.option, { displayName: event.target.value })}
                      className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] outline-none focus:border-[#2f7866]"
                    />
                    <input
                      value={row.description}
                      placeholder="고객에게 보일 짧은 설명"
                      onChange={(event) => updateCustomerServiceOption(row.option, { description: event.target.value })}
                      className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] outline-none focus:border-[#2f7866]"
                    />
                    <div className="relative">
                      <div className="flex h-10 w-full items-center justify-end rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[16px] text-[#334155]">
                        {row.option.durationMinutes}분
                      </div>
                    </div>
                    <div className="relative">
                      <div className="flex h-10 w-full items-center justify-end rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[16px] text-[#334155]">
                        {formatServicePrice(row.option.price, row.option.priceType)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateCustomerServiceOption(row.option, { visible: !row.visible })}
                      className={`h-10 rounded-[8px] border px-3 text-[15px] font-medium ${
                        row.visible ? "border-[#c8ded8] bg-[#edf7f3] text-[#2f7866]" : "border-[#dbe2ea] bg-white text-[#64748b]"
                      }`}
                    >
                      {row.visible ? "노출" : "숨김"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveCustomerServiceOptionChanges(row.option.id)}
                      disabled={savingServiceId === row.option.id}
                      className="h-10 rounded-[8px] bg-[#2f7866] px-3 text-[15px] font-medium text-white disabled:bg-[#94a3b8]"
                    >
                      저장
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </WebSurface>

        {message ? <p className="text-[15px] font-medium text-[#2f7866]">{message}</p> : null}
      </div>

      <WebSurface className="sticky top-[72px] flex h-[calc(100vh-96px)] flex-col overflow-hidden p-3">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <CustomerPagePhonePreview
            shop={previewShop}
            services={previewServices}
            staffMembers={initialData.staffMembers}
          />
        </div>
      </WebSurface>
    </div>
  );
}
