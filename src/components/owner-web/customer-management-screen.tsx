"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarPlus, Check, ChevronRight, MessageSquareText, Trash2, X } from "lucide-react";

import { BasilIcon } from "@/components/owner-web/basil-icon";
import CustomerDetailPanel from "@/components/owner-web/customer-detail-panel";
import { buildCustomerDetailFromBootstrap } from "@/components/owner-web/customer-detail-helpers";
import { AssetIcon } from "@/components/owner-web/owner-web-ui";
import { getDotIndicatorClass } from "@/components/owner-web/status-indicators";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { createOwnerMediaAssetFromFile } from "@/lib/media/owner-media-client";
import { normalizePetBiteLevel } from "@/lib/pet-bite-level";
import { cn, currentDateInTimeZone, formatClockTime } from "@/lib/utils";
import type {
  Appointment,
  BootstrapPayload,
  Guardian,
  GuardianNotificationSettings,
  MediaAsset,
  Notification,
  NotificationStatus,
  NotificationType,
  Pet,
  PetBiteLevel,
} from "@/types/domain";

type CustomerSort = "recentDesc" | "nameAsc";

type CustomerViewRow = {
  id: string;
  name: string;
  phone: string;
  pets: string[];
  petDetails: Array<Pick<Pet, "id" | "name" | "breed" | "weight" | "notes" | "birthday" | "bite_level" | "grooming_cycle_weeks">>;
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

type NewCustomerDraft = {
  name: string;
  phone: string;
  petName: string;
  breed: string;
  weight: string;
  petNotes: string;
  memo: string;
  staffMemo: string;
  alertEnabled: boolean;
  needsConsultation: boolean;
};

type OwnerMediaUploadIntentResponse = {
  mediaAsset: MediaAsset;
  upload: {
    signedUrl: string;
    method: string;
    headers: Record<string, string>;
  };
};

type PetAddInput = {
  name: string;
  breed?: string;
  birthday?: string;
  weight?: string;
  biteLevel?: PetBiteLevel;
  profilePhoto?: File | null;
};

type CustomerReservationDraft = {
  guardianId: string;
  petId: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  memo: string;
};

type GuardianDeleteResult = {
  success: boolean;
  guardianIds: string[];
  restoreUntil: string;
};

const emptyNewCustomerDraft: NewCustomerDraft = {
  name: "",
  phone: "",
  petName: "",
  breed: "",
  weight: "",
  petNotes: "",
  memo: "",
  staffMemo: "",
  alertEnabled: true,
  needsConsultation: false,
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

function formatMonthDayTime(date: string, time?: string) {
  return `${formatMonthDay(date)}${time ? ` ${formatClockTime(time)}` : ""}`;
}

function getTimestampParts(value: string | null | undefined) {
  if (!value) return { date: "", time: "" };
  const normalized = value.replace("T", " ");
  const [datePart = "", timePart = ""] = normalized.split(" ");
  return {
    date: datePart.slice(0, 10),
    time: timePart ? formatClockTime(timePart) : "",
  };
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

function formatPetProfile(pet: Pick<Pet, "breed" | "weight" | "notes">) {
  const parts = [
    pet.breed && pet.breed !== "미정" && pet.breed !== "미입력" ? pet.breed : "",
    typeof pet.weight === "number" && Number.isFinite(pet.weight) ? `${pet.weight.toLocaleString("ko-KR")}kg` : "",
  ].filter(Boolean);

  if (parts.length > 0) return parts.join(" · ");
  return pet.notes?.replace(/^고객 입력:\s*/, "").trim() || "견종/몸무게 미입력";
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
    booking_time_proposed: "다른 시간 제안",
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
      dotClassName: getDotIndicatorClass("teal"),
    },
    queued: {
      label: "대기",
      className: "border-[#dbe2ea] bg-white text-[#64748b]",
      dotClassName: getDotIndicatorClass("neutral"),
    },
    failed: {
      label: "실패",
      className: "border-[#efcaca] bg-[#fffafa] text-[#b42318]",
      dotClassName: getDotIndicatorClass("burgundy"),
    },
    mocked: {
      label: "테스트",
      className: "border-[#dbe2ea] bg-[#f8fafc] text-[#475569]",
      dotClassName: getDotIndicatorClass("slate"),
    },
    skipped: {
      label: "건너뜀",
      className: "border-[#eadfd3] bg-[#fffaf4] text-[#9a5b1f]",
      dotClassName: getDotIndicatorClass("amber"),
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
    const recentRecordTime = getTimestampParts(recentRecord?.groomed_at);
    const recentVisitDate = recentRecordTime.date || recentCompletedAppointment?.appointment_date || null;
    const recentVisit = recentRecordTime.date
      ? formatMonthDayTime(recentRecordTime.date, recentRecordTime.time)
      : recentCompletedAppointment
        ? formatMonthDayTime(recentCompletedAppointment.appointment_date, recentCompletedAppointment.appointment_time)
        : "방문 전";
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
        weight: pet.weight,
        notes: pet.notes,
        birthday: pet.birthday ?? null,
        bite_level: normalizePetBiteLevel(pet.bite_level),
        grooming_cycle_weeks: pet.grooming_cycle_weeks,
      })),
      tags: tags.length > 0 ? tags : ["일반"],
      recentVisit,
      recentVisitDate,
      nextBooking: upcomingAppointment ? formatMonthDayTime(upcomingAppointment.appointment_date, upcomingAppointment.appointment_time) : "예약 없음",
      nextBookingDate: upcomingAppointment?.appointment_date ?? null,
      nextBookingService,
      memo: guardian.memo?.trim() || pets.map((pet) => pet.notes).filter(Boolean).join(" / ") || "고객 메모가 없습니다.",
      alerts: alertEnabled ? "알림 수신 중" : "알림 중지",
      alertEnabled,
      appointmentCount: guardianAppointments.length,
      groomingCount: groomingRecords.length,
      noshowCount,
      deleted: Boolean(guardian.deleted_at),
      searchText: buildSearchText([guardian.name, guardian.phone, ...petNames, ...pets.map((pet) => pet.breed), ...tags]),
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
      weight: null,
      notes: "",
      birthday: null,
      bite_level: "none",
      grooming_cycle_weeks: 4,
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

async function uploadOwnerPetProfilePhoto({
  shopId,
  guardianId,
  petId,
  file,
}: {
  shopId: string;
  guardianId: string;
  petId: string;
  file: File;
}) {
  await createOwnerMediaAssetFromFile({ shopId, guardianId, petId }, "customer_shared", file);
  return;

  const intent = await fetchApiJsonWithAuth<OwnerMediaUploadIntentResponse>("/api/owner/media/upload-intents", {
    method: "POST",
    body: JSON.stringify({
      shopId,
      guardianId,
      petId,
      originalFileName: file.name,
      contentType: file.type || "image/jpeg",
      byteSize: file.size,
      mediaKind: "customer_shared",
      visibility: "private",
      retentionPolicy: "standard",
      uploadedFrom: "owner_web",
      metadata: { role: "pet_profile" },
    }),
  });

  const headers = new Headers(intent.upload.headers ?? {});
  if (!headers.has("content-type")) headers.set("content-type", file.type || "image/jpeg");
  const uploadResponse = await fetch(intent.upload.signedUrl, {
    method: intent.upload.method || "PUT",
    headers,
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error("반려동물 프로필 사진 업로드에 실패했습니다.");
  }

  await fetchApiJsonWithAuth<{ mediaAsset: MediaAsset }>("/api/owner/media/complete", {
    method: "POST",
    body: JSON.stringify({
      shopId,
      mediaAssetId: intent.mediaAsset.id,
      byteSize: file.size,
    }),
  });
}

async function deleteOwnerPet(payload: unknown) {
  return fetchApiJsonWithAuth<{ success: boolean; petId: string }>("/api/pets", {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

async function postOwnerAppointment(payload: unknown) {
  return fetchApiJsonWithAuth<Appointment>("/api/appointments", {
    method: "POST",
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

export default function CustomerManagementScreen({
  initialData,
  onCreateReservationForCustomer,
  onDataChange,
}: {
  initialData: BootstrapPayload;
  onCreateReservationForCustomer?: (params: { guardianId: string; petId: string | null }) => void;
  onDataChange?: (data: BootstrapPayload) => void;
}) {
  void onCreateReservationForCustomer;
  const [bootstrapData, setBootstrapData] = useState<BootstrapPayload>(() => initialData);
  const initialCustomers = useMemo(() => {
    const rows = buildCustomerRowsFromBootstrap(bootstrapData);
    const baseRows = rows.length > 0 ? rows : [];
    return shouldUseLocalMockCustomers(bootstrapData) ? [...baseRows, ...buildLocalMockCustomerRows()] : baseRows;
  }, [bootstrapData]);
  const [customers, setCustomers] = useState<CustomerViewRow[]>(() => initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [deletingCustomers, setDeletingCustomers] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerDraft, setNewCustomerDraft] = useState<NewCustomerDraft>(() => emptyNewCustomerDraft);
  const [reservationDraft, setReservationDraft] = useState<CustomerReservationDraft | null>(null);
  const [reservationSaving, setReservationSaving] = useState(false);
  const [reservationError, setReservationError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CustomerSort>("recentDesc");

  useEffect(() => {
    setBootstrapData(initialData);
  }, [initialData]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCustomers(initialCustomers);
      setSelectedCustomerId((current) => (initialCustomers.some((customer) => customer.id === current) ? current : ""));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialCustomers]);

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
  const selectedCustomerDetail = useMemo(
    () => (selectedCustomerId ? buildCustomerDetailFromBootstrap(bootstrapData, selectedCustomerId, selectedPetId) : null),
    [bootstrapData, selectedCustomerId, selectedPetId],
  );
  const displayedCustomerIds = useMemo(() => displayedCustomers.map((row) => row.id), [displayedCustomers]);
  const allDisplayedCustomersSelected =
    displayedCustomerIds.length > 0 && displayedCustomerIds.every((id) => selectedDeleteIds.includes(id));

  function openNewCustomerModal() {
    setSaveError("");
    setNewCustomerDraft(emptyNewCustomerDraft);
    setNewCustomerOpen(true);
  }

  async function addCustomer() {
    const name = newCustomerDraft.name.trim();
    const phone = formatPhoneNumber(newCustomerDraft.phone.trim());
    const petName = newCustomerDraft.petName.trim();
    const breed = newCustomerDraft.breed.trim() || "미입력";
    const memo = newCustomerDraft.memo.trim();
    const petNotes = newCustomerDraft.petNotes.trim();
    const parsedWeight = Number(newCustomerDraft.weight.replace(/[^\d.]/g, ""));
    const weight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : null;

    if (!name || !phone || !petName) {
      setSaveError("보호자명, 연락처, 반려동물 이름을 입력해 주세요.");
      return;
    }

    setSaveError("");
    setCreatingCustomer(true);

    const tags = [newCustomerDraft.needsConsultation ? "상담 필요" : "", newCustomerDraft.alertEnabled ? "알림 수신" : "알림 중지"].filter(Boolean);
    const localId = `G-${Date.now()}`;
    const localPetId = `local-pet-${Date.now()}`;
    const nextCustomer: CustomerViewRow = {
      id: localId,
      name,
      phone,
      pets: [petName],
      petDetails: [{ id: localPetId, name: petName, breed, weight, notes: petNotes, birthday: null, bite_level: "none", grooming_cycle_weeks: 4 }],
      tags: tags.length > 0 ? tags : ["일반"],
      recentVisit: "방문 전",
      recentVisitDate: null,
      nextBooking: "예약 없음",
      nextBookingDate: null,
      nextBookingService: "예약 없음",
      memo: memo || (newCustomerDraft.needsConsultation ? "상담 필요" : "고객 메모가 없습니다."),
      alerts: newCustomerDraft.alertEnabled ? "알림 수신 중" : "알림 중지",
      alertEnabled: newCustomerDraft.alertEnabled,
      appointmentCount: 0,
      groomingCount: 0,
      noshowCount: 0,
      deleted: false,
      searchText: buildSearchText([name, phone, petName, breed, petNotes, memo, ...tags]),
    };

    if (shouldUseLocalMockCustomers(initialData)) {
      setCustomers((current) => [nextCustomer, ...current]);
      setSelectedCustomerId(nextCustomer.id);
      setDetailSheetOpen(true);
      setNewCustomerOpen(false);
      setCreatingCustomer(false);
      return;
    }

    try {
      let guardian = await createOwnerGuardian({
        shopId: initialData.shop.id,
        name,
        phone,
        memo: nextCustomer.memo,
      });

      if (!newCustomerDraft.alertEnabled) {
        guardian = await patchOwnerGuardian({
          shopId: initialData.shop.id,
          guardianId: guardian.id,
          enabled: false,
        });
      }

      const pet = await createOwnerPet({
        shopId: initialData.shop.id,
        guardianId: guardian.id,
        name: petName,
        breed,
        weight,
        birthday: null,
        notes: petNotes,
        biteLevel: "none",
        groomingCycleWeeks: 4,
      });

      const savedCustomer: CustomerViewRow = {
        ...nextCustomer,
        id: guardian.id,
        name: guardian.name,
        phone: guardian.phone,
        petDetails: [{ id: pet.id, name: pet.name, breed: pet.breed, weight: pet.weight, notes: pet.notes, birthday: pet.birthday ?? null, bite_level: normalizePetBiteLevel(pet.bite_level), grooming_cycle_weeks: pet.grooming_cycle_weeks }],
        searchText: buildSearchText([guardian.name, guardian.phone, pet.name, pet.breed, pet.notes, ...nextCustomer.tags]),
      };

      setCustomers((current) => [savedCustomer, ...current]);
      setSelectedCustomerId(guardian.id);
      setDetailSheetOpen(true);
      setNewCustomerOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "고객 추가에 실패했습니다.");
    } finally {
      setCreatingCustomer(false);
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
    setSelectedPetId(null);
    setDetailSheetOpen(true);
  }

  function buildReservationDraft(params?: { guardianId: string; petId: string | null }): CustomerReservationDraft | null {
    const customer = params ? customers.find((row) => row.id === params.guardianId) : selectedCustomer;
    if (!customer) return null;
    const petId = params?.petId ?? customer.petDetails[0]?.id ?? "";
    const serviceId = bootstrapData.services.find((service) => service.is_active)?.id ?? bootstrapData.services[0]?.id ?? "";
    const staffId = bootstrapData.staffMembers[0]?.id ?? "";
    return {
      guardianId: customer.id,
      petId,
      serviceId,
      staffId,
      date: currentDateInTimeZone(),
      time: "",
      memo: "",
    };
  }

  function openCustomerReservationModal(params?: { guardianId: string; petId: string | null }) {
    const draft = buildReservationDraft(params);
    if (!draft) return;
    setReservationError("");
    setReservationDraft(draft);
  }

  function addQuickReservation() {
    openCustomerReservationModal();
  }

  async function createCustomerReservation() {
    if (!reservationDraft || reservationSaving) return;
    const guardian = bootstrapData.guardians.find((item) => item.id === reservationDraft.guardianId);
    const pet = bootstrapData.pets.find((item) => item.id === reservationDraft.petId);
    const service = bootstrapData.services.find((item) => item.id === reservationDraft.serviceId);

    if (!guardian || !pet || !service || !reservationDraft.date || !reservationDraft.time) {
      setReservationError("반려동물, 서비스, 날짜와 시간을 모두 입력해 주세요.");
      return;
    }

    setReservationSaving(true);
    setReservationError("");
    try {
      const appointment = await postOwnerAppointment({
        shopId: initialData.shop.id,
        guardianId: guardian.id,
        petId: pet.id,
        serviceId: service.id,
        staffId: reservationDraft.staffId || null,
        appointmentDate: reservationDraft.date,
        appointmentTime: reservationDraft.time,
        memo: reservationDraft.memo,
        source: "owner",
      });
      setBootstrapData((current) => {
        const nextData = {
          ...current,
          appointments: [...current.appointments.filter((item) => item.id !== appointment.id), appointment],
        };
        onDataChange?.(nextData);
        return nextData;
      });
      setReservationDraft(null);
    } catch (error) {
      setReservationError(error instanceof Error ? error.message : "예약 추가에 실패했습니다.");
    } finally {
      setReservationSaving(false);
    }
  }

  async function toggleAlertStatus() {
    if (!selectedCustomer) return;
    const previousCustomers = customers;
    const previousBootstrapData = bootstrapData;
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
    setBootstrapData((current) => ({
      ...current,
      guardians: current.guardians.map((guardian) =>
        guardian.id === selectedCustomer.id
          ? {
              ...guardian,
              notification_settings: {
                ...guardian.notification_settings,
                enabled: nextAlertEnabled,
              },
            }
          : guardian,
      ),
    }));

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
      setBootstrapData(previousBootstrapData);
      setSaveError(error instanceof Error ? error.message : "알림 수신 상태 저장에 실패했습니다.");
    }
  }

  async function updateGuardianNotificationSettings(customerId: string, patch: Partial<GuardianNotificationSettings>) {
    const currentCustomer = customers.find((row) => row.id === customerId);
    if (!currentCustomer) return;

    const previousCustomers = customers;
    const previousBootstrapData = bootstrapData;
    const nextAlertEnabled = typeof patch.enabled === "boolean" ? patch.enabled : currentCustomer.alertEnabled;
    setSaveError("");
    setCustomers((current) =>
      current.map((row) => {
        if (row.id !== customerId) return row;
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
    setBootstrapData((current) => ({
      ...current,
      guardians: current.guardians.map((guardian) =>
        guardian.id === customerId
          ? {
              ...guardian,
              notification_settings: {
                ...guardian.notification_settings,
                ...patch,
              },
              updated_at: new Date().toISOString(),
            }
          : guardian,
      ),
    }));

    try {
      if (!isLocalOnlyCustomer(currentCustomer)) {
        await patchOwnerGuardian({
          shopId: initialData.shop.id,
          guardianId: customerId,
          notificationSettings: patch,
        });
      }
    } catch (error) {
      setCustomers(previousCustomers);
      setBootstrapData(previousBootstrapData);
      setSaveError(error instanceof Error ? error.message : "알림 설정 저장에 실패했습니다.");
    }
  }

  async function updateCustomer(customerId: string, patch: Partial<Pick<CustomerViewRow, "name" | "phone" | "pets" | "recentVisit" | "nextBooking" | "memo">>) {
    const currentCustomer = customers.find((row) => row.id === customerId);
    if (!currentCustomer) return;

    const previousCustomers = customers;
    const previousBootstrapData = bootstrapData;
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
    setBootstrapData((current) => ({
      ...current,
      guardians: current.guardians.map((guardian) =>
        guardian.id === customerId
          ? {
              ...guardian,
              name: patch.name ?? guardian.name,
              phone: patch.phone ?? guardian.phone,
              memo: patch.memo ?? guardian.memo,
              updated_at: new Date().toISOString(),
            }
          : guardian,
      ),
      pets: patch.pets
        ? current.pets.map((pet) => {
            const petIndex = currentCustomer.petDetails.findIndex((item) => item.id === pet.id);
            return petIndex >= 0 && patch.pets?.[petIndex] ? { ...pet, name: patch.pets[petIndex], updated_at: new Date().toISOString() } : pet;
          })
        : current.pets,
    }));

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
              weight: pet.weight,
              notes: pet.notes,
              biteLevel: normalizePetBiteLevel(pet.bite_level),
              groomingCycleWeeks: pet.grooming_cycle_weeks,
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
                      ...createdPets.map((pet) => ({ id: pet.id, name: pet.name, breed: pet.breed, weight: pet.weight, notes: pet.notes, birthday: pet.birthday ?? null, bite_level: normalizePetBiteLevel(pet.bite_level), grooming_cycle_weeks: pet.grooming_cycle_weeks })),
                    ],
                  }
                : row,
            ),
          );
        }
      }
    } catch (error) {
      setCustomers(previousCustomers);
      setBootstrapData(previousBootstrapData);
      setSaveError(error instanceof Error ? error.message : "고객 정보 저장에 실패했습니다.");
    }
  }

  async function updatePetDetail(
    customerId: string,
    petId: string,
    patch: { name: string; breed: string; birthday: string; weight: string; notes: string; groomingCycleWeeks: string },
  ) {
    const currentCustomer = customers.find((row) => row.id === customerId);
    const targetPet = currentCustomer?.petDetails.find((pet) => pet.id === petId);
    const name = patch.name.trim();
    if (!currentCustomer || !targetPet || !name) return;

    const previousCustomers = customers;
    const previousBootstrapData = bootstrapData;
    const parsedWeight = Number.parseFloat(patch.weight);
    const nextWeight = Number.isFinite(parsedWeight) ? parsedWeight : null;
    const parsedCycle = Number.parseInt(patch.groomingCycleWeeks, 10);
    const nextCycle = Number.isFinite(parsedCycle) && parsedCycle > 0 ? parsedCycle : 4;
    const nextPet = {
      ...targetPet,
      name,
      breed: patch.breed.trim(),
      birthday: patch.birthday.trim() || null,
      weight: nextWeight,
      notes: patch.notes,
      grooming_cycle_weeks: nextCycle,
    };

    setSaveError("");
    setCustomers((current) =>
      current.map((row) => {
        if (row.id !== customerId) return row;
        const nextPetDetails = row.petDetails.map((pet) => (pet.id === petId ? nextPet : pet));
        const nextPets = nextPetDetails.map((pet) => pet.name);
        return {
          ...row,
          pets: nextPets,
          petDetails: nextPetDetails,
          searchText: buildSearchText([row.name, row.phone, ...nextPets, ...nextPetDetails.map((pet) => pet.breed), ...nextPetDetails.map((pet) => pet.notes), ...row.tags]),
        };
      }),
    );
    setBootstrapData((current) => {
      const nextData = {
        ...current,
        pets: current.pets.map((pet) =>
          pet.id === petId
            ? {
                ...pet,
                name: nextPet.name,
                breed: nextPet.breed,
                birthday: nextPet.birthday,
                weight: nextPet.weight,
                notes: nextPet.notes,
                grooming_cycle_weeks: nextPet.grooming_cycle_weeks,
                updated_at: new Date().toISOString(),
              }
            : pet,
        ),
      };
      onDataChange?.(nextData);
      return nextData;
    });

    if (isLocalOnlyCustomer(currentCustomer) || petId.startsWith("local-pet-") || petId.startsWith("mock-pet-")) return;

    try {
      const savedPet = await patchOwnerPet({
        shopId: initialData.shop.id,
        petId,
        name: nextPet.name,
        breed: nextPet.breed || "미입력",
        birthday: nextPet.birthday,
        weight: nextPet.weight,
        notes: nextPet.notes,
        biteLevel: normalizePetBiteLevel(targetPet.bite_level),
        groomingCycleWeeks: nextPet.grooming_cycle_weeks,
      });
      setBootstrapData((current) => {
        const nextData = {
          ...current,
          pets: current.pets.map((pet) =>
            pet.id === petId
              ? {
                  ...pet,
                  ...savedPet,
                  bite_level: savedPet.bite_level === undefined ? normalizePetBiteLevel(targetPet.bite_level) : normalizePetBiteLevel(savedPet.bite_level),
                }
              : pet,
          ),
        };
        onDataChange?.(nextData);
        return nextData;
      });
    } catch (error) {
      setCustomers(previousCustomers);
      setBootstrapData(previousBootstrapData);
      setSaveError(error instanceof Error ? error.message : "반려동물 정보 저장에 실패했습니다.");
      throw error;
    }
  }

  async function addPet(customerId: string, petInput: string | PetAddInput) {
    const currentCustomer = customers.find((row) => row.id === customerId);
    const payload = typeof petInput === "string" ? { name: petInput } : petInput;
    const name = payload.name.trim();
    if (!currentCustomer || !name) return;
    const previousCustomers = customers;
    const previousBootstrapData = bootstrapData;
    const breed = payload.breed?.trim() || "미입력";
    const birthday = payload.birthday?.trim() || null;
    const parsedWeight = payload.weight?.trim() ? Number(payload.weight.replace(/[^0-9.]/g, "")) : null;
    const weight = parsedWeight && Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : null;
    const biteLevel = normalizePetBiteLevel(payload.biteLevel);
    const tempPet = { id: `local-pet-${Date.now()}`, name, breed: "미입력", weight: null, notes: "", birthday: null, bite_level: biteLevel, grooming_cycle_weeks: 4 };
    setSaveError("");
    setCustomers((current) =>
      current.map((row) =>
        row.id === customerId
          ? {
              ...row,
              pets: [...row.pets.filter((item) => item !== "반려동물 없음"), name],
              petDetails: [...row.petDetails, { ...tempPet, breed, weight, birthday }],
              searchText: buildSearchText([row.name, row.phone, ...row.pets, name, ...row.tags]),
            }
          : row,
      ),
    );
    setBootstrapData((current) => ({
      ...current,
      pets: [
        ...current.pets,
        {
          id: tempPet.id,
          shop_id: initialData.shop.id,
          guardian_id: customerId,
          name: tempPet.name,
          breed,
          age: null,
          birthday,
          weight,
          notes: tempPet.notes,
          avatar_seed: tempPet.name.slice(0, 1) || "P",
          bite_level: tempPet.bite_level,
          grooming_cycle_weeks: tempPet.grooming_cycle_weeks,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } satisfies Pet,
      ],
    }));

    if (isLocalOnlyCustomer(currentCustomer)) return;

    try {
      let pet = await createOwnerPet({
        shopId: initialData.shop.id,
        guardianId: customerId,
        name,
        breed: "미입력",
        birthday: null,
        notes: "",
        biteLevel,
        groomingCycleWeeks: 4,
      });
      pet = await patchOwnerPet({
        shopId: initialData.shop.id,
        petId: pet.id,
        name,
        breed,
        birthday,
        weight,
        notes: "",
        biteLevel,
        groomingCycleWeeks: 4,
      });
      if (payload.profilePhoto) {
        await uploadOwnerPetProfilePhoto({
          shopId: initialData.shop.id,
          guardianId: customerId,
          petId: pet.id,
          file: payload.profilePhoto,
        });
      }
      setCustomers((current) =>
        current.map((row) =>
          row.id === customerId
            ? {
                ...row,
                petDetails: row.petDetails.map((item) =>
                  item.id === tempPet.id
                    ? { id: pet.id, name: pet.name, breed: pet.breed, weight: pet.weight, notes: pet.notes, birthday: pet.birthday ?? null, bite_level: normalizePetBiteLevel(pet.bite_level), grooming_cycle_weeks: pet.grooming_cycle_weeks }
                    : item,
                ),
              }
            : row,
        ),
      );
      setBootstrapData((current) => ({
        ...current,
        pets: current.pets.map((item) => (item.id === tempPet.id ? { ...item, ...pet, bite_level: normalizePetBiteLevel(pet.bite_level) } : item)),
      }));
    } catch (error) {
      setCustomers(previousCustomers);
      setBootstrapData(previousBootstrapData);
      setSaveError(error instanceof Error ? error.message : "반려동물 추가에 실패했습니다.");
      throw error;
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

  async function updatePetBiteLevel(customerId: string, petId: string, biteLevel: PetBiteLevel) {
    const currentCustomer = customers.find((row) => row.id === customerId);
    const targetPet = currentCustomer?.petDetails.find((pet) => pet.id === petId);
    if (!currentCustomer || !targetPet) return;

    const normalizedBiteLevel = normalizePetBiteLevel(biteLevel);
    const previousCustomers = customers;
    const previousBootstrapData = bootstrapData;
    setSaveError("");

    setCustomers((current) =>
      current.map((row) => {
        if (row.id !== customerId) return row;
        const nextPetDetails = row.petDetails.map((pet) => (pet.id === petId ? { ...pet, bite_level: normalizedBiteLevel } : pet));
        return {
          ...row,
          petDetails: nextPetDetails,
          searchText: buildSearchText([
            row.name,
            row.phone,
            ...row.pets,
            ...nextPetDetails.map((pet) => pet.breed),
            ...nextPetDetails.map((pet) => pet.notes),
            ...row.tags,
          ]),
        };
      }),
    );

    setBootstrapData((current) => {
      const nextData = {
        ...current,
        pets: current.pets.map((pet) => (pet.id === petId ? { ...pet, bite_level: normalizedBiteLevel, updated_at: new Date().toISOString() } : pet)),
      };
      onDataChange?.(nextData);
      return nextData;
    });

    if (isLocalOnlyCustomer(currentCustomer) || petId.startsWith("local-pet-") || petId.startsWith("mock-pet-")) return;

    try {
      const savedPet = await patchOwnerPet({
        shopId: initialData.shop.id,
        petId,
        name: targetPet.name,
        breed: targetPet.breed || "미입력",
        birthday: targetPet.birthday ?? null,
        weight: targetPet.weight ?? null,
        notes: targetPet.notes ?? "",
        biteLevel: normalizedBiteLevel,
      });

      setBootstrapData((current) => {
        const nextData = {
          ...current,
          pets: current.pets.map((pet) =>
            pet.id === petId
              ? {
                  ...pet,
                  ...savedPet,
                  bite_level: savedPet.bite_level === undefined ? normalizedBiteLevel : normalizePetBiteLevel(savedPet.bite_level),
                }
              : pet,
          ),
        };
        onDataChange?.(nextData);
        return nextData;
      });
    } catch (error) {
      setCustomers(previousCustomers);
      setBootstrapData(previousBootstrapData);
      setSaveError(error instanceof Error ? error.message : "입질 정도 저장에 실패했습니다.");
    }
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="border-b border-[#dbe2ea] px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 min-w-[320px] flex-1 items-center gap-3 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[#64748b] focus-within:border-[#111827]">
              <AssetIcon src="/icons/phosphor/MagnifyingGlass.svg" className="h-4 w-4 text-[#94a3b8]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-[15px] text-[#111827] outline-none placeholder:text-[#94a3b8]"
                placeholder="보호자명, 연락처, 반려동물 이름 검색"
              />
            </label>
            <button
              type="button"
              onClick={openNewCustomerModal}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-[#111827] px-4 text-[14px] font-medium text-white transition hover:bg-[#1f2937]"
            >
              <AssetIcon src="/icons/phosphor/UserCirclePlus.svg" className="h-4 w-4" />
              고객 추가
            </button>
            <button
              type="button"
              aria-label={deleteMode ? "고객 삭제 모드 닫기" : "고객 삭제 모드"}
              onClick={toggleDeleteMode}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-[8px] border transition",
                deleteMode
                  ? "border-[#ead9cf] bg-[#fff7ed] text-[#9a4f1f]"
                  : "border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]",
              )}
            >
              <BasilIcon name="trash" />
            </button>
          </div>
        </div>

        {deleteMode ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 py-3">
            <div>
            <p className="text-[16px] font-medium text-[#111827]">
              {selectedDeleteIds.length}명 선택됨
              <span className="ml-2 text-[16px] font-normal text-[#64748b]">선택한 고객은 삭제 처리됩니다.</span>
            </p>
            {deleteError ? <p className="mt-1 text-[16px] font-medium text-[#b42318]">{deleteError}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleDisplayedCustomerSelection} className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#334155] transition hover:bg-[#f8fafc]" disabled={deletingCustomers}>
                {allDisplayedCustomersSelected ? "선택 해제" : "전체 선택"}
              </button>
              <button type="button" onClick={moveSelectedCustomersToDeleted} className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#9f3a3a] transition hover:border-[#efcaca] hover:bg-[#fffafa] disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]" disabled={selectedDeleteIds.length === 0 || deletingCustomers}>
                선택 삭제
              </button>
            </div>
          </div>
        ) : null}

        {saveError ? (
          <p className="border-b border-[#f4c7cc] bg-[#fff7f8] px-4 py-2 text-[16px] font-medium text-[#b42318]">
            {saveError}
          </p>
        ) : null}

        <div className={cn("grid border-b border-[#dbe2ea] bg-[#f1f2ef] px-4 py-3 text-center text-[16px] font-medium text-[#4f5a64]", customerListGridClass)}>
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
        <div className="min-h-0 flex-1 overflow-y-auto">
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
              <p className="text-[16px] font-medium text-[#111827]">조건에 맞는 고객이 없습니다.</p>
              <p className="mt-1 text-[16px] text-[#64748b]">검색어를 줄이거나 고객을 추가해 주세요.</p>
            </div>
          )}
        </div>
      </section>

      {newCustomerOpen ? (
        <NewCustomerModal
          draft={newCustomerDraft}
          saving={creatingCustomer}
          error={saveError}
          onDraftChange={setNewCustomerDraft}
          onClose={() => {
            if (creatingCustomer) return;
            setNewCustomerOpen(false);
            setSaveError("");
          }}
          onSubmit={() => void addCustomer()}
        />
      ) : null}

      {reservationDraft ? (
        <CustomerReservationModal
          data={bootstrapData}
          draft={reservationDraft}
          saving={reservationSaving}
          error={reservationError}
          onDraftChange={setReservationDraft}
          onClose={() => {
            if (reservationSaving) return;
            setReservationDraft(null);
            setReservationError("");
          }}
          onSubmit={() => void createCustomerReservation()}
        />
      ) : null}

      {selectedCustomer && selectedCustomerDetail && detailSheetOpen ? (
        <CustomerDetailPanel
          detail={selectedCustomerDetail}
          selectedPetId={selectedPetId}
          onSelectPet={setSelectedPetId}
          onUpdatePetBiteLevel={updatePetBiteLevel}
          onUpdateGuardian={(guardianId, patch) => updateCustomer(guardianId, patch)}
          onUpdatePet={updatePetDetail}
          onAddPet={addPet}
          onDeletePet={removePet}
          onToggleGuardianNotifications={() => toggleAlertStatus()}
          onUpdateGuardianNotificationSettings={updateGuardianNotificationSettings}
          onCreateReservation={openCustomerReservationModal}
          onClose={() => setDetailSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CustomerReservationModal({
  data,
  draft,
  saving,
  error,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  data: BootstrapPayload;
  draft: CustomerReservationDraft;
  saving: boolean;
  error: string;
  onDraftChange: (draft: CustomerReservationDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const guardian = data.guardians.find((item) => item.id === draft.guardianId) ?? null;
  const pets = data.pets.filter((pet) => pet.guardian_id === draft.guardianId);
  const selectedPet = pets.find((pet) => pet.id === draft.petId) ?? pets[0] ?? null;
  const services = data.services.filter((service) => service.is_active);
  const selectedService = data.services.find((service) => service.id === draft.serviceId) ?? services[0] ?? data.services[0] ?? null;

  function patchDraft(patch: Partial<CustomerReservationDraft>) {
    onDraftChange({ ...draft, ...patch });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/25 px-4" onClick={onClose}>
      <section
        className="w-full max-w-[560px] rounded-[12px] border border-[#dbe2ea] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-[16px] text-[#64748b]">
              {guardian ? `${guardian.name} 보호자 · ${formatPhoneNumber(guardian.phone)}` : "고객 예약"}
            </p>
            <h3 className="mt-1 flex items-center gap-2 text-[22px] font-semibold text-[#111827]">
              <CalendarPlus className="h-5 w-5 text-[#2f7866]" />
              예약 추가
            </h3>
          </div>
          <button type="button" onClick={onClose} className="h-8 rounded-[7px] border border-[#dbe2ea] px-3 text-[16px] text-[#475569] hover:bg-[#f8fafc]">
            닫기
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[16px] text-[#64748b]">반려동물</span>
              <select
                value={selectedPet?.id ?? ""}
                onChange={(event) => patchDraft({ petId: event.target.value })}
                className="h-11 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-3 text-[16px] text-[#111827] outline-none focus:border-[#2f7866]"
              >
                {pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[16px] text-[#64748b]">담당 직원</span>
              <select
                value={draft.staffId}
                onChange={(event) => patchDraft({ staffId: event.target.value })}
                className="h-11 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-3 text-[16px] text-[#111827] outline-none focus:border-[#2f7866]"
              >
                {data.staffMembers.length === 0 ? <option value="">담당자 없음</option> : null}
                {data.staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[16px] text-[#64748b]">서비스</span>
            <select
              value={selectedService?.id ?? ""}
              onChange={(event) => patchDraft({ serviceId: event.target.value })}
              className="h-11 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-3 text-[16px] text-[#111827] outline-none focus:border-[#2f7866]"
            >
              {(services.length > 0 ? services : data.services).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.duration_minutes}분 · {service.price.toLocaleString("ko-KR")}원
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[16px] text-[#64748b]">예약일</span>
              <input
                type="date"
                value={draft.date}
                onChange={(event) => patchDraft({ date: event.target.value })}
                className="h-11 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-3 text-[16px] text-[#111827] outline-none focus:border-[#2f7866]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[16px] text-[#64748b]">예약 시간</span>
              <input
                type="time"
                step={300}
                value={draft.time}
                onChange={(event) => patchDraft({ time: event.target.value })}
                className="h-11 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-3 text-[16px] text-[#111827] outline-none focus:border-[#2f7866]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[16px] text-[#64748b]">고객 요청사항</span>
            <textarea
              value={draft.memo}
              onChange={(event) => patchDraft({ memo: event.target.value })}
              placeholder="예약에 남길 요청사항을 입력해 주세요."
              className="min-h-[92px] w-full resize-none rounded-[8px] border border-[#cfd8e3] bg-white px-3 py-2 text-[16px] leading-6 text-[#111827] outline-none focus:border-[#2f7866]"
            />
          </label>

          {error ? <p className="rounded-[8px] border border-[#f4c7cc] bg-[#fff7f8] px-3 py-2 text-[16px] text-[#b42318]">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[16px] text-[#334155] hover:bg-[#f8fafc]" disabled={saving}>
              취소
            </button>
            <button type="button" onClick={onSubmit} className="h-10 rounded-[8px] bg-[#2f7866] px-5 text-[16px] font-medium text-white hover:bg-[#286a5a] disabled:bg-[#94a3b8]" disabled={saving}>
              {saving ? "등록 중" : "예약 등록"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function NewCustomerModal({
  draft,
  saving,
  error,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  draft: NewCustomerDraft;
  saving: boolean;
  error: string;
  onDraftChange: (draft: NewCustomerDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  function patchDraft(patch: Partial<NewCustomerDraft>) {
    onDraftChange({ ...draft, ...patch });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-[480px] flex-col border-l border-[#dbe2ea] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] px-5 py-4">
          <div>
            <p className="text-[16px] font-medium text-[#64748b]">고객 관리</p>
            <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-[#111827]">신규 고객 추가</h2>
            <p className="mt-1 text-[16px] leading-5 text-[#64748b]">예약 전에 꼭 필요한 정보만 먼저 등록합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <section className="rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[16px] font-semibold text-[#111827]">보호자 정보</h3>
                <div className="flex items-center gap-2">
                  <label className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] font-medium text-[#334155]">
                    <input
                      type="checkbox"
                      checked={draft.alertEnabled}
                      onChange={(event) => patchDraft({ alertEnabled: event.target.checked })}
                      className="h-3.5 w-3.5 accent-[#2f7866]"
                    />
                    알림 수신
                  </label>
                  <label className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] font-medium text-[#334155]">
                    <input
                      type="checkbox"
                      checked={draft.needsConsultation}
                      onChange={(event) => patchDraft({ needsConsultation: event.target.checked })}
                      className="h-3.5 w-3.5 accent-[#2f7866]"
                    />
                    상담 필요
                  </label>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[16px] font-medium text-[#64748b]">보호자명</span>
                  <input
                    value={draft.name}
                    onChange={(event) => patchDraft({ name: event.target.value })}
                    placeholder="예: 정유진"
                    className="mt-1.5 h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                  />
                </label>
                <label className="block">
                  <span className="text-[16px] font-medium text-[#64748b]">연락처</span>
                  <input
                    value={draft.phone}
                    onChange={(event) => patchDraft({ phone: formatPhoneNumber(event.target.value) })}
                    placeholder="010-0000-0000"
                    className="mt-1.5 h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] tabular-nums text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <h3 className="text-[16px] font-semibold text-[#111827]">반려동물 정보</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[16px] font-medium text-[#64748b]">반려동물 이름</span>
                  <input
                    value={draft.petName}
                    onChange={(event) => patchDraft({ petName: event.target.value })}
                    placeholder="예: 우유"
                    className="mt-1.5 h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                  />
                </label>
                <label className="block">
                  <span className="text-[16px] font-medium text-[#64748b]">품종</span>
                  <input
                    value={draft.breed}
                    onChange={(event) => patchDraft({ breed: event.target.value })}
                    placeholder="미입력 가능"
                    className="mt-1.5 h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                  />
                </label>
                <label className="block">
                  <span className="text-[16px] font-medium text-[#64748b]">몸무게</span>
                  <input
                    value={draft.weight}
                    onChange={(event) => patchDraft({ weight: event.target.value })}
                    placeholder="예: 4.8"
                    className="mt-1.5 h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] tabular-nums text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                  />
                </label>
                <label className="block">
                  <span className="text-[16px] font-medium text-[#64748b]">특이사항</span>
                  <input
                    value={draft.petNotes}
                    onChange={(event) => patchDraft({ petNotes: event.target.value })}
                    placeholder="피부, 성향, 요청 등"
                    className="mt-1.5 h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-[#64748b]" />
                <h3 className="text-[16px] font-semibold text-[#111827]">메모</h3>
              </div>
              <label className="mt-3 block">
                <span className="text-[16px] font-medium text-[#64748b]">고객 요청 / 상담 메모</span>
                <textarea
                  value={draft.memo}
                  onChange={(event) => patchDraft({ memo: event.target.value })}
                  placeholder="예약 전 확인할 고객 요청을 적어주세요."
                  className="mt-1.5 min-h-[92px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[16px] leading-6 text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-[16px] font-medium text-[#64748b]">작업자 공유 메모</span>
                <textarea
                  value={draft.staffMemo}
                  onChange={(event) => patchDraft({ staffMemo: event.target.value })}
                  placeholder="미용 시 바로 볼 내부 메모입니다."
                  className="mt-1.5 min-h-[76px] w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2 text-[16px] leading-6 text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                />
              </label>
            </section>

            {error ? <p className="rounded-[8px] border border-[#f4c7cc] bg-[#fff7f8] px-3 py-2 text-[16px] font-medium text-[#b42318]">{error}</p> : null}
          </div>

          <div className="flex gap-2 border-t border-[#edf2f7] bg-white px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-11 flex-1 rounded-[8px] border border-[#dbe2ea] bg-white text-[16px] font-medium text-[#334155] transition hover:bg-[#f8fafc] disabled:text-[#94a3b8]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-11 flex-[1.6] rounded-[8px] bg-[#2f7866] text-[16px] font-semibold text-white transition hover:bg-[#286a5a] disabled:bg-[#94a3b8]"
            >
              {saving ? "추가 중" : "고객 추가"}
            </button>
          </div>
        </form>
      </aside>
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
          <span className={row.noshowCount >= 2 ? getDotIndicatorClass("burgundy") : row.alertEnabled ? getDotIndicatorClass("teal") : getDotIndicatorClass("neutral")} />
        )}
      </span>
      <span className="min-w-0 text-center">
        <span className="block truncate text-[16px] font-normal text-[#334155]">{row.name}</span>
      </span>
      <span className="truncate text-center text-[16px] font-normal text-[#334155]">{row.pets.join(", ")}</span>
      <span className="truncate text-center text-[16px] font-normal tabular-nums text-[#334155]">{formatPhoneNumber(row.phone)}</span>
      <span className={cn("truncate text-center text-[16px] font-normal", row.nextBookingDate ? "text-[#334155]" : "text-[#94a3b8]")}>{row.nextBooking}</span>
      <span className="flex min-w-0 justify-center">
        <span className={cn("inline-flex h-7 items-center rounded-full px-2.5 text-[16px] font-normal", row.alertEnabled ? "bg-[#eef7f4] text-[#1f6b5b]" : "bg-[#f1f5f9] text-[#64748b]")}>
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
              displayTextClassName="text-[16px] font-semibold leading-[34px] tracking-[-0.02em] text-[#111827]"
              inputClassName="h-11 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-2 text-[16px] font-semibold tracking-[-0.02em] text-[#111827] outline-none focus:border-[#1f6b5b]"
            />
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <EditableText
                value={formattedPhone}
                onSave={(value) => updateEditableField("phone", value)}
                displayClassName="min-w-fit text-left"
                displayTextClassName="text-[16px] font-medium tabular-nums text-[#334155]"
                inputClassName="h-10 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-2 text-[16px] font-medium tabular-nums text-[#111827] outline-none focus:border-[#1f6b5b]"
              />
              {visibleTags.map((tag) => (
                <span key={tag} className={cn("inline-flex h-6 items-center rounded-[6px] px-2.5 text-[16px] font-medium", getCustomerTagClass(tag))}>
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
              <p className="text-[16px] font-medium text-[#64748b]">다음 예약</p>
              <button
                type="button"
                onClick={onAddQuickReservation}
                className="absolute right-4 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1 rounded-[7px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] font-medium text-[#334155] hover:bg-[#f8fafc]"
              >
                {customer.nextBookingDate ? "예약 변경" : "예약 추가"}
              </button>
            </div>
            <EditableText
              value={customer.nextBooking}
              onSave={(value) => updateEditableField("nextBooking", value)}
              displayClassName="mt-1.5 block w-full text-left"
              displayTextClassName="text-[16px] font-semibold leading-[28px] text-[#111827]"
              inputClassName="mt-2 h-10 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-2 text-[16px] font-semibold text-[#111827] outline-none focus:border-[#1f6b5b]"
            />
            <p className="mt-0.5 truncate text-[16px] leading-5 text-[#64748b]">{nextBookingDetail}</p>
          </section>

          <section className="mt-4 divide-y divide-[#edf2f7] border-y border-[#edf2f7]">
            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3 py-3">
              <p className="text-[16px] font-medium text-[#64748b]">반려동물</p>
              <div className="min-w-0 space-y-2">
                {(customer.petDetails.length > 0
                  ? customer.petDetails
                  : customer.pets.map((name, index) => ({ id: `local-pet-${index}`, name, breed: "미입력", weight: null, notes: "", birthday: null }))
                ).map((pet, index) => (
                  <div key={pet.id} className="flex min-w-0 items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-baseline gap-3">
                        <EditableText
                          value={pet.name}
                          onSave={(value) => {
                            const nextPets = [...customer.pets];
                            nextPets[index] = value;
                            updateEditableField("pets", nextPets.join(", "));
                          }}
                          displayClassName="min-w-0 shrink-0 text-left"
                          displayTextClassName="text-[16px] font-medium leading-5 text-[#111827]"
                          inputClassName="h-9 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-2 text-[16px] font-medium text-[#111827] outline-none focus:border-[#1f6b5b]"
                        />
                        <p className="min-w-0 truncate text-[16px] font-normal leading-5 text-[#64748b]">{formatPetProfile(pet)}</p>
                      </div>
                    </div>
                    {customer.petDetails.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => void onDeletePet(customer.id, pet.id)}
                        className="mt-0.5 h-8 rounded-[7px] border border-[#ead9cf] bg-white px-2 text-[16px] font-medium text-[#94624f] hover:bg-[#fffafa]"
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
                    className="h-9 min-w-0 flex-1 rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-[16px] text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#1f6b5b]"
                  />
                  <button type="submit" className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#334155] hover:bg-[#f8fafc]">
                    추가
                  </button>
                </form>
              </div>
            </div>
            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 py-3">
              <p className="text-[16px] font-medium text-[#64748b]">최근 방문</p>
              <EditableText
                value={customer.recentVisit}
                onSave={(value) => updateEditableField("recentVisit", value)}
                displayClassName="min-w-0 text-left"
                displayTextClassName="text-[16px] font-medium text-[#111827]"
                inputClassName="h-9 w-full rounded-[8px] border border-[#cfd8e3] bg-white px-2 text-[16px] font-medium text-[#111827] outline-none focus:border-[#1f6b5b]"
              />
            </div>
            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 py-3">
              <p className="text-[16px] font-medium text-[#64748b]">알림</p>
              <button type="button" onClick={() => void onToggleAlertStatus()} className="w-fit text-left text-[16px] font-medium text-[#111827] hover:text-[#1f6b5b]">
                {customer.alerts}
              </button>
            </div>
          </section>

          {customer.noshowCount >= 2 ? (
            <section className="mt-3 rounded-[8px] border border-[#f4c7cc] bg-[#fff7f8] px-4 py-3">
              <p className="text-[16px] font-semibold text-[#b42318]">노쇼 주의 고객</p>
              <p className="mt-1 text-[16px] leading-5 text-[#7f1d1d]">노쇼가 {customer.noshowCount}회 기록되었습니다. 예약 확정 전에 재확인이 필요합니다.</p>
            </section>
          ) : null}

          <section className="mt-5">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-[#64748b]" />
              <h3 className="text-[16px] font-semibold text-[#111827]">메모</h3>
            </div>
            <div className="mt-2 rounded-[8px] border border-[#dbe2ea] bg-white p-4">
              <p className="text-[16px] font-medium text-[#64748b]">고객 메모</p>
              <EditableText
                value={customer.memo}
                onSave={(value) => updateEditableField("memo", value)}
                multiline
                displayClassName="mt-1.5 block w-full text-left"
                displayTextClassName="whitespace-pre-wrap text-[16px] leading-6 text-[#111827]"
                inputClassName="mt-1.5 min-h-[72px] w-full resize-none rounded-[8px] border border-[#cfd8e3] bg-white px-3 py-2 text-[16px] leading-6 text-[#111827] outline-none focus:border-[#1f6b5b]"
              />
              <div className="my-3 h-px bg-[#edf2f7]" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[16px] font-medium text-[#64748b]">작업 메모</p>
                <span className="text-[16px] font-medium text-[#94a3b8]">스태프 공유</span>
              </div>
              <textarea
                value={staffComment}
                onChange={(event) => onChangeStaffComment(event.target.value)}
                placeholder="작업 시 주의할 점을 적어주세요."
                className="mt-1.5 h-[88px] w-full resize-none rounded-[8px] border border-[#cfd8e3] bg-white px-3 py-2 text-[16px] leading-6 text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#1f6b5b]"
              />
            </div>
          </section>

          <section className="mt-4 rounded-[8px] border border-[#dbe2ea] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#edf2f7] px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#64748b]" />
                <h3 className="text-[16px] font-medium text-[#111827]">알림 이력</h3>
              </div>
              <span className="text-[16px] text-[#94a3b8]">최근 {notifications.length}건</span>
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
                            <p className="truncate text-[16px] font-medium text-[#111827]">{getNotificationTypeLabel(notification.type)}</p>
                          </div>
                          <p className="mt-1 truncate text-[16px] text-[#64748b]">{notification.message || "발송 메시지 내용이 없습니다."}</p>
                          {reason ? <p className="mt-1 text-[16px] leading-5 text-[#b42318]">{reason}</p> : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={cn("inline-flex h-6 items-center rounded-[6px] border px-2 text-[16px] font-medium", statusMeta.className)}>
                            {statusMeta.label}
                          </span>
                          <p className="mt-1 text-[16px] tabular-nums text-[#94a3b8]">{deliveredAt}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-4 text-[16px] leading-5 text-[#64748b]">
                아직 이 고객에게 기록된 알림이 없습니다.
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-[#edf2f7] bg-white px-5 py-3.5">
          <button type="button" onClick={onToggleDeleteMode} className="inline-flex h-8 items-center gap-1.5 text-[16px] font-medium text-[#94624f] hover:underline">
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
