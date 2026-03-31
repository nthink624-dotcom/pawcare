"use client";

import { CalendarDays, House, Settings, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import OwnerSettingsPanel from "@/components/owner/owner-settings-panel";
import { computeAvailableSlots, revisitInfo } from "@/lib/availability";
import { ownerHomeCopy } from "@/lib/owner-home-copy";
import { addDate, currentDateInTimeZone, shortDate, won } from "@/lib/utils";
import type { Appointment, AppointmentStatus, BootstrapPayload, GroomingRecord, Pet, Service } from "@/types/domain";

type TabKey = "home" | "book" | "customers" | "settings";
type Guardian = BootstrapPayload["guardians"][number];
type AppointmentUpdatePayload = {
  status: AppointmentStatus;
  rejectionReasonTemplate?: string;
  rejectionReasonCustom?: string;
  eventType?: "booking_rescheduled_confirmed";
};
type ModalState =
  | { type: "appointment"; appointment: Appointment }
  | { type: "new-appointment"; petId?: string }
  | { type: "new-customer" }
  | { type: "add-pet"; guardianId: string }
  | { type: "edit-record"; record: GroomingRecord }
  | { type: "stat"; kind: "today" | "pending" | "completed" | "cancel_change" }
  | null;

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
  { key: "customers", label: "고객", icon: UserRound },
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

export default function OwnerApp({ initialData }: { initialData: BootstrapPayload }) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [todayDate, setTodayDate] = useState(() => currentDateInTimeZone());
  const [selectedDate, setSelectedDate] = useState(() => currentDateInTimeZone());
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [visitDateFilter, setVisitDateFilter] = useState(currentDateInTimeZone());
  const [visitSelectionMode, setVisitSelectionMode] = useState<"single" | "range">("single");
  const [visitRange, setVisitRange] = useState<{ start: string; end: string } | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "records" | "appointments">("info");
  const [isVisitCalendarOpen, setIsVisitCalendarOpen] = useState(false);
  const [pendingVisitSelectionMode, setPendingVisitSelectionMode] = useState<"single" | "range">("single");
  const [pendingVisitDate, setPendingVisitDate] = useState(currentDateInTimeZone());
  const [pendingVisitRangeStart, setPendingVisitRangeStart] = useState<string | null>(null);
  const [pendingVisitRangeEnd, setPendingVisitRangeEnd] = useState<string | null>(null);
  const [visitCalendarMonthCursor, setVisitCalendarMonthCursor] = useState(currentDateInTimeZone().slice(0, 7));
  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const next = await fetchJson<BootstrapPayload>(`/api/bootstrap?shopId=${data.shop.id}`);
    setData(next);
  }

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

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
  const selectedAppointments = selectedPet ? data.appointments.filter((item) => item.pet_id === selectedPet.id) : [];
  const selectedLatestRecord = selectedPet ? [...selectedRecords].sort((a, b) => b.groomed_at.localeCompare(a.groomed_at))[0] : null;
  const selectedLatestAppointment = selectedPet ? [...selectedAppointments].sort((a, b) => `${b.appointment_date} ${b.appointment_time}`.localeCompare(`${a.appointment_date} ${a.appointment_time}`))[0] : null;
  const selectedLatestService = selectedLatestRecord ? serviceMap[selectedLatestRecord.service_id] : selectedLatestAppointment ? serviceMap[selectedLatestAppointment.service_id] : null;
  const selectedVisitCount = selectedRecords.length;
  const selectedRevisitState = selectedPet ? revisitRows.find((row) => row.pet.id === selectedPet.id) : null;

  async function mutate(url: string, init: RequestInit) {
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
    await mutate("/api/appointments", {
      method: "PATCH",
      body: JSON.stringify({ appointmentId, ...payload }),
    });
  }

  async function updateGuardianNotifications(guardianId: string, enabled: boolean, revisitEnabled: boolean) {
    await mutate("/api/guardians", {
      method: "PATCH",
      body: JSON.stringify({ guardianId, enabled, revisitEnabled }),
    });
  }

  async function updatePetProfile(petId: string, name: string, breed: string, birthday: string | null) {
    await mutate("/api/pets", {
      method: "PATCH",
      body: JSON.stringify({ petId, name, breed, birthday }),
    });
  }

  async function updateApprovalMode(nextMode: "manual" | "auto") {
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
    await mutate("/api/notifications", {
      method: "POST",
      body: JSON.stringify({
        shopId: data.shop.id,
        guardianId: guardian.id,
        petId: pet.id,
        type: "birthday_greeting",
        message: `안녕하세요. ${data.shop.name}입니다. ${pet.name}의 생일을 축하드려요! 오늘도 행복한 하루 보내세요.`,
      }),
    });
  }

  async function sendRevisitNotice(pet: Pet) {
    const guardian = guardianMap[pet.guardian_id];
    await mutate("/api/notifications", {
      method: "POST",
      body: JSON.stringify({
        shopId: data.shop.id,
        guardianId: guardian.id,
        petId: pet.id,
        type: "revisit_notice",
        message: `${pet.name} 재방문 안내 알림을 발송했어요.`,
      }),
    });
  }

  const overdueCount = revisitRows.filter((item) => item.status === "overdue").length;
  const urgentCount = revisitRows.filter((item) => item.status === "overdue" || item.status === "soon").length;
  const estimatedRevenue = todayConfirmedAppointments.reduce((sum, item) => sum + (serviceMap[item.service_id]?.price || 0), 0);

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[var(--background)] shadow-[0_0_0_1px_rgba(47,49,46,0.03)]"
    >
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(248,246,242,0.94)] px-6 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--accent)]">{data.shop.name}</p>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--text)]">{selectedPet ? selectedPet.name : tabItems.find((item) => item.key === activeTab)?.label}</h1>
            {activeTab === "home" ? <p className="text-[12px] leading-5 text-[var(--muted)]">{`${shortDate(todayDate)} 운영 요약`}</p> : null}
          </div>
          <div className="flex gap-2">
            {(activeTab === "home" || activeTab === "book") && <button className="h-11 rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-xs font-semibold text-white shadow-[var(--shadow-soft)]" onClick={() => setModal({ type: "new-appointment", petId: selectedPetId || undefined })}>{"+ 예약"}</button>}
            {activeTab === "customers" && !selectedPet && <button className="h-11 rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 text-xs font-semibold text-white shadow-[var(--shadow-soft)]" onClick={() => setModal({ type: "new-customer" })}>{"+ 고객"}</button>}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {error && <div className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {activeTab === "home" && (
          <section className="space-y-5 px-6 pb-5 pt-4">
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
          </section>
        )}
{activeTab === "book" && <section className="space-y-4 p-4"><Panel title={ownerHomeCopy.visitCalendarTitle}><div className="space-y-3"><div className="flex items-center justify-between gap-3"><p className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">{selectedVisitDateHeader}</p><button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--border)] bg-white text-[18px] text-[var(--text)] transition hover:bg-[#f7f4ef]" onClick={() => { setPendingVisitSelectionMode(visitSelectionMode); if (visitSelectionMode === "range" && selectedVisitRange) { setPendingVisitRangeStart(selectedVisitRange.start); setPendingVisitRangeEnd(selectedVisitRange.end); setPendingVisitDate(selectedVisitRange.start); setVisitCalendarMonthCursor(selectedVisitRange.start.slice(0, 7)); } else { setPendingVisitDate(selectedVisitDate); setPendingVisitRangeStart(null); setPendingVisitRangeEnd(null); setVisitCalendarMonthCursor(selectedVisitDate.slice(0, 7)); } setIsVisitCalendarOpen(true); }} aria-label={"달력 열기"}><CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.9} /></button></div><div className="grid grid-cols-5 gap-1.5">{quickVisitDates.map((item, index) => { const active = !isSelectedVisitRange && selectedVisitDate === item; const label = index === 0 ? "오늘" : new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(new Date(item + "T00:00:00")).replace("요일", ""); return <button key={item} type="button" onClick={() => { setVisitSelectionMode("single"); setVisitRange(null); setVisitDateFilter(item); }} className={`rounded-[15px] border px-1.5 py-2.5 text-center transition ${active ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]" : "border-[var(--border)] bg-white text-[var(--text)] hover:bg-[#fcfaf7]"}`}><span className={`block text-[11px] font-medium ${active ? "text-white/80" : "text-[var(--muted)]"}`}>{label}</span><span className="mt-0.5 block text-[17px] font-semibold tracking-[-0.02em]">{String(Number(item.slice(8, 10)))}</span></button>; })}</div>{(!isSelectedVisitInQuickRange || isSelectedVisitRange) && <div className="rounded-[16px] border border-[var(--border)] bg-[#fcfaf7] px-4 py-3 text-sm text-[var(--muted)]">{isSelectedVisitRange ? <>현재 선택 기간: <span className="font-semibold text-[var(--text)]">{selectedVisitDateHeader}</span></> : <>현재 선택 날짜: <span className="font-semibold text-[var(--text)]">{selectedVisitDateHeader}</span></>}</div>}</div></Panel>{shouldShowVisitActionSection && <Panel title={ownerHomeCopy.visitActionTitle} action={selectedVisitActionAppointments.length + ownerHomeCopy.countSuffix}>{selectedVisitActionAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.visitActionEmpty} /> : <div className="space-y-2">{selectedVisitActionAppointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => setModal({ type: "appointment", appointment })} />)}</div>}</Panel>}<Panel title={ownerHomeCopy.visitCompletedTitle} action={selectedVisitCompletedAppointments.length + selectedVisitRecords.length + ownerHomeCopy.countSuffix}>{selectedVisitCompletedAppointments.length === 0 && selectedVisitRecords.length === 0 ? <EmptyState title={ownerHomeCopy.visitCompletedEmpty} /> : <div className="space-y-2">{selectedVisitCompletedAppointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => setModal({ type: "appointment", appointment })} />)}{selectedVisitRecords.map((record) => <VisitRecordRow key={record.id} record={record} pet={petMap[record.pet_id]} guardian={guardianMap[record.guardian_id]} service={serviceMap[record.service_id]} />)}</div>}</Panel><Panel title={ownerHomeCopy.visitCancelChangeTitle} action={selectedVisitCancelledAppointments.length + ownerHomeCopy.countSuffix}>{selectedVisitCancelledAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.visitCancelChangeEmpty} /> : <div className="space-y-2">{selectedVisitCancelledAppointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => setModal({ type: "appointment", appointment })} />)}</div>}</Panel></section>}

{activeTab === "book" && isVisitCalendarOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 px-5" onClick={() => setIsVisitCalendarOpen(false)}><div className="w-full max-w-[360px] rounded-[24px] border border-[var(--border)] bg-white p-4 shadow-[0_18px_40px_rgba(35,35,31,0.12)]" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-start justify-between gap-3"><p className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">{pendingVisitDateHeader}</p><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--text)]" onClick={() => setIsVisitCalendarOpen(false)}>{"✕"}</button></div><div className="mb-4 grid grid-cols-2 gap-1.5 rounded-[15px] bg-[#f7f4ef] p-0.5"><button type="button" className={`rounded-[12px] px-2.5 py-2 text-sm font-semibold transition ${pendingVisitSelectionMode === "single" ? "bg-white text-[var(--text)] shadow-[0_6px_14px_rgba(35,35,31,0.08)]" : "text-[var(--muted)]"}`} onClick={() => { setPendingVisitSelectionMode("single"); setPendingVisitRangeStart(null); setPendingVisitRangeEnd(null); }}>날짜 선택</button><button type="button" className={`rounded-[12px] px-2.5 py-2 text-sm font-semibold transition ${pendingVisitSelectionMode === "range" ? "bg-white text-[var(--text)] shadow-[0_6px_14px_rgba(35,35,31,0.08)]" : "text-[var(--muted)]"}`} onClick={() => { setPendingVisitSelectionMode("range"); setPendingVisitRangeStart(pendingVisitDate); setPendingVisitRangeEnd(null); }}>기간 선택</button></div><div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-[var(--text)]">{visitCalendarMonthLabel}</p><div className="flex items-center gap-2"><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-lg text-[var(--text)] transition hover:bg-[#f6f1ec]" onClick={() => { const base = new Date(visitCalendarMonthStart + "T00:00:00"); const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1); setVisitCalendarMonthCursor(String(prev.getFullYear()) + "-" + String(prev.getMonth() + 1).padStart(2, "0")); }} aria-label={"이전 달"}>{"‹"}</button><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-lg text-[var(--text)] transition hover:bg-[#f6f1ec]" onClick={() => { const base = new Date(visitCalendarMonthStart + "T00:00:00"); const next = new Date(base.getFullYear(), base.getMonth() + 1, 1); setVisitCalendarMonthCursor(String(next.getFullYear()) + "-" + String(next.getMonth() + 1).padStart(2, "0")); }} aria-label={"다음 달"}>{"›"}</button></div></div><div className="grid grid-cols-7 gap-y-3 text-center text-sm font-semibold"><span className="text-[var(--muted)]">{"일"}</span><span className="text-[var(--muted)]">{"월"}</span><span className="text-[var(--muted)]">{"화"}</span><span className="text-[var(--muted)]">{"수"}</span><span className="text-[var(--muted)]">{"목"}</span><span className="text-[var(--muted)]">{"금"}</span><span className="text-[var(--muted)]">{"토"}</span>{visitCalendarCells.map((item, index) => { if (!item) return <div key={`calendar-empty-${index}`} className="h-11" />; const isSingleActive = pendingVisitSelectionMode === "single" && pendingVisitDate === item; const isRangeStart = pendingVisitSelectionMode === "range" && pendingVisitRange?.start === item; const isRangeEnd = pendingVisitSelectionMode === "range" && pendingVisitRange?.end === item; const isRangeActive = Boolean(isRangeStart || isRangeEnd); const isInRange = pendingVisitSelectionMode === "range" && pendingVisitRange && pendingVisitRange.start < item && item < pendingVisitRange.end; const isToday = item === todayDate; return <button key={item} type="button" className="flex h-11 items-center justify-center" onClick={() => { if (pendingVisitSelectionMode === "single") { setPendingVisitDate(item); return; } if (!pendingVisitRangeStart || pendingVisitRangeEnd) { setPendingVisitRangeStart(item); setPendingVisitRangeEnd(null); setPendingVisitDate(item); return; } if (item < pendingVisitRangeStart) { setPendingVisitRangeStart(item); setPendingVisitRangeEnd(null); setPendingVisitDate(item); return; } setPendingVisitRangeEnd(item); setPendingVisitDate(item); }}><span className={`flex h-10 w-10 items-center justify-center rounded-full text-[16px] font-semibold transition ${isSingleActive || isRangeActive ? "bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]" : isInRange ? "bg-[var(--accent-soft)] text-[var(--text)]" : isToday ? "border border-[var(--border)] bg-[#faf7f4] text-[var(--text)]" : "bg-transparent text-[var(--text)] hover:bg-[#f6f1ec]"}`}>{String(Number(item.slice(8, 10)))}</span></button>; })}</div><div className="mt-5 grid grid-cols-2 gap-2"><ActionButton variant="ghost" onClick={() => { if (visitSelectionMode === "range" && selectedVisitRange) { setPendingVisitSelectionMode("range"); setPendingVisitRangeStart(selectedVisitRange.start); setPendingVisitRangeEnd(selectedVisitRange.end); setPendingVisitDate(selectedVisitRange.start); } else { setPendingVisitSelectionMode("single"); setPendingVisitDate(selectedVisitDate); setPendingVisitRangeStart(null); setPendingVisitRangeEnd(null); } setIsVisitCalendarOpen(false); }}>닫기</ActionButton><ActionButton onClick={() => { if (pendingVisitSelectionMode === "range" && pendingVisitRange) { setVisitSelectionMode("range"); setVisitRange(pendingVisitRange); setVisitDateFilter(pendingVisitRange.start); } else { setVisitSelectionMode("single"); setVisitRange(null); setVisitDateFilter(pendingVisitDate); } setIsVisitCalendarOpen(false); }} disabled={!canConfirmVisitCalendar}>확인</ActionButton></div></div></div>}

        {activeTab === "customers" && !selectedPet && <section className="space-y-4 p-4"><Panel title="고객 관리" action={filteredGuardians.length + "명"}><div className="rounded-[16px] border border-[var(--border)] bg-white p-3.5"><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="보호자명, 연락처, 아기 이름 검색" className="w-full bg-transparent text-sm outline-none" /></div>{filteredGuardians.length === 0 ? <EmptyState title="조건에 맞는 고객이 없어요" /> : <div className="space-y-3">{filteredGuardians.map((summary) => <button key={summary.guardian.id} className="w-full rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:bg-[#fcfaf7]" onClick={() => { setSelectedPetId(summary.pets[0]?.id || null); setDetailTab("info"); }}><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{summary.guardian.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{summary.guardian.phone}</p><p className="mt-2 text-sm text-[var(--text)]">아기 이름: {summary.pets.map((pet) => pet.name).join(", ") || "없음"}</p></div><span className="text-xs font-semibold text-[var(--accent)]">상세</span></div></button>)}</div>}</Panel></section>}
                {activeTab === "customers" && selectedPet && selectedGuardian && <section className="space-y-4 p-4"><button className="text-sm font-bold text-[var(--muted)]" onClick={() => setSelectedPetId(null)}>← 고객 목록</button><Panel title={selectedGuardian.name} action={selectedGuardian.phone}><div className="grid grid-cols-2 gap-2.5 text-sm"><InfoItem label="보호자" value={selectedGuardian.name} /><InfoItem label="연락처" value={selectedGuardian.phone} /><InfoItem label="아기 수" value={`${selectedGuardianPets.length}마리`} /><InfoItem label="대표 아기" value={selectedPet.name} /><InfoItem label="최근 방문" value={selectedLatestRecord ? shortDate(selectedLatestRecord.groomed_at.slice(0, 10)) : selectedLatestAppointment ? shortDate(selectedLatestAppointment.appointment_date) : "없음"} /><InfoItem label="최근 서비스" value={selectedLatestService?.name || "없음"} /></div><div className="mt-3 rounded-2xl bg-[var(--peach-soft)]/45 p-4 text-sm"><p className="font-bold">고객 메모</p><p className="mt-2 text-[var(--muted)]">{selectedGuardian.memo || "메모 없음"}</p></div><div className="mt-3 flex gap-2">{(["info", "records", "appointments"] as const).map((item) => <button key={item} className={`flex-1 rounded-[14px] border px-3 py-2.5 text-xs font-semibold ${detailTab === item ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-white text-[var(--muted)]"}`} onClick={() => setDetailTab(item)}>{item === "info" ? "정보" : item === "records" ? "\uAE30\uB85D" : "\uC608\uC57D"}</button>)}</div>{detailTab === "info" && <div className="mt-4 space-y-3"><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold">빠른 액션</p><div className="mt-2.5 grid grid-cols-2 gap-2"><a href={`tel:${selectedGuardian.phone}`} className="flex items-center justify-center rounded-[14px] border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]">전화하기</a><a href={`sms:${selectedGuardian.phone}`} className="flex items-center justify-center rounded-[14px] border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--muted)]">문자 보내기</a></div></div><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold">아기 정보</p><button className="text-xs font-semibold text-[var(--accent)]" onClick={() => setModal({ type: "add-pet", guardianId: selectedGuardian.id })}>+ 아기 추가하기</button></div><div className="space-y-3">{selectedGuardianPets.map((pet) => <GuardianPetEditorCard key={pet.id} pet={pet} saving={saving} isBirthdayToday={Boolean(pet.birthday && pet.birthday.slice(5) === "03-17")} onSelect={() => setSelectedPetId(pet.id)} onSave={(name, breed, birthday) => updatePetProfile(pet.id, name, breed, birthday)} onSendBirthday={() => sendBirthdayGreeting(pet)} onSendRevisit={() => sendRevisitNotice(pet)} />)}</div></div><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold">알림 수신 설정</p><div className="mt-3 space-y-2"></div></div><button className="w-full rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]" onClick={() => setModal({ type: "new-appointment", petId: selectedPet.id })}>이 아기로 예약 등록</button></div>}{detailTab === "records" && <div className="mt-4 space-y-3">{selectedRecords.length === 0 ? <EmptyState title="미용 기록이 없어요" /> : selectedRecords.map((record) => <RecordCard key={record.id} record={record} service={serviceMap[record.service_id]} onEdit={() => setModal({ type: "edit-record", record })} />)}</div>}{detailTab === "appointments" && <div className="mt-4 space-y-3">{selectedAppointments.length === 0 ? <EmptyState title="예약 이력이 없어요" /> : selectedAppointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} pet={selectedPet} guardian={selectedGuardian} service={serviceMap[appointment.service_id]} onClick={() => setModal({ type: "appointment", appointment })} />)}</div>}</Panel></section>}

        {activeTab === "settings" && <SettingsPanel data={data} onSave={(payload) => mutate("/api/settings", { method: "PATCH", body: JSON.stringify(payload) })} onSaveService={(payload) => mutate("/api/services", { method: "POST", body: JSON.stringify(payload) })} onSaveCustomerPageSettings={(payload) => mutate("/api/customer-page-settings", { method: "PATCH", body: JSON.stringify(payload) })} />}
      </main>

      <nav className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 gap-0.5 border-t border-[var(--border)] bg-[rgba(255,255,255,0.98)] px-2 py-1.5 backdrop-blur">
  {tabItems.map((item) => {
    const Icon = item.icon;
    const active = activeTab === item.key;

    return (
      <button
        key={item.key}
        type="button"
        aria-label={item.label}
        className={`flex min-h-[46px] flex-1 items-center justify-center rounded-[12px] px-1 py-1.5 text-center transition ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[#fcfaf7]"}`}
        onClick={() => {
          setActiveTab(item.key);
          if (item.key === "book") {
            setVisitSelectionMode("single");
            setVisitRange(null);
            setVisitDateFilter(todayDate);
          }
          if (item.key !== "customers") setSelectedPetId(null);
        }}
      >
        <Icon className={`h-[18px] w-[18px] ${active ? "text-[var(--accent)]" : "text-current"}`} />
        <span className="sr-only">{item.label}</span>
      </button>
    );
  })}
</nav>

      {modal && <div>{modal.type === "appointment" ? <Overlay><AppointmentDetail appointment={modal.appointment} pet={petMap[modal.appointment.pet_id]} guardian={guardianMap[modal.appointment.guardian_id]} service={serviceMap[modal.appointment.service_id]} saving={saving} onClose={() => setModal(null)} onUpdate={(payload) => updateAppointment(modal.appointment.id, payload)} /></Overlay> : null}{modal.type === "new-appointment" ? <Overlay><NewAppointmentForm data={data} petId={modal.petId} saving={saving} onClose={() => setModal(null)} onSave={(payload) => mutate("/api/appointments", { method: "POST", body: JSON.stringify(payload) })} /></Overlay> : null}{modal.type === "new-customer" ? <Overlay><NewCustomerForm shopId={data.shop.id} saving={saving} onClose={() => setModal(null)} onSave={async (guardianPayload, petPayloads) => { await mutate("/api/guardians", { method: "POST", body: JSON.stringify(guardianPayload) }); const refreshed = await fetchJson<BootstrapPayload>(`/api/bootstrap?shopId=${data.shop.id}`); setData(refreshed); const guardian = refreshed.guardians[refreshed.guardians.length - 1]; for (const petPayload of petPayloads) { await mutate("/api/pets", { method: "POST", body: JSON.stringify({ ...petPayload, guardianId: guardian.id }) }); } }} /></Overlay> : null}{modal.type === "add-pet" ? <Overlay><AddPetForm shopId={data.shop.id} guardianId={modal.guardianId} saving={saving} onClose={() => setModal(null)} onSave={(payload) => mutate("/api/pets", { method: "POST", body: JSON.stringify(payload) })} /></Overlay> : null}{modal.type === "edit-record" ? <Overlay><EditRecordForm shopId={data.shop.id} services={data.services} record={modal.record} saving={saving} onClose={() => setModal(null)} onSave={(payload) => mutate("/api/records", { method: "PATCH", body: JSON.stringify(payload) })} /></Overlay> : null}{modal.type === "stat" ? <Overlay><StatDetail kind={modal.kind} todayAppointments={todayConfirmedAppointments} pendingAppointments={pendingAppointments} overdueRows={revisitRows.filter((item) => item.status === "overdue")} estimatedRevenue={estimatedRevenue} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} saving={saving} onUpdate={(appointmentId: string, payload: AppointmentUpdatePayload) => updateAppointment(appointmentId, payload)} onClose={() => setModal(null)} /></Overlay> : null}</div>}
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</h2>
        {action && <span className="text-xs font-medium tracking-[0.01em] text-[var(--muted)]">{action}</span>}
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
    accent: "before:bg-[var(--accent)]",
    warning: "before:bg-[#e4b08d]",
    danger: "before:bg-[#cf9b8d]",
    neutral: "before:bg-[#d8d2c7]",
  } as const;

  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-[1px] before:absolute before:inset-x-0 before:top-0 before:h-1 ${toneMap[tone]}`}
    >
      <p className="text-[12px] font-medium tracking-[0.01em] text-[var(--muted)]">{label}</p>
      <p className="mt-1.5 text-[27px] font-semibold tracking-[-0.04em] text-[var(--text)]">{value}</p>
      
    </button>
  );
}

function AppointmentRow({ appointment, pet, guardian, service, onClick }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-left transition hover:bg-[#fcfaf7]">
      <div className="min-w-[52px] text-sm font-semibold text-[var(--text)]">{appointment.appointment_time}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text)]">{pet.name} <span className="text-xs font-medium text-[var(--muted)]">({guardian.name})</span></p>
        <p className="text-xs text-[var(--muted)]">{service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}</p>
      </div>
      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: statusMeta[appointment.status].color, background: statusMeta[appointment.status].bg }}>{statusMeta[appointment.status].label}</span>
    </button>
  );
}

function AppointmentDetail({ appointment, pet, guardian, service, saving, onClose, onUpdate }: { appointment: Appointment; pet: Pet; guardian: Guardian; service: Service; saving: boolean; onClose: () => void; onUpdate: (payload: AppointmentUpdatePayload) => void }) {
  const rollbackStatus = appointment.status === "cancelled" ? "confirmed" : null;
  const rollbackLabel = appointment.status === "cancelled" ? "\uCDE8\uC18C/\uBCC0\uACBD \uCCA0\uD68C" : null;
  const [template, setTemplate] = useState<(typeof rejectionReasonTemplates)[number]>(rejectionReasonTemplates[0]);
  const [customReason, setCustomReason] = useState("");

  return <Sheet title={ownerHomeCopy.appointmentDetailTitle} onClose={onClose}><div className="space-y-4"><div className="rounded-2xl bg-[#fcfaf7] p-4 text-sm"><p className="font-bold">{pet.name} {ownerHomeCopy.separator} {guardian.name}</p><p className="mt-1 text-[var(--muted)]">{appointment.appointment_date} {appointment.appointment_time}</p><p className="mt-1 text-[var(--muted)]">{service.name} {ownerHomeCopy.separator} {won(service.price)}</p><p className="mt-1 text-[var(--muted)]">{ownerHomeCopy.memoLabel}: {appointment.memo || ownerHomeCopy.emptyMemo}</p>{appointment.rejection_reason && <p className="mt-2 rounded-2xl bg-[#fff1f1] px-3 py-2 text-xs font-semibold text-red-700">미승인 사유: {appointment.rejection_reason}</p>}</div><div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold">빠른 연락</p><QuickContactRow phone={guardian.phone} /></div>{appointment.status === "pending" && <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-bold">미승인 사유 템플릿</p><RejectionReasonEditor template={template} customReason={customReason} onTemplateChange={(value) => setTemplate(value || rejectionReasonTemplates[0])} onCustomReasonChange={setCustomReason} /><div className="grid grid-cols-2 gap-2"><ActionButton onClick={() => onUpdate({ status: "confirmed" })} disabled={saving}>{ownerHomeCopy.pendingApprove}</ActionButton><ActionButton onClick={() => onUpdate({ status: "rejected", rejectionReasonTemplate: template, rejectionReasonCustom: customReason })} variant="secondary" disabled={saving}>{"\uBBF8\uC2B9\uC778"}</ActionButton></div></div>}<div className="grid grid-cols-2 gap-2">{appointment.status === "confirmed" && <ActionButton variant="highlight" onClick={() => onUpdate({ status: "in_progress" })} disabled={saving}>{"\uC2DC\uC791"}</ActionButton>}{appointment.status === "in_progress" && <ActionButton onClick={() => onUpdate({ status: "almost_done" })} variant="secondary" disabled={saving}>{ownerHomeCopy.pickupReady}</ActionButton>}{appointment.status === "almost_done" && <ActionButton onClick={() => onUpdate({ status: "completed" })} variant="secondary" disabled={saving}>{ownerHomeCopy.groomingComplete}</ActionButton>}{rollbackStatus && rollbackLabel && <ActionButton onClick={() => onUpdate({ status: rollbackStatus })} variant="ghost" disabled={saving}>{rollbackLabel}</ActionButton>}</div></div></Sheet>;
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

function SettingsPanel({ data, onSave, onSaveService, onSaveCustomerPageSettings }: { data: BootstrapPayload; onSave: (payload: unknown) => void; onSaveService: (payload: unknown) => void; onSaveCustomerPageSettings: (payload: unknown) => void }) {
  return <OwnerSettingsPanel data={data} onSave={onSave} onSaveService={onSaveService} onSaveCustomerPageSettings={onSaveCustomerPageSettings} />;
}

function RecordCard({ record, service, onEdit }: { record: GroomingRecord; service?: Service; onEdit: () => void }) { return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"><div className="flex items-center justify-between"><div><p className="text-sm font-bold">{service?.name || "서비스"}</p><p className="text-xs text-[var(--muted)]">{record.groomed_at.slice(0, 10)}</p></div><button className="text-xs font-semibold text-[var(--accent)]" onClick={onEdit}>수정</button></div><p className="mt-2 text-sm text-[var(--muted)]">{record.style_notes || "스타일 메모 없음"}</p><p className="mt-1 text-sm text-[var(--muted)]">{record.memo || "상세 메모 없음"}</p></div>; }
function StatDetail({ kind, todayAppointments, pendingAppointments, overdueRows, estimatedRevenue, petMap, guardianMap, serviceMap, saving, onUpdate, onClose }: { kind: "today" | "pending" | "completed" | "cancel_change"; todayAppointments: Appointment[]; pendingAppointments: Appointment[]; overdueRows: Array<{ pet: Pet; guardian: Guardian; daysUntil: number | null }>; estimatedRevenue: number; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; saving: boolean; onUpdate: (appointmentId: string, payload: AppointmentUpdatePayload) => void; onClose: () => void }) { const [openRejectAppointmentId, setOpenRejectAppointmentId] = useState<string | null>(null); const currentAppointments = todayAppointments.filter((item) => ["confirmed", "in_progress", "almost_done"].includes(item.status)); const completedAppointments = todayAppointments.filter((item) => item.status === "completed"); const cancelChangeOnly = todayAppointments.filter((item) => item.status === "cancelled"); return <Sheet title={kind === "today" ? ownerHomeCopy.todaySheetTitle : kind === "pending" ? ownerHomeCopy.pendingSheetTitle : kind === "completed" ? ownerHomeCopy.completedSheetTitle : ownerHomeCopy.cancelChangeSheetTitle} onClose={onClose}><div className="space-y-3">{kind === "today" && <TodayConfirmedContent pendingAppointments={pendingAppointments} currentAppointments={currentAppointments} completedAppointments={completedAppointments} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} saving={saving} onOpenAppointment={() => {}} onPendingUpdate={onUpdate} onStatusChange={(appointmentId, status) => onUpdate(appointmentId, { status })} />}{kind === "pending" && pendingAppointments.map((appointment) => <PendingApprovalCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => {}} onStatusChange={(payload) => { setOpenRejectAppointmentId(null); onUpdate(appointment.id, payload); }} isRejectOpen={openRejectAppointmentId === appointment.id} onRejectOpen={() => setOpenRejectAppointmentId(appointment.id)} onRejectClose={() => setOpenRejectAppointmentId(null)} />)}{kind === "completed" && <CompletedReservationsContent historyAppointments={completedAppointments} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} onOpenAppointment={() => {}} />}{kind === "cancel_change" && cancelChangeOnly.map((appointment) => <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => {}} onStatusChange={(status) => onUpdate(appointment.id, { status })} />)}</div></Sheet>; }

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
        <div className="min-w-[52px] text-sm font-semibold text-[var(--text)]">{appointment.appointment_time}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">{pet.name} <span className="text-xs font-medium text-[var(--muted)]">({guardian.name})</span></p>
          <p className="text-xs text-[var(--muted)]">{service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}</p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: statusMeta[appointment.status].color, background: statusMeta[appointment.status].bg }}>{statusMeta[appointment.status].label}</span>
      </button>
      {!isRejectOpen ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <ActionButton onClick={() => onStatusChange({ status: "confirmed" })} disabled={saving}>{ownerHomeCopy.pendingApprove}</ActionButton>
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


function TodayConfirmedContent({ pendingAppointments, currentAppointments, completedAppointments, petMap, guardianMap, serviceMap, approvalMode, saving, onOpenAppointment, onPendingUpdate, onStatusChange, onApprovalModeChange }: { pendingAppointments: Appointment[]; currentAppointments: Appointment[]; completedAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, Guardian>; serviceMap: Record<string, Service>; approvalMode?: "manual" | "auto"; saving: boolean; onOpenAppointment: (appointment: Appointment) => void; onPendingUpdate: (appointmentId: string, payload: AppointmentUpdatePayload) => void; onStatusChange: (appointmentId: string, status: AppointmentStatus) => void; onApprovalModeChange?: (mode: "manual" | "auto") => void; }) {
  const [openRejectAppointmentId, setOpenRejectAppointmentId] = useState<string | null>(null);

  return <div className="space-y-3"><div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-3.5"><div className="mb-3 space-y-2"><div className="flex items-center justify-between gap-3"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.pendingSectionTitle}</h3>{approvalMode ? <span className="text-[11px] font-medium text-[var(--muted)]">{approvalMode === "manual" ? "직접 승인 선택됨" : "바로 승인 선택됨"}</span> : null}</div>{approvalMode && onApprovalModeChange ? <div className="grid grid-cols-2 gap-2 rounded-[16px] border border-[var(--border)] bg-[#fcfaf7] p-1"><button type="button" onClick={() => onApprovalModeChange("manual")} disabled={saving || approvalMode === "manual"} className={`rounded-[12px] px-3 py-2 text-sm font-semibold transition ${approvalMode === "manual" ? "bg-[var(--accent)] text-white" : "bg-white text-[var(--muted)]"}`}>{"직접 승인"}</button><button type="button" onClick={() => onApprovalModeChange("auto")} disabled={saving || approvalMode === "auto"} className={`rounded-[12px] px-3 py-2 text-sm font-semibold transition ${approvalMode === "auto" ? "bg-[var(--accent)] text-white" : "bg-white text-[var(--muted)]"}`}>{"바로 승인"}</button></div> : null}</div><div className="max-h-64 overflow-y-auto pr-1"><div className="space-y-2.5">{pendingAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.pendingSectionEmpty} /> : pendingAppointments.map((appointment) => <PendingApprovalCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(payload) => { setOpenRejectAppointmentId(null); onPendingUpdate(appointment.id, payload); }} isRejectOpen={openRejectAppointmentId === appointment.id} onRejectOpen={() => setOpenRejectAppointmentId(appointment.id)} onRejectClose={() => setOpenRejectAppointmentId(null)} />)}</div></div></div><div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-3.5"><div className="mb-2.5"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.currentSectionTitle}</h3></div><div className="max-h-72 overflow-y-auto pr-1"><div className="space-y-2.5">{currentAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.currentSectionEmpty} /> : currentAppointments.map((appointment) => <HomeConfirmedCard key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} saving={saving} onOpen={() => onOpenAppointment(appointment)} onStatusChange={(status) => onStatusChange(appointment.id, status)} allowSwipeCancel />)}</div></div></div><CompletedReservationsContent historyAppointments={completedAppointments} petMap={petMap} guardianMap={guardianMap} serviceMap={serviceMap} onOpenAppointment={onOpenAppointment} /></div>;
}


function CompletedReservationsContent({ historyAppointments, petMap, guardianMap, serviceMap, onOpenAppointment }: { historyAppointments: Appointment[]; petMap: Record<string, Pet>; guardianMap: Record<string, BootstrapPayload["guardians"][number]>; serviceMap: Record<string, Service>; onOpenAppointment: (appointment: Appointment) => void; }) {
  return <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-3.5"><div className="mb-2.5"><h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{ownerHomeCopy.historySectionTitle}</h3></div><div className="space-y-2.5">{historyAppointments.length === 0 ? <EmptyState title={ownerHomeCopy.historySectionEmpty} /> : historyAppointments.map((appointment) => <CompletedAppointmentRow key={appointment.id} appointment={appointment} pet={petMap[appointment.pet_id]} guardian={guardianMap[appointment.guardian_id]} service={serviceMap[appointment.service_id]} onClick={() => onOpenAppointment(appointment)} />)}</div></div>;
}

function CompletedAppointmentRow({ appointment, pet, guardian, service, onClick }: { appointment: Appointment; pet: Pet; guardian: BootstrapPayload["guardians"][number]; service: Service; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-left transition hover:bg-[#fcfaf7]">
      <div className="min-w-[52px] text-sm font-semibold text-[var(--text)]">{appointment.appointment_time}</div>
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

  return <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-transparent"><div className={`absolute inset-y-0 right-0 overflow-hidden rounded-r-[20px] transition-all duration-200 ${actionVisible ? "w-24 opacity-100" : "w-0 opacity-0"}`}><button type="button" className="flex h-full w-24 items-center justify-center bg-[#a86957] text-sm font-semibold text-white" onClick={() => { closeSwipe(); onStatusChange("cancelled"); }}>{ownerHomeCopy.slideCancel}</button></div><div className={`relative rounded-[20px] bg-[var(--surface)] transition-transform ${isDragging ? "duration-75" : "duration-200"}`} style={{ transform: "translateX(" + translateX + "px)", touchAction: allowSwipeCancel ? "pan-y" : "auto" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={isDragging ? handlePointerUp : undefined}><button onClick={() => { if (translateX !== 0) { closeSwipe(); return; } onOpen(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left"><div className="min-w-[52px] text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{appointment.appointment_time}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-[var(--text)]">{pet.name}</p><span className="truncate text-xs font-medium text-[var(--muted)]">{guardian.name}</span></div><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{service.name} {ownerHomeCopy.separator} {service.duration_minutes}{ownerHomeCopy.minuteSuffix}</p></div><span className="rounded-full px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.01em]" style={{ color: statusMeta[appointment.status].color, background: statusMeta[appointment.status].bg }}>{statusMeta[appointment.status].label}</span></button><div className="grid grid-cols-2 gap-2 px-4 pb-3">{appointment.status === "confirmed" && <ActionButton variant="primary" onClick={() => onStatusChange("in_progress")} disabled={saving}>{"\uC2DC\uC791"}</ActionButton>}{appointment.status === "in_progress" && <ActionButton onClick={() => onStatusChange("almost_done")} variant="secondary" disabled={saving}>{ownerHomeCopy.pickupReady}</ActionButton>}{appointment.status === "almost_done" && <ActionButton onClick={() => onStatusChange("completed")} variant="secondary" disabled={saving}>{ownerHomeCopy.groomingComplete}</ActionButton>}{rollbackStatus && rollbackLabel && <ActionButton onClick={() => onStatusChange(rollbackStatus)} variant="ghost" disabled={saving}>{rollbackLabel}</ActionButton>}{appointment.status === "completed" && <div className="col-span-2 rounded-[16px] border border-[#dce8e3] bg-[#f4faf7] px-4 py-3 text-center text-sm font-semibold text-[var(--accent)]">{ownerHomeCopy.completedNotice}</div>}</div></div></div>;
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


function GuardianPetEditorCard({ pet, saving, isBirthdayToday, onSelect, onSave, onSendBirthday, onSendRevisit }: { pet: Pet; saving: boolean; isBirthdayToday: boolean; onSelect: () => void; onSave: (name: string, breed: string, birthday: string | null) => void; onSendBirthday: () => void; onSendRevisit: () => void }) { const [name, setName] = useState(pet.name); const [breed, setBreed] = useState(pet.breed); const [birthday, setBirthday] = useState(pet.birthday ?? ""); return <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex items-center justify-between gap-3"><button className="text-left" onClick={onSelect}><p className="text-sm font-semibold">{pet.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{isBirthdayToday ? "오늘 생일" : birthday ? `생일 ${birthday}` : "생일 미등록"}</p></button><span className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">상세 연결</span></div><div className="mt-3 space-y-3"><Field label="아기 이름"><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="견종"><input className="field" value={breed} onChange={(event) => setBreed(event.target.value)} /></Field><Field label="생일"><input className="field" type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} /></Field></div><div className="mt-2.5 grid grid-cols-2 gap-2"><ActionButton variant="ghost" onClick={() => onSave(name.trim(), breed.trim(), birthday || null)} disabled={saving || !name.trim() || !breed.trim()}>아기 정보 저장</ActionButton><ActionButton variant="secondary" onClick={onSendRevisit}>재방문 알림</ActionButton></div><div className="mt-2">{birthday ? <ActionButton onClick={onSendBirthday} disabled={saving}>생일 축하 문자 보내기</ActionButton> : <div className="rounded-2xl bg-[#fcfaf7] px-4 py-3 text-center text-sm text-[var(--muted)]">생일 미등록</div>}</div></div>; }
function QuickContactRow({ phone }: { phone: string }) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2">
      <a href={`tel:${phone}`} className="flex items-center justify-center rounded-2xl bg-[#f7f4ef] px-4 py-3 text-sm font-semibold text-[var(--text)]">전화하기</a>
      <a href={`sms:${phone}`} className="flex items-center justify-center rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--muted)]">문자 보내기</a>
    </div>
  );
}

function ToggleRow({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) { return <label className={`flex items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 ${disabled ? "opacity-50" : ""}`}><div><p className="text-sm font-semibold text-[var(--text)]">{label}</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p></div><button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-[var(--accent)]" : "bg-[#d9d6cf]"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} /></button></label>; }
function Overlay({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-[430px] rounded-t-[32px] bg-white p-4" onClick={(event) => event.stopPropagation()}>
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
function ActionButton({ children, disabled, onClick, variant = "primary" }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; variant?: "primary" | "secondary" | "ghost" | "highlight" }) {
  const className = variant === "primary" ? "border border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,107,91,0.12)]" : variant === "secondary" ? "border border-[var(--border)] bg-white text-[var(--text)]" : variant === "highlight" ? "border border-[#d7e7e1] bg-[var(--accent-soft)] text-[var(--accent)]" : "border border-[var(--border)] bg-white text-[var(--muted)]";
  return <button disabled={disabled} onClick={onClick} className={`flex h-[43px] w-full items-center justify-center rounded-[14px] px-4 text-sm font-semibold tracking-[-0.01em] transition hover:bg-opacity-95 disabled:opacity-50 ${className}`}>{children}</button>;
}

function EmptyState({ title }: { title: string }) { return <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[#fcfaf7] px-4 py-5 text-center text-sm leading-6 text-[var(--muted)]">{title}</div>; }
function Avatar({ seed }: { seed: string }) { return <div className="flex size-11 items-center justify-center rounded-full border border-[#dfeae5] bg-[#f6fbf9] text-lg shadow-[0_2px_8px_rgba(31,107,91,0.05)]">{seed}</div>; }
function UrgencyPill({ status, days }: { status: "overdue" | "soon" | "ok" | "unknown"; days: number | null }) {
  const text = status === "overdue" ? `${Math.abs(days || 0)}일 초과` : status === "soon" ? `${days}일 남음` : status === "ok" ? `${days}일 여유` : "미산정";
  const cls = status === "overdue" ? "bg-red-50 text-red-700" : status === "soon" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${cls}`}>{text}</span>;
}

function InfoItem({ label, value }: { label: string; value: string }) { return <div className="rounded-[16px] border border-[var(--border)] bg-white p-3.5"><p className="text-[11px] font-medium text-[var(--muted)]">{label}</p><p className="mt-1 text-sm font-semibold text-[var(--text)]">{value}</p></div>; }
