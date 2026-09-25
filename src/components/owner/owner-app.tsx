"use client";

import { CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, ExternalLink, House, LoaderCircle, PawPrint, Plus, QrCode, Settings, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

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
  CustomerEmptyState,
  CustomerMetricCard,
  InfoItem,
  NotificationHistoryRow,
  QuickContactRow,
  ShopAvatar,
  UrgencyPill,
} from "@/components/owner/owner-customer-detail-ui";
import CustomerDeleteSelectionPanel from "@/components/owner/customer-delete-selection-panel";
import OwnerCustomerListToolbar from "@/components/owner/owner-customer-list-toolbar";
import OwnerBookingDatePicker from "@/components/owner/owner-booking-date-picker";
import OwnerBookingDaySchedule from "@/components/owner/owner-booking-day-schedule";
import OwnerExternalPhotoSheet from "@/components/owner/owner-external-photo-sheet";
import OwnerHomeDateNavigator from "@/components/owner/owner-home-date-navigator";
import OwnerAiCareReportSheet, { createOwnerCareReportImmediateData, normalizeCareReport, type OwnerCareReportInitialData } from "@/components/owner/owner-ai-care-report-sheet";
import { readOwnerCareReportLocalDraft } from "@/lib/care-report/owner-care-report-local-draft";
import OwnerContextActionMenu from "@/components/owner/owner-context-action-menu";
import OwnerMobileGroomingStartSheet from "@/components/owner/owner-mobile-grooming-start-sheet";
import OwnerAppUpdateCoordinator from "@/components/owner/owner-app-update";
import OwnerSettingsPanel from "@/components/owner/owner-settings-panel";
import OwnerTesterFeedbackSheet from "@/components/owner/owner-tester-feedback-sheet";
import { StaffProfilePhoto } from "@/components/owner/staff-profile-photo";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { StatusBadge as AppStatusBadge } from "@/components/ui/status-badge";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  assertOwnerAppointmentCreateReadback,
  createOwnerAppointmentCreateGate,
  mergeOwnerAppointmentCreateReadback,
} from "@/lib/appointments/owner-appointment-create";
import { createOwnerStatusMutationGate } from "@/lib/appointments/owner-status-mutation-gate";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { withOwnerMobileTimeout } from "@/lib/owner-mobile-startup";
import { computeAvailableSlots, revisitInfo } from "@/lib/availability";
import { concurrentCapacityForApprovalMode } from "@/lib/booking-slot-settings";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { createOwnerMediaAssetFromFile, type MediaAssetListItem, type MediaAssetListResponse } from "@/lib/media/owner-media-client";
import {
  isOwnerMediaItemBoundToAppointment,
  mergeOwnerMediaPreviews,
  type OwnerMediaBinding,
  type OwnerMediaPreview,
} from "@/lib/media/owner-media-durability";
import { traceOwnerMediaStep } from "@/lib/media/owner-media-timing";
import {
  clearPendingOwnerStatusPhoto,
  createPendingOwnerStatusPhoto,
  isPendingDurableAssetReusable,
  isPendingOwnerStatusPhotoExactBinding,
  markPendingOwnerStatusPhotoDurable,
  markPendingOwnerStatusPhotoUploadStarted,
  pendingOwnerStatusPhotoToFile,
  readPendingOwnerStatusPhoto,
  readPendingOwnerStatusPhotos,
  writePendingOwnerStatusPhoto,
  type PendingOwnerStatusPhoto,
  type PendingOwnerStatusPhotoBinding,
} from "@/lib/media/owner-pending-status-photo";
import { createOwnerMobileBackgroundRefreshGate } from "@/lib/owner-mobile-background-refresh";
import { DEFAULT_REVISIT_REMINDER_DAYS } from "@/lib/notification-settings";
import { canUseExternalCameraApps, captureWithAndroidCameraApp } from "@/lib/media/external-camera";
import { ownerHomeCopy } from "@/lib/owner-home-copy";
import { getStaffScheduleAvailability, getStaffScheduleIdentityTone, shouldRenderStaffScheduleLane } from "@/lib/staff-schedule-identity";
import { getTodayBookingCustomerGradeLabel } from "@/lib/today-booking-customer-grade";
import { canUseTesterFeedback, resolveTesterFeedbackAppVersion, type TesterFeedbackCategory, type TesterFeedbackScreenKey } from "@/lib/tester-feedback";
import { sharedOwnerFeedbackAdapter } from "@/lib/owner-feedback-adapter";
import { getMobileGroomingStartTiming } from "@/lib/mobile-grooming-start-policy";
import { matchesCanonicalCustomerFilter, type OwnerCustomerFilter } from "@/lib/owner-customer-filter";
import {
  ownerAppointmentVisitWeightTransport,
  type OwnerAppointmentVisitWeightTransport,
} from "@/lib/owner-appointment-visit-weight";
import { keepStableStaffProfileUrls } from "@/lib/owner-mobile-staff-refresh-stability";
import { addOwnerAndroidBackButtonListener, exitOwnerAndroidApp, shouldExitOwnerApp } from "@/lib/owner-mobile-back-navigation";
import { flattenAppointmentGuardianPetPairs } from "@/lib/owner-appointment-guardian-pet-pairs";
import {
  dedupeAuthoritativeAppointments,
  getOwnerTodayQuickDates,
  getOwnerTodaySlideDirection,
  shouldApplyOwnerMobileRefresh,
} from "@/lib/owner-mobile-today";
import { ownerTodayCareReportFollowupKey, selectOwnerTodayCareReportFollowups } from "@/lib/owner-today-care-report-followup";
import {
  indexTodayPetDisplayPhotosByAppointmentId,
  resolveTodayAppointmentPetDisplayPhoto,
} from "@/lib/owner-today-pet-display-photo";
import {
  assertCurrentShopEntities,
  assertCurrentShopEntity,
  createGuardianAndPets,
} from "@/lib/owner-customer-pet-integrity";
import {
  OWNER_PUSH_RECEIVED_EVENT,
  type OwnerPushReceivedEventDetail,
} from "@/lib/push/owner-push-notifications";
import { addDate, cn, currentDateInTimeZone, currentMinutesInTimeZone, formatClockTime, minutesFromTime, phoneNormalize, shortDate, won } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload, BootstrapStaffMember, GroomingRecord, MediaKind, Pet, Service } from "@/types/domain";

type TabKey = "home" | "book" | "customers" | "settings";
type CustomerDetailTab = "pets" | "records" | "notifications";
type SettingsEntryScreen = "shop" | "closures" | "notifications" | "appNotifications" | "appPermissions" | "staff" | "support" | "legal" | "account" | null;
type OwnerGuideScreen = "getting-started" | null;
type MobileAppRole = "owner" | "staff";
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
type CustomerEditableField = "name" | "phone" | "pet" | "memo";
type AppointmentStatusUpdatePayload = {
  status: AppointmentStatus;
  rejectionReasonTemplate?: string;
  rejectionReasonCustom?: string;
  mediaAssetIds?: string[];
};
type AppointmentEditPayload = {
  mode: "edit";
  serviceId: string;
  appointmentDate: string;
  appointmentTime: string;
  staffMemo: string;
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
  | { type: "stat"; kind: "today" | "completed" | "cancel_change" }
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
  allowSkip?: boolean;
};
type MobileGroomingStartAction = {
  appointmentId: string;
  stage: "early-confirm" | "choices";
  requestedMode?: "photo" | "without-photo";
};
export type OwnerMobileLaunchPhotoStatusAction = {
  appointmentId: string;
  statusAction: Extract<AppointmentStatus, "in_progress" | "completed">;
  autoOpenCamera?: boolean;
};
type AppointmentMediaPreview = OwnerMediaPreview;
type SignedMediaUrlResponse = {
  signedUrl: string;
  expiresInSeconds: number;
};
type SignedMediaUrlsResponse = {
  items: Array<SignedMediaUrlResponse & { mediaAssetId?: string }>;
};

function createMobilePhotoStatusAction(
  appointmentId: string,
  status: Extract<AppointmentStatus, "in_progress" | "completed">,
  autoOpenCamera = false,
  allowSkip = true,
): MobilePhotoStatusAction {
  return {
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
    allowSkip,
  };
}

function resolvePendingMobilePhotoBinding(
  data: BootstrapPayload,
  action: MobilePhotoStatusAction,
): PendingOwnerStatusPhotoBinding | null {
  const appointment = data.appointments.find((item) => item.id === action.appointmentId);
  const expectedMediaKind = action.nextStatus === "in_progress" ? "grooming_before" : "grooming_after";
  if (
    !appointment ||
    appointment.shop_id !== data.shop.id ||
    action.mediaKind !== expectedMediaKind
  ) return null;
  return {
    shopId: data.shop.id,
    appointmentId: appointment.id,
    guardianId: appointment.guardian_id,
    petId: appointment.pet_id,
    mediaKind: action.mediaKind,
    nextStatus: action.nextStatus,
    allowSkip: action.allowSkip !== false,
  };
}

const compactWeekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const settingsEntryScreenTitles: Record<Exclude<SettingsEntryScreen, null>, string> = {
  shop: "매장 기본 정보",
  closures: "영업·예약 시간",
  notifications: "고객 알림톡",
  appNotifications: "내 앱 알림",
  appPermissions: "앱 권한",
  staff: "직원 관리",
  support: "1:1 문의",
  legal: "약관 및 정책",
  account: "계정",
};

const rejectionReasonTemplates = [
  "\uD574\uB2F9 \uC2DC\uAC04 \uC608\uC57D\uC740 \uC5B4\uB824\uC6CC\uC694",
  "\uC2DC\uAC04 \uC870\uC815\uC774 \uD544\uC694\uD574\uC694",
  "\uC624\uB298 \uC608\uC57D \uAC00\uB2A5 \uC778\uC6D0\uC774 \uB9C8\uAC10\uB418\uC5C8\uC5B4\uC694",
  "\uB9E4\uC7A5 \uC0AC\uC815\uC73C\uB85C \uC608\uC57D\uC774 \uC5B4\uB824\uC6CC\uC694",
  "\uAE30\uD0C0 \uC9C1\uC811 \uC785\uB825",
] as const;
const directRejectionReasonTemplate = rejectionReasonTemplates[4];

const statusMeta: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "\uB300\uAE30", color: "#9a6a16", bg: "#fff8eb" },
  confirmed: { label: "\uD655\uC815", color: "#2f6bd4", bg: "#eef4ff" },
  in_progress: { label: "\uBBF8\uC6A9\uC911", color: "#2f6bd4", bg: "#eef4ff" },
  almost_done: { label: "\uD53D\uC5C5 \uC900\uBE44", color: "#4f5d73", bg: "#f3f6fb" },
  completed: { label: "미용 완료", color: "#4f5d73", bg: "#f3f6fb" },
  cancelled: { label: "\uCDE8\uC18C", color: "#8f6658", bg: "#f8efea" },
  rejected: { label: "\uBBF8\uC2B9\uC778", color: "#8f6658", bg: "#f8efea" },
  noshow: { label: "\uB178\uC1FC", color: "#8f6658", bg: "#f8efea" },
};

function matchesHomeStaffFilter(appointment: Appointment, filter: HomeStaffFilterKey) {
  if (filter === "all") return true;
  if (filter === "unassigned") return !appointment.staff_id;
  return appointment.staff_id === filter;
}

function isMissedPendingAppointment(appointment: Appointment, todayKey: string, currentMinutes: number) {
  if (appointment.status !== "pending") return false;
  if (appointment.appointment_date < todayKey) return true;
  if (appointment.appointment_date > todayKey) return false;
  return minutesFromTime(appointment.appointment_time) < currentMinutes;
}

function getAppointmentNotificationLabel(type: BootstrapPayload["notifications"][number]["type"]) {
  switch (type) {
    case "booking_confirmed":
      return "확정 알림";
    case "booking_cancelled":
      return "취소 알림";
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
  { key: "home", label: "오늘", icon: House },
  { key: "book", label: "예약 조회", icon: CalendarDays },
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
  appRole = "owner",
  currentStaffId = null,
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
  appRole?: MobileAppRole;
  currentStaffId?: string | null;
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
  const [isHomeDatePickerOpen, setIsHomeDatePickerOpen] = useState(false);
  const [homeStaffFilter, setHomeStaffFilter] = useState<HomeStaffFilterKey>("all");
  const [homeFocusedSection, setHomeFocusedSection] = useState<HomeReservationSectionKey>("current");
  const [selectedDate, setSelectedDate] = useState(() => currentDateInTimeZone());
  const [selectedGuardianId, setSelectedGuardianId] = useState<string | null>(null);
  const [selectedCustomerPetId, setSelectedCustomerPetId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<OwnerCustomerFilter>("all");
  const [selectedGuardianIds, setSelectedGuardianIds] = useState<string[]>([]);
  const [isCustomerListEditing, setIsCustomerListEditing] = useState(false);
  const [visitDateFilter, setVisitDateFilter] = useState(currentDateInTimeZone());
  const [bookingStaffFilter, setBookingStaffFilter] = useState<HomeStaffFilterKey>(() => initialData.staffMembers[0]?.id ?? "all");
  const [isBookingDatePickerOpen, setIsBookingDatePickerOpen] = useState(false);
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
  const [isTesterFeedbackHubOpen, setIsTesterFeedbackHubOpen] = useState(false);
  const [isOwnerContextMenuOpen, setIsOwnerContextMenuOpen] = useState(false);
  const [feedbackInitialCategory, setFeedbackInitialCategory] = useState<TesterFeedbackCategory>("inquiry");
  const ownerContextMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const settingsFeedbackTriggerRef = useRef<HTMLButtonElement | null>(null);
  const ownerFeedbackReturnFocusRef = useRef<HTMLElement | null>(null);
  const [mobilePhotoStatusAction, setMobilePhotoStatusAction] = useState<MobilePhotoStatusAction | null>(null);
  const [mobileGroomingStartAction, setMobileGroomingStartAction] = useState<MobileGroomingStartAction | null>(null);
  const [mobilePhotoUploading, setMobilePhotoUploading] = useState(false);
  const [mobilePhotoPreviewFile, setMobilePhotoPreviewFile] = useState<File | null>(null);
  const [pendingMobilePhoto, setPendingMobilePhoto] = useState<PendingOwnerStatusPhoto | null>(null);
  const [mobilePhotoRecovered, setMobilePhotoRecovered] = useState(false);
  const [mobilePhotoPreparing, setMobilePhotoPreparing] = useState(false);
  const [careReportAppointmentId, setCareReportAppointmentId] = useState<string | null>(null);
  const [careReportInitialData, setCareReportInitialData] = useState<OwnerCareReportInitialData | null>(null);
  const [careReportLoadingAppointmentId, setCareReportLoadingAppointmentId] = useState<string | null>(null);
  const [careReportEntryError, setCareReportEntryError] = useState<{ appointmentId: string; message: string } | null>(null);
  const careReportOpenInFlightRef = useRef(false);
  const [publishedCareReportFollowupKeys, setPublishedCareReportFollowupKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [settingsEntryScreen, setSettingsEntryScreen] = useState<SettingsEntryScreen>(null);
  const [guideScreen, setGuideScreen] = useState<OwnerGuideScreen>(null);
  const [isShopPickerOpen, setIsShopPickerOpen] = useState(false);
  const [pendingShopProfileEditId, setPendingShopProfileEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerPageOrigin, setOwnerPageOrigin] = useState("");
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const [pushNotice, setPushNotice] = useState<OwnerPushReceivedEventDetail | null>(null);
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
  const pendingPhotoRestoreShopRef = useRef<string | null>(null);
  const pendingPhotoActionRequestRef = useRef(0);
  const mobilePhotoUploadInFlightRef = useRef(false);
  const pushNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newCustomerSaveInFlightRef = useRef(false);
  const refreshRequestIdRef = useRef(0);
  const lastAppliedRefreshRequestIdRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const backgroundRefreshGateRef = useRef(createOwnerMobileBackgroundRefreshGate(60_000));
  const appointmentCreateGateRef = useRef(createOwnerAppointmentCreateGate());
  const statusMutationGateRef = useRef(createOwnerStatusMutationGate());
  const activeTabBackStackRef = useRef<TabKey[]>([]);
  const previousActiveTabRef = useRef<TabKey>(activeTab);
  const restoringBackTabRef = useRef(false);
  const rootBackRequestedAtRef = useRef<number | null>(null);
  const rootBackNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardwareBackHandlerRef = useRef<() => void>(() => {});
  const [rootBackExitNotice, setRootBackExitNotice] = useState(false);

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
      if (pushNoticeTimeoutRef.current) {
        clearTimeout(pushNoticeTimeoutRef.current);
      }
      if (rootBackNoticeTimerRef.current) {
        clearTimeout(rootBackNoticeTimerRef.current);
      }
    };
  }, []);

  const clearRootBackExitNotice = () => {
    rootBackRequestedAtRef.current = null;
    if (rootBackNoticeTimerRef.current) clearTimeout(rootBackNoticeTimerRef.current);
    rootBackNoticeTimerRef.current = null;
    setRootBackExitNotice(false);
  };

  useEffect(() => {
    const previous = previousActiveTabRef.current;
    if (previous !== activeTab) {
      if (restoringBackTabRef.current) {
        restoringBackTabRef.current = false;
      } else {
        activeTabBackStackRef.current = [...activeTabBackStackRef.current.filter((tab) => tab !== previous), previous];
      }
      previousActiveTabRef.current = activeTab;
      rootBackRequestedAtRef.current = null;
      if (rootBackNoticeTimerRef.current) clearTimeout(rootBackNoticeTimerRef.current);
      rootBackNoticeTimerRef.current = null;
      setRootBackExitNotice(false);
    }
  }, [activeTab]);

  hardwareBackHandlerRef.current = () => {
    if (isTesterFeedbackHubOpen) {
      setIsTesterFeedbackHubOpen(false);
      clearRootBackExitNotice();
      return;
    }
    if (isOwnerContextMenuOpen) {
      setIsOwnerContextMenuOpen(false);
      clearRootBackExitNotice();
      return;
    }
    if (mobilePhotoStatusAction) {
      if (mobilePhotoUploading || mobilePhotoPreparing || saving) return;
      pendingPhotoActionRequestRef.current += 1;
      setMobilePhotoPreviewFile(null);
      setPendingMobilePhoto(null);
      setMobilePhotoRecovered(false);
      setMobilePhotoStatusAction(null);
      clearRootBackExitNotice();
      return;
    }
    if (mobileGroomingStartAction) {
      setMobileGroomingStartAction(null);
      clearRootBackExitNotice();
      return;
    }
    if (careReportEntryError) {
      setCareReportEntryError(null);
      clearRootBackExitNotice();
      return;
    }
    if (careReportLoadingAppointmentId) {
      clearRootBackExitNotice();
      return;
    }
    if (careReportAppointmentId) {
      closeCareReport();
      clearRootBackExitNotice();
      return;
    }
    if (modal) {
      setModal(null);
      clearRootBackExitNotice();
      return;
    }
    if (isHomeDatePickerOpen) {
      setIsHomeDatePickerOpen(false);
      clearRootBackExitNotice();
      return;
    }
    if (isBookingDatePickerOpen) {
      setIsBookingDatePickerOpen(false);
      clearRootBackExitNotice();
      return;
    }
    if (isVisitCalendarOpen) {
      setIsVisitCalendarOpen(false);
      clearRootBackExitNotice();
      return;
    }
    if (isShopPickerOpen) {
      setIsShopPickerOpen(false);
      clearRootBackExitNotice();
      return;
    }
    if (settingsEntryScreen) {
      const backRequest = new CustomEvent("owner-mobile-back-request", { cancelable: true });
      window.dispatchEvent(backRequest);
      if (backRequest.defaultPrevented) {
        clearRootBackExitNotice();
        return;
      }
      setSettingsEntryScreen(null);
      clearRootBackExitNotice();
      return;
    }
    if (selectedCustomerPetId || selectedGuardianId) {
      setSelectedCustomerPetId(null);
      setSelectedGuardianId(null);
      clearRootBackExitNotice();
      return;
    }

    const previousTab = activeTabBackStackRef.current.pop();
    if (previousTab) {
      restoringBackTabRef.current = true;
      setActiveTab(previousTab);
      clearRootBackExitNotice();
      return;
    }
    if (activeTab !== "home") {
      restoringBackTabRef.current = true;
      setActiveTab("home");
      clearRootBackExitNotice();
      return;
    }
    if (typeof window !== "undefined" && window.location.pathname !== "/owner/mobile") {
      window.location.replace("/owner/mobile");
      return;
    }

    const now = Date.now();
    if (shouldExitOwnerApp(rootBackRequestedAtRef.current, now)) {
      void exitOwnerAndroidApp();
      return;
    }
    rootBackRequestedAtRef.current = now;
    setRootBackExitNotice(true);
    rootBackNoticeTimerRef.current = setTimeout(clearRootBackExitNotice, 2_000);
  };

  useEffect(() => {
    let disposed = false;
    let removeListener: (() => void | Promise<void>) | null = null;
    void addOwnerAndroidBackButtonListener(() => hardwareBackHandlerRef.current()).then((remove) => {
      if (!remove) return;
      if (disposed) {
        void remove();
        return;
      }
      removeListener = remove;
    });
    return () => {
      disposed = true;
      if (removeListener) void removeListener();
    };
  }, []);
  const isOwnerDemo = isPreviewDemo || data.shop.id === "owner-demo";
  const isStaffApp = appRole === "staff";
  const isTesterFeedback = !isOwnerDemo && !isStaffApp && canUseTesterFeedback(data.pilotCohort);

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

  async function handleRequestError(error: unknown, fallbackMessage: string, forceFallback = false) {
    const rawMessage = error instanceof Error ? error.message : "";
    const nextMessage =
      !forceFallback && rawMessage && !isLikelyCorruptedMessage(rawMessage)
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

  async function copyBookingEntryUrl() {
    try {
      await navigator.clipboard.writeText(bookingEntryUrl);
      setBookingLinkCopied(true);
      if (bookingLinkCopyTimeoutRef.current) clearTimeout(bookingLinkCopyTimeoutRef.current);
      bookingLinkCopyTimeoutRef.current = setTimeout(() => setBookingLinkCopied(false), 1800);
    } catch {
      setError("예약 링크 복사에 실패했습니다.");
    }
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

  function refresh() {
    if (isOwnerDemo) return Promise.resolve();
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const requestId = ++refreshRequestIdRef.current;
    const request = fetchJson<BootstrapPayload>(`/api/bootstrap?shopId=${data.shop.id}`, { cache: "no-store" })
      .then((next) => {
        if (!shouldApplyOwnerMobileRefresh(requestId, lastAppliedRefreshRequestIdRef.current)) return;

        lastAppliedRefreshRequestIdRef.current = requestId;
        const authoritativeSnapshot = {
          ...next,
          appointments: dedupeAuthoritativeAppointments(next.appointments),
        };
        setData((previous) => keepStableStaffProfileUrls(previous, authoritativeSnapshot));
        syncOwnedShopSummary(authoritativeSnapshot.shop);
      });

    refreshInFlightRef.current = request;
    void request.finally(() => {
      if (refreshInFlightRef.current === request) refreshInFlightRef.current = null;
    });
    return request;
  }

  async function refreshSilently() {
    try {
      await refresh();
    } catch {
      // Keep the current screen stable when background sync misses.
    }
  }

  useEffect(() => {
    setData((previous) => keepStableStaffProfileUrls(previous, initialData));
  }, [initialData]);

  useEffect(() => {
    setOwnedShopItems(ownedShops);
  }, [ownedShops]);

  useEffect(() => {
    let active = true;

    const handlePushReceived = (event: Event) => {
      const detail = (event as CustomEvent<OwnerPushReceivedEventDetail>).detail;
      if (detail.shopId && detail.shopId !== data.shop.id) return;

      void (async () => {
        try {
          const next = isOwnerDemo
            ? data
            : await fetchJson<BootstrapPayload>(`/api/bootstrap?shopId=${data.shop.id}`, { cache: "no-store" });
          if (!active) return;

          if (!isOwnerDemo) {
            setData(next);
            setOwnedShopItems((previous) =>
              previous.map((item) =>
                item.id === next.shop.id
                  ? {
                      ...item,
                      name: next.shop.name,
                      address: next.shop.address,
                      heroImageUrl: next.shop.customer_page_settings?.hero_image_url || "",
                    }
                  : item,
              ),
            );
          }

          const appointment = detail.appointmentId
            ? next.appointments.find((item) => item.id === detail.appointmentId)
            : null;

          if (detail.opened) {
            setActiveTab("book");
            setSettingsEntryScreen(null);
            if (appointment) {
              setSelectedDate(appointment.appointment_date);
              setModal({ type: "appointment", appointment });
            }
            return;
          }

          setPushNotice(detail);
          if (pushNoticeTimeoutRef.current) clearTimeout(pushNoticeTimeoutRef.current);
          pushNoticeTimeoutRef.current = setTimeout(() => setPushNotice(null), 5000);
        } catch {
          if (active) setPushNotice(detail);
        }
      })();
    };

    window.addEventListener(OWNER_PUSH_RECEIVED_EVENT, handlePushReceived);
    return () => {
      active = false;
      window.removeEventListener(OWNER_PUSH_RECEIVED_EVENT, handlePushReceived);
    };
  }, [data, isOwnerDemo]);

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
    void openMobilePhotoStatusAction(
      appointment.id,
      launchPhotoStatusAction.statusAction,
      launchPhotoStatusAction.autoOpenCamera ?? true,
    );
  // The imperative opener reads the same appointment snapshot listed here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.appointments, data.shop.id, launchPhotoStatusAction]);

  useEffect(() => {
    if (isOwnerDemo || launchPhotoStatusAction || pendingPhotoRestoreShopRef.current === data.shop.id) return;
    pendingPhotoRestoreShopRef.current = data.shop.id;
    let active = true;
    void readPendingOwnerStatusPhotos(data.shop.id).then((pendingItems) => {
      if (!active) return;
      for (const pending of pendingItems) {
        const appointment = data.appointments.find((item) => item.id === pending.appointmentId);
        if (!appointment) continue;
        const action = createMobilePhotoStatusAction(
          appointment.id,
          pending.nextStatus,
          false,
          pending.allowSkip,
        );
        const binding = resolvePendingMobilePhotoBinding(data, action);
        if (!binding || !isPendingOwnerStatusPhotoExactBinding(pending, binding)) continue;
        try {
          const file = pendingOwnerStatusPhotoToFile(pending);
          setModal(null);
          setMobilePhotoStatusAction(action);
          setPendingMobilePhoto(pending);
          setMobilePhotoPreviewFile(file);
          setMobilePhotoRecovered(true);
          break;
        } catch {
          // A corrupt local record is ignored and never attached to another booking.
        }
      }
    }).catch(() => {
      // IndexedDB can be unavailable in private or restricted browsing contexts.
    });
    return () => { active = false; };
  }, [data, isOwnerDemo, launchPhotoStatusAction]);

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
  const serviceMap = useMemo(() => Object.fromEntries(data.services.map((item) => [item.id, item])), [data.services]);
  const guardianMap = useMemo(() => Object.fromEntries(data.guardians.map((item) => [item.id, item])), [data.guardians]);
  const petMap = useMemo(() => Object.fromEntries(data.pets.map((item) => [item.id, item])), [data.pets]);
  const staffMap = useMemo(() => Object.fromEntries(data.staffMembers.map((item) => [item.id, item])), [data.staffMembers]);
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

  const currentHomeMinutes = currentMinutesInTimeZone();
  const homeWorkDateKey = homeReservationDate;
  const recordCompletedAppointmentIds = useMemo(
    () => new Set(data.groomingRecords.map((record) => record.appointment_id).filter(Boolean)),
    [data.groomingRecords],
  );
  const homeConfirmedAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === homeWorkDateKey && ["confirmed", "in_progress", "almost_done", "completed", "cancelled"].includes(item.status)), [data.appointments, homeWorkDateKey]);
  const homeMissedPendingAppointments = useMemo(
    () =>
      data.appointments
        .filter((item) => item.appointment_date === homeWorkDateKey && isMissedPendingAppointment(item, todayDate, currentHomeMinutes))
        .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)),
    [currentHomeMinutes, data.appointments, homeWorkDateKey, todayDate],
  );
  const homeActionAppointments = useMemo(
    () =>
      homeConfirmedAppointments
        .filter((item) => ["confirmed", "in_progress", "almost_done"].includes(item.status) && !recordCompletedAppointmentIds.has(item.id))
        .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)),
    [homeConfirmedAppointments, recordCompletedAppointmentIds],
  );
  const homeHistoryAppointments = useMemo(
    () =>
      [...homeConfirmedAppointments.filter((item) => item.status === "completed" || recordCompletedAppointmentIds.has(item.id)), ...homeMissedPendingAppointments].sort((a, b) =>
        a.appointment_time.localeCompare(b.appointment_time),
      ),
    [homeConfirmedAppointments, homeMissedPendingAppointments, recordCompletedAppointmentIds],
  );
  const homeCompletedHistoryAppointments = useMemo(() => homeHistoryAppointments, [homeHistoryAppointments]);
  const homeCancelChangeAppointments = useMemo(() => homeConfirmedAppointments.filter((item) => item.status === "cancelled"), [homeConfirmedAppointments]);
  const homeCareReportFollowupAppointments = useMemo(
    () => selectOwnerTodayCareReportFollowups({
      appointments: data.appointments,
      groomingRecords: data.groomingRecords,
      shopId: data.shop.id,
      dateKey: homeWorkDateKey,
      hiddenFollowupKeys: publishedCareReportFollowupKeys,
    }),
    [data.appointments, data.groomingRecords, data.shop.id, homeWorkDateKey, publishedCareReportFollowupKeys],
  );
  const homeWorkAppointments = useMemo(
    () => [...homeActionAppointments, ...homeCompletedHistoryAppointments],
    [homeActionAppointments, homeCompletedHistoryAppointments],
  );
  const homeStaffFilterOptions = useMemo(() => {
    const options: Array<{
      key: HomeStaffFilterKey;
      label: string;
      count: number;
      profileImageUrl?: string | null;
      profileImageFallbackKey?: string | null;
    }> = [
      { key: "all", label: "전체 담당자", count: homeWorkAppointments.length },
      ...data.staffMembers
        .map((staffMember) => ({
          key: staffMember.id,
          label: staffMember.name,
          count: homeWorkAppointments.filter((appointment) => appointment.staff_id === staffMember.id).length,
          profileImageUrl: staffMember.profileImageUrl,
          profileImageFallbackKey: staffMember.profileImageFallbackKey,
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
  const matchesHomeRoleScope = (appointment: Appointment) => {
    if (!isStaffApp) return true;
    if (!currentStaffId) return true;
    return appointment.staff_id === currentStaffId;
  };
  const filteredHomeActionAppointments = useMemo(
    () =>
      homeActionAppointments.filter(
        (appointment) => matchesHomeRoleScope(appointment) && (!isStaffApp ? matchesHomeStaffFilter(appointment, homeStaffFilter) : true),
      ),
    [currentStaffId, homeActionAppointments, homeStaffFilter, isStaffApp],
  );
  const filteredHomeCompletedHistoryAppointments = useMemo(
    () =>
      homeCompletedHistoryAppointments.filter(
        (appointment) => matchesHomeRoleScope(appointment) && (!isStaffApp ? matchesHomeStaffFilter(appointment, homeStaffFilter) : true),
      ),
    [currentStaffId, homeCompletedHistoryAppointments, homeStaffFilter, isStaffApp],
  );
  const filteredHomeCareReportFollowupAppointments = homeCareReportFollowupAppointments.filter(
    (appointment) => matchesHomeRoleScope(appointment) && (!isStaffApp ? matchesHomeStaffFilter(appointment, homeStaffFilter) : true),
  );
  const filteredHomeCancelChangeAppointments = useMemo(
    () =>
      homeCancelChangeAppointments.filter(
        (appointment) => matchesHomeRoleScope(appointment) && (!isStaffApp ? matchesHomeStaffFilter(appointment, homeStaffFilter) : true),
      ),
    [currentStaffId, homeCancelChangeAppointments, homeStaffFilter, isStaffApp],
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
  const selectHomeReservationDate = (nextDate: string) => {
    setHomeReservationSlideDirection(getOwnerTodaySlideDirection(homeReservationDate, nextDate));
    setHomeReservationDate(nextDate);
    void refreshSilently();
  };

  const moveHomeReservationDate = (direction: "prev" | "next") => {
    selectHomeReservationDate(addDate(homeReservationDate, direction === "prev" ? -1 : 1));
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
      hasCanonicalFirstVisit: data.appointments.some(
        (appointment) => appointment.guardian_id === guardian.id && appointment.customer_visit_type === "first_visit",
      ),
    };
  }), [data.guardians, data.pets, data.groomingRecords, data.appointments, petMap, serviceMap, revisitRows, todayDate]);

  const searchableCustomerSummaries = useMemo(() => {
    const query = customerSearch.trim();
    return customerSummaries
      .filter((summary) => {
        return (
          !query ||
          summary.guardian.name.includes(query) ||
          (!isStaffApp && summary.guardian.phone.includes(query)) ||
          summary.pets.some((pet) => pet.name.includes(query) || pet.breed.includes(query))
        );
      })
      .sort((a, b) => (b.latestActivityAt ?? "").localeCompare(a.latestActivityAt ?? "") || a.guardian.name.localeCompare(b.guardian.name, "ko-KR"));
  }, [customerSearch, customerSummaries, isStaffApp]);
  const customerFilterCounts = useMemo(
    () => ({
      all: searchableCustomerSummaries.length,
      loyal: searchableCustomerSummaries.filter((summary) => matchesCanonicalCustomerFilter({ customerGradeOverride: summary.guardian.customer_grade_override, hasFirstVisit: summary.hasCanonicalFirstVisit }, "loyal")).length,
      first_visit: searchableCustomerSummaries.filter((summary) => matchesCanonicalCustomerFilter({ customerGradeOverride: summary.guardian.customer_grade_override, hasFirstVisit: summary.hasCanonicalFirstVisit }, "first_visit")).length,
    }),
    [searchableCustomerSummaries],
  );
  const filteredGuardians = useMemo(
    () =>
      searchableCustomerSummaries.filter((summary) =>
        matchesCanonicalCustomerFilter(
          { customerGradeOverride: summary.guardian.customer_grade_override, hasFirstVisit: summary.hasCanonicalFirstVisit },
          customerFilter,
        ),
      ),
    [customerFilter, searchableCustomerSummaries],
  );
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
        (!isStaffApp && guardian.phone.includes(query)) ||
        pets.some((pet) => pet.name.includes(query) || pet.breed.includes(query))
      );
    });
  }, [customerSearch, data.pets, deletedGuardians, isStaffApp]);

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
  const selectedVisitAppointments = useMemo(
    () =>
      data.appointments
        .filter((item) => selectedVisitDateSet.has(item.appointment_date) && matchesHomeRoleScope(item))
        .sort((a, b) => (a.appointment_date + " " + a.appointment_time).localeCompare(b.appointment_date + " " + b.appointment_time)),
    [currentStaffId, data.appointments, isStaffApp, selectedVisitDateSet],
  );
  const selectedVisitRecords = useMemo(
    () =>
      data.groomingRecords
        .filter((item) => {
          if (!selectedVisitDateSet.has(item.groomed_at.slice(0, 10))) return false;
          if (!isStaffApp || !currentStaffId) return true;
          const appointment = item.appointment_id ? data.appointments.find((candidate) => candidate.id === item.appointment_id) : null;
          return appointment?.staff_id === currentStaffId;
        })
        .sort((a, b) => b.groomed_at.localeCompare(a.groomed_at)),
    [currentStaffId, data.appointments, data.groomingRecords, isStaffApp, selectedVisitDateSet],
  );
  const completedAppointmentIds = useMemo(() => new Set(selectedVisitRecords.map((item) => item.appointment_id).filter(Boolean)), [selectedVisitRecords]);
  const selectedVisitReservationAppointments = useMemo(
    () =>
      selectedVisitAppointments.filter(
        (item) =>
          item.status !== "cancelled" &&
          item.status !== "completed" &&
          !completedAppointmentIds.has(item.id) &&
          !isMissedPendingAppointment(item, todayDate, currentHomeMinutes),
      ),
    [completedAppointmentIds, currentHomeMinutes, selectedVisitAppointments, todayDate],
  );
  const selectedVisitCancelledAppointments = useMemo(() => selectedVisitAppointments.filter((item) => item.status === "cancelled"), [selectedVisitAppointments]);
  const selectedVisitCompletedAppointments = useMemo(() => selectedVisitAppointments.filter((item) => {
    if (item.status === "cancelled") return false;
    if (isMissedPendingAppointment(item, todayDate, currentHomeMinutes)) return !completedAppointmentIds.has(item.id);
    const isPast = item.appointment_date < todayDate;
    if (isPast) return !completedAppointmentIds.has(item.id);
    return ["completed"].includes(item.status) && !completedAppointmentIds.has(item.id);
  }), [completedAppointmentIds, currentHomeMinutes, selectedVisitAppointments, todayDate]);
  const bookingVisibleAppointments = useMemo(
    () =>
      data.appointments.filter((appointment) => {
        if (isStaffApp && currentStaffId && appointment.staff_id !== currentStaffId) return false;
        return true;
      }),
    [currentStaffId, data.appointments, isStaffApp],
  );
  const bookingDayWeekday = new Date(`${selectedVisitDate}T00:00:00`).getDay();
  const bookingDayHours = data.shop.business_hours[bookingDayWeekday];
  const isBookingDayClosed = data.shop.temporary_closed_dates.includes(selectedVisitDate) || data.shop.regular_closed_days.includes(bookingDayWeekday) || Boolean(bookingDayHours && !bookingDayHours.enabled);
  const bookingStaffFilterOptions = useMemo(() => {
    const currentDateAppointments = data.appointments.filter((appointment) => appointment.appointment_date === selectedVisitDate);
    const countFor = (staffId: string | null) => currentDateAppointments.filter((appointment) => appointment.staff_id === staffId).length;
    const options = [
      ...(data.staffMembers.length > 1 ? [{ id: "all", label: "전체", count: currentDateAppointments.length }] : []),
      ...data.staffMembers.flatMap((staffMember) => {
        const appointmentCount = countFor(staffMember.id);
        const exactOverride = data.staffScheduleOverrides?.find((override) => override.staff_id === staffMember.id && override.work_date === selectedVisitDate);
        const availability = getStaffScheduleAvailability({
          date: selectedVisitDate,
          defaultDays: staffMember.defaultDays,
          overrideStatus: exactOverride?.status,
          isShopClosed: isBookingDayClosed,
        });
        if (!shouldRenderStaffScheduleLane(availability, appointmentCount)) return [];
        const identityTone = getStaffScheduleIdentityTone(staffMember.id, staffMember.chipColorIndex);
        return [{
          id: staffMember.id,
          label: staffMember.name,
          count: appointmentCount,
          profileImageUrl: staffMember.profileImageUrl,
          profileImageFallbackKey: staffMember.profileImageFallbackKey,
          startTime: staffMember.startTime,
          endTime: staffMember.endTime,
          unavailable: !availability.isWorking,
          ...identityTone,
        }];
      }),
    ];
    if (data.staffMembers.length > 1 && countFor(null) > 0) options.push({ id: "unassigned", label: "미배정", count: countFor(null) });
    return isStaffApp && currentStaffId ? options.filter((option) => option.id === currentStaffId) : options;
  }, [currentStaffId, data.appointments, data.staffMembers, data.staffScheduleOverrides, isBookingDayClosed, isStaffApp, selectedVisitDate]);
  useEffect(() => {
    if (bookingStaffFilterOptions.some((option) => option.id === bookingStaffFilter && !("unavailable" in option && option.unavailable))) return;
    setBookingStaffFilter(bookingStaffFilterOptions.find((option) => !("unavailable" in option && option.unavailable))?.id ?? "all");
  }, [bookingStaffFilter, bookingStaffFilterOptions]);
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
      settingKey: keyof GuardianNotificationSettings;
    }>;
  }> = [
    {
      title: "예약",
      items: [
        {
          label: "예약 확정",
          settingKey: "booking_confirmed_enabled",
        },
        {
          label: "예약 취소",
          settingKey: "booking_cancelled_enabled",
        },
        {
          label: "예약 변경 확정",
          settingKey: "booking_rescheduled_enabled",
        },
      ],
    },
    {
      title: "방문 안내",
      items: [
        {
          label: "직전·오늘·내일 안내",
          settingKey: "appointment_reminder_10m_enabled",
        },
      ],
    },
    {
      title: "미용진행",
      items: [
        {
          label: "미용 시작",
          settingKey: "grooming_started_enabled",
        },
        {
          label: "픽업 준비",
          settingKey: "grooming_almost_done_enabled",
        },
        {
          label: "미용 완료",
          settingKey: "grooming_completed_enabled",
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
      if (!backgroundRefreshGateRef.current.shouldRun()) return;
      void refreshSilently();
    };

    const intervalId = window.setInterval(syncIfIdle, 60_000);
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

  async function mutate(url: string, init: RequestInit, options?: { rethrow?: boolean; errorFallbackMessage?: string }) {
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
      await handleRequestError(
        mutationError,
        options?.errorFallbackMessage ?? "저장에 실패했습니다.",
        Boolean(options?.errorFallbackMessage),
      );
      if (options?.rethrow) {
        throw mutationError;
      }
    } finally {
      setSaving(false);
    }
  }

  async function createOwnerAppointment(payload: unknown) {
    if (isOwnerDemo) {
      setModal(null);
      return;
    }

    await appointmentCreateGateRef.current.run(async () => {
      setSaving(true);
      setError(null);
      try {
        const created = assertOwnerAppointmentCreateReadback(
          await fetchJson<Appointment>("/api/appointments", {
            method: "POST",
            body: JSON.stringify(payload),
          }),
          data.shop.id,
        );
        setData((previous) => ({
          ...previous,
          appointments: mergeOwnerAppointmentCreateReadback(previous.appointments, created),
        }));
        setActiveTab("book");
        setVisitSelectionMode("single");
        setVisitRange(null);
        setVisitDateFilter(created.appointment_date);
        setModal(null);
        void refreshSilently();
      } catch (mutationError) {
        await handleRequestError(mutationError, "예약 등록에 실패했습니다.");
      } finally {
        setSaving(false);
      }
    });
  }

  async function saveStaffMemberProfile(payload: unknown) {
    const staffPayload = payload as {
      staffMemberId?: string;
      name?: string;
      displayName?: string;
      profileImageUrl?: string;
      profileImageFallbackKey?: BootstrapStaffMember["profileImageFallbackKey"];
      titlePrefix?: string;
      position?: string;
      chipColorIndex?: number | null;
      profileMessage?: string;
    };

    if (isOwnerDemo) {
      setData((prev) => ({
        ...prev,
        staffMembers: prev.staffMembers.map((staffMember) =>
          staffMember.id === staffPayload.staffMemberId
            ? {
                ...staffMember,
                name: staffPayload.name ?? staffMember.name,
                displayName: staffPayload.displayName ?? staffMember.displayName,
                profileImageUrl: staffPayload.profileImageUrl ?? staffMember.profileImageUrl,
                profileImageFallbackKey: staffPayload.profileImageFallbackKey ?? staffMember.profileImageFallbackKey,
                titlePrefix: staffPayload.titlePrefix ?? staffMember.titlePrefix,
                position: staffPayload.position ?? staffMember.position,
                chipColorIndex: staffPayload.chipColorIndex ?? staffMember.chipColorIndex,
                profileMessage: staffPayload.profileMessage ?? "",
              }
            : staffMember,
        ),
      }));
      return;
    }

    await mutate(
      "/api/staff-members",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      { rethrow: true },
    );
  }

  async function updateAppointment(appointmentId: string, payload: AppointmentUpdatePayload, options?: { rethrow?: boolean }) {
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
                      staff_memo: payload.staffMemo,
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
      return true;
    }

    if ("status" in payload && !("mode" in payload)) {
      const outcome = await statusMutationGateRef.current.run(async () => {
        setSaving(true);
        setError(null);
        try {
          const updated = await withOwnerMobileTimeout(
            (signal) =>
              fetchJson<Appointment>("/api/appointments", {
                method: "PATCH",
                body: JSON.stringify({ appointmentId, ...payload }),
                signal,
              }),
            15_000,
            "상태 변경 응답이 지연되고 있습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.",
          );
          if (!updated || updated.id !== appointmentId || updated.status !== payload.status) {
            throw new Error("상태 변경 결과를 확인하지 못했습니다. 다시 불러와 확인해 주세요.");
          }
          setData((previous) => ({
            ...previous,
            appointments: previous.appointments.map((appointment) =>
              appointment.id === appointmentId ? updated : appointment,
            ),
          }));
          setModal(null);
          void refreshSilently();
          return true;
        } catch (mutationError) {
          await handleRequestError(mutationError, "예약 상태 변경에 실패했습니다.");
          if (options?.rethrow) throw mutationError;
          return false;
        } finally {
          setSaving(false);
        }
      });
      return outcome.accepted ? outcome.value : false;
    }

    await mutate("/api/appointments", {
      method: "PATCH",
      body: JSON.stringify({ appointmentId, ...payload }),
    }, options);
    return true;
  }

  function openMobilePhotoStatusAction(
    appointmentId: string,
    status: Extract<AppointmentStatus, "in_progress" | "completed">,
    autoOpenCamera = false,
    allowSkip = true,
  ) {
    const action = createMobilePhotoStatusAction(appointmentId, status, autoOpenCamera, allowSkip);
    const binding = resolvePendingMobilePhotoBinding(data, action);
    if (!binding) {
      setError("사진을 연결할 예약 정보를 다시 확인해 주세요.");
      return;
    }
    const requestId = pendingPhotoActionRequestRef.current + 1;
    pendingPhotoActionRequestRef.current = requestId;
    setMobilePhotoPreviewFile(null);
    setPendingMobilePhoto(null);
    setMobilePhotoRecovered(false);
    setMobilePhotoStatusAction(action);
    void readPendingOwnerStatusPhoto(binding).then((pending) => {
      if (!pending || pendingPhotoActionRequestRef.current !== requestId) return;
      setPendingMobilePhoto(pending);
      setMobilePhotoPreviewFile(pendingOwnerStatusPhotoToFile(pending));
      setMobilePhotoRecovered(true);
    }).catch(() => {
      // The capture flow still works while the visible page remains open.
    });
  }

  async function stageMobilePhotoFile(file: File) {
    const action = mobilePhotoStatusAction;
    if (!action) return;
    const binding = resolvePendingMobilePhotoBinding(data, action);
    if (!binding) {
      setError("사진과 예약의 연결 정보를 다시 확인해 주세요.");
      return;
    }
    const pending = createPendingOwnerStatusPhoto(binding, file);
    setMobilePhotoPreviewFile(file);
    setPendingMobilePhoto(pending);
    setMobilePhotoRecovered(false);
    try {
      await writePendingOwnerStatusPhoto(pending);
    } catch {
      setError("선택한 사진을 기기에 임시 보관하지 못했습니다. 이 화면을 닫거나 앱을 업데이트하기 전에 등록을 완료해 주세요.");
    }
  }

  async function selectMobilePhotoFile(file: File) {
    setMobilePhotoPreparing(true);
    setError(null);
    try {
      await stageMobilePhotoFile(file);
    } finally {
      setMobilePhotoPreparing(false);
    }
  }

  async function clearStagedMobilePhoto(action: MobilePhotoStatusAction) {
    pendingPhotoActionRequestRef.current += 1;
    const binding = resolvePendingMobilePhotoBinding(data, action);
    if (binding) await clearPendingOwnerStatusPhoto(binding);
    setMobilePhotoPreviewFile(null);
    setPendingMobilePhoto(null);
    setMobilePhotoRecovered(false);
  }

  function requestMobileAppointmentStatusChange(appointmentId: string, status: AppointmentStatus) {
    if (status === "completed") {
      void completeMobileAppointment(appointmentId, "without-photo");
      return;
    }

    if (status === "in_progress") {
      requestMobileGroomingStart(appointmentId);
      return;
    }

    void updateAppointment(appointmentId, { status });
  }

  function requestMobileGroomingStart(appointmentId: string, requestedMode?: "photo" | "without-photo") {
    const appointment = data.appointments.find((item) => item.id === appointmentId);
    if (!appointment) {
      setError("미용을 시작할 예약 정보를 찾지 못했습니다.");
      return;
    }

    const timing = getMobileGroomingStartTiming({
      appointmentDate: appointment.appointment_date,
      appointmentTime: appointment.appointment_time,
      today: currentDateInTimeZone(),
      currentMinutes: currentMinutesInTimeZone(),
    });

    // The late-start flow is intentionally unchanged until its UX policy is decided.
    if (timing === "late" && !requestedMode) {
      openMobilePhotoStatusAction(appointmentId, "in_progress");
      return;
    }

    if (timing !== "early" && requestedMode === "photo") {
      openMobilePhotoStatusAction(appointmentId, "in_progress", false, false);
      return;
    }

    if (timing !== "early" && requestedMode === "without-photo") {
      startMobileAppointmentWithoutPhoto(appointmentId);
      return;
    }

    setMobileGroomingStartAction({
      appointmentId,
      stage: timing === "early" ? "early-confirm" : "choices",
      requestedMode,
    });
  }

  function startMobileAppointmentWithoutPhoto(appointmentId: string) {
    void updateAppointment(appointmentId, { status: "in_progress" });
  }

  function startMobileAppointmentWithPhoto(appointmentId: string, file: File) {
    void updateAppointmentStatusWithMobilePhoto(appointmentId, "in_progress", "grooming_before", file);
  }

  function openCareReport(appointmentId: string) {
    if (isOwnerDemo || careReportOpenInFlightRef.current) return;
    const appointment = data.appointments.find((item) => item.id === appointmentId);
    if (!appointment) {
      setCareReportEntryError({ appointmentId, message: "케어리포트 예약 정보를 찾지 못했습니다." });
      return;
    }
    const publishedCareReport = normalizeCareReport(data.groomingRecords.find((record) => record.appointment_id === appointment.id)?.care_report_data);
    careReportOpenInFlightRef.current = true;
    setCareReportLoadingAppointmentId(appointmentId);
    setCareReportEntryError(null);
    try {
      if (typeof performance !== "undefined") {
        performance.clearMarks("petmanager:care-report:entry-start");
        performance.clearMarks("petmanager:care-report:shell-rendered");
        performance.clearMeasures("petmanager:care-report:shell-open");
        performance.mark("petmanager:care-report:entry-start");
      }
      const immediateData = createOwnerCareReportImmediateData({
        shopId: data.shop.id,
        appointmentId,
        publishedCareReport,
      });
      setCareReportInitialData(immediateData);
      setModal((current) => current?.type === "appointment" && current.appointment.id === appointmentId ? null : current);
      setCareReportAppointmentId(appointmentId);
    } catch {
      setCareReportEntryError({ appointmentId, message: "케어리포트를 열지 못했습니다. 다시 시도해 주세요." });
    } finally {
      queueMicrotask(() => {
        careReportOpenInFlightRef.current = false;
        setCareReportLoadingAppointmentId((current) => current === appointmentId ? null : current);
      });
    }
  }

  function closeCareReport() {
    setCareReportAppointmentId(null);
    setCareReportInitialData(null);
  }

  async function completeMobileAppointment(appointmentId: string, mode: "photo" | "without-photo") {
    if (mode === "without-photo") {
      // A photo remains optional. The care-report editor can add one after completion.
      try {
        const committed = await updateAppointment(appointmentId, { status: "completed" }, { rethrow: true });
        if (committed) void openCareReport(appointmentId);
      } catch {
        // updateAppointment already shows the actionable request error.
      }
      return;
    }

    openMobilePhotoStatusAction(appointmentId, "completed", false, false);
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
    if (isOwnerDemo) return;
    const appointment = data.appointments.find((item) => item.id === appointmentId);
    if (!appointment) {
      setError("사진을 연결할 예약 정보를 찾지 못했습니다.");
      setMobilePhotoStatusAction(null);
      return;
    }

    const action = mobilePhotoStatusAction?.appointmentId === appointmentId
      ? mobilePhotoStatusAction
      : createMobilePhotoStatusAction(appointmentId, nextStatus, false, false);
    const binding = resolvePendingMobilePhotoBinding(data, action);
    if (!binding || binding.mediaKind !== mediaKind || binding.nextStatus !== nextStatus) {
      setError("사진과 예약의 고객·반려동물 정보가 일치하지 않습니다.");
      return;
    }

    if (mobilePhotoUploadInFlightRef.current) return;
    mobilePhotoUploadInFlightRef.current = true;
    setMobilePhotoUploading(true);
    setError(null);
    try {
      let pending = pendingMobilePhoto && isPendingOwnerStatusPhotoExactBinding(pendingMobilePhoto, binding)
        ? pendingMobilePhoto
        : createPendingOwnerStatusPhoto(binding, file);
      if (!pendingMobilePhoto || pending !== pendingMobilePhoto) {
        setPendingMobilePhoto(pending);
        await writePendingOwnerStatusPhoto(pending);
      }

      let durableMediaAssetId: string | null = null;
      if (pending.uploadStarted || pending.durableMediaAssetId) {
        const query = new URLSearchParams({
          shopId: binding.shopId,
          appointmentId: binding.appointmentId,
          guardianId: binding.guardianId,
          petId: binding.petId,
          includeVariants: "false",
          limit: "50",
        });
        const existing = await fetchJson<MediaAssetListResponse>(`/api/owner/media/assets?${query.toString()}`);
        durableMediaAssetId = existing.items.find((item) => isPendingDurableAssetReusable(pending, item.mediaAsset))?.mediaAsset.id ?? null;
        if (pending.durableMediaAssetId && !durableMediaAssetId) {
          throw new Error("이미 저장한 사진의 예약 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      }

      if (!durableMediaAssetId) {
        const uploadStartedPending = { ...pending, uploadStarted: true };
        pending = await markPendingOwnerStatusPhotoUploadStarted(pending).catch(() => uploadStartedPending);
        setPendingMobilePhoto(pending);
        const uploaded = await createOwnerMediaAssetFromFile(
          {
            shopId: data.shop.id,
            guardianId: appointment.guardian_id,
            petId: appointment.pet_id,
            appointmentId: appointment.id,
            groomingRecordId: null,
            metadata: { owner_pending_upload_id: pending.uploadAttemptId },
          },
          mediaKind,
          file,
          { waitForProviderReadyVariant: false },
        );
        durableMediaAssetId = uploaded.mediaAsset.id;
        const durablePending = { ...pending, durableMediaAssetId };
        setPendingMobilePhoto(durablePending);
        pending = await markPendingOwnerStatusPhotoDurable(pending, durableMediaAssetId).catch(() => durablePending);
        setPendingMobilePhoto(pending);
      }

      const committed = appointment.status === nextStatus
        ? true
        : await traceOwnerMediaStep("appointment-status-commit", () =>
            updateAppointment(appointment.id, {
              status: nextStatus,
              mediaAssetIds: [durableMediaAssetId!],
            }, { rethrow: true }),
          );
      if (!committed) return;
      await clearPendingOwnerStatusPhoto(binding).catch(() => undefined);
      setMobilePhotoPreviewFile(null);
      setPendingMobilePhoto(null);
      setMobilePhotoRecovered(false);
      setMobilePhotoStatusAction(null);
      if (nextStatus === "completed") void openCareReport(appointment.id);
    } catch (uploadError) {
      await handleRequestError(uploadError, "사진 업로드 또는 상태 변경에 실패했습니다.");
    } finally {
      mobilePhotoUploadInFlightRef.current = false;
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

  async function captureMobilePhoto(mode: "default" | "chooser") {
    setMobilePhotoPreparing(true);
    setError(null);
    try {
      const photo = await captureWithAndroidCameraApp(mode);
      await stageMobilePhotoFile(photo);
    } catch (captureError) {
      if (captureError instanceof Error && captureError.message === "CAMERA_CANCELLED") return;
      await handleRequestError(captureError, "카메라를 열지 못했습니다. 다른 카메라 앱이나 사진 불러오기를 이용해 주세요.");
    } finally {
      setMobilePhotoPreparing(false);
    }
  }

  function openSettingsScreen(screen: Exclude<SettingsEntryScreen, null>) {
    setSettingsEntryScreen(screen);
    setActiveTab("settings");
  }

  function hasCurrentShopEntity(
    entities: ReadonlyArray<{ id: string; shop_id: string }>,
    entityId: string,
    label: "고객" | "반려동물",
  ) {
    try {
      assertCurrentShopEntity(entities, entityId, data.shop.id, label);
      return true;
    } catch (scopeError) {
      setError(scopeError instanceof Error ? scopeError.message : `${label} 정보를 다시 확인해 주세요.`);
      return false;
    }
  }

  function getCurrentShopEntityIds(
    entities: ReadonlyArray<{ id: string; shop_id: string }>,
    entityIds: readonly string[],
    label: "고객" | "반려동물",
  ) {
    try {
      return assertCurrentShopEntities(entities, entityIds, data.shop.id, label);
    } catch (scopeError) {
      setError(scopeError instanceof Error ? scopeError.message : `${label} 정보를 다시 확인해 주세요.`);
      return null;
    }
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

    if (!hasCurrentShopEntity(data.guardians, guardianId, "고객")) return;
    await mutate("/api/guardians", {
      method: "PATCH",
      body: JSON.stringify({ shopId: data.shop.id, guardianId, notificationSettings: patch }),
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

    if (!hasCurrentShopEntity(data.guardians, guardianId, "고객")) return;
    await mutate("/api/guardians", {
      method: "PATCH",
      body: JSON.stringify({ shopId: data.shop.id, guardianId, name, phone, memo }),
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

    if (!hasCurrentShopEntity(data.guardians, guardianId, "고객")) return;
    await mutate("/api/guardians", {
      method: "DELETE",
      body: JSON.stringify({ shopId: data.shop.id, guardianId }),
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

    const scopedGuardianIds = getCurrentShopEntityIds(data.guardians, guardianIds, "고객");
    if (!scopedGuardianIds) return;
    await mutate("/api/guardians", {
      method: "DELETE",
      body: JSON.stringify({ shopId: data.shop.id, guardianIds: scopedGuardianIds }),
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
      await fetchJson("/api/owner/shops", {
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
      const scopedGuardianIds = getCurrentShopEntityIds(data.deletedGuardians ?? [], guardianIds, "고객");
      if (!scopedGuardianIds) return;
      await fetchJson("/api/guardians/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: data.shop.id, guardianIds: scopedGuardianIds }),
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
    if (isStaffApp && field === "phone") return;
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

    if (!hasCurrentShopEntity(data.pets, petId, "반려동물")) return;
    await mutate("/api/pets", {
      method: "PATCH",
      body: JSON.stringify({ shopId: data.shop.id, petId, name, breed, birthday }),
    });
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
  const customerEmptyTitle = customerSearch.trim()
    ? "검색 조건과 맞는 활성 고객이 없어요"
    : customerFilter === "loyal"
      ? "단골 고객이 없어요"
      : customerFilter === "first_visit"
        ? "신규 고객이 없어요"
        : "등록된 고객이 아직 없어요";
  const customerEmptyDescription =
    customerSearch.trim() && filteredDeletedGuardians.length > 0
      ? "삭제 고객에서는 일치하는 항목이 있어요. 삭제 고객 보기를 열어 확인해 주세요."
      : customerSearch.trim()
        ? "이름, 연락처, 반려동물 이름을 다시 확인해 주세요."
        : customerFilter === "loyal"
          ? "저장된 단골 표시가 있는 고객만 보여요."
          : customerFilter === "first_visit"
            ? "첫 방문으로 표시된 예약이 있는 고객만 보여요."
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
  const homeCurrentSectionLabel = homeWorkDateKey === todayDate ? "오늘 할 일" : "선택한 날";
  const homeScheduleTabs: Array<{ key: HomeReservationSectionKey; label: string; count: number }> = [
    { key: "current", label: homeCurrentSectionLabel, count: filteredHomeActionAppointments.length + filteredHomeCareReportFollowupAppointments.length },
    { key: "cancelChange", label: ownerHomeCopy.statCancelChange, count: filteredHomeCancelChangeAppointments.length },
  ];
  const testerFeedbackScreenKey: TesterFeedbackScreenKey =
    activeTab === "home" ? "home" : activeTab === "book" ? "schedule" : activeTab === "customers" ? "customers" : "shop_settings";

  return (
    <div
      className={cn(
        "pm-mobile-owner relative mx-auto flex w-full max-w-[430px] flex-col bg-[var(--background)] shadow-[0_0_0_1px_rgba(15,23,42,0.04)]",
        isHomeTab && !isCustomerDetailView
          ? "h-dvh overflow-hidden"
          : activeTab === "book"
            ? "h-dvh"
            : "min-h-screen",
      )}
    >
      <OwnerAppUpdateCoordinator />
      {pushNotice ? (
        <button
          type="button"
          onClick={() => {
            const appointment = pushNotice.appointmentId
              ? data.appointments.find((item) => item.id === pushNotice.appointmentId)
              : null;
            setPushNotice(null);
            setActiveTab("book");
            setSettingsEntryScreen(null);
            if (appointment) {
              setSelectedDate(appointment.appointment_date);
              setModal({ type: "appointment", appointment });
            }
          }}
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+12px)] z-[70] flex w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 items-center justify-between gap-3 rounded-[8px] border border-[#cfe0d9] bg-white px-4 py-3 text-left shadow-[0_8px_24px_rgba(15,23,42,0.14)]"
        >
          <span className="min-w-0">
            <span className="block text-[16px] font-semibold text-[var(--text)]">새 예약이 접수되었습니다.</span>
            <span className="mt-0.5 block text-[13px] text-[var(--muted)]">눌러서 예약을 확인해 주세요.</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={2} />
        </button>
      ) : null}
      {!isCustomerDetailView && activeTab !== "book" ? (
      <header className={cn("sticky top-0 z-20 border-b border-[#edf1f5] bg-white px-4", isHomeTab ? "pb-0 pt-3" : "py-3")}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isHomeTab ? (
              <div className="flex w-full min-w-0 flex-col">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setIsShopPickerOpen((prev) => !prev)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-transparent text-left"
                  >
                    <div className="flex min-h-[30px] min-w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#eaf1fc] text-[#174ea6]">
                      {currentOwnedShop.heroImageUrl ? (
                        <img src={currentOwnedShop.heroImageUrl} alt={`${currentOwnedShop.name} 대표 이미지`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold tracking-[-0.03em]">
                          {currentOwnedShop.name.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <p className="min-w-0 max-w-[172px] text-[18px] font-semibold tracking-[-0.01em] text-[#0f172a] [overflow-wrap:anywhere]">{currentOwnedShop.name}</p>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                  </button>
                  {!isStaffApp ? <HomeHeaderStaffSelect options={homeStaffFilterOptions} value={homeStaffFilter} onChange={setHomeStaffFilter} staffCount={data.staffMembers.length} /> : null}
                </div>
                <div className="mt-3 border-t border-[#edf1f5]">
                  <HomeScheduleTabs
                    tabs={homeScheduleTabs}
                    activeKey={homeFocusedSection}
                    onChange={setHomeFocusedSection}
                    trailing={
                      <OwnerHomeDateNavigator
                        selectedDate={homeReservationDate}
                        todayDate={todayDate}
                        onMoveDate={moveHomeReservationDate}
                        onOpenDatePicker={() => setIsHomeDatePickerOpen(true)}
                      />
                    }
                  />
                </div>
              </div>
            ) : (
              isSettingsDetailView ? (
                <button
                  type="button"
                  onClick={() => setSettingsEntryScreen(null)}
                  className="inline-flex min-h-11 w-full items-center gap-2 rounded-[8px] bg-transparent px-0 text-left text-[20px] font-semibold leading-10 tracking-[-0.03em] text-[var(--text)]"
                  aria-label="설정으로 돌아가기"
                >
                  <ChevronRight className="h-5 w-5 shrink-0 rotate-180" strokeWidth={2} />
                  <span className="truncate">{currentSettingsScreenTitle}</span>
                </button>
              ) : (
                <div className="space-y-1">
                  <h1 className="text-[20px] font-semibold leading-10 tracking-[-0.03em] text-[var(--text)]">{screenTitle}</h1>
                </div>
              )
            )}
          </div>
          {headerAction ? (
            <button
              type="button"
              disabled={headerAction.disabled}
              className="inline-flex min-h-11 min-w-[88px] shrink-0 items-center justify-center rounded-[12px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[14px] font-semibold tracking-[-0.01em] text-white disabled:opacity-45"
              onClick={headerAction.onClick}
            >
              {headerAction.label}
            </button>
          ) : null}
        </div>
      </header>
      ) : null}

      <main className={cn("no-scrollbar flex-1", isHomeTab && !isCustomerDetailView ? "min-h-0 overflow-hidden pb-0" : activeTab === "book" ? "mb-[calc(env(safe-area-inset-bottom)+60px)] min-h-0 overflow-y-auto overscroll-y-contain pb-0" : "overflow-y-auto pb-24")}>
        {error && <div className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {activeTab === "home" && (
          <section className="flex h-full min-h-0 flex-col gap-2 bg-[#f6f9fc] px-2.5 pb-[calc(env(safe-area-inset-bottom)+128px)] pt-2">
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
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="min-h-0 flex-1">
                  <TodayConfirmedContent
                    currentAppointments={filteredHomeActionAppointments}
                    careReportFollowupAppointments={filteredHomeCareReportFollowupAppointments}
                    cancelChangeAppointments={filteredHomeCancelChangeAppointments}
                    completedAppointments={filteredHomeCompletedHistoryAppointments}
                    petMap={petMap}
                    guardianMap={guardianMap}
                    serviceMap={serviceMap}
                    staffMap={staffMap}
                    petDisplayPhotos={data.petDisplayPhotos ?? []}
                    saving={saving}
                    focusedSection={homeFocusedSection}
                    selectedDateKey={homeWorkDateKey}
                    isToday={homeWorkDateKey === todayDate}
                    slideDirection={homeReservationSlideDirection}
                    careReportLoadingAppointmentId={careReportLoadingAppointmentId}
                    onOpenAppointment={(appointment) => setModal({ type: "appointment", appointment })}
                    onResumeCareReport={(appointmentId) => void openCareReport(appointmentId)}
                    onStatusChange={requestMobileAppointmentStatusChange}
                    onStartWithoutPhoto={(appointmentId) => requestMobileGroomingStart(appointmentId, "without-photo")}
                    onCompleteWithoutPhoto={(appointmentId) => completeMobileAppointment(appointmentId, "without-photo")}
                    onOpenPhotoStatusAction={(appointmentId, status) => {
                      if (status === "in_progress") {
                        requestMobileGroomingStart(appointmentId, "photo");
                        return;
                      }
                      completeMobileAppointment(appointmentId, "without-photo");
                    }}
                  />
                </div>
              </div>
            </div>
            <OwnerBookingDatePicker
              open={isHomeDatePickerOpen}
              selectedDate={homeReservationDate}
              onClose={() => setIsHomeDatePickerOpen(false)}
              onSelectDate={(date) => {
                selectHomeReservationDate(date);
                setIsHomeDatePickerOpen(false);
              }}
              quickDates={getOwnerTodayQuickDates(todayDate)}
            />
          </section>
        )}
{activeTab === "book" && (
  <section className="min-h-full space-y-3.5 bg-[#f6f9fc] p-0">
    <OwnerBookingDaySchedule
      date={selectedVisitDate}
      appointments={bookingVisibleAppointments}
      petNames={Object.fromEntries(data.pets.map((pet) => [pet.id, pet.name]))}
      guardianNames={Object.fromEntries(data.guardians.map((guardian) => [guardian.id, guardian.name]))}
      serviceNames={Object.fromEntries(data.services.map((service) => [service.id, service.name]))}
      serviceDurations={Object.fromEntries(data.services.map((service) => [service.id, service.duration_minutes]))}
      staffOptions={bookingStaffFilterOptions}
      selectedStaffId={bookingStaffFilter}
      staffScheduleOverrides={data.staffScheduleOverrides ?? []}
      isShopClosed={isBookingDayClosed}
      onSelectStaff={setBookingStaffFilter}
      onChangeDate={(direction) => {
        const date = addDate(selectedVisitDate, direction === "previous" ? -1 : 1);
        setVisitSelectionMode("single");
        setVisitRange(null);
        setVisitDateFilter(date);
      }}
      onOpenDatePicker={() => setIsBookingDatePickerOpen(true)}
      onOpenAppointment={(appointment) => setModal({ type: "appointment", appointment })}
    />
    <OwnerBookingDatePicker
      open={isBookingDatePickerOpen}
      selectedDate={selectedVisitDate}
      onClose={() => setIsBookingDatePickerOpen(false)}
      onSelectDate={(date) => {
        setVisitSelectionMode("single");
        setVisitRange(null);
        setVisitDateFilter(date);
        setIsBookingDatePickerOpen(false);
      }}
    />

    {isSelectedVisitRange ? visitSectionOrder.map((sectionKey) => {
      if (sectionKey === "reservation") {
        return (
          <Panel
            key="reservation"
            title={ownerHomeCopy.visitActionTitle}
            titleTextClassName="text-[16px] font-medium leading-6 tracking-[-0.02em]"
            action={<span className="text-[12px] font-medium tracking-[-0.01em] text-[#64748b]">{selectedVisitReservationAppointments.length + ownerHomeCopy.countSuffix}</span>}
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
            action={<span className="text-[12px] font-medium tracking-[-0.01em] text-[#64748b]">{selectedVisitCompletedAppointments.length + selectedVisitRecords.length + ownerHomeCopy.countSuffix}</span>}
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
          action={<span className="text-[12px] font-medium tracking-[-0.01em] text-[#64748b]">{selectedVisitCancelledAppointments.length + ownerHomeCopy.countSuffix}</span>}
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
    }) : null}
  </section>
)}

{activeTab === "book" && isVisitCalendarOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 px-5" onClick={() => setIsVisitCalendarOpen(false)}><div className="w-full max-w-[360px] rounded-[12px] border border-[var(--border)] bg-white p-4 shadow-[0_18px_40px_rgba(35,35,31,0.12)]" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-start justify-between gap-3"><p className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">{pendingVisitDateHeader}</p><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--text)]" onClick={() => setIsVisitCalendarOpen(false)}>{"✕"}</button></div><div className="mb-4 grid grid-cols-2 gap-1.5 rounded-[12px] bg-[#f7f4ef] p-0.5"><button type="button" className={`rounded-[10px] px-2.5 py-2 text-sm font-semibold transition ${pendingVisitSelectionMode === "single" ? "bg-white text-[var(--text)] shadow-[0_6px_14px_rgba(35,35,31,0.08)]" : "text-[var(--muted)]"}`} onClick={() => { setPendingVisitSelectionMode("single"); setPendingVisitRangeStart(null); setPendingVisitRangeEnd(null); }}>날짜 선택</button><button type="button" className={`rounded-[10px] px-2.5 py-2 text-sm font-semibold transition ${pendingVisitSelectionMode === "range" ? "bg-white text-[var(--text)] shadow-[0_6px_14px_rgba(35,35,31,0.08)]" : "text-[var(--muted)]"}`} onClick={() => { setPendingVisitSelectionMode("range"); setPendingVisitRangeStart(pendingVisitDate); setPendingVisitRangeEnd(null); }}>기간 선택</button></div><div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-[var(--text)]">{visitCalendarMonthLabel}</p><div className="flex items-center gap-2"><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-lg text-[var(--text)] transition hover:bg-[#f6f1ec]" onClick={() => { const base = new Date(visitCalendarMonthStart + "T00:00:00"); const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1); setVisitCalendarMonthCursor(String(prev.getFullYear()) + "-" + String(prev.getMonth() + 1).padStart(2, "0")); }} aria-label={"이전 달"}>{"‹"}</button><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-lg text-[var(--text)] transition hover:bg-[#f6f1ec]" onClick={() => { const base = new Date(visitCalendarMonthStart + "T00:00:00"); const next = new Date(base.getFullYear(), base.getMonth() + 1, 1); setVisitCalendarMonthCursor(String(next.getFullYear()) + "-" + String(next.getMonth() + 1).padStart(2, "0")); }} aria-label={"다음 달"}>{"›"}</button></div></div><div className="grid grid-cols-7 gap-y-3 text-center text-sm font-semibold"><span className="text-[var(--muted)]">{"일"}</span><span className="text-[var(--muted)]">{"월"}</span><span className="text-[var(--muted)]">{"화"}</span><span className="text-[var(--muted)]">{"수"}</span><span className="text-[var(--muted)]">{"목"}</span><span className="text-[var(--muted)]">{"금"}</span><span className="text-[var(--muted)]">{"토"}</span>{visitCalendarCells.map((item, index) => { if (!item) return <div key={`calendar-empty-${index}`} className="h-11" />; const isSingleActive = pendingVisitSelectionMode === "single" && pendingVisitDate === item; const isRangeStart = pendingVisitSelectionMode === "range" && pendingVisitRange?.start === item; const isRangeEnd = pendingVisitSelectionMode === "range" && pendingVisitRange?.end === item; const isRangeActive = Boolean(isRangeStart || isRangeEnd); const isInRange = pendingVisitSelectionMode === "range" && pendingVisitRange && pendingVisitRange.start < item && item < pendingVisitRange.end; const isToday = item === todayDate; return <button key={item} type="button" className="flex h-11 items-center justify-center" onClick={() => { if (pendingVisitSelectionMode === "single") { setPendingVisitDate(item); return; } if (!pendingVisitRangeStart || pendingVisitRangeEnd) { setPendingVisitRangeStart(item); setPendingVisitRangeEnd(null); setPendingVisitDate(item); return; } if (item < pendingVisitRangeStart) { setPendingVisitRangeStart(item); setPendingVisitRangeEnd(null); setPendingVisitDate(item); return; } setPendingVisitRangeEnd(item); setPendingVisitDate(item); }}><span className={`flex h-10 w-10 items-center justify-center rounded-full text-[16px] font-semibold transition ${isSingleActive || isRangeActive ? "bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]" : isInRange ? "bg-[var(--accent-soft)] text-[var(--text)]" : isToday ? "border border-[var(--border)] bg-[#faf7f4] text-[var(--text)]" : "bg-transparent text-[var(--text)] hover:bg-[#f6f1ec]"}`}>{String(Number(item.slice(8, 10)))}</span></button>; })}</div><div className="mt-5 grid grid-cols-2 gap-2"><ActionButton variant="ghost" onClick={() => { if (visitSelectionMode === "range" && selectedVisitRange) { setPendingVisitSelectionMode("range"); setPendingVisitRangeStart(selectedVisitRange.start); setPendingVisitRangeEnd(selectedVisitRange.end); setPendingVisitDate(selectedVisitRange.start); } else { setPendingVisitSelectionMode("single"); setPendingVisitDate(selectedVisitDate); setPendingVisitRangeStart(null); setPendingVisitRangeEnd(null); } setIsVisitCalendarOpen(false); }}>닫기</ActionButton><ActionButton onClick={() => { if (pendingVisitSelectionMode === "range" && pendingVisitRange) { setVisitSelectionMode("range"); setVisitRange(pendingVisitRange); setVisitDateFilter(pendingVisitRange.start); } else { setVisitSelectionMode("single"); setVisitRange(null); setVisitDateFilter(pendingVisitDate); } setIsVisitCalendarOpen(false); }} disabled={!canConfirmVisitCalendar}>확인</ActionButton></div></div></div>}

        {activeTab === "customers" && !selectedGuardian && (
          <section className={`min-h-full bg-[#f6f9fc] ${isCustomerListEditing && filteredGuardians.length > 0 ? "pb-[160px]" : "pb-4"}`}>
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
                <OwnerCustomerListToolbar
                  customerSearch={customerSearch}
                  customerFilter={customerFilter}
                  customerFilterCounts={customerFilterCounts}
                  isStaffApp={isStaffApp}
                  onCustomerSearchChange={setCustomerSearch}
                  onCustomerFilterChange={setCustomerFilter}
                  onOpenDeleteMode={() => {
                    setIsCustomerListEditing((prev) => {
                      if (prev) setSelectedGuardianIds([]);
                      return !prev;
                    });
                  }}
                />
                <div className="space-y-2 px-4 pb-24 pt-3">
                {filteredGuardians.length === 0 ? (
                  <CustomerEmptyState
                    title={customerEmptyTitle}
                    description={customerEmptyDescription}
                    action={
                      null
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredGuardians.map((summary, index) => (
                      <div
                        key={summary.guardian.id}
                        className="rounded-2xl border border-[#eaf0f6] bg-white px-3.5 py-3 transition hover:bg-[#fbfcfe]"
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
                          <div className="flex min-h-[42px] items-center gap-3">
                            <span className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-[#172235] ${["bg-[#8fb4e0]", "bg-[#6f9bd1]", "bg-[#4f7cb8]", "bg-[#7ec2c9]"][index % 4]}`}>{summary.guardian.name.slice(0, 1)}</span>
                            <div className="flex min-w-0 flex-1 flex-col gap-1 text-[16px] leading-5 tracking-[-0.02em]">
                              <div className="flex min-w-0 items-center gap-1.5"><span className="shrink-0 font-semibold text-[#33404f]">{summary.guardian.name}</span>
                              {!isStaffApp ? (
                                <>
                                  <span className="shrink-0 text-[#64748b]">·</span>
                                  <span className="shrink-0 font-normal text-[var(--muted)]">{summary.guardian.phone}</span>
                                </>
                              ) : null}
                              <span className="shrink-0 text-[#64748b]">·</span>
                              </div><span className="w-fit max-w-full truncate rounded-full bg-[#e6f3f3] px-2 py-0.5 text-[12px] font-semibold text-[#245b63]">🐾 {summary.pets.map((pet) => pet.name).join(", ") || "등록된 반려동물 없음"}</span>
                            </div>
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ebe3da] bg-[#fcfaf7] text-[var(--muted)] transition group-hover:text-[var(--accent)]">
                              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                            </span>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                </div>
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
          <section className="min-h-full space-y-4 bg-[#F4F5F7] px-4 pb-4 pt-[72px]">
            <div className="fixed left-1/2 top-0 z-30 flex min-h-[56px] w-full max-w-[430px] -translate-x-1/2 items-center justify-center border-b border-[#edf1f5] bg-white px-4">
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

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="px-1 text-[12px] font-medium leading-4 tracking-[0.03em] text-[#64748b]">기본 정보</p>
                <div className="overflow-hidden rounded-[14px] border border-[#e2e7ed] bg-white">
                  {editingCustomerFields.name ? (
                    <div className="flex items-center gap-3 px-[15px] py-[13px]">
                      <span className="w-16 shrink-0 text-[13px] font-normal text-[#64748b]">보호자</span>
                      <div className="relative min-w-0 flex-1">
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
                          className={`${customerInlineSaveButtonClass} absolute bottom-1 right-1 top-1 min-w-[64px] px-3.5`}
                          onClick={() => void handleCustomerInlineSave()}
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-[15px] py-[13px] text-left"
                      onClick={() => openCustomerFieldEditor("name")}
                    >
                      <span className="w-16 shrink-0 text-[13px] font-normal text-[#64748b]">보호자</span>
                      <span className="min-w-0 flex-1 truncate text-[16px] font-medium text-[#0f172a]">{selectedGuardian.name}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#94a3b8]" strokeWidth={1.9} />
                    </button>
                  )}

                  <div className="border-t border-[#edf1f5]" />
                  {isStaffApp ? (
                    <div className="flex items-center gap-3 px-[15px] py-[13px]">
                      <span className="w-16 shrink-0 text-[13px] font-normal text-[#64748b]">연락처</span>
                      <span className="min-w-0 flex-1 truncate text-[16px] font-medium text-[#64748b]">관리자 확인 필요</span>
                    </div>
                  ) : editingCustomerFields.phone ? (
                    <div className="flex items-center gap-3 px-[15px] py-[13px]">
                      <span className="w-16 shrink-0 text-[13px] font-normal text-[#64748b]">연락처</span>
                      <div className="relative min-w-0 flex-1">
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
                          className={`${customerInlineSaveButtonClass} absolute bottom-1 right-1 top-1 min-w-[64px] px-3.5`}
                          onClick={() => void handleCustomerInlineSave()}
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-[15px] py-[13px] text-left"
                      onClick={() => openCustomerFieldEditor("phone")}
                    >
                      <span className="w-16 shrink-0 text-[13px] font-normal text-[#64748b]">연락처</span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[16px] font-medium text-[#0f172a]">
                        <span className="truncate">{formatShopPhoneNumber(selectedGuardian.phone)}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#94a3b8]" strokeWidth={1.9} />
                    </button>
                  )}

                  <div className="border-t border-[#edf1f5]" />
                  {editingCustomerFields.pet ? (
                    <div className="flex items-center gap-3 px-[15px] py-[13px]">
                      <span className="w-16 shrink-0 text-[13px] font-normal text-[#64748b]">반려동물</span>
                      <div className="relative min-w-0 flex-1">
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
                          className={`${customerInlineSaveButtonClass} absolute bottom-1 right-1 top-1 min-w-[64px] px-3.5`}
                          onClick={() => void handleCustomerInlineSave()}
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-[15px] py-[13px] text-left"
                      onClick={() => openCustomerFieldEditor("pet")}
                    >
                      <span className="w-16 shrink-0 text-[13px] font-normal text-[#64748b]">반려동물</span>
                      <span className="min-w-0 flex-1 truncate text-[16px] font-medium text-[#0f172a]">{selectedGuardianPetNames || "등록된 반려동물 없음"}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#94a3b8]" strokeWidth={1.9} />
                    </button>
                  )}

                  <div className="border-t border-[#edf1f5]" />
                  {editingCustomerFields.memo ? (
                    <div className="px-[15px] py-[13px]">
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
                          className="absolute bottom-3 right-3 inline-flex h-8 min-w-[52px] items-center justify-center rounded-[10px] border border-[#2f6fd6] bg-[#2f6fd6] px-3 text-[12px] font-medium tracking-[-0.01em] text-white transition disabled:opacity-45"
                          onClick={() => void handleCustomerInlineSave()}
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-[15px] py-[13px] text-left"
                      onClick={() => openCustomerFieldEditor("memo")}
                    >
                      <span className="w-16 shrink-0 pt-0.5 text-[13px] font-normal text-[#64748b]">메모</span>
                      <span className={cn("min-w-0 flex-1 overflow-hidden text-[16px] font-medium leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]", selectedGuardian.memo ? "text-[#0f172a]" : "text-[#94a3b8]")}>{selectedGuardian.memo || "메모를 추가해 주세요"}</span>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#94a3b8]" strokeWidth={1.9} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="px-1 text-[12px] font-medium leading-4 tracking-[0.03em] text-[#475569]">개인 알림톡</p>
                <div className="flex min-h-14 items-center gap-3 rounded-[14px] border border-[#e2e7ed] bg-white px-[15px] py-1.5">
                  <p className="min-w-0 flex-1 text-[16px] font-semibold leading-5 text-[#0f172a]">알림톡 전체 수신</p>
                  <button
                    type="button"
                    disabled={saving}
                    role="switch"
                    aria-checked={guardianNotificationsEnabled}
                    aria-label="알림톡 전체 수신"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] motion-reduce:transition-none disabled:opacity-45"
                    onClick={() => void updateGuardianNotifications(selectedGuardian.id, { enabled: !guardianNotificationsEnabled })}
                  >
                    <span className={cn("relative h-6 w-10 rounded-full transition motion-reduce:transition-none", guardianNotificationsEnabled ? "bg-[#2f6fd6]" : "bg-[#d8dde3]")} aria-hidden="true">
                      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition motion-reduce:transition-none", guardianNotificationsEnabled ? "left-[18px]" : "left-0.5")} />
                    </span>
                  </button>
                </div>

                {customerNotificationGroups.map((group) => (
                  <div key={group.title} className="space-y-1.5">
                    <p className="px-1 pt-2 text-[12px] font-medium leading-4 text-[#475569]">{group.title}</p>
                    <div className="overflow-hidden rounded-[14px] border border-[#e2e7ed] bg-white">
                      {group.items.map((item, index) => {
                        const active = guardianNotificationsEnabled && selectedGuardian.notification_settings[item.settingKey] !== false;
                        const disabled = saving || !guardianNotificationsEnabled;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            role="switch"
                            aria-checked={active}
                            disabled={disabled}
                            onClick={() => void updateGuardianNotifications(selectedGuardian.id, { [item.settingKey]: !active })}
                            className={cn(
                              "flex min-h-11 w-full items-center gap-3 px-[15px] py-2 text-left transition active:bg-[#f1f5f9] focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb] motion-reduce:transition-none",
                              index > 0 ? "border-t border-[#edf1f5]" : "",
                              disabled ? "cursor-not-allowed opacity-55" : "hover:bg-[#f8fafc]",
                            )}
                          >
                            <span className="min-w-0 flex-1 text-[14px] font-medium leading-5 text-[#0f172a]">{item.label}</span>
                            <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition motion-reduce:transition-none", active ? "bg-[#2f6fd6]" : "bg-[#d8dde3]")} aria-hidden="true">
                              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition motion-reduce:transition-none", active ? "left-[18px]" : "left-0.5")} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5">
                  <div data-testid="owner-customer-detail-tabs" className="grid grid-cols-3 gap-1 rounded-[10px] border border-[var(--border)] bg-[#f8f5f0] p-1">
                    {(["records", "pets", "notifications"] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        data-customer-detail-tab={item}
                        className={`flex min-h-11 items-center justify-center rounded-[8px] px-1 py-2 text-center text-[16px] font-medium leading-6 tracking-[-0.005em] [overflow-wrap:anywhere] transition ${
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
                        />
                      ))}
                      <button
                        type="button"
                        className="mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#cfded8] bg-white px-4 py-2.5 text-[16px] font-medium leading-6 tracking-[-0.005em] text-[var(--accent)] transition hover:bg-[#fcfaf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-2"
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
                        <AppEmptyState title="발송된 알림톡이 없어요" description="예약 안내 알림을 보내면 여기에서 이력을 확인할 수 있어요." />
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
          </section>
        )}

        {activeTab === "settings" && <SettingsPanel data={data} initialScreen={settingsEntryScreen} onActiveScreenChange={setSettingsEntryScreen} onSave={(payload, options) => mutate("/api/owner/shops", { method: "PATCH", body: JSON.stringify(payload) }, { rethrow: true, errorFallbackMessage: options?.errorFallbackMessage })} onSaveCustomerPageSettings={(payload) => mutate("/api/customer-page-settings", { method: "PATCH", body: JSON.stringify(payload) }, { rethrow: true })} onSaveStaff={saveStaffMemberProfile} onLogout={onLogout} loggingOut={loggingOut} userEmail={userEmail} subscriptionSummary={subscriptionSummary} appRole={appRole} currentStaffId={currentStaffId} onOpenFeedback={() => { ownerFeedbackReturnFocusRef.current = settingsFeedbackTriggerRef.current; setFeedbackInitialCategory("inquiry"); setIsTesterFeedbackHubOpen(true); }} feedbackTriggerRef={settingsFeedbackTriggerRef} isTesterFeedback={isTesterFeedback} />}
      </main>

      {!isStaffApp && !modal ? (
        <OwnerContextActionMenu
          ref={ownerContextMenuTriggerRef}
          isOpen={isOwnerContextMenuOpen}
          isSuppressed={isTesterFeedbackHubOpen}
          isTester={isTesterFeedback}
          onOpenChange={setIsOwnerContextMenuOpen}
          onAddReservation={() => setModal({ type: "new-appointment" })}
          onOpenFeedback={(category) => {
            ownerFeedbackReturnFocusRef.current = ownerContextMenuTriggerRef.current;
            setFeedbackInitialCategory(category);
            setIsTesterFeedbackHubOpen(true);
          }}
        />
      ) : null}

      {isTesterFeedbackHubOpen && !isStaffApp ? (
        <OwnerTesterFeedbackSheet
          shopId={data.shop.id}
          screenKey={testerFeedbackScreenKey}
          appVersion={resolveTesterFeedbackAppVersion()}
          onClose={() => setIsTesterFeedbackHubOpen(false)}
          returnFocusRef={ownerFeedbackReturnFocusRef}
          isTester={isTesterFeedback}
          initialCategory={feedbackInitialCategory}
          adapter={sharedOwnerFeedbackAdapter}
        />
      ) : null}

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
                  className={`group relative flex min-h-11 flex-col items-center justify-center rounded-[12px] px-1 py-0.5 text-center transition ${
                    active
                      ? "bg-[var(--accent-soft)] text-[#174ea6]"
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
                    className={`relative mt-0.5 text-[12px] font-semibold leading-4 tracking-[-0.01em] ${
                      active ? "text-[#174ea6]" : "text-[var(--muted)]"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
        </div>
      </nav>

      {rootBackExitNotice ? (
        <p
          data-testid="owner-root-back-exit-notice"
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-24 z-[70] mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          한 번 더 누르면 앱이 종료됩니다
        </p>
      ) : null}

      {modal && <div>{modal.type === "appointment" ? <Overlay><AppointmentDetail data={data} appointment={modal.appointment} pet={petMap[modal.appointment.pet_id]} guardian={guardianMap[modal.appointment.guardian_id]} service={serviceMap[modal.appointment.service_id]} saving={saving} careReportLoading={careReportLoadingAppointmentId === modal.appointment.id} isReadOnly={isOwnerDemo} canViewGuardianContact={!isStaffApp} onClose={() => setModal(null)} onUpdate={(payload) => updateAppointmentWithMobilePhotoGuard(modal.appointment.id, payload)} onOpenCareReport={() => void openCareReport(modal.appointment.id)} /></Overlay> : null}{modal.type === "edit-shop-profile" ? <Overlay><ShopProfileEditForm data={data} saving={saving} onClose={() => setModal(null)} onSave={saveShopProfile} /></Overlay> : null}{modal.type === "new-appointment" ? <Overlay><NewAppointmentForm data={data} petId={modal.petId} saving={saving} canViewGuardianContact={!isStaffApp} onClose={() => setModal(null)} onNewCustomer={() => setModal({ type: "new-customer" })} onSave={createOwnerAppointment} /></Overlay> : null}{modal.type === "new-customer" ? <Overlay><NewCustomerForm shopId={data.shop.id} saving={saving} onClose={() => setModal(null)} onSave={async (guardianPayload, petPayloads) => {
        if (isOwnerDemo) {
          setModal(null);
          return;
        }
        if (newCustomerSaveInFlightRef.current) return;
        newCustomerSaveInFlightRef.current = true;
        setSaving(true);
        setError(null);
        try {
          await createGuardianAndPets({ shopId: data.shop.id, guardianPayload, petPayloads, request: fetchJson });
          await refresh();
          setModal(null);
        } catch (mutationError) {
          await handleRequestError(mutationError, "고객 저장에 실패했습니다.");
        } finally {
          newCustomerSaveInFlightRef.current = false;
          setSaving(false);
        }
      }} /></Overlay> : null}{modal.type === "add-pet" ? <Overlay><AddPetForm shopId={data.shop.id} guardianId={modal.guardianId} saving={saving} onClose={() => setModal(null)} onSave={(payload) => {
        if (!hasCurrentShopEntity(data.guardians, payload.guardianId, "고객")) return;
        return mutate("/api/pets", { method: "POST", body: JSON.stringify({ ...payload, shopId: data.shop.id }) });
      }} /></Overlay> : null}{modal.type === "edit-record" ? <Overlay><EditRecordForm shopId={data.shop.id} services={data.services} record={modal.record} saving={saving} onClose={() => setModal(null)} onSave={(payload) => mutate("/api/records", { method: "PATCH", body: JSON.stringify(payload) })} /></Overlay> : null}{modal.type === "stat" ? <Overlay><StatDetail kind={modal.kind} todayAppointments={filteredHomeConfirmedAppointmentsForStat} overdueRows={revisitRows.filter((item) => item.status === "overdue")} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} petDisplayPhotos={data.petDisplayPhotos ?? []} saving={saving} onUpdate={updateAppointmentWithMobilePhotoGuard} onOpenAppointment={(appointment) => setModal({ type: "appointment", appointment })} onClose={() => setModal(null)} /></Overlay> : null}</div>}
      {mobileGroomingStartAction ? (
        <OwnerMobileGroomingStartSheet
          stage={mobileGroomingStartAction.stage}
          busy={saving || mobilePhotoUploading || mobilePhotoPreparing}
          onClose={() => setMobileGroomingStartAction(null)}
          onConfirmEarly={() => {
            const action = mobileGroomingStartAction;
            if (!action.requestedMode) {
              setMobileGroomingStartAction({ ...action, stage: "choices" });
              return;
            }
            setMobileGroomingStartAction(null);
            if (action.requestedMode === "photo") {
              openMobilePhotoStatusAction(action.appointmentId, "in_progress", false, false);
              return;
            }
            startMobileAppointmentWithoutPhoto(action.appointmentId);
          }}
          onPhotoStart={() => {
            const action = mobileGroomingStartAction;
            setMobileGroomingStartAction(null);
            openMobilePhotoStatusAction(action.appointmentId, "in_progress", false, false);
          }}
          onStartWithoutPhoto={() => {
            const action = mobileGroomingStartAction;
            setMobileGroomingStartAction(null);
            startMobileAppointmentWithoutPhoto(action.appointmentId);
          }}
        />
      ) : null}
      {mobilePhotoStatusAction ? (
        <OwnerExternalPhotoSheet
          action={mobilePhotoStatusAction}
          busy={mobilePhotoUploading || mobilePhotoPreparing || saving}
          canUseCameraApps={canUseExternalCameraApps()}
          previewFile={mobilePhotoPreviewFile}
          recoveredPreview={mobilePhotoRecovered}
          allowSkip={mobilePhotoStatusAction.allowSkip !== false}
          onClose={() => {
            if (!mobilePhotoUploading && !mobilePhotoPreparing) {
              pendingPhotoActionRequestRef.current += 1;
              setMobilePhotoPreviewFile(null);
              setPendingMobilePhoto(null);
              setMobilePhotoRecovered(false);
              setMobilePhotoStatusAction(null);
            }
          }}
          onSkip={() => {
            const action = mobilePhotoStatusAction;
            if (!action) return;
            void clearStagedMobilePhoto(action)
              .catch(() => undefined)
              .finally(() => {
                setMobilePhotoPreviewFile(null);
                setPendingMobilePhoto(null);
                setMobilePhotoRecovered(false);
                setMobilePhotoStatusAction(null);
                void updateAppointment(action.appointmentId, { status: action.nextStatus });
              });
          }}
          onSelectFile={(file) => void selectMobilePhotoFile(file)}
          onCapture={(mode) => void captureMobilePhoto(mode)}
          onClearPreview={() => {
            const action = mobilePhotoStatusAction;
            if (!action) return;
            void clearStagedMobilePhoto(action).catch(() => {
              setError("임시 보관된 사진을 지우지 못했습니다. 다시 시도해 주세요.");
            });
          }}
          onConfirm={() => {
            if (mobilePhotoPreviewFile) void handleMobilePhotoStatusFile(mobilePhotoPreviewFile);
          }}
        />
      ) : null}
      {!isOwnerDemo && careReportAppointmentId && careReportInitialData ? (() => {
        const appointment = data.appointments.find((item) => item.id === careReportAppointmentId);
        const pet = appointment ? petMap[appointment.pet_id] : null;
        if (!appointment || !pet) return null;
        const staffName = appointment.staff_id ? staffMap[appointment.staff_id]?.name ?? "담당 디자이너" : "담당 디자이너";
        const publishedCareReport = normalizeCareReport(data.groomingRecords.find((record) => record.appointment_id === appointment.id)?.care_report_data);
        return <OwnerAiCareReportSheet key={appointment.id} shopId={data.shop.id} appointment={appointment} pet={pet} services={data.services} staffName={staffName} publishedCareReport={publishedCareReport} initialData={careReportInitialData} revisitReminderDefaultDays={data.shop.notification_settings.revisit_reminder_default_days ?? DEFAULT_REVISIT_REMINDER_DAYS} onClose={closeCareReport} onReturnToDetail={() => { closeCareReport(); setModal({ type: "appointment", appointment }); void refresh(); }} onPublished={() => { setPublishedCareReportFollowupKeys((previous) => new Set(previous).add(ownerTodayCareReportFollowupKey(appointment))); void refresh(); }} />;
      })() : null}
      {careReportEntryError ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0b1b2c]/35 px-5"><section role="alertdialog" aria-modal="true" aria-label="케어리포트 불러오기 실패" className="w-full max-w-[360px] rounded-[18px] border border-[#dce7f2] bg-white p-6"><p className="text-[16px] font-normal leading-6 text-[#101a31]">{careReportEntryError.message}</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setCareReportEntryError(null)} className="min-h-11 rounded-[10px] border border-[#d7e4f2] bg-white px-3 text-[16px] font-medium leading-6 text-[#526b84]">닫기</button><button type="button" onClick={() => { const appointmentId = careReportEntryError.appointmentId; setCareReportEntryError(null); void openCareReport(appointmentId); }} className="min-h-11 rounded-[10px] bg-[#2f6fd6] px-3 text-[16px] font-medium leading-6 text-white">다시 시도</button></div></section></div> : null}
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
    <div className="flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-[#f4f2ef] p-1 text-[12px] font-normal text-[#666058]">
      {appointmentInitial(name)}
    </div>
  );
}

function TodayPetPhoto({ name, src }: { name: string; src?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!src || imageFailed) {
    return (
      <span data-testid="today-pet-display-photo" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f4f2ef] text-[14px] font-normal text-[#666058]">
        {appointmentInitial(name)}
      </span>
    );
  }
  return (
    <span data-testid="today-pet-display-photo" className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#eef2f6]">
      {/* Signed bootstrap URLs are dynamic; this stays outside the static Next image allowlist. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
    </span>
  );
}

function AppointmentListTrailing({ status }: { status: AppointmentStatus | "record-completed" | "missed-pending" }) {
  if (status === "missed-pending") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full border border-[#ead8b8] bg-[#fff8eb] px-2.5 text-[12px] font-normal leading-none text-[#9a6a16]">
        누락
      </span>
    );
  }

  if (status === "record-completed" || status === "completed") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2.5 text-[12px] font-normal leading-none text-[var(--text)]">
        <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
        완료
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#f4f2ef] px-2.5 text-[12px] font-normal leading-none text-[#7b756e]">
        취소
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#f7f0e8] px-2.5 text-[12px] font-normal leading-none text-[#8b6b5d]">
        대기
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#f3f5f7] px-2.5 text-[12px] font-normal leading-none text-[var(--text)]">
        진행
      </span>
    );
  }

  if (status === "almost_done") {
    return (
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#f4f2ef] px-2.5 text-[12px] font-normal leading-none text-[#6a665f]">
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
      <div className="min-w-[42px] text-[16px] font-normal leading-none tracking-[-0.01em] text-[#0f172a]">{record.groomed_at.slice(11, 16)}</div>
      <div className="h-6 w-px shrink-0 bg-[#e1e7ef]" />
      <AppointmentMonogram name={pet.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[16px] font-normal leading-[20px] tracking-[-0.02em] text-[#0f172a]">{pet.name}</p>
          <span className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">{guardian.name}</span>
        </div>
        <p className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">{service?.name || "서비스"}</p>
      </div>
      <AppointmentListTrailing status="record-completed" />
    </div>
  );
}

function HomeScheduleTabs({
  tabs,
  activeKey,
  onChange,
  onAdd,
  trailing,
}: {
  tabs: Array<{ key: HomeReservationSectionKey; label: string; count: number }>;
  activeKey: HomeReservationSectionKey;
  onChange: (key: HomeReservationSectionKey) => void;
  onAdd?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="mt-3 flex items-end border-b border-[#edf1f5] px-0.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
            className={cn(
              "relative top-px flex min-h-11 shrink-0 items-center gap-[5px] border-b-2 pb-[11px] text-[14px] font-medium tracking-[-0.01em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]",
              active ? "border-[#2f6fd6] text-[#0f172a]" : "border-transparent text-[#64748b]",
              )}
              onClick={() => onChange(tab.key)}
              aria-pressed={active}
            >
              <span className="whitespace-nowrap text-center">{tab.label}</span>
              <span className={cn("text-[14px] font-medium", active ? "text-[#2f6fd6]" : "text-[#64748b]")}>{tab.count}</span>
            </button>
          );
        })}
      </div>
      {trailing ? <div className="relative top-px mb-[5px] shrink-0">{trailing}</div> : null}
      {onAdd ? (
        <div className="relative top-px shrink-0 border-b-2 border-transparent pb-[7px]">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#d8e4f5] bg-white text-[#2f6fd6] transition hover:bg-[#f4f8ff]"
            onClick={onAdd}
            aria-label="예약추가"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HomeHeaderStaffSelect({
  options,
  value,
  onChange,
  staffCount,
}: {
  options: Array<{
    key: HomeStaffFilterKey;
    label: string;
    count: number;
    profileImageUrl?: string | null;
    profileImageFallbackKey?: string | null;
  }>;
  value: HomeStaffFilterKey;
  onChange: (value: HomeStaffFilterKey) => void;
  staffCount: number;
}) {
  const selectedOption = options.find((option) => option.key === value) ?? options[0];
  const staffOptions = options.filter((option) => option.key !== "all" && option.key !== "unassigned");
  const visibleStaffPhotos = staffOptions.slice(0, 3);
  const showStaffStack = staffCount > 1 && value === "all";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative h-11 min-w-[120px] shrink-0">
      <button
        type="button"
        className={cn(
          "flex h-full w-full items-center gap-2 rounded-[10px] bg-[#f4f6f9] px-3 pr-8 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]",
          open ? "bg-[#eef3fb] ring-1 ring-[#d8e4f5]" : "hover:bg-[#eef3fb]",
        )}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={showStaffStack ? `전체 담당자 ${staffOptions.length}명 선택` : `${selectedOption?.label ?? "담당자"} 담당자 선택`}
      >
        {showStaffStack ? (
          <div className="flex shrink-0 items-center" aria-hidden="true">
            {visibleStaffPhotos.map((staffOption, index) => (
              <span key={staffOption.key} className={cn("h-[22px] w-[22px] overflow-hidden rounded-full border-[1.5px] border-[#f4f6f9] bg-[#e8edf3]", index > 0 ? "-ml-2" : "")}>
                <StaffProfilePhoto
                  src={staffOption.profileImageUrl}
                  fallbackKey={staffOption.profileImageFallbackKey}
                  alt=""
                />
              </span>
            ))}
            {staffOptions.length > visibleStaffPhotos.length ? (
              <span className="-ml-1 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-[1.5px] border-[#f4f6f9] bg-[#e8edf3] px-1 text-[11px] font-medium leading-none text-[#526174]">
                +{staffOptions.length - visibleStaffPhotos.length}
              </span>
            ) : null}
          </div>
        ) : (
          selectedOption?.profileImageUrl || selectedOption?.profileImageFallbackKey ? (
            <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#e8edf3]">
              <StaffProfilePhoto
                src={selectedOption.profileImageUrl}
                fallbackKey={selectedOption.profileImageFallbackKey}
                alt=""
              />
            </span>
          ) : (
            <UserRound className="h-4 w-4 shrink-0 text-[#64748b]" strokeWidth={1.8} />
          )
        )}
        <span className="min-w-0 truncate text-[14px] font-medium tracking-[-0.01em] text-[#334155]">
          {showStaffStack ? "전체" : selectedOption?.label ?? "담당자"}
        </span>
      </button>
      <ChevronDown className={cn("pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8] transition", open ? "rotate-180" : "")} strokeWidth={2} />

      {open ? (
        <div className="absolute right-0 top-[50px] z-50 w-[164px] overflow-hidden rounded-[14px] border border-[#dbe5f1] bg-white p-1.5 shadow-[0_14px_32px_rgba(15,23,42,0.14)]" role="listbox">
          {options.map((option) => {
            const active = option.key === value;
            const label = option.key === "all" ? option.label : option.label;
            return (
              <button
                key={option.key}
                type="button"
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-2 rounded-[10px] px-3 text-left text-[14px] tracking-[-0.01em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]",
                  active ? "bg-[#eef4ff] font-medium text-[#2f6fd6]" : "font-normal text-[#334155] hover:bg-[#f8fafc]",
                )}
                onClick={() => {
                  onChange(option.key);
                  setOpen(false);
                }}
                role="option"
                aria-selected={active}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {option.key !== "all" && option.key !== "unassigned" ? (
                    <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#e8edf3]">
                      <StaffProfilePhoto
                        src={option.profileImageUrl}
                        fallbackKey={option.profileImageFallbackKey}
                        alt=""
                      />
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate">{label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {option.key !== "all" ? <span className={cn("text-[12px]", active ? "text-[#2f6fd6]" : "text-[#94a3b8]")}>{option.count}건</span> : null}
                  {active ? <Check className="h-4 w-4" strokeWidth={2.2} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AppointmentRow({ appointment, pet, guardian, service, onClick }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 rounded-[12px] border border-[#e1e7ef] bg-white px-[14px] py-[10px] text-left transition hover:bg-[#f8fafc]">
      <div className="min-w-[42px] text-[16px] font-normal leading-none tracking-[-0.01em] text-[#0f172a]">{formatClockTime(appointment.appointment_time)}</div>
      <div className="h-6 w-px shrink-0 bg-[#e1e7ef]" />
      <AppointmentMonogram name={pet.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[16px] font-normal leading-[20px] tracking-[-0.02em] text-[#0f172a]">{pet.name}</p>
          <span className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">{guardian.name}</span>
        </div>
        <p className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">{service.name}</p>
      </div>
      <AppointmentListTrailing status={appointment.status} />
    </button>
  );
}

const APPOINTMENT_DETAIL_SECTION_HEADING_CLASS =
  "text-[16px] font-semibold leading-6 tracking-[-0.005em] text-[#101a31]";
const APPOINTMENT_DETAIL_HISTORY_HEADING_CLASS =
  "text-[16px] font-semibold leading-6 text-[var(--text)]";

function AppointmentDetailInfoRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 max-[300px]:grid-cols-1 max-[300px]:gap-0">
      <span className="text-[14px] font-medium leading-5 tracking-[-0.005em] text-[#64748b]">{label}</span>
      <p className={`min-w-0 text-[16px] font-normal leading-6 tracking-[-0.005em] [overflow-wrap:anywhere] ${muted ? "text-[#64748b]" : "text-[var(--text)]"}`}>{value}</p>
    </div>
  );
}

function AppointmentVisitWeightEditor({ shopId, appointmentId, disabled, transport = ownerAppointmentVisitWeightTransport }: { shopId: string; appointmentId: string; disabled: boolean; transport?: OwnerAppointmentVisitWeightTransport }) {
  const [weight, setWeight] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const idempotencyKeys = useRef(new Map<string, string>());
  const weightInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = weightInputRef.current;
    const viewport = window.visualViewport;
    if (!input || !viewport) return;

    let frame: number | null = null;
    const keepInputVisible = () => {
      if (document.activeElement !== input) return;
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const scrollport = input.closest<HTMLElement>(".overflow-y-auto");
        if (!scrollport) return;
        const inputRect = input.getBoundingClientRect();
        const scrollportRect = scrollport.getBoundingClientRect();
        const centeredTop = scrollport.scrollTop
          + inputRect.top
          - scrollportRect.top
          - Math.max(0, (scrollport.clientHeight - inputRect.height) / 2);
        if (Math.abs(scrollport.scrollTop - centeredTop) > 1) {
          scrollport.scrollTop = centeredTop;
        }
      });
    };
    const stopKeepingInputVisible = () => {
      viewport.removeEventListener("resize", keepInputVisible);
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    };
    const startKeepingInputVisible = () => {
      keepInputVisible();
      viewport.addEventListener("resize", keepInputVisible);
    };

    input.addEventListener("focus", startKeepingInputVisible);
    input.addEventListener("blur", stopKeepingInputVisible);
    return () => {
      input.removeEventListener("focus", startKeepingInputVisible);
      input.removeEventListener("blur", stopKeepingInputVisible);
      stopKeepingInputVisible();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    setIsError(false);
    void transport.fetch(shopId, appointmentId)
      .then((nextResponse) => {
        if (cancelled) return;
        setWeight(nextResponse.current ? String(nextResponse.current.weightKg) : "");
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("오늘 몸무게를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
          setIsError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [appointmentId, shopId, transport]);

  const saveWeight = async () => {
    const normalized = weight.trim().replace(",", ".");
    const weightKg = Number(normalized);
    if (!Number.isFinite(weightKg) || weightKg < 0.1 || weightKg > 200) {
      setMessage("0.1kg부터 200kg 사이의 숫자로 입력해 주세요.");
      setIsError(true);
      return;
    }

    const idempotencyKey = idempotencyKeys.current.get(normalized) ?? crypto.randomUUID();
    idempotencyKeys.current.set(normalized, idempotencyKey);
    setSaving(true);
    setMessage(null);
    setIsError(false);
    try {
      await transport.put({ shopId, appointmentId, weightKg, idempotencyKey });
      const readback = await transport.fetch(shopId, appointmentId);
      if (!readback.current || readback.current.appointmentId !== appointmentId || readback.current.weightKg !== weightKg) {
        throw new Error("readback_mismatch");
      }
      setWeight(String(readback.current.weightKg));
    } catch {
      setMessage("오늘 몸무게를 저장하지 못했어요. 입력값은 그대로 남아 있어요.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-t border-[#e8edf3] px-1 py-3" aria-labelledby={`visit-weight-${appointmentId}`}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={`visit-weight-${appointmentId}`} className={APPOINTMENT_DETAIL_SECTION_HEADING_CLASS}>오늘 몸무게</h2>
      </div>
      <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_84px] gap-2 max-[300px]:grid-cols-[minmax(0,1fr)_auto]">
        <label className="sr-only" htmlFor={`visit-weight-input-${appointmentId}`}>오늘 몸무게(kg)</label>
        <input
          ref={weightInputRef}
          id={`visit-weight-input-${appointmentId}`}
          inputMode="decimal"
          value={weight}
          onChange={(event) => { setWeight(event.target.value); setMessage(null); setIsError(false); }}
          placeholder="kg"
          disabled={disabled || loading || saving}
          className="min-h-11 min-w-0 rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-[16px] font-medium leading-6 text-[#101a31] outline-none placeholder:text-[#94a3b8] focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:bg-[#f8fafc] disabled:text-[#64748b]"
        />
        <span className="flex min-h-11 items-center text-[16px] font-medium leading-6 text-[#64748b]" aria-hidden="true">kg</span>
        <button
          type="button"
          onClick={() => void saveWeight()}
          disabled={disabled || loading || saving}
          className="min-h-11 rounded-[10px] bg-[#111a30] px-3 text-[16px] font-medium leading-6 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
        >
          {saving ? "저장 중" : "저장"}
        </button>
      </div>
      {message ? <p role="status" className={`mt-2 text-[14px] leading-5 ${isError ? "font-medium text-[#9a5e4e]" : "font-normal text-[#1f6b5b]"}`}>{message}</p> : null}
    </section>
  );
}

function AppointmentDetailMediaHistory({ shopId, appointment }: { shopId: string; appointment: Appointment }) {
  const [items, setItems] = useState<AppointmentMediaPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAppointmentMedia() {
      setLoading(true);
      setLoadError("");
      try {
        const binding: OwnerMediaBinding = {
          shopId,
          appointmentId: appointment.id,
          guardianId: appointment.guardian_id,
          petId: appointment.pet_id,
        };
        const query = new URLSearchParams({
          shopId,
          appointmentId: appointment.id,
          guardianId: appointment.guardian_id,
          petId: appointment.pet_id,
          includeVariants: "true",
          limit: "8",
        });
        const list = await fetchJson<{ items: MediaAssetListItem[] }>(`/api/owner/media/assets?${query.toString()}`);
        const visibleItems = list.items.filter((item) =>
          isOwnerMediaItemBoundToAppointment(item, binding) &&
          ["grooming_before", "grooming_after", "grooming_result"].includes(item.mediaAsset.media_kind),
        );
        const signed = visibleItems.length > 0
          ? await fetchJson<SignedMediaUrlsResponse>("/api/owner/media/signed-urls", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                shopId,
                items: visibleItems.map((item) => ({ mediaAssetId: item.mediaAsset.id, variant: "provider_ready" })),
              }),
            })
          : { items: [] };
        const signedUrlByAssetId = new Map(
          signed.items.flatMap((item) => item.mediaAssetId && item.signedUrl ? [[item.mediaAssetId, item.signedUrl] as const] : []),
        );
        const previews = visibleItems.map((item) => ({
          item,
          signedUrl: signedUrlByAssetId.get(item.mediaAsset.id) ?? null,
        }));
        if (!cancelled) setItems((current) => mergeOwnerMediaPreviews(current, previews, binding));
      } catch {
        if (!cancelled) setLoadError("사진 기록 일부를 표시하지 못했습니다. 저장된 항목은 유지됩니다. 화면을 다시 열어 확인해 주세요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAppointmentMedia();
    return () => {
      cancelled = true;
    };
  }, [appointment.guardian_id, appointment.id, appointment.pet_id, shopId]);

  return (
    <section className="border-b border-[#e8edf3] px-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className={APPOINTMENT_DETAIL_HISTORY_HEADING_CLASS}>사진 기록</h2>
        <span className="text-[13px] font-medium leading-5 text-[var(--muted)]">{loading ? "확인 중" : `${items.length}장`}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-[14px] font-normal leading-5 text-[var(--muted)]">
          {loading ? "사진 기록을 불러오고 있어요." : "이 예약에 연결된 시작/완료 사진이 아직 없어요."}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {items.map(({ item, signedUrl }) => {
            const content = <>
              <div className="aspect-[4/3] overflow-hidden bg-[#eef2f6]">
                {signedUrl ? (
                  <img
                    src={signedUrl}
                    alt={getAppointmentMediaKindLabel(item.mediaAsset.media_kind)}
                    className="h-full w-full object-cover transition group-active:scale-[0.99]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center text-[13px] font-medium leading-5 text-[#64748b]">
                    사진 주소를 확인하지 못했어요
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="truncate text-[14px] font-medium leading-5 text-[var(--text)]">{getAppointmentMediaKindLabel(item.mediaAsset.media_kind)}</span>
                <span className="shrink-0 text-[13px] font-normal leading-5 text-[var(--muted)]">{item.mediaAsset.status === "ready" ? "저장됨" : "처리 중"}</span>
              </div>
            </>;
            return signedUrl ? (
              <a key={item.mediaAsset.id} href={signedUrl} target="_blank" rel="noreferrer" className="group min-h-11 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[#f8fafc]">
                {content}
              </a>
            ) : (
              <div key={item.mediaAsset.id} className="min-h-11 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[#f8fafc]">
                {content}
              </div>
            );
          })}
        </div>
      )}
      {loadError ? <p role="alert" className="mt-2 text-[13px] font-medium leading-5 text-[#9a5e4e]">{loadError}</p> : null}
    </section>
  );
}

export function AppointmentDetail({ data, appointment, pet, guardian, service, saving, careReportLoading = false, isReadOnly = false, canViewGuardianContact = true, visitWeightTransport, showMediaHistory = true, onClose, onUpdate, onOpenCareReport }: { data: BootstrapPayload; appointment: Appointment; pet: Pet; guardian: Guardian; service: Service; saving: boolean; careReportLoading?: boolean; isReadOnly?: boolean; canViewGuardianContact?: boolean; visitWeightTransport?: OwnerAppointmentVisitWeightTransport; showMediaHistory?: boolean; onClose: () => void; onUpdate: (payload: AppointmentUpdatePayload) => void; onOpenCareReport: () => void }) {
  const [notificationPageState, setNotificationPageState] = useState({ appointmentId: appointment.id, page: 1 });
  const [careReportStatus, setCareReportStatus] = useState<"before" | "draft" | "published">("before");
  const canEditSchedule = ["pending", "confirmed"].includes(appointment.status);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [serviceId, setServiceId] = useState(appointment.service_id);
  const [date, setDate] = useState(appointment.appointment_date);
  const [time, setTime] = useState(appointment.appointment_time);
  const [staffMemo, setStaffMemo] = useState(appointment.staff_memo ?? "");
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const cancelActionRef = useRef<HTMLButtonElement | null>(null);
  const cancelConfirmRef = useRef<HTMLButtonElement | null>(null);
  const wasCancelConfirmOpen = useRef(false);
  const completedGroomingRecord = data.groomingRecords.find((record) => record.appointment_id === appointment.id);
  const hasPublishedCareReport = Boolean(
    completedGroomingRecord?.care_report_data || completedGroomingRecord?.care_report_owner_confirmed_at,
  );
  const hasLocalCareReportDraft = !hasPublishedCareReport && Boolean(readOwnerCareReportLocalDraft(data.shop.id, appointment.id));

  useEffect(() => {
    let active = true;
    if (isReadOnly || appointment.status !== "completed" || hasPublishedCareReport) return;
    void fetchApiJsonWithAuth<{ draft: unknown | null }>(`/api/owner/grooming-record-drafts?${new URLSearchParams({ shopId: data.shop.id, appointmentId: appointment.id }).toString()}`, { cache: "no-store" })
      .then((result) => { if (active) setCareReportStatus(result.draft ? "draft" : "before"); })
      .catch(() => { if (active) setCareReportStatus("before"); });
    return () => { active = false; };
  }, [appointment.id, appointment.status, data.shop.id, hasPublishedCareReport, isReadOnly]);
  const resolvedCareReportStatus = hasPublishedCareReport ? "published" : (hasLocalCareReportDraft || careReportStatus === "draft" ? "draft" : "before");
  const selectableServices = useMemo(
    () =>
      data.services
        .filter((item) => isBookableOwnerService(item) || (item.id === appointment.service_id && item.name.trim() !== "새 항목"))
        .sort((first, second) => (first.sort_order ?? 0) - (second.sort_order ?? 0)),
    [appointment.service_id, data.services],
  );
  const serviceGroups = useMemo(
    () =>
      Array.from(
        new Set(
          selectableServices
            .map((item) => item.category?.trim())
            .filter((category): category is string => Boolean(category)),
        ),
      ),
    [selectableServices],
  );
  const [selectedServiceGroup, setSelectedServiceGroup] = useState(
    () => data.services.find((item) => item.id === appointment.service_id)?.category?.trim() || "전체",
  );
  const selectedService = selectableServices.find((item) => item.id === serviceId) ?? service;
  const selectedStaffName = appointment.staff_id
    ? data.staffMembers.find((staffMember) => staffMember.id === appointment.staff_id)?.name ?? "담당 미확인"
    : "미배정";
  const expectedEndTime = useMemo(() => {
    if (!time || !selectedService) return "";
    const endMinutes = minutesFromTime(time) + selectedService.duration_minutes;
    const normalizedMinutes = ((endMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`;
  }, [selectedService, time]);
  const visibleServices = useMemo(
    () =>
      selectedServiceGroup === "전체"
        ? selectableServices
        : selectableServices.filter((item) => item.category?.trim() === selectedServiceGroup),
    [selectableServices, selectedServiceGroup],
  );
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
    staffMemo !== (appointment.staff_memo ?? "");
  const canSaveSchedule = Boolean(serviceId && time && hasEditChanges && !saving);
  const canCancelAppointment = ["pending", "confirmed", "in_progress", "almost_done"].includes(appointment.status);
  const notificationPageSize = 5;
  const appointmentNotifications = useMemo(
    () =>
      data.notifications
        .filter((notification) => {
          if (notification.appointment_id === appointment.id) return true;
          const metadataAppointmentId = notification.metadata?.appointmentId ?? notification.metadata?.appointment_id;
          if (metadataAppointmentId === appointment.id) return true;
          return (
            notification.type === "booking_cancelled" &&
            !notification.appointment_id &&
            notification.guardian_id === appointment.guardian_id &&
            notification.pet_id === appointment.pet_id
          );
        })
        .sort((first, second) => (second.sent_at ?? second.created_at).localeCompare(first.sent_at ?? first.created_at)),
    [appointment.guardian_id, appointment.id, appointment.pet_id, data.notifications],
  );
  const totalNotificationPages = Math.max(1, Math.ceil(appointmentNotifications.length / notificationPageSize));
  const notificationPage =
    notificationPageState.appointmentId === appointment.id
      ? Math.min(notificationPageState.page, totalNotificationPages)
      : 1;
  const pagedAppointmentNotifications = appointmentNotifications.slice(
    (notificationPage - 1) * notificationPageSize,
    notificationPage * notificationPageSize,
  );
  const appointmentFooter =
    canEditSchedule && isEditingSchedule ? (
      <ActionButton
        disabled={!canSaveSchedule}
        onClick={() => onUpdate({ mode: "edit", serviceId, appointmentDate: date, appointmentTime: time, staffMemo })}
      >
        예약 수정 저장
      </ActionButton>
    ) : canViewGuardianContact ? (
      <div className="-mt-2.5">
        <QuickContactRow
          phone={guardian.phone}
          sending={saving}
        />
      </div>
    ) : null;

  const openScheduleEditing = () => {
    setServiceId(appointment.service_id);
    setDate(appointment.appointment_date);
    setTime(appointment.appointment_time);
    setStaffMemo(appointment.staff_memo ?? "");
    setSelectedServiceGroup(data.services.find((item) => item.id === appointment.service_id)?.category?.trim() || "전체");
    setIsEditingSchedule(true);
  };

  const closeScheduleEditing = () => {
    setServiceId(appointment.service_id);
    setDate(appointment.appointment_date);
    setTime(appointment.appointment_time);
    setStaffMemo(appointment.staff_memo ?? "");
    setSelectedServiceGroup(data.services.find((item) => item.id === appointment.service_id)?.category?.trim() || "전체");
    setIsEditingSchedule(false);
  };

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

  useEffect(() => {
    if (isCancelConfirmOpen) {
      wasCancelConfirmOpen.current = true;
      cancelConfirmRef.current?.focus();
      return;
    }
    if (wasCancelConfirmOpen.current) {
      wasCancelConfirmOpen.current = false;
      cancelActionRef.current?.focus();
    }
  }, [isCancelConfirmOpen]);

  return (
    <Sheet
      title={ownerHomeCopy.appointmentDetailTitle}
      onClose={onClose}
      footer={appointmentFooter}
      prominentTitle
    >
      <div className="space-y-3">
        <div className="px-1 text-[16px] leading-6">
          <div className="flex min-w-0 items-start justify-between gap-3 max-[300px]:flex-col max-[300px]:items-stretch">
            <p className="min-w-0 text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[var(--text)] [overflow-wrap:anywhere]">
              {pet.name} {ownerHomeCopy.separator} {guardian.name}
            </p>
            {canEditSchedule && !isEditingSchedule ? (
              <button
                type="button"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] bg-[#eaf2ff] px-3 text-[16px] font-medium leading-6 tracking-[-0.005em] text-[var(--accent)] max-[300px]:w-full"
                onClick={openScheduleEditing}
              >
                예약 일정 수정
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2.5 border-y border-[#e8edf3] py-3">
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
          </div>
          <section className="mt-3 pb-3">
            <div>
              <h2 className={APPOINTMENT_DETAIL_SECTION_HEADING_CLASS}>고객 요청 메모</h2>
              <p className={`mt-1 whitespace-pre-wrap text-[16px] font-normal leading-6 [overflow-wrap:anywhere] ${appointment.memo ? "text-[#33404f]" : "text-[#64748b]"}`}>{appointment.memo || "고객이 남긴 요청 메모가 없어요."}</p>
            </div>
            <div className="mt-3 border-t border-[#e8edf3] pt-3">
              <h2 className={APPOINTMENT_DETAIL_SECTION_HEADING_CLASS}>담당자 메모</h2>
              <p className={`mt-1 whitespace-pre-wrap text-[16px] font-normal leading-6 [overflow-wrap:anywhere] ${appointment.staff_memo ? "text-[#33404f]" : "text-[#64748b]"}`}>{appointment.staff_memo || "담당자 메모가 없어요."}</p>
            </div>
          </section>
          {appointment.rejection_reason && (
            <p className="mt-3 rounded-[14px] bg-[#fff6f4] px-3 py-2 text-[14px] font-medium leading-5 text-[#a04455]">
              미승인 사유: {appointment.rejection_reason}
            </p>
          )}
          {canEditSchedule && isEditingSchedule ? (
            <div className="mt-3 space-y-3 border-t border-[#e1e9f1] pt-3">
              <button
                type="button"
                onClick={closeScheduleEditing}
                className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-[10px] px-2 text-[14px] font-medium text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                예약 상세로
              </button>
              {serviceGroups.length > 0 ? (
                <div>
                  <p className="px-1 pb-2 text-[14px] font-medium leading-5 text-[var(--muted)]">서비스 그룹</p>
                  <HorizontalDragScroll>
                    {['전체', ...serviceGroups].map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setSelectedServiceGroup(group)}
                        className={`min-h-11 shrink-0 rounded-full border px-3.5 py-2 text-[14px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${
                          selectedServiceGroup === group
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--border)] bg-white text-[var(--text)]"
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </HorizontalDragScroll>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                {visibleServices.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`min-h-11 rounded-2xl border px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${
                      serviceId === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-white"
                    }`}
                    onClick={() => setServiceId(item.id)}
                  >
                    <p className="text-[16px] font-medium leading-6 text-[var(--text)]">{item.name}</p>
                    <p className="mt-1 text-[16px] font-normal leading-6 text-[var(--muted)]">{won(item.price)}</p>
                  </button>
                ))}
              </div>
              <div className="rounded-2xl bg-[#f8fafc] p-2">
                <p className="px-2 pb-2 text-[14px] font-medium leading-5 text-[var(--muted)]">날짜</p>
                <HorizontalDragScroll>
                  {dateOptions.map((item, index) => (
                    <button
                      key={item}
                      type="button"
                      className={`min-h-11 min-w-[110px] shrink-0 rounded-2xl border px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${
                        date === item ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-white text-[var(--text)]"
                      }`}
                      onClick={() => setDate(item)}
                    >
                      <span className="text-[16px] font-medium leading-6">{index === 0 && item === currentDateInTimeZone() ? "오늘" : shortDate(item)}</span>
                    </button>
                  ))}
                </HorizontalDragScroll>
              </div>
              <div className="rounded-2xl bg-[#f8fafc] p-2">
                <p className="px-2 pb-2 text-[14px] font-medium leading-5 text-[var(--muted)]">시간</p>
                {slots.length === 0 ? (
                  <div className="rounded-2xl bg-white px-4 py-5 text-center text-[14px] font-normal leading-5 text-[var(--muted)]">선택한 날짜에 가능한 시간이 없어요.</div>
                ) : (
                  <HorizontalDragScroll>
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`min-h-11 min-w-[92px] shrink-0 rounded-[14px] border px-4 py-3 text-center text-[16px] font-medium leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] ${
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
              <div className="rounded-[14px] border border-[#e8edf3] bg-white px-4 py-3" aria-label="변경할 예약 시간 요약">
                <div className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-[14px] leading-5">
                  <span className="font-medium text-[#64748b]">현재 담당</span>
                  <span className="min-w-0 font-medium text-[#101a31] [overflow-wrap:anywhere]">{selectedStaffName}</span>
                  <span className="font-medium text-[#64748b]">선택 시작</span>
                  <span className="font-medium tabular-nums text-[#101a31]">{time ? formatClockTime(time) : "시간을 선택해 주세요"}</span>
                  <span className="font-medium text-[#64748b]">예상 종료</span>
                  <span className="font-medium tabular-nums text-[#101a31]">{expectedEndTime ? formatClockTime(expectedEndTime) : "-"}</span>
                  <span className="font-medium text-[#64748b]">소요시간</span>
                  <span className="font-medium text-[#101a31]">{selectedService.duration_minutes}분</span>
                </div>
              </div>
              <Field label="담당자 메모">
                <textarea
                  value={staffMemo}
                  onChange={(event) => setStaffMemo(event.target.value)}
                  className="field min-h-24"
                  placeholder="매장 내부 참고 메모를 남겨 주세요"
                />
              </Field>
            </div>
          ) : null}
        </div>
        {!isEditingSchedule && !isReadOnly ? <AppointmentVisitWeightEditor shopId={data.shop.id} appointmentId={appointment.id} disabled={saving} transport={visitWeightTransport} /> : null}
        {!isEditingSchedule && canCancelAppointment ? (
          <section className="border-b border-[#e8edf3] pb-3">
            <button
              type="button"
              ref={cancelActionRef}
              onClick={() => setIsCancelConfirmOpen(true)}
              disabled={saving}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[10px] border border-[#d8bfc5] bg-white px-3 text-[16px] font-medium leading-6 text-[#9a5e4e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a5e4e] focus-visible:ring-offset-2 disabled:opacity-50"
            >
              예약 취소
            </button>
            {isCancelConfirmOpen ? (
              <div role="alertdialog" aria-modal="true" aria-label="예약 취소 확인" className="mt-2 rounded-[10px] border border-[#ead5d9] bg-[#fff7f8] p-3">
                <p className="text-[14px] font-medium leading-5 text-[#101a31]">이 예약을 취소할까요?</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button ref={cancelConfirmRef} type="button" onClick={() => setIsCancelConfirmOpen(false)} disabled={saving} className="min-h-11 rounded-[10px] border border-[#d8e0e9] bg-white px-3 text-[16px] font-medium leading-6 text-[#475569] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">유지</button>
                  <button type="button" onClick={() => onUpdate({ status: "cancelled" })} disabled={saving} className="min-h-11 rounded-[10px] bg-[#9a5e4e] px-3 text-[16px] font-medium leading-6 text-white disabled:opacity-50">예약 취소</button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
        {appointment.status === "completed" ? (
          <div className="rounded-[14px] border border-[#d4e3f2] bg-[#f8fbfe] p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-[16px] font-semibold leading-6 text-[#526b84]">케어리포트</span><span className={`text-[13px] font-medium leading-5 ${resolvedCareReportStatus === "published" ? "text-[#2f8c72]" : resolvedCareReportStatus === "draft" ? "text-[#4b77b6]" : "text-[#64748b]"}`}>{resolvedCareReportStatus === "published" ? "발송 완료" : resolvedCareReportStatus === "draft" ? "임시저장" : "작성 전"}</span></div>
            <button type="button" onClick={onOpenCareReport} disabled={careReportLoading} aria-busy={careReportLoading} className="flex h-11 w-full items-center justify-center gap-2 rounded-[11px] border border-[#c9ddef] bg-white text-[16px] font-semibold text-[#326fac] disabled:opacity-60">
              {careReportLoading ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="h-4 w-4" />}{resolvedCareReportStatus === "published" ? "케어리포트 보기" : resolvedCareReportStatus === "draft" ? "이어서 작성" : "AI 케어리포트 작성"}
            </button>
          </div>
        ) : null}
        {!isReadOnly && showMediaHistory ? <AppointmentDetailMediaHistory shopId={data.shop.id} appointment={appointment} /> : null}
        {!isEditingSchedule ? (
          <section className="pt-3" aria-labelledby={`appointment-notification-history-${appointment.id}`}>
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 id={`appointment-notification-history-${appointment.id}`} className={APPOINTMENT_DETAIL_HISTORY_HEADING_CLASS}>알림톡 이력</h2>
              <span className="text-[13px] font-medium leading-5 text-[var(--muted)]">{appointmentNotifications.length}건</span>
            </div>
            <div className="mt-2 divide-y divide-[#e8edf3]">
              {appointmentNotifications.length === 0 ? (
                <p className="px-1 py-3 text-[14px] font-normal leading-5 text-[var(--muted)]">이 예약으로 발송된 알림톡이 아직 없어요.</p>
              ) : (
                pagedAppointmentNotifications.map((notification) => (
                  <NotificationHistoryRow key={notification.id} notification={notification} pet={pet} />
                ))
              )}
            </div>
            <CustomerDetailHistoryPagination
              page={notificationPage}
              totalPages={totalNotificationPages}
              onChange={(page) => setNotificationPageState({ appointmentId: appointment.id, page })}
            />
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}

function isBookableOwnerService(service: Service) {
  const name = service.name.trim();
  return service.is_active && name.length > 0 && name !== "새 항목";
}

function NewAppointmentForm({ data, petId, saving, canViewGuardianContact = true, onClose, onNewCustomer, onSave }: { data: BootstrapPayload; petId?: string; saving: boolean; canViewGuardianContact?: boolean; onClose: () => void; onNewCustomer: () => void; onSave: (payload: unknown) => void | Promise<void> }) {
  const [selectedPetId, setSelectedPetId] = useState(petId || "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState(() => (data.staffMembers.length === 1 ? data.staffMembers[0]?.id ?? "" : ""));
  const [date, setDate] = useState(currentDateInTimeZone());
  const [time, setTime] = useState("");
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<"customer" | "service" | "schedule" | "memo">(petId ? "service" : "customer");

  const selectedPet = data.pets.find((item) => item.id === selectedPetId);
  const selectedGuardian = selectedPet ? data.guardians.find((item) => item.id === selectedPet.guardian_id) : undefined;
  const selectableServices = useMemo(
    () =>
      data.services
        .filter(isBookableOwnerService)
        .sort((first, second) => (first.sort_order ?? 0) - (second.sort_order ?? 0)),
    [data.services],
  );
  const selectableStaffMembers = useMemo(
    () => [...data.staffMembers].sort((first, second) => first.name.localeCompare(second.name, "ko")),
    [data.staffMembers],
  );
  const dateOptions = useMemo(() => Array.from({ length: 14 }, (_, index) => addDate(currentDateInTimeZone(), index)), []);
  const slots = computeAvailableSlots({
    date,
    serviceId,
    shop: data.shop,
    services: selectableServices,
    appointments: data.appointments,
  });
  const filteredGuardianGroups = useMemo(() => {
    const query = customerQuery.trim();
    const normalizedPhoneQuery = phoneNormalize(query);
    return data.guardians
      .map((guardian) => {
        const pets = data.pets.filter((pet) => pet.guardian_id === guardian.id);
        return { guardian, pets };
      })
      .filter((row) => {
        if (!row.pets.length) return false;
        if (!query) return true;
        return (
          row.guardian.name.includes(query) ||
          (canViewGuardianContact && row.guardian.phone.includes(query)) ||
          (canViewGuardianContact && normalizedPhoneQuery ? phoneNormalize(row.guardian.phone).includes(normalizedPhoneQuery) : false) ||
          row.pets.some((pet) => pet.name.includes(query))
        );
      });
  }, [canViewGuardianContact, customerQuery, data.guardians, data.pets]);
  const selectableGuardianPetPairs = useMemo(
    () => flattenAppointmentGuardianPetPairs(filteredGuardianGroups),
    [filteredGuardianGroups],
  );

  const canMoveToService = Boolean(selectedPet);
  const canMoveToSchedule = Boolean(serviceId && selectedStaffId);
  const canSave = Boolean(selectedPet && time && serviceId && selectedStaffId && !saving);
  const footer =
    step === "customer" ? (
      <ActionButton disabled={!canMoveToService} onClick={() => setStep("service")}>다음</ActionButton>
    ) : step === "service" ? (
      <div className="grid grid-cols-2 gap-2">
        <ActionButton variant="ghost" onClick={() => setStep("customer")}>이전</ActionButton>
        <ActionButton disabled={!canMoveToSchedule} onClick={() => setStep("schedule")}>다음</ActionButton>
      </div>
    ) : step === "schedule" ? (
      <div className="grid grid-cols-2 gap-2">
        <ActionButton variant="ghost" onClick={() => setStep("service")}>이전</ActionButton>
        <ActionButton disabled={!time} onClick={() => setStep("memo")}>다음</ActionButton>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        <ActionButton variant="ghost" onClick={() => setStep("schedule")}>이전</ActionButton>
        <ActionButton
          disabled={!canSave}
          onClick={() =>
            void onSave({
              shopId: data.shop.id,
              guardianId: selectedPet?.guardian_id,
              petId: selectedPetId,
              serviceId,
              staffId: selectedStaffId,
              appointmentDate: date,
              appointmentTime: time,
              memo,
              source: "owner",
            })
          }
        >
          {saving ? "등록 중…" : "예약 등록"}
        </ActionButton>
      </div>
    );

  const sheetTitle = step === "service" ? "서비스 선택" : step === "schedule" ? "날짜 / 시간 선택" : step === "memo" ? "메모" : "새 예약 추가";

  return (
    <Sheet title={sheetTitle} onClose={onClose} footer={footer}>
      <div className="space-y-4">
        {step === "customer" ? (
          <div className="space-y-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1 rounded-[10px] border border-[#dbe5f1] bg-white px-3">
                <input aria-label="고객 검색" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="보호자명 또는 아기 이름 검색" className="min-h-11 w-full bg-transparent text-[16px] outline-none placeholder:text-[#94a3b8]" />
              </div>
              <button
                type="button"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] bg-[#2f6fd6] px-3 text-[14px] font-medium tracking-[-0.01em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                onClick={onNewCustomer}
              >
                신규 고객
              </button>
            </div>
            <div className="no-scrollbar max-h-[22rem] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                {selectableGuardianPetPairs.length === 0 ? (
                  <div className="rounded-[14px] border border-[#dbe5f1] bg-white px-4 py-4">
                    <p className="text-[16px] font-medium text-[#0f172a]">검색된 고객이 없어요</p>
                    <p className="mt-1 text-[13px] leading-5 text-[#64748b]">새 고객으로 등록한 뒤 예약을 이어가 주세요.</p>
                  </div>
                ) : (
                  selectableGuardianPetPairs.map(({ guardian, pet }) => (
                    <button
                      key={pet.id}
                      type="button"
                      data-testid={`appointment-guardian-pet-${pet.id}`}
                      aria-pressed={selectedPetId === pet.id}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-2 overflow-hidden rounded-[10px] border px-3 text-left text-[16px] leading-6 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2",
                        selectedPetId === pet.id ? "border-[#94a3b8] bg-[#f1f5f9] text-[#0f172a]" : "border-[#dbe5f1] bg-white text-[#0f172a]",
                      )}
                      onClick={() => {
                        setSelectedPetId(pet.id);
                        setServiceId("");
                        setTime("");
                        setMemo("");
                      }}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                        <span className="min-w-0 truncate font-medium tracking-[-0.01em]">{guardian.name}</span>
                        <span aria-hidden="true" className="shrink-0 text-[#94a3b8]">·</span>
                        <span className="min-w-0 truncate font-normal">{pet.name}</span>
                      </span>
                      <span className="shrink-0 text-[14px] leading-5 text-[#64748b]">{canViewGuardianContact ? guardian.phone || "연락처 없음" : "연락처 비공개"}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {step === "service" ? (
          <>
            <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">담당자</p>
                {selectableStaffMembers.length === 1 ? <span className="text-[12px] font-semibold text-[var(--muted)]">자동 선택</span> : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {selectableStaffMembers.map((staffMember) => {
                  const displayName = staffMember.displayName?.trim() || staffMember.name;
                  const description = staffMember.position || staffMember.role || "담당자";

                  return (
                    <button
                      key={staffMember.id}
                      type="button"
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        selectedStaffId === staffMember.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                          : "border-[var(--border)] bg-white text-[var(--text)]"
                      }`}
                      onClick={() => setSelectedStaffId(staffMember.id)}
                    >
                      <p className="truncate text-sm font-semibold">{displayName}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            {selectableServices.length === 0 ? (
              <EmptyState title="선택 가능한 서비스가 없어요" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {selectableServices.map((item) => (
                  <button key={item.id} className={`rounded-2xl border px-3 py-4 text-left ${serviceId === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-white"}`} onClick={() => { setServiceId(item.id); setTime(""); }}>
                    <p className="text-sm font-semibold">{item.name}</p>
                    {item.category ? <p className="mt-1 text-xs text-[var(--muted)]">{item.category}</p> : null}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}

        {step === "schedule" ? (
          <>
            <p className="text-xs text-[var(--muted)]">좌우로 넘기듯 터치해서 빠르게 선택할 수 있어요.</p>
            <div className="space-y-3">
              <div className="rounded-2xl bg-[#fcfaf7] p-2">
                <p className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">날짜</p>
                <HorizontalDragScroll>
                  {dateOptions.map((item, index) => (
                    <button key={item} className={`min-w-[110px] shrink-0 rounded-2xl border px-4 py-3 text-left ${date === item ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-[#fcfaf7] text-[var(--text)]"}`} onClick={() => { setDate(item); setTime(""); }}>
                      <span className="text-sm font-semibold">{index === 0 ? "오늘" : shortDate(item)}</span>
                    </button>
                  ))}
                </HorizontalDragScroll>
              </div>
              <div className="rounded-2xl bg-[#fcfaf7] p-2">
                <p className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">시간</p>
                {slots.length === 0 ? (
                  <div className="rounded-2xl bg-[#fcfaf7] px-4 py-6 text-center text-sm text-[var(--muted)]">선택한 조건에 가능한 시간이 없어요.</div>
                ) : (
                  <HorizontalDragScroll>
                    {slots.map((slot) => (
                      <button key={slot} className={`min-w-[92px] shrink-0 rounded-2xl border px-4 py-3 text-center text-sm font-semibold ${time === slot ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-[#fcfaf7] text-[var(--text)]"}`} onClick={() => setTime(slot)}>
                        {slot}
                      </button>
                    ))}
                  </HorizontalDragScroll>
                )}
              </div>
            </div>
          </>
        ) : null}

        {step === "memo" ? (
          <textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="field min-h-24" placeholder="참고 메모를 남겨주세요" />
        ) : null}
      </div>
    </Sheet>
  );
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
      <div className="space-y-5">
        <section>
          <p className="text-[16px] font-semibold leading-6 tracking-[-0.01em] text-[var(--text)]">보호자 정보</p>
          <div className="mt-3 space-y-2.5">
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-medium leading-5 text-[#475569]">보호자 이름</span>
              <input
                className="min-h-11 w-full rounded-[10px] border border-[#dbe5f1] bg-white px-3 text-[16px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                value={guardianName}
                onChange={(event) => setGuardianName(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-medium leading-5 text-[#475569]">연락처</span>
              <input
                className="min-h-11 w-full rounded-[10px] border border-[#dbe5f1] bg-white px-3 text-[16px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[14px] font-medium leading-5 text-[#475569]">고객 메모</span>
              <input
                className="min-h-11 w-full rounded-[10px] border border-[#dbe5f1] bg-white px-3 text-[16px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="선택 입력"
              />
            </label>
          </div>
        </section>

        <div className="space-y-3">
          {pets.map((pet, index) => (
            <section key={pet.id} className="border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[16px] font-semibold leading-6 tracking-[-0.01em] text-[var(--text)]">{index === 0 ? "아기 정보" : `아기 ${index + 1}`}</p>
                {index > 0 ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#b85c47]"
                    onClick={() => removePet(pet.id)}
                  >
                    삭제
                  </button>
                ) : (
                  <span className="text-[12px] font-semibold text-[var(--muted)]">최소 1마리</span>
                )}
              </div>

              <div className="mt-3 space-y-2.5">
                <label className="block">
                  <span className="mb-1.5 block text-[14px] font-medium leading-5 text-[#475569]">아기 이름</span>
                  <input
                    className="min-h-11 w-full rounded-[10px] border border-[#dbe5f1] bg-white px-3 text-[16px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                    value={pet.name}
                    onChange={(event) => updatePet(pet.id, "name", event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[14px] font-medium leading-5 text-[#475569]">견종</span>
                  <input
                    className="min-h-11 w-full rounded-[10px] border border-[#dbe5f1] bg-white px-3 text-[16px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                    value={pet.breed}
                    onChange={(event) => updatePet(pet.id, "breed", event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[14px] font-medium leading-5 text-[#475569]">생일</span>
                  <input
                    className="min-h-11 w-full rounded-[10px] border border-[#dbe5f1] bg-white px-3 text-[16px] font-normal tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                    type="date"
                    value={pet.birthday}
                    onChange={(event) => updatePet(pet.id, "birthday", event.target.value)}
                  />
                </label>
              </div>
            </section>
          ))}
        </div>

        <button
          type="button"
          className="min-h-11 w-full rounded-[10px] border border-dashed border-[var(--accent)] bg-[var(--accent-soft)] px-4 text-[14px] font-medium text-[var(--accent)]"
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
    "h-12 rounded-[14px] border border-[var(--border)] bg-white px-4 text-[16px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none transition placeholder:text-[16px] placeholder:font-normal placeholder:text-[#a29c92] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(31,107,91,0.12)]";
  const fieldTextareaClassName =
    "min-h-[112px] rounded-[14px] border border-[var(--border)] bg-white px-4 py-3 text-[16px] font-medium leading-6 tracking-[-0.02em] text-[var(--text)] outline-none transition placeholder:text-[16px] placeholder:font-normal placeholder:text-[#a29c92] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(31,107,91,0.12)]";

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
          className="h-12 rounded-[16px] text-[16px] font-semibold tracking-[-0.02em]"
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
  const bareInputClassName = "w-full bg-transparent px-0 py-0 text-[16px] font-medium tracking-[-0.02em] text-[var(--text)] outline-none placeholder:text-[#b0b7bf]";
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
                bookingAvailableStartTime: data.shop.booking_available_start_time ?? "00:00",
                bookingAvailableEndTime: data.shop.booking_available_end_time ?? "23:59",
                approvalMode: data.shop.approval_mode,
                regularClosedDays: data.shop.regular_closed_days,
                temporaryClosedDates: data.shop.temporary_closed_dates,
                businessHours,
                notificationSettings: {
                  enabled: data.shop.notification_settings.enabled,
                  revisitEnabled: data.shop.notification_settings.revisit_enabled,
                  bookingConfirmedEnabled: data.shop.notification_settings.booking_confirmed_enabled,
                  bookingCancelledEnabled: data.shop.notification_settings.booking_cancelled_enabled,
                  bookingRescheduledEnabled: data.shop.notification_settings.booking_rescheduled_enabled,
                  groomingAlmostDoneEnabled: data.shop.notification_settings.grooming_almost_done_enabled,
                  groomingCompletedEnabled: data.shop.notification_settings.grooming_completed_enabled,
                  groomingStartWithoutPhotoEnabled: data.shop.notification_settings.grooming_start_without_photo_enabled ?? false,
                  groomingCompleteWithoutPhotoEnabled: data.shop.notification_settings.grooming_complete_without_photo_enabled ?? false,
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
                <p className="text-[16px] font-medium text-[var(--text)]">{name || data.shop.name}</p>
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
            <p className="text-[16px] font-medium tracking-[-0.02em] text-[var(--text)]">운영 정보</p>
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text)]">고객 예약 링크</p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[14px] font-semibold tracking-[-0.01em] text-white"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Copy className="h-4 w-4" strokeWidth={2} />}
                링크 복사
              </button>
              <a
                href={bookingEntryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-white px-4 text-[14px] font-semibold tracking-[-0.01em] text-[var(--text)]"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={2} />
                고객 화면 열기
              </a>
            </div>
          </div>
          <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
            고객이 직접 예약할 수 있는 링크예요. 인스타그램, 네이버 플레이스, 카카오 채널 등에 넣어두면 고객이 바로 예약할 수 있어요.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-[14px] bg-white px-3 py-3">
            <p className="min-w-0 flex-1 [overflow-wrap:anywhere] text-[12px] text-[var(--muted)]">{bookingEntryUrl}</p>
          </div>
        </div>
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-[var(--muted)]" />
            <p className="text-sm font-semibold text-[var(--text)]">QR 코드</p>
          </div>
          <div className="mt-3 flex justify-center rounded-[16px] bg-white p-4">
            <img src={qrImageUrl} alt="고객 예약 QR 코드" className="h-[168px] w-[168px]" />
          </div>
          <a
            href={qrImageUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[12px] border border-[var(--border)] bg-white px-4 text-[14px] font-medium text-[var(--text)]"
          >
            QR 크게 보기
          </a>
        </div>
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">사용 예시</p>
          <ul className="mt-3 space-y-2 text-[13px] leading-6 text-[var(--muted)]">
            <li>인스타그램 프로필 링크</li>
            <li>네이버 플레이스 소개 문구</li>
            <li>카카오 채널 버튼</li>
            <li>문자 또는 알림톡 안내 문구</li>
            <li>블로그 또는 공지글</li>
          </ul>
        </div>
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
  onSaveCustomerPageSettings,
  onSaveStaff,
  onLogout,
  loggingOut = false,
  userEmail,
  subscriptionSummary,
  onActiveScreenChange,
  appRole = "owner",
  currentStaffId = null,
  onOpenFeedback,
  feedbackTriggerRef,
  isTesterFeedback = false,
}: {
  data: BootstrapPayload;
  initialScreen?: SettingsEntryScreen;
  onSave: (payload: unknown, options?: { errorFallbackMessage?: string }) => Promise<void> | void;
  onSaveCustomerPageSettings: (payload: unknown) => void;
  onSaveStaff: (payload: unknown) => void;
  onLogout?: () => void;
  loggingOut?: boolean;
  userEmail?: string | null;
  subscriptionSummary?: OwnerSubscriptionSummary | null;
  onActiveScreenChange?: (screen: SettingsEntryScreen) => void;
  appRole?: MobileAppRole;
  currentStaffId?: string | null;
  onOpenFeedback?: () => void;
  feedbackTriggerRef?: React.RefObject<HTMLButtonElement | null>;
  isTesterFeedback?: boolean;
}) {
  return (
    <OwnerSettingsPanel
      data={data}
      initialScreen={initialScreen}
      onSave={onSave}
      onSaveCustomerPageSettings={onSaveCustomerPageSettings}
      onSaveStaff={onSaveStaff}
      onLogout={onLogout}
      loggingOut={loggingOut}
      userEmail={userEmail}
      subscriptionSummary={subscriptionSummary}
      onActiveScreenChange={onActiveScreenChange}
      appRole={appRole}
      currentStaffId={currentStaffId}
      onOpenFeedback={onOpenFeedback}
      feedbackTriggerRef={feedbackTriggerRef}
      isTesterFeedback={isTesterFeedback}
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
  overdueRows,
  petMap,
  guardianMap,
  serviceMap,
  petDisplayPhotos,
  saving,
  onUpdate,
  onOpenAppointment,
  onClose,
}: {
  kind: "today" | "completed" | "cancel_change";
  todayAppointments: Appointment[];
  overdueRows: Array<{ pet: Pet; guardian: Guardian; daysUntil: number | null }>;
  petMap: Record<string, Pet>;
  guardianMap: Record<string, Guardian>;
  serviceMap: Record<string, Service>;
  petDisplayPhotos: NonNullable<BootstrapPayload["petDisplayPhotos"]>;
  saving: boolean;
  onUpdate: (appointmentId: string, payload: AppointmentUpdatePayload) => void;
  onOpenAppointment: (appointment: Appointment) => void;
  onClose: () => void;
}) {
  const petDisplayPhotoByAppointmentId = useMemo(
    () => indexTodayPetDisplayPhotosByAppointmentId(petDisplayPhotos),
    [petDisplayPhotos],
  );
  const currentAppointments = todayAppointments.filter((item) => ["confirmed", "in_progress", "almost_done"].includes(item.status));
  const completedAppointments = todayAppointments.filter((item) => item.status === "completed");
  const cancelChangeOnly = todayAppointments.filter((item) => item.status === "cancelled");

  return (
    <Sheet title={kind === "today" ? ownerHomeCopy.todaySheetTitle : kind === "completed" ? ownerHomeCopy.completedSheetTitle : ownerHomeCopy.cancelChangeSheetTitle} onClose={onClose}>
      <div className="space-y-3">
        {kind === "today" && (
          <CurrentReservationsContent
            currentAppointments={currentAppointments}
            petMap={petMap}
            guardianMap={guardianMap}
            serviceMap={serviceMap}
            petDisplayPhotoByAppointmentId={petDisplayPhotoByAppointmentId}
            saving={saving}
            onOpenAppointment={onOpenAppointment}
            onStatusChange={(appointmentId, status) => onUpdate(appointmentId, { status })}
          />
        )}
        {kind === "completed" && <CompletedReservationsContent historyAppointments={completedAppointments} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} petDisplayPhotoByAppointmentId={petDisplayPhotoByAppointmentId} onOpenAppointment={onOpenAppointment} />}
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
  const [template, setTemplate] = useState<"" | (typeof rejectionReasonTemplates)[number]>(directRejectionReasonTemplate);
  const [customReason, setCustomReason] = useState("");
  const canSubmitReject = Boolean(template);

  const handleRejectCancel = () => {
    setTemplate(directRejectionReasonTemplate);
    setCustomReason("");
    onRejectClose();
  };

  const handleRejectConfirm = () => {
    if (!canSubmitReject || !template) return;
    onStatusChange({ status: "rejected", rejectionReasonTemplate: template, rejectionReasonCustom: customReason.trim() });
    handleRejectCancel();
  };
  const leadingLabel = hideTime ? sequenceLabel : formatClockTime(appointment.appointment_time);

  return (
    <div className="rounded-[12px] border border-[#e1e7ef] bg-white px-3 py-2">
      <div className="flex w-full items-center gap-2.5">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          {leadingLabel ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="w-[39px] text-[16px] font-normal leading-none tracking-[-0.01em] text-[#0f172a]">{leadingLabel}</div>
              <div className="h-6 w-px bg-[#e1e7ef]" />
            </div>
          ) : null}
          <AppointmentMonogram name={pet.name} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[16px] font-normal leading-[20px] tracking-[-0.02em] text-[#0f172a]">{pet.name}</p>
              <span className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">{guardian.name}</span>
            </div>
            <p className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">
              {service.name} {ownerHomeCopy.separator} {staffName ?? "미배정"}
            </p>
          </div>
        </button>
        {!isRejectOpen ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onStatusChange({ status: "confirmed" })}
              disabled={saving}
              className="flex h-8 items-center justify-center rounded-full border border-[#111827] bg-[#111827] px-3 text-[14px] font-medium text-white transition disabled:opacity-50"
            >
              {ownerHomeCopy.pendingApprove}
            </button>
            <button
              type="button"
              onClick={onRejectOpen}
              disabled={saving}
              className="flex h-8 items-center justify-center rounded-full border border-[#e1e7ef] bg-white px-3 text-[14px] font-medium text-[#334155] transition disabled:opacity-50"
            >
              {"미승인"}
            </button>
          </div>
        ) : null}
      </div>
      {isRejectOpen ? (
        <div className="mt-3 space-y-3 rounded-[12px] border border-[var(--border)] bg-[#fcfaf7] p-3">
          <RejectionReasonEditor template={template} customReason={customReason} onTemplateChange={(value) => setTemplate(value || directRejectionReasonTemplate)} onCustomReasonChange={setCustomReason} />
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={handleRejectCancel} variant="ghost" disabled={saving}>{"취소"}</ActionButton>
            <ActionButton onClick={handleRejectConfirm} variant="secondary" disabled={saving || !canSubmitReject}>{"미승인 확정"}</ActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}


function CurrentReservationsContent({ currentAppointments, petMap, guardianMap, serviceMap, petDisplayPhotoByAppointmentId, saving, onOpenAppointment, onStatusChange }: { currentAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; petDisplayPhotoByAppointmentId: ReadonlyMap<string, NonNullable<BootstrapPayload["petDisplayPhotos"]>[number]>; saving: boolean; onOpenAppointment: (appointment: Appointment) => void; onStatusChange: (appointmentId: string, status: AppointmentStatus) => void; }) {
  return <div className="overflow-hidden rounded-[10px] border border-[#dce4ef] bg-white p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[var(--accent)]" /><div className="mb-2.5"><h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.currentSectionTitle}</h3></div><div className="no-scrollbar max-h-[34rem] overflow-y-auto pr-1"><div className="space-y-2.5">{currentAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.currentSectionEmpty} /> : currentAppointments.map((appointment) => <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} petDisplayPhoto={resolveTodayAppointmentPetDisplayPhoto(petDisplayPhotoByAppointmentId, appointment)} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} allowSwipeCancel />)}</div></div></div>;
}

function groupAppointmentsByTime(appointments: Appointment[]) {
  const groups = new Map<string, Appointment[]>();
  appointments.forEach((appointment) => {
    const key = appointment.appointment_time;
    groups.set(key, [...(groups.get(key) ?? []), appointment]);
  });
  return Array.from(groups.entries()).map(([time, items]) => ({ time, items }));
}

function HomeReservationSectionHeader({ title, dotClassName, expanded, onToggle }: { title: string; dotClassName: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={`flex w-full items-center justify-between gap-3 px-1 pb-0.5 pt-1.5 text-left ${expanded ? "mb-3" : ""}`}>
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClassName}`} />
        <span className="truncate text-[16px] font-medium leading-[22px] tracking-[-0.02em] text-[var(--text)]">{title}</span>
      </span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-[#94a3b8] transition-transform ${expanded ? "" : "-rotate-90"}`} />
    </button>
  );
}

function TodayConfirmedContent({ currentAppointments, careReportFollowupAppointments, cancelChangeAppointments, completedAppointments, petMap, guardianMap, serviceMap, staffMap, petDisplayPhotos, saving, focusedSection, selectedDateKey, isToday, slideDirection, careReportLoadingAppointmentId, onOpenAppointment, onResumeCareReport, onStatusChange, onStartWithoutPhoto, onCompleteWithoutPhoto, onOpenPhotoStatusAction }: { currentAppointments: Appointment[]; careReportFollowupAppointments: Appointment[]; cancelChangeAppointments: Appointment[]; completedAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; staffMap: Record<string, BootstrapPayload["staffMembers"][number]>; petDisplayPhotos: NonNullable<BootstrapPayload["petDisplayPhotos"]>; saving: boolean; focusedSection: HomeReservationSectionKey; selectedDateKey: string; isToday: boolean; slideDirection: "prev" | "next"; careReportLoadingAppointmentId: string | null; onOpenAppointment: (appointment: Appointment) => void; onResumeCareReport: (appointmentId: string) => void; onStatusChange: (appointmentId: string, status: AppointmentStatus) => void; onStartWithoutPhoto: (appointmentId: string) => void; onCompleteWithoutPhoto: (appointmentId: string) => void; onOpenPhotoStatusAction: (appointmentId: string, status: Extract<AppointmentStatus, "in_progress" | "completed">) => void; }) {
  const petDisplayPhotoByAppointmentId = useMemo(
    () => indexTodayPetDisplayPhotosByAppointmentId(petDisplayPhotos),
    [petDisplayPhotos],
  );
  const resolvePetDisplayPhoto = (appointment: Appointment) =>
    resolveTodayAppointmentPetDisplayPhoto(petDisplayPhotoByAppointmentId, appointment);
  const careReportFollowupPhotoByAppointmentId = useMemo(
    () => new Map(careReportFollowupAppointments.map((appointment) => [
      appointment.id,
      resolveTodayAppointmentPetDisplayPhoto(petDisplayPhotoByAppointmentId, appointment),
    ])),
    [careReportFollowupAppointments, petDisplayPhotoByAppointmentId],
  );
  const currentGroups = groupAppointmentsByTime(currentAppointments);
  const cancelChangeGroups = groupAppointmentsByTime(cancelChangeAppointments);
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

  const openSectionBodyClassName = "no-scrollbar min-h-0 flex-1 overflow-y-auto pb-20";
  const emptySectionClassName = "min-h-[72px] bg-[#f8fafc] px-3.5 py-4";

  const renderSectionBody = () => {
    if (focusedSection === "current") {
      return currentAppointments.length === 0 && careReportFollowupAppointments.length === 0 ? (
        <EmptyState compact className={emptySectionClassName} title={isToday ? ownerHomeCopy.currentSectionEmpty : "선택한 날짜에 처리할 예약이 없어요"} />
      ) : (
        <div className="space-y-2.5">
          {currentGroups.map((group) => {
            return (
              <div key={`current-${group.time}`} className="space-y-2">
                <div className="space-y-2">
                  {group.items.map((appointment) => (
                    <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} petDisplayPhoto={resolvePetDisplayPhoto(appointment)} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} onStartWithoutPhoto={() => onStartWithoutPhoto(appointment.id)} onStartCamera={() => onOpenPhotoStatusAction(appointment.id, "in_progress")} onCompleteWithoutPhoto={() => onCompleteWithoutPhoto(appointment.id)} allowSwipeCancel />
                  ))}
                </div>
              </div>
            );
          })}
          {careReportFollowupAppointments.map((appointment) => (
            <CompletedAppointmentRow key={`care-report-${appointment.id}`} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} staffName={appointment.staff_id ? staffMap[appointment.staff_id]?.name ?? "담당 미확인" : "미배정"} petDisplayPhoto={careReportFollowupPhotoByAppointmentId.get(appointment.id)} showTodayPetDisplayPhoto careReportLoading={careReportLoadingAppointmentId === appointment.id} onClick={() => onOpenAppointment(appointment)} onResumeCareReport={() => onResumeCareReport(appointment.id)} />
          ))}
        </div>
      );
    }

    if (focusedSection === "cancelChange") {
      return cancelChangeAppointments.length === 0 ? (
        <EmptyState compact className={emptySectionClassName} title="취소·변경 내역이 없어요" />
      ) : (
        <div className="space-y-2.5">
          {cancelChangeGroups.map((group) => {
            return (
              <div key={`cancel-change-${group.time}`} className="space-y-2">
                <div className="space-y-2">
                  {group.items.map((appointment) => (
                    <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} petDisplayPhoto={resolvePetDisplayPhoto(appointment)} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} allowSwipeCancel />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return completedAppointments.length === 0 ? (
      <EmptyState compact className={emptySectionClassName} title={ownerHomeCopy.historySectionEmpty} />
    ) : (
      <div className="space-y-2.5">
        {completedAppointments.map((appointment) => (
          <CompletedAppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} staffName={appointment.staff_id ? staffMap[appointment.staff_id]?.name ?? "담당 미확인" : "미배정"} petDisplayPhoto={resolvePetDisplayPhoto(appointment)} showTodayPetDisplayPhoto onClick={() => onOpenAppointment(appointment)} />
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-full min-h-0 flex-1 flex-col" style={contentSlideStyle}>
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={openSectionBodyClassName}>
            <div className="min-h-full px-1.5 pb-2.5 pt-1">
              {renderSectionBody()}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


function CompletedReservationsContent({ historyAppointments, petMap, guardianMap, serviceMap, staffMap, petDisplayPhotoByAppointmentId, onOpenAppointment }: { historyAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, BootstrapPayload["guardians"][number]>; serviceMap: Record<string, Service>; staffMap?: Record<string, BootstrapPayload["staffMembers"][number]>; petDisplayPhotoByAppointmentId: ReadonlyMap<string, NonNullable<BootstrapPayload["petDisplayPhotos"]>[number]>; onOpenAppointment: (appointment: Appointment) => void; }) {
  return <div className="overflow-hidden rounded-[10px] border border-[#e1e7ef] bg-white p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#94a3b8]" /><div className="mb-2.5"><h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.historySectionTitle}</h3></div><div className="space-y-2.5">{historyAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.historySectionEmpty} /> : historyAppointments.map((appointment) => <CompletedAppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} staffName={appointment.staff_id ? staffMap?.[appointment.staff_id]?.name ?? "담당 미확인" : "미배정"} petDisplayPhoto={resolveTodayAppointmentPetDisplayPhoto(petDisplayPhotoByAppointmentId, appointment)} showTodayPetDisplayPhoto onClick={() => onOpenAppointment(appointment)} />)}</div></div>;
}

function CompletedAppointmentRow({ appointment, pet, guardian, service, staffName, petDisplayPhoto, showTodayPetDisplayPhoto = false, careReportLoading = false, onClick, onResumeCareReport }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; staffName?: string; petDisplayPhoto?: NonNullable<BootstrapPayload["petDisplayPhotos"]>[number]; showTodayPetDisplayPhoto?: boolean; careReportLoading?: boolean; onClick: () => void; onResumeCareReport?: () => void }) {
  const trailingStatus = appointment.status === "pending" ? "missed-pending" : "completed";
  const summary = (
    <>
      <div className="min-w-[42px] text-[16px] font-normal leading-none tracking-[-0.01em] text-[#0f172a]">{formatClockTime(appointment.appointment_time)}</div>
      <div className="h-6 w-px shrink-0 bg-[#e1e7ef]" />
      {showTodayPetDisplayPhoto ? <TodayPetPhoto name={pet.name} src={petDisplayPhoto?.url} /> : <AppointmentMonogram name={pet.name} />}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[16px] font-normal leading-[20px] tracking-[-0.02em] text-[#0f172a]">{pet.name}</p>
          <span className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">{guardian.name}</span>
        </div>
        <p className="truncate text-[14px] font-normal leading-[18px] text-[#64748b]">{service.name}</p>
      </div>
      <AppointmentListTrailing status={trailingStatus} />
    </>
  );

  if (!onResumeCareReport) {
    return <button onClick={onClick} className={`flex min-h-[52px] w-full items-center gap-2.5 rounded-[12px] border border-[#e1e7ef] bg-white px-3 text-left transition hover:bg-[#f8fafc] ${showTodayPetDisplayPhoto ? "py-1" : "py-2"}`}>{summary}</button>;
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-[#dbe5f1] bg-white">
      <button type="button" onClick={onClick} className="flex min-h-[52px] w-full items-center gap-2.5 px-3 py-1 text-left transition hover:bg-[#f8fafc]">{summary}</button>
      <div className="border-t border-[#e8edf3] px-3 py-2">
        <button type="button" onClick={onResumeCareReport} disabled={careReportLoading} aria-busy={careReportLoading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[16px] font-medium leading-6 text-[var(--text)] transition-colors hover:bg-[var(--background)] active:bg-[var(--border)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--background)] disabled:text-[var(--muted)]">{careReportLoading ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}케어리포트 이어서 작성</button>
      </div>
    </div>
  );
}

function HomeConfirmedCard({ appointment, pet, guardian, service, petDisplayPhoto, saving, onOpen, onStatusChange, onStartWithoutPhoto, onStartCamera, onCompleteWithoutPhoto, onCompleteWithPhoto, allowSwipeCancel = false }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; petDisplayPhoto?: NonNullable<BootstrapPayload["petDisplayPhotos"]>[number]; saving: boolean; onOpen: () => void; onStatusChange: (status: AppointmentStatus) => void; onStartWithoutPhoto?: () => void; onStartCamera?: () => void; onCompleteWithoutPhoto?: () => void; onCompleteWithPhoto?: () => void; allowSwipeCancel?: boolean; }) {
  const actionWidth = 96;
  const snapThreshold = 48;
  const [startX, setStartX] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const translateXRef = useRef(0);
  const isDragging = startX !== null;
  const actionVisible = allowSwipeCancel && (isDragging || translateX !== 0);
  const rollbackStatus = appointment.status === "cancelled" ? "confirmed" : null;
  const rollbackLabel = appointment.status === "cancelled" ? "\uCDE8\uC18C/\uBCC0\uACBD \uCCA0\uD68C" : null;
  const customerGradeLabel = getTodayBookingCustomerGradeLabel({
    visitType: appointment.customer_visit_type,
    gradeOverride: guardian.customer_grade_override,
  });
  const updateTranslateX = (next: number) => {
    translateXRef.current = next;
    setTranslateX(next);
  };
  const closeSwipe = () => updateTranslateX(0);
  const openDetailFromCard = () => {
    if (translateX !== 0) {
      closeSwipe();
      return;
    }
    onOpen();
  };
  const openDetailFromCardSurface = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button, label, input, a, textarea, select")) return;
    openDetailFromCard();
  };

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
    setStartX(event.clientX);
    setDragStartX(translateXRef.current);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowSwipeCancel || startX === null || saving) return;
    const diff = event.clientX - startX;
    if (Math.abs(diff) > 4 && !event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
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
      <div className="relative w-full max-w-full overflow-hidden rounded-[12px] border border-[#dbe5f1] bg-transparent">
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
            <span className="text-[12px] font-medium text-white/80">한 번 더 확인</span>
          </button>
        </div>

        <div
          className={`relative rounded-[12px] bg-white transition-transform ${isDragging ? "duration-75" : "duration-200"}`}
          style={{ transform: `translateX(${translateX}px)`, touchAction: allowSwipeCancel ? "pan-y" : "auto" }}
          onClick={openDetailFromCardSurface}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={isDragging ? handlePointerUp : undefined}
        >
          <button
            type="button"
            onClick={openDetailFromCard}
            className="flex w-full min-w-0 items-center gap-2 px-2.5 pb-1 pt-2.5 text-left"
          >
            <div className="w-[48px] shrink-0 whitespace-nowrap text-[16px] font-medium leading-6 tabular-nums text-[#0f172a]">
              {formatClockTime(appointment.appointment_time)}
            </div>
            <div className="h-6 w-px shrink-0 bg-[#e1e7ef]" />
            <TodayPetPhoto name={pet.name} src={petDisplayPhoto?.url} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <p className="min-w-0 text-[16px] font-semibold leading-6 tracking-[-0.02em] text-[#0f172a] [overflow-wrap:anywhere]">{pet.name}</p>
                <span className="min-w-0 text-[14px] font-normal text-[#64748b] [overflow-wrap:anywhere]">{guardian.name}</span>
                {customerGradeLabel ? <span className="inline-flex min-h-6 shrink-0 items-center rounded-full border border-[#dbe5f1] bg-white px-2 text-[12px] font-medium leading-[18px] text-[#475569]">{customerGradeLabel}</span> : null}
              </div>
              <p className="text-[14px] font-medium leading-5 text-[#64748b] [overflow-wrap:anywhere]">
                {service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#b8b2aa]" strokeWidth={1.9} />
          </button>

          <div
            className="px-2.5 pb-2 pt-1"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onPointerCancel={(event) => event.stopPropagation()}
          >
            <div className="flex items-center">
              {appointment.status === "confirmed" && (
                <div className="grid w-full grid-cols-[1.15fr_0.85fr] gap-2">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-center rounded-[10px] border border-[var(--accent)] bg-[var(--accent)] px-3 text-[16px] font-medium leading-6 tracking-[-0.005em] text-white transition disabled:pointer-events-none disabled:bg-[#9db9ee] disabled:opacity-50"
                    onClick={onStartCamera ?? (() => onStatusChange("in_progress"))}
                    disabled={saving}
                  >
                    {saving ? "시작하는 중…" : "사진 찍고 시작"}
                  </button>
                  <ActionButton className="!min-h-11 !rounded-[10px] !px-3 !text-[16px]" variant="ghost" onClick={onStartWithoutPhoto ?? (() => onStatusChange("in_progress"))} disabled={saving}>{saving ? "시작하는 중…" : "바로 시작"}</ActionButton>
                </div>
              )}
              {appointment.status === "in_progress" && <ActionButton className="w-full !min-h-11 !rounded-[10px] !px-5 !text-[16px]" onClick={() => onStatusChange("almost_done")} variant="warm" disabled={saving}>{saving ? "변경하는 중…" : ownerHomeCopy.pickupReady}</ActionButton>}
              {appointment.status === "almost_done" && <ActionButton className="w-full !min-h-11 !rounded-[10px] !px-5 !text-[16px]" onClick={onCompleteWithoutPhoto ?? (() => onStatusChange("completed"))} variant="complete" disabled={saving}>{saving ? "완료하는 중…" : "미용 완료"}</ActionButton>}
              {rollbackStatus && rollbackLabel && <ActionButton className="w-full !min-h-11 !rounded-[10px] !px-5 !text-[16px]" onClick={() => onStatusChange(rollbackStatus)} variant="ghost" disabled={saving}>{rollbackLabel}</ActionButton>}
            </div>
            {appointment.status === "completed" && <div className="w-full rounded-[10px] border border-[#dce4ef] bg-[#f8fafc] px-4 py-2 text-center text-sm font-medium text-[var(--accent)]">{ownerHomeCopy.completedNotice}</div>}
          </div>
        </div>
      </div>

      {showCancelConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/28 px-5" onClick={() => { setShowCancelConfirm(false); closeSwipe(); }}>
          <div className="w-full max-w-[320px] rounded-[24px] border border-[var(--border)] bg-white px-5 py-5 shadow-[0_18px_44px_rgba(35,35,31,0.18)]" onClick={(event) => event.stopPropagation()}>
            <p className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">예약 취소하시겠습니까?</p>
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraMode, setCameraMode] = useState<"ready" | "camera" | "fallback">("ready");
  const [cameraError, setCameraError] = useState<string | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function openCamera() {
    setCameraError(null);
    setCameraMode("camera");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMode("fallback");
      setCameraError("이 브라우저에서는 카메라 촬영을 바로 열 수 없어요.");
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      stopCamera();
      setCameraMode("fallback");
      setCameraError("카메라 권한이 없거나 기기에서 카메라를 열 수 없어요.");
    }
  }

  function captureCameraPhoto() {
    const video = videoRef.current;
    const videoWidth = video?.videoWidth ?? 0;
    const videoHeight = video?.videoHeight ?? 0;

    if (!video || videoWidth <= 0 || videoHeight <= 0) {
      setCameraError("카메라 화면을 불러오는 중입니다. 잠시 후 다시 눌러주세요.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("사진을 저장할 수 없어요. 다시 시도해 주세요.");
      return;
    }

    context.drawImage(video, 0, 0, videoWidth, videoHeight);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("사진을 저장할 수 없어요. 다시 시도해 주세요.");
          return;
        }

        stopCamera();
        onSubmit(new File([blob], `petmanager-photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }

  useEffect(() => {
    if (!action.autoOpenCamera || uploading) return;
    const timer = window.setTimeout(() => {
      void openCamera();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [action.appointmentId, action.autoOpenCamera, uploading]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current || cameraMode !== "camera") return;
    video.srcObject = streamRef.current;
    void video.play();
  }, [cameraMode]);

  useEffect(() => stopCamera, []);

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
          {cameraMode === "camera" ? (
            <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-black">
              <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted autoPlay />
            </div>
          ) : null}
          {cameraError ? (
            <p className="rounded-[14px] border border-[#f0d7d7] bg-[#fff7f7] px-3 py-2 text-[14px] leading-5 text-[#a04455]">
              {cameraError}
            </p>
          ) : null}
          {cameraMode === "camera" ? (
            <ActionButton onClick={captureCameraPhoto} disabled={uploading} className="!h-[52px] !rounded-[16px] !text-[16px]">
              {uploading ? "업로드 중" : "촬영하기"}
            </ActionButton>
          ) : (
            <ActionButton onClick={() => void openCamera()} disabled={uploading} className="!h-[52px] !rounded-[16px] !text-[16px]">
              {uploading ? "업로드 중" : action.buttonLabel}
            </ActionButton>
          )}
          {cameraMode === "fallback" ? (
            <label
              htmlFor={inputId}
              className={`flex h-[48px] items-center justify-center rounded-[16px] border border-[var(--border)] bg-white px-4 text-[16px] font-medium text-[var(--text)] transition ${
                uploading ? "pointer-events-none opacity-60" : "active:scale-[0.99]"
              }`}
            >
              기기 카메라로 촬영
            </label>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              variant="ghost"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              disabled={uploading}
            >
              취소
            </ActionButton>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onSkip();
              }}
              disabled={uploading}
              className="h-[48px] rounded-[16px] border border-[var(--border)] bg-white px-4 text-[16px] font-medium text-[var(--muted)] transition active:scale-[0.99] disabled:opacity-60"
            >
              {action.skipLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RejectionReasonEditor({ template, customReason, onTemplateChange, onCustomReasonChange }: { template: "" | (typeof rejectionReasonTemplates)[number]; customReason: string; onTemplateChange: (value: "" | (typeof rejectionReasonTemplates)[number]) => void; onCustomReasonChange: (value: string) => void }) {
  useEffect(() => {
    if (template !== directRejectionReasonTemplate) {
      onTemplateChange(directRejectionReasonTemplate);
    }
  }, [onTemplateChange, template]);

  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-[var(--muted)]" htmlFor="owner-rejection-reason">
        미승인 사유
      </label>
      <textarea
        id="owner-rejection-reason"
        className="field min-h-[66px] resize-none"
        value={customReason}
        onChange={(event) => onCustomReasonChange(event.target.value)}
        placeholder="필요할 때만 고객에게 보낼 사유를 적어주세요"
      />
    </div>
  );
}


function PetStoreVerificationPanel({ pet }: { pet: Pet }) {
  const biteLevelLabel =
    pet.bite_level === "none"
      ? "없음"
      : pet.bite_level === "mild"
        ? "약함"
        : pet.bite_level === "watch"
          ? "주의"
          : pet.bite_level === "bite"
            ? "입질 있음"
            : pet.bite_level === "strong"
              ? "강함"
              : "미입력";
  const items = [
    ["몸무게", pet.weight === null ? "미입력" : `${pet.weight}kg`, pet.weight === null],
    ["생일", pet.birthday ?? "미입력", !pet.birthday],
    ["입질 정도", biteLevelLabel, biteLevelLabel === "미입력"],
    ["요금표 그룹", "미입력", true],
  ] as const;

  return (
    <section data-testid="pet-store-verification" className="border-t border-[#e8edf3] pt-3">
      <h4 className="text-[14px] font-medium leading-5 text-[#0f172a]">매장 확인 정보</h4>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 max-[340px]:grid-cols-1">
        {items.map(([label, value, isEmpty]) => (
          <div key={label} className="min-w-0 space-y-1">
            <dt className="text-[14px] font-medium leading-5 text-[#64748b]">{label}</dt>
            <dd className={cn("text-[16px] font-normal leading-6 [overflow-wrap:anywhere]", isEmpty ? "text-[#64748b]" : "text-[#1e293b]")}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GuardianPetEditorCard({ pet, saving, isBirthdayToday, isSelected, onSelect, onSave }: { pet: Pet; saving: boolean; isBirthdayToday: boolean; isSelected: boolean; onSelect: () => void; onSave: (name: string, breed: string, birthday: string | null) => void }) {
  const [name, setName] = useState(pet.name);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setName(pet.name);
      setIsEditing(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pet.birthday, pet.breed, pet.name]);

  const handleSelectKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div data-testid={`guardian-pet-card-${pet.id}`} className={cn("overflow-hidden rounded-[10px] border bg-white", isSelected ? "border-[#b8d1c9]" : "border-[var(--border)]")}>
      <div
        role="button"
        tabIndex={0}
        className="flex min-h-[68px] w-full cursor-pointer items-start justify-between gap-3 bg-white px-4 py-3 text-left transition hover:bg-[#fffdfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25"
        onClick={onSelect}
        onKeyDown={handleSelectKeyDown}
        aria-pressed={isSelected}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[var(--text)] [overflow-wrap:anywhere]">{pet.name}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className={cn("text-[16px] font-normal leading-6 [overflow-wrap:anywhere]", pet.breed ? "text-[var(--muted)]" : "text-[#64748b]")}>{pet.breed || "미입력"}</p>
            {isBirthdayToday ? <span className="text-[14px] font-medium leading-5 text-[var(--accent)]">오늘 생일</span> : null}
          </div>
        </div>
        <div className="shrink-0">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] px-2 text-[16px] font-medium leading-6 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-2"
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
        <div data-testid="guardian-pet-editor" className="border-t border-[var(--border)] px-4 py-4">
          <div className="space-y-3">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-[14px] font-medium leading-5 tracking-[-0.005em] text-[#64748b]">아기 이름</span>
              <input className="field !h-auto min-h-11 !rounded-[10px] !px-3 !py-2 text-[16px] font-normal leading-6 tracking-[-0.005em]" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <div className="border-t border-[#e8edf3] pt-3">
              <p className="text-[14px] font-medium leading-5 text-[#64748b]">고객 입력 품종</p>
              <p className={cn("mt-1 text-[16px] font-normal leading-6 [overflow-wrap:anywhere]", pet.breed ? "text-[#1e293b]" : "text-[#64748b]")}>{pet.breed || "미입력"}</p>
            </div>
            <div className="border-t border-[#e8edf3] pt-3">
              <p className="text-[14px] font-medium leading-5 text-[#64748b]">고객 요청사항</p>
              <p className={cn("mt-1 whitespace-pre-wrap text-[16px] font-normal leading-6 [overflow-wrap:anywhere]", pet.notes ? "text-[#334155]" : "text-[#64748b]")}>{pet.notes || "미입력"}</p>
            </div>
            <PetStoreVerificationPanel pet={pet} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[#e8edf3] pt-3">
            <button
              type="button"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] px-3 text-[16px] font-medium leading-6 text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-2 disabled:opacity-45"
              onClick={() => {
                setName(pet.name);
                setIsEditing(false);
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(name.trim(), pet.breed, pet.birthday);
                setIsEditing(false);
              }}
              disabled={saving || !name.trim()}
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] px-3 text-[16px] font-medium leading-6 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-2 disabled:opacity-45"
            >
              정보 저장
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}



























