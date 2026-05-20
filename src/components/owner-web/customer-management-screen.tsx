"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, ChevronRight, MessageSquareText, Plus, Search, Trash2, X } from "lucide-react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { cn, currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload, Guardian, Notification, NotificationStatus, NotificationType, Pet } from "@/types/domain";

const staffCommentStorageKey = "petmanager.ownerWeb.staffComments";

type CustomerSort = "recentDesc" | "nameAsc";

type CustomerViewRow = {
  id: string;
  name: string;
  phone: string;
  pets: string[];
  petDetails: Array<Pick<Pet, "id" | "name" | "breed" | "birthday">>;
  tags: string[];
  recentVisit: string;
  recentVisitDate: string | null;
  nextBooking: string;
  nextBookingDate: string | null;
  nextBookingService: string;
  memo: string;
  alerts: string;
  alertEnabled: boolean;
  appointmentCount: number;
  groomingCount: number;
  noshowCount: number;
  deleted: boolean;
  searchText: string;
};

type GuardianDeleteResult = {
  success: boolean;
  guardianIds: string[];
  restoreUntil: string;
};

const customerListGridClass =
  "grid-cols-[28px_minmax(138px,0.85fr)_minmax(136px,0.8fr)_minmax(150px,0.85fr)_minmax(132px,0.75fr)_minmax(170px,1fr)_40px]";

const initialStaffComments: Record<string, string> = {
  "우유|정유진": "첫 방문 때 긴장했음. 목 주변은 잡아주면 안정됨.",
  "몽이|김민지": "물 온도 낮으면 싫어함. 시작 전에 충분히 적셔주기.",
};

function formatMonthDay(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

function normalizeSearch(value: string) {
  return value.replaceAll("-", "").replace(/\s+/g, "").toLowerCase();
}

function buildSearchText(parts: string[]) {
  return normalizeSearch(parts.filter(Boolean).join(" "));
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10 && digits.startsWith("02")) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value;
}

function formatNotificationDateTime(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 16).replace("T", " ");
  return `${parsed.getMonth() + 1}/${parsed.getDate()} ${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

function getNotificationTypeLabel(type: NotificationType) {
  const labels: Record<NotificationType, string> = {
    booking_received: "예약 접수",
    booking_confirmed: "예약 확정",
    owner_booking_requested: "오너 알림",
    booking_rejected: "예약 거절",
    booking_cancelled: "예약 취소",
    booking_rescheduled_confirmed: "예약 변경",
    appointment_reminder_10m: "방문 전 안내",
    grooming_started: "미용 시작",
    grooming_almost_done: "픽업 준비",
    grooming_completed: "미용 완료",
    revisit_notice: "재방문 안내",
    landing_feedback: "피드백",
    waitlist_interest: "대기 신청",
    birthday_greeting: "생일 안내",
  };
  return labels[type] ?? type;
}

function getNotificationStatusMeta(status: NotificationStatus) {
  const labels: Record<NotificationStatus, { label: string; className: string; dotClassName: string }> = {
    sent: {
      label: "발송됨",
      className: "border-[#c9ded7] bg-[#f7fbf9] text-[#1f6b5b]",
      dotClassName: "bg-[#3f8f7a]",
    },
    queued: {
      label: "대기",
      className: "border-[#dbe2ea] bg-white text-[#64748b]",
      dotClassName: "bg-[#94a3b8]",
    },
    failed: {
      label: "실패",
      className: "border-[#efcaca] bg-[#fffafa] text-[#b42318]",
      dotClassName: "bg-[#d1495b]",
    },
    mocked: {
      label: "테스트",
      className: "border-[#dbe2ea] bg-[#f8fafc] text-[#475569]",
      dotClassName: "bg-[#64748b]",
    },
    skipped: {
      label: "건너뜀",
      className: "border-[#eadfd3] bg-[#fffaf4] text-[#9a5b1f]",
      dotClassName: "bg-[#c98a2c]",
    },
  };
  return labels[status] ?? labels.queued;
}

function compareDateDesc(first: string | null, second: string | null) {
  if (!first && !second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  return second.localeCompare(first);
}

function isActiveAppointmentStatus(status: string) {
  return !["cancelled", "rejected", "noshow"].includes(status);
}

function buildCustomerRowsFromBootstrap(data: BootstrapPayload): CustomerViewRow[] {
  const today = currentDateInTimeZone();
  const petsByGuardian = new Map<string, typeof data.pets>();
  const serviceNameById = new Map(data.services.map((service) => [service.id, service.name]));

  for (const pet of data.pets) {
    petsByGuardian.set(pet.guardian_id, [...(petsByGuardian.get(pet.guardian_id) ?? []), pet]);
  }

  return data.guardians.map((guardian) => {
    const pets = petsByGuardian.get(guardian.id) ?? [];
    const petIds = new Set(pets.map((pet) => pet.id));
    const guardianAppointments = data.appointments
      .filter((appointment) => appointment.guardian_id === guardian.id || petIds.has(appointment.pet_id))
      .sort((first, second) => `${first.appointment_date} ${first.appointment_time}`.localeCompare(`${second.appointment_date} ${second.appointment_time}`));
    const upcomingAppointment = guardianAppointments.find(
      (appointment) => appointment.appointment_date >= today && isActiveAppointmentStatus(appointment.status),
    );
    const groomingRecords = data.groomingRecords
      .filter((record) => record.guardian_id === guardian.id || petIds.has(record.pet_id))
      .sort((first, second) => second.groomed_at.localeCompare(first.groomed_at));
    const recentRecord = groomingRecords[0];
    const recentCompletedAppointment = [...guardianAppointments]
      .reverse()
      .find((appointment) => appointment.appointment_date < today || appointment.status === "completed");
    const recentVisitDate = recentRecord?.groomed_at.slice(0, 10) ?? recentCompletedAppointment?.appointment_date ?? null;
    const petNames = pets.length > 0 ? pets.map((pet) => pet.name) : ["반려동물 없음"];
    const nextBookingService = upcomingAppointment ? (serviceNameById.get(upcomingAppointment.service_id) ?? "서비스 확인") : "예약 없음";
    const alertEnabled = guardian.notification_settings?.enabled !== false;
    const noshowCount = guardianAppointments.filter((appointment) => appointment.status === "noshow").length;
    const tags = [
      noshowCount >= 2 ? `노쇼 ${noshowCount}회` : "",
      upcomingAppointment ? "예약 있음" : "",
      groomingRecords.length > 0 ? "미용 기록" : "",
      guardian.memo?.trim() ? "상담 필요" : "",
      alertEnabled ? "알림 수신" : "알림 중지",
    ].filter(Boolean);

    return {
      id: guardian.id,
      name: guardian.name,
      phone: guardian.phone,
      pets: petNames,
      petDetails: pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        breed: pet.breed,
        birthday: pet.birthday ?? null,
      })),
      tags: tags.length > 0 ? tags : ["일반"],
      recentVisit: recentVisitDate ? formatMonthDay(recentVisitDate) : "방문 전",
      recentVisitDate,
      nextBooking: upcomingAppointment ? `${formatMonthDay(upcomingAppointment.appointment_date)} ${upcomingAppointment.appointment_time}` : "예약 없음",
      nextBookingDate: upcomingAppointment?.appointment_date ?? null,
      nextBookingService,
      memo: guardian.memo?.trim() || pets.map((pet) => pet.notes).filter(Boolean).join(" / ") || "고객 메모가 없습니다.",
      alerts: alertEnabled ? "알림 수신 중" : "알림 중지",
      alertEnabled,
      appointmentCount: guardianAppointments.length,
      groomingCount: groomingRecords.length,
      noshowCount,
      deleted: Boolean(guardian.deleted_at),
      searchText: buildSearchText([guardian.name, guardian.phone, ...petNames, ...tags]),
    };
  });
}

function buildLocalMockCustomerRows(): CustomerViewRow[] {
  const rows = [
    { id: "MOCK-001", name: "한서윤", phone: "010-2184-9301", pets: ["마루"], tags: ["정기 고객"], recentVisit: "5/12", recentVisitDate: "2026-05-12", nextBooking: "5/16 10:30", nextBookingDate: "2026-05-16", memo: "발바닥 털을 짧게 정리 선호.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 8, groomingCount: 6, noshowCount: 0 },
    { id: "MOCK-002", name: "이도윤", phone: "010-7641-2209", pets: ["콩이", "바이"], tags: ["다견"], recentVisit: "5/9", recentVisitDate: "2026-05-09", nextBooking: "예약 없음", nextBookingDate: null, memo: "두 마리 동시 방문 시 콩이 먼저 진행.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 5, groomingCount: 4, noshowCount: 0 },
    { id: "MOCK-003", name: "박나은", phone: "010-4120-8831", pets: ["라떼"], tags: ["노쇼 2회", "재확인 필요"], recentVisit: "4/30", recentVisitDate: "2026-04-30", nextBooking: "5/18 14:00", nextBookingDate: "2026-05-18", memo: "예약 전날 확인 연락 필요.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 9, groomingCount: 5, noshowCount: 2 },
    { id: "MOCK-004", name: "최민규", phone: "010-3391-5570", pets: ["누리"], tags: ["상담 필요"], recentVisit: "방문 전", recentVisitDate: null, nextBooking: "5/20 11:30", nextBookingDate: "2026-05-20", memo: "첫 방문. 피부 상태 상담 요청.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 1, groomingCount: 0, noshowCount: 0 },
    { id: "MOCK-005", name: "오하진", phone: "010-9023-1184", pets: ["보리"], tags: ["알림 중지"], recentVisit: "5/1", recentVisitDate: "2026-05-01", nextBooking: "예약 없음", nextBookingDate: null, memo: "알림 대신 전화 선호.", alerts: "알림 중지", alertEnabled: false, appointmentCount: 4, groomingCount: 3, noshowCount: 0 },
    { id: "MOCK-006", name: "정다온", phone: "010-6755-4318", pets: ["루루"], tags: ["재방문 임박"], recentVisit: "4/18", recentVisitDate: "2026-04-18", nextBooking: "예약 없음", nextBookingDate: null, memo: "3주 주기로 재방문 안내하면 좋음.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 7, groomingCount: 7, noshowCount: 0 },
    { id: "MOCK-007", name: "강시우", phone: "010-1182-7430", pets: ["초코"], tags: ["노쇼 3회", "주의"], recentVisit: "4/11", recentVisitDate: "2026-04-11", nextBooking: "예약 없음", nextBookingDate: null, memo: "당일 취소/노쇼 이력 많음. 예약금 안내 권장.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 12, groomingCount: 8, noshowCount: 3 },
    { id: "MOCK-008", name: "서민지", phone: "010-4811-2904", pets: ["구름"], tags: ["피부 민감"], recentVisit: "5/6", recentVisitDate: "2026-05-06", nextBooking: "5/22 16:00", nextBookingDate: "2026-05-22", memo: "저자극 샴푸 사용.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 6, groomingCount: 6, noshowCount: 0 },
    { id: "MOCK-009", name: "오지후", phone: "010-5560-7721", pets: ["하루"], tags: ["대형견"], recentVisit: "5/3", recentVisitDate: "2026-05-03", nextBooking: "5/17 13:00", nextBookingDate: "2026-05-17", memo: "목욕 시간 넉넉한 확보 필요.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 3, groomingCount: 3, noshowCount: 0 },
    { id: "MOCK-010", name: "김유라", phone: "010-7002-1908", pets: ["미미"], tags: ["첫 방문"], recentVisit: "방문 전", recentVisitDate: null, nextBooking: "5/15 12:30", nextBookingDate: "2026-05-15", memo: "예약 때 요청사항 없음.", alerts: "알림 수신 중", alertEnabled: true, appointmentCount: 1, groomingCount: 0, noshowCount: 0 },
  ] satisfies Array<Omit<CustomerViewRow, "searchText" | "deleted" | "nextBookingService" | "petDetails">>;

  return rows.map((row) => ({
    ...row,
    deleted: false,
    nextBookingService: row.nextBookingDate ? "전체 미용" : "예약 없음",
    petDetails: row.pets.map((petName, index) => ({
      id: `mock-pet-${row.id}-${index}`,
      name: petName,
      breed: "미입력",
      birthday: null,
    })),
    searchText: buildSearchText([row.name, row.phone, ...row.pets, ...row.tags]),
  }));
}

function shouldUseLocalMockCustomers(data: BootstrapPayload) {
  return data.mode !== "supabase" && (data.shop.id === "demo-shop" || data.shop.id === "owner-demo");
}

function sortCustomers(customers: CustomerViewRow[], sort: CustomerSort) {
  return [...customers].sort((first, second) => {
    if (sort === "nameAsc") return first.name.localeCompare(second.name, "ko");
    return compareDateDesc(first.recentVisitDate, second.recentVisitDate) || first.name.localeCompare(second.name, "ko");
  });
}

async function patchOwnerGuardian(payload: unknown) {
  return fetchApiJsonWithAuth<Guardian>("/api/guardians", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function createOwnerGuardian(payload: unknown) {
  return fetchApiJsonWithAuth<Guardian>("/api/guardians", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function patchOwnerPet(payload: unknown) {
  return fetchApiJsonWithAuth<Pet>("/api/pets", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function createOwnerPet(payload: unknown) {
  return fetchApiJsonWithAuth<Pet>("/api/pets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function deleteOwnerPet(payload: unknown) {
  return fetchApiJsonWithAuth<{ success: boolean; petId: string }>("/api/pets", {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

function isLocalOnlyCustomer(row: CustomerViewRow) {
  return row.id.startsWith("MOCK-") || row.id.startsWith("G-");
}

function getCustomerTagClass(tag: string) {
  if (tag.startsWith("노쇼")) return "bg-[#fff1f2] text-[#b42318] ring-1 ring-[#f4c7cc]";
  return "bg-[#f4f0eb] text-[#6d655c]";
}

export default function CustomerManagementScreen({ initialData }: { initialData: BootstrapPayload }) {
  const initialCustomers = useMemo(() => {
    const rows = buildCustomerRowsFromBootstrap(initialData);
    const baseRows = rows.length > 0 ? rows : [];
    return shouldUseLocalMockCustomers(initialData) ? [...baseRows, ...buildLocalMockCustomerRows()] : baseRows;
  }, [initialData]);
  const [customers, setCustomers] = useState<CustomerViewRow[]>(() => initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [deletingCustomers, setDeletingCustomers] = useState(false);
  const [staffComments, setStaffComments] = useState<Record<string, string>>(() => initialStaffComments);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CustomerSort>("recentDesc");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCustomers(initialCustomers);
      setSelectedCustomerId((current) => (initialCustomers.some((customer) => customer.id === current) ? current : ""));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialCustomers]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(staffCommentStorageKey);
      if (stored) {
        const frame = window.requestAnimationFrame(() => setStaffComments((current) => ({ ...current, ...JSON.parse(stored) })));
        return () => window.cancelAnimationFrame(frame);
      }
    } catch {
      // Ignore malformed local storage data.
    }
  }, []);

  const displayedCustomers = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const filtered = customers.filter((row) => {
      if (row.deleted) return false;
      if (!normalizedQuery) return true;
      return row.searchText.includes(normalizedQuery);
    });
    return sortCustomers(filtered, sort);
  }, [customers, query, sort]);

  const selectedCustomer = customers.find((row) => row.id === selectedCustomerId);
  const selectedPetName = selectedCustomer?.pets[0] ?? "";
  const selectedCommentKey = selectedCustomer ? `${selectedPetName}|${selectedCustomer.name}` : "";
  const selectedStaffComment = staffComments[selectedCommentKey] ?? "";
  const selectedNotifications = useMemo(() => {
    if (!selectedCustomer) return [];
    const petIds = new Set(selectedCustomer.petDetails.map((pet) => pet.id));
    return initialData.notifications
      .filter((notification) => notification.guardian_id === selectedCustomer.id || (notification.pet_id ? petIds.has(notification.pet_id) : false))
      .sort((first, second) => (second.sent_at ?? second.created_at).localeCompare(first.sent_at ?? first.created_at))
      .slice(0, 6);
  }, [initialData.notifications, selectedCustomer]);
  const displayedCustomerIds = useMemo(() => displayedCustomers.map((row) => row.id), [displayedCustomers]);
  const allDisplayedCustomersSelected =
    displayedCustomerIds.length > 0 && displayedCustomerIds.every((id) => selectedDeleteIds.includes(id));

  function updateStaffComment(value: string) {
    if (!selectedCommentKey) return;
    setStaffComments((current) => {
      const next = { ...current, [selectedCommentKey]: value };
      window.localStorage.setItem(staffCommentStorageKey, JSON.stringify(next));
      return next;
    });
  }

  async function addCustomer() {
    setSaveError("");
    const nextCustomer: CustomerViewRow = {
      id: `G-${Date.now()}`,
      name: "신규 보호자",
      phone: "010-0000-0000",
      pets: ["반려동물"],
      petDetails: [],
      tags: ["상담 필요", "알림 수신"],
      recentVisit: "방문 전",
      recentVisitDate: null,
      nextBooking: "예약 없음",
      nextBookingDate: null,
      nextBookingService: "예약 없음",
      memo: "고객 메모를 입력해 주세요.",
      alerts: "알림 수신 중",
      alertEnabled: true,
      appointmentCount: 0,
      groomingCount: 0,
      noshowCount: 0,
      deleted: false,
      searchText: buildSearchText(["신규 보호자", "010-0000-0000", "반려동물", "상담 필요", "알림 수신"]),
    };

    setCustomers((current) => [nextCustomer, ...current]);
    setSelectedCustomerId(nextCustomer.id);
    setDetailSheetOpen(true);

    if (shouldUseLocalMockCustomers(initialData)) return;

    try {
      const guardian = await createOwnerGuardian({
        shopId: initialData.shop.id,
        name: nextCustomer.name,
        phone: nextCustomer.phone,
        memo: nextCustomer.memo,
      });
      const pet = await createOwnerPet({
        shopId: initialData.shop.id,
        guardianId: guardian.id,
        name: "반려동물",
        breed: "미입력",
        birthday: null,
        notes: "",
        groomingCycleWeeks: 4,
      });
      setCustomers((current) =>
        current.map((row) =>
          row.id === nextCustomer.id
            ? {
                ...row,
                id: guardian.id,
                name: guardian.name,
                phone: guardian.phone,
                petDetails: [{ id: pet.id, name: pet.name, breed: pet.breed, birthday: pet.birthday ?? null }],
                searchText: buildSearchText([guardian.name, guardian.phone, pet.name, ...row.tags]),
              }
            : row,
        ),
      );
      setSelectedCustomerId(guardian.id);
    } catch (error) {
      setCustomers((current) => current.filter((row) => row.id !== nextCustomer.id));
      setSelectedCustomerId("");
      setDetailSheetOpen(false);
      setSaveError(error instanceof Error ? error.message : "고객 추가에 실패했습니다.");
    }
  }

  function toggleDelete(id: string) {
    setSelectedDeleteIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleDeleteMode() {
    setDeleteMode((current) => !current);
    setSelectedDeleteIds([]);
    setDeleteError("");
    setSaveError("");
  }

  function toggleDisplayedCustomerSelection() {
    setSelectedDeleteIds((current) => {
      const displayedIdSet = new Set(displayedCustomerIds);
      const allDisplayedSelected = displayedCustomerIds.length > 0 && displayedCustomerIds.every((id) => current.includes(id));

      if (allDisplayedSelected) return current.filter((id) => !displayedIdSet.has(id));
      return Array.from(new Set([...current, ...displayedCustomerIds]));
    });
  }

  async function moveSelectedCustomersToDeleted() {
    if (selectedDeleteIds.length === 0 || deletingCustomers) return;

    const selectedIds = new Set(selectedDeleteIds);
    setDeletingCustomers(true);
    setDeleteError("");

    try {
      await fetchApiJsonWithAuth<GuardianDeleteResult>("/api/guardians", {
        method: "DELETE",
        body: JSON.stringify({
          shopId: initialData.shop.id,
          guardianIds: selectedDeleteIds,
        }),
      });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "고객 삭제에 실패했습니다.");
      setDeletingCustomers(false);
      return;
    }

    setCustomers((current) => current.map((row) => (selectedIds.has(row.id) ? { ...row, deleted: true } : row)));
    setSelectedCustomerId((current) => (selectedIds.has(current) ? "" : current));
    setSelectedDeleteIds([]);
    setDeleteMode(false);
    setDetailSheetOpen(false);
    setDeletingCustomers(false);
  }

  function openCustomer(row: CustomerViewRow) {
    if (deleteMode) {
      toggleDelete(row.id);
      return;
    }
    setSelectedCustomerId(row.id);
    setDetailSheetOpen(true);
  }

  function addQuickReservation() {
    if (!selectedCustomer) return;
    setCustomers((current) =>
      current.map((row) =>
        row.id === selectedCustomer.id
          ? {
              ...row,
              nextBooking: "오늘 빠른 예약",
              nextBookingDate: currentDateInTimeZone(),
              appointmentCount: row.appointmentCount + 1,
              tags: Array.from(new Set([...row.tags, "예약 있음"])),
              searchText: buildSearchText([row.name, row.phone, ...row.pets, ...row.tags, "예약 있음"]),
            }
          : row,
      ),
    );
  }

  async function toggleAlertStatus() {
    if (!selectedCustomer) return;
    const previousCustomers = customers;
    const nextAlertEnabled = !selectedCustomer.alertEnabled;
    setSaveError("");
    setCustomers((current) =>
      current.map((row) => {
        if (row.id !== selectedCustomer.id) return row;
        const tags = row.tags
          .filter((tag) => tag !== "알림 수신" && tag !== "알림 중지")
          .concat(nextAlertEnabled ? "알림 수신" : "알림 중지");
        return {
          ...row,
          alertEnabled: nextAlertEnabled,
          alerts: nextAlertEnabled ? "알림 수신 중" : "알림 중지",
          tags,
          searchText: buildSearchText([row.name, row.phone, ...row.pets, ...tags]),
        };
      }),
    );

    try {
      if (!isLocalOnlyCustomer(selectedCustomer)) {
        await patchOwnerGuardian({
          shopId: initialData.shop.id,
          guardianId: selectedCustomer.id,
          notificationSettings: {
            enabled: nextAlertEnabled,
          },
        });
      }
    } catch (error) {
      setCustomers(previousCustomers);
      setSaveError(error instanceof Error ? error.message : "알림 수신 상태 저장에 실패했습니다.");
    }
  }

  async function updateCustomer(customerId: string, patch: Partial<Pick<CustomerViewRow, "name" | "phone" | "pets" | "recentVisit" | "nextBooking" | "memo">>) {
    const currentCustomer = customers.find((row) => row.id === customerId);
    if (!currentCustomer) return;

    const previousCustomers = customers;
    setSaveError("");
    setCustomers((current) =>
      current.map((row) => {
        if (row.id !== customerId) return row;
        const next = {
          ...row,
          ...patch,
          petDetails: patch.pets
            ? row.petDetails.map((pet, index) => ({
                ...pet,
                name: patch.pets?.[index] ?? pet.name,
              }))
            : row.petDetails,
        };
        return {
          ...next,
          searchText: buildSearchText([next.name, next.phone, ...next.pets, ...next.tags]),
        };
      }),
    );

    try {
      const guardianPatch: Record<string, unknown> = { guardianId: customerId };
      if (!isLocalOnlyCustomer(currentCustomer)) guardianPatch.shopId = initialData.shop.id;
      if (typeof patch.name === "string") guardianPatch.name = patch.name;
      if (typeof patch.phone === "string") guardianPatch.phone = patch.phone;
      if (typeof patch.memo === "string") guardianPatch.memo = patch.memo;

      if (!isLocalOnlyCustomer(currentCustomer) && Object.keys(guardianPatch).length > 2) {
        await patchOwnerGuardian(guardianPatch);
      }

      if (patch.pets && !isLocalOnlyCustomer(currentCustomer)) {
        const nextPetNames = patch.pets;
        const editablePetDetails = currentCustomer.petDetails.slice(0, nextPetNames.length);
        await Promise.all(
          editablePetDetails.map((pet, index) =>
            patchOwnerPet({
              shopId: initialData.shop.id,
              petId: pet.id,
              name: nextPetNames[index],
              breed: pet.breed || "미입력",
              birthday: pet.birthday ?? null,
            }),
          ),
        );
        const newPetNames = nextPetNames.slice(currentCustomer.petDetails.length);
        if (newPetNames.length > 0) {
          const createdPets = await Promise.all(
            newPetNames.map((name) =>
              createOwnerPet({
                shopId: initialData.shop.id,
                guardianId: currentCustomer.id,
                name,
                breed: "미입력",
                birthday: null,
                notes: "",
                groomingCycleWeeks: 4,
              }),
            ),
          );
          setCustomers((current) =>
            current.map((row) =>
              row.id === customerId
                ? {
                    ...row,
                    petDetails: [
                      ...row.petDetails,
                      ...createdPets.map((pet) => ({ id: pet.id, name: pet.name, breed: pet.breed, birthday: pet.birthday ?? null })),
                    ],
                  }
                : row,
            ),
          );
        }
      }
    } catch (error) {
      setCustomers(previousCustomers);
      setSaveError(error instanceof Error ? error.message : "고객 정보 저장에 실패했습니다.");
    }
  }

  async function addPet(customerId: string, petName: string) {
    const currentCustomer = customers.find((row) => row.id === customerId);
    const name = petName.trim();
    if (!currentCustomer || !name) return;
    const previousCustomers = customers;
    const tempPet = { id: `local-pet-${Date.now()}`, name, breed: "미입력", birthday: null };
    setSaveError("");
    setCustomers((current) =>
      current.map((row) =>
        row.id === customerId
          ? {
              ...row,
              pets: [...row.pets.filter((item) => item !== "반려동물 없음"), name],
              petDetails: [...row.petDetails, tempPet],
              searchText: buildSearchText([row.name, row.phone, ...row.pets, name, ...row.tags]),
            }
          : row,
      ),
    );

    if (isLocalOnlyCustomer(currentCustomer)) return;

    try {
      const pet = await createOwnerPet({
        shopId: initialData.shop.id,
        guardianId: customerId,
        name,
        breed: "미입력",
        birthday: null,
        notes: "",
        groomingCycleWeeks: 4,
      });
      setCustomers((current) =>
        current.map((row) =>
          row.id === customerId
            ? {
                ...row,
                petDetails: row.petDetails.map((item) => (item.id === tempPet.id ? { id: pet.id, name: pet.name, breed: pet.breed, birthday: pet.birthday ?? null } : item)),
              }
            : row,
        ),
      );
    } catch (error) {
      setCustomers(previousCustomers);
      setSaveError(error instanceof Error ? error.message : "반려동물 추가에 실패했습니다.");
    }
  }

  async function removePet(customerId: string, petId: string) {
    const currentCustomer = customers.find((row) => row.id === customerId);
    const targetPet = currentCustomer?.petDetails.find((pet) => pet.id === petId);
    if (!currentCustomer || !targetPet || currentCustomer.petDetails.length <= 1) return;
    const previousCustomers = customers;
    setSaveError("");
    setCustomers((current) =>
      current.map((row) =>
        row.id === customerId
          ? {
              ...row,
              pets: row.pets.filter((name) => name !== targetPet.name),
              petDetails: row.petDetails.filter((pet) => pet.id !== petId),
              searchText: buildSearchText([row.name, row.phone, ...row.pets.filter((name) => name !== targetPet.name), ...row.tags]),
            }
          : row,
      ),
    );

    if (isLocalOnlyCustomer(currentCustomer) || petId.startsWith("local-pet-") || petId.startsWith("mock-pet-")) return;

    try {
      await deleteOwnerPet({
        shopId: initialData.shop.id,
        petId,
      });
    } catch (error) {
      setCustomers(previousCustomers);
      setSaveError(error instanceof Error ? error.message : "반려동물 삭제에 실패했습니다.");
    }
  }

  return (
    <div>
      <section className="overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="border-b border-[#dbe2ea] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-11 min-w-[320px] flex-1 items-center gap-3 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[#64748b] focus-within:border-[#2f7866] focus-within:bg-white">
              <Search className="h-4 w-4 text-[#94a3b8]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-[14px] text-[#111827] outline-none placeholder:text-[#94a3b8]"
                placeholder="보호자명, 연락처, 반려동물 이름 검색"
              />
            </label>
            <button
              type="button"
              onClick={addCustomer}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[8px] bg-[#2f7866] px-4 text-[14px] font-semibold text-white transition hover:bg-[#286a5a]"
            >
              <Plus className="h-4 w-4" />
              고객 추가
            </button>
            <button
              type="button"
              aria-label={deleteMode ? "고객 삭제 모드 닫기" : "고객 삭제 모드"}
              onClick={toggleDeleteMode}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-[8px] border transition",
                deleteMode
                  ? "border-[#ead9cf] bg-[#fff7ed] text-[#9a4f1f]"
                  : "border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]",
              )}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {deleteMode ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 py-3">
            <div>
            <p className="text-[14px] font-medium text-[#111827]">
              {selectedDeleteIds.length}명 선택됨
              <span className="ml-2 text-[13px] font-normal text-[#64748b]">선택한 고객은 삭제 처리됩니다.</span>
            </p>
            {deleteError ? <p className="mt-1 text-[12px] font-medium text-[#b42318]">{deleteError}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleDisplayedCustomerSelection} className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-medium text-[#334155] transition hover:bg-[#f8fafc]" disabled={deletingCustomers}>
                {allDisplayedCustomersSelected ? "선택 해제" : "전체 선택"}
              </button>
              <button type="button" onClick={moveSelectedCustomersToDeleted} className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-medium text-[#9f3a3a] transition hover:border-[#efcaca] hover:bg-[#fffafa] disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]" disabled={selectedDeleteIds.length === 0 || deletingCustomers}>
                선택 삭제
              </button>
            </div>
          </div>
        ) : null}

        {saveError ? (
          <p className="border-b border-[#f4c7cc] bg-[#fff7f8] px-4 py-2 text-[12px] font-medium text-[#b42318]">
            {saveError}
          </p>
        ) : null}

        <div className={cn("grid border-b border-[#dbe2ea] bg-[#f8fafc] px-4 py-3 text-center text-[15px] font-semibold text-[#64748b]", customerListGridClass)}>
          <span />
          <button type="button" onClick={() => setSort((current) => (current === "nameAsc" ? "recentDesc" : "nameAsc"))} className="text-center transition hover:text-[#1f6b5b]">
            보호자명
          </button>
          <span className="text-center">반려동물</span>
          <span className="text-center">연락처</span>
          <span className="text-center">다음 예약</span>
          <span className="text-center">알림 수신</span>
          <span />
        </div>
        <div className="max-h-[calc(100vh-240px)] min-h-[620px] overflow-y-auto">
          {displayedCustomers.length > 0 ? (
            displayedCustomers.map((row) => (
              <CustomerListRow
                key={row.id}
                row={row}
                selected={row.id === selectedCustomerId}
                deleteMode={deleteMode}
                checked={selectedDeleteIds.includes(row.id)}
                onToggleDelete={toggleDelete}
                onOpen={openCustomer}
              />
            ))
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <p className="text-[15px] font-medium text-[#111827]">조건에 맞는 고객이 없습니다.</p>
              <p className="mt-1 text-[13px] text-[#64748b]">검색어를 줄이거나 고객을 추가해 주세요.</p>
            </div>
          )}
        </div>
      </section>

      {selectedCustomer && detailSheetOpen ? (
        <CustomerDetailSheet
          customer={selectedCustomer}
          staffComment={selectedStaffComment}
          notifications={selectedNotifications}
          onClose={() => setDetailSheetOpen(false)}
          onChangeStaffComment={updateStaffComment}
          onUpdateCustomer={updateCustomer}
          onAddPet={addPet}
          onDeletePet={removePet}
          onAddQuickReservation={addQuickReservation}
          onToggleAlertStatus={toggleAlertStatus}
          onToggleDeleteMode={() => {
            setDeleteMode(true);
            setSelectedDeleteIds([selectedCustomer.id]);
            setDetailSheetOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function CustomerListRow({
  row,
  selected,
  deleteMode,
  checked,
  onToggleDelete,
  onOpen,
}: {
  row: CustomerViewRow;
  selected: boolean;
  deleteMode: boolean;
  checked: boolean;
  onToggleDelete: (id: string) => void;
  onOpen: (row: CustomerViewRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className={cn(
        "relative grid min-h-[46px] w-full items-center border-b border-[#edf2f7] px-4 text-left transition last:border-b-0",
        customerListGridClass,
        selected ? "bg-[#fbfcfd] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]" : "bg-white hover:bg-[#f8fafc]",
      )}
    >
      <span className="flex items-center">
        {deleteMode ? (
          <span
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onToggleDelete(row.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onToggleDelete(row.id);
              }
            }}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-[5px] border",
              checked ? "border-[#2f7866] bg-[#2f7866] text-white" : "border-[#cbd5e1] bg-white",
            )}
          >
            {checked ? <Check className="h-3.5 w-3.5" /> : null}
          </span>
        ) : (
          <span className={cn("h-2 w-2 rounded-full", row.noshowCount >= 2 ? "bg-[#b42318]" : row.alertEnabled ? "bg-[#4f9b88]" : "bg-[#d5dde6]")} />
        )}
      </span>
      <span className="min-w-0 text-center">
        <span className="block truncate text-[14px] font-medium text-[#111827]">{row.name}</span>
        <span className="block truncate text-[11px] text-[#64748b]">{row.appointmentCount}건 예약 · {row.groomingCount}건 기록</span>
      </span>
      <span className="truncate text-center text-[14px] text-[#111827]">{row.pets.join(", ")}</span>
      <span className="truncate text-center text-[14px] tabular-nums text-[#111827]">{formatPhoneNumber(row.phone)}</span>
      <span className={cn("truncate text-center text-[14px]", row.nextBookingDate ? "text-[#1f6b5b]" : "text-[#94a3b8]")}>{row.nextBooking}</span>
      <span className="flex min-w-0 justify-center">
        <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium", row.alertEnabled ? "bg-[#eef7f4] text-[#1f6b5b]" : "bg-[#f1f5f9] text-[#64748b]")}>
          {row.alertEnabled ? "수신" : "중지"}
        </span>
      </span>
      <span className="flex justify-end">
        <ChevronRight className="h-4 w-4 text-[#94a3b8]" />
      </span>
    </button>
  );
}

function CustomerDetailSheet({
  customer,
  staffComment,
  notifications,
  onClose,
  onChangeStaffComment,
  onUpdateCustomer,
  onAddPet,
  onDeletePet,
  onAddQuickReservation,
  onToggleAlertStatus,
  onToggleDeleteMode,
}: {
  customer: CustomerViewRow;
  staffComment: string;
  notifications: Notification[];
  onClose: () => void;
  onChangeStaffComment: (value: string) => void;
  onUpdateCustomer: (customerId: string, patch: Partial<Pick<CustomerViewRow, "name" | "phone" | "pets" | "recentVisit" | "nextBooking" | "memo">>) => void | Promise<void>;
  onAddPet: (customerId: string, petName: string) => void | Promise<void>;
  onDeletePet: (customerId: string, petId: string) => void | Promise<void>;
  onAddQuickReservation: () => void;
  onToggleAlertStatus: () => void | Promise<void>;
  onToggleDeleteMode: () => void;
}) {
  const formattedPhone = formatPhoneNumber(customer.phone);
  const primaryPetName = customer.pets[0] ?? "반려동물";
  const nextBookingDetail = customer.nextBookingDate ? `${customer.nextBookingService} · ${primaryPetName}` : "등록된 다음 예약이 없습니다.";
  const visibleTags = customer.tags.filter((tag) => tag !== "알림 수신" && tag !== "알림 중지");
  const [newPetName, setNewPetName] = useState("");

  function updateEditableField(field: "name" | "phone" | "pets" | "recentVisit" | "nextBooking" | "memo", value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    if (field === "pets") {
      const pets = trimmedValue
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (pets.length > 0) void onUpdateCustomer(customer.id, { pets });
      return;
    }
    void onUpdateCustomer(customer.id, {
      [field]: field === "phone" ? formatPhoneNumber(trimmedValue) : trimmedValue,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-[460px] flex-col border-l border-[#dbe2ea] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <EditableText
              value={customer.name}
              onSave={(value) => updateEditableField("name", value)}
              displayClassName="block w-full text-left"
              displayTextClassName="text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-[#111827]"
              inputClassName="h-11 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-2 text-[28px] font-semibold tracking-[-0.02em] text-[#111827] outline-none focus:border-[#1f6b5b]"
            />
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <EditableText
                value={formattedPhone}
                onSave={(value) => updateEditableField("phone", value)}
                displayClassName="min-w-fit text-left"
                displayTextClassName="text-[17px] font-medium tabular-nums text-[#334155]"
                inputClassName="h-10 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-2 text-[17px] font-medium tabular-nums text-[#111827] outline-none focus:border-[#1f6b5b]"
              />
              {visibleTags.map((tag) => (
                <span key={tag} className={cn("inline-flex h-6 items-center rounded-[6px] px-2.5 text-[12px] font-medium", getCustomerTagClass(tag))}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3.5">
          <section className="relative rounded-[8px] border border-[#dbe2ea] border-l-4 border-l-[#1f6b5b] bg-[#fbfcfd] py-3 pl-4 pr-[112px]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-[#64748b]">다음 예약</p>
              <button
                type="button"
                onClick={onAddQuickReservation}
                className="absolute right-4 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
              >
                {customer.nextBookingDate ? "예약 변경" : "예약 추가"}
              </button>
            </div>
            <EditableText
              value={customer.nextBooking}
              onSave={(value) => updateEditableField("nextBooking", value)}
              displayClassName="mt-1.5 block w-full text-left"
              displayTextClassName="text-[23px] font-semibold leading-[28px] text-[#111827]"
              inputClassName="mt-2 h-10 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-2 text-[22px] font-semibold text-[#111827] outline-none focus:border-[#1f6b5b]"
            />
            <p className="mt-0.5 truncate text-[13px] leading-5 text-[#64748b]">{nextBookingDetail}</p>
          </section>

          <section className="mt-4 divide-y divide-[#edf2f7] border-y border-[#edf2f7]">
            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3 py-3">
              <p className="text-[13px] font-medium text-[#64748b]">반려동물</p>
              <div className="min-w-0 space-y-2">
                {(customer.petDetails.length > 0 ? customer.petDetails : customer.pets.map((name, index) => ({ id: `local-pet-${index}`, name, breed: "미입력", birthday: null }))).map((pet, index) => (
                  <div key={pet.id} className="flex min-w-0 items-center gap-2">
                    <EditableText
                      value={pet.name}
                      onSave={(value) => {
                        const nextPets = [...customer.pets];
                        nextPets[index] = value;
                        updateEditableField("pets", nextPets.join(", "));
                      }}
                      displayClassName="min-w-0 flex-1 text-left"
                      displayTextClassName="text-[16px] font-medium text-[#111827]"
                      inputClassName="h-9 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-2 text-[16px] font-medium text-[#111827] outline-none focus:border-[#1f6b5b]"
                    />
                    {customer.petDetails.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => void onDeletePet(customer.id, pet.id)}
                        className="h-8 rounded-[7px] border border-[#ead9cf] bg-white px-2 text-[12px] font-medium text-[#94624f] hover:bg-[#fffafa]"
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                ))}
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = newPetName.trim();
                    if (!name) return;
                    void onAddPet(customer.id, name);
                    setNewPetName("");
                  }}
                >
                  <input
                    value={newPetName}
                    onChange={(event) => setNewPetName(event.target.value)}
                    placeholder="반려동물 추가"
                    className="h-9 min-w-0 flex-1 rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-[14px] text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#1f6b5b]"
                  />
                  <button type="submit" className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]">
                    추가
                  </button>
                </form>
              </div>
            </div>
            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 py-3">
              <p className="text-[13px] font-medium text-[#64748b]">최근 방문</p>
              <EditableText
                value={customer.recentVisit}
                onSave={(value) => updateEditableField("recentVisit", value)}
                displayClassName="min-w-0 text-left"
                displayTextClassName="text-[16px] font-medium text-[#111827]"
                inputClassName="h-9 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-2 text-[16px] font-medium text-[#111827] outline-none focus:border-[#1f6b5b]"
              />
            </div>
            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 py-3">
              <p className="text-[13px] font-medium text-[#64748b]">알림</p>
              <button type="button" onClick={() => void onToggleAlertStatus()} className="w-fit text-left text-[16px] font-medium text-[#111827] hover:text-[#1f6b5b]">
                {customer.alerts}
              </button>
            </div>
          </section>

          {customer.noshowCount >= 2 ? (
            <section className="mt-3 rounded-[8px] border border-[#f4c7cc] bg-[#fff7f8] px-4 py-3">
              <p className="text-[12px] font-semibold text-[#b42318]">노쇼 주의 고객</p>
              <p className="mt-1 text-[14px] leading-5 text-[#7f1d1d]">노쇼가 {customer.noshowCount}회 기록되었습니다. 예약 확정 전에 재확인이 필요합니다.</p>
            </section>
          ) : null}

          <section className="mt-5">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-[#64748b]" />
              <h3 className="text-[15px] font-semibold text-[#111827]">메모</h3>
            </div>
            <div className="mt-2 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <p className="text-[13px] font-medium text-[#64748b]">고객 메모</p>
              <EditableText
                value={customer.memo}
                onSave={(value) => updateEditableField("memo", value)}
                multiline
                displayClassName="mt-1.5 block w-full text-left"
                displayTextClassName="whitespace-pre-wrap text-[15px] leading-6 text-[#111827]"
                inputClassName="mt-1.5 min-h-[72px] w-full resize-none rounded-[8px] border border-[#cfd8e3] bg-white px-3 py-2 text-[15px] leading-6 text-[#111827] outline-none focus:border-[#1f6b5b]"
              />
              <div className="my-3 h-px bg-[#edf2f7]" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium text-[#64748b]">작업 메모</p>
                <span className="text-[11px] font-medium text-[#94a3b8]">스태프 공유</span>
              </div>
              <textarea
                value={staffComment}
                onChange={(event) => onChangeStaffComment(event.target.value)}
                placeholder="작업 시 주의할 점을 적어주세요."
                className="mt-1.5 h-[88px] w-full resize-none rounded-[8px] border border-[#cfd8e3] bg-white px-3 py-2 text-[15px] leading-6 text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#1f6b5b]"
              />
            </div>
          </section>

          <section className="mt-4 rounded-[8px] border border-[#dbe2ea] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#edf2f7] px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#64748b]" />
                <h3 className="text-[15px] font-medium text-[#111827]">알림 이력</h3>
              </div>
              <span className="text-[12px] text-[#94a3b8]">최근 {notifications.length}건</span>
            </div>
            {notifications.length > 0 ? (
              <div className="divide-y divide-[#edf2f7]">
                {notifications.map((notification) => {
                  const statusMeta = getNotificationStatusMeta(notification.status);
                  const deliveredAt = formatNotificationDateTime(notification.sent_at ?? notification.created_at);
                  const reason = notification.status === "failed" || notification.status === "skipped" ? notification.fail_reason : "";
                  return (
                    <div key={notification.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", statusMeta.dotClassName)} />
                            <p className="truncate text-[14px] font-medium text-[#111827]">{getNotificationTypeLabel(notification.type)}</p>
                          </div>
                          <p className="mt-1 truncate text-[13px] text-[#64748b]">{notification.message || "발송 메시지 내용이 없습니다."}</p>
                          {reason ? <p className="mt-1 text-[12px] leading-5 text-[#b42318]">{reason}</p> : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={cn("inline-flex h-6 items-center rounded-[6px] border px-2 text-[11px] font-medium", statusMeta.className)}>
                            {statusMeta.label}
                          </span>
                          <p className="mt-1 text-[12px] tabular-nums text-[#94a3b8]">{deliveredAt}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-4 text-[13px] leading-5 text-[#64748b]">
                아직 이 고객에게 기록된 알림이 없습니다.
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-[#edf2f7] bg-white px-5 py-3.5">
          <button type="button" onClick={onToggleDeleteMode} className="inline-flex h-8 items-center gap-1.5 text-[13px] font-medium text-[#94624f] hover:underline">
            <Trash2 className="h-4 w-4" />
            고객 삭제 모드로 이동
          </button>
        </div>
      </aside>
    </div>
  );
}

function EditableText({
  value,
  onSave,
  displayClassName,
  inputClassName,
  displayTextClassName,
  multiline = false,
}: {
  value: string;
  onSave: (value: string) => void;
  displayClassName: string;
  inputClassName: string;
  displayTextClassName?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (editing) return;
    const frame = window.requestAnimationFrame(() => setDraft(value));
    return () => window.cancelAnimationFrame(frame);
  }, [editing, value]);

  function commit() {
    const nextValue = draft.trim();
    setEditing(false);
    if (nextValue && nextValue !== value) onSave(nextValue);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
          className={inputClassName}
        />
      );
    }

    return (
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        className={inputClassName}
      />
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className={displayClassName} title="클릭해서 수정">
      <span className={cn("block min-w-0 truncate", displayTextClassName)}>{value}</span>
    </button>
  );
}
