import type {
  AppointmentDto,
  AppointmentStatus,
  GroomingRecordDto,
  GuardianDto,
  NotificationDto,
  OwnerBootstrapDto,
  PetDto,
  ServiceDto,
  ShopDto,
} from "@/types/bootstrap";
import { getAppointmentSourceLabel, getAppointmentStatusLabel, getAppointmentStatusSection, type AppointmentStatusSection } from "@/viewModels/status";

export type ShopSummaryViewModel = {
  id: string;
  name: string;
  phone: string;
  address: string;
  description: string;
  ownerEmail: string;
  bookingEntryLabel: string;
};

export type AppointmentRowViewModel = {
  id: string;
  date: string;
  time: string;
  customerName: string;
  guardianPhone: string;
  petName: string;
  petAvatarSeed: string;
  serviceName: string;
  serviceDurationMinutes: number;
  status: AppointmentStatus;
  statusLabel: string;
  section: AppointmentStatusSection;
  sourceLabel: string;
  memo: string;
  staffLabel: string;
};

export type AppointmentDetailViewModel = AppointmentRowViewModel & {
  endTime: string;
  servicePriceLabel: string;
  petBreed: string;
  petNotes: string;
  rejectionReason: string | null;
};

export type TodayHomeViewModel = {
  shop: ShopSummaryViewModel;
  stats: {
    pending: number;
    active: number;
    completed: number;
    cancelChange: number;
  };
  pendingReservations: AppointmentRowViewModel[];
  activeReservations: AppointmentRowViewModel[];
  completedReservations: AppointmentRowViewModel[];
  cancelChangeReservations: AppointmentRowViewModel[];
};

export type CustomerSummaryViewModel = {
  id: string;
  name: string;
  phone: string;
  petNames: string[];
  avatarSeed: string;
  latestVisitLabel: string;
  nextBookingLabel: string;
  memo: string;
  alertLabel: string;
  tags: string[];
};

export type CustomerDetailViewModel = CustomerSummaryViewModel & {
  pets: Array<{
    id: string;
    name: string;
    breed: string;
    birthday: string | null;
    notes: string;
    groomingCycleWeeks: number;
    avatarSeed: string;
  }>;
  appointments: AppointmentRowViewModel[];
  groomingRecords: Array<{
    id: string;
    petName: string;
    serviceName: string;
    groomedAt: string;
    styleNotes: string;
    memo: string;
    pricePaidLabel: string;
  }>;
  notifications: Array<{
    id: string;
    message: string;
    status: string;
    channel: string;
    createdAt: string;
  }>;
};

export type SettingsSummaryViewModel = {
  shop: ShopSummaryViewModel;
  businessHoursSummary: string;
  bookingPolicySummary: string;
  notificationSummary: string;
  serviceSummary: string;
  customerPageSummary: string;
  accountEmail: string;
  rows: Array<{
    key: string;
    label: string;
    description: string;
  }>;
};

const DEFAULT_STAFF_LABEL = "담당자 미지정";
const EMPTY_LABEL = "없음";

export function buildAppointmentRows(dto: OwnerBootstrapDto, date?: string): AppointmentRowViewModel[] {
  return dto.appointments
    .filter((appointment) => !date || appointment.appointment_date === date)
    .sort(compareAppointments)
    .map((appointment) => toAppointmentRow(dto, appointment));
}

export function buildTodayHomeViewModel(dto: OwnerBootstrapDto, today: string): TodayHomeViewModel {
  const rows = buildAppointmentRows(dto, today);

  return {
    shop: buildShopSummaryViewModel(dto.shop, dto.ownerProfile.email),
    stats: {
      pending: rows.filter((row) => row.section === "pending").length,
      active: rows.filter((row) => row.section === "active").length,
      completed: rows.filter((row) => row.section === "completed").length,
      cancelChange: rows.filter((row) => row.section === "cancelChange").length,
    },
    pendingReservations: rows.filter((row) => row.section === "pending"),
    activeReservations: rows.filter((row) => row.section === "active"),
    completedReservations: rows.filter((row) => row.section === "completed"),
    cancelChangeReservations: rows.filter((row) => row.section === "cancelChange"),
  };
}

export function buildAppointmentDetailViewModel(dto: OwnerBootstrapDto, appointmentId: string): AppointmentDetailViewModel | null {
  const appointment = dto.appointments.find((item) => item.id === appointmentId);
  if (!appointment) return null;

  const row = toAppointmentRow(dto, appointment);
  const service = findService(dto, appointment.service_id);
  const pet = findPet(dto, appointment.pet_id);

  return {
    ...row,
    endTime: formatClockTime(appointment.end_at.slice(11, 16) || appointment.appointment_time),
    servicePriceLabel: service ? formatWon(service.price, service.price_type) : EMPTY_LABEL,
    petBreed: pet?.breed ?? EMPTY_LABEL,
    petNotes: pet?.notes || EMPTY_LABEL,
    rejectionReason: appointment.rejection_reason,
  };
}

export function buildCustomerSummaries(dto: OwnerBootstrapDto): CustomerSummaryViewModel[] {
  return dto.guardians.map((guardian) => toCustomerSummary(dto, guardian));
}

export function buildCustomerDetailViewModel(dto: OwnerBootstrapDto, guardianId: string): CustomerDetailViewModel | null {
  const guardian = dto.guardians.find((item) => item.id === guardianId);
  if (!guardian) return null;

  const summary = toCustomerSummary(dto, guardian);
  const pets = findPetsByGuardian(dto, guardian.id);
  const petIds = new Set(pets.map((pet) => pet.id));
  const appointments = dto.appointments
    .filter((appointment) => appointment.guardian_id === guardian.id || petIds.has(appointment.pet_id))
    .sort(compareAppointments)
    .map((appointment) => toAppointmentRow(dto, appointment));
  const groomingRecords = dto.groomingRecords
    .filter((record) => record.guardian_id === guardian.id || petIds.has(record.pet_id))
    .sort((a, b) => b.groomed_at.localeCompare(a.groomed_at))
    .map((record) => toGroomingRecordViewModel(dto, record));
  const notifications = dto.notifications
    .filter((notification) => notification.guardian_id === guardian.id || (notification.pet_id ? petIds.has(notification.pet_id) : false))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(toNotificationViewModel);

  return {
    ...summary,
    pets: pets.map((pet) => ({
      id: pet.id,
      name: pet.name,
      breed: pet.breed,
      birthday: pet.birthday,
      notes: pet.notes,
      groomingCycleWeeks: pet.grooming_cycle_weeks,
      avatarSeed: pet.avatar_seed,
    })),
    appointments,
    groomingRecords,
    notifications,
  };
}

export function buildSettingsSummaryViewModel(dto: OwnerBootstrapDto): SettingsSummaryViewModel {
  const activeServices = dto.services.filter((service) => service.is_active);

  return {
    shop: buildShopSummaryViewModel(dto.shop, dto.ownerProfile.email),
    businessHoursSummary: formatBusinessHoursSummary(dto.shop),
    bookingPolicySummary: `동시 예약 ${dto.shop.concurrent_capacity}명 · ${dto.shop.booking_slot_interval_minutes}분 간격`,
    notificationSummary: dto.shop.notification_settings.enabled ? "알림톡 전체 사용 중" : "알림톡 전체 꺼짐",
    serviceSummary: `${activeServices.length}개 서비스 운영 중`,
    customerPageSummary: dto.shop.customer_page_settings.show_notices ? "고객 예약 화면 안내 노출 중" : "고객 예약 화면 안내 숨김",
    accountEmail: dto.ownerProfile.email ?? "계정 이메일 미지정",
    rows: [
      { key: "shop", label: "매장 기본 정보", description: "대표 이미지, 매장명, 연락처, 소개 문구" },
      { key: "hours", label: "운영 시간", description: formatBusinessHoursSummary(dto.shop) },
      { key: "policy", label: "예약 정책", description: `동시 예약 ${dto.shop.concurrent_capacity}명, ${dto.shop.approval_mode === "manual" ? "직접 승인" : "바로 승인"}` },
      { key: "alerts", label: "알림톡 설정", description: dto.shop.notification_settings.enabled ? "예약 확정, 취소, 변경, 완료 안내 사용" : "알림톡 전체 꺼짐" },
      { key: "services", label: "서비스 관리", description: `${activeServices.length}개 활성 서비스, 총 ${dto.services.length}개 등록` },
      { key: "billing", label: "결제 설정", description: "구독 플랜과 결제 수단은 다음 단계에서 연결" },
    ],
  };
}

function buildShopSummaryViewModel(shop: ShopDto, ownerEmail: string | null): ShopSummaryViewModel {
  return {
    id: shop.id,
    name: shop.name,
    phone: shop.phone,
    address: shop.address,
    description: shop.description,
    ownerEmail: ownerEmail ?? "owner@example.com",
    bookingEntryLabel: `/entry/${shop.id}`,
  };
}

function toAppointmentRow(dto: OwnerBootstrapDto, appointment: AppointmentDto): AppointmentRowViewModel {
  const guardian = findGuardian(dto, appointment.guardian_id);
  const pet = findPet(dto, appointment.pet_id);
  const service = findService(dto, appointment.service_id);

  return {
    id: appointment.id,
    date: appointment.appointment_date,
    time: formatClockTime(appointment.appointment_time),
    customerName: guardian?.name ?? "보호자 없음",
    guardianPhone: guardian?.phone ?? EMPTY_LABEL,
    petName: pet?.name ?? "반려동물 없음",
    petAvatarSeed: pet?.avatar_seed ?? "•",
    serviceName: service?.name ?? "서비스 없음",
    serviceDurationMinutes: service?.duration_minutes ?? 0,
    status: appointment.status,
    statusLabel: getAppointmentStatusLabel(appointment.status),
    section: getAppointmentStatusSection(appointment.status),
    sourceLabel: getAppointmentSourceLabel(appointment.source),
    memo: appointment.memo,
    staffLabel: DEFAULT_STAFF_LABEL,
  };
}

function toCustomerSummary(dto: OwnerBootstrapDto, guardian: GuardianDto): CustomerSummaryViewModel {
  const pets = findPetsByGuardian(dto, guardian.id);
  const petIds = new Set(pets.map((pet) => pet.id));
  const appointments = dto.appointments
    .filter((appointment) => appointment.guardian_id === guardian.id || petIds.has(appointment.pet_id))
    .sort(compareAppointments);
  const groomingRecords = dto.groomingRecords
    .filter((record) => record.guardian_id === guardian.id || petIds.has(record.pet_id))
    .sort((a, b) => b.groomed_at.localeCompare(a.groomed_at));
  const nextAppointment = appointments.find((appointment) => ["pending", "confirmed", "in_progress", "almost_done"].includes(appointment.status));

  return {
    id: guardian.id,
    name: guardian.name,
    phone: guardian.phone,
    petNames: pets.map((pet) => pet.name),
    avatarSeed: pets[0]?.avatar_seed ?? guardian.name.slice(0, 1),
    latestVisitLabel: groomingRecords[0] ? formatShortDate(groomingRecords[0].groomed_at.slice(0, 10)) : "방문 전",
    nextBookingLabel: nextAppointment ? `${formatRelativeDate(nextAppointment.appointment_date)} ${formatClockTime(nextAppointment.appointment_time)}` : "예약 없음",
    memo: guardian.memo,
    alertLabel: formatGuardianAlertLabel(guardian),
    tags: buildCustomerTags(guardian, pets, appointments, groomingRecords),
  };
}

function toGroomingRecordViewModel(dto: OwnerBootstrapDto, record: GroomingRecordDto) {
  const pet = findPet(dto, record.pet_id);
  const service = findService(dto, record.service_id);

  return {
    id: record.id,
    petName: pet?.name ?? "반려동물 없음",
    serviceName: service?.name ?? "서비스 없음",
    groomedAt: formatShortDate(record.groomed_at.slice(0, 10)),
    styleNotes: record.style_notes || EMPTY_LABEL,
    memo: record.memo || EMPTY_LABEL,
    pricePaidLabel: formatWon(record.price_paid),
  };
}

function toNotificationViewModel(notification: NotificationDto) {
  return {
    id: notification.id,
    message: notification.message,
    status: notification.status,
    channel: notification.channel,
    createdAt: formatShortDate(notification.created_at.slice(0, 10)),
  };
}

function findGuardian(dto: OwnerBootstrapDto, guardianId: string) {
  return dto.guardians.find((guardian) => guardian.id === guardianId);
}

function findPet(dto: OwnerBootstrapDto, petId: string) {
  return dto.pets.find((pet) => pet.id === petId);
}

function findService(dto: OwnerBootstrapDto, serviceId: string) {
  return dto.services.find((service) => service.id === serviceId);
}

function findPetsByGuardian(dto: OwnerBootstrapDto, guardianId: string) {
  return dto.pets.filter((pet) => pet.guardian_id === guardianId);
}

function compareAppointments(a: AppointmentDto, b: AppointmentDto) {
  return `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`);
}

function formatClockTime(value: string) {
  return value.slice(0, 5);
}

function formatRelativeDate(date: string) {
  return date === "2026-05-08" ? "오늘" : formatShortDate(date);
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatWon(value: number, priceType?: ServiceDto["price_type"]) {
  const prefix = priceType === "starting" ? "부터 " : "";
  return `${prefix}${value.toLocaleString("ko-KR")}원`;
}

function formatGuardianAlertLabel(guardian: GuardianDto) {
  if (!guardian.notification_settings.enabled) return "알림톡 수신 꺼짐";
  if (guardian.notification_settings.revisit_enabled) return "재방문 안내 켜짐";
  return "알림톡 수신 중";
}

function buildCustomerTags(guardian: GuardianDto, pets: PetDto[], appointments: AppointmentDto[], groomingRecords: GroomingRecordDto[]) {
  const tags: string[] = [];

  if (groomingRecords.length === 0) tags.push("신규");
  if (guardian.memo.trim()) tags.push("상담 필요");
  if (groomingRecords.length >= 2) tags.push("정기 고객");
  if (pets.some((pet) => pet.grooming_cycle_weeks <= 4)) tags.push("재방문 임박");
  if (appointments.some((appointment) => appointment.status === "pending")) tags.push("승인 대기");

  return tags.length > 0 ? tags : ["미납 없음"];
}

function formatBusinessHoursSummary(shop: ShopDto) {
  const monday = shop.business_hours[1];
  if (!monday) return "운영 시간 미설정";

  return `${monday.open} - ${monday.close} · 정기 휴무 ${shop.regular_closed_days.length}일`;
}
