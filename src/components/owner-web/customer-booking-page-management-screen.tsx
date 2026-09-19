"use client";

import { Clock, ImagePlus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CustomerPagePhonePreview } from "@/components/owner-web/customer-page-phone-preview";
import { WebSurface } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { MAX_CUSTOMER_PAGE_HERO_IMAGES } from "@/lib/customer-page-settings";
import { createOwnerShopProfileImageFromFile, getOwnerMediaSignedUrl } from "@/lib/media/owner-media-client";
import type { BootstrapPayload, CustomerPageSettings, Service, Shop } from "@/types/domain";

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function uniqueNonEmptyStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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
  const [message, setMessage] = useState("");

  useEffect(() => {
    setShop(initialData.shop);
    setServices(initialData.services);
    setShopName(initialData.shop.name);
    setTagline(initialData.shop.customer_page_settings.tagline || initialData.shop.description || "");
  }, [initialData]);

  const businessHours = useMemo(() => formatBusinessHours(shop), [shop]);
  const heroImageUrl = shop.customer_page_settings.hero_image_url.trim();
  const [resolvedHeroAssetUrls, setResolvedHeroAssetUrls] = useState<string[]>([]);
  const heroMediaAssetIds = useMemo(
    () => uniqueNonEmptyStrings(shop.customer_page_settings.hero_media_asset_ids ?? (shop.customer_page_settings.hero_media_asset_id ? [shop.customer_page_settings.hero_media_asset_id] : [])).slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES),
    [shop.customer_page_settings.hero_media_asset_id, shop.customer_page_settings.hero_media_asset_ids],
  );
  const heroImages = useMemo(
    () =>
      uniqueNonEmptyStrings([
        ...resolvedHeroAssetUrls,
        ...(shop.customer_page_settings.hero_image_urls ?? []),
      ]).slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES),
    [resolvedHeroAssetUrls, shop.customer_page_settings.hero_image_urls],
  );
  const heroDisplayImageUrl = heroImages[0] || heroImageUrl;
  const hasCustomHeroImage = Boolean(heroImages[0] || heroImageUrl || heroMediaAssetIds[0]);
  const previewShop = useMemo(
    () => ({
      ...shop,
      name: shopName.trim() || shop.name,
      customer_page_settings: {
        ...shop.customer_page_settings,
        shop_name: shopName.trim() || shop.customer_page_settings.shop_name,
        tagline: tagline.trim() || shop.customer_page_settings.tagline,
        hero_image_url: heroDisplayImageUrl,
        hero_image_urls: heroImages,
      },
    }),
    [heroDisplayImageUrl, heroImages, shop, shopName, tagline],
  );
  const previewServices = useMemo(() => sortCustomerPageServices(services).filter((service) => service.is_active), [services]);

  useEffect(() => {
    if (!heroMediaAssetIds.length) {
      setResolvedHeroAssetUrls([]);
      return;
    }

    let cancelled = false;
    void Promise.all(
      heroMediaAssetIds.map((mediaAssetId) =>
        getOwnerMediaSignedUrl(shop.id, mediaAssetId, "provider_ready").catch(() => ""),
      ),
    ).then((urls) => {
      if (!cancelled) {
        setResolvedHeroAssetUrls(urls.filter(Boolean));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [heroMediaAssetIds, shop.id]);

  function updateCustomerPageSettings(nextSettings: CustomerPageSettings) {
    const nextShop: Shop = {
      ...shop,
      customer_page_settings: nextSettings,
    };
    setShop(nextShop);
    onDataChange({ ...initialData, shop: nextShop, services });
  }

  async function saveHeroImage(heroImageUrl: string, heroMediaAssetId = "") {
    const currentHeroImageUrls = (shop.customer_page_settings.hero_image_urls ?? [])
      .filter((imageUrl): imageUrl is string => typeof imageUrl === "string" && imageUrl.trim().length > 0);
    const currentHeroMediaAssetIds = (shop.customer_page_settings.hero_media_asset_ids ?? [])
      .filter((mediaAssetId): mediaAssetId is string => typeof mediaAssetId === "string" && mediaAssetId.trim().length > 0);
    const nextHeroImageUrls = heroMediaAssetId
      ? currentHeroImageUrls.slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES)
      : heroImageUrl
        ? [...new Set([...currentHeroImageUrls, heroImageUrl])].slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES)
        : [];
    const nextHeroMediaAssetIds = heroMediaAssetId
      ? [...new Set([...currentHeroMediaAssetIds, heroMediaAssetId])].slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES)
      : [];
    const nextSettings = {
      ...shop.customer_page_settings,
      shop_name: shopName.trim() || shop.customer_page_settings.shop_name || shop.name,
      tagline: tagline.trim() || shop.customer_page_settings.tagline,
      hero_image_url: nextHeroImageUrls[0] ?? "",
      hero_image_urls: nextHeroImageUrls,
      hero_media_asset_id: nextHeroMediaAssetIds[0] ?? "",
      hero_media_asset_ids: nextHeroMediaAssetIds,
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
      const nextSignedUrls = [...new Set([...(shop.customer_page_settings.hero_image_urls ?? []), uploaded.signedUrl])]
        .filter(Boolean)
        .slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES);
      const nextAssetIds = [...new Set([...(shop.customer_page_settings.hero_media_asset_ids ?? []), uploaded.mediaAsset.id])]
        .filter(Boolean)
        .slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES);
      updateCustomerPageSettings({
        ...shop.customer_page_settings,
        hero_image_url: nextSignedUrls[0] ?? "",
        hero_image_urls: nextSignedUrls,
        hero_media_asset_id: nextAssetIds[0] ?? "",
        hero_media_asset_ids: nextAssetIds,
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

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <WebSurface className="p-5">
          <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] pb-4">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[#111827]">예약 페이지 관리</h1>
              <p className="mt-1 text-[16px] text-[#64748b]">고객에게 보이는 예약페이지 정보를 관리합니다.</p>
            </div>
            <button
              type="button"
              onClick={() => void saveShop()}
              disabled={savingShop}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[8px] bg-[#2f7866] px-4 text-[16px] font-medium leading-6 text-white disabled:bg-[#94a3b8]"
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
                {hasCustomHeroImage && heroDisplayImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={heroDisplayImageUrl} alt="고객 예약페이지 대표 사진" className="h-full w-full object-cover object-center" />
                  </>
                ) : (
                  <div className="flex h-full w-full items-end bg-[linear-gradient(135deg,#fff8f5_0%,#f7f9fc_58%,#eef4ff_100%)] p-4">
                    <span className="text-[18px] font-semibold text-[#241b18]">{shopName.trim() || shop.name}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => document.getElementById("customer-booking-hero-image-input")?.click()}
                  disabled={uploadingHeroImage}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[#2f7866] px-3 text-[16px] font-medium leading-6 text-white disabled:bg-[#94a3b8]"
                >
                  <ImagePlus className="h-4 w-4" />
                  {uploadingHeroImage ? "업로드 중" : hasCustomHeroImage ? "사진 변경" : "사진 업로드"}
                </button>
                {hasCustomHeroImage ? (
                  <button
                    type="button"
                    onClick={() => void removeHeroImage()}
                    disabled={uploadingHeroImage}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium leading-6 text-[#64748b] disabled:opacity-45"
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

        {message ? <p className="text-[14px] font-medium leading-5 text-[#2f7866]">{message}</p> : null}
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
