"use client";

import { Bell, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, ExternalLink, FileText, KeyRound, LogOut, Mail, MapPin, MessageCircle, Phone, Plus, Store, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { InfoTip } from "@/components/owner/owner-app-ui";
import OwnerSupportPanel from "@/components/owner/owner-support-panel";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { Switch } from "@/components/ui/switch";
import { ApiRequestError } from "@/lib/api";
import { writeOwnerBillingSummaryCache } from "@/lib/billing/owner-billing-navigation";
import { getOwnerPlanDisplayName } from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { concurrentCapacityForApprovalMode } from "@/lib/booking-slot-settings";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import {
  PUBLIC_LEGAL_CONTACT,
  PUBLIC_LEGAL_LINKS,
  getPublicLegalMailtoHref,
  getPublicLegalTelHref,
} from "@/lib/legal/public-legal-links";
import { addDate, currentDateInTimeZone, decodeUnicodeEscapes, won } from "@/lib/utils";
import type { BootstrapPayload, BootstrapStaffMember, BusinessHours } from "@/types/domain";

type SettingsPanelProps = {
  data: BootstrapPayload;
  onSave: (payload: unknown) => Promise<unknown> | void;
  onSaveCustomerPageSettings: (payload: unknown) => Promise<unknown> | void;
  onSaveStaff: (payload: unknown) => Promise<unknown> | void;
  onLogout?: () => void;
  loggingOut?: boolean;
  userEmail?: string | null;
  subscriptionSummary?: OwnerSubscriptionSummary | null;
  initialScreen?: SettingsScreen;
  onActiveScreenChange?: (screen: SettingsScreen) => void;
  appRole?: MobileAppRole;
  currentStaffId?: string | null;
};

type MobileAppRole = "owner" | "staff";

type SaveFeedback = {
  type: "idle" | "success" | "error";
  message: string;
  description?: string;
};

type SettingsScreen = "shop" | "closures" | "notifications" | "staff" | "support" | "legal" | "account" | null;
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
  bookingRejectedEnabled: boolean;
  bookingCancelledEnabled: boolean;
  bookingRescheduledEnabled: boolean;
  groomingAlmostDoneEnabled: boolean;
  groomingCompletedEnabled: boolean;
  groomingStartWithoutPhotoEnabled: boolean;
  groomingCompleteWithoutPhotoEnabled: boolean;
};
const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const businessHoursWeekOrder = [1, 2, 3, 4, 5, 6, 0];
const defaultBusinessHoursEntry = { open: "10:00", close: "19:00", enabled: true };
const defaultStaffProfileMessage = "아이 성향에 맞춰 차분하게 미용해드려요.";

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

function mapShopNotificationSettingsState(
  settings: BootstrapPayload["shop"]["notification_settings"],
): ShopNotificationSettingsState {
  return {
    enabled: settings.enabled,
    revisitEnabled: settings.revisit_enabled,
    bookingConfirmedEnabled: settings.booking_confirmed_enabled,
    bookingRejectedEnabled: settings.booking_rejected_enabled,
    bookingCancelledEnabled: settings.booking_cancelled_enabled,
    bookingRescheduledEnabled: settings.booking_rescheduled_enabled,
    groomingAlmostDoneEnabled: settings.grooming_almost_done_enabled,
    groomingCompletedEnabled: settings.grooming_completed_enabled,
    groomingStartWithoutPhotoEnabled: settings.grooming_start_without_photo_enabled ?? false,
    groomingCompleteWithoutPhotoEnabled: settings.grooming_complete_without_photo_enabled ?? false,
  };
}

function withPrimedShopNotificationSettings(
  previous: ShopNotificationSettingsState,
  next: ShopNotificationSettingsState,
): ShopNotificationSettingsState {
  const enablingNotificationsForTheFirstTime = !previous.enabled && next.enabled;
  const hasAnyDetailedNotificationEnabled =
    next.revisitEnabled ||
    next.bookingConfirmedEnabled ||
    next.bookingRejectedEnabled ||
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
    bookingRejectedEnabled: true,
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

function resolveLoginIdFromOwnerAuthEmail(email?: string | null) {
  const trimmed = email?.trim();
  if (!trimmed) return null;

  const lowerEmail = trimmed.toLowerCase();
  const ownerAuthEmailSuffixes = ["@owner.petmanager.local", "@owner.pawcare.local"];
  const matchedSuffix = ownerAuthEmailSuffixes.find((suffix) => lowerEmail.endsWith(suffix));

  if (!matchedSuffix) return null;
  return trimmed.slice(0, -matchedSuffix.length);
}

export default function OwnerSettingsPanel({
  data,
  onSave,
  onSaveCustomerPageSettings,
  onSaveStaff,
  onLogout,
  loggingOut = false,
  userEmail,
  subscriptionSummary,
  initialScreen = null,
  onActiveScreenChange,
  appRole = "owner",
  currentStaffId = null,
}: SettingsPanelProps) {
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
  const [bookingSlotIntervalMinutes, setBookingSlotIntervalMinutes] = useState(data.shop.booking_slot_interval_minutes);
  const [bookingSlotOffsetMinutes, setBookingSlotOffsetMinutes] = useState(data.shop.booking_slot_offset_minutes);
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
  const [notificationSettings, setNotificationSettings] = useState<ShopNotificationSettingsState>(
    mapShopNotificationSettingsState(data.shop.notification_settings),
  );
  const [isNotificationSettingsDirty, setIsNotificationSettingsDirty] = useState(false);
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false);
  const [notificationSettingsFeedback, setNotificationSettingsFeedback] = useState<SaveFeedback>({ type: "idle", message: "" });
  const notificationSaveQueueRef = useRef(Promise.resolve());
  const notificationSaveCountRef = useRef(0);
  const [staffPushEnabled, setStaffPushEnabled] = useState(true);

  const activeScreen = onActiveScreenChange ? (initialScreen ?? null) : localActiveScreen;
  const isStaffApp = appRole === "staff";
  const effectiveActiveScreen = isStaffApp && activeScreen && activeScreen !== "support" && activeScreen !== "legal" && activeScreen !== "account" ? null : activeScreen;
  const accountLoginId = resolveLoginIdFromOwnerAuthEmail(userEmail);
  const currentStaff = useMemo(
    () => data.staffMembers.find((staffMember) => staffMember.id === currentStaffId) ?? data.staffMembers[0] ?? null,
    [currentStaffId, data.staffMembers],
  );

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
    setBookingSlotIntervalMinutes(data.shop.booking_slot_interval_minutes);
    setBookingSlotOffsetMinutes(data.shop.booking_slot_offset_minutes);
    setTimeEditorTarget(null);
  }, [
    data.shop.id,
    data.shop.business_hours,
    data.shop.regular_closed_days,
    data.shop.booking_slot_interval_minutes,
    data.shop.booking_slot_offset_minutes,
  ]);

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
    setTimeEditorTarget(target);
  }

  function applyBusinessHoursEditor() {
    if (timeEditorTarget === null) return;

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

    setBusinessHours(nextBusinessHours);
    setRegularClosedDays(nextRegularClosedDays);
    saveOperatingInfo(nextBusinessHours, nextRegularClosedDays, temporaryClosedDates);
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
    if (!isBasicInfoEditing) return;
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
  ) {
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
      } catch (error) {
        setOperatingInfoFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "운영 정보를 저장하지 못했습니다.",
        });
      } finally {
        operatingSaveCountRef.current -= 1;
        if (operatingSaveCountRef.current === 0) setSavingOperatingInfo(false);
      }
    };

    operatingSaveQueueRef.current = operatingSaveQueueRef.current.then(saveTask, saveTask);
  }

  function saveNotificationSettings(nextSettings: ShopNotificationSettingsState) {
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
          }),
        );
        setIsNotificationSettingsDirty(false);
        setNotificationSettingsFeedback({ type: "success", message: "자동 저장되었습니다." });
      } catch (error) {
        setNotificationSettingsFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "알림톡 설정을 저장하지 못했습니다.",
        });
      } finally {
        notificationSaveCountRef.current -= 1;
        if (notificationSaveCountRef.current === 0) setSavingNotificationSettings(false);
      }
    };

    notificationSaveQueueRef.current = notificationSaveQueueRef.current.then(saveTask, saveTask);
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
          bookingSlotIntervalMinutes,
          bookingSlotOffsetMinutes,
          bookingAvailableStartTime: data.shop.booking_available_start_time,
          bookingAvailableEndTime: data.shop.booking_available_end_time,
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

  async function handleStaffProfileSave(staffMember: BootstrapStaffMember) {
    const draft = staffProfileDrafts[staffMember.id] ?? createStaffProfileDraft(staffMember);
    const name = draft.name.trim() || staffMember.name;

    setSavingStaffId(staffMember.id);
    setStaffFeedback({ type: "idle", message: "" });

    try {
      await Promise.resolve(
        onSaveStaff({
          shopId: data.shop.id,
          staffMemberId: staffMember.id,
          name,
          displayName: draft.displayName.trim(),
          profileImageUrl: draft.profileImageUrl.trim(),
          titlePrefix: draft.titlePrefix.trim(),
          position: draft.position.trim() || staffMember.position || staffMember.role || "직원",
          chipColorIndex: draft.chipColorIndex,
          profileMessage: draft.profileMessage.trim(),
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
        const currentPlanTitle = isFreePlan || showTrialCard ? "체험 플랜" : getOwnerPlanDisplayName(currentPlan.code);
        const currentPlanLine = isFreePlan || showTrialCard
          ? "카드 등록 없이 이용 중"
          : `${currentPlan.staffLimitLabel} · ${currentPlan.alimtalkIncludedLabel}`;
        const currentPlanPriceLabel = isFreePlan || showTrialCard ? "무료" : `월 ${won(currentPlan.monthlyPrice)}`;
        const currentPlanSubLabel = isFreePlan
          ? "관리자 설정"
          : showTrialCard
            ? "체험 플랜"
          : currentPlan.excessAlimtalkLabel;
        const endDateLabel = "서비스 종료일";
        const isInService =
          subscriptionSummary.status === "active" ||
          subscriptionSummary.status === "trialing" ||
          subscriptionSummary.status === "trial_will_end";
        const planCtaLabel = isInService ? "플랜 보기" : "업그레이드 플랜";

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
                href={`/owner/billing?compare=1&plan=${currentPlan.code}`}
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
          ) : (
            <button
              type="button"
              onClick={() => {
                setBasicInfoFeedback({ type: "idle", message: "" });
                setIsBasicInfoEditing(true);
              }}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#2f6fd6] px-4 text-[14px] font-medium text-white"
            >
              수정
            </button>
          )}
        </div>

        <div className="mt-3 border-t border-[#edf0f3] pt-3">
          <div className="grid grid-cols-2 gap-3">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[#475569]">매장명</span>
            <input
              disabled={!isBasicInfoEditing}
              className="h-[46px] w-full min-w-0 rounded-[9px] border border-[#e2e7ed] bg-[#fafbfc] px-3.5 text-[16px] font-medium text-[#0f172a] outline-none disabled:cursor-default disabled:text-[#475569]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="매장명"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[#475569]">업체 연락처</span>
            <input
              disabled={!isBasicInfoEditing}
              className="h-[46px] w-full min-w-0 rounded-[9px] border border-[#e2e7ed] bg-[#fafbfc] px-3.5 text-[16px] font-medium text-[#0f172a] outline-none disabled:cursor-default disabled:text-[#475569]"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="연락처"
            />
          </label>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[#475569]">기본 주소</span>
          <button
            type="button"
            disabled={!isBasicInfoEditing}
            onClick={() => setIsAddressSearchOpen(true)}
            className={`min-h-[46px] w-full rounded-[9px] border border-[#e2e7ed] bg-[#fafbfc] px-3.5 py-2 text-left text-[16px] font-medium leading-[22px] outline-none disabled:cursor-default ${
              address ? "text-[#0f172a]" : "text-[#94a3b8]"
            }`}
          >
            {address || "도로명이나 건물명으로 주소를 찾아주세요"}
          </button>
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
        <button
          type="button"
          onClick={() => openBusinessHoursEditor("all")}
          className="mb-1 flex w-full items-center justify-between gap-3 rounded-[10px] bg-[#eaf1fc] px-3 py-2.5 text-left"
        >
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#1d4d9e]">전체 시간 설정</p>
            <p className="mt-0.5 truncate text-[12px] text-[#4779c7]">{businessHoursSummary}</p>
          </div>
          <span className="inline-flex h-7 shrink-0 items-center rounded-[7px] border border-[#cfe0f7] bg-white px-2.5 text-[12px] font-semibold text-[#2f6fd6]">
            일괄 적용
          </span>
        </button>
        <div className="divide-y divide-[#edf1f5]">
          {businessHoursWeekOrder.map((day) => {
            const hours = getBusinessHour(day);
            const isClosed = regularClosedDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => openBusinessHoursEditor(day)}
                className="flex h-[50px] w-full items-center justify-between gap-3 px-1 text-left"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`inline-flex w-10 shrink-0 items-center text-[14px] font-semibold leading-none ${day === 0 ? "text-[#e0594f]" : day === 6 ? "text-[#2f6fd6]" : "text-[#1e293b]"}`}>
                    {weekdayLabels[day]}요일
                  </span>
                  {isClosed ? (
                    <span className="inline-flex items-center rounded-[6px] bg-[#fdeeec] px-2 py-1 text-[11px] font-semibold leading-none text-[#b3453b]">휴무</span>
                  ) : (
                    <p className="min-w-0 truncate text-[15px] font-medium leading-5 text-[#334155]">{formatBusinessHoursRange(hours)}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#94a3b8]" strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[14px] border border-[#e2e7ed] bg-white p-3.5">
        <p className="mb-3 text-[14px] font-semibold text-[#0f172a]">특정 휴무일</p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="flex h-[40px] flex-1 items-center justify-between rounded-[9px] border border-[#e2e7ed] bg-[#fafbfc] px-3 text-[13px] text-[#1e293b]"
              onClick={() => setIsClosedDatePickerOpen(true)}
            >
              <span>{pendingClosedDate || "날짜 선택"}</span>
              <CalendarDays className="h-4 w-4 text-[var(--muted)]" />
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[9px] border border-[#2f6fd6] bg-[#2f6fd6] text-white disabled:opacity-50"
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
                  className="flex h-[38px] w-full items-center justify-between rounded-[9px] border border-[#e2e7ed] bg-[#f6f7f9] px-3 text-[13px] font-medium text-[#1e293b]"
                  onClick={() => removeTemporaryClosedDate(date)}
                >
                  <span>{date}</span>
                  <span className="text-[12px] text-[#94a3b8]">삭제</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {savingOperatingInfo || operatingInfoFeedback.type !== "idle" ? (
        <p
          aria-live="polite"
          className={`px-1 text-[13px] font-medium ${
            savingOperatingInfo
              ? "text-[#4779c7]"
              : operatingInfoFeedback.type === "error"
                ? "text-[#b3453b]"
                : "text-[#3b7d5b]"
          }`}
        >
          {savingOperatingInfo ? "자동 저장 중..." : operatingInfoFeedback.message}
        </p>
      ) : null}
    </>
  );

  const notificationsSection = (
    <SettingsCard contentClassName="space-y-4">
      <SettingsFieldCard
        label="알림톡 발송"
        className="border-[#dfe7f1] bg-white px-4 pb-3 pt-2.5"
        labelAccessory={
          <InfoTip ariaLabel="알림톡 설정 안내" popoverClassName="w-[248px]">
            매장 알림톡과 고객별 수신 설정이 모두 켜져 있어야 오너가 직접 알림을 보낼 수 있어요.
          </InfoTip>
        }
      >
        <div className="space-y-2.5 pt-1">
          <ToggleRow
            label="알림톡 전체 사용"
            checked={notificationSettings.enabled}
            onChange={(checked) => updateNotificationSettings((prev) => ({ ...prev, enabled: checked }))}
            emphasized
          />
          <div className="rounded-[10px] border border-[#e1e8f0] bg-[#f7f9fc] px-3 py-2.5">
            <p className="text-[12px] leading-[18px] tracking-[-0.01em] text-[#607080]">
              알림톡은 펫매니저 공통 발신 프로필로 발송됩니다. 메시지 본문에는 매장명이 표시됩니다.
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
              label="예약 거절 안내"
              checked={notificationSettings.bookingRejectedEnabled}
              onChange={(checked) => updateNotificationSettings((prev) => ({ ...prev, bookingRejectedEnabled: checked }))}
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
      {savingNotificationSettings || notificationSettingsFeedback.type !== "idle" ? (
        <p
          aria-live="polite"
          className={`px-1 text-[13px] font-medium ${
            savingNotificationSettings
              ? "text-[#4779c7]"
              : notificationSettingsFeedback.type === "error"
                ? "text-[#b3453b]"
                : "text-[#3b7d5b]"
          }`}
        >
          {savingNotificationSettings ? "자동 저장 중..." : notificationSettingsFeedback.message}
        </p>
      ) : null}
    </SettingsCard>
  );

  const accountSection = onLogout ? (
    <SettingsCard>
      <div className="divide-y divide-[var(--border)]">
        {accountLoginId ? <AccountRow icon={UserRound} label="로그인 아이디" value={accountLoginId} /> : null}
        <AccountRow href="/login/reset" icon={KeyRound} label="비밀번호 재설정" />
        <AccountActionRow icon={LogOut} label={loggingOut ? "로그아웃 중..." : "로그아웃"} onClick={onLogout} disabled={loggingOut} />
      </div>
    </SettingsCard>
  ) : null;

  const staffSection = (
    <div className="space-y-3">
      {data.staffMembers.map((staffMember) => {
        const draft = staffProfileDrafts[staffMember.id] ?? createStaffProfileDraft(staffMember);
        const displayName = draft.displayName.trim() || draft.name.trim() || staffMember.name;
        const avatarLabel = displayName.slice(0, 1);
        const imageInputId = `staff-profile-image-${staffMember.id}`;

        return (
          <div key={staffMember.id} className="rounded-[14px] border border-[#e2e7ed] bg-white p-4">
            <div className="space-y-3.5">
              <div className="flex items-center gap-3 border-b border-[#edf1f5] pb-4">
                <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eaf1fc] text-[22px] font-bold text-[#2f6fd6]">
                  {draft.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.profileImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    avatarLabel
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold tracking-[-0.02em] text-[#0f172a]">{displayName}</p>
                  <p className="mt-0.5 truncate text-[12.5px] leading-4 text-[#64748b]">
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
                    className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#e2e7ed] bg-[#fafbfc] px-3 text-[12px] font-semibold text-[#334155]"
                  >
                    <Camera className="h-3.5 w-3.5" strokeWidth={2.2} />
                    사진 올리기
                  </label>
                  {draft.profileImageUrl ? (
                    <button
                      type="button"
                      onClick={() => updateStaffProfileDraft(staffMember.id, { profileImageUrl: "" })}
                      className="ml-2 inline-flex h-8 items-center rounded-[8px] px-2 text-[12px] font-semibold text-[#94a3b8]"
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
            <span className="min-w-0 text-[15px] font-medium text-[var(--text)]">{link.label}</span>
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

  const screenMap: Record<Exclude<SettingsScreen, null>, { title: string; content: ReactNode }> = {
    shop: { title: "매장 기본 정보", content: shopSection },
    closures: { title: "영업 시간 설정", content: closuresSection },
    notifications: { title: "알림톡 설정", content: notificationsSection },
    staff: { title: "직원관리", content: staffSection },
    support: { title: "1:1 문의", content: supportSection },
    legal: { title: "약관 및 정책", content: legalSection },
    account: { title: "계정", content: accountSection },
  };

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
                  className="min-h-[104px] w-full resize-none bg-transparent p-0 text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
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
                      className="w-full bg-transparent p-0 text-[15px] leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
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
            onClose={() => setTimeEditorTarget(null)}
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
        accountLoginId={accountLoginId}
        pushEnabled={staffPushEnabled}
        onPushEnabledChange={setStaffPushEnabled}
        onSupportClick={() => updateActiveScreen("support")}
        onLegalClick={() => updateActiveScreen("legal")}
        onAccountClick={onLogout ? () => updateActiveScreen("account") : undefined}
      />
    );
  }

  return (
    <section className="min-h-full bg-[#F4F5F7] p-4">
      {subscriptionSummary ? <div className="mb-3.5">{subscriptionSection}</div> : null}

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
          icon={Bell}
          title="알림톡 설정"
          onClick={() => updateActiveScreen("notifications")}
        />
        <SettingsNavRow
          icon={UserRound}
          title="직원관리"
          onClick={() => updateActiveScreen("staff")}
        />
        <SettingsNavRow
          icon={MessageCircle}
          title="1:1 문의"
          onClick={() => updateActiveScreen("support")}
        />
        {onLogout ? (
          <SettingsNavRow
            icon={UserRound}
            title="계정"
            onClick={() => updateActiveScreen("account")}
          />
        ) : null}
        <SettingsNavRow
          icon={FileText}
          title="약관 및 정책"
          onClick={() => updateActiveScreen("legal")}
        />
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
    </section>
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
            <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
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
  onClose,
  onChange,
  onApply,
}: {
  title: string;
  draft: { open: string; close: string; closed: boolean };
  showClosedToggle: boolean;
  onClose: () => void;
  onChange: (draft: { open: string; close: string; closed: boolean }) => void;
  onApply: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-[430px] rounded-t-[28px] bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-stone-200" />
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
          </div>
          <button className="text-sm font-semibold text-[var(--muted)]" onClick={onClose}>닫기</button>
        </div>

        <div className="space-y-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
          {showClosedToggle ? (
            <div
              className="flex min-h-[50px] w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-left"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">휴무일로 설정</p>
              </div>
              <Switch
                checked={draft.closed}
                aria-label="휴무일로 설정"
                onCheckedChange={(checked) => onChange({ ...draft, closed: checked })}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5">
            <SettingsFieldCard label="시작 시간">
              <input
                type="time"
                className="w-full bg-transparent p-0 text-[16px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none"
                value={draft.open}
                onChange={(event) => onChange({ ...draft, open: event.target.value })}
                disabled={draft.closed}
              />
            </SettingsFieldCard>
            <SettingsFieldCard label="마감 시간">
              <input
                type="time"
                className="w-full bg-transparent p-0 text-[16px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none"
                value={draft.close}
                onChange={(event) => onChange({ ...draft, close: event.target.value })}
                disabled={draft.closed}
              />
            </SettingsFieldCard>
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <OutlineButton onClick={onClose}>취소</OutlineButton>
          <SolidButton onClick={onApply}>적용</SolidButton>
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
            <h3 className="text-base font-semibold text-[var(--text)]">특정 휴무일 추가</h3>
          </div>
          <button className="text-sm font-semibold text-[var(--muted)]" onClick={onClose}>닫기</button>
        </div>
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" className="rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text)]" onClick={onPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-[var(--text)]">{monthLabel}</p>
            <button type="button" className="rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text)]" onClick={onNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-2">
            {weekdayLabels.map((label) => (
              <div key={label} className="text-center text-xs font-semibold text-[var(--muted)]">{label}</div>
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
                  className={`h-11 rounded-[16px] text-sm font-semibold transition ${
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
          <h2 className="text-[17px] font-medium tracking-[-0.02em] text-[var(--text)]">{title}</h2>
        </div>
      ) : null}
      <div className={`${contentClassName || "space-y-1"} ${title ? "pt-2.5" : ""}`.trim()}>{children}</div>
    </section>
  );
}

function SettingsNavRow({
  icon: Icon,
  title,
  onClick,
  accent = false,
}: {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[68px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left ${
        accent ? "bg-[#f6fbf9]" : "bg-white"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center ${
          accent ? "text-[var(--accent)]" : "text-[var(--text)]"
        }`}>
          <Icon className="h-5 w-5" strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <p className="text-[17px] font-normal tracking-[-0.02em] text-[var(--text)]">{title}</p>
        </div>
      </div>
      <ChevronRight className={`h-4 w-4 shrink-0 ${accent ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} strokeWidth={1.9} />
    </button>
  );
}

function StaffSettingsHome({
  staffMember,
  shopName,
  accountLoginId,
  pushEnabled,
  onPushEnabledChange,
  onSupportClick,
  onLegalClick,
  onAccountClick,
}: {
  staffMember: BootstrapStaffMember | null;
  shopName: string;
  accountLoginId: string | null;
  pushEnabled: boolean;
  onPushEnabledChange: (checked: boolean) => void;
  onSupportClick: () => void;
  onLegalClick: () => void;
  onAccountClick?: () => void;
}) {
  const staffName = staffMember?.displayName || staffMember?.name || "직원";
  const staffRole = staffMember?.position || "직원";
  const staffInitial = staffName.trim().slice(0, 1) || "직";

  return (
    <section className="min-h-full bg-[#F4F5F7] p-4">
      <div className="mb-4">
        <h1 className="text-[24px] font-medium tracking-[-0.02em] text-[#101828]">설정</h1>
      </div>

      <div className="space-y-3.5">
        <div className="rounded-[18px] border border-[#dfe7f0] bg-white p-4">
          <p className="mb-3 text-[16px] font-medium tracking-[-0.02em] text-[#101828]">내 계정 정보</p>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[18px] font-medium text-[#2563eb]">
              {staffInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-medium tracking-[-0.02em] text-[#101828]">{staffName}</p>
              <p className="mt-0.5 truncate text-[15px] text-[#667085]">{shopName} · {staffRole}</p>
            </div>
          </div>
          <div className="mt-4 rounded-[14px] bg-[#f8fafc] px-3.5 py-3">
            <p className="text-[15px] leading-6 text-[#475467]">
              프로필 사진, 표시 이름, 담당 서비스는 오너가 관리해요. 변경이 필요하면 매장 관리자에게 요청해 주세요.
            </p>
          </div>
        </div>

        <div className="rounded-[18px] border border-[#dfe7f0] bg-white p-4">
          <p className="mb-3 text-[16px] font-medium tracking-[-0.02em] text-[#101828]">업무 알림</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" strokeWidth={1.9} />
              <div className="min-w-0">
                <p className="text-[17px] font-medium tracking-[-0.02em] text-[#101828]">앱 알림 수신</p>
                <p className="mt-1 text-[15px] leading-5 text-[#667085]">내 예약과 일정 변경 알림을 앱에서 받아요.</p>
              </div>
            </div>
            <Switch checked={pushEnabled} aria-label="앱 알림 수신" onCheckedChange={onPushEnabledChange} />
          </div>
        </div>

        <div className="rounded-[18px] border border-[#dfe7f0] bg-white">
          <p className="px-4 pt-4 text-[16px] font-medium tracking-[-0.02em] text-[#101828]">계정 / 문의</p>
          <div className="mt-2 overflow-hidden divide-y divide-[#edf1f5]">
            {accountLoginId ? <AccountRow icon={UserRound} label="로그인 아이디" value={accountLoginId} /> : null}
            <AccountRow href="/login/reset" icon={KeyRound} label="비밀번호 재설정" />
            <button type="button" onClick={onSupportClick} className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <div className="flex min-w-0 items-center gap-3">
                <MessageCircle className="h-[18px] w-[18px] shrink-0 text-[#101828]" strokeWidth={1.9} />
                <p className="text-[16px] font-medium text-[#101828]">1:1 문의</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#98a2b3]" />
            </button>
            <button type="button" onClick={onLegalClick} className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-[18px] w-[18px] shrink-0 text-[#101828]" strokeWidth={1.9} />
                <p className="text-[16px] font-medium text-[#101828]">약관 및 정책</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#98a2b3]" />
            </button>
            {onAccountClick ? (
              <button type="button" onClick={onAccountClick} className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left">
                <div className="flex min-w-0 items-center gap-3">
                  <LogOut className="h-[18px] w-[18px] shrink-0 text-[#c43d3d]" strokeWidth={1.9} />
                  <p className="text-[16px] font-medium text-[#c43d3d]">로그아웃</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#98a2b3]" />
              </button>
            ) : null}
          </div>
        </div>
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
      <p className="text-[15px] font-medium text-[#25364d]">{label}</p>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onChange}
        className={checked ? "!border-[#2f6fd6] !bg-[#2f6fd6]" : "!border-[#cfd9e6] !bg-[#edf2f7]"}
      />
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
    <label className="block rounded-[10px] border border-[#e2e7ed] bg-[#fafbfc] px-3.5 py-2.5">
      <span className="mb-1.5 block text-[12px] font-semibold leading-4 text-[#334155]">{label}</span>
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
      className={`flex h-10 w-full items-center justify-center rounded-[12px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)] disabled:opacity-50 ${className}`.trim()}
    >
      {children}
    </button>
  );
}

function OutlineButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className="flex h-10 w-full items-center justify-center rounded-[12px] border border-[var(--border)] bg-white px-4 text-[14px] font-semibold text-[var(--muted)] disabled:opacity-50">
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
          <p className="text-[15px] font-medium text-[var(--text)]">{label}</p>
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
        <p className="text-[15px] font-medium">{label}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" />
    </button>
  );
}



