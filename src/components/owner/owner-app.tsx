"use client";

import { CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, House, PawPrint, Plus, QrCode, Settings, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  ActionButton,
  EmptyState,
  Field,
  HorizontalDragScroll,
  InfoTip,
  Overlay,
  Panel,
  Sheet,
  ToggleRow,
} from "@/components/owner/owner-app-ui";
import {
  Avatar,
  CustomerDetailFieldCard,
  CustomerDetailHistoryPagination,
  CustomerDetailInfoRow,
  CustomerDetailNotificationItemRow,
  CustomerDetailToggleRow,
  CustomerEmptyState,
  CustomerMetricCard,
  InfoItem,
  NotificationHistoryRow,
  PetDetailInputField,
  QuickContactRow,
  ShopAvatar,
  UrgencyPill,
} from "@/components/owner/owner-customer-detail-ui";
import CustomerDeleteSelectionPanel from "@/components/owner/customer-delete-selection-panel";
import OwnerSettingsPanel from "@/components/owner/owner-settings-panel";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { StatusBadge as AppStatusBadge } from "@/components/ui/status-badge";
import { fetchApiJsonWithAuth } from "@/lib/api";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { computeAvailableSlots, revisitInfo } from "@/lib/availability";
import { concurrentCapacityForApprovalMode } from "@/lib/booking-slot-settings";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { createOwnerMediaAssetFromFile, type MediaAssetListItem } from "@/lib/media/owner-media-client";
import { ownerHomeCopy } from "@/lib/owner-home-copy";
import { addDate, cn, currentDateInTimeZone, formatClockTime, phoneNormalize, shortDate, won } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload, GroomingRecord, MediaKind, Pet, Service } from "@/types/domain";

type TabKey = "home" | "book" | "customers" | "settings";
type CustomerDetailTab = "pets" | "records" | "notifications";
type SettingsEntryScreen = "subscription" | "shop" | "closures" | "notifications" | "services" | "addons" | "account" | null;
type OwnerGuideScreen = "getting-started" | null;
type HomeStaffFilterKey = "all" | "unassigned" | string;
type OwnedShopSummary = {
  id: string;
  name: string;
  address: string;
  heroImageUrl: string;
};
type ShopBusinessHours = Record<string, { open: string; close: string; enabled: boolean }>;
type ShopProfileSavePayload = {
  settingsPayload: {
    shopId: string;
    name: string;
    phone: string;
    address: string;
    description: string;
    concurrentCapacity: number;
    bookingSlotIntervalMinutes: number;
    bookingSlotOffsetMinutes: number;
    bookingAvailableStartTime: string;
    bookingAvailableEndTime: string;
    approvalMode: "manual" | "auto";
    regularClosedDays: number[];
    temporaryClosedDates: string[];
    businessHours: ShopBusinessHours;
    notificationSettings: {
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
  };
  customerPageSettingsPayload: {
    shopId: string;
    customerPageSettings: BootstrapPayload["shop"]["customer_page_settings"];
  };
};
type Guardian = BootstrapPayload["guardians"][number];
type GuardianNotificationSettings = Guardian["notification_settings"];
type GuardianNotificationSettingKey = keyof GuardianNotificationSettings;
type CustomerEditableField = "name" | "phone" | "pet" | "memo";
type AppointmentStatusUpdatePayload = {
  status: AppointmentStatus;
  rejectionReasonTemplate?: string;
  rejectionReasonCustom?: string;
  eventType?: "booking_rescheduled_confirmed";
  mediaAssetIds?: string[];
};
type AppointmentEditPayload = {
  mode: "edit";
  serviceId: string;
  appointmentDate: string;
  appointmentTime: string;
  memo: string;
};
type AppointmentUpdatePayload = AppointmentStatusUpdatePayload | AppointmentEditPayload;
type HomeReservationSectionKey = "pending" | "current" | "cancelChange" | "completed";
type ModalState =
  | { type: "appointment"; appointment: Appointment }
  | { type: "edit-shop-profile" }
  | { type: "new-appointment"; petId?: string }
  | { type: "new-customer" }
  | { type: "add-pet"; guardianId: string }
  | { type: "edit-record"; record: GroomingRecord }
  | { type: "stat"; kind: "today" | "pending" | "completed" | "cancel_change" }
  | null;
type MobilePhotoStatusAction = {
  appointmentId: string;
  nextStatus: Extract<AppointmentStatus, "in_progress" | "completed">;
  mediaKind: Extract<MediaKind, "grooming_before" | "grooming_after">;
  title: string;
  description: string;
  buttonLabel: string;
  skipLabel: string;
  autoOpenCamera?: boolean;
};
export type OwnerMobileLaunchPhotoStatusAction = {
  appointmentId: string;
  statusAction: Extract<AppointmentStatus, "in_progress" | "completed">;
  autoOpenCamera?: boolean;
};
type AppointmentMediaPreview = {
  item: MediaAssetListItem;
  signedUrl: string;
};
type SignedMediaUrlResponse = {
  signedUrl: string;
  expiresInSeconds: number;
};

const compactWeekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const settingsEntryScreenTitles: Record<Exclude<SettingsEntryScreen, null>, string> = {
  subscription: "현재 플랜",
  shop: "매장 기본 정보",
  closures: "영업 시간 설정",
  notifications: "알림톡 설정",
  services: "미용 요금",
  addons: "부가기능",
  account: "계정",
};

const rejectionReasonTemplates = [
  "\uD574\uB2F9 \uC2DC\uAC04 \uC608\uC57D\uC740 \uC5B4\uB824\uC6CC\uC694",
  "\uC2DC\uAC04 \uC870\uC815\uC774 \uD544\uC694\uD574\uC694",
  "\uC624\uB298 \uC608\uC57D \uAC00\uB2A5 \uC778\uC6D0\uC774 \uB9C8\uAC10\uB418\uC5C8\uC5B4\uC694",
  "\uB9E4\uC7A5 \uC0AC\uC815\uC73C\uB85C \uC608\uC57D\uC774 \uC5B4\uB824\uC6CC\uC694",
  "\uAE30\uD0C0 \uC9C1\uC811 \uC785\uB825",
] as const;

const statusMeta: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "\uB300\uAE30", color: "#9a6a16", bg: "#fff8eb" },
  confirmed: { label: "\uD655\uC815", color: "#2f6bd4", bg: "#eef4ff" },
  in_progress: { label: "\uBBF8\uC6A9\uC911", color: "#2f6bd4", bg: "#eef4ff" },
  almost_done: { label: "\uD53D\uC5C5 \uC900\uBE44", color: "#4f5d73", bg: "#f3f6fb" },
  completed: { label: "\uC644\uB8CC", color: "#4f5d73", bg: "#f3f6fb" },
  cancelled: { label: "\uCDE8\uC18C", color: "#8f6658", bg: "#f8efea" },
  rejected: { label: "\uBBF8\uC2B9\uC778", color: "#8f6658", bg: "#f8efea" },
  noshow: { label: "\uB178\uC1FC", color: "#8f6658", bg: "#f8efea" },
};

function matchesHomeStaffFilter(appointment: Appointment, filter: HomeStaffFilterKey) {
  if (filter === "all") return true;
  if (filter === "unassigned") return !appointment.staff_id;
  return appointment.staff_id === filter;
}

function getAppointmentNotificationLabel(type: BootstrapPayload["notifications"][number]["type"]) {
  switch (type) {
    case "booking_confirmed":
      return "확정 알림";
    case "booking_rejected":
      return "거절 알림";
    case "booking_cancelled":
      return "취소 알림";
    case "booking_rescheduled_confirmed":
      return "변경 알림";
    case "appointment_reminder_10m":
      return "방문 안내";
    case "grooming_started":
      return "시작 알림";
    case "grooming_almost_done":
      return "픽업 알림";
    case "grooming_completed":
      return "완료 알림";
    default:
      return "알림";
  }
}

function getNotificationResultMeta(notification: BootstrapPayload["notifications"][number] | null) {
  if (!notification) {
    return {
      label: "알림 기록 없음",
      className: "border-[#e1e4ea] bg-[#f8fafc] text-[#646a74]",
    };
  }

  const prefix = getAppointmentNotificationLabel(notification.type);
  if (notification.status === "sent" || notification.status === "mocked") {
    return {
      label: `${prefix} 완료`,
      className: "border-[#e1e7ef] bg-[#f8fafc] text-[#334155]",
    };
  }
  if (notification.status === "failed") {
    return {
      label: `${prefix} 실패`,
      className: "border-[#f0d1ca] bg-[#fff8f6] text-[#a85c4c]",
    };
  }
  if (notification.status === "queued") {
    return {
      label: `${prefix} 대기`,
      className: "border-[#f0dfbc] bg-[#fff8eb] text-[#9a6a16]",
    };
  }
  return {
    label: `${prefix} 건너뜀`,
    className: "border-[#e1e4ea] bg-[#f8fafc] text-[#646a74]",
  };
}

function getAppointmentMediaKindLabel(mediaKind: MediaKind | string) {
  switch (mediaKind) {
    case "grooming_before":
      return "미용 전 사진";
    case "grooming_after":
      return "완료 사진";
    case "grooming_result":
      return "결과 사진";
    default:
      return "사진";
  }
}

const tabItems: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "홈", icon: House },
  { key: "book", label: "예약조회", icon: CalendarDays },
  { key: "customers", label: "고객 관리", icon: PawPrint },
  { key: "settings", label: "설정", icon: Settings },
];

const CUSTOMER_DETAIL_HISTORY_MONTHS = 3;
const CUSTOMER_DETAIL_PAGE_SIZE = 5;

function subtractMonthsDate(date: string, months: number) {
  const base = new Date(`${date}T00:00:00`);
  base.setMonth(base.getMonth() - months);
  return base.toISOString().slice(0, 10);
}

async function fetchJson<T>(input: string, init?: RequestInit) {
  return fetchApiJsonWithAuth<T>(input, init);
}

export default function OwnerApp({
  initialData,
  ownedShops,
  selectedShopId,
  isPreviewDemo = false,
  onLogout,
  onSwitchShop,
  loggingOut = false,
  userEmail = null,
  subscriptionSummary = null,
  launchPhotoStatusAction = null,
}: {
  initialData: BootstrapPayload;
  ownedShops: OwnedShopSummary[];
  selectedShopId: string | null;
  isPreviewDemo?: boolean;
  onLogout?: () => void | Promise<void>;
  onSwitchShop?: (shopId: string) => Promise<void>;
  loggingOut?: boolean;
  userEmail?: string | null;
  subscriptionSummary?: OwnerSubscriptionSummary | null;
  launchPhotoStatusAction?: OwnerMobileLaunchPhotoStatusAction | null;
}) {
  const [data, setData] = useState(initialData);
  const [ownedShopItems, setOwnedShopItems] = useState(ownedShops);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [todayDate, setTodayDate] = useState(() => currentDateInTimeZone());
  const [homeReservationDate, setHomeReservationDate] = useState(() => currentDateInTimeZone());
  const [homeReservationSlideDirection, setHomeReservationSlideDirection] = useState<"prev" | "next">("next");
  const [homeStaffFilter, setHomeStaffFilter] = useState<HomeStaffFilterKey>("all");
  const [homeFocusedSection, setHomeFocusedSection] = useState<HomeReservationSectionKey>("current");
  const [selectedDate, setSelectedDate] = useState(() => currentDateInTimeZone());
  const [selectedGuardianId, setSelectedGuardianId] = useState<string | null>(null);
  const [selectedCustomerPetId, setSelectedCustomerPetId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedGuardianIds, setSelectedGuardianIds] = useState<string[]>([]);
  const [isCustomerListEditing, setIsCustomerListEditing] = useState(false);
  const [visitDateFilter, setVisitDateFilter] = useState(currentDateInTimeZone());
  const [visitSelectionMode, setVisitSelectionMode] = useState<"single" | "range">("single");
  const [visitRange, setVisitRange] = useState<{ start: string; end: string } | null>(null);
  const [detailTab, setDetailTab] = useState<CustomerDetailTab>("records");
  const [recordPage, setRecordPage] = useState(1);
  const [notificationPage, setNotificationPage] = useState(1);
  const [isVisitCalendarOpen, setIsVisitCalendarOpen] = useState(false);
  const [pendingVisitSelectionMode, setPendingVisitSelectionMode] = useState<"single" | "range">("single");
  const [pendingVisitDate, setPendingVisitDate] = useState(currentDateInTimeZone());
  const [pendingVisitRangeStart, setPendingVisitRangeStart] = useState<string | null>(null);
  const [pendingVisitRangeEnd, setPendingVisitRangeEnd] = useState<string | null>(null);
  const [visitCalendarMonthCursor, setVisitCalendarMonthCursor] = useState(currentDateInTimeZone().slice(0, 7));
  const [modal, setModal] = useState<ModalState>(null);
  const [mobilePhotoStatusAction, setMobilePhotoStatusAction] = useState<MobilePhotoStatusAction | null>(null);
  const [mobilePhotoUploading, setMobilePhotoUploading] = useState(false);
  const [settingsEntryScreen, setSettingsEntryScreen] = useState<SettingsEntryScreen>(null);
  const [guideScreen, setGuideScreen] = useState<OwnerGuideScreen>(null);
  const [isShopPickerOpen, setIsShopPickerOpen] = useState(false);
  const [pendingShopProfileEditId, setPendingShopProfileEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerPageOrigin, setOwnerPageOrigin] = useState("");
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const [isGuardianEditing, setIsGuardianEditing] = useState(false);
  const [isGuardianMemoEditing, setIsGuardianMemoEditing] = useState(false);
  const [editingCustomerFields, setEditingCustomerFields] = useState<Record<CustomerEditableField, boolean>>({
    name: false,
    phone: false,
    pet: false,
    memo: false,
  });
  const [isCustomerToolsOpen, setIsCustomerToolsOpen] = useState(false);
  const [isDeletedCustomersOpen, setIsDeletedCustomersOpen] = useState(false);
  const [guardianDraft, setGuardianDraft] = useState({
    name: "",
    phone: "",
    memo: "",
  });
  const [petDraftName, setPetDraftName] = useState("");
  const bookingLinkCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardianMemoTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const launchedPhotoStatusActionRef = useRef<string | null>(null);

  const resizeGuardianMemoTextarea = () => {
    const textarea = guardianMemoTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 72)}px`;
  };

  useEffect(() => {
    return () => {
      if (bookingLinkCopyTimeoutRef.current) {
        clearTimeout(bookingLinkCopyTimeoutRef.current);
      }
    };
  }, []);
  const isOwnerDemo = isPreviewDemo || data.shop.id === "owner-demo";

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOwnerPageOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!editingCustomerFields.memo) return;
    resizeGuardianMemoTextarea();
  }, [editingCustomerFields.memo, guardianDraft.memo]);

  function isLikelyCorruptedMessage(message: string) {
    return /�/.test(message) || /[À-ÿ]{2,}/.test(message) || /\?{2,}/.test(message);
  }

  async function handleRequestError(error: unknown, fallbackMessage: string) {
    const rawMessage = error instanceof Error ? error.message : "";
    const nextMessage =
      rawMessage && !isLikelyCorruptedMessage(rawMessage)
        ? rawMessage
        : fallbackMessage;
    if (nextMessage === "로그인이 필요합니다.") {
      setError(null);
      if (onLogout) {
        await onLogout();
      } else if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return;
    }
    setError(nextMessage);
  }

  function syncOwnedShopSummary(shop: BootstrapPayload["shop"]) {
    setOwnedShopItems((prev) =>
      prev.map((item) =>
        item.id === shop.id
          ? {
              ...item,
              name: shop.name,
              address: shop.address,
              heroImageUrl: shop.customer_page_settings?.hero_image_url || "",
            }
          : item,
      ),
    );
  }

  async function refresh() {
    if (isOwnerDemo) return;
    const next = await fetchJson<BootstrapPayload>(`/api/bootstrap?shopId=${data.shop.id}`, { cache: "no-store" });
    setData(next);
    syncOwnedShopSummary(next.shop);
  }

  async function refreshSilently() {
    try {
      await refresh();
    } catch {
      // Keep the current screen stable when background sync misses.
    }
  }

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    setOwnedShopItems(ownedShops);
  }, [ownedShops]);

  useEffect(() => {
    if (!launchPhotoStatusAction) return;
    const actionKey = `${data.shop.id}:${launchPhotoStatusAction.appointmentId}:${launchPhotoStatusAction.statusAction}`;
    if (launchedPhotoStatusActionRef.current === actionKey) return;

    const appointment = data.appointments.find((item) => item.id === launchPhotoStatusAction.appointmentId);
    if (!appointment) {
      setError("촬영할 예약 정보를 찾지 못했습니다.");
      launchedPhotoStatusActionRef.current = actionKey;
      return;
    }

    launchedPhotoStatusActionRef.current = actionKey;
    setModal(null);
    setActiveTab("home");
    setTodayDate(appointment.appointment_date);
    setHomeReservationDate(appointment.appointment_date);
    setSelectedDate(appointment.appointment_date);
    setMobilePhotoStatusAction({
      appointmentId: appointment.id,
      nextStatus: launchPhotoStatusAction.statusAction,
      mediaKind: launchPhotoStatusAction.statusAction === "in_progress" ? "grooming_before" : "grooming_after",
      title: launchPhotoStatusAction.statusAction === "in_progress" ? "미용 전 사진" : "미용 완료 사진",
      description:
        launchPhotoStatusAction.statusAction === "in_progress"
          ? "미용 전 털 상태, 엉킴, 피부 상태를 선택적으로 남길 수 있어요."
          : "마무리된 모습을 한 장 촬영하면 미용 완료 알림톡에 함께 기록됩니다.",
      buttonLabel: launchPhotoStatusAction.statusAction === "in_progress" ? "사진 찍고 미용 시작" : "사진 찍고 미용 완료",
      skipLabel: launchPhotoStatusAction.statusAction === "in_progress" ? "사진 없이 미용 시작" : "사진 없이 미용 완료",
      autoOpenCamera: launchPhotoStatusAction.autoOpenCamera ?? true,
    });
  }, [data.appointments, data.shop.id, launchPhotoStatusAction]);

  useEffect(() => {
    if (!pendingShopProfileEditId || data.shop.id !== pendingShopProfileEditId) return;
    setModal({ type: "edit-shop-profile" });
    setPendingShopProfileEditId(null);
  }, [data.shop.id, pendingShopProfileEditId]);

  useEffect(() => {
    if (visitSelectionMode === "range" && visitRange) {
      const start = visitRange.start <= visitRange.end ? visitRange.start : visitRange.end;
      const end = visitRange.start <= visitRange.end ? visitRange.end : visitRange.start;
      setVisitCalendarMonthCursor(start.slice(0, 7));
      setPendingVisitSelectionMode("range");
      setPendingVisitRangeStart(start);
      setPendingVisitRangeEnd(end);
      setPendingVisitDate(start);
      return;
    }

    setVisitCalendarMonthCursor(visitDateFilter.slice(0, 7));
    setPendingVisitSelectionMode("single");
    setPendingVisitDate(visitDateFilter);
    setPendingVisitRangeStart(null);
    setPendingVisitRangeEnd(null);
  }, [visitDateFilter, visitRange, visitSelectionMode]);
  useEffect(() => {
    const syncToday = () => setTodayDate(currentDateInTimeZone());
    syncToday();
    const timer = window.setInterval(syncToday, 60000);
    return () => window.clearInterval(timer);
  }, []);
  const maxHomeReservationDate = useMemo(() => addDate(todayDate, 7), [todayDate]);

  useEffect(() => {
    setHomeReservationDate((current) => {
      if (current < todayDate) return todayDate;
      if (current > maxHomeReservationDate) return maxHomeReservationDate;
      return current;
    });
  }, [maxHomeReservationDate, todayDate]);

  const serviceMap = useMemo(() => Object.fromEntries(data.services.map((item) => [item.id, item])), [data.services]);
  const guardianMap = useMemo(() => Object.fromEntries(data.guardians.map((item) => [item.id, item])), [data.guardians]);
  const petMap = useMemo(() => Object.fromEntries(data.pets.map((item) => [item.id, item])), [data.pets]);
  const staffMap = useMemo(() => Object.fromEntries(data.staffMembers.map((item) => [item.id, item])), [data.staffMembers]);
  const latestNotificationByAppointmentId = useMemo(() => {
    const rows = [...data.notifications].sort((first, second) =>
      (second.sent_at ?? second.created_at).localeCompare(first.sent_at ?? first.created_at),
    );
    const map = new Map<string, BootstrapPayload["notifications"][number]>();
    for (const notification of rows) {
      if (!notification.appointment_id || map.has(notification.appointment_id)) continue;
      map.set(notification.appointment_id, notification);
    }
    return map;
  }, [data.notifications]);
  const currentOwnedShop = useMemo(() => {
    const currentShopId = selectedShopId || data.shop.id;
    const ownedShop = ownedShopItems.find((shop) => shop.id === currentShopId);
    if (currentShopId === data.shop.id) {
      return {
        id: data.shop.id,
        name: data.shop.name,
        address: data.shop.address,
        heroImageUrl: data.shop.customer_page_settings?.hero_image_url || ownedShop?.heroImageUrl || "",
      };
    }

    return (
      ownedShop ?? {
        id: data.shop.id,
        name: data.shop.name,
        address: data.shop.address,
        heroImageUrl: data.shop.customer_page_settings?.hero_image_url || "",
      }
    );
  }, [data.shop.address, data.shop.customer_page_settings, data.shop.id, data.shop.name, ownedShopItems, selectedShopId]);
  const enabledBusinessDayCount = useMemo(
    () => Object.values(data.shop.business_hours).filter((item) => item?.enabled).length,
    [data.shop.business_hours],
  );
  const onboardingTasks = useMemo(
    () =>
      [
        enabledBusinessDayCount === 0
          ? {
              key: "closures" as const,
              title: "영업시간을 열어 주세요",
              description: "영업일과 시간을 정해야 실제 예약 가능 시간이 계산돼요.",
              cta: "영업시간 설정",
            }
          : null,
      ].filter(Boolean),
    [enabledBusinessDayCount],
  );
  const isOnboardingIncomplete = onboardingTasks.length > 0;

  const homeConfirmedAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === homeReservationDate && ["confirmed", "in_progress", "almost_done", "completed", "cancelled"].includes(item.status)), [data.appointments, homeReservationDate]);
  const homePendingAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === homeReservationDate && item.status === "pending"), [data.appointments, homeReservationDate]);
  const homeActionAppointments = useMemo(() => homeConfirmedAppointments.filter((item) => ["confirmed", "in_progress", "almost_done"].includes(item.status)).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)), [homeConfirmedAppointments]);
  const homeHistoryAppointments = useMemo(() => homeConfirmedAppointments.filter((item) => item.status === "completed").sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)), [homeConfirmedAppointments]);
  const homeCompletedHistoryAppointments = useMemo(() => homeHistoryAppointments.filter((item) => item.status === "completed"), [homeHistoryAppointments]);
  const homeCancelChangeAppointments = useMemo(() => homeConfirmedAppointments.filter((item) => item.status === "cancelled"), [homeConfirmedAppointments]);
  const homeWorkAppointments = useMemo(
    () => [...homePendingAppointments, ...homeActionAppointments, ...homeCompletedHistoryAppointments],
    [homeActionAppointments, homeCompletedHistoryAppointments, homePendingAppointments],
  );
  const homeStaffFilterOptions = useMemo(() => {
    const options: Array<{ key: HomeStaffFilterKey; label: string; count: number }> = [
      { key: "all", label: "전체 담당자", count: homeWorkAppointments.length },
      ...data.staffMembers
        .map((staffMember) => ({
          key: staffMember.id,
          label: staffMember.name,
          count: homeWorkAppointments.filter((appointment) => appointment.staff_id === staffMember.id).length,
        })),
    ];

    if (homeWorkAppointments.some((appointment) => !appointment.staff_id)) {
      options.push({
        key: "unassigned",
        label: "미배정",
        count: homeWorkAppointments.filter((appointment) => !appointment.staff_id).length,
      });
    }

    return options;
  }, [data.staffMembers, homeWorkAppointments]);
  const filteredHomePendingAppointments = useMemo(
    () => homePendingAppointments.filter((appointment) => matchesHomeStaffFilter(appointment, homeStaffFilter)),
    [homePendingAppointments, homeStaffFilter],
  );
  const filteredHomeActionAppointments = useMemo(
    () => homeActionAppointments.filter((appointment) => matchesHomeStaffFilter(appointment, homeStaffFilter)),
    [homeActionAppointments, homeStaffFilter],
  );
  const filteredHomeCompletedHistoryAppointments = useMemo(
    () => homeCompletedHistoryAppointments.filter((appointment) => matchesHomeStaffFilter(appointment, homeStaffFilter)),
    [homeCompletedHistoryAppointments, homeStaffFilter],
  );
  const filteredHomeCancelChangeAppointments = useMemo(
    () => homeCancelChangeAppointments.filter((appointment) => matchesHomeStaffFilter(appointment, homeStaffFilter)),
    [homeCancelChangeAppointments, homeStaffFilter],
  );
  const filteredHomeConfirmedAppointmentsForStat = useMemo(
    () => [...filteredHomeActionAppointments, ...filteredHomeCompletedHistoryAppointments, ...filteredHomeCancelChangeAppointments],
    [filteredHomeActionAppointments, filteredHomeCancelChangeAppointments, filteredHomeCompletedHistoryAppointments],
  );
  useEffect(() => {
    if (homeStaffFilter === "all") return;
    if (!homeStaffFilterOptions.some((option) => option.key === homeStaffFilter)) {
      setHomeStaffFilter("all");
    }
  }, [homeStaffFilter, homeStaffFilterOptions]);
  const selectedDayAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === selectedDate).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)), [data.appointments, selectedDate]);
  const tomorrowDate = useMemo(() => addDate(todayDate, 1), [todayDate]);
  const homeReservationDateLabel = useMemo(() => {
    if (homeReservationDate === todayDate) return "오늘";
    if (homeReservationDate === tomorrowDate) return "내일";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    })
      .format(new Date(homeReservationDate + "T00:00:00"))
      .replace("요일", "");
  }, [homeReservationDate, todayDate, tomorrowDate]);
  const homeReservationFullDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        year: "2-digit",
        month: "long",
        day: "numeric",
        weekday: "short",
      })
        .format(new Date(homeReservationDate + "T00:00:00"))
        .replace("요일", ""),
    [homeReservationDate],
  );
  const canMoveHomeReservationBackward = homeReservationDate > todayDate;
  const canMoveHomeReservationForward = homeReservationDate < maxHomeReservationDate;

  const moveHomeReservationDate = (direction: "prev" | "next") => {
    setHomeReservationSlideDirection(direction);
    setHomeReservationDate((current) => {
      if (direction === "prev") {
        return current > todayDate ? addDate(current, -1) : current;
      }
      return current < maxHomeReservationDate ? addDate(current, 1) : current;
    });
  };
  const revisitRows = useMemo(() => data.pets.map((pet) => {
    const lastRecord = data.groomingRecords.filter((record) => record.pet_id === pet.id).sort((a, b) => b.groomed_at.localeCompare(a.groomed_at))[0];
    const revisit = revisitInfo(pet, lastRecord?.groomed_at);
    return { pet, guardian: guardianMap[pet.guardian_id], lastRecord, ...revisit };
  }).sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999)), [data.groomingRecords, data.pets, guardianMap]);

  const customerSummaries = useMemo(() => data.guardians.map((guardian) => {
    const pets = data.pets.filter((pet) => pet.guardian_id === guardian.id);
    const petIds = new Set(pets.map((pet) => pet.id));
    const records = data.groomingRecords.filter((record) => petIds.has(record.pet_id)).sort((a, b) => b.groomed_at.localeCompare(a.groomed_at));
    const appointments = data.appointments.filter((appointment) => petIds.has(appointment.pet_id)).sort((a, b) => `${b.appointment_date} ${b.appointment_time}`.localeCompare(`${a.appointment_date} ${a.appointment_time}`));
    const latestRecord = records[0];
    const latestAppointment = appointments[0];
    const upcomingAppointment = [...appointments]
      .filter((appointment) => appointment.appointment_date >= todayDate && ["pending", "confirmed", "in_progress", "almost_done"].includes(appointment.status))
      .sort((a, b) => `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`))[0];
    const latestPet = latestRecord ? petMap[latestRecord.pet_id] : latestAppointment ? petMap[latestAppointment.pet_id] : pets[0];
    const latestService = latestRecord ? serviceMap[latestRecord.service_id] : latestAppointment ? serviceMap[latestAppointment.service_id] : undefined;
    const latestVisitedAt = latestRecord?.groomed_at?.slice(0, 10) || null;
    const latestActivityAt = latestVisitedAt || latestAppointment?.appointment_date || null;
    const latestNote = latestRecord?.style_notes || latestRecord?.memo || latestAppointment?.memo || "메모 없음";
    const revisitCandidates = revisitRows.filter((row) => row.guardian?.id === guardian.id && ["overdue", "soon"].includes(row.status));
    const recentActivity = latestActivityAt ? Math.abs((new Date(todayDate).getTime() - new Date(latestActivityAt).getTime()) / 86400000) <= 30 : false;
    return {
      guardian,
      pets,
      latestPet,
      latestService,
      latestRecord,
      latestAppointment,
      latestVisitedAt,
      latestActivityAt,
      latestNote,
      upcomingAppointment,
      visitCount: records.length,
      revisitCandidates,
      isAlertsOff: !guardian.notification_settings.enabled,
      isRecent: recentActivity,
    };
  }), [data.guardians, data.pets, data.groomingRecords, data.appointments, petMap, serviceMap, revisitRows, todayDate]);

  const filteredGuardians = useMemo(() => {
    const query = customerSearch.trim();
    return customerSummaries
      .filter((summary) => {
        return (
          !query ||
          summary.guardian.name.includes(query) ||
          summary.guardian.phone.includes(query) ||
          summary.pets.some((pet) => pet.name.includes(query) || pet.breed.includes(query))
        );
      })
      .sort((a, b) => (b.latestActivityAt ?? "").localeCompare(a.latestActivityAt ?? "") || a.guardian.name.localeCompare(b.guardian.name, "ko-KR"));
  }, [customerSearch, customerSummaries]);
  const deletedGuardians = useMemo(
    () =>
      (data.deletedGuardians ?? [])
        .filter((guardian) => guardian.deleted_at && guardian.deleted_restore_until)
        .sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? "")),
    [data.deletedGuardians],
  );
  const filteredDeletedGuardians = useMemo(() => {
    const query = customerSearch.trim();
    return deletedGuardians.filter((guardian) => {
      if (!query) return true;
      const pets = data.pets.filter((pet) => pet.guardian_id === guardian.id);
      return (
        guardian.name.includes(query) ||
        guardian.phone.includes(query) ||
        pets.some((pet) => pet.name.includes(query) || pet.breed.includes(query))
      );
    });
  }, [customerSearch, data.pets, deletedGuardians]);

  const visitTimeline = useMemo(() => {
    const dates = Array.from(new Set([
      ...data.appointments.map((item) => item.appointment_date),
      ...data.groomingRecords.map((item) => item.groomed_at.slice(0, 10)),
    ])).sort((a, b) => b.localeCompare(a));

    return dates.map((date) => ({
      date,
      appointments: data.appointments
        .filter((item) => item.appointment_date === date)
        .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)),
      records: data.groomingRecords
        .filter((item) => item.groomed_at.slice(0, 10) === date)
        .sort((a, b) => b.groomed_at.localeCompare(a.groomed_at)),
    }));
  }, [data.appointments, data.groomingRecords]);

  const selectedVisitDate = visitDateFilter || todayDate;
  const selectedVisitRange = useMemo(() => {
    if (visitSelectionMode !== "range" || !visitRange) return null;
    return visitRange.start <= visitRange.end ? visitRange : { start: visitRange.end, end: visitRange.start };
  }, [visitRange, visitSelectionMode]);
  const isSelectedVisitRange = Boolean(selectedVisitRange);
  const selectedVisitStart = selectedVisitRange?.start ?? selectedVisitDate;
  const selectedVisitEnd = selectedVisitRange?.end ?? selectedVisitDate;
  const selectedVisitDates = useMemo(() => {
    const dates: string[] = [];
    let cursor = selectedVisitStart;
    while (cursor <= selectedVisitEnd) {
      dates.push(cursor);
      cursor = addDate(cursor, 1);
    }
    return dates;
  }, [selectedVisitEnd, selectedVisitStart]);
  const selectedVisitDateSet = useMemo(() => new Set(selectedVisitDates), [selectedVisitDates]);
  const selectedVisitAppointments = useMemo(() => data.appointments.filter((item) => selectedVisitDateSet.has(item.appointment_date)).sort((a, b) => (a.appointment_date + " " + a.appointment_time).localeCompare(b.appointment_date + " " + b.appointment_time)), [data.appointments, selectedVisitDateSet]);
  const selectedVisitRecords = useMemo(() => data.groomingRecords.filter((item) => selectedVisitDateSet.has(item.groomed_at.slice(0, 10))).sort((a, b) => b.groomed_at.localeCompare(a.groomed_at)), [data.groomingRecords, selectedVisitDateSet]);
  const completedAppointmentIds = useMemo(() => new Set(selectedVisitRecords.map((item) => item.appointment_id).filter(Boolean)), [selectedVisitRecords]);
  const selectedVisitReservationAppointments = useMemo(
    () =>
      selectedVisitAppointments.filter(
        (item) => item.status !== "cancelled" && item.status !== "completed" && !completedAppointmentIds.has(item.id),
      ),
    [completedAppointmentIds, selectedVisitAppointments],
  );
  const selectedVisitCancelledAppointments = useMemo(() => selectedVisitAppointments.filter((item) => item.status === "cancelled"), [selectedVisitAppointments]);
  const selectedVisitCompletedAppointments = useMemo(() => selectedVisitAppointments.filter((item) => {
    if (item.status === "cancelled") return false;
    const isPast = item.appointment_date < todayDate;
    if (isPast) return !completedAppointmentIds.has(item.id);
    return ["completed"].includes(item.status) && !completedAppointmentIds.has(item.id);
  }), [completedAppointmentIds, selectedVisitAppointments, todayDate]);
  const visitSectionOrder: Array<"reservation" | "cancel_change" | "completed"> = ["reservation", "cancel_change", "completed"];

  const visitCalendarMonth = visitCalendarMonthCursor;
  const visitCalendarMonthStart = visitCalendarMonth + "-01";
  const visitCalendarMonthLabel = visitCalendarMonth.slice(2, 4) + "년 " + String(Number(visitCalendarMonth.slice(5, 7))) + "월";
  const dateHeaderFormatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" });
  const dateRangeFormatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });
  const selectedVisitDateHeader = isSelectedVisitRange ? dateRangeFormatter.format(new Date(selectedVisitStart + "T00:00:00")) + " ~ " + dateRangeFormatter.format(new Date(selectedVisitEnd + "T00:00:00")) : dateHeaderFormatter.format(new Date(selectedVisitDate + "T00:00:00"));
  const pendingVisitRange = useMemo(() => {
    if (pendingVisitSelectionMode !== "range" || !pendingVisitRangeStart || !pendingVisitRangeEnd) return null;
    return pendingVisitRangeStart <= pendingVisitRangeEnd ? { start: pendingVisitRangeStart, end: pendingVisitRangeEnd } : { start: pendingVisitRangeEnd, end: pendingVisitRangeStart };
  }, [pendingVisitRangeEnd, pendingVisitRangeStart, pendingVisitSelectionMode]);
  const pendingVisitDateHeader = pendingVisitSelectionMode === "range" && pendingVisitRange ? dateRangeFormatter.format(new Date(pendingVisitRange.start + "T00:00:00")) + " ~ " + dateRangeFormatter.format(new Date(pendingVisitRange.end + "T00:00:00")) : dateHeaderFormatter.format(new Date(pendingVisitDate + "T00:00:00"));
  const quickVisitDates = useMemo(() => Array.from({ length: 8 }, (_, index) => addDate(todayDate, index)), [todayDate]);
  const isSelectedVisitInQuickRange = !isSelectedVisitRange && quickVisitDates.includes(selectedVisitDate);
  const canConfirmVisitCalendar = pendingVisitSelectionMode === "single" ? Boolean(pendingVisitDate) : Boolean(pendingVisitRange);
  const visitCalendarCells = useMemo(() => {
    const startDate = new Date(visitCalendarMonthStart + "T00:00:00");
    const startWeekday = startDate.getDay();
    const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayOffset = index - startWeekday;
      if (dayOffset < 0 || dayOffset >= daysInMonth) return null;
      return addDate(visitCalendarMonthStart, dayOffset);
    });
  }, [visitCalendarMonthStart]);
  const selectedGuardian = selectedGuardianId ? guardianMap[selectedGuardianId] : null;
  const selectedGuardianSummary = useMemo(
    () => (selectedGuardian ? customerSummaries.find((summary) => summary.guardian.id === selectedGuardian.id) ?? null : null),
    [customerSummaries, selectedGuardian],
  );
  const selectedGuardianPets = useMemo(
    () => (selectedGuardian ? data.pets.filter((item) => item.guardian_id === selectedGuardian.id) : []),
    [data.pets, selectedGuardian],
  );
  const selectedCustomerPet = selectedCustomerPetId && selectedGuardianPets.some((pet) => pet.id === selectedCustomerPetId)
    ? petMap[selectedCustomerPetId]
    : selectedGuardianSummary?.latestPet ?? selectedGuardianPets[0] ?? null;
  const customerDetailCutoffDate = useMemo(
    () => subtractMonthsDate(todayDate, CUSTOMER_DETAIL_HISTORY_MONTHS),
    [todayDate],
  );
  const selectedRecords = useMemo(
    () =>
      selectedGuardian
        ? data.groomingRecords
            .filter((item) => item.guardian_id === selectedGuardian.id)
            .filter((item) => item.groomed_at.slice(0, 10) >= customerDetailCutoffDate)
            .sort((a, b) => b.groomed_at.localeCompare(a.groomed_at))
        : [],
    [customerDetailCutoffDate, data.groomingRecords, selectedGuardian],
  );
  const selectedNotifications = useMemo(() => {
    if (!selectedGuardian) return [];
    const selectedPetIds = new Set(selectedGuardianPets.map((item) => item.id));
    return data.notifications
      .filter((item) => {
        const sameGuardian = item.guardian_id === selectedGuardian.id;
        const samePet = item.pet_id ? selectedPetIds.has(item.pet_id) : false;
        return sameGuardian || samePet;
      })
      .filter((item) => (item.sent_at ?? item.created_at).slice(0, 10) >= customerDetailCutoffDate)
      .sort((a, b) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at));
  }, [customerDetailCutoffDate, data.notifications, selectedGuardian, selectedGuardianPets]);
  const totalRecordPages = Math.max(1, Math.ceil(selectedRecords.length / CUSTOMER_DETAIL_PAGE_SIZE));
  const totalNotificationPages = Math.max(1, Math.ceil(selectedNotifications.length / CUSTOMER_DETAIL_PAGE_SIZE));
  const pagedSelectedRecords = useMemo(
    () =>
      selectedRecords.slice(
        (recordPage - 1) * CUSTOMER_DETAIL_PAGE_SIZE,
        recordPage * CUSTOMER_DETAIL_PAGE_SIZE,
      ),
    [recordPage, selectedRecords],
  );
  const pagedSelectedNotifications = useMemo(
    () =>
      selectedNotifications.slice(
        (notificationPage - 1) * CUSTOMER_DETAIL_PAGE_SIZE,
        notificationPage * CUSTOMER_DETAIL_PAGE_SIZE,
      ),
    [notificationPage, selectedNotifications],
  );
  const guardianNotificationsEnabled = selectedGuardian?.notification_settings.enabled ?? false;
  const customerNotificationGroups: Array<{
    title: string;
    items: Array<{
    label: string;
    description: string;
    settingKey: GuardianNotificationSettingKey;
    }>;
  }> = [
    {
      title: "예약 안내",
      items: [
        {
          label: "예약 확정",
          description: "예약이 최종 확정되었을 때 보내는 알림이에요.",
          settingKey: "booking_confirmed_enabled",
        },
        {
          label: "예약 거절",
          description: "예약을 받을 수 없을 때 고객에게 사유를 안내해요.",
          settingKey: "booking_rejected_enabled",
        },
        {
          label: "예약 취소",
          description: "확정된 예약이 취소되면 바로 알려드려요.",
          settingKey: "booking_cancelled_enabled",
        },
        {
          label: "예약 변경 확정",
          description: "변경된 일정이 확정되면 새 방문 시간을 알려드려요.",
          settingKey: "booking_rescheduled_enabled",
        },
        {
          label: "방문 10분 전",
          description: "예약 시간이 가까워졌을 때 미리 안내해요.",
          settingKey: "appointment_reminder_10m_enabled",
        },
      ],
    },
    {
      title: "미용 진행 안내",
      items: [
        {
          label: "미용 시작",
          description: "매장에서 미용을 시작했을 때 바로 알려드려요.",
          settingKey: "grooming_started_enabled",
        },
        {
          label: "픽업 준비",
          description: "미용이 거의 끝나 픽업 준비가 되었을 때 안내해요.",
          settingKey: "grooming_almost_done_enabled",
        },
        {
          label: "미용 완료",
          description: "미용이 끝나 고객이 데리러 오실 수 있을 때 보내요.",
          settingKey: "grooming_completed_enabled",
        },
      ],
    },
    {
      title: "관계 관리",
      items: [
        {
          label: "재방문 안내",
          description: "재방문 시기가 가까워졌을 때 안내해요.",
          settingKey: "revisit_enabled",
        },
        {
          label: "생일 축하",
          description: "반려동물 생일에 맞춰 축하 메시지를 보낼 수 있어요.",
          settingKey: "birthday_greeting_enabled",
        },
      ],
    },
  ];
  const isAnyCustomerFieldEditing = Object.values(editingCustomerFields).some(Boolean);
  const canSavePetProfile = Boolean(selectedCustomerPet && petDraftName.trim() && petDraftName.trim() !== selectedCustomerPet.name);
  const canSaveGuardianProfile = Boolean(
    selectedGuardian &&
      guardianDraft.name.trim() &&
      guardianDraft.phone.trim() &&
      (
        guardianDraft.name.trim() !== selectedGuardian.name ||
        guardianDraft.phone.trim() !== selectedGuardian.phone ||
        guardianDraft.memo.trim() !== (selectedGuardian.memo || "")
      ),
  );

  useEffect(() => {
    setRecordPage(1);
    setNotificationPage(1);
  }, [selectedGuardianId]);

  useEffect(() => {
    if (recordPage > totalRecordPages) {
      setRecordPage(totalRecordPages);
    }
  }, [recordPage, totalRecordPages]);

  useEffect(() => {
    if (notificationPage > totalNotificationPages) {
      setNotificationPage(totalNotificationPages);
    }
  }, [notificationPage, totalNotificationPages]);

  useEffect(() => {
    if (isOwnerDemo || typeof window === "undefined") return;

    const syncIfIdle = () => {
      const canSync =
        document.visibilityState === "visible" &&
        !saving &&
        !modal &&
        !isAnyCustomerFieldEditing &&
        !isCustomerListEditing &&
        !isShopPickerOpen;

      if (!canSync) return;
      void refreshSilently();
    };

    const intervalId = window.setInterval(syncIfIdle, 15000);
    window.addEventListener("focus", syncIfIdle);
    document.addEventListener("visibilitychange", syncIfIdle);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncIfIdle);
      document.removeEventListener("visibilitychange", syncIfIdle);
    };
  }, [isAnyCustomerFieldEditing, isCustomerListEditing, isOwnerDemo, isShopPickerOpen, modal, saving]);

  useEffect(() => {
    if (!selectedGuardian) {
      setSelectedCustomerPetId(null);
      setIsCustomerToolsOpen(false);
      return;
    }
    setGuardianDraft({
      name: selectedGuardian.name,
      phone: selectedGuardian.phone,
      memo: selectedGuardian.memo || "",
    });
    setEditingCustomerFields({
      name: false,
      phone: false,
      pet: false,
      memo: false,
    });
    setIsGuardianEditing(false);
    setIsGuardianMemoEditing(false);
    setIsCustomerToolsOpen(false);
    setSelectedCustomerPetId((prev) => {
      if (prev && selectedGuardianPets.some((pet) => pet.id === prev)) return prev;
      return selectedGuardianSummary?.latestPet?.id ?? selectedGuardianPets[0]?.id ?? null;
    });
  }, [selectedGuardian, selectedGuardianPets, selectedGuardianSummary]);

  useEffect(() => {
    const activeGuardianIds = new Set(data.guardians.map((guardian) => guardian.id));
    setSelectedGuardianIds((prev) => prev.filter((guardianId) => activeGuardianIds.has(guardianId)));
    setSelectedGuardianId((prev) => (prev && activeGuardianIds.has(prev) ? prev : null));
    const activePetIds = new Set(data.pets.map((pet) => pet.id));
    setSelectedCustomerPetId((prev) => (prev && activePetIds.has(prev) ? prev : null));
  }, [data.guardians, data.pets]);

  useEffect(() => {
    setPetDraftName(selectedCustomerPet?.name ?? "");
  }, [selectedCustomerPet]);

  async function mutate(url: string, init: RequestInit, options?: { rethrow?: boolean }) {
    if (isOwnerDemo) {
      setModal(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await fetchJson(url, init);
      await refresh();
      setModal(null);
    } catch (mutationError) {
      await handleRequestError(mutationError, "저장에 실패했습니다.");
      if (options?.rethrow) {
        throw mutationError;
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateAppointment(appointmentId: string, payload: AppointmentUpdatePayload) {
    if (isOwnerDemo) {
      const isEditPayload = "mode" in payload && payload.mode === "edit";
      const statusPayload: AppointmentStatusUpdatePayload | null = isEditPayload
        ? null
        : (payload as AppointmentStatusUpdatePayload);
      setData((prev) => ({
        ...prev,
        appointments: prev.appointments.map((appointment) =>
          appointment.id === appointmentId
            ? {
                ...appointment,
                ...(isEditPayload
                  ? {
                      service_id: payload.serviceId,
                      appointment_date: payload.appointmentDate,
                      appointment_time: payload.appointmentTime,
                      memo: payload.memo,
                      status: "confirmed" as AppointmentStatus,
                      rejection_reason: null,
                    }
                  : {
                      status: statusPayload!.status,
                      rejection_reason:
                        statusPayload!.status === "rejected"
                          ? statusPayload!.rejectionReasonCustom?.trim() || statusPayload!.rejectionReasonTemplate || appointment.rejection_reason
                          : null,
                    }),
              }
            : appointment,
        ),
      }));
      setModal(null);
      return;
    }

    await mutate("/api/appointments", {
      method: "PATCH",
      body: JSON.stringify({ appointmentId, ...payload }),
    });
  }

  function openMobilePhotoStatusAction(
    appointmentId: string,
    status: Extract<AppointmentStatus, "in_progress" | "completed">,
    autoOpenCamera = false,
  ) {
    setMobilePhotoStatusAction({
      appointmentId,
      nextStatus: status,
      mediaKind: status === "in_progress" ? "grooming_before" : "grooming_after",
      title: status === "in_progress" ? "미용 전 사진" : "미용 완료 사진",
      description:
        status === "in_progress"
          ? "미용 전 털 상태, 엉킴, 피부 상태를 선택적으로 남길 수 있어요."
          : "마무리된 모습을 한 장 촬영하면 미용 완료 알림톡에 함께 기록됩니다.",
      buttonLabel: status === "in_progress" ? "사진 찍고 미용 시작" : "사진 찍고 미용 완료",
      skipLabel: status === "in_progress" ? "사진 없이 미용 시작" : "사진 없이 미용 완료",
      autoOpenCamera,
    });
  }

  function requestMobileAppointmentStatusChange(appointmentId: string, status: AppointmentStatus) {
    if (
      status === "completed" &&
      data.shop.notification_settings.grooming_complete_without_photo_enabled
    ) {
      void updateAppointment(appointmentId, { status });
      return;
    }

    if (status === "in_progress") {
      openMobilePhotoStatusAction(appointmentId, status);
      return;
    }

    if (status !== "completed") {
      void updateAppointment(appointmentId, { status });
      return;
    }

    openMobilePhotoStatusAction(appointmentId, status);
  }

  function startMobileAppointmentWithoutPhoto(appointmentId: string) {
    void updateAppointment(appointmentId, { status: "in_progress" });
  }

  function startMobileAppointmentWithPhoto(appointmentId: string, file: File) {
    void updateAppointmentStatusWithMobilePhoto(appointmentId, "in_progress", "grooming_before", file);
  }

  function updateAppointmentWithMobilePhotoGuard(appointmentId: string, payload: AppointmentUpdatePayload) {
    const isStatusUpdatePayload = "status" in payload;
    const canSkipPhoto =
      isStatusUpdatePayload &&
      payload.status === "completed" && data.shop.notification_settings.grooming_complete_without_photo_enabled;

    if (
      isStatusUpdatePayload &&
      !("mode" in payload) &&
      payload.status === "completed" &&
      !payload.mediaAssetIds?.length &&
      !canSkipPhoto
    ) {
      requestMobileAppointmentStatusChange(appointmentId, payload.status);
      return;
    }

    void updateAppointment(appointmentId, payload);
  }

  async function updateAppointmentStatusWithMobilePhoto(
    appointmentId: string,
    nextStatus: Extract<AppointmentStatus, "in_progress" | "completed">,
    mediaKind: Extract<MediaKind, "grooming_before" | "grooming_after">,
    file: File,
  ) {
    const appointment = data.appointments.find((item) => item.id === appointmentId);
    if (!appointment) {
      setError("사진을 연결할 예약 정보를 찾지 못했습니다.");
      setMobilePhotoStatusAction(null);
      return;
    }

    setMobilePhotoUploading(true);
    setError(null);
    try {
      const uploaded = await createOwnerMediaAssetFromFile(
        {
          shopId: data.shop.id,
          guardianId: appointment.guardian_id,
          petId: appointment.pet_id,
          appointmentId: appointment.id,
          groomingRecordId: null,
        },
        mediaKind,
        file,
      );

      await updateAppointment(appointment.id, {
        status: nextStatus,
        mediaAssetIds: [uploaded.mediaAsset.id],
      });
      setMobilePhotoStatusAction(null);
    } catch (uploadError) {
      await handleRequestError(uploadError, "사진 업로드 또는 상태 변경에 실패했습니다.");
    } finally {
      setMobilePhotoUploading(false);
    }
  }

  async function handleMobilePhotoStatusFile(file: File) {
    if (!mobilePhotoStatusAction) return;
    await updateAppointmentStatusWithMobilePhoto(
      mobilePhotoStatusAction.appointmentId,
      mobilePhotoStatusAction.nextStatus,
      mobilePhotoStatusAction.mediaKind,
      file,
    );
  }

  function openSettingsScreen(screen: Exclude<SettingsEntryScreen, null>) {
    setSettingsEntryScreen(screen);
    setActiveTab("settings");
  }

  async function updateGuardianNotifications(guardianId: string, patch: Partial<GuardianNotificationSettings>) {
    if (isOwnerDemo) {
      setData((prev) => ({
        ...prev,
        guardians: prev.guardians.map((guardian) =>
          guardian.id === guardianId
            ? {
                ...guardian,
                notification_settings: {
                  ...guardian.notification_settings,
                  ...patch,
                },
              }
            : guardian,
        ),
      }));
      return;
    }

    await mutate("/api/guardians", {
      method: "PATCH",
      body: JSON.stringify({ guardianId, notificationSettings: patch }),
    });
  }

  async function updateGuardianProfile(guardianId: string, name: string, phone: string, memo: string) {
    if (isOwnerDemo) {
      setData((prev) => ({
        ...prev,
        guardians: prev.guardians.map((guardian) =>
          guardian.id === guardianId
            ? {
                ...guardian,
                name,
                phone,
                memo,
              }
            : guardian,
        ),
      }));
      setIsGuardianEditing(false);
      setIsGuardianMemoEditing(false);
      return;
    }

    await mutate("/api/guardians", {
      method: "PATCH",
      body: JSON.stringify({ guardianId, name, phone, memo }),
    });
    setIsGuardianEditing(false);
    setIsGuardianMemoEditing(false);
  }

  async function deleteGuardianProfile(guardianId: string) {
    if (isOwnerDemo) {
      const deletedAt = new Date().toISOString();
      const restoreUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      setData((prev) => {
        return {
          ...prev,
          guardians: prev.guardians.filter((guardian) => guardian.id !== guardianId),
          deletedGuardians: [
            {
              ...(prev.guardians.find((guardian) => guardian.id === guardianId)!),
              deleted_at: deletedAt,
              deleted_restore_until: restoreUntil,
              updated_at: deletedAt,
            },
            ...(prev.deletedGuardians ?? []),
          ],
        };
      });
      setSelectedGuardianId(null);
      setSelectedCustomerPetId(null);
      setSelectedGuardianIds((prev) => prev.filter((id) => id !== guardianId));
      setIsGuardianEditing(false);
      setIsGuardianMemoEditing(false);
      return;
    }

    await mutate("/api/guardians", {
      method: "DELETE",
      body: JSON.stringify({ guardianId }),
    });
    setSelectedGuardianId(null);
    setSelectedCustomerPetId(null);
    setSelectedGuardianIds((prev) => prev.filter((id) => id !== guardianId));
    setIsGuardianEditing(false);
    setIsGuardianMemoEditing(false);
  }

  async function deleteGuardianIds(guardianIds: string[]) {
    if (guardianIds.length === 0 || saving) return;
    const confirmDelete = window.confirm(`선택한 고객 ${guardianIds.length}명을 삭제하시겠어요?\n3일 안에는 다시 복구할 수 있어요.`);
    if (!confirmDelete) return;

    if (isOwnerDemo) {
      const deletedAt = new Date().toISOString();
      const restoreUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      setData((prev) => {
        const deleting = prev.guardians.filter((guardian) => guardianIds.includes(guardian.id));
        return {
          ...prev,
          guardians: prev.guardians.filter((guardian) => !guardianIds.includes(guardian.id)),
          deletedGuardians: [
            ...deleting.map((guardian) => ({
              ...guardian,
              deleted_at: deletedAt,
              deleted_restore_until: restoreUntil,
              updated_at: deletedAt,
            })),
            ...(prev.deletedGuardians ?? []),
          ],
        };
      });
      setSelectedGuardianIds([]);
      if (selectedGuardian && guardianIds.includes(selectedGuardian.id)) {
        setSelectedGuardianId(null);
        setSelectedCustomerPetId(null);
      }
      return;
    }

    await mutate("/api/guardians", {
      method: "DELETE",
      body: JSON.stringify({ guardianIds }),
    });
    setSelectedGuardianIds([]);
    if (selectedGuardian && guardianIds.includes(selectedGuardian.id)) {
      setSelectedGuardianId(null);
      setSelectedCustomerPetId(null);
    }
  }

  async function saveShopProfile(payload: ShopProfileSavePayload) {
    const nextHeroImageUrl = payload.customerPageSettingsPayload.customerPageSettings.hero_image_url || "";
    const nextAddress = payload.settingsPayload.address;
    const nextName = payload.settingsPayload.name;

    const syncOwnedShopSummary = () => {
      setOwnedShopItems((prev) =>
        prev.map((shop) =>
          shop.id === data.shop.id
            ? {
                ...shop,
                name: nextName,
                address: nextAddress,
                heroImageUrl: nextHeroImageUrl,
              }
            : shop,
        ),
      );
    };

    if (isOwnerDemo) {
      setData((prev) => ({
        ...prev,
        shop: {
          ...prev.shop,
          name: payload.settingsPayload.name,
          phone: payload.settingsPayload.phone,
          address: payload.settingsPayload.address,
          description: payload.settingsPayload.description,
          concurrent_capacity: payload.settingsPayload.concurrentCapacity,
          booking_slot_interval_minutes: payload.settingsPayload.bookingSlotIntervalMinutes,
          booking_slot_offset_minutes: payload.settingsPayload.bookingSlotOffsetMinutes,
          booking_available_start_time: payload.settingsPayload.bookingAvailableStartTime,
          booking_available_end_time: payload.settingsPayload.bookingAvailableEndTime,
          business_hours: payload.settingsPayload.businessHours,
          customer_page_settings: payload.customerPageSettingsPayload.customerPageSettings,
        },
      }));
      syncOwnedShopSummary();
      setModal(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await fetchJson("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.settingsPayload),
      });
      await fetchJson("/api/customer-page-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.customerPageSettingsPayload),
      });
      syncOwnedShopSummary();
      await refresh();
      setModal(null);
    } catch (mutationError) {
      await handleRequestError(mutationError, "매장 정보 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedGuardians() {
    await deleteGuardianIds(selectedGuardianIds);
  }

  async function restoreDeletedGuardians(guardianIds: string[]) {
    if (guardianIds.length === 0 || saving) return;

    if (isOwnerDemo) {
      setData((prev) => {
        const restoring = (prev.deletedGuardians ?? []).filter((guardian) => guardianIds.includes(guardian.id));
        return {
          ...prev,
          guardians: [
            ...restoring.map((guardian) => ({
              ...guardian,
              deleted_at: null,
              deleted_restore_until: null,
              updated_at: new Date().toISOString(),
            })),
            ...prev.guardians,
          ],
          deletedGuardians: (prev.deletedGuardians ?? []).filter((guardian) => !guardianIds.includes(guardian.id)),
        };
      });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await fetchJson("/api/guardians/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guardianIds }),
      });
      await refresh();
    } catch (mutationError) {
      await handleRequestError(mutationError, "복구에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function toggleGuardianSelection(guardianId: string) {
    setSelectedGuardianIds((prev) =>
      prev.includes(guardianId) ? prev.filter((id) => id !== guardianId) : [...prev, guardianId],
    );
  }

  function toggleAllVisibleGuardians() {
    if (filteredGuardians.length === 0) return;
    const visibleIds = filteredGuardians.map((summary) => summary.guardian.id);
    const allSelected = visibleIds.every((guardianId) => selectedGuardianIds.includes(guardianId));

    setSelectedGuardianIds((prev) => {
      if (allSelected) {
        return prev.filter((guardianId) => !visibleIds.includes(guardianId));
      }
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  }

  async function handleGuardianProfileSave() {
    if (!selectedGuardian || saving || !canSaveGuardianProfile) return;
    await updateGuardianProfile(
      selectedGuardian.id,
      guardianDraft.name.trim(),
      guardianDraft.phone.trim(),
      guardianDraft.memo.trim(),
    );
  }

  async function handleGuardianMemoSave() {
    if (!selectedGuardian || saving) return;
    if (guardianDraft.memo.trim() === (selectedGuardian.memo || "")) {
      setIsGuardianMemoEditing(false);
      return;
    }
    await updateGuardianProfile(
      selectedGuardian.id,
      isGuardianEditing ? guardianDraft.name.trim() : selectedGuardian.name,
      isGuardianEditing ? guardianDraft.phone.trim() : selectedGuardian.phone,
      guardianDraft.memo.trim(),
    );
  }

  function openCustomerFieldEditor(field: CustomerEditableField) {
    if (!selectedGuardian) return;
    setGuardianDraft({
      name: selectedGuardian.name,
      phone: selectedGuardian.phone,
      memo: selectedGuardian.memo || "",
    });
    setPetDraftName(selectedCustomerPet?.name ?? "");
    setEditingCustomerFields({
      name: field === "name",
      phone: field === "phone",
      pet: field === "pet",
      memo: field === "memo",
    });
    setIsGuardianEditing(field === "name" || field === "phone" || field === "pet");
    setIsGuardianMemoEditing(field === "memo");
  }

  async function handleCustomerInlineSave() {
    if (!selectedGuardian || saving) return;

    const shouldSaveGuardian =
      (editingCustomerFields.name || editingCustomerFields.phone || editingCustomerFields.memo) &&
      guardianDraft.name.trim() &&
      guardianDraft.phone.trim() &&
      (guardianDraft.name.trim() !== selectedGuardian.name ||
        guardianDraft.phone.trim() !== selectedGuardian.phone ||
        guardianDraft.memo.trim() !== (selectedGuardian.memo || ""));

    const shouldSavePet = editingCustomerFields.pet && selectedCustomerPet && canSavePetProfile;

    if (!shouldSaveGuardian && !shouldSavePet) {
      setEditingCustomerFields({ name: false, phone: false, pet: false, memo: false });
      setIsGuardianEditing(false);
      setIsGuardianMemoEditing(false);
      return;
    }

    if (shouldSaveGuardian) {
      await updateGuardianProfile(
        selectedGuardian.id,
        guardianDraft.name.trim(),
        guardianDraft.phone.trim(),
        guardianDraft.memo.trim(),
      );
    }

    if (shouldSavePet && selectedCustomerPet) {
      await updatePetProfile(
        selectedCustomerPet.id,
        petDraftName.trim(),
        selectedCustomerPet.breed,
        selectedCustomerPet.birthday,
      );
    }

    setEditingCustomerFields({ name: false, phone: false, pet: false, memo: false });
    setIsGuardianEditing(false);
    setIsGuardianMemoEditing(false);
  }

  async function handleGuardianDelete() {
    if (!selectedGuardian || saving) return;
    const confirmed = window.confirm(`${selectedGuardian.name} 고객 정보를 삭제할까요?\n3일 안에는 다시 복구할 수 있어요.`);
    if (!confirmed) return;
    await deleteGuardianProfile(selectedGuardian.id);
  }

  async function updatePetProfile(petId: string, name: string, breed: string, birthday: string | null) {
    if (isOwnerDemo) {
      setData((prev) => ({
        ...prev,
        pets: prev.pets.map((pet) => (pet.id === petId ? { ...pet, name, breed, birthday } : pet)),
      }));
      return;
    }

    await mutate("/api/pets", {
      method: "PATCH",
      body: JSON.stringify({ petId, name, breed, birthday }),
    });
  }

  async function sendBirthdayGreeting(pet: Pet) {
    const guardian = guardianMap[pet.guardian_id];
    if (!guardian) return;
    if (!guardian.notification_settings.enabled) {
      setError("이 고객은 알림톡 수신이 꺼져 있어요. 고객 관리에서 먼저 켜 주세요.");
      return;
    }
    if (!guardian.notification_settings.birthday_greeting_enabled) {
      setError("이 고객은 생일 축하 알림이 꺼져 있어요. 고객 관리에서 먼저 켜 주세요.");
      return;
    }

    if (isOwnerDemo) {
      const now = new Date().toISOString();
      setData((prev) => ({
        ...prev,
        notifications: [
          {
            id: `demo-birthday-${pet.id}-${Date.now()}`,
            shop_id: prev.shop.id,
            appointment_id: null,
            pet_id: pet.id,
            guardian_id: guardian.id,
            type: "birthday_greeting",
            channel: "alimtalk",
            message: `[${prev.shop.name}] ${pet.name}의 생일을 축하드려요. 오늘도 행복한 하루 보내세요.`,
            status: "mocked",
            provider: "mock",
            provider_message_id: null,
            recipient_phone: guardian.phone,
            fail_reason: null,
            scheduled_at: null,
            sent_at: now,
            created_at: now,
            template_key: "birthday_greeting",
            template_type: "birthday_greeting",
            metadata: { source: "manual" },
          },
          ...prev.notifications,
        ],
      }));
      setDetailTab("notifications");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await fetchJson("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: data.shop.id,
          guardianId: guardian.id,
          petId: pet.id,
          type: "birthday_greeting",
          templateKey: "birthday_greeting",
          templateType: "birthday_greeting",
          message: `[${data.shop.name}] ${pet.name}의 생일을 축하드려요. 오늘도 행복한 하루 보내세요.`,
        }),
      });
      await refresh();
      setDetailTab("notifications");
    } catch (mutationError) {
      await handleRequestError(mutationError, "생일 축하 알림 발송에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function sendRevisitNotice(pet: Pet) {
    const guardian = guardianMap[pet.guardian_id];
    if (!guardian) return;
    if (!guardian.notification_settings.enabled) {
      setError("이 고객은 알림톡 수신이 꺼져 있어요. 고객 관리에서 먼저 켜 주세요.");
      return;
    }
    if (!guardian.notification_settings.revisit_enabled) {
      setError("이 고객은 재방문 알림이 꺼져 있어요. 고객 관리에서 먼저 켜 주세요.");
      return;
    }

    if (isOwnerDemo) {
      const now = new Date().toISOString();
      setData((prev) => ({
        ...prev,
        notifications: [
          {
            id: `demo-revisit-${pet.id}-${Date.now()}`,
            shop_id: prev.shop.id,
            appointment_id: null,
            pet_id: pet.id,
            guardian_id: guardian.id,
            type: "revisit_notice",
            channel: "alimtalk",
            message: `[${prev.shop.name}] ${pet.name} 재방문 안내 알림을 발송했어요.`,
            status: "mocked",
            provider: "mock",
            provider_message_id: null,
            recipient_phone: guardian.phone,
            fail_reason: null,
            scheduled_at: null,
            sent_at: now,
            created_at: now,
            template_key: "revisit_notice",
            template_type: "revisit_notice",
            metadata: { source: "manual" },
          },
          ...prev.notifications,
        ],
      }));
      setDetailTab("notifications");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await fetchJson("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: data.shop.id,
          guardianId: guardian.id,
          petId: pet.id,
          type: "revisit_notice",
          templateKey: "revisit_notice",
          templateType: "revisit_notice",
          message: `[${data.shop.name}] ${pet.name} 재방문 안내 알림을 발송했어요.`,
        }),
      });
      await refresh();
      setDetailTab("notifications");
    } catch (mutationError) {
      await handleRequestError(mutationError, "재방문 알림 발송에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function sendAppointmentReminder(appointment: Appointment, pet: Pet, guardian: Guardian, service: Service) {
    if (!guardian.notification_settings.enabled) {
      setError("이 고객은 알림톡 수신이 꺼져 있어요. 고객 관리에서 먼저 켜 주세요.");
      return;
    }
    if (!guardian.notification_settings.appointment_reminder_10m_enabled) {
      setError("이 고객은 방문 전 안내 알림이 꺼져 있어요. 고객 관리에서 먼저 켜 주세요.");
      return;
    }

    if (isOwnerDemo) {
      setData((prev) => ({
        ...prev,
        notifications: [
          {
            id: `demo-reminder-${appointment.id}-${Date.now()}`,
            shop_id: prev.shop.id,
            appointment_id: appointment.id,
            pet_id: pet.id,
            guardian_id: guardian.id,
            type: "appointment_reminder_10m",
            channel: "alimtalk",
            message: `${pet.name} 예약 10분 전 알림톡을 발송했어요.`,
            status: "mocked",
            provider: "mock",
            metadata: {
              appointmentDate: appointment.appointment_date,
              appointmentTime: formatClockTime(appointment.appointment_time),
            },
            sent_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
          ...prev.notifications,
        ],
      }));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await fetchJson("/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          shopId: data.shop.id,
          appointmentId: appointment.id,
          guardianId: guardian.id,
          petId: pet.id,
          type: "appointment_reminder_10m",
          channel: "alimtalk",
          force: true,
          metadata: {
            serviceName: service.name,
            appointmentDate: appointment.appointment_date,
            appointmentTime: formatClockTime(appointment.appointment_time),
          },
        }),
      });
      await refresh();
    } catch (mutationError) {
      await handleRequestError(mutationError, "알림톡 발송에 실패했습니다.");
      throw mutationError;
    } finally {
      setSaving(false);
    }
  }

  const overdueCount = revisitRows.filter((item) => item.status === "overdue").length;
  const urgentCount = revisitRows.filter((item) => item.status === "overdue" || item.status === "soon").length;
  const isCustomerDetailView = activeTab === "customers" && Boolean(selectedGuardian);
  const isSettingsDetailView = activeTab === "settings" && Boolean(settingsEntryScreen);
  const currentSettingsScreenTitle = settingsEntryScreen ? settingsEntryScreenTitles[settingsEntryScreen] : "";
  const screenTitle =
    activeTab === "customers"
      ? "고객 관리"
      : tabItems.find((item) => item.key === activeTab)?.label;
  const bookingEntryUrl = `${ownerPageOrigin || ""}/s/${data.shop.id}`;
  const isHomeTab = activeTab === "home";
  const customerEmptyTitle = customerSearch.trim() ? "검색 조건과 맞는 활성 고객이 없어요" : "등록된 고객이 아직 없어요";
  const customerEmptyDescription =
    customerSearch.trim() && filteredDeletedGuardians.length > 0
      ? "삭제 고객에서는 일치하는 항목이 있어요. 삭제 고객 보기를 열어 확인해 주세요."
      : customerSearch.trim()
        ? "이름, 연락처, 반려동물 이름을 다시 확인해 주세요."
        : "고객 추가로 첫 보호자와 반려동물을 등록해 주세요.";
  const allFilteredGuardiansSelected =
    filteredGuardians.length > 0 && filteredGuardians.every((summary) => selectedGuardianIds.includes(summary.guardian.id));
  const selectedGuardianCount = selectedGuardianIds.length;
  const selectedGuardianPetNames = selectedGuardianPets.map((pet) => pet.name).join(", ");
  const customerInlineSaveButtonClass =
    "inline-flex items-center justify-center rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[13px] font-medium tracking-[-0.01em] text-white transition disabled:opacity-45";
  const customerInlineInputClass = "field-input min-w-0 flex-1 !pt-0 !pb-[2px] !pr-[78px]";
  const headerAction: { label: string; onClick: () => void; disabled?: boolean } | null =
    activeTab === "book"
      ? { label: "예약추가", onClick: () => setModal({ type: "new-appointment" }) }
      : activeTab === "customers" && !selectedGuardian
        ? { label: "고객추가", onClick: () => setModal({ type: "new-customer" }) }
        : null;
  const homeSecondaryAction =
    isHomeTab
      ? {
          label: "예약 링크 복사",
          onClick: () => setGuideScreen("getting-started" as OwnerGuideScreen),
        }
      : null;

  return (
    <div
      className="pm-mobile-owner mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[var(--background)] shadow-[0_0_0_1px_rgba(15,23,42,0.04)]"
    >
      {!isCustomerDetailView ? (
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isHomeTab ? (
              <button
                type="button"
                onClick={() => setIsShopPickerOpen((prev) => !prev)}
                className="flex w-full max-w-[250px] items-center gap-2 rounded-[14px] bg-transparent py-1 text-left"
              >
                <ShopAvatar name={currentOwnedShop.name} imageUrl={currentOwnedShop.heroImageUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">{currentOwnedShop.name}</p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              </button>
            ) : (
              isSettingsDetailView ? (
                <button
                  type="button"
                  onClick={() => setSettingsEntryScreen(null)}
                  className="inline-flex h-10 w-full items-center gap-1.5 rounded-[8px] bg-transparent px-0 text-left text-sm font-semibold tracking-[-0.02em] text-[var(--text)]"
                  aria-label="설정으로 돌아가기"
                >
                  <ChevronRight className="h-4 w-4 shrink-0 rotate-180" strokeWidth={2} />
                  <span className="truncate">{currentSettingsScreenTitle}</span>
                </button>
              ) : (
                <div className="space-y-1">
                  <h1 className="text-[20px] font-medium tracking-[-0.03em] text-[var(--text)]">{screenTitle}</h1>
                </div>
              )
            )}
          </div>
          {headerAction ? (
            <button
              type="button"
              disabled={headerAction.disabled}
              className="shrink-0 rounded-[12px] border border-[var(--accent)] bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold tracking-[-0.01em] text-white disabled:opacity-45"
              onClick={headerAction.onClick}
            >
              {headerAction.label}
            </button>
          ) : homeSecondaryAction ? (
            <button
              type="button"
              className="relative top-[2px] inline-flex shrink-0 items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12px] font-semibold tracking-[-0.01em] text-[var(--text)] transition hover:bg-[#f8fafc]"
              onClick={homeSecondaryAction.onClick}
            >
              <Copy className="h-3.5 w-3.5 shrink-0 text-[var(--text)]" strokeWidth={1.8} />
              {homeSecondaryAction.label}
            </button>
          ) : null}
        </div>
      </header>
      ) : null}

      <main className="flex-1 overflow-y-auto pb-24">
        {error && <div className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {activeTab === "home" && (
          <section className="space-y-4 p-4 pb-5">
            {isOnboardingIncomplete ? (
              <Panel title="예약 오픈 전 체크리스트" action={`${onboardingTasks.length}단계 남음`}>
                <div className="space-y-2.5">
                  {onboardingTasks.map((task) =>
                    task ? (
                      <div key={task.key} className="rounded-[10px] border border-[var(--border)] bg-white px-4 py-3.5">
                        <p className="text-[14px] font-medium tracking-[-0.02em] text-[var(--text)]">{task.title}</p>
                        <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">{task.description}</p>
                        <button
                          type="button"
                          className="mt-3 inline-flex rounded-[10px] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-[12px] font-medium text-[var(--accent)]"
                          onClick={() => openSettingsScreen(task.key)}
                        >
                          {task.cta}
                        </button>
                      </div>
                    ) : null,
                  )}
                </div>
              </Panel>
            ) : null}
            <div className="space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_154px] gap-2">
                <div className="flex h-11 items-center justify-between gap-2 rounded-[14px] border border-[var(--border)] bg-white px-2" aria-label={`예약 날짜 선택: ${homeReservationFullDateLabel}`}>
                  <button
                    type="button"
                    onClick={() => moveHomeReservationDate("prev")}
                    disabled={!canMoveHomeReservationBackward}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="이전 날짜"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <p className="min-w-0 flex-1 text-center text-[16px] font-medium leading-8 tracking-[-0.02em] text-[var(--text)]">{homeReservationDateLabel}</p>
                  <button
                    type="button"
                    onClick={() => moveHomeReservationDate("next")}
                    disabled={!canMoveHomeReservationForward}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text)] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="다음 날짜"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <MobileStaffFilterStrip
                  options={homeStaffFilterOptions}
                  value={homeStaffFilter}
                  onChange={setHomeStaffFilter}
                />
              </div>
              <div className="space-y-3">
                <MobileStatusSummary
                  activeKey={homeFocusedSection}
                  items={[
                    { key: "pending", label: ownerHomeCopy.statPending, value: filteredHomePendingAppointments.length, tone: "warning", onClick: () => setHomeFocusedSection("pending") },
                    { key: "current", label: ownerHomeCopy.statUpcoming, value: filteredHomeActionAppointments.length, tone: "accent", onClick: () => setHomeFocusedSection("current") },
                    { key: "completed", label: ownerHomeCopy.statCompleted, value: filteredHomeCompletedHistoryAppointments.length, tone: "neutral", onClick: () => setHomeFocusedSection("completed") },
                    { key: "cancelChange", label: ownerHomeCopy.statCancelChange, value: filteredHomeCancelChangeAppointments.length, tone: "danger", onClick: () => setHomeFocusedSection("cancelChange") },
                  ]}
                />
                <div className="space-y-0">
                  <TodayConfirmedContent
                    pendingAppointments={filteredHomePendingAppointments}
                    currentAppointments={filteredHomeActionAppointments}
                    cancelChangeAppointments={filteredHomeCancelChangeAppointments}
                    completedAppointments={filteredHomeCompletedHistoryAppointments}
                    petMap={petMap}
                    guardianMap={guardianMap}
                    serviceMap={serviceMap}
                    staffMap={staffMap}
                    latestNotificationByAppointmentId={latestNotificationByAppointmentId}
                    saving={saving}
                    focusedSection={homeFocusedSection}
                    selectedDateKey={homeReservationDate}
                    slideDirection={homeReservationSlideDirection}
                    canMoveBackward={canMoveHomeReservationBackward}
                    canMoveForward={canMoveHomeReservationForward}
                    onMoveBackward={() => moveHomeReservationDate("prev")}
                    onMoveForward={() => moveHomeReservationDate("next")}
                    onOpenAppointment={(appointment) => setModal({ type: "appointment", appointment })}
                    onPendingUpdate={(appointmentId, payload) => updateAppointment(appointmentId, payload)}
                    onStatusChange={requestMobileAppointmentStatusChange}
                    onStartWithoutPhoto={startMobileAppointmentWithoutPhoto}
                    onStartWithPhoto={startMobileAppointmentWithPhoto}
                  />
                </div>
              </div>
            </div>
          </section>
        )}
{activeTab === "book" && (
  <section className="space-y-3.5 p-4">
    <Panel
      title="날짜선택"
      titleAccessory={
        <InfoTip ariaLabel="날짜선택 안내" popoverClassName="w-[238px]">
          날짜를 선택하면 예약, 완료, 취소·변경 내역을 해당 날짜 기준으로 볼 수 있어요.
        </InfoTip>
      }
      titleTextClassName="text-[15px] font-medium leading-6 tracking-[-0.02em]"
      className="rounded-[12px] border-[#ece8e2] bg-white px-3 py-3 shadow-none"
      contentClassName="space-y-2"
      action={
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#ece8e2] bg-white text-[18px] text-[var(--text)] transition hover:bg-[#f7f4ef]"
          onClick={() => {
            setPendingVisitSelectionMode(visitSelectionMode);
            if (visitSelectionMode === "range" && selectedVisitRange) {
              setPendingVisitRangeStart(selectedVisitRange.start);
              setPendingVisitRangeEnd(selectedVisitRange.end);
              setPendingVisitDate(selectedVisitRange.start);
              setVisitCalendarMonthCursor(selectedVisitRange.start.slice(0, 7));
            } else {
              setPendingVisitDate(selectedVisitDate);
              setPendingVisitRangeStart(null);
              setPendingVisitRangeEnd(null);
              setVisitCalendarMonthCursor(selectedVisitDate.slice(0, 7));
            }
            setIsVisitCalendarOpen(true);
          }}
          aria-label={"달력 열기"}
        >
          <CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </button>
      }
    >
      <div className="space-y-3">
        <HorizontalDragScroll>
          {quickVisitDates.map((item) => {
            const active = !isSelectedVisitRange && selectedVisitDate === item;
            const label = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(new Date(item + "T00:00:00")).replace("요일", "");

            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setVisitSelectionMode("single");
                  setVisitRange(null);
                  setVisitDateFilter(item);
                }}
                className={`min-w-[66px] shrink-0 rounded-[12px] border border-[#ece8e2] px-[10px] py-[10px] text-center transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(15,23,42,0.10)]"
                    : "bg-white text-[#23231f] hover:bg-[#fcfaf7]"
                }`}
              >
                <span className={`block text-[10px] font-medium leading-none tracking-[-0.01em] ${active ? "text-white/78" : "text-[#8f8a83]"}`}>{label}</span>
                <span className="mt-[6px] block text-[19px] font-medium leading-none tracking-[-0.03em]">{String(Number(item.slice(8, 10)))}</span>
              </button>
            );
          })}
        </HorizontalDragScroll>
        {(!isSelectedVisitInQuickRange || isSelectedVisitRange) && (
          <div className="rounded-[16px] border border-[var(--border)] bg-[#fcfaf7] px-4 py-3 text-[13px] leading-5 text-[var(--muted)]">
            {isSelectedVisitRange ? (
              <>
                현재 선택 기간: <span className="font-medium text-[var(--text)]">{selectedVisitDateHeader}</span>
              </>
            ) : (
              <>
                현재 선택 날짜: <span className="font-medium text-[var(--text)]">{selectedVisitDateHeader}</span>
              </>
            )}
          </div>
        )}
      </div>
    </Panel>

    {visitSectionOrder.map((sectionKey) => {
      if (sectionKey === "reservation") {
        return (
          <Panel
            key="reservation"
            title={ownerHomeCopy.visitActionTitle}
            titleTextClassName="text-[16px] font-medium leading-6 tracking-[-0.02em]"
            action={<span className="text-[12px] font-medium tracking-[-0.01em] text-[#8d867e]">{selectedVisitReservationAppointments.length + ownerHomeCopy.countSuffix}</span>}
            className="rounded-[12px] border-[#ece8e2] bg-white px-3 py-3 shadow-none"
            contentClassName="space-y-2"
          >
            {selectedVisitReservationAppointments.length === 0 ? (
              <EmptyState title={ownerHomeCopy.visitActionEmpty} compact className="min-h-[52px] rounded-[12px] px-[14px] py-[10px]" />
            ) : (
              <div className="space-y-2">
                {selectedVisitReservationAppointments.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    pet={petMap[appointment.pet_id]}
                    guardian={guardianMap[appointment.guardian_id]}
                    service={serviceMap[appointment.service_id]}
                    onClick={() => setModal({ type: "appointment", appointment })}
                  />
                ))}
              </div>
            )}
          </Panel>
        );
      }

      if (sectionKey === "completed") {
        return (
          <Panel
            key="completed"
            title={ownerHomeCopy.visitCompletedTitle}
            titleTextClassName="text-[16px] font-medium leading-6 tracking-[-0.02em]"
            action={<span className="text-[12px] font-medium tracking-[-0.01em] text-[#8d867e]">{selectedVisitCompletedAppointments.length + selectedVisitRecords.length + ownerHomeCopy.countSuffix}</span>}
            className="rounded-[12px] border-[#ece8e2] bg-white px-3 py-3 shadow-none"
            contentClassName="space-y-2"
          >
            {selectedVisitCompletedAppointments.length === 0 && selectedVisitRecords.length === 0 ? (
              <EmptyState title={ownerHomeCopy.visitCompletedEmpty} compact className="min-h-[52px] rounded-[12px] px-[14px] py-[10px]" />
            ) : (
              <div className="space-y-2">
                {selectedVisitCompletedAppointments.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    pet={petMap[appointment.pet_id]}
                    guardian={guardianMap[appointment.guardian_id]}
                    service={serviceMap[appointment.service_id]}
                    onClick={() => setModal({ type: "appointment", appointment })}
                  />
                ))}
                {selectedVisitRecords.map((record) => (
                  <VisitRecordRow
                    key={record.id}
                    record={record}
                    pet={petMap[record.pet_id]}
                    guardian={guardianMap[record.guardian_id]}
                    service={serviceMap[record.service_id]}
                  />
                ))}
              </div>
            )}
          </Panel>
        );
      }

      return (
        <Panel
          key="cancel_change"
          title={ownerHomeCopy.visitCancelChangeTitle}
          titleTextClassName="text-[16px] font-medium leading-6 tracking-[-0.02em]"
          action={<span className="text-[12px] font-medium tracking-[-0.01em] text-[#8d867e]">{selectedVisitCancelledAppointments.length + ownerHomeCopy.countSuffix}</span>}
          className="rounded-[12px] border-[#ece8e2] bg-white px-3 py-3 shadow-none"
          contentClassName="space-y-2"
        >
          {selectedVisitCancelledAppointments.length === 0 ? (
            <EmptyState title={ownerHomeCopy.visitCancelChangeEmpty} compact className="min-h-[52px] rounded-[12px] px-[14px] py-[10px]" />
          ) : (
            <div className="space-y-2">
              {selectedVisitCancelledAppointments.map((appointment) => (
                <AppointmentRow
                  key={appointment.id}
                  appointment={appointment}
                  pet={petMap[appointment.pet_id]}
                  guardian={guardianMap[appointment.guardian_id]}
                  service={serviceMap[appointment.service_id]}
                  onClick={() => setModal({ type: "appointment", appointment })}
                />
              ))}
            </div>
          )}
        </Panel>
      );
    })}
  </section>
)}

{activeTab === "book" && isVisitCalendarOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 px-5" onClick={() => setIsVisitCalendarOpen(false)}><div className="w-full max-w-[360px] rounded-[12px] border border-[var(--border)] bg-white p-4 shadow-[0_18px_40px_rgba(35,35,31,0.12)]" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-start justify-between gap-3"><p className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">{pendingVisitDateHeader}</p><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--text)]" onClick={() => setIsVisitCalendarOpen(false)}>{"✕"}</button></div><div className="mb-4 grid grid-cols-2 gap-1.5 rounded-[12px] bg-[#f7f4ef] p-0.5"><button type="button" className={`rounded-[10px] px-2.5 py-2 text-sm font-semibold transition ${pendingVisitSelectionMode === "single" ? "bg-white text-[var(--text)] shadow-[0_6px_14px_rgba(35,35,31,0.08)]" : "text-[var(--muted)]"}`} onClick={() => { setPendingVisitSelectionMode("single"); setPendingVisitRangeStart(null); setPendingVisitRangeEnd(null); }}>날짜 선택</button><button type="button" className={`rounded-[10px] px-2.5 py-2 text-sm font-semibold transition ${pendingVisitSelectionMode === "range" ? "bg-white text-[var(--text)] shadow-[0_6px_14px_rgba(35,35,31,0.08)]" : "text-[var(--muted)]"}`} onClick={() => { setPendingVisitSelectionMode("range"); setPendingVisitRangeStart(pendingVisitDate); setPendingVisitRangeEnd(null); }}>기간 선택</button></div><div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-[var(--text)]">{visitCalendarMonthLabel}</p><div className="flex items-center gap-2"><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-lg text-[var(--text)] transition hover:bg-[#f6f1ec]" onClick={() => { const base = new Date(visitCalendarMonthStart + "T00:00:00"); const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1); setVisitCalendarMonthCursor(String(prev.getFullYear()) + "-" + String(prev.getMonth() + 1).padStart(2, "0")); }} aria-label={"이전 달"}>{"‹"}</button><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-lg text-[var(--text)] transition hover:bg-[#f6f1ec]" onClick={() => { const base = new Date(visitCalendarMonthStart + "T00:00:00"); const next = new Date(base.getFullYear(), base.getMonth() + 1, 1); setVisitCalendarMonthCursor(String(next.getFullYear()) + "-" + String(next.getMonth() + 1).padStart(2, "0")); }} aria-label={"다음 달"}>{"›"}</button></div></div><div className="grid grid-cols-7 gap-y-3 text-center text-sm font-semibold"><span className="text-[var(--muted)]">{"일"}</span><span className="text-[var(--muted)]">{"월"}</span><span className="text-[var(--muted)]">{"화"}</span><span className="text-[var(--muted)]">{"수"}</span><span className="text-[var(--muted)]">{"목"}</span><span className="text-[var(--muted)]">{"금"}</span><span className="text-[var(--muted)]">{"토"}</span>{visitCalendarCells.map((item, index) => { if (!item) return <div key={`calendar-empty-${index}`} className="h-11" />; const isSingleActive = pendingVisitSelectionMode === "single" && pendingVisitDate === item; const isRangeStart = pendingVisitSelectionMode === "range" && pendingVisitRange?.start === item; const isRangeEnd = pendingVisitSelectionMode === "range" && pendingVisitRange?.end === item; const isRangeActive = Boolean(isRangeStart || isRangeEnd); const isInRange = pendingVisitSelectionMode === "range" && pendingVisitRange && pendingVisitRange.start < item && item < pendingVisitRange.end; const isToday = item === todayDate; return <button key={item} type="button" className="flex h-11 items-center justify-center" onClick={() => { if (pendingVisitSelectionMode === "single") { setPendingVisitDate(item); return; } if (!pendingVisitRangeStart || pendingVisitRangeEnd) { setPendingVisitRangeStart(item); setPendingVisitRangeEnd(null); setPendingVisitDate(item); return; } if (item < pendingVisitRangeStart) { setPendingVisitRangeStart(item); setPendingVisitRangeEnd(null); setPendingVisitDate(item); return; } setPendingVisitRangeEnd(item); setPendingVisitDate(item); }}><span className={`flex h-10 w-10 items-center justify-center rounded-full text-[16px] font-semibold transition ${isSingleActive || isRangeActive ? "bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]" : isInRange ? "bg-[var(--accent-soft)] text-[var(--text)]" : isToday ? "border border-[var(--border)] bg-[#faf7f4] text-[var(--text)]" : "bg-transparent text-[var(--text)] hover:bg-[#f6f1ec]"}`}>{String(Number(item.slice(8, 10)))}</span></button>; })}</div><div className="mt-5 grid grid-cols-2 gap-2"><ActionButton variant="ghost" onClick={() => { if (visitSelectionMode === "range" && selectedVisitRange) { setPendingVisitSelectionMode("range"); setPendingVisitRangeStart(selectedVisitRange.start); setPendingVisitRangeEnd(selectedVisitRange.end); setPendingVisitDate(selectedVisitRange.start); } else { setPendingVisitSelectionMode("single"); setPendingVisitDate(selectedVisitDate); setPendingVisitRangeStart(null); setPendingVisitRangeEnd(null); } setIsVisitCalendarOpen(false); }}>닫기</ActionButton><ActionButton onClick={() => { if (pendingVisitSelectionMode === "range" && pendingVisitRange) { setVisitSelectionMode("range"); setVisitRange(pendingVisitRange); setVisitDateFilter(pendingVisitRange.start); } else { setVisitSelectionMode("single"); setVisitRange(null); setVisitDateFilter(pendingVisitDate); } setIsVisitCalendarOpen(false); }} disabled={!canConfirmVisitCalendar}>확인</ActionButton></div></div></div>}

        {activeTab === "customers" && !selectedGuardian && (
          <section className={`space-y-4 p-4 ${isCustomerListEditing && filteredGuardians.length > 0 ? "pb-[160px]" : "pb-4"}`}>
            {isCustomerListEditing ? (
              <CustomerDeleteSelectionPanel
                customerSearch={customerSearch}
                onCustomerSearchChange={setCustomerSearch}
                filteredDeletedGuardians={filteredDeletedGuardians}
                isDeletedCustomersOpen={isDeletedCustomersOpen}
                onToggleDeletedCustomersOpen={() => setIsDeletedCustomersOpen((prev) => !prev)}
                filteredGuardians={filteredGuardians}
                selectedGuardianIds={selectedGuardianIds}
                selectedGuardianCount={selectedGuardianCount}
                allFilteredGuardiansSelected={allFilteredGuardiansSelected}
                onToggleAllVisibleGuardians={toggleAllVisibleGuardians}
                onToggleGuardianSelection={toggleGuardianSelection}
                onClose={() => {
                  setIsCustomerListEditing((prev) => {
                    if (prev) setSelectedGuardianIds([]);
                    return !prev;
                  });
                }}
                onRestoreDeletedGuardians={restoreDeletedGuardians}
                saving={saving}
                emptyTitle={customerEmptyTitle}
                emptyDescription={customerEmptyDescription}
              />
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-white px-4 py-3">
                    <input
                      value={customerSearch}
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      placeholder="보호자명, 연락처, 반려동물 이름 검색"
                      className="relative -top-[1.5px] min-w-0 flex-1 bg-transparent text-[14px] font-normal leading-6 outline-none placeholder:text-[14px] placeholder:font-normal placeholder:text-[var(--muted)]"
                    />
                  </div>

                  <button
                    type="button"
                    className="inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[#fcfaf7] text-[var(--muted)] transition hover:border-[#d9d4cb] hover:text-[var(--text)]"
                    onClick={() => {
                      setIsCustomerListEditing((prev) => {
                        if (prev) setSelectedGuardianIds([]);
                        return !prev;
                      });
                    }}
                    aria-label="고객 삭제 선택 모드 열기"
                  >
                    <Trash2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
                  </button>
                </div>

                {filteredGuardians.length === 0 ? (
                  <CustomerEmptyState
                    title={customerEmptyTitle}
                    description={customerEmptyDescription}
                    action={
                      null
                    }
                  />
                ) : (
                  <div className="space-y-1.5">
                    {filteredGuardians.map((summary) => (
                      <div
                        key={summary.guardian.id}
                        className="rounded-[10px] border border-[var(--border)] bg-white px-3 py-1 transition hover:bg-[#fcfaf7]"
                      >
                        <button
                          type="button"
                          className="group w-full text-left"
                          onClick={() => {
                            setSelectedGuardianId(summary.guardian.id);
                            setSelectedCustomerPetId(summary.latestPet?.id ?? summary.pets[0]?.id ?? null);
                            setDetailTab("records");
                          }}
                          aria-label={`${summary.guardian.name} 상세 보기`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[18px] font-medium tracking-[-0.02em] text-[var(--text)]">{summary.guardian.name}</p>
                            </div>
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ebe3da] bg-[#fcfaf7] text-[var(--muted)] transition group-hover:text-[var(--accent)]">
                              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                            </span>
                          </div>
                          <div className="mt-0.5 border-t border-[#eee7de] pt-0.5">
                            <p className="text-[16px] font-normal leading-[20px] text-[var(--muted)]">{summary.guardian.phone}</p>
                            <p className="mt-0.5 truncate text-[16px] font-normal leading-[20px] text-[#5e5a56]">
                              {summary.pets.map((pet) => pet.name).join(", ") || "등록된 반려동물 없음"}
                            </p>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}
        {activeTab === "customers" && !selectedGuardian && isCustomerListEditing && filteredGuardians.length > 0 ? (
          <div className="fixed bottom-[74px] left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-[var(--border)] bg-[rgba(248,246,242,0.96)] px-4 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-3 backdrop-blur">
            <ActionButton disabled={selectedGuardianCount === 0 || saving} onClick={deleteSelectedGuardians}>
              선택한 고객 삭제
            </ActionButton>
          </div>
        ) : null}
        {activeTab === "customers" && selectedGuardian && (
          <section className="space-y-4 p-4">
            <div className="relative flex min-h-8 items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setSelectedGuardianId(null);
                  setSelectedCustomerPetId(null);
                  setIsCustomerToolsOpen(false);
                }}
                className="absolute left-0 inline-flex h-8 w-8 items-center justify-center text-[var(--text)]"
                aria-label="고객 관리로 돌아가기"
              >
                <ChevronRight className="h-5 w-5 rotate-180" strokeWidth={2} />
              </button>
              <h2 className="text-[18px] font-medium tracking-[-0.03em] text-[var(--text)]">고객 상세</h2>
            </div>

            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-2">
              <div className="space-y-3">
                <CustomerDetailFieldCard label="기본 정보" className="relative top-[2px] overflow-hidden rounded-[10px] px-0 pb-0 pt-1.5">
                  <div className="divide-y divide-[var(--border)]">
                    {editingCustomerFields.name ? (
                      <div className="px-3 py-1.5">
                        <div className="relative">
                        <input
                          className={customerInlineInputClass}
                          value={guardianDraft.name}
                          onChange={(event) => setGuardianDraft((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="보호자 이름"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={saving || !guardianDraft.name.trim()}
                          className={`${customerInlineSaveButtonClass} absolute right-1 top-1 bottom-1 min-w-[64px] px-3.5`}
                          onClick={() => void handleCustomerInlineSave()}
                        >
                          저장
                        </button>
                        </div>
                      </div>
                    ) : (
                      <CustomerDetailInfoRow
                        label="보호자 이름"
                        value={`${selectedGuardian.name} 보호자`}
                        onClick={() => openCustomerFieldEditor("name")}
                      />
                    )}
                    {editingCustomerFields.phone ? (
                      <div className="px-3 py-1.5">
                        <div className="relative">
                        <input
                          className={customerInlineInputClass}
                          value={guardianDraft.phone}
                          onChange={(event) => setGuardianDraft((prev) => ({ ...prev, phone: event.target.value }))}
                          placeholder="연락처"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={saving || !guardianDraft.phone.trim()}
                          className={`${customerInlineSaveButtonClass} absolute right-1 top-1 bottom-1 min-w-[64px] px-3.5`}
                          onClick={() => void handleCustomerInlineSave()}
                        >
                          저장
                        </button>
                        </div>
                      </div>
                    ) : (
                      <CustomerDetailInfoRow
                        label="연락처"
                        value={formatShopPhoneNumber(selectedGuardian.phone)}
                        onClick={() => openCustomerFieldEditor("phone")}
                      />
                    )}
                    {editingCustomerFields.pet ? (
                      <div className="px-3 py-1.5">
                        <div className="relative">
                        <input
                          className={customerInlineInputClass}
                          value={petDraftName}
                          onChange={(event) => setPetDraftName(event.target.value)}
                          placeholder="반려동물 이름"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={saving || !petDraftName.trim()}
                          className={`${customerInlineSaveButtonClass} absolute right-1 top-1 bottom-1 min-w-[64px] px-3.5`}
                          onClick={() => void handleCustomerInlineSave()}
                        >
                          저장
                        </button>
                        </div>
                      </div>
                    ) : (
                      <CustomerDetailInfoRow
                        label="반려동물"
                        value={selectedGuardianPetNames || "등록된 반려동물 없음"}
                        onClick={() => openCustomerFieldEditor("pet")}
                      />
                    )}
                    {editingCustomerFields.memo ? (
                      <div className="px-3 py-1.5">
                        <div className="relative">
                          <textarea
                            ref={guardianMemoTextareaRef}
                            className="field-textarea !min-h-[92px] !resize-none overflow-hidden px-3 py-2 !pb-12 leading-5"
                            value={guardianDraft.memo}
                            onChange={(event) => setGuardianDraft((prev) => ({ ...prev, memo: event.target.value }))}
                            onInput={resizeGuardianMemoTextarea}
                            placeholder="고객에게 기억해 둘 내용을 적어주세요"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={saving}
                            className="absolute bottom-3 right-3 inline-flex h-8 min-w-[52px] items-center justify-center rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-3 text-[12px] font-medium tracking-[-0.01em] text-white transition disabled:opacity-45"
                            onClick={() => void handleCustomerInlineSave()}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <CustomerDetailInfoRow
                        label="고객 메모"
                        value={selectedGuardian.memo || "메모를 추가해 주세요"}
                        onClick={() => openCustomerFieldEditor("memo")}
                        muted={!selectedGuardian.memo}
                        multiline
                      />
                    )}
                  </div>
                </CustomerDetailFieldCard>

                <CustomerDetailFieldCard label="개인 알림톡" className="overflow-hidden rounded-[10px] px-0 pb-0 pt-0">
                  <div className="border-b border-[var(--border)] bg-[#fffdfa]">
                    <CustomerDetailToggleRow
                      label="알림톡 전체 수신"
                      description="이 고객에게 가는 예약·미용 알림을 한 번에 켜거나 끌 수 있어요."
                      checked={guardianNotificationsEnabled}
                      disabled={saving}
                      onChange={(checked) => {
                        void updateGuardianNotifications(selectedGuardian.id, { enabled: checked });
                      }}
                    />
                  </div>
                  <div className="space-y-4 px-4 pb-4 pt-3.5">
                    {customerNotificationGroups.map((group) => (
                      <div key={group.title} className="space-y-2">
                        <p className="px-0.5 text-[13px] font-medium leading-5 tracking-[-0.01em] text-[#8f877d]">{group.title}</p>
                        <div className="space-y-2.5">
                          {group.items.map((item) => (
                            <CustomerDetailNotificationItemRow
                              key={item.label}
                              label={item.label}
                              description={item.description}
                              active={guardianNotificationsEnabled && selectedGuardian.notification_settings[item.settingKey]}
                              disabled={saving || !guardianNotificationsEnabled}
                              onChange={(checked) => {
                                void updateGuardianNotifications(selectedGuardian.id, { [item.settingKey]: checked });
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CustomerDetailFieldCard>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-1 rounded-[10px] border border-[var(--border)] bg-[#f8f5f0] p-1">
                    {(["records", "pets", "notifications"] as const).map((item) => (
                      <button
                        key={item}
                        className={`flex h-[36px] items-center justify-center rounded-[8px] px-2 py-1 text-center text-[14px] font-medium leading-[1.2] transition ${
                          detailTab === item
                            ? "bg-white text-[var(--text)] shadow-[0_2px_6px_rgba(35,35,31,0.05)]"
                            : "text-[var(--muted)]"
                        }`}
                        onClick={() => setDetailTab(item)}
                      >
                        {item === "records" ? "미용 기록" : item === "pets" ? "반려동물" : "알림 내역"}
                      </button>
                    ))}
                  </div>

                  {detailTab === "records" ? (
                    <div className="space-y-2.5">
                      {selectedRecords.length === 0 ? (
                        <AppEmptyState title="미용 기록이 없어요" description="첫 방문이 완료되면 이 고객의 미용 기록이 시간순으로 쌓입니다." />
                      ) : (
                        <>
                          <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white divide-y divide-[var(--border)]">
                            {pagedSelectedRecords.map((record) => (
                              <RecordCard
                                key={record.id}
                                record={record}
                                pet={petMap[record.pet_id]}
                                service={serviceMap[record.service_id]}
                                onEdit={() => setModal({ type: "edit-record", record })}
                              />
                            ))}
                          </div>
                          <CustomerDetailHistoryPagination page={recordPage} totalPages={totalRecordPages} onChange={setRecordPage} />
                        </>
                      )}
                    </div>
                  ) : null}

                  {detailTab === "pets" ? (
                    <div className="space-y-2.5">
                      {selectedGuardianPets.map((pet) => (
                        <GuardianPetEditorCard
                          key={pet.id}
                          pet={pet}
                          saving={saving}
                          isBirthdayToday={Boolean(pet.birthday && pet.birthday.slice(5) === "03-17")}
                          isSelected={selectedCustomerPet?.id === pet.id}
                          onSelect={() => setSelectedCustomerPetId(pet.id)}
                          onSave={(name, breed, birthday) => updatePetProfile(pet.id, name, breed, birthday)}
                          onSendBirthday={() => sendBirthdayGreeting(pet)}
                          onSendRevisit={() => sendRevisitNotice(pet)}
                        />
                      ))}
                      <button
                        type="button"
                        className="mt-1 flex h-[42px] w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#cfded8] bg-white px-4 text-[16px] font-medium tracking-[-0.02em] text-[var(--accent)] transition hover:bg-[#fcfaf7]"
                        onClick={() => setModal({ type: "add-pet", guardianId: selectedGuardian.id })}
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.1} />
                        아기 추가하기
                      </button>
                    </div>
                  ) : null}

                  {detailTab === "notifications" ? (
                    <div className="space-y-2.5">
                      {selectedNotifications.length === 0 ? (
                        <AppEmptyState title="발송된 알림톡이 없어요" description="예약 안내나 재방문 알림을 보내면 여기에서 이력을 확인할 수 있어요." />
                      ) : (
                        <>
                          <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white divide-y divide-[var(--border)]">
                            {pagedSelectedNotifications.map((notification) => (
                              <NotificationHistoryRow
                                key={notification.id}
                                notification={notification}
                                pet={notification.pet_id ? petMap[notification.pet_id] ?? null : null}
                              />
                            ))}
                          </div>
                          <CustomerDetailHistoryPagination
                            page={notificationPage}
                            totalPages={totalNotificationPages}
                            onChange={setNotificationPage}
                          />
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "settings" && <SettingsPanel data={data} initialScreen={settingsEntryScreen} onActiveScreenChange={setSettingsEntryScreen} onSave={(payload) => mutate("/api/settings", { method: "PATCH", body: JSON.stringify(payload) }, { rethrow: true })} onSaveService={(payload) => mutate("/api/services", { method: "POST", body: JSON.stringify(payload) })} onSaveCustomerPageSettings={(payload) => mutate("/api/customer-page-settings", { method: "PATCH", body: JSON.stringify(payload) }, { rethrow: true })} onLogout={onLogout} loggingOut={loggingOut} userEmail={userEmail} subscriptionSummary={subscriptionSummary} />}
      </main>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-[var(--border)] bg-white/95 px-2.5 pb-[calc(env(safe-area-inset-bottom)+2px)] pt-1 backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-1">
            {tabItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              const shouldFill = active && (item.key === "home" || item.key === "customers");
              const isActiveHome = active && item.key === "home";

              return (
                <button
                  key={item.key}
                  type="button"
                  aria-label={item.label}
                  className={`group relative flex min-h-[42px] flex-col items-center justify-center rounded-[12px] px-1 py-0.5 text-center transition ${
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-[#f8fafc]"
                  }`}
                  onClick={() => {
                    setActiveTab(item.key);
                    if (item.key === "book") {
                      setVisitSelectionMode("single");
                      setVisitRange(null);
                      setVisitDateFilter(todayDate);
                    }
                    if (item.key !== "settings") setSettingsEntryScreen(null);
                    if (item.key !== "customers") {
                      setSelectedGuardianId(null);
                      setSelectedCustomerPetId(null);
                      setIsCustomerToolsOpen(false);
                    }
                  }}
                >
                  <div
                    className={`relative flex items-center justify-center rounded-full transition ${
                      active
                        ? "h-7 w-7 text-[var(--accent)]"
                        : "h-7 w-7 text-[var(--muted)]"
                    }`}
                  >
                    <Icon
                      className="h-[22px] w-[22px]"
                      strokeWidth={1.9}
                      style={shouldFill ? { fill: "currentColor" } : undefined}
                    />
                    {isActiveHome ? <span className="pointer-events-none absolute bottom-[2px] h-[12px] w-[6px] rounded-t-[2px] bg-[var(--accent-soft)]" /> : null}
                  </div>
                  <span
                    className={`relative mt-0.5 text-[11px] font-semibold leading-4 tracking-[-0.01em] ${
                      active ? "text-[var(--accent)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
        </div>
      </nav>

      {modal && <div>{modal.type === "appointment" ? <Overlay><AppointmentDetail data={data} appointment={modal.appointment} pet={petMap[modal.appointment.pet_id]} guardian={guardianMap[modal.appointment.guardian_id]} service={serviceMap[modal.appointment.service_id]} saving={saving} onClose={() => setModal(null)} onUpdate={(payload) => updateAppointmentWithMobilePhotoGuard(modal.appointment.id, payload)} onSendReminder={() => sendAppointmentReminder(modal.appointment, petMap[modal.appointment.pet_id], guardianMap[modal.appointment.guardian_id], serviceMap[modal.appointment.service_id])} /></Overlay> : null}{modal.type === "edit-shop-profile" ? <Overlay><ShopProfileEditForm data={data} saving={saving} onClose={() => setModal(null)} onSave={saveShopProfile} /></Overlay> : null}{modal.type === "new-appointment" ? <Overlay><NewAppointmentForm data={data} petId={modal.petId} saving={saving} onClose={() => setModal(null)} onSave={(payload) => mutate("/api/appointments", { method: "POST", body: JSON.stringify(payload) })} /></Overlay> : null}{modal.type === "new-customer" ? <Overlay><NewCustomerForm shopId={data.shop.id} saving={saving} onClose={() => setModal(null)} onSave={async (guardianPayload, petPayloads) => { await mutate("/api/guardians", { method: "POST", body: JSON.stringify(guardianPayload) }); const refreshed = await fetchJson<BootstrapPayload>(`/api/bootstrap?shopId=${data.shop.id}`); setData(refreshed); const guardian = refreshed.guardians[refreshed.guardians.length - 1]; for (const petPayload of petPayloads) { await mutate("/api/pets", { method: "POST", body: JSON.stringify({ ...petPayload, guardianId: guardian.id }) }); } }} /></Overlay> : null}{modal.type === "add-pet" ? <Overlay><AddPetForm shopId={data.shop.id} guardianId={modal.guardianId} saving={saving} onClose={() => setModal(null)} onSave={(payload) => mutate("/api/pets", { method: "POST", body: JSON.stringify(payload) })} /></Overlay> : null}{modal.type === "edit-record" ? <Overlay><EditRecordForm shopId={data.shop.id} services={data.services} record={modal.record} saving={saving} onClose={() => setModal(null)} onSave={(payload) => mutate("/api/records", { method: "PATCH", body: JSON.stringify(payload) })} /></Overlay> : null}{modal.type === "stat" ? <Overlay><StatDetail kind={modal.kind} todayAppointments={filteredHomeConfirmedAppointmentsForStat} pendingAppointments={filteredHomePendingAppointments} overdueRows={revisitRows.filter((item) => item.status === "overdue")} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} saving={saving} onUpdate={updateAppointmentWithMobilePhotoGuard} onOpenAppointment={(appointment) => setModal({ type: "appointment", appointment })} onClose={() => setModal(null)} /></Overlay> : null}</div>}
      {mobilePhotoStatusAction ? (
        <MobilePhotoStatusSheet
          action={mobilePhotoStatusAction}
          uploading={mobilePhotoUploading || saving}
          onClose={() => {
            if (!mobilePhotoUploading) setMobilePhotoStatusAction(null);
          }}
          onSkip={() => {
            const action = mobilePhotoStatusAction;
            if (!action) return;
            setMobilePhotoStatusAction(null);
            void updateAppointment(action.appointmentId, { status: action.nextStatus });
          }}
          onSubmit={handleMobilePhotoStatusFile}
        />
      ) : null}
      {isShopPickerOpen ? (
        <Overlay>
          <ShopPickerSheet
            shops={ownedShopItems}
            currentShopId={currentOwnedShop.id}
            switching={saving}
            onClose={() => setIsShopPickerOpen(false)}
            onSelect={async (shopId) => {
              if (!onSwitchShop || shopId === currentOwnedShop.id) {
                setIsShopPickerOpen(false);
                return;
              }
              await onSwitchShop(shopId);
              setIsShopPickerOpen(false);
            }}
            onEdit={async (shopId) => {
              if (!onSwitchShop || shopId === currentOwnedShop.id) {
                setIsShopPickerOpen(false);
                setModal({ type: "edit-shop-profile" });
                return;
              }
              setPendingShopProfileEditId(shopId);
              setIsShopPickerOpen(false);
              await onSwitchShop(shopId);
            }}
          />
        </Overlay>
      ) : null}
      {guideScreen === "getting-started" ? <Overlay><BookingGuideSheet bookingEntryUrl={bookingEntryUrl} onClose={() => setGuideScreen(null)} /></Overlay> : null}
    </div>
  );
}

function badgeToneForAppointmentStatus(status: AppointmentStatus): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "pending":
      return "warning";
    case "confirmed":
    case "in_progress":
      return "success";
    case "almost_done":
      return "info";
    case "cancelled":
    case "rejected":
    case "noshow":
      return "danger";
    case "completed":
    default:
      return "neutral";
  }
}

function appointmentInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed[0] : "?";
}

function AppointmentMonogram({ name }: { name: string }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f4f2ef] text-[12px] font-normal leading-none text-[#666058]">
      {appointmentInitial(name)}
    </div>
  );
}

function AppointmentListTrailing({ status }: { status: AppointmentStatus | "record-completed" }) {
  if (status === "record-completed" || status === "completed") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2.5 text-[11px] font-normal leading-none text-[var(--text)]">
        <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
        완료
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#f4f2ef] px-2.5 text-[11px] font-normal leading-none text-[#7b756e]">
        취소
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#f7f0e8] px-2.5 text-[11px] font-normal leading-none text-[#8b6b5d]">
        대기
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#f3f5f7] px-2.5 text-[11px] font-normal leading-none text-[var(--text)]">
        진행
      </span>
    );
  }

  if (status === "almost_done") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#f4f2ef] px-2.5 text-[11px] font-normal leading-none text-[#6a665f]">
        픽업
      </span>
    );
  }

  return <ChevronRight className="h-4 w-4 shrink-0 text-[#b8b2aa]" strokeWidth={2} />;
}

function VisitTimelineSection({ date, appointments, records, petMap, guardianMap, serviceMap, onOpenAppointment }: { date: string; appointments: Appointment[]; records: GroomingRecord[]; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; onOpenAppointment: (appointment: Appointment) => void }) { return <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{shortDate(date)}</h3><span className="text-xs text-[var(--muted)]">{appointments.length + records.length}건</span></div><div className="mt-3 space-y-2">{appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => onOpenAppointment(appointment)} />)}{records.map((record) => <VisitRecordRow key={record.id} record={record} pet={petMap[record.pet_id]} guardian={guardianMap[record.guardian_id]} service={serviceMap[record.service_id]} />)}{appointments.length === 0 && records.length === 0 ? <AppEmptyState title="이 날짜 방문 내역이 없어요" /> : null}</div></div>; }
function VisitRecordRow({ record, pet, guardian, service }: { record: GroomingRecord; pet: Pet; guardian: Guardian; service?: Service }) {
  return (
    <div className="flex min-h-[52px] w-full items-center gap-3 rounded-[12px] border border-[#e1e7ef] bg-white px-[14px] py-[10px]">
      <div className="min-w-[42px] text-[15px] font-normal leading-none tracking-[-0.01em] text-[#0f172a]">{record.groomed_at.slice(11, 16)}</div>
      <div className="h-6 w-px shrink-0 bg-[#e1e7ef]" />
      <AppointmentMonogram name={pet.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[16px] font-normal leading-[20px] tracking-[-0.02em] text-[#0f172a]">{pet.name}</p>
          <span className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">{guardian.name}</span>
        </div>
        <p className="truncate text-[13px] font-normal leading-[17px] text-[#64748b]">{service?.name || "서비스"}</p>
      </div>
      <AppointmentListTrailing status="record-completed" />
    </div>
  );
}

function MobileStatusSummary({ items, activeKey }: { items: Array<{ key: HomeReservationSectionKey; label: string; value: number; tone: "accent" | "warning" | "danger" | "neutral"; onClick: () => void }>; activeKey: HomeReservationSectionKey }) {
  const toneMap = {
    accent: {
      dot: "bg-[var(--accent)]",
      text: "text-[var(--accent)]",
    },
    warning: {
      dot: "bg-[#c79a37]",
      text: "text-[#4f5d73]",
    },
    danger: {
      dot: "bg-[#b56a78]",
      text: "text-[#4f5d73]",
    },
    neutral: {
      dot: "bg-[#8c98aa]",
      text: "text-[#4f5d73]",
    },
  } as const;
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-white p-4 text-[var(--text)] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
        <button
          key={item.key}
          type="button"
          aria-pressed={active}
          onClick={item.onClick}
          className={`min-w-0 rounded-[12px] border px-3 py-3 text-left transition ${
            active
              ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(47,107,212,0.12)]"
              : "border-[var(--border)] bg-white text-[var(--text)] hover:bg-[#f3f6fb]"
          }`}
        >
          <span className={`flex items-center justify-between gap-2 text-[16px] font-normal leading-[22px] tracking-[-0.02em] ${active ? "text-white" : toneMap[item.tone].text}`}>
            <span className="flex min-w-0 items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${toneMap[item.tone].dot}`} />
            <span className="truncate">{item.label}</span>
            </span>
            <span className={active ? "text-white" : "text-[#8c98aa]"}>{item.value}</span>
          </span>
        </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileStaffFilterStrip({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: HomeStaffFilterKey; label: string; count: number }>;
  value: HomeStaffFilterKey;
  onChange: (value: HomeStaffFilterKey) => void;
}) {
  if (options.length <= 1) return null;

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="home-staff-filter">담당자 선택</label>
      <select
        id="home-staff-filter"
        value={value}
        onChange={(event) => onChange(event.target.value as HomeStaffFilterKey)}
        className="h-11 w-full appearance-none rounded-[14px] border border-[var(--border)] bg-white px-3 pr-8 text-[13px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgba(47,107,212,0.12)]"
        aria-label="담당자 선택"
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.key === "all" ? option.label : `${option.label} ${option.count}건`}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center text-[var(--muted)]">
        <ChevronDown className="h-4 w-4" strokeWidth={2} />
      </div>
    </div>
  );
}

function AppointmentRow({ appointment, pet, guardian, service, onClick }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 rounded-[12px] border border-[#e1e7ef] bg-white px-[14px] py-[10px] text-left transition hover:bg-[#f8fafc]">
      <div className="min-w-[42px] text-[15px] font-normal leading-none tracking-[-0.01em] text-[#0f172a]">{formatClockTime(appointment.appointment_time)}</div>
      <div className="h-6 w-px shrink-0 bg-[#e1e7ef]" />
      <AppointmentMonogram name={pet.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[16px] font-normal leading-[20px] tracking-[-0.02em] text-[#0f172a]">{pet.name}</p>
          <span className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">{guardian.name}</span>
        </div>
        <p className="truncate text-[13px] font-normal leading-[17px] text-[#64748b]">{service.name}</p>
      </div>
      <AppointmentListTrailing status={appointment.status} />
    </button>
  );
}

function AppointmentDetailInfoRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[66px_minmax(0,1fr)] items-start gap-2">
      <span className="text-[13px] font-medium leading-5 tracking-[-0.01em] text-[#a59f96]">{label}</span>
      <p className={`text-[14px] leading-5 tracking-[-0.02em] ${muted ? "text-[#aaa49c]" : "text-[var(--text)]"}`}>{value}</p>
    </div>
  );
}

function AppointmentDetailMediaHistory({ shopId, appointment }: { shopId: string; appointment: Appointment }) {
  const [items, setItems] = useState<AppointmentMediaPreview[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAppointmentMedia() {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          shopId,
          appointmentId: appointment.id,
          includeVariants: "true",
          limit: "8",
        });
        const list = await fetchJson<{ items: MediaAssetListItem[] }>(`/api/owner/media/assets?${query.toString()}`);
        const previews = await Promise.all(
          list.items
            .filter((item) => item.mediaAsset.media_kind === "grooming_after")
            .map(async (item) => {
              const signedQuery = new URLSearchParams({
                shopId,
                mediaAssetId: item.mediaAsset.id,
                variant: "provider_ready",
              });
              const signed = await fetchJson<SignedMediaUrlResponse>(`/api/owner/media/signed-url?${signedQuery.toString()}`);
              return { item, signedUrl: signed.signedUrl };
            }),
        );
        if (!cancelled) setItems(previews);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAppointmentMedia();
    return () => {
      cancelled = true;
    };
  }, [appointment.id, shopId]);

  return (
    <div className="rounded-[18px] border border-[#e8e0d2] bg-white px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium text-[var(--text)]">사진 기록</p>
        <span className="text-[12px] text-[var(--muted)]">{loading ? "확인 중" : `${items.length}장`}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 rounded-[12px] border border-dashed border-[var(--border)] px-3.5 py-3 text-[13px] leading-5 text-[var(--muted)]">
          {loading ? "사진 기록을 불러오고 있어요." : "이 예약에 연결된 시작/완료 사진이 아직 없어요."}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {items.map(({ item, signedUrl }) => (
            <a
              key={item.mediaAsset.id}
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-[12px] border border-[var(--border)] bg-[#fbfaf7]"
            >
              <div className="aspect-[4/3] overflow-hidden bg-[#f1eee8]">
                <img
                  src={signedUrl}
                  alt={getAppointmentMediaKindLabel(item.mediaAsset.media_kind)}
                  className="h-full w-full object-cover transition group-active:scale-[0.99]"
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="truncate text-[12px] font-medium text-[var(--text)]">{getAppointmentMediaKindLabel(item.mediaAsset.media_kind)}</span>
                <span className="shrink-0 text-[11px] text-[var(--muted)]">{item.mediaAsset.status === "ready" ? "저장됨" : "처리 중"}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AppointmentDetail({ data, appointment, pet, guardian, service, saving, onClose, onUpdate, onSendReminder }: { data: BootstrapPayload; appointment: Appointment; pet: Pet; guardian: Guardian; service: Service; saving: boolean; onClose: () => void; onUpdate: (payload: AppointmentUpdatePayload) => void; onSendReminder: () => Promise<void> }) {
  const [template, setTemplate] = useState<(typeof rejectionReasonTemplates)[number]>(rejectionReasonTemplates[0]);
  const [customReason, setCustomReason] = useState("");
  const [reminderSent, setReminderSent] = useState(false);
  const canEditSchedule = ["pending", "confirmed", "cancelled"].includes(appointment.status);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [serviceId, setServiceId] = useState(appointment.service_id);
  const [date, setDate] = useState(appointment.appointment_date);
  const [time, setTime] = useState(appointment.appointment_time);
  const [memo, setMemo] = useState(appointment.memo);
  const selectableServices = useMemo(
    () => data.services.filter((item) => item.is_active || item.id === appointment.service_id),
    [appointment.service_id, data.services],
  );
  const selectedService = selectableServices.find((item) => item.id === serviceId) ?? service;
  const dateOptions = useMemo(() => {
    const base = Array.from({ length: 14 }, (_, index) => addDate(currentDateInTimeZone(), index));
    return base.includes(appointment.appointment_date)
      ? base
      : [appointment.appointment_date, ...base].sort((a, b) => a.localeCompare(b));
  }, [appointment.appointment_date]);
  const slots = computeAvailableSlots({
    date,
    serviceId,
    shop: data.shop,
    services: data.services,
    appointments: data.appointments,
    excludeAppointmentId: appointment.id,
  });
  const hasEditChanges =
    serviceId !== appointment.service_id ||
    date !== appointment.appointment_date ||
    time !== appointment.appointment_time ||
    memo !== appointment.memo;
  const canSaveSchedule = Boolean(serviceId && time && hasEditChanges && !saving);
  const canSendReminder =
    ["pending", "confirmed"].includes(appointment.status) &&
    guardian.notification_settings.enabled &&
    guardian.notification_settings.appointment_reminder_10m_enabled;
  const canCancelAppointment = ["pending", "confirmed", "in_progress", "almost_done"].includes(appointment.status);
  const appointmentNotifications = useMemo(
    () =>
      data.notifications
        .filter((notification) => notification.appointment_id === appointment.id)
        .sort((first, second) => (second.sent_at ?? second.created_at).localeCompare(first.sent_at ?? first.created_at))
        .slice(0, 4),
    [appointment.id, data.notifications],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (slots.length === 0) {
        setTime("");
        return;
      }

      if (!slots.includes(time)) {
        setTime(slots[0]);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [slots, time]);

  return (
    <Sheet
      title={ownerHomeCopy.appointmentDetailTitle}
      onClose={onClose}
      footer={
        canEditSchedule && isEditingSchedule ? (
          <ActionButton
            disabled={!canSaveSchedule}
            onClick={() => onUpdate({ mode: "edit", serviceId, appointmentDate: date, appointmentTime: time, memo })}
          >
            예약 수정 저장
          </ActionButton>
        ) : undefined
      }
    >
      <div className="space-y-3.5">
        <div className="rounded-[18px] border border-[#e8e0d2] bg-white px-4 py-3.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[18px] font-medium leading-6 tracking-[-0.02em] text-[var(--text)]">
              {pet.name} {ownerHomeCopy.separator} {guardian.name}
            </p>
            {canEditSchedule && !isEditingSchedule ? (
              <button
                type="button"
                className="shrink-0 text-[13px] font-medium leading-5 tracking-[-0.01em] text-[var(--accent)]"
                onClick={() => setIsEditingSchedule((prev) => !prev)}
              >
                예약 일정 수정
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2.5">
            <AppointmentDetailInfoRow
              label="예약 일시"
              value={`${appointment.appointment_date} ${formatClockTime(appointment.appointment_time)}`}
            />
            <AppointmentDetailInfoRow
              label="서비스"
            value={`${selectedService.name} ${ownerHomeCopy.separator} ${won(selectedService.price)}`}
            />
            <AppointmentDetailInfoRow
              label="담당"
              value={appointment.staff_id ? data.staffMembers.find((staffMember) => staffMember.id === appointment.staff_id)?.name ?? "담당 미확인" : "미배정"}
              muted={!appointment.staff_id}
            />
            <AppointmentDetailInfoRow
              label={ownerHomeCopy.memoLabel}
              value={appointment.memo || ownerHomeCopy.emptyMemo}
              muted={!appointment.memo}
            />
          </div>
          {appointment.rejection_reason && (
            <p className="mt-3 rounded-[14px] bg-[#fff6f4] px-3 py-2 text-[13px] font-medium leading-5 text-[#b25d52]">
              미승인 사유: {appointment.rejection_reason}
            </p>
          )}
          {canEditSchedule && isEditingSchedule ? (
            <div className="mt-3 space-y-3 border-t border-[#eee5d7] pt-3">
              <div className="grid grid-cols-2 gap-2">
                {selectableServices.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`rounded-2xl border px-3 py-3 text-left ${
                      serviceId === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-white"
                    }`}
                    onClick={() => setServiceId(item.id)}
                  >
                    <p className="text-sm font-bold text-[var(--text)]">{item.name}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">{won(item.price)}</p>
                  </button>
                ))}
              </div>
              <div className="rounded-2xl bg-[#fcfaf7] p-2">
                <p className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">날짜</p>
                <HorizontalDragScroll>
                  {dateOptions.map((item, index) => (
                    <button
                      key={item}
                      type="button"
                      className={`min-w-[110px] shrink-0 rounded-2xl border px-4 py-3 text-left ${
                        date === item ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-white text-[var(--text)]"
                      }`}
                      onClick={() => setDate(item)}
                    >
                      <span className="text-sm font-bold">{index === 0 && item === currentDateInTimeZone() ? "오늘" : shortDate(item)}</span>
                    </button>
                  ))}
                </HorizontalDragScroll>
              </div>
              <div className="rounded-2xl bg-[#fcfaf7] p-2">
                <p className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">시간</p>
                {slots.length === 0 ? (
                  <div className="rounded-2xl bg-white px-4 py-5 text-center text-sm text-[var(--muted)]">선택한 날짜에 가능한 시간이 없어요.</div>
                ) : (
                  <HorizontalDragScroll>
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`min-w-[92px] shrink-0 rounded-2xl border px-4 py-3 text-center text-sm font-bold ${
                          time === slot ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-white text-[var(--text)]"
                        }`}
                        onClick={() => setTime(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </HorizontalDragScroll>
                )}
              </div>
              <Field label="메모">
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  className="field min-h-24"
                  placeholder="변경 안내 메모를 남겨 주세요"
                />
              </Field>
            </div>
          ) : null}
        </div>
        <AppointmentDetailMediaHistory shopId={data.shop.id} appointment={appointment} />
        <div className="rounded-[18px] border border-[#e8e0d2] bg-white px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] font-medium text-[var(--text)]">알림톡 이력</p>
            <span className="text-[12px] text-[var(--muted)]">{appointmentNotifications.length}건</span>
          </div>
          <div className="mt-3 overflow-hidden rounded-[12px] border border-[var(--border)] bg-white divide-y divide-[var(--border)]">
            {appointmentNotifications.length === 0 ? (
              <p className="px-3.5 py-3 text-[13px] leading-5 text-[var(--muted)]">이 예약으로 발송된 알림톡이 아직 없어요.</p>
            ) : (
              appointmentNotifications.map((notification) => (
                <NotificationHistoryRow key={notification.id} notification={notification} pet={pet} />
              ))
            )}
          </div>
        </div>
        <div className="rounded-[18px] border border-[#e8e0d2] bg-white px-4 py-3.5">
          <p className="text-[14px] font-medium text-[var(--text)]">빠른 연락</p>
          <QuickContactRow
            phone={guardian.phone}
            reminderSent={reminderSent}
            sending={saving}
            onSendReminder={
              canSendReminder
                ? async () => {
                    await onSendReminder();
                    setReminderSent(true);
                  }
                : undefined
            }
          />
        </div>
        {canCancelAppointment ? (
          <div className="rounded-[18px] border border-[#eadbd2] bg-[#fffaf7] px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[var(--text)]">예약 취소</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">취소 후에는 취소·변경 내역에서 확인할 수 있어요.</p>
              </div>
              <button
                type="button"
                onClick={() => onUpdate({ status: "cancelled" })}
                disabled={saving}
                className="shrink-0 rounded-[10px] border border-[#d8c8bd] bg-white px-3 py-2 text-[13px] font-medium text-[#9a5f4f] disabled:opacity-50"
              >
                예약 취소
              </button>
            </div>
          </div>
        ) : null}
        {appointment.status === "pending" && <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold">미승인 사유 템플릿</p><RejectionReasonEditor template={template} customReason={customReason} onTemplateChange={(value) => setTemplate(value || rejectionReasonTemplates[0])} onCustomReasonChange={setCustomReason} /><div className="grid grid-cols-2 gap-2"><ActionButton onClick={() => onUpdate({ status: "confirmed" })} disabled={saving}>{ownerHomeCopy.pendingApprove}</ActionButton><ActionButton onClick={() => onUpdate({ status: "rejected", rejectionReasonTemplate: template, rejectionReasonCustom: customReason })} variant="secondary" disabled={saving}>{"\uBBF8\uC2B9\uC778"}</ActionButton></div></div>}
      </div>
    </Sheet>
  );
}

function NewAppointmentForm({ data, petId, saving, onClose, onSave }: { data: BootstrapPayload; petId?: string; saving: boolean; onClose: () => void; onSave: (payload: unknown) => void }) {
  const [selectedPetId, setSelectedPetId] = useState(petId || "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [customServiceName, setCustomServiceName] = useState("");
  const [date, setDate] = useState(currentDateInTimeZone());
  const [time, setTime] = useState("");
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<"customer" | "service" | "schedule" | "memo">(petId ? "service" : "customer");

  const selectedPet = data.pets.find((item) => item.id === selectedPetId);
  const selectedGuardian = selectedPet ? data.guardians.find((item) => item.id === selectedPet.guardian_id) : undefined;
  const selectableServices = data.services;
  const customService: Service = {
    id: "__custom__",
    shop_id: data.shop.id,
    name: customServiceName.trim() || "기타 직접입력",
    price: 0,
    duration_minutes: 60,
    is_active: true,
    created_at: "",
    updated_at: "",
  };
  const servicesForAvailability = serviceId === "__custom__" ? [...selectableServices, customService] : selectableServices;
  const dateOptions = useMemo(() => Array.from({ length: 14 }, (_, index) => addDate(currentDateInTimeZone(), index)), []);
  const slots = computeAvailableSlots({
    date,
    serviceId: serviceId || customService.id,
    shop: data.shop,
    services: servicesForAvailability,
    appointments: data.appointments,
  });
  const filteredPets = useMemo(() => {
    const query = customerQuery.trim();
    const rows = data.pets.map((pet) => ({ pet, guardian: data.guardians.find((guardian) => guardian.id === pet.guardian_id) }));
    if (!query) return rows;
    return rows.filter((row) => row.guardian?.name.includes(query) || row.pet.name.includes(query));
  }, [customerQuery, data.guardians, data.pets]);

  const canMoveToService = Boolean(selectedPet);
  const canMoveToSchedule = Boolean(serviceId && (serviceId !== "__custom__" || customServiceName.trim()));
  const canSave = Boolean(selectedPet && time && serviceId && (serviceId !== "__custom__" || customServiceName.trim()) && !saving);

  return <Sheet title="새 예약" onClose={onClose}><div className="space-y-4">{step === "customer" ? <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">고객 검색</p><p className="mt-1 text-xs text-[var(--muted)]">보호자 이름이나 아기 이름으로 빠르게 찾아서 예약을 등록해 주세요.</p><div className="mt-3 rounded-2xl border border-[var(--border)] bg-white px-3 py-3"><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="보호자명 또는 아기 이름 검색" className="w-full bg-transparent text-sm outline-none" /></div>{selectedPet && selectedGuardian ? <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#fcfaf7] px-3 py-3"><Avatar seed={selectedPet.avatar_seed} /><div className="min-w-0 flex-1"><p className="text-sm font-bold">{selectedPet.name}</p><p className="text-xs text-[var(--muted)]">{selectedGuardian.name} {ownerHomeCopy.separator} {selectedGuardian.phone}</p></div><span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent)]">선택됨</span></div> : null}<div className="mt-3 max-h-64 overflow-y-auto pr-1"><div className="space-y-2">{filteredPets.length === 0 ? <EmptyState title="검색된 고객이 없어요" /> : filteredPets.map((row) => <button key={row.pet.id} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${selectedPetId === row.pet.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-white"}`} onClick={() => { setSelectedPetId(row.pet.id); setServiceId(""); setCustomServiceName(""); setTime(""); setMemo(""); }}><Avatar seed={row.pet.avatar_seed} /><div className="min-w-0 flex-1"><p className="text-sm font-bold">{row.pet.name}</p><p className="text-xs text-[var(--muted)]">{row.guardian?.name || "보호자 없음"} {ownerHomeCopy.separator} {row.pet.breed}</p></div></button>)}</div></div><div className="mt-4"><ActionButton disabled={!canMoveToService} onClick={() => setStep("service")}>다음</ActionButton></div></div> : null}{step === "service" ? <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">서비스 선택</p><div className="mt-2.5 grid grid-cols-2 gap-2">{selectableServices.map((item) => <button key={item.id} className={`rounded-2xl border px-3 py-4 text-left ${serviceId === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-white"}`} onClick={() => { setServiceId(item.id); setTime(""); }}><p className="text-sm font-bold">{item.name}</p></button>)}<button className={`rounded-2xl border px-3 py-4 text-left ${serviceId === "__custom__" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-white"}`} onClick={() => { setServiceId("__custom__"); setTime(""); }}><p className="text-sm font-bold">기타</p></button></div>{serviceId === "__custom__" ? <div className="mt-3"><input value={customServiceName} onChange={(event) => setCustomServiceName(event.target.value)} className="field" placeholder="예: 탄산 스파, 발 관리" /></div> : null}<div className="mt-4 grid grid-cols-2 gap-2"><ActionButton variant="ghost" onClick={() => setStep("customer")}>이전</ActionButton><ActionButton disabled={!canMoveToSchedule} onClick={() => setStep("schedule")}>다음</ActionButton></div></div> : null}{step === "schedule" ? <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><div><p className="text-sm font-semibold">날짜 / 시간 선택</p><p className="mt-1 text-xs text-[var(--muted)]">좌우로 넘기듯 터치해서 빠르게 선택할 수 있어요.</p></div><div className="mt-3 space-y-3"><div className="rounded-2xl bg-[#fcfaf7] p-2"><p className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">날짜</p><HorizontalDragScroll>{dateOptions.map((item, index) => <button key={item} className={`min-w-[110px] shrink-0 rounded-2xl border px-4 py-3 text-left ${date === item ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-[#fcfaf7] text-[var(--text)]"}`} onClick={() => { setDate(item); setTime(""); }}><span className="text-sm font-bold">{index === 0 ? "오늘" : shortDate(item)}</span></button>)}</HorizontalDragScroll></div><div className="rounded-2xl bg-[#fcfaf7] p-2"><p className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">시간</p>{slots.length === 0 ? <div className="rounded-2xl bg-[#fcfaf7] px-4 py-6 text-center text-sm text-[var(--muted)]">선택한 조건에 가능한 시간이 없어요.</div> : <HorizontalDragScroll>{slots.map((slot) => <button key={slot} className={`min-w-[92px] shrink-0 rounded-2xl border px-4 py-3 text-center text-sm font-bold ${time === slot ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-[#fcfaf7] text-[var(--text)]"}`} onClick={() => setTime(slot)}>{slot}</button>)}</HorizontalDragScroll>}</div></div><div className="mt-4 grid grid-cols-2 gap-2"><ActionButton variant="ghost" onClick={() => setStep("service")}>이전</ActionButton><ActionButton disabled={!time} onClick={() => setStep("memo")}>다음</ActionButton></div></div> : null}{step === "memo" ? <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><Field label="메모"><textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="field min-h-24" placeholder="참고 메모를 남겨주세요" /></Field><div className="mt-4 grid grid-cols-2 gap-2"><ActionButton variant="ghost" onClick={() => setStep("schedule")}>이전</ActionButton><ActionButton disabled={!canSave} onClick={() => onSave({ shopId: data.shop.id, guardianId: selectedPet?.guardian_id, petId: selectedPetId, serviceId, customServiceName: serviceId === "__custom__" ? customServiceName.trim() : "", appointmentDate: date, appointmentTime: time, memo, source: "owner" })}>예약 등록</ActionButton></div></div> : null}</div></Sheet>;
}

function NewCustomerForm({ shopId, saving, onClose, onSave }: { shopId: string; saving: boolean; onClose: () => void; onSave: (guardianPayload: { shopId: string; name: string; phone: string; memo: string }, petPayloads: Array<{ shopId: string; name: string; breed: string; birthday: string | null; weight: null; age: null; notes: string; groomingCycleWeeks: number }>) => void }) {
  const [guardianName, setGuardianName] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [pets, setPets] = useState([{ id: crypto.randomUUID(), name: "", breed: "", birthday: "" }]);

  function updatePet(id: string, field: "name" | "breed" | "birthday", value: string) {
    setPets((prev) => prev.map((pet) => (pet.id === id ? { ...pet, [field]: value } : pet)));
  }

  function addPet() {
    setPets((prev) => [...prev, { id: crypto.randomUUID(), name: "", breed: "", birthday: "" }]);
  }

  function removePet(id: string) {
    setPets((prev) => (prev.length === 1 ? prev : prev.filter((pet) => pet.id !== id)));
  }

  const canSave = !saving && guardianName.trim() && phone.trim() && pets.every((pet) => pet.name.trim() && pet.breed.trim());

  return (
    <Sheet title="새 고객" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold">보호자 정보</p>
          <div className="mt-3 space-y-2.5">
            <CustomerDetailFieldCard label="보호자 이름">
              <input
                className="w-full bg-transparent px-0 py-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf]"
                value={guardianName}
                onChange={(event) => setGuardianName(event.target.value)}
              />
            </CustomerDetailFieldCard>
            <CustomerDetailFieldCard label="연락처">
              <input
                className="w-full bg-transparent px-0 py-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf]"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </CustomerDetailFieldCard>
            <CustomerDetailFieldCard label="고객 메모">
              <input
                className="w-full bg-transparent px-0 py-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf]"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="선택 입력"
              />
            </CustomerDetailFieldCard>
          </div>
        </div>

        <div className="space-y-3">
          {pets.map((pet, index) => (
            <div key={pet.id} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">아기 {index + 1}</p>
                {index > 0 ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#b85c47]"
                    onClick={() => removePet(pet.id)}
                  >
                    삭제
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-[var(--muted)]">최소 1마리</span>
                )}
              </div>

              <div className="mt-3 space-y-2.5">
                <CustomerDetailFieldCard label="아기 이름">
                  <input
                    className="w-full bg-transparent px-0 py-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf]"
                    value={pet.name}
                    onChange={(event) => updatePet(pet.id, "name", event.target.value)}
                  />
                </CustomerDetailFieldCard>
                <CustomerDetailFieldCard label="견종">
                  <input
                    className="w-full bg-transparent px-0 py-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf]"
                    value={pet.breed}
                    onChange={(event) => updatePet(pet.id, "breed", event.target.value)}
                  />
                </CustomerDetailFieldCard>
                <CustomerDetailFieldCard label="생일">
                  <input
                    className="w-full bg-transparent px-0 py-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf]"
                    type="date"
                    value={pet.birthday}
                    onChange={(event) => updatePet(pet.id, "birthday", event.target.value)}
                  />
                </CustomerDetailFieldCard>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="w-full rounded-2xl border border-dashed border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold text-[var(--accent)]"
          onClick={addPet}
        >
          + 아기 추가하기
        </button>

        <ActionButton
          disabled={!canSave}
          onClick={() =>
            onSave(
              { shopId, name: guardianName.trim(), phone: phone.trim(), memo: memo.trim() },
              pets.map((pet) => ({
                shopId,
                name: pet.name.trim(),
                breed: pet.breed.trim(),
                birthday: pet.birthday || null,
                weight: null,
                age: null,
                notes: "",
                groomingCycleWeeks: 4,
              })),
            )
          }
        >
          고객 저장
        </ActionButton>
      </div>
    </Sheet>
  );
}
function AddPetForm({ shopId, guardianId, saving, onClose, onSave }: { shopId: string; guardianId: string; saving: boolean; onClose: () => void; onSave: (payload: { shopId: string; guardianId: string; name: string; breed: string; birthday: string | null; weight: null; age: null; notes: string; groomingCycleWeeks: number }) => void }) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birthday, setBirthday] = useState("");
  const [notes, setNotes] = useState("");
  return <Sheet title="반려견 추가" onClose={onClose}><div className="space-y-3"><Field label="아기 이름"><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="견종"><input className="field" value={breed} onChange={(event) => setBreed(event.target.value)} /></Field><Field label="생일"><input className="field" type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} /></Field><Field label="메모"><textarea className="field min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field><ActionButton disabled={saving || !name || !breed} onClick={() => onSave({ shopId, guardianId, name, breed, birthday: birthday || null, weight: null, age: null, notes, groomingCycleWeeks: 4 })}>반려견 저장</ActionButton></div></Sheet>;
}
function EditRecordForm({
  services,
  record,
  saving,
  onClose,
  onSave,
}: {
  shopId: string;
  services: Service[];
  record: GroomingRecord;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: unknown) => void;
}) {
  const [styleNotes, setStyleNotes] = useState(record.style_notes);
  const [memo, setMemo] = useState(record.memo);
  const [pricePaid, setPricePaid] = useState(String(record.price_paid));
  const [serviceId, setServiceId] = useState(record.service_id);

  const fieldLabelClassName =
    "mb-2 block text-[14px] font-medium leading-5 tracking-[-0.01em] text-[var(--muted)]";
  const fieldInputClassName =
    "h-12 rounded-[14px] border border-[var(--border)] bg-white px-4 text-[16px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none transition placeholder:text-[15px] placeholder:font-normal placeholder:text-[#a29c92] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(31,107,91,0.12)]";
  const fieldTextareaClassName =
    "min-h-[112px] rounded-[14px] border border-[var(--border)] bg-white px-4 py-3 text-[16px] font-medium leading-6 tracking-[-0.02em] text-[var(--text)] outline-none transition placeholder:text-[15px] placeholder:font-normal placeholder:text-[#a29c92] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(31,107,91,0.12)]";

  return (
    <Sheet title="미용 기록 수정" onClose={onClose}>
      <div className="space-y-4 pb-1">
        <label className="block">
          <span className={fieldLabelClassName}>서비스</span>
          <select
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            className={`w-full ${fieldInputClassName}`}
          >
            {services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={fieldLabelClassName}>스타일 메모</span>
          <input
            value={styleNotes}
            onChange={(event) => setStyleNotes(event.target.value)}
            className={`w-full ${fieldInputClassName}`}
            placeholder="스타일 메모를 입력해 주세요"
          />
        </label>

        <label className="block">
          <span className={fieldLabelClassName}>상세 메모</span>
          <textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            className={`w-full resize-none ${fieldTextareaClassName}`}
            placeholder="상세 메모를 입력해 주세요"
          />
        </label>

        <label className="block">
          <span className={fieldLabelClassName}>결제 금액</span>
          <input
            value={pricePaid}
            onChange={(event) => setPricePaid(event.target.value)}
            className={`w-full ${fieldInputClassName}`}
            placeholder="결제 금액을 입력해 주세요"
          />
        </label>

        <ActionButton
          disabled={saving}
          className="h-12 rounded-[16px] text-[15px] font-semibold tracking-[-0.02em]"
          onClick={() =>
            onSave({
              recordId: record.id,
              styleNotes,
              memo,
              pricePaid: Number(pricePaid),
              serviceId,
            })
          }
        >
          기록 저장
        </ActionButton>
      </div>
    </Sheet>
  );
}

function splitShopAddressValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { baseAddress: "", detailAddress: "" };

  const closingParenIndex = trimmed.lastIndexOf(")");
  if (closingParenIndex !== -1 && closingParenIndex < trimmed.length - 1) {
    const baseAddress = trimmed.slice(0, closingParenIndex + 1).trim();
    const detailAddress = trimmed.slice(closingParenIndex + 1).trim();
    return { baseAddress, detailAddress };
  }

  return { baseAddress: trimmed, detailAddress: "" };
}

function formatShopPhoneNumber(value: string) {
  const digits = phoneNormalize(value).slice(0, 11);
  if (!digits) return "";

  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.startsWith("0505")) {
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, digits.length - 4)}-${digits.slice(-4)}`;
  }

  if (digits[0] === "1" && digits.length <= 8) {
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
}

function ShopProfileEditForm({ data, saving, onClose, onSave }: { data: BootstrapPayload; saving: boolean; onClose: () => void; onSave: (payload: ShopProfileSavePayload) => void }) {
  const initialAddressState = splitShopAddressValue(data.shop.address);
  const [name, setName] = useState(data.shop.name);
  const [phone, setPhone] = useState(formatShopPhoneNumber(data.shop.phone));
  const [baseAddress, setBaseAddress] = useState(initialAddressState.baseAddress);
  const [detailAddress, setDetailAddress] = useState(initialAddressState.detailAddress);
  const [postalCode, setPostalCode] = useState("");
  const [isAddressSearchOpen, setIsAddressSearchOpen] = useState(false);
  const [description, setDescription] = useState(data.shop.description);
  const [heroImageUrl, setHeroImageUrl] = useState(data.shop.customer_page_settings?.hero_image_url || "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [businessHours, setBusinessHours] = useState<ShopBusinessHours>(() =>
    Object.fromEntries(
      Object.entries(data.shop.business_hours).map(([key, value]) => [
        key,
        value || { open: "10:00", close: "19:00", enabled: false },
      ]),
    ),
  );

  const normalizedCustomerPageSettings = useMemo(
    () => normalizeCustomerPageSettings(data.shop.customer_page_settings, data.shop.name, data.shop.description),
    [data.shop.customer_page_settings, data.shop.description, data.shop.name],
  );
  const combinedAddress = [baseAddress.trim(), detailAddress.trim()].filter(Boolean).join(" ");
  const canSave = Boolean(name.trim() && phone.trim() && combinedAddress);
  const bareInputClassName = "w-full bg-transparent px-0 py-0 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf]";
  const bareTextareaClassName = "min-h-[96px] w-full resize-none bg-transparent px-0 py-0 text-[14px] leading-6 text-[var(--text)] outline-none placeholder:text-[#b0b7bf]";

  function handleProfileImageChange(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setHeroImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <Sheet
      title="매장 프로필 편집"
      onClose={onClose}
      footer={
        <ActionButton
          disabled={saving || !canSave}
          onClick={() =>
            onSave({
              settingsPayload: {
                shopId: data.shop.id,
                name: name.trim(),
                phone: phone.trim(),
                address: combinedAddress,
                description: description.trim(),
                concurrentCapacity: concurrentCapacityForApprovalMode(data.shop.approval_mode),
                bookingSlotIntervalMinutes: data.shop.booking_slot_interval_minutes,
                bookingSlotOffsetMinutes: data.shop.booking_slot_offset_minutes,
                bookingAvailableStartTime: data.shop.booking_available_start_time,
                bookingAvailableEndTime: data.shop.booking_available_end_time,
                approvalMode: data.shop.approval_mode,
                regularClosedDays: data.shop.regular_closed_days,
                temporaryClosedDates: data.shop.temporary_closed_dates,
                businessHours,
                notificationSettings: {
                  enabled: data.shop.notification_settings.enabled,
                  revisitEnabled: data.shop.notification_settings.revisit_enabled,
                  bookingConfirmedEnabled: data.shop.notification_settings.booking_confirmed_enabled,
                  bookingRejectedEnabled: data.shop.notification_settings.booking_rejected_enabled,
                  bookingCancelledEnabled: data.shop.notification_settings.booking_cancelled_enabled,
                  bookingRescheduledEnabled: data.shop.notification_settings.booking_rescheduled_enabled,
                  groomingAlmostDoneEnabled: data.shop.notification_settings.grooming_almost_done_enabled,
                  groomingCompletedEnabled: data.shop.notification_settings.grooming_completed_enabled,
                  groomingStartWithoutPhotoEnabled: data.shop.notification_settings.grooming_start_without_photo_enabled,
                  groomingCompleteWithoutPhotoEnabled: data.shop.notification_settings.grooming_complete_without_photo_enabled,
                },
              },
              customerPageSettingsPayload: {
                shopId: data.shop.id,
                customerPageSettings: {
                  ...normalizedCustomerPageSettings,
                  shop_name: name.trim(),
                  hero_image_url: heroImageUrl.trim(),
                },
              },
            })
          }
        >
          매장 정보 저장
        </ActionButton>
      }
    >
      <div className="space-y-4">
        <section className="space-y-2.5">
          <CustomerDetailFieldCard label="프로필 사진">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-full border border-[#dfeae5] bg-white shadow-[0_2px_8px_rgba(31,107,91,0.05)]"
                  aria-label="프로필 이미지 변경"
                >
                  {heroImageUrl ? (
                    <img src={heroImageUrl} alt={`${name || data.shop.name} 프로필`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#f4f5f4] text-[#9ea4a1]">
                      <UserRound className="h-7 w-7" strokeWidth={1.8} />
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-[var(--accent)] text-white shadow-[0_6px_14px_rgba(31,107,91,0.18)]"
                  aria-label="프로필 이미지 선택"
                >
                  <Camera className="h-3 w-3" strokeWidth={2} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleProfileImageChange(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-[var(--text)]">{name || data.shop.name}</p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[var(--muted)]">
                  {description.trim() || "매장 소개를 입력해 주세요"}
                </p>
              </div>
            </div>
          </CustomerDetailFieldCard>

          <CustomerDetailFieldCard label="매장명">
            <input
              className={bareInputClassName}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 매장명"
            />
          </CustomerDetailFieldCard>

          <CustomerDetailFieldCard label="매장 연락처">
            <input
              className={bareInputClassName}
              value={phone}
              onChange={(event) => setPhone(formatShopPhoneNumber(event.target.value))}
              placeholder="010-0000-0000"
            />
          </CustomerDetailFieldCard>

          <CustomerDetailFieldCard label="매장 주소" className="px-4 pb-3 pt-3">
            <button
              type="button"
              onClick={() => setIsAddressSearchOpen(true)}
              className="flex min-h-[34px] w-full items-center justify-between gap-3 text-left transition"
            >
              <div className="min-w-0 flex-1">
                <span className={baseAddress ? "block whitespace-normal break-words text-[14px] font-medium leading-5 text-[var(--text)]" : "block text-[14px] leading-5 text-[#b0b7bf]"}>
                  {baseAddress || "주소 검색으로 매장 주소를 선택해 주세요"}
                </span>
              </div>
              <span className="shrink-0 text-[13px] font-medium text-[var(--accent)]">주소 검색</span>
            </button>
            {postalCode ? (
              <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">우편번호 {postalCode}</p>
            ) : null}
          </CustomerDetailFieldCard>

          <CustomerDetailFieldCard label="상세 주소">
            <input
              className={bareInputClassName}
              value={detailAddress}
              onChange={(event) => setDetailAddress(event.target.value)}
              placeholder="상세 주소를 입력해 주세요"
            />
            <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">건물명, 층수, 호수는 상세 주소에 적어 주세요.</p>
          </CustomerDetailFieldCard>

          <CustomerDetailFieldCard label="매장 소개">
            <textarea
              className={bareTextareaClassName}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="매장을 간단히 소개해 주세요"
            />
          </CustomerDetailFieldCard>
        </section>

        <section className="space-y-2.5">
          <div className="px-1">
            <p className="text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">운영 정보</p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">요일별 운영 시간을 설정해 주세요.</p>
          </div>

          <CustomerDetailFieldCard label="운영 가능 시간">
            <div className="space-y-2">
              {Object.entries(businessHours).map(([key, value], index) => {
                const dayValue = value || { open: "10:00", close: "19:00", enabled: false };

                return <div key={key} className="rounded-[14px] border border-[var(--border)] bg-[#fcfaf7] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-medium text-[var(--text)]">{compactWeekdayLabels[index] || key}</p>
                    <label className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={dayValue.enabled}
                        onChange={(event) =>
                          setBusinessHours((prev) => ({
                            ...prev,
                            [key]: {
                              ...(prev[key] || dayValue),
                              enabled: event.target.checked,
                            },
                          }))
                        }
                      />
                      운영
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      className="field-input"
                      value={dayValue.open}
                      disabled={!dayValue.enabled}
                      onChange={(event) =>
                        setBusinessHours((prev) => ({
                          ...prev,
                          [key]: {
                            ...(prev[key] || dayValue),
                            open: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      type="time"
                      className="field-input"
                      value={dayValue.close}
                      disabled={!dayValue.enabled}
                      onChange={(event) =>
                        setBusinessHours((prev) => ({
                          ...prev,
                          [key]: {
                            ...(prev[key] || dayValue),
                            close: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>;
              })}
            </div>
          </CustomerDetailFieldCard>
        </section>

      </div>
      {isAddressSearchOpen ? (
        <KakaoPostcodeSheet
          title="매장 주소 검색"
          description="도로명이나 건물명으로 검색한 뒤 매장 주소를 선택해 주세요."
          initialQuery={baseAddress}
          onClose={() => setIsAddressSearchOpen(false)}
          onSelect={(selection) => {
            setBaseAddress(selection.address);
            setDetailAddress("");
            setPostalCode(selection.zonecode);
            setIsAddressSearchOpen(false);
          }}
        />
      ) : null}
    </Sheet>
  );
}

function ShopPickerSheet({ shops, currentShopId, switching, onClose, onSelect, onEdit }: { shops: OwnedShopSummary[]; currentShopId: string; switching: boolean; onClose: () => void; onSelect: (shopId: string) => Promise<void>; onEdit: (shopId: string) => Promise<void> }) {
  return <Sheet title="매장 전환" onClose={onClose}><div className="space-y-3">{shops.map((shop) => <div key={shop.id} className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 ${shop.id === currentShopId ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-white"}`}><button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void onSelect(shop.id)} disabled={switching}><ShopAvatar name={shop.name} imageUrl={shop.heroImageUrl} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text)]">{shop.name}</p><p className="truncate text-xs text-[var(--muted)]">{shop.address}</p></div></button><button type="button" className="shrink-0 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--accent)]" onClick={() => void onEdit(shop.id)} disabled={switching}>편집</button></div>)}</div></Sheet>;
}

function BookingGuideSheet({ bookingEntryUrl, onClose }: { bookingEntryUrl: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=168x168&margin=12&data=${encodeURIComponent(bookingEntryUrl)}`;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingEntryUrl);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors in the guide sheet
    }
  };

  return (
    <Sheet title="예약 링크 안내" onClose={onClose}>
      <div className="space-y-4 pb-2">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-bold text-[var(--text)]">고객 예약 링크</p>
          <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
            고객이 직접 예약할 수 있는 링크예요. 인스타그램, 네이버 플레이스, 카카오 채널 등에 넣어두면 고객이 바로 예약할 수 있어요.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-[14px] bg-white px-3 py-3">
            <p className="min-w-0 flex-1 break-all text-[12px] text-[var(--muted)]">{bookingEntryUrl}</p>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]"
              onClick={handleCopy}
              aria-label="링크 복사하기"
            >
              {copied ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-[var(--muted)]" />
            <p className="text-sm font-bold text-[var(--text)]">QR 코드</p>
          </div>
          <div className="mt-3 flex justify-center rounded-[16px] bg-white p-4">
            <img src={qrImageUrl} alt="고객 예약 QR 코드" className="h-[168px] w-[168px]" />
          </div>
          <a
            href={qrImageUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[12px] border border-[var(--border)] bg-white text-[13px] font-medium text-[var(--text)]"
          >
            QR 크게 보기
          </a>
        </div>
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-bold text-[var(--text)]">사용 예시</p>
          <ul className="mt-3 space-y-2 text-[13px] leading-6 text-[var(--muted)]">
            <li>인스타그램 프로필 링크</li>
            <li>네이버 플레이스 소개 문구</li>
            <li>카카오 채널 버튼</li>
            <li>문자 또는 알림톡 안내 문구</li>
            <li>블로그 또는 공지글</li>
          </ul>
        </div>
        <button
          type="button"
          className="inline-flex h-12 w-full items-center justify-center rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[15px] font-medium tracking-[-0.01em] text-white"
          onClick={handleCopy}
        >
          링크 복사하기
        </button>
        <div
          className={`pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+24px)] z-[70] flex justify-center px-6 transition-all duration-200 ${
            copied ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
          aria-live="polite"
        >
          <div className="rounded-full bg-[rgba(35,35,31,0.92)] px-4 py-2 text-[13px] font-medium text-white shadow-[0_12px_24px_rgba(35,35,31,0.18)]">
            예약 링크가 복사되었어요
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function SettingsPanel({
  data,
  initialScreen = null,
  onSave,
  onSaveService,
  onSaveCustomerPageSettings,
  onLogout,
  loggingOut = false,
  userEmail,
  subscriptionSummary,
  onActiveScreenChange,
}: {
  data: BootstrapPayload;
  initialScreen?: SettingsEntryScreen;
  onSave: (payload: unknown) => void;
  onSaveService: (payload: unknown) => void;
  onSaveCustomerPageSettings: (payload: unknown) => void;
  onLogout?: () => void;
  loggingOut?: boolean;
  userEmail?: string | null;
  subscriptionSummary?: OwnerSubscriptionSummary | null;
  onActiveScreenChange?: (screen: SettingsEntryScreen) => void;
}) {
  return (
    <OwnerSettingsPanel
      data={data}
      initialScreen={initialScreen}
      onSave={onSave}
      onSaveService={onSaveService}
      onSaveCustomerPageSettings={onSaveCustomerPageSettings}
      onLogout={onLogout}
      loggingOut={loggingOut}
      userEmail={userEmail}
      subscriptionSummary={subscriptionSummary}
      onActiveScreenChange={onActiveScreenChange}
    />
  );
}

function RecordCard({ record, pet, service, onEdit }: { record: GroomingRecord; pet: Pet; service?: Service; onEdit: () => void }) {
  return (
    <div className="flex w-full items-start justify-between gap-3 px-3.5 py-3">
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left transition hover:bg-[#fffdfa]">
        <div className="flex items-center gap-2">
          <p className="truncate text-[16px] font-medium leading-5 tracking-[-0.02em] text-[var(--text)]">{pet.name}</p>
          <span className="text-[14px] leading-5 text-[var(--muted)]">{record.groomed_at.slice(0, 10)}</span>
        </div>
        <p className="mt-1 text-[14px] leading-5 text-[var(--text)]">{service?.name || "시술내역 없음"}</p>
        <p className="mt-1 truncate text-[14px] leading-5 text-[var(--muted)]">{record.memo || "상세 메모 없음"}</p>
      </button>
      <button type="button" onClick={onEdit} className="shrink-0 text-[14px] font-medium leading-5 text-[var(--accent)]">
        수정
      </button>
    </div>
  );
}
function StatDetail({
  kind,
  todayAppointments,
  pendingAppointments,
  overdueRows,
  petMap,
  guardianMap,
  serviceMap,
  saving,
  onUpdate,
  onOpenAppointment,
  onClose,
}: {
  kind: "today" | "pending" | "completed" | "cancel_change";
  todayAppointments: Appointment[];
  pendingAppointments: Appointment[];
  overdueRows: Array<{ pet: Pet; guardian: Guardian; daysUntil: number | null }>;
  petMap: Record<string, Pet>;
  guardianMap: Record<string, Guardian>;
  serviceMap: Record<string, Service>;
  saving: boolean;
  onUpdate: (appointmentId: string, payload: AppointmentUpdatePayload) => void;
  onOpenAppointment: (appointment: Appointment) => void;
  onClose: () => void;
}) {
  const [openRejectAppointmentId, setOpenRejectAppointmentId] = useState<string | null>(null);
  const currentAppointments = todayAppointments.filter((item) => ["confirmed", "in_progress", "almost_done"].includes(item.status));
  const completedAppointments = todayAppointments.filter((item) => item.status === "completed");
  const cancelChangeOnly = todayAppointments.filter((item) => item.status === "cancelled");

  return (
    <Sheet title={kind === "today" ? ownerHomeCopy.todaySheetTitle : kind === "pending" ? ownerHomeCopy.pendingSheetTitle : kind === "completed" ? ownerHomeCopy.completedSheetTitle : ownerHomeCopy.cancelChangeSheetTitle} onClose={onClose}>
      <div className="space-y-3">
        {kind === "today" && (
          <CurrentReservationsContent
            currentAppointments={currentAppointments}
            petMap={petMap}
            guardianMap={guardianMap}
            serviceMap={serviceMap}
            saving={saving}
            onOpenAppointment={onOpenAppointment}
            onStatusChange={(appointmentId, status) => onUpdate(appointmentId, { status })}
          />
        )}
        {kind === "pending" &&
          pendingAppointments.map((appointment) => (
            <PendingApprovalCard
              key={appointment.id}
              appointment={appointment}
              pet={petMap[appointment.pet_id]}
              guardian={guardianMap[appointment.guardian_id]}
              service={serviceMap[appointment.service_id]}
              saving={saving}
              onOpen={() => onOpenAppointment(appointment)}
              onStatusChange={(payload) => {
                setOpenRejectAppointmentId(null);
                onUpdate(appointment.id, payload);
              }}
              isRejectOpen={openRejectAppointmentId === appointment.id}
              onRejectOpen={() => setOpenRejectAppointmentId(appointment.id)}
              onRejectClose={() => setOpenRejectAppointmentId(null)}
            />
          ))}
        {kind === "completed" && <CompletedReservationsContent historyAppointments={completedAppointments} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} onOpenAppointment={onOpenAppointment} />}
        {kind === "cancel_change" &&
          cancelChangeOnly.map((appointment) => (
            <HomeConfirmedCard
              key={appointment.id}
              appointment={appointment}
              pet={petMap[appointment.pet_id]}
              guardian={guardianMap[appointment.guardian_id]}
              service={serviceMap[appointment.service_id]}
              saving={saving}
              onOpen={() => onOpenAppointment(appointment)}
              onStatusChange={(status) => onUpdate(appointment.id, { status })}
            />
          ))}
      </div>
    </Sheet>
  );
}

function PendingApprovalCard({ appointment, pet, guardian, service, staffName, saving, onOpen, onStatusChange, isRejectOpen, onRejectOpen, onRejectClose, hideTime = false, sequenceLabel }: { appointment: Appointment; pet: Pet; guardian: Guardian; service: Service; staffName?: string; saving: boolean; onOpen: () => void; onStatusChange: (payload: AppointmentUpdatePayload) => void; isRejectOpen: boolean; onRejectOpen: () => void; onRejectClose: () => void; hideTime?: boolean; sequenceLabel?: string }) {
  const [template, setTemplate] = useState<"" | (typeof rejectionReasonTemplates)[number]>("");
  const [customReason, setCustomReason] = useState("");
  const requiresCustomReason = template === "기타 직접 입력";
  const canSubmitReject = Boolean(template) && (!requiresCustomReason || customReason.trim().length > 0);

  const handleRejectCancel = () => {
    setTemplate("");
    setCustomReason("");
    onRejectClose();
  };

  const handleRejectConfirm = () => {
    if (!canSubmitReject || !template) return;
    onStatusChange({ status: "rejected", rejectionReasonTemplate: template, rejectionReasonCustom: customReason.trim() });
    handleRejectCancel();
  };
  return (
    <div className="rounded-[12px] border border-[#e7edf4] bg-white px-3.5 py-2.5">
      <div className={cn("grid w-full items-center gap-x-3", hideTime ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[54px_1px_minmax(0,1fr)_auto]")}>
        {!hideTime ? (
          <>
            <button onClick={onOpen} className="text-left text-[16px] font-normal leading-6 tracking-[-0.02em] text-[#0f172a]">{formatClockTime(appointment.appointment_time)}</button>
            <div className="h-9 w-px bg-[#e1e7ef]" />
          </>
        ) : null}
        <button onClick={onOpen} className="min-w-0 text-left">
          <p className="truncate text-[16px] font-medium leading-[21px] text-[var(--text)]">
            {pet.name} <span className="font-normal text-[var(--muted)]">{guardian.name}</span>
          </p>
          <p className="truncate text-[16px] font-normal leading-[21px] text-[var(--muted)]">
            {service.name} {ownerHomeCopy.separator} {staffName ?? "미배정"}
          </p>
        </button>
        {!isRejectOpen ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onStatusChange({ status: "confirmed" })}
              disabled={saving}
              className="flex h-8 items-center justify-center rounded-full border border-[#111827] bg-[#111827] px-3 text-[16px] font-medium text-white transition disabled:opacity-50"
            >
              {ownerHomeCopy.pendingApprove}
            </button>
            <button
              type="button"
              onClick={onRejectOpen}
              disabled={saving}
              className="flex h-8 items-center justify-center rounded-full border border-[var(--border)] bg-white px-3 text-[16px] font-medium text-[var(--text)] transition disabled:opacity-50"
            >
              {"미승인"}
            </button>
          </div>
        ) : null}
      </div>
      {isRejectOpen ? (
        <div className="mt-3 space-y-3 rounded-[12px] border border-[var(--border)] bg-[#fcfaf7] p-3">
          <p className="text-xs font-semibold text-[var(--text)]">사유를 선택해주세요</p>
          <RejectionReasonEditor template={template} customReason={customReason} onTemplateChange={(value) => setTemplate(value || rejectionReasonTemplates[0])} onCustomReasonChange={setCustomReason} />
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={handleRejectCancel} variant="ghost" disabled={saving}>{"취소"}</ActionButton>
            <ActionButton onClick={handleRejectConfirm} variant="secondary" disabled={saving || !canSubmitReject}>{"미승인 확정"}</ActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}


function CurrentReservationsContent({ currentAppointments, petMap, guardianMap, serviceMap, saving, onOpenAppointment, onStatusChange }: { currentAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; saving: boolean; onOpenAppointment: (appointment: Appointment) => void; onStatusChange: (appointmentId: string, status: AppointmentStatus) => void; }) {
  return <div className="overflow-hidden rounded-[10px] border border-[#d8e7e0] bg-[#f6fbf8] p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#2f7866]" /><div className="mb-2.5"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.currentSectionTitle}</h3></div><div className="max-h-[34rem] overflow-y-auto pr-1"><div className="space-y-2.5">{currentAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.currentSectionEmpty} /> : currentAppointments.map((appointment) => <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} allowSwipeCancel />)}</div></div></div>;
}

function groupAppointmentsByTime(appointments: Appointment[]) {
  const groups = new Map<string, Appointment[]>();
  appointments.forEach((appointment) => {
    const key = appointment.appointment_time;
    groups.set(key, [...(groups.get(key) ?? []), appointment]);
  });
  return Array.from(groups.entries()).map(([time, items]) => ({ time, items }));
}

function AppointmentTimeGroupHeader({ time, count, label }: { time: string; count: number; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-1 pt-0.5">
      <div className="flex min-w-0 items-baseline gap-2 rounded-full bg-[#f8fafc] px-3 py-1.5">
        <span className="text-[18px] font-medium leading-6 tracking-[-0.03em] text-[var(--text)]">{formatClockTime(time)}</span>
        <span className="truncate text-[16px] leading-[22px] text-[var(--muted)]">{label} {count}건</span>
      </div>
      <div className="h-px min-w-0 flex-1 bg-[#e1e7ef]" />
    </div>
  );
}

function HomeReservationSectionHeader({ title, dotClassName, expanded, onToggle }: { title: string; dotClassName: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={`flex w-full items-center justify-between gap-3 text-left ${expanded ? "mb-4" : ""}`}>
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClassName}`} />
        <span className="truncate text-[16px] font-medium leading-[22px] tracking-[-0.02em] text-[var(--text)]">{title}</span>
      </span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-[#94a3b8] transition-transform ${expanded ? "" : "-rotate-90"}`} />
    </button>
  );
}

function TodayConfirmedContent({ pendingAppointments, currentAppointments, cancelChangeAppointments, completedAppointments, petMap, guardianMap, serviceMap, staffMap, latestNotificationByAppointmentId, saving, focusedSection, selectedDateKey, slideDirection, canMoveBackward, canMoveForward, onMoveBackward, onMoveForward, onOpenAppointment, onPendingUpdate, onStatusChange, onStartWithoutPhoto, onStartWithPhoto }: { pendingAppointments: Appointment[]; currentAppointments: Appointment[]; cancelChangeAppointments: Appointment[]; completedAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; staffMap: Record<string, BootstrapPayload["staffMembers"][number]>; latestNotificationByAppointmentId: Map<string, BootstrapPayload["notifications"][number]>; saving: boolean; focusedSection: HomeReservationSectionKey; selectedDateKey: string; slideDirection: "prev" | "next"; canMoveBackward: boolean; canMoveForward: boolean; onMoveBackward: () => void; onMoveForward: () => void; onOpenAppointment: (appointment: Appointment) => void; onPendingUpdate: (appointmentId: string, payload: AppointmentUpdatePayload) => void; onStatusChange: (appointmentId: string, status: AppointmentStatus) => void; onStartWithoutPhoto: (appointmentId: string) => void; onStartWithPhoto: (appointmentId: string, file: File) => void; }) {
  const [openRejectAppointmentId, setOpenRejectAppointmentId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<HomeReservationSectionKey, boolean>>({
    pending: true,
    current: true,
    cancelChange: true,
    completed: true,
  });
  const pendingGroups = groupAppointmentsByTime(pendingAppointments);
  const currentGroups = groupAppointmentsByTime(currentAppointments);
  const cancelChangeGroups = groupAppointmentsByTime(cancelChangeAppointments);
  const toggleSection = (section: HomeReservationSectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
  const shouldShowSection = (section: HomeReservationSectionKey) => focusedSection === section;

  useEffect(() => {
    setExpandedSections((prev) => ({ ...prev, [focusedSection]: true }));
  }, [focusedSection]);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [contentSlideStyle, setContentSlideStyle] = useState<{ transform: string; opacity: number; transition: string }>({
    transform: "translateX(0px)",
    opacity: 1,
    transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease",
  });

  useEffect(() => {
    const offset = slideDirection === "next" ? 92 : -92;
    const enterFrame = window.requestAnimationFrame(() => {
      setContentSlideStyle({
        transform: `translateX(${offset}px)`,
        opacity: 0.96,
        transition: "none",
      });
      animationFrameRef.current = window.requestAnimationFrame(() => {
        setContentSlideStyle({
          transform: "translateX(0px)",
          opacity: 1,
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease",
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(enterFrame);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [selectedDateKey, slideDirection]);

  const resetSwipeStart = () => {
    swipeStartRef.current = null;
  };

  const handleDatePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDatePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    resetSwipeStart();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (deltaX < 0 && canMoveForward) {
      onMoveForward();
      return;
    }
    if (deltaX > 0 && canMoveBackward) {
      onMoveBackward();
    }
  };

  return (
    <div className="space-y-3">
      <div className="select-none" onPointerDown={handleDatePointerDown} onPointerUp={handleDatePointerUp} onPointerCancel={resetSwipeStart} />
      <div className="space-y-3" style={contentSlideStyle}>
        {shouldShowSection("pending") ? <section className="rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <HomeReservationSectionHeader title={ownerHomeCopy.pendingSectionTitle} dotClassName="bg-[#c79a37]" expanded={expandedSections.pending} onToggle={() => toggleSection("pending")} />
          {expandedSections.pending ? (
            <div className="max-h-64 overflow-y-auto pr-1">
              <div className="space-y-3">
                {pendingAppointments.length === 0 ? (
                  <EmptyState compact className="min-h-[76px] bg-[#f8fafc]" title={ownerHomeCopy.pendingSectionEmpty} />
                ) : (
                  pendingGroups.map((group) => {
                    const isTimeGroup = group.items.length > 1;
                    return (
                    <div key={`pending-${group.time}`} className="space-y-2">
                      {isTimeGroup ? <AppointmentTimeGroupHeader time={group.time} count={group.items.length} label="동시간 요청" /> : null}
                      <div className="space-y-2">
                        {group.items.map((appointment, index) => (
                          <PendingApprovalCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} staffName={appointment.staff_id ? staffMap[appointment.staff_id]?.name ?? "담당 미확인" : "미배정"} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(payload) => { setOpenRejectAppointmentId(null); onPendingUpdate(appointment.id, payload); }} isRejectOpen={openRejectAppointmentId === appointment.id} onRejectOpen={() => setOpenRejectAppointmentId(appointment.id)} onRejectClose={() => setOpenRejectAppointmentId(null)} hideTime={isTimeGroup} sequenceLabel={isTimeGroup ? `요청 ${index + 1}` : undefined} />
                        ))}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </section> : null}
        {shouldShowSection("current") ? <section className="rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <HomeReservationSectionHeader title={ownerHomeCopy.currentSectionTitle} dotClassName="bg-[var(--accent)]" expanded={expandedSections.current} onToggle={() => toggleSection("current")} />
          {expandedSections.current ? (
            <div className="max-h-[29rem] overflow-y-auto pr-1">
              <div className="space-y-3">
                {currentAppointments.length === 0 ? (
                  <EmptyState compact className="min-h-[76px] bg-[#f8fafc]" title={ownerHomeCopy.currentSectionEmpty} />
                ) : (
                  currentGroups.map((group) => {
                    const isTimeGroup = group.items.length > 1;
                    return (
                    <div key={`current-${group.time}`} className="space-y-2">
                      {isTimeGroup ? <AppointmentTimeGroupHeader time={group.time} count={group.items.length} label="동시간 확정" /> : null}
                      <div className="space-y-2">
                        {group.items.map((appointment) => (
                          <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} onStartWithoutPhoto={() => onStartWithoutPhoto(appointment.id)} onStartWithPhoto={(file) => onStartWithPhoto(appointment.id, file)} allowSwipeCancel />
                        ))}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </section> : null}
        {shouldShowSection("cancelChange") ? <section className="rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <HomeReservationSectionHeader title={ownerHomeCopy.statCancelChange} dotClassName="bg-[#b76d7b]" expanded={expandedSections.cancelChange} onToggle={() => toggleSection("cancelChange")} />
          {expandedSections.cancelChange ? (
            <div className="max-h-64 overflow-y-auto pr-1">
              <div className="space-y-3">
                {cancelChangeAppointments.length === 0 ? (
                  <EmptyState compact className="min-h-[76px] bg-[#f8fafc]" title="취소·변경 내역이 없어요" />
                ) : (
                  cancelChangeGroups.map((group) => {
                    const isTimeGroup = group.items.length > 1;
                    return (
                    <div key={`cancel-change-${group.time}`} className="space-y-2">
                      {isTimeGroup ? <AppointmentTimeGroupHeader time={group.time} count={group.items.length} label="동시간 취소·변경" /> : null}
                      <div className="space-y-2">
                        {group.items.map((appointment) => (
                          <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} allowSwipeCancel />
                        ))}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </section> : null}
        {shouldShowSection("completed") ? <section className="rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <HomeReservationSectionHeader title={ownerHomeCopy.historySectionTitle} dotClassName="bg-[#8c98aa]" expanded={expandedSections.completed} onToggle={() => toggleSection("completed")} />
          {expandedSections.completed ? (
            <div className="space-y-2.5">
              {completedAppointments.length === 0 ? <EmptyState compact className="min-h-[76px] bg-[#f8fafc]" title={ownerHomeCopy.historySectionEmpty} /> : completedAppointments.map((appointment) => <CompletedAppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} staffName={appointment.staff_id ? staffMap[appointment.staff_id]?.name ?? "담당 미확인" : "미배정"} latestNotification={latestNotificationByAppointmentId.get(appointment.id) ?? null} onClick={() => onOpenAppointment(appointment)} />)}
            </div>
          ) : null}
        </section> : null}
      </div>
    </div>
  );
}


function CompletedReservationsContent({ historyAppointments, petMap, guardianMap, serviceMap, staffMap, latestNotificationByAppointmentId, onOpenAppointment }: { historyAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, BootstrapPayload["guardians"][number]>; serviceMap: Record<string, Service>; staffMap?: Record<string, BootstrapPayload["staffMembers"][number]>; latestNotificationByAppointmentId?: Map<string, BootstrapPayload["notifications"][number]>; onOpenAppointment: (appointment: Appointment) => void; }) {
  return <div className="overflow-hidden rounded-[10px] border border-[#e1e7ef] bg-white p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#94a3b8]" /><div className="mb-2.5"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.historySectionTitle}</h3></div><div className="space-y-2.5">{historyAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.historySectionEmpty} /> : historyAppointments.map((appointment) => <CompletedAppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} staffName={appointment.staff_id ? staffMap?.[appointment.staff_id]?.name ?? "담당 미확인" : "미배정"} latestNotification={latestNotificationByAppointmentId?.get(appointment.id) ?? null} onClick={() => onOpenAppointment(appointment)} />)}</div></div>;
}

function CompletedAppointmentRow({ appointment, pet, guardian, service, staffName, latestNotification, onClick }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; staffName?: string; latestNotification?: BootstrapPayload["notifications"][number] | null; onClick: () => void }) {
  const notificationMeta = getNotificationResultMeta(latestNotification ?? null);
  return (
    <button onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 rounded-[12px] border border-[#e1e7ef] bg-white px-[14px] py-[10px] text-left transition hover:bg-[#f8fafc]">
      <div className="min-w-[42px] text-[15px] font-normal leading-none tracking-[-0.01em] text-[#0f172a]">{formatClockTime(appointment.appointment_time)}</div>
      <div className="h-6 w-px shrink-0 bg-[#e1e7ef]" />
      <AppointmentMonogram name={pet.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[16px] font-normal leading-[20px] tracking-[-0.02em] text-[#0f172a]">{pet.name}</p>
          <span className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">{guardian.name}</span>
        </div>
        <p className="truncate text-[13px] font-normal leading-[17px] text-[#64748b]">{service.name} {ownerHomeCopy.separator} {staffName ?? "미배정"}</p>
        {latestNotification ? <span className={`mt-1 inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium ${notificationMeta.className}`}>{notificationMeta.label}</span> : null}
      </div>
      <AppointmentListTrailing status="completed" />
    </button>
  );
}

function HomeConfirmedCard({ appointment, pet, guardian, service, saving, onOpen, onStatusChange, onStartWithoutPhoto, onStartWithPhoto, allowSwipeCancel = false }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; saving: boolean; onOpen: () => void; onStatusChange: (status: AppointmentStatus) => void; onStartWithoutPhoto?: () => void; onStartWithPhoto?: (file: File) => void; allowSwipeCancel?: boolean; }) {
  const actionWidth = 96;
  const snapThreshold = 48;
  const beforePhotoInputId = useId();
  const [startX, setStartX] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const translateXRef = useRef(0);
  const isDragging = startX !== null;
  const actionVisible = allowSwipeCancel && (isDragging || translateX !== 0);
  const rollbackStatus = appointment.status === "cancelled" ? "confirmed" : null;
  const rollbackLabel = appointment.status === "cancelled" ? "\uCDE8\uC18C/\uBCC0\uACBD \uCCA0\uD68C" : null;
  const updateTranslateX = (next: number) => {
    translateXRef.current = next;
    setTranslateX(next);
  };
  const closeSwipe = () => updateTranslateX(0);

  const requestCancel = () => {
    if (saving) return;
    setShowCancelConfirm(true);
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    closeSwipe();
    onStatusChange("cancelled");
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowSwipeCancel || saving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setStartX(event.clientX);
    setDragStartX(translateXRef.current);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowSwipeCancel || startX === null || saving) return;
    const diff = event.clientX - startX;
    const next = Math.min(0, Math.max(-actionWidth, dragStartX + diff));
    updateTranslateX(next);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowSwipeCancel) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    updateTranslateX(translateXRef.current <= -snapThreshold ? -actionWidth : 0);
    setStartX(null);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-[10px] border border-[var(--border)] bg-transparent">
        <div
          className={`absolute inset-y-0 right-0 overflow-hidden rounded-r-[12px] transition-all duration-200 ${actionVisible ? "w-24 opacity-100" : "w-0 opacity-0"}`}
        >
          <button
            type="button"
            className="flex h-full w-24 flex-col items-center justify-center gap-1 bg-[#a86957] text-white disabled:cursor-not-allowed disabled:opacity-70"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              requestCancel();
            }}
            disabled={saving}
          >
            <span className="text-[18px] leading-none">←</span>
            <span className="text-sm font-semibold">{ownerHomeCopy.slideCancel}</span>
            <span className="text-[11px] font-medium text-white/80">한 번 더 확인</span>
          </button>
        </div>

        <div
          className={`relative rounded-[10px] bg-[var(--surface)] transition-transform ${isDragging ? "duration-75" : "duration-200"}`}
          style={{ transform: `translateX(${translateX}px)`, touchAction: allowSwipeCancel ? "pan-y" : "auto" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={isDragging ? handlePointerUp : undefined}
        >
          <button
            onClick={() => {
              if (translateX !== 0) {
                closeSwipe();
                return;
              }
              onOpen();
            }}
            className="flex w-full items-center justify-between gap-3 px-3.5 pb-1.5 pt-2.5 text-left"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="min-w-[56px] text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">
                {formatClockTime(appointment.appointment_time)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-normal leading-6 tracking-[-0.02em] text-[var(--text)]">
                  <span className="font-medium">{pet.name}</span>
                  <span className="text-[#8f8a83]"> {ownerHomeCopy.separator} {guardian.name} {ownerHomeCopy.separator} {service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}</span>
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#b8b2aa]" strokeWidth={1.9} />
          </button>

          <div
            className="px-3.5 pb-2.5 pt-1"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onPointerCancel={(event) => event.stopPropagation()}
          >
            <div className="flex items-center">
              {appointment.status === "confirmed" && (
                <div className="grid w-full grid-cols-[1.15fr_0.85fr] gap-2">
                  <ActionButton className="!h-[40px] !rounded-[14px] !px-3 !text-[16px]" variant="ghost" onClick={onStartWithoutPhoto ?? (() => onStatusChange("in_progress"))} disabled={saving}>촬영없이 시작</ActionButton>
                  {onStartWithPhoto ? (
                    <>
                      <input
                        id={beforePhotoInputId}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        disabled={saving}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) onStartWithPhoto(file);
                        }}
                      />
                      <label
                        htmlFor={beforePhotoInputId}
                        className={`flex h-[40px] w-full items-center justify-center rounded-[14px] border border-[#d7e7e1] px-3 text-[16px] font-semibold tracking-[-0.01em] text-white shadow-[0_8px_18px_rgba(47,120,102,0.14)] transition ${
                          saving ? "pointer-events-none bg-[#8da9a2] opacity-50" : "bg-[#2f7866] active:scale-[0.99]"
                        }`}
                      >
                        촬영
                      </label>
                    </>
                  ) : (
                    <ActionButton className="!h-[40px] !rounded-[14px] !px-3 !text-[16px]" variant="accentSoft" onClick={() => onStatusChange("in_progress")} disabled={saving}>촬영</ActionButton>
                  )}
                </div>
              )}
              {appointment.status === "in_progress" && <ActionButton className="w-full !h-[40px] !rounded-[14px] !px-5 !text-[14px]" onClick={() => onStatusChange("almost_done")} variant="warm" disabled={saving}>{ownerHomeCopy.pickupReady}</ActionButton>}
              {appointment.status === "almost_done" && <ActionButton className="w-full !h-[40px] !rounded-[14px] !px-5 !text-[14px]" onClick={() => onStatusChange("completed")} variant="complete" disabled={saving}>{ownerHomeCopy.groomingComplete}</ActionButton>}
              {rollbackStatus && rollbackLabel && <ActionButton className="w-full !h-[40px] !rounded-[14px] !px-5 !text-[14px]" onClick={() => onStatusChange(rollbackStatus)} variant="ghost" disabled={saving}>{rollbackLabel}</ActionButton>}
            </div>
            {appointment.status === "completed" && <div className="w-full rounded-[10px] border border-[#dce8e3] bg-[#f4faf7] px-4 py-3 text-center text-sm font-semibold text-[var(--accent)]">{ownerHomeCopy.completedNotice}</div>}
          </div>
        </div>
      </div>

      {showCancelConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/28 px-5" onClick={() => { setShowCancelConfirm(false); closeSwipe(); }}>
          <div className="w-full max-w-[320px] rounded-[24px] border border-[var(--border)] bg-white px-5 py-5 shadow-[0_18px_44px_rgba(35,35,31,0.18)]" onClick={(event) => event.stopPropagation()}>
            <p className="text-[19px] font-semibold tracking-[-0.03em] text-[var(--text)]">예약 취소하시겠습니까?</p>
            <p className="mt-2 text-[14px] leading-6 text-[var(--muted)]">취소 처리 후에는 취소·변경 내역에서 확인할 수 있어요.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <ActionButton variant="ghost" onClick={() => { setShowCancelConfirm(false); closeSwipe(); }} disabled={saving}>아니오</ActionButton>
              <ActionButton onClick={confirmCancel} disabled={saving}>예</ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MobilePhotoStatusSheet({
  action,
  uploading,
  onClose,
  onSkip,
  onSubmit,
}: {
  action: MobilePhotoStatusAction;
  uploading: boolean;
  onClose: () => void;
  onSkip: () => void;
  onSubmit: (file: File) => void;
}) {
  const inputId = `mobile-photo-status-${action.appointmentId}`;
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!action.autoOpenCamera || uploading) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.click();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [action.appointmentId, action.autoOpenCamera, uploading]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/35 px-3 pb-3 pt-10" onClick={onClose}>
      <div
        className="w-full rounded-[22px] border border-[var(--border)] bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#d7dce2]" />
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[var(--border)] bg-[#f8fafc] text-[var(--text)]">
            <Camera className="h-5 w-5" strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[20px] font-medium tracking-[-0.03em] text-[var(--text)]">{action.title}</h3>
            <p className="mt-1 text-[14px] leading-6 text-[var(--muted)]">{action.description}</p>
          </div>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onSubmit(file);
          }}
        />
        <div className="mt-5 grid gap-2">
          <ActionButton variant="ghost" onClick={onClose} disabled={uploading}>
            취소
          </ActionButton>
          <label
            htmlFor={inputId}
            className={`flex h-[52px] items-center justify-center rounded-[16px] px-4 text-[15px] font-semibold tracking-[-0.02em] text-white transition ${
              uploading ? "pointer-events-none bg-[#a8b7b3]" : "bg-[var(--accent)] active:scale-[0.99]"
            }`}
          >
            {uploading ? "업로드 중" : action.buttonLabel}
          </label>
          <button
            type="button"
            onClick={onSkip}
            disabled={uploading}
            className="h-[48px] rounded-[16px] border border-[var(--border)] bg-white px-4 text-[15px] font-medium text-[var(--muted)] transition active:scale-[0.99] disabled:opacity-60"
          >
            {action.skipLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectionReasonEditor({ template, customReason, onTemplateChange, onCustomReasonChange }: { template: "" | (typeof rejectionReasonTemplates)[number]; customReason: string; onTemplateChange: (value: "" | (typeof rejectionReasonTemplates)[number]) => void; onCustomReasonChange: (value: string) => void }) {
  return (
    <div className="mt-2 space-y-2">
      <select className="field" value={template} onChange={(event) => onTemplateChange(event.target.value as "" | (typeof rejectionReasonTemplates)[number])}>
        <option value="">사유를 선택해주세요</option>
        {rejectionReasonTemplates.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      {template === "기타 직접 입력" && <input className="field" value={customReason} onChange={(event) => onCustomReasonChange(event.target.value)} placeholder="고객에게 보낼 사유를 입력해 주세요" />}
    </div>
  );
}


function GuardianPetEditorCard({ pet, saving, isBirthdayToday, isSelected, onSelect, onSave, onSendBirthday, onSendRevisit }: { pet: Pet; saving: boolean; isBirthdayToday: boolean; isSelected: boolean; onSelect: () => void; onSave: (name: string, breed: string, birthday: string | null) => void; onSendBirthday: () => void; onSendRevisit: () => void }) {
  const [name, setName] = useState(pet.name);
  const [breed, setBreed] = useState(pet.breed);
  const [birthday, setBirthday] = useState(pet.birthday ?? "");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setName(pet.name);
      setBreed(pet.breed);
      setBirthday(pet.birthday ?? "");
      setIsEditing(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pet.birthday, pet.breed, pet.name]);

  const summary = [breed, birthday ? `생일 ${birthday}` : null, isBirthdayToday ? "오늘 생일" : null].filter(Boolean).join(" · ");
  const handleSelectKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full cursor-pointer items-start justify-between gap-3 bg-white px-3.5 py-3 text-left transition hover:bg-[#fffdfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25"
        onClick={onSelect}
        onKeyDown={handleSelectKeyDown}
        aria-pressed={isSelected}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[16px] font-medium leading-5 tracking-[-0.02em] text-[var(--text)]">{pet.name}</p>
          </div>
          {summary ? <p className="mt-0.5 text-[14px] leading-5 text-[var(--muted)]">{summary}</p> : null}
        </div>
        <div className="shrink-0">
          <button
            type="button"
            className="text-[14px] font-medium leading-5 text-[var(--accent)]"
            onClick={(event) => {
              event.stopPropagation();
              setIsEditing((prev) => !prev);
            }}
          >
            {isEditing ? "닫기" : "수정"}
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="border-t border-[var(--border)] px-3.5 py-3">
          <div className="grid grid-cols-2 gap-2">
            <PetDetailInputField label="아기 이름">
              <input className="field !h-[40px] !rounded-[10px] !px-3 !py-2 text-[16px] tracking-[-0.02em]" value={name} onChange={(event) => setName(event.target.value)} />
            </PetDetailInputField>
            <PetDetailInputField label="견종">
              <input className="field !h-[40px] !rounded-[10px] !px-3 !py-2 text-[16px] tracking-[-0.02em]" value={breed} onChange={(event) => setBreed(event.target.value)} />
            </PetDetailInputField>
            <div className="col-span-2">
              <PetDetailInputField label="생일">
                <input className="field !h-[40px] !rounded-[10px] !px-3 !py-2 text-[16px] tracking-[-0.02em]" type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} />
              </PetDetailInputField>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={saving}
              className="text-[14px] font-medium text-[var(--muted)] disabled:opacity-45"
              onClick={() => {
                setName(pet.name);
                setBreed(pet.breed);
                setBirthday(pet.birthday ?? "");
                setIsEditing(false);
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(name.trim(), breed.trim(), birthday || null);
                setIsEditing(false);
              }}
              disabled={saving || !name.trim() || !breed.trim()}
              className="text-[14px] font-medium text-[var(--accent)] disabled:opacity-45"
            >
              정보 저장
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] px-3.5 py-2">
          <button
            type="button"
            onClick={onSendRevisit}
            disabled={saving}
            className="text-[14px] font-medium text-[var(--accent)] disabled:opacity-45"
          >
            재방문 알림
          </button>
          {birthday ? (
            <button
              type="button"
              onClick={onSendBirthday}
              disabled={saving}
              className="text-[14px] font-medium text-[var(--muted)] disabled:opacity-45"
            >
              생일 축하 문자
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}



























