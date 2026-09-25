import { decodeUnicodeEscapes } from "@/lib/utils";
import type { CustomerPageSettings } from "@/types/domain";

export const defaultCustomerPageSettings: CustomerPageSettings = {
  shop_name: "포근한 발바닥 미용실",
  tagline: "부드럽고 편안한 돌봄으로 아이에게 맞는 미용 시간을 준비해요.",
  hero_image_url: "",
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
};

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

export function normalizeCustomerPageSettings(
  settings: Partial<CustomerPageSettings> | null | undefined,
  fallbackName?: string,
  fallbackTagline?: string,
): CustomerPageSettings {
  return {
    shop_name: normalizeText(settings?.shop_name, fallbackName || defaultCustomerPageSettings.shop_name),
    tagline: normalizeText(settings?.tagline, fallbackTagline || defaultCustomerPageSettings.tagline),
    hero_image_url: settings?.hero_image_url?.trim() || "",
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
  };
}
