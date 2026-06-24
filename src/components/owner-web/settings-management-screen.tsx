"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SettingsTabKey } from "@/components/owner-web/owner-web-data";
import { CustomerPagePreviewLayout } from "@/components/owner-web/customer-page-phone-preview";
import CustomerServiceExposurePanel from "@/components/owner-web/customer-service-exposure-panel";
import DiscountCouponEditor, { type DiscountCouponPreset } from "@/components/owner-web/discount-coupon-editor";
import OperatingHoursSettings from "@/components/owner-web/operating-hours-settings";
import OwnerProfileSettingsPanel from "@/components/owner-web/owner-profile-settings-panel";
import { WebSurface } from "@/components/owner-web/owner-web-ui";
import SettingsAlertsPanel, { type AlertSettingsDraft } from "@/components/owner-web/settings-alerts-panel";
import ShopInfoSettingsPanel from "@/components/owner-web/settings-shop-info-panel";
import { Switch } from "@/components/ui/switch";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { concurrentCapacityForApprovalMode } from "@/lib/booking-slot-settings";
import { normalizeDiscountCoupons } from "@/lib/customer-page-settings";
import {
  applyConfiguredCustomerServiceOverrides,
  buildCustomerServiceMenuConnectionOptions,
  buildCustomerServiceSourceOptions,
  normalizeCustomerServiceOverrides,
  type CustomerServiceDisplayOverrides,
  type CustomerServiceSourceOption,
} from "@/lib/customer-service-options";
import { createOwnerShopProfileImageFromFile } from "@/lib/media/owner-media-client";
import { normalizeShopNotificationSettings } from "@/lib/notification-settings";
import { cn } from "@/lib/utils";
import type { ApprovalMode, CustomerDiscountCoupon, OwnerProfile, ReservationPolicySettings, Service, Shop, ShopNotificationSettings } from "@/types/domain";

type SettingControl = "text" | "address" | "select" | "toggle" | "readonly" | "stepper" | "businessHours" | "closedDays";

type SettingRow = {
  id: string;
  label: string;
  value: string | boolean | number;
  description?: string;
  control: SettingControl;
  options?: string[];
  suffix?: string;
};

type SettingsTab = {
  key: SettingsTabKey;
  label: string;
  title: string;
  description: string;
  rows: SettingRow[];
};

type ShopProfilePatch = Pick<Shop, "name" | "phone" | "address" | "description"> & {
  showcaseTitle: string;
  showcaseBody: string;
  socialLinks: NonNullable<Shop["customer_page_settings"]["social_links"]>;
  businessCategory: string;
  additionalContact: string;
  postalCode: string;
  addressDetail: string;
};
type ShopPolicyPatch = {
  approvalMode: ApprovalMode;
  cancelWindow: ReservationPolicySettings["cancel_window"];
  pendingHoldLimit: 1;
};

function approvalModeLabel(value: ApprovalMode | null | undefined) {
  return value === "auto" ? "바로 승인" : "직접 승인";
}

function approvalModeFromLabel(value: string): ApprovalMode {
  return value === "바로 승인" || value === "auto" ? "auto" : "manual";
}

function cancelWindowLabel(value: ReservationPolicySettings["cancel_window"] | string | null | undefined) {
  switch (value) {
    case "none":
      return "불가";
    case "1h":
      return "예약 1시간 전까지";
    case "6h":
      return "예약 6시간 전까지";
    case "24h":
      return "예약 1일 전까지";
    case "2h":
    default:
      return "예약 2시간 전까지";
  }
}

function cancelWindowFromLabel(value: string): ReservationPolicySettings["cancel_window"] {
  if (value === "불가") return "none";
  if (value === "예약 1시간 전까지") return "1h";
  if (value === "예약 6시간 전까지") return "6h";
  if (value === "예약 하루 전까지" || value === "예약 1일 전까지") return "24h";
  return "2h";
}

function buildAlertSettingsDraft(settings: Partial<ShopNotificationSettings> | null | undefined): AlertSettingsDraft {
  const normalized = normalizeShopNotificationSettings(settings);
  return {
    enabled: normalized.enabled,
    alimtalkSenderMode: normalized.alimtalk_sender_mode,
    alimtalkShopChannelStatus: normalized.alimtalk_shop_channel_status,
    alimtalkShopChannelName: normalized.alimtalk_shop_channel_name ?? "",
    alimtalkShopChannelUrl: normalized.alimtalk_shop_channel_url ?? "",
    alimtalkSenderProfileKey: normalized.alimtalk_sender_profile_key ?? "",
    alimtalkChannelRequestedAt: normalized.alimtalk_channel_requested_at ?? null,
    alimtalkChannelAdminNote: normalized.alimtalk_channel_admin_note ?? "",
    alimtalkTemplateRequestNote: normalized.alimtalk_template_request_note ?? "",
    alimtalkTemplateRequestUpdatedAt: normalized.alimtalk_template_request_updated_at ?? null,
    revisitEnabled: normalized.revisit_enabled,
    bookingConfirmedEnabled: normalized.booking_confirmed_enabled,
    bookingRejectedEnabled: normalized.booking_rejected_enabled,
    bookingCancelledEnabled: normalized.booking_cancelled_enabled,
    bookingRescheduledEnabled: normalized.booking_rescheduled_enabled,
    appointmentReminder10mEnabled: normalized.appointment_reminder_10m_enabled,
    appointmentReminder10mMode: normalized.appointment_reminder_10m_mode,
    visitReminderOffsetMinutes: normalized.visit_reminder_offset_minutes,
    groomingStartedEnabled: normalized.grooming_started_enabled,
    groomingAlmostDoneEnabled: normalized.grooming_almost_done_enabled,
    pickupReadyEtaMinutes: normalized.pickup_ready_eta_minutes,
    groomingCompletedEnabled: normalized.grooming_completed_enabled,
    groomingStartWithoutPhotoEnabled: normalized.grooming_start_without_photo_enabled,
    groomingCompleteWithoutPhotoEnabled: normalized.grooming_complete_without_photo_enabled,
  };
}

function alertSettingsDraftToShopSettings(draft: AlertSettingsDraft): ShopNotificationSettings {
  return {
    enabled: draft.enabled,
    alimtalk_sender_mode: draft.alimtalkSenderMode,
    alimtalk_shop_channel_status: draft.alimtalkShopChannelStatus,
    alimtalk_shop_channel_name: draft.alimtalkShopChannelName,
    alimtalk_shop_channel_url: draft.alimtalkShopChannelUrl,
    alimtalk_sender_profile_key: draft.alimtalkSenderProfileKey,
    alimtalk_channel_requested_at: draft.alimtalkChannelRequestedAt,
    alimtalk_channel_admin_note: draft.alimtalkChannelAdminNote,
    alimtalk_template_request_note: draft.alimtalkTemplateRequestNote,
    alimtalk_template_request_updated_at: draft.alimtalkTemplateRequestUpdatedAt,
    revisit_enabled: draft.revisitEnabled,
    booking_confirmed_enabled: draft.bookingConfirmedEnabled,
    booking_rejected_enabled: draft.bookingRejectedEnabled,
    booking_cancelled_enabled: draft.bookingCancelledEnabled,
    booking_rescheduled_enabled: draft.bookingRescheduledEnabled,
    appointment_reminder_10m_enabled: draft.appointmentReminder10mEnabled,
    appointment_reminder_10m_mode: draft.appointmentReminder10mMode,
    visit_reminder_offset_minutes: draft.visitReminderOffsetMinutes,
    grooming_started_enabled: draft.groomingStartedEnabled,
    grooming_almost_done_enabled: draft.groomingAlmostDoneEnabled,
    pickup_ready_eta_minutes: draft.pickupReadyEtaMinutes,
    grooming_completed_enabled: draft.groomingCompletedEnabled,
    grooming_start_without_photo_enabled: draft.groomingStartWithoutPhotoEnabled,
    grooming_complete_without_photo_enabled: draft.groomingCompleteWithoutPhotoEnabled,
  };
}

const settingsTabs: Array<{ key: SettingsTabKey; label: string }> = [
  { key: "profile", label: "프로필" },
  { key: "shop", label: "매장 정보" },
  { key: "benefits", label: "혜택 관리" },
  { key: "alerts", label: "알림 설정" },
];

function createDiscountCouponDraft(index: number, preset: DiscountCouponPreset = "first_visit"): CustomerDiscountCoupon {
  const presets: Record<DiscountCouponPreset, Pick<CustomerDiscountCoupon, "name" | "discount_type" | "discount_value" | "audience" | "per_customer_limit">> = {
    first_visit: {
      name: "첫 방문 할인",
      discount_type: "fixed",
      discount_value: 10000,
      audience: "first_visit",
      per_customer_limit: true,
    },
    revisit: {
      name: "재방문 할인",
      discount_type: "percent",
      discount_value: 10,
      audience: "revisit",
      per_customer_limit: false,
    },
    all: {
      name: "전체 고객 할인",
      discount_type: "fixed",
      discount_value: 5000,
      audience: "all",
      per_customer_limit: false,
    },
    custom: {
      name: "기타 할인",
      discount_type: "fixed",
      discount_value: 5000,
      audience: "custom",
      per_customer_limit: false,
    },
  };
  const template = presets[preset];

  return {
    id: `coupon-${Date.now()}-${index}`,
    name: template.name,
    enabled: true,
    visible: true,
    discount_type: template.discount_type,
    discount_value: template.discount_value,
    audience: template.audience,
    service_scope: "all",
    service_option_ids: [],
    per_customer_limit: template.per_customer_limit,
    starts_at: "",
    ends_at: "",
  };
}

const initialSettings: Record<SettingsTabKey, SettingsTab> = {
  profile: {
    key: "profile",
    label: "프로필",
    title: "프로필",
    description: "",
    rows: [],
  },
  shop: {
    key: "shop",
    label: "매장 정보",
    title: "매장 정보",
    description: "고객에게 보여지는 매장 기본 정보와 예약 정책을 관리하세요.",
    rows: [
      {
        id: "shopName",
        label: "매장명",
        value: "매장명",
        description: "고객 예약 화면과 결제 화면에 노출되는 대표 이름",
        control: "text",
      },
      {
        id: "description",
        label: "매장 소개",
        value: "",
        description: "고객 예약 화면에 보여지는 짧은 소개",
        control: "text",
      },
      {
        id: "showcaseTitle",
        label: "자랑 제목",
        value: "",
        description: "고객 프런트에 보여줄 매장 강점 제목",
        control: "text",
      },
      {
        id: "showcaseBody",
        label: "자랑 문구",
        value: "",
        description: "고객 프런트에 보여줄 매장 강점 설명",
        control: "text",
      },
      {
        id: "instagramUrl",
        label: "인스타그램",
        value: "",
        description: "고객에게 노출할 인스타그램 링크",
        control: "text",
      },
      {
        id: "kakaoChannelUrl",
        label: "카카오 채널",
        value: "",
        description: "고객에게 노출할 카카오톡/채널 링크",
        control: "text",
      },
      {
        id: "naverBlogUrl",
        label: "네이버 블로그",
        value: "",
        description: "고객에게 노출할 네이버 블로그 링크",
        control: "text",
      },
      {
        id: "threadsUrl",
        label: "쓰레드",
        value: "",
        description: "고객에게 노출할 Threads 링크",
        control: "text",
      },
      {
        id: "businessCategory",
        label: "업종",
        value: "애견미용",
        description: "고객에게 표시되는 매장 업종",
        control: "select",
        options: ["애견미용"],
      },
      {
        id: "phone",
        label: "대표 연락처",
        value: "010-0000-0000",
        description: "고객 문의와 예약 확인에 사용하는 번호",
        control: "text",
      },
      {
        id: "additionalContact",
        label: "추가 연락처",
        value: "",
        description: "선택 입력",
        control: "text",
      },
      {
        id: "postalCode",
        label: "우편번호",
        value: "",
        description: "주소 검색으로 선택한 우편번호",
        control: "text",
      },
      {
        id: "address",
        label: "주소",
        value: "",
        description: "카카오 주소 검색으로 선택한 주소와 상세 주소를 합친 최종 노출 주소",
        control: "address",
      },
      {
        id: "addressDetail",
        label: "상세주소",
        value: "",
        description: "건물, 층, 호수 등 상세 위치",
        control: "text",
      },
      {
        id: "slotPolicy",
        label: "승인 방식",
        value: "같은 시간대 1건만 접수",
        description: "확정 예약과 승인대기 예약 모두 같은 시간 구간에 1건만 받을 수 있습니다.",
        control: "readonly",
      },
      {
        id: "approvalMode",
        label: "승인 방식",
        value: "직접 승인",
        description: "예약 요청 후 오너가 직접 확정하는 운영 방식",
        control: "select",
        options: ["직접 승인", "바로 승인"],
      },
      {
        id: "cancelWindow",
        label: "취소 허용 시간",
        value: "예약 2시간 전까지",
        description: "고객이 직접 변경/취소할 수 있는 범위",
        control: "select",
        options: ["예약 2시간 전까지", "예약 6시간 전까지", "예약 1일 전까지", "불가"],
      },
    ],
  },
  hours: {
    key: "hours",
    label: "운영 시간",
    title: "운영 시간",
    description: "예약 가능 시간과 휴무일 기준을 관리합니다.",
    rows: [
      {
        id: "businessHours",
        label: "전체 시간 설정",
        value: "10:00 - 19:00",
        description: "매장 기본 운영 시간을 오너가 직접 선택",
        control: "businessHours",
      },
      {
        id: "closedDay",
        label: "정기 휴무일",
        value: "일",
        description: "휴무일은 예약 가능한 날짜에서 자동 제외",
        control: "closedDays",
      },
    ],
  },
  benefits: {
    key: "benefits",
    label: "혜택 관리",
    title: "혜택 관리",
    description: "고객 예약 화면에 노출할 할인 혜택을 관리하세요.",
    rows: [],
  },
  alerts: {
    key: "alerts",
    label: "알림 설정",
    title: "알림 설정",
    description: "고객과 오너에게 발송되는 자동 안내 조건을 관리합니다.",
    rows: [
      {
        id: "alimtalkEnabled",
        label: "알림톡 전체 사용",
        value: true,
        description: "예약 확정, 취소, 픽업 준비, 완료 알림을 묶어서 관리",
        control: "toggle",
      },
      {
        id: "revisitEnabled",
        label: "재방문 안내",
        value: true,
        description: "주기 기준으로 고객에게 재방문 알림 발송",
        control: "toggle",
      },
      {
        id: "ownerAlertChannel",
        label: "운영자 알림",
        value: "카카오 채널 + 앱",
        description: "예약 요청과 변경 사항을 오너에게 즉시 전달",
        control: "select",
        options: ["앱만", "카카오 채널", "카카오 채널 + 앱"],
      },
    ],
  },
};

function cloneSettings(settings: Record<SettingsTabKey, SettingsTab>) {
  return Object.fromEntries(
    Object.entries(settings).map(([key, tab]) => [
      key,
      {
        ...tab,
        rows: tab.rows.map((row) => ({ ...row, options: row.options ? [...row.options] : undefined })),
      },
    ]),
  ) as Record<SettingsTabKey, SettingsTab>;
}

function applyShopToSettings(settings: Record<SettingsTabKey, SettingsTab>, shop?: Shop) {
  if (!shop) return settings;

  return {
    ...settings,
    shop: {
      ...settings.shop,
      rows: settings.shop.rows.map((row) => {
        if (row.id === "shopName") return { ...row, value: shop.name };
        if (row.id === "description") return { ...row, value: shop.description ?? "" };
        if (row.id === "showcaseTitle") return { ...row, value: shop.customer_page_settings.showcase_title || "" };
        if (row.id === "showcaseBody") return { ...row, value: shop.customer_page_settings.showcase_body || "" };
        if (row.id === "instagramUrl") return { ...row, value: shop.customer_page_settings.social_links?.instagram_url || "" };
        if (row.id === "kakaoChannelUrl") return { ...row, value: shop.customer_page_settings.social_links?.kakao_channel_url || "" };
        if (row.id === "naverBlogUrl") return { ...row, value: shop.customer_page_settings.social_links?.naver_blog_url || "" };
        if (row.id === "threadsUrl") return { ...row, value: shop.customer_page_settings.social_links?.threads_url || "" };
        if (row.id === "businessCategory") return { ...row, value: shop.customer_page_settings.business_category || "애견미용" };
        if (row.id === "phone") return { ...row, value: shop.phone };
        if (row.id === "additionalContact") return { ...row, value: shop.customer_page_settings.additional_contact || "" };
        if (row.id === "postalCode") return { ...row, value: shop.customer_page_settings.postal_code || "" };
        if (row.id === "address") return { ...row, value: shop.address };
        if (row.id === "addressDetail") return { ...row, value: shop.customer_page_settings.address_detail || "" };
        if (row.id === "approvalMode") return { ...row, value: approvalModeLabel(shop.approval_mode) };
        if (row.id === "cancelWindow") {
          return { ...row, value: cancelWindowLabel(shop.reservation_policy_settings?.cancel_window) };
        }
        return row;
      }),
    },
  };
}

const ownerWebSettingsStorageKey = "petmanager.ownerWeb.settings";
const ownerWebShopProfileImageStorageKey = "petmanager.ownerWeb.shopProfileImage";
const ownerWebShopProfileImagesStorageKey = "petmanager.ownerWeb.shopProfileImages";
const ownerWebShopProfileImagesStorageLimit = 900_000;
const ownerWebShopProfileImagesMaxCount = 10;

function normalizeShopProfileImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((imageUrl): imageUrl is string => typeof imageUrl === "string" && imageUrl.length > 0).slice(0, ownerWebShopProfileImagesMaxCount);
}

function isLocalPreviewImageUrl(imageUrl: string) {
  return imageUrl.startsWith("data:");
}

function isRemotePersistableImageUrl(imageUrl: string) {
  return !isLocalPreviewImageUrl(imageUrl) && imageUrl.length <= 2000;
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function shouldFallbackToLocalProfileImage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("R2_ACCOUNT_ID") ||
    message.includes("media storage") ||
    message.includes("storage") ||
    message.includes("Supabase 서버 설정")
  );
}

function mergeSettingsWithDefaults(savedSettings: unknown, shop?: Shop) {
  const nextSettings = applyShopToSettings(cloneSettings(initialSettings), shop);

  if (!savedSettings || typeof savedSettings !== "object") return nextSettings;

  for (const [tabKey, savedTab] of Object.entries(savedSettings)) {
    if (shop && tabKey === "shop") continue;
    if (!(tabKey in nextSettings) || !savedTab || typeof savedTab !== "object") continue;
    const rows = (savedTab as { rows?: unknown }).rows;
    if (!Array.isArray(rows)) continue;

    nextSettings[tabKey as SettingsTabKey] = {
      ...nextSettings[tabKey as SettingsTabKey],
      rows: nextSettings[tabKey as SettingsTabKey].rows.map((row) => {
        const savedRow = rows.find(
          (item): item is { id: string; value: SettingRow["value"] } =>
            Boolean(item) &&
            typeof item === "object" &&
            "id" in item &&
            (item as { id: unknown }).id === row.id &&
            "value" in item,
        );

        if (!savedRow) return row;
        const valueType = typeof savedRow.value;
        if (valueType !== "string" && valueType !== "boolean" && valueType !== "number") return row;
        return { ...row, value: savedRow.value };
      }),
    };
  }

  return nextSettings;
}

function readShopProfileFromSettings(settings: Record<SettingsTabKey, SettingsTab>): ShopProfilePatch {
  const rows = settings.shop.rows;
  return {
    name: String(rows.find((row) => row.id === "shopName")?.value ?? "").trim(),
    phone: String(rows.find((row) => row.id === "phone")?.value ?? "").trim(),
    address: String(rows.find((row) => row.id === "address")?.value ?? "").trim(),
    description: String(rows.find((row) => row.id === "description")?.value ?? "").trim(),
    showcaseTitle: String(rows.find((row) => row.id === "showcaseTitle")?.value ?? "").trim(),
    showcaseBody: String(rows.find((row) => row.id === "showcaseBody")?.value ?? "").trim(),
    socialLinks: {
      instagram_url: String(rows.find((row) => row.id === "instagramUrl")?.value ?? "").trim(),
      kakao_channel_url: String(rows.find((row) => row.id === "kakaoChannelUrl")?.value ?? "").trim(),
      naver_blog_url: String(rows.find((row) => row.id === "naverBlogUrl")?.value ?? "").trim(),
      tiktok_url: "",
      threads_url: String(rows.find((row) => row.id === "threadsUrl")?.value ?? "").trim(),
    },
    businessCategory: String(rows.find((row) => row.id === "businessCategory")?.value ?? "").trim(),
    additionalContact: String(rows.find((row) => row.id === "additionalContact")?.value ?? "").trim(),
    postalCode: String(rows.find((row) => row.id === "postalCode")?.value ?? "").trim(),
    addressDetail: String(rows.find((row) => row.id === "addressDetail")?.value ?? "").trim(),
  };
}

function readShopPolicyFromSettings(settings: Record<SettingsTabKey, SettingsTab>): ShopPolicyPatch {
  const rows = settings.shop.rows;
  return {
    approvalMode: approvalModeFromLabel(String(rows.find((row) => row.id === "approvalMode")?.value ?? "")),
    cancelWindow: cancelWindowFromLabel(String(rows.find((row) => row.id === "cancelWindow")?.value ?? "")),
    pendingHoldLimit: 1,
  };
}

function mergeCustomerPageSettings(
  current: Shop["customer_page_settings"],
  incoming: Partial<Shop["customer_page_settings"]> | null | undefined,
): Shop["customer_page_settings"] {
  if (!incoming) return current;
  return {
    ...current,
    ...incoming,
    social_links: {
      ...(current.social_links ?? {}),
      ...(incoming.social_links ?? {}),
    },
    customer_service_overrides: {
      ...(current.customer_service_overrides ?? {}),
      ...(incoming.customer_service_overrides ?? {}),
    },
    discount_coupons: incoming.discount_coupons ?? current.discount_coupons,
  };
}

function buildServicePayload(shopId: string, service: Service, priceGuide: unknown = service.price_guide) {
  return {
    shopId,
    serviceId: service.id,
    name: service.name,
    description: service.description ?? "",
    price: service.price,
    priceType: service.price_type ?? "starting",
    durationMinutes: service.duration_minutes,
    isActive: service.is_active,
    category: service.category ?? "미용",
    sortOrder: service.sort_order ?? 1,
    capacityLabel: service.capacity_label ?? "동일 시간 1건",
    staffSelectionMode: service.staff_selection_mode ?? "all",
    priceGuide,
  };
}

function optionItemId(option: CustomerServiceSourceOption) {
  return option.id.includes(":") ? option.id.split(":").slice(1).join(":") : option.id;
}

function buildCustomerServiceOverrideBaseline(
  options: CustomerServiceSourceOption[],
  overrides: CustomerServiceDisplayOverrides,
) {
  const normalizedOverrides = normalizeCustomerServiceOverrides(overrides);

  const baseline = Object.fromEntries(
    options.map((option) => [
      option.id,
      {
        visible: true,
        order: option.order,
        displayName: option.sourceName,
        description: option.description,
        linkedOptionId: option.linkedOptionId ?? option.id,
      },
    ]),
  ) satisfies CustomerServiceDisplayOverrides;

  return {
    ...baseline,
    ...normalizedOverrides,
  };
}

function createCustomerServiceMenuRowId() {
  return `menu-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function removeOptionFromPriceGuide(priceGuide: unknown, option: CustomerServiceSourceOption) {
  if (!priceGuide || typeof priceGuide !== "object" || Array.isArray(priceGuide)) return priceGuide;
  const source = priceGuide as Record<string, unknown>;
  if (!Array.isArray(source.sections)) return priceGuide;
  const targetId = optionItemId(option);

  return {
    ...source,
    sections: source.sections.map((section) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) return section;
      const sectionRecord = section as Record<string, unknown>;
      if (!Array.isArray(sectionRecord.items)) return section;
      return {
        ...sectionRecord,
        items: sectionRecord.items.filter((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return true;
          const itemRecord = item as { id?: unknown; label?: unknown };
          const itemId = String(itemRecord.id ?? itemRecord.label ?? "");
          const itemLabel = String(itemRecord.label ?? "");
          return itemId !== targetId && itemLabel !== option.sourceName;
        }),
      };
    }),
  };
}

function renameOptionInPriceGuide(priceGuide: unknown, option: CustomerServiceSourceOption, nextName: string) {
  if (!priceGuide || typeof priceGuide !== "object" || Array.isArray(priceGuide)) return priceGuide;
  const source = priceGuide as Record<string, unknown>;
  if (!Array.isArray(source.sections)) return priceGuide;
  const targetId = optionItemId(option);

  return {
    ...source,
    sections: source.sections.map((section) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) return section;
      const sectionRecord = section as Record<string, unknown>;
      if (!Array.isArray(sectionRecord.items)) return section;
      return {
        ...sectionRecord,
        items: sectionRecord.items.map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return item;
          const itemRecord = item as { id?: unknown; label?: unknown };
          const itemId = String(itemRecord.id ?? itemRecord.label ?? "");
          const itemLabel = String(itemRecord.label ?? "");
          if (itemId !== targetId && itemLabel !== option.sourceName) return item;
          return { ...itemRecord, label: nextName };
        }),
      };
    }),
  };
}

function focusEditableControl(rowId: string) {
  const element = document.getElementById(`setting-control-${rowId}`) as HTMLElement | null;
  element?.focus();
}

const weekdayClosedOptions = ["월", "화", "수", "목", "금", "토", "일"] as const;

function parseBusinessHoursValue(value: SettingRow["value"]) {
  const text = String(value);
  const [open = "10:00", close = "19:00"] = text.split("-").map((item) => item.trim());
  return { open, close };
}

function parseClosedDayValue(value: SettingRow["value"]) {
  const text = String(value).trim();
  if (!text || text === "없음") return [];
  return text
    .replaceAll("매주", "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is (typeof weekdayClosedOptions)[number] =>
      weekdayClosedOptions.includes(item as (typeof weekdayClosedOptions)[number]),
    );
}

function formatClosedDayValue(days: string[]) {
  return days.length > 0 ? days.join(", ") : "없음";
}

function SettingSelectControl({
  row,
  onChange,
}: {
  row: SettingRow;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const value = String(row.value);
  const options = row.options ?? [];

  return (
    <div
      className="relative inline-block min-w-[210px] text-left"
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null;
        if (!nextFocus || !event.currentTarget.contains(nextFocus)) {
          setOpen(false);
        }
      }}
    >
      <button
        id={`setting-control-${row.id}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-3 rounded-[10px] border bg-white px-3 text-[14px] font-medium text-[#111827] outline-none transition",
          open ? "border-[#1f6b5b] shadow-[0_0_0_3px_rgba(31,107,91,0.08)]" : "border-[#dbe2ea] hover:border-[#bfd3cb]",
        )}
      >
        <span className="min-w-0 truncate text-left">{value}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#64748b] transition", open && "rotate-180 text-[#1f6b5b]")} />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-max min-w-full overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-white p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-9 w-full items-center justify-between gap-4 rounded-[8px] px-3 text-left text-[14px] transition",
                  selected ? "bg-[#edf7f3] font-semibold text-[#1f6b5b]" : "text-[#334155] hover:bg-[#f8fafc]",
                )}
              >
                <span className="whitespace-nowrap">{option}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SettingValueControl({
  row,
  onChange,
  onCommit,
  onOpenAddressSearch,
}: {
  row: SettingRow;
  onChange: (value: SettingRow["value"]) => void;
  onCommit?: (value: SettingRow["value"]) => void;
  onOpenAddressSearch: () => void;
}) {
  if (row.control === "toggle") {
    return (
      <span
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Switch
          checked={Boolean(row.value)}
          size="lg"
          aria-label={row.label}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </span>
    );
  }

  if (row.control === "address") {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenAddressSearch();
        }}
        className="flex min-h-10 w-full min-w-[360px] max-w-[620px] items-center justify-end gap-3 rounded-[8px] border border-transparent bg-transparent px-3 py-2 text-right text-[15px] font-medium text-[#111827] transition hover:border-[#dbe2ea] hover:bg-white focus:border-[#1f6b5b] focus:bg-white focus:outline-none"
      >
        <span className="line-clamp-2 min-w-0 break-words">{String(row.value) || "주소 검색으로 매장 주소를 선택해 주세요"}</span>
        <span className="shrink-0 text-[13px] font-semibold text-[#1f6b5b]">주소 검색</span>
      </button>
    );
  }

  if (row.control === "businessHours") {
    const { open, close } = parseBusinessHoursValue(row.value);
    const updateTime = (next: { open?: string; close?: string }) => {
      onChange(`${next.open ?? open} - ${next.close ?? close}`);
    };

    return (
      <div className="flex flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        <label className="min-w-[132px]">
          <span className="mb-1 block text-left text-[12px] font-medium text-[#64748b]">시작</span>
          <input
            id={`setting-control-${row.id}`}
            type="time"
            value={open}
            onChange={(event) => updateTime({ open: event.target.value })}
            className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-semibold text-[#111827] outline-none transition focus:border-[#1f6b5b] focus:ring-2 focus:ring-[#1f6b5b]/10"
          />
        </label>
        <label className="min-w-[132px]">
          <span className="mb-1 block text-left text-[12px] font-medium text-[#64748b]">종료</span>
          <input
            type="time"
            value={close}
            onChange={(event) => updateTime({ close: event.target.value })}
            className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-semibold text-[#111827] outline-none transition focus:border-[#1f6b5b] focus:ring-2 focus:ring-[#1f6b5b]/10"
          />
        </label>
      </div>
    );
  }

  if (row.control === "closedDays") {
    const closedDays = parseClosedDayValue(row.value);
    return (
      <div className="flex max-w-[420px] flex-wrap justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
        {weekdayClosedOptions.map((day) => {
          const active = closedDays.includes(day);
          return (
            <button
              key={day}
              id={day === "월" ? `setting-control-${row.id}` : undefined}
              type="button"
              onClick={() => {
                const nextDays = active ? closedDays.filter((item) => item !== day) : [...closedDays, day];
                onChange(formatClosedDayValue(weekdayClosedOptions.filter((item) => nextDays.includes(item))));
              }}
              className={cn(
                "inline-flex h-10 min-w-12 items-center justify-center rounded-[8px] border px-3 text-[14px] font-medium transition",
                active
                  ? "border-[#a04455] bg-[#fff7f8] text-[#8f2438]"
                  : "border-[#dbe2ea] bg-white text-[#334155] hover:bg-[#f8fafc]",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    );
  }

  if (row.control === "select") {
    return <SettingSelectControl row={row} onChange={(value) => onChange(value)} />;
  }

  if (row.control === "stepper") {
    const value = Number(row.value);
    return (
      <div className="inline-flex h-10 items-center rounded-[8px] border border-[#dbe2ea] bg-white" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-full w-9 text-[18px] font-medium text-[#64748b] hover:bg-[#f8fafc]"
        >
          -
        </button>
        <span className="min-w-[62px] px-2 text-center text-[14px] font-semibold text-[#111827]">
          {value}
          {row.suffix}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="h-full w-9 text-[18px] font-medium text-[#64748b] hover:bg-[#f8fafc]"
        >
          +
        </button>
      </div>
    );
  }

  if (row.control === "text") {
    return (
      <input
        id={`setting-control-${row.id}`}
        value={String(row.value)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onCommit?.(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        className="h-10 w-full min-w-[280px] max-w-[520px] rounded-[8px] border border-transparent bg-transparent px-3 text-right text-[15px] font-medium text-[#111827] outline-none transition hover:border-[#dbe2ea] hover:bg-white focus:border-[#1f6b5b] focus:bg-white"
      />
    );
  }

  return <p className="text-[15px] font-medium text-[#111827]">{String(row.value)}</p>;
}

export default function SettingsManagementScreen({
  activeTab: controlledActiveTab,
  onActiveTabChange,
  showTabNavigation = true,
  shop,
  services = [],
  ownerProfile,
  onShopChange,
  onOwnerProfileChange,
  onServicesChange,
  persistShopProfile = true,
  manualApprovalEnabled,
  onManualApprovalChange,
  automaticVisitReminderAvailable = true,
}: {
  activeTab?: SettingsTabKey;
  onActiveTabChange?: (tab: SettingsTabKey) => void;
  showTabNavigation?: boolean;
  shop?: Shop;
  services?: Service[];
  ownerProfile?: OwnerProfile | null;
  onShopChange?: (shop: Shop) => void;
  onOwnerProfileChange?: (profile: OwnerProfile) => void;
  onServicesChange?: (services: Service[]) => void;
  persistShopProfile?: boolean;
  manualApprovalEnabled?: boolean;
  onManualApprovalChange?: (enabled: boolean) => void;
  automaticVisitReminderAvailable?: boolean;
}) {
  const [internalActiveTab, setInternalActiveTab] = useState<SettingsTabKey>("shop");
  const [draftSettings, setDraftSettings] = useState(() => applyShopToSettings(cloneSettings(initialSettings), shop));
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [shopProfileImages, setShopProfileImages] = useState<string[]>([]);
  const [shopProfileImageAssetIds, setShopProfileImageAssetIds] = useState<string[]>([]);
  const [isShopInfoDirty, setIsShopInfoDirty] = useState(false);
  const [savingShopInfo, setSavingShopInfo] = useState(false);
  const [shopInfoFeedback, setShopInfoFeedback] = useState("");
  const [alertSettings, setAlertSettings] = useState<AlertSettingsDraft>(() => buildAlertSettingsDraft(shop?.notification_settings));
  const [customerServiceOverrides, setCustomerServiceOverrides] = useState<CustomerServiceDisplayOverrides>(() =>
    normalizeCustomerServiceOverrides(shop?.customer_page_settings.customer_service_overrides),
  );
  const [customerServiceActionId, setCustomerServiceActionId] = useState<string | null>(null);
  const [, setCustomerServiceSaveStatus] = useState<"idle" | "pending" | "saved" | "error">("saved");
  const [discountCouponDrafts, setDiscountCouponDrafts] = useState<CustomerDiscountCoupon[]>(() =>
    normalizeDiscountCoupons(shop?.customer_page_settings.discount_coupons),
  );
  const [savedDiscountCoupons, setSavedDiscountCoupons] = useState<CustomerDiscountCoupon[]>(() =>
    normalizeDiscountCoupons(shop?.customer_page_settings.discount_coupons),
  );
  const [discountCouponSaveStatus, setDiscountCouponSaveStatus] = useState<"idle" | "pending" | "saved" | "error">("saved");
  const [saveCompleteVisible, setSaveCompleteVisible] = useState(false);
  const alertAutoSaveSeqRef = useRef(0);
  const customerServiceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isShopInfoDirty || savingShopInfo || addressSheetOpen) {
      return;
    }

    try {
      const storedSettings = window.localStorage.getItem(ownerWebSettingsStorageKey);
      const storedProfileImages = window.localStorage.getItem(ownerWebShopProfileImagesStorageKey);
      const storedProfileImage = window.localStorage.getItem(ownerWebShopProfileImageStorageKey);
      const frame = window.requestAnimationFrame(() => {
        if (storedSettings) {
          const nextSettings = mergeSettingsWithDefaults(JSON.parse(storedSettings), shop);
          setDraftSettings(cloneSettings(nextSettings));
        }

        if (storedProfileImages) {
          setShopProfileImages(normalizeShopProfileImages(JSON.parse(storedProfileImages)));
        } else if (storedProfileImage) {
          setShopProfileImages([storedProfileImage]);
        } else if (shop?.customer_page_settings.hero_image_urls?.length) {
          setShopProfileImages(normalizeShopProfileImages(shop.customer_page_settings.hero_image_urls));
        } else if (shop?.customer_page_settings.hero_image_url) {
          setShopProfileImages([shop.customer_page_settings.hero_image_url]);
        }
        setShopProfileImageAssetIds((shop?.customer_page_settings.hero_media_asset_ids ?? []).filter(Boolean).slice(0, 10));
      });
      setIsShopInfoDirty(false);
      setAlertSettings(buildAlertSettingsDraft(shop?.notification_settings));
      return () => window.cancelAnimationFrame(frame);
    } catch {
      window.localStorage.removeItem(ownerWebSettingsStorageKey);
      window.localStorage.removeItem(ownerWebShopProfileImagesStorageKey);
      window.localStorage.removeItem(ownerWebShopProfileImageStorageKey);
    }
  }, [addressSheetOpen, isShopInfoDirty, savingShopInfo, shop]);

  useEffect(() => {
    return () => {
      if (saveCompleteTimerRef.current) {
        clearTimeout(saveCompleteTimerRef.current);
      }
      if (customerServiceSaveTimerRef.current) {
        clearTimeout(customerServiceSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextOverrides = normalizeCustomerServiceOverrides(shop?.customer_page_settings.customer_service_overrides);
    setCustomerServiceOverrides((currentOverrides) =>
      JSON.stringify(currentOverrides) === JSON.stringify(nextOverrides) ? currentOverrides : nextOverrides,
    );
    setCustomerServiceSaveStatus((currentStatus) => (currentStatus === "pending" ? currentStatus : "saved"));
  }, [shop?.id, shop?.customer_page_settings.customer_service_overrides]);

  useEffect(() => {
    const nextCoupons = normalizeDiscountCoupons(shop?.customer_page_settings.discount_coupons);
    setSavedDiscountCoupons(nextCoupons);
    setDiscountCouponDrafts(nextCoupons);
    setDiscountCouponSaveStatus("saved");
  }, [shop?.id, shop?.customer_page_settings.discount_coupons]);

  const activeTab = controlledActiveTab ?? internalActiveTab;
  const current = useMemo(() => {
    return draftSettings[activeTab] ?? initialSettings[activeTab];
  }, [activeTab, draftSettings]);
  const rawCustomerServiceConnectionOptions = useMemo(() => buildCustomerServiceSourceOptions(services, { priceGuideOnly: true }), [services]);
  const customerServiceConnectionOptions = useMemo(
    () => buildCustomerServiceMenuConnectionOptions(rawCustomerServiceConnectionOptions),
    [rawCustomerServiceConnectionOptions],
  );
  const customerServiceOptions = useMemo(
    () => applyConfiguredCustomerServiceOverrides(rawCustomerServiceConnectionOptions, customerServiceOverrides),
    [rawCustomerServiceConnectionOptions, customerServiceOverrides],
  );
  const discountCoupons = discountCouponDrafts;
  const customerPagePreviewShop = useMemo<Shop | null>(() => {
    if (!shop) return null;
    return {
      ...shop,
      customer_page_settings: {
        ...shop.customer_page_settings,
        customer_service_overrides: customerServiceOverrides,
        discount_coupons: discountCoupons,
      },
    };
  }, [customerServiceOverrides, discountCoupons, shop]);
  const discountCouponsDirty = useMemo(
    () => JSON.stringify(discountCouponDrafts) !== JSON.stringify(savedDiscountCoupons),
    [discountCouponDrafts, savedDiscountCoupons],
  );

  async function saveShopSettings(
    settings: Record<SettingsTabKey, SettingsTab>,
    options: { profile?: boolean; policy?: boolean },
  ) {
    if (!shop) return;

    const profilePatch = options.profile ? readShopProfileFromSettings(settings) : {};
    const policyPatch = options.policy ? readShopPolicyFromSettings(settings) : null;
    const profileName = "name" in profilePatch && typeof profilePatch.name === "string" ? profilePatch.name : "";
    const businessCategory =
      "businessCategory" in profilePatch && typeof profilePatch.businessCategory === "string" ? profilePatch.businessCategory : "";
    const additionalContact =
      "additionalContact" in profilePatch && typeof profilePatch.additionalContact === "string" ? profilePatch.additionalContact : "";
    const showcaseTitle = "showcaseTitle" in profilePatch && typeof profilePatch.showcaseTitle === "string" ? profilePatch.showcaseTitle : "";
    const showcaseBody = "showcaseBody" in profilePatch && typeof profilePatch.showcaseBody === "string" ? profilePatch.showcaseBody : "";
    const socialLinks = "socialLinks" in profilePatch && profilePatch.socialLinks ? profilePatch.socialLinks : {};
    const postalCode = "postalCode" in profilePatch && typeof profilePatch.postalCode === "string" ? profilePatch.postalCode : "";
    const addressDetail =
      "addressDetail" in profilePatch && typeof profilePatch.addressDetail === "string" ? profilePatch.addressDetail : "";
    const heroImageUrls = normalizeShopProfileImages(shopProfileImages);
    const heroMediaAssetIds = shopProfileImageAssetIds.filter(Boolean).slice(0, heroImageUrls.length || 10);
    const persistentHeroImageUrls = heroMediaAssetIds.length > 0 ? [] : heroImageUrls.filter(isRemotePersistableImageUrl);
    const heroImageUrl = heroImageUrls[0] ?? "";
    const persistentHeroImageUrl = persistentHeroImageUrls[0] ?? "";
    const tagline = "description" in profilePatch && typeof profilePatch.description === "string" ? profilePatch.description : "";
    const optimisticShop: Shop = {
      ...shop,
      ...profilePatch,
      ...(policyPatch
        ? {
            approval_mode: policyPatch.approvalMode,
            concurrent_capacity: concurrentCapacityForApprovalMode(policyPatch.approvalMode),
            reservation_policy_settings: {
              ...shop.reservation_policy_settings,
              cancel_window: policyPatch.cancelWindow,
              customer_change_enabled: policyPatch.cancelWindow !== "none",
              pending_hold_limit: policyPatch.pendingHoldLimit,
            },
          }
        : {}),
      customer_page_settings: {
        ...shop.customer_page_settings,
        shop_name: profileName || shop.customer_page_settings.shop_name,
        tagline,
        showcase_title: showcaseTitle,
        showcase_body: showcaseBody,
        social_links: socialLinks,
        hero_image_url: heroImageUrl,
        hero_image_urls: heroImageUrls,
        hero_media_asset_id: heroMediaAssetIds[0] ?? "",
        hero_media_asset_ids: heroMediaAssetIds,
        business_category: businessCategory || shop.customer_page_settings.business_category,
        additional_contact: additionalContact,
        postal_code: postalCode,
        address_detail: addressDetail,
      },
    };
    onShopChange?.(optimisticShop);

    if (!persistShopProfile) {
      return;
    }

    const result = await fetchApiJsonWithAuth<{
      shop: Pick<
        Shop,
        | "id"
        | "name"
        | "phone"
        | "address"
        | "description"
        | "approval_mode"
        | "concurrent_capacity"
        | "reservation_policy_settings"
        | "customer_page_settings"
      >;
    }>(
      "/api/owner/shops",
      {
        method: "PATCH",
        body: JSON.stringify({
          shopId: shop.id,
          ...profilePatch,
          tagline,
          showcaseTitle,
          showcaseBody,
          socialLinks,
          heroImageUrl: persistentHeroImageUrl,
          heroImageUrls: persistentHeroImageUrls,
          heroMediaAssetIds,
          ...(policyPatch ?? {}),
          ...(policyPatch ? { pendingHoldLimit: policyPatch.pendingHoldLimit } : {}),
        }),
      },
    );
    onShopChange?.({
      ...optimisticShop,
      ...result.shop,
      customer_page_settings: mergeCustomerPageSettings(optimisticShop.customer_page_settings, {
        ...result.shop.customer_page_settings,
        ...(heroMediaAssetIds.length > 0
          ? {
              hero_image_url: heroImageUrl,
              hero_image_urls: heroImageUrls,
              hero_media_asset_id: heroMediaAssetIds[0] ?? "",
              hero_media_asset_ids: heroMediaAssetIds,
            }
          : {}),
      }),
    });
    if (policyPatch) {
      onManualApprovalChange?.(policyPatch.approvalMode !== "auto");
    }
  }

  function updateCustomerServiceOverrides(nextOverrides: CustomerServiceDisplayOverrides) {
    const normalizedOverrides = normalizeCustomerServiceOverrides(nextOverrides);
    setCustomerServiceOverrides(normalizedOverrides);

    if (customerServiceSaveTimerRef.current) {
      clearTimeout(customerServiceSaveTimerRef.current);
      customerServiceSaveTimerRef.current = null;
    }

    if (!shop) {
      setCustomerServiceSaveStatus("idle");
      return;
    }

    const optimisticShop: Shop = {
      ...shop,
      customer_page_settings: {
        ...shop.customer_page_settings,
        customer_service_overrides: normalizedOverrides,
      },
    };
    onShopChange?.(optimisticShop);

    if (!persistShopProfile || shop.id === "demo-shop" || shop.id === "owner-demo") {
      setCustomerServiceSaveStatus("saved");
      return;
    }

    setCustomerServiceSaveStatus("pending");
    customerServiceSaveTimerRef.current = setTimeout(() => {
      void fetchApiJsonWithAuth<{ shop: Pick<Shop, "id" | "customer_page_settings"> }>("/api/owner/shops", {
        method: "PATCH",
        body: JSON.stringify({
          shopId: shop.id,
          customerServiceOverrides: normalizedOverrides,
        }),
      })
        .then((result) => {
          onShopChange?.({
            ...optimisticShop,
            customer_page_settings: mergeCustomerPageSettings(
              optimisticShop.customer_page_settings,
              result.shop.customer_page_settings,
            ),
          });
          setCustomerServiceSaveStatus("saved");
        })
        .catch((error) => {
          console.error("[OWNER SETTINGS] failed to save customer service exposure", error);
          setCustomerServiceSaveStatus("error");
        });
      customerServiceSaveTimerRef.current = null;
    }, 500);
  }

  function updateDiscountCoupons(nextCoupons: CustomerDiscountCoupon[]) {
    const normalizedCoupons = normalizeDiscountCoupons(nextCoupons);
    setDiscountCouponDrafts(normalizedCoupons);
    setDiscountCouponSaveStatus("idle");
  }

  async function saveDiscountCoupons() {
    if (!shop || discountCouponSaveStatus === "pending") return;

    const normalizedCoupons = normalizeDiscountCoupons(discountCouponDrafts);
    setDiscountCouponSaveStatus("pending");

    const optimisticShop: Shop = {
      ...shop,
      customer_page_settings: {
        ...shop.customer_page_settings,
        discount_coupons: normalizedCoupons,
      },
    };

    if (!persistShopProfile || shop.id === "demo-shop" || shop.id === "owner-demo") {
      setDiscountCouponDrafts(normalizedCoupons);
      setSavedDiscountCoupons(normalizedCoupons);
      onShopChange?.(optimisticShop);
      setDiscountCouponSaveStatus("saved");
      showSaveCompletePopup();
      return;
    }

    try {
      const result = await fetchApiJsonWithAuth<{ shop: Pick<Shop, "id" | "customer_page_settings"> }>("/api/owner/shops", {
        method: "PATCH",
        body: JSON.stringify({
          shopId: shop.id,
          discountCoupons: normalizedCoupons,
        }),
      });
      const savedCoupons = normalizeDiscountCoupons(result.shop.customer_page_settings.discount_coupons);
      const nextShop: Shop = {
        ...optimisticShop,
        customer_page_settings: {
          ...mergeCustomerPageSettings(optimisticShop.customer_page_settings, result.shop.customer_page_settings),
          discount_coupons: savedCoupons,
        },
      };
      setDiscountCouponDrafts(savedCoupons);
      setSavedDiscountCoupons(savedCoupons);
      onShopChange?.(nextShop);
      setDiscountCouponSaveStatus("saved");
      showSaveCompletePopup();
    } catch (error) {
      console.error("[OWNER SETTINGS] failed to save discount coupons", error);
      setDiscountCouponSaveStatus("error");
    }
  }

  function reloadSavedDiscountCoupons() {
    const normalizedCoupons = normalizeDiscountCoupons(savedDiscountCoupons);
    setDiscountCouponDrafts(normalizedCoupons);
    setDiscountCouponSaveStatus("saved");
  }

  function updateDiscountCoupon(couponId: string, patch: Partial<CustomerDiscountCoupon>) {
    updateDiscountCoupons(
      discountCoupons.map((coupon) =>
        coupon.id === couponId
          ? {
              ...coupon,
              ...patch,
            }
          : coupon,
      ),
    );
  }

  function addDiscountCoupon(preset: DiscountCouponPreset = "first_visit") {
    updateDiscountCoupons([...discountCoupons, createDiscountCouponDraft(discountCoupons.length + 1, preset)]);
  }

  function deleteDiscountCoupon(couponId: string) {
    updateDiscountCoupons(discountCoupons.filter((coupon) => coupon.id !== couponId));
  }

  function addCustomerServiceOption() {
    if (!shop || customerServiceActionId) return;

    const usedConnectionOptionIds = new Set(customerServiceOptions.map((option) => option.linkedOptionId ?? option.id));
    const defaultConnectionOption = customerServiceConnectionOptions.find((option) => !usedConnectionOptionIds.has(option.linkedOptionId ?? option.id));
    if (!defaultConnectionOption) return;

    const baselineOverrides = buildCustomerServiceOverrideBaseline(customerServiceOptions, customerServiceOverrides);
    const rowId = createCustomerServiceMenuRowId();
    const nextOrder =
      Math.max(
        0,
        ...customerServiceOptions.map((option) => baselineOverrides[option.id]?.order ?? option.order),
      ) + 1;
    updateCustomerServiceOverrides({
      ...baselineOverrides,
      [rowId]: {
        visible: true,
        order: nextOrder,
        displayName: defaultConnectionOption.sourceName,
        description: defaultConnectionOption.description,
        linkedOptionId: defaultConnectionOption.linkedOptionId ?? defaultConnectionOption.id,
      },
    });
  }

  function deleteCustomerServiceOption(option: CustomerServiceSourceOption) {
    if (!shop || customerServiceActionId) return;

    const baselineOverrides = buildCustomerServiceOverrideBaseline(customerServiceOptions, customerServiceOverrides);
    updateCustomerServiceOverrides({
      ...baselineOverrides,
      [option.id]: {
        ...(baselineOverrides[option.id] ?? {}),
        visible: false,
        order: baselineOverrides[option.id]?.order ?? option.order,
        displayName: baselineOverrides[option.id]?.displayName ?? option.sourceName,
        description: baselineOverrides[option.id]?.description ?? option.description,
      },
    });
  }

  function renameCustomerServiceOption(option: CustomerServiceSourceOption, nextName: string) {
    if (!shop || customerServiceActionId) return;

    const trimmedName = nextName.trim();
    if (!trimmedName || trimmedName === option.sourceName) return;

    const baselineOverrides = buildCustomerServiceOverrideBaseline(customerServiceOptions, customerServiceOverrides);
    updateCustomerServiceOverrides({
      ...baselineOverrides,
      [option.id]: {
        ...(baselineOverrides[option.id] ?? {}),
        visible: true,
        order: baselineOverrides[option.id]?.order ?? option.order,
        displayName: trimmedName,
        description: baselineOverrides[option.id]?.description ?? option.description,
        linkedOptionId: baselineOverrides[option.id]?.linkedOptionId ?? option.linkedOptionId ?? option.id,
      },
    });
  }

  function relinkCustomerServiceOption(option: CustomerServiceSourceOption, nextOptionId: string) {
    if (!nextOptionId) return;

    const nextOption = rawCustomerServiceConnectionOptions.find((item) => item.id === nextOptionId);
    if (!nextOption) return;

    const baselineOverrides = buildCustomerServiceOverrideBaseline(customerServiceOptions, customerServiceOverrides);
    const currentOverride = baselineOverrides[option.id] ?? {};

    updateCustomerServiceOverrides({
      ...baselineOverrides,
      [option.id]: {
        ...currentOverride,
        visible: true,
        displayName: nextOption.sourceName,
        description: currentOverride.description ?? option.description,
        order: currentOverride.order ?? option.order,
        linkedOptionId: nextOption.id,
      },
    });
  }

  function buildSettingsWithRow(
    settings: Record<SettingsTabKey, SettingsTab>,
    rowId: string,
    value: SettingRow["value"],
  ) {
    return {
      ...settings,
      [activeTab]: {
        ...settings[activeTab],
        rows: settings[activeTab].rows.map((row) => (row.id === rowId ? { ...row, value } : row)),
      },
    };
  }

  function updateRow(rowId: string, value: SettingRow["value"]) {
    setDraftSettings((currentSettings) => {
      const nextSettings = buildSettingsWithRow(currentSettings, rowId, value);
      persistSettings(nextSettings);
      if (activeTab === "shop") {
        setIsShopInfoDirty(true);
      }
      return nextSettings;
    });
  }

  function updateHoursRow(rowId: string, value: SettingRow["value"]) {
    setDraftSettings((currentSettings) => {
      const nextSettings = {
        ...currentSettings,
        hours: {
          ...currentSettings.hours,
          rows: currentSettings.hours.rows.map((row) => (row.id === rowId ? { ...row, value } : row)),
        },
      };
      persistSettings(nextSettings);
      return nextSettings;
    });
  }

  function updateShopAddress(address: string, postalCode: string) {
    setDraftSettings((currentSettings) => {
      const targetIds = new Set(["address", "postalCode"]);
      const nextSettings = {
        ...currentSettings,
        shop: {
          ...currentSettings.shop,
          rows: currentSettings.shop.rows.map((row) => {
            if (!targetIds.has(row.id)) return row;
            if (row.id === "address") return { ...row, value: address };
            return { ...row, value: postalCode };
          }),
        },
      };
      persistSettings(nextSettings);
      setIsShopInfoDirty(true);
      return nextSettings;
    });
  }

  function showSaveCompletePopup() {
    setSaveCompleteVisible(true);
    if (saveCompleteTimerRef.current) {
      clearTimeout(saveCompleteTimerRef.current);
    }
    saveCompleteTimerRef.current = setTimeout(() => {
      setSaveCompleteVisible(false);
      saveCompleteTimerRef.current = null;
    }, 1400);
  }

  async function saveShopInfoFromDraft() {
    if (savingShopInfo) return;
    setShopInfoFeedback("");
    if (!isShopInfoDirty) {
      showSaveCompletePopup();
      return;
    }
    const settingsToSave = draftSettings;
    setSavingShopInfo(true);
    setIsShopInfoDirty(false);
    try {
      await saveShopSettings(settingsToSave, { profile: true, policy: true });
      showSaveCompletePopup();
    } catch (error) {
      console.error("[OWNER SETTINGS] failed to save shop profile", error);
      setShopInfoFeedback(error instanceof Error ? error.message : "매장 정보를 저장하지 못했습니다.");
      setIsShopInfoDirty(true);
    } finally {
      setSavingShopInfo(false);
    }
  }

  function handleRowClick(row: SettingRow) {
    if (row.control === "address") {
      setAddressSheetOpen(true);
      return;
    }
    if (row.control === "toggle") {
      updateRow(row.id, !row.value);
      return;
    }
    if (row.control === "text" || row.control === "select" || row.control === "businessHours" || row.control === "closedDays") {
      focusEditableControl(row.id);
    }
  }

  function persistSettings(nextSettings: Record<SettingsTabKey, SettingsTab>, nextShopProfileImages = shopProfileImages) {
    const settingsToStore = cloneSettings(nextSettings);
    const profileImagesToStore = normalizeShopProfileImages(nextShopProfileImages);
    const serializedProfileImages = JSON.stringify(profileImagesToStore);
    const canPersistProfileImages = serializedProfileImages.length <= ownerWebShopProfileImagesStorageLimit;
    try {
      if (!canPersistProfileImages) {
        window.localStorage.removeItem(ownerWebShopProfileImagesStorageKey);
        window.localStorage.removeItem(ownerWebShopProfileImageStorageKey);
      }
      window.localStorage.setItem(ownerWebSettingsStorageKey, JSON.stringify(settingsToStore));
      if (profileImagesToStore.length > 0 && canPersistProfileImages) {
        window.localStorage.setItem(ownerWebShopProfileImagesStorageKey, serializedProfileImages);
        window.localStorage.setItem(ownerWebShopProfileImageStorageKey, profileImagesToStore[0]);
      } else {
        window.localStorage.removeItem(ownerWebShopProfileImagesStorageKey);
        window.localStorage.removeItem(ownerWebShopProfileImageStorageKey);
      }
    } catch {
      // Local preview storage can fail in private modes; keep the in-session state saved.
    }
  }

  function changeActiveTab(tab: SettingsTabKey) {
    setInternalActiveTab(tab);
    onActiveTabChange?.(tab);
  }

  const addressValue = String(draftSettings.shop.rows.find((row) => row.id === "address")?.value ?? "");
  const currentRows = current?.rows ?? [];
  const currentBusinessHoursRow = currentRows.find((row) => row.id === "businessHours");
  const currentClosedDayRow = currentRows.find((row) => row.id === "closedDay");
  const businessHoursRow = draftSettings.hours.rows.find((row) => row.id === "businessHours");
  const closedDayRow = draftSettings.hours.rows.find((row) => row.id === "closedDay");

  async function addShopProfileImages(files: FileList | File[]) {
    if (!shop) return;
    const remainingCount = Math.max(ownerWebShopProfileImagesMaxCount - shopProfileImages.length, 0);
    setShopInfoFeedback("");
    if (remainingCount === 0) {
      setShopInfoFeedback(`매장 사진은 최대 ${ownerWebShopProfileImagesMaxCount}장까지 등록할 수 있습니다.`);
      return;
    }

    const selectedFiles = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, remainingCount);
    if (selectedFiles.length === 0) {
      setShopInfoFeedback("이미지 파일만 추가할 수 있습니다.");
      return;
    }

    setSavingShopInfo(true);
    try {
      const uploadedImages = await Promise.all(
        selectedFiles.map((file) => createOwnerShopProfileImageFromFile({ shopId: shop.id }, file)),
      );
      const imageUrls = uploadedImages.map((item) => item.signedUrl).filter(Boolean);
      const mediaAssetIds = uploadedImages.map((item) => item.mediaAsset.id).filter(Boolean);
      if (imageUrls.length === 0) return;

      const nextImages = normalizeShopProfileImages([...shopProfileImages, ...imageUrls]);
      const nextMediaAssetIds = [...shopProfileImageAssetIds, ...mediaAssetIds].slice(0, nextImages.length);
      setShopProfileImages(nextImages);
      setShopProfileImageAssetIds(nextMediaAssetIds);
      persistSettings(draftSettings, nextImages);
      setIsShopInfoDirty(true);
    } catch (error) {
      console.error("[OWNER SETTINGS] failed to upload shop profile images", error);
      if (shouldFallbackToLocalProfileImage(error)) {
        const localImageUrls = (await Promise.all(selectedFiles.map((file) => readImageFileAsDataUrl(file)))).filter(Boolean);
        const nextImages = normalizeShopProfileImages([...shopProfileImages, ...localImageUrls]);
        setShopProfileImages(nextImages);
        setShopProfileImageAssetIds((currentIds) => currentIds.slice(0, nextImages.length));
        persistSettings(draftSettings, nextImages);
        setIsShopInfoDirty(true);
        setShopInfoFeedback("");
        return;
      }
      setShopInfoFeedback(error instanceof Error ? error.message : "매장 사진을 업로드하지 못했습니다.");
    } finally {
      setSavingShopInfo(false);
    }
  }

  function removeShopProfileImages(indexes: number[]) {
    const removeIndexes = new Set(indexes);
    if (removeIndexes.size === 0) return;
    const nextImages = shopProfileImages.filter((_, imageIndex) => !removeIndexes.has(imageIndex));
    const nextMediaAssetIds = shopProfileImageAssetIds.filter((_, imageIndex) => !removeIndexes.has(imageIndex));
    setShopProfileImages(nextImages);
    setShopProfileImageAssetIds(nextMediaAssetIds);
    persistSettings(draftSettings, nextImages);
    setIsShopInfoDirty(true);
  }

  async function updateAlertSettings(nextSettings: AlertSettingsDraft) {
    setAlertSettings(nextSettings);
    if (!shop) {
      return;
    }

    const nextNotificationSettings = alertSettingsDraftToShopSettings(nextSettings);
    const optimisticShop: Shop = {
      ...shop,
      notification_settings: nextNotificationSettings,
    };

    onShopChange?.(optimisticShop);

    if (!persistShopProfile || shop.id === "demo-shop" || shop.id === "owner-demo") {
      return;
    }

    const saveSeq = alertAutoSaveSeqRef.current + 1;
    alertAutoSaveSeqRef.current = saveSeq;

    try {
      const savedShop = await fetchApiJsonWithAuth<Shop>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          shopId: shop.id,
          name: shop.name,
          phone: shop.phone,
          address: shop.address,
          description: shop.description,
          concurrentCapacity: shop.concurrent_capacity,
          bookingSlotIntervalMinutes: shop.booking_slot_interval_minutes,
          bookingSlotOffsetMinutes: shop.booking_slot_offset_minutes,
          bookingAvailableStartTime: shop.booking_available_start_time,
          bookingAvailableEndTime: shop.booking_available_end_time,
          approvalMode: shop.approval_mode,
          regularClosedDays: shop.regular_closed_days,
          regularClosedCycle: shop.regular_closed_cycle ?? "weekly",
          regularClosedAnchorDate: shop.regular_closed_anchor_date ?? null,
          temporaryClosedDates: shop.temporary_closed_dates,
          businessHours: shop.business_hours,
          reservationPolicySettings: shop.reservation_policy_settings,
          notificationSettings: nextSettings,
        }),
      });
      if (alertAutoSaveSeqRef.current === saveSeq) {
        setAlertSettings(buildAlertSettingsDraft(savedShop.notification_settings));
        onShopChange?.({
          ...savedShop,
          customer_page_settings: mergeCustomerPageSettings(shop.customer_page_settings, savedShop.customer_page_settings),
        });
      }
    } catch (error) {
      console.error("[OWNER SETTINGS] failed to save notification settings", error);
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      {saveCompleteVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none" aria-live="polite">
          <div className="flex min-w-[252px] items-center justify-center gap-3 rounded-[12px] border border-[#dbe2ea] bg-white px-6 py-5 text-[18px] font-semibold text-[#111827] shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e6f3ef] text-[#2f7866]">
              <Check className="h-5 w-5" strokeWidth={2.5} />
            </span>
            저장 완료
          </div>
        </div>
      ) : null}

      <div className={cn("grid min-h-0 gap-6", (activeTab === "shop" || activeTab === "benefits") && "h-full", showTabNavigation && "xl:grid-cols-[316px_minmax(0,1fr)]")}>
        {showTabNavigation ? (
          <WebSurface className="p-3">
            <div className="space-y-1.5">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => changeActiveTab(tab.key)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[16px] px-4 py-3 text-left transition",
                    activeTab === tab.key ? "bg-[#f1f7f4] text-[#2f7866]" : "text-[#5f5851] hover:bg-[#fbfaf8]",
                  )}
                >
                  <span className="text-[15px] font-medium">{tab.label}</span>
                  <span className="text-[12px]">{activeTab === tab.key ? "선택됨" : ""}</span>
                </button>
              ))}
            </div>
          </WebSurface>
        ) : null}

        <div className={cn("min-w-0 space-y-4", (activeTab === "shop" || activeTab === "benefits") && "h-full min-h-0")}>
          {activeTab === "alerts" ? (
            <SettingsAlertsPanel
              value={alertSettings}
              onChange={updateAlertSettings}
              automaticVisitReminderAvailable={automaticVisitReminderAvailable}
            />
          ) : activeTab === "profile" ? (
            <OwnerProfileSettingsPanel
              shop={shop}
              ownerProfile={ownerProfile}
              persistToSupabase={persistShopProfile}
              onOwnerProfileChange={onOwnerProfileChange}
            />
          ) : activeTab === "hours" && currentBusinessHoursRow && currentClosedDayRow ? (
            <OperatingHoursSettings
              businessHoursValue={currentBusinessHoursRow.value}
              closedDaysValue={currentClosedDayRow.value}
              onBusinessHoursChange={(value) => updateRow("businessHours", value)}
              onClosedDaysChange={(value) => updateRow("closedDay", value)}
              shop={shop}
              onShopChange={onShopChange}
              persistToSupabase={persistShopProfile}
            />
          ) : activeTab === "shop" ? (
            <>
              <ShopInfoSettingsPanel
                rows={current.rows}
                  shopProfileImages={shopProfileImages}
                  shop={shop}
                  previewServices={services}
                  ownerProfile={ownerProfile}
                  businessHoursSummary={String(businessHoursRow?.value ?? "")}
                  closedDaysSummary={String(closedDayRow?.value ?? "")}
                editable
                saving={savingShopInfo}
                feedbackMessage={shopInfoFeedback}
                onSave={saveShopInfoFromDraft}
                onProfileImagesAdd={addShopProfileImages}
                onProfileImagesRemove={removeShopProfileImages}
                onRowChange={(rowId, value) => updateRow(rowId, value)}
                onRowCommit={(rowId, value) => updateRow(rowId, value)}
                onOpenAddressSearch={() => setAddressSheetOpen(true)}
                serviceMenuContent={
                  <CustomerServiceExposurePanel
                    options={customerServiceOptions}
                    overrides={customerServiceOverrides}
                    title="서비스 메뉴"
                    embedded
                    busyOptionId={customerServiceActionId}
                    onChange={updateCustomerServiceOverrides}
                    connectionOptions={customerServiceConnectionOptions}
                    onAddOption={addCustomerServiceOption}
                    onDeleteOption={deleteCustomerServiceOption}
                    onRenameOption={renameCustomerServiceOption}
                    onRelinkOption={relinkCustomerServiceOption}
                  />
                }
              >
                {businessHoursRow && closedDayRow ? (
                  <OperatingHoursSettings
                    businessHoursValue={businessHoursRow.value}
                    closedDaysValue={closedDayRow.value}
                    onBusinessHoursChange={(value) => updateHoursRow("businessHours", value)}
                    onClosedDaysChange={(value) => updateHoursRow("closedDay", value)}
                    shop={shop}
                    onShopChange={onShopChange}
                    persistToSupabase={persistShopProfile}
                    compact
                  />
                ) : null}
              </ShopInfoSettingsPanel>
            </>
          ) : activeTab === "benefits" ? (
            <CustomerPagePreviewLayout shop={customerPagePreviewShop} services={services} ownerProfile={ownerProfile}>
            <WebSurface className="p-6">
              <div className="mb-5 flex items-start justify-between gap-3 rounded-[10px] border border-[#dbe2ea] bg-[#fbfcfd] p-4">
                <div>
                  <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#111827]">혜택 관리</h2>
                  <p
                    className={cn(
                      "mt-1 text-[14px] font-normal",
                      discountCouponSaveStatus === "error"
                        ? "text-[#a04455]"
                        : discountCouponSaveStatus === "pending" || discountCouponsDirty
                          ? "text-[#8a5b11]"
                          : "text-[#2f7866]",
                    )}
                  >
                    {discountCouponSaveStatus === "pending"
                      ? "혜택을 저장하는 중입니다."
                      : discountCouponSaveStatus === "error"
                        ? "저장하지 못했습니다. 다시 시도해 주세요."
                        : discountCouponsDirty
                          ? "저장하지 않은 변경사항이 있습니다."
                          : "저장된 혜택을 불러온 상태입니다."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={reloadSavedDiscountCoupons}
                    disabled={!discountCouponsDirty || discountCouponSaveStatus === "pending"}
                    className="inline-flex h-10 items-center rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[15px] font-normal text-[#334155] transition hover:border-[#c8ded8] hover:bg-[#f4faf8] hover:text-[#2f7866] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    기존 혜택 불러오기
                  </button>
                  <button
                    type="button"
                    onClick={() => addDiscountCoupon()}
                    disabled={discountCouponSaveStatus === "pending"}
                    className="inline-flex h-10 items-center rounded-[8px] border border-[#c8ded8] bg-[#f4faf8] px-4 text-[15px] font-normal text-[#2f7866] transition hover:border-[#8bbcaf] hover:bg-[#eef7f4] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    혜택 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveDiscountCoupons()}
                    disabled={!discountCouponsDirty || discountCouponSaveStatus === "pending"}
                    className="inline-flex h-10 items-center rounded-[8px] border border-[#2f7866] bg-[#2f7866] px-4 text-[15px] font-normal text-white transition hover:border-[#286a5a] hover:bg-[#286a5a] disabled:cursor-not-allowed disabled:border-[#cbd5e1] disabled:bg-[#cbd5e1]"
                  >
                    {discountCouponSaveStatus === "pending" ? "저장 중" : "혜택 저장"}
                  </button>
                </div>
              </div>
              <DiscountCouponEditor
                coupons={discountCoupons}
                serviceOptions={customerServiceConnectionOptions}
                disabled={discountCouponSaveStatus === "pending"}
                onAdd={() => addDiscountCoupon()}
                onAddPreset={addDiscountCoupon}
                onDelete={deleteDiscountCoupon}
                onUpdate={updateDiscountCoupon}
              />
            </WebSurface>
            </CustomerPagePreviewLayout>
          ) : (
            <WebSurface className="p-6">
              <div className="divide-y divide-[#f1e8e0]">
                {current.rows.map((row) => (
                  <div
                    key={row.id}
                    role={row.control === "readonly" || row.control === "stepper" ? undefined : "button"}
                    tabIndex={row.control === "readonly" || row.control === "stepper" ? undefined : 0}
                    onClick={() => handleRowClick(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleRowClick(row);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between gap-6 py-4 transition",
                      row.control !== "readonly" && "cursor-pointer hover:bg-[#fbfaf8]",
                    )}
                  >
                    <div className="min-w-0 px-1">
                      <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#17211f]">{row.label}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <SettingValueControl
                        row={row}
                        onChange={(value) => updateRow(row.id, value)}
                        onCommit={(value) => updateRow(row.id, value)}
                        onOpenAddressSearch={() => setAddressSheetOpen(true)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </WebSurface>
          )}
        </div>
      </div>

      {addressSheetOpen ? (
        <KakaoPostcodeSheet
          title="매장 주소 검색"
          description="도로명이나 건물명으로 검색한 뒤 매장 주소를 선택해 주세요."
          initialQuery={addressValue}
          onClose={() => setAddressSheetOpen(false)}
          onSelect={(selection) => {
            updateShopAddress(selection.address, selection.zonecode);
            setAddressSheetOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
