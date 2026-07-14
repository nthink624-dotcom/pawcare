import { decodeUnicodeEscapes } from "@/lib/utils";
import { normalizeCustomerServiceOverrides } from "@/lib/customer-service-options";
import type { CustomerDiscountCoupon, CustomerPageSettings } from "@/types/domain";

export const MAX_CUSTOMER_PAGE_HERO_IMAGES = 200;

export const defaultCustomerPageSettings: CustomerPageSettings = {
  shop_name: "",
  tagline: "우리 아이에게 맞는 미용 시간을 편하게 예약해 주세요.",
  hero_image_url: "",
  hero_image_urls: [],
  hero_media_asset_id: "",
  hero_media_asset_ids: [],
  showcase_title: "",
  showcase_body: "",
  social_links: {
    instagram_url: "",
    kakao_channel_url: "",
    naver_blog_url: "",
    tiktok_url: "",
    threads_url: "",
  },
  primary_color: "#1F6B5B",
  notices: ["첫 방문은 상담 포함으로 여유 있게 예약해 주세요.", "대기 시간이 길어질 수 있어 예약 시간 10분 전에 도착해 주세요.", "피부 예민한 아이는 메모에 꼭 남겨 주세요."],
  operating_hours_note: "월-토 10:00 - 19:00, 일요일 휴무",
  holiday_notice: "매주 일요일 휴무, 임시 휴무는 공지사항으로 안내드려요.",
  parking_notice: "건물 뒤편 공용 주차장을 이용해 주세요.",
  kakao_inquiry_url: "",
  show_notices: true,
  show_parking_notice: true,
  show_services: true,
  booking_button_label: "예약하기",
  show_kakao_inquiry: true,
  font_preset: "soft",
  font_scale: "comfortable",
  business_category: "애견미용",
  additional_contact: "",
  postal_code: "",
  address_detail: "",
  customer_service_overrides: {},
  discount_coupons: [],
};

function normalizeCouponText(value: unknown, maxLength: number) {
  return typeof value === "string" ? decodeUnicodeEscapes(value).trim().slice(0, maxLength) : "";
}

function normalizeCouponNumber(value: unknown, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0;
  return Math.min(max, Math.round(numberValue));
}

export function normalizeDiscountCoupons(value: unknown): CustomerDiscountCoupon[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 30)
    .flatMap((item, index): CustomerDiscountCoupon[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const source = item as Record<string, unknown>;
      const id = normalizeCouponText(source.id, 80) || `coupon-${index + 1}`;
      const name = normalizeCouponText(source.name, 40) || "할인 쿠폰";
      const ownerLabel = normalizeCouponText(source.owner_label, 40);
      const discountType = source.discount_type === "percent" || source.discount_type === "service" ? source.discount_type : "fixed";
      const discountValue = discountType === "service" ? 0 : normalizeCouponNumber(source.discount_value, discountType === "percent" ? 100 : 1_000_000);
      const serviceBenefitName = normalizeCouponText(source.service_benefit_name, 40);
      const audience =
        source.audience === "first_visit" || source.audience === "revisit" ? source.audience : "all";
      const combinationPolicy =
        source.combination_policy === "exclusive" || source.combination_policy === "stackable"
          ? source.combination_policy
          : audience === "first_visit" || audience === "revisit"
            ? "exclusive"
            : "stackable";
      const serviceScope = source.service_scope === "specific" ? "specific" : "all";
      const serviceOptionIds = Array.isArray(source.service_option_ids)
        ? source.service_option_ids
            .map((optionId) => normalizeCouponText(optionId, 180))
            .filter(Boolean)
            .slice(0, 50)
        : [];

      return [
        {
          id,
          name,
          owner_label: ownerLabel || name,
          enabled: source.enabled !== false,
          visible: true,
          discount_type: discountType,
          discount_value: discountValue,
          audience,
          combination_policy:
            discountType === "service"
              ? "stackable"
              : audience === "first_visit" || audience === "revisit"
                ? "exclusive"
                : combinationPolicy,
          service_benefit_name: discountType === "service" ? serviceBenefitName : "",
          service_scope: serviceScope,
          service_option_ids: serviceScope === "specific" ? serviceOptionIds : [],
          per_customer_limit: audience === "first_visit" ? true : source.per_customer_limit !== false,
          starts_at: normalizeCouponText(source.starts_at, 10),
          ends_at: normalizeCouponText(source.ends_at, 10),
        },
      ];
    });
}

export function buildDefaultCustomerPageSettings(input: {
  shopName: string;
  description?: string | null;
}): CustomerPageSettings {
  const shopName = input.shopName.trim();
  const description = input.description?.trim() || "";

  return normalizeCustomerPageSettings(
    {
      shop_name: shopName,
      tagline: description || defaultCustomerPageSettings.tagline,
    },
    shopName,
    description || defaultCustomerPageSettings.tagline,
  );
}

function normalizeColor(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : defaultCustomerPageSettings.primary_color;
}

function normalizeFontPreset(value: string | null | undefined): CustomerPageSettings["font_preset"] {
  return value === "clean" || value === "classic" ? value : "soft";
}

function normalizeFontScale(value: string | null | undefined): CustomerPageSettings["font_scale"] {
  return value === "compact" ? value : "comfortable";
}

function normalizeText(value: string | null | undefined, fallback: string) {
  const decoded = decodeUnicodeEscapes(value).trim();
  return decoded || fallback;
}

function normalizeOptionalText(value: string | null | undefined) {
  return decodeUnicodeEscapes(value).trim();
}

function normalizeHeroImageUrls(settings: Partial<CustomerPageSettings> | null | undefined) {
  const imageUrls = Array.isArray(settings?.hero_image_urls)
    ? settings.hero_image_urls.filter((imageUrl): imageUrl is string => typeof imageUrl === "string" && imageUrl.trim().length > 0)
    : [];
  const singleImageUrl = settings?.hero_image_url?.trim() || "";
  return (imageUrls.length > 0 ? imageUrls : singleImageUrl ? [singleImageUrl] : []).slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES);
}

function normalizeHeroMediaAssetIds(settings: Partial<CustomerPageSettings> | null | undefined) {
  const mediaAssetIds = Array.isArray(settings?.hero_media_asset_ids)
    ? settings.hero_media_asset_ids.filter((mediaAssetId): mediaAssetId is string => typeof mediaAssetId === "string" && mediaAssetId.trim().length > 0)
    : [];
  const singleMediaAssetId = settings?.hero_media_asset_id?.trim() || "";
  return (mediaAssetIds.length > 0 ? mediaAssetIds : singleMediaAssetId ? [singleMediaAssetId] : []).slice(0, MAX_CUSTOMER_PAGE_HERO_IMAGES);
}

function normalizeSocialLinks(settings: Partial<CustomerPageSettings> | null | undefined): NonNullable<CustomerPageSettings["social_links"]> {
  const links = settings?.social_links;
  return {
    instagram_url: normalizeOptionalText(links?.instagram_url),
    kakao_channel_url: normalizeOptionalText(links?.kakao_channel_url),
    naver_blog_url: normalizeOptionalText(links?.naver_blog_url),
    tiktok_url: normalizeOptionalText(links?.tiktok_url),
    threads_url: normalizeOptionalText(links?.threads_url),
  };
}

export function normalizeCustomerPageSettings(
  settings: Partial<CustomerPageSettings> | null | undefined,
  fallbackName?: string,
  fallbackTagline?: string,
): CustomerPageSettings {
  const heroImageUrls = normalizeHeroImageUrls(settings);
  const heroMediaAssetIds = normalizeHeroMediaAssetIds(settings);
  return {
    shop_name: normalizeText(settings?.shop_name, fallbackName || defaultCustomerPageSettings.shop_name),
    tagline: normalizeText(settings?.tagline, fallbackTagline || defaultCustomerPageSettings.tagline),
    hero_image_url: heroImageUrls[0] || "",
    hero_image_urls: heroImageUrls,
    hero_media_asset_id: heroMediaAssetIds[0] || "",
    hero_media_asset_ids: heroMediaAssetIds,
    showcase_title: normalizeOptionalText(settings?.showcase_title),
    showcase_body: normalizeOptionalText(settings?.showcase_body),
    social_links: normalizeSocialLinks(settings),
    primary_color: normalizeColor(settings?.primary_color),
    notices: settings?.notices
      ? Array.from({ length: 3 }, (_, index) => normalizeOptionalText(settings.notices?.[index]))
      : defaultCustomerPageSettings.notices,
    operating_hours_note: normalizeText(settings?.operating_hours_note, defaultCustomerPageSettings.operating_hours_note),
    holiday_notice: normalizeText(settings?.holiday_notice, defaultCustomerPageSettings.holiday_notice),
    parking_notice: settings && "parking_notice" in settings ? normalizeOptionalText(settings.parking_notice) : defaultCustomerPageSettings.parking_notice,
    kakao_inquiry_url: settings?.kakao_inquiry_url?.trim() || "",
    show_notices: settings?.show_notices ?? defaultCustomerPageSettings.show_notices,
    show_parking_notice: settings?.show_parking_notice ?? defaultCustomerPageSettings.show_parking_notice,
    show_services: settings?.show_services ?? defaultCustomerPageSettings.show_services,
    booking_button_label: normalizeText(settings?.booking_button_label, defaultCustomerPageSettings.booking_button_label),
    show_kakao_inquiry: settings?.show_kakao_inquiry ?? defaultCustomerPageSettings.show_kakao_inquiry,
    font_preset: normalizeFontPreset(settings?.font_preset),
    font_scale: normalizeFontScale(settings?.font_scale),
    business_category: normalizeText(settings?.business_category, defaultCustomerPageSettings.business_category || "애견미용"),
    additional_contact: normalizeOptionalText(settings?.additional_contact),
    postal_code: normalizeOptionalText(settings?.postal_code),
    address_detail: normalizeOptionalText(settings?.address_detail),
    customer_service_overrides: normalizeCustomerServiceOverrides(settings?.customer_service_overrides),
    discount_coupons: normalizeDiscountCoupons(settings?.discount_coupons),
  };
}
