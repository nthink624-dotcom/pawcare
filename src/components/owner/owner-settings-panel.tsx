"use client";

import { CalendarDays, Camera, Check, ChevronLeft, ChevronRight, CreditCard, KeyRound, LogOut, MapPin, Plus, Store, UserRound, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { InfoTip } from "@/components/owner/owner-app-ui";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { Switch } from "@/components/ui/switch";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { writeOwnerBillingSummaryCache } from "@/lib/billing/owner-billing-navigation";
import {
  OWNER_CANONICAL_PLAN_CODE,
  OWNER_SINGLE_PLAN_INCLUDED_COPY,
  OWNER_SINGLE_PLAN_MONTHLY_PRICE,
  OWNER_SINGLE_PLAN_NAME,
} from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { concurrentCapacityForApprovalMode } from "@/lib/booking-slot-settings";
import { bookingCloseGraceMinuteOptions, normalizeBookingCloseGraceMinutes } from "@/lib/booking-last-start-cutoff";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { defaultStaffProfileMessage } from "@/lib/staff-display";
import { addDate, currentDateInTimeZone, decodeUnicodeEscapes, formatServicePrice, won } from "@/lib/utils";
import type { BootstrapPayload, BootstrapStaffMember, BusinessHours, Service } from "@/types/domain";

type SettingsPanelProps = {
  data: BootstrapPayload;
  onSave: (payload: unknown, options?: { errorFallbackMessage?: string }) => Promise<unknown> | void;
  onSaveCustomerPageSettings: (payload: unknown) => Promise<unknown> | void;
  onSaveStaffMembers: (payload: unknown) => Promise<unknown> | void;
  onLogout?: () => void;
  loggingOut?: boolean;
  userEmail?: string | null;
  subscriptionSummary?: OwnerSubscriptionSummary | null;
  initialScreen?: SettingsScreen;
  onActiveScreenChange?: (screen: SettingsScreen) => void;
  appRole?: MobileAppRole;
  currentStaffId?: string | null;
  onOpenFeedback?: () => void;
  feedbackTriggerRef?: RefObject<HTMLButtonElement | null>;
  isTesterFeedback?: boolean;
};

type MobileAppRole = "owner" | "staff";

type SaveFeedback = {
  type: "idle" | "success" | "error";
  message: string;
  description?: string;
};

type SettingsScreen = "subscription" | "shop" | "closures" | "notifications" | "services" | "staff" | "addons" | "account" | null;

type PriceType = "fixed" | "starting";
type StaffProfileDraft = {
  name: string;
  displayName: string;
  profileImageUrl: string;
  titlePrefix: string;
  position: string;
  chipColorIndex: number | null;
  profileMessage: string;
};
type ShopNotificationSettingsState = {
  enabled: boolean;
  revisitEnabled: boolean;
  bookingConfirmedEnabled: boolean;
  bookingCancelledEnabled: boolean;
  bookingRescheduledEnabled: boolean;
  groomingAlmostDoneEnabled: boolean;
  groomingCompletedEnabled: boolean;
  groomingStartWithoutPhotoEnabled: boolean;
  groomingCompleteWithoutPhotoEnabled: boolean;
};
const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const businessHoursWeekOrder = [1, 2, 3, 4, 5, 6, 0];
const businessHoursRowValueWeightClass = "font-medium";
const defaultBusinessHoursEntry = { open: "10:00", close: "19:00", enabled: true };

function createStaffProfileDraft(staffMember: BootstrapStaffMember): StaffProfileDraft {
  return {
    name: staffMember.name,
    displayName: staffMember.displayName ?? "",
    profileImageUrl: staffMember.profileImageUrl ?? "",
    titlePrefix: staffMember.titlePrefix ?? "",
    position: staffMember.position ?? "",
    chipColorIndex: staffMember.chipColorIndex ?? null,
    profileMessage: staffMember.profileMessage ?? "",
  };
}

function createStaffProfileDrafts(staffMembers: BootstrapStaffMember[]): Record<string, StaffProfileDraft> {
  return Object.fromEntries(staffMembers.map((staffMember) => [staffMember.id, createStaffProfileDraft(staffMember)]));
}
function createBusinessHoursState(hours: BusinessHours, regularClosedDays: number[]): BusinessHours {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, day) => {
      const current = hours[day];
      return [
        day,
        {
          open: current?.open ?? defaultBusinessHoursEntry.open,
          close: current?.close ?? defaultBusinessHoursEntry.close,
          enabled: current?.enabled ?? !regularClosedDays.includes(day),
        },
      ];
    }),
  ) as BusinessHours;
}

function formatBusinessHoursRange(entry?: { open: string; close: string }) {
  if (!entry) return `${defaultBusinessHoursEntry.open} - ${defaultBusinessHoursEntry.close}`;
  return `${entry.open} - ${entry.close}`;
}

function isOrderedTimeRange(open: string, close: string) {
  return /^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close) && open < close;
}

function mapShopNotificationSettingsState(
  settings: BootstrapPayload["shop"]["notification_settings"],
): ShopNotificationSettingsState {
  return {
    enabled: settings.enabled,
    revisitEnabled: settings.revisit_enabled,
    bookingConfirmedEnabled: settings.booking_confirmed_enabled,
    bookingCancelledEnabled: settings.booking_cancelled_enabled,
    bookingRescheduledEnabled: settings.booking_rescheduled_enabled,
    groomingAlmostDoneEnabled: settings.grooming_almost_done_enabled,
    groomingCompletedEnabled: settings.grooming_completed_enabled,
    groomingStartWithoutPhotoEnabled: settings.grooming_start_without_photo_enabled,
    groomingCompleteWithoutPhotoEnabled: settings.grooming_complete_without_photo_enabled,
  };
}

function getNotificationSettingsSaveFailureMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.status === 403) {
      return "로그인 상태를 확인한 뒤 다시 시도해 주세요.";
    }
    if (error.status === 404 || error.status === 405) {
      return "알림톡 설정 연결을 찾지 못했어요. 잠시 후 다시 시도해 주세요.";
    }
    if (error.status === 409) {
      return "다른 설정 변경이 반영되었어요. 화면을 다시 확인해 주세요.";
    }
    if (error.status === 400 || error.status === 422) {
      return "알림톡 설정 값을 다시 확인해 주세요.";
    }
  }

  if (error instanceof TypeError) {
    return "알림톡 설정 연결을 확인한 뒤 다시 시도해 주세요.";
  }

  return "알림톡 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function withPrimedShopNotificationSettings(
  previous: ShopNotificationSettingsState,
  next: ShopNotificationSettingsState,
): ShopNotificationSettingsState {
  const enablingNotificationsForTheFirstTime = !previous.enabled && next.enabled;
  const hasAnyDetailedNotificationEnabled =
    next.revisitEnabled ||
    next.bookingConfirmedEnabled ||
    next.bookingCancelledEnabled ||
    next.bookingRescheduledEnabled ||
    next.groomingAlmostDoneEnabled ||
    next.groomingCompletedEnabled;

  if (!enablingNotificationsForTheFirstTime || hasAnyDetailedNotificationEnabled) {
    return next;
  }

  return {
    ...next,
    revisitEnabled: true,
    bookingConfirmedEnabled: true,
    bookingCancelledEnabled: true,
    bookingRescheduledEnabled: true,
    groomingAlmostDoneEnabled: true,
    groomingCompletedEnabled: true,
  };
}

function monthCursorFromDate(date: string) {
  return date.slice(0, 7);
}

function shiftMonth(cursor: string, amount: number) {
  const [year, month] = cursor.split("-").map(Number);
  const next = new Date(year, month - 1 + amount, 1);
  const nextYear = next.getFullYear();
  const nextMonth = String(next.getMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

function parseShopAddressParts(rawAddress: string) {
  const normalized = decodeUnicodeEscapes(rawAddress ?? "").trim();
  if (!normalized) {
    return {
      baseAddress: "",
      detailAddress: "",
    };
  }

  const commaIndex = normalized.indexOf(",");
  if (commaIndex === -1) {
    return {
      baseAddress: normalized,
      detailAddress: "",
    };
  }

  return {
    baseAddress: normalized.slice(0, commaIndex).trim(),
    detailAddress: normalized.slice(commaIndex + 1).trim(),
  };
}

export default function OwnerSettingsPanel({
  data,
  onSave,
  onSaveCustomerPageSettings,
  onSaveStaffMembers,
  onLogout,
  loggingOut = false,
  userEmail,
  subscriptionSummary,
  initialScreen = null,
  onActiveScreenChange,
  appRole = "owner",
  currentStaffId = null,
  onOpenFeedback,
  feedbackTriggerRef,
  isTesterFeedback = false,
}: SettingsPanelProps) {
  const appUpdateState = useOwnerPlayUpdateSnapshot();
  const initialAddressParts = parseShopAddressParts(data.shop.address);
  const [name, setName] = useState(decodeUnicodeEscapes(data.shop.name));
  const [phone, setPhone] = useState(data.shop.phone);
  const [address, setAddress] = useState(initialAddressParts.baseAddress);
  const [detailAddress, setDetailAddress] = useState(initialAddressParts.detailAddress);
  const [postalCode, setPostalCode] = useState("");
  const [isAddressSearchOpen, setIsAddressSearchOpen] = useState(false);
  const detailAddressInputRef = useRef<HTMLInputElement | null>(null);
  const [description, setDescription] = useState(decodeUnicodeEscapes(data.shop.description));
  const [regularClosedDays, setRegularClosedDays] = useState<number[]>(data.shop.regular_closed_days);
  const [temporaryClosedDates, setTemporaryClosedDates] = useState<string[]>(data.shop.temporary_closed_dates);
  const [pendingClosedDate, setPendingClosedDate] = useState("");
  const [isClosedDatePickerOpen, setIsClosedDatePickerOpen] = useState(false);
  const [closedDateMonthCursor, setClosedDateMonthCursor] = useState(monthCursorFromDate(data.shop.temporary_closed_dates[0] ?? currentDateInTimeZone()));
  const [businessHours, setBusinessHours] = useState<BusinessHours>(
    createBusinessHoursState(data.shop.business_hours, data.shop.regular_closed_days),
  );
  const [bookingCloseGraceMinutes, setBookingCloseGraceMinutes] = useState(
    normalizeBookingCloseGraceMinutes(data.shop.reservation_policy_settings?.booking_close_grace_minutes),
  );
  const [timeEditorTarget, setTimeEditorTarget] = useState<number | "all" | null>(null);
  const [timeDraft, setTimeDraft] = useState({ open: defaultBusinessHoursEntry.open, close: defaultBusinessHoursEntry.close, closed: false });
  const [operatingHoursNote, setOperatingHoursNote] = useState(decodeUnicodeEscapes(data.shop.customer_page_settings?.operating_hours_note ?? ""));
  const [holidayNotice] = useState(decodeUnicodeEscapes(data.shop.customer_page_settings?.holiday_notice ?? ""));
  const [parkingNotice, setParkingNotice] = useState(decodeUnicodeEscapes(data.shop.customer_page_settings?.parking_notice ?? ""));
  const [heroImageUrl, setHeroImageUrl] = useState(decodeUnicodeEscapes(data.shop.customer_page_settings?.hero_image_url ?? ""));
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
  const [notices, setNotices] = useState<string[]>([
    decodeUnicodeEscapes(data.shop.customer_page_settings?.notices?.[0] ?? ""),
    decodeUnicodeEscapes(data.shop.customer_page_settings?.notices?.[1] ?? ""),
    decodeUnicodeEscapes(data.shop.customer_page_settings?.notices?.[2] ?? ""),
  ]);
  const [showNotices, setShowNotices] = useState(data.shop.customer_page_settings?.show_notices ?? true);
  const [showParkingNotice, setShowParkingNotice] = useState(data.shop.customer_page_settings?.show_parking_notice ?? true);
  const [noticeEditorTarget, setNoticeEditorTarget] = useState<"parking" | "notices" | null>(null);
  const [parkingNoticeDraft, setParkingNoticeDraft] = useState("");
  const [noticeDrafts, setNoticeDrafts] = useState<string[]>(["", "", ""]);
  const [newService, setNewService] = useState({
    name: "",
    price: "",
    duration: "60",
    priceType: "starting" as PriceType,
    isActive: true,
  });
  const [isNewServiceFormOpen, setIsNewServiceFormOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState("");
  const [editingServicePrice, setEditingServicePrice] = useState("");
  const [editingServiceDuration, setEditingServiceDuration] = useState("");
  const [editingServicePriceType, setEditingServicePriceType] = useState<PriceType>("starting");
  const [editingServiceIsActive, setEditingServiceIsActive] = useState(true);
  const [staffProfileDrafts, setStaffProfileDrafts] = useState<Record<string, StaffProfileDraft>>(() =>
    createStaffProfileDrafts(data.staffMembers),
  );
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);
  const [staffFeedback, setStaffFeedback] = useState<SaveFeedback>({ type: "idle", message: "" });
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [basicInfoFeedback, setBasicInfoFeedback] = useState<SaveFeedback>({ type: "idle", message: "" });
  const [savingOperatingInfo, setSavingOperatingInfo] = useState(false);
  const [operatingInfoFeedback, setOperatingInfoFeedback] = useState<SaveFeedback>({ type: "idle", message: "" });
  const operatingSaveQueueRef = useRef(Promise.resolve());
  const operatingSaveCountRef = useRef(0);
  const [isBasicInfoEditing, setIsBasicInfoEditing] = useState(false);
  const [localActiveScreen, setLocalActiveScreen] = useState<SettingsScreen>(initialScreen ?? null);
  const priceGuideSessionKey = ownerPriceGuideSessionKey(data);
  const [priceGuideState, setPriceGuideState] = useState<PriceGuideSessionState | null>(() =>
    readOwnerPriceGuideSessionDraft(priceGuideSessionKey) ?? readBootstrapPriceGuideState(data.services),
  );
  const [notificationSettings, setNotificationSettings] = useState<ShopNotificationSettingsState>(
    mapShopNotificationSettingsState(data.shop.notification_settings),
  );
  const [isNotificationSettingsDirty, setIsNotificationSettingsDirty] = useState(false);
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false);
  const [notificationSettingsFeedback, setNotificationSettingsFeedback] = useState<SaveFeedback>({ type: "idle", message: "" });
  const notificationSaveQueueRef = useRef(Promise.resolve());
  const notificationSaveCountRef = useRef(0);
  const notificationSaveSequenceRef = useRef(0);
  const activeScreen = onActiveScreenChange ? (initialScreen ?? null) : localActiveScreen;
  const accountEmail = userEmail?.trim() || null;

  useEffect(() => {
    setIsNotificationSettingsDirty(false);
    setNotificationSettings(mapShopNotificationSettingsState(data.shop.notification_settings));
  }, [data.shop.id]);

  useEffect(() => {
    setStaffProfileDrafts(createStaffProfileDrafts(data.staffMembers));
    setStaffFeedback({ type: "idle", message: "" });
  }, [data.staffMembers]);

  useEffect(() => {
    setBusinessHours(createBusinessHoursState(data.shop.business_hours, data.shop.regular_closed_days));
    setTimeEditorTarget(null);
  }, [
    data.shop.id,
    data.shop.business_hours,
    data.shop.regular_closed_days,
  ]);

  useEffect(() => {
    setBookingCloseGraceMinutes(
      normalizeBookingCloseGraceMinutes(data.shop.reservation_policy_settings?.booking_close_grace_minutes),
    );
  }, [data.shop.id, data.shop.reservation_policy_settings?.booking_close_grace_minutes]);

  useEffect(() => {
    const nextAddressParts = parseShopAddressParts(data.shop.address);
    setName(decodeUnicodeEscapes(data.shop.name));
    setPhone(data.shop.phone);
    setAddress(nextAddressParts.baseAddress);
    setDetailAddress(nextAddressParts.detailAddress);
    setDescription(decodeUnicodeEscapes(data.shop.description));
    setHeroImageUrl(decodeUnicodeEscapes(data.shop.customer_page_settings?.hero_image_url ?? ""));
    setIsBasicInfoEditing(false);
  }, [
    data.shop.id,
    data.shop.name,
    data.shop.phone,
    data.shop.address,
    data.shop.description,
    data.shop.customer_page_settings?.hero_image_url,
  ]);

  useEffect(() => {
    if (onActiveScreenChange) return;
    setLocalActiveScreen(initialScreen ?? null);
  }, [initialScreen, onActiveScreenChange]);

  function updateActiveScreen(nextScreen: SettingsScreen) {
    if (onActiveScreenChange) {
      onActiveScreenChange(nextScreen);
      return;
    }
    setLocalActiveScreen(nextScreen);
  }

  function setIsPriceGuideOpen(isOpen: boolean) {
    updateActiveScreen(isOpen ? "price" : null);
  }

  useEffect(() => {
    const savedSettings = mapShopNotificationSettingsState(data.shop.notification_settings);
    if (isNotificationSettingsDirty) return;

    setNotificationSettings((currentSettings) =>
      JSON.stringify(currentSettings) === JSON.stringify(savedSettings) ? currentSettings : savedSettings,
    );
  }, [data.shop.notification_settings, isNotificationSettingsDirty]);

  useEffect(() => {
    if (basicInfoFeedback.type !== "success") return;

    const timeout = window.setTimeout(() => {
      setBasicInfoFeedback({ type: "idle", message: "" });
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [basicInfoFeedback]);

  useEffect(() => {
    if (operatingInfoFeedback.type !== "success") return;

    const timeout = window.setTimeout(() => {
      setOperatingInfoFeedback({ type: "idle", message: "" });
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [operatingInfoFeedback]);

  useEffect(() => {
    if (notificationSettingsFeedback.type !== "success") return;

    const timeout = window.setTimeout(() => {
      setNotificationSettingsFeedback({ type: "idle", message: "" });
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [notificationSettingsFeedback]);

  function updateNotificationSettings(updater: (previous: ShopNotificationSettingsState) => ShopNotificationSettingsState) {
    const nextSettings = withPrimedShopNotificationSettings(notificationSettings, updater(notificationSettings));
    setNotificationSettings(nextSettings);
    setIsNotificationSettingsDirty(true);
    saveNotificationSettings(nextSettings);
  }

  function resetBasicInfoDraft() {
    const nextAddressParts = parseShopAddressParts(data.shop.address);
    setName(decodeUnicodeEscapes(data.shop.name));
    setPhone(data.shop.phone);
    setAddress(nextAddressParts.baseAddress);
    setDetailAddress(nextAddressParts.detailAddress);
    setHeroImageUrl(decodeUnicodeEscapes(data.shop.customer_page_settings?.hero_image_url ?? ""));
    setBasicInfoFeedback({ type: "idle", message: "" });
    setIsBasicInfoEditing(false);
  }

  function getBusinessHour(day: number) {
    return businessHours[day] ?? {
      ...defaultBusinessHoursEntry,
      enabled: !regularClosedDays.includes(day),
    };
  }

  function openBusinessHoursEditor(target: number | "all") {
    const base =
      target === "all"
        ? businessHoursWeekOrder.map((day) => getBusinessHour(day)).find((entry) => entry.enabled) ?? getBusinessHour(1)
        : getBusinessHour(target);
    setTimeDraft({
      open: base.open,
      close: base.close,
      closed: target === "all" ? false : regularClosedDays.includes(target),
    });
    setOperatingInfoFeedback({ type: "idle", message: "" });
    setTimeEditorTarget(target);
  }

  async function applyBusinessHoursEditor() {
    if (timeEditorTarget === null) return;
    if (!timeDraft.closed && !isOrderedTimeRange(timeDraft.open, timeDraft.close)) return;

    const nextBusinessHours = { ...businessHours };
    const nextRegularClosedDays = [...regularClosedDays];

    if (timeEditorTarget === "all") {
      businessHoursWeekOrder.forEach((day) => {
        nextBusinessHours[day] = {
          ...(businessHours[day] ?? defaultBusinessHoursEntry),
          open: timeDraft.open,
          close: timeDraft.close,
          enabled: !regularClosedDays.includes(day),
        };
      });
    } else {
      const isClosed = timeDraft.closed;
      nextBusinessHours[timeEditorTarget] = {
        ...(businessHours[timeEditorTarget] ?? defaultBusinessHoursEntry),
        open: timeDraft.open,
        close: timeDraft.close,
        enabled: !isClosed,
      };

      const hasDay = nextRegularClosedDays.includes(timeEditorTarget);
      if (isClosed && !hasDay) nextRegularClosedDays.push(timeEditorTarget);
      if (!isClosed && hasDay) nextRegularClosedDays.splice(nextRegularClosedDays.indexOf(timeEditorTarget), 1);
      nextRegularClosedDays.sort((left, right) => left - right);
    }

    const saved = await saveOperatingInfo(nextBusinessHours, nextRegularClosedDays, temporaryClosedDates);
    if (!saved) return;

    setBusinessHours(nextBusinessHours);
    setRegularClosedDays(nextRegularClosedDays);
    setTimeEditorTarget(null);
  }

  const closedDateMonthLabel = `${closedDateMonthCursor.slice(2, 4)}년 ${Number(closedDateMonthCursor.slice(5, 7))}월`;
  const subscriptionEndDate = useMemo(() => {
    if (!subscriptionSummary) return "-";

    const serviceEndsAt = subscriptionSummary.currentPeriodEndsAt ?? subscriptionSummary.trialEndsAt;
    if (!serviceEndsAt) return "-";
    const datePart = serviceEndsAt.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? `${datePart.slice(2, 4)}.${datePart.slice(5, 7)}.${datePart.slice(8, 10)}` : datePart.replace(/-/g, ".");
  }, [subscriptionSummary]);

  const closedDateMonthCells = useMemo(() => {
    const monthStart = `${closedDateMonthCursor}-01`;
    const startDate = new Date(`${monthStart}T00:00:00`);
    const startWeekday = startDate.getDay();
    const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayOffset = index - startWeekday;
      if (dayOffset < 0 || dayOffset >= daysInMonth) return null;
      return addDate(monthStart, dayOffset);
    });
  }, [closedDateMonthCursor]);

  const businessHoursSummary = useMemo(() => {
    const normalized = businessHoursWeekOrder.map((day) => getBusinessHour(day));
    const first = normalized[0];
    const allSame = normalized.every((entry) => entry.open === first.open && entry.close === first.close);

    return allSame ? formatBusinessHoursRange(first) : "요일별로 다르게 설정 중";
  }, [businessHours, regularClosedDays]);
  const parkingNoticeSummary = useMemo(() => {
    const trimmed = parkingNotice.trim();
    return trimmed || "주차 안내 문구를 입력해 주세요.";
  }, [parkingNotice]);
  const noticeSummary = useMemo(() => {
    const filledNotices = notices.map((item) => item.trim()).filter(Boolean);
    if (filledNotices.length === 0) {
      return "예약 전 안내 문구를 추가해 주세요.";
    }
    if (filledNotices.length === 1) {
      return filledNotices[0];
    }
    const firstNotice = filledNotices[0];
    const compactFirstNotice =
      firstNotice.length > 22 ? `${firstNotice.slice(0, 22).trimEnd()}…` : firstNotice;
    return `${compactFirstNotice} 외 ${filledNotices.length - 1}개`;
  }, [notices]);

  function openNoticeEditor(target: "parking" | "notices") {
    if (target === "parking") {
      setParkingNoticeDraft(parkingNotice);
    } else {
      setNoticeDrafts([
        notices[0] ?? "",
        notices[1] ?? "",
        notices[2] ?? "",
      ]);
    }
    setNoticeEditorTarget(target);
  }

  function handleAddressSelect(nextAddress: { address: string; zonecode: string }) {
    setAddress(nextAddress.address);
    setPostalCode(nextAddress.zonecode);
    setDetailAddress("");
    setIsAddressSearchOpen(false);
    window.setTimeout(() => detailAddressInputRef.current?.focus(), 80);
  }

  function applyNoticeEditor() {
    if (noticeEditorTarget === "parking") {
      setParkingNotice(parkingNoticeDraft);
    }

    if (noticeEditorTarget === "notices") {
      setNotices(noticeDrafts);
    }

    setNoticeEditorTarget(null);
  }

  function handleProfileImageChange(file: File | null) {
    if (!isBasicInfoEditing) return;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setHeroImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function updateStaffProfileDraft(staffMemberId: string, patch: Partial<StaffProfileDraft>) {
    setStaffProfileDrafts((prev) => ({
      ...prev,
      [staffMemberId]: {
        ...(prev[staffMemberId] ?? {
          name: "",
          displayName: "",
          profileImageUrl: "",
          profileImageFallbackKey: null,
          titlePrefix: "",
          position: "",
          chipColorIndex: null,
          profileMessage: "",
        }),
        ...patch,
      },
    }));
  }

  function addPendingClosedDate() {
    if (!pendingClosedDate || temporaryClosedDates.includes(pendingClosedDate)) {
      setIsClosedDatePickerOpen(false);
      return;
    }

    const nextTemporaryClosedDates = [...temporaryClosedDates, pendingClosedDate].sort();
    setTemporaryClosedDates(nextTemporaryClosedDates);
    saveOperatingInfo(businessHours, regularClosedDays, nextTemporaryClosedDates);
    setPendingClosedDate("");
    setIsClosedDatePickerOpen(false);
  }

  function removeTemporaryClosedDate(date: string) {
    const nextTemporaryClosedDates = temporaryClosedDates.filter((item) => item !== date);
    setTemporaryClosedDates(nextTemporaryClosedDates);
    saveOperatingInfo(businessHours, regularClosedDays, nextTemporaryClosedDates);
  }

  function saveOperatingInfo(
    nextBusinessHours: BusinessHours,
    nextRegularClosedDays: number[],
    nextTemporaryClosedDates: string[],
  ): Promise<boolean> {
    operatingSaveCountRef.current += 1;
    setSavingOperatingInfo(true);
    setOperatingInfoFeedback({ type: "idle", message: "" });

    const saveTask = async () => {
      try {
        await Promise.resolve(
          onSave({
            shopId: data.shop.id,
            name: decodeUnicodeEscapes(data.shop.name),
            phone: data.shop.phone,
            address: decodeUnicodeEscapes(data.shop.address),
            description: decodeUnicodeEscapes(data.shop.description),
            concurrentCapacity: concurrentCapacityForApprovalMode(data.shop.approval_mode),
            bookingSlotIntervalMinutes: data.shop.booking_slot_interval_minutes,
            bookingSlotOffsetMinutes: data.shop.booking_slot_offset_minutes,
            bookingAvailableStartTime: data.shop.booking_available_start_time,
            bookingAvailableEndTime: data.shop.booking_available_end_time,
            approvalMode: data.shop.approval_mode,
            regularClosedDays: nextRegularClosedDays,
            temporaryClosedDates: nextTemporaryClosedDates,
            businessHours: nextBusinessHours,
            notificationSettings,
          }),
        );
        setOperatingInfoFeedback({ type: "success", message: "자동 저장되었습니다." });
        return true;
      } catch (error) {
        setOperatingInfoFeedback({
          type: "error",
          message: `${error instanceof Error ? error.message : "운영 정보를 저장하지 못했습니다."} 입력값은 유지되었습니다. 확인 후 다시 시도해 주세요.`,
        });
        return false;
      } finally {
        operatingSaveCountRef.current -= 1;
        if (operatingSaveCountRef.current === 0) setSavingOperatingInfo(false);
      }
    };

    const queuedTask = operatingSaveQueueRef.current.then(saveTask, saveTask);
    operatingSaveQueueRef.current = queuedTask.then(() => undefined);
    return queuedTask;
  }

  function saveNotificationSettings(nextSettings: ShopNotificationSettingsState) {
    const saveSequence = notificationSaveSequenceRef.current + 1;
    notificationSaveSequenceRef.current = saveSequence;
    notificationSaveCountRef.current += 1;
    setSavingNotificationSettings(true);
    setNotificationSettingsFeedback({ type: "idle", message: "" });

    const saveTask = async () => {
      try {
        await Promise.resolve(
          onSave({
            shopId: data.shop.id,
            name: decodeUnicodeEscapes(data.shop.name),
            phone: data.shop.phone,
            address: decodeUnicodeEscapes(data.shop.address),
            description: decodeUnicodeEscapes(data.shop.description),
            concurrentCapacity: concurrentCapacityForApprovalMode(data.shop.approval_mode),
            bookingSlotIntervalMinutes: data.shop.booking_slot_interval_minutes,
            bookingSlotOffsetMinutes: data.shop.booking_slot_offset_minutes,
            bookingAvailableStartTime: data.shop.booking_available_start_time,
            bookingAvailableEndTime: data.shop.booking_available_end_time,
            approvalMode: data.shop.approval_mode,
            regularClosedDays,
            temporaryClosedDates,
            businessHours,
            notificationSettings: nextSettings,
          }, { errorFallbackMessage: "알림톡 설정을 저장하지 못했어요." }),
        );
        if (notificationSaveSequenceRef.current === saveSequence) {
          setIsNotificationSettingsDirty(false);
          setNotificationSettingsFeedback({ type: "success", message: "자동 저장되었습니다." });
        }
      } catch (error) {
        if (notificationSaveSequenceRef.current === saveSequence) {
          setNotificationSettings(mapShopNotificationSettingsState(data.shop.notification_settings));
          setIsNotificationSettingsDirty(false);
          setNotificationSettingsFeedback({ type: "error", message: getNotificationSettingsSaveFailureMessage(error) });
        }
      } finally {
        notificationSaveCountRef.current -= 1;
        if (notificationSaveCountRef.current === 0) setSavingNotificationSettings(false);
      }
    };

    notificationSaveQueueRef.current = notificationSaveQueueRef.current.then(saveTask, saveTask);
  }

  function updateStaffProfileDraft(staffMemberId: string, patch: Partial<StaffProfileDraft>) {
    setStaffProfileDrafts((prev) => ({
      ...prev,
      [staffMemberId]: {
        ...(prev[staffMemberId] ?? {
          name: "",
          displayName: "",
          profileImageUrl: "",
          titlePrefix: "",
          position: "",
          chipColorIndex: null,
          profileMessage: "",
        }),
        ...patch,
      },
    }));
  }

  function handleStaffProfileImageChange(staffMemberId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateStaffProfileDraft(staffMemberId, { profileImageUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  }

  function buildStaffMembersPayload(targetStaffMember: BootstrapStaffMember): BootstrapStaffMember[] {
    const targetDraft = staffProfileDrafts[targetStaffMember.id] ?? createStaffProfileDraft(targetStaffMember);
    const name = targetDraft.name.trim() || targetStaffMember.name;

    return data.staffMembers.map((staffMember) => {
      if (staffMember.id !== targetStaffMember.id) return staffMember;

      return {
        ...staffMember,
        name,
        displayName: targetDraft.displayName.trim(),
        profileImageUrl: targetDraft.profileImageUrl.trim(),
        titlePrefix: targetDraft.titlePrefix.trim(),
        position: targetDraft.position.trim() || staffMember.position || staffMember.role || "직원",
        chipColorIndex: targetDraft.chipColorIndex,
        profileMessage: targetDraft.profileMessage.trim(),
      };
    });
  }

  async function saveBasicInfo() {
    setBasicInfoFeedback({ type: "idle", message: "" });

    const nextCustomerPageSettings = normalizeCustomerPageSettings(
      {
        ...data.shop.customer_page_settings,
        shop_name: name,
        tagline: description,
        hero_image_url: heroImageUrl.trim(),
        operating_hours_note: operatingHoursNote,
        holiday_notice: holidayNotice,
        parking_notice: parkingNotice,
        notices,
        show_notices: showNotices,
        show_parking_notice: showParkingNotice,
      },
      name,
      description,
    );
    const initialCustomerPageSettings = normalizeCustomerPageSettings(
      data.shop.customer_page_settings,
      decodeUnicodeEscapes(data.shop.name),
      decodeUnicodeEscapes(data.shop.description),
    );
    const combinedAddress = detailAddress.trim() ? `${address}, ${detailAddress.trim()}`.trim() : address;
    const hasChanges =
      name !== decodeUnicodeEscapes(data.shop.name) ||
      phone !== data.shop.phone ||
      combinedAddress !== decodeUnicodeEscapes(data.shop.address) ||
      description !== decodeUnicodeEscapes(data.shop.description) ||
      bookingSlotIntervalMinutes !== data.shop.booking_slot_interval_minutes ||
      bookingSlotOffsetMinutes !== data.shop.booking_slot_offset_minutes ||
      JSON.stringify(regularClosedDays) !== JSON.stringify(data.shop.regular_closed_days) ||
      JSON.stringify(temporaryClosedDates) !== JSON.stringify(data.shop.temporary_closed_dates) ||
      JSON.stringify(businessHours) !== JSON.stringify(createBusinessHoursState(data.shop.business_hours, data.shop.regular_closed_days)) ||
      JSON.stringify(notificationSettings) !== JSON.stringify(mapShopNotificationSettingsState(data.shop.notification_settings)) ||
      JSON.stringify(nextCustomerPageSettings) !== JSON.stringify(initialCustomerPageSettings);

    if (!hasChanges) {
      setIsBasicInfoEditing(false);
      setBasicInfoFeedback({ type: "success", message: "변경된 내용이 없어요." });
      return;
    }

    setSavingBasicInfo(true);

    try {

      await Promise.resolve(
        onSave({
          shopId: data.shop.id,
          name,
          phone,
          address: combinedAddress,
          description,
          concurrentCapacity: concurrentCapacityForApprovalMode(data.shop.approval_mode),
          bookingSlotIntervalMinutes: 15,
          bookingSlotOffsetMinutes: 0,
          bookingAvailableStartTime: data.shop.booking_available_start_time,
          bookingAvailableEndTime: data.shop.booking_available_end_time,
          reservationPolicySettings: {
            ...data.shop.reservation_policy_settings,
            booking_close_grace_minutes: bookingCloseGraceMinutes,
          },
          approvalMode: data.shop.approval_mode,
          regularClosedDays,
          temporaryClosedDates,
          businessHours,
          notificationSettings,
        }),
      );

      await Promise.resolve(
        onSaveCustomerPageSettings({
          shopId: data.shop.id,
          customerPageSettings: nextCustomerPageSettings,
        }),
      );

      setIsNotificationSettingsDirty(false);
      setIsBasicInfoEditing(false);
      setBasicInfoFeedback({ type: "success", message: "설정이 저장되었어요." });
    } catch (error) {
      const isCoreInfoLimitExceeded = error instanceof ApiRequestError && error.status === 429;
      setBasicInfoFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "설정을 저장하지 못했어요.",
        description: isCoreInfoLimitExceeded ? "추가 변경이 필요하면 설정의 1:1 문의로 요청해 주세요." : undefined,
      });
    } finally {
      setSavingBasicInfo(false);
    }
  }

  async function handleServiceSave(service: Service) {
    await Promise.resolve(
      onSaveService({
        shopId: data.shop.id,
        serviceId: service.id,
        name: editingServiceName.trim(),
        price: Number(editingServicePrice),
        priceType: editingServicePriceType,
        durationMinutes: Number(editingServiceDuration),
        isActive: editingServiceIsActive,
        category: service.category ?? "미용",
        description: service.description ?? "",
        sortOrder: service.sort_order ?? data.services.findIndex((item) => item.id === service.id) + 1,
        capacityLabel: service.capacity_label ?? "동일 시간 1건",
        staffSelectionMode: service.staff_selection_mode ?? "all",
        priceGuide: service.price_guide ?? {},
      }),
    );
    stopEditingService();
  }

  async function handleServiceCreate() {
    await Promise.resolve(
      onSaveService({
        shopId: data.shop.id,
        name: newService.name.trim(),
        price: Number(newService.price),
        priceType: newService.priceType,
        durationMinutes: Number(newService.duration),
        isActive: newService.isActive,
        category: "미용",
        description: "",
        sortOrder: data.services.length + 1,
        capacityLabel: "동일 시간 1건",
        staffSelectionMode: "all",
        priceGuide: {},
      }),
    );
    setNewService({ name: "", price: "", duration: "60", priceType: "starting", isActive: true });
    setIsNewServiceFormOpen(false);
  }

  async function handleStaffProfileSave(staffMember: BootstrapStaffMember) {
    setSavingStaffId(staffMember.id);
    setStaffFeedback({ type: "idle", message: "" });

    try {
      await Promise.resolve(
        onSaveStaffMembers({
          shopId: data.shop.id,
          staffMembers: buildStaffMembersPayload(staffMember),
        }),
      );
      setStaffFeedback({ type: "success", message: "직원 프로필이 저장되었어요." });
    } catch (error) {
      setStaffFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "직원 프로필을 저장하지 못했어요.",
      });
    } finally {
      setSavingStaffId(null);
    }
  }

  const subscriptionSection = subscriptionSummary ? (
    <section className="space-y-4">
      {(() => {
        const currentPlan = subscriptionSummary.currentPlan;
        const isTrialStatus =
          subscriptionSummary.status === "trialing" || subscriptionSummary.status === "trial_will_end";
        const showTrialCard =
          isTrialStatus &&
          !subscriptionSummary.currentPeriodEndsAt &&
          subscriptionSummary.lastPaymentStatus === "none";
        const isFreePlan = currentPlan.code === "free";
        const currentPlanTitle = isFreePlan || showTrialCard ? "체험 플랜" : OWNER_SINGLE_PLAN_NAME;
        const currentPlanLine = isFreePlan || showTrialCard
          ? "카드 등록 없이 이용 중"
          : getOwnerPlanStaffLimitLabel(currentPlan, currentTotalShopCount);
        const currentPlanPriceLabel = isFreePlan || showTrialCard ? "무료" : `월 ${won(currentPlan.monthlyPrice)}`;
        const currentPlanSubLabel = isFreePlan
          ? "관리자 설정"
          : showTrialCard
            ? "체험 플랜"
          : "현재 요금제로 이용 중";
        const endDateLabel = "서비스 종료일";
        const isInService =
          subscriptionSummary.status === "active" ||
          subscriptionSummary.status === "trialing" ||
          subscriptionSummary.status === "trial_will_end";
        const planCtaLabel = "요금제 확인";

        return (
      <div className="overflow-hidden rounded-[10px] border border-[#d9d4cb] bg-white shadow-[0_4px_12px_rgba(21,22,19,0.03)]">
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[12px] font-medium tracking-[0.02em] text-[#8a8277]">현재 플랜</p>
              <p className="mt-2 text-[22px] font-medium leading-none tracking-[-0.04em] text-[#171411]">
                {currentPlanTitle}
              </p>
              <p className="mt-2 text-[14px] font-normal leading-[1.45] text-[#6f675d]">{currentPlanLine}</p>
            </div>
            <div className="shrink-0 pt-0.5 text-right">
              <p className="text-[22px] font-medium leading-none tracking-[-0.04em] text-[#171411]">{currentPlanPriceLabel}</p>
              <p className="mt-2 text-[12px] font-normal text-[#8a8277]">
                {currentPlanSubLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-[#ebe5dc] pt-3.5">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-medium tracking-[0.02em] text-[#8a8277]">{endDateLabel}</p>
                <p className="mt-1 text-[17px] font-medium tracking-[-0.02em] text-[#171411]">{subscriptionEndDate}</p>
              </div>
              <Link
                href={`/owner/billing?compare=1&plan=${OWNER_CANONICAL_PLAN_CODE}`}
                prefetch
                onClick={() => writeOwnerBillingSummaryCache(subscriptionSummary)}
                className="inline-flex h-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent)] px-4 text-[14px] font-normal tracking-[-0.01em] text-white transition hover:bg-[#195748]"
              >
                {planCtaLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
        );
      })()}
    </section>
  ) : null;

  const shopSection = (
    <div className="rounded-[14px] border border-[#e2e7ed] bg-[#ffffff] p-3.5">
      <div>
        <input
          ref={profileImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleProfileImageChange(event.target.files?.[0] ?? null)}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-[-0.02em] text-[#0f172a]">{name || data.shop.name}</p>
          {isBasicInfoEditing ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={resetBasicInfoDraft}
                disabled={savingBasicInfo}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[#e2e7ed] bg-white px-4 text-[14px] font-medium text-[#64748b] disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveBasicInfo}
                disabled={savingBasicInfo}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[#2f6fd6] px-4 text-[14px] font-medium text-white disabled:opacity-50"
              >
                {savingBasicInfo ? "저장 중..." : "저장"}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-normal tracking-[-0.02em] text-[var(--text)]">{name || data.shop.name}</p>
              <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">
                저장하면 매장 전환 카드와 고객 예약 화면 대표 이미지에도 같이 반영돼요.
              </p>
            </div>
          </div>
        </SettingsFieldCard>

        <div className="grid gap-1.5 sm:grid-cols-2">
          <SettingsFieldCard label="매장명" className="pb-2 pt-2">
            <input
              className="relative -top-[4px] w-full bg-transparent p-0 text-[16px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="매장명을 입력해 주세요"
            />
          </SettingsFieldCard>
          <SettingsFieldCard label="업체 연락처" className="pb-2 pt-2">
            <input
              className="relative -top-[4px] w-full bg-transparent p-0 text-[16px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="연락처를 입력해 주세요"
            />
          </SettingsFieldCard>
        </div>

        <SettingsFieldCard label="한줄 소개" className="pb-2 pt-2">
          <textarea
            className="relative -top-[4px] min-h-[72px] w-full resize-none bg-transparent p-0 text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="고객에게 보여줄 매장 소개를 간단히 적어보세요."
          />
        </SettingsFieldCard>

        <SettingsFieldCard label="주소" className="pb-3 pt-2">
          <div className="relative -top-[4px] space-y-2.5">
            <button
              type="button"
              onClick={() => setIsAddressSearchOpen(true)}
              className="group min-h-[66px] w-full rounded-[14px] border border-[#e7dfd6] bg-white px-3.5 py-3 text-left transition hover:border-[#d9d0c5] hover:bg-[#fffdf9]"
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium leading-5 text-[#8f877d]">기본 주소</p>
                  <span className="shrink-0 text-[13px] font-medium leading-5 text-[var(--accent)]">
                    {address ? "변경" : "검색"}
                  </span>
                </div>
                <p className={`mt-1.5 break-words text-[15px] leading-[21px] ${address ? "font-normal text-[var(--text)]" : "text-[var(--muted)]"}`}>
                  {address || "도로명이나 건물명으로 주소를 찾아주세요"}
                </p>
              </div>
            </button>
            {address ? (
              <label className="block rounded-[14px] border border-[#ece5dd] bg-white px-3.5 py-3 shadow-[0_1px_4px_rgba(21,22,19,0.03)]">
                <span className="text-[13px] font-medium leading-5 text-[#8f877d]">상세주소</span>
                <input
                  ref={detailAddressInputRef}
                  className="mt-1.5 w-full bg-transparent p-0 text-[15px] leading-5 text-[var(--text)] outline-none placeholder:text-[#b4aca2]"
                  value={detailAddress}
                  onChange={(event) => setDetailAddress(event.target.value)}
                  placeholder="예: 2층, 101호, 미용실 입구"
                />
              </label>
            ) : null}
          </div>

        <SettingsFieldCard label="안내 문구 설정" className="mt-1.5 px-0 pb-0 pt-1">
          <div className="relative -top-[2px] divide-y divide-[#ebe5dc]">
            <div className="px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <p className="shrink-0 text-[16px] tracking-[-0.02em] text-[var(--text)]">주차 안내</p>
                  <button
                    type="button"
                    onClick={() => openNoticeEditor("parking")}
                    className="relative top-[1px] shrink-0 text-[11px] font-normal leading-none tracking-[-0.02em] text-[var(--accent)]"
                  >
                    수정
                  </button>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Switch
                    checked={showParkingNotice}
                    size="sm"
                    aria-label="주차 안내 노출"
                    onCheckedChange={setShowParkingNotice}
                  />
                  <InfoTip
                    ariaLabel="주차 안내 노출 설정"
                    size="small"
                    className="relative top-px"
                    popoverClassName="-left-[214px] w-[210px] rounded-[11px] text-[11px] leading-[18px]"
                  >
                    켜면 고객 예약 페이지에 주차 안내가 보여요. 끄면 문구는 저장되지만 고객에게 보이지 않아요.
                  </InfoTip>
                </div>
              </div>
              <div className="mt-0.5 w-full">
                <p className="truncate text-[12px] leading-[1.4] text-[var(--muted)]">{parkingNoticeSummary}</p>
              </div>
            </div>

            <div className="px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <p className="shrink-0 text-[16px] tracking-[-0.02em] text-[var(--text)]">예약 전 안내</p>
                  <button
                    type="button"
                    onClick={() => openNoticeEditor("notices")}
                    className="relative top-[1px] shrink-0 text-[11px] font-normal leading-none tracking-[-0.02em] text-[var(--accent)]"
                  >
                    수정
                  </button>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Switch
                    checked={showNotices}
                    size="sm"
                    aria-label="예약 전 안내 노출"
                    onCheckedChange={setShowNotices}
                  />
                  <InfoTip
                    ariaLabel="예약 전 안내 노출 설정"
                    size="small"
                    className="relative top-px"
                    popoverClassName="-left-[214px] w-[210px] rounded-[11px] text-[11px] leading-[18px]"
                  >
                    켜면 고객이 예약하기 전에 안내 문구를 확인해요. 끄면 문구는 저장되지만 예약 화면에는 숨겨져요.
                  </InfoTip>
                </div>
              </div>
              <div className="mt-0.5 w-full">
                <p className="truncate text-[12px] leading-[1.4] text-[var(--muted)]">{noticeSummary}</p>
              </div>
            </div>
          </div>

          <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[#475569]">상세주소</span>
          <input
            ref={detailAddressInputRef}
            disabled={!isBasicInfoEditing}
            className="h-[46px] w-full rounded-[9px] border border-[#e2e7ed] bg-[#fafbfc] px-3.5 text-[16px] font-normal text-[#1e293b] outline-none disabled:cursor-default disabled:text-[#475569]"
            value={detailAddress}
            onChange={(event) => setDetailAddress(event.target.value)}
            placeholder="예: 2층, 101호, 미용실 입구"
          />
          </label>

          {isBasicInfoEditing ? (
            <p className="mt-3 text-[12px] leading-4 text-[#94a3b8]">
              매장 정보는 월 2회까지 수정 가능합니다. 초과 변경은 1:1 문의로 가능합니다.
            </p>
          ) : null}
        </div>

        {basicInfoFeedback.type !== "idle" ? (
          <div
            className={`mt-3 rounded-[12px] px-3.5 py-2.5 text-[13px] font-medium ${
              basicInfoFeedback.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <p>{basicInfoFeedback.message}</p>
            {basicInfoFeedback.description ? (
              <p className="mt-1 text-[12px] leading-4 text-red-600">{basicInfoFeedback.description}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  const closuresSection = (
    <>
      <div className="mb-3 rounded-[14px] border border-[#e2e7ed] bg-white p-3.5">
        <div className="divide-y divide-[#edf1f5]">
          <button
            type="button"
            onClick={() => openBusinessHoursEditor("all")}
            className="flex min-h-14 w-full items-center justify-between gap-3 px-1 text-left"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 whitespace-nowrap text-[16px] font-medium leading-6 text-[#1e293b]">전체 시간 설정</span>
              <p className="min-w-0 truncate text-[16px] font-medium leading-6 text-[#334155]">{businessHoursSummary}</p>
            </div>
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#94a3b8]" strokeWidth={1.8} />
          </button>
          {businessHoursWeekOrder.map((day) => {
            const hours = getBusinessHour(day);
            const isClosed = regularClosedDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => openBusinessHoursEditor(day)}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-1 text-left"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`inline-flex w-14 shrink-0 items-center whitespace-nowrap text-[16px] leading-6 ${businessHoursRowValueWeightClass} ${day === 0 ? "text-[#e0594f]" : day === 6 ? "text-[#2f6fd6]" : "text-[#1e293b]"}`}>
                    {weekdayLabels[day]}요일
                  </span>
                  {isClosed ? (
                    <span className="inline-flex items-center rounded-[6px] bg-[#fdeeec] px-2 py-1 text-[14px] font-medium leading-5 text-[#b3453b]">휴무</span>
                  ) : (
                    <p className={`min-w-0 truncate text-[16px] leading-6 text-[#334155] ${businessHoursRowValueWeightClass}`}>{formatBusinessHoursRange(hours)}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#94a3b8]" strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      </div>

      <SettingsFieldCard label="마감 여유">
        <div className="space-y-2">
          <select
            value={bookingCloseGraceMinutes}
            onChange={(event) => setBookingCloseGraceMinutes(normalizeBookingCloseGraceMinutes(Number(event.target.value)))}
            className="min-h-[46px] w-full rounded-[14px] border border-[var(--border)] bg-white px-3.5 text-[16px] font-medium leading-6 text-[var(--text)] outline-none focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20"
          >
            {bookingCloseGraceMinuteOptions.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === 0 ? "여유 없음" : `${minutes}분${minutes === 15 ? " · 권장" : ""}`}
              </option>
            ))}
          </select>
          <p className="text-[13px] font-normal leading-5 text-[var(--muted)]">
            영업 마감 뒤 예약 종료를 허용할 여유입니다. 기존 매장은 여유 없음으로 유지됩니다.
          </p>
        </div>
      </SettingsFieldCard>

      <SettingsFieldCard label="특정 휴무일">
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="flex min-h-11 flex-1 items-center justify-between rounded-[9px] border border-[#e2e7ed] bg-[#fafbfc] px-3 text-[16px] font-medium leading-6 text-[#1e293b]"
              onClick={() => setIsClosedDatePickerOpen(true)}
            >
              <span>{pendingClosedDate || "날짜 선택"}</span>
              <CalendarDays className="h-4 w-4 text-[var(--muted)]" />
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[9px] border border-[#2f6fd6] bg-[#2f6fd6] text-white disabled:opacity-50"
              disabled={!pendingClosedDate}
              onClick={() => {
                addPendingClosedDate();
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>
          {temporaryClosedDates.length > 0 ? (
            <div className="space-y-2">
              {temporaryClosedDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between rounded-[9px] border border-[#e2e7ed] bg-[#f6f7f9] px-3 text-[14px] font-medium leading-5 text-[#1e293b]"
                  onClick={() => removeTemporaryClosedDate(date)}
                >
                  <span>{date}</span>
                  <span className="text-[12px] font-medium leading-[18px] text-[#94a3b8]">삭제</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

    </SettingsCard>
  );

  const notificationsSection = (
    <SettingsCard contentClassName="space-y-3">
      <SettingsFieldCard
        label="알림톡 발송"
        labelAccessory={
          <InfoTip ariaLabel="알림톡 설정 안내" popoverClassName="w-[248px]">
            매장 알림톡과 고객별 수신 설정이 모두 켜져 있어야 오너가 직접 알림을 보낼 수 있어요.
          </InfoTip>
        }
      >
        <div className="relative -top-[6px] space-y-1.5">
          <ToggleRow
            label="알림톡 전체 사용"
            checked={notificationSettings.enabled}
            onChange={(checked) => updateNotificationSettings((prev) => ({ ...prev, enabled: checked }))}
            emphasized
          />
          <div className="rounded-[12px] border border-[#e4ebe7] bg-[#f8fbfa] px-3 py-2.5">
            <p className="text-[12px] leading-[18px] tracking-[-0.01em] text-[#5f6c66]">
              알림톡은 {PETMANAGER_SERVICE_NAME} 공통 발신 프로필로 발송됩니다. 메시지 본문에는 매장명이
              표시됩니다.
            </p>
          </div>
          <div className="space-y-2">
            <ToggleRow
              label="예약 확정 안내"
              checked={notificationSettings.bookingConfirmedEnabled}
              onChange={(checked) => updateNotificationSettings((prev) => ({ ...prev, bookingConfirmedEnabled: checked }))}
              disabled={!notificationSettings.enabled}
            />
            <ToggleRow
              label="예약 취소 안내"
              checked={notificationSettings.bookingCancelledEnabled}
              onChange={(checked) => updateNotificationSettings((prev) => ({ ...prev, bookingCancelledEnabled: checked }))}
              disabled={!notificationSettings.enabled}
            />
            <ToggleRow
              label="예약 변경 안내"
              checked={notificationSettings.bookingRescheduledEnabled}
              onChange={(checked) => updateNotificationSettings((prev) => ({ ...prev, bookingRescheduledEnabled: checked }))}
              disabled={!notificationSettings.enabled}
            />
            <ToggleRow
              label="픽업 준비 안내"
              checked={notificationSettings.groomingAlmostDoneEnabled}
              onChange={(checked) => updateNotificationSettings((prev) => ({ ...prev, groomingAlmostDoneEnabled: checked }))}
              disabled={!notificationSettings.enabled}
            />
            <ToggleRow
              label="미용 완료 안내"
              checked={notificationSettings.groomingCompletedEnabled}
              onChange={(checked) => updateNotificationSettings((prev) => ({ ...prev, groomingCompletedEnabled: checked }))}
              disabled={!notificationSettings.enabled}
            />
          </div>
        </div>
      </SettingsFieldCard>
    </SettingsCard>
  );

  const servicesSection = (
    <SettingsCard>
      <div className="space-y-1">
        {data.services.map((service) => {
          const isEditing = editingServiceId === service.id;
          return (
            <div key={service.id}>
              {isEditing ? (
                <div className="space-y-2">
                  <SettingsFieldCard label="서비스 이름">
                    <input
                      className="w-full bg-transparent p-0 text-[15px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                      value={editingServiceName}
                      onChange={(event) => setEditingServiceName(event.target.value)}
                      placeholder="서비스 이름 입력"
                    />
                  </SettingsFieldCard>
                  <SettingsFieldCard label="가격">
                    <div className="flex items-center gap-2">
                      <input
                        className="min-w-0 flex-1 bg-transparent p-0 text-[15px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                        value={editingServicePrice}
                        onChange={(event) => setEditingServicePrice(event.target.value)}
                        placeholder="최소 가격 입력"
                      />
                      <span className="shrink-0 text-[14px] font-normal tracking-[-0.01em] text-[var(--muted)]">원</span>
                    </div>
                    <label className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
                      <span className="text-[14px] font-normal tracking-[-0.01em] text-[var(--text)]">시작가로 표시</span>
                      <input
                        className="h-4 w-4 accent-[var(--accent)]"
                        type="checkbox"
                        checked={editingServicePriceType === "starting"}
                        onChange={(event) => setEditingServicePriceType(event.target.checked ? "starting" : "fixed")}
                      />
                    </label>
                  </SettingsFieldCard>
                  <SettingsFieldCard label="노출 설정" className="pb-2.5 pt-2">
                    <label className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-normal tracking-[-0.01em] text-[var(--text)]">소비자 화면에 노출</p>
                        <p className="mt-0.5 text-[12px] leading-4 text-[var(--muted)]">고객 예약 화면에 바로 보여줘요.</p>
                      </div>
                      <input className="h-4 w-4 accent-[var(--accent)]" type="checkbox" checked={editingServiceIsActive} onChange={(event) => setEditingServiceIsActive(event.target.checked)} />
                    </label>
                  </SettingsFieldCard>
                  <div className="grid grid-cols-2 gap-2">
                    <OutlineButton onClick={stopEditingService}>취소</OutlineButton>
                    <SolidButton onClick={() => handleServiceSave(service)} disabled={!editingServiceName || !editingServicePrice}>
                      저장
                    </SolidButton>
                  </div>
                </div>
              ) : (
                <SettingsFieldCard label={service.name}>
                  <div className="relative -top-[3px] flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium tracking-[-0.02em] text-[var(--text)]">
                        가격 {formatServicePrice(service.price, service.price_type ?? "starting")}
                      </p>
                      {!service.is_active ? (
                        <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">소비자 화면에 노출되지 않아요.</p>
                      ) : null}
                    </div>
                    <button className="shrink-0 text-[14px] font-medium text-[var(--accent)]" onClick={() => startEditingService(service)}>
                      수정
                    </button>
                  </div>
                </SettingsFieldCard>
              )}
            </div>
          );
        })}

        {isNewServiceFormOpen ? (
          <div className="space-y-2 rounded-[10px] border border-[#d9e6e0] bg-[#f8fcfa] px-2.5 py-2.5">
              <SettingsFieldCard label="서비스 이름">
                <input
                  className="w-full bg-transparent p-0 text-[15px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  placeholder="서비스 이름 입력"
                  value={newService.name}
                  onChange={(event) => setNewService((prev) => ({ ...prev, name: event.target.value }))}
                />
              </SettingsFieldCard>
              <SettingsFieldCard label="가격">
                <div className="flex items-center gap-2">
                  <input
                    className="min-w-0 flex-1 bg-transparent p-0 text-[15px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                    placeholder="최소 가격 입력"
                    value={newService.price}
                    onChange={(event) => setNewService((prev) => ({ ...prev, price: event.target.value }))}
                  />
                  <span className="shrink-0 text-[14px] font-normal tracking-[-0.01em] text-[var(--muted)]">원</span>
                </div>
                <label className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
                  <span className="text-[14px] font-normal tracking-[-0.01em] text-[var(--text)]">시작가로 표시</span>
                  <input
                    className="h-4 w-4 accent-[var(--accent)]"
                    type="checkbox"
                    checked={newService.priceType === "starting"}
                    onChange={(event) => setNewService((prev) => ({ ...prev, priceType: event.target.checked ? "starting" : "fixed" }))}
                  />
                </label>
              </SettingsFieldCard>
              <SettingsFieldCard label="노출 설정" className="pb-2.5 pt-2">
                <label className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-normal tracking-[-0.01em] text-[var(--text)]">소비자 화면에 노출</p>
                    <p className="mt-0.5 text-[12px] leading-4 text-[var(--muted)]">고객 예약 화면에 바로 보여줘요.</p>
                  </div>
                  <input className="h-4 w-4 accent-[var(--accent)]" type="checkbox" checked={newService.isActive} onChange={(event) => setNewService((prev) => ({ ...prev, isActive: event.target.checked }))} />
                </label>
              </SettingsFieldCard>
              <div className="grid grid-cols-2 gap-2">
                <OutlineButton
                  onClick={() => {
                    setIsNewServiceFormOpen(false);
                    setNewService({ name: "", price: "", duration: "60", priceType: "starting", isActive: true });
                  }}
                >
                  취소
                </OutlineButton>
                <SolidButton onClick={() => void handleServiceCreate()} disabled={!newService.name || !newService.price}>
                  추가
                </SolidButton>
              </div>
          </div>
        ) : null}

        {!isNewServiceFormOpen ? (
        <div className="pt-1">
          <button
            type="button"
            className="w-full rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-3 py-[11px] text-[14px] font-medium text-white"
            onClick={() => setIsNewServiceFormOpen(true)}
          >
            서비스 추가
          </button>
        </div>
        ) : null}
      </div>
    </SettingsCard>
  );

  const accountSection = onLogout ? (
    <SettingsCard>
      <div className="divide-y divide-[var(--border)]">
          {accountEmail ? <AccountRow icon={UserRound} label="로그인 이메일" value={accountEmail} /> : null}
        <AccountRow href="/login/reset" icon={KeyRound} label="비밀번호 재설정" />
        {appRole === "owner" ? <OwnerAccountDeletionPanel onDeleted={onLogout} /> : null}
        <AccountActionRow icon={LogOut} label={loggingOut ? "로그아웃 중..." : "로그아웃"} onClick={onLogout} disabled={loggingOut} />
      </div>
    </SettingsCard>
  ) : null;

  const staffSection = (
    <SettingsCard contentClassName="space-y-3">
      <div className="space-y-1">
        <p className="text-[16px] font-semibold tracking-[-0.03em] text-[var(--text)]">직원 프로필</p>
        <p className="text-[13px] leading-5 text-[var(--muted)]">
          고객 예약 첫 화면에 보일 직원 사진, 표시 이름, 상태메시지를 관리해요.
        </p>
      </div>
      {data.staffMembers.map((staffMember) => {
        const draft = staffProfileDrafts[staffMember.id] ?? createStaffProfileDraft(staffMember);
        const displayName = draft.displayName.trim() || draft.name.trim() || staffMember.name;
        const avatarLabel = displayName.slice(0, 1);
        const imageInputId = `staff-profile-image-${staffMember.id}`;

        return (
          <SettingsFieldCard key={staffMember.id} label={displayName} className="pb-3 pt-3">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-[62px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-[var(--accent-soft)] text-[22px] font-semibold text-[var(--accent)]">
                  {draft.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.profileImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    avatarLabel
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{displayName}</p>
                  <p className="mt-0.5 truncate text-[12px] leading-4 text-[var(--muted)]">
                    {[draft.titlePrefix, draft.position].filter(Boolean).join(" · ") || "고객에게 보일 프로필"}
                  </p>
                  <input
                    id={imageInputId}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleStaffProfileImageChange(staffMember.id, event)}
                  />
                  <label
                    htmlFor={imageInputId}
                    className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-white px-3 text-[12px] font-semibold text-[var(--text)]"
                  >
                    <Camera className="h-3.5 w-3.5" strokeWidth={2.2} />
                    사진 올리기
                  </label>
                  {draft.profileImageUrl ? (
                    <button
                      type="button"
                      onClick={() => updateStaffProfileDraft(staffMember.id, { profileImageUrl: "" })}
                      className="ml-2 inline-flex h-9 items-center rounded-[10px] px-2 text-[12px] font-semibold text-[var(--muted)]"
                    >
                      사진 지우기
                    </button>
                  ) : null}
                </div>
              </div>

              <StaffProfileEditField label="직원 이름">
                <input
                  className="w-full bg-transparent p-0 text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  value={draft.name}
                  onChange={(event) => updateStaffProfileDraft(staffMember.id, { name: event.target.value })}
                  placeholder="직원 이름"
                />
              </StaffProfileEditField>

              <StaffProfileEditField label="고객 표시 이름">
                <input
                  className="w-full bg-transparent p-0 text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  value={draft.displayName}
                  onChange={(event) => updateStaffProfileDraft(staffMember.id, { displayName: event.target.value })}
                  placeholder="예: 정우진 원장"
                />
              </StaffProfileEditField>

              <div className="grid grid-cols-2 gap-2">
                <StaffProfileEditField label="호칭">
                  <input
                    className="w-full bg-transparent p-0 text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                    value={draft.titlePrefix}
                    onChange={(event) => updateStaffProfileDraft(staffMember.id, { titlePrefix: event.target.value })}
                    placeholder="원장"
                  />
                </StaffProfileEditField>
                <StaffProfileEditField label="역할">
                  <input
                    className="w-full bg-transparent p-0 text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                    value={draft.position}
                    onChange={(event) => updateStaffProfileDraft(staffMember.id, { position: event.target.value })}
                    placeholder="대표 미용사"
                  />
                </StaffProfileEditField>
              </div>

              <StaffProfileEditField label="상태메시지">
                <textarea
                  className="min-h-[82px] w-full resize-none bg-transparent p-0 text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  value={draft.profileMessage}
                  onChange={(event) => updateStaffProfileDraft(staffMember.id, { profileMessage: event.target.value })}
                  placeholder={defaultStaffProfileMessage}
                />
              </StaffProfileEditField>

              <SolidButton
                onClick={() => void handleStaffProfileSave(staffMember)}
                disabled={savingStaffId === staffMember.id}
              >
                {savingStaffId === staffMember.id ? "저장 중..." : "프로필 저장"}
              </SolidButton>
            </div>
          </SettingsFieldCard>
        );
      })}
      {staffFeedback.message ? (
        <p className={`text-[13px] leading-5 ${staffFeedback.type === "error" ? "text-[#c43d3d]" : "text-[var(--accent)]"}`}>
          {staffFeedback.message}
        </p>
      ) : null}
    </SettingsCard>
  );

  const addonsSection = (
    <SettingsCard>
      <SettingsFieldCard
        label="업장 추가"
        className="pb-3 pt-2.5"
        labelAccessory={
          <InfoTip ariaLabel="부가기능 안내" popoverClassName="w-[248px]">
            업장 추가는 별도 문의가 필요한 부가 기능입니다.
          </InfoTip>
        }
      >
        <div className="space-y-3 px-0.5 pt-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[16px] font-normal tracking-[-0.02em] text-[var(--text)]">업장 추가</p>
              <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">
                여러 지점이나 다른 매장을 함께 운영하시나요?
              </p>
            </div>
            <div className="shrink-0 rounded-[10px] border border-[#dfe8e2] bg-[#f8fcfa] px-3 py-2 text-right">
              <p className="text-[12px] font-medium text-[#7a736b]">부가 기능</p>
              <p className="mt-0.5 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">별도 문의</p>
            </div>
          </div>
          <div className="rounded-[10px] border border-[var(--border)] bg-[#fcfaf7] px-3.5 py-3">
            <div className="space-y-1.5 text-[13px] leading-5 text-[var(--muted)]">
              <p>• 추가 업장은 별도 문의로 안내드려요.</p>
              <p>• 같은 사업자 또는 동일 운영 조건에 따라 할인 적용이 가능할 수 있어요.</p>
            </div>
          </div>
          {data.shop.customer_page_settings?.kakao_inquiry_url ? (
            <a
              href={data.shop.customer_page_settings.kakao_inquiry_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-[40px] items-center justify-center rounded-[10px] border border-[var(--border)] bg-white px-4 text-[14px] font-normal text-[var(--text)]"
            >
              업장 추가 문의하기
            </a>
          ) : null}
        </div>
      </SettingsFieldCard>
    </SettingsCard>
  );

  const screenMap: Record<Exclude<SettingsScreen, null>, { title: string; content: ReactNode }> = {
    subscription: { title: "현재 플랜", content: subscriptionSection },
    shop: { title: "매장 기본 정보", content: shopSection },
    closures: { title: "영업 시간 설정", content: closuresSection },
    notifications: { title: "알림톡 설정", content: notificationsSection },
    services: { title: "미용 요금", content: servicesSection },
    staff: { title: "직원관리", content: staffSection },
    addons: { title: "부가기능", content: addonsSection },
    account: { title: "계정", content: accountSection },
  };

  if (activeScreen) {
    const isShopScreen = activeScreen === "shop";
    const isClosuresScreen = activeScreen === "closures";
    const isNotificationsScreen = activeScreen === "notifications";
    const shouldShowSaveFooter = isShopScreen || isClosuresScreen || isNotificationsScreen;
    const saveButtonLabel = isClosuresScreen ? "운영 정보 저장" : isNotificationsScreen ? "알림톡 설정 저장" : "매장정보 저장";

    return (
      <section className={`space-y-4 p-4 ${shouldShowSaveFooter ? "pb-[calc(env(safe-area-inset-bottom)+116px)]" : ""}`}>
        <div className={`${isShopScreen ? "overflow-visible" : "overflow-hidden"} border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] ${isClosuresScreen ? "rounded-[16px]" : "rounded-[10px]"}`}>
          {screenMap[activeScreen].content}
        </div>

        {shouldShowSaveFooter ? (
          <div className="pointer-events-none fixed bottom-[76px] left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-4">
            <div className="pointer-events-auto space-y-2 rounded-[18px] bg-[rgba(248,246,242,0.94)] px-2 pb-[calc(env(safe-area-inset-bottom)+4px)] pt-3 shadow-[0_10px_30px_rgba(21,22,19,0.08)] backdrop-blur">
              {basicInfoFeedback.type !== "idle" ? (
                <div
                  className={`rounded-[14px] px-4 py-2.5 text-[13px] font-medium ${
                    basicInfoFeedback.type === "success"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {basicInfoFeedback.message}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="[overflow-wrap:anywhere] text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#0f172a]">{displayName}</p>
                  <p className="mt-1 [overflow-wrap:anywhere] text-[14px] font-normal leading-5 text-[#64748b]">
                    {profileRoleLine}
                  </p>
                </div>
              </div>

              <fieldset data-staff-profile-preset-picker className="space-y-2.5">
                <legend className="text-[14px] font-medium leading-5 text-[#334155]">기본 프로필</legend>
                <div className="grid grid-cols-2 gap-3">
                  {staffProfileFallbackKeys.map((fallbackKey, index) => {
                    const selected = draft.profileImageFallbackKey === fallbackKey;
                    return (
                      <button
                        key={fallbackKey}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`기본 프로필 ${index + 1}`}
                        onClick={() => {
                          updateStaffProfileDraft(staffMember.id, { profileImageFallbackKey: fallbackKey });
                          if (staffProfileChoiceErrorStaffId === staffMember.id) {
                            setStaffProfileChoiceErrorStaffId(null);
                            setStaffFeedback({ type: "idle", message: "" });
                          }
                        }}
                        className={`relative flex min-h-[96px] items-center justify-center rounded-[12px] border bg-white p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fd6] focus-visible:ring-offset-2 ${
                          selected ? "border-[#111a30]" : "border-[#e2e7ed]"
                        }`}
                      >
                        <span className="h-[72px] w-[72px] overflow-hidden rounded-full bg-[#f4f6f8]">
                          <StaffProfilePhoto
                            fallbackKey={fallbackKey}
                            alt={`기본 프로필 ${index + 1}`}
                          />
                        </span>
                        {selected ? (
                          <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#111a30] text-white" aria-hidden="true">
                            <Check className="h-3 w-3" strokeWidth={2.2} />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {staffProfileChoiceErrorStaffId === staffMember.id ? (
                  <p className="text-[13px] font-normal leading-5 text-[#b3453b]" role="alert">
                    기본 프로필 이미지 두 개 중 하나를 선택해 주세요.
                  </p>
                ) : null}
              </fieldset>

              <StaffProfileEditField label="직원 이름">
                <input
                  className="w-full bg-transparent p-0 text-[16px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  value={draft.name}
                  onChange={(event) => updateStaffProfileDraft(staffMember.id, { name: event.target.value })}
                  placeholder="직원 이름"
                />
              </StaffProfileEditField>

              <StaffProfileEditField label="고객 표시 이름">
                <input
                  className="w-full bg-transparent p-0 text-[16px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  value={draft.displayName}
                  onChange={(event) => updateStaffProfileDraft(staffMember.id, { displayName: event.target.value })}
                  placeholder="예: 정우진 원장"
                />
              </StaffProfileEditField>

              <div className="grid grid-cols-2 gap-2">
                <StaffProfileEditField label="호칭">
                  <input
                    className="w-full bg-transparent p-0 text-[16px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                    value={draft.titlePrefix}
                    onChange={(event) => updateStaffProfileDraft(staffMember.id, { titlePrefix: event.target.value })}
                    placeholder="원장"
                  />
                </StaffProfileEditField>
                <StaffProfileEditField label="역할">
                  <input
                    className="w-full bg-transparent p-0 text-[16px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                    value={draft.position}
                    onChange={(event) => updateStaffProfileDraft(staffMember.id, { position: event.target.value })}
                    placeholder="대표 미용사"
                  />
                </StaffProfileEditField>
              </div>

              <StaffProfileEditField label="상태메시지">
                <textarea
                  className="min-h-[82px] w-full resize-none bg-transparent p-0 text-[16px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  value={draft.profileMessage}
                  onChange={(event) => updateStaffProfileDraft(staffMember.id, { profileMessage: event.target.value })}
                  placeholder={defaultStaffProfileMessage}
                />
              </StaffProfileEditField>

              <SolidButton
                onClick={() => void handleStaffProfileSave(staffMember)}
                disabled={savingStaffId === staffMember.id}
              >
                {savingStaffId === staffMember.id ? "저장 중..." : "프로필 저장"}
              </SolidButton>
            </div>
          </div>
        );
      })}
      {staffFeedback.message ? (
        <p className={`text-[13px] leading-5 ${staffFeedback.type === "error" ? "text-[#c43d3d]" : "text-[var(--accent)]"}`}>
          {staffFeedback.message}
        </p>
      ) : null}
    </div>
  );

  const supportSection = (
    <OwnerSupportPanel
      data={data}
      userEmail={userEmail}
    />
  );

  const legalSection = (
    <SettingsCard contentClassName="space-y-4">
      <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-white divide-y divide-[var(--border)]">
        {PUBLIC_LEGAL_LINKS.map((link) => (
          <a
            key={link.key}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[54px] items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="min-w-0 text-[16px] font-medium text-[var(--text)]">{link.label}</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={1.9} />
          </a>
        ))}
      </div>

      <div className="rounded-[14px] border border-[var(--border)] bg-white px-4 py-4">
        <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">고객 및 개인정보 문의</h3>
        <div className="mt-3 space-y-2 text-[14px] leading-6 text-[var(--muted)]">
          <p>상호: {PUBLIC_LEGAL_CONTACT.companyName}</p>
          <p>대표자: {PUBLIC_LEGAL_CONTACT.representativeName}</p>
          <p>사업자등록번호: {PUBLIC_LEGAL_CONTACT.businessRegistrationNumber}</p>
        </div>
        <div className="mt-4 overflow-hidden rounded-[12px] border border-[var(--border)] divide-y divide-[var(--border)]">
          <a href={getPublicLegalTelHref()} className="flex min-h-[50px] items-center justify-between gap-3 px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={1.9} />
              <span className="text-[14px] font-medium text-[var(--text)]">{PUBLIC_LEGAL_CONTACT.phone}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={1.9} />
          </a>
          <a href={getPublicLegalMailtoHref()} className="flex min-h-[50px] items-center justify-between gap-3 px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={1.9} />
              <span className="truncate text-[14px] font-medium text-[var(--text)]">{PUBLIC_LEGAL_CONTACT.email}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={1.9} />
          </a>
        </div>
      </div>
    </SettingsCard>
  );

  const appNotificationsSection = (
    <OwnerAppNotificationSettings
      shopId={data.shop.id}
      staffMemberId={appRole === "staff" ? currentStaff?.id ?? currentStaffId : null}
      appRole={appRole}
      onBack={() => updateActiveScreen(null)}
    />
  );
  const appPermissionsSection = <OwnerAppPermissionsSettings />;

  const priceGuideSection = (
    <MobileAiPriceGuideFixture
      shopId={data.shop.id}
      initialRows={priceGuideState?.rows ?? null}
      initialDocument={priceGuideState?.document ?? null}
      initialServiceId={priceGuideState?.serviceId ?? null}
      initialResumeMode={priceGuideState?.resumeMode}
      onComplete={(_rows, state) => {
        setPriceGuideState(state ?? null);
        writeOwnerPriceGuideSessionDraft(priceGuideSessionKey, null);
        setIsPriceGuideOpen(false);
      }}
      onExit={(_rows, state) => {
        setPriceGuideState(state ?? null);
        writeOwnerPriceGuideSessionDraft(priceGuideSessionKey, state ?? null);
        setIsPriceGuideOpen(false);
      }}
    />
  );

  const screenMap: Record<Exclude<SettingsScreen, null>, { title: string; content: ReactNode }> = {
    shop: { title: "매장 기본 정보", content: shopSection },
    closures: { title: "영업·예약 시간", content: closuresSection },
    price: { title: "서비스 요금 설정", content: priceGuideSection },
    notifications: { title: "고객 알림톡", content: notificationsSection },
    appNotifications: { title: "내 앱 알림", content: appNotificationsSection },
    appPermissions: { title: "앱 권한", content: appPermissionsSection },
    staff: { title: "직원 관리", content: staffSection },
    support: { title: "1:1 문의", content: supportSection },
    legal: { title: "약관 및 정책", content: legalSection },
    account: { title: "계정", content: accountSection },
  };

  if (effectiveActiveScreen === "price") {
    return <section className="min-h-full bg-[#F4F5F7] py-4">{priceGuideSection}</section>;
  }

  if (effectiveActiveScreen) {
    const isShopScreen = effectiveActiveScreen === "shop";
    const isClosuresScreen = effectiveActiveScreen === "closures";
    const isStaffScreen = effectiveActiveScreen === "staff";

    return (
      <section className="space-y-4 p-4">
        {isShopScreen || isClosuresScreen || isStaffScreen ? (
          screenMap[effectiveActiveScreen].content
        ) : (
          <div className={`overflow-hidden border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] ${isClosuresScreen ? "rounded-[16px]" : "rounded-[10px]"}`}>
            {screenMap[effectiveActiveScreen].content}
          </div>
        )}

        {noticeEditorTarget !== null ? (
          <GuideMessagesSheet
            title={noticeEditorTarget === "parking" ? "주차 안내 수정" : "예약 전 안내 수정"}
            description={
              noticeEditorTarget === "parking"
                ? "고객 예약 화면에 보여줄 주차 안내 문구를 편집해 주세요."
                : "고객 예약 전에 보여줄 안내 문구를 편집해 주세요."
            }
            onClose={() => setNoticeEditorTarget(null)}
            onApply={applyNoticeEditor}
          >
            {noticeEditorTarget === "parking" ? (
              <SettingsFieldCard label="주차 안내 문구" className="pt-1.5">
                <textarea
                  className="min-h-[104px] w-full resize-none bg-transparent p-0 text-[16px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  value={parkingNoticeDraft}
                  onChange={(event) => setParkingNoticeDraft(event.target.value)}
                  placeholder="예: 건물 뒤편 공용 주차장을 이용해 주세요."
                />
              </SettingsFieldCard>
            ) : (
              <div className="space-y-2.5">
                {noticeDrafts.map((notice, index) => (
                  <SettingsFieldCard key={index} label={`안내 문구 ${index + 1}`} className="pt-1.5">
                    <input
                      className="w-full bg-transparent p-0 text-[16px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                      value={notice}
                      onChange={(event) =>
                        setNoticeDrafts((prev) => prev.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                      }
                      placeholder={
                        index === 0
                          ? "예: 첫 방문은 상담 포함으로 여유 있게 예약해 주세요."
                          : index === 1
                            ? "예: 휴무, 준비사항, 참고 안내를 편하게 남겨보세요."
                            : "예: 고객에게 미리 보여줄 안내를 간단히 적어주세요."
                      }
                    />
                  </SettingsFieldCard>
                ))}
              </div>
            )}
          </GuideMessagesSheet>
        ) : null}

        {timeEditorTarget !== null ? (
          <BusinessHoursSheet
            title={timeEditorTarget === "all" ? "전체 시간 설정" : `${weekdayLabels[timeEditorTarget]}요일 시간 설정`}
            draft={timeDraft}
            showClosedToggle={timeEditorTarget !== "all"}
            saving={savingOperatingInfo}
            errorMessage={operatingInfoFeedback.type === "error" ? operatingInfoFeedback.message : null}
            onClose={() => {
              if (!savingOperatingInfo) setTimeEditorTarget(null);
            }}
            onChange={(nextDraft) => setTimeDraft(nextDraft)}
            onApply={applyBusinessHoursEditor}
          />
        ) : null}

        {isClosedDatePickerOpen ? (
          <ClosedDatePickerSheet
            monthLabel={closedDateMonthLabel}
            monthCursor={closedDateMonthCursor}
            selectedDate={pendingClosedDate}
            cells={closedDateMonthCells}
            onClose={() => setIsClosedDatePickerOpen(false)}
            onPrevMonth={() => setClosedDateMonthCursor((prev) => shiftMonth(prev, -1))}
            onNextMonth={() => setClosedDateMonthCursor((prev) => shiftMonth(prev, 1))}
            onSelectDate={setPendingClosedDate}
            onApply={addPendingClosedDate}
          />
        ) : null}

        {isAddressSearchOpen ? (
          <KakaoPostcodeSheet
            onClose={() => setIsAddressSearchOpen(false)}
            initialQuery={address}
            onSelect={handleAddressSelect}
          />
        ) : null}
      </section>
    );
  }

  if (isStaffApp) {
    return (
      <StaffSettingsHome
        staffMember={currentStaff}
        shopName={decodeUnicodeEscapes(data.shop.name)}
        accountEmail={accountEmail}
        onSupportClick={() => updateActiveScreen("support")}
        onLegalClick={() => updateActiveScreen("legal")}
        onAccountClick={onLogout ? () => updateActiveScreen("account") : undefined}
      />
    );
  }

      <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white shadow-[var(--shadow-soft)] divide-y divide-[var(--border)]">
        <SettingsNavRow
          icon={Store}
          title="매장 기본 정보"
          onClick={() => updateActiveScreen("shop")}
        />
        <SettingsNavRow
          icon={CalendarDays}
          title="영업 시간 설정"
          onClick={() => updateActiveScreen("closures")}
        />
        <SettingsNavRow
          icon={Plus}
          title="부가기능"
          onClick={() => updateActiveScreen("addons")}
        />
        <SettingsNavRow
          icon={UserRound}
          title="직원관리"
          onClick={() => updateActiveScreen("staff")}
        />
        {onLogout ? (
          <SettingsNavRow
            icon={UserRound}
            title="계정"
            onClick={() => updateActiveScreen("account")}
          />
        ) : null}
      </div>

      {isClosedDatePickerOpen ? (
        <ClosedDatePickerSheet
          monthLabel={closedDateMonthLabel}
          monthCursor={closedDateMonthCursor}
          selectedDate={pendingClosedDate}
          cells={closedDateMonthCells}
          onClose={() => setIsClosedDatePickerOpen(false)}
          onPrevMonth={() => setClosedDateMonthCursor((prev) => shiftMonth(prev, -1))}
          onNextMonth={() => setClosedDateMonthCursor((prev) => shiftMonth(prev, 1))}
          onSelectDate={setPendingClosedDate}
          onApply={addPendingClosedDate}
        />
      ) : null}

      {isAddressSearchOpen ? (
        <KakaoPostcodeSheet
          onClose={() => setIsAddressSearchOpen(false)}
          initialQuery={address}
          onSelect={handleAddressSelect}
        />
      ) : null}
    </>
  );
}

function GuideMessagesSheet({
  title,
  description,
  children,
  onClose,
  onApply,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-[430px] rounded-t-[28px] bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-stone-200" />
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[20px] font-semibold leading-7 text-[var(--text)]">{title}</h3>
            <p className="mt-0.5 text-xs leading-4 text-[var(--muted)]">{description}</p>
          </div>
          <button className="text-sm font-semibold text-[var(--muted)]" onClick={onClose}>닫기</button>
        </div>

        <div className="space-y-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
          {children}
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <OutlineButton onClick={onClose}>취소</OutlineButton>
          <SolidButton onClick={onApply}>적용</SolidButton>
        </div>
      </div>
    </div>
  );
}

function BusinessHoursSheet({
  title,
  draft,
  showClosedToggle,
  saving,
  errorMessage,
  onClose,
  onChange,
  onApply,
}: {
  title: string;
  draft: { open: string; close: string; closed: boolean };
  showClosedToggle: boolean;
  saving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onChange: (draft: { open: string; close: string; closed: boolean }) => void;
  onApply: () => void | Promise<void>;
}) {
  const openInputId = useId();
  const closeInputId = useId();
  const rangeErrorId = useId();
  const titleId = useId();
  const hasInvalidRange = !draft.closed && !isOrderedTimeRange(draft.open, draft.close);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-6" onClick={() => {
      if (!saving) onClose();
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100dvh-48px)] w-full max-w-[398px] overflow-y-auto rounded-[18px] bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div>
            <h3 id={titleId} className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[var(--text)]">{title}</h3>
          </div>
          <button
            type="button"
            disabled={saving}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-[10px] px-2 text-[16px] font-medium leading-6 text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
            onClick={onClose}
          >닫기</button>
        </div>

        <div className="space-y-3">
          {showClosedToggle ? (
            <button
              type="button"
              role="switch"
              aria-checked={draft.closed}
              disabled={saving}
              onClick={() => onChange({ ...draft, closed: !draft.closed })}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="min-w-0">
                <p className="text-[16px] font-medium tracking-[-0.02em] text-[var(--text)]">휴무일로 설정</p>
              </div>
              <Switch
                checked={draft.closed}
                aria-label="휴무일로 설정"
                onCheckedChange={(checked) => onChange({ ...draft, closed: checked })}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5">
            <label htmlFor={openInputId} className="block rounded-[10px] border border-[var(--border)] bg-white px-3.5 py-2.5 focus-within:border-[#2563eb] focus-within:ring-2 focus-within:ring-[#2563eb]/15">
              <span className="mb-1.5 block text-[14px] font-medium leading-5 text-[var(--muted)]">시작 시간</span>
              <input
                id={openInputId}
                type="time"
                step={300}
                aria-invalid={hasInvalidRange}
                aria-describedby={hasInvalidRange ? rangeErrorId : undefined}
                className="min-h-11 w-full bg-transparent p-0 text-[16px] font-medium leading-6 tabular-nums tracking-[-0.02em] text-[var(--text)] outline-none"
                value={draft.open}
                onChange={(event) => onChange({ ...draft, open: event.target.value })}
                disabled={draft.closed || saving}
              />
            </label>
            <label htmlFor={closeInputId} className="block rounded-[10px] border border-[var(--border)] bg-white px-3.5 py-2.5 focus-within:border-[#2563eb] focus-within:ring-2 focus-within:ring-[#2563eb]/15">
              <span className="mb-1.5 block text-[14px] font-medium leading-5 text-[var(--muted)]">마감 시간</span>
              <input
                id={closeInputId}
                type="time"
                step={300}
                aria-invalid={hasInvalidRange}
                aria-describedby={hasInvalidRange ? rangeErrorId : undefined}
                className="min-h-11 w-full bg-transparent p-0 text-[16px] font-medium leading-6 tabular-nums tracking-[-0.02em] text-[var(--text)] outline-none"
                value={draft.close}
                onChange={(event) => onChange({ ...draft, close: event.target.value })}
                disabled={draft.closed || saving}
              />
            </label>
          </div>
          {hasInvalidRange ? (
            <p id={rangeErrorId} role="alert" className="text-[13px] font-medium leading-5 text-[#a04455]">
              마감 시간은 시작 시간보다 늦게 설정해 주세요.
            </p>
          ) : null}
          {errorMessage ? <p role="alert" className="text-[13px] font-medium leading-5 text-[#a04455]">{errorMessage}</p> : null}
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <OutlineButton className="text-[16px] font-medium leading-6" disabled={saving} onClick={onClose}>취소</OutlineButton>
          <SolidButton className="text-[16px] font-medium leading-6" disabled={saving || hasInvalidRange} onClick={onApply}>{saving ? "저장 중..." : "적용"}</SolidButton>
        </div>
      </div>
    </div>
  );
}

function ClosedDatePickerSheet({
  monthCursor,
  monthLabel,
  selectedDate,
  cells,
  onClose,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onApply,
}: {
  monthCursor: string;
  monthLabel: string;
  selectedDate: string;
  cells: Array<string | null>;
  onClose: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-[430px] rounded-t-[28px] bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[var(--text)]">특정 휴무일 추가</h3>
          </div>
          <button className="min-h-11 min-w-11 text-[14px] font-medium leading-5 text-[var(--muted)]" onClick={onClose}>닫기</button>
        </div>
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text)]" onClick={onPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-[14px] font-medium leading-5 text-[var(--text)]">{monthLabel}</p>
            <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text)]" onClick={onNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-2">
            {weekdayLabels.map((label) => (
              <div key={label} className="text-center text-[12px] font-medium leading-[18px] text-[var(--muted)]">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((date, index) => {
              if (!date) return <div key={`${monthCursor}-${index}`} className="h-11" />;
              const active = selectedDate === date;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => onSelectDate(date)}
                  className={`h-11 rounded-[16px] text-[14px] font-medium leading-5 transition ${
                    active ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-white text-[var(--text)]"
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <OutlineButton onClick={onClose}>취소</OutlineButton>
          <SolidButton onClick={onApply} disabled={!selectedDate}>확인</SolidButton>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  title,
  children,
  className = "",
  contentClassName = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={`px-4 py-4 ${className}`.trim()}>
      {title ? (
        <div className="mb-2">
          <h2 className="text-[18px] font-medium tracking-[-0.02em] text-[var(--text)]">{title}</h2>
        </div>
      ) : null}
      <div className={`${contentClassName || "space-y-1"} ${title ? "pt-2.5" : ""}`.trim()}>{children}</div>
    </section>
  );
}

function SettingsNavRow({
  icon: Icon,
  title,
  value,
  onClick,
  href,
}: {
  icon: LucideIcon;
  title: string;
  value?: string;
  onClick?: () => void;
  href?: string;
}) {
  const isActionable = Boolean(onClick || href);
  const className =
    "flex min-h-[56px] w-full items-center gap-3 bg-white px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]";
  const content = (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f2f6fb] text-[#475467]">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-medium leading-6 tracking-[-0.02em] text-[#101828]">{title}</p>
        {value ? (
          <p className="mt-0.5 break-words text-[14px] font-normal leading-5 text-[#667085] [overflow-wrap:anywhere]">
            {value}
          </p>
        ) : null}
      </div>
      {isActionable ? <ChevronRight className="h-4 w-4 shrink-0 text-[#98a2b3]" strokeWidth={1.9} /> : null}
    </>
  );

  if (href) return <a href={href} className={className}>{content}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={className}>{content}</button>;
  return <div className={className}>{content}</div>;
}

function StaffSettingsHome({
  staffMember,
  shopName,
  accountEmail,
  onSupportClick,
  onLegalClick,
  onAccountClick,
}: {
  staffMember: BootstrapStaffMember | null;
  shopName: string;
  accountEmail: string | null;
  onSupportClick: () => void;
  onLegalClick: () => void;
  onAccountClick?: () => void;
}) {
  const appUpdateState = useOwnerPlayUpdateSnapshot();
  const staffName = staffMember?.displayName || staffMember?.name || "직원";
  const staffRole = staffMember?.position || "직원";
  const staffContext = [shopName, staffRole].filter(Boolean).join(" · ");

  return (
    <section className="min-h-full bg-[#f6f9fc] px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4">
      <div className="space-y-5">
        <section aria-labelledby="staff-settings-account-heading">
          <h2 id="staff-settings-account-heading" className="mb-2 text-[14px] font-medium leading-5 text-[#667085]">
            계정
          </h2>
          <div className="overflow-hidden rounded-[14px] border border-[#dfe7f0] bg-white divide-y divide-[#edf1f5]">
            <SettingsNavRow
              icon={UserRound}
              title="내 계정"
              value={`${staffName} · ${staffContext}`}
              onClick={onAccountClick}
            />
            {accountEmail ? <SettingsNavRow icon={Mail} title="로그인 이메일" value={accountEmail} /> : null}
            <SettingsNavRow href="/login/reset" icon={KeyRound} title="비밀번호 재설정" />
          </div>
        </section>

      <div className="space-y-3.5">
        {appUpdateState.available ? (
          <button
            type="button"
            disabled={appUpdateState.starting}
            onClick={() => void runOwnerPlayUpdateAction()}
            className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[14px] border border-[#dfe7f0] bg-white px-4 py-3 text-left disabled:opacity-50"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#f1f5f9] text-[#334155]">
                <Download className="size-[18px]" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="text-[16px] font-medium text-[#101828]">
                {appUpdateState.downloaded ? "업데이트 설치" : "앱 업데이트"}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-[#eef4ff] px-2 py-1 text-[12px] font-semibold text-[#2563eb]">
              {appUpdateState.downloaded ? "설치 준비됨" : "업데이트 가능"}
            </span>
          </button>
        ) : null}
        <div className="rounded-[18px] border border-[#dfe7f0] bg-white p-4">
          <p className="mb-3 text-[16px] font-medium tracking-[-0.02em] text-[#101828]">내 계정 정보</p>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[18px] font-medium text-[#2563eb]">
              {staffInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-medium tracking-[-0.02em] text-[#101828]">{staffName}</p>
              <p className="mt-0.5 truncate text-[16px] text-[#667085]">{shopName} · {staffRole}</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function SettingsFieldCard({
  label,
  labelAccessory,
  children,
  className = "",
  variant = "floating",
}: {
  label: string;
  labelAccessory?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "floating" | "inside-title";
}) {
  if (variant === "inside-title") {
    return (
      <div className={`rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-4 ${className}`.trim()}>
        <div className="mb-3 flex items-center gap-1">
          <p className="text-[14px] font-normal tracking-[-0.01em] text-[#6f675d]">{label}</p>
          {labelAccessory}
        </div>
        {children}
      </div>
    );
  }

  return (
    <fieldset className={`min-w-0 overflow-visible rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 pb-2.5 pt-2 ${className}`.trim()}>
      <legend className="ml-0.5 px-1.5 text-[16px] font-normal tracking-[-0.01em] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1 align-middle">
          <span>{label}</span>
          {labelAccessory}
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false,
  emphasized = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  emphasized?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 rounded-[10px] border px-4 py-3 ${
        emphasized ? "border-[#d9e4f3] bg-[#f7faff]" : "border-[#e1e8f0] bg-white"
      } ${
        disabled ? "opacity-55" : ""
      }`}
    >
      <p className="text-[15px] font-normal text-[var(--text)]">{label}</p>
      <Switch checked={checked} disabled={disabled} aria-label={label} onCheckedChange={onChange} />
    </label>
  );
}

function StaffProfileEditField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block rounded-[10px] border border-[var(--border)] bg-white px-3 py-2">
      <span className="mb-1 block text-[11px] font-semibold leading-4 text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function SolidButton({
  children,
  disabled,
  onClick,
  className = "",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
  className?: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => void onClick()}
      className={`flex min-h-11 w-full items-center justify-center rounded-[12px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50 ${className}`.trim()}
    >
      {children}
    </button>
  );
}

function OutlineButton({ children, disabled, onClick, className = "" }: { children: ReactNode; disabled?: boolean; onClick: () => void; className?: string }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`flex min-h-11 w-full items-center justify-center rounded-[12px] border border-[var(--border)] bg-white px-4 text-[14px] font-semibold text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50 ${className}`.trim()}>
      {children}
    </button>
  );
}

function AccountRow({
  href,
  icon: Icon,
  label,
  value,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  value?: string;
}) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-[18px] w-[18px] shrink-0 text-[var(--text)]" strokeWidth={1.9} />
        <div className="min-w-0">
          <p className="text-[16px] font-medium text-[var(--text)]">{label}</p>
          {value ? <p className="mt-0.5 truncate text-[13px] text-[var(--muted)]">{value}</p> : null}
        </div>
      </div>
      {href ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" /> : null}
    </>
  );

  const className = "flex min-h-[52px] w-full items-center justify-between gap-3 px-1 py-2.5 text-left";

  return href ? <a href={href} className={className}>{content}</a> : <div className={className}>{content}</div>;
}

function AccountActionRow({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[52px] w-full items-center justify-between gap-3 px-1 py-2.5 text-left text-[#c43d3d] disabled:opacity-50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
        <p className="text-[16px] font-medium">{label}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" />
    </button>
  );
}



