"use client";

import { CalendarDays, Camera, ChevronDown, Copy, House, PawPrint, Settings, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import OwnerSettingsPanel from "@/components/owner/owner-settings-panel";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { computeAvailableSlots, revisitInfo } from "@/lib/availability";
import { normalizeCustomerPageSettings } from "@/lib/customer-page-settings";
import { ownerHomeCopy } from "@/lib/owner-home-copy";
import { addDate, currentDateInTimeZone, formatClockTime, phoneNormalize, shortDate, won } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload, GroomingRecord, Pet, Service } from "@/types/domain";

type TabKey = "home" | "book" | "customers" | "settings";
type SettingsEntryScreen = "subscription" | "shop" | "closures" | "services" | "account" | null;
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
  { key: "book", label: "예약 조회", icon: CalendarDays },
  { key: "customers", label: "고객관리", icon: PawPrint },
  { key: "settings", label: "설정", icon: Settings },
];

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message || "\uC694\uCCAD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
  return json as T;
}

export default function OwnerApp({
  initialData,
  ownedShops,
  selectedShopId,
  onLogout,
  onSwitchShop,
  loggingOut = false,
  userEmail = null,
  subscriptionSummary = null,
}: {
  initialData: BootstrapPayload;
  ownedShops: OwnedShopSummary[];
  selectedShopId: string | null;
  onLogout?: () => void;
  onSwitchShop?: (shopId: string) => Promise<void>;
  loggingOut?: boolean;
  userEmail?: string | null;
  subscriptionSummary?: OwnerSubscriptionSummary | null;
}) {
  const isAdminUser = (userEmail ?? "").trim().toLowerCase() === "nthink624@gmail.com";
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [todayDate, setTodayDate] = useState(() => currentDateInTimeZone());
  const [selectedDate, setSelectedDate] = useState(() => currentDateInTimeZone());
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedGuardianIds, setSelectedGuardianIds] = useState<string[]>([]);
  const [isCustomerListEditing, setIsCustomerListEditing] = useState(false);
  const [visitDateFilter, setVisitDateFilter] = useState(currentDateInTimeZone());
  const [visitSelectionMode, setVisitSelectionMode] = useState<"single" | "range">("single");
  const [visitRange, setVisitRange] = useState<{ start: string; end: string } | null>(null);
  const [detailTab, setDetailTab] = useState<"pets" | "records" | "notifications">("pets");
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
  const [isGuardianEditing, setIsGuardianEditing] = useState(false);
  const [isGuardianMemoEditing, setIsGuardianMemoEditing] = useState(false);
  const [guardianDraft, setGuardianDraft] = useState({
    name: "",
    phone: "",
    memo: "",
  });
  const isOwnerDemo = data.shop.id === "owner-demo";

  async function refresh() {
    if (isOwnerDemo) return;
    const next = await fetchJson<BootstrapPayload>(`/api/bootstrap?shopId=${data.shop.id}`);
    setData(next);
  }

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

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
  const activeServiceCount = useMemo(() => data.services.filter((item) => item.is_active).length, [data.services]);
  const currentOwnedShop = useMemo(
    () => ownedShops.find((shop) => shop.id === (selectedShopId || data.shop.id)) ?? {
      id: data.shop.id,
      name: data.shop.name,
      address: data.shop.address,
      heroImageUrl: data.shop.customer_page_settings?.hero_image_url || "",
    },
    [data.shop.address, data.shop.customer_page_settings, data.shop.id, data.shop.name, ownedShops, selectedShopId],
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
  const selectedDayAppointments = useMemo(() => data.appointments.filter((item) => item.appointment_date === selectedDate).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)), [data.appointments, selectedDate]);
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
    const latestPet = latestRecord ? petMap[latestRecord.pet_id] : latestAppointment ? petMap[latestAppointment.pet_id] : pets[0];
    const latestService = latestRecord ? serviceMap[latestRecord.service_id] : latestAppointment ? serviceMap[latestAppointment.service_id] : undefined;
    const latestVisitedAt = latestRecord?.groomed_at?.slice(0, 10) || latestAppointment?.appointment_date || null;
    const latestNote = latestRecord?.style_notes || latestRecord?.memo || latestAppointment?.memo || "메모 없음";
    const revisitCandidates = revisitRows.filter((row) => row.guardian?.id === guardian.id && ["overdue", "soon"].includes(row.status));
    const recentVisited = latestVisitedAt ? Math.abs((new Date(todayDate).getTime() - new Date(latestVisitedAt).getTime()) / 86400000) <= 30 : false;
    return { guardian, pets, latestPet, latestService, latestVisitedAt, latestNote, visitCount: records.length, revisitCandidates, isAlertsOff: !guardian.notification_settings.enabled, isRecent: recentVisited };
  }), [data.guardians, data.pets, data.groomingRecords, data.appointments, petMap, serviceMap, revisitRows, todayDate]);

  const filteredGuardians = useMemo(() => {
    const query = customerSearch.trim();
    return customerSummaries.filter((summary) => {
      const matchesQuery = !query || summary.guardian.name.includes(query) || summary.guardian.phone.includes(query) || summary.pets.some((pet) => pet.name.includes(query) || pet.breed.includes(query));
      return matchesQuery;
    });
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
  const selectedVisitHasTodayOrFuture = selectedVisitDates.some((item) => item >= todayDate);
  const shouldShowVisitActionSection = isSelectedVisitRange ? selectedVisitHasTodayOrFuture : selectedVisitDate >= todayDate;
  const selectedVisitAppointments = useMemo(() => data.appointments.filter((item) => selectedVisitDateSet.has(item.appointment_date)).sort((a, b) => (a.appointment_date + " " + a.appointment_time).localeCompare(b.appointment_date + " " + b.appointment_time)), [data.appointments, selectedVisitDateSet]);
  const selectedVisitRecords = useMemo(() => data.groomingRecords.filter((item) => selectedVisitDateSet.has(item.groomed_at.slice(0, 10))).sort((a, b) => b.groomed_at.localeCompare(a.groomed_at)), [data.groomingRecords, selectedVisitDateSet]);
  const selectedVisitActionAppointments = useMemo(() => selectedVisitAppointments.filter((item) => item.appointment_date >= todayDate && ["pending", "confirmed", "in_progress", "almost_done"].includes(item.status)), [selectedVisitAppointments, todayDate]);
  const selectedVisitCancelledAppointments = useMemo(() => selectedVisitAppointments.filter((item) => item.status === "cancelled"), [selectedVisitAppointments]);
  const completedAppointmentIds = useMemo(() => new Set(selectedVisitRecords.map((item) => item.appointment_id).filter(Boolean)), [selectedVisitRecords]);
  const selectedVisitCompletedAppointments = useMemo(() => selectedVisitAppointments.filter((item) => {
    if (item.status === "cancelled") return false;
    const isPast = item.appointment_date < todayDate;
    if (isPast) return !completedAppointmentIds.has(item.id);
    return ["completed"].includes(item.status) && !completedAppointmentIds.has(item.id);
  }), [completedAppointmentIds, selectedVisitAppointments, todayDate]);

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
  const quickVisitDates = useMemo(() => Array.from({ length: 5 }, (_, index) => addDate(todayDate, index)), [todayDate]);
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
  const selectedPet = selectedPetId ? petMap[selectedPetId] : null;
  const selectedGuardian = selectedPet ? guardianMap[selectedPet.guardian_id] : null;
  const selectedGuardianPets = selectedGuardian ? data.pets.filter((item) => item.guardian_id === selectedGuardian.id) : [];
  const selectedRecords = selectedPet ? data.groomingRecords.filter((item) => item.pet_id === selectedPet.id) : [];
  const selectedRecordAppointmentIds = useMemo(
    () => new Set(selectedRecords.map((record) => record.appointment_id).filter(Boolean)),
    [selectedRecords],
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
      .sort((a, b) => (b.sent_at ?? b.created_at).localeCompare(a.sent_at ?? a.created_at));
  }, [data.notifications, selectedGuardian, selectedGuardianPets]);
  const guardianNotificationsEnabled = selectedGuardian?.notification_settings.enabled ?? false;
  const guardianRevisitNotificationsEnabled = selectedGuardian?.notification_settings.revisit_enabled ?? false;
  const selectedLatestRecord = selectedPet ? [...selectedRecords].sort((a, b) => b.groomed_at.localeCompare(a.groomed_at))[0] : null;
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
    if (!selectedGuardian) return;
    setGuardianDraft({
      name: selectedGuardian.name,
      phone: selectedGuardian.phone,
      memo: selectedGuardian.memo || "",
    });
    setIsGuardianEditing(false);
    setIsGuardianMemoEditing(false);
  }, [selectedGuardian]);

  useEffect(() => {
    const activeGuardianIds = new Set(data.guardians.map((guardian) => guardian.id));
    setSelectedGuardianIds((prev) => prev.filter((guardianId) => activeGuardianIds.has(guardianId)));
  }, [data.guardians]);

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
      setError(mutationError instanceof Error ? mutationError.message : "저장에 실패했습니다.");
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
      setSelectedPetId(null);
      setSelectedGuardianIds((prev) => prev.filter((id) => id !== guardianId));
      setIsGuardianEditing(false);
      setIsGuardianMemoEditing(false);
      return;
    }

    await mutate("/api/guardians", {
      method: "DELETE",
      body: JSON.stringify({ guardianId }),
    });
    setSelectedPetId(null);
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
        setSelectedPetId(null);
      }
      return;
    }

    await mutate("/api/guardians", {
      method: "DELETE",
      body: JSON.stringify({ guardianIds }),
    });
    setSelectedGuardianIds([]);
    if (selectedGuardian && guardianIds.includes(selectedGuardian.id)) {
      setSelectedPetId(null);
    }
  }

  async function saveShopProfile(payload: ShopProfileSavePayload) {
    if (isOwnerDemo) {
      setData((prev) => ({
        ...prev,
        shop: {
          ...prev.shop,
          name: payload.settingsPayload.name,
          phone: payload.settingsPayload.phone,
          address: payload.settingsPayload.address,
          description: payload.settingsPayload.description,
          business_hours: payload.settingsPayload.businessHours,
          customer_page_settings: payload.customerPageSettingsPayload.customerPageSettings,
        },
      }));
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
      await refresh();
      setModal(null);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "매장 정보 저장에 실패했습니다.");
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
      setError(mutationError instanceof Error ? mutationError.message : "복구에 실패했습니다.");
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
      setError(mutationError instanceof Error ? mutationError.message : "생일 축하 알림 발송에 실패했습니다.");
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
      setError(mutationError instanceof Error ? mutationError.message : "재방문 알림 발송에 실패했습니다.");
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
          status: "sent",
          templateKey: "appointment_reminder_10m",
          message: `${data.shop.name}입니다. ${pet.name} 예약이 ${appointment.appointment_date} ${formatClockTime(appointment.appointment_time)}에 예정되어 있어요. 방문 10분 전까지 편하게 방문해 주세요.`,
          recipientPhone: guardian.phone,
          recipientName: guardian.name,
          metadata: {
            serviceName: service.name,
            appointmentDate: appointment.appointment_date,
            appointmentTime: formatClockTime(appointment.appointment_time),
          },
        }),
      });
      await refresh();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "알림톡 발송에 실패했습니다.");
      throw mutationError;
    } finally {
      setSaving(false);
    }
  }

  const overdueCount = revisitRows.filter((item) => item.status === "overdue").length;
  const urgentCount = revisitRows.filter((item) => item.status === "overdue" || item.status === "soon").length;
  const estimatedRevenue = todayConfirmedAppointments.reduce((sum, item) => sum + (serviceMap[item.service_id]?.price || 0), 0);
  const screenTitle =
    activeTab === "customers"
      ? selectedGuardian
        ? "고객정보"
        : "고객관리"
      : selectedPet
        ? selectedPet.name
        : tabItems.find((item) => item.key === activeTab)?.label;
  const bookingEntryUrl =
    typeof window === "undefined" ? `/book/${data.shop.id}` : `${window.location.origin}/book/${data.shop.id}`;
  const isHomeTab = activeTab === "home";

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[var(--background)] shadow-[0_0_0_1px_rgba(47,49,46,0.03)]"
    >
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(248,246,242,0.94)] px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            {isHomeTab ? (
              <button
                type="button"
                onClick={() => setIsShopPickerOpen((prev) => !prev)}
                className="flex max-w-[250px] items-center gap-3 rounded-[18px] bg-transparent py-1 text-left"
              >
                <ShopAvatar name={currentOwnedShop.name} imageUrl={currentOwnedShop.heroImageUrl} />
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">{currentOwnedShop.name}</p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              </button>
            ) : (
              <div className="space-y-1">
                <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--text)]">{screenTitle}</h1>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {activeTab === "book" && (
              <button className="h-11 rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-xs font-semibold text-white shadow-[var(--shadow-soft)]" onClick={() => setModal({ type: "new-appointment" })}>{"예약 추가"}</button>
            )}
            {activeTab === "customers" && !selectedGuardian && <button className="h-11 rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-xs font-semibold text-white shadow-[var(--shadow-soft)]" onClick={() => setModal({ type: "new-customer" })}>{"고객 추가"}</button>}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {error && <div className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {activeTab === "home" && (
          <section className="space-y-5 px-6 pb-5 pt-4">
            {isOnboardingIncomplete ? (
              <Panel title="예약 오픈 전 체크리스트" action={`${onboardingTasks.length}단계 남음`}>
                <div className="space-y-2.5">
                  {onboardingTasks.map((task) =>
                    task ? (
                      <div key={task.key} className="rounded-[18px] border border-[var(--border)] bg-white px-4 py-3.5">
                        <p className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">{task.title}</p>
                        <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">{task.description}</p>
                        <button
                          type="button"
                          className="mt-3 inline-flex rounded-[12px] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--accent)]"
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
            <Panel title={ownerHomeCopy.todayTimelineTitle} action={String(pendingAppointments.length + todayActionAppointments.length + completedHistoryAppointments.length) + ownerHomeCopy.countSuffix}>
              <TodayConfirmedContent
                pendingAppointments={pendingAppointments}
                currentAppointments={todayActionAppointments}
                completedAppointments={completedHistoryAppointments}
                petMap={petMap}
                guardianMap={guardianMap}
                serviceMap={serviceMap}
                approvalMode={data.shop.approval_mode}
                saving={saving}
                onOpenAppointment={(appointment) => setModal({ type: "appointment", appointment })}
                onPendingUpdate={(appointmentId, payload) => updateAppointment(appointmentId, payload)}
                onStatusChange={(appointmentId, status) => updateAppointment(appointmentId, { status })}
                onApprovalModeChange={updateApprovalMode}
              />
            </Panel>
            <Panel title="예약 링크 사용법" action={<button type="button" className="text-xs font-semibold text-[var(--accent)]" onClick={() => setGuideScreen("getting-started")}>자세히 보기</button>}>
              <div className="space-y-2 rounded-[18px] border border-[var(--border)] bg-white px-4 py-3.5">
                <p className="text-[13px] font-semibold text-[var(--text)]">고객 예약 링크</p>
                <div className="flex items-center gap-2 rounded-[14px] bg-[#f7f4ef] px-3 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-[12px] text-[var(--muted)]">{bookingEntryUrl}</p>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--accent)]"
                    onClick={async () => {
                      await navigator.clipboard.writeText(bookingEntryUrl);
                      setError("예약 링크를 복사했어요. 인스타 프로필, 네이버 예약 안내, 카카오 채널에 붙여 넣어 주세요.");
                    }}
                    aria-label="예약 링크 복사"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[12px] leading-5 text-[var(--muted)]">인스타그램 프로필, 네이버 플레이스 소개글, 카카오 채널 버튼에 같은 링크를 넣으면 여러 곳의 예약 유입을 한 화면에서 관리할 수 있어요.</p>
              </div>
            </Panel>
          </section>
        )}
{activeTab === "book" && <section className="space-y-4 p-4"><Panel title={ownerHomeCopy.visitCalendarTitle}><div className="space-y-3"><div className="flex items-center justify-between gap-3"><p className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">{selectedVisitDateHeader}</p><button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--border)] bg-white text-[18px] text-[var(--text)] transition hover:bg-[#f7f4ef]" onClick={() => { setPendingVisitSelectionMode(visitSelectionMode); if (visitSelectionMode === "range" && selectedVisitRange) { setPendingVisitRangeStart(selectedVisitRange.start); setPendingVisitRangeEnd(selectedVisitRange.end); setPendingVisitDate(selectedVisitRange.start); setVisitCalendarMonthCursor(selectedVisitRange.start.slice(0, 7)); } else { setPendingVisitDate(selectedVisitDate); setPendingVisitRangeStart(null); setPendingVisitRangeEnd(null); setVisitCalendarMonthCursor(selectedVisitDate.slice(0, 7)); } setIsVisitCalendarOpen(true); }} aria-label={"달력 열기"}><CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.9} /></button></div><div className="grid grid-cols-5 gap-1.5">{quickVisitDates.map((item, index) => { const active = !isSelectedVisitRange && selectedVisitDate === item; const label = index === 0 ? "오늘" : new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(new Date(item + "T00:00:00")).replace("요일", ""); return <button key={item} type="button" onClick={() => { setVisitSelectionMode("single"); setVisitRange(null); setVisitDateFilter(item); }} className={`rounded-[15px] border px-1.5 py-2.5 text-center transition ${active ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]" : "border-[var(--border)] bg-white text-[var(--text)] hover:bg-[#fcfaf7]"}`}><span className={`block text-[11px] font-medium ${active ? "text-white/80" : "text-[var(--muted)]"}`}>{label}</span><span className="mt-0.5 block text-[17px] font-semibold tracking-[-0.02em]">{String(Number(item.slice(8, 10)))}</span></button>; })}</div>{(!isSelectedVisitInQuickRange || isSelectedVisitRange) && <div className="rounded-[16px] border border-[var(--border)] bg-[#fcfaf7] px-4 py-3 text-sm text-[var(--muted)]">{isSelectedVisitRange ? <>현재 선택 기간: <span className="font-semibold text-[var(--text)]">{selectedVisitDateHeader}</span></> : <>현재 선택 날짜: <span className="font-semibold text-[var(--text)]">{selectedVisitDateHeader}</span></>}</div>}</div></Panel>{shouldShowVisitActionSection && <Panel title={ownerHomeCopy.visitActionTitle} action={selectedVisitActionAppointments.length + ownerHomeCopy.countSuffix}>{selectedVisitActionAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.visitActionEmpty} /> : <div className="space-y-2">{selectedVisitActionAppointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => setModal({ type: "appointment", appointment })} />)}</div>}</Panel>}<Panel title={ownerHomeCopy.visitCompletedTitle} action={selectedVisitCompletedAppointments.length + selectedVisitRecords.length + ownerHomeCopy.countSuffix}>{selectedVisitCompletedAppointments.length === 0 && selectedVisitRecords.length === 0 ? <EmptyState title={ownerHomeCopy.visitCompletedEmpty} /> : <div className="space-y-2">{selectedVisitCompletedAppointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => setModal({ type: "appointment", appointment })} />)}{selectedVisitRecords.map((record) => <VisitRecordRow key={record.id} record={record} pet={petMap[record.pet_id]} guardian={guardianMap[record.guardian_id]} service={serviceMap[record.service_id]} />)}</div>}</Panel><Panel title={ownerHomeCopy.visitCancelChangeTitle} action={selectedVisitCancelledAppointments.length + ownerHomeCopy.countSuffix}>{selectedVisitCancelledAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.visitCancelChangeEmpty} /> : <div className="space-y-2">{selectedVisitCancelledAppointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => setModal({ type: "appointment", appointment })} />)}</div>}</Panel></section>}

{activeTab === "book" && isVisitCalendarOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 px-5" onClick={() => setIsVisitCalendarOpen(false)}><div className="w-full max-w-[360px] rounded-[24px] border border-[var(--border)] bg-white p-4 shadow-[0_18px_40px_rgba(35,35,31,0.12)]" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-start justify-between gap-3"><p className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">{pendingVisitDateHeader}</p><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--text)]" onClick={() => setIsVisitCalendarOpen(false)}>{"✕"}</button></div><div className="mb-4 grid grid-cols-2 gap-1.5 rounded-[15px] bg-[#f7f4ef] p-0.5"><button type="button" className={`rounded-[12px] px-2.5 py-2 text-sm font-semibold transition ${pendingVisitSelectionMode === "single" ? "bg-white text-[var(--text)] shadow-[0_6px_14px_rgba(35,35,31,0.08)]" : "text-[var(--muted)]"}`} onClick={() => { setPendingVisitSelectionMode("single"); setPendingVisitRangeStart(null); setPendingVisitRangeEnd(null); }}>날짜 선택</button><button type="button" className={`rounded-[12px] px-2.5 py-2 text-sm font-semibold transition ${pendingVisitSelectionMode === "range" ? "bg-white text-[var(--text)] shadow-[0_6px_14px_rgba(35,35,31,0.08)]" : "text-[var(--muted)]"}`} onClick={() => { setPendingVisitSelectionMode("range"); setPendingVisitRangeStart(pendingVisitDate); setPendingVisitRangeEnd(null); }}>기간 선택</button></div><div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-[var(--text)]">{visitCalendarMonthLabel}</p><div className="flex items-center gap-2"><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-lg text-[var(--text)] transition hover:bg-[#f6f1ec]" onClick={() => { const base = new Date(visitCalendarMonthStart + "T00:00:00"); const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1); setVisitCalendarMonthCursor(String(prev.getFullYear()) + "-" + String(prev.getMonth() + 1).padStart(2, "0")); }} aria-label={"이전 달"}>{"‹"}</button><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-lg text-[var(--text)] transition hover:bg-[#f6f1ec]" onClick={() => { const base = new Date(visitCalendarMonthStart + "T00:00:00"); const next = new Date(base.getFullYear(), base.getMonth() + 1, 1); setVisitCalendarMonthCursor(String(next.getFullYear()) + "-" + String(next.getMonth() + 1).padStart(2, "0")); }} aria-label={"다음 달"}>{"›"}</button></div></div><div className="grid grid-cols-7 gap-y-3 text-center text-sm font-semibold"><span className="text-[var(--muted)]">{"일"}</span><span className="text-[var(--muted)]">{"월"}</span><span className="text-[var(--muted)]">{"화"}</span><span className="text-[var(--muted)]">{"수"}</span><span className="text-[var(--muted)]">{"목"}</span><span className="text-[var(--muted)]">{"금"}</span><span className="text-[var(--muted)]">{"토"}</span>{visitCalendarCells.map((item, index) => { if (!item) return <div key={`calendar-empty-${index}`} className="h-11" />; const isSingleActive = pendingVisitSelectionMode === "single" && pendingVisitDate === item; const isRangeStart = pendingVisitSelectionMode === "range" && pendingVisitRange?.start === item; const isRangeEnd = pendingVisitSelectionMode === "range" && pendingVisitRange?.end === item; const isRangeActive = Boolean(isRangeStart || isRangeEnd); const isInRange = pendingVisitSelectionMode === "range" && pendingVisitRange && pendingVisitRange.start < item && item < pendingVisitRange.end; const isToday = item === todayDate; return <button key={item} type="button" className="flex h-11 items-center justify-center" onClick={() => { if (pendingVisitSelectionMode === "single") { setPendingVisitDate(item); return; } if (!pendingVisitRangeStart || pendingVisitRangeEnd) { setPendingVisitRangeStart(item); setPendingVisitRangeEnd(null); setPendingVisitDate(item); return; } if (item < pendingVisitRangeStart) { setPendingVisitRangeStart(item); setPendingVisitRangeEnd(null); setPendingVisitDate(item); return; } setPendingVisitRangeEnd(item); setPendingVisitDate(item); }}><span className={`flex h-10 w-10 items-center justify-center rounded-full text-[16px] font-semibold transition ${isSingleActive || isRangeActive ? "bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]" : isInRange ? "bg-[var(--accent-soft)] text-[var(--text)]" : isToday ? "border border-[var(--border)] bg-[#faf7f4] text-[var(--text)]" : "bg-transparent text-[var(--text)] hover:bg-[#f6f1ec]"}`}>{String(Number(item.slice(8, 10)))}</span></button>; })}</div><div className="mt-5 grid grid-cols-2 gap-2"><ActionButton variant="ghost" onClick={() => { if (visitSelectionMode === "range" && selectedVisitRange) { setPendingVisitSelectionMode("range"); setPendingVisitRangeStart(selectedVisitRange.start); setPendingVisitRangeEnd(selectedVisitRange.end); setPendingVisitDate(selectedVisitRange.start); } else { setPendingVisitSelectionMode("single"); setPendingVisitDate(selectedVisitDate); setPendingVisitRangeStart(null); setPendingVisitRangeEnd(null); } setIsVisitCalendarOpen(false); }}>닫기</ActionButton><ActionButton onClick={() => { if (pendingVisitSelectionMode === "range" && pendingVisitRange) { setVisitSelectionMode("range"); setVisitRange(pendingVisitRange); setVisitDateFilter(pendingVisitRange.start); } else { setVisitSelectionMode("single"); setVisitRange(null); setVisitDateFilter(pendingVisitDate); } setIsVisitCalendarOpen(false); }} disabled={!canConfirmVisitCalendar}>확인</ActionButton></div></div></div>}

        {activeTab === "customers" && !selectedPet && (
          <section className="space-y-4 p-4">
            <Panel
              title="고객 정보"
              titleClassName="text-[16px] tracking-[-0.03em]"
              action={
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-full px-2 text-[12px] font-medium tracking-[-0.01em] text-[var(--accent)]"
                  onClick={() => {
                    setIsCustomerListEditing((prev) => {
                      if (prev) setSelectedGuardianIds([]);
                      return !prev;
                    });
                  }}
                >
                  {isCustomerListEditing ? "완료" : "편집"}
                </button>
              }
            >
              <div className="rounded-[14px] border border-[var(--border)] bg-white px-3.5 py-2.5">
                <input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="보호자명, 연락처, 아기 이름 검색"
                  className="w-full bg-transparent text-[13px] outline-none placeholder:text-[12px] placeholder:font-medium placeholder:text-[var(--muted)]"
                />
              </div>

              {isCustomerListEditing && filteredGuardians.length > 0 ? (
                <div className="flex items-center justify-between rounded-[13px] border border-[var(--border)] bg-[#fcfaf7] px-2.5 py-1">
                  <label className="flex items-center gap-1.5 text-[10px] font-normal tracking-[-0.01em] text-[var(--text)]">
                    <input
                      type="checkbox"
                      checked={filteredGuardians.length > 0 && filteredGuardians.every((summary) => selectedGuardianIds.includes(summary.guardian.id))}
                      onChange={toggleAllVisibleGuardians}
                      className="h-[12px] w-[12px] rounded-[3px] border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    <span className="leading-none">전체 선택</span>
                  </label>
                  <button
                    type="button"
                    className="px-1 py-0.5 text-[10px] font-normal leading-none tracking-[-0.01em] text-[#8f756e] transition hover:text-[#6f5d57] disabled:text-[var(--muted)]"
                    onClick={deleteSelectedGuardians}
                    disabled={selectedGuardianIds.length === 0 || saving}
                  >
                    선택 삭제
                  </button>
                </div>
              ) : null}

              {filteredGuardians.length === 0 ? (
                <EmptyState title="조건에 맞는 고객이 없어요" />
              ) : (
                <div className="space-y-2.5">
                  {filteredGuardians.map((summary) => (
                    <div
                      key={summary.guardian.id}
                      className="flex items-start gap-3 rounded-[15px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 transition hover:bg-[#fcfaf7]"
                    >
                      {isCustomerListEditing ? (
                        <input
                          type="checkbox"
                          checked={selectedGuardianIds.includes(summary.guardian.id)}
                          onChange={() => toggleGuardianSelection(summary.guardian.id)}
                          className="mt-[3px] h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                        />
                      ) : null}
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setSelectedPetId(summary.pets[0]?.id || null);
                          setDetailTab("pets");
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{summary.guardian.name}</p>
                              <div className="flex shrink-0 items-center gap-2">
                                {summary.isAlertsOff ? (
                                  <span className="rounded-full bg-[#f4f0ea] px-2 py-1 text-[10px] font-medium tracking-[-0.01em] text-[var(--muted)]">
                                    알림 꺼짐
                                  </span>
                                ) : null}
                                <span className="text-[11px] font-medium tracking-[-0.01em] text-[var(--accent)]">상세</span>
                              </div>
                            </div>
                            <p className="mt-1 text-[12px] font-medium leading-5 text-[var(--muted)]">{summary.guardian.phone}</p>
                            <p className="mt-0.5 text-[12px] font-medium leading-5 text-[#5e5a56]">반려동물 · {summary.pets.map((pet) => pet.name).join(", ") || "없음"}</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {filteredDeletedGuardians.length > 0 ? (
                <div className="space-y-3 rounded-[18px] border border-dashed border-[var(--border)] bg-[#fcfaf7] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--text)]">최근 삭제</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">삭제 후 3일 안에는 고객 정보를 다시 복구할 수 있어요.</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--accent)]"
                      onClick={() => restoreDeletedGuardians(filteredDeletedGuardians.map((guardian) => guardian.id))}
                      disabled={saving}
                    >
                      전체 복구
                    </button>
                  </div>
                  <div className="space-y-2">
                    {filteredDeletedGuardians.map((guardian) => (
                      <div key={guardian.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] bg-white px-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text)]">{guardian.name}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{guardian.phone}</p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 text-xs font-semibold text-[var(--accent)]"
                          onClick={() => restoreDeletedGuardians([guardian.id])}
                          disabled={saving}
                        >
                          복구
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Panel>
          </section>
        )}
                {activeTab === "customers" && selectedPet && selectedGuardian && (
                  <section className="space-y-4 p-4">
                    <button className="text-sm font-bold text-[var(--muted)]" onClick={() => setSelectedPetId(null)}>
                      ← 이전
                    </button>
                    <Panel
                      title={`${selectedGuardian.name} 보호자`}
                      action={
                        <div className="flex items-center gap-3">
                          {!isGuardianEditing ? (
                            <button
                              className="text-[12px] font-medium tracking-[0.01em] text-[var(--muted)] transition hover:text-[#6b5b57]"
                              onClick={handleGuardianDelete}
                              disabled={saving}
                            >
                              삭제
                            </button>
                          ) : null}
                          {isGuardianEditing ? (
                            <button
                              className="text-xs font-medium tracking-[0.01em] text-[var(--muted)]"
                              onClick={() => {
                                setGuardianDraft({
                                  name: selectedGuardian.name,
                                  phone: selectedGuardian.phone,
                                  memo: selectedGuardian.memo || "",
                                });
                                setIsGuardianEditing(false);
                              }}
                            >
                              취소
                            </button>
                          ) : null}
                          <button
                            className="text-xs font-semibold tracking-[0.01em] text-[var(--accent)]"
                            onClick={() => {
                              if (isGuardianEditing) {
                                if (!canSaveGuardianProfile || saving) return;
                                handleGuardianProfileSave();
                                return;
                              }
                              setIsGuardianEditing(true);
                            }}
                          >
                            {isGuardianEditing ? "저장" : "편집"}
                          </button>
                        </div>
                      }
                    >
                      <div className="grid grid-cols-2 gap-2 text-sm">
                          {isGuardianEditing ? (
                            <>
                              <Field label="보호자 이름">
                                <input
                                  className="field"
                                  value={guardianDraft.name}
                                onChange={(event) => setGuardianDraft((prev) => ({ ...prev, name: event.target.value }))}
                              />
                            </Field>
                            <Field label="연락처">
                              <input
                                className="field"
                                value={guardianDraft.phone}
                                onChange={(event) => setGuardianDraft((prev) => ({ ...prev, phone: event.target.value }))}
                              />
                            </Field>
                          </>
                        ) : (
                          <>
                            <InfoItem label="보호자명" value={selectedGuardian.name} />
                            <InfoItem label="연락처" value={selectedGuardian.phone} />
                          </>
                        )}
                        <InfoItem
                          label="반려동물 이름"
                          value={selectedGuardianPets.length ? selectedGuardianPets.map((pet) => pet.name).join(", ") : "없음"}
                          className="col-span-2"
                        />
                      </div>

                      {isGuardianMemoEditing ? (
                        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-[12px] font-medium leading-4 text-[var(--muted)]">고객 메모</p>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                className="text-xs font-medium tracking-[0.01em] text-[var(--muted)]"
                                onClick={() => {
                                  setGuardianDraft((prev) => ({ ...prev, memo: selectedGuardian.memo || "" }));
                                  setIsGuardianMemoEditing(false);
                                }}
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                className="text-xs font-semibold tracking-[0.01em] text-[var(--accent)]"
                                onClick={handleGuardianMemoSave}
                                disabled={saving}
                              >
                                저장
                              </button>
                            </div>
                          </div>
                          <textarea
                            className="field min-h-24"
                            value={guardianDraft.memo}
                            onChange={(event) => setGuardianDraft((prev) => ({ ...prev, memo: event.target.value }))}
                            placeholder="고객에게 기억해 둘 내용을 적어주세요"
                          />
                        </div>
                      ) : selectedGuardian.memo ? (
                        <button
                          type="button"
                          className="w-full rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:bg-[#fcfaf7]"
                          onClick={() => setIsGuardianMemoEditing(true)}
                        >
                          <p className="text-[12px] font-medium leading-4 text-[var(--muted)]">고객 메모</p>
                          <p className="mt-1 text-[15px] font-semibold leading-5 tracking-[-0.02em] text-[var(--text)]">{selectedGuardian.memo}</p>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="w-full rounded-[16px] border border-dashed border-[var(--border)] bg-[#fcfaf7] px-4 py-2.5 text-left transition hover:bg-[#f8f3ed]"
                          onClick={() => setIsGuardianMemoEditing(true)}
                        >
                          <p className="text-[12px] font-medium leading-4 text-[var(--muted)]">고객 메모</p>
                          <p className="mt-1 text-[15px] font-semibold leading-5 tracking-[-0.02em] text-[var(--muted)]">터치해서 고객 메모를 적어주세요</p>
                        </button>
                      )}

                      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
                        <p className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)]">빠른 액션</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <a
                            href={buildTelHref(selectedGuardian.phone)}
                            className="flex items-center justify-center rounded-[14px] border border-[var(--border)] bg-white px-4 py-2 text-[14px] font-semibold text-[var(--text)]"
                          >
                            전화하기
                          </a>
                          <a
                            href={buildSmsHref(selectedGuardian.phone)}
                            className="flex items-center justify-center rounded-[14px] border border-[var(--border)] bg-white px-4 py-2 text-[14px] font-semibold text-[var(--muted)]"
                          >
                            문자 보내기
                          </a>
                        </div>
                      </div>

                      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)]">알림톡 설정</p>
                            <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">고객별로 알림톡 비용이 나가지 않도록 수신을 직접 조절할 수 있어요.</p>
                          </div>
                        </div>
                        <div className="mt-2 space-y-2">
                          <ToggleRow
                            label="알림톡 받기"
                            description="예약 안내, 방문 안내, 완료 알림 등 기본 알림을 보낼 수 있어요."
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
                          <ToggleRow
                            label="재방문 알림"
                            description="재방문 시기가 다가왔을 때만 별도로 다시 알려드려요."
                            checked={guardianNotificationsEnabled && guardianRevisitNotificationsEnabled}
                            disabled={saving || !guardianNotificationsEnabled}
                            onChange={(checked) => {
                              void updateGuardianNotifications(selectedGuardian.id, guardianNotificationsEnabled, checked);
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {(["pets", "records", "notifications"] as const).map((item) => (
                          <button
                            key={item}
                            className={`flex-1 rounded-[14px] border px-3 py-2.5 text-[12px] font-semibold ${
                              detailTab === item
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                : "border-[var(--border)] bg-white text-[var(--muted)]"
                            }`}
                            onClick={() => setDetailTab(item)}
                          >
                            {item === "pets" ? (
                              "아기 정보"
                            ) : item === "records" ? (
                              "미용 기록"
                            ) : (
                              <span className="leading-[1.15]">알림톡<br />발송내역</span>
                            )}
                          </button>
                        ))}
                      </div>

                      {detailTab === "pets" ? (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                            <div className="mb-3 flex items-center justify-between">
                              <p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text)]">아기 정보</p>
                              <button
                                className="text-[12px] font-semibold text-[var(--accent)]"
                                onClick={() => setModal({ type: "add-pet", guardianId: selectedGuardian.id })}
                              >
                                + 아기 추가하기
                              </button>
                            </div>
                            <div className="space-y-3">
                              {selectedGuardianPets.map((pet) => (
                                <GuardianPetEditorCard
                                  key={pet.id}
                                  pet={pet}
                                  saving={saving}
                                  isBirthdayToday={Boolean(pet.birthday && pet.birthday.slice(5) === "03-17")}
                                  onSelect={() => setSelectedPetId(pet.id)}
                                  onSave={(name, breed, birthday) => updatePetProfile(pet.id, name, breed, birthday)}
                                  onSendBirthday={() => sendBirthdayGreeting(pet)}
                                  onSendRevisit={() => sendRevisitNotice(pet)}
                                />
                              ))}
                            </div>
                          </div>

                          <button
                            className="w-full rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]"
                            onClick={() => setModal({ type: "new-appointment", petId: selectedPet.id })}
                          >
                            이 아기로 예약 등록
                          </button>
                        </div>
                      ) : null}

                      {detailTab === "records" ? (
                        <div className="mt-4 space-y-3">
                          {selectedRecords.length === 0 ? (
                            <EmptyState title="미용 기록이 없어요" />
                          ) : (
                            selectedRecords.map((record) => (
                              <RecordCard
                                key={record.id}
                                record={record}
                                service={serviceMap[record.service_id]}
                                onEdit={() => setModal({ type: "edit-record", record })}
                              />
                            ))
                          )}
                        </div>
                      ) : null}

                      {detailTab === "notifications" ? (
                        <div className="mt-4 space-y-3">
                          {selectedNotifications.length === 0 ? (
                            <EmptyState title="발송된 알림이 없어요" />
                          ) : (
                            selectedNotifications.map((notification) => (
                              <NotificationHistoryRow
                                key={notification.id}
                                notification={notification}
                                pet={notification.pet_id ? petMap[notification.pet_id] ?? null : null}
                              />
                            ))
                          )}
                        </div>
                      ) : null}
                    </Panel>
                  </section>
                )}

        {activeTab === "settings" && <SettingsPanel data={data} initialScreen={settingsEntryScreen} onSave={(payload) => mutate("/api/settings", { method: "PATCH", body: JSON.stringify(payload) })} onSaveService={(payload) => mutate("/api/services", { method: "POST", body: JSON.stringify(payload) })} onSaveCustomerPageSettings={(payload) => mutate("/api/customer-page-settings", { method: "PATCH", body: JSON.stringify(payload) })} onLogout={onLogout} loggingOut={loggingOut} userEmail={userEmail} isAdminUser={isAdminUser} subscriptionSummary={subscriptionSummary} />}
      </main>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 bg-[rgba(255,255,255,0.98)] px-2.5 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1.5 shadow-[0_-8px_24px_rgba(31,40,37,0.08)] backdrop-blur">
        <div className="grid grid-cols-4 gap-1.5">
            {tabItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;

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
                    if (item.key !== "customers") setSelectedPetId(null);
                  }}
                >
                  <div
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full transition ${
                      active
                        ? "text-[var(--accent)]"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    <Icon className="h-[22px] w-[22px]" />
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
            shops={ownedShops}
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

function Panel({ title, action, children, titleClassName = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; titleClassName?: string }) {
  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className={`text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)] ${titleClassName}`.trim()}>{title}</h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function VisitTimelineSection({ date, appointments, records, petMap, guardianMap, serviceMap, onOpenAppointment }: { date: string; appointments: Appointment[]; records: GroomingRecord[]; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; onOpenAppointment: (appointment: Appointment) => void }) { return <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{shortDate(date)}</h3><span className="text-xs text-[var(--muted)]">{appointments.length + records.length}건</span></div><div className="mt-3 space-y-2">{appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => onOpenAppointment(appointment)} />)}{records.map((record) => <VisitRecordRow key={record.id} record={record} pet={petMap[record.pet_id]} guardian={guardianMap[record.guardian_id]} service={serviceMap[record.service_id]} />)}{appointments.length === 0 && records.length === 0 ? <EmptyState title="이 날짜 방문 내역이 없어요" /> : null}</div></div>; }
function VisitRecordRow({ record, pet, guardian, service }: { record: GroomingRecord; pet: Pet; guardian: Guardian; service?: Service }) {
  return (
    <div className="rounded-[20px] border border-[var(--border)] bg-[var(--peach-soft)] px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="min-w-12 text-sm font-semibold text-[var(--text)]">{record.groomed_at.slice(11, 16)}</div>
        <Avatar seed={pet.avatar_seed} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">{pet.name} <span className="text-xs font-medium text-[var(--muted)]">({guardian.name})</span></p>
          <p className="text-xs text-[var(--muted)]">{service?.name || "서비스"} {ownerHomeCopy.separator} {record.groomed_at.slice(0, 10)}</p>
        </div>
        <span className="rounded-full bg-[#f3f4f2] px-2.5 py-1 text-[11px] font-semibold text-[#5f6b66]">완료</span>
      </div>
      {(record.style_notes || record.memo) && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{record.style_notes || record.memo}</p>}
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
      className={`relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-white px-4 py-3 text-left transition before:absolute before:inset-x-0 before:top-0 before:h-1.5 ${toneMap[tone].bar}`}
    >
      <p className="relative z-[1] text-[14px] font-semibold tracking-[-0.01em] text-[var(--muted)]">{label}</p>
      <p className="relative z-[1] mt-3 text-[32px] font-extrabold leading-none tracking-[-0.05em] text-[var(--text)]">{value}</p>
    </button>
  );
}

function AppointmentRow({ appointment, pet, guardian, service, onClick }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-left transition hover:bg-[#fcfaf7]">
      <div className="min-w-[58px] text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">{formatClockTime(appointment.appointment_time)}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text)]">{pet.name} <span className="text-xs font-medium text-[var(--muted)]">({guardian.name})</span></p>
        <p className="text-xs text-[var(--muted)]">{service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}</p>
      </div>
      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: statusMeta[appointment.status].color, background: statusMeta[appointment.status].bg }}>{statusMeta[appointment.status].label}</span>
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

  useEffect(() => {
    if (slots.length === 0) {
      setTime("");
      return;
    }

    if (!slots.includes(time)) {
      setTime(slots[0]);
    }
  }, [slots, time]);

  return <Sheet title={ownerHomeCopy.appointmentDetailTitle} onClose={onClose}><div className="space-y-4"><div className="rounded-2xl bg-[#fcfaf7] p-4 text-sm"><p className="font-bold">{pet.name} {ownerHomeCopy.separator} {guardian.name}</p><p className="mt-1 text-[var(--muted)]">{appointment.appointment_date} {formatClockTime(appointment.appointment_time)}</p><p className="mt-1 text-[var(--muted)]">{selectedService.name} {ownerHomeCopy.separator} {won(selectedService.price)}</p><p className="mt-1 text-[var(--muted)]">{ownerHomeCopy.memoLabel}: {appointment.memo || ownerHomeCopy.emptyMemo}</p>{appointment.rejection_reason && <p className="mt-2 rounded-2xl bg-[#fff1f1] px-3 py-2 text-xs font-semibold text-red-700">미승인 사유: {appointment.rejection_reason}</p>}</div><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold">빠른 연락</p><QuickContactRow phone={guardian.phone} reminderSent={reminderSent} sending={saving} onSendReminder={async () => { await onSendReminder(); setReminderSent(true); }} /></div>{canEditSchedule && <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">예약 일정 수정</p><button type="button" className="text-xs font-semibold text-[var(--accent)]" onClick={() => setIsEditingSchedule((prev) => !prev)}>{isEditingSchedule ? "닫기" : "수정"}</button></div>{isEditingSchedule ? <div className="space-y-3"><div className="grid grid-cols-2 gap-2">{selectableServices.map((item) => <button key={item.id} type="button" className={`rounded-2xl border px-3 py-3 text-left ${serviceId === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-white"}`} onClick={() => setServiceId(item.id)}><p className="text-sm font-bold text-[var(--text)]">{item.name}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{won(item.price)}</p></button>)}</div><div className="rounded-2xl bg-[#fcfaf7] p-2"><p className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">날짜</p><HorizontalDragScroll>{dateOptions.map((item, index) => <button key={item} type="button" className={`min-w-[110px] shrink-0 rounded-2xl border px-4 py-3 text-left ${date === item ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-white text-[var(--text)]"}`} onClick={() => setDate(item)}><span className="text-sm font-bold">{index === 0 && item === currentDateInTimeZone() ? "오늘" : shortDate(item)}</span></button>)}</HorizontalDragScroll></div><div className="rounded-2xl bg-[#fcfaf7] p-2"><p className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">시간</p>{slots.length === 0 ? <div className="rounded-2xl bg-white px-4 py-5 text-center text-sm text-[var(--muted)]">선택한 날짜에 가능한 시간이 없어요.</div> : <HorizontalDragScroll>{slots.map((slot) => <button key={slot} type="button" className={`min-w-[92px] shrink-0 rounded-2xl border px-4 py-3 text-center text-sm font-bold ${time === slot ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-white text-[var(--text)]"}`} onClick={() => setTime(slot)}>{slot}</button>)}</HorizontalDragScroll>}</div><Field label="메모"><textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="field min-h-24" placeholder="변경 안내 메모를 남겨 주세요" /></Field><ActionButton disabled={!canSaveSchedule} onClick={() => onUpdate({ mode: "edit", serviceId, appointmentDate: date, appointmentTime: time, memo })}>예약 수정 저장</ActionButton></div> : <p className="text-xs leading-5 text-[var(--muted)]">서비스, 날짜, 시간, 메모를 한 번에 바꿔서 고객과 조정한 예약을 바로 반영할 수 있어요.</p>}</div>}{appointment.status === "pending" && <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold">미승인 사유 템플릿</p><RejectionReasonEditor template={template} customReason={customReason} onTemplateChange={(value) => setTemplate(value || rejectionReasonTemplates[0])} onCustomReasonChange={setCustomReason} /><div className="grid grid-cols-2 gap-2"><ActionButton onClick={() => onUpdate({ status: "confirmed" })} disabled={saving}>{ownerHomeCopy.pendingApprove}</ActionButton><ActionButton onClick={() => onUpdate({ status: "rejected", rejectionReasonTemplate: template, rejectionReasonCustom: customReason })} variant="secondary" disabled={saving}>{"\uBBF8\uC2B9\uC778"}</ActionButton></div></div>}<div className="grid grid-cols-2 gap-2">{appointment.status === "confirmed" && <ActionButton variant="highlight" onClick={() => onUpdate({ status: "in_progress" })} disabled={saving}>{"\uC2DC\uC791"}</ActionButton>}{appointment.status === "in_progress" && <ActionButton onClick={() => onUpdate({ status: "almost_done" })} variant="secondary" disabled={saving}>{ownerHomeCopy.pickupReady}</ActionButton>}{appointment.status === "almost_done" && <ActionButton onClick={() => onUpdate({ status: "completed" })} variant="secondary" disabled={saving}>{ownerHomeCopy.groomingComplete}</ActionButton>}{rollbackStatus && rollbackLabel && <ActionButton onClick={() => onUpdate({ status: rollbackStatus })} variant="ghost" disabled={saving}>{rollbackLabel}</ActionButton>}</div></div></Sheet>;
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

  return <Sheet title="새 고객" onClose={onClose}><div className="space-y-4"><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">보호자 정보</p><div className="mt-3 space-y-3"><Field label="보호자 이름"><input className="field" value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></Field><Field label="연락처"><input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field><Field label="고객 메모"><input className="field" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="선택 입력" /></Field></div></div><div className="space-y-3">{pets.map((pet, index) => <div key={pet.id} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">아기 {index + 1}</p>{index > 0 ? <button type="button" className="text-xs font-semibold text-[#b85c47]" onClick={() => removePet(pet.id)}>삭제</button> : <span className="text-[11px] font-bold text-[var(--muted)]">최소 1마리</span>}</div><div className="mt-3 space-y-3"><Field label="아기 이름"><input className="field" value={pet.name} onChange={(event) => updatePet(pet.id, "name", event.target.value)} /></Field><Field label="견종"><input className="field" value={pet.breed} onChange={(event) => updatePet(pet.id, "breed", event.target.value)} /></Field><Field label="생일"><input className="field" type="date" value={pet.birthday} onChange={(event) => updatePet(pet.id, "birthday", event.target.value)} /></Field></div></div>)}</div><button type="button" className="w-full rounded-2xl border border-dashed border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-bold text-[var(--accent)]" onClick={addPet}>+ 아기 추가하기</button><ActionButton disabled={!canSave} onClick={() => onSave({ shopId, name: guardianName.trim(), phone: phone.trim(), memo: memo.trim() }, pets.map((pet) => ({ shopId, name: pet.name.trim(), breed: pet.breed.trim(), birthday: pet.birthday || null, weight: null, age: null, notes: "", groomingCycleWeeks: 4 })))}>고객 저장</ActionButton></div></Sheet>;
}
function AddPetForm({ shopId, guardianId, saving, onClose, onSave }: { shopId: string; guardianId: string; saving: boolean; onClose: () => void; onSave: (payload: { shopId: string; guardianId: string; name: string; breed: string; birthday: string | null; weight: null; age: null; notes: string; groomingCycleWeeks: number }) => void }) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birthday, setBirthday] = useState("");
  const [notes, setNotes] = useState("");
  return <Sheet title="반려견 추가" onClose={onClose}><div className="space-y-3"><Field label="아기 이름"><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="견종"><input className="field" value={breed} onChange={(event) => setBreed(event.target.value)} /></Field><Field label="생일"><input className="field" type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} /></Field><Field label="메모"><textarea className="field min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field><ActionButton disabled={saving || !name || !breed} onClick={() => onSave({ shopId, guardianId, name, breed, birthday: birthday || null, weight: null, age: null, notes, groomingCycleWeeks: 4 })}>반려견 저장</ActionButton></div></Sheet>;
}
function EditRecordForm({ services, record, saving, onClose, onSave }: { shopId: string; services: Service[]; record: GroomingRecord; saving: boolean; onClose: () => void; onSave: (payload: unknown) => void }) { const [styleNotes, setStyleNotes] = useState(record.style_notes); const [memo, setMemo] = useState(record.memo); const [pricePaid, setPricePaid] = useState(String(record.price_paid)); const [serviceId, setServiceId] = useState(record.service_id); return <Sheet title="미용 기록 수정" onClose={onClose}><div className="space-y-3"><Field label="서비스"><select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="field">{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="스타일 메모"><input value={styleNotes} onChange={(event) => setStyleNotes(event.target.value)} className="field" /></Field><Field label="상세 메모"><textarea value={memo} onChange={(event) => setMemo(event.target.value)} className="field min-h-24" /></Field><Field label="결제 금액"><input value={pricePaid} onChange={(event) => setPricePaid(event.target.value)} className="field" /></Field><ActionButton disabled={saving} onClick={() => onSave({ recordId: record.id, styleNotes, memo, pricePaid: Number(pricePaid), serviceId })}>기록 저장</ActionButton></div></Sheet>; }

function ShopProfileEditForm({ data, saving, onClose, onSave }: { data: BootstrapPayload; saving: boolean; onClose: () => void; onSave: (payload: ShopProfileSavePayload) => void }) {
  const [name, setName] = useState(data.shop.name);
  const [phone, setPhone] = useState(data.shop.phone);
  const [address, setAddress] = useState(data.shop.address);
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
  const canSave = Boolean(name.trim() && phone.trim() && address.trim());

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
    <Sheet title="매장 프로필 편집" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border border-[#dfeae5] bg-white shadow-[0_2px_8px_rgba(31,107,91,0.05)]"
                aria-label="프로필 이미지 변경"
              >
                {heroImageUrl ? (
                  <img src={heroImageUrl} alt={`${name || data.shop.name} 프로필`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#f4f5f4] text-[#9ea4a1]">
                    <UserRound className="h-8 w-8" strokeWidth={1.8} />
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white bg-[var(--accent)] text-white shadow-[0_6px_14px_rgba(31,107,91,0.18)]"
                aria-label="프로필 이미지 선택"
              >
                <Camera className="h-3.5 w-3.5" strokeWidth={2} />
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
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{name || data.shop.name}</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">프로필 사진을 누르면 바로 바꿀 수 있어요.</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--accent)]"
                >
                  사진 변경
                </button>
                {heroImageUrl ? (
                  <button
                    type="button"
                    onClick={() => setHeroImageUrl("")}
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--muted)]"
                  >
                    기본 아이콘
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Field label="매장 이름">
              <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="연락처">
              <input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
          </div>

          <div className="mt-2.5 space-y-2.5">
            <Field label="매장 주소">
              <input className="field" value={address} onChange={(event) => setAddress(event.target.value)} />
            </Field>
            <Field label="매장 소개">
              <textarea className="field min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
          </div>
        </div>

        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <p className="text-sm font-semibold text-[var(--text)]">운영 가능 시간</p>
          <div className="mt-2.5 space-y-2">
            {Object.entries(businessHours).map(([key, value], index) => {
              const dayValue = value || { open: "10:00", close: "19:00", enabled: false };

              return <div key={key} className="rounded-[14px] border border-[var(--border)] bg-white px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text)]">{compactWeekdayLabels[index] || key}</p>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
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
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    className="field"
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
                    className="field"
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
        </div>

        <ActionButton
          disabled={saving || !canSave}
          onClick={() =>
            onSave({
              settingsPayload: {
                shopId: data.shop.id,
                name: name.trim(),
                phone: phone.trim(),
                address: address.trim(),
                description: description.trim(),
                concurrentCapacity: data.shop.concurrent_capacity,
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
      </div>
    </Sheet>
  );
}

function ShopPickerSheet({ shops, currentShopId, switching, onClose, onSelect, onEdit }: { shops: OwnedShopSummary[]; currentShopId: string; switching: boolean; onClose: () => void; onSelect: (shopId: string) => Promise<void>; onEdit: (shopId: string) => Promise<void> }) {
  return <Sheet title="매장 전환" onClose={onClose}><div className="space-y-3">{shops.map((shop) => <div key={shop.id} className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 ${shop.id === currentShopId ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-white"}`}><button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void onSelect(shop.id)} disabled={switching}><ShopAvatar name={shop.name} imageUrl={shop.heroImageUrl} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text)]">{shop.name}</p><p className="truncate text-xs text-[var(--muted)]">{shop.address}</p></div></button><button type="button" className="shrink-0 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--accent)]" onClick={() => void onEdit(shop.id)} disabled={switching}>편집</button></div>)}</div></Sheet>;
}

function BookingGuideSheet({ bookingEntryUrl, onClose }: { bookingEntryUrl: string; onClose: () => void }) {
  return <Sheet title="예약 링크 사용법" onClose={onClose}><div className="space-y-4"><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold text-[var(--text)]">1. 고객용 예약 링크</p><div className="mt-3 flex items-center gap-2 rounded-[14px] bg-white px-3 py-3"><p className="min-w-0 flex-1 break-all text-[12px] text-[var(--muted)]">{bookingEntryUrl}</p><button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]" onClick={() => void navigator.clipboard.writeText(bookingEntryUrl)} aria-label="예약 링크 복사"><Copy className="h-4 w-4" /></button></div></div><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold text-[var(--text)]">2. 어디에 붙이면 좋은가요?</p><ul className="mt-3 space-y-2 text-[13px] leading-6 text-[var(--muted)]"><li>인스타그램 프로필 링크</li><li>네이버 플레이스 소개글/예약 안내</li><li>카카오채널 채팅방 버튼 또는 자동응답</li><li>문자, 알림톡, 단골 고객 안내 메시지</li></ul></div><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold text-[var(--text)]">3. 왜 한 링크로 모으나요?</p><p className="mt-3 text-[13px] leading-6 text-[var(--muted)]">여러 채널에서 예약이 들어와도 결국 같은 예약 페이지로 모이면 일정 확인, 승인, 변경, 고객 관리가 한 화면에서 정리됩니다.</p></div></div></Sheet>;
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
  isAdminUser = false,
  subscriptionSummary,
}: {
  data: BootstrapPayload;
  initialScreen?: SettingsEntryScreen;
  onSave: (payload: unknown) => void;
  onSaveService: (payload: unknown) => void;
  onSaveCustomerPageSettings: (payload: unknown) => void;
  onLogout?: () => void;
  loggingOut?: boolean;
  userEmail?: string | null;
  isAdminUser?: boolean;
  subscriptionSummary?: OwnerSubscriptionSummary | null;
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
      isAdminUser={isAdminUser}
      subscriptionSummary={subscriptionSummary}
    />
  );
}

function RecordCard({ record, service, onEdit }: { record: GroomingRecord; service?: Service; onEdit: () => void }) { return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"><div className="flex items-center justify-between"><div><p className="text-sm font-bold">{service?.name || "서비스"}</p><p className="text-xs text-[var(--muted)]">{record.groomed_at.slice(0, 10)}</p></div><button className="text-xs font-semibold text-[var(--accent)]" onClick={onEdit}>수정</button></div><p className="mt-2 text-sm text-[var(--muted)]">{record.style_notes || "스타일 메모 없음"}</p><p className="mt-1 text-sm text-[var(--muted)]">{record.memo || "상세 메모 없음"}</p></div>; }
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
    <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <button onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <div className="min-w-[58px] text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">{formatClockTime(appointment.appointment_time)}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">{pet.name} <span className="text-xs font-medium text-[var(--muted)]">({guardian.name})</span></p>
          <p className="text-xs text-[var(--muted)]">{service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}</p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: statusMeta[appointment.status].color, background: statusMeta[appointment.status].bg }}>{statusMeta[appointment.status].label}</span>
      </button>
      {!isRejectOpen ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <ActionButton onClick={() => onStatusChange({ status: "confirmed" })} variant="warm" disabled={saving}>{ownerHomeCopy.pendingApprove}</ActionButton>
          <ActionButton onClick={onRejectOpen} variant="secondary" disabled={saving}>{"미승인"}</ActionButton>
        </div>
      ) : (
        <div className="mt-3 space-y-3 rounded-[18px] border border-[var(--border)] bg-[#fcfaf7] p-3">
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

  return <div className="overflow-hidden rounded-[20px] border border-[#d8e7e0] bg-[#f6fbf8] p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#2f7866]" /><div className="mb-2.5"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.currentSectionTitle}</h3></div>{showSwipeHint ? <div className="mb-2.5 rounded-[14px] border border-[#d7e8e0] bg-white/90 px-3 py-2 text-[12px] font-medium leading-5 text-[#4d6b62]">예약 카드를 왼쪽으로 밀면 바로 취소할 수 있어요.</div> : null}<div className="max-h-[34rem] overflow-y-auto pr-1"><div className="space-y-2.5">{currentAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.currentSectionEmpty} /> : currentAppointments.map((appointment) => <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} allowSwipeCancel />)}</div></div></div>;
}

function TodayConfirmedContent({ pendingAppointments, currentAppointments, completedAppointments, petMap, guardianMap, serviceMap, approvalMode, saving, onOpenAppointment, onPendingUpdate, onStatusChange, onApprovalModeChange }: { pendingAppointments: Appointment[]; currentAppointments: Appointment[]; completedAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; approvalMode?: "manual" | "auto"; saving: boolean; onOpenAppointment: (appointment: Appointment) => void; onPendingUpdate: (appointmentId: string, payload: AppointmentUpdatePayload) => void; onStatusChange: (appointmentId: string, status: AppointmentStatus) => void; onApprovalModeChange?: (mode: "manual" | "auto") => void; }) {
  const [openRejectAppointmentId, setOpenRejectAppointmentId] = useState<string | null>(null);

  return <div className="space-y-3"><div className="overflow-hidden rounded-[20px] border border-[#ead9cf] bg-[#fffaf6] p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#e6b091]" /><div className="space-y-2"><div className="flex items-center justify-between gap-3"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.pendingSectionTitle}</h3>{approvalMode ? <span className="text-[11px] font-medium text-[#8b6b5d]">{approvalMode === "manual" ? "직접 승인 선택됨" : "바로 승인 선택됨"}</span> : null}</div>{approvalMode && onApprovalModeChange ? <div className="grid grid-cols-2 gap-2 rounded-[16px] border border-[#ead9cf] bg-white/80 p-1"><button type="button" onClick={() => onApprovalModeChange("manual")} disabled={saving || approvalMode === "manual"} className={`rounded-[12px] px-3 py-2 text-sm font-semibold transition ${approvalMode === "manual" ? "bg-[#c99273] text-white" : "bg-white text-[var(--muted)]"}`}>{"직접 승인"}</button><button type="button" onClick={() => onApprovalModeChange("auto")} disabled={saving || approvalMode === "auto"} className={`rounded-[12px] px-3 py-2 text-sm font-semibold transition ${approvalMode === "auto" ? "bg-[#c99273] text-white" : "bg-white text-[var(--muted)]"}`}>{"바로 승인"}</button></div> : null}</div><div className="mt-3 max-h-64 overflow-y-auto pr-1"><div className="space-y-2.5">{pendingAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.pendingSectionEmpty} /> : pendingAppointments.map((appointment) => <PendingApprovalCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(payload) => { setOpenRejectAppointmentId(null); onPendingUpdate(appointment.id, payload); }} isRejectOpen={openRejectAppointmentId === appointment.id} onRejectOpen={() => setOpenRejectAppointmentId(appointment.id)} onRejectClose={() => setOpenRejectAppointmentId(null)} />)}</div></div></div><div className="overflow-hidden rounded-[20px] border border-[#d8e7e0] bg-[#f6fbf8] p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#2f7866]" /><div className="mb-2.5"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.currentSectionTitle}</h3></div><div className="max-h-[29rem] overflow-y-auto pr-1"><div className="space-y-2.5">{currentAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.currentSectionEmpty} /> : currentAppointments.map((appointment) => <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} allowSwipeCancel />)}</div></div></div><CompletedReservationsContent historyAppointments={completedAppointments} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} onOpenAppointment={onOpenAppointment} /></div>;
}


function CompletedReservationsContent({ historyAppointments, petMap, guardianMap, serviceMap, onOpenAppointment }: { historyAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, BootstrapPayload["guardians"][number]>; serviceMap: Record<string, Service>; onOpenAppointment: (appointment: Appointment) => void; }) {
  return <div className="overflow-hidden rounded-[20px] border border-[#e9ddd3] bg-[#fbf8f4] p-3.5"><div className="mb-3 h-1.5 rounded-full bg-[#c9b39e]" /><div className="mb-2.5"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.historySectionTitle}</h3></div><div className="space-y-2.5">{historyAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.historySectionEmpty} /> : historyAppointments.map((appointment) => <CompletedAppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => onOpenAppointment(appointment)} />)}</div></div>;
}

function CompletedAppointmentRow({ appointment, pet, guardian, service, onClick }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-left transition hover:bg-[#fcfaf7]">
      <div className="min-w-[64px] text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">{formatClockTime(appointment.appointment_time)}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text)]">{pet.name} <span className="text-xs font-medium text-[var(--muted)]">({guardian.name})</span></p>
        <p className="text-xs text-[var(--muted)]">{service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}</p>
      </div>
      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: statusMeta.completed.color, background: statusMeta.completed.bg }}>{statusMeta.completed.label}</span>
    </button>
  );
}
function HomeConfirmedCard({ appointment, pet, guardian, service, saving, onOpen, onStatusChange, allowSwipeCancel = false }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; saving: boolean; onOpen: () => void; onStatusChange: (status: AppointmentStatus) => void; allowSwipeCancel?: boolean; }) {
  const actionWidth = 96;
  const snapThreshold = 48;
  const [startX, setStartX] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const isDragging = startX !== null;
  const actionVisible = allowSwipeCancel && (isDragging || translateX !== 0);
  const rollbackStatus = appointment.status === "cancelled" ? "confirmed" : null;
  const rollbackLabel = appointment.status === "cancelled" ? "\uCDE8\uC18C/\uBCC0\uACBD \uCCA0\uD68C" : null;
  const closeSwipe = () => setTranslateX(0);
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowSwipeCancel) return;
    setStartX(event.clientX);
    setDragStartX(translateX);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowSwipeCancel || startX === null) return;
    const diff = event.clientX - startX;
    const next = Math.min(0, Math.max(-actionWidth, dragStartX + diff));
    setTranslateX(next);
  };
  const handlePointerUp = () => {
    if (!allowSwipeCancel) return;
    setTranslateX(translateX <= -snapThreshold ? -actionWidth : 0);
    setStartX(null);
  };

  return <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-transparent"><div className={`absolute inset-y-0 right-0 overflow-hidden rounded-r-[20px] transition-all duration-200 ${actionVisible ? "w-24 opacity-100" : "w-0 opacity-0"}`}><button type="button" className="flex h-full w-24 flex-col items-center justify-center gap-1 bg-[#a86957] text-white" onClick={() => { closeSwipe(); onStatusChange("cancelled"); }}><span className="text-[18px] leading-none">←</span><span className="text-sm font-semibold">{ownerHomeCopy.slideCancel}</span><span className="text-[11px] font-medium text-white/80">밀어서 취소</span></button></div><div className={`relative rounded-[20px] bg-[var(--surface)] transition-transform ${isDragging ? "duration-75" : "duration-200"}`} style={{ transform: "translateX(" + translateX + "px)", touchAction: allowSwipeCancel ? "pan-y" : "auto" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={isDragging ? handlePointerUp : undefined}><button onClick={() => { if (translateX !== 0) { closeSwipe(); return; } onOpen(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left"><div className="min-w-[64px] text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">{formatClockTime(appointment.appointment_time)}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-[var(--text)]">{pet.name}</p><span className="truncate text-xs font-medium text-[var(--muted)]">{guardian.name}</span></div><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}</p></div><span className="rounded-full px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.01em]" style={{ color: statusMeta[appointment.status].color, background: statusMeta[appointment.status].bg }}>{statusMeta[appointment.status].label}</span></button><div className="grid grid-cols-2 gap-2 px-4 pb-3">{appointment.status === "confirmed" && <ActionButton variant="accentSoft" onClick={() => onStatusChange("in_progress")} disabled={saving}>{"\uC2DC\uC791"}</ActionButton>}{appointment.status === "in_progress" && <ActionButton onClick={() => onStatusChange("almost_done")} variant="warm" disabled={saving}>{ownerHomeCopy.pickupReady}</ActionButton>}{appointment.status === "almost_done" && <ActionButton onClick={() => onStatusChange("completed")} variant="complete" disabled={saving}>{ownerHomeCopy.groomingComplete}</ActionButton>}{rollbackStatus && rollbackLabel && <ActionButton onClick={() => onStatusChange(rollbackStatus)} variant="ghost" disabled={saving}>{rollbackLabel}</ActionButton>}{appointment.status === "completed" && <div className="col-span-2 rounded-[16px] border border-[#dce8e3] bg-[#f4faf7] px-4 py-3 text-center text-sm font-semibold text-[var(--accent)]">{ownerHomeCopy.completedNotice}</div>}</div></div></div>;
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


function GuardianPetEditorCard({ pet, saving, isBirthdayToday, onSelect, onSave, onSendBirthday, onSendRevisit }: { pet: Pet; saving: boolean; isBirthdayToday: boolean; onSelect: () => void; onSave: (name: string, breed: string, birthday: string | null) => void; onSendBirthday: () => void; onSendRevisit: () => void }) { const [name, setName] = useState(pet.name); const [breed, setBreed] = useState(pet.breed); const [birthday, setBirthday] = useState(pet.birthday ?? ""); return <div className="rounded-[16px] border border-[var(--border)] bg-white px-4 py-2.5"><div className="flex items-center justify-between gap-3"><button className="text-left" onClick={onSelect}><p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{pet.name}</p><p className="mt-0.5 text-[12px] font-medium text-[var(--muted)]">{isBirthdayToday ? "오늘 생일" : birthday ? `생일 ${birthday}` : "생일 미등록"}</p></button></div><div className="mt-2.5 space-y-2"><Field label="아기 이름"><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="견종"><input className="field" value={breed} onChange={(event) => setBreed(event.target.value)} /></Field><Field label="생일"><input className="field" type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} /></Field></div><div className="mt-2.5 grid grid-cols-2 gap-2"><ActionButton variant="ghost" onClick={() => onSave(name.trim(), breed.trim(), birthday || null)} disabled={saving || !name.trim() || !breed.trim()}>아기 정보 저장</ActionButton><ActionButton variant="secondary" onClick={onSendRevisit}>재방문 알림</ActionButton></div><div className="mt-2">{birthday ? <ActionButton onClick={onSendBirthday} disabled={saving}>생일 축하 문자 보내기</ActionButton> : <div className="rounded-[14px] bg-[#fcfaf7] px-4 py-2 text-center text-[12px] font-medium text-[var(--muted)]">생일 미등록</div>}</div></div>; }
function QuickContactRow({ phone, sending = false, reminderSent = false, onSendReminder }: { phone: string; sending?: boolean; reminderSent?: boolean; onSendReminder?: () => Promise<void> }) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2">
      <a href={buildTelHref(phone)} className="flex items-center justify-center rounded-2xl bg-[#f7f4ef] px-4 py-3 text-sm font-semibold text-[var(--text)]">전화하기</a>
      <a href={buildSmsHref(phone)} className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--muted)]">문자 보내기</a>
      {onSendReminder ? <button type="button" onClick={() => void onSendReminder()} disabled={sending || reminderSent} className="col-span-2 flex items-center justify-center rounded-2xl border border-[#d8e7e0] bg-[#f4faf7] px-4 py-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-60">{reminderSent ? "예약 10분 전 알림톡 발송됨" : "예약 10분 전 알림톡 발송"}</button> : null}
    </div>
  );
}

function ToggleRow({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) { return <label className={`flex items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 ${disabled ? "opacity-50" : ""}`}><div><p className="text-sm font-semibold text-[var(--text)]">{label}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p></div><button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-[var(--accent)]" : "bg-[#d9d6cf]"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} /></button></label>; }
function Overlay({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-[430px] flex-col rounded-t-[32px] bg-white px-4 pb-5 pt-4" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button className="text-sm font-semibold text-[var(--muted)]" onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-[var(--text)]"><span className="mb-2 block text-xs text-[var(--muted)]">{label}</span>{children}</label>; }
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
                  ? "border border-[#6d7d77] bg-[#6d7d77] text-white shadow-[0_8px_18px_rgba(109,125,119,0.16)]"
                  : "border border-[var(--border)] bg-white text-[var(--muted)]";
  return <button disabled={disabled} onClick={onClick} className={`flex h-[43px] w-full items-center justify-center rounded-[14px] px-4 text-sm font-semibold tracking-[-0.01em] transition hover:bg-opacity-95 disabled:opacity-50 ${className}`}>{children}</button>;
}

function EmptyState({ title }: { title: string }) { return <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[#fcfaf7] px-4 py-5 text-center text-sm leading-6 text-[var(--muted)]">{title}</div>; }
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
      case "booking_confirmed":
        return "예약 완료";
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

  return <div className="rounded-[16px] border border-[var(--border)] bg-white px-4 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text)]">{typeLabel}</p>{pet ? <span className="text-[12px] font-medium text-[var(--muted)]">{pet.name}</span> : null}</div><p className="mt-1 text-[12px] font-medium text-[var(--muted)]">{timeLabel}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone}`}>{statusLabel}</span></div><p className="mt-2 text-[14px] leading-6 text-[var(--text)]">{notification.message}</p></div>;
}




























