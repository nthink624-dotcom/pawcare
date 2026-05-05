"use client";

import { CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, House, PawPrint, Plus, Settings, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import CustomerDeleteSelectionPanel from "@/components/owner/customer-delete-selection-panel";
import OwnerSettingsPanel from "@/components/owner/owner-settings-panel";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { SectionHeader as AppSectionHeader } from "@/components/ui/section-header";
import { StatusBadge as AppStatusBadge } from "@/components/ui/status-badge";
import { fetchApiJsonWithAuth } from "@/lib/api";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { computeAvailableSlots, revisitInfo } from "@/lib/availability";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { ownerHomeCopy } from "@/lib/owner-home-copy";
import { addDate, currentDateInTimeZone, formatClockTime, phoneNormalize, shortDate, won } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload, GroomingRecord, Pet, Service } from "@/types/domain";

type TabKey = "home" | "book" | "customers" | "settings";
type CustomerDetailTab = "pets" | "records" | "notifications";
type SettingsEntryScreen = "subscription" | "shop" | "closures" | "notifications" | "services" | "account" | null;
type OwnerGuideScreen = "getting-started" | null;
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
    };
  };
  customerPageSettingsPayload: {
    shopId: string;
    customerPageSettings: BootstrapPayload["shop"]["customer_page_settings"];
  };
};
type Guardian = BootstrapPayload["guardians"][number];
type CustomerEditableField = "name" | "phone" | "pet" | "memo";
type AppointmentStatusUpdatePayload = {
  status: AppointmentStatus;
  rejectionReasonTemplate?: string;
  rejectionReasonCustom?: string;
  eventType?: "booking_rescheduled_confirmed";
};
type AppointmentEditPayload = {
  mode: "edit";
  serviceId: string;
  appointmentDate: string;
  appointmentTime: string;
  memo: string;
};
type AppointmentUpdatePayload = AppointmentStatusUpdatePayload | AppointmentEditPayload;
type ModalState =
  | { type: "appointment"; appointment: Appointment }
  | { type: "edit-shop-profile" }
  | { type: "new-appointment"; petId?: string }
  | { type: "new-customer" }
  | { type: "add-pet"; guardianId: string }
  | { type: "edit-record"; record: GroomingRecord }
  | { type: "stat"; kind: "today" | "pending" | "completed" | "cancel_change" }
  | null;

const compactWeekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const settingsEntryScreenTitles: Record<Exclude<SettingsEntryScreen, null>, string> = {
  subscription: "현재 플랜",
  shop: "매장 기본 정보",
  closures: "운영시간 안내",
  notifications: "알림톡 설정",
  services: "서비스 관리",
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
  pending: { label: "\uB300\uAE30", color: "#7b654d", bg: "#f6eee3" },
  confirmed: { label: "\uD655\uC815", color: "#1f6b5b", bg: "#eaf5f1" },
  in_progress: { label: "\uBBF8\uC6A9\uC911", color: "#1f6b5b", bg: "#eef4f2" },
  almost_done: { label: "\uD53D\uC5C5 \uC900\uBE44", color: "#5f6b66", bg: "#f3f4f2" },
  completed: { label: "\uC644\uB8CC", color: "#5f6b66", bg: "#f3f4f2" },
  cancelled: { label: "\uCDE8\uC18C", color: "#8f6658", bg: "#f8efea" },
  rejected: { label: "\uBBF8\uC2B9\uC778", color: "#8f6658", bg: "#f8efea" },
  noshow: { label: "\uB178\uC1FC", color: "#8f6658", bg: "#f8efea" },
};

const tabItems: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "홈", icon: House },
  { key: "book", label: "예약조회", icon: CalendarDays },
  { key: "customers", label: "고객관리", icon: PawPrint },
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
}) {
  const [data, setData] = useState(initialData);
  const [ownedShopItems, setOwnedShopItems] = useState(ownedShops);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [todayDate, setTodayDate] = useState(() => currentDateInTimeZone());
  const [homeReservationDate, setHomeReservationDate] = useState(() => currentDateInTimeZone());
  const [homeReservationSlideDirection, setHomeReservationSlideDirection] = useState<"prev" | "next">("next");
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
  const [isCustomerNotificationSettingsOpen, setIsCustomerNotificationSettingsOpen] = useState(false);
  const [isVisitCalendarOpen, setIsVisitCalendarOpen] = useState(false);
  const [pendingVisitSelectionMode, setPendingVisitSelectionMode] = useState<"single" | "range">("single");
  const [pendingVisitDate, setPendingVisitDate] = useState(currentDateInTimeZone());
  const [pendingVisitRangeStart, setPendingVisitRangeStart] = useState<string | null>(null);
  const [pendingVisitRangeEnd, setPendingVisitRangeEnd] = useState<string | null>(null);
  const [visitCalendarMonthCursor, setVisitCalendarMonthCursor] = useState(currentDateInTimeZone().slice(0, 7));
  const [modal, setModal] = useState<ModalState>(null);
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

  useEffect(() => {
    setIsCustomerNotificationSettingsOpen(false);
  }, [selectedGuardianId]);

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

  async function handleRequestError(error: unknown, fallbackMessage: string) {
    const nextMessage = error instanceof Error ? error.message : fallbackMessage;
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

  async function refresh() {
    if (isOwnerDemo) return;
    const next = await fetchJson<BootstrapPayload>(`/api/bootstrap?shopId=${data.shop.id}`);
    setData(next);
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
  const activeServiceCount = useMemo(() => data.services.filter((item) => item.is_active).length, [data.services]);
  const currentOwnedShop = useMemo(
    () => ownedShopItems.find((shop) => shop.id === (selectedShopId || data.shop.id)) ?? {
      id: data.shop.id,
      name: data.shop.name,
      address: data.shop.address,
      heroImageUrl: data.shop.customer_page_settings?.hero_image_url || "",
    },
    [data.shop.address, data.shop.customer_page_settings, data.shop.id, data.shop.name, ownedShopItems, selectedShopId],
  );
  const enabledBusinessDayCount = useMemo(
    () => Object.values(data.shop.business_hours).filter((item) => item?.enabled).length,
    [data.shop.business_hours],
  );
  const onboardingTasks = useMemo(
    () =>
      [
        activeServiceCount === 0
          ? {
              key: "services" as const,
              title: "서비스를 1개 이상 등록해 주세요",
              description: "고객이 예약할 메뉴가 아직 없어서 예약 화면이 비어 보여요.",
              cta: "서비스 추가",
            }
          : null,
        enabledBusinessDayCount === 0
          ? {
              key: "closures" as const,
              title: "영업시간을 열어 주세요",
              description: "영업일과 시간을 정해야 실제 예약 가능 시간이 계산돼요.",
              cta: "영업시간 설정",
            }
          : null,
      ].filter(Boolean),
    [activeServiceCount, enabledBusinessDayCount],
  );
  const isOnboardingIncomplete = onboardingTasks.length > 0;

  const todayConfirmedAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === todayDate && ["confirmed", "in_progress", "almost_done", "completed", "cancelled"].includes(item.status)), [data.appointments, todayDate]);
  const pendingAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === todayDate && item.status === "pending"), [data.appointments, todayDate]);
  const todayActionAppointments = useMemo(() => todayConfirmedAppointments.filter((item) => ["confirmed", "in_progress", "almost_done"].includes(item.status)).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)), [todayConfirmedAppointments]);
  const todayHistoryAppointments = useMemo(() => todayConfirmedAppointments.filter((item) => item.status === "completed").sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)), [todayConfirmedAppointments]);
  const completedHistoryAppointments = useMemo(() => todayHistoryAppointments.filter((item) => item.status === "completed"), [todayHistoryAppointments]);
  const cancelChangeAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === todayDate && item.status === "cancelled"), [data.appointments, todayDate]);
  const homeConfirmedAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === homeReservationDate && ["confirmed", "in_progress", "almost_done", "completed", "cancelled"].includes(item.status)), [data.appointments, homeReservationDate]);
  const homePendingAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === homeReservationDate && item.status === "pending"), [data.appointments, homeReservationDate]);
  const homeActionAppointments = useMemo(() => homeConfirmedAppointments.filter((item) => ["confirmed", "in_progress", "almost_done"].includes(item.status)).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)), [homeConfirmedAppointments]);
  const homeHistoryAppointments = useMemo(() => homeConfirmedAppointments.filter((item) => item.status === "completed").sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)), [homeConfirmedAppointments]);
  const homeCompletedHistoryAppointments = useMemo(() => homeHistoryAppointments.filter((item) => item.status === "completed"), [homeHistoryAppointments]);
  const selectedDayAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === selectedDate).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)), [data.appointments, selectedDate]);
  const homeReservationDateLabel = useMemo(() => {
    if (homeReservationDate === todayDate) return "오늘";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    })
      .format(new Date(homeReservationDate + "T00:00:00"))
      .replace("요일", "");
  }, [homeReservationDate, todayDate]);
  const homeReservationPanelTitle = "예약관리";
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
  const visitCalendarMonthLabel = String(Number(visitCalendarMonth.slice(0, 4))) + "년 " + String(Number(visitCalendarMonth.slice(5, 7))) + "월";
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
  const guardianRevisitNotificationsEnabled = selectedGuardian?.notification_settings.revisit_enabled ?? false;
  const customerNotificationSummary = !guardianNotificationsEnabled
    ? "알림 수신 꺼짐"
    : guardianRevisitNotificationsEnabled
      ? "알림 수신 · 재방문 안내 사용 중"
      : "알림 수신 사용 중";
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

  async function mutate(url: string, init: RequestInit) {
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

  function openSettingsScreen(screen: Exclude<SettingsEntryScreen, null>) {
    setSettingsEntryScreen(screen);
    setActiveTab("settings");
  }

  async function updateGuardianNotifications(guardianId: string, enabled: boolean, revisitEnabled: boolean) {
    if (isOwnerDemo) {
      setData((prev) => ({
        ...prev,
        guardians: prev.guardians.map((guardian) =>
          guardian.id === guardianId
            ? {
                ...guardian,
                notification_settings: {
                  ...guardian.notification_settings,
                  enabled,
                  revisit_enabled: revisitEnabled,
                },
              }
            : guardian,
        ),
      }));
      return;
    }

    await mutate("/api/guardians", {
      method: "PATCH",
      body: JSON.stringify({ guardianId, enabled, revisitEnabled }),
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

  async function updateApprovalMode(nextMode: "manual" | "auto") {
    if (isOwnerDemo) {
      setData((prev) => ({
        ...prev,
        shop: {
          ...prev.shop,
          approval_mode: nextMode,
        },
        appointments:
          nextMode === "auto"
            ? prev.appointments.map((appointment) =>
                appointment.status === "pending" ? { ...appointment, status: "confirmed" } : appointment,
              )
            : prev.appointments,
      }));
      return;
    }

    await mutate("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        shopId: data.shop.id,
        name: data.shop.name,
        phone: data.shop.phone,
        address: data.shop.address,
        description: data.shop.description,
        concurrentCapacity: data.shop.concurrent_capacity,
        bookingSlotIntervalMinutes: data.shop.booking_slot_interval_minutes,
        bookingSlotOffsetMinutes: data.shop.booking_slot_offset_minutes,
        approvalMode: nextMode,
        regularClosedDays: data.shop.regular_closed_days,
        temporaryClosedDates: data.shop.temporary_closed_dates,
        businessHours: data.shop.business_hours,
        notificationSettings: {
          enabled: data.shop.notification_settings.enabled,
          revisitEnabled: data.shop.notification_settings.revisit_enabled,
          bookingConfirmedEnabled: data.shop.notification_settings.booking_confirmed_enabled,
          bookingRejectedEnabled: data.shop.notification_settings.booking_rejected_enabled,
          bookingCancelledEnabled: data.shop.notification_settings.booking_cancelled_enabled,
          bookingRescheduledEnabled: data.shop.notification_settings.booking_rescheduled_enabled,
          groomingAlmostDoneEnabled: data.shop.notification_settings.grooming_almost_done_enabled,
          groomingCompletedEnabled: data.shop.notification_settings.grooming_completed_enabled,
        },
        customerPageSettings: data.shop.customer_page_settings,
      }),
    });
  }

  async function sendBirthdayGreeting(pet: Pet) {
    const guardian = guardianMap[pet.guardian_id];
    if (!guardian) return;
    if (!guardian.notification_settings.enabled) {
      setError("이 고객은 알림톡 수신이 꺼져 있어요. 고객관리에서 먼저 켜 주세요.");
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
      setError("이 고객은 알림톡 수신이 꺼져 있어요. 고객관리에서 먼저 켜 주세요.");
      return;
    }
    if (!guardian.notification_settings.revisit_enabled) {
      setError("이 고객은 재방문 알림이 꺼져 있어요. 고객관리에서 먼저 켜 주세요.");
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
      setError("이 고객은 알림톡 수신이 꺼져 있어요. 고객관리에서 먼저 켜 주세요.");
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
  const estimatedRevenue = todayConfirmedAppointments.reduce((sum, item) => sum + (serviceMap[item.service_id]?.price || 0), 0);
  const isCustomerDetailView = activeTab === "customers" && Boolean(selectedGuardian);
  const isSettingsDetailView = activeTab === "settings" && Boolean(settingsEntryScreen);
  const currentSettingsScreenTitle = settingsEntryScreen ? settingsEntryScreenTitles[settingsEntryScreen] : "";
  const screenTitle =
    activeTab === "customers"
      ? "고객관리"
      : tabItems.find((item) => item.key === activeTab)?.label;
  const bookingEntryUrl = `${ownerPageOrigin || ""}/entry/${data.shop.id}`;
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

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[var(--background)] shadow-[0_0_0_1px_rgba(47,49,46,0.03)]"
    >
      {!isCustomerDetailView ? (
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(248,246,242,0.94)] px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isHomeTab ? (
              <button
                type="button"
                onClick={() => setIsShopPickerOpen((prev) => !prev)}
                className="flex max-w-[250px] items-center gap-3 rounded-[18px] bg-transparent py-1 text-left"
              >
                <ShopAvatar name={currentOwnedShop.name} imageUrl={currentOwnedShop.heroImageUrl} />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-medium tracking-[-0.02em] text-[var(--text)]">{currentOwnedShop.name}</p>
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
              className="shrink-0 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium tracking-[-0.01em] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)] disabled:opacity-45"
              onClick={headerAction.onClick}
            >
              {headerAction.label}
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
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard label={ownerHomeCopy.statPending} value={String(pendingAppointments.length) + ownerHomeCopy.countSuffix} tone="warning" onClick={() => setModal({ type: "stat", kind: "pending" })} />
              <StatCard label={ownerHomeCopy.statUpcoming} value={String(pendingAppointments.length + todayActionAppointments.length) + ownerHomeCopy.countSuffix} tone="accent" onClick={() => setModal({ type: "stat", kind: "today" })} />
              <StatCard label={ownerHomeCopy.statCompleted} value={String(completedHistoryAppointments.length) + ownerHomeCopy.countSuffix} tone="neutral" onClick={() => setModal({ type: "stat", kind: "completed" })} />
              <StatCard label={ownerHomeCopy.statCancelChange} value={String(cancelChangeAppointments.length) + ownerHomeCopy.countSuffix} tone="danger" onClick={() => setModal({ type: "stat", kind: "cancel_change" })} />
            </div>
            <Panel title={homeReservationPanelTitle} action={String(homePendingAppointments.length + homeActionAppointments.length + homeCompletedHistoryAppointments.length) + ownerHomeCopy.countSuffix}>
              <TodayConfirmedContent
                pendingAppointments={homePendingAppointments}
                currentAppointments={homeActionAppointments}
                completedAppointments={homeCompletedHistoryAppointments}
                petMap={petMap}
                guardianMap={guardianMap}
                serviceMap={serviceMap}
                approvalMode={data.shop.approval_mode}
                saving={saving}
                selectedDateKey={homeReservationDate}
                slideDirection={homeReservationSlideDirection}
                canMoveBackward={canMoveHomeReservationBackward}
                canMoveForward={canMoveHomeReservationForward}
                onMoveBackward={() => moveHomeReservationDate("prev")}
                onMoveForward={() => moveHomeReservationDate("next")}
                onOpenAppointment={(appointment) => setModal({ type: "appointment", appointment })}
                onPendingUpdate={(appointmentId, payload) => updateAppointment(appointmentId, payload)}
                onStatusChange={(appointmentId, status) => updateAppointment(appointmentId, { status })}
                onApprovalModeChange={updateApprovalMode}
              />
            </Panel>
            <Panel title="예약 링크 사용법" action={<button type="button" className="text-xs font-medium text-[var(--accent)]" onClick={() => setGuideScreen("getting-started")}>자세히 보기</button>}>
              <div className="space-y-2 rounded-[10px] border border-[var(--border)] bg-white px-4 py-3.5">
                <p className="text-[13px] font-medium text-[var(--text)]">고객 예약 링크</p>
                <div className="flex items-center gap-2 rounded-[10px] bg-[#f7f4ef] px-3 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-[12px] text-[var(--muted)]">{bookingEntryUrl}</p>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--accent)]"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(bookingEntryUrl);
                        setBookingLinkCopied(true);
                        if (bookingLinkCopyTimeoutRef.current) {
                          clearTimeout(bookingLinkCopyTimeoutRef.current);
                        }
                        bookingLinkCopyTimeoutRef.current = setTimeout(() => setBookingLinkCopied(false), 1800);
                      } catch {
                        setError("예약 링크를 복사하지 못했어요. 다시 시도해 주세요.");
                      }
                    }}
                    aria-label="예약 링크 복사"
                  >
                    {bookingLinkCopied ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[12px] leading-5 text-[var(--muted)]">인스타그램 프로필, 네이버 플레이스 소개글, 카카오 채널 버튼에 같은 링크를 넣으면 여러 곳의 예약 유입을 한 화면에서 관리할 수 있어요.</p>
              </div>
            </Panel>
          </section>
        )}
{activeTab === "book" && (
  <section className="space-y-3.5 p-4">
    <Panel
      title="날짜선택"
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
                    ? "border-[#1f6b5b] bg-[#1f6b5b] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]"
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
            titleTextClassName="text-[15px] font-medium leading-6 tracking-[-0.02em]"
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
            titleTextClassName="text-[15px] font-medium leading-6 tracking-[-0.02em]"
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
          titleTextClassName="text-[15px] font-medium leading-6 tracking-[-0.02em]"
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
                              <p className="truncate text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">{summary.guardian.name}</p>
                            </div>
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ebe3da] bg-[#fcfaf7] text-[var(--muted)] transition group-hover:text-[var(--accent)]">
                              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                            </span>
                          </div>
                          <div className="mt-0.5 border-t border-[#eee7de] pt-0.5">
                            <p className="text-[12.5px] font-normal leading-[19px] text-[var(--muted)]">{summary.guardian.phone}</p>
                            <p className="mt-0.5 truncate text-[12.5px] font-normal leading-[19px] text-[#5e5a56]">
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
                aria-label="고객관리로 돌아가기"
              >
                <ChevronRight className="h-5 w-5 rotate-180" strokeWidth={2} />
              </button>
              <h2 className="text-[18px] font-medium tracking-[-0.03em] text-[var(--text)]">고객 상세</h2>
            </div>

            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-2">
              <div className="space-y-[7.5px]">
                <CustomerDetailFieldCard label="기본 정보" className="overflow-hidden rounded-[10px] px-0 pb-0 pt-0.5">
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

                <CustomerDetailFieldCard label="알림톡 설정" className="overflow-hidden rounded-[10px] px-0 pb-0 pt-0">
                  <button
                    type="button"
                    onClick={() => setIsCustomerNotificationSettingsOpen((prev) => !prev)}
                    className="flex min-h-[42px] w-full items-center justify-between gap-3 px-3 py-1 text-left transition hover:bg-[#fffdfa]"
                  >
                    <span className="relative -top-[2px] text-[16px] font-normal tracking-[-0.02em] text-[var(--text)]">{customerNotificationSummary}</span>
                    <ChevronRight
                      className={`relative -top-[2px] h-4 w-4 shrink-0 text-[var(--muted)] transition ${isCustomerNotificationSettingsOpen ? "rotate-90" : ""}`}
                      strokeWidth={1.8}
                    />
                  </button>
                  {isCustomerNotificationSettingsOpen ? (
                    <div className="max-h-[132px] overflow-y-auto border-t border-[var(--border)] divide-y divide-[var(--border)]">
                      <CustomerDetailToggleRow
                        label="알림톡 수신"
                        description="이 고객에게 예약 확정, 취소, 픽업 준비 알림을 보낼 수 있어요."
                        checked={guardianNotificationsEnabled}
                        disabled={saving}
                        onChange={(checked) => {
                          void updateGuardianNotifications(
                            selectedGuardian.id,
                            checked,
                            checked ? guardianRevisitNotificationsEnabled : false,
                          );
                        }}
                      />
                      <CustomerDetailToggleRow
                        label="재방문 안내"
                        description="다음 방문 시점이 가까워졌을 때 재방문 알림을 보낼 수 있어요."
                        checked={guardianRevisitNotificationsEnabled}
                        disabled={saving || !guardianNotificationsEnabled}
                        onChange={(checked) => {
                          void updateGuardianNotifications(selectedGuardian.id, guardianNotificationsEnabled, checked);
                        }}
                      />
                    </div>
                  ) : null}
                </CustomerDetailFieldCard>

                <div className="space-y-2">
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
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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

        {activeTab === "settings" && <SettingsPanel data={data} initialScreen={settingsEntryScreen} onActiveScreenChange={setSettingsEntryScreen} onSave={(payload) => mutate("/api/settings", { method: "PATCH", body: JSON.stringify(payload) })} onSaveService={(payload) => mutate("/api/services", { method: "POST", body: JSON.stringify(payload) })} onSaveCustomerPageSettings={(payload) => mutate("/api/customer-page-settings", { method: "PATCH", body: JSON.stringify(payload) })} onLogout={onLogout} loggingOut={loggingOut} userEmail={userEmail} subscriptionSummary={subscriptionSummary} />}
      </main>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 bg-[rgba(255,255,255,0.98)] px-2.5 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1.5 shadow-[0_-8px_24px_rgba(31,40,37,0.08)] backdrop-blur">
        <div className="grid grid-cols-4 gap-1.5">
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
                  className={`group relative flex min-h-[50px] flex-col items-center justify-center rounded-[14px] px-1 py-1 text-center transition ${
                    active
                      ? "text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-[#fcfaf7]"
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
                        ? "h-8 w-8 text-[var(--accent)]"
                        : "h-8 w-8 text-[var(--muted)]"
                    }`}
                  >
                    <Icon
                      className="h-[22px] w-[22px]"
                      strokeWidth={1.9}
                      style={shouldFill ? { fill: "currentColor" } : undefined}
                    />
                    {isActiveHome ? <span className="pointer-events-none absolute bottom-[2px] h-[12px] w-[6px] rounded-t-[2px] bg-white" /> : null}
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

      {modal && <div>{modal.type === "appointment" ? <Overlay><AppointmentDetail data={data} appointment={modal.appointment} pet={petMap[modal.appointment.pet_id]} guardian={guardianMap[modal.appointment.guardian_id]} service={serviceMap[modal.appointment.service_id]} saving={saving} onClose={() => setModal(null)} onUpdate={(payload) => updateAppointment(modal.appointment.id, payload)} onSendReminder={() => sendAppointmentReminder(modal.appointment, petMap[modal.appointment.pet_id], guardianMap[modal.appointment.guardian_id], serviceMap[modal.appointment.service_id])} /></Overlay> : null}{modal.type === "edit-shop-profile" ? <Overlay><ShopProfileEditForm data={data} saving={saving} onClose={() => setModal(null)} onSave={saveShopProfile} /></Overlay> : null}{modal.type === "new-appointment" ? <Overlay><NewAppointmentForm data={data} petId={modal.petId} saving={saving} onClose={() => setModal(null)} onSave={(payload) => mutate("/api/appointments", { method: "POST", body: JSON.stringify(payload) })} /></Overlay> : null}{modal.type === "new-customer" ? <Overlay><NewCustomerForm shopId={data.shop.id} saving={saving} onClose={() => setModal(null)} onSave={async (guardianPayload, petPayloads) => { await mutate("/api/guardians", { method: "POST", body: JSON.stringify(guardianPayload) }); const refreshed = await fetchJson<BootstrapPayload>(`/api/bootstrap?shopId=${data.shop.id}`); setData(refreshed); const guardian = refreshed.guardians[refreshed.guardians.length - 1]; for (const petPayload of petPayloads) { await mutate("/api/pets", { method: "POST", body: JSON.stringify({ ...petPayload, guardianId: guardian.id }) }); } }} /></Overlay> : null}{modal.type === "add-pet" ? <Overlay><AddPetForm shopId={data.shop.id} guardianId={modal.guardianId} saving={saving} onClose={() => setModal(null)} onSave={(payload) => mutate("/api/pets", { method: "POST", body: JSON.stringify(payload) })} /></Overlay> : null}{modal.type === "edit-record" ? <Overlay><EditRecordForm shopId={data.shop.id} services={data.services} record={modal.record} saving={saving} onClose={() => setModal(null)} onSave={(payload) => mutate("/api/records", { method: "PATCH", body: JSON.stringify(payload) })} /></Overlay> : null}{modal.type === "stat" ? <Overlay><StatDetail kind={modal.kind} todayAppointments={todayConfirmedAppointments} pendingAppointments={pendingAppointments} overdueRows={revisitRows.filter((item) => item.status === "overdue")} estimatedRevenue={estimatedRevenue} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} saving={saving} onUpdate={(appointmentId: string, payload: AppointmentUpdatePayload) => updateAppointment(appointmentId, payload)} onClose={() => setModal(null)} /></Overlay> : null}</div>}
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

function buildTelHref(phone: string) {
  return `tel:${phoneNormalize(phone)}`;
}

function buildSmsHref(phone: string) {
  return `sms:${phoneNormalize(phone)}`;
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

function Panel({
  title,
  action,
  children,
  titleClassName = "",
  titleTextClassName = "",
  className = "",
  contentClassName = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  titleClassName?: string;
  titleTextClassName?: string;
  className?: string;
  contentClassName?: string;
}) {
  return (
      <section className={`rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 shadow-[var(--shadow-soft)] ${className}`.trim()}>
      <AppSectionHeader title={title} action={action} className={`mb-2.5 ${titleClassName}`.trim()} titleClassName={titleTextClassName} />
      <div className={`space-y-2.5 ${contentClassName}`.trim()}>{children}</div>
    </section>
  );
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
      <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[#dde8e2] bg-white px-2.5 text-[11px] font-normal leading-none text-[#1f6b5b]">
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
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#eef6f3] px-2.5 text-[11px] font-normal leading-none text-[#1f6b5b]">
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
    <div className="flex min-h-[52px] w-full items-center gap-3 rounded-[12px] border border-[#ece8e2] bg-white px-[14px] py-[10px]">
      <div className="min-w-[42px] text-[15px] font-normal leading-none tracking-[-0.01em] text-[#4a4845]">{record.groomed_at.slice(11, 16)}</div>
      <div className="h-6 w-px shrink-0 bg-[#ece8e2]" />
      <AppointmentMonogram name={pet.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[16px] font-normal leading-[20px] tracking-[-0.02em] text-[#23231f]">{pet.name}</p>
          <span className="truncate text-[14px] font-normal leading-[18px] text-[#a09c96]">{guardian.name}</span>
        </div>
        <p className="truncate text-[13px] font-normal leading-[17px] text-[#b0aba3]">{service?.name || "서비스"}</p>
      </div>
      <AppointmentListTrailing status="record-completed" />
    </div>
  );
}

function StatCard({ label, value, tone, onClick }: { label: string; value: string; tone: "accent" | "warning" | "danger" | "neutral"; onClick: () => void }) {
  const toneMap = {
    accent: {
      bar: "before:bg-[var(--accent)]",
      border: "border-[#d6e7e1]",
    },
    warning: {
      bar: "before:bg-[#e4b08d]",
      border: "border-[#ead8c9]",
    },
    danger: {
      bar: "before:bg-[#cf9b8d]",
      border: "border-[#ead8d2]",
    },
    neutral: {
      bar: "before:bg-[#c9b39e]",
      border: "border-[#e9ddd3]",
    },
  } as const;

  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-[10px] border border-[var(--border)] bg-white px-4 py-3 text-left transition before:absolute before:inset-x-0 before:top-0 before:h-1.5 ${toneMap[tone].bar}`}
    >
      <p className="relative z-[1] text-[14px] font-semibold tracking-[-0.01em] text-[var(--muted)]">{label}</p>
      <p className="relative z-[1] mt-3 text-[32px] font-extrabold leading-none tracking-[-0.05em] text-[var(--text)]">{value}</p>
    </button>
  );
}

function AppointmentRow({ appointment, pet, guardian, service, onClick }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 rounded-[12px] border border-[#ece8e2] bg-white px-[14px] py-[10px] text-left transition hover:bg-[#fcfaf7]">
      <div className="min-w-[42px] text-[15px] font-normal leading-none tracking-[-0.01em] text-[#4a4845]">{formatClockTime(appointment.appointment_time)}</div>
      <div className="h-6 w-px shrink-0 bg-[#ece8e2]" />
      <AppointmentMonogram name={pet.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[16px] font-normal leading-[20px] tracking-[-0.02em] text-[#23231f]">{pet.name}</p>
          <span className="truncate text-[14px] font-normal leading-[18px] text-[#a09c96]">{guardian.name}</span>
        </div>
        <p className="truncate text-[13px] font-normal leading-[17px] text-[#b0aba3]">{service.name}</p>
      </div>
      <AppointmentListTrailing status={appointment.status} />
    </button>
  );
}

function AppointmentDetail({ data, appointment, pet, guardian, service, saving, onClose, onUpdate, onSendReminder }: { data: BootstrapPayload; appointment: Appointment; pet: Pet; guardian: Guardian; service: Service; saving: boolean; onClose: () => void; onUpdate: (payload: AppointmentUpdatePayload) => void; onSendReminder: () => Promise<void> }) {
  const rollbackStatus = appointment.status === "cancelled" ? "confirmed" : null;
  const rollbackLabel = appointment.status === "cancelled" ? "\uCDE8\uC18C/\uBCC0\uACBD \uCCA0\uD68C" : null;
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
    ["pending", "confirmed"].includes(appointment.status) && guardian.notification_settings.enabled;

  useEffect(() => {
    if (slots.length === 0) {
      setTime("");
      return;
    }

    if (!slots.includes(time)) {
      setTime(slots[0]);
    }
  }, [slots, time]);

  return (
    <Sheet title={ownerHomeCopy.appointmentDetailTitle} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-[18px] border border-[#e8e0d2] bg-white px-4 py-3.5 text-sm">
          <p className="text-[15px] font-medium text-[var(--text)]">
            {pet.name} {ownerHomeCopy.separator} {guardian.name}
          </p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {appointment.appointment_date} {formatClockTime(appointment.appointment_time)}
          </p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {selectedService.name} {ownerHomeCopy.separator} {won(selectedService.price)}
          </p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {ownerHomeCopy.memoLabel}: {appointment.memo || ownerHomeCopy.emptyMemo}
          </p>
          {appointment.rejection_reason && (
            <p className="mt-2 rounded-[14px] bg-[#fff6f4] px-3 py-2 text-[12px] font-medium text-[#b25d52]">
              미승인 사유: {appointment.rejection_reason}
            </p>
          )}
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
        {canEditSchedule && <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">예약 일정 수정</p><button type="button" className="text-xs font-semibold text-[var(--accent)]" onClick={() => setIsEditingSchedule((prev) => !prev)}>{isEditingSchedule ? "닫기" : "수정"}</button></div>{isEditingSchedule ? <div className="space-y-3"><div className="grid grid-cols-2 gap-2">{selectableServices.map((item) => <button key={item.id} type="button" className={`rounded-2xl border px-3 py-3 text-left ${serviceId === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-white"}`} onClick={() => setServiceId(item.id)}><p className="text-sm font-bold text-[var(--text)]">{item.name}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{won(item.price)}</p></button>)}</div><div className="rounded-2xl bg-[#fcfaf7] p-2"><p className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">날짜</p><HorizontalDragScroll>{dateOptions.map((item, index) => <button key={item} type="button" className={`min-w-[110px] shrink-0 rounded-2xl border px-4 py-3 text-left ${date === item ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-white text-[var(--text)]"}`} onClick={() => setDate(item)}><span className="text-sm font-bold">{index === 0 && item === currentDateInTimeZone() ? "오늘" : shortDate(item)}</span></button>)}</HorizontalDragScroll></div><div className="rounded-2xl bg-[#fcfaf7] p-2"><p className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">시간</p>{slots.length === 0 ? <div className="rounded-2xl bg-white px-4 py-5 text-center text-sm text-[var(--muted)]">선택한 날짜에 가능한 시간이 없어요.</div> : <HorizontalDragScroll>{slots.map((slot) => <button key={slot} type="button" className={`min-w-[92px] shrink-0 rounded-2xl border px-4 py-3 text-center text-sm font-bold ${time === slot ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-white text-[var(--text)]"}`} onClick={() => setTime(slot)}>{slot}</button>)}</HorizontalDragScroll>}</div><Field label="메모"><textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="field min-h-24" placeholder="변경 안내 메모를 남겨 주세요" /></Field><ActionButton disabled={!canSaveSchedule} onClick={() => onUpdate({ mode: "edit", serviceId, appointmentDate: date, appointmentTime: time, memo })}>예약 수정 저장</ActionButton></div> : <p className="text-xs leading-5 text-[var(--muted)]">서비스, 날짜, 시간, 메모를 한 번에 바꿔서 고객과 조정한 예약을 바로 반영할 수 있어요.</p>}</div>}
        {appointment.status === "pending" && <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold">미승인 사유 템플릿</p><RejectionReasonEditor template={template} customReason={customReason} onTemplateChange={(value) => setTemplate(value || rejectionReasonTemplates[0])} onCustomReasonChange={setCustomReason} /><div className="grid grid-cols-2 gap-2"><ActionButton onClick={() => onUpdate({ status: "confirmed" })} disabled={saving}>{ownerHomeCopy.pendingApprove}</ActionButton><ActionButton onClick={() => onUpdate({ status: "rejected", rejectionReasonTemplate: template, rejectionReasonCustom: customReason })} variant="secondary" disabled={saving}>{"\uBBF8\uC2B9\uC778"}</ActionButton></div></div>}
        <div className="grid grid-cols-2 gap-2">{appointment.status === "confirmed" && <ActionButton variant="highlight" onClick={() => onUpdate({ status: "in_progress" })} disabled={saving}>{"\uC2DC\uC791"}</ActionButton>}{appointment.status === "in_progress" && <ActionButton onClick={() => onUpdate({ status: "almost_done" })} variant="secondary" disabled={saving}>{ownerHomeCopy.pickupReady}</ActionButton>}{appointment.status === "almost_done" && <ActionButton onClick={() => onUpdate({ status: "completed" })} variant="complete" disabled={saving}>{ownerHomeCopy.groomingComplete}</ActionButton>}{rollbackStatus && rollbackLabel && <ActionButton onClick={() => onUpdate({ status: rollbackStatus })} variant="ghost" disabled={saving}>{rollbackLabel}</ActionButton>}</div>
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

function HorizontalDragScroll({ children }: { children: React.ReactNode }) {
  return <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">{children}</div>;
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
function EditRecordForm({ services, record, saving, onClose, onSave }: { shopId: string; services: Service[]; record: GroomingRecord; saving: boolean; onClose: () => void; onSave: (payload: unknown) => void }) { const [styleNotes, setStyleNotes] = useState(record.style_notes); const [memo, setMemo] = useState(record.memo); const [pricePaid, setPricePaid] = useState(String(record.price_paid)); const [serviceId, setServiceId] = useState(record.service_id); return <Sheet title="미용 기록 수정" onClose={onClose}><div className="space-y-3"><Field label="서비스"><select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="field">{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="스타일 메모"><input value={styleNotes} onChange={(event) => setStyleNotes(event.target.value)} className="field" /></Field><Field label="상세 메모"><textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="field min-h-24" /></Field><Field label="결제 금액"><input value={pricePaid} onChange={(event) => setPricePaid(event.target.value)} className="field" /></Field><ActionButton disabled={saving} onClick={() => onSave({ recordId: record.id, styleNotes, memo, pricePaid: Number(pricePaid), serviceId })}>기록 저장</ActionButton></div></Sheet>; }

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
                concurrentCapacity: data.shop.concurrent_capacity,
                bookingSlotIntervalMinutes: data.shop.booking_slot_interval_minutes,
                bookingSlotOffsetMinutes: data.shop.booking_slot_offset_minutes,
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
              placeholder="예: 포근한 발바닥 미용실"
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

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return <Sheet title="예약 링크 사용법" onClose={onClose}><div className="space-y-4"><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold text-[var(--text)]">1. 고객용 예약 링크</p><div className="mt-3 flex items-center gap-2 rounded-[14px] bg-white px-3 py-3"><p className="min-w-0 flex-1 break-all text-[12px] text-[var(--muted)]">{bookingEntryUrl}</p><button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]" onClick={async () => { await navigator.clipboard.writeText(bookingEntryUrl); setCopied(true); if (timeoutRef.current) clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => setCopied(false), 1800); }} aria-label="예약 링크 복사">{copied ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Copy className="h-4 w-4" />}</button></div></div><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold text-[var(--text)]">2. 어디에 붙이면 좋은가요?</p><ul className="mt-3 space-y-2 text-[13px] leading-6 text-[var(--muted)]"><li>인스타그램 프로필 링크</li><li>네이버 플레이스 소개글/예약 안내</li><li>카카오채널 채팅방 버튼 또는 자동응답</li><li>문자, 알림톡, 단골 고객 안내 메시지</li></ul></div><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold text-[var(--text)]">3. 왜 한 링크로 모으나요?</p><p className="mt-3 text-[13px] leading-6 text-[var(--muted)]">여러 채널에서 예약이 들어와도 결국 같은 예약 페이지로 모이면 일정 확인, 승인, 변경, 고객 관리가 한 화면에서 정리됩니다.</p></div></div></Sheet>;
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
function StatDetail({ kind, todayAppointments, pendingAppointments, overdueRows, estimatedRevenue, petMap, guardianMap, serviceMap, saving, onUpdate, onClose }: { kind: "today" | "pending" | "completed" | "cancel_change"; todayAppointments: Appointment[]; pendingAppointments: Appointment[]; overdueRows: Array<{ pet: Pet; guardian: Guardian; daysUntil: number | null }>; estimatedRevenue: number; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; saving: boolean; onUpdate: (appointmentId: string, payload: AppointmentUpdatePayload) => void; onClose: () => void }) { const [openRejectAppointmentId, setOpenRejectAppointmentId] = useState<string | null>(null); const currentAppointments = todayAppointments.filter((item) => ["confirmed", "in_progress", "almost_done"].includes(item.status)); const completedAppointments = todayAppointments.filter((item) => item.status === "completed"); const cancelChangeOnly = todayAppointments.filter((item) => item.status === "cancelled"); return <Sheet title={kind === "today" ? ownerHomeCopy.todaySheetTitle : kind === "pending" ? ownerHomeCopy.pendingSheetTitle : kind === "completed" ? ownerHomeCopy.completedSheetTitle : ownerHomeCopy.cancelChangeSheetTitle} onClose={onClose}><div className="space-y-3">{kind === "today" && <CurrentReservationsContent currentAppointments={currentAppointments} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} saving={saving} onOpenAppointment={() => {}} onStatusChange={(appointmentId, status) => onUpdate(appointmentId, { status })} />}{kind === "pending" && pendingAppointments.map((appointment) => <PendingApprovalCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => {}} onStatusChange={(payload) => { setOpenRejectAppointmentId(null); onUpdate(appointment.id, payload); }} isRejectOpen={openRejectAppointmentId === appointment.id} onRejectOpen={() => setOpenRejectAppointmentId(appointment.id)} onRejectClose={() => setOpenRejectAppointmentId(null)} />)}{kind === "completed" && <CompletedReservationsContent historyAppointments={completedAppointments} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} onOpenAppointment={() => {}} />}{kind === "cancel_change" && cancelChangeOnly.map((appointment) => <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => {}} onStatusChange={(status) => onUpdate(appointment.id, { status })} />)}</div></Sheet>; }

function PendingApprovalCard({ appointment, pet, guardian, service, saving, onOpen, onStatusChange, isRejectOpen, onRejectOpen, onRejectClose }: { appointment: Appointment; pet: Pet; guardian: Guardian; service: Service; saving: boolean; onOpen: () => void; onStatusChange: (payload: AppointmentUpdatePayload) => void; isRejectOpen: boolean; onRejectOpen: () => void; onRejectClose: () => void }) {
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
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <button onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <div className="min-w-[58px] text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">{formatClockTime(appointment.appointment_time)}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">{pet.name} <span className="text-xs font-medium text-[var(--muted)]">({guardian.name})</span></p>
          <p className="text-xs text-[var(--muted)]">{service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}</p>
        </div>
        <AppStatusBadge label={statusMeta[appointment.status].label} tone={badgeToneForAppointmentStatus(appointment.status)} />
      </button>
      {!isRejectOpen ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <ActionButton onClick={() => onStatusChange({ status: "confirmed" })} variant="warm" disabled={saving}>{ownerHomeCopy.pendingApprove}</ActionButton>
          <ActionButton onClick={onRejectOpen} variant="secondary" disabled={saving}>{"미승인"}</ActionButton>
        </div>
      ) : (
        <div className="mt-3 space-y-3 rounded-[12px] border border-[var(--border)] bg-[#fcfaf7] p-3">
          <p className="text-xs font-semibold text-[var(--text)]">사유를 선택해주세요</p>
          <RejectionReasonEditor template={template} customReason={customReason} onTemplateChange={(value) => setTemplate(value || rejectionReasonTemplates[0])} onCustomReasonChange={setCustomReason} />
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={handleRejectCancel} variant="ghost" disabled={saving}>{"취소"}</ActionButton>
            <ActionButton onClick={handleRejectConfirm} variant="secondary" disabled={saving || !canSubmitReject}>{"미승인 확정"}</ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}


function CurrentReservationsContent({ currentAppointments, petMap, guardianMap, serviceMap, saving, onOpenAppointment, onStatusChange }: { currentAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; saving: boolean; onOpenAppointment: (appointment: Appointment) => void; onStatusChange: (appointmentId: string, status: AppointmentStatus) => void; }) {
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || currentAppointments.length === 0) return;
    const hintKey = "owner-home-swipe-cancel-hint-seen";
    if (window.localStorage.getItem(hintKey)) return;
    window.localStorage.setItem(hintKey, "true");
    setShowSwipeHint(true);
    const timeout = window.setTimeout(() => setShowSwipeHint(false), 4500);
    return () => window.clearTimeout(timeout);
  }, [currentAppointments.length]);

  return <div className="overflow-hidden rounded-[10px] border border-[#d8e7e0] bg-[#f6fbf8] p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#2f7866]" /><div className="mb-2.5"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.currentSectionTitle}</h3></div>{showSwipeHint ? <div className="mb-2.5 rounded-[10px] border border-[#d7e8e0] bg-white/90 px-3 py-2 text-[12px] font-medium leading-5 text-[#4d6b62]">예약 카드를 왼쪽으로 밀면 취소 버튼이 나타나요.</div> : null}<div className="max-h-[34rem] overflow-y-auto pr-1"><div className="space-y-2.5">{currentAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.currentSectionEmpty} /> : currentAppointments.map((appointment) => <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} allowSwipeCancel />)}</div></div></div>;
}

function TodayConfirmedContent({ pendingAppointments, currentAppointments, completedAppointments, petMap, guardianMap, serviceMap, approvalMode, saving, selectedDateKey, slideDirection, canMoveBackward, canMoveForward, onMoveBackward, onMoveForward, onOpenAppointment, onPendingUpdate, onStatusChange, onApprovalModeChange }: { pendingAppointments: Appointment[]; currentAppointments: Appointment[]; completedAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; approvalMode?: "manual" | "auto"; saving: boolean; selectedDateKey: string; slideDirection: "prev" | "next"; canMoveBackward: boolean; canMoveForward: boolean; onMoveBackward: () => void; onMoveForward: () => void; onOpenAppointment: (appointment: Appointment) => void; onPendingUpdate: (appointmentId: string, payload: AppointmentUpdatePayload) => void; onStatusChange: (appointmentId: string, status: AppointmentStatus) => void; onApprovalModeChange?: (mode: "manual" | "auto") => void; }) {
  const [openRejectAppointmentId, setOpenRejectAppointmentId] = useState<string | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [contentSlideStyle, setContentSlideStyle] = useState<{ transform: string; opacity: number; transition: string }>({
    transform: "translateX(0px)",
    opacity: 1,
    transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease",
  });

  useEffect(() => {
    const offset = slideDirection === "next" ? 92 : -92;
    setContentSlideStyle({
      transform: `translateX(${offset}px)`,
      opacity: 0.96,
      transition: "none",
    });
    const runAnimation = () => {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        setContentSlideStyle({
          transform: "translateX(0px)",
          opacity: 1,
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease",
        });
      });
    };
    if (typeof window !== "undefined") {
      runAnimation();
    }
    return () => {
      if (animationFrameRef.current !== null && typeof window !== "undefined") {
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

  return <div className="space-y-3"><div className="select-none" onPointerDown={handleDatePointerDown} onPointerUp={handleDatePointerUp} onPointerCancel={resetSwipeStart} /><div className="space-y-3" style={contentSlideStyle}><div className="overflow-hidden rounded-[10px] border border-[#ead9cf] bg-[#fffaf6] p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#e6b091]" /><div className="space-y-2"><div className="flex items-center justify-between gap-3"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.pendingSectionTitle}</h3>{approvalMode ? <span className="text-[11px] font-medium text-[#8b6b5d]">{approvalMode === "manual" ? "직접 승인 선택됨" : "바로 승인 선택됨"}</span> : null}</div>{approvalMode && onApprovalModeChange ? <div className="grid grid-cols-2 gap-2 rounded-[10px] border border-[#ead9cf] bg-white/80 p-1"><button type="button" onClick={() => onApprovalModeChange("manual")} disabled={saving || approvalMode === "manual"} className={`rounded-[10px] px-3 py-2 text-sm font-semibold transition ${approvalMode === "manual" ? "bg-[#c99273] text-white" : "bg-white text-[var(--muted)]"}`}>{"직접 승인"}</button><button type="button" onClick={() => onApprovalModeChange("auto")} disabled={saving || approvalMode === "auto"} className={`rounded-[10px] px-3 py-2 text-sm font-semibold transition ${approvalMode === "auto" ? "bg-[#c99273] text-white" : "bg-white text-[var(--muted)]"}`}>{"바로 승인"}</button></div> : null}</div><div className="mt-3 max-h-64 overflow-y-auto pr-1"><div className="space-y-2.5">{pendingAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.pendingSectionEmpty} titleClassName="translate-y-px" /> : pendingAppointments.map((appointment) => <PendingApprovalCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(payload) => { setOpenRejectAppointmentId(null); onPendingUpdate(appointment.id, payload); }} isRejectOpen={openRejectAppointmentId === appointment.id} onRejectOpen={() => setOpenRejectAppointmentId(appointment.id)} onRejectClose={() => setOpenRejectAppointmentId(null)} />)}</div></div></div><div className="overflow-hidden rounded-[10px] border border-[#d8e7e0] bg-[#f6fbf8] p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#2f7866]" /><div className="mb-2.5"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.currentSectionTitle}</h3></div><div className="max-h-[29rem] overflow-y-auto pr-1"><div className="space-y-2.5">{currentAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.currentSectionEmpty} titleClassName="translate-y-px" /> : currentAppointments.map((appointment) => <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} allowSwipeCancel />)}</div></div></div><CompletedReservationsContent historyAppointments={completedAppointments} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} onOpenAppointment={onOpenAppointment} /></div></div>;
}


function CompletedReservationsContent({ historyAppointments, petMap, guardianMap, serviceMap, onOpenAppointment }: { historyAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, BootstrapPayload["guardians"][number]>; serviceMap: Record<string, Service>; onOpenAppointment: (appointment: Appointment) => void; }) {
  return <div className="overflow-hidden rounded-[10px] border border-[#e9ddd3] bg-[#fbf8f4] p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#c9b39e]" /><div className="mb-2.5"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.historySectionTitle}</h3></div><div className="space-y-2.5">{historyAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.historySectionEmpty} titleClassName="translate-y-px" /> : historyAppointments.map((appointment) => <CompletedAppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => onOpenAppointment(appointment)} />)}</div></div>;
}

function CompletedAppointmentRow({ appointment, pet, guardian, service, onClick }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 rounded-[12px] border border-[#ece8e2] bg-white px-[14px] py-[10px] text-left transition hover:bg-[#fcfaf7]">
      <div className="min-w-[42px] text-[15px] font-normal leading-none tracking-[-0.01em] text-[#4a4845]">{formatClockTime(appointment.appointment_time)}</div>
      <div className="h-6 w-px shrink-0 bg-[#ece8e2]" />
      <AppointmentMonogram name={pet.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[16px] font-normal leading-[20px] tracking-[-0.02em] text-[#23231f]">{pet.name}</p>
          <span className="truncate text-[14px] font-normal leading-[18px] text-[#a09c96]">{guardian.name}</span>
        </div>
        <p className="truncate text-[13px] font-normal leading-[17px] text-[#b0aba3]">{service.name}</p>
      </div>
      <AppointmentListTrailing status="completed" />
    </button>
  );
}
function HomeConfirmedCard({ appointment, pet, guardian, service, saving, onOpen, onStatusChange, allowSwipeCancel = false }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; saving: boolean; onOpen: () => void; onStatusChange: (status: AppointmentStatus) => void; allowSwipeCancel?: boolean; }) {
  const actionWidth = 96;
  const snapThreshold = 48;
  const [startX, setStartX] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const isDragging = startX !== null;
  const actionVisible = allowSwipeCancel && (isDragging || translateX !== 0);
  const rollbackStatus = appointment.status === "cancelled" ? "confirmed" : null;
  const rollbackLabel = appointment.status === "cancelled" ? "\uCDE8\uC18C/\uBCC0\uACBD \uCCA0\uD68C" : null;

  const closeSwipe = () => setTranslateX(0);

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
    setDragStartX(translateX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowSwipeCancel || startX === null || saving) return;
    const diff = event.clientX - startX;
    const next = Math.min(0, Math.max(-actionWidth, dragStartX + diff));
    setTranslateX(next);
  };

  const handlePointerUp = () => {
    if (!allowSwipeCancel) return;
    setTranslateX(translateX <= -snapThreshold ? -actionWidth : 0);
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
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <div className="min-w-[64px] text-[22px] font-semibold tracking-[-0.03em] text-[var(--text)]">{formatClockTime(appointment.appointment_time)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[16px] font-semibold text-[var(--text)]">{pet.name}</p>
                <span className="truncate text-[14px] font-medium text-[var(--muted)]">{guardian.name}</span>
              </div>
              <p className="mt-1 text-[14px] leading-5 text-[var(--muted)]">
                {service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}
              </p>
            </div>
            <AppStatusBadge label={statusMeta[appointment.status].label} tone={badgeToneForAppointmentStatus(appointment.status)} className="px-2.5 py-1.5 tracking-[0.01em]" />
          </button>

          <div className="grid grid-cols-2 gap-2 px-4 pb-3">
            {appointment.status === "confirmed" && <ActionButton variant="accentSoft" onClick={() => onStatusChange("in_progress")} disabled={saving}>{"\uC2DC\uC791"}</ActionButton>}
            {appointment.status === "in_progress" && <ActionButton onClick={() => onStatusChange("almost_done")} variant="warm" disabled={saving}>{ownerHomeCopy.pickupReady}</ActionButton>}
            {appointment.status === "almost_done" && <ActionButton onClick={() => onStatusChange("completed")} variant="complete" disabled={saving}>{ownerHomeCopy.groomingComplete}</ActionButton>}
            {rollbackStatus && rollbackLabel && <ActionButton onClick={() => onStatusChange(rollbackStatus)} variant="ghost" disabled={saving}>{rollbackLabel}</ActionButton>}
            {appointment.status === "completed" && <div className="col-span-2 rounded-[10px] border border-[#dce8e3] bg-[#f4faf7] px-4 py-3 text-center text-sm font-semibold text-[var(--accent)]">{ownerHomeCopy.completedNotice}</div>}
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
    setName(pet.name);
    setBreed(pet.breed);
    setBirthday(pet.birthday ?? "");
    setIsEditing(false);
  }, [pet.birthday, pet.breed, pet.name]);

  const summary = [breed, birthday ? `생일 ${birthday}` : null, isBirthdayToday ? "오늘 생일" : null].filter(Boolean).join(" · ");

  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 bg-white px-3.5 py-3 text-left transition hover:bg-[#fffdfa]"
        onClick={onSelect}
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
      </button>

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
function PetDetailInputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[14px] font-medium tracking-[-0.01em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
function QuickContactRow({ phone, sending = false, reminderSent = false, onSendReminder }: { phone: string; sending?: boolean; reminderSent?: boolean; onSendReminder?: () => Promise<void> }) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2">
      <a
        href={buildTelHref(phone)}
        className="flex items-center justify-center rounded-[14px] border border-[#e8e0d2] bg-[#faf8f4] px-4 py-3 text-[14px] font-medium text-[var(--text)]"
      >
        전화하기
      </a>
      <a
        href={buildSmsHref(phone)}
        className="flex items-center justify-center rounded-[14px] border border-[#e8e0d2] bg-white px-4 py-3 text-[14px] font-medium text-[var(--text)]"
      >
        문자 보내기
      </a>
      {onSendReminder ? (
        <button
          type="button"
          onClick={() => void onSendReminder()}
          disabled={sending || reminderSent}
          className="col-span-2 flex items-center justify-center rounded-[14px] border border-[#dfe8e2] bg-[#f7fbf9] px-4 py-3 text-[14px] font-medium text-[#2f7266] disabled:opacity-60"
        >
          {reminderSent ? "예약 10분 전 알림톡 발송됨" : "예약 10분 전 알림톡 발송"}
        </button>
      ) : null}
    </div>
  );
}

function ToggleRow({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) { return <label className={`flex items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 ${disabled ? "opacity-50" : ""}`}><div><p className="text-[14px] font-semibold text-[var(--text)]">{label}</p><p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">{description}</p></div><button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-[var(--accent)]" : "bg-[#d9d6cf]"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} /></button></label>; }
function Overlay({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
function Sheet({ title, children, onClose, footer }: { title: string; children: React.ReactNode; onClose: () => void; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="flex max-h-[92vh] min-h-0 w-full max-w-[430px] flex-col overflow-hidden rounded-t-[32px] bg-white px-4 pb-5 pt-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-medium tracking-[-0.01em] text-[var(--text)]">{title}</h3>
          <button className="text-[13px] font-medium text-[var(--muted)]" onClick={onClose}>닫기</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {children}
        </div>
        {footer ? <div className="mt-4 border-t border-[var(--border)] pt-3">{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-[13px] text-[var(--text)]"><span className="mb-1.5 block text-[11px] font-medium tracking-[-0.01em] text-[var(--muted)]">{label}</span>{children}</label>; }
function ActionButton({ children, disabled, onClick, variant = "primary" }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; variant?: "primary" | "secondary" | "ghost" | "highlight" | "warm" | "accentSoft" | "ready" | "complete" }) {
  const className =
    variant === "primary"
      ? "border border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]"
      : variant === "secondary"
        ? "border border-[var(--border)] bg-white text-[var(--text)]"
        : variant === "highlight"
          ? "border border-[#d7e7e1] bg-[var(--accent-soft)] text-[var(--accent)]"
          : variant === "warm"
            ? "border border-[#c99273] bg-[#c99273] text-white shadow-[0_8px_18px_rgba(201,146,115,0.15)]"
            : variant === "accentSoft"
              ? "border border-[#d7e7e1] bg-[#2f7866] text-white shadow-[0_8px_18px_rgba(47,120,102,0.14)]"
              : variant === "ready"
                ? "border border-[#cf9b8d] bg-[#cf9b8d] text-white shadow-[0_8px_18px_rgba(207,155,141,0.16)]"
                : variant === "complete"
                  ? "border border-[#2a8a72] bg-[#2a8a72] text-white shadow-[0_10px_20px_rgba(42,138,114,0.18)]"
      : "border border-[var(--border)] bg-white text-[var(--muted)]";
  return <button disabled={disabled} onClick={onClick} className={`flex h-[42px] w-full items-center justify-center rounded-[14px] px-4 text-[14px] font-medium tracking-[-0.01em] transition hover:bg-opacity-95 disabled:opacity-50 ${className}`}>{children}</button>;
}

function CustomerDetailFieldCard({
  label,
  children,
  onClick,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const sharedClassName = `isolate min-w-0 overflow-visible rounded-[12px] border border-[var(--border)] bg-white px-3 pb-1 pt-0.5 text-left ${onClick ? "transition hover:border-[#d9d2c9] hover:bg-[#fffdfa]" : ""} ${className}`.trim();
  const labelNode = (
    <legend className="ml-0.5 px-1.5 text-[16px] font-medium tracking-[-0.01em] text-[var(--muted)]">
      {label}
    </legend>
  );

  if (onClick) {
    return (
      <fieldset className={sharedClassName}>
        {labelNode}
        <button type="button" className="block w-full text-left" onClick={onClick}>
          {children}
        </button>
      </fieldset>
    );
  }

  return (
    <fieldset className={sharedClassName}>
      {labelNode}
      {children}
    </fieldset>
  );
}

function CustomerDetailInfoRow({
  label,
  value,
  onClick,
  muted = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  muted?: boolean;
  multiline?: boolean;
}) {
  const rowClassName = `relative z-[1] flex w-full justify-between gap-3 px-3.5 ${multiline ? "items-start py-2" : "min-h-[56px] items-center py-2"} text-left ${onClick ? "transition hover:bg-[#fffdfa]" : ""}`.trim();
  const valueClassName = multiline
    ? `text-[15px] leading-5 tracking-[-0.02em] ${muted ? "font-normal text-[var(--muted)]" : "font-normal text-[var(--text)]"}`
    : `text-[16px] leading-6 tracking-[-0.02em] ${muted ? "font-normal text-[var(--muted)]" : "font-normal text-[var(--text)]"}`;
  const body = (
    <>
      <div className={`relative min-w-0 flex-1 ${multiline ? "-top-[2px]" : "-top-[2px]"}`}>
        <p className={valueClassName}>{value}</p>
        <p className={`${multiline ? "mt-0.5" : "mt-1"} text-[13px] leading-5 text-[var(--muted)]`}>{label}</p>
      </div>
      {onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={1.8} /> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={rowClassName} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={rowClassName}>{body}</div>;
}

function CustomerDetailToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex min-h-[56px] items-center justify-between gap-3 px-3.5 py-2 ${disabled ? "opacity-50" : ""}`}>
      <div className="relative -top-0.5 min-w-0 flex-1">
        <p className="text-[17px] font-normal tracking-[-0.02em] text-[var(--text)]">{label}</p>
        <p className="mt-1 text-[13px] leading-5 text-[var(--muted)]">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-[26px] w-11 shrink-0 rounded-full transition ${checked ? "bg-[var(--accent)]" : "bg-[#d9d6cf]"}`}
      >
        <span className={`absolute top-[3px] size-5 rounded-full bg-white shadow-sm transition ${checked ? "left-[22px]" : "left-[3px]"}`} />
      </button>
    </label>
  );
}

function CustomerMetricCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-[16px] border border-[var(--border)] bg-white px-3.5 ${compact ? "py-3" : "py-3.5"}`}>
      <p className="text-[12px] font-medium leading-4 text-[var(--muted)]">{label}</p>
      <p className={`mt-1 font-semibold tracking-[-0.02em] text-[var(--text)] ${compact ? "line-clamp-2 text-[14px] leading-5" : "text-[15px] leading-5"}`}>{value}</p>
    </div>
  );
}

function CustomerEmptyState({ title, description, action = null }: { title: string; description: string; action?: React.ReactNode }) {
  return <AppEmptyState title={title} description={description} action={action} className="rounded-[18px] bg-[#fcfaf7] px-4 py-5" />;
}

function EmptyState({
  title,
  className = "",
  compact = false,
  titleClassName = "",
}: {
  title: string;
  className?: string;
  compact?: boolean;
  titleClassName?: string;
}) {
  if (compact) {
    return (
      <div className={`flex items-center justify-center rounded-[10px] border border-[var(--border)] bg-white text-center ${className}`.trim()}>
        <p className={`text-[14px] font-normal leading-[20px] tracking-[-0.02em] text-[#6f6a63] ${titleClassName}`.trim()}>{title}</p>
      </div>
    );
  }

  return (
    <AppEmptyState
      title={title}
      titleClassName={titleClassName}
      className={`min-h-[68px] rounded-[10px] bg-white px-3.5 py-4 ${className}`.trim()}
    />
  );
}

function CustomerDetailHistoryPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (nextPage: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 pt-1">
      {Array.from({ length: totalPages }, (_, index) => {
        const nextPage = index + 1;
        const active = nextPage === page;
        return (
          <button
            key={nextPage}
            type="button"
            onClick={() => onChange(nextPage)}
            className={`inline-flex h-[28px] min-w-[58px] items-center justify-center rounded-[999px] border px-3 text-[12px] font-medium transition ${
              active
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border)] bg-white text-[var(--muted)]"
            }`}
          >
            {nextPage}페이지
          </button>
        );
      })}
    </div>
  );
}

function ShopAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return <img src={imageUrl} alt={`${name} 대표 이미지`} className="h-11 w-11 rounded-full border border-[#dfeae5] object-cover shadow-[0_2px_8px_rgba(31,107,91,0.05)]" />;
  }

  return <div className="flex size-11 items-center justify-center rounded-full border border-[#dfeae5] bg-[#f4f5f4] text-[#9ea4a1] shadow-[0_2px_8px_rgba(31,107,91,0.05)]"><UserRound className="h-5 w-5" strokeWidth={1.9} /></div>;
}

function Avatar({ seed }: { seed: string }) { return <div className="flex size-11 items-center justify-center rounded-full border border-[#dfeae5] bg-[#f6fbf9] text-lg shadow-[0_2px_8px_rgba(31,107,91,0.05)]">{seed}</div>; }
function UrgencyPill({ status, days }: { status: "overdue" | "soon" | "ok" | "unknown"; days: number | null }) {
  const text = status === "overdue" ? `${Math.abs(days || 0)}일 초과` : status === "soon" ? `${days}일 남음` : status === "ok" ? `${days}일 여유` : "미산정";
  const cls = status === "overdue" ? "bg-red-50 text-red-700" : status === "soon" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${cls}`}>{text}</span>;
}

function InfoItem({ label, value, className = "" }: { label: string; value: string; className?: string }) { return <div className={`rounded-[16px] border border-[var(--border)] bg-white px-4 py-2 ${className}`.trim()}><p className="text-[12px] font-medium leading-4 text-[var(--muted)]">{label}</p><p className="mt-1 flex min-h-[20px] items-center text-[15px] font-semibold leading-5 tracking-[-0.02em] text-[var(--text)]">{value}</p></div>; }

function NotificationHistoryRow({ notification, pet }: { notification: BootstrapPayload["notifications"][number]; pet: Pet | null }) {
  const typeLabel = (() => {
    switch (notification.type) {
      case "booking_received":
        return "예약 접수";
      case "booking_confirmed":
        return "예약 완료";
      case "owner_booking_requested":
        return "새 예약 접수";
      case "booking_rejected":
        return "예약 거절";
      case "booking_cancelled":
        return "예약 취소";
      case "booking_rescheduled_confirmed":
        return "예약 변경";
      case "appointment_reminder_10m":
        return "방문 전 안내";
      case "grooming_started":
        return "미용 시작";
      case "grooming_almost_done":
        return "픽업 준비";
      case "grooming_completed":
        return "미용 완료";
      case "revisit_notice":
        return "재방문 안내";
      case "birthday_greeting":
        return "생일 축하";
      default:
        return "알림 발송";
    }
  })();
  const statusLabel =
    notification.status === "sent" || notification.status === "mocked"
      ? "발송 완료"
      : notification.status === "failed"
        ? "발송 실패"
        : notification.status === "queued"
          ? "발송 대기"
          : "건너뜀";
  const statusTone =
    notification.status === "sent" || notification.status === "mocked"
      ? "bg-[#eef8f3] text-[var(--accent)]"
      : notification.status === "failed"
        ? "bg-[#fdf0ec] text-[#b85c47]"
        : "bg-[#f4f0ea] text-[var(--muted)]";
  const timestamp = notification.sent_at ?? notification.created_at;
  const parsed = new Date(timestamp);
  const timeLabel = Number.isNaN(parsed.getTime())
    ? timestamp
    : `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, "0")}.${String(parsed.getDate()).padStart(2, "0")} ${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-medium tracking-[-0.01em] text-[var(--text)]">{typeLabel}</p>
            {pet ? <span className="text-[14px] font-medium text-[var(--muted)]">{pet.name}</span> : null}
          </div>
          <p className="mt-1 text-[14px] leading-5 text-[var(--muted)]">{timeLabel}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[14px] font-normal ${statusTone}`}>{statusLabel}</span>
      </div>
      <p className="mt-1.5 text-[14px] leading-5 text-[var(--text)] break-words">{notification.message}</p>
    </div>
  );
}




























